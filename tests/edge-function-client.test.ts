import { describe, it, expect } from "vitest";
import { buildChatRequest, buildBuildRequest, EdgeFunctionClient } from "../src/server/engine/edge-function-client.js";

describe("edge-function-client", () => {
  describe("buildChatRequest", () => {
    it("builds a chat request body with correct field names", () => {
      const body = buildChatRequest({
        siteSpecId: "spec-1",
        message: "Hello",
        chatHistory: [{ role: "user", content: "Hi" }],
      });
      expect(body).toEqual({
        site_spec_id: "spec-1",
        message: "Hello",
        chat_history: [{ role: "user", content: "Hi" }],
      });
    });

    it("handles empty chat history", () => {
      const body = buildChatRequest({ siteSpecId: "spec-1", message: "Hi", chatHistory: [] });
      expect(body.chat_history).toEqual([]);
    });
  });

  describe("buildBuildRequest", () => {
    it("builds a build request body", () => {
      const body = buildBuildRequest({ siteSpecId: "spec-1" });
      expect(body).toEqual({ site_spec_id: "spec-1" });
    });
  });

  describe("EdgeFunctionClient", () => {
    it("constructs endpoint URLs from base URL", () => {
      const client = new EdgeFunctionClient({
        supabaseUrl: "https://abc.supabase.co",
        anonKey: "key-123",
      });
      expect(client.chatUrl).toBe("https://abc.supabase.co/functions/v1/chat");
      expect(client.buildUrl).toBe("https://abc.supabase.co/functions/v1/build");
      expect(client.publishUrl).toBe("https://abc.supabase.co/functions/v1/publish");
    });

    it("strips trailing slash from base URL", () => {
      const client = new EdgeFunctionClient({
        supabaseUrl: "https://abc.supabase.co/",
        anonKey: "key-123",
      });
      expect(client.chatUrl).toBe("https://abc.supabase.co/functions/v1/chat");
    });
  });
});
