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
