/**
 * Level 2: Full Integration Smoke Test
 *
 * Manual test script that verifies the full stack works end-to-end
 * with real Supabase and Anthropic credentials.
 *
 * Requirements:
 *   - .env file with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *     TEST_TENANT_ID, TEST_USER_ID, AUTH_TOKEN, ANTHROPIC_API_KEY
 *   - Server must NOT be already running on the same port
 *
 * Usage:
 *   npx tsx scripts/smoke-test.ts
 *
 * This script:
 *   1. Starts the Express server on a random port
 *   2. POSTs to /api/runs with sparse-sarah, skipBuild: true, skipEvaluation: true
 *   3. Connects to the SSE stream and logs progress events
 *   4. Waits for completion or error
 *   5. Checks the run results via GET /api/runs
 *   6. Exits with code 0 (success) or 1 (failure)
 */

import dotenv from "dotenv";
dotenv.config();

import type { AddressInfo } from "net";
import type { Server } from "http";

// Dynamically import to ensure dotenv loads first
const { createApp } = await import("../src/server/index.js");

const TIMEOUT_MS = 120_000; // 2 minutes max for the whole test

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.error(`[${ts}] ERROR: ${msg}`);
}

async function main(): Promise<void> {
  // Verify required env vars
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TEST_TENANT_ID",
    "TEST_USER_ID",
    "AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(", ")}`);
    logError("Ensure your .env file has all required values.");
    process.exit(1);
  }

  // Start server
  log("Starting server...");
  const app = createApp();
  let server: Server;
  const baseUrl = await new Promise<string>((resolve) => {
    server = app.listen(0, () => {
      const addr = server!.address() as AddressInfo;
      const url = `http://127.0.0.1:${addr.port}`;
      log(`Server listening on ${url}`);
      resolve(url);
    });
  });

  // Set up timeout
  const timeoutId = setTimeout(() => {
    logError(`Test timed out after ${TIMEOUT_MS / 1000}s`);
    server!.close();
    process.exit(1);
  }, TIMEOUT_MS);

  try {
    // Verify health
    log("Checking /api/health...");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = (await healthRes.json()) as { status: string };
    if (health.status !== "ok") {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }
    log("Health check passed.");

    // Start a run with cheapest possible options
    log("Starting run with sparse-sarah (skipBuild, skipEvaluation)...");
    const runRes = await fetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personas: ["sparse-sarah"],
        maxTurns: 3, // Keep conversation very short to minimise cost
        skipBuild: true,
        skipEvaluation: true,
      }),
    });

    if (!runRes.ok) {
      throw new Error(`POST /api/runs failed: ${runRes.status} ${await runRes.text()}`);
    }

    const { runId, status } = (await runRes.json()) as { runId: string; status: string };
    log(`Run started: id=${runId}, status=${status}`);

    if (status !== "started") {
      throw new Error(`Expected status "started", got "${status}"`);
    }

    // Connect to SSE stream
    log(`Connecting to SSE stream /api/runs/${runId}/stream...`);
    const controller = new AbortController();
    const streamRes = await fetch(`${baseUrl}/api/runs/${runId}/stream`, {
      signal: controller.signal,
    });

    if (!streamRes.ok || !streamRes.body) {
      throw new Error(`SSE connection failed: ${streamRes.status}`);
    }

    // Read SSE events
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;
    let lastEvent = "";

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) {
        done = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          lastEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            const step = (parsed.step as string) ?? lastEvent;
            const persona = parsed.persona as string | undefined;
            const turn = parsed.turn as number | undefined;
            const message = parsed.message as { role: string; content: string } | undefined;

            if (message) {
              const preview = message.content.slice(0, 80) + (message.content.length > 80 ? "..." : "");
              log(`  [${step}] ${persona ?? "?"} turn=${turn ?? "?"} ${message.role}: ${preview}`);
            } else if (lastEvent === "error") {
              logError(`  Run error: ${JSON.stringify(parsed)}`);
            } else if (lastEvent === "done") {
              log("  Run completed.");
            } else {
              log(`  [${step}] ${persona ?? "?"}`);
            }
          } catch {
            log(`  SSE data (raw): ${data}`);
          }

          if (lastEvent === "done" || lastEvent === "error") {
            done = true;
          }
        }
      }
    }

    controller.abort();

    // Check run results
    log("Checking completed runs...");
    const runsRes = await fetch(`${baseUrl}/api/runs`);
    const runs = (await runsRes.json()) as Array<{ id: string; config: unknown; summary: unknown }>;
    log(`Total runs on disk: ${runs.length}`);

    if (lastEvent === "error") {
      logError("Run ended with an error event. Check logs above.");
      throw new Error("Run failed with error event");
    }

    log("--- SMOKE TEST PASSED ---");
  } catch (err) {
    logError(err instanceof Error ? err.message : String(err));
    log("--- SMOKE TEST FAILED ---");
    clearTimeout(timeoutId);
    server!.close();
    process.exit(1);
  }

  clearTimeout(timeoutId);
  server!.close();
  process.exit(0);
}

main();
