# Persona Testing Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an automated conversation testing harness that simulates different user personas against a chatbot, evaluates the conversations with an LLM judge, and reports quality scores with regression detection.

**Architecture:** Modular Node.js/TypeScript CLI with three LLM roles (persona simulator on Sonnet, target chatbot on Sonnet, judge evaluator on Opus). Mode B only (isolated prompt, no Supabase). In-memory spec accumulation with density scoring adapted from BirthBuild.

**Tech Stack:** Node.js, TypeScript (strict), Anthropic SDK (`@anthropic-ai/sdk`), Commander (CLI), chalk (output formatting), vitest (testing)

**Design doc:** `docs/plans/2026-02-18-persona-harness-design.md`
**Scoping doc:** `SCOPING-PERSONA-HARNESS.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `CLAUDE.md`

**Step 1: Initialize project**

```bash
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk commander chalk@4
npm install -D typescript tsx vitest @types/node
```

Note: chalk@4 for CJS compatibility with tsx. chalk@5 is ESM-only.

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", "runs"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
runs/
.env
*.tsbuildinfo
```

**Step 5: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Step 6: Create CLAUDE.md**

Write the project conventions file. Content specified in Task 2.

**Step 7: Update package.json scripts**

Add to package.json:
```json
{
  "scripts": {
    "harness": "tsx run.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example CLAUDE.md docs/
git commit -m "feat: scaffold persona-harness project"
```

---

## Task 2: CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write CLAUDE.md**

```markdown
# Persona Testing Harness

Automated conversation testing harness for Dopamine Labs chatbot products. Simulates user personas against a chatbot, evaluates conversations with an LLM judge, and reports quality scores with regression detection.

## Tech Stack

- **Runtime:** Node.js + TypeScript (strict mode)
- **LLM:** Anthropic Claude via `@anthropic-ai/sdk`
- **CLI:** Commander
- **Testing:** Vitest
- **Output:** chalk@4 for coloured terminal output

## Project Structure

```
persona-harness/
├── personas/           # Persona type definitions + JSON persona files
│   ├── schema.ts       # Persona, SiteSpec, ConversationTurn, EvaluationResult types
│   └── birthbuild/     # BirthBuild vertical personas (JSON)
├── criteria/           # Evaluation criteria definitions
│   ├── universal.ts    # 7 universal criteria (all personas)
│   └── birthbuild/     # Per-persona criteria with hard-fail checks
├── prompts/            # Extracted system prompts + tool definitions
│   └── birthbuild/     # system-prompt.md + tools.json
├── lib/                # Core modules
│   ├── simulator.ts    # Conversation loop orchestration
│   ├── persona-agent.ts # LLM-as-user (Sonnet)
│   ├── chatbot-client.ts # ChatbotClient interface + Mode B impl
│   ├── spec-accumulator.ts # In-memory SiteSpec + tool call mapping
│   ├── judge.ts        # LLM-as-judge evaluator (Opus)
│   ├── density.ts      # Density scoring (adapted from BirthBuild)
│   ├── reporter.ts     # JSON + markdown report generation
│   └── regression.ts   # Run-to-run diff + regression detection
├── runs/               # Output directory (gitignored)
├── run.ts              # CLI entry point
└── tests/              # Vitest test files
```

## Commands

```bash
npm run harness -- run --vertical birthbuild --prompt ./prompts/birthbuild/system-prompt.md --tools ./prompts/birthbuild/tools.json
npm run harness -- run --persona sparse-sarah --prompt ... --tools ...
npm run harness -- diff <run1> <run2>
npm run harness -- report <run-dir>
npm test                # run all tests
npm run typecheck       # type check without emitting
```

## Coding Standards

- TypeScript strict mode, no `any`
- Named exports only (no default exports)
- Functional style preferred; classes only for stateful modules (SpecAccumulator)
- All LLM calls go through the Anthropic SDK, never raw fetch
- British English in user-facing strings (colour, organisation)
- Error handling: throw typed errors, catch at CLI boundary
- All file I/O uses absolute paths resolved from project root

## Architecture Patterns

- **ChatbotClient interface** — abstraction over how we talk to the chatbot. Mode B (direct Claude API) is the only implementation now. Mode A (live Supabase endpoint) can be added later as a new class.
- **SpecAccumulator** — maintains an in-memory SiteSpec. Tool calls from the chatbot are mapped to spec field updates using the same logic as BirthBuild's `mapToolCallToSpecUpdate`. Exposes `getSpec()` for density scoring at any point.
- **Persona agent isolation** — the persona simulator only sees chatbot text responses. Tool calls, tool results, and system prompts are invisible, matching a real user's experience.
- **Tool-use loop** — Mode B mirrors BirthBuild's edge function: when Claude returns `stop_reason === "tool_use"`, apply tool calls to SpecAccumulator, return tool_result messages, continue until text is produced. Max 5 iterations.
- **Structured judge output** — the judge is forced to return structured JSON by defining a `submit_evaluation` tool that it must call.

## Three LLM Roles

| Role | Model | Purpose |
|------|-------|---------|
| Persona Simulator | claude-sonnet-4-5-20250929 | Acts as the user |
| Target Chatbot | claude-sonnet-4-5-20250929 | System under test |
| Judge Evaluator | claude-opus-4-5-20250514 | Scores conversations |

## Key Constraints

- Persona agent NEVER sees the chatbot's system prompt or tool calls
- Max 60 conversation turns per simulation
- Max 5 tool-use loop iterations per chatbot response
- Judge uses a single `submit_evaluation` tool for structured output
- Runs are stored as timestamped directories under `runs/`
- Regression detection compares against the most recent previous run
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md project conventions"
```

---

## Task 3: Type Definitions

**Files:**
- Create: `personas/schema.ts`
- Test: `tests/schema.test.ts`

**Step 1: Write the test**

```typescript
// tests/schema.test.ts
import { describe, it, expect } from "vitest";
import type {
  Persona,
  SiteSpec,
  ConversationTurn,
  EvaluationResult,
  DensityResult,
  Message,
  ChatbotResponse,
} from "../personas/schema.js";

describe("schema types", () => {
  it("creates a valid Persona", () => {
    const persona: Persona = {
      id: "test-persona",
      name: "Test Persona",
      vertical: "birthbuild",
      background: "A test persona",
      communication_style: {
        detail_level: "minimal",
        tone: "neutral",
        typical_response_length: "1-2 sentences",
        quirks: [],
      },
      knowledge: {
        knows_about_their_field: "beginner",
        self_awareness: "low",
        willingness_to_share: "open",
      },
      seed_data: { business_name: "Test Business" },
      gaps: ["testimonials"],
      triggers: {
        will_elaborate_if: [],
        will_shut_down_if: [],
        will_skip_if: [],
      },
    };
    expect(persona.id).toBe("test-persona");
  });

  it("creates an empty SiteSpec", () => {
    const spec: SiteSpec = {
      business_name: null,
      doula_name: null,
      tagline: null,
      service_area: null,
      primary_location: null,
      services: [],
      email: null,
      phone: null,
      booking_url: null,
      social_links: {},
      bio: null,
      philosophy: null,
      bio_previous_career: null,
      bio_origin_story: null,
      training_year: null,
      additional_training: [],
      client_perception: null,
      signature_story: null,
      testimonials: [],
      faq_enabled: false,
      style: null,
      palette: null,
      typography: null,
      brand_feeling: null,
      style_inspiration_url: null,
      doula_uk: false,
      training_provider: null,
      pages: [],
    };
    expect(spec.business_name).toBeNull();
    expect(spec.services).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — module not found

**Step 3: Write personas/schema.ts**

```typescript
// personas/schema.ts

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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add personas/schema.ts tests/schema.test.ts
git commit -m "feat: add type definitions for persona, site spec, evaluation"
```

---

## Task 4: Persona Data Files

**Files:**
- Create: `personas/birthbuild/sparse-sarah.json`
- Create: `personas/birthbuild/detailed-dina.json`
- Create: `personas/birthbuild/nervous-nora.json`
- Test: `tests/personas.test.ts`

**Step 1: Write the test**

```typescript
// tests/personas.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { Persona } from "../personas/schema.js";

