import { describe, it, expect } from "vitest";
import { buildPersonaSystemPrompt } from "../lib/persona-agent.js";
import type { Persona } from "../personas/schema.js";

describe("buildPersonaSystemPrompt", () => {
  it("includes persona JSON in the prompt", () => {
    const persona: Persona = {
      id: "test",
      name: "Test",
      vertical: "birthbuild",
      background: "A test",
      communication_style: {
        detail_level: "minimal",
        tone: "neutral",
        typical_response_length: "1-2 sentences",
        quirks: [],
      },
      knowledge: {
        knows_about_their_field: "beginner",
        self_awareness: "low",
        willingness_to_share: "open",
      },
      seed_data: { business_name: "Test" },
      gaps: [],
      triggers: {
        will_elaborate_if: [],
        will_shut_down_if: [],
        will_skip_if: [],
      },
    };
    const prompt = buildPersonaSystemPrompt(persona);
    expect(prompt).toContain("Test");
    expect(prompt).toContain("seed_data");
    expect(prompt).toContain("Do not break character");
  });
});
