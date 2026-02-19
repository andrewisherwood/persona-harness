# BirthBuild Test Harness v2 — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Upgrade the persona harness into a full BirthBuild test harness with a React dashboard, production endpoint integration, full build pipeline, A/B prompt comparison, and cost tracking.

**Architecture:** Standalone repo with an embedded Express server inside a Vite React app. Calls deployed Supabase edge functions as a black-box tester of the production BirthBuild system. Streams real-time progress via SSE. Stores results as JSON on disk.

**Tech Stack:** React 18, Vite, React Router 7, TypeScript, Express (embedded), @supabase/supabase-js, BirthBuild design tokens, Server-Sent Events.

---

## 1. Architecture

```
┌─────────────────────────────────────────────┐
│              React Dashboard (Vite)          │
│  ┌──────────┬──────────┬──────────────────┐  │
│  │ Run      │ A/B      │ Results          │  │
│  │ Config   │ Compare  │ Explorer         │  │
│  │ Panel    │ View     │ (conversations,  │  │
│  │          │          │  specs, URLs)    │  │
│  └──────────┴──────────┴──────────────────┘  │
│              ↕ SSE + REST                    │
│  ┌──────────────────────────────────────────┐│
│  │         Express API (embedded)           ││
│  │  /api/runs     /api/personas             ││
│  │  /api/results  /api/prompts              ││
│  │  /api/stream   /api/config               ││
│  └──────────────────────────────────────────┘│
└──────────────┬───────────────────────────────┘
               │ HTTP
               ↓
┌──────────────────────────────────────────────┐
│     Supabase Edge Functions (production)     │
│  /chat  /build  /generate-*  /publish        │
└──────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────┐
│        Supabase DB (site_specs table)        │
└──────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────┐
│          Netlify (deployed preview)          │
└──────────────────────────────────────────────┘
```

The harness sits between the user and the production BirthBuild system. It calls the same endpoints a real user's browser would call, but with a persona agent driving the conversation instead of a human.

### Key Principle

The **persona agent** calls Anthropic directly (it simulates a user typing). The **chatbot** is tested through the deployed edge functions — no local prompt copies, no drift from production.

## 2. Run Modes

### Mode 1: Full Pipeline (Persona → Chat → Build → Preview)

1. Persona agent generates a message based on persona definition + conversation history
2. Message sent to the deployed `/chat` edge function via HTTP
3. Chat endpoint processes message, calls Anthropic internally, makes tool calls to update `site_specs` table
4. Response returned to persona agent; conversation continues
5. After conversation completes (chatbot marks review step complete), harness reads the final `site_spec` from Supabase
6. Harness calls `/build` endpoint → triggers `generate-design-system` + `generate-page` pipeline
7. Harness calls `/publish` → site deployed to Netlify
8. Preview URL returned and stored with results

### Mode 2: Build-Only (Saved Spec → Build → Preview)

1. Load a `site_spec` JSON saved from a previous Mode 1 run
2. Upsert into Supabase `site_specs` table (using service role key)
3. Call `/build` → `/publish`
4. Preview URL returned

### A/B Mode: Two Prompts Side-by-Side

1. User selects a persona and two prompt variants (A and B)
2. Harness runs Mode 1 twice in sequence — once per prompt
3. Both conversations, site_specs, evaluation scores, and preview URLs stored together
4. Dashboard displays results side-by-side with diff highlighting

**Prompt variants** are managed as:
- **Production:** The current system prompt served by the deployed edge function (default)
- **Local overrides:** Modified prompt files stored in `prompts/` directory. When a local override is selected, the harness must inject it — either by:
  - Calling a test-mode endpoint that accepts a custom system prompt (if BirthBuild supports it)
  - Or temporarily updating the prompt in Supabase via service role (with automatic rollback)

> **Open question for implementation:** How does the harness inject a different prompt into the deployed `/chat` endpoint? Options: (a) the edge function accepts a `system_prompt_override` param gated behind a test key, (b) we update the prompt source in Supabase before the run and revert after, (c) for A/B we call Anthropic directly with the custom prompt (hybrid mode). Decision needed during implementation.

## 3. Dashboard Pages

### 3.1 Run Configuration

The landing page. Configure and launch test runs.

