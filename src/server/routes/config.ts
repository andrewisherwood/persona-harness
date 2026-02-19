import { Router } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const router = Router();
const CONFIG_PATH = join(process.cwd(), "harness-config.json");

interface HarnessConfig {
  dailyBudget: number;
  defaultPersonaModel: string;
  defaultJudgeModel: string;
}

const DEFAULT_CONFIG: HarnessConfig = {
  dailyBudget: 10,
  defaultPersonaModel: "claude-sonnet-4-5-20250929",
  defaultJudgeModel: "claude-sonnet-4-5-20250929",
};

function loadConfig(): HarnessConfig {
  if (existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) };
  }
  return DEFAULT_CONFIG;
}

// GET /api/config
router.get("/", (_req, res) => {
  res.json(loadConfig());
});

// PUT /api/config
router.put("/", (req, res) => {
  const current = loadConfig();
  const updated = { ...current, ...req.body };
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  res.json(updated);
});

export { router as configRouter };
