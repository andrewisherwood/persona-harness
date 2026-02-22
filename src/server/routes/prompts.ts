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

  // PUT /api/prompts/:type/production — set production variant
  // (must be registered before /:type/:variant to avoid param capture)
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

  return router;
}
