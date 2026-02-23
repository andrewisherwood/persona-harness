/**
 * Creative Build: Unconstrained LLM Site Generation
 *
 * Calls the Anthropic API directly (bypassing edge functions) with a minimal
 * creative prompt. The model receives the full site spec and client design
 * choices (palette, typography, style, brand feeling) but has full creative
 * freedom over layout, components, spacing, and visual hierarchy.
 *
 * No enforced CSS selectors. No HTML templates. No post-processing CSS strip.
 *
 * Usage:
 *   npx tsx scripts/creative-build.ts                    # defaults to claude-opus-4-6
 *   npx tsx scripts/creative-build.ts claude-sonnet-4-5-20250929
 *   npx tsx scripts/creative-build.ts gpt-5.2            # requires OPENAI_API_KEY
 *
 * Output is saved locally for inspection. Deploy with:
 *   npx tsx scripts/creative-deploy.ts <output-dir>
 */

import dotenv from "dotenv";
dotenv.config();

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { STOCK_PHOTOS } from "../src/server/engine/supabase-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = process.argv[2] || "claude-opus-4-6";
const MAX_TOKENS = 16_384;

const SPEC_PATH = join(
  __dirname,
  "../runs/4deebe94-45f5-4ca9-aa9e-6ce4a64722b2/detailed-dina/site-spec.json",
);

// Palette and typography lookup tables (mirrored from BirthBuild edge functions)
const PALETTES: Record<string, { background: string; primary: string; accent: string; text: string; cta: string }> = {
  sage_sand: { background: "#f5f0e8", primary: "#5f7161", accent: "#c9b99a", text: "#3d3d3d", cta: "#5f7161" },
  blush_neutral: { background: "#fdf6f0", primary: "#c9928e", accent: "#d4c5b9", text: "#4a4a4a", cta: "#c9928e" },
  deep_earth: { background: "#f0ebe3", primary: "#6b4c3b", accent: "#a08060", text: "#2d2d2d", cta: "#6b4c3b" },
  ocean_calm: { background: "#f0f4f5", primary: "#3d6b7e", accent: "#8fb8c9", text: "#2d3b3e", cta: "#3d6b7e" },
};

const TYPOGRAPHY_PRESETS: Record<string, { heading: string; body: string }> = {
  modern: { heading: "Inter", body: "Inter" },
  classic: { heading: "Playfair Display", body: "Source Sans 3" },
  mixed: { heading: "DM Serif Display", body: "Inter" },
};

// ---------------------------------------------------------------------------
// Load spec and resolve design variables
// ---------------------------------------------------------------------------

interface SiteSpec {
  business_name: string;
  doula_name: string;
  tagline: string;
  service_area: string;
  services: Array<Record<string, unknown>>;
  email: string;
  phone: string;
  booking_url: string;
  social_links: Record<string, string>;
  bio: string;
  philosophy: string;
  testimonials: Array<{ name: string; quote: string; context: string }>;
  style: string;
  palette: string;
  custom_colours: Record<string, string> | null;
  typography: string;
  font_heading: string | null;
  font_body: string | null;
  brand_feeling: string;
  pages: string[];
  [key: string]: unknown;
}

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf-8")) as SiteSpec;

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "";
const storageBase = `${supabaseUrl}/storage/v1/object/public/photos`;
const photos = STOCK_PHOTOS.map((p) => ({
  purpose: p.purpose,
  url: `${storageBase}/${p.storage_path}`,
  alt: p.alt_text,
}));

