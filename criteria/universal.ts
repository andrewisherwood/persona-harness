import type { ScoreCriterion } from "../personas/schema.js";

export const UNIVERSAL_CRITERIA: ScoreCriterion[] = [
  { type: "score", name: "completion", description: "Did the conversation reach the build/review stage?" },
  { type: "score", name: "follow_up_appropriateness", description: "Were follow-ups triggered at the right moments and avoided when unnecessary?" },
  { type: "score", name: "redundancy_avoidance", description: "Did the chatbot avoid asking for information the user had already provided?" },
  { type: "score", name: "opt_out_respect", description: "When the user signalled they wanted to skip or move on, did the chatbot respect that?" },
  { type: "score", name: "tone_consistency", description: "Did the chatbot maintain an appropriate, warm tone throughout?" },
  { type: "score", name: "payoff_signals", description: "Did the chatbot explain why specific details matter when they were provided?" },
  { type: "score", name: "conversation_naturalness", description: "Did the conversation feel like a natural chat or like a form with extra steps?" },
];
