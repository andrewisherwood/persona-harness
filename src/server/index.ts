import express from "express";
import type { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { personasRouter } from "./routes/personas.js";
import { promptsRouter } from "./routes/prompts.js";
import { createRunsRouter } from "./routes/runs.js";
import { configRouter } from "./routes/config.js";
import { costRouter } from "./routes/cost.js";
import { Orchestrator } from "./engine/orchestrator.js";
import { buildSupabaseConfig } from "./engine/supabase-client.js";

/**
 * Creates and configures the Express application without starting a listener.
 * Used by tests to get a testable app instance without side effects.
 */
export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const supabaseConfig = buildSupabaseConfig(process.env as Record<string, string>);
  const orchestrator = new Orchestrator(supabaseConfig);

  app.use("/api/personas", personasRouter);
  app.use("/api/prompts", promptsRouter);
  app.use("/api/runs", createRunsRouter(orchestrator));
  app.use("/api/config", configRouter);
  app.use("/api/cost", costRouter);

  return app;
}

// Start listening only when run directly — not during tests.
// Vitest sets process.env.VITEST automatically.
if (!process.env.VITEST) {
  dotenv.config();
  const app = createApp();
  const PORT = process.env.API_PORT || 3001;
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}
