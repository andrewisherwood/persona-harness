import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface StockPhoto {
  storage_path: string;
  purpose: string;
  alt_text: string;
  sort_order: number;
}

const USER_PHOTOS_PATH = "photos/23099152-2ebe-4040-9a45-9a2d0a8fb1c6";

export const STOCK_PHOTOS: StockPhoto[] = [
  { storage_path: `${USER_PHOTOS_PATH}/headshot.png`, purpose: "headshot", alt_text: "Dina", sort_order: 0 },
  { storage_path: `${USER_PHOTOS_PATH}/hero.png`, purpose: "hero", alt_text: "Supporting you", sort_order: 1 },
  { storage_path: `${USER_PHOTOS_PATH}/gallery-antenatal-consultation.png`, purpose: "gallery", alt_text: "Antenatal Consultation", sort_order: 2 },
  { storage_path: `${USER_PHOTOS_PATH}/gallery-hospitalbirth.png`, purpose: "gallery", alt_text: "Hospital Birth", sort_order: 3 },
  { storage_path: `${USER_PHOTOS_PATH}/gallery-homebirth.png`, purpose: "gallery", alt_text: "Home Birth", sort_order: 4 },
  { storage_path: `${USER_PHOTOS_PATH}/gallery-holding-hands.png`, purpose: "gallery", alt_text: "Holding hands", sort_order: 5 },
  { storage_path: `${USER_PHOTOS_PATH}/gallery-hypnobirthing-class.png`, purpose: "gallery", alt_text: "Hypnobirthing Class", sort_order: 6 },
  { storage_path: `${USER_PHOTOS_PATH}/gallery-preparations.png`, purpose: "gallery", alt_text: "Preparations", sort_order: 7 },
];

export async function seedStockPhotos(
  client: SupabaseClient,
  siteSpecId: string,
): Promise<void> {
  const rows = STOCK_PHOTOS.map((photo) => ({
    site_spec_id: siteSpecId,
    ...photo,
  }));
  const { error } = await client.from("photos").insert(rows);
  if (error) throw new Error(`Failed to seed stock photos: ${error.message}`);
}

/**
 * Build photo inputs with full public URLs for the /generate-page edge function.
 * The edge function reads photos from the request body (not from the DB),
 * so we need to pass them with resolved publicUrl values.
 */
export function buildStockPhotoInputs(supabaseUrl: string): Array<{ purpose: string; publicUrl: string; altText: string }> {
  const storageBase = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/photos`;
  return STOCK_PHOTOS.map((photo) => ({
    purpose: photo.purpose,
    publicUrl: `${storageBase}/${photo.storage_path}`,
    altText: photo.alt_text,
  }));
}

export interface SupabaseConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  testTenantId: string;
  testUserId: string;
  authToken: string; // User JWT for edge function calls
}

export function validateConfig(config: SupabaseConfig): void {
  if (!config.supabaseUrl) throw new Error("SUPABASE_URL is required");
  if (!config.anonKey) throw new Error("SUPABASE_ANON_KEY is required");
  if (!config.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  if (!config.testTenantId) throw new Error("TEST_TENANT_ID is required");
  if (!config.testUserId) throw new Error("TEST_USER_ID is required");
}

/**
 * Programmatically generates a fresh auth token for the test user.
 * Uses service role key to create a magic link, then exchanges the
 * hashed_token for a session via verifyOtp — no password needed.
 */
export async function generateAuthToken(config: SupabaseConfig): Promise<string> {
  const serviceClient = createClient(config.supabaseUrl, config.serviceRoleKey);

  // Look up test user email from TEST_USER_ID
  const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(config.testUserId);
  if (userError || !userData?.user?.email) {
    throw new Error(`Failed to look up test user ${config.testUserId}: ${userError?.message ?? "no email found"}`);
  }

  // Generate a magic link (server-side only, no email sent)
  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkError) {
    throw new Error(`Failed to generate magic link: ${linkError.message}`);
  }
  const hashedToken = linkData?.properties?.hashed_token;
  if (!hashedToken) {
    throw new Error("generateLink returned no hashed_token");
  }

  // Exchange hashed_token for a session via anon client
  const anonClient = createClient(config.supabaseUrl, config.anonKey);
  const { data: sessionData, error: sessionError } = await anonClient.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error(`Failed to verify OTP: ${sessionError?.message ?? "no session returned"}`);
  }

  return sessionData.session.access_token;
}

export function buildSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  return {
    supabaseUrl: env.SUPABASE_URL ?? "",
    anonKey: env.SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    testTenantId: env.TEST_TENANT_ID ?? "",
    testUserId: env.TEST_USER_ID ?? "",
    authToken: env.AUTH_TOKEN ?? "",
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
  // Use update (not upsert) — the row already exists from createTestSiteSpec.
  // Upsert treats missing columns as null, which violates NOT NULL on user_id/tenant_id.
  const { error } = await client
    .from("site_specs")
    .update(spec)
    .eq("id", siteSpecId);
  if (error) throw new Error(`Failed to upsert site_spec: ${error.message}`);
}
