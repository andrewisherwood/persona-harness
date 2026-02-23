/**
 * Creative Deploy: Deploy locally-generated site files via /build edge function
 *
 * Takes a directory of HTML/CSS files from creative-build.ts and deploys them
 * to Netlify via the existing BirthBuild /build endpoint.
 *
 * Usage:
 *   npx tsx scripts/creative-deploy.ts runs/creative-claude-opus-4-6-2026-02-23T12-00-00
 */

import dotenv from "dotenv";
dotenv.config();

import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import { generateAuthToken, validateConfig } from "../src/server/engine/supabase-client.js";
import type { SupabaseConfig } from "../src/server/engine/supabase-client.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: npx tsx scripts/creative-deploy.ts <output-dir>");
  process.exit(1);
}

// The site_spec_id for Dina Hart — used by the /build endpoint to associate
// the deployment with a spec record.
const DINA_SITE_SPEC_ID = "6ddb56d6-1e1a-491b-9455-2b09fbec685c";

const supabaseConfig: SupabaseConfig = {
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  anonKey: process.env.SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  testTenantId: process.env.TEST_TENANT_ID ?? "",
  testUserId: process.env.TEST_USER_ID ?? "",
  authToken: process.env.AUTH_TOKEN ?? "",
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  validateConfig(supabaseConfig);

  // Generate fresh auth token
  console.log("Generating auth token...");
  const authToken = await generateAuthToken(supabaseConfig);

  // Read all HTML and CSS files from the output directory
  const allFiles = readdirSync(outDir).filter(
    (f) => f.endsWith(".html") || f.endsWith(".css"),
  );

  if (allFiles.length === 0) {
    console.error(`No HTML/CSS files found in ${outDir}`);
    process.exit(1);
  }

  const files = allFiles.map((filename) => ({
    path: filename,
    content: readFileSync(join(outDir, filename), "utf-8"),
  }));

  console.log(`Deploying ${files.length} files from ${basename(outDir)}:`);
  for (const f of files) {
    console.log(`  ${f.path} (${(f.content.length / 1024).toFixed(1)}KB)`);
  }

  // Call /build endpoint
  const buildUrl = `${supabaseConfig.supabaseUrl.replace(/\/$/, "")}/functions/v1/build`;
  const response = await fetch(buildUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_spec_id: DINA_SITE_SPEC_ID,
      files,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Build endpoint error ${response.status}: ${text}`);
  }

  const result = (await response.json()) as { preview_url?: string };
  console.log(`\nDeployed: ${result.preview_url}`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
