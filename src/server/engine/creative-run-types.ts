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
  total_input_tokens: number;
  total_output_tokens: number;
  total_time_s: number;
  estimated_cost_usd: number;
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
  input_tokens: number;
  output_tokens: number;
  generation_time_s: number;
  metrics: PageMetrics | null;
  error_message: string | null;
  created_at: string;
}

/** Insert shape for `creative_run_pages`. run_id + page_name required; rest optional. */
export interface CreativeRunPageInsert {
  run_id: string;
  page_name: string;
  html?: string | null;
  css?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  generation_time_s?: number;
  metrics?: PageMetrics | null;
  error_message?: string | null;
}
