import Anthropic from "@anthropic-ai/sdk";
import { SpecAccumulator } from "./spec-accumulator.js";
import type { SiteSpec, ToolCall, ChatbotResponse } from "../personas/schema.js";

export interface ChatbotClientConfig {
  systemPrompt: string;
  tools: Anthropic.Tool[];
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface ChatbotClient {
  sendMessage(history: Array<Anthropic.MessageParam>): Promise<ChatbotResponse>;
  getSpec(): SiteSpec;
}

const MAX_TOOL_ITERATIONS = 5;

export class ModeBChatbotClient implements ChatbotClient {
  private client: Anthropic;
  private systemPrompt: string;
  private tools: Anthropic.Tool[];
  private model: string;
  private maxTokens: number;
  private accumulator: SpecAccumulator;

  constructor(config: ChatbotClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.systemPrompt = config.systemPrompt;
    this.tools = config.tools;
    this.model = config.model ?? "claude-sonnet-4-5-20250929";
    this.maxTokens = config.maxTokens ?? 1024;
    this.accumulator = new SpecAccumulator();
  }

  async sendMessage(history: Array<Anthropic.MessageParam>): Promise<ChatbotResponse> {
    const conversationMessages = [...history];
    const allToolCalls: ToolCall[] = [];
    const allFieldsWritten: Record<string, unknown> = {};
    let iterations = 0;
    let finalText = "";

    while (iterations <= MAX_TOOL_ITERATIONS) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        messages: conversationMessages,
        tools: this.tools,
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      finalText += textBlocks.map((b) => b.text).join("\n");

      for (const block of toolUseBlocks) {
        const toolCall: ToolCall = {
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
        allToolCalls.push(toolCall);

        const fields = this.accumulator.applyToolCall(block.name, block.input as Record<string, unknown>);
        if (fields) Object.assign(allFieldsWritten, fields);
      }

      if (response.stop_reason !== "tool_use") {
        return {
          text: finalText,
          toolCalls: allToolCalls,
          fieldsWritten: allFieldsWritten,
          stopReason: response.stop_reason ?? "end_turn",
        };
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((b) => ({
        type: "tool_result" as const,
        tool_use_id: b.id,
        content: "Saved successfully.",
      }));

      conversationMessages.push({ role: "assistant", content: response.content });
      conversationMessages.push({ role: "user", content: toolResults });

      iterations++;
    }

    return {
      text: finalText,
      toolCalls: allToolCalls,
      fieldsWritten: allFieldsWritten,
      stopReason: "max_tool_iterations",
    };
  }

  getSpec(): SiteSpec {
    return this.accumulator.getSpec();
  }
}
