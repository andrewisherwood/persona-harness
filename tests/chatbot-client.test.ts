import { describe, it, expect } from "vitest";
import { ModeBChatbotClient } from "../lib/chatbot-client.js";

describe("ModeBChatbotClient", () => {
  it("exposes getSpec() returning accumulated spec state", () => {
    const client = new ModeBChatbotClient({
      systemPrompt: "test prompt",
      tools: [],
      apiKey: "test-key",
    });
    const spec = client.getSpec();
    expect(spec.business_name).toBeNull();
    expect(spec.services).toEqual([]);
  });
});
