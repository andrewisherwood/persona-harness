# Persona Testing Harness

Automated conversation testing harness for Dopamine Labs chatbot products. Simulates user personas against a chatbot, evaluates conversations with an LLM judge, and reports quality scores with regression detection.

**v2** adds a React dashboard, production Supabase edge function integration, full build pipeline, A/B prompt comparison, and cost tracking.

## Tech Stack

- **Runtime:** Node.js + TypeScript (strict mode)
- **LLM:** Anthropic Claude via `@anthropic-ai/sdk`, OpenAI via `openai`
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
│           ├── creative-engine.ts      # Creative build engine (direct API, multi-provider)
│           ├── creative-run-db.ts      # Supabase CRUD for creative_runs + creative_run_pages
│           ├── creative-run-types.ts   # Types for creative run DB tables
│           ├── html-metrics.ts         # HTML metrics extraction (headings, landmarks, etc.)
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
│   ├── creative-build.ts     # CLI wrapper for creative engine
│   ├── creative-deploy.ts    # Manual Netlify deploy for creative runs
│   └── smoke-test.ts         # Manual E2E integration test
├── runs/                     # Output directory (gitignored)
├── run.ts                    # CLI entry point
├── tests/                    # Vitest test files (193 tests, 23 files)
├── docs/
│   ├── edge-function-contracts.md  # Production edge function HTTP contracts
│   ├── plans/                      # Design + implementation plans
│   └── research/                   # Multi-model comparison research
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
npm test                  # Run all 193 tests
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
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (for site_spec CRUD + auth token generation)
- `TEST_TENANT_ID` — Test tenant UUID
- `TEST_USER_ID` — Test user UUID
- `API_PORT` — Express server port (default: 3001)
- `BIRTHBUILD_ROOT` — Path to BirthBuild project root (for reading/writing prompt templates)
- `AUTH_TOKEN` — (optional) Manual override; auto-generated from TEST_USER_ID if omitted
- `OPENAI_API_KEY` — (optional) OpenAI API key for multi-model A/B testing; auto-injected when provider is "openai"

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health + env var status |
| GET | `/api/personas` | List all personas |
| GET | `/api/personas/:id` | Get persona details |
| GET | `/api/prompts` | Full manifest (prompt types + variants) |
| GET | `/api/prompts/:type/:variant` | Read prompt template content |
| PUT | `/api/prompts/:type/:variant` | Update prompt template content |
| POST | `/api/prompts/:type` | Create new variant |
| DELETE | `/api/prompts/:type/:variant` | Delete variant |
| POST | `/api/prompts/:type/:variant/duplicate` | Duplicate variant |
| PUT | `/api/prompts/:type/production` | Set production variant |
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
| GET | `/api/research/runs` | List creative runs |
| GET | `/api/research/runs/:id` | Get creative run detail + pages |
| POST | `/api/research/runs` | Start a creative build |
| GET | `/api/research/runs/:id/stream` | SSE stream for creative build progress |

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
- Auth uses `Bearer <JWT>` in `Authorization` header (EdgeFunctionClient adds prefix automatically; token auto-generated per run)
- `/build` takes `{ site_spec_id, files[] }` — files generated by `site-generator.ts` from the accumulated spec

### Dashboard Architecture

- Express `createApp()` factory enables testing without side effects
- `dotenv.config()` only runs in production (not during tests)
- SSE streams tracked per-run via `activeStreams` Map (initialized on POST, cleaned up on done/error)
- Late-joining SSE clients get immediate `done` or `error` if run already completed
- Progress `step: "error"` is remapped to avoid conflicting with SSE error events
- Vite proxies `/api` to Express in dev mode

### Multi-Model A/B Testing

The dashboard supports swapping the LLM backend for site generation via `promptConfig` in the run config. The `model-client.ts` in BirthBuild normalises Anthropic and OpenAI APIs into a common interface.

**Supported providers:** Anthropic (Claude Sonnet 4.5, Opus 4.6, Haiku 4.5), OpenAI (GPT-5.2, GPT-5.2 Pro, GPT-5 Mini)

