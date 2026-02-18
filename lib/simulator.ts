import Anthropic from "@anthropic-ai/sdk";
import type { Persona, ConversationTurn, SiteSpec } from "../personas/schema.js";
import type { ChatbotClient } from "./chatbot-client.js";
import { PersonaAgent } from "./persona-agent.js";
import { calculateDensityScore } from "./density.js";

export interface SimulationConfig {
  persona: Persona;
  chatbotClient: ChatbotClient;
  apiKey: string;
  maxTurns?: number;
  personaModel?: string;
}

export interface SimulationResult {
  turns: ConversationTurn[];
  finalSpec: SiteSpec;
}

export function formatTranscript(turns: ConversationTurn[]): string {
  return turns
    .map((t) => `[Turn ${t.turn_number}] ${t.role}: ${t.content}`)
    .join("\n\n");
}

export async function simulateConversation(
  config: SimulationConfig,
): Promise<SimulationResult> {
  const { persona, chatbotClient, apiKey, maxTurns = 60 } = config;

  const personaAgent = new PersonaAgent({
    persona,
    apiKey,
    model: config.personaModel,
  });

  const turns: ConversationTurn[] = [];
  const chatbotHistory: Array<Anthropic.MessageParam> = [];
  const personaHistory: Array<Anthropic.MessageParam> = [];
  let turnNumber = 0;

  // Get initial chatbot greeting (send a minimal user message to start)
  chatbotHistory.push({ role: "user", content: "Hi" });
  turnNumber++;

  const greeting = await chatbotClient.sendMessage(chatbotHistory);
  turns.push({
    turn_number: turnNumber,
    role: "assistant",
    content: greeting.text,
    tool_calls: greeting.toolCalls.length > 0 ? greeting.toolCalls : undefined,
    fields_written: Object.keys(greeting.fieldsWritten).length > 0 ? greeting.fieldsWritten : undefined,
    density_score: calculateDensityScore(chatbotClient.getSpec()),
    timestamp: new Date().toISOString(),
  });
  chatbotHistory.push({ role: "assistant", content: greeting.text });
  // Persona sees the greeting as the first assistant message
  personaHistory.push({ role: "assistant", content: greeting.text });

  while (turnNumber < maxTurns) {
    // Persona responds
    turnNumber++;
    const userResponse = await personaAgent.respond(personaHistory);

    turns.push({
      turn_number: turnNumber,
      role: "user",
      content: userResponse,
      timestamp: new Date().toISOString(),
    });
    chatbotHistory.push({ role: "user", content: userResponse });
    personaHistory.push({ role: "user", content: userResponse });

    // Chatbot responds
    turnNumber++;
    const botResponse = await chatbotClient.sendMessage(chatbotHistory);

    const isConversationComplete = botResponse.toolCalls.some(
      (tc) => tc.name === "mark_step_complete" &&
        (tc.input as Record<string, unknown>).next_step === "complete",
    );

    turns.push({
      turn_number: turnNumber,
      role: "assistant",
      content: botResponse.text,
      tool_calls: botResponse.toolCalls.length > 0 ? botResponse.toolCalls : undefined,
      fields_written: Object.keys(botResponse.fieldsWritten).length > 0 ? botResponse.fieldsWritten : undefined,
      density_score: calculateDensityScore(chatbotClient.getSpec()),
      timestamp: new Date().toISOString(),
    });
    chatbotHistory.push({ role: "assistant", content: botResponse.text });
    personaHistory.push({ role: "assistant", content: botResponse.text });

    if (isConversationComplete) break;
  }

  return {
    turns,
    finalSpec: chatbotClient.getSpec(),
  };
}
