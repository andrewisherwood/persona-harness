import { describe, it, expect } from "vitest";
import { CostTracker, MODEL_RATES } from "../src/server/engine/cost-tracker.js";

describe("cost-tracker", () => {
  it("tracks a single direct API call cost", () => {
    const tracker = new CostTracker();
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 10000,
      outputTokens: 2000,
    });
    const summary = tracker.getSummary();
    expect(summary.persona_agent).toBeDefined();
    expect(summary.persona_agent!.input_tokens).toBe(10000);
    expect(summary.persona_agent!.output_tokens).toBe(2000);
    expect(summary.persona_agent!.usd).toBeGreaterThan(0);
  });

  it("accumulates multiple calls in same category", () => {
    const tracker = new CostTracker();
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 5000,
      outputTokens: 1000,
    });
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 5000,
      outputTokens: 1000,
    });
    const summary = tracker.getSummary();
    expect(summary.persona_agent!.input_tokens).toBe(10000);
    expect(summary.persona_agent!.output_tokens).toBe(2000);
  });

  it("tracks estimated chatbot costs", () => {
    const tracker = new CostTracker();
    tracker.recordEstimatedCall("chatbot_estimated", {
      messageCount: 45,
      estimatedTokens: 52000,
      model: "claude-sonnet-4-5-20250929",
    });
    const summary = tracker.getSummary();
    expect(summary.chatbot_estimated).toBeDefined();
    expect(summary.chatbot_estimated!.messages).toBe(45);
    expect(summary.chatbot_estimated!.usd_estimate).toBeGreaterThan(0);
  });

  it("calculates total cost across categories", () => {
    const tracker = new CostTracker();
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 10000,
      outputTokens: 2000,
    });
    tracker.recordDirectCall("judge", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 8000,
      outputTokens: 1200,
    });
    const summary = tracker.getSummary();
    expect(summary.total_usd).toBeGreaterThan(0);
    const expected = summary.persona_agent!.usd + summary.judge!.usd;
    expect(summary.total_usd).toBeCloseTo(expected, 4);
  });

  it("returns zero for empty tracker", () => {
    const tracker = new CostTracker();
    expect(tracker.getSummary().total_usd).toBe(0);
  });

  it("has model rates for Sonnet", () => {
    expect(MODEL_RATES["claude-sonnet-4-5-20250929"]).toBeDefined();
    expect(MODEL_RATES["claude-sonnet-4-5-20250929"]!.inputPerMillion).toBe(3);
    expect(MODEL_RATES["claude-sonnet-4-5-20250929"]!.outputPerMillion).toBe(15);
  });
});
