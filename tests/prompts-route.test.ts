import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { createPromptsRouter } from "../src/server/routes/prompts.js";
import express from "express";
import request from "supertest";

const TEST_DIR = join(process.cwd(), "test-prompts-tmp");
const PROMPTS_DIR = join(TEST_DIR, "supabase/functions/_shared/prompts");

function setupTestPrompts() {
  mkdirSync(join(PROMPTS_DIR, "design-system"), { recursive: true });
  mkdirSync(join(PROMPTS_DIR, "generate-page"), { recursive: true });
  writeFileSync(
    join(PROMPTS_DIR, "manifest.json"),
    JSON.stringify({
      "design-system": {
        production: "v1-structured",
        variants: {
          "v1-structured": {
            description: "Original design system prompt",
            file: "design-system/v1-structured.md",
          },
        },
      },
      "generate-page": {
        production: "v1-structured",
        variants: {
          "v1-structured": {
            description: "Original page prompt",
            file: "generate-page/v1-structured.md",
          },
        },
      },
    }),
  );
  writeFileSync(join(PROMPTS_DIR, "design-system/v1-structured.md"), "# Design System\n\nYou are a design system generator.\n");
  writeFileSync(join(PROMPTS_DIR, "generate-page/v1-structured.md"), "# Page Generator\n\nYou generate HTML pages.\n");
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/prompts", createPromptsRouter(TEST_DIR));
  return app;
}

describe("prompts route", () => {
  beforeEach(() => {
    setupTestPrompts();
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("GET /api/prompts", () => {
    it("returns the full manifest", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/prompts");
      expect(res.status).toBe(200);
      expect(res.body["design-system"]).toBeDefined();
      expect(res.body["design-system"].production).toBe("v1-structured");
      expect(res.body["design-system"].variants["v1-structured"]).toBeDefined();
      expect(res.body["generate-page"]).toBeDefined();
    });
  });

  describe("GET /api/prompts/:type/:variant", () => {
    it("returns .md content for a valid variant", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/prompts/design-system/v1-structured");
      expect(res.status).toBe(200);
      expect(res.body.content).toContain("# Design System");
      expect(res.body.variant).toBe("v1-structured");
      expect(res.body.description).toBe("Original design system prompt");
    });

    it("returns 404 for unknown type", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/prompts/unknown-type/v1-structured");
      expect(res.status).toBe(404);
    });

    it("returns 404 for unknown variant", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/prompts/design-system/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/prompts/:type/:variant", () => {
    it("updates .md content for an existing variant", async () => {
      const app = createTestApp();
      const res = await request(app)
        .put("/api/prompts/design-system/v1-structured")
        .send({ content: "# Updated\n\nNew content." });
      expect(res.status).toBe(200);
      const onDisk = readFileSync(join(PROMPTS_DIR, "design-system/v1-structured.md"), "utf-8");
      expect(onDisk).toBe("# Updated\n\nNew content.");
    });

    it("updates description in manifest when provided", async () => {
      const app = createTestApp();
      const res = await request(app)
        .put("/api/prompts/design-system/v1-structured")
        .send({ content: "# Updated", description: "New description" });
      expect(res.status).toBe(200);
      const manifest = JSON.parse(readFileSync(join(PROMPTS_DIR, "manifest.json"), "utf-8"));
      expect(manifest["design-system"].variants["v1-structured"].description).toBe("New description");
    });

    it("returns 404 for unknown variant", async () => {
      const app = createTestApp();
      const res = await request(app)
        .put("/api/prompts/design-system/nonexistent")
        .send({ content: "test" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/prompts/:type", () => {
    it("creates a new variant", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/prompts/design-system")
        .send({ name: "v2-minimal", description: "Minimal prompt", content: "# Minimal\n\nLess is more." });
      expect(res.status).toBe(201);
      expect(existsSync(join(PROMPTS_DIR, "design-system/v2-minimal.md"))).toBe(true);
      const manifest = JSON.parse(readFileSync(join(PROMPTS_DIR, "manifest.json"), "utf-8"));
      expect(manifest["design-system"].variants["v2-minimal"]).toBeDefined();
      expect(manifest["design-system"].variants["v2-minimal"].description).toBe("Minimal prompt");
    });

    it("rejects duplicate variant name", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/prompts/design-system")
        .send({ name: "v1-structured", description: "Dup", content: "test" });
      expect(res.status).toBe(409);
    });

    it("rejects invalid slug", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/prompts/design-system")
        .send({ name: "Bad Name!", description: "test", content: "test" });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/prompts/:type/:variant", () => {
    it("deletes a non-production variant", async () => {
      const app = createTestApp();
      await request(app)
        .post("/api/prompts/design-system")
        .send({ name: "deleteme", description: "temp", content: "temp" });
      const res = await request(app).delete("/api/prompts/design-system/deleteme");
      expect(res.status).toBe(200);
      expect(existsSync(join(PROMPTS_DIR, "design-system/deleteme.md"))).toBe(false);
    });

    it("refuses to delete the production variant", async () => {
      const app = createTestApp();
      const res = await request(app).delete("/api/prompts/design-system/v1-structured");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("production");
    });
  });

  describe("POST /api/prompts/:type/:variant/duplicate", () => {
    it("duplicates a variant under a new name", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/prompts/design-system/v1-structured/duplicate")
        .send({ name: "v1-copy" });
      expect(res.status).toBe(201);
      const content = readFileSync(join(PROMPTS_DIR, "design-system/v1-copy.md"), "utf-8");
      expect(content).toContain("# Design System");
    });
  });

  describe("PUT /api/prompts/:type/production", () => {
    it("sets a different variant as production", async () => {
      const app = createTestApp();
      await request(app)
        .post("/api/prompts/design-system")
        .send({ name: "v2-test", description: "test", content: "test" });
      const res = await request(app)
        .put("/api/prompts/design-system/production")
        .send({ variant: "v2-test" });
      expect(res.status).toBe(200);
      const manifest = JSON.parse(readFileSync(join(PROMPTS_DIR, "manifest.json"), "utf-8"));
      expect(manifest["design-system"].production).toBe("v2-test");
    });

    it("rejects unknown variant", async () => {
      const app = createTestApp();
      const res = await request(app)
        .put("/api/prompts/design-system/production")
        .send({ variant: "nonexistent" });
      expect(res.status).toBe(404);
    });
  });
});
