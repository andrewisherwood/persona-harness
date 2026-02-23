/**
 * Types for creative run research framework.
 * Supports systematic comparison of LLM-generated websites.
 *
 * Maps to the `creative_runs` and `creative_run_pages` Supabase tables.
 * Used by the research pipeline to track unconstrained LLM site generation
 * experiments across different models and configurations.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type CreativeRunStatus =
  | "pending"
  | "generating"
  | "deploying"
  | "complete"
  | "error";

// ---------------------------------------------------------------------------
// Page metrics (extracted from accessibility tree / HTML analysis)
// ---------------------------------------------------------------------------

/** Structural metrics extracted from a single generated HTML page. */
export interface PageMetrics {
  imgCount: number;
  headingCount: number;
  landmarkCount: number;
  linkCount: number;
  schemaOrgPresent: boolean;
  totalHtmlSize: number;
}

// ---------------------------------------------------------------------------
// creative_runs table
// ---------------------------------------------------------------------------

/** Full row shape from the `creative_runs` table. */
export interface CreativeRun {
  id: string;
  created_at: string;
  model_provider: string;
  model_name: string;
  model_version: string | null;
  temperature: number;
  max_tokens: number;
  palette: string;
  typography: string;
  style: string;
  brand_feeling: string;
  site_spec_name: string;
  site_spec_snapshot: Record<string, unknown>;
  preview_url: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_time_s: number | null;
  estimated_cost_usd: number | null;
  status: CreativeRunStatus;
  error_message: string | null;
}

/** Insert shape for `creative_runs`. Only required fields; DB defaults handle the rest. */
export interface CreativeRunInsert {
  model_provider: string;
  model_name: string;
  model_version?: string | null;
  temperature: number;
  max_tokens: number;
  palette: string;
  typography: string;
  style: string;
  brand_feeling: string;
  site_spec_name: string;
  site_spec_snapshot: Record<string, unknown>;
  status?: CreativeRunStatus;
}

// ---------------------------------------------------------------------------
// creative_run_pages table
// ---------------------------------------------------------------------------

/** Full row shape from the `creative_run_pages` table. */
export interface CreativeRunPage {
  id: string;
  run_id: string;
  page_name: string;
  html: string | null;
  css: string | null;
  accessibility_tree: Record<string, unknown> | null;
  input_tokens: number | null;
  output_tokens: number | null;
  generation_time_s: number | null;
  img_count: number | null;
  heading_count: number | null;
  landmark_count: number | null;
  link_count: number | null;
  schema_org_present: boolean | null;
  screenshot_path: string | null;
  created_at: string;
}

/** Insert shape for `creative_run_pages`. run_id + page_name required; rest optional. */
export interface CreativeRunPageInsert {
  run_id: string;
  page_name: string;
  html?: string;
  css?: string;
  accessibility_tree?: Record<string, unknown>;
  input_tokens?: number;
  output_tokens?: number;
  generation_time_s?: number;
  img_count?: number;
  heading_count?: number;
  landmark_count?: number;
  link_count?: number;
  schema_org_present?: boolean;
  screenshot_path?: string;
}
