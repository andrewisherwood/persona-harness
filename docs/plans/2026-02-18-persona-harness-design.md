# Design: Persona Testing Harness

**Date:** 2026-02-18
**Status:** Approved
**Source:** SCOPING-PERSONA-HARNESS.md

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Initial integration mode | Mode B only (isolated prompt) | Faster to build, no Supabase test tenant needed. Mode A added later. |
| Tool call handling | In-memory spec accumulator | Tracks exact field writes, enables density scoring, matches BirthBuild's tool mapping. |
| API keys | Single `ANTHROPIC_API_KEY` env var | Model selection per-call. Simple config. |
| Density module | Copy and adapt from BirthBuild | Self-contained harness, no cross-repo dependency. |
| Runtime | Node.js + TypeScript | Familiar tooling, Anthropic Node SDK out of the box. |
| Prompt source | Config file paths via CLI flags | `--prompt` and `--tools` flags point to extracted files. |
| Architecture | Modular pipeline with typed interfaces | Clean separation, Mode A extension point, parallel persona runs. |

---

## Architecture

### Project Structure

```
persona-harness/
├── package.json
├── tsconfig.json
├── .env                      # ANTHROPIC_API_KEY
├── .gitignore
├── CLAUDE.md
├── personas/
│   ├── schema.ts             # Persona + SiteSpec + Criteria types
│   └── birthbuild/
│       ├── sparse-sarah.json
│       ├── detailed-dina.json
│       └── nervous-nora.json
├── criteria/
│   ├── universal.ts          # Universal evaluation criteria definitions
│   └── birthbuild/
│       ├── sparse-sarah.ts
│       ├── detailed-dina.ts
│       └── nervous-nora.ts
├── prompts/
│   └── birthbuild/
│       ├── system-prompt.md
│       └── tools.json
├── lib/
│   ├── simulator.ts          # Conversation loop orchestration
│   ├── persona-agent.ts      # LLM-as-user (Sonnet)
│   ├── chatbot-client.ts     # ChatbotClient interface + Mode B implementation
│   ├── spec-accumulator.ts   # In-memory SiteSpec + tool call handler
│   ├── judge.ts              # LLM-as-judge (Opus)
│   ├── density.ts            # Density scoring (adapted from BirthBuild)
│   ├── reporter.ts           # JSON + markdown report generation
│   └── regression.ts         # Run-to-run diff + regression detection
├── runs/                     # Output directory (gitignored)
├── run.ts                    # CLI entry point
└── docs/plans/
```

### Three LLM Roles

| Role | Model | Purpose |
|------|-------|---------|
| Persona Simulator | Claude Sonnet | Acts as the user, follows persona definition |
| Target Chatbot | Claude Sonnet | The system under test (matches production model) |
| Judge Evaluator | Claude Opus | Reads transcript, scores against criteria rubric |

### Core Interface

```typescript
interface ChatbotClient {
  sendMessage(history: Message[]): Promise<ChatbotResponse>;
  getSpec(): SiteSpec;
}
```

Mode B implements this by calling Claude directly with the extracted system prompt and tool definitions. Mode A (future) implements it by calling the Supabase edge function.

---

## Conversation Simulation

1. CLI loads persona JSON, system prompt, and tool definitions
2. Simulator creates `ModeBChatbotClient` with prompt/tools and fresh `SpecAccumulator`
3. Simulator creates `PersonaAgent` with persona definition
4. Chatbot sends opening greeting
5. Loop: persona responds → chatbot responds → log turn → check end conditions
6. End conditions: build triggered, max turns (60), or natural conclusion

**Persona agent isolation:** The persona agent only sees the chatbot's text responses. Tool calls, tool results, and system prompts are invisible — matching a real user's experience.

**Tool-use loop:** `ModeBChatbotClient` mirrors the BirthBuild edge function's loop. When Claude returns `stop_reason === "tool_use"`, tool calls are applied to the `SpecAccumulator`, tool_result messages are sent back, and the loop continues until text is produced.

**SpecAccumulator:** Starts empty. Each tool call maps to SiteSpec field updates using the same mapping logic as BirthBuild's `mapToolCallToSpecUpdate`. Exposes `getSpec()` for density scoring at any turn.

---

## LLM-as-Judge Evaluation

After conversation completes, the full transcript is sent to Claude Opus.

**Judge input:**
- Persona JSON
- Full conversation transcript with turn numbers
- Final spec snapshot
- Universal criteria (7 criteria, 1-5 scale)
- Persona-specific criteria (includes hard-fail checks)

**Structured output:** Uses Anthropic SDK tool_use to force JSON conformance — a single `submit_evaluation` tool that the judge must call with the result schema.

**Output schema:**
```typescript
interface EvaluationResult {
  persona_id: string;
  universal_scores: Record<string, { score: number; reasoning: string }>;
  persona_scores: Record<string, { score?: number; check?: boolean; count?: number; reasoning: string }>;
  hard_fails: string[];
  overall_score: number;
  top_improvement: string;
  regression_pass: boolean;
  regression_reasoning: string;
}
```

---

## Reporting & Regression

### Run Output

```
runs/
└── 2026-02-18T14-30-00/
    ├── meta.json
    ├── sparse-sarah/
    │   ├── conversation.json
    │   ├── evaluation.json
    │   └── spec-snapshot.json
    ├── detailed-dina/...
    ├── nervous-nora/...
    └── summary.json
```

### Regression Rules

- Score drop > 1 point on any criterion → regression
- New hard fail triggered → regression
- Density outside expected range → regression
- Dina turn count +30% → efficiency regression
- Sarah turn count -30% → premature termination regression

### CLI

```bash
npx tsx run.ts run --vertical birthbuild --prompt ./prompts/birthbuild/system-prompt.md --tools ./prompts/birthbuild/tools.json
npx tsx run.ts run --persona sparse-sarah --prompt ... --tools ...
npx tsx run.ts diff <run1> <run2>
npx tsx run.ts report <run-dir>
```

---

## Out of Scope (Phase 1)

- Mode A (live Supabase endpoint integration)
- Claude Code plugin/command wrapper
- Git hook auto-run
- A/B prompt testing
- Persona generation from real conversations
- Nightly monitoring
- Benchmark database / visualization
