# Prompt Management & A/B Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add prompt template CRUD, editor UI, and prompt_config wiring so the harness can manage BirthBuild's prompt variants and pass them to edge functions during builds.

**Architecture:** The API reads/writes BirthBuild's prompt files via `BIRTHBUILD_ROOT` env var. The Prompts page becomes a two-panel editor. RunConfig gets prompt/model selection that flows through the orchestrator as `prompt_config` to the edge functions.

**Tech Stack:** TypeScript, Express 5, React 18, Vitest

---

### Task 1: Add `PromptSelection` type and update `RunConfig`

**Files:**
- Modify: `src/server/engine/types.ts`
- Test: `tests/types.test.ts` (not needed — types only, no runtime code)

**Step 1: Update types.ts**

Replace the `promptSource` / `promptSourceB` string fields with structured `PromptSelection` objects. Keep the old fields temporarily for backwards compat in the runs route.

Open `src/server/engine/types.ts` and replace the entire contents with:

```typescript
export type RunMode = "full-pipeline" | "build-only";
export type RunStep = "pending" | "chatting" | "evaluating" | "building" | "deploying" | "complete" | "error";

export interface PromptSelection {
  designSystem: string;          // variant name from manifest
  generatePage: string;          // variant name from manifest
  modelProvider?: string;        // "anthropic" | "openai"
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  providerApiKey?: string;       // OpenAI only, never persisted to disk
}

export interface RunConfig {
  id: string;
  mode: RunMode;
  personas: string[];
  promptConfig?: PromptSelection;
  promptConfigB?: PromptSelection;
  maxTurns: number;
  personaModel: string;
  judgeModel: string;
  skipEvaluation: boolean;
  skipBuild: boolean;
}

export interface RunProgress {
  runId: string;
  persona: string;
  step: RunStep;
  turn?: number;
  message?: { role: string; content: string };
  costSoFar?: number;
}

export interface PersonaRunResult {
  personaId: string;
  conversation: Array<{ turn: number; role: string; content: string; timestamp: string }>;
  siteSpec: Record<string, unknown> | null;
  evaluation: Record<string, unknown> | null;
  cost: Record<string, unknown>;
  previewUrl: string | null;
  error: string | null;
}

export interface RunResult {
  id: string;
  config: RunConfig;
  timestamp: string;
  personas: Record<string, PersonaRunResult>;
  totalCost: number;
}

export type ProgressCallback = (progress: RunProgress) => void;
```

**Step 2: Run typecheck to verify**

Run: `npm run typecheck`
Expected: Should pass (old `promptSource` usage in runs.ts will need updating in Task 5, but typecheck may pass since both are optional)

If typecheck fails on `promptSource` references in `src/server/routes/runs.ts`, that's expected — we'll fix it in Task 5. Note the errors and move on.

**Step 3: Commit**

```bash
git add src/server/engine/types.ts
git commit -m "feat: add PromptSelection type, replace promptSource in RunConfig"
```

---

### Task 2: Prompts API route — CRUD for BirthBuild templates

**Files:**
- Modify: `src/server/routes/prompts.ts` (complete rewrite)
- Modify: `src/server/index.ts` (add `BIRTHBUILD_ROOT` to health check, change prompts route to factory)
- Create: `tests/prompts-route.test.ts`

**Step 1: Write the failing tests**

Create `tests/prompts-route.test.ts`:

```typescript
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
      // Verify file was written
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
      // Verify file exists
      expect(existsSync(join(PROMPTS_DIR, "design-system/v2-minimal.md"))).toBe(true);
      // Verify manifest updated
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
      // First create a variant to delete
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
      // Create second variant first
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/prompts-route.test.ts`
Expected: FAIL — `createPromptsRouter` is not exported from prompts.ts

**Step 3: Install supertest (test HTTP helper)**

Run: `npm install --save-dev supertest @types/supertest`

**Step 4: Implement the prompts route**

Replace the entire contents of `src/server/routes/prompts.ts` with:

