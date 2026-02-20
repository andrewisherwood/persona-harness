import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import type { RunConfig, RunResult, PersonaRunResult, ProgressCallback } from "./types.js";
import { EdgeFunctionClient, extractTextFromResponse, isConversationComplete } from "./edge-function-client.js";
import type { ChatMessage } from "./edge-function-client.js";
import { CostTracker } from "./cost-tracker.js";
import type { SupabaseConfig } from "./supabase-client.js";
import { createServiceClient, createTestSiteSpec, getSiteSpec, upsertSiteSpec, validateConfig } from "./supabase-client.js";
import type { Persona, Criterion } from "../../../personas/schema.js";

const RUNS_DIR = join(process.cwd(), "runs");
const PERSONAS_DIR = join(process.cwd(), "personas/birthbuild");

export class Orchestrator {
  private edgeClient: EdgeFunctionClient;
  private supabaseConfig: SupabaseConfig;
  private anthropic: Anthropic;

  constructor(supabaseConfig: SupabaseConfig) {
    this.supabaseConfig = supabaseConfig;
    this.edgeClient = new EdgeFunctionClient({
      supabaseUrl: supabaseConfig.supabaseUrl,
      authToken: supabaseConfig.authToken,
    });
    this.anthropic = new Anthropic();
  }

