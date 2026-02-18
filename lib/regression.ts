import type { TestRunSummary } from "../personas/schema.js";

export interface RegressionResult {
  detected: boolean;
  details: string[];
}

export function detectRegressions(
  current: TestRunSummary,
  previous: TestRunSummary,
): RegressionResult {
  const details: string[] = [];

  for (const [personaId, currPersona] of Object.entries(current.personas)) {
    const prevPersona = previous.personas[personaId];
    if (!prevPersona) continue;

    // Score drops > 1 point on universal criteria
    for (const [criterion, currScore] of Object.entries(currPersona.universal_scores)) {
      const prevScore = prevPersona.universal_scores[criterion];
      if (prevScore !== undefined && typeof currScore === "number" && typeof prevScore === "number") {
        if (prevScore - currScore > 1) {
          details.push(`${personaId}: ${criterion} dropped from ${prevScore} to ${currScore}`);
        }
      }
    }

    // Score drops > 1 point on persona criteria
    for (const [criterion, currScore] of Object.entries(currPersona.persona_scores)) {
      const prevScore = prevPersona.persona_scores[criterion];
      if (prevScore !== undefined && typeof currScore === "number" && typeof prevScore === "number") {
        if (prevScore - currScore > 1) {
          details.push(`${personaId}: ${criterion} dropped from ${prevScore} to ${currScore}`);
        }
      }
    }

    // New hard fails
    for (const hf of currPersona.hard_fails) {
      if (!prevPersona.hard_fails.includes(hf)) {
        details.push(`${personaId}: new hard fail — ${hf}`);
      }
    }

    // Density shift > 5 points
    const currDensity = currPersona.density_score.totalScore;
    const prevDensity = prevPersona.density_score.totalScore;
    if (Math.abs(currDensity - prevDensity) > 5) {
      details.push(`${personaId}: density shifted from ${prevDensity} to ${currDensity}`);
    }

    // Turn count checks for specific personas
    if (personaId === "detailed-dina" && prevPersona.total_turns > 0) {
      const increase = (currPersona.total_turns - prevPersona.total_turns) / prevPersona.total_turns;
      if (increase > 0.3) {
        details.push(`${personaId}: turn count increased ${Math.round(increase * 100)}% (${prevPersona.total_turns} → ${currPersona.total_turns})`);
      }
    }
    if (personaId === "sparse-sarah" && prevPersona.total_turns > 0) {
      const decrease = (prevPersona.total_turns - currPersona.total_turns) / prevPersona.total_turns;
      if (decrease > 0.3) {
        details.push(`${personaId}: turn count decreased ${Math.round(decrease * 100)}% (${prevPersona.total_turns} → ${currPersona.total_turns})`);
      }
    }
  }

  return {
    detected: details.length > 0,
    details,
  };
}
