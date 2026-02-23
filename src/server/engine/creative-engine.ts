/**
 * Creative Build Engine
 *
 * Extracted from scripts/creative-build.ts. Calls the Anthropic API directly
 * (bypassing edge functions) with a minimal creative prompt. The model receives
 * the full site spec and client design choices but has full creative freedom
 * over layout, components, spacing, and visual hierarchy.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { STOCK_PHOTOS, createServiceClient, generateAuthToken } from "./supabase-client.js";
import { insertCreativeRun, updateCreativeRunStatus, insertCreativeRunPage } from "./creative-run-db.js";
import { extractPageMetrics } from "./html-metrics.js";
import type { SupabaseConfig } from "./supabase-client.js";
import type { CreativeRunInsert, CreativeRunPageInsert } from "./creative-run-types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreativeBuildConfig {
  model: string;
  temperature: number;
  palette: string;
  typography: string;
  style: string;
  feeling: string;
}

export interface CreativeRunProgress {
  runId: string;
  step: "init" | "design-system" | "page" | "saving" | "deploying" | "complete" | "error";
  pageName?: string;
  pageIndex?: number;
  totalPages?: number;
  message?: string;
  previewUrl?: string;
}

// ---------------------------------------------------------------------------
// Internal types
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
  training_provider?: string;
  training_year?: string;
  additional_training?: string[];
  doula_uk?: boolean;
  [key: string]: unknown;
}

interface DesignSystem {
  css: string;
  nav_html: string;
  footer_html: string;
  wordmark_svg: string;
}

interface GenerationStats {
  inputTokens: number;
  outputTokens: number;
  elapsedS: number;
}

interface DesignSystemResult {
  designSystem: DesignSystem;
  stats: GenerationStats;
}

interface PageResult {
  html: string;
  stats: GenerationStats;
}

interface DbContext {
  client: SupabaseClient;
  runId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TOKENS = 16_384;

const SPEC_PATH = join(
  process.cwd(),
  "runs/4deebe94-45f5-4ca9-aa9e-6ce4a64722b2/detailed-dina/site-spec.json",
);

export const PALETTES: Record<string, { background: string; primary: string; accent: string; text: string; cta: string }> = {
  sage_sand: { background: "#f5f0e8", primary: "#5f7161", accent: "#c9b99a", text: "#3d3d3d", cta: "#5f7161" },
  blush_neutral: { background: "#fdf6f0", primary: "#c9928e", accent: "#d4c5b9", text: "#4a4a4a", cta: "#c9928e" },
  deep_earth: { background: "#f0ebe3", primary: "#6b4c3b", accent: "#a08060", text: "#2d2d2d", cta: "#6b4c3b" },
  ocean_calm: { background: "#f0f4f5", primary: "#3d6b7e", accent: "#8fb8c9", text: "#2d3b3e", cta: "#3d6b7e" },
};

export const TYPOGRAPHY_PRESETS: Record<string, { heading: string; body: string }> = {
  modern: { heading: "Inter", body: "Inter" },
  classic: { heading: "Playfair Display", body: "Source Sans 3" },
  mixed: { heading: "DM Serif Display", body: "Inter" },
};

/** Per-million-token rates: [input, output] in USD */
export const MODEL_RATES: Record<string, [number, number]> = {
  "claude-opus-4-6": [15, 75],
  "claude-sonnet-4-5-20250929": [3, 15],
  "claude-haiku-4-5-20251001": [0.8, 4],
  "gpt-5.2": [2.5, 10],
  "gpt-5.2-pro": [5, 20],
  "gpt-5-mini": [0.3, 1.25],
};

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
// Utility functions
// ---------------------------------------------------------------------------

