# Persona Testing Harness

Automated conversation testing harness for Dopamine Labs chatbot products. Simulates user personas against a chatbot, evaluates conversations with an LLM judge, and reports quality scores with regression detection.

**v2** adds a React dashboard, production Supabase edge function integration, full build pipeline, A/B prompt comparison, and cost tracking.

## Tech Stack

- **Runtime:** Node.js + TypeScript (strict mode)
- **LLM:** Anthropic Claude via `@anthropic-ai/sdk`
- **Dashboard:** React 18 + Vite 7 + React Router 7
- **API Server:** Express 5 (embedded, proxied through Vite in dev)
- **Production Integration:** Supabase edge functions (`/chat`, `/build`, `/publish`)
- **Streaming:** Server-Sent Events for real-time run progress
- **CLI:** Commander
- **Testing:** Vitest
- **Output:** chalk@4 for coloured terminal output

## Project Structure

```
persona-harness/
├── src/
│   ├── client/               # React dashboard
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Router + Layout
│   │   ├── styles/           # Design tokens + global CSS
│   │   ├── components/       # Reusable components (Layout, ChatBubble, ScoreCard, etc.)
│   │   ├── pages/            # Page components (RunConfig, RunProgress, Results, etc.)
│   │   └── hooks/            # useApi, useSSE
│   └── server/               # Express API server
│       ├── index.ts          # App factory (createApp) + listener
│       ├── routes/           # API routes (runs, personas, prompts, config, cost)
│       └── engine/           # Core engine
│           ├── orchestrator.ts   # Run execution (full-pipeline, build-only)
│           ├── edge-function-client.ts  # HTTP client for Supabase edge functions
│           ├── supabase-client.ts       # Supabase config + site_spec CRUD
│           ├── cost-tracker.ts          # Token cost accounting
│           ├── site-generator.ts       # HTML/CSS generation from site spec
│           └── types.ts                 # RunConfig, RunResult, RunProgress types
├── lib/                      # Original CLI core modules
│   ├── simulator.ts          # Conversation loop orchestration
│   ├── persona-agent.ts      # LLM-as-user (builds persona system prompt)
│   ├── chatbot-client.ts     # ChatbotClient interface + Mode B impl
│   ├── spec-accumulator.ts   # In-memory SiteSpec + tool call mapping
│   ├── judge.ts              # LLM-as-judge evaluator
│   ├── density.ts            # Density scoring
│   ├── reporter.ts           # JSON + markdown report generation
│   └── regression.ts         # Run-to-run diff + regression detection
├── personas/                 # Persona definitions
│   ├── schema.ts             # Types: Persona, SiteSpec, ConversationTurn, etc.
│   └── birthbuild/           # BirthBuild personas (JSON)
├── criteria/                 # Evaluation criteria
│   ├── universal.ts          # 7 universal criteria
│   └── birthbuild/           # Per-persona criteria with hard-fail checks
├── prompts/                  # System prompts + tool definitions
│   └── birthbuild/           # system-prompt.md + tools.json
├── scripts/
│   └── smoke-test.ts         # Manual E2E integration test
├── runs/                     # Output directory (gitignored)
├── run.ts                    # CLI entry point
├── tests/                    # Vitest test files (104 tests, 16 files)
├── docs/
│   ├── edge-function-contracts.md  # Production edge function HTTP contracts
│   └── plans/                      # Design + implementation plans
├── vite.config.ts            # Vite config with Express proxy
├── index.html                # Vite HTML entry point
└── harness-config.json       # Runtime config (budget, default models)
```

## Commands

```bash
# Dashboard (v2)
npm run dev               # Start dashboard + API server (Vite + Express)
npm run dev:client        # Vite dev server only
npm run dev:server        # Express API server only (tsx watch)

# CLI (v1 — still works)
npm run harness -- run --vertical birthbuild --prompt ./prompts/birthbuild/system-prompt.md --tools ./prompts/birthbuild/tools.json
npm run harness -- run --persona sparse-sarah --prompt ... --tools ...
npm run harness -- diff <run1> <run2>
npm run harness -- report <run-dir>

# Testing
npm test                  # Run all 104 tests
npm run test:watch        # Watch mode
npm run typecheck         # tsc --noEmit

# Manual integration test (requires .env with real credentials)
npx tsx scripts/smoke-test.ts
```

## Environment Variables

Required for dashboard runs (in `.env`):
- `ANTHROPIC_API_KEY` — Anthropic API key (for persona agent + judge)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (for site_spec CRUD)
- `AUTH_TOKEN` — User JWT token (for edge function auth — Bearer prefix added automatically)
- `TEST_TENANT_ID` — Test tenant UUID
- `TEST_USER_ID` — Test user UUID
- `API_PORT` — Express server port (default: 3001)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health + env var status |
| GET | `/api/personas` | List all personas |
| GET | `/api/personas/:id` | Get persona details |
| GET | `/api/prompts` | List available prompts |
| GET | `/api/prompts/:id` | Get prompt content |
| GET | `/api/config` | Get harness config |
| PUT | `/api/config` | Update harness config |
| GET | `/api/runs` | List all runs |
| GET | `/api/runs/:id` | Get run summary |
| POST | `/api/runs` | Start a new run |
| GET | `/api/runs/:id/stream` | SSE stream for run progress |
| GET | `/api/runs/:id/:persona/conversation` | Get conversation |
| GET | `/api/runs/:id/:persona/site-spec` | Get site spec |
| GET | `/api/runs/:id/:persona/evaluation` | Get evaluation |
| GET | `/api/runs/:id/:persona/cost` | Get cost breakdown |
| GET | `/api/cost/summary` | Aggregated cost summary |