const colours = PALETTES[spec.palette] ?? PALETTES["sage_sand"]!;
const typo = TYPOGRAPHY_PRESETS[spec.typography] ?? TYPOGRAPHY_PRESETS["modern"]!;
const headingFont = spec.font_heading ?? typo.heading;
const bodyFont = spec.font_body ?? typo.body;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildDesignSystemPrompt(): string {
  return `You are a world-class web designer building a complete website for a birth doula practice.

## Client Brief

Business: ${spec.business_name}
Doula: ${spec.doula_name}
Tagline: "${spec.tagline}"
Location: ${spec.service_area}
Brand feeling: ${spec.brand_feeling}
Style: ${spec.style}

## Design Constraints (from the client)

Colour palette (${spec.palette}):
- Background: ${colours.background}
- Primary: ${colours.primary}
- Accent: ${colours.accent}
- Text: ${colours.text}
- CTA: ${colours.cta}

Typography:
- Headings: ${headingFont}
- Body: ${bodyFont}

These are the client's choices — honour them exactly. Within these constraints you have
full creative freedom over layout, spacing, component design, visual hierarchy, hover
states, transitions, and how you compose the content into a beautiful, cohesive site.

## Photos

These are real, hosted images. Design your components to showcase them:
${photos.map((p) => `- ${p.purpose}: ${p.url} (alt: "${p.alt}")`).join("\n")}

## Pages

The site has these pages: ${spec.pages.join(", ")}

## Your Task

Design a complete CSS design system for this website. Return your work via the
design_system tool.

Requirements for the CSS:
- :root variables using the exact colour values above
- Google Fonts @import for ${headingFont} and ${bodyFont}
- Complete reset and base styles
- All component styles needed for every page (hero, cards, sections, testimonials, etc.)
- Mobile-first responsive design with breakpoints
- Smooth transitions and thoughtful hover states
- The CSS must be self-contained — pages will link to it as a single stylesheet

Requirements for nav_html:
- Complete <header> with skip-to-content link
- Navigation linking to: ${spec.pages.map((p) => p + ".html").join(", ")}
- CSS-only responsive hamburger menu for mobile
- Business name/wordmark in the header

Requirements for footer_html:
- Complete <footer> with business name, tagline, social links, copyright
- Social links: ${Object.entries(spec.social_links).map(([k, v]) => `${k}: ${v}`).join(", ")}

Requirements for wordmark_svg:
- SVG text wordmark of "${spec.business_name}"

Be bold. Be beautiful. Use the client's colours and fonts — make them sing.`;
}

function buildPagePrompt(
  page: string,
  designSystemCss: string,
  navHtml: string,
  footerHtml: string,
): string {
  // Build page-specific content guidance from the spec
  let pageGuidance = "";
  switch (page) {
    case "home":
      pageGuidance = `This is the homepage — the first impression. It should include:
- A compelling hero section using the hero photo
- A brief introduction to ${spec.doula_name} and her practice
- An overview of services (${spec.services.map((s) => s.title).join(", ")})
- A testimonial highlight
- A clear call to action to get in touch
- Use the gallery and headshot photos where they enhance the design`;
      break;
    case "about":
      pageGuidance = `This is the about page. Content to work with:

Bio:
${spec.bio}

Philosophy:
${spec.philosophy}

Training: ${spec.training_provider} (${spec.training_year}), additional: ${(spec.additional_training as string[] | undefined)?.join(", ") ?? ""}
Doula UK member: ${spec.doula_uk ? "Yes" : "No"}

Use the headshot photo. Make the bio compelling and personal.`;
      break;
    case "services":
      pageGuidance = `This is the services page. Display these services:
${spec.services.map((s) => `- ${s.title}: ${s.price} — ${s.description}`).join("\n")}

Use gallery photos to make the service cards visually rich.`;
      break;
    case "testimonials":
      pageGuidance = `This is the testimonials page. Display these testimonials:
${spec.testimonials.map((t) => `- "${t.quote}" — ${t.name} (${t.context})`).join("\n")}

Make each testimonial feel personal and impactful.`;
      break;
    case "faq":
      pageGuidance = `This is the FAQ page. Create helpful FAQs appropriate for a doula practice in ${spec.service_area}. Cover common questions about:
- What a doula does
- What to expect from the services offered
- Pricing and booking
- Areas covered`;
      break;
    case "contact":
      pageGuidance = `This is the contact page. Include:
- Email: ${spec.email}
- Phone: ${spec.phone}
- Booking link: ${spec.booking_url}
- Service area: ${spec.service_area}
- A contact form (HTML only, no backend needed)
- Social links: ${Object.entries(spec.social_links).map(([k, v]) => `${k}: ${v}`).join(", ")}`;
      break;
    default:
      pageGuidance = `Build a beautiful ${page} page using the business data from the spec.`;
  }

  return `You are a world-class web designer building the "${page}" page for ${spec.business_name}.

## Design System CSS

Use these styles. Do NOT add <style> blocks — reference only the classes from this CSS:

${designSystemCss}

## Navigation (include at top of every page)

${navHtml}

## Footer (include at bottom of every page)

${footerHtml}

## Photos

${photos.map((p) => `- ${p.purpose}: ${p.url} (alt: "${p.alt}")`).join("\n")}

## Page Content

${pageGuidance}

## Your Task

Build a complete, production-ready HTML page. The page must:
- Be a valid HTML5 document
- Link to the design system as <link rel="stylesheet" href="styles.css">
- Include the navigation and footer exactly as provided
- Use the photos — they are real, hosted images
- Use British English throughout
- Include appropriate Schema.org JSON-LD structured data

Return the complete HTML via the page_html tool.`;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const DESIGN_SYSTEM_TOOL: Anthropic.Tool = {
  name: "design_system",
  description: "Submit the complete design system for the website.",
  input_schema: {
    type: "object" as const,
    properties: {
      css: { type: "string", description: "Complete CSS file contents" },
      nav_html: { type: "string", description: "Complete header/navigation HTML" },
      footer_html: { type: "string", description: "Complete footer HTML" },
      wordmark_svg: { type: "string", description: "SVG wordmark of the business name" },
    },
    required: ["css", "nav_html", "footer_html", "wordmark_svg"],
  },
};

const PAGE_HTML_TOOL: Anthropic.Tool = {
  name: "page_html",
  description: "Submit the complete HTML for a page.",
  input_schema: {
    type: "object" as const,
    properties: {
      html: { type: "string", description: "Complete HTML document" },
    },
    required: ["html"],
  },
};

// ---------------------------------------------------------------------------
// API call helpers
// ---------------------------------------------------------------------------

const client = new Anthropic();

interface DesignSystem {
  css: string;
  nav_html: string;
  footer_html: string;
  wordmark_svg: string;
}

async function generateDesignSystem(): Promise<DesignSystem> {
  console.log(`\n[design-system] Calling ${MODEL}...`);
  const start = Date.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    system: "You are a world-class web designer. Return your work exclusively via the design_system tool.",
    messages: [{ role: "user", content: buildDesignSystemPrompt() }],
    tools: [DESIGN_SYSTEM_TOOL],
    tool_choice: { type: "tool", name: "design_system" },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[design-system] Done in ${elapsed}s — ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  const toolBlock = response.content.find((b) => b.type === "tool_use" && b.name === "design_system");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`Model did not return design_system tool call. Stop reason: ${response.stop_reason}`);
  }

  const input = toolBlock.input as Record<string, string>;
  return {
    css: input.css ?? "",
    nav_html: input.nav_html ?? "",
    footer_html: input.footer_html ?? "",
    wordmark_svg: input.wordmark_svg ?? "",
  };
}

