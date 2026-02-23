/**
 * Creative Build: CLI wrapper
 *
 * Thin CLI entry point that calls the reusable creative engine.
 * For dashboard usage, import executeCreativeBuild from creative-engine.ts directly.
 *
 * Usage:
 *   npx tsx scripts/creative-build.ts                         # defaults to claude-opus-4-6
 *   npx tsx scripts/creative-build.ts claude-sonnet-4-5-20250929
 *   npx tsx scripts/creative-build.ts --model claude-opus-4-6 --palette ocean_calm
 *   npx tsx scripts/creative-build.ts --no-db                 # skip database writes
 *   npx tsx scripts/creative-build.ts --temperature 0.9 --feeling "warm and inviting"
 *
 * Output is saved locally for inspection. Deploy with:
 *   npx tsx scripts/creative-deploy.ts <output-dir>
 */

import dotenv from "dotenv";
dotenv.config();

import { executeCreativeBuild, PALETTES, TYPOGRAPHY_PRESETS, detectModelProvider } from "../src/server/engine/creative-engine.js";
import { buildSupabaseConfig, createServiceClient } from "../src/server/engine/supabase-client.js";
import { insertCreativeRun, updateCreativeRunStatus, insertCreativeRunPage } from "../src/server/engine/creative-run-db.js";
import { extractPageMetrics } from "../src/server/engine/html-metrics.js";
import type { CreativeRunProgress } from "../src/server/engine/creative-engine.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  model: string;
  palette: string | null;
  typography: string | null;
  style: string | null;
  feeling: string | null;
  temperature: number;
  noDb: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = {
    model: "claude-opus-4-6",
    palette: null,
    typography: null,
    style: null,
    feeling: null,
    temperature: 0.7,
    noDb: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;

    if (arg === "--model") {
      result.model = args[++i] ?? result.model;
    } else if (arg === "--palette") {
      result.palette = args[++i] ?? null;
    } else if (arg === "--typography") {
      result.typography = args[++i] ?? null;
    } else if (arg === "--style") {
      result.style = args[++i] ?? null;
    } else if (arg === "--feeling") {
      result.feeling = args[++i] ?? null;
    } else if (arg === "--temperature") {
      const val = parseFloat(args[++i] ?? "");
      if (!isNaN(val)) result.temperature = val;
    } else if (arg === "--no-db") {
      result.noDb = true;
    } else if (!arg.startsWith("--")) {
      // Bare first arg = model name (backward compat)
      result.model = arg;
    }
    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cliArgs = parseArgs(process.argv);

  if (cliArgs.noDb) {
    console.log("[cli] --no-db mode: database writes will be skipped");
    console.log("[cli] Note: --no-db with the engine wrapper is not yet supported.");
    console.log("[cli] Use the full engine (which always writes to DB) or remove --no-db.");
    process.exit(1);
  }

  const config = buildSupabaseConfig(process.env as Record<string, string | undefined>);
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot write to DB.");
    console.error("Set these in .env or use the dashboard instead.");
    process.exit(1);
  }

  const buildConfig = {
    model: cliArgs.model,
    temperature: cliArgs.temperature,
    palette: cliArgs.palette ?? "sage_sand",
    typography: cliArgs.typography ?? "mixed",
    style: cliArgs.style ?? "classic",
    feeling: cliArgs.feeling ?? "Reassuring",
  };

  console.log(`Creative build: ${buildConfig.model} (temperature: ${buildConfig.temperature})`);
  console.log(`Palette: ${buildConfig.palette} | Typography: ${buildConfig.typography} | Style: ${buildConfig.style} | Feeling: ${buildConfig.feeling}`);

  const onProgress = (p: CreativeRunProgress) => {
    const prefix = p.step === "page" ? `[${p.pageName}]` : `[${p.step}]`;
    console.log(`${prefix} ${p.message ?? ""}`);
  };

  const result = await executeCreativeBuild(buildConfig, config, onProgress);
  console.log(`\nDB run ID: ${result.dbRunId}`);
  console.log(`Estimated cost: $${result.estimatedCostUsd.toFixed(4)}`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
