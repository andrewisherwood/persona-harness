import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../src/server/index.js";

/**
 * E2E Smoke Tests -- Level 1: API contract verification.
 *
 * These tests start the Express server on a random port and verify that
 * all API routes respond with the correct shape. No real Supabase or
 * Anthropic credentials are required -- the server starts successfully
 * with empty config strings.
 *
 * Note: POST /api/runs will trigger orchestrator.executeRun() in the
 * background (fire-and-forget). Those calls will fail because there are
 * no real credentials, but that is expected. We only test the HTTP
 * response contract, not the run outcome.
 */

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  // Force-close all connections (including long-lived SSE streams and
  // background orchestrator work that may be hanging on failed network calls).
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}, 15_000);

describe("E2E Smoke Tests -- Level 1", () => {
  describe("GET /api/health", () => {
    it("returns status ok with a timestamp", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as { status: string; timestamp: string; env: Record<string, boolean> };
      // In test env, env vars are not set so status is "misconfigured"
      expect(["ok", "misconfigured"]).toContain(body.status);
      expect(body.timestamp).toBeDefined();
      expect(body.env).toBeDefined();
      // Timestamp should be a valid ISO string
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });
  });

  describe("GET /api/personas", () => {
    it("returns an array containing sparse-sarah", async () => {
      const res = await fetch(`${baseUrl}/api/personas`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as Array<{ id: string; name: string; background: string }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);

      const sarah = body.find((p) => p.id === "sparse-sarah");
      expect(sarah).toBeDefined();
      expect(sarah!.name).toBe("Sparse Sarah");
      expect(sarah!.background).toBeDefined();
    });
  });

  describe("GET /api/runs", () => {
    it("returns an array (may be empty)", async () => {
      const res = await fetch(`${baseUrl}/api/runs`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as unknown[];
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("GET /api/prompts", () => {
    it("returns 500 when BIRTHBUILD_ROOT is not configured", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`);
      // Without BIRTHBUILD_ROOT pointing to a valid directory, manifest.json cannot be read
      expect(res.status).toBe(500);

      const body = (await res.json()) as { error: string };
      expect(body.error).toBeDefined();
      expect(body.error).toContain("Failed to read manifest");
    });
  });

  describe("GET /api/config", () => {
    it("returns default configuration values", async () => {
      const res = await fetch(`${baseUrl}/api/config`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as { dailyBudget: number; defaultPersonaModel: string; defaultJudgeModel: string };
      expect(body.dailyBudget).toBeDefined();
      expect(typeof body.dailyBudget).toBe("number");
      expect(body.defaultPersonaModel).toBeDefined();
      expect(body.defaultJudgeModel).toBeDefined();
    });
  });

  describe("POST /api/runs", () => {
    it("accepts a valid config body and returns runId + status started", async () => {
      const res = await fetch(`${baseUrl}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personas: ["sparse-sarah"],
          skipBuild: true,
          skipEvaluation: true,
        }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as { runId: string; status: string };
      expect(body.runId).toBeDefined();
      expect(typeof body.runId).toBe("string");
      expect(body.runId.length).toBeGreaterThan(0);
      expect(body.status).toBe("started");
    });

    it("returns a unique runId for each request", async () => {
      const res1 = await fetch(`${baseUrl}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personas: ["sparse-sarah"], skipBuild: true, skipEvaluation: true }),
      });
      const body1 = (await res1.json()) as { runId: string };

      const res2 = await fetch(`${baseUrl}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personas: ["sparse-sarah"], skipBuild: true, skipEvaluation: true }),
      });
      const body2 = (await res2.json()) as { runId: string };

      expect(body1.runId).not.toBe(body2.runId);
    });
  });

  describe("GET /api/runs/:id (non-existent)", () => {
    it("returns 404 for a run that does not exist", async () => {
      const res = await fetch(`${baseUrl}/api/runs/non-existent-run-id`);
      expect(res.status).toBe(404);

      const body = (await res.json()) as { error: string };
      expect(body.error).toBeDefined();
    });
  });

  describe("GET /api/runs/:id/stream", () => {
    it("returns SSE content type headers", async () => {
      // Use Node http.get instead of fetch because fetch awaits the full
      // response body on SSE streams. http.get fires the callback as soon
      // as headers arrive, which is what we need to test.
      const { statusCode, headers } = await new Promise<{ statusCode: number; headers: Record<string, string | undefined> }>((resolve, reject) => {
        const req = http.get(`${baseUrl}/api/runs/test-stream-id/stream`, (res) => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: {
              "content-type": res.headers["content-type"],
              "cache-control": res.headers["cache-control"],
            },
          });
          // Destroy the connection immediately — suppress res-level errors
          // from our own destroy() call on some Node versions.
          res.on("error", () => {});
          res.destroy();
        });
        req.on("error", (err) => {
          // Ignore ECONNRESET from our own destroy() call
          if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
            reject(err);
          }
        });
      });

      expect(statusCode).toBe(200);
      expect(headers["content-type"]).toBe("text/event-stream");
      expect(headers["cache-control"]).toBe("no-cache");
    }, 10_000);
  });
});