export function detectModelProvider(modelName: string): string {
  if (modelName.startsWith("claude")) return "anthropic";
  if (modelName.startsWith("gpt")) return "openai";
  if (modelName.startsWith("gemini")) return "google";
  return "unknown";
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_RATES[model];
  if (!rates) {
    console.warn(`[creative-engine] No cost rates for model "${model}", falling back to Sonnet rates [$3/$15]`);
  }
  const effective = rates ?? [3, 15];
  return (inputTokens * effective[0] + outputTokens * effective[1]) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildPhotos(supabaseUrl: string): Array<{ purpose: string; url: string; alt: string }> {
  const storageBase = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/photos`;
  return STOCK_PHOTOS.map((p) => ({
    purpose: p.purpose,
    url: `${storageBase}/${p.storage_path}`,
    alt: p.alt_text,
  }));
}

function buildDesignSystemPrompt(
  spec: SiteSpec,
  colours: { background: string; primary: string; accent: string; text: string; cta: string },
  headingFont: string,
  bodyFont: string,
  photos: Array<{ purpose: string; url: string; alt: string }>,
): string {
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
  spec: SiteSpec,
  page: string,
  designSystemCss: string,
  navHtml: string,
  footerHtml: string,
  photos: Array<{ purpose: string; url: string; alt: string }>,
): string {
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
// OpenAI tool definitions (function calling format)
// ---------------------------------------------------------------------------

const OPENAI_DESIGN_SYSTEM_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "design_system",
    description: "Submit the complete design system for the website.",
    parameters: {
      type: "object",
      properties: {
        css: { type: "string", description: "Complete CSS file contents" },
        nav_html: { type: "string", description: "Complete header/navigation HTML" },
        footer_html: { type: "string", description: "Complete footer HTML" },
        wordmark_svg: { type: "string", description: "SVG wordmark of the business name" },
      },
      required: ["css", "nav_html", "footer_html", "wordmark_svg"],
    },
  },
};

const OPENAI_PAGE_HTML_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "page_html",
    description: "Submit the complete HTML for a page.",
    parameters: {
      type: "object",
      properties: {
        html: { type: "string", description: "Complete HTML document" },
      },
      required: ["html"],
    },
  },
};

// ---------------------------------------------------------------------------
// API call helpers — Anthropic
// ---------------------------------------------------------------------------

async function generateDesignSystemAnthropic(
  client: Anthropic,
  model: string,
  temperature: number,
  prompt: string,
): Promise<{ result: Record<string, string>; inputTokens: number; outputTokens: number }> {
  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    temperature,
    system: "You are a world-class web designer. Return your work exclusively via the design_system tool.",
    messages: [{ role: "user", content: prompt }],
    tools: [DESIGN_SYSTEM_TOOL],
    tool_choice: { type: "tool", name: "design_system" },
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use" && b.name === "design_system");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`Model did not return design_system tool call. Stop reason: ${response.stop_reason}`);
  }

  return {
    result: toolBlock.input as Record<string, string>,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function generatePageAnthropic(
  client: Anthropic,
  model: string,
  temperature: number,
  prompt: string,
): Promise<{ html: string; inputTokens: number; outputTokens: number }> {
  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    temperature,
    system: "You are a world-class web designer. Return your work exclusively via the page_html tool.",
    messages: [{ role: "user", content: prompt }],
    tools: [PAGE_HTML_TOOL],
    tool_choice: { type: "tool", name: "page_html" },
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use" && b.name === "page_html");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`Model did not return page_html tool call. Stop reason: ${response.stop_reason}`);
  }

  return {
    html: (toolBlock.input as Record<string, string>).html ?? "",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// API call helpers — OpenAI
// ---------------------------------------------------------------------------

async function generateDesignSystemOpenAI(
  client: OpenAI,
  model: string,
  temperature: number,
  prompt: string,
): Promise<{ result: Record<string, string>; inputTokens: number; outputTokens: number }> {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: MAX_TOKENS,
    temperature,
    messages: [
      { role: "system", content: "You are a world-class web designer. Return your work exclusively via the design_system tool." },
      { role: "user", content: prompt },
    ],
    tools: [OPENAI_DESIGN_SYSTEM_TOOL],
    tool_choice: { type: "function", function: { name: "design_system" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== "design_system") {
    throw new Error(`OpenAI model did not return design_system tool call. Finish reason: ${response.choices[0]?.finish_reason}`);
  }

  let result: Record<string, string>;
  try {
    result = JSON.parse(toolCall.function.arguments) as Record<string, string>;
  } catch (parseErr) {
    throw new Error(
      `Failed to parse OpenAI design_system tool call arguments: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. ` +
      `Raw (first 500 chars): ${toolCall.function.arguments.slice(0, 500)}`
    );
  }
  if (!response.usage) {
    console.warn(`[creative-engine] OpenAI design_system response missing usage data for model ${model}`);
  }
  return {
    result,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

async function generatePageOpenAI(
  client: OpenAI,
  model: string,
  temperature: number,
  prompt: string,
): Promise<{ html: string; inputTokens: number; outputTokens: number }> {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: MAX_TOKENS,
    temperature,
    messages: [
      { role: "system", content: "You are a world-class web designer. Return your work exclusively via the page_html tool." },
      { role: "user", content: prompt },
    ],
    tools: [OPENAI_PAGE_HTML_TOOL],
    tool_choice: { type: "function", function: { name: "page_html" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== "page_html") {
    throw new Error(`OpenAI model did not return page_html tool call. Finish reason: ${response.choices[0]?.finish_reason}`);
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(toolCall.function.arguments) as Record<string, string>;
  } catch (parseErr) {
    throw new Error(
      `Failed to parse OpenAI page_html tool call arguments: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. ` +
      `Raw (first 500 chars): ${toolCall.function.arguments.slice(0, 500)}`
    );
  }
  if (!response.usage) {
    console.warn(`[creative-engine] OpenAI page_html response missing usage data for model ${model}`);
  }
  return {
    html: parsed.html ?? "",
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Provider-agnostic generation
// ---------------------------------------------------------------------------

async function generateDesignSystem(
  provider: string,
  anthropicClient: Anthropic,
  openaiClient: OpenAI,
  model: string,
  temperature: number,
  spec: SiteSpec,
  colours: { background: string; primary: string; accent: string; text: string; cta: string },
  headingFont: string,
  bodyFont: string,
  photos: Array<{ purpose: string; url: string; alt: string }>,
): Promise<DesignSystemResult> {
  const prompt = buildDesignSystemPrompt(spec, colours, headingFont, bodyFont, photos);

  const raw = provider === "openai"
    ? await generateDesignSystemOpenAI(openaiClient, model, temperature, prompt)
    : await generateDesignSystemAnthropic(anthropicClient, model, temperature, prompt);

  return {
    designSystem: {
      css: raw.result.css ?? "",
      nav_html: raw.result.nav_html ?? "",
      footer_html: raw.result.footer_html ?? "",
      wordmark_svg: raw.result.wordmark_svg ?? "",
    },
    stats: { inputTokens: raw.inputTokens, outputTokens: raw.outputTokens, elapsedS: 0 },
  };
}

async function generatePage(
  provider: string,
  anthropicClient: Anthropic,
  openaiClient: OpenAI,
  model: string,
  temperature: number,
  spec: SiteSpec,
  page: string,
  ds: DesignSystem,
  photos: Array<{ purpose: string; url: string; alt: string }>,
): Promise<PageResult> {
  const prompt = buildPagePrompt(spec, page, ds.css, ds.nav_html, ds.footer_html, photos);

  const raw = provider === "openai"
    ? await generatePageOpenAI(openaiClient, model, temperature, prompt)
    : await generatePageAnthropic(anthropicClient, model, temperature, prompt);

  return {
    html: raw.html,
    stats: { inputTokens: raw.inputTokens, outputTokens: raw.outputTokens, elapsedS: 0 },
  };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function recordDesignSystemPage(
  db: DbContext,
  css: string,
  stats: GenerationStats,
): Promise<void> {
  const pageInsert: CreativeRunPageInsert = {
    run_id: db.runId,
    page_name: "design_system",
    css,
    input_tokens: stats.inputTokens,
    output_tokens: stats.outputTokens,
    generation_time_s: Math.round(stats.elapsedS * 10) / 10,
  };
  await insertCreativeRunPage(db.client, pageInsert);
}

async function recordHtmlPage(
  db: DbContext,
  pageName: string,
  html: string,
  stats: GenerationStats,
): Promise<void> {
  const metrics = extractPageMetrics(html);
  const pageInsert: CreativeRunPageInsert = {
    run_id: db.runId,
    page_name: pageName,
    html,
    input_tokens: stats.inputTokens,
    output_tokens: stats.outputTokens,
    generation_time_s: Math.round(stats.elapsedS * 10) / 10,
    img_count: metrics.imgCount,
    heading_count: metrics.headingCount,
    landmark_count: metrics.landmarkCount,
    link_count: metrics.linkCount,
    schema_org_present: metrics.schemaOrgPresent,
  };
  await insertCreativeRunPage(db.client, pageInsert);
}

const DINA_SITE_SPEC_ID = "6ddb56d6-1e1a-491b-9455-2b09fbec685c";

async function deployToNetlify(
  files: Array<{ path: string; content: string }>,
  supabaseConfig: SupabaseConfig,
): Promise<string> {
  const serviceClient = createServiceClient(supabaseConfig);

  // Clear netlify_site_id and subdomain_slug so the /build endpoint creates
  // a fresh Netlify site with an auto-generated subdomain. Without this,
  // every build reuses the same cached netlify_site_id and overwrites the
  // previous deployment.
  const { error: clearErr } = await serviceClient
    .from("site_specs")
    .update({ netlify_site_id: null, subdomain_slug: null })
    .eq("id", DINA_SITE_SPEC_ID);
  if (clearErr) {
    throw new Error(`Failed to clear netlify fields on site_spec: ${clearErr.message}`);
  }

  const authToken = await generateAuthToken(supabaseConfig);
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
  if (!result.preview_url) {
    throw new Error("Build endpoint did not return a preview_url");
  }
  return result.preview_url;
}

async function recordRunComplete(
  db: DbContext,
  totalInputTokens: number,
  totalOutputTokens: number,
  totalTimeS: number,
  estimatedCostUsd: number,
  previewUrl?: string,
): Promise<void> {
  await updateCreativeRunStatus(db.client, db.runId, "complete", {
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_time_s: Math.round(totalTimeS * 10) / 10,
    estimated_cost_usd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    preview_url: previewUrl,
  });
}

async function recordRunError(db: DbContext, errorMessage: string): Promise<void> {
  await updateCreativeRunStatus(db.client, db.runId, "error", {
    error_message: errorMessage,
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function executeCreativeBuild(
  config: CreativeBuildConfig,
  supabaseConfig: SupabaseConfig,
  onProgress: (p: CreativeRunProgress) => void,
): Promise<{ dbRunId: string; estimatedCostUsd: number }> {
  const provider = detectModelProvider(config.model);
  const anthropicClient = new Anthropic();
  const openaiClient = new OpenAI();

  // Load spec
  const spec = JSON.parse(readFileSync(SPEC_PATH, "utf-8")) as SiteSpec;

  // Apply config overrides
  spec.palette = config.palette;
  spec.typography = config.typography;
  spec.style = config.style;
  spec.brand_feeling = config.feeling;

  // Resolve design variables
  const supabaseUrl = supabaseConfig.supabaseUrl;
  const photos = buildPhotos(supabaseUrl);
  if (!PALETTES[spec.palette]) {
    console.warn(`[creative-engine] Unknown palette "${spec.palette}", falling back to sage_sand`);
  }
  if (!TYPOGRAPHY_PRESETS[spec.typography]) {
    console.warn(`[creative-engine] Unknown typography "${spec.typography}", falling back to modern`);
  }
  const colours = PALETTES[spec.palette] ?? PALETTES["sage_sand"]!;
  const typo = TYPOGRAPHY_PRESETS[spec.typography] ?? TYPOGRAPHY_PRESETS["modern"]!;
  const headingFont = spec.font_heading ?? typo.heading;
  const bodyFont = spec.font_body ?? typo.body;

  // Init DB
  const client = createServiceClient(supabaseConfig);
  const runInsert: CreativeRunInsert = {
    model_provider: detectModelProvider(config.model),
    model_name: config.model,
    temperature: config.temperature,
    max_tokens: MAX_TOKENS,
    palette: spec.palette,
    typography: spec.typography,
    style: spec.style,
    brand_feeling: spec.brand_feeling,
    site_spec_name: spec.business_name,
    site_spec_snapshot: spec as unknown as Record<string, unknown>,
    status: "generating",
  };
  const dbRunId = await insertCreativeRun(client, runInsert);
  const db: DbContext = { client, runId: dbRunId };

  onProgress({ runId: dbRunId, step: "init", message: `Starting creative build with ${config.model}` });

  const mainStart = Date.now();

  try {
    // Step 1: Design system
    onProgress({ runId: dbRunId, step: "design-system", message: `Generating design system with ${config.model}...` });
    const dsStart = Date.now();
    const dsResult = await generateDesignSystem(provider, anthropicClient, openaiClient, config.model, config.temperature, spec, colours, headingFont, bodyFont, photos);
    dsResult.stats.elapsedS = (Date.now() - dsStart) / 1000;
    const ds = dsResult.designSystem;
    await recordDesignSystemPage(db, ds.css, dsResult.stats);

    // Step 2: Pages (sequential to avoid rate limits)
    const files: Array<{ path: string; content: string }> = [];
    files.push({ path: "styles.css", content: ds.css });

    let totalInputTokens = dsResult.stats.inputTokens;
    let totalOutputTokens = dsResult.stats.outputTokens;

    for (let i = 0; i < spec.pages.length; i++) {
      const page = spec.pages[i]!;
      onProgress({
        runId: dbRunId,
        step: "page",
        pageName: page,
        pageIndex: i,
        totalPages: spec.pages.length,
        message: `Generating ${page} page (${i + 1}/${spec.pages.length})...`,
      });

      const pageStart = Date.now();
      const pageResult = await generatePage(provider, anthropicClient, openaiClient, config.model, config.temperature, spec, page, ds, photos);
      pageResult.stats.elapsedS = (Date.now() - pageStart) / 1000;
      files.push({ path: `${page}.html`, content: pageResult.html });

      totalInputTokens += pageResult.stats.inputTokens;
      totalOutputTokens += pageResult.stats.outputTokens;

      await recordHtmlPage(db, page, pageResult.html, pageResult.stats);
    }

    const totalTimeS = (Date.now() - mainStart) / 1000;
    const totalCost = estimateCost(config.model, totalInputTokens, totalOutputTokens);

    // Step 3: Save locally
    onProgress({ runId: dbRunId, step: "saving", message: "Saving files locally..." });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outDir = join(process.cwd(), `runs/creative-${config.model}-${timestamp}`);
    mkdirSync(outDir, { recursive: true });

    writeFileSync(join(outDir, "design-system.json"), JSON.stringify(ds, null, 2));
    for (const f of files) {
      writeFileSync(join(outDir, f.path), f.content);
    }

    const manifest = {
      model: config.model,
      temperature: config.temperature,
      max_tokens: MAX_TOKENS,
      run_id: dbRunId,
      spec_name: spec.business_name,
      palette: spec.palette,
      typography: spec.typography,
      style: spec.style,
      brand_feeling: spec.brand_feeling,
      pages: spec.pages,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_time_s: Math.round(totalTimeS * 10) / 10,
      estimated_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // Step 4: Deploy to Netlify via /build edge function
    onProgress({ runId: dbRunId, step: "deploying", message: "Deploying to Netlify..." });
    let previewUrl: string | undefined;
    try {
      previewUrl = await deployToNetlify(files, supabaseConfig);
    } catch (deployErr) {
      // Deploy failures are non-fatal — log and continue
      const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
      onProgress({ runId: dbRunId, step: "deploying", message: `Deploy failed (non-fatal): ${msg}` });
    }

    // Update DB with totals + preview URL
    await recordRunComplete(db, totalInputTokens, totalOutputTokens, totalTimeS, totalCost, previewUrl);

    onProgress({
      runId: dbRunId,
      step: "complete",
      message: previewUrl
        ? `Build complete — $${totalCost.toFixed(4)} — ${Math.round(totalTimeS)}s`
        : `Build complete (no deploy) — $${totalCost.toFixed(4)} — ${Math.round(totalTimeS)}s`,
      previewUrl,
    });

    return { dbRunId, estimatedCostUsd: totalCost };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordRunError(db, message).catch((dbErr) => {
      console.error(`[creative-engine] Failed to record error status for run ${db.runId}: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
    });
    onProgress({ runId: dbRunId, step: "error", message });
    throw err;
  }
}
