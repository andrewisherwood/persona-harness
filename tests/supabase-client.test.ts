import { describe, it, expect, vi } from "vitest";
import { buildStockPhotoInputs, buildSupabaseConfig, validateConfig, STOCK_PHOTOS, seedStockPhotos } from "../src/server/engine/supabase-client.js";

describe("supabase-client", () => {
  describe("validateConfig", () => {
    it("throws when supabaseUrl is missing", () => {
      expect(() =>
        validateConfig({ supabaseUrl: "", anonKey: "k", serviceRoleKey: "k", testTenantId: "t", testUserId: "u", authToken: "jwt" })
      ).toThrow("SUPABASE_URL is required");
    });

    it("throws when anonKey is missing", () => {
      expect(() =>
        validateConfig({ supabaseUrl: "https://x.supabase.co", anonKey: "", serviceRoleKey: "k", testTenantId: "t", testUserId: "u", authToken: "jwt" })
      ).toThrow("SUPABASE_ANON_KEY is required");
    });

    it("throws when serviceRoleKey is missing", () => {
      expect(() =>
        validateConfig({ supabaseUrl: "https://x.supabase.co", anonKey: "k", serviceRoleKey: "", testTenantId: "t", testUserId: "u", authToken: "jwt" })
      ).toThrow("SUPABASE_SERVICE_ROLE_KEY is required");
    });

    it("throws when testTenantId is missing", () => {
      expect(() =>
        validateConfig({ supabaseUrl: "https://x.supabase.co", anonKey: "k", serviceRoleKey: "k", testTenantId: "", testUserId: "u", authToken: "jwt" })
      ).toThrow("TEST_TENANT_ID is required");
    });

    it("throws when testUserId is missing", () => {
      expect(() =>
        validateConfig({ supabaseUrl: "https://x.supabase.co", anonKey: "k", serviceRoleKey: "k", testTenantId: "t", testUserId: "", authToken: "jwt" })
      ).toThrow("TEST_USER_ID is required");
    });

    it("does not require authToken (auto-generated at runtime)", () => {
      expect(() =>
        validateConfig({ supabaseUrl: "https://x.supabase.co", anonKey: "k", serviceRoleKey: "k", testTenantId: "t", testUserId: "u", authToken: "" })
      ).not.toThrow();
    });

    it("does not throw for a valid config", () => {
      expect(() =>
        validateConfig({ supabaseUrl: "https://x.supabase.co", anonKey: "k", serviceRoleKey: "k", testTenantId: "t", testUserId: "u", authToken: "jwt" })
      ).not.toThrow();
    });
  });

  describe("buildSupabaseConfig", () => {
    it("maps environment variables to config object", () => {
      const config = buildSupabaseConfig({
        SUPABASE_URL: "https://test.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
        TEST_TENANT_ID: "tenant-1",
        TEST_USER_ID: "user-1",
        AUTH_TOKEN: "jwt-token",
      });
      expect(config.supabaseUrl).toBe("https://test.supabase.co");
      expect(config.anonKey).toBe("anon-key");
      expect(config.serviceRoleKey).toBe("service-key");
      expect(config.testTenantId).toBe("tenant-1");
      expect(config.testUserId).toBe("user-1");
      expect(config.authToken).toBe("jwt-token");
    });

    it("defaults to empty strings for missing env vars", () => {
      const config = buildSupabaseConfig({});
      expect(config.supabaseUrl).toBe("");
      expect(config.anonKey).toBe("");
      expect(config.authToken).toBe("");
    });
  });

  describe("STOCK_PHOTOS", () => {
    it("contains 8 photos with required fields", () => {
      expect(STOCK_PHOTOS).toHaveLength(8);
      for (const photo of STOCK_PHOTOS) {
        expect(photo).toHaveProperty("storage_path");
        expect(photo).toHaveProperty("purpose");
        expect(photo).toHaveProperty("alt_text");
        expect(typeof photo.sort_order).toBe("number");
      }
    });

    it("includes exactly 1 headshot, 1 hero, and 6 gallery", () => {
      const purposes = STOCK_PHOTOS.map((p) => p.purpose);
      expect(purposes.filter((p) => p === "headshot")).toHaveLength(1);
      expect(purposes.filter((p) => p === "hero")).toHaveLength(1);
      expect(purposes.filter((p) => p === "gallery")).toHaveLength(6);
    });

    it("has storage_path values that do not include URL prefix or query params", () => {
      for (const photo of STOCK_PHOTOS) {
        expect(photo.storage_path).not.toContain("https://");
        expect(photo.storage_path).not.toContain("?");
        expect(photo.storage_path).toMatch(/^photos\//);
      }
    });
  });

  describe("seedStockPhotos", () => {
    it("inserts all stock photos for a given site_spec_id", async () => {
      const insertedRows: unknown[] = [];
      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockImplementation((rows: unknown[]) => {
            insertedRows.push(...rows);
            return { error: null };
          }),
        }),
      };

      await seedStockPhotos(mockClient as never, "test-spec-id");

      expect(mockClient.from).toHaveBeenCalledWith("photos");
      expect(insertedRows).toHaveLength(8);
      for (const row of insertedRows as Array<Record<string, unknown>>) {
        expect(row.site_spec_id).toBe("test-spec-id");
        expect(row).toHaveProperty("storage_path");
        expect(row).toHaveProperty("purpose");
        expect(row).toHaveProperty("alt_text");
        expect(row).toHaveProperty("sort_order");
      }
    });

    it("throws on insert error", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({ error: { message: "RLS violation" } }),
        }),
      };

      await expect(seedStockPhotos(mockClient as never, "test-spec-id"))
        .rejects.toThrow("Failed to seed stock photos: RLS violation");
    });
  });

  describe("buildStockPhotoInputs", () => {
    it("returns PhotoInput-compatible objects with full public URLs", () => {
      const inputs = buildStockPhotoInputs("https://abc.supabase.co");
      expect(inputs).toHaveLength(8);
      for (const input of inputs) {
        expect(input.publicUrl).toMatch(/^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/photos\/photos\//);
        expect(input).toHaveProperty("purpose");
        expect(input).toHaveProperty("altText");
      }
    });

    it("strips trailing slash from supabaseUrl", () => {
      const inputs = buildStockPhotoInputs("https://abc.supabase.co/");
      expect(inputs[0].publicUrl).toContain("abc.supabase.co/storage/");
      expect(inputs[0].publicUrl).not.toContain("co//storage");
    });
  });
});
