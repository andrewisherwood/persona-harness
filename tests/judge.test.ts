import { describe, it, expect } from "vitest";
import { buildJudgePrompt, buildEvaluationTool } from "../lib/judge.js";
import { UNIVERSAL_CRITERIA } from "../criteria/universal.js";
import { SPARSE_SARAH_CRITERIA } from "../criteria/birthbuild/sparse-sarah.js";
import type { Persona, ConversationTurn } from "../personas/schema.js";

describe("buildJudgePrompt", () => {
  const persona: Persona = {
    id: "test",
    name: "Test",
    vertical: "birthbuild",
    background: "test",
    communication_style: { detail_level: "minimal", tone: "neutral", typical_response_length: "1-2 sentences", quirks: [] },
    knowledge: { knows_about_their_field: "beginner", self_awareness: "low", willingness_to_share: "open" },
    seed_data: {},
    gaps: [],
    triggers: { will_elaborate_if: [], will_shut_down_if: [], will_skip_if: [] },
  };

  const turns: ConversationTurn[] = [
    { turn_number: 1, role: "assistant", content: "Hello!", timestamp: "2026-01-01T00:00:00Z" },
    { turn_number: 2, role: "user", content: "Hi", timestamp: "2026-01-01T00:00:01Z" },
  ];

  it("includes persona profile in prompt", () => {
    const prompt = buildJudgePrompt(persona, turns, UNIVERSAL_CRITERIA, SPARSE_SARAH_CRITERIA);
    expect(prompt).toContain("Test");
    expect(prompt).toContain("Persona Profile");
  });

  it("includes conversation transcript", () => {
    const prompt = buildJudgePrompt(persona, turns, UNIVERSAL_CRITERIA, SPARSE_SARAH_CRITERIA);
    expect(prompt).toContain("[Turn 1]");
    expect(prompt).toContain("Hello!");
  });

  it("includes criteria", () => {
    const prompt = buildJudgePrompt(persona, turns, UNIVERSAL_CRITERIA, SPARSE_SARAH_CRITERIA);
    expect(prompt).toContain("completion");
    expect(prompt).toContain("gentle_probing");
  });

  it("marks hard fail criteria", () => {
    const prompt = buildJudgePrompt(persona, turns, UNIVERSAL_CRITERIA, SPARSE_SARAH_CRITERIA);
    expect(prompt).toContain("[HARD FAIL]");
  });
});

describe("buildEvaluationTool", () => {
  it("returns a valid tool definition", () => {
    const tool = buildEvaluationTool();
    expect(tool.name).toBe("submit_evaluation");
    expect(tool.input_schema).toBeDefined();
  });
});