  async executeRun(config: RunConfig, onProgress: ProgressCallback): Promise<RunResult> {
    // Fail fast with a clear message if Supabase is not configured
    if (!this.supabaseConfig.supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is not set. Add it to your .env file and restart the server (tsx watch does not reload .env changes).",
      );
    }
    if (!this.supabaseConfig.authToken) {
      throw new Error(
        "AUTH_TOKEN is not set. Add your Supabase user JWT to .env and restart the server.",
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    // Use the run UUID as directory name so the client can look it up by ID
    const runDir = join(RUNS_DIR, config.id);
    mkdirSync(runDir, { recursive: true });

    const result: RunResult = {
      id: config.id,
      config,
      timestamp,
      personas: {},
      totalCost: 0,
    };

    writeFileSync(join(runDir, "config.json"), JSON.stringify(config, null, 2));

    for (const personaId of config.personas) {
      const personaResult = await this.executePersonaRun(config, personaId, runDir, onProgress);
      result.personas[personaId] = personaResult;
      result.totalCost += (personaResult.cost as Record<string, unknown>).total_usd as number ?? 0;
    }

    writeFileSync(join(runDir, "summary.json"), JSON.stringify(result, null, 2));
    return result;
  }

  private async executePersonaRun(
    config: RunConfig,
    personaId: string,
    runDir: string,
    onProgress: ProgressCallback,
  ): Promise<PersonaRunResult> {
    const personaDir = join(runDir, personaId);
    mkdirSync(personaDir, { recursive: true });
    const costTracker = new CostTracker();

    try {
      const personaPath = join(PERSONAS_DIR, `${personaId}.json`);
      if (!existsSync(personaPath)) throw new Error(`Persona not found: ${personaId}`);
      const persona: Persona = JSON.parse(readFileSync(personaPath, "utf-8")) as Persona;

      if (config.mode === "build-only") {
        return await this.executeBuildOnly(config, personaId, personaDir, costTracker, onProgress);
      }
      return await this.executeFullPipeline(config, persona, personaDir, costTracker, onProgress);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      onProgress({ runId: config.id, persona: personaId, step: "error" });
      return {
        personaId,
        conversation: [],
        siteSpec: null,
        evaluation: null,
        cost: costTracker.getSummary(),
        previewUrl: null,
        error,
      };
    }
  }

  private async executeFullPipeline(
    config: RunConfig,
    persona: Persona,
    personaDir: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<PersonaRunResult> {
    onProgress({ runId: config.id, persona: persona.id, step: "chatting" });
    validateConfig(this.supabaseConfig);

    // Create test site_spec in Supabase
    const supabase = createServiceClient(this.supabaseConfig);
    const siteSpecId = await createTestSiteSpec(
      supabase, this.supabaseConfig.testTenantId, this.supabaseConfig.testUserId,
    );

    // Run conversation
    const conversation = await this.runConversation(config, persona, siteSpecId, costTracker, onProgress);
    writeFileSync(join(personaDir, "conversation.json"), JSON.stringify(conversation, null, 2));

    // Read final site_spec from Supabase
    const siteSpec = await getSiteSpec(supabase, siteSpecId);
    writeFileSync(join(personaDir, "site-spec.json"), JSON.stringify(siteSpec, null, 2));

    // Evaluate
    let evaluation: Record<string, unknown> | null = null;
    if (!config.skipEvaluation) {
      onProgress({ runId: config.id, persona: persona.id, step: "evaluating" });
      evaluation = await this.evaluate(persona, conversation, config.judgeModel, costTracker);
      writeFileSync(join(personaDir, "evaluation.json"), JSON.stringify(evaluation, null, 2));
    }

    // Build + deploy — failures here should not lose conversation/evaluation data
    let previewUrl: string | null = null;
    let buildError: string | null = null;
    if (!config.skipBuild) {
      try {
        onProgress({ runId: config.id, persona: persona.id, step: "building" });
        // TODO: Generate HTML/CSS files from site_spec before calling build.
        // The /build endpoint requires files[] with generated content.
        // For now, pass an empty files array as a placeholder.
        const buildResult = await this.edgeClient.triggerBuild(siteSpecId, []);
        previewUrl = buildResult.preview_url;

        onProgress({ runId: config.id, persona: persona.id, step: "deploying" });
        const publishResult = await this.edgeClient.triggerPublish(siteSpecId, "publish");
        if (publishResult.deploy_url) {
          previewUrl = publishResult.deploy_url;
        }
        writeFileSync(join(personaDir, "preview-url.txt"), previewUrl);
      } catch (err) {
        buildError = err instanceof Error ? err.message : String(err);
      }
    }

    const cost = costTracker.getSummary();
    writeFileSync(join(personaDir, "cost.json"), JSON.stringify(cost, null, 2));

    onProgress({ runId: config.id, persona: persona.id, step: "complete" });

    return { personaId: persona.id, conversation, siteSpec, evaluation, cost, previewUrl, error: buildError };
  }

  private async executeBuildOnly(
    config: RunConfig,
    personaId: string,
    personaDir: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<PersonaRunResult> {
    const savedSpec = this.findLatestSavedSpec(personaId);
    if (!savedSpec) throw new Error(`No saved site_spec found for ${personaId}`);

    const supabase = createServiceClient(this.supabaseConfig);
    const siteSpecId = await createTestSiteSpec(
      supabase, this.supabaseConfig.testTenantId, this.supabaseConfig.testUserId,
    );
    await upsertSiteSpec(supabase, siteSpecId, savedSpec);

    onProgress({ runId: config.id, persona: personaId, step: "building" });
    // TODO: Generate HTML/CSS files from saved spec before calling build.
    // The /build endpoint requires files[] with generated content.
    const buildResult = await this.edgeClient.triggerBuild(siteSpecId, []);
    const previewUrl = buildResult.preview_url;

    onProgress({ runId: config.id, persona: personaId, step: "deploying" });
    const publishResult = await this.edgeClient.triggerPublish(siteSpecId, "publish");
    const deployUrl = publishResult.deploy_url ?? previewUrl;
    writeFileSync(join(personaDir, "preview-url.txt"), deployUrl);

    const cost = costTracker.getSummary();
    writeFileSync(join(personaDir, "cost.json"), JSON.stringify(cost, null, 2));

    onProgress({ runId: config.id, persona: personaId, step: "complete" });

    return { personaId, conversation: [], siteSpec: savedSpec, evaluation: null, cost, previewUrl: deployUrl, error: null };
  }

  private async runConversation(
    config: RunConfig,
    persona: Persona,
    _siteSpecId: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<Array<{ turn: number; role: string; content: string; timestamp: string }>> {
    // Import persona system prompt builder from existing lib
    const { buildPersonaSystemPrompt } = await import("../../../lib/persona-agent.js");
    const personaSystemPrompt = buildPersonaSystemPrompt(persona);

    const conversation: Array<{ turn: number; role: string; content: string; timestamp: string }> = [];
    // Messages array sent to the /chat edge function (full conversation history)
    const chatMessages: ChatMessage[] = [];
    let turnNumber = 0;

    // Get initial greeting by sending "Hi" via edge function
    chatMessages.push({ role: "user", content: "Hi" });
    const greetingResponse = await this.edgeClient.sendChatMessage(chatMessages);
    const greetingText = extractTextFromResponse(greetingResponse) || "[The chatbot is ready]";

    turnNumber++;
    conversation.push({ turn: turnNumber, role: "user", content: "Hi", timestamp: new Date().toISOString() });
    turnNumber++;
    conversation.push({ turn: turnNumber, role: "assistant", content: greetingText, timestamp: new Date().toISOString() });

    chatMessages.push({ role: "assistant", content: greetingText });

    onProgress({
      runId: config.id, persona: persona.id, step: "chatting",
      turn: turnNumber, message: { role: "assistant", content: greetingText },
    });

    // Persona sees chatbot messages as "user" (incoming) and its own replies as "assistant"
    const personaHistory: Anthropic.MessageParam[] = [
      { role: "user", content: greetingText },
    ];

    let complete = isConversationComplete(greetingResponse);

    while (turnNumber < config.maxTurns * 2 && !complete) {
      // Persona generates response
      const personaResponse = await this.anthropic.messages.create({
        model: config.personaModel,
        max_tokens: 1024,
        system: personaSystemPrompt,
        messages: personaHistory,
      });

      const personaText = personaResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("") || "Okay.";

      costTracker.recordDirectCall("persona_agent", {
        model: config.personaModel,
        inputTokens: personaResponse.usage.input_tokens,
        outputTokens: personaResponse.usage.output_tokens,
      });

      personaHistory.push({ role: "assistant", content: personaText });

      turnNumber++;
      conversation.push({ turn: turnNumber, role: "user", content: personaText, timestamp: new Date().toISOString() });

      onProgress({
        runId: config.id, persona: persona.id, step: "chatting",
        turn: turnNumber, message: { role: "user", content: personaText },
      });

      // Send to chatbot via edge function (full message history)
      chatMessages.push({ role: "user", content: personaText });
      const chatResponse = await this.edgeClient.sendChatMessage(chatMessages);

      const botText = extractTextFromResponse(chatResponse) || "[The chatbot saved your information]";

      costTracker.recordEstimatedCall("chatbot_estimated", {
        messageCount: 1,
        estimatedTokens: chatResponse.usage
          ? chatResponse.usage.input_tokens + chatResponse.usage.output_tokens
          : Math.ceil((personaText.length + botText.length) / 4) * 3,
        model: chatResponse.model || "claude-sonnet-4-5-20250929",
      });

      chatMessages.push({ role: "assistant", content: botText });
      personaHistory.push({ role: "user", content: botText });

      turnNumber++;
      conversation.push({ turn: turnNumber, role: "assistant", content: botText, timestamp: new Date().toISOString() });

      onProgress({
        runId: config.id, persona: persona.id, step: "chatting",
        turn: turnNumber, message: { role: "assistant", content: botText },
      });

      complete = isConversationComplete(chatResponse);
    }

    return conversation;
  }

  private async evaluate(
    persona: Persona,
    conversation: Array<{ turn: number; role: string; content: string; timestamp: string }>,
    judgeModel: string,
    costTracker: CostTracker,
  ): Promise<Record<string, unknown>> {
    const { evaluateConversation } = await import("../../../lib/judge.js");
    const { UNIVERSAL_CRITERIA } = await import("../../../criteria/universal.js");

    let personaCriteria: Criterion[] = [];
    try {
      const mod: Record<string, unknown> = await import(`../../../criteria/birthbuild/${persona.id}.js`);
      const exported = Object.values(mod)[0];
      if (Array.isArray(exported)) personaCriteria = exported as Criterion[];
    } catch {
      // No persona-specific criteria
    }

    const turns = conversation.map((c) => ({
      turn_number: c.turn,
      role: c.role as "user" | "assistant",
      content: c.content,
      timestamp: c.timestamp,
    }));

    const result = await evaluateConversation({
      persona,
      turns,
      universalCriteria: [...UNIVERSAL_CRITERIA, ...personaCriteria],
      personaCriteria,
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: judgeModel,
    });

    costTracker.recordDirectCall("judge", {
      model: judgeModel,
      inputTokens: Math.ceil(JSON.stringify(turns).length / 4),
      outputTokens: 2000,
    });

    return result as unknown as Record<string, unknown>;
  }

  findLatestSavedSpec(personaId: string): Record<string, unknown> | null {
    if (!existsSync(RUNS_DIR)) return null;
    // Run dirs are now UUIDs; sort by summary timestamp to find latest
    const runs = readdirSync(RUNS_DIR)
      .map((dir) => {
        const summaryPath = join(RUNS_DIR, dir, "summary.json");
        if (!existsSync(summaryPath)) return null;
        try {
          const summary = JSON.parse(readFileSync(summaryPath, "utf-8")) as { timestamp?: string };
          return { dir, timestamp: summary.timestamp ?? "" };
        } catch { return null; }
      })
      .filter((r): r is { dir: string; timestamp: string } => r !== null)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    for (const run of runs) {
      const specPath = join(RUNS_DIR, run.dir, personaId, "site-spec.json");
      if (existsSync(specPath)) {
        return JSON.parse(readFileSync(specPath, "utf-8")) as Record<string, unknown>;
      }
    }
    return null;
  }

  listPersonas(): string[] {
    if (!existsSync(PERSONAS_DIR)) return [];
    return readdirSync(PERSONAS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }

  listRuns(): string[] {
    if (!existsSync(RUNS_DIR)) return [];
    return readdirSync(RUNS_DIR).sort().reverse();
  }
}
