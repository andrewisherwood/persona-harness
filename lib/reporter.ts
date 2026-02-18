import type {
  EvaluationResult,
  DensityResult,
  PersonaSummary,
  TestRunSummary,
} from "../personas/schema.js";

export function buildPersonaSummary(
  evaluation: EvaluationResult,
  density: DensityResult,
  totalTurns: number,
): PersonaSummary {
  const universalScores: Record<string, number> = {};
  for (const [key, val] of Object.entries(evaluation.universal_scores)) {
    universalScores[key] = val.score;
  }

  const personaScores: Record<string, number | boolean> = {};
  for (const [key, val] of Object.entries(evaluation.persona_scores)) {
    if ("score" in val && typeof val.score === "number") personaScores[key] = val.score;
    else if ("check" in val && typeof val.check === "boolean") personaScores[key] = val.check;
    else if ("count" in val && typeof val.count === "number") personaScores[key] = val.count;
  }

  return {
    passed: evaluation.hard_fails.length === 0 && evaluation.overall_score >= 3.0,
    overall_score: evaluation.overall_score,
    hard_fails: evaluation.hard_fails,
    density_score: density,
    total_turns: totalTurns,
    universal_scores: universalScores,
    persona_scores: personaScores,
    top_improvement: evaluation.top_improvement,
  };
}

export function generateMarkdownReport(summary: TestRunSummary): string {
  const regressionNote = summary.regression.detected
    ? " (regressions detected)"
    : " (no regressions)";

  let md = `# Persona Test Run — ${summary.timestamp}\n\n`;
  md += `**Prompt version:** ${summary.prompt_version}\n`;
  md += `**Model:** ${summary.model}\n`;
  md += `**Result:** ${summary.overall_pass ? "PASS" : "FAIL"}${regressionNote}\n\n`;

  for (const [personaId, persona] of Object.entries(summary.personas)) {
    const icon = persona.passed ? "PASS" : "FAIL";
    md += `## ${personaId}\n`;
    md += `Score: ${persona.overall_score}/5 | Density: ${persona.density_score.totalScore}/25 (${persona.density_score.level}) | Turns: ${persona.total_turns}\n`;
    md += `Status: ${icon}\n`;

    if (persona.hard_fails.length > 0) {
      md += `Hard fails: ${persona.hard_fails.join(", ")}\n`;
    }

    md += `Top improvement: ${persona.top_improvement}\n\n`;
  }

  if (summary.regression.detected) {
    md += `## Regressions\n`;
    for (const detail of summary.regression.details) {
      md += `- ${detail}\n`;
    }
    md += "\n";
  }

  return md;
}
