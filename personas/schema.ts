// ---------------------------------------------------------------------------
// Persona definition (universal schema across all verticals)
// ---------------------------------------------------------------------------

export interface Persona {
  id: string;
  name: string;
  vertical: string;
  background: string;
  communication_style: {
    detail_level: "minimal" | "moderate" | "verbose";
    tone: "hesitant" | "neutral" | "confident" | "enthusiastic";
    typical_response_length: "1-5 words" | "1-2 sentences" | "paragraph";
    quirks: string[];
  };
  knowledge: {
    knows_about_their_field: "beginner" | "intermediate" | "expert";
    self_awareness: "low" | "medium" | "high";
    willingness_to_share: "reluctant" | "open" | "eager";
  };
  seed_data: Record<string, string>;
  gaps: string[];
  triggers: {
    will_elaborate_if: string[];
    will_shut_down_if: string[];
    will_skip_if: string[];
  };
}

// ---------------------------------------------------------------------------
// SiteSpec (mirrors BirthBuild's site_specs, harness-relevant fields only)
// ---------------------------------------------------------------------------

export interface ServiceItem {
  type: string;
  title: string;
  description: string;
  price: string;
  birth_types?: string[];
  format?: string;
  programme?: string;
  experience_level?: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  [key: string]: string | undefined;
}

export interface Testimonial {
  quote: string;
  name: string;
  context: string;
}

export interface SiteSpec {
  business_name: string | null;
  doula_name: string | null;
  tagline: string | null;
  service_area: string | null;
  primary_location: string | null;
  services: ServiceItem[];
  email: string | null;
  phone: string | null;
  booking_url: string | null;
  social_links: SocialLinks;
  bio: string | null;
  philosophy: string | null;
  bio_previous_career: string | null;
  bio_origin_story: string | null;
  training_year: string | null;
  additional_training: string[];
  client_perception: string | null;
  signature_story: string | null;
  testimonials: Testimonial[];
  faq_enabled: boolean;
  style: string | null;
  palette: string | null;
  typography: string | null;
  brand_feeling: string | null;
  style_inspiration_url: string | null;
  doula_uk: boolean;
  training_provider: string | null;
  pages: string[];
}

// ---------------------------------------------------------------------------
// LLM message types
// ---------------------------------------------------------------------------

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatbotResponse {
  text: string;
  toolCalls: ToolCall[];
  fieldsWritten: Record<string, unknown>;
  stopReason: string;
}

// ---------------------------------------------------------------------------
// Conversation turn (logged per turn)
// ---------------------------------------------------------------------------

export interface ConversationTurn {
  turn_number: number;
  role: "assistant" | "user";
  content: string;
  tool_calls?: ToolCall[];
  fields_written?: Record<string, unknown>;
  follow_up_triggered?: boolean;
  follow_up_topic?: string;
  density_score?: DensityResult;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Density scoring
// ---------------------------------------------------------------------------

export type DensityLevel = "low" | "medium" | "high" | "excellent";

export interface DensityResult {
  coreScore: number;
  depthScore: number;
  totalScore: number;
  percentage: number;
  level: DensityLevel;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Evaluation (judge output)
// ---------------------------------------------------------------------------

export interface CriterionScore {
  score: number;
  reasoning: string;
}

export interface CriterionCheck {
  check: boolean;
  reasoning: string;
}

export interface CriterionCount {
  count: number;
  reasoning: string;
}

export type PersonaScoreEntry = CriterionScore | CriterionCheck | CriterionCount;

export interface EvaluationResult {
  persona_id: string;
  universal_scores: Record<string, CriterionScore>;
  persona_scores: Record<string, PersonaScoreEntry>;
  hard_fails: string[];
  overall_score: number;
  top_improvement: string;
  regression_pass: boolean;
  regression_reasoning: string;
}

// ---------------------------------------------------------------------------
// Test run summary
// ---------------------------------------------------------------------------

export interface PersonaSummary {
  passed: boolean;
  overall_score: number;
  hard_fails: string[];
  density_score: DensityResult;
  total_turns: number;
  universal_scores: Record<string, number>;
  persona_scores: Record<string, number | boolean>;
  top_improvement: string;
}

export interface TestRunSummary {
  run_id: string;
  timestamp: string;
  prompt_version: string;
  model: string;
  personas: Record<string, PersonaSummary>;
  regression: {
    detected: boolean;
    details: string[];
  };
  overall_pass: boolean;
}

// ---------------------------------------------------------------------------
// Criteria definition (used by judge)
// ---------------------------------------------------------------------------

export interface ScoreCriterion {
  type: "score";
  name: string;
  description: string;
}

export interface CheckCriterion {
  type: "check";
  name: string;
  description: string;
  hard_fail?: boolean;
}

export interface CountCriterion {
  type: "count";
  name: string;
  description: string;
  fail_threshold?: number;
}

export interface RangeCriterion {
  type: "range";
  name: string;
  description: string;
  expected_min: number;
  expected_max: number;
}

export type Criterion = ScoreCriterion | CheckCriterion | CountCriterion | RangeCriterion;