const PERSONAS_DIR = join(__dirname, "..", "personas", "birthbuild");

function loadPersona(filename: string): Persona {
  const raw = readFileSync(join(PERSONAS_DIR, filename), "utf-8");
  return JSON.parse(raw) as Persona;
}

describe("birthbuild personas", () => {
  const files = ["sparse-sarah.json", "detailed-dina.json", "nervous-nora.json"];

  for (const file of files) {
    describe(file, () => {
      it("is valid JSON matching Persona schema", () => {
        const persona = loadPersona(file);
        expect(persona.id).toBeTruthy();
        expect(persona.name).toBeTruthy();
        expect(persona.vertical).toBe("birthbuild");
        expect(persona.background).toBeTruthy();
        expect(persona.communication_style).toBeDefined();
        expect(persona.communication_style.detail_level).toMatch(
          /^(minimal|moderate|verbose)$/
        );
        expect(persona.knowledge).toBeDefined();
        expect(persona.seed_data).toBeDefined();
        expect(Array.isArray(persona.gaps)).toBe(true);
        expect(persona.triggers).toBeDefined();
      });

      it("has seed_data with at least business_name", () => {
        const persona = loadPersona(file);
        expect(persona.seed_data.business_name).toBeTruthy();
      });
    });
  }
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/personas.test.ts`
Expected: FAIL — files don't exist

**Step 3: Create the three persona JSON files**

Copy the persona JSON objects directly from `SCOPING-PERSONA-HARNESS.md` sections 3.2 into:
- `personas/birthbuild/sparse-sarah.json`
- `personas/birthbuild/detailed-dina.json`
- `personas/birthbuild/nervous-nora.json`

These are the exact JSON blocks from the scoping doc (lines 127-160, 168-215, 225-261).

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/personas.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add personas/birthbuild/ tests/personas.test.ts
git commit -m "feat: add BirthBuild persona definitions"
```

---

## Task 5: Extracted Prompts + Tool Definitions

**Files:**
- Create: `prompts/birthbuild/system-prompt.md`
- Create: `prompts/birthbuild/tools.json`

**Step 1: Extract system prompt**

Copy the `SYSTEM_PROMPT` string from `/Users/andrew/Documents/DopamineLaboratory/Apps/BirthBuild/supabase/functions/chat/index.ts` (lines 30-159) into `prompts/birthbuild/system-prompt.md` as raw text (no code fences, no escaping — just the prompt content).

**Step 2: Extract tool definitions**

Copy the `CHAT_TOOLS` array from the same edge function (lines 165-466) and convert it to a JSON array in `prompts/birthbuild/tools.json`. This is the array of tool definition objects with `name`, `description`, and `input_schema` fields.

**Step 3: Commit**

```bash
git add prompts/birthbuild/
git commit -m "feat: extract BirthBuild system prompt and tool definitions"
```

---

## Task 6: Spec Accumulator

**Files:**
- Create: `lib/spec-accumulator.ts`
- Test: `tests/spec-accumulator.test.ts`

**Step 1: Write the test**

```typescript
// tests/spec-accumulator.test.ts
import { describe, it, expect } from "vitest";
import { SpecAccumulator } from "../lib/spec-accumulator.js";

describe("SpecAccumulator", () => {
  it("starts with an empty spec", () => {
    const acc = new SpecAccumulator();
    const spec = acc.getSpec();
    expect(spec.business_name).toBeNull();
    expect(spec.services).toEqual([]);
    expect(spec.testimonials).toEqual([]);
  });

  it("applies update_business_info tool call", () => {
    const acc = new SpecAccumulator();
    const fields = acc.applyToolCall("update_business_info", {
      business_name: "Sarah's Doula Services",
      doula_name: "Sarah Mitchell",
      primary_location: "Bristol",
    });
    expect(acc.getSpec().business_name).toBe("Sarah's Doula Services");
    expect(acc.getSpec().doula_name).toBe("Sarah Mitchell");
    expect(acc.getSpec().primary_location).toBe("Bristol");
    expect(fields).toEqual({
      business_name: "Sarah's Doula Services",
      doula_name: "Sarah Mitchell",
      primary_location: "Bristol",
    });
  });

  it("applies update_style tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_style", {
      style: "modern",
      palette: "sage_sand",
      brand_feeling: "warm and earthy",
    });
    expect(acc.getSpec().style).toBe("modern");
    expect(acc.getSpec().palette).toBe("sage_sand");
    expect(acc.getSpec().brand_feeling).toBe("warm and earthy");
  });

  it("applies update_content tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_content", {
      bio: "A great bio",
      testimonials: [{ quote: "Amazing", name: "Emma", context: "birth" }],
    });
    expect(acc.getSpec().bio).toBe("A great bio");
    expect(acc.getSpec().testimonials).toHaveLength(1);
  });

  it("applies update_bio_depth tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_bio_depth", {
      bio_previous_career: "nurse",
      additional_training: ["spinning babies", "rebozo"],
    });
    expect(acc.getSpec().bio_previous_career).toBe("nurse");
    expect(acc.getSpec().additional_training).toEqual(["spinning babies", "rebozo"]);
  });

  it("applies update_contact tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_contact", {
      email: "test@test.com",
      social_links: { instagram: "insta.com/test" },
    });
    expect(acc.getSpec().email).toBe("test@test.com");
    expect(acc.getSpec().social_links.instagram).toBe("insta.com/test");
  });

  it("applies update_pages tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_pages", {
      pages: ["home", "about", "contact"],
    });
    expect(acc.getSpec().pages).toEqual(["home", "about", "contact"]);
  });

  it("returns null for non-spec tools", () => {
    const acc = new SpecAccumulator();
    const fields = acc.applyToolCall("mark_step_complete", {
      completed_step: "welcome",
      next_step: "basics",
    });
    expect(fields).toBeNull();
  });

  it("returns null for generate_content", () => {
    const acc = new SpecAccumulator();
    const fields = acc.applyToolCall("generate_content", {
      field: "bio",
      context: "some context",
    });
    expect(fields).toBeNull();
  });

  it("accumulates across multiple tool calls", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_business_info", { business_name: "Test" });
    acc.applyToolCall("update_contact", { email: "a@b.com" });
    acc.applyToolCall("update_style", { style: "minimal" });
    const spec = acc.getSpec();
    expect(spec.business_name).toBe("Test");
    expect(spec.email).toBe("a@b.com");
    expect(spec.style).toBe("minimal");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/spec-accumulator.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/spec-accumulator.ts**

Adapt the `mapToolCallToSpecUpdate` logic from BirthBuild's `src/lib/chat-tools.ts`. The SpecAccumulator class maintains an in-memory SiteSpec and applies tool call updates.

```typescript
// lib/spec-accumulator.ts
import type { SiteSpec, ServiceItem, SocialLinks } from "../personas/schema.js";

export function createEmptySpec(): SiteSpec {
  return {
    business_name: null,
    doula_name: null,
    tagline: null,
    service_area: null,
    primary_location: null,
    services: [],
    email: null,
    phone: null,
    booking_url: null,
    social_links: {},
    bio: null,
    philosophy: null,
    bio_previous_career: null,
    bio_origin_story: null,
    training_year: null,
    additional_training: [],
    client_perception: null,
    signature_story: null,
    testimonials: [],
    faq_enabled: false,
    style: null,
    palette: null,
    typography: null,
    brand_feeling: null,
    style_inspiration_url: null,
    doula_uk: false,
    training_provider: null,
    pages: [],
  };
}

function mapToolCallToSpecUpdate(
  toolName: string,
  toolArgs: Record<string, unknown>,
): Partial<SiteSpec> | null {
  switch (toolName) {
    case "update_business_info": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.business_name === "string") update.business_name = toolArgs.business_name;
      if (typeof toolArgs.doula_name === "string") update.doula_name = toolArgs.doula_name;
      if (typeof toolArgs.primary_location === "string") update.primary_location = toolArgs.primary_location;
      if (typeof toolArgs.service_area === "string") update.service_area = toolArgs.service_area;
      if (Array.isArray(toolArgs.services)) update.services = toolArgs.services as ServiceItem[];
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_style": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.style === "string") update.style = toolArgs.style;
      if (typeof toolArgs.palette === "string") update.palette = toolArgs.palette;
      if (typeof toolArgs.typography === "string") update.typography = toolArgs.typography;
      if (typeof toolArgs.brand_feeling === "string") update.brand_feeling = toolArgs.brand_feeling;
      if (typeof toolArgs.style_inspiration_url === "string") update.style_inspiration_url = toolArgs.style_inspiration_url;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_content": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.bio === "string") update.bio = toolArgs.bio;
      if (typeof toolArgs.tagline === "string") update.tagline = toolArgs.tagline;
      if (typeof toolArgs.philosophy === "string") update.philosophy = toolArgs.philosophy;
      if (Array.isArray(toolArgs.testimonials)) update.testimonials = toolArgs.testimonials as SiteSpec["testimonials"];
      if (typeof toolArgs.faq_enabled === "boolean") update.faq_enabled = toolArgs.faq_enabled;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_bio_depth": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.bio_previous_career === "string") update.bio_previous_career = toolArgs.bio_previous_career;
      if (typeof toolArgs.bio_origin_story === "string") update.bio_origin_story = toolArgs.bio_origin_story;
      if (typeof toolArgs.training_year === "string") update.training_year = toolArgs.training_year;
      if (Array.isArray(toolArgs.additional_training)) update.additional_training = toolArgs.additional_training as string[];
      if (typeof toolArgs.client_perception === "string") update.client_perception = toolArgs.client_perception;
      if (typeof toolArgs.signature_story === "string") update.signature_story = toolArgs.signature_story;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_contact": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.email === "string") update.email = toolArgs.email;
      if (typeof toolArgs.phone === "string") update.phone = toolArgs.phone;
      if (typeof toolArgs.booking_url === "string") update.booking_url = toolArgs.booking_url;
      if (typeof toolArgs.social_links === "object" && toolArgs.social_links !== null) update.social_links = toolArgs.social_links as SocialLinks;
      if (typeof toolArgs.doula_uk === "boolean") update.doula_uk = toolArgs.doula_uk;
      if (typeof toolArgs.training_provider === "string") update.training_provider = toolArgs.training_provider;
      if (typeof toolArgs.training_year === "string") update.training_year = toolArgs.training_year;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_pages": {
      if (Array.isArray(toolArgs.pages)) return { pages: toolArgs.pages as string[] };
      return null;
    }
    case "generate_content":
    case "mark_step_complete":
    case "trigger_photo_upload":
      return null;
    default:
      return null;
  }
}

