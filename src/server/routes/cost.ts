import { Router } from "express";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const router = Router();
const RUNS_DIR = join(process.cwd(), "runs");
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

/** Parse a run directory name like "2026-02-19T14-30-00" into a Date */
export function parseRunTimestamp(dirName: string): Date | null {
  // Format: YYYY-MM-DDTHH-MM-SS
  const match = dirName.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

/** Check whether a date falls on the same UTC day as the reference date */
export function isSameUTCDay(date: Date, reference: Date): boolean {
  return (
    date.getUTCFullYear() === reference.getUTCFullYear() &&
    date.getUTCMonth() === reference.getUTCMonth() &&
    date.getUTCDate() === reference.getUTCDate()
  );
}

/** Check whether a date falls within the same ISO week as the reference date */
export function isSameUTCWeek(date: Date, reference: Date): boolean {
  // Start of ISO week (Monday 00:00:00 UTC) for the reference date
  const refDay = reference.getUTCDay();
  const mondayOffset = refDay === 0 ? -6 : 1 - refDay;
  const weekStart = new Date(reference);
  weekStart.setUTCDate(reference.getUTCDate() + mondayOffset);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  return date >= weekStart && date < weekEnd;
}

export interface CostSummaryResponse {
  today: number;
  thisWeek: number;
  total: number;
  budget: number;
  runCount: number;
  todayRunCount: number;
}

/** Read all run directories and aggregate cost data */
export function aggregateCosts(
  runsDir: string,
  now: Date = new Date(),
): Omit<CostSummaryResponse, "budget"> {
  if (!existsSync(runsDir)) {
    return { today: 0, thisWeek: 0, total: 0, runCount: 0, todayRunCount: 0 };
  }

  const dirs = readdirSync(runsDir);
  let total = 0;
  let thisWeek = 0;
  let today = 0;
  let runCount = 0;
  let todayRunCount = 0;

  for (const dir of dirs) {
    const summaryPath = join(runsDir, dir, "summary.json");
    if (!existsSync(summaryPath)) continue;

    let cost = 0;
    try {
      const summary = JSON.parse(readFileSync(summaryPath, "utf-8")) as {
        totalCost?: number;
      };
      cost = typeof summary.totalCost === "number" ? summary.totalCost : 0;
    } catch {
      continue;
    }

    runCount++;
    total += cost;

    const ts = parseRunTimestamp(dir);
    if (ts) {
      if (isSameUTCDay(ts, now)) {
        today += cost;
        todayRunCount++;
      }
      if (isSameUTCWeek(ts, now)) {
        thisWeek += cost;
      }
    }
  }

  return { today, thisWeek, total, runCount, todayRunCount };
}

// GET /api/cost/summary
router.get("/summary", (_req, res) => {
  const config = loadConfig();
  const costs = aggregateCosts(RUNS_DIR);
  const response: CostSummaryResponse = {
    ...costs,
    budget: config.dailyBudget,
  };
  res.json(response);
});

export { router as costRouter };
