import { describe, it, expect } from "vitest";
import { buildSupabaseConfig, validateConfig } from "../src/server/engine/supabase-client.js";

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
});