export class SpecAccumulator {
  private spec: SiteSpec;

  constructor() {
    this.spec = createEmptySpec();
  }

  applyToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const update = mapToolCallToSpecUpdate(toolName, toolArgs);
    if (!update) return null;
    Object.assign(this.spec, update);
    return update as Record<string, unknown>;
  }

  getSpec(): SiteSpec {
    return { ...this.spec };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/spec-accumulator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/spec-accumulator.ts tests/spec-accumulator.test.ts
git commit -m "feat: add SpecAccumulator with tool call mapping"
```

---

## Task 7: Density Scoring

**Files:**
- Create: `lib/density.ts`
- Test: `tests/density.test.ts`

**Step 1: Write the test**

```typescript
// tests/density.test.ts
import { describe, it, expect } from "vitest";
import { calculateDensityScore } from "../lib/density.js";
import { createEmptySpec } from "../lib/spec-accumulator.js";

describe("calculateDensityScore", () => {
  it("returns 0 for empty spec", () => {
    const result = calculateDensityScore(createEmptySpec());
    expect(result.totalScore).toBe(0);
    expect(result.level).toBe("low");
  });

  it("scores core fields correctly", () => {
    const spec = {
      ...createEmptySpec(),
      business_name: "Test",
      doula_name: "Test Person",
      service_area: "Brighton",
      services: [{ type: "birth-support", title: "Birth Doula", description: "Support", price: "£500" }],
      email: "test@test.com",
      style: "modern",
      palette: "sage_sand",
      bio: "A bio about me",
    };
    const result = calculateDensityScore(spec);
    expect(result.coreScore).toBe(8);
  });

  it("scores depth fields correctly", () => {
    const spec = {
      ...createEmptySpec(),
      primary_location: "Brighton",
      service_area: "Brighton, Hove, Lewes",
      philosophy: "Evidence-based",
      training_provider: "Doula UK",
      training_year: "2020",
      brand_feeling: "warm",
    };
    const result = calculateDensityScore(spec);
    expect(result.depthScore).toBeGreaterThanOrEqual(5);
  });

  it("returns 'excellent' for high score", () => {
    const spec = {
      ...createEmptySpec(),
      business_name: "Dina Hart Birth Services",
      doula_name: "Dina Hart",
      service_area: "Brighton, Hove, Lewes, Worthing",
      services: [{
        type: "birth-support",
        title: "Birth Doula",
        description: "Full support",
        price: "£800",
        birth_types: ["home", "hospital", "vbac"],
        experience_level: "100+",
      }],
      email: "dina@test.com",
      style: "classic",
      palette: "deep_earth",
      bio: "Experienced doula",
      primary_location: "Brighton",
      bio_origin_story: "Had a transformative birth",
      philosophy: "Evidence-based informed choice",
      training_provider: "Developing Doulas",
      training_year: "2018",
      additional_training: ["spinning babies", "rebozo"],
      testimonials: [{ quote: "Amazing", name: "Emma R.", context: "home birth" }],
      brand_feeling: "warm, professional",
      social_links: { instagram: "insta.com/dina" },
      phone: "07700 900123",
      booking_url: "https://calendly.com/dina",
      client_perception: "calm and prepared",
      signature_story: "A memorable birth story",
    };
    const result = calculateDensityScore(spec);
    expect(result.level).toBe("excellent");
    expect(result.totalScore).toBeGreaterThanOrEqual(21);
  });

  it("returns suggestions for missing fields", () => {
    const spec = createEmptySpec();
    const result = calculateDensityScore(spec);
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/density.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/density.ts**

Adapt directly from BirthBuild's `src/lib/density-score.ts`. Replace the `import type { SiteSpec }` with the harness's own type.

```typescript
// lib/density.ts
import type { SiteSpec, DensityLevel, DensityResult } from "../personas/schema.js";

const MAX_CORE = 8;
const MAX_DEPTH = 17;
const MAX_TOTAL = MAX_CORE + MAX_DEPTH;

function getLevelForScore(score: number): DensityLevel {
  if (score >= 21) return "excellent";
  if (score >= 16) return "high";
  if (score >= 9) return "medium";
  return "low";
}

export function calculateDensityScore(spec: SiteSpec): DensityResult {
  let coreScore = 0;
  let depthScore = 0;

  // Core fields (8 points)
  if (spec.business_name) coreScore++;
  if (spec.doula_name) coreScore++;
  if (spec.service_area) coreScore++;
  if (spec.services && spec.services.length > 0) coreScore++;
  if (spec.email) coreScore++;
  if (spec.style) coreScore++;
  if (spec.palette) coreScore++;
  if (spec.bio) coreScore++;

  // Depth fields (17 points)
  if (spec.primary_location) depthScore++;
  if (spec.service_area) {
    const areas = spec.service_area.split(",").map((a) => a.trim()).filter(Boolean);
    if (areas.length >= 3) depthScore++;
  }
  if (spec.services?.some((s) => Array.isArray(s.birth_types) && s.birth_types.length > 0)) depthScore++;
  if (spec.services?.some((s) => s.experience_level)) depthScore++;
  if (spec.bio_origin_story) depthScore++;
  if (spec.philosophy) depthScore++;
  if (spec.training_provider) depthScore++;
  if (spec.training_year) depthScore++;
  if (spec.additional_training && spec.additional_training.length > 0) depthScore++;
  if (spec.testimonials && spec.testimonials.length > 0) depthScore++;
  if (spec.testimonials?.some((t) => t.name && t.context)) depthScore++;
  if (spec.brand_feeling) depthScore++;
  if (spec.social_links) {
    const hasAny = Object.values(spec.social_links).some((v) => typeof v === "string" && v.length > 0);
    if (hasAny) depthScore++;
  }
  if (spec.phone) depthScore++;
  if (spec.booking_url) depthScore++;
  if (spec.client_perception) depthScore++;
  if (spec.signature_story) depthScore++;

  const totalScore = coreScore + depthScore;
  const percentage = Math.round((totalScore / MAX_TOTAL) * 100);
  const level = getLevelForScore(totalScore);

  const suggestions: string[] = [];
  if (!spec.bio_origin_story && suggestions.length < 3) suggestions.push("Add an origin story for a more personal About page.");
  if ((!spec.testimonials || spec.testimonials.length === 0) && suggestions.length < 3) suggestions.push("Add a client testimonial to build trust.");
  if (!spec.philosophy && suggestions.length < 3) suggestions.push("Describe your philosophy or approach.");
  if (!spec.primary_location && suggestions.length < 3) suggestions.push("Add your primary location.");
  if (!spec.training_provider && suggestions.length < 3) suggestions.push("Mention your training provider.");
  if (!spec.brand_feeling && suggestions.length < 3) suggestions.push("Describe the feeling you want your site to give.");
  if (!spec.client_perception && suggestions.length < 3) suggestions.push("Share what clients say about you most often.");
  if ((!spec.additional_training || spec.additional_training.length === 0) && suggestions.length < 3) suggestions.push("List any additional training or CPD.");
  if (!spec.signature_story && suggestions.length < 3) suggestions.push("Share a memorable birth story.");
  if (!spec.booking_url && suggestions.length < 3) suggestions.push("Add a booking link.");

  return { coreScore, depthScore, totalScore, percentage, level, suggestions: suggestions.slice(0, 3) };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/density.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/density.ts tests/density.test.ts
git commit -m "feat: add density scoring adapted from BirthBuild"
```

---

## Task 8: Chatbot Client (Mode B)

**Files:**
- Create: `lib/chatbot-client.ts`
- Test: `tests/chatbot-client.test.ts`

**Step 1: Write the test**

Test the interface and the tool-use loop logic. Mock the Anthropic SDK.

```typescript
// tests/chatbot-client.test.ts
import { describe, it, expect, vi } from "vitest";
import { ModeBChatbotClient } from "../lib/chatbot-client.js";

// We test the tool-use loop logic by verifying:
// 1. Text-only responses pass through correctly
// 2. Tool-use responses trigger spec accumulation and loop

describe("ModeBChatbotClient", () => {
  it("exposes getSpec() returning accumulated spec state", () => {
    const client = new ModeBChatbotClient({
      systemPrompt: "test prompt",
      tools: [],
      apiKey: "test-key",
    });
    const spec = client.getSpec();
    expect(spec.business_name).toBeNull();
  });
});
```

Note: Full integration testing of the LLM calls happens in end-to-end runs. Unit tests verify the structural logic.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chatbot-client.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/chatbot-client.ts**

```typescript
// lib/chatbot-client.ts
import Anthropic from "@anthropic-ai/sdk";
import { SpecAccumulator } from "./spec-accumulator.js";
import type { SiteSpec, ToolCall, ChatbotResponse, ContentBlock } from "../personas/schema.js";

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

      // Extract text and tool_use blocks
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      finalText += textBlocks.map((b) => b.text).join("\n");

      // Process tool calls
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

      // If no tool use, we're done
      if (response.stop_reason !== "tool_use") {
        return {
          text: finalText,
          toolCalls: allToolCalls,
          fieldsWritten: allFieldsWritten,
          stopReason: response.stop_reason ?? "end_turn",
        };
      }

      // Build tool_result messages and continue the loop
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/chatbot-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/chatbot-client.ts tests/chatbot-client.test.ts
git commit -m "feat: add Mode B chatbot client with tool-use loop"
```

---

## Task 9: Persona Agent

**Files:**
- Create: `lib/persona-agent.ts`
- Test: `tests/persona-agent.test.ts`

**Step 1: Write the test**

```typescript
// tests/persona-agent.test.ts
import { describe, it, expect } from "vitest";
import { buildPersonaSystemPrompt } from "../lib/persona-agent.js";

describe("buildPersonaSystemPrompt", () => {
  it("includes persona JSON in the prompt", () => {
    const persona = {
      id: "test",
      name: "Test",
      vertical: "birthbuild",
      background: "A test",
      communication_style: { detail_level: "minimal" as const, tone: "neutral" as const, typical_response_length: "1-2 sentences" as const, quirks: [] },
      knowledge: { knows_about_their_field: "beginner" as const, self_awareness: "low" as const, willingness_to_share: "open" as const },
      seed_data: { business_name: "Test" },
      gaps: [],
      triggers: { will_elaborate_if: [], will_shut_down_if: [], will_skip_if: [] },
    };
    const prompt = buildPersonaSystemPrompt(persona);
    expect(prompt).toContain("Test");
    expect(prompt).toContain("seed_data");
    expect(prompt).toContain("Do not break character");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/persona-agent.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/persona-agent.ts**

```typescript
// lib/persona-agent.ts
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
  private persona: Persona;
  private systemPrompt: string;
  private model: string;

  constructor(config: { persona: Persona; apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.persona = config.persona;
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
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    return textBlocks.map((b) => b.text).join("\n");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/persona-agent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/persona-agent.ts tests/persona-agent.test.ts
git commit -m "feat: add persona agent (LLM-as-user simulator)"
```

---

## Task 10: Simulator (Conversation Loop)

**Files:**
- Create: `lib/simulator.ts`
- Test: `tests/simulator.test.ts`

**Step 1: Write the test**

```typescript
// tests/simulator.test.ts
import { describe, it, expect } from "vitest";
import { formatTranscript } from "../lib/simulator.js";
import type { ConversationTurn } from "../personas/schema.js";

describe("formatTranscript", () => {
  it("formats turns into readable text", () => {
    const turns: ConversationTurn[] = [
      { turn_number: 1, role: "assistant", content: "Hello!", timestamp: "2026-02-18T14:00:00Z" },
      { turn_number: 2, role: "user", content: "Hi", timestamp: "2026-02-18T14:00:01Z" },
    ];
    const text = formatTranscript(turns);
    expect(text).toContain("[Turn 1] assistant:");
    expect(text).toContain("Hello!");
    expect(text).toContain("[Turn 2] user:");
    expect(text).toContain("Hi");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/simulator.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/simulator.ts**

```typescript
// lib/simulator.ts
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

  // Get initial chatbot greeting
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

    const isStepComplete = botResponse.toolCalls.some(
      (tc) => tc.name === "mark_step_complete" && (tc.input as Record<string, unknown>).next_step === "complete"
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

    // Check for conversation end
    if (isStepComplete) break;
  }

  return {
    turns,
    finalSpec: chatbotClient.getSpec(),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/simulator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/simulator.ts tests/simulator.test.ts
git commit -m "feat: add conversation simulator with persona/chatbot loop"
```

---

## Task 11: Evaluation Criteria Definitions

**Files:**
- Create: `criteria/universal.ts`
- Create: `criteria/birthbuild/sparse-sarah.ts`
- Create: `criteria/birthbuild/detailed-dina.ts`
- Create: `criteria/birthbuild/nervous-nora.ts`

**Step 1: Write criteria/universal.ts**

```typescript
// criteria/universal.ts
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
```

**Step 2: Write criteria/birthbuild/sparse-sarah.ts**

```typescript
// criteria/birthbuild/sparse-sarah.ts
import type { Criterion } from "../../personas/schema.js";

export const SPARSE_SARAH_CRITERIA: Criterion[] = [
  { type: "score", name: "gentle_probing", description: "When Sarah gave minimal answers, did the chatbot gently offer examples or options rather than open-ended follow-ups?" },
  { type: "score", name: "graceful_retreat", description: "After 2 unsuccessful follow-ups on a topic, did the chatbot move on without making Sarah feel she'd failed?" },
  { type: "check", name: "max_follow_ups_respected", description: "Did the chatbot ever ask more than 2 follow-ups on the same topic? (HARD FAIL if true)", hard_fail: true },
  { type: "check", name: "minimum_viable_spec", description: "Despite minimal input, does the resulting spec contain enough data to generate a functional site?" },
  { type: "range", name: "density_score_range", description: "Low density but above the functional threshold", expected_min: 8, expected_max: 14 },
];
```

**Step 3: Write criteria/birthbuild/detailed-dina.ts**

```typescript
// criteria/birthbuild/detailed-dina.ts
import type { Criterion } from "../../personas/schema.js";

export const DETAILED_DINA_CRITERIA: Criterion[] = [
  { type: "score", name: "information_recognition", description: "When Dina volunteered information that answered multiple upcoming questions, did the chatbot recognise this and skip those questions?" },
  { type: "score", name: "multi_field_parsing", description: "When Dina gave a paragraph containing multiple field values, did the chatbot extract and save all of them?" },
  { type: "count", name: "redundant_questions", description: "Number of times the chatbot asked for information Dina had already provided. 0 = pass, 1 = warning, 2+ = fail.", fail_threshold: 2 },
  { type: "range", name: "efficiency", description: "Dina's conversations should be shorter than average. A long conversation suggests the chatbot isn't recognising pre-provided data.", expected_min: 10, expected_max: 30 },
  { type: "range", name: "density_score_range", description: "Should achieve excellent density with minimal prompting", expected_min: 21, expected_max: 25 },
];
```

**Step 4: Write criteria/birthbuild/nervous-nora.ts**

```typescript
// criteria/birthbuild/nervous-nora.ts
import type { Criterion } from "../../personas/schema.js";

export const NERVOUS_NORA_CRITERIA: Criterion[] = [
  { type: "score", name: "validation_given", description: "When Nora expressed self-doubt or apologised, did the chatbot validate her rather than ignore it or move on?" },
  { type: "score", name: "experience_sensitivity", description: "When asking about experience levels, did the chatbot frame it in a way that doesn't make 'just starting out' feel inadequate?" },
  { type: "score", name: "strength_identification", description: "Did the chatbot identify and lean into Nora's strengths (12 years nursing) rather than dwelling on her lack of doula experience?" },
  { type: "score", name: "gap_handling", description: "When Nora said she didn't have testimonials, did the chatbot normalise this and offer a path forward rather than making her feel behind?" },
  { type: "check", name: "no_harm_questions", description: "Did the chatbot avoid asking 'how many births have you attended?' or 'tell me about a birth that stayed with you' without first establishing she's newly qualified? (HARD FAIL if asked cold)", hard_fail: true },
  { type: "range", name: "density_score_range", description: "Medium density — higher than Sarah because Nora is willing to share, lower than Dina because she lacks some data", expected_min: 10, expected_max: 17 },
];
```

**Step 5: Commit**

```bash
git add criteria/
git commit -m "feat: add universal and per-persona evaluation criteria"
```

---

## Task 12: LLM-as-Judge Evaluator

**Files:**
- Create: `lib/judge.ts`
- Test: `tests/judge.test.ts`

**Step 1: Write the test**

```typescript
// tests/judge.test.ts
import { describe, it, expect } from "vitest";
import { buildJudgePrompt, buildEvaluationTool } from "../lib/judge.js";
import { UNIVERSAL_CRITERIA } from "../criteria/universal.js";
import { SPARSE_SARAH_CRITERIA } from "../criteria/birthbuild/sparse-sarah.js";
import type { Persona, ConversationTurn } from "../personas/schema.js";

describe("buildJudgePrompt", () => {
  const persona: Persona = {
    id: "test",
    name: "Test",
    vertical: "birthbuild",
    background: "test",
    communication_style: { detail_level: "minimal", tone: "neutral", typical_response_length: "1-2 sentences", quirks: [] },
    knowledge: { knows_about_their_field: "beginner", self_awareness: "low", willingness_to_share: "open" },
    seed_data: {},
    gaps: [],
    triggers: { will_elaborate_if: [], will_shut_down_if: [], will_skip_if: [] },
  };

  const turns: ConversationTurn[] = [
    { turn_number: 1, role: "assistant", content: "Hello!", timestamp: "2026-01-01T00:00:00Z" },
    { turn_number: 2, role: "user", content: "Hi", timestamp: "2026-01-01T00:00:01Z" },
  ];

  it("includes persona profile in prompt", () => {
    const prompt = buildJudgePrompt(persona, turns, UNIVERSAL_CRITERIA, SPARSE_SARAH_CRITERIA);
    expect(prompt).toContain("Test");
    expect(prompt).toContain("Persona Profile");
  });

  it("includes conversation transcript", () => {
    const prompt = buildJudgePrompt(persona, turns, UNIVERSAL_CRITERIA, SPARSE_SARAH_CRITERIA);
    expect(prompt).toContain("[Turn 1]");
    expect(prompt).toContain("Hello!");
  });

  it("includes criteria", () => {
    const prompt = buildJudgePrompt(persona, turns, UNIVERSAL_CRITERIA, SPARSE_SARAH_CRITERIA);
    expect(prompt).toContain("completion");
    expect(prompt).toContain("gentle_probing");
  });
});

describe("buildEvaluationTool", () => {
  it("returns a valid tool definition", () => {
    const tool = buildEvaluationTool();
    expect(tool.name).toBe("submit_evaluation");
    expect(tool.input_schema).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/judge.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/judge.ts**

```typescript
// lib/judge.ts
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
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (!toolUseBlock) {
    throw new Error("Judge did not return a submit_evaluation tool call");
  }

  return toolUseBlock.input as unknown as EvaluationResult;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/judge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/judge.ts tests/judge.test.ts
git commit -m "feat: add LLM-as-judge evaluator with structured output"
```

---

## Task 13: Reporter (JSON + Markdown)

**Files:**
- Create: `lib/reporter.ts`
- Test: `tests/reporter.test.ts`

**Step 1: Write the test**

```typescript
// tests/reporter.test.ts
import { describe, it, expect } from "vitest";
import { generateMarkdownReport, buildPersonaSummary } from "../lib/reporter.js";
import type { EvaluationResult, DensityResult, ConversationTurn } from "../personas/schema.js";

describe("buildPersonaSummary", () => {
  it("builds a summary from evaluation result", () => {
    const evaluation: EvaluationResult = {
      persona_id: "sparse-sarah",
      universal_scores: {
        completion: { score: 4, reasoning: "Reached review" },
        tone_consistency: { score: 5, reasoning: "Warm throughout" },
      },
      persona_scores: {
        gentle_probing: { score: 3, reasoning: "Decent" },
      },
      hard_fails: [],
      overall_score: 3.8,
      top_improvement: "Better examples",
      regression_pass: true,
      regression_reasoning: "Consistent",
    };
    const density: DensityResult = {
      coreScore: 5,
      depthScore: 6,
      totalScore: 11,
      percentage: 44,
      level: "medium",
      suggestions: [],
    };

    const summary = buildPersonaSummary(evaluation, density, 28);
    expect(summary.passed).toBe(true);
    expect(summary.overall_score).toBe(3.8);
    expect(summary.total_turns).toBe(28);
    expect(summary.hard_fails).toEqual([]);
  });

  it("marks as failed when hard fails exist", () => {
    const evaluation: EvaluationResult = {
      persona_id: "sparse-sarah",
      universal_scores: {},
      persona_scores: {},
      hard_fails: ["max_follow_ups_respected"],
      overall_score: 2.0,
      top_improvement: "Respect limits",
      regression_pass: false,
      regression_reasoning: "Hard fail",
    };
    const density: DensityResult = {
      coreScore: 3, depthScore: 2, totalScore: 5,
      percentage: 20, level: "low", suggestions: [],
    };

    const summary = buildPersonaSummary(evaluation, density, 40);
    expect(summary.passed).toBe(false);
  });
});

describe("generateMarkdownReport", () => {
  it("produces markdown with persona sections", () => {
    const md = generateMarkdownReport({
      run_id: "test-run",
      timestamp: "2026-02-18T14:30:00Z",
      prompt_version: "abc123",
      model: "claude-sonnet-4-5",
      personas: {
        "sparse-sarah": {
          passed: true,
          overall_score: 3.8,
          hard_fails: [],
          density_score: { coreScore: 5, depthScore: 6, totalScore: 11, percentage: 44, level: "medium", suggestions: [] },
          total_turns: 28,
          universal_scores: { completion: 4 },
          persona_scores: { gentle_probing: 3 },
          top_improvement: "Better examples",
        },
      },
      regression: { detected: false, details: [] },
      overall_pass: true,
    });
    expect(md).toContain("# Persona Test Run");
    expect(md).toContain("sparse-sarah");
    expect(md).toContain("PASS");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/reporter.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/reporter.ts**

```typescript
// lib/reporter.ts
import type {
  EvaluationResult,
  DensityResult,
  PersonaSummary,
  TestRunSummary,
} from "../personas/schema.js";

export function buildPersonaSummary(
  evaluation: EvaluationResult,
  density: DensityResult,
  totalTurns: number,
): PersonaSummary {
  const universalScores: Record<string, number> = {};
  for (const [key, val] of Object.entries(evaluation.universal_scores)) {
    universalScores[key] = val.score;
  }

  const personaScores: Record<string, number | boolean> = {};
  for (const [key, val] of Object.entries(evaluation.persona_scores)) {
    if ("score" in val && typeof val.score === "number") personaScores[key] = val.score;
    else if ("check" in val && typeof val.check === "boolean") personaScores[key] = val.check;
    else if ("count" in val && typeof val.count === "number") personaScores[key] = val.count;
  }

  return {
    passed: evaluation.hard_fails.length === 0 && evaluation.overall_score >= 3.0,
    overall_score: evaluation.overall_score,
    hard_fails: evaluation.hard_fails,
    density_score: density,
    total_turns: totalTurns,
    universal_scores: universalScores,
    persona_scores: personaScores,
    top_improvement: evaluation.top_improvement,
  };
}

export function generateMarkdownReport(summary: TestRunSummary): string {
  const result = summary.overall_pass ? "PASS" : "FAIL";
  const regressionNote = summary.regression.detected
    ? ` (regressions detected)`
    : " (no regressions)";

  let md = `# Persona Test Run — ${summary.timestamp}\n\n`;
  md += `**Prompt version:** ${summary.prompt_version}\n`;
  md += `**Model:** ${summary.model}\n`;
  md += `**Result:** ${summary.overall_pass ? "PASS" : "FAIL"}${regressionNote}\n\n`;

  for (const [personaId, persona] of Object.entries(summary.personas)) {
    const icon = persona.passed ? "PASS" : "FAIL";
    md += `## ${personaId}\n`;
    md += `Score: ${persona.overall_score}/5 | Density: ${persona.density_score.totalScore}/25 (${persona.density_score.level}) | Turns: ${persona.total_turns}\n`;
    md += `Status: ${icon}\n`;

    if (persona.hard_fails.length > 0) {
      md += `Hard fails: ${persona.hard_fails.join(", ")}\n`;
    }

    md += `Top improvement: ${persona.top_improvement}\n\n`;
  }

  if (summary.regression.detected) {
    md += `## Regressions\n`;
    for (const detail of summary.regression.details) {
      md += `- ${detail}\n`;
    }
    md += "\n";
  }

  return md;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/reporter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/reporter.ts tests/reporter.test.ts
git commit -m "feat: add report generation (JSON + markdown)"
```

---

## Task 14: Regression Detection

**Files:**
- Create: `lib/regression.ts`
- Test: `tests/regression.test.ts`

**Step 1: Write the test**

```typescript
// tests/regression.test.ts
import { describe, it, expect } from "vitest";
import { detectRegressions } from "../lib/regression.js";
import type { TestRunSummary } from "../personas/schema.js";

function makeSummary(overrides: Partial<TestRunSummary["personas"]["x"]> = {}): TestRunSummary {
  return {
    run_id: "test",
    timestamp: "2026-02-18T14:30:00Z",
    prompt_version: "abc",
    model: "sonnet",
    personas: {
      "sparse-sarah": {
        passed: true,
        overall_score: 3.8,
        hard_fails: [],
        density_score: { coreScore: 5, depthScore: 6, totalScore: 11, percentage: 44, level: "medium", suggestions: [] },
        total_turns: 28,
        universal_scores: { completion: 4, tone_consistency: 4 },
        persona_scores: { gentle_probing: 3 },
        top_improvement: "test",
        ...overrides,
      },
    },
    regression: { detected: false, details: [] },
    overall_pass: true,
  };
}

describe("detectRegressions", () => {
  it("returns no regressions when scores are stable", () => {
    const prev = makeSummary();
    const curr = makeSummary();
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(false);
    expect(result.details).toEqual([]);
  });

  it("detects score drop > 1 point", () => {
    const prev = makeSummary({ universal_scores: { completion: 4, tone_consistency: 4 } });
    const curr = makeSummary({ universal_scores: { completion: 2, tone_consistency: 4 } });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(true);
    expect(result.details.some((d) => d.includes("completion"))).toBe(true);
  });

  it("detects new hard fail", () => {
    const prev = makeSummary({ hard_fails: [] });
    const curr = makeSummary({ hard_fails: ["max_follow_ups_respected"] });
    const result = detectRegressions(curr, prev);
    expect(result.detected).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/regression.test.ts`
Expected: FAIL — module not found

**Step 3: Write lib/regression.ts**

```typescript
// lib/regression.ts
import type { TestRunSummary, PersonaSummary } from "../personas/schema.js";

interface RegressionResult {
  detected: boolean;
  details: string[];
}

export function detectRegressions(
  current: TestRunSummary,
  previous: TestRunSummary,
): RegressionResult {
  const details: string[] = [];

  for (const [personaId, currPersona] of Object.entries(current.personas)) {
    const prevPersona = previous.personas[personaId];
    if (!prevPersona) continue;

    // Score drops > 1 point on universal criteria
    for (const [criterion, currScore] of Object.entries(currPersona.universal_scores)) {
      const prevScore = prevPersona.universal_scores[criterion];
      if (prevScore !== undefined && typeof currScore === "number" && typeof prevScore === "number") {
        if (prevScore - currScore > 1) {
          details.push(`${personaId}: ${criterion} dropped from ${prevScore} to ${currScore}`);
        }
      }
    }

    // Score drops > 1 point on persona criteria
    for (const [criterion, currScore] of Object.entries(currPersona.persona_scores)) {
      const prevScore = prevPersona.persona_scores[criterion];
      if (prevScore !== undefined && typeof currScore === "number" && typeof prevScore === "number") {
        if (prevScore - currScore > 1) {
          details.push(`${personaId}: ${criterion} dropped from ${prevScore} to ${currScore}`);
        }
      }
    }

    // New hard fails
    for (const hf of currPersona.hard_fails) {
      if (!prevPersona.hard_fails.includes(hf)) {
        details.push(`${personaId}: new hard fail — ${hf}`);
      }
    }

    // Density outside expected range (use persona-specific expected ranges)
    const currDensity = currPersona.density_score.totalScore;
    const prevDensity = prevPersona.density_score.totalScore;
    if (Math.abs(currDensity - prevDensity) > 5) {
      details.push(`${personaId}: density shifted from ${prevDensity} to ${currDensity}`);
    }

    // Turn count checks for specific personas
    if (personaId === "detailed-dina" && prevPersona.total_turns > 0) {
      const increase = (currPersona.total_turns - prevPersona.total_turns) / prevPersona.total_turns;
      if (increase > 0.3) {
        details.push(`${personaId}: turn count increased ${Math.round(increase * 100)}% (${prevPersona.total_turns} → ${currPersona.total_turns})`);
      }
    }
    if (personaId === "sparse-sarah" && prevPersona.total_turns > 0) {
      const decrease = (prevPersona.total_turns - currPersona.total_turns) / prevPersona.total_turns;
      if (decrease > 0.3) {
        details.push(`${personaId}: turn count decreased ${Math.round(decrease * 100)}% (${prevPersona.total_turns} → ${currPersona.total_turns})`);
      }
    }
  }

  return {
    detected: details.length > 0,
    details,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/regression.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/regression.ts tests/regression.test.ts
git commit -m "feat: add regression detection between test runs"
```

---

## Task 15: CLI Entry Point

**Files:**
- Create: `run.ts`

**Step 1: Write run.ts**

```typescript
// run.ts
import { Command } from "commander";
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";
import type { Persona, Criterion, TestRunSummary } from "./personas/schema.js";
import { ModeBChatbotClient } from "./lib/chatbot-client.js";
import { simulateConversation } from "./lib/simulator.js";
import { evaluateConversation } from "./lib/judge.js";
import { calculateDensityScore } from "./lib/density.js";
import { buildPersonaSummary, generateMarkdownReport } from "./lib/reporter.js";
import { detectRegressions } from "./lib/regression.js";
import { UNIVERSAL_CRITERIA } from "./criteria/universal.js";
import type Anthropic from "@anthropic-ai/sdk";

const ROOT = resolve(import.meta.dirname ?? __dirname);

function loadPersonaCriteria(personaId: string, vertical: string): Criterion[] {
  const path = join(ROOT, "criteria", vertical, `${personaId}.ts`);
  // Dynamic import for criteria files
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  throw new Error(`Load criteria from ${path} — use dynamic import in actual implementation`);
}

// Criteria registry (avoids dynamic import complexity)
async function getCriteria(personaId: string, vertical: string): Promise<Criterion[]> {
  if (vertical === "birthbuild") {
    switch (personaId) {
      case "sparse-sarah": {
        const mod = await import("./criteria/birthbuild/sparse-sarah.js");
        return mod.SPARSE_SARAH_CRITERIA;
      }
      case "detailed-dina": {
        const mod = await import("./criteria/birthbuild/detailed-dina.js");
        return mod.DETAILED_DINA_CRITERIA;
      }
      case "nervous-nora": {
        const mod = await import("./criteria/birthbuild/nervous-nora.js");
        return mod.NERVOUS_NORA_CRITERIA;
      }
    }
  }
  throw new Error(`No criteria found for ${personaId} in vertical ${vertical}`);
}

function getPersonaFiles(vertical: string, personaId?: string): string[] {
  const dir = join(ROOT, "personas", vertical);
  if (personaId) return [join(dir, `${personaId}.json`)];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dir, f));
}

function findLatestRun(): TestRunSummary | null {
  const runsDir = join(ROOT, "runs");
  if (!existsSync(runsDir)) return null;
  const dirs = readdirSync(runsDir).sort().reverse();
  for (const dir of dirs) {
    const summaryPath = join(runsDir, dir, "summary.json");
    if (existsSync(summaryPath)) {
      return JSON.parse(readFileSync(summaryPath, "utf-8")) as TestRunSummary;
    }
  }
  return null;
}

const program = new Command();
program.name("persona-harness").description("Persona testing harness for chatbot evaluation").version("0.1.0");

program
  .command("run")
  .description("Run persona simulations and evaluate")
  .requiredOption("--prompt <path>", "Path to system prompt file")
  .requiredOption("--tools <path>", "Path to tools JSON file")
  .option("--vertical <vertical>", "Run all personas for a vertical", "birthbuild")
  .option("--persona <id>", "Run a single persona")
  .option("--max-turns <n>", "Maximum conversation turns", "60")
  .action(async (opts) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red("ANTHROPIC_API_KEY not set"));
      process.exit(1);
    }

    const systemPrompt = readFileSync(resolve(opts.prompt), "utf-8");
    const tools = JSON.parse(readFileSync(resolve(opts.tools), "utf-8")) as Anthropic.Tool[];
    const maxTurns = parseInt(opts.maxTurns, 10);
    const vertical = opts.vertical;

    const personaFiles = getPersonaFiles(vertical, opts.persona);
    const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const runDir = join(ROOT, "runs", runId);
    mkdirSync(runDir, { recursive: true });

    const summaryPersonas: TestRunSummary["personas"] = {};

    for (const personaFile of personaFiles) {
      const persona = JSON.parse(readFileSync(personaFile, "utf-8")) as Persona;
      console.log(chalk.blue(`\nSimulating ${persona.name}...`));

      const chatbotClient = new ModeBChatbotClient({
        systemPrompt,
        tools,
        apiKey,
      });

      // Simulate conversation
      const { turns, finalSpec } = await simulateConversation({
        persona,
        chatbotClient,
        apiKey,
        maxTurns,
      });

      console.log(chalk.grey(`  ${turns.length} turns completed`));

      // Save conversation and spec
      const personaDir = join(runDir, persona.id);
      mkdirSync(personaDir, { recursive: true });
      writeFileSync(join(personaDir, "conversation.json"), JSON.stringify(turns, null, 2));
      writeFileSync(join(personaDir, "spec-snapshot.json"), JSON.stringify(finalSpec, null, 2));

      // Evaluate
      console.log(chalk.blue(`  Evaluating with judge...`));
      const personaCriteria = await getCriteria(persona.id, vertical);
      const evaluation = await evaluateConversation({
        persona,
        turns,
        universalCriteria: UNIVERSAL_CRITERIA,
        personaCriteria,
        apiKey,
      });

      writeFileSync(join(personaDir, "evaluation.json"), JSON.stringify(evaluation, null, 2));

      // Build summary
      const density = calculateDensityScore(finalSpec);
      summaryPersonas[persona.id] = buildPersonaSummary(evaluation, density, turns.length);

      const icon = summaryPersonas[persona.id]!.passed ? chalk.green("PASS") : chalk.red("FAIL");
      console.log(`  ${icon} — Score: ${evaluation.overall_score}/5 | Density: ${density.totalScore}/25 (${density.level}) | Turns: ${turns.length}`);
    }

    // Regression detection
    const previousRun = findLatestRun();
    const currentSummary: TestRunSummary = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      prompt_version: "manual",
      model: "claude-sonnet-4-5-20250929",
      personas: summaryPersonas,
      regression: { detected: false, details: [] },
      overall_pass: Object.values(summaryPersonas).every((p) => p.passed),
    };

    if (previousRun) {
      currentSummary.regression = detectRegressions(currentSummary, previousRun);
      if (currentSummary.regression.detected) {
        currentSummary.overall_pass = false;
      }
    }

    // Save summary and report
    writeFileSync(join(runDir, "summary.json"), JSON.stringify(currentSummary, null, 2));
    writeFileSync(join(runDir, "meta.json"), JSON.stringify({
      run_id: runId,
      timestamp: currentSummary.timestamp,
      prompt_version: "manual",
      model: "claude-sonnet-4-5-20250929",
    }, null, 2));

    const markdownReport = generateMarkdownReport(currentSummary);
    writeFileSync(join(runDir, "report.md"), markdownReport);

    console.log(`\n${markdownReport}`);
    console.log(chalk.grey(`Results saved to: runs/${runId}/`));
  });

program
  .command("diff <run1> <run2>")
  .description("Compare two test runs")
  .action((run1Path, run2Path) => {
    const summary1 = JSON.parse(readFileSync(join(resolve(run1Path), "summary.json"), "utf-8")) as TestRunSummary;
    const summary2 = JSON.parse(readFileSync(join(resolve(run2Path), "summary.json"), "utf-8")) as TestRunSummary;

    const regression = detectRegressions(summary2, summary1);
    if (regression.detected) {
      console.log(chalk.red("Regressions detected:"));
      for (const detail of regression.details) {
        console.log(chalk.red(`  - ${detail}`));
      }
    } else {
      console.log(chalk.green("No regressions detected."));
    }
  });

program
  .command("report <run-dir>")
  .description("Generate a human-readable report for a run")
  .action((runDir) => {
    const summary = JSON.parse(readFileSync(join(resolve(runDir), "summary.json"), "utf-8")) as TestRunSummary;
    const md = generateMarkdownReport(summary);
    console.log(md);
  });

program.parse();
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only minor ones to fix)

**Step 3: Commit**

```bash
git add run.ts
git commit -m "feat: add CLI entry point with run/diff/report commands"
```

---

## Task 16: End-to-End Smoke Test

**Step 1: Set up .env with a real API key**

```bash
cp .env.example .env
# Edit .env to add your ANTHROPIC_API_KEY
```

**Step 2: Run a single persona**

```bash
npm run harness -- run --persona sparse-sarah --prompt ./prompts/birthbuild/system-prompt.md --tools ./prompts/birthbuild/tools.json --max-turns 10
```

Use `--max-turns 10` for a quick smoke test (shorter conversation, lower cost).

**Step 3: Verify output**

Check that `runs/<timestamp>/sparse-sarah/` contains:
- `conversation.json` — array of ConversationTurn objects
- `spec-snapshot.json` — SiteSpec with some fields populated
- `evaluation.json` — EvaluationResult with scores

Check that `runs/<timestamp>/summary.json` and `runs/<timestamp>/report.md` exist.

**Step 4: Fix any issues**

Address any runtime errors, type mismatches, or API call failures.

**Step 5: Run the report command**

```bash
npm run harness -- report runs/<timestamp>
```

Verify it prints a formatted markdown summary.

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from end-to-end smoke test"
```

---

## Task 17: Full Run + Push

**Step 1: Run all personas**

```bash
npm run harness -- run --vertical birthbuild --prompt ./prompts/birthbuild/system-prompt.md --tools ./prompts/birthbuild/tools.json
```

This runs Sparse Sarah, Detailed Dina, and Nervous Nora sequentially. Expect ~$1.50 cost with Opus judge.

**Step 2: Review the report**

Read `runs/<timestamp>/report.md` and verify:
- All three personas produced conversation transcripts
- Density scores are in expected ranges (Sarah 8-14, Dina 21-25, Nora 10-17)
- No unexpected hard fails
- The judge's reasoning cites specific turn numbers

**Step 3: Push to remote**

```bash
git push -u origin main
```

**Step 4: Run a second run to test regression detection**

```bash
npm run harness -- run --vertical birthbuild --prompt ./prompts/birthbuild/system-prompt.md --tools ./prompts/birthbuild/tools.json
```

Then:
```bash
npm run harness -- diff runs/<first-run> runs/<second-run>
```

Verify regression detection compares the two runs correctly.

---

## Summary

| Task | Module | Description |
|------|--------|-------------|
| 1 | Scaffold | package.json, tsconfig, .gitignore, .env |
| 2 | CLAUDE.md | Project conventions file |
| 3 | Types | Persona, SiteSpec, ConversationTurn, EvaluationResult |
| 4 | Personas | 3 BirthBuild persona JSON files |
| 5 | Prompts | Extracted system prompt + tool definitions |
| 6 | SpecAccumulator | In-memory spec with tool call mapping |
| 7 | Density | 25-point density scoring |
| 8 | ChatbotClient | Mode B client with tool-use loop |
| 9 | PersonaAgent | LLM-as-user simulator |
| 10 | Simulator | Conversation loop orchestration |
| 11 | Criteria | Universal + per-persona evaluation criteria |
| 12 | Judge | LLM-as-judge with structured output |
| 13 | Reporter | JSON + markdown report generation |
| 14 | Regression | Run-to-run comparison |
| 15 | CLI | Entry point with run/diff/report commands |
| 16 | Smoke test | End-to-end with --max-turns 10 |
| 17 | Full run | All personas + push to remote |
