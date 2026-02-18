import Anthropic from "@anthropic-ai/sdk";
import type { Persona, ConversationTurn, EvaluationResult, Criterion } from "../personas/schema.js";
import { formatTranscript } from "./simulator.js";

export function buildJudgePrompt(
  persona: Persona,
  turns: ConversationTurn[],
  universalCriteria: Criterion[],
  personaCriteria: Criterion[],
): string {
  const transcript = formatTranscript(turns);

  const formatCriteria = (criteria: Criterion[]): string =>
    criteria.map((c) => {
      let line = `- **${c.name}** (${c.type}): ${c.description}`;
      if (c.type === "check" && c.hard_fail) line += " [HARD FAIL]";
      if (c.type === "range") line += ` Expected range: ${c.expected_min}-${c.expected_max}`;
      if (c.type === "count" && c.fail_threshold !== undefined) line += ` Fail threshold: ${c.fail_threshold}+`;
      return line;
    }).join("\n");

  return `You are evaluating a conversation between a chatbot website builder and a user. The user is a simulated persona with specific characteristics. Your job is to score the chatbot's performance against the criteria below.

## Persona Profile
${JSON.stringify(persona, null, 2)}

## Full Conversation Transcript
${transcript}

## Evaluation Criteria

### Universal Criteria
${formatCriteria(universalCriteria)}

### Persona-Specific Criteria
${formatCriteria(personaCriteria)}

## Instructions

For each criterion:
1. State the criterion name
2. Give a score (1-5 scale), boolean check, or count as specified by the criterion type
3. Provide 1-2 sentences of reasoning citing specific turn numbers
4. Flag any HARD FAIL conditions

Then provide:
- An overall quality score (1-5)
- The single most important improvement the chatbot could make for this persona type
- Whether this conversation would pass regression testing (yes/no with reasoning)

Call the submit_evaluation tool with your complete evaluation.`;
}

export function buildEvaluationTool(): Anthropic.Tool {
  return {
    name: "submit_evaluation",
    description: "Submit the complete evaluation of the conversation.",
    input_schema: {
      type: "object" as const,
      properties: {
        persona_id: { type: "string", description: "The persona ID" },
        universal_scores: {
          type: "object",
          description: "Scores for each universal criterion. Keys are criterion names.",
          additionalProperties: {
            type: "object",
            properties: {
              score: { type: "number", description: "Score 1-5" },
              reasoning: { type: "string", description: "1-2 sentences citing turn numbers" },
            },
            required: ["score", "reasoning"],
          },
        },
        persona_scores: {
          type: "object",
          description: "Scores for each persona-specific criterion. Keys are criterion names. Values have score (number), check (boolean), or count (number) depending on criterion type.",
          additionalProperties: {
            type: "object",
            properties: {
              score: { type: "number" },
              check: { type: "boolean" },
              count: { type: "number" },
              reasoning: { type: "string" },
            },
            required: ["reasoning"],
          },
        },
        hard_fails: {
          type: "array",
          items: { type: "string" },
          description: "List of hard-fail criterion names that were triggered",
        },
        overall_score: { type: "number", description: "Overall quality score 1-5" },
        top_improvement: { type: "string", description: "Single most important improvement" },
        regression_pass: { type: "boolean", description: "Would this pass regression testing?" },
        regression_reasoning: { type: "string", description: "Reasoning for regression pass/fail" },
      },
      required: [
        "persona_id", "universal_scores", "persona_scores",
        "hard_fails", "overall_score", "top_improvement",
        "regression_pass", "regression_reasoning",
      ],
    },
  };
}

export async function evaluateConversation(config: {
  persona: Persona;
  turns: ConversationTurn[];
  universalCriteria: Criterion[];
  personaCriteria: Criterion[];
  apiKey: string;
  model?: string;
}): Promise<EvaluationResult> {
  const { persona, turns, universalCriteria, personaCriteria, apiKey } = config;
  const model = config.model ?? "claude-opus-4-5-20250514";

  const client = new Anthropic({ apiKey });
  const prompt = buildJudgePrompt(persona, turns, universalCriteria, personaCriteria);
  const tool = buildEvaluationTool();

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_evaluation" },
  });

  const toolUseBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );

  if (!toolUseBlock) {
    throw new Error("Judge did not return a submit_evaluation tool call");
  }

  return toolUseBlock.input as unknown as EvaluationResult;
}