**How it works:** `promptConfig` flows from RunConfig UI → runs route → orchestrator → EdgeFunctionClient → edge functions. The orchestrator auto-injects `OPENAI_API_KEY` from `.env` when the provider is "openai".

**POST /api/runs body for build-only A/B test:**
```json
{
  "personaId": "detailed-dina",
  "vertical": "birthbuild",
  "mode": "build-only",
  "promptConfig": {
    "modelProvider": "anthropic",
    "modelName": "claude-opus-4-6",
    "temperature": 0.7,
    "maxTokens": 8192
  }
}
```

Note: The `mode` field must be `"build-only"` (not `buildOnly: true`). Getting this wrong triggers a full-pipeline run.

### Three LLM Roles

| Role | Model | Purpose |
|------|-------|---------|
| Persona Simulator | claude-sonnet-4-5-20250929 | Acts as the user |
| Target Chatbot | Production edge function | System under test (model swappable via promptConfig) |
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
- **Auth tokens auto-refresh** — `generateAuthToken()` uses service role key to create a magic link for TEST_USER_ID, then exchanges the hashed_token via `verifyOtp` to get a fresh session. This runs automatically before each orchestrator run, so expired JWTs are no longer a problem. Manual `AUTH_TOKEN` in `.env` is still supported as an override.
- **Kill stale servers** — `lsof -i :3001` to find, `kill <PID>` to remove; stale processes serve old code
- Build failures are non-fatal — conversation, site_spec, evaluation, and cost data are preserved

### Build Pipeline

1. During conversation, `SpecAccumulator` captures tool calls (update_business_info, update_style, update_content, update_bio_depth, update_contact, update_pages) and accumulates a local `SiteSpec`
2. After conversation ends, accumulated spec is upserted to Supabase via `upsertSiteSpec`
3. `site-generator.ts` generates HTML/CSS files from the spec (home, about, services, contact + conditional testimonials/faq + sitemap/robots.txt)
4. Generated files are passed to `/build` endpoint → Netlify deployment → preview URL
5. Both `accumulated-spec.json` (local) and `site-spec.json` (DB) are saved for comparison

## Prompt Optimisation Workflow

The harness enables rapid iteration on BirthBuild's edge function prompts via **build-only mode** (~2 min per cycle vs 15+ min for a full conversation run).

### Workflow

1. Edit prompt in BirthBuild (`supabase/functions/`)
2. Deploy edge function (`supabase functions deploy <name>`)
3. Trigger build-only run from the dashboard (reuses a saved site spec)
4. Inspect the deployed preview site for regressions