## Coding Standards

- TypeScript strict mode, no `any`
- Named exports only (no default exports)
- Functional style preferred; classes only for stateful modules (Orchestrator, CostTracker, SpecAccumulator)
- Edge function calls use `fetch` via `EdgeFunctionClient`; direct LLM calls use Anthropic SDK
- British English in user-facing strings (colour, organisation)
- Error handling: throw typed errors, catch at boundaries (CLI, Express routes)
- All file I/O uses absolute paths resolved from project root
- React components use named function exports
- CSS uses BirthBuild design tokens from `src/client/styles/tokens.css`

## Architecture

### Two Execution Modes

1. **CLI (v1)** — `run.ts` uses `lib/` modules directly. Chatbot is simulated locally via Claude API with system prompt + tools (Mode B). Self-contained, no Supabase needed.

2. **Dashboard (v2)** — `src/server/` orchestrator calls production Supabase edge functions. The chatbot is the real BirthBuild `/chat` endpoint. Persona agent and judge still call Claude directly via Anthropic SDK.

### Edge Function Contracts

See `docs/edge-function-contracts.md` for full details. Key points:
- `/chat` takes `{ messages }` (full history), returns raw Claude API format with `content[]` blocks
- Tool calls in chat responses (`update_business_info`, `update_style`, etc.) are extracted and accumulated by `SpecAccumulator` during the conversation loop, then upserted to Supabase
- Completion detected via `mark_step_complete` tool call with `next_step === "complete"`
- Auth uses `Bearer <JWT>` in `Authorization` header (EdgeFunctionClient adds prefix automatically)
- `/build` takes `{ site_spec_id, files[] }` — files generated by `site-generator.ts` from the accumulated spec

### Dashboard Architecture

- Express `createApp()` factory enables testing without side effects
- `dotenv.config()` only runs in production (not during tests)
- SSE streams tracked per-run via `activeStreams` Map (initialized on POST, cleaned up on done/error)
- Late-joining SSE clients get immediate `done` or `error` if run already completed
- Progress `step: "error"` is remapped to avoid conflicting with SSE error events
- Vite proxies `/api` to Express in dev mode

### Three LLM Roles

| Role | Model | Purpose |
|------|-------|---------|
| Persona Simulator | claude-sonnet-4-5-20250929 | Acts as the user |
| Target Chatbot | Production edge function | System under test |
| Judge Evaluator | claude-sonnet-4-5-20250929 | Scores conversations |

### Cost Tracking

- `CostTracker` records direct calls (persona, judge) with exact token counts
- Edge function calls are estimated from response `usage` field
- Model rates: Sonnet ($3/$15 per M tokens), Opus ($15/$75), Haiku ($0.80/$4)
- Daily budget tracked in `harness-config.json`, displayed on dashboard

## Key Constraints

- Persona agent NEVER sees the chatbot's system prompt or tool calls
- Max 60 conversation turns per simulation (configurable in dashboard)
- Judge uses a single `submit_evaluation` tool for structured output
- Runs stored as UUID-named directories under `runs/` (timestamp in summary.json)
- CLI and dashboard share persona definitions and evaluation criteria
- Dashboard runs require real Supabase credentials; CLI runs are self-contained

## Important Notes

- **tsx watch does NOT reload `.env` changes** — must restart `npm run dev` manually after editing `.env`
- **AUTH_TOKEN JWTs expire** — magic link JWTs have limited lifetime; refresh from Supabase dashboard (Authentication → Users or browser Local Storage `sb-*-auth-token` → `access_token`)
- **Kill stale servers** — `lsof -i :3001` to find, `kill <PID>` to remove; stale processes serve old code
- Build failures are non-fatal — conversation, site_spec, evaluation, and cost data are preserved

### Build Pipeline

1. During conversation, `SpecAccumulator` captures tool calls (update_business_info, update_style, update_content, update_bio_depth, update_contact, update_pages) and accumulates a local `SiteSpec`
2. After conversation ends, accumulated spec is upserted to Supabase via `upsertSiteSpec`
3. `site-generator.ts` generates HTML/CSS files from the spec (home, about, services, contact + conditional testimonials/faq + sitemap/robots.txt)
4. Generated files are passed to `/build` endpoint → Netlify deployment → preview URL
5. Both `accumulated-spec.json` (local) and `site-spec.json` (DB) are saved for comparison

## Known Limitations

- Pre-existing CLI runs use timestamp-named directories; new dashboard runs use UUID directories. Both formats are supported by the cost aggregator and run listing.
- Site generation is self-contained in the harness (ported from BirthBuild). It does not include photos, Schema.org JSON-LD, or the advanced design editor's custom fonts/spacing. These are cosmetic differences only.
