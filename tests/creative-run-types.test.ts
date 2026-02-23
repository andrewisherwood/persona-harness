import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  CreativeRunStatus,
  PageMetrics,
  CreativeRun,
  CreativeRunInsert,
  CreativeRunPage,
  CreativeRunPageInsert,
} from "../src/server/engine/creative-run-types.js";

describe("creative-run-types", () => {
  // -------------------------------------------------------------------------
  // CreativeRunStatus
  // -------------------------------------------------------------------------

  describe("CreativeRunStatus", () => {
    it("covers all five valid states", () => {
      const states: CreativeRunStatus[] = [
        "pending",
        "generating",
        "deploying",
        "complete",
        "error",
      ];
      expect(states).toHaveLength(5);
      // Each value is assignable to the union type (compile-time check)
      for (const s of states) {
        expect(typeof s).toBe("string");
      }
    });
  });

  // -------------------------------------------------------------------------
  // PageMetrics
  // -------------------------------------------------------------------------

  describe("PageMetrics", () => {
    it("has the correct shape with all required fields", () => {
      const metrics: PageMetrics = {
        imgCount: 3,
        headingCount: 5,
        landmarkCount: 4,
        linkCount: 12,
        schemaOrgPresent: true,
        totalHtmlSize: 24576,
      };
      expect(metrics.imgCount).toBe(3);
      expect(metrics.headingCount).toBe(5);
      expect(metrics.landmarkCount).toBe(4);
      expect(metrics.linkCount).toBe(12);
      expect(metrics.schemaOrgPresent).toBe(true);
      expect(metrics.totalHtmlSize).toBe(24576);
    });

    it("has boolean type for schemaOrgPresent", () => {
      const metrics: PageMetrics = {
        imgCount: 0,
        headingCount: 0,
        landmarkCount: 0,
        linkCount: 0,
        schemaOrgPresent: false,
        totalHtmlSize: 0,
      };
      expect(typeof metrics.schemaOrgPresent).toBe("boolean");
    });

    it("has number types for all count fields", () => {
      const metrics: PageMetrics = {
        imgCount: 1,
        headingCount: 2,
        landmarkCount: 3,
        linkCount: 4,
        schemaOrgPresent: false,
        totalHtmlSize: 100,
      };
      expect(typeof metrics.imgCount).toBe("number");
      expect(typeof metrics.headingCount).toBe("number");
      expect(typeof metrics.landmarkCount).toBe("number");
      expect(typeof metrics.linkCount).toBe("number");
      expect(typeof metrics.totalHtmlSize).toBe("number");
    });
  });

  // -------------------------------------------------------------------------
  // CreativeRunInsert
  // -------------------------------------------------------------------------

  describe("CreativeRunInsert", () => {
    it("has all required fields for inserting a creative run", () => {
      const insert: CreativeRunInsert = {
        model_provider: "anthropic",
        model_name: "claude-opus-4-6",
        temperature: 0.7,
        max_tokens: 16384,
        palette: "sage_sand",
        typography: "classic",
        style: "professional",
        brand_feeling: "warm, welcoming, professional",
        site_spec_name: "detailed-dina",
        site_spec_snapshot: { business_name: "Dina Hart Doula Services" },
      };
      expect(insert.model_provider).toBe("anthropic");
      expect(insert.model_name).toBe("claude-opus-4-6");
      expect(insert.temperature).toBe(0.7);
      expect(insert.max_tokens).toBe(16384);
      expect(insert.palette).toBe("sage_sand");
      expect(insert.typography).toBe("classic");
      expect(insert.style).toBe("professional");
      expect(insert.brand_feeling).toBe("warm, welcoming, professional");
      expect(insert.site_spec_name).toBe("detailed-dina");
      expect(insert.site_spec_snapshot).toEqual({ business_name: "Dina Hart Doula Services" });
    });

    it("allows optional model_version", () => {
      const withVersion: CreativeRunInsert = {
        model_provider: "anthropic",
        model_name: "claude-opus-4-6",
        model_version: "2026-02-20",
        temperature: 0.7,
        max_tokens: 16384,
        palette: "sage_sand",
        typography: "classic",
        style: "professional",
        brand_feeling: "warm",
        site_spec_name: "detailed-dina",
        site_spec_snapshot: {},
      };
      expect(withVersion.model_version).toBe("2026-02-20");

      const withoutVersion: CreativeRunInsert = {
        model_provider: "openai",
        model_name: "gpt-5.2",
        temperature: 0.5,
        max_tokens: 8192,
        palette: "blush_neutral",
        typography: "modern",
        style: "minimalist",
        brand_feeling: "calm",
        site_spec_name: "detailed-dina",
        site_spec_snapshot: {},
      };
      expect(withoutVersion.model_version).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // CreativeRun (full row)
  // -------------------------------------------------------------------------

  describe("CreativeRun", () => {
    it("represents a complete row from the creative_runs table", () => {
      const run: CreativeRun = {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        created_at: "2026-02-23T12:00:00Z",
        model_provider: "anthropic",
        model_name: "claude-opus-4-6",
        model_version: null,
        temperature: 0.7,
        max_tokens: 16384,
        palette: "sage_sand",
        typography: "classic",
        style: "professional",
        brand_feeling: "warm, welcoming, professional",
        site_spec_name: "detailed-dina",
        site_spec_snapshot: { business_name: "Dina Hart Doula Services" },
        preview_url: "https://birthbuild-dina-hart-abc1.netlify.app",
        total_input_tokens: 52000,
        total_output_tokens: 38000,
        total_time_s: 145.3,
        estimated_cost_usd: 6.55,
        status: "complete",
        error_message: null,
      };
      expect(run.id).toBeDefined();
      expect(run.status).toBe("complete");
      expect(run.preview_url).toContain("netlify.app");
    });

    it("supports error state with error_message", () => {
      const run: CreativeRun = {
        id: "fail-run-id",
        created_at: "2026-02-23T12:00:00Z",
        model_provider: "openai",
        model_name: "gpt-5.2",
        model_version: null,
        temperature: 0.5,
        max_tokens: 8192,
        palette: "ocean_calm",
        typography: "modern",
        style: "minimalist",
        brand_feeling: "calm",
        site_spec_name: "detailed-dina",
        site_spec_snapshot: {},
        preview_url: null,
        total_input_tokens: 10000,
        total_output_tokens: 0,
        total_time_s: 3.2,
        estimated_cost_usd: 0.05,
        status: "error",
        error_message: "Rate limit exceeded",
      };
      expect(run.status).toBe("error");
      expect(run.error_message).toBe("Rate limit exceeded");
      expect(run.preview_url).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // CreativeRunPage + CreativeRunPageInsert
  // -------------------------------------------------------------------------

  describe("CreativeRunPage", () => {
    it("represents a complete row from the creative_run_pages table", () => {
      const page: CreativeRunPage = {
        id: "page-uuid-1",
        run_id: "run-uuid-1",
        page_name: "home",
        html: "<html><body>Home page</body></html>",
        css: "body { margin: 0; }",
        input_tokens: 8000,
        output_tokens: 6000,
        generation_time_s: 22.5,
        metrics: {
          imgCount: 3,
          headingCount: 4,
          landmarkCount: 5,
          linkCount: 8,
          schemaOrgPresent: true,
          totalHtmlSize: 12345,
        },
        error_message: null,
        created_at: "2026-02-23T12:01:00Z",
      };
      expect(page.page_name).toBe("home");
      expect(page.metrics?.imgCount).toBe(3);
      expect(page.error_message).toBeNull();
    });
  });

  describe("CreativeRunPageInsert", () => {
    it("requires only run_id and page_name", () => {
      const minimal: CreativeRunPageInsert = {
        run_id: "run-uuid-1",
        page_name: "about",
      };
      expect(minimal.run_id).toBe("run-uuid-1");
      expect(minimal.page_name).toBe("about");
      expect(minimal.html).toBeUndefined();
      expect(minimal.metrics).toBeUndefined();
    });

    it("accepts all optional fields", () => {
      const full: CreativeRunPageInsert = {
        run_id: "run-uuid-1",
        page_name: "services",
        html: "<html></html>",
        css: ".services { }",
        input_tokens: 5000,
        output_tokens: 4000,
        generation_time_s: 18.2,
        metrics: {
          imgCount: 2,
          headingCount: 3,
          landmarkCount: 2,
          linkCount: 6,
          schemaOrgPresent: false,
          totalHtmlSize: 8000,
        },
        error_message: null,
      };
      expect(full.html).toBe("<html></html>");
      expect(full.metrics?.schemaOrgPresent).toBe(false);
    });
  });
});
