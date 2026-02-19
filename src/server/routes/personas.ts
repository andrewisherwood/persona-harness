import { Router } from "express";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const router = Router();
const PERSONAS_DIR = join(process.cwd(), "personas/birthbuild");

// GET /api/personas — list all personas
router.get("/", (_req, res) => {
  if (!existsSync(PERSONAS_DIR)) {
    res.json([]);
    return;
  }
  const personas = readdirSync(PERSONAS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const data = JSON.parse(readFileSync(join(PERSONAS_DIR, f), "utf-8"));
      return { id: data.id, name: data.name, background: data.background };
    });
  res.json(personas);
});

// GET /api/personas/:id — get full persona definition
router.get("/:id", (req, res) => {
  const filePath = join(PERSONAS_DIR, `${req.params.id}.json`);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }
  res.json(JSON.parse(readFileSync(filePath, "utf-8")));
});

export { router as personasRouter };
