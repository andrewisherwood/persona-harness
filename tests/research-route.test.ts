import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createResearchRouter } from "../src/server/routes/research.js";
import type { CreativeRun, CreativeRunPage } from "../src/server/engine/creative-run-types.js";

vi.mock("../src/server/engine/creative-run-db.js", () => ({
  listCreativeRuns: vi.fn(),
  getCreativeRun: vi.fn(),
  getCreativeRunPages: vi.fn(),
}));

import {
  listCreativeRuns,
  getCreativeRun,
  getCreativeRunPages,
} from "../src/server/engine/creative-run-db.js";

const mockListCreativeRuns = vi.mocked(listCreativeRuns);
const mockGetCreativeRun = vi.mocked(getCreativeRun);
const mockGetCreativeRunPages = vi.mocked(getCreativeRunPages);

function buildApp() {
  const app = express();
  app.use(express.json());
  // Pass an empty object as SupabaseClient — the real client is mocked at the module level
  app.use("/api/research", createResearchRouter({} as never));
  return app;
}

const SAMPLE_RUN: CreativeRun = {
  id: "run-001",
  created_at: "2026-02-23T10:00:00Z",
  model_provider: "anthropic",
  model_name: "claude-opus-4-6",
  model_version: null,
  temperature: 0.7,
  max_tokens: 8192,
  palette: "warm",
  typography: "modern",
  style: "professional",
  brand_feeling: "nurturing",
  site_spec_name: "detailed-dina",
  site_spec_snapshot: { business_name: "Dina Hart Doula" },
  preview_url: "https://example.netlify.app",
  total_input_tokens: 5000,
  total_output_tokens: 12000,
  total_time_s: 45,
  estimated_cost_usd: 1.25,
  status: "complete",
  error_message: null,
};

const SAMPLE_PAGES: CreativeRunPage[] = [
  {
    id: "page-001",
    run_id: "run-001",
    page_name: "home",
    html: "<html><body>Home</body></html>",
    css: "body { margin: 0; }",
    accessibility_tree: null,
    input_tokens: 2000,
    output_tokens: 5000,
    generation_time_s: 15,
    img_count: 3,
    heading_count: 5,
    landmark_count: 4,
    link_count: 8,
    schema_org_present: true,
    screenshot_path: null,
    created_at: "2026-02-23T10:01:00Z",
  },
];

describe("research route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/research", () => {
    it("returns list of creative runs", async () => {
      mockListCreativeRuns.mockResolvedValue([SAMPLE_RUN]);

      const app = buildApp();
      const res = await request(app).get("/api/research");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("run-001");
      expect(res.body[0].model_name).toBe("claude-opus-4-6");
    });

    it("returns empty array when no runs exist", async () => {
      mockListCreativeRuns.mockResolvedValue([]);

      const app = buildApp();
      const res = await request(app).get("/api/research");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns 500 when listing fails", async () => {
      mockListCreativeRuns.mockRejectedValue(new Error("DB connection failed"));

      const app = buildApp();
      const res = await request(app).get("/api/research");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("DB connection failed");
    });
  });

  describe("GET /api/research/:id", () => {
    it("returns run with pages", async () => {
      mockGetCreativeRun.mockResolvedValue(SAMPLE_RUN);
      mockGetCreativeRunPages.mockResolvedValue(SAMPLE_PAGES);

      const app = buildApp();
      const res = await request(app).get("/api/research/run-001");

      expect(res.status).toBe(200);
      expect(res.body.run.id).toBe("run-001");
      expect(res.body.pages).toHaveLength(1);
      expect(res.body.pages[0].page_name).toBe("home");
    });

    it("returns 404 for unknown run", async () => {
      mockGetCreativeRun.mockRejectedValue(new Error("Creative run not found: row not found"));

      const app = buildApp();
      const res = await request(app).get("/api/research/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("Creative run not found");
    });
  });
});
