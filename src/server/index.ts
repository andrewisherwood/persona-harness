import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { personasRouter } from "./routes/personas.js";
import { promptsRouter } from "./routes/prompts.js";
import { createRunsRouter } from "./routes/runs.js";
import { configRouter } from "./routes/config.js";
import { Orchestrator } from "./engine/orchestrator.js";
import { buildSupabaseConfig } from "./engine/supabase-client.js";

dotenv.config();

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

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export { app };