async function generatePage(page: string, ds: DesignSystem): Promise<string> {
  console.log(`[${page}] Calling ${MODEL}...`);
  const start = Date.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    system: "You are a world-class web designer. Return your work exclusively via the page_html tool.",
    messages: [{ role: "user", content: buildPagePrompt(page, ds.css, ds.nav_html, ds.footer_html) }],
    tools: [PAGE_HTML_TOOL],
    tool_choice: { type: "tool", name: "page_html" },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[${page}] Done in ${elapsed}s — ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  const toolBlock = response.content.find((b) => b.type === "tool_use" && b.name === "page_html");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`Model did not return page_html tool call for ${page}. Stop reason: ${response.stop_reason}`);
  }

  return (toolBlock.input as Record<string, string>).html ?? "";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Creative build: ${MODEL}`);
  console.log(`Spec: ${spec.business_name} (${spec.pages.length} pages)`);
  console.log(`Palette: ${spec.palette} | Typography: ${spec.typography} | Style: ${spec.style} | Feeling: ${spec.brand_feeling}`);
  console.log(`Photos: ${photos.length}`);

  // Step 1: Design system
  const ds = await generateDesignSystem();

  // Step 2: Pages (sequential to avoid rate limits)
  const files: Array<{ path: string; content: string }> = [];
  files.push({ path: "styles.css", content: ds.css });

  for (const page of spec.pages) {
    const html = await generatePage(page, ds);
    files.push({ path: `${page}.html`, content: html });
  }

  // Step 3: Save locally
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(__dirname, `../runs/creative-${MODEL}-${timestamp}`);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "design-system.json"), JSON.stringify(ds, null, 2));
  for (const f of files) {
    writeFileSync(join(outDir, f.path), f.content);
  }

  // Summary
  console.log(`\nFiles saved to: ${outDir}`);
  console.log("Files:");
  for (const f of files) {
    console.log(`  ${f.path} (${(f.content.length / 1024).toFixed(1)}KB)`);
  }
  console.log(`\nInspect locally, then deploy with:`);
  console.log(`  npx tsx scripts/creative-deploy.ts ${outDir}`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
