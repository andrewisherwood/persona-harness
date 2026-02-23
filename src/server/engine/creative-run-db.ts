import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreativeRun,
  CreativeRunInsert,
  CreativeRunPage,
  CreativeRunPageInsert,
  CreativeRunStatus,
} from "./creative-run-types.js";

/** Insert a new creative run and return its ID. */
export async function insertCreativeRun(
  client: SupabaseClient,
  run: CreativeRunInsert,
): Promise<string> {
  const { data, error } = await client
    .from("creative_runs")
    .insert(run)
    .select("id")
    .single();
  if (error) throw new Error(`Failed to insert creative run: ${error.message}`);
  return (data as { id: string }).id;
}

/** Update creative run status and optional result fields. */
export async function updateCreativeRunStatus(
  client: SupabaseClient,
  runId: string,
  status: CreativeRunStatus,
  results?: {
    preview_url?: string;
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_time_s?: number;
    estimated_cost_usd?: number;
    error_message?: string;
  },
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (results) Object.assign(update, results);
  const { error } = await client
    .from("creative_runs")
    .update(update)
    .eq("id", runId);
  if (error) throw new Error(`Failed to update creative run: ${error.message}`);
}

/** Insert a page record for a creative run and return its ID. */
export async function insertCreativeRunPage(
  client: SupabaseClient,
  page: CreativeRunPageInsert,
): Promise<string> {
  const { data, error } = await client
    .from("creative_run_pages")
    .insert(page)
    .select("id")
    .single();
  if (error) throw new Error(`Failed to insert creative run page: ${error.message}`);
  return (data as { id: string }).id;
}

/** List all creative runs, ordered by created_at descending. */
export async function listCreativeRuns(
  client: SupabaseClient,
): Promise<CreativeRun[]> {
  const { data, error } = await client
    .from("creative_runs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list creative runs: ${error.message}`);
  return (data ?? []) as CreativeRun[];
}

/** Get a single creative run by ID. */
export async function getCreativeRun(
  client: SupabaseClient,
  runId: string,
): Promise<CreativeRun> {
  const { data, error } = await client
    .from("creative_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (error) throw new Error(`Creative run not found: ${error.message}`);
  return data as CreativeRun;
}

/** Get all pages for a creative run. */
export async function getCreativeRunPages(
  client: SupabaseClient,
  runId: string,
): Promise<CreativeRunPage[]> {
  const { data, error } = await client
    .from("creative_run_pages")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to get creative run pages: ${error.message}`);
  return (data ?? []) as CreativeRunPage[];
}
