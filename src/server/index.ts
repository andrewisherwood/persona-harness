import express from "express";
import type { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { personasRouter } from "./routes/personas.js";
import { createPromptsRouter } from "./routes/prompts.js";
import { createRunsRouter } from "./routes/runs.js";
import { configRouter } from "./routes/config.js";
import { costRouter } from "./routes/cost.js";
import { createResearchRouter } from "./routes/research.js";
import { Orchestrator } from "./engine/orchestrator.js";
import { buildSupabaseConfig, createServiceClient, generateAuthToken, validateConfig } from "./engine/supabase-client.js";

const REQUIRED_ENV_VARS = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "TEST_TENANT_ID", "TEST_USER_ID", "BIRTHBUILD_ROOT"];

/**
 * Creates and configures the Express application without starting a listener.
 * Used by tests to get a testable app instance without side effects.
 */
export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const envStatus: Record<string, boolean> = {};
    for (const k of REQUIRED_ENV_VARS) {
      envStatus[k] = !!process.env[k];
    }
    const allSet = Object.values(envStatus).every(Boolean);
    const optional: Record<string, boolean> = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    };
    res.json({
      status: allSet ? "ok" : "misconfigured",
      timestamp: new Date().toISOString(),
      env: envStatus,
      optional,
    });
  });

  const supabaseConfig = buildSupabaseConfig(process.env as Record<string, string>);
  const orchestrator = new Orchestrator(supabaseConfig);

  app.use("/api/personas", personasRouter);
  const birthbuildRoot = process.env.BIRTHBUILD_ROOT ?? "";
  app.use("/api/prompts", createPromptsRouter(birthbuildRoot));
  app.use("/api/runs", createRunsRouter(orchestrator));
  app.use("/api/config", configRouter);
  app.use("/api/cost", costRouter);

  // Research routes require a valid Supabase URL; skip registration when
  // env vars are missing (e.g. during E2E smoke tests without credentials).
  if (supabaseConfig.supabaseUrl && supabaseConfig.serviceRoleKey) {
    const researchClient = createServiceClient(supabaseConfig);
    app.use("/api/research", createResearchRouter(researchClient));
  }

  return app;
}

// Start listening only when run directly — not during tests.
// Vitest sets process.env.VITEST automatically.
if (!process.env.VITEST) {
  dotenv.config();

  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n❌ Missing env vars: ${missing.join(", ")}`);
    console.error("   Runs will fail. Add them to .env and restart.\n");
    console.error("   Note: tsx watch does NOT reload .env changes — you must restart manually.\n");
  }

  // Generate an initial auth token if not provided in .env
  const startServer = async () => {
    if (!process.env.AUTH_TOKEN && missing.length === 0) {
      try {
        const config = buildSupabaseConfig(process.env as Record<string, string>);
        const token = await generateAuthToken(config);
        process.env.AUTH_TOKEN = token;
        console.log("  ✓ AUTH_TOKEN auto-generated from test user");
      } catch (err) {
        console.error(`  ✗ Failed to auto-generate AUTH_TOKEN: ${err instanceof Error ? err.message : err}`);
        console.error("    You can still set AUTH_TOKEN manually in .env\n");
      }
    }

    const app = createApp();
    const PORT = process.env.API_PORT || 3001;
    app.listen(PORT, () => {
      console.log(`\nAPI server running on http://localhost:${PORT}`);
      console.log(`Check config: http://localhost:${PORT}/api/health\n`);
      for (const k of [...REQUIRED_ENV_VARS, "AUTH_TOKEN"]) {
        console.log(`  ${process.env[k] ? "✓" : "✗"} ${k}${k === "AUTH_TOKEN" ? " (auto-generated per run)" : ""}`);
      }
      console.log();
    });
  };

  startServer();
}
