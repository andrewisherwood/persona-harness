/**
 * Capture screenshots + accessibility trees for a deployed creative site.
 * Uploads screenshots to Supabase storage and updates creative_run_pages rows.
 *
 * Usage:
 *   npx tsx scripts/creative-capture.ts <run-id> <preview-url>
 *
 * Requires: Playwright Chromium installed (npx playwright install chromium)
 */
import dotenv from "dotenv";
dotenv.config();

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { getCreativeRunPages } from "../src/server/engine/creative-run-db.js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const runIdArg = process.argv[2];
const previewUrlArg = process.argv[3];

if (!runIdArg || !previewUrlArg) {
  console.error(
    "Usage: npx tsx scripts/creative-capture.ts <run-id> <preview-url>",
  );
  process.exit(1);
}

// After the guard above, these are guaranteed to be strings.
// Assign to const with definite types so tsc doesn't carry the `string | undefined`.
const runId: string = runIdArg;
const previewUrl: string = previewUrlArg;

// Strip trailing slash from preview URL for consistent path joining
const baseUrl = previewUrl.replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Fetch pages for this run from DB
  console.log(`Fetching pages for run ${runId}...`);
  const pages = await getCreativeRunPages(supabase, runId);

  if (pages.length === 0) {
    console.error(`No pages found for run ${runId}`);
    process.exit(1);
  }

  console.log(
    `Found ${pages.length} pages: ${pages.map((p) => p.page_name).join(", ")}`,
  );

  // 2. Launch headless browser
  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  try {
    for (const page of pages) {
      // Skip design_system — it has no renderable page
      if (page.page_name === "design_system") {
        console.log(`  [${page.page_name}] Skipping (no renderable page)`);
        continue;
      }

      // Determine URL: home = base URL, others = base URL / page_name.html
      const pageUrl =
        page.page_name === "home"
          ? baseUrl
          : `${baseUrl}/${page.page_name}.html`;

      console.log(`  [${page.page_name}] Navigating to ${pageUrl}...`);
      const browserPage = await context.newPage();

      try {
        await browserPage.goto(pageUrl, { waitUntil: "networkidle" });

        // Capture accessibility tree via Playwright's ariaSnapshot (YAML string)
        console.log(`  [${page.page_name}] Capturing accessibility tree...`);
        const ariaSnapshotYaml = await browserPage
          .locator("body")
          .ariaSnapshot();

        // Wrap the YAML string in an object for the jsonb DB column
        const accessibilityTree: Record<string, unknown> = {
          snapshot: ariaSnapshotYaml,
        };

        // Capture full-page screenshot
        console.log(`  [${page.page_name}] Capturing screenshot...`);
        const screenshotBuffer = await browserPage.screenshot({
          fullPage: true,
        });

        // Upload screenshot to Supabase storage
        const storagePath = `research/${runId}/${page.page_name}.png`;
        console.log(
          `  [${page.page_name}] Uploading screenshot to ${storagePath}...`,
        );
        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(storagePath, screenshotBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error(
            `  [${page.page_name}] Upload failed: ${uploadError.message}`,
          );
          continue;
        }

        // Update creative_run_pages row with accessibility tree and screenshot path
        console.log(`  [${page.page_name}] Updating DB record...`);
        const { error: updateError } = await supabase
          .from("creative_run_pages")
          .update({
            accessibility_tree: accessibilityTree,
            screenshot_path: storagePath,
          })
          .eq("id", page.id);

        if (updateError) {
          console.error(
            `  [${page.page_name}] DB update failed: ${updateError.message}`,
          );
          continue;
        }

        console.log(`  [${page.page_name}] Done.`);
      } finally {
        await browserPage.close();
      }
    }
  } finally {
    // 3. Close browser
    await browser.close();
    console.log("\nBrowser closed.");
  }

  console.log(`\nCapture complete for run ${runId}.`);
}

main().catch((err: unknown) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
