import { Router } from "express";
import { randomUUID } from "crypto";
import type { Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig } from "../engine/supabase-client.js";
import {
  listCreativeRuns,
  getCreativeRun,
  getCreativeRunPages,
} from "../engine/creative-run-db.js";
import { executeCreativeBuild } from "../engine/creative-engine.js";
import type { CreativeBuildConfig, CreativeRunProgress } from "../engine/creative-engine.js";

interface RunState {
  streams: Set<Response>;
  done: boolean;
  error: string | null;
  dbRunId: string | null;
}

export function createResearchRouter(supabaseClient: SupabaseClient, supabaseConfig: SupabaseConfig) {
  const router = Router();
  const activeRuns = new Map<string, RunState>();

  // GET /api/research — list all creative runs
  router.get("/", async (_req, res) => {
    try {
      const runs = await listCreativeRuns(supabaseClient);
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/research/runs — start a creative build
  router.post("/runs", (req, res) => {
    const body = req.body as Partial<CreativeBuildConfig>;
    const config: CreativeBuildConfig = {
      model: body.model ?? "claude-sonnet-4-5-20250929",
      temperature: body.temperature ?? 0.7,
      palette: body.palette ?? "sage_sand",
      typography: body.typography ?? "mixed",
      style: body.style ?? "classic",
      feeling: body.feeling ?? "Reassuring",
    };

    const trackingId = randomUUID();

    activeRuns.set(trackingId, {
      streams: new Set(),
      done: false,
      error: null,
      dbRunId: null,
    });

    res.json({ trackingId, status: "started" });

    const onProgress = (progress: CreativeRunProgress) => {
      const state = activeRuns.get(trackingId);
      if (!state) return;

      // Track the dbRunId from the first progress event
      if (progress.runId && !state.dbRunId) {
        state.dbRunId = progress.runId;
      }

      const data = JSON.stringify(progress);
      for (const stream of state.streams) {
        stream.write(`event: progress\ndata: ${data}\n\n`);
      }
    };

    executeCreativeBuild(config, supabaseConfig, onProgress)
      .then((result) => {
        const state = activeRuns.get(trackingId);
        if (!state) return;
        state.done = true;
        state.dbRunId = result.dbRunId;
        const doneData = JSON.stringify({ dbRunId: result.dbRunId, estimatedCostUsd: result.estimatedCostUsd });
        for (const stream of state.streams) {
          stream.write(`event: done\ndata: ${doneData}\n\n`);
          stream.end();
        }
        state.streams.clear();
      })
      .catch((err) => {
        const state = activeRuns.get(trackingId);
        if (!state) return;
        state.done = true;
        state.error = err instanceof Error ? err.message : String(err);
        const errData = JSON.stringify({ error: state.error });
        for (const stream of state.streams) {
          stream.write(`event: error\ndata: ${errData}\n\n`);
          stream.end();
        }
        state.streams.clear();
      });
  });

  // GET /api/research/runs/:id/stream — SSE stream for build progress
  router.get("/runs/:id/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(":ok\n\n");

    const trackingId = req.params.id;
    const state = activeRuns.get(trackingId);

    if (!state) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Run not found" })}\n\n`);
      res.end();
      return;
    }

    // If already done, send final event immediately
    if (state.done) {
      if (state.error) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: state.error })}\n\n`);
      } else {
        res.write(`event: done\ndata: ${JSON.stringify({ dbRunId: state.dbRunId })}\n\n`);
      }
      res.end();
      return;
    }

    state.streams.add(res);

    req.on("close", () => {
      state.streams.delete(res);
    });
  });

  // GET /api/research/:id — get run detail with pages
  router.get("/:id", async (req, res) => {
    try {
      const [run, pages] = await Promise.all([
        getCreativeRun(supabaseClient, req.params.id),
        getCreativeRunPages(supabaseClient, req.params.id),
      ]);
      res.json({ run, pages });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