```typescript
import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";

const SLUG_RE = /^[a-z0-9-]+$/;

interface ManifestVariant {
  description: string;
  file: string;
}

interface ManifestEntry {
  production: string;
  variants: Record<string, ManifestVariant>;
}

type Manifest = Record<string, ManifestEntry>;

function promptsDir(birthbuildRoot: string): string {
  return join(birthbuildRoot, "supabase/functions/_shared/prompts");
}

function readManifest(baseDir: string): Manifest {
  return JSON.parse(readFileSync(join(promptsDir(baseDir), "manifest.json"), "utf-8")) as Manifest;
}

function writeManifest(baseDir: string, manifest: Manifest): void {
  writeFileSync(join(promptsDir(baseDir), "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}

export function createPromptsRouter(birthbuildRoot: string): Router {
  const router = Router();
  const base = birthbuildRoot;

  // GET /api/prompts — full manifest
  router.get("/", (_req, res) => {
    try {
      const manifest = readManifest(base);
      res.json(manifest);
    } catch (err) {
      res.status(500).json({ error: `Failed to read manifest: ${err instanceof Error ? err.message : err}` });
    }
  });

  // GET /api/prompts/:type/:variant — read .md content
  router.get("/:type/:variant", (req, res) => {
    try {
      const manifest = readManifest(base);
      const entry = manifest[req.params.type];
      if (!entry) { res.status(404).json({ error: `Unknown prompt type: ${req.params.type}` }); return; }
      const variant = entry.variants[req.params.variant];
      if (!variant) { res.status(404).json({ error: `Unknown variant: ${req.params.variant}` }); return; }
      const filePath = join(promptsDir(base), variant.file);
      const content = readFileSync(filePath, "utf-8");
      res.json({
        variant: req.params.variant,
        description: variant.description,
        isProduction: entry.production === req.params.variant,
        content,
      });
    } catch (err) {
      res.status(500).json({ error: `Failed to read variant: ${err instanceof Error ? err.message : err}` });
    }
  });

  // PUT /api/prompts/:type/:variant — update .md content (and optionally description)
  router.put("/:type/:variant", (req, res) => {
    try {
      const manifest = readManifest(base);
      const entry = manifest[req.params.type];
      if (!entry) { res.status(404).json({ error: `Unknown prompt type: ${req.params.type}` }); return; }
      const variant = entry.variants[req.params.variant];
      if (!variant) { res.status(404).json({ error: `Unknown variant: ${req.params.variant}` }); return; }
      const { content, description } = req.body as { content?: string; description?: string };
      if (content !== undefined) {
        writeFileSync(join(promptsDir(base), variant.file), content);
      }
      if (description !== undefined) {
        variant.description = description;
        writeManifest(base, manifest);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Failed to update variant: ${err instanceof Error ? err.message : err}` });
    }
  });

  // POST /api/prompts/:type — create new variant
  router.post("/:type", (req, res) => {
    try {
      const manifest = readManifest(base);
      const entry = manifest[req.params.type];
      if (!entry) { res.status(404).json({ error: `Unknown prompt type: ${req.params.type}` }); return; }
      const { name, description, content } = req.body as { name: string; description: string; content: string };
      if (!SLUG_RE.test(name)) {
        res.status(400).json({ error: "Variant name must be lowercase alphanumeric with hyphens (a-z0-9-)" });
        return;
      }
      if (entry.variants[name]) {
        res.status(409).json({ error: `Variant "${name}" already exists` });
        return;
      }
      const filePath = `${req.params.type}/${name}.md`;
      mkdirSync(join(promptsDir(base), req.params.type), { recursive: true });
      writeFileSync(join(promptsDir(base), filePath), content);
      entry.variants[name] = { description, file: filePath };
      writeManifest(base, manifest);
      res.status(201).json({ ok: true, variant: name });
    } catch (err) {
      res.status(500).json({ error: `Failed to create variant: ${err instanceof Error ? err.message : err}` });
    }
  });

  // DELETE /api/prompts/:type/:variant
  router.delete("/:type/:variant", (req, res) => {
    try {
      const manifest = readManifest(base);
      const entry = manifest[req.params.type];
      if (!entry) { res.status(404).json({ error: `Unknown prompt type: ${req.params.type}` }); return; }
      if (entry.production === req.params.variant) {
        res.status(400).json({ error: "Cannot delete the production variant. Set a different variant as production first." });
        return;
      }
      const variant = entry.variants[req.params.variant];
      if (!variant) { res.status(404).json({ error: `Unknown variant: ${req.params.variant}` }); return; }
      const filePath = join(promptsDir(base), variant.file);
      if (existsSync(filePath)) unlinkSync(filePath);
      delete entry.variants[req.params.variant];
      writeManifest(base, manifest);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Failed to delete variant: ${err instanceof Error ? err.message : err}` });
    }
  });

  // POST /api/prompts/:type/:variant/duplicate
  router.post("/:type/:variant/duplicate", (req, res) => {
    try {
      const manifest = readManifest(base);
      const entry = manifest[req.params.type];
      if (!entry) { res.status(404).json({ error: `Unknown prompt type: ${req.params.type}` }); return; }
      const source = entry.variants[req.params.variant];
      if (!source) { res.status(404).json({ error: `Unknown variant: ${req.params.variant}` }); return; }
      const { name } = req.body as { name: string };
      if (!SLUG_RE.test(name)) {
        res.status(400).json({ error: "Variant name must be lowercase alphanumeric with hyphens (a-z0-9-)" });
        return;
      }
      if (entry.variants[name]) {
        res.status(409).json({ error: `Variant "${name}" already exists` });
        return;
      }
      const sourceContent = readFileSync(join(promptsDir(base), source.file), "utf-8");
      const newFilePath = `${req.params.type}/${name}.md`;
      writeFileSync(join(promptsDir(base), newFilePath), sourceContent);
      entry.variants[name] = { description: `Copy of ${source.description}`, file: newFilePath };
      writeManifest(base, manifest);
      res.status(201).json({ ok: true, variant: name });
    } catch (err) {
      res.status(500).json({ error: `Failed to duplicate variant: ${err instanceof Error ? err.message : err}` });
    }
  });

  // PUT /api/prompts/:type/production — set production variant
  router.put("/:type/production", (req, res) => {
    try {
      const manifest = readManifest(base);
      const entry = manifest[req.params.type];
      if (!entry) { res.status(404).json({ error: `Unknown prompt type: ${req.params.type}` }); return; }
      const { variant } = req.body as { variant: string };
      if (!entry.variants[variant]) {
        res.status(404).json({ error: `Variant "${variant}" does not exist` });
        return;
      }
      entry.production = variant;
      writeManifest(base, manifest);
      res.json({ ok: true, production: variant });
    } catch (err) {
      res.status(500).json({ error: `Failed to set production: ${err instanceof Error ? err.message : err}` });
    }
  });

  return router;
}
```

**Step 5: Update server index.ts**

In `src/server/index.ts`, change the prompts route from a static router to a factory that receives `BIRTHBUILD_ROOT`:

1. Change the import from `import { promptsRouter } from "./routes/prompts.js"` to `import { createPromptsRouter } from "./routes/prompts.js"`.

2. Add `"BIRTHBUILD_ROOT"` to the `REQUIRED_ENV_VARS` array.

3. Replace `app.use("/api/prompts", promptsRouter)` with:
```typescript
const birthbuildRoot = process.env.BIRTHBUILD_ROOT ?? "";
app.use("/api/prompts", createPromptsRouter(birthbuildRoot));
```

**Step 6: Run the tests**

Run: `npx vitest run tests/prompts-route.test.ts`
Expected: All 10 tests PASS

**Step 7: Run the full test suite**

Run: `npm test`
Expected: All existing tests still pass. If any old tests imported `promptsRouter`, they will need updating to use `createPromptsRouter`.

**Step 8: Commit**

```bash
git add src/server/routes/prompts.ts src/server/index.ts tests/prompts-route.test.ts package.json package-lock.json
git commit -m "feat: prompts API CRUD for BirthBuild template variants"
```

---

### Task 3: Add `deleteApi` to useApi hook

**Files:**
- Modify: `src/client/hooks/useApi.ts`

**Step 1: Add deleteApi function**

Add this function after the existing `putApi` in `src/client/hooks/useApi.ts`:

```typescript
export async function deleteApi<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}
```

**Step 2: Commit**

```bash
git add src/client/hooks/useApi.ts
git commit -m "feat: add deleteApi helper to useApi hook"
```

---

### Task 4: Prompts page — two-panel editor UI

**Files:**
- Modify: `src/client/pages/Prompts.tsx` (complete rewrite)
- Modify: `src/client/pages/Prompts.css` (complete rewrite)

**Step 1: Rewrite Prompts.tsx**

Replace the entire contents of `src/client/pages/Prompts.tsx` with:

```typescript
import { useState, useEffect, useCallback } from "react";
import { useApi, postApi, putApi, deleteApi } from "../hooks/useApi.js";
import "./Prompts.css";

interface ManifestVariant {
  description: string;
  file: string;
}

interface ManifestEntry {
  production: string;
  variants: Record<string, ManifestVariant>;
}

type Manifest = Record<string, ManifestEntry>;

interface VariantContent {
  variant: string;
  description: string;
  isProduction: boolean;
  content: string;
}

const TEMPLATE_VARIABLES: Record<string, string[]> = {
  "design-system": [
    "business_name", "doula_name", "tagline", "service_area", "style", "brand_feeling",
    "colour_bg", "colour_primary", "colour_accent", "colour_text", "colour_cta",
    "colour_bg_desc", "colour_primary_desc", "colour_accent_desc", "colour_text_desc", "colour_cta_desc",
    "heading_font", "body_font", "typography_scale", "spacing_density", "border_radius",
    "page_list", "social_links_desc", "year",
  ],
  "generate-page": [
    "business_name", "doula_name", "tagline", "service_area", "primary_keyword",
    "bio", "philosophy", "services_desc", "testimonials_desc", "photos_desc",
    "page", "subdomain", "email", "phone", "booking_url",
    "doula_uk", "training_provider", "training_year", "primary_location",
    "bio_previous_career", "bio_origin_story", "additional_training",
    "client_perception", "signature_story",
    "page_specific", "section_list", "year",
  ],
};

const PROMPT_TYPE_LABELS: Record<string, string> = {
  "design-system": "Design System",
  "generate-page": "Generate Page",
};

export function Prompts() {
  const { data: manifest, loading } = useApi<Manifest>("/prompts");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [savedDescription, setSavedDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showVars, setShowVars] = useState(false);
  const [localManifest, setLocalManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    if (manifest) setLocalManifest(manifest);
  }, [manifest]);

  const loadVariant = useCallback(async (type: string, variant: string) => {
    setSelectedType(type);
    setSelectedVariant(variant);
    try {
      const res = await fetch(`/api/prompts/${type}/${variant}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as VariantContent;
      setContent(data.content);
      setSavedContent(data.content);
      setDescription(data.description);
      setSavedDescription(data.description);
    } catch {
      setContent("");
      setSavedContent("");
    }
  }, []);

  const hasChanges = content !== savedContent || description !== savedDescription;

  const save = async () => {
    if (!selectedType || !selectedVariant) return;
    setSaving(true);
    try {
      await putApi(`/prompts/${selectedType}/${selectedVariant}`, { content, description });
      setSavedContent(content);
      setSavedDescription(description);
      // Update local manifest description
      if (localManifest) {
        const updated = structuredClone(localManifest);
        updated[selectedType].variants[selectedVariant].description = description;
        setLocalManifest(updated);
      }
    } catch (err) {
      alert(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const createVariant = async (type: string) => {
    try {
      await postApi(`/prompts/${type}`, {
        name: newName,
        description: newDescription,
        content: "",
      });
      setShowNewModal(null);
      setNewName("");
      setNewDescription("");
      // Update local manifest
      if (localManifest) {
        const updated = structuredClone(localManifest);
        updated[type].variants[newName] = { description: newDescription, file: `${type}/${newName}.md` };
        setLocalManifest(updated);
      }
      loadVariant(type, newName);
    } catch (err) {
      alert(`Create failed: ${err}`);
    }
  };

  const duplicateVariant = async (type: string, source: string) => {
    const name = prompt("New variant name (slug):");
    if (!name) return;
    try {
      await postApi(`/prompts/${type}/${source}/duplicate`, { name });
      if (localManifest) {
        const updated = structuredClone(localManifest);
        const sourceDesc = updated[type].variants[source].description;
        updated[type].variants[name] = { description: `Copy of ${sourceDesc}`, file: `${type}/${name}.md` };
        setLocalManifest(updated);
      }
      loadVariant(type, name);
    } catch (err) {
      alert(`Duplicate failed: ${err}`);
    }
  };

  const deleteVariant = async (type: string, variant: string) => {
    if (!confirm(`Delete variant "${variant}"?`)) return;
    try {
      await deleteApi(`/prompts/${type}/${variant}`);
      if (localManifest) {
        const updated = structuredClone(localManifest);
        delete updated[type].variants[variant];
        setLocalManifest(updated);
      }
      if (selectedType === type && selectedVariant === variant) {
        setSelectedType(null);
        setSelectedVariant(null);
        setContent("");
        setSavedContent("");
      }
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  const setProduction = async (type: string, variant: string) => {
    try {
      await putApi(`/prompts/${type}/production`, { variant });
      if (localManifest) {
        const updated = structuredClone(localManifest);
        updated[type].production = variant;
        setLocalManifest(updated);
      }
    } catch (err) {
      alert(`Failed: ${err}`);
    }
  };

  if (loading) return <div className="loading">Loading prompts...</div>;

  const m = localManifest;

  return (
    <div className="prompts-page">
      <h2>Prompts</h2>
      <div className="prompts-layout">
        <div className="prompt-sidebar">
          {m && Object.entries(m).map(([type, entry]) => (
            <div key={type} className="prompt-group">
              <h4 className="prompt-group-title">{PROMPT_TYPE_LABELS[type] ?? type}</h4>
              {Object.entries(entry.variants).map(([name, variant]) => (
                <div
                  key={name}
                  className={`prompt-item ${selectedType === type && selectedVariant === name ? "active" : ""}`}
                  onClick={() => loadVariant(type, name)}
                >
                  <div className="prompt-item-header">
                    <strong>{name}</strong>
                    {entry.production === name && <span className="badge badge-live">LIVE</span>}
                  </div>
                  <span className="prompt-desc">{variant.description}</span>
                  <div className="prompt-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-tiny" onClick={() => duplicateVariant(type, name)}>Duplicate</button>
                    {entry.production !== name && (
                      <>
                        <button className="btn-tiny" onClick={() => setProduction(type, name)}>Set Live</button>
                        <button className="btn-tiny btn-danger" onClick={() => deleteVariant(type, name)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn-secondary btn-sm new-variant-btn" onClick={() => setShowNewModal(type)}>
                + New Variant
              </button>
            </div>
          ))}
        </div>

        <div className="prompt-editor card">
          {selectedType && selectedVariant ? (
            <>
              <div className="editor-header">
                <input
                  className="editor-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Variant description..."
                />
                <button className="btn-primary btn-sm" disabled={!hasChanges || saving} onClick={save}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
              <textarea
                className="editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />
              <details className="vars-panel" open={showVars} onToggle={(e) => setShowVars((e.target as HTMLDetailsElement).open)}>
                <summary>Template Variables</summary>
                <div className="vars-grid">
                  {(TEMPLATE_VARIABLES[selectedType] ?? []).map((v) => (
                    <code key={v} className="var-tag">{`{{${v}}}`}</code>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <p className="empty-state">Select a prompt variant to edit.</p>
          )}
        </div>
      </div>

      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>New {PROMPT_TYPE_LABELS[showNewModal] ?? showNewModal} Variant</h3>
            <label>
              Name (slug):
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="v2-minimal" />
            </label>
            <label>
              Description:
              <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description..." />
            </label>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewModal(null)}>Cancel</button>
              <button className="btn-primary" disabled={!newName} onClick={() => createVariant(showNewModal)}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Rewrite Prompts.css**

Replace the entire contents of `src/client/pages/Prompts.css` with:

```css
.prompts-page { max-width: 1200px; }
.prompts-layout { display: grid; grid-template-columns: 280px 1fr; gap: var(--space-4); margin-top: var(--space-4); min-height: 600px; }

/* Sidebar */
.prompt-sidebar { display: flex; flex-direction: column; gap: var(--space-4); }
.prompt-group { display: flex; flex-direction: column; gap: var(--space-2); }
.prompt-group-title { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin: 0; }

.prompt-item {
  display: flex; flex-direction: column; gap: var(--space-1);
  padding: var(--space-3); background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  cursor: pointer; transition: all 0.15s;
}
.prompt-item:hover { border-color: var(--color-primary-light); }
.prompt-item.active { border-color: var(--color-primary); background: #E8F0E4; }

.prompt-item-header { display: flex; align-items: center; gap: var(--space-2); }
.prompt-item-header strong { font-size: var(--text-sm); }

.badge-live {
  font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
  padding: 1px 6px; border-radius: var(--radius-sm);
  background: var(--color-primary); color: white;
}

.prompt-desc { font-size: var(--text-xs); color: var(--color-text-muted); }

.prompt-actions { display: flex; gap: var(--space-1); margin-top: var(--space-1); }
.btn-tiny {
  font-size: 11px; padding: 2px 6px; border-radius: var(--radius-sm);
  background: var(--color-surface); border: 1px solid var(--color-border);
  cursor: pointer; transition: all 0.15s;
}
.btn-tiny:hover { border-color: var(--color-primary-light); }
.btn-tiny.btn-danger:hover { border-color: #c44; color: #c44; }

.new-variant-btn { margin-top: var(--space-1); }
.btn-sm { font-size: var(--text-sm); padding: var(--space-1) var(--space-3); }

/* Editor */
.prompt-editor { display: flex; flex-direction: column; gap: var(--space-3); }
.editor-header { display: flex; gap: var(--space-3); align-items: center; }
.editor-description {
  flex: 1; font-size: var(--text-sm); padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-surface);
}
.editor-textarea {
  flex: 1; min-height: 400px; font-family: "SF Mono", "Fira Code", monospace;
  font-size: 13px; line-height: 1.6; padding: var(--space-4);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg); resize: vertical; tab-size: 2;
}

/* Template variables */
.vars-panel { margin-top: var(--space-2); }
.vars-panel summary { font-size: var(--text-sm); font-weight: 500; cursor: pointer; color: var(--color-text-muted); }
.vars-grid { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: var(--space-2); }
.var-tag {
  font-size: 11px; padding: 2px 6px; border-radius: var(--radius-sm);
  background: var(--color-surface); border: 1px solid var(--color-border);
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  width: 400px; display: flex; flex-direction: column; gap: var(--space-4);
}
.modal label { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-sm); }
.modal input {
  padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-sm);
}
.modal-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
```

**Step 3: Verify the page renders**

Run: `npm run dev`
Navigate to `http://localhost:5173/prompts` and verify:
- Two groups show in sidebar (Design System, Generate Page)
- v1-structured shows with "LIVE" badge in each group
- Clicking loads content in the editor
- Save button is disabled until you make changes
- "New Variant" opens modal
- Template variables panel expands

**Step 4: Commit**

```bash
git add src/client/pages/Prompts.tsx src/client/pages/Prompts.css
git commit -m "feat: two-panel prompt editor with CRUD"
```

---

### Task 5: Update RunConfig page — prompt selection + model config

**Files:**
- Modify: `src/client/pages/RunConfig.tsx`
- Modify: `src/client/pages/RunConfig.css`

**Step 1: Update RunConfig.tsx**

Replace the entire contents of `src/client/pages/RunConfig.tsx` with:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi, postApi } from "../hooks/useApi.js";
import { CostSummaryWidget } from "../components/CostSummaryWidget.js";
import "./RunConfig.css";

interface PersonaSummary { id: string; name: string; background: string }

interface ManifestVariant { description: string; file: string }
interface ManifestEntry { production: string; variants: Record<string, ManifestVariant> }
type Manifest = Record<string, ManifestEntry>;

const ANTHROPIC_MODELS = [
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

const OPENAI_MODELS = [
  { id: "gpt-5.2", label: "GPT-5.2" },
  { id: "gpt-5.2-pro", label: "GPT-5.2 Pro" },
  { id: "gpt-5-mini", label: "GPT-5 Mini" },
];

interface PromptConfigState {
  designSystem: string;
  generatePage: string;
  modelProvider: "anthropic" | "openai";
  modelName: string;
  temperature: number;
  maxTokens: string;
  providerApiKey: string;
}

function defaultPromptConfig(manifest: Manifest | null): PromptConfigState {
  return {
    designSystem: manifest?.["design-system"]?.production ?? "v1-structured",
    generatePage: manifest?.["generate-page"]?.production ?? "v1-structured",
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-5-20250929",
    temperature: 0.7,
    maxTokens: "",
    providerApiKey: "",
  };
}

function PromptConfigPanel({
  config, onChange, manifest, label,
}: {
  config: PromptConfigState;
  onChange: (c: PromptConfigState) => void;
  manifest: Manifest | null;
  label: string;
}) {
  const models = config.modelProvider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;

  return (
    <div className="prompt-config-panel">
      {label && <h4 className="prompt-config-label">{label}</h4>}
      <div className="prompt-selects">
        <label>
          <span>Design System:</span>
          <select value={config.designSystem} onChange={(e) => onChange({ ...config, designSystem: e.target.value })}>
            {manifest?.["design-system"] && Object.entries(manifest["design-system"].variants).map(([name]) => (
              <option key={name} value={name}>
                {name}{manifest["design-system"].production === name ? " (LIVE)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Page Prompt:</span>
          <select value={config.generatePage} onChange={(e) => onChange({ ...config, generatePage: e.target.value })}>
            {manifest?.["generate-page"] && Object.entries(manifest["generate-page"].variants).map(([name]) => (
              <option key={name} value={name}>
                {name}{manifest["generate-page"].production === name ? " (LIVE)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="model-config">
        <label>
          <span>Provider:</span>
          <div className="mode-toggle">
            <button
              className={config.modelProvider === "anthropic" ? "btn-primary" : "btn-secondary"}
              onClick={() => onChange({ ...config, modelProvider: "anthropic", modelName: ANTHROPIC_MODELS[0].id })}
            >Anthropic</button>
            <button
              className={config.modelProvider === "openai" ? "btn-primary" : "btn-secondary"}
              onClick={() => onChange({ ...config, modelProvider: "openai", modelName: OPENAI_MODELS[0].id })}
            >OpenAI</button>
          </div>
        </label>
        <label>
          <span>Model:</span>
          <select value={config.modelName} onChange={(e) => onChange({ ...config, modelName: e.target.value })}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label>
          <span>Temperature:</span>
          <input type="range" min={0} max={1} step={0.1} value={config.temperature}
            onChange={(e) => onChange({ ...config, temperature: Number(e.target.value) })} />
          <span className="range-value">{config.temperature.toFixed(1)}</span>
        </label>
        <label>
          <span>Max tokens:</span>
          <input type="number" min={1} max={32768} placeholder="Default"
            value={config.maxTokens} onChange={(e) => onChange({ ...config, maxTokens: e.target.value })} />
        </label>
        {config.modelProvider === "openai" && (
          <label>
            <span>API Key:</span>
            <input type="password" placeholder="sk-..." value={config.providerApiKey}
              onChange={(e) => onChange({ ...config, providerApiKey: e.target.value })} />
          </label>
        )}
      </div>
    </div>
  );
}

export function RunConfig() {
  const navigate = useNavigate();
  const { data: personas, loading: personasLoading } = useApi<PersonaSummary[]>("/personas");
  const { data: manifest } = useApi<Manifest>("/prompts");

  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"full-pipeline" | "build-only">("full-pipeline");
  const [promptConfigA, setPromptConfigA] = useState<PromptConfigState | null>(null);
  const [abEnabled, setAbEnabled] = useState(false);
  const [promptConfigB, setPromptConfigB] = useState<PromptConfigState | null>(null);
  const [maxTurns, setMaxTurns] = useState(60);
  const [skipEvaluation, setSkipEvaluation] = useState(false);
  const [skipBuild, setSkipBuild] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Initialize prompt configs once manifest loads
  const configA = promptConfigA ?? defaultPromptConfig(manifest);
  const configB = promptConfigB ?? defaultPromptConfig(manifest);

  const togglePersona = (id: string) => {
    const next = new Set(selectedPersonas);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPersonas(next);
  };

  const selectAll = () => {
    if (personas) setSelectedPersonas(new Set(personas.map((p) => p.id)));
  };

  const deselectAll = () => setSelectedPersonas(new Set());

  const buildPromptConfig = (c: PromptConfigState) => ({
    designSystem: c.designSystem,
    generatePage: c.generatePage,
    modelProvider: c.modelProvider,
    modelName: c.modelName,
    temperature: c.temperature,
    maxTokens: c.maxTokens ? Number(c.maxTokens) : undefined,
    providerApiKey: c.providerApiKey || undefined,
  });

  const startRun = async () => {
    setIsStarting(true);
    try {
      const result = await postApi<{ runId: string }>("/runs", {
        mode,
        personas: [...selectedPersonas],
        promptConfig: buildPromptConfig(configA),
        promptConfigB: abEnabled ? buildPromptConfig(configB) : undefined,
        maxTurns,
        skipEvaluation,
        skipBuild,
      });
      navigate(`/progress/${result.runId}`);
    } catch (e) {
      alert(`Failed to start run: ${e}`);
      setIsStarting(false);
    }
  };

  if (personasLoading) return <div>Loading...</div>;

  return (
    <div className="run-config">
      <h2>Run Configuration</h2>

      <CostSummaryWidget />

      <section className="config-section card">
        <h3>Personas</h3>
        <div className="persona-grid">
          {personas?.map((p) => (
            <label key={p.id} className={`persona-card ${selectedPersonas.has(p.id) ? "selected" : ""}`}>
              <input type="checkbox" checked={selectedPersonas.has(p.id)} onChange={() => togglePersona(p.id)} />
              <div>
                <strong>{p.name}</strong>
                <span className="persona-bg">{p.background}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="persona-actions">
          <button className="btn-secondary" onClick={selectAll}>Select All</button>
          <button className="btn-secondary" onClick={deselectAll}>Deselect All</button>
        </div>
      </section>

      <section className="config-section card">
        <h3>Mode</h3>
        <div className="mode-toggle">
          <button className={mode === "full-pipeline" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("full-pipeline")}>Full Pipeline</button>
          <button className={mode === "build-only" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("build-only")}>Build Only</button>
        </div>
        <p className="mode-desc">
          {mode === "full-pipeline"
            ? "Persona \u2192 Chat \u2192 Site Spec \u2192 Build \u2192 Preview URL"
            : "Saved Site Spec \u2192 Build \u2192 Preview URL"}
        </p>
      </section>

      <section className="config-section card">
        <h3>Build Prompts</h3>
        <PromptConfigPanel config={configA} onChange={setPromptConfigA} manifest={manifest} label="" />
        <label className="ab-toggle">
          <input type="checkbox" checked={abEnabled} onChange={(e) => setAbEnabled(e.target.checked)} />
          Enable A/B Mode
        </label>
        {abEnabled && (
          <PromptConfigPanel config={configB} onChange={setPromptConfigB} manifest={manifest} label="Variant B" />
        )}
      </section>

      <details className="config-section card">
        <summary><h3 style={{ display: "inline" }}>Advanced Settings</h3></summary>
        <div className="advanced-grid">
          <label>
            <span>Max turns:</span>
            <input type="range" min={10} max={120} step={5} value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} />
            <span className="range-value">{maxTurns}</span>
          </label>
          <label>
            <input type="checkbox" checked={skipEvaluation} onChange={(e) => setSkipEvaluation(e.target.checked)} />
            Skip evaluation (save cost)
          </label>
          <label>
            <input type="checkbox" checked={skipBuild} onChange={(e) => setSkipBuild(e.target.checked)} />
            Skip build (stop at site_spec)
          </label>
        </div>
      </details>

      <button className="btn-primary start-btn" disabled={selectedPersonas.size === 0 || isStarting} onClick={startRun}>
        {isStarting ? "Starting..." : `Start Run (${selectedPersonas.size} persona${selectedPersonas.size !== 1 ? "s" : ""})`}
      </button>
    </div>
  );
}
```

**Step 2: Add CSS for new RunConfig elements**

Append to the end of `src/client/pages/RunConfig.css`:

```css
/* Prompt config panel */
.prompt-config-panel { display: flex; flex-direction: column; gap: var(--space-3); }
.prompt-config-label { margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); border-top: 1px solid var(--color-border); padding-top: var(--space-3); }
.prompt-selects { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.prompt-selects label { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-sm); }
.model-config { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.model-config label { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-sm); }
.model-config input[type="number"],
.model-config input[type="password"] {
  padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
```

**Step 3: Verify the page renders**

Run: `npm run dev`
Navigate to `http://localhost:5173/` and verify:
- Two prompt dropdowns appear (Design System, Page Prompt)
- Provider toggle switches between Anthropic/OpenAI
- Model dropdown changes per provider
- Temperature slider works
- A/B toggle shows second panel
- Start button sends the new payload shape

**Step 4: Commit**

```bash
git add src/client/pages/RunConfig.tsx src/client/pages/RunConfig.css
git commit -m "feat: prompt selection + model config in RunConfig"
```

---

### Task 6: Update runs route — accept `promptConfig` in POST body

**Files:**
- Modify: `src/server/routes/runs.ts`

**Step 1: Update POST /api/runs handler**

In `src/server/routes/runs.ts`, update the POST handler (line 114-173) to accept `promptConfig` and `promptConfigB` instead of `promptSource` and `promptSourceB`.

Replace the config construction block (lines 116-127):

```typescript
    const body = req.body as Partial<RunConfig>;
    const config: RunConfig = {
      id: randomUUID(),
      mode: body.mode ?? "full-pipeline",
      personas: body.personas ?? orchestrator.listPersonas(),
      promptSource: body.promptSource ?? "production",
      promptSourceB: body.promptSourceB,
      maxTurns: body.maxTurns ?? 60,
      personaModel: body.personaModel ?? "claude-sonnet-4-5-20250929",
      judgeModel: body.judgeModel ?? "claude-sonnet-4-5-20250929",
      skipEvaluation: body.skipEvaluation ?? false,
      skipBuild: body.skipBuild ?? false,
    };
```

With:

```typescript
    const body = req.body as Partial<RunConfig>;
    const config: RunConfig = {
      id: randomUUID(),
      mode: body.mode ?? "full-pipeline",
      personas: body.personas ?? orchestrator.listPersonas(),
      promptConfig: body.promptConfig,
      promptConfigB: body.promptConfigB,
      maxTurns: body.maxTurns ?? 60,
      personaModel: body.personaModel ?? "claude-sonnet-4-5-20250929",
      judgeModel: body.judgeModel ?? "claude-sonnet-4-5-20250929",
      skipEvaluation: body.skipEvaluation ?? false,
      skipBuild: body.skipBuild ?? false,
    };
```

**Step 2: Strip providerApiKey from saved config**

The `providerApiKey` should never be written to disk. Add a sanitisation step before writing `config.json`. In the orchestrator's `executeRun` method at line 66 where it writes config:

In `src/server/engine/orchestrator.ts`, change:
```typescript
writeFileSync(join(runDir, "config.json"), JSON.stringify(config, null, 2));
```
to:
```typescript
// Strip sensitive fields before saving to disk
const safeConfig = structuredClone(config);
if (safeConfig.promptConfig) delete safeConfig.promptConfig.providerApiKey;
if (safeConfig.promptConfigB) delete safeConfig.promptConfigB.providerApiKey;
writeFileSync(join(runDir, "config.json"), JSON.stringify(safeConfig, null, 2));
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no more references to `promptSource`

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/server/routes/runs.ts src/server/engine/orchestrator.ts
git commit -m "feat: accept promptConfig in POST /runs, strip API keys from disk"
```

---

### Task 7: Wire `prompt_config` through EdgeFunctionClient

**Files:**
- Modify: `src/server/engine/edge-function-client.ts`
- Modify: `tests/edge-function-client.test.ts`

**Step 1: Write failing tests**

Add these tests to `tests/edge-function-client.test.ts` inside the `describe("EdgeFunctionClient", ...)` block:

```typescript
  describe("buildDesignSystemRequest", () => {
    it("includes only site_spec_id when no prompt config", () => {
      const { buildDesignSystemRequest } = require("../src/server/engine/edge-function-client.js");
      const body = buildDesignSystemRequest("spec-1");
      expect(body).toEqual({ site_spec_id: "spec-1" });
    });

    it("includes prompt_config when provided", () => {
      const { buildDesignSystemRequest } = require("../src/server/engine/edge-function-client.js");
      const body = buildDesignSystemRequest("spec-1", {
        system_prompt: "You are...",
        model_name: "claude-opus-4-6",
        temperature: 0.8,
      });
      expect(body.prompt_config).toEqual({
        system_prompt: "You are...",
        model_name: "claude-opus-4-6",
        temperature: 0.8,
      });
    });
  });

  describe("buildPageRequest", () => {
    it("includes prompt_config when provided", () => {
      const { buildPageRequest } = require("../src/server/engine/edge-function-client.js");
      const body = buildPageRequest("spec-1", "home", { css: "", nav_html: "", footer_html: "", wordmark_svg: "" }, [], {
        system_prompt: "Generate...",
        model_provider: "openai",
        model_name: "gpt-5.2",
      });
      expect(body.prompt_config.model_provider).toBe("openai");
    });
  });
```

**Step 2: Run tests to see them fail**

Run: `npx vitest run tests/edge-function-client.test.ts`
Expected: FAIL — `buildDesignSystemRequest` and `buildPageRequest` not exported

**Step 3: Add PromptConfigPayload and request builders to edge-function-client.ts**

Add the following interface and functions to `src/server/engine/edge-function-client.ts`:

After the `PhotoInput` interface (around line 60), add:

```typescript
export interface PromptConfigPayload {
  system_prompt?: string;
  user_message?: string;
  model_provider?: string;
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  provider_api_key?: string;
}
```

After the `buildBuildRequest` function, add:

```typescript
export function buildDesignSystemRequest(
  siteSpecId: string,
  promptConfig?: PromptConfigPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = { site_spec_id: siteSpecId };
  if (promptConfig) body.prompt_config = promptConfig;
  return body;
}

export function buildPageRequest(
  siteSpecId: string,
  page: string,
  designSystem: DesignSystem,
  photos: PhotoInput[],
  promptConfig?: PromptConfigPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = { site_spec_id: siteSpecId, page, design_system: designSystem, photos };
  if (promptConfig) body.prompt_config = promptConfig;
  return body;
}
```

**Step 4: Update `generateDesignSystem` and `generatePage` methods to accept promptConfig**

Update the `generateDesignSystem` method:

```typescript
async generateDesignSystem(siteSpecId: string, promptConfig?: PromptConfigPayload): Promise<DesignSystemResponse> {
  const response = await fetch(this.generateDesignSystemUrl, {
    method: "POST",
    headers: this.headers(),
    body: JSON.stringify(buildDesignSystemRequest(siteSpecId, promptConfig)),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`generate-design-system error ${response.status}: ${text}`);
  }
  return response.json() as Promise<DesignSystemResponse>;
}
```

Update the `generatePage` method:

```typescript
async generatePage(
  siteSpecId: string,
  page: string,
  designSystem: DesignSystem,
  photos: PhotoInput[],
  promptConfig?: PromptConfigPayload,
): Promise<GeneratePageResponse> {
  const response = await fetch(this.generatePageUrl, {
    method: "POST",
    headers: this.headers(),
    body: JSON.stringify(buildPageRequest(siteSpecId, page, designSystem, photos, promptConfig)),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`generate-page (${page}) error ${response.status}: ${text}`);
  }
  return response.json() as Promise<GeneratePageResponse>;
}
```

**Step 5: Run tests**

Run: `npx vitest run tests/edge-function-client.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/server/engine/edge-function-client.ts tests/edge-function-client.test.ts
git commit -m "feat: prompt_config support in EdgeFunctionClient"
```

---

### Task 8: Wire prompt_config through the orchestrator

**Files:**
- Modify: `src/server/engine/orchestrator.ts`

This is the final integration task. The orchestrator reads the selected prompt template from BirthBuild's filesystem and passes it to the edge function client.

**Step 1: Add prompt template reader**

Add a helper function at the top of `orchestrator.ts` (after the constants), that reads a prompt template given a variant name:

```typescript
function readPromptTemplate(birthbuildRoot: string, promptType: string, variantName: string): string | undefined {
  if (!birthbuildRoot) return undefined;
  try {
    const manifestPath = join(birthbuildRoot, "supabase/functions/_shared/prompts/manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, { variants: Record<string, { file: string }> }>;
    const variant = manifest[promptType]?.variants[variantName];
    if (!variant) return undefined;
    const templatePath = join(birthbuildRoot, "supabase/functions/_shared/prompts", variant.file);
    return readFileSync(templatePath, "utf-8");
  } catch {
    return undefined;
  }
}
```

**Step 2: Update `generateAndDeploy` to accept and use `promptConfig`**

Import `PromptSelection` from types and `PromptConfigPayload` from edge-function-client at the top of the file.

Add `promptConfig?: PromptSelection` parameter to `generateAndDeploy` (after `costTracker`).

Inside `generateAndDeploy`, before calling `this.edgeClient.generateDesignSystem(siteSpecId)`, build the prompt_config payload:

```typescript
// Build prompt_config payload if a custom prompt selection was provided
const birthbuildRoot = process.env.BIRTHBUILD_ROOT ?? "";
let dsPromptConfig: PromptConfigPayload | undefined;
let pagePromptConfig: PromptConfigPayload | undefined;

if (promptConfig) {
  const dsTemplate = readPromptTemplate(birthbuildRoot, "design-system", promptConfig.designSystem);
  const pageTemplate = readPromptTemplate(birthbuildRoot, "generate-page", promptConfig.generatePage);

  const baseConfig: Partial<PromptConfigPayload> = {};
  if (promptConfig.modelProvider) baseConfig.model_provider = promptConfig.modelProvider;
  if (promptConfig.modelName) baseConfig.model_name = promptConfig.modelName;
  if (promptConfig.temperature !== undefined) baseConfig.temperature = promptConfig.temperature;
  if (promptConfig.maxTokens) baseConfig.max_tokens = promptConfig.maxTokens;
  if (promptConfig.providerApiKey) baseConfig.provider_api_key = promptConfig.providerApiKey;

  if (dsTemplate || Object.keys(baseConfig).length > 0) {
    dsPromptConfig = { ...baseConfig };
    if (dsTemplate) dsPromptConfig.system_prompt = dsTemplate;
  }
  if (pageTemplate || Object.keys(baseConfig).length > 0) {
    pagePromptConfig = { ...baseConfig };
    if (pageTemplate) pagePromptConfig.system_prompt = pageTemplate;
  }
}
```

Then update the edge function calls to pass the payload:

```typescript
const dsResponse = await this.edgeClient.generateDesignSystem(siteSpecId, dsPromptConfig);
```

And for page generation:

```typescript
const pageResults = await Promise.all(
  pages.map((page) =>
    this.edgeClient.generatePage(siteSpecId, page, designSystem, photos, pagePromptConfig),
  ),
);
```

**Step 3: Pass promptConfig from executeFullPipeline and executeBuildOnly**

In `executeFullPipeline`, update the `generateAndDeploy` call (around line 161):

```typescript
const { files, previewUrl: url } = await this.generateAndDeploy(
  config, persona.id, siteSpecId, personaDir, onProgress, costTracker, config.promptConfig,
);
```

In `executeBuildOnly`, update the `generateAndDeploy` call (around line 205):

```typescript
const { previewUrl } = await this.generateAndDeploy(
  config, personaId, siteSpecId, personaDir, onProgress, costTracker, config.promptConfig,
);
```

**Step 4: Update cost estimation model**

In the cost estimation section of `generateAndDeploy`, update the model used for estimation based on promptConfig:

```typescript
const estimatedModel = promptConfig?.modelName ?? "claude-sonnet-4-5-20250929";
```

Use `estimatedModel` in both `recordEstimatedCall` invocations instead of the hardcoded string.

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/server/engine/orchestrator.ts
git commit -m "feat: wire prompt_config through orchestrator to edge functions"
```

---

### Task 9: Add BIRTHBUILD_ROOT to .env and update CLAUDE.md

**Files:**
- Modify: `.env` (add `BIRTHBUILD_ROOT`)
- Modify: `CLAUDE.md` (update env vars table + API table)

**Step 1: Add to .env**

Add to your `.env` file:

```
BIRTHBUILD_ROOT=/Users/andrew/Documents/DopamineLaboratory/Apps/BirthBuild
```

**Step 2: Update CLAUDE.md**

Add `BIRTHBUILD_ROOT` to the Environment Variables section:

```
- `BIRTHBUILD_ROOT` — Path to BirthBuild project root (for reading/writing prompt templates)
```

Update the API Endpoints table — replace the two prompt rows with:

```
| GET | `/api/prompts` | Full manifest (prompt types + variants) |
| GET | `/api/prompts/:type/:variant` | Read prompt template content |
| PUT | `/api/prompts/:type/:variant` | Update prompt template content |
| POST | `/api/prompts/:type` | Create new variant |
| DELETE | `/api/prompts/:type/:variant` | Delete variant |
| POST | `/api/prompts/:type/:variant/duplicate` | Duplicate variant |
| PUT | `/api/prompts/:type/production` | Set production variant |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add BIRTHBUILD_ROOT env var and prompt API endpoints"
```

---

### Task 10: End-to-end smoke test

**No code changes.** This task verifies the full flow works.

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Test the Prompts page**

1. Navigate to `http://localhost:5173/prompts`
2. Verify both prompt types show in sidebar with "LIVE" badges
3. Click "v1-structured" under Design System — content should load
4. Click "New Variant" under Design System — create "v2-test" with some content
5. Verify it appears in the sidebar
6. Click "Duplicate" on v1-structured — name it "v1-copy"
7. Click "Set Live" on v2-test — LIVE badge should move
8. Click "Delete" on v1-copy — should disappear
9. Set v1-structured back to LIVE

**Step 3: Test RunConfig prompt selection**

1. Navigate to `http://localhost:5173/`
2. Verify prompt dropdowns show variants with "(LIVE)" suffix
3. Select a persona, set mode to "build-only"
4. Select a non-production prompt variant
5. Toggle to OpenAI — verify model dropdown changes, API key field appears
6. Toggle back to Anthropic
7. Enable A/B mode — second panel should appear
8. Start a build-only run — verify it completes with a preview URL

**Step 4: Verify prompt_config reaches the edge function**

Check the run's `config.json` in the `runs/` directory to confirm `promptConfig` is saved (without `providerApiKey`).

**Step 5: Commit (if any cleanup needed)**

```bash
git add -A
git commit -m "fix: any cleanup from smoke testing"
```
