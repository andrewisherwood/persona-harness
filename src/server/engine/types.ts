export type RunMode = "full-pipeline" | "build-only";
export type RunStep = "pending" | "chatting" | "evaluating" | "building" | "deploying" | "complete" | "error";

export interface RunConfig {
  id: string;
  mode: RunMode;
  personas: string[];
  promptSource: string; // "production" or filename of local override
  promptSourceB?: string; // for A/B mode
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
