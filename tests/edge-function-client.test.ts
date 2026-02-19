import { describe, it, expect } from "vitest";
import {
  buildChatRequest,
  buildBuildRequest,
  EdgeFunctionClient,
  extractTextFromResponse,
  extractToolCalls,
  isConversationComplete,
} from "../src/server/engine/edge-function-client.js";
import type { ChatResponse } from "../src/server/engine/edge-function-client.js";

describe("edge-function-client", () => {
  describe("buildChatRequest", () => {
    it("wraps messages in the expected format", () => {
      const body = buildChatRequest([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);
      expect(body).toEqual({
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      });
    });
  });

  describe("buildBuildRequest", () => {
    it("includes site_spec_id and files", () => {
      const body = buildBuildRequest("spec-1", [{ path: "index.html", content: "<html>" }]);
      expect(body).toEqual({
        site_spec_id: "spec-1",
        files: [{ path: "index.html", content: "<html>" }],
      });
    });
  });

  describe("EdgeFunctionClient", () => {
    it("constructs endpoint URLs from base URL", () => {
      const client = new EdgeFunctionClient({
        supabaseUrl: "https://abc.supabase.co",
        authToken: "jwt-token",
      });
      expect(client.chatUrl).toBe("https://abc.supabase.co/functions/v1/chat");
      expect(client.buildUrl).toBe("https://abc.supabase.co/functions/v1/build");
      expect(client.publishUrl).toBe("https://abc.supabase.co/functions/v1/publish");
    });

    it("strips trailing slash from base URL", () => {
      const client = new EdgeFunctionClient({
        supabaseUrl: "https://abc.supabase.co/",
        authToken: "jwt-token",
      });
      expect(client.chatUrl).toBe("https://abc.supabase.co/functions/v1/chat");
    });
  });

  describe("extractTextFromResponse", () => {
    it("joins text blocks from response", () => {
      const response: ChatResponse = {
        content: [
          { type: "text", text: "Hello " },
          { type: "tool_use", name: "update_style", input: {} },
          { type: "text", text: "world" },
        ],
        stop_reason: "end_turn",
        model: "claude-sonnet-4-5-20250929",
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      expect(extractTextFromResponse(response)).toBe("Hello world");
    });

    it("returns empty string when no text blocks", () => {
      const response: ChatResponse = {
        content: [{ type: "tool_use", name: "foo", input: {} }],
        stop_reason: "tool_use",
        model: "claude-sonnet-4-5-20250929",
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      expect(extractTextFromResponse(response)).toBe("");
    });
  });

  describe("extractToolCalls", () => {
    it("extracts tool_use blocks", () => {
      const response: ChatResponse = {
        content: [
          { type: "text", text: "Hello" },
          { type: "tool_use", name: "update_style", id: "tc1", input: { style: "modern" } },
          { type: "tool_use", name: "mark_step_complete", id: "tc2", input: { next_step: "content" } },
        ],
        stop_reason: "tool_use",
        model: "claude-sonnet-4-5-20250929",
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      const tools = extractToolCalls(response);
      expect(tools).toHaveLength(2);
      expect(tools[0]!.name).toBe("update_style");
      expect(tools[1]!.name).toBe("mark_step_complete");
    });
  });

  describe("isConversationComplete", () => {
    it("returns true when mark_step_complete has next_step=complete", () => {
      const response: ChatResponse = {
        content: [
          { type: "text", text: "All done!" },
          { type: "tool_use", name: "mark_step_complete", id: "tc1", input: { completed_step: "review", next_step: "complete" } },
        ],
        stop_reason: "tool_use",
        model: "claude-sonnet-4-5-20250929",
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      expect(isConversationComplete(response)).toBe(true);
    });

    it("returns false when no mark_step_complete", () => {
      const response: ChatResponse = {
        content: [{ type: "text", text: "Tell me more" }],
        stop_reason: "end_turn",
        model: "claude-sonnet-4-5-20250929",
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      expect(isConversationComplete(response)).toBe(false);
    });

    it("returns false when next_step is not complete", () => {
      const response: ChatResponse = {
        content: [
          { type: "tool_use", name: "mark_step_complete", id: "tc1", input: { completed_step: "basics", next_step: "style" } },
        ],
        stop_reason: "tool_use",
        model: "claude-sonnet-4-5-20250929",
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      expect(isConversationComplete(response)).toBe(false);
    });
  });
});
