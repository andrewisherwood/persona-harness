import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  testTenantId: string;
  testUserId: string;
}

export function validateConfig(config: SupabaseConfig): void {
  if (!config.supabaseUrl) throw new Error("SUPABASE_URL is required");
  if (!config.anonKey) throw new Error("SUPABASE_ANON_KEY is required");
  if (!config.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  if (!config.testTenantId) throw new Error("TEST_TENANT_ID is required");
  if (!config.testUserId) throw new Error("TEST_USER_ID is required");
}

export function buildSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  return {
    supabaseUrl: env.SUPABASE_URL ?? "",
    anonKey: env.SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    testTenantId: env.TEST_TENANT_ID ?? "",
    testUserId: env.TEST_USER_ID ?? "",
  };
}

export function createServiceClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey);
}

export function createAnonClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.anonKey);
}

export async function createTestSiteSpec(
  client: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<string> {
  const { data, error } = await client
    .from("site_specs")
    .insert({ tenant_id: tenantId, user_id: userId, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create test site_spec: ${error.message}`);
  return data.id as string;
}

export async function getSiteSpec(
  client: SupabaseClient,
  siteSpecId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from("site_specs")
    .select("*")
    .eq("id", siteSpecId)
    .single();
  if (error) throw new Error(`Failed to read site_spec: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function upsertSiteSpec(
  client: SupabaseClient,
  siteSpecId: string,
  spec: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("site_specs")
    .upsert({ id: siteSpecId, ...spec });
  if (error) throw new Error(`Failed to upsert site_spec: ${error.message}`);
}
