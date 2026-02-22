export type RunMode = "full-pipeline" | "build-only";
export type RunStep = "pending" | "chatting" | "evaluating" | "building" | "deploying" | "complete" | "error";

export interface PromptSelection {
  designSystem: string;          // variant name from manifest
  generatePage: string;          // variant name from manifest
  modelProvider?: string;        // "anthropic" | "openai"
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  providerApiKey?: string;       // OpenAI only, never persisted to disk
}

export interface RunConfig {
  id: string;
  mode: RunMode;
  personas: string[];
  promptConfig?: PromptSelection;
  promptConfigB?: PromptSelection;
  maxTurns: number;
  personaModel: string;
  judgeModel: string;
  skipEvaluation: boolean;
  skipBuild: boolean;
}

export interface RunProgress {
  runId: string;
  persona: string;
  step: RunStep;
  turn?: number;
  message?: { role: string; content: string };
  costSoFar?: number;
}

export interface PersonaRunResult {
  personaId: string;
  conversation: Array<{ turn: number; role: string; content: string; timestamp: string }>;
  siteSpec: Record<string, unknown> | null;
  evaluation: Record<string, unknown> | null;
  cost: Record<string, unknown>;
  previewUrl: string | null;
  error: string | null;
}

export interface RunResult {
  id: string;
  config: RunConfig;
  timestamp: string;
  personas: Record<string, PersonaRunResult>;
  totalCost: number;
}

export type ProgressCallback = (progress: RunProgress) => void;