### Key BirthBuild Files (prompt optimisation)

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/prompts/design-system/v1-structured.md` | Template prompt for design system CSS generation |
| `supabase/functions/generate-design-system/index.ts` | Hardcoded prompt + `REQUIRED_CSS_SELECTORS` validation |
| `supabase/functions/generate-page/index.ts` | Per-page prompt with photo injection via `buildSystemPrompt()` |
| `supabase/functions/_shared/sanitise-html.ts` | CSS sanitiser — `enforceDesignSystemCss()` |
| `supabase/functions/_shared/model-client.ts` | Multi-provider LLM client (Anthropic + OpenAI) |

### Page Generation: No Template Override

`generate-page` always uses the hardcoded `buildSystemPrompt()` — it does NOT support `prompt_config.system_prompt` template overrides. This is because the page prompt is tightly coupled to runtime data: photo URLs, conditional hero/card markup, and page-specific instructions are injected dynamically. The `resolveTemplate()` path was removed after it was found to bypass photo injection entirely.

### Critical Constraint: `enforceDesignSystemCss()`

`generate-page/index.ts` calls `enforceDesignSystemCss()` which strips ALL `<style>` blocks from generated pages and re-injects only the design system CSS. Any CSS class used in page HTML **must** be defined in the design system prompt — page-level styles will be discarded.

If a page layout looks broken (flat, stacked, unstyled), the first thing to check is whether the required CSS selectors are in the design system prompt and the `REQUIRED_CSS_SELECTORS` validation array.

## Multi-Model Research

Active research comparing site generation quality across LLM providers. See `docs/research/2026-02-23-multi-model-site-generation.md` for full findings.

### Two Build Modes

1. **Constrained** (edge functions) — Enforced CSS selectors, HTML templates, `enforceDesignSystemCss()`. Predictable output, suitable for Sonnet at scale. ~$0.30/site, ~2 min.

2. **Creative** (`src/server/engine/creative-engine.ts`) — Calls Anthropic or OpenAI API directly. Client's palette/typography/style/feeling as constraints, full creative freedom on layout/components/hierarchy. Opus produces dramatically superior designs. ~$6.55/site, ~11 min.

### Creative Build Engine

The creative build logic lives in `src/server/engine/creative-engine.ts` and is used by both the dashboard and CLI. It exports `executeCreativeBuild(config, supabaseConfig, onProgress)` which generates a design system + 6 pages, records results to the `creative_runs`/`creative_run_pages` tables, and optionally deploys to Netlify.

**Dashboard:** Navigate to `/research/new` to configure model, palette, typography, style, feeling, and temperature. Click "Start Build" to trigger an async creative build with SSE progress streaming at `/research/run/:id`.

**CLI:** `scripts/creative-build.ts` is a thin wrapper:
```bash
npx tsx scripts/creative-build.ts --model claude-opus-4-6 --palette sage_sand
npx tsx scripts/creative-build.ts --model gpt-5.2 --no-db
npx tsx scripts/creative-deploy.ts runs/creative-*   # manual deploy
```

**Supported models:** Anthropic (Opus 4.6, Sonnet 4.5, Haiku 4.5), OpenAI (GPT-5.2, GPT-5.2 Pro, GPT-5 Mini). Provider detected automatically from model name.

**Deploy uniqueness:** Before calling `/build`, the engine clears `netlify_site_id` and `subdomain_slug` on the Dina site spec so each deploy gets a fresh auto-generated subdomain. Without this, every build overwrites the same Netlify site.

Output includes HTML, CSS, accessibility trees (Playwright), full-page screenshots, and a manifest with token counts/costs.

### Key Findings

- **Hypothesis proven:** Opus 4.6 with creative freedom produces visually stunning sites that far exceed constrained builds
- The creative prompt honours the client's design choices (colours, fonts, style, feeling) while giving the model freedom over layout and composition
- GPT-5.2 requires `max_completion_tokens` (not `max_tokens`) — fixed in `model-client.ts`
- GPT-5.2 copywriting arguably warmer/better; structural compliance equal
- Edge function rate limit: 20 generate-page requests per hour per user

### Dashboard Routes (Research)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/research` | `Research` | List of creative runs with "New Build" button |
| `/research/new` | `CreativeBuildConfig` | Config form (model, palette, typography, style, feeling, temperature) |
| `/research/run/:id` | `CreativeBuildProgress` | SSE progress page with step indicator |
| `/research/compare` | `ResearchCompare` | Side-by-side run comparison |
| `/research/:id` | `ResearchDetail` | Run detail with page previews + metrics |

### Live Sites

| Build | Model | URL |
|-------|-------|-----|
| Constrained baseline | Sonnet 4.5 | `birthbuild-dina-hart-1joo.netlify.app` |
| Constrained | GPT-5.2 | `birthbuild-dina-hart-tlb8.netlify.app` |
| **Creative** | **Opus 4.6** | **`birthbuild-dina-hart-63wr.netlify.app`** |

### Stock Photos

8 stock photos for Dina Hart in `stock_photos/Dina/` and uploaded to Supabase storage. The `STOCK_PHOTOS` array in `supabase-client.ts` has the correct clean filenames.

## Known Limitations

- Pre-existing CLI runs use timestamp-named directories; new dashboard runs use UUID directories. Both formats are supported by the cost aggregator and run listing.
- Site generation is self-contained in the harness (ported from BirthBuild). It does not include photos, Schema.org JSON-LD, or the advanced design editor's custom fonts/spacing. These are cosmetic differences only.
- Only `detailed-dina` has a saved site spec for build-only mode. Other personas (`nervous-nora`, `sparse-sarah`) require a full-pipeline run first to capture their spec.
