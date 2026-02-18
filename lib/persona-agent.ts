import Anthropic from "@anthropic-ai/sdk";
import type { Persona } from "../personas/schema.js";

export function buildPersonaSystemPrompt(persona: Persona): string {
  return `You are simulating a user interacting with a website builder chatbot.
You must stay in character as the following persona:

${JSON.stringify(persona, null, 2)}

RULES:
- Respond as this person would. Match their communication style, detail level, tone, and quirks exactly.
- Only share information from seed_data. Do not invent details.
- If seed_data has a value for something the chatbot asks about, share it — but in a way that matches the persona's style. Sparse Sarah says "Bristol" not "I'm based in Bristol, covering the greater Bristol area."
- If the chatbot asks about something in your gaps list, respond as the persona would — Sparse Sarah says "not yet", Nervous Nora says "sorry, I don't have any yet"
- Respond to the triggers defined in the persona. If a trigger condition is met, adjust your behaviour accordingly.
- Do not break character. Do not explain what you're doing. Just respond as the user.
- Keep responses natural. Real users don't answer in perfect JSON or bullet points.`;
}

export class PersonaAgent {
  private client: Anthropic;
  private systemPrompt: string;
  private model: string;

  constructor(config: { persona: Persona; apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.systemPrompt = buildPersonaSystemPrompt(config.persona);
    this.model = config.model ?? "claude-sonnet-4-5-20250929";
  }

  async respond(chatHistory: Array<Anthropic.MessageParam>): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: this.systemPrompt,
      messages: chatHistory,
    });

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return textBlocks.map((b) => b.text).join("\n");
  }
}
