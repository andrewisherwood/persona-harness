import { Router } from "express";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const router = Router();
const PROMPTS_DIR = join(process.cwd(), "prompts/birthbuild");

// GET /api/prompts — list available prompts
router.get("/", (_req, res) => {
  const prompts: Array<{ id: string; name: string; source: string }> = [
    { id: "production", name: "Production (live)", source: "edge-function" },
  ];
  if (existsSync(PROMPTS_DIR)) {
    const files = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      prompts.push({ id: f.replace(".md", ""), name: f, source: "local" });
    }
  }
  res.json(prompts);
});

// GET /api/prompts/:id — get prompt content
router.get("/:id", (req, res) => {
  if (req.params.id === "production") {
    res.json({ id: "production", content: "(Fetched from production at runtime)" });
    return;
  }
  const filePath = join(PROMPTS_DIR, `${req.params.id}.md`);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.json({ id: req.params.id, content: readFileSync(filePath, "utf-8") });
});

export { router as promptsRouter };
