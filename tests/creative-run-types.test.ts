import { describe, it, expect } from "vitest";
import type {
  CreativeRunStatus,
  PageMetrics,
  CreativeRun,
  CreativeRunInsert,
  CreativeRunPage,
  CreativeRunPageInsert,
} from "../src/server/engine/creative-run-types.js";

describe("creative-run-types", () => {
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
    });
  });

  describe("PageMetrics", () => {
    it("has the correct shape", () => {
      const metrics: PageMetrics = {
        imgCount: 3,
        headingCount: 5,
        landmarkCount: 4,
        linkCount: 12,
        schemaOrgPresent: true,
        totalHtmlSize: 24576,
      };
      expect(metrics.imgCount).toBe(3);
    });
  });

  describe("CreativeRunInsert", () => {
    it("has all required fields", () => {
      const insert: CreativeRunInsert = {
        model_provider: "anthropic",
        model_name: "claude-opus-4-6",
        temperature: 0.7,
        max_tokens: 16384,
        palette: "sage_sand",
        typography: "mixed",
        style: "classic",
        brand_feeling: "Reassuring",
        site_spec_name: "Dina Hart Birth Services",
        site_spec_snapshot: { business_name: "Test" },
      };
      expect(insert.model_provider).toBe("anthropic");
    });
  });

  describe("CreativeRunPage", () => {
    it("has flat metric columns matching DB schema", () => {
      const page: CreativeRunPage = {
        id: "page-1",
        run_id: "run-1",
        page_name: "home",
        html: "<html></html>",
        css: null,
        accessibility_tree: null,
        input_tokens: 8000,
        output_tokens: 6000,
        generation_time_s: 22.5,
        img_count: 3,
        heading_count: 4,
        landmark_count: 5,
        link_count: 8,
        schema_org_present: true,
        screenshot_path: null,
        created_at: "2026-02-23T12:00:00Z",
      };
      expect(page.img_count).toBe(3);
      expect(page.accessibility_tree).toBeNull();
    });
  });

  describe("CreativeRunPageInsert", () => {
    it("requires only run_id and page_name", () => {
      const minimal: CreativeRunPageInsert = {
        run_id: "run-1",
        page_name: "about",
      };
      expect(minimal.run_id).toBe("run-1");
      expect(minimal.html).toBeUndefined();
    });

    it("accepts all optional fields", () => {
      const full: CreativeRunPageInsert = {
        run_id: "run-1",
        page_name: "services",
        html: "<html></html>",
        css: ".services { }",
        img_count: 2,
        heading_count: 3,
        landmark_count: 2,
        link_count: 6,
        schema_org_present: false,
        screenshot_path: "research/run-1/services.png",
      };
      expect(full.schema_org_present).toBe(false);
    });
  });
});
