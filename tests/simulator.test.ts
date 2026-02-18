import { describe, it, expect } from "vitest";
import { formatTranscript } from "../lib/simulator.js";
import type { ConversationTurn } from "../personas/schema.js";

describe("formatTranscript", () => {
  it("formats turns into readable text", () => {
    const turns: ConversationTurn[] = [
      { turn_number: 1, role: "assistant", content: "Hello!", timestamp: "2026-02-18T14:00:00Z" },
      { turn_number: 2, role: "user", content: "Hi", timestamp: "2026-02-18T14:00:01Z" },
    ];
    const text = formatTranscript(turns);
    expect(text).toContain("[Turn 1] assistant:");
    expect(text).toContain("Hello!");
    expect(text).toContain("[Turn 2] user:");
    expect(text).toContain("Hi");
  });
});
