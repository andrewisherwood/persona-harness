import { Router } from "express";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Response } from "express";
import type { Orchestrator } from "../engine/orchestrator.js";
import type { RunConfig, RunProgress } from "../engine/types.js";

const RUNS_DIR = join(process.cwd(), "runs");

export function createRunsRouter(orchestrator: Orchestrator) {
  const router = Router();
  const activeStreams = new Map<string, Set<Response>>();

  // GET /api/runs — list all completed runs
  router.get("/", (_req, res) => {
    if (!existsSync(RUNS_DIR)) {
      res.json([]);
      return;
    }
    const runs = readdirSync(RUNS_DIR)
      .map((dir) => {
        const configPath = join(RUNS_DIR, dir, "config.json");
        const summaryPath = join(RUNS_DIR, dir, "summary.json");
        const summary = existsSync(summaryPath)
          ? JSON.parse(readFileSync(summaryPath, "utf-8"))
          : null;
        return {
          id: dir,
          config: existsSync(configPath)
            ? JSON.parse(readFileSync(configPath, "utf-8"))
            : null,
          summary,
          // Sort key: use timestamp from summary, fall back to dir name
          _ts: (summary as Record<string, unknown>)?.timestamp as string ?? dir,
        };
      })
      .sort((a, b) => b._ts.localeCompare(a._ts))
      .map(({ _ts, ...rest }) => rest);
    res.json(runs);
  });

  // GET /api/runs/:id — get run summary
  router.get("/:id", (req, res) => {
    const summaryPath = join(RUNS_DIR, req.params.id, "summary.json");
    if (!existsSync(summaryPath)) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(JSON.parse(readFileSync(summaryPath, "utf-8")));
  });

  // GET /api/runs/:id/:persona/conversation
  router.get("/:id/:persona/conversation", (req, res) => {
    const filePath = join(
      RUNS_DIR,
      req.params.id,
      req.params.persona,
      "conversation.json",
    );
    if (!existsSync(filePath)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(JSON.parse(readFileSync(filePath, "utf-8")));
  });

  // GET /api/runs/:id/:persona/site-spec
  router.get("/:id/:persona/site-spec", (req, res) => {
    const filePath = join(
      RUNS_DIR,
      req.params.id,
      req.params.persona,
      "site-spec.json",
    );
    if (!existsSync(filePath)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(JSON.parse(readFileSync(filePath, "utf-8")));
  });

  // GET /api/runs/:id/:persona/evaluation
  router.get("/:id/:persona/evaluation", (req, res) => {
    const filePath = join(
      RUNS_DIR,
      req.params.id,
      req.params.persona,
      "evaluation.json",
    );
    if (!existsSync(filePath)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(JSON.parse(readFileSync(filePath, "utf-8")));
  });

  // GET /api/runs/:id/:persona/cost
  router.get("/:id/:persona/cost", (req, res) => {
    const filePath = join(
      RUNS_DIR,
      req.params.id,
      req.params.persona,
      "cost.json",
    );
    if (!existsSync(filePath)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(JSON.parse(readFileSync(filePath, "utf-8")));
  });

  // POST /api/runs — start a new run
  router.post("/", (req, res) => {
    const body = req.body as Partial<RunConfig>;
    const config: RunConfig = {
      id: randomUUID(),
      mode: body.mode ?? "full-pipeline",
      personas: body.personas ?? orchestrator.listPersonas(),
      promptSource: body.promptSource ?? "production",
      promptSourceB: body.promptSourceB,
      maxTurns: body.maxTurns ?? 60,
      personaModel: body.personaModel ?? "claude-sonnet-4-5-20250929",
      judgeModel: body.judgeModel ?? "claude-sonnet-4-5-20250929",
      skipEvaluation: body.skipEvaluation ?? false,
      skipBuild: body.skipBuild ?? false,
    };

    // Initialize SSE stream set BEFORE responding so that clients
    // connecting to /stream can find the run.
    activeStreams.set(config.id, new Set());

    res.json({ runId: config.id, status: "started" });

    const onProgress = (progress: RunProgress) => {
      const streams = activeStreams.get(config.id);
      if (streams) {
        const data = JSON.stringify(progress);
        // Never use "error" as SSE event name for progress — it conflicts
        // with the run-level error event. Map it to "complete" so the
        // step indicator still works; the persona error is in the summary.
        const eventName = progress.step === "error" ? "complete" : progress.step;
        for (const stream of streams) {
          stream.write(`event: ${eventName}\ndata: ${data}\n\n`);
        }
      }
    };

    orchestrator
      .executeRun(config, onProgress)
      .then(() => {
        const streams = activeStreams.get(config.id);
        if (streams) {
          for (const stream of streams) {
            stream.write(`event: done\ndata: {}\n\n`);
            stream.end();
          }
          activeStreams.delete(config.id);
        }
      })
      .catch((err) => {
        const streams = activeStreams.get(config.id);
        if (streams) {
          for (const stream of streams) {
            stream.write(
              `event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`,
            );
            stream.end();
          }
          activeStreams.delete(config.id);
        }
      });
  });

  // GET /api/runs/:id/stream — SSE stream for run progress
  router.get("/:id/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    // Write an initial SSE comment to fully establish the connection.
    // Some HTTP clients and proxies require at least one write to flush
    // the response headers through the full pipeline.
    res.write(":ok\n\n");

    const runId = req.params.id;

    // If no active run exists for this ID, check if it already completed
    // on disk. Without this check, late-joining clients would hang forever
    // because the run's completion callback already fired and deleted the
    // activeStreams entry.
    if (!activeStreams.has(runId)) {
      const summaryPath = join(RUNS_DIR, runId, "summary.json");
      if (existsSync(summaryPath)) {
        res.write(`event: done\ndata: {}\n\n`);
      } else {
        res.write(
          `event: error\ndata: ${JSON.stringify({ error: "Run not found or already completed" })}\n\n`,
        );
      }
      res.end();
      return;
    }

    activeStreams.get(runId)!.add(res);

    req.on("close", () => {
      activeStreams.get(runId)?.delete(res);
    });
  });

  return router;
}
