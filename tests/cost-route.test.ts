import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  aggregateCosts,
  parseRunTimestamp,
  isSameUTCDay,
  isSameUTCWeek,
} from "../src/server/routes/cost.js";

const TEST_RUNS_DIR = join(process.cwd(), "test-runs-cost");

function createRun(dirName: string, totalCost: number) {
  const dir = join(TEST_RUNS_DIR, dirName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "summary.json"),
    JSON.stringify({ totalCost }),
  );
}

describe("cost-route", () => {
  beforeEach(() => {
    if (existsSync(TEST_RUNS_DIR)) {
      rmSync(TEST_RUNS_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_RUNS_DIR)) {
      rmSync(TEST_RUNS_DIR, { recursive: true });
    }
  });

  describe("parseRunTimestamp", () => {
    it("parses a valid run directory name", () => {
      const date = parseRunTimestamp("2026-02-19T14-30-00");
      expect(date).not.toBeNull();
      expect(date!.getUTCFullYear()).toBe(2026);
      expect(date!.getUTCMonth()).toBe(1); // 0-indexed
      expect(date!.getUTCDate()).toBe(19);
      expect(date!.getUTCHours()).toBe(14);
      expect(date!.getUTCMinutes()).toBe(30);
    });

    it("returns null for invalid directory names", () => {
      expect(parseRunTimestamp("not-a-timestamp")).toBeNull();
      expect(parseRunTimestamp("some-random-dir")).toBeNull();
      expect(parseRunTimestamp("")).toBeNull();
    });
  });

  describe("isSameUTCDay", () => {
    it("returns true for same day", () => {
      const a = new Date("2026-02-19T10:00:00Z");
      const b = new Date("2026-02-19T23:59:59Z");
      expect(isSameUTCDay(a, b)).toBe(true);
    });

    it("returns false for different days", () => {
      const a = new Date("2026-02-18T23:59:59Z");
      const b = new Date("2026-02-19T00:00:00Z");
      expect(isSameUTCDay(a, b)).toBe(false);
    });
  });

  describe("isSameUTCWeek", () => {
    // 2026-02-19 is a Thursday. ISO week starts Monday 2026-02-16.
    it("returns true for dates in the same ISO week", () => {
      const thursday = new Date("2026-02-19T12:00:00Z");
      const monday = new Date("2026-02-16T00:00:00Z");
      expect(isSameUTCWeek(monday, thursday)).toBe(true);
    });

    it("returns false for date in previous week", () => {
      const thursday = new Date("2026-02-19T12:00:00Z");
      const lastSunday = new Date("2026-02-15T23:59:59Z");
      expect(isSameUTCWeek(lastSunday, thursday)).toBe(false);
    });
  });

  describe("aggregateCosts", () => {
    it("returns zeros when no runs directory exists", () => {
      const result = aggregateCosts(join(process.cwd(), "nonexistent-dir"));
      expect(result).toEqual({
        today: 0,
        thisWeek: 0,
        total: 0,
        runCount: 0,
        todayRunCount: 0,
      });
    });

    it("returns zeros when runs directory is empty", () => {
      mkdirSync(TEST_RUNS_DIR, { recursive: true });
      const result = aggregateCosts(TEST_RUNS_DIR);
      expect(result).toEqual({
        today: 0,
        thisWeek: 0,
        total: 0,
        runCount: 0,
        todayRunCount: 0,
      });
    });

    it("correctly sums costs from run directories", () => {
      createRun("2026-01-10T10-00-00", 0.5);
      createRun("2026-01-11T12-00-00", 0.75);

      const now = new Date("2026-02-19T12:00:00Z");
      const result = aggregateCosts(TEST_RUNS_DIR, now);

      expect(result.total).toBeCloseTo(1.25, 4);
      expect(result.runCount).toBe(2);
    });

    it("correctly filters by today", () => {
      const now = new Date("2026-02-19T15:00:00Z");

      createRun("2026-02-19T10-00-00", 0.10);
      createRun("2026-02-19T14-30-00", 0.25);
      createRun("2026-02-18T10-00-00", 0.50);

      const result = aggregateCosts(TEST_RUNS_DIR, now);

      expect(result.today).toBeCloseTo(0.35, 4);
      expect(result.todayRunCount).toBe(2);
      expect(result.total).toBeCloseTo(0.85, 4);
      expect(result.runCount).toBe(3);
    });

    it("correctly filters by this week", () => {
      // 2026-02-19 is a Thursday; ISO week Mon 2026-02-16 to Sun 2026-02-22
      const now = new Date("2026-02-19T15:00:00Z");

      createRun("2026-02-16T08-00-00", 0.10); // Monday = same week
      createRun("2026-02-19T10-00-00", 0.20); // Thursday = same week
      createRun("2026-02-15T23-00-00", 0.40); // Sunday before = previous week
      createRun("2026-01-05T12-00-00", 0.80); // Old run

      const result = aggregateCosts(TEST_RUNS_DIR, now);

      expect(result.thisWeek).toBeCloseTo(0.30, 4);
      expect(result.total).toBeCloseTo(1.50, 4);
    });

    it("skips directories without summary.json", () => {
      createRun("2026-02-19T10-00-00", 0.10);
      mkdirSync(join(TEST_RUNS_DIR, "2026-02-19T11-00-00"), { recursive: true });
      // No summary.json in the second directory

      const now = new Date("2026-02-19T15:00:00Z");
      const result = aggregateCosts(TEST_RUNS_DIR, now);

      expect(result.runCount).toBe(1);
      expect(result.total).toBeCloseTo(0.10, 4);
    });

    it("handles summary.json with missing totalCost field", () => {
      const dir = join(TEST_RUNS_DIR, "2026-02-19T10-00-00");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "summary.json"), JSON.stringify({ someOtherField: true }));

      const now = new Date("2026-02-19T15:00:00Z");
      const result = aggregateCosts(TEST_RUNS_DIR, now);

      expect(result.runCount).toBe(1);
      expect(result.total).toBe(0);
      expect(result.todayRunCount).toBe(1);
    });
  });
});
