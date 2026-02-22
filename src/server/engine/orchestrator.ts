import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import type { RunConfig, RunResult, PersonaRunResult, ProgressCallback } from "./types.js";
import { EdgeFunctionClient, extractTextFromResponse, extractToolCalls, isConversationComplete } from "./edge-function-client.js";
import type { ChatMessage, DesignSystem, PhotoInput, BuildFile } from "./edge-function-client.js";
import { CostTracker } from "./cost-tracker.js";
import type { SupabaseConfig } from "./supabase-client.js";
import { buildStockPhotoInputs, createServiceClient, createTestSiteSpec, generateAuthToken, getSiteSpec, seedStockPhotos, upsertSiteSpec, validateConfig } from "./supabase-client.js";
import { SpecAccumulator } from "../../../lib/spec-accumulator.js";
import type { Persona, Criterion } from "../../../personas/schema.js";

const RUNS_DIR = join(process.cwd(), "runs");
const PERSONAS_DIR = join(process.cwd(), "personas/birthbuild");

/** Minimum fields required before spending tokens on AI generation. */
export function validateSpecForBuild(spec: Record<string, unknown>): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!spec.business_name) missing.push("business_name");
  if (!spec.doula_name) missing.push("doula_name");
  if (!Array.isArray(spec.services) || spec.services.length === 0) missing.push("services");
  if (!spec.service_area) missing.push("service_area");
  return { valid: missing.length === 0, missing };
}

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

    // Auto-generate a fresh auth token before each run
    const freshToken = await generateAuthToken(this.supabaseConfig);
    this.supabaseConfig.authToken = freshToken;
    this.edgeClient.updateAuthToken(freshToken);

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
    await seedStockPhotos(supabase, siteSpecId);

    // Run conversation (also accumulates tool calls into site spec)
    const { conversation, accumulatedSpec } = await this.runConversation(config, persona, siteSpecId, costTracker, onProgress);
    writeFileSync(join(personaDir, "conversation.json"), JSON.stringify(conversation, null, 2));

    // Read final site_spec from Supabase (includes accumulated tool call data)
    const siteSpec = await getSiteSpec(supabase, siteSpecId);
    writeFileSync(join(personaDir, "site-spec.json"), JSON.stringify(siteSpec, null, 2));
    // Also save the locally-accumulated spec for comparison/debugging
    writeFileSync(join(personaDir, "accumulated-spec.json"), JSON.stringify(accumulatedSpec, null, 2));

    // Evaluate
    let evaluation: Record<string, unknown> | null = null;
    if (!config.skipEvaluation) {
      onProgress({ runId: config.id, persona: persona.id, step: "evaluating" });
      evaluation = await this.evaluate(persona, conversation, config.judgeModel, costTracker);
      writeFileSync(join(personaDir, "evaluation.json"), JSON.stringify(evaluation, null, 2));
    }

    // AI generation + deploy — failures here should not lose conversation/evaluation data
    let previewUrl: string | null = null;
    let buildError: string | null = null;
    if (!config.skipBuild) {
      // Gate: validate spec has minimum data before spending tokens on AI generation
      const specForValidation = siteSpec ?? accumulatedSpec;
      const { valid, missing } = validateSpecForBuild(specForValidation);
      if (!valid) {
        buildError = `Skipping build — spec missing required fields: ${missing.join(", ")}. The conversation may not have collected enough data.`;
      } else {
        try {
          // Enable AI generation on the spec
          await upsertSiteSpec(supabase, siteSpecId, { use_llm_generation: true });

          const { files, previewUrl: url } = await this.generateAndDeploy(
            config, persona.id, siteSpecId, personaDir, onProgress, costTracker,
          );
          previewUrl = url;
          writeFileSync(join(personaDir, "generated-files.json"), JSON.stringify(files.map((f) => f.path), null, 2));
        } catch (err) {
          buildError = err instanceof Error ? err.message : String(err);
        }
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

    // Gate: validate before spending tokens
    const { valid, missing } = validateSpecForBuild(savedSpec);
    if (!valid) {
      throw new Error(`Cannot build — saved spec missing required fields: ${missing.join(", ")}`);
    }

    const supabase = createServiceClient(this.supabaseConfig);
    const siteSpecId = await createTestSiteSpec(
      supabase, this.supabaseConfig.testTenantId, this.supabaseConfig.testUserId,
    );
    await seedStockPhotos(supabase, siteSpecId);
    // Strip immutable DB fields before updating the new row
    const { id: _id, user_id: _uid, tenant_id: _tid, created_at: _ca, ...specData } = savedSpec;
    await upsertSiteSpec(supabase, siteSpecId, { ...specData, use_llm_generation: true });

    const { previewUrl } = await this.generateAndDeploy(
      config, personaId, siteSpecId, personaDir, onProgress, costTracker,
    );

    const cost = costTracker.getSummary();
    writeFileSync(join(personaDir, "cost.json"), JSON.stringify(cost, null, 2));

    onProgress({ runId: config.id, persona: personaId, step: "complete" });

    return { personaId, conversation: [], siteSpec: savedSpec, evaluation: null, cost, previewUrl, error: null };
  }

  /**
   * AI generation + deploy pipeline:
   * 1. Call /generate-design-system → CSS, nav, footer, wordmark
   * 2. Call /generate-page for each page in parallel → HTML files
   * 3. Call /build with all files → Netlify preview URL
   */
  private async generateAndDeploy(
    config: RunConfig,
    personaId: string,
    siteSpecId: string,
    personaDir: string,
    onProgress: ProgressCallback,
    costTracker?: CostTracker,
  ): Promise<{ files: BuildFile[]; previewUrl: string }> {
    // Step 1: Generate design system
    onProgress({ runId: config.id, persona: personaId, step: "building" });
    const dsResponse = await this.edgeClient.generateDesignSystem(siteSpecId);
    const designSystem: DesignSystem = {
      css: dsResponse.css,
      nav_html: dsResponse.nav_html,
      footer_html: dsResponse.footer_html,
      wordmark_svg: dsResponse.wordmark_svg ?? "",
    };
    writeFileSync(join(personaDir, "design-system.json"), JSON.stringify(designSystem, null, 2));

    // Estimate design system generation cost (LLM call inside edge function)
    const dsOutputTokens = Math.ceil((designSystem.css.length + designSystem.nav_html.length + designSystem.footer_html.length) / 4);
    costTracker?.recordEstimatedCall("build_estimated", {
      messageCount: 1,
      estimatedTokens: 3000 + dsOutputTokens, // ~3K input tokens for system prompt + spec
      model: "claude-sonnet-4-5-20250929",
    });

    // Step 2: Generate pages in parallel
    // Read the spec to get the pages list
    const supabase = createServiceClient(this.supabaseConfig);
    const specData = await getSiteSpec(supabase, siteSpecId);
    const pages = Array.isArray(specData.pages) && specData.pages.length > 0 ? specData.pages as string[] : ["home", "about", "services", "contact"];

    const photos: PhotoInput[] = buildStockPhotoInputs(this.supabaseConfig.supabaseUrl);
    const pageResults = await Promise.all(
      pages.map((page) =>
        this.edgeClient.generatePage(siteSpecId, page, designSystem, photos),
      ),
    );

    const files: BuildFile[] = pageResults.map((r) => ({
      path: r.filename,
      content: r.html,
    }));

    // Estimate page generation costs (1 LLM call per page inside edge functions)
    for (const result of pageResults) {
      const pageOutputTokens = Math.ceil(result.html.length / 4);
      costTracker?.recordEstimatedCall("build_estimated", {
        messageCount: 1,
        estimatedTokens: 8000 + pageOutputTokens, // ~8K input tokens for system prompt + spec + design system
        model: "claude-sonnet-4-5-20250929",
      });
    }

    // Step 3: Deploy
    onProgress({ runId: config.id, persona: personaId, step: "deploying" });
    const buildResult = await this.edgeClient.triggerBuild(siteSpecId, files);
    writeFileSync(join(personaDir, "preview-url.txt"), buildResult.preview_url);

    return { files, previewUrl: buildResult.preview_url };
  }

  private async runConversation(
    config: RunConfig,
    persona: Persona,
    siteSpecId: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<{ conversation: Array<{ turn: number; role: string; content: string; timestamp: string }>; accumulatedSpec: Record<string, unknown> }> {
    // Import persona system prompt builder from existing lib
    const { buildPersonaSystemPrompt } = await import("../../../lib/persona-agent.js");
    const personaSystemPrompt = buildPersonaSystemPrompt(persona);

    const specAccumulator = new SpecAccumulator();
    const conversation: Array<{ turn: number; role: string; content: string; timestamp: string }> = [];
    // Messages array sent to the /chat edge function (full conversation history)
    const chatMessages: ChatMessage[] = [];
    let turnNumber = 0;

    // Get initial greeting by sending "Hi" via edge function
    chatMessages.push({ role: "user", content: "Hi" });
    const greetingResponse = await this.edgeClient.sendChatMessage(chatMessages);
    const greetingText = extractTextFromResponse(greetingResponse) || "[The chatbot is ready]";

    // Extract and accumulate any tool calls from the greeting
    for (const tc of extractToolCalls(greetingResponse)) {
      specAccumulator.applyToolCall(tc.name, tc.input);
    }

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

      // Extract and accumulate tool calls from the chatbot response
      for (const tc of extractToolCalls(chatResponse)) {
        specAccumulator.applyToolCall(tc.name, tc.input);
      }

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

    // Upsert the accumulated spec to Supabase so the DB has the data
    const accumulatedSpec = specAccumulator.getSpec() as unknown as Record<string, unknown>;
    const supabase = createServiceClient(this.supabaseConfig);
    await upsertSiteSpec(supabase, siteSpecId, accumulatedSpec);

    return { conversation, accumulatedSpec };
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
