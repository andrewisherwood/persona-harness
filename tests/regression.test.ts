import { describe, it, expect } from "vitest";
import { detectRegressions } from "../lib/regression.js";
import type { TestRunSummary, PersonaSummary } from "../personas/schema.js";

function makePersona(overrides: Partial<PersonaSummary> = {}): PersonaSummary {
  return {
    passed: true,
    overall_score: 3.8,
    hard_fails: [],
    density_score: { coreScore: 5, depthScore: 6, totalScore: 11, percentage: 44, level: "medium", suggestions: [] },
    total_turns: 28,
    universal_scores: { completion: 4, tone_consistency: 4 },
    persona_scores: { gentle_probing: 3 },
    top_improvement: "test",
    ...overrides,
  };
}

function makeSummary(personas: Record<string, PersonaSummary>): TestRunSummary {
  return {
    run_id: "test",
    timestamp: "2026-02-18T14:30:00Z",
    prompt_version: "abc",
    model: "sonnet",
    personas,
    regression: { detected: false, details: [] },
    overall_pass: true,
  };
}

describe("detectRegressions", () => {
  it("returns no regressions when scores are stable", () => {
    const prev = makeSummary({ "sparse-sarah": makePersona() });
    const curr = makeSummary({ "sparse-sarah": makePersona() });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(false);
    expect(result.details).toEqual([]);
  });

  it("detects score drop > 1 point", () => {
    const prev = makeSummary({ "sparse-sarah": makePersona({ universal_scores: { completion: 4, tone_consistency: 4 } }) });
    const curr = makeSummary({ "sparse-sarah": makePersona({ universal_scores: { completion: 2, tone_consistency: 4 } }) });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(true);
    expect(result.details.some((d) => d.includes("completion"))).toBe(true);
  });

  it("detects new hard fail", () => {
    const prev = makeSummary({ "sparse-sarah": makePersona({ hard_fails: [] }) });
    const curr = makeSummary({ "sparse-sarah": makePersona({ hard_fails: ["max_follow_ups_respected"] }) });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(true);
    expect(result.details.some((d) => d.includes("hard fail"))).toBe(true);
  });

  it("detects Dina turn count increase > 30%", () => {
    const prev = makeSummary({ "detailed-dina": makePersona({ total_turns: 20 }) });
    const curr = makeSummary({ "detailed-dina": makePersona({ total_turns: 30 }) });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(true);
    expect(result.details.some((d) => d.includes("turn count increased"))).toBe(true);
  });

  it("detects Sarah turn count decrease > 30%", () => {
    const prev = makeSummary({ "sparse-sarah": makePersona({ total_turns: 30 }) });
    const curr = makeSummary({ "sparse-sarah": makePersona({ total_turns: 18 }) });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(true);
    expect(result.details.some((d) => d.includes("turn count decreased"))).toBe(true);
  });

  it("ignores personas not in previous run", () => {
    const prev = makeSummary({});
    const curr = makeSummary({ "sparse-sarah": makePersona() });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(false);
  });
});