- **Persona selector:** Checkboxes for each persona (Detailed Dina, Nervous Nora, Sparse Sarah, etc.). Enable/disable individually.
- **Mode selector:** Full Pipeline / Build-Only toggle
- **Prompt selector:** Dropdown listing "Production (live)" + any local override files in `prompts/`
- **A/B toggle:** When enabled, shows a second prompt dropdown. Both run in sequence.
- **Advanced settings (collapsible):**
  - Max conversation turns (slider, default 80)
  - Persona model (dropdown: Sonnet, Haiku)
  - Judge model (dropdown: Sonnet, Opus)
  - Enable/disable evaluation (skip judge to save cost)
  - Enable/disable build step (stop at site_spec to save cost)
- **Budget guard:** Shows estimated cost for the configured run. Warns if over daily budget.
- **"Start Run" button:** Launches the run and navigates to the progress view.

### 3.2 Run Progress (Live)

Real-time view of an active run, streamed via SSE.

- **Step indicator:** Chatting → Evaluating → Building → Deploying → Complete
- **Live conversation:** Messages appear as they happen. Persona messages on one side, chatbot on the other. Chat-bubble style using BirthBuild's conversation component patterns.
- **Metadata bar:** Elapsed time, turn count, running token count, estimated cost so far
- **Per-persona tabs:** When running multiple personas, each gets a tab. Runs happen sequentially (to avoid edge function rate limits).

### 3.3 Results Explorer

Browse all completed runs.

- **Run list:** Table/cards sorted by date, showing: date, personas run, mode, pass/fail badge, total cost, prompt used
- **Run detail (expandable):**
  - **Conversation transcript:** Expandable turns. Persona messages and chatbot messages in alternating style. Tool calls shown as collapsible details.
  - **Site Spec:** Collapsible JSON viewer with syntax highlighting. Key fields (business_name, palette, services, bio) highlighted.
  - **Evaluation:** Quality score (X/5), density score (X/25), per-criteria breakdown table, pass/fail badge with reason
  - **Preview URL:** Clickable link, opens in new tab. Optional: inline iframe preview.
  - **Prompt used:** View the system prompt that was active for this run.
  - **Cost breakdown:** Persona agent / chatbot (est.) / build (est.) / judge / total

### 3.4 A/B Comparison

Side-by-side comparison of two prompt variants.

- **Two-column layout:** Prompt A on left, Prompt B on right
- **Synced sections:** Conversations, site_specs, scores, previews shown in parallel
- **Diff highlighting:** Score differences highlighted (green = improvement, red = regression)
- **Preview comparison:** Both URLs side-by-side. Could embed iframes for visual comparison.
- **Cost comparison:** Which prompt variant was cheaper (fewer turns, smaller responses)

### 3.5 Prompts View

View and manage prompt variants.

- **Production prompt:** Fetched from the deployed system. Read-only display.
- **Local overrides:** List of prompt files in `prompts/` directory. View contents.
- **Diff view:** Compare any two prompts side-by-side with inline diff highlighting.

### 3.6 Settings

- **Supabase connection:** Project URL, service role key, test tenant ID, test user ID
- **Budget:** Daily budget threshold (USD). Warning and optional hard block.
- **Default models:** Persona agent model, judge model
- **Display preferences:** Dark/light mode (using BirthBuild tokens)

## 4. Design System

The dashboard uses BirthBuild's design tokens adapted for a developer tool context.

### Colour Palette

Use `sage_sand` as the base palette (the calmest, most neutral option):
- Background: `#FAF6F1` (warm cream)
- Surface: `#FFFFFF`
- Primary: `#7C8B6F` (sage)
- Secondary: `#C2B280` (sand)
- Text: `#2D2926` (near-black)
- Success: `#4CAF50`
- Warning: `#FF9800`
- Error: `#E53935`
- Pass badge: sage green
- Fail badge: muted red

### Typography

- Headings: BirthBuild's heading font (system or loaded)
- Body: System font stack for performance (`-apple-system, BlinkMacSystemFont, ...`)
- Code/JSON: `JetBrains Mono` or `SF Mono`

### Spacing & Radius

Follow BirthBuild's spacing scale (4px base unit) and border radius presets.

### Components

- Chat bubbles (persona left, chatbot right) — adapted from BirthBuild's conversation UI
- Collapsible panels for JSON/details
- Status badges (pass/fail/running)
- Score cards with progress indicators
- Side-by-side comparison layout
- SSE-powered streaming text

