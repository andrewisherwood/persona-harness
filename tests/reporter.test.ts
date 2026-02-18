import { describe, it, expect } from "vitest";
import { generateMarkdownReport, buildPersonaSummary } from "../lib/reporter.js";
import type { EvaluationResult, DensityResult } from "../personas/schema.js";

describe("buildPersonaSummary", () => {
  it("builds a summary from evaluation result", () => {
    const evaluation: EvaluationResult = {
      persona_id: "sparse-sarah",
      universal_scores: {
        completion: { score: 4, reasoning: "Reached review" },
        tone_consistency: { score: 5, reasoning: "Warm throughout" },
      },
      persona_scores: {
        gentle_probing: { score: 3, reasoning: "Decent" },
      },
      hard_fails: [],
      overall_score: 3.8,
      top_improvement: "Better examples",
      regression_pass: true,
      regression_reasoning: "Consistent",
    };
    const density: DensityResult = {
      coreScore: 5,
      depthScore: 6,
      totalScore: 11,
      percentage: 44,
      level: "medium",
      suggestions: [],
    };

    const summary = buildPersonaSummary(evaluation, density, 28);
    expect(summary.passed).toBe(true);
    expect(summary.overall_score).toBe(3.8);
    expect(summary.total_turns).toBe(28);
    expect(summary.hard_fails).toEqual([]);
  });

  it("marks as failed when hard fails exist", () => {
    const evaluation: EvaluationResult = {
      persona_id: "sparse-sarah",
      universal_scores: {},
      persona_scores: {},
      hard_fails: ["max_follow_ups_respected"],
      overall_score: 2.0,
      top_improvement: "Respect limits",
      regression_pass: false,
      regression_reasoning: "Hard fail",
    };
    const density: DensityResult = {
      coreScore: 3, depthScore: 2, totalScore: 5,
      percentage: 20, level: "low", suggestions: [],
    };

    const summary = buildPersonaSummary(evaluation, density, 40);
    expect(summary.passed).toBe(false);
  });

  it("marks as failed when score below 3.0", () => {
    const evaluation: EvaluationResult = {
      persona_id: "sparse-sarah",
      universal_scores: {},
      persona_scores: {},
      hard_fails: [],
      overall_score: 2.5,
      top_improvement: "Everything",
      regression_pass: false,
      regression_reasoning: "Low score",
    };
    const density: DensityResult = {
      coreScore: 3, depthScore: 2, totalScore: 5,
      percentage: 20, level: "low", suggestions: [],
    };

    const summary = buildPersonaSummary(evaluation, density, 40);
    expect(summary.passed).toBe(false);
  });
});

describe("generateMarkdownReport", () => {
  it("produces markdown with persona sections", () => {
    const md = generateMarkdownReport({
      run_id: "test-run",
      timestamp: "2026-02-18T14:30:00Z",
      prompt_version: "abc123",
      model: "claude-sonnet-4-5",
      personas: {
        "sparse-sarah": {
          passed: true,
          overall_score: 3.8,
          hard_fails: [],
          density_score: { coreScore: 5, depthScore: 6, totalScore: 11, percentage: 44, level: "medium", suggestions: [] },
          total_turns: 28,
          universal_scores: { completion: 4 },
          persona_scores: { gentle_probing: 3 },
          top_improvement: "Better examples",
        },
      },
      regression: { detected: false, details: [] },
      overall_pass: true,
    });
    expect(md).toContain("# Persona Test Run");
    expect(md).toContain("sparse-sarah");
    expect(md).toContain("PASS");
  });

  it("includes regression details when detected", () => {
    const md = generateMarkdownReport({
      run_id: "test-run",
      timestamp: "2026-02-18T14:30:00Z",
      prompt_version: "abc123",
      model: "claude-sonnet-4-5",
      personas: {},
      regression: { detected: true, details: ["score dropped"] },
      overall_pass: false,
    });
    expect(md).toContain("Regressions");
    expect(md).toContain("score dropped");
  });
});
