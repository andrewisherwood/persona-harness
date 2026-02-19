import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import type { RunConfig, RunResult, PersonaRunResult, ProgressCallback } from "./types.js";
import { EdgeFunctionClient } from "./edge-function-client.js";
import { CostTracker } from "./cost-tracker.js";
import type { SupabaseConfig } from "./supabase-client.js";
import { createServiceClient, createTestSiteSpec, getSiteSpec, upsertSiteSpec } from "./supabase-client.js";
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
      anonKey: supabaseConfig.anonKey,
    });
    this.anthropic = new Anthropic();
  }

  async executeRun(config: RunConfig, onProgress: ProgressCallback): Promise<RunResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const runDir = join(RUNS_DIR, timestamp);
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

    // Build + deploy
    let previewUrl: string | null = null;
    if (!config.skipBuild) {
      onProgress({ runId: config.id, persona: persona.id, step: "building" });
      await this.edgeClient.triggerBuild(siteSpecId);
      await this.edgeClient.waitForBuild(siteSpecId, async () => {
        const spec = await getSiteSpec(supabase, siteSpecId);
        return (spec.status as string | undefined) ?? "unknown";
      });

      onProgress({ runId: config.id, persona: persona.id, step: "deploying" });
      const publishResult = await this.edgeClient.triggerPublish(siteSpecId);
      previewUrl = publishResult.previewUrl;
      writeFileSync(join(personaDir, "preview-url.txt"), previewUrl);
    }

    const cost = costTracker.getSummary();
    writeFileSync(join(personaDir, "cost.json"), JSON.stringify(cost, null, 2));

    onProgress({ runId: config.id, persona: persona.id, step: "complete" });

    return { personaId: persona.id, conversation, siteSpec, evaluation, cost, previewUrl, error: null };
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
    await this.edgeClient.triggerBuild(siteSpecId);
    await this.edgeClient.waitForBuild(siteSpecId, async () => {
      const spec = await getSiteSpec(supabase, siteSpecId);
      return (spec.status as string | undefined) ?? "unknown";
    });

    onProgress({ runId: config.id, persona: personaId, step: "deploying" });
    const publishResult = await this.edgeClient.triggerPublish(siteSpecId);
    const previewUrl = publishResult.previewUrl;
    writeFileSync(join(personaDir, "preview-url.txt"), previewUrl);

    const cost = costTracker.getSummary();
    writeFileSync(join(personaDir, "cost.json"), JSON.stringify(cost, null, 2));

    onProgress({ runId: config.id, persona: personaId, step: "complete" });

    return { personaId, conversation: [], siteSpec: savedSpec, evaluation: null, cost, previewUrl, error: null };
  }

  private async runConversation(
    config: RunConfig,
    persona: Persona,
    siteSpecId: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<Array<{ turn: number; role: string; content: string; timestamp: string }>> {
    // Import persona system prompt builder from existing lib
    const { buildPersonaSystemPrompt } = await import("../../../lib/persona-agent.js");
    const personaSystemPrompt = buildPersonaSystemPrompt(persona);

    const conversation: Array<{ turn: number; role: string; content: string; timestamp: string }> = [];
    const chatHistory: Array<{ role: string; content: string }> = [];
    let turnNumber = 0;

    // Get initial greeting
    const greetingResponse = await this.edgeClient.sendChatMessage({
      siteSpecId, message: "Hi", chatHistory: [],
    });

    turnNumber++;
    conversation.push({ turn: turnNumber, role: "user", content: "Hi", timestamp: new Date().toISOString() });
    turnNumber++;
    conversation.push({ turn: turnNumber, role: "assistant", content: greetingResponse.message, timestamp: new Date().toISOString() });

    chatHistory.push({ role: "user", content: "Hi" });
    chatHistory.push({ role: "assistant", content: greetingResponse.message });

    onProgress({
      runId: config.id, persona: persona.id, step: "chatting",
      turn: turnNumber, message: { role: "assistant", content: greetingResponse.message },
    });

    // Persona sees chatbot messages as "user" (incoming) and its own replies as "assistant"
    const personaHistory: Anthropic.MessageParam[] = [
      { role: "user", content: greetingResponse.message },
    ];

    let isComplete = greetingResponse.is_complete ?? false;

    while (turnNumber < config.maxTurns * 2 && !isComplete) {
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

      // Send to chatbot via edge function
      chatHistory.push({ role: "user", content: personaText });
      const chatResponse = await this.edgeClient.sendChatMessage({
        siteSpecId, message: personaText, chatHistory,
      });

      costTracker.recordEstimatedCall("chatbot_estimated", {
        messageCount: 1,
        estimatedTokens: Math.ceil((personaText.length + chatResponse.message.length) / 4) * 3,
        model: "claude-sonnet-4-5-20250929",
      });

      const botText = chatResponse.message || "[The chatbot saved your information]";
      chatHistory.push({ role: "assistant", content: botText });
      personaHistory.push({ role: "user", content: botText });

      turnNumber++;
      conversation.push({ turn: turnNumber, role: "assistant", content: botText, timestamp: new Date().toISOString() });

      onProgress({
        runId: config.id, persona: persona.id, step: "chatting",
        turn: turnNumber, message: { role: "assistant", content: botText },
      });

      isComplete = chatResponse.is_complete ?? false;
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
    const runs = readdirSync(RUNS_DIR).sort().reverse();
    for (const run of runs) {
      const specPath = join(RUNS_DIR, run, personaId, "site-spec.json");
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