## 5. Cost Tracking

### Precise Tracking (Direct Anthropic Calls)

- **Persona agent:** We call Anthropic directly for the simulated user. Token counts (input/output) available from API response. Cost calculated using model rates.
- **Judge evaluator:** Same — direct Anthropic calls with known token usage.

### Estimated Tracking (Black-Box Edge Functions)

- **Chatbot edge function:** Each `/chat` call processes user message + conversation history + system prompt. Estimate: count tokens in request/response bodies, multiply by chatbot model rate.
- **Build pipeline:** Each `/generate-design-system` and `/generate-page` call. Estimate: count pages generated × average tokens per page generation call.

### Dashboard Display

- **Per-run cost card:** Breakdown by component (persona | chatbot est. | build est. | judge | total)
- **Cost over time chart:** Line chart of cumulative spend across runs, date on X axis
- **Budget threshold:** Set in settings. Progress bar shows spend vs budget. Warning colour when >80%. Optional: block new runs when exceeded.
- **A/B cost comparison:** Show cost difference between prompt variants

### Data Schema

```json
{
  "cost": {
    "persona_agent": {
      "input_tokens": 12400,
      "output_tokens": 3200,
      "model": "claude-sonnet-4-5-20250929",
      "usd": 0.08
    },
    "judge": {
      "input_tokens": 8900,
      "output_tokens": 1200,
      "model": "claude-sonnet-4-5-20250929",
      "usd": 0.04
    },
    "chatbot_estimated": {
      "messages": 45,
      "estimated_tokens": 52000,
      "usd_estimate": 0.31
    },
    "build_estimated": {
      "pages": 6,
      "estimated_tokens": 84000,
      "usd_estimate": 0.50
    },
    "total_usd": 0.93
  }
}
```

## 6. Data Storage

Results stored on disk as JSON in `runs/` (extending current pattern):

```
runs/
  2026-02-19T14-30-00/
    config.json                    # Run configuration
    detailed-dina/
      conversation.json            # Full message history
      site-spec.json               # Final spec from Supabase
      evaluation.json              # Judge scores
      cost.json                    # Cost breakdown
      preview-url.txt              # Deployed URL
    nervous-nora/
      ...
  ab-2026-02-19T15-00-00/
    config.json                    # A/B configuration (both prompts)
    prompt-a/
      detailed-dina/
        conversation.json
        site-spec.json
        evaluation.json
        cost.json
        preview-url.txt
    prompt-b/
      detailed-dina/
        ...
```

The Express API reads/writes this directory. The React frontend never touches the filesystem directly.

## 7. API Endpoints

### Express Routes (embedded in Vite dev server)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/personas` | List available personas from `personas/` dir |
| GET | `/api/prompts` | List prompt variants (production + local overrides) |
| GET | `/api/prompts/:name` | Get prompt content |
| POST | `/api/runs` | Start a new run (returns run ID) |
| GET | `/api/runs` | List all completed runs |
| GET | `/api/runs/:id` | Get run details |
| GET | `/api/runs/:id/stream` | SSE stream of run progress |
| GET | `/api/runs/:id/:persona/conversation` | Get conversation for a persona |
| GET | `/api/runs/:id/:persona/site-spec` | Get site spec |
| GET | `/api/runs/:id/:persona/evaluation` | Get evaluation |
| GET | `/api/runs/:id/:persona/cost` | Get cost breakdown |
| GET | `/api/config` | Get settings |
| PUT | `/api/config` | Update settings |
| GET | `/api/cost/summary` | Get aggregate cost data |

### SSE Event Types

```
event: run_started
data: { "run_id": "...", "personas": [...], "mode": "full" }

event: persona_started
data: { "persona": "detailed-dina", "step": "chatting" }

event: message
data: { "persona": "detailed-dina", "role": "user"|"assistant", "content": "..." }

event: step_changed
data: { "persona": "detailed-dina", "step": "evaluating"|"building"|"deploying" }

event: persona_completed
data: { "persona": "detailed-dina", "score": 5, "density": 20, "preview_url": "...", "cost": 0.45 }

event: run_completed
data: { "run_id": "...", "total_cost": 0.93, "results_summary": {...} }
```

## 8. Supabase Integration

### Authentication

The harness uses a **service role key** to bypass RLS. This allows:
- Creating test site_spec records
- Reading completed site_specs
- Upserting fixture specs (Mode 2)

### Test Isolation

A dedicated **test tenant ID** and **test user ID** ensure harness runs don't pollute production data. These are configured in settings.

### Edge Function Calls

The harness calls edge functions the same way the BirthBuild frontend does:

```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    site_spec_id: siteSpecId,
    message: personaMessage,
    chat_history: conversationHistory,
  }),
});
```

The exact request/response shape must match what BirthBuild's frontend sends. This will be determined during implementation by reading the edge function code.

## 9. Persona Engine (Evolved)

The persona engine evolves from the current `lib/simulator.ts`:

- **Current:** Calls Anthropic directly with a local system prompt copy. Accumulates site_spec in memory from tool calls.
- **v2:** Calls Anthropic directly for the *persona agent only*. Sends persona messages to the deployed `/chat` endpoint. Site_spec accumulation happens server-side in Supabase (no local tracking needed).

The persona agent still needs:
- The persona definition (JSON with seed_data, gaps, triggers)
- A system prompt telling it how to behave
- Conversation history (its own messages + chatbot responses from `/chat`)

The chatbot's tool calls are no longer visible to the harness (they happen inside the edge function). The harness reads the final site_spec from Supabase after the conversation ends.

## 10. Evaluation

The judge evaluator from the current harness is reused:
- After conversation completes, the judge reviews the full transcript
- Scores against persona-specific criteria (quality 1-5, density 0-25)
- Results stored in `evaluation.json`

The density scoring may need adaptation since we read the site_spec from Supabase rather than accumulating it locally. The Supabase schema fields map to the density criteria.

## 11. Project Structure

```
persona-harness/
  package.json
  vite.config.ts
  tsconfig.json
  .env                          # Supabase URL, keys, etc.
  src/
    client/                     # React frontend
      App.tsx
      main.tsx
      pages/
        RunConfig.tsx
        RunProgress.tsx
        Results.tsx
        ABComparison.tsx
        Prompts.tsx
        Settings.tsx
      components/
        ChatBubble.tsx
        ScoreCard.tsx
        CostBreakdown.tsx
        JsonViewer.tsx
        DiffViewer.tsx
        PersonaSelector.tsx
        PromptSelector.tsx
        StatusBadge.tsx
      hooks/
        useSSE.ts
        useRuns.ts
        useCost.ts
      styles/
        tokens.css              # BirthBuild design tokens
        global.css
    server/                     # Express backend
      index.ts                  # Express app setup
      routes/
        runs.ts
        personas.ts
        prompts.ts
        config.ts
        cost.ts
      engine/
        orchestrator.ts         # Run orchestration
        persona-agent.ts        # Persona LLM agent
        supabase-client.ts      # Supabase integration
        edge-function-client.ts # HTTP calls to edge functions
        judge.ts                # Evaluation judge
        cost-tracker.ts         # Token/cost tracking
      storage/
        runs.ts                 # Read/write runs directory
  personas/                     # Persona definitions (JSON)
    birthbuild/
      detailed-dina.json
      nervous-nora.json
      sparse-sarah.json
  prompts/                      # Local prompt overrides
    birthbuild/
      system-prompt.md          # Current local copy
  runs/                         # Run results (gitignored)
  criteria/                     # Evaluation criteria
    birthbuild/
      ...
```

## 12. Open Questions (Resolve During Implementation)

1. **Prompt injection for A/B:** How does the harness inject a different system prompt into the deployed `/chat` endpoint? Need to check if the edge function supports an override parameter or if we need to temporarily modify the prompt source.

2. **Chat endpoint contract:** What exact request/response shape does `/chat` expect? Need to read the edge function code to match it precisely.

3. **Build polling:** After calling `/build`, how do we know when it's done? Poll the site_spec status field? Webhook? Need to match BirthBuild's frontend behavior.

4. **Preview URL source:** Where does the deployed URL come from after publish? Is it in the site_spec record? A separate table? The publish response?

5. **Conversation completion signal:** How does the harness know the conversation is "done"? Does the chatbot send a specific signal at the review step? Or do we track step completion via site_spec fields?
