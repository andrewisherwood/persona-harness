# BirthBuild Test Harness v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the persona harness into a full BirthBuild test harness with a React dashboard, production endpoint integration, full build pipeline, A/B prompt comparison, and cost tracking.

**Architecture:** Standalone Vite + React frontend with embedded Express API server. Calls deployed Supabase edge functions. Streams real-time progress via SSE. Stores results as JSON on disk.

**Tech Stack:** React 18, Vite 6, React Router 7, TypeScript, Express, @supabase/supabase-js, Server-Sent Events, Vitest.

---

## Phase 1: Project Restructure & Scaffolding

### Task 1: Install Dependencies and Update package.json

**Files:**
- Modify: `package.json`

**Step 1: Install frontend dependencies**

Run:
```bash
cd /Users/andrew/Documents/DopamineLaboratory/Apps/Plugins/persona-harness
npm install react@18 react-dom@18 react-router-dom@7 @supabase/supabase-js
```

**Step 2: Install backend dependencies**

Run:
```bash
npm install express cors dotenv
```

**Step 3: Install dev dependencies**

Run:
```bash
npm install -D @types/react @types/react-dom @types/express @types/cors @vitejs/plugin-react vite
```

**Step 4: Verify installation**

Run: `npm ls --depth=0`
Expected: All packages listed without errors.

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add React, Vite, Express, Supabase dependencies for v2 dashboard"
```

---

### Task 2: Create Vite Config with Express Middleware

**Files:**
- Create: `vite.config.ts`
- Modify: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `tsconfig.client.json`

**Step 1: Create vite.config.ts**

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: "index.html",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

**Step 2: Create tsconfig.server.json for server code**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist/server",
    "rootDir": ".",
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src/server/**/*", "lib/**/*", "personas/**/*", "criteria/**/*"],
  "exclude": ["node_modules", "dist", "runs"]
}
```

**Step 3: Create tsconfig.client.json for React code**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "sourceMap": true,
    "outDir": "dist/client",
    "rootDir": ".",
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src/client/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Update root tsconfig.json to reference both**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": ".",
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*", "lib/**/*", "personas/**/*", "criteria/**/*", "run.ts"],
  "exclude": ["node_modules", "dist", "runs"]
}
```

**Step 5: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: No errors (existing code still compiles).

**Step 6: Commit**

```bash
git add vite.config.ts tsconfig.json tsconfig.server.json tsconfig.client.json
git commit -m "feat: add Vite config and split TypeScript configs for client/server"
```

---

### Task 3: Create Directory Structure and Entry Points

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/server/index.ts`
- Create: `index.html`
- Create: `.env.example`

**Step 1: Create index.html (Vite entry)**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BirthBuild Test Harness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

**Step 2: Create React entry point**

```tsx
// src/client/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 3: Create App shell**

```tsx
// src/client/App.tsx
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";

export function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <nav style={{ width: 220, padding: 16, borderRight: "1px solid #eee" }}>
          <h2>Test Harness</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li><NavLink to="/">Run</NavLink></li>
            <li><NavLink to="/results">Results</NavLink></li>
            <li><NavLink to="/compare">A/B Compare</NavLink></li>
            <li><NavLink to="/prompts">Prompts</NavLink></li>
            <li><NavLink to="/settings">Settings</NavLink></li>
          </ul>
        </nav>
        <main style={{ flex: 1, padding: 24 }}>
          <Routes>
            <Route path="/" element={<div>Run Configuration — coming soon</div>} />
            <Route path="/progress/:runId" element={<div>Run Progress — coming soon</div>} />
            <Route path="/results" element={<div>Results — coming soon</div>} />
            <Route path="/results/:runId" element={<div>Run Detail — coming soon</div>} />
            <Route path="/compare" element={<div>A/B Compare — coming soon</div>} />
            <Route path="/prompts" element={<div>Prompts — coming soon</div>} />
            <Route path="/settings" element={<div>Settings — coming soon</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

**Step 4: Create Express server entry**

```typescript
// src/server/index.ts
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export { app };
```

**Step 5: Create .env.example**

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TEST_TENANT_ID=
TEST_USER_ID=
API_PORT=3001
```

**Step 6: Update package.json scripts**

Add to scripts:
```json
{
  "dev": "concurrently \"npx tsx src/server/index.ts\" \"npx vite\"",
  "dev:client": "vite",
  "dev:server": "tsx watch src/server/index.ts",
  "harness": "tsx run.ts",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

Also install concurrently: `npm install -D concurrently`

**Step 7: Verify both start**

Run: `npx tsx src/server/index.ts &` (background), then `curl http://localhost:3001/api/health`
Expected: `{"status":"ok","timestamp":"..."}`
Kill the background process.

Run: `npx vite --open` (verify React app loads at localhost:5173)
Kill with Ctrl+C.

**Step 8: Commit**

```bash
git add src/ index.html .env.example package.json package-lock.json
git commit -m "feat: scaffold Vite + React + Express project structure"
```

---

## Phase 2: Server Engine — Supabase & Edge Function Integration

### Task 4: Supabase Client Module

**Files:**
- Create: `src/server/engine/supabase-client.ts`
- Create: `tests/supabase-client.test.ts`

**Step 1: Write the test**

```typescript
// tests/supabase-client.test.ts
import { describe, it, expect } from "vitest";
import { buildSupabaseConfig, validateConfig } from "../src/server/engine/supabase-client.js";

describe("supabase-client", () => {
  it("validates required config fields", () => {
    expect(() => validateConfig({})).toThrow("SUPABASE_URL is required");
    expect(() => validateConfig({ supabaseUrl: "https://x.supabase.co" })).toThrow("SUPABASE_ANON_KEY is required");
  });

  it("builds config from env-like object", () => {
    const config = buildSupabaseConfig({
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      TEST_TENANT_ID: "tenant-1",
      TEST_USER_ID: "user-1",
    });
    expect(config.supabaseUrl).toBe("https://test.supabase.co");
    expect(config.anonKey).toBe("anon-key");
    expect(config.serviceRoleKey).toBe("service-key");
    expect(config.testTenantId).toBe("tenant-1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/supabase-client.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement supabase-client.ts**

```typescript
// src/server/engine/supabase-client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  testTenantId: string;
  testUserId: string;
}

export function validateConfig(config: Partial<SupabaseConfig>): asserts config is SupabaseConfig {
  if (!config.supabaseUrl) throw new Error("SUPABASE_URL is required");
  if (!config.anonKey) throw new Error("SUPABASE_ANON_KEY is required");
  if (!config.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  if (!config.testTenantId) throw new Error("TEST_TENANT_ID is required");
  if (!config.testUserId) throw new Error("TEST_USER_ID is required");
}

export function buildSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  return {
    supabaseUrl: env.SUPABASE_URL ?? "",
    anonKey: env.SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    testTenantId: env.TEST_TENANT_ID ?? "",
    testUserId: env.TEST_USER_ID ?? "",
  };
}

export function createServiceClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey);
}

export function createAnonClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.anonKey);
}

export interface SiteSpecRow {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
  business_name: string | null;
  [key: string]: unknown;
}

export async function createTestSiteSpec(
  client: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<string> {
  const { data, error } = await client
    .from("site_specs")
    .insert({ tenant_id: tenantId, user_id: userId, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create test site_spec: ${error.message}`);
  return data.id;
}

export async function getSiteSpec(
  client: SupabaseClient,
  siteSpecId: string,
): Promise<SiteSpecRow> {
  const { data, error } = await client
    .from("site_specs")
    .select("*")
    .eq("id", siteSpecId)
    .single();
  if (error) throw new Error(`Failed to read site_spec: ${error.message}`);
  return data;
}

export async function upsertSiteSpec(
  client: SupabaseClient,
  siteSpecId: string,
  spec: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("site_specs")
    .upsert({ id: siteSpecId, ...spec });
  if (error) throw new Error(`Failed to upsert site_spec: ${error.message}`);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/supabase-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/engine/supabase-client.ts tests/supabase-client.test.ts
git commit -m "feat: add Supabase client module with config validation"
```

---

### Task 5: Edge Function Client

**Files:**
- Create: `src/server/engine/edge-function-client.ts`
- Create: `tests/edge-function-client.test.ts`

**Step 1: Write the test**

```typescript
// tests/edge-function-client.test.ts
import { describe, it, expect } from "vitest";
import { buildChatRequest, buildBuildRequest, EdgeFunctionClient } from "../src/server/engine/edge-function-client.js";

describe("edge-function-client", () => {
  it("builds a chat request body", () => {
    const body = buildChatRequest({
      siteSpecId: "spec-1",
      message: "Hello",
      chatHistory: [],
    });
    expect(body.site_spec_id).toBe("spec-1");
    expect(body.message).toBe("Hello");
    expect(body.chat_history).toEqual([]);
  });

  it("builds a build request body", () => {
    const body = buildBuildRequest({ siteSpecId: "spec-1" });
    expect(body.site_spec_id).toBe("spec-1");
  });

  it("constructs endpoint URLs from base URL", () => {
    const client = new EdgeFunctionClient({
      supabaseUrl: "https://abc.supabase.co",
      anonKey: "key-123",
    });
    expect(client.chatUrl).toBe("https://abc.supabase.co/functions/v1/chat");
    expect(client.buildUrl).toBe("https://abc.supabase.co/functions/v1/build");
    expect(client.publishUrl).toBe("https://abc.supabase.co/functions/v1/publish");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/edge-function-client.test.ts`
Expected: FAIL

**Step 3: Implement edge-function-client.ts**

```typescript
// src/server/engine/edge-function-client.ts

export interface EdgeFunctionConfig {
  supabaseUrl: string;
  anonKey: string;
}

export interface ChatRequest {
  siteSpecId: string;
  message: string;
  chatHistory: Array<{ role: string; content: string }>;
}

export interface ChatResponse {
  message: string;
  chat_history: Array<{ role: string; content: string }>;
  tool_calls?: Array<{ name: string; input: Record<string, unknown> }>;
  step_completed?: string;
  is_complete?: boolean;
}

export function buildChatRequest(req: ChatRequest) {
  return {
    site_spec_id: req.siteSpecId,
    message: req.message,
    chat_history: req.chatHistory,
  };
}

export function buildBuildRequest(req: { siteSpecId: string }) {
  return { site_spec_id: req.siteSpecId };
}

export class EdgeFunctionClient {
  readonly chatUrl: string;
  readonly buildUrl: string;
  readonly publishUrl: string;
  private readonly anonKey: string;

  constructor(config: EdgeFunctionConfig) {
    const base = config.supabaseUrl.replace(/\/$/, "");
    this.chatUrl = `${base}/functions/v1/chat`;
    this.buildUrl = `${base}/functions/v1/build`;
    this.publishUrl = `${base}/functions/v1/publish`;
    this.anonKey = config.anonKey;
  }

  private headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.anonKey}`,
      "Content-Type": "application/json",
    };
  }

  async sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(this.chatUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildChatRequest(req)),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chat endpoint error ${response.status}: ${text}`);
    }
    return response.json();
  }

  async triggerBuild(siteSpecId: string): Promise<{ buildId: string }> {
    const response = await fetch(this.buildUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildBuildRequest({ siteSpecId })),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Build endpoint error ${response.status}: ${text}`);
    }
    return response.json();
  }

  async triggerPublish(siteSpecId: string): Promise<{ previewUrl: string }> {
    const response = await fetch(this.publishUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ site_spec_id: siteSpecId }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Publish endpoint error ${response.status}: ${text}`);
    }
    return response.json();
  }

  async waitForBuild(
    siteSpecId: string,
    pollFn: () => Promise<string>,
    timeoutMs: number = 120_000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await pollFn();
      if (status === "built" || status === "published") return;
      if (status === "error") throw new Error("Build failed");
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`Build timed out after ${timeoutMs}ms`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/edge-function-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/engine/edge-function-client.ts tests/edge-function-client.test.ts
git commit -m "feat: add edge function HTTP client for chat, build, publish"
```

---

### Task 6: Cost Tracker Module

**Files:**
- Create: `src/server/engine/cost-tracker.ts`
- Create: `tests/cost-tracker.test.ts`

**Step 1: Write the test**

```typescript
// tests/cost-tracker.test.ts
import { describe, it, expect } from "vitest";
import { CostTracker, MODEL_RATES } from "../src/server/engine/cost-tracker.js";

describe("cost-tracker", () => {
  it("tracks direct API call costs", () => {
    const tracker = new CostTracker();
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 10000,
      outputTokens: 2000,
    });
    const summary = tracker.getSummary();
    expect(summary.persona_agent.input_tokens).toBe(10000);
    expect(summary.persona_agent.output_tokens).toBe(2000);
    expect(summary.persona_agent.usd).toBeGreaterThan(0);
  });

  it("accumulates multiple calls", () => {
    const tracker = new CostTracker();
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 5000,
      outputTokens: 1000,
    });
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 5000,
      outputTokens: 1000,
    });
    const summary = tracker.getSummary();
    expect(summary.persona_agent.input_tokens).toBe(10000);
    expect(summary.persona_agent.output_tokens).toBe(2000);
  });

  it("estimates chatbot costs from message lengths", () => {
    const tracker = new CostTracker();
    tracker.recordEstimatedCall("chatbot_estimated", {
      messageCount: 45,
      estimatedTokens: 52000,
      model: "claude-sonnet-4-5-20250929",
    });
    const summary = tracker.getSummary();
    expect(summary.chatbot_estimated.messages).toBe(45);
    expect(summary.chatbot_estimated.usd_estimate).toBeGreaterThan(0);
  });

  it("calculates total cost", () => {
    const tracker = new CostTracker();
    tracker.recordDirectCall("persona_agent", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 10000,
      outputTokens: 2000,
    });
    tracker.recordDirectCall("judge", {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 8000,
      outputTokens: 1200,
    });
    const summary = tracker.getSummary();
    expect(summary.total_usd).toBeGreaterThan(0);
    expect(summary.total_usd).toBe(
      (summary.persona_agent?.usd ?? 0) + (summary.judge?.usd ?? 0)
    );
  });

  it("has model rates for Sonnet and Opus", () => {
    expect(MODEL_RATES["claude-sonnet-4-5-20250929"]).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cost-tracker.test.ts`
Expected: FAIL

**Step 3: Implement cost-tracker.ts**

```typescript
// src/server/engine/cost-tracker.ts

export const MODEL_RATES: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-sonnet-4-5-20250929": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-opus-4-5-20250514": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 0.80, outputPerMillion: 4 },
};

interface DirectCallRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface EstimatedCallRecord {
  messageCount: number;
  estimatedTokens: number;
  model: string;
}

interface DirectSummary {
  input_tokens: number;
  output_tokens: number;
  model: string;
  usd: number;
}

interface EstimatedSummary {
  messages: number;
  estimated_tokens: number;
  usd_estimate: number;
}

export interface CostSummary {
  persona_agent?: DirectSummary;
  judge?: DirectSummary;
  chatbot_estimated?: EstimatedSummary;
  build_estimated?: EstimatedSummary;
  total_usd: number;
  [key: string]: DirectSummary | EstimatedSummary | number | undefined;
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_RATES[model];
  if (!rates) return 0;
  return (inputTokens / 1_000_000) * rates.inputPerMillion +
         (outputTokens / 1_000_000) * rates.outputPerMillion;
}

export class CostTracker {
  private directCalls: Map<string, { model: string; inputTokens: number; outputTokens: number }> = new Map();
  private estimatedCalls: Map<string, EstimatedCallRecord> = new Map();

  recordDirectCall(category: string, record: DirectCallRecord): void {
    const existing = this.directCalls.get(category);
    if (existing) {
      existing.inputTokens += record.inputTokens;
      existing.outputTokens += record.outputTokens;
    } else {
      this.directCalls.set(category, { ...record });
    }
  }

  recordEstimatedCall(category: string, record: EstimatedCallRecord): void {
    const existing = this.estimatedCalls.get(category);
    if (existing) {
      existing.messageCount += record.messageCount;
      existing.estimatedTokens += record.estimatedTokens;
    } else {
      this.estimatedCalls.set(category, { ...record });
    }
  }

  getSummary(): CostSummary {
    const summary: CostSummary = { total_usd: 0 };

    for (const [category, record] of this.directCalls) {
      const usd = calculateCost(record.model, record.inputTokens, record.outputTokens);
      (summary as Record<string, unknown>)[category] = {
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        model: record.model,
        usd,
      };
      summary.total_usd += usd;
    }

    for (const [category, record] of this.estimatedCalls) {
      const rates = MODEL_RATES[record.model];
      const usdEstimate = rates
        ? (record.estimatedTokens / 1_000_000) * ((rates.inputPerMillion + rates.outputPerMillion) / 2)
        : 0;
      (summary as Record<string, unknown>)[category] = {
        messages: record.messageCount,
        estimated_tokens: record.estimatedTokens,
        usd_estimate: usdEstimate,
      };
      summary.total_usd += usdEstimate;
    }

    summary.total_usd = Math.round(summary.total_usd * 10000) / 10000;
    return summary;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cost-tracker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/engine/cost-tracker.ts tests/cost-tracker.test.ts
git commit -m "feat: add cost tracker with model rates and token accounting"
```

---

### Task 7: Run Orchestrator

**Files:**
- Create: `src/server/engine/orchestrator.ts`
- Create: `src/server/engine/types.ts`

This is the central coordination module. It manages run lifecycle, delegates to the persona agent and edge function client, and emits progress events.

**Step 1: Create shared types**

```typescript
// src/server/engine/types.ts

export type RunMode = "full-pipeline" | "build-only";
export type RunStep = "pending" | "chatting" | "evaluating" | "building" | "deploying" | "complete" | "error";

export interface RunConfig {
  id: string;
  mode: RunMode;
  personas: string[];  // persona IDs to run
  promptSource: "production" | string;  // "production" or path to local override
  promptSourceB?: string;  // for A/B mode
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
```

**Step 2: Create orchestrator skeleton**

```typescript
// src/server/engine/orchestrator.ts
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { RunConfig, RunResult, PersonaRunResult, ProgressCallback } from "./types.js";
import { EdgeFunctionClient } from "./edge-function-client.js";
import { CostTracker } from "./cost-tracker.js";
import type { SupabaseConfig } from "./supabase-client.js";
import { createServiceClient, createTestSiteSpec, getSiteSpec, upsertSiteSpec } from "./supabase-client.js";
import Anthropic from "@anthropic-ai/sdk";
import type { Persona } from "../../personas/schema.js";

const RUNS_DIR = join(process.cwd(), "runs");
const PERSONAS_DIR = join(process.cwd(), "personas/birthbuild");

export class Orchestrator {
  private edgeClient: EdgeFunctionClient;
  private supabaseConfig: SupabaseConfig;
  private anthropic: Anthropic;

  constructor(supabaseConfig: SupabaseConfig) {
    this.supabaseConfig = supabaseConfig;
    this.edgeClient = new EdgeFunctionClient({
      supabaseUrl: supabaseConfig.supabaseUrl,
      anonKey: supabaseConfig.anonKey,
    });
    this.anthropic = new Anthropic();
  }

  async executeRun(config: RunConfig, onProgress: ProgressCallback): Promise<RunResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const runDir = join(RUNS_DIR, timestamp);
    mkdirSync(runDir, { recursive: true });

    const result: RunResult = {
      id: config.id,
      config,
      timestamp,
      personas: {},
      totalCost: 0,
    };

    // Save config
    writeFileSync(join(runDir, "config.json"), JSON.stringify(config, null, 2));

    for (const personaId of config.personas) {
      const personaResult = await this.executePersonaRun(config, personaId, runDir, onProgress);
      result.personas[personaId] = personaResult;
      result.totalCost += personaResult.cost.total_usd as number ?? 0;
    }

    // Save summary
    writeFileSync(join(runDir, "summary.json"), JSON.stringify(result, null, 2));

    return result;
  }

  private async executePersonaRun(
    config: RunConfig,
    personaId: string,
    runDir: string,
    onProgress: ProgressCallback,
  ): Promise<PersonaRunResult> {
    const personaDir = join(runDir, personaId);
    mkdirSync(personaDir, { recursive: true });

    const costTracker = new CostTracker();

    try {
      // Load persona
      const personaPath = join(PERSONAS_DIR, `${personaId}.json`);
      const persona: Persona = JSON.parse(readFileSync(personaPath, "utf-8"));

      if (config.mode === "build-only") {
        return await this.executeBuildOnly(config, personaId, personaDir, costTracker, onProgress);
      }

      return await this.executeFullPipeline(config, persona, personaDir, costTracker, onProgress);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        personaId,
        conversation: [],
        siteSpec: null,
        evaluation: null,
        cost: costTracker.getSummary(),
        previewUrl: null,
        error,
      };
    }
  }

  private async executeFullPipeline(
    config: RunConfig,
    persona: Persona,
    personaDir: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<PersonaRunResult> {
    onProgress({ runId: config.id, persona: persona.id, step: "chatting" });

    // 1. Create a test site_spec in Supabase
    const supabase = createServiceClient(this.supabaseConfig);
    const siteSpecId = await createTestSiteSpec(
      supabase,
      this.supabaseConfig.testTenantId,
      this.supabaseConfig.testUserId,
    );

    // 2. Build persona system prompt and run conversation against /chat
    const conversation = await this.runConversation(config, persona, siteSpecId, costTracker, onProgress);

    // Save conversation
    writeFileSync(join(personaDir, "conversation.json"), JSON.stringify(conversation, null, 2));

    // 3. Read final site_spec from Supabase
    const siteSpec = await getSiteSpec(supabase, siteSpecId);
    writeFileSync(join(personaDir, "site-spec.json"), JSON.stringify(siteSpec, null, 2));

    // 4. Evaluate (optional)
    let evaluation = null;
    if (!config.skipEvaluation) {
      onProgress({ runId: config.id, persona: persona.id, step: "evaluating" });
      evaluation = await this.evaluate(persona, conversation, config.judgeModel, costTracker);
      writeFileSync(join(personaDir, "evaluation.json"), JSON.stringify(evaluation, null, 2));
    }

    // 5. Build + deploy (optional)
    let previewUrl: string | null = null;
    if (!config.skipBuild) {
      onProgress({ runId: config.id, persona: persona.id, step: "building" });
      await this.edgeClient.triggerBuild(siteSpecId);

      // Poll for build completion
      await this.edgeClient.waitForBuild(siteSpecId, async () => {
        const spec = await getSiteSpec(supabase, siteSpecId);
        return spec.status;
      });

      onProgress({ runId: config.id, persona: persona.id, step: "deploying" });
      const publishResult = await this.edgeClient.triggerPublish(siteSpecId);
      previewUrl = publishResult.previewUrl;
      writeFileSync(join(personaDir, "preview-url.txt"), previewUrl);
    }

    // 6. Save cost
    const cost = costTracker.getSummary();
    writeFileSync(join(personaDir, "cost.json"), JSON.stringify(cost, null, 2));

    onProgress({ runId: config.id, persona: persona.id, step: "complete" });

    return {
      personaId: persona.id,
      conversation,
      siteSpec,
      evaluation,
      cost,
      previewUrl,
      error: null,
    };
  }

  private async executeBuildOnly(
    config: RunConfig,
    personaId: string,
    personaDir: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<PersonaRunResult> {
    // Load saved site_spec from a previous run
    // The config should specify which saved spec to use
    // For now, find the latest run with this persona that has a site-spec.json
    const savedSpec = this.findLatestSavedSpec(personaId);
    if (!savedSpec) throw new Error(`No saved site_spec found for ${personaId}`);

    const supabase = createServiceClient(this.supabaseConfig);
    const siteSpecId = await createTestSiteSpec(
      supabase,
      this.supabaseConfig.testTenantId,
      this.supabaseConfig.testUserId,
    );

    await upsertSiteSpec(supabase, siteSpecId, savedSpec);

    onProgress({ runId: config.id, persona: personaId, step: "building" });
    await this.edgeClient.triggerBuild(siteSpecId);
    await this.edgeClient.waitForBuild(siteSpecId, async () => {
      const spec = await getSiteSpec(supabase, siteSpecId);
      return spec.status;
    });

    onProgress({ runId: config.id, persona: personaId, step: "deploying" });
    const publishResult = await this.edgeClient.triggerPublish(siteSpecId);
    const previewUrl = publishResult.previewUrl;
    writeFileSync(join(personaDir, "preview-url.txt"), previewUrl);

    const cost = costTracker.getSummary();
    writeFileSync(join(personaDir, "cost.json"), JSON.stringify(cost, null, 2));

    onProgress({ runId: config.id, persona: personaId, step: "complete" });

    return {
      personaId,
      conversation: [],
      siteSpec: savedSpec,
      evaluation: null,
      cost,
      previewUrl,
      error: null,
    };
  }

  private async runConversation(
    config: RunConfig,
    persona: Persona,
    siteSpecId: string,
    costTracker: CostTracker,
    onProgress: ProgressCallback,
  ): Promise<Array<{ turn: number; role: string; content: string; timestamp: string }>> {
    // Build persona system prompt (reuse from existing lib/persona-agent.ts)
    const { buildPersonaSystemPrompt } = await import("../../lib/persona-agent.js");
    const personaSystemPrompt = buildPersonaSystemPrompt(persona);

    const conversation: Array<{ turn: number; role: string; content: string; timestamp: string }> = [];
    const chatHistory: Array<{ role: string; content: string }> = [];
    let turnNumber = 0;

    // Get initial greeting from chatbot
    const greetingResponse = await this.edgeClient.sendChatMessage({
      siteSpecId,
      message: "Hi",
      chatHistory: [],
    });

    turnNumber++;
    conversation.push({
      turn: turnNumber,
      role: "user",
      content: "Hi",
      timestamp: new Date().toISOString(),
    });

    turnNumber++;
    conversation.push({
      turn: turnNumber,
      role: "assistant",
      content: greetingResponse.message,
      timestamp: new Date().toISOString(),
    });

    chatHistory.push({ role: "user", content: "Hi" });
    chatHistory.push({ role: "assistant", content: greetingResponse.message });

    onProgress({
      runId: config.id,
      persona: persona.id,
      step: "chatting",
      turn: turnNumber,
      message: { role: "assistant", content: greetingResponse.message },
    });

    // Persona history (for the persona LLM — inverted roles)
    const personaHistory: Anthropic.MessageParam[] = [
      { role: "user", content: greetingResponse.message },
    ];

    let isComplete = greetingResponse.is_complete ?? false;

    while (turnNumber < config.maxTurns * 2 && !isComplete) {
      // Persona generates a response
      const personaResponse = await this.anthropic.messages.create({
        model: config.personaModel,
        max_tokens: 1024,
        system: personaSystemPrompt,
        messages: personaHistory,
      });

      const personaText = personaResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("") || "Okay.";

      // Track persona cost
      costTracker.recordDirectCall("persona_agent", {
        model: config.personaModel,
        inputTokens: personaResponse.usage.input_tokens,
        outputTokens: personaResponse.usage.output_tokens,
      });

      personaHistory.push({ role: "assistant", content: personaText });

      turnNumber++;
      conversation.push({
        turn: turnNumber,
        role: "user",
        content: personaText,
        timestamp: new Date().toISOString(),
      });

      onProgress({
        runId: config.id,
        persona: persona.id,
        step: "chatting",
        turn: turnNumber,
        message: { role: "user", content: personaText },
      });

      // Send to chatbot via edge function
      chatHistory.push({ role: "user", content: personaText });
      const chatResponse = await this.edgeClient.sendChatMessage({
        siteSpecId,
        message: personaText,
        chatHistory,
      });

      // Estimate chatbot cost (we can't see actual tokens)
      costTracker.recordEstimatedCall("chatbot_estimated", {
        messageCount: 1,
        estimatedTokens: Math.ceil((personaText.length + chatResponse.message.length) / 4) * 3,
        model: "claude-sonnet-4-5-20250929",
      });

      const botText = chatResponse.message || "[The chatbot saved your information]";

      chatHistory.push({ role: "assistant", content: botText });
      personaHistory.push({ role: "user", content: botText });

      turnNumber++;
      conversation.push({
        turn: turnNumber,
        role: "assistant",
        content: botText,
        timestamp: new Date().toISOString(),
      });

      onProgress({
        runId: config.id,
        persona: persona.id,
        step: "chatting",
        turn: turnNumber,
        message: { role: "assistant", content: botText },
      });

      isComplete = chatResponse.is_complete ?? false;
    }

    return conversation;
  }

  private async evaluate(
    persona: Persona,
    conversation: Array<{ turn: number; role: string; content: string; timestamp: string }>,
    judgeModel: string,
    costTracker: CostTracker,
  ): Promise<Record<string, unknown>> {
    // Reuse existing judge infrastructure
    const { evaluateConversation } = await import("../../lib/judge.js");
    const { UNIVERSAL_CRITERIA } = await import("../../criteria/universal.js");

    // Dynamic import of persona criteria
    const criteriaModule = await import(`../../criteria/birthbuild/${persona.id}.js`);
    const personaCriteria = Object.values(criteriaModule)[0] as Array<Record<string, unknown>>;

    // Convert conversation to ConversationTurn format
    const turns = conversation.map((c) => ({
      turn_number: c.turn,
      role: c.role as "user" | "assistant",
      content: c.content,
      timestamp: c.timestamp,
    }));

    const result = await evaluateConversation(
      persona,
      turns,
      [...UNIVERSAL_CRITERIA, ...personaCriteria] as any[],
      judgeModel,
    );

    // Track judge cost (approximate — we can't get exact tokens from evaluateConversation)
    // The existing judge.ts would need to be modified to return usage info
    costTracker.recordDirectCall("judge", {
      model: judgeModel,
      inputTokens: Math.ceil(JSON.stringify(turns).length / 4),
      outputTokens: 2000,
    });

    return result as unknown as Record<string, unknown>;
  }

  private findLatestSavedSpec(personaId: string): Record<string, unknown> | null {
    if (!existsSync(RUNS_DIR)) return null;
    const runs = readdirSync(RUNS_DIR).sort().reverse();
    for (const run of runs) {
      const specPath = join(RUNS_DIR, run, personaId, "site-spec.json");
      if (existsSync(specPath)) {
        return JSON.parse(readFileSync(specPath, "utf-8"));
      }
    }
    return null;
  }

  listPersonas(): string[] {
    if (!existsSync(PERSONAS_DIR)) return [];
    return readdirSync(PERSONAS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }

  listRuns(): string[] {
    if (!existsSync(RUNS_DIR)) return [];
    return readdirSync(RUNS_DIR).sort().reverse();
  }
}
```

**Step 3: Commit**

```bash
git add src/server/engine/orchestrator.ts src/server/engine/types.ts
git commit -m "feat: add run orchestrator with full-pipeline and build-only modes"
```

---

### Task 8: Express API Routes

**Files:**
- Create: `src/server/routes/runs.ts`
- Create: `src/server/routes/personas.ts`
- Create: `src/server/routes/prompts.ts`
- Create: `src/server/routes/config.ts`
- Modify: `src/server/index.ts`

**Step 1: Create personas route**

```typescript
// src/server/routes/personas.ts
import { Router } from "express";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const router = Router();
const PERSONAS_DIR = join(process.cwd(), "personas/birthbuild");

router.get("/", (_req, res) => {
  if (!existsSync(PERSONAS_DIR)) return res.json([]);
  const personas = readdirSync(PERSONAS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const data = JSON.parse(readFileSync(join(PERSONAS_DIR, f), "utf-8"));
      return { id: data.id, name: data.name, background: data.background };
    });
  res.json(personas);
});

router.get("/:id", (req, res) => {
  const path = join(PERSONAS_DIR, `${req.params.id}.json`);
  if (!existsSync(path)) return res.status(404).json({ error: "Persona not found" });
  res.json(JSON.parse(readFileSync(path, "utf-8")));
});

export { router as personasRouter };
```

**Step 2: Create prompts route**

```typescript
// src/server/routes/prompts.ts
import { Router } from "express";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const router = Router();
const PROMPTS_DIR = join(process.cwd(), "prompts/birthbuild");

router.get("/", (_req, res) => {
  const prompts = [{ id: "production", name: "Production (live)", source: "edge-function" }];
  if (existsSync(PROMPTS_DIR)) {
    const files = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      prompts.push({ id: f.replace(".md", ""), name: f, source: "local" });
    }
  }
  res.json(prompts);
});

router.get("/:id", (req, res) => {
  if (req.params.id === "production") {
    return res.json({ id: "production", content: "(Fetched from production at runtime)" });
  }
  const path = join(PROMPTS_DIR, `${req.params.id}.md`);
  if (!existsSync(path)) return res.status(404).json({ error: "Prompt not found" });
  res.json({ id: req.params.id, content: readFileSync(path, "utf-8") });
});

export { router as promptsRouter };
```

**Step 3: Create runs route with SSE**

```typescript
// src/server/routes/runs.ts
import { Router } from "express";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Orchestrator } from "../engine/orchestrator.js";
import type { RunConfig, RunProgress } from "../engine/types.js";

const RUNS_DIR = join(process.cwd(), "runs");

export function createRunsRouter(orchestrator: Orchestrator) {
  const router = Router();

  // Active run streams (runId → Set of SSE response objects)
  const activeStreams = new Map<string, Set<any>>();

  // List all runs
  router.get("/", (_req, res) => {
    if (!existsSync(RUNS_DIR)) return res.json([]);
    const runs = readdirSync(RUNS_DIR)
      .sort()
      .reverse()
      .map((dir) => {
        const configPath = join(RUNS_DIR, dir, "config.json");
        const summaryPath = join(RUNS_DIR, dir, "summary.json");
        return {
          id: dir,
          config: existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : null,
          summary: existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, "utf-8")) : null,
        };
      });
    res.json(runs);
  });

  // Get run detail
  router.get("/:id", (req, res) => {
    const runDir = join(RUNS_DIR, req.params.id);
    if (!existsSync(runDir)) return res.status(404).json({ error: "Run not found" });
    const summaryPath = join(runDir, "summary.json");
    if (!existsSync(summaryPath)) return res.status(404).json({ error: "Summary not found" });
    res.json(JSON.parse(readFileSync(summaryPath, "utf-8")));
  });

  // Get persona conversation
  router.get("/:id/:persona/conversation", (req, res) => {
    const path = join(RUNS_DIR, req.params.id, req.params.persona, "conversation.json");
    if (!existsSync(path)) return res.status(404).json({ error: "Conversation not found" });
    res.json(JSON.parse(readFileSync(path, "utf-8")));
  });

  // Get persona site-spec
  router.get("/:id/:persona/site-spec", (req, res) => {
    const path = join(RUNS_DIR, req.params.id, req.params.persona, "site-spec.json");
    if (!existsSync(path)) return res.status(404).json({ error: "Site spec not found" });
    res.json(JSON.parse(readFileSync(path, "utf-8")));
  });

  // Get persona evaluation
  router.get("/:id/:persona/evaluation", (req, res) => {
    const path = join(RUNS_DIR, req.params.id, req.params.persona, "evaluation.json");
    if (!existsSync(path)) return res.status(404).json({ error: "Evaluation not found" });
    res.json(JSON.parse(readFileSync(path, "utf-8")));
  });

  // Get persona cost
  router.get("/:id/:persona/cost", (req, res) => {
    const path = join(RUNS_DIR, req.params.id, req.params.persona, "cost.json");
    if (!existsSync(path)) return res.status(404).json({ error: "Cost not found" });
    res.json(JSON.parse(readFileSync(path, "utf-8")));
  });

  // Start a new run
  router.post("/", async (req, res) => {
    const body = req.body as Partial<RunConfig>;
    const config: RunConfig = {
      id: randomUUID(),
      mode: body.mode ?? "full-pipeline",
      personas: body.personas ?? orchestrator.listPersonas(),
      promptSource: body.promptSource ?? "production",
      promptSourceB: body.promptSourceB,
      maxTurns: body.maxTurns ?? 60,
      personaModel: body.personaModel ?? "claude-sonnet-4-5-20250929",
      judgeModel: body.judgeModel ?? "claude-sonnet-4-5-20250929",
      skipEvaluation: body.skipEvaluation ?? false,
      skipBuild: body.skipBuild ?? false,
    };

    // Return immediately with run ID
    res.json({ runId: config.id, status: "started" });

    // Execute in background
    const onProgress = (progress: RunProgress) => {
      const streams = activeStreams.get(config.id);
      if (streams) {
        const data = JSON.stringify(progress);
        for (const stream of streams) {
          stream.write(`event: ${progress.step}\ndata: ${data}\n\n`);
        }
      }
    };

    try {
      await orchestrator.executeRun(config, onProgress);
    } finally {
      // Close all SSE streams
      const streams = activeStreams.get(config.id);
      if (streams) {
        for (const stream of streams) {
          stream.write(`event: done\ndata: {}\n\n`);
          stream.end();
        }
        activeStreams.delete(config.id);
      }
    }
  });

  // SSE stream for run progress
  router.get("/:id/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const runId = req.params.id;
    if (!activeStreams.has(runId)) {
      activeStreams.set(runId, new Set());
    }
    activeStreams.get(runId)!.add(res);

    req.on("close", () => {
      activeStreams.get(runId)?.delete(res);
    });
  });

  return router;
}
```

**Step 4: Create config route**

```typescript
// src/server/routes/config.ts
import { Router } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const router = Router();
const CONFIG_PATH = join(process.cwd(), "harness-config.json");

interface HarnessConfig {
  dailyBudget: number;
  defaultPersonaModel: string;
  defaultJudgeModel: string;
}

const DEFAULT_CONFIG: HarnessConfig = {
  dailyBudget: 10,
  defaultPersonaModel: "claude-sonnet-4-5-20250929",
  defaultJudgeModel: "claude-sonnet-4-5-20250929",
};

function loadConfig(): HarnessConfig {
  if (existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) };
  }
  return DEFAULT_CONFIG;
}

router.get("/", (_req, res) => {
  res.json(loadConfig());
});

router.put("/", (req, res) => {
  const current = loadConfig();
  const updated = { ...current, ...req.body };
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  res.json(updated);
});

export { router as configRouter };
```

**Step 5: Wire routes into Express server**

Update `src/server/index.ts`:

```typescript
// src/server/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { personasRouter } from "./routes/personas.js";
import { promptsRouter } from "./routes/prompts.js";
import { createRunsRouter } from "./routes/runs.js";
import { configRouter } from "./routes/config.js";
import { Orchestrator } from "./engine/orchestrator.js";
import { buildSupabaseConfig, validateConfig } from "./engine/supabase-client.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Supabase config (validated on startup)
const supabaseConfig = buildSupabaseConfig(process.env as Record<string, string>);

// Orchestrator
const orchestrator = new Orchestrator(supabaseConfig);

// Routes
app.use("/api/personas", personasRouter);
app.use("/api/prompts", promptsRouter);
app.use("/api/runs", createRunsRouter(orchestrator));
app.use("/api/config", configRouter);

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export { app };
```

**Step 6: Commit**

```bash
git add src/server/
git commit -m "feat: add Express API routes for runs, personas, prompts, config with SSE"
```

---

## Phase 3: Dashboard UI

### Task 9: Design Tokens and Global Styles

**Files:**
- Create: `src/client/styles/tokens.css`
- Create: `src/client/styles/global.css`

**Step 1: Create BirthBuild design tokens**

```css
/* src/client/styles/tokens.css */
:root {
  /* Sage & Sand palette (base) */
  --color-bg: #FAF6F1;
  --color-surface: #FFFFFF;
  --color-primary: #7C8B6F;
  --color-primary-light: #A3B196;
  --color-secondary: #C2B280;
  --color-text: #2D2926;
  --color-text-muted: #6B6560;
  --color-border: #E5DED6;

  /* Status */
  --color-pass: #7C8B6F;
  --color-fail: #C25D4E;
  --color-warning: #D4A843;
  --color-running: #5B8CB5;

  /* Spacing (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Typography */
  --font-heading: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Fira Code", monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(45, 41, 38, 0.06);
  --shadow-md: 0 4px 12px rgba(45, 41, 38, 0.08);
  --shadow-lg: 0 8px 24px rgba(45, 41, 38, 0.12);
}
```

**Step 2: Create global styles**

```css
/* src/client/styles/global.css */
@import "./tokens.css";

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 { font-family: var(--font-heading); font-weight: 600; line-height: 1.3; }
h1 { font-size: var(--text-3xl); }
h2 { font-size: var(--text-2xl); }
h3 { font-size: var(--text-xl); }

a { color: var(--color-primary); text-decoration: none; }
a:hover { text-decoration: underline; }

code, pre { font-family: var(--font-mono); font-size: var(--text-sm); }

button {
  font-family: var(--font-body);
  cursor: pointer;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background-color 0.15s, box-shadow 0.15s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}
.btn-primary:hover { background: var(--color-primary-light); }

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn-secondary:hover { background: var(--color-bg); }

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-pass { background: #E8F0E4; color: var(--color-pass); }
.badge-fail { background: #F5E0DD; color: var(--color-fail); }
.badge-running { background: #DDE8F0; color: var(--color-running); }
```

**Step 3: Import global styles in main.tsx**

Add to top of `src/client/main.tsx`:
```tsx
import "./styles/global.css";
```

**Step 4: Commit**

```bash
git add src/client/styles/ src/client/main.tsx
git commit -m "feat: add BirthBuild design tokens and global styles"
```

---

### Task 10: Layout Shell and Navigation

**Files:**
- Create: `src/client/components/Layout.tsx`
- Create: `src/client/components/Layout.css`
- Modify: `src/client/App.tsx`

**Step 1: Create Layout component**

```tsx
// src/client/components/Layout.tsx
import { NavLink, Outlet } from "react-router-dom";
import "./Layout.css";

const NAV_ITEMS = [
  { to: "/", label: "Run", icon: "▶" },
  { to: "/results", label: "Results", icon: "☰" },
  { to: "/compare", label: "A/B Compare", icon: "⇄" },
  { to: "/prompts", label: "Prompts", icon: "✎" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">BirthBuild</h1>
          <span className="logo-sub">Test Harness</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 2: Create Layout CSS**

```css
/* src/client/components/Layout.css */
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.sidebar-header {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.logo {
  font-size: var(--text-lg);
  color: var(--color-primary);
  margin: 0;
}

.logo-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s;
}

.nav-item:hover {
  background: var(--color-bg);
  color: var(--color-text);
  text-decoration: none;
}

.nav-item.active {
  background: #E8F0E4;
  color: var(--color-primary);
}

.nav-icon { font-size: var(--text-base); }

.main-content {
  flex: 1;
  padding: var(--space-8);
  overflow-y: auto;
}
```

**Step 3: Update App.tsx to use Layout**

```tsx
// src/client/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<div className="card"><h2>Run Configuration</h2><p>Coming soon...</p></div>} />
          <Route path="/progress/:runId" element={<div className="card"><h2>Run Progress</h2></div>} />
          <Route path="/results" element={<div className="card"><h2>Results</h2></div>} />
          <Route path="/results/:runId" element={<div className="card"><h2>Run Detail</h2></div>} />
          <Route path="/compare" element={<div className="card"><h2>A/B Compare</h2></div>} />
          <Route path="/prompts" element={<div className="card"><h2>Prompts</h2></div>} />
          <Route path="/settings" element={<div className="card"><h2>Settings</h2></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 4: Verify the dashboard loads**

Run: `npx vite` — open localhost:5173, verify nav and layout render.

**Step 5: Commit**

```bash
git add src/client/
git commit -m "feat: add dashboard layout shell with BirthBuild-styled navigation"
```

---

### Task 11: Run Configuration Page

**Files:**
- Create: `src/client/pages/RunConfig.tsx`
- Create: `src/client/pages/RunConfig.css`
- Create: `src/client/hooks/useApi.ts`

This page lets the user select personas, mode, prompt, and advanced settings, then start a run.

**Step 1: Create useApi hook**

```tsx
// src/client/hooks/useApi.ts
import { useState, useEffect } from "react";

const API_BASE = "/api";

export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  return { data, loading, error };
}

export async function postApi<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
```

**Step 2: Create RunConfig page**

```tsx
// src/client/pages/RunConfig.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi, postApi } from "../hooks/useApi.js";
import "./RunConfig.css";

interface PersonaSummary { id: string; name: string; background: string }
interface PromptSummary { id: string; name: string; source: string }

export function RunConfig() {
  const navigate = useNavigate();
  const { data: personas } = useApi<PersonaSummary[]>("/personas");
  const { data: prompts } = useApi<PromptSummary[]>("/prompts");

  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"full-pipeline" | "build-only">("full-pipeline");
  const [promptSource, setPromptSource] = useState("production");
  const [abEnabled, setAbEnabled] = useState(false);
  const [promptSourceB, setPromptSourceB] = useState("");
  const [maxTurns, setMaxTurns] = useState(60);
  const [skipEvaluation, setSkipEvaluation] = useState(false);
  const [skipBuild, setSkipBuild] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const togglePersona = (id: string) => {
    const next = new Set(selectedPersonas);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPersonas(next);
  };

  const selectAll = () => {
    if (personas) setSelectedPersonas(new Set(personas.map((p) => p.id)));
  };

  const startRun = async () => {
    setIsStarting(true);
    try {
      const result = await postApi<{ runId: string }>("/runs", {
        mode,
        personas: [...selectedPersonas],
        promptSource,
        promptSourceB: abEnabled ? promptSourceB : undefined,
        maxTurns,
        skipEvaluation,
        skipBuild,
      });
      navigate(`/progress/${result.runId}`);
    } catch (e) {
      alert(`Failed to start run: ${e}`);
      setIsStarting(false);
    }
  };

  return (
    <div className="run-config">
      <h2>Run Configuration</h2>

      <section className="config-section card">
        <h3>Personas</h3>
        <div className="persona-grid">
          {personas?.map((p) => (
            <label key={p.id} className={`persona-card ${selectedPersonas.has(p.id) ? "selected" : ""}`}>
              <input
                type="checkbox"
                checked={selectedPersonas.has(p.id)}
                onChange={() => togglePersona(p.id)}
              />
              <div>
                <strong>{p.name}</strong>
                <span className="persona-bg">{p.background}</span>
              </div>
            </label>
          ))}
        </div>
        <button className="btn-secondary" onClick={selectAll}>Select All</button>
      </section>

      <section className="config-section card">
        <h3>Mode</h3>
        <div className="mode-toggle">
          <button className={`btn-${mode === "full-pipeline" ? "primary" : "secondary"}`} onClick={() => setMode("full-pipeline")}>Full Pipeline</button>
          <button className={`btn-${mode === "build-only" ? "primary" : "secondary"}`} onClick={() => setMode("build-only")}>Build Only</button>
        </div>
      </section>

      <section className="config-section card">
        <h3>Prompt</h3>
        <select value={promptSource} onChange={(e) => setPromptSource(e.target.value)}>
          {prompts?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="ab-toggle">
          <input type="checkbox" checked={abEnabled} onChange={(e) => setAbEnabled(e.target.checked)} />
          A/B Mode
        </label>
        {abEnabled && (
          <select value={promptSourceB} onChange={(e) => setPromptSourceB(e.target.value)}>
            <option value="">Select Prompt B</option>
            {prompts?.filter((p) => p.id !== promptSource).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </section>

      <details className="config-section card">
        <summary><h3 style={{ display: "inline" }}>Advanced Settings</h3></summary>
        <div className="advanced-grid">
          <label>Max turns: <input type="range" min={10} max={120} value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} /> {maxTurns}</label>
          <label><input type="checkbox" checked={skipEvaluation} onChange={(e) => setSkipEvaluation(e.target.checked)} /> Skip evaluation (save cost)</label>
          <label><input type="checkbox" checked={skipBuild} onChange={(e) => setSkipBuild(e.target.checked)} /> Skip build (stop at site_spec)</label>
        </div>
      </details>

      <button
        className="btn-primary start-btn"
        disabled={selectedPersonas.size === 0 || isStarting}
        onClick={startRun}
      >
        {isStarting ? "Starting..." : "Start Run"}
      </button>
    </div>
  );
}
```

**Step 3: Create RunConfig.css**

```css
/* src/client/pages/RunConfig.css */
.run-config { display: flex; flex-direction: column; gap: var(--space-6); max-width: 800px; }
.config-section { display: flex; flex-direction: column; gap: var(--space-4); }

.persona-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
.persona-card {
  display: flex; gap: var(--space-3); align-items: flex-start;
  padding: var(--space-4); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); cursor: pointer; transition: all 0.15s;
}
.persona-card.selected { border-color: var(--color-primary); background: #E8F0E4; }
.persona-card strong { display: block; font-size: var(--text-sm); }
.persona-bg { font-size: var(--text-xs); color: var(--color-text-muted); }

.mode-toggle { display: flex; gap: var(--space-2); }

select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--color-surface);
}

.ab-toggle { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }

.advanced-grid { display: flex; flex-direction: column; gap: var(--space-3); padding-top: var(--space-4); }
.advanced-grid label { font-size: var(--text-sm); display: flex; align-items: center; gap: var(--space-2); }

.start-btn {
  padding: var(--space-3) var(--space-8);
  font-size: var(--text-lg);
  align-self: flex-start;
}
```

**Step 4: Wire into App.tsx routes**

Replace the `"/"` route placeholder with `<RunConfig />`, importing from `./pages/RunConfig.js`.

**Step 5: Commit**

```bash
git add src/client/pages/RunConfig.tsx src/client/pages/RunConfig.css src/client/hooks/useApi.ts src/client/App.tsx
git commit -m "feat: add Run Configuration page with persona/prompt/mode selection"
```

---

### Task 12: Run Progress Page with SSE

**Files:**
- Create: `src/client/pages/RunProgress.tsx`
- Create: `src/client/pages/RunProgress.css`
- Create: `src/client/hooks/useSSE.ts`
- Create: `src/client/components/ChatBubble.tsx`
- Create: `src/client/components/ChatBubble.css`

**Step 1: Create useSSE hook**

```tsx
// src/client/hooks/useSSE.ts
import { useEffect, useRef, useState } from "react";

interface SSEMessage { event: string; data: unknown }

export function useSSE(url: string | null) {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    const handleEvent = (event: MessageEvent) => {
      const msg: SSEMessage = { event: event.type, data: JSON.parse(event.data) };
      if (event.type === "done") {
        setIsDone(true);
        es.close();
        return;
      }
      setMessages((prev) => [...prev, msg]);
    };

    for (const eventType of ["chatting", "evaluating", "building", "deploying", "complete", "error", "done"]) {
      es.addEventListener(eventType, handleEvent);
    }

    return () => { es.close(); };
  }, [url]);

  return { messages, isConnected, isDone };
}
```

**Step 2: Create ChatBubble component**

```tsx
// src/client/components/ChatBubble.tsx
import "./ChatBubble.css";

interface Props { role: "user" | "assistant"; content: string; turn?: number }

export function ChatBubble({ role, content, turn }: Props) {
  return (
    <div className={`chat-bubble ${role}`}>
      <div className="bubble-header">
        <span className="bubble-role">{role === "user" ? "Persona" : "Chatbot"}</span>
        {turn !== undefined && <span className="bubble-turn">Turn {turn}</span>}
      </div>
      <div className="bubble-content">{content}</div>
    </div>
  );
}
```

```css
/* src/client/components/ChatBubble.css */
.chat-bubble {
  max-width: 75%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}
.chat-bubble.user {
  align-self: flex-start;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.chat-bubble.assistant {
  align-self: flex-end;
  background: #E8F0E4;
  margin-left: auto;
}
.bubble-header { display: flex; justify-content: space-between; margin-bottom: var(--space-1); }
.bubble-role { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; }
.bubble-turn { font-size: var(--text-xs); color: var(--color-text-muted); }
.bubble-content { font-size: var(--text-sm); line-height: 1.5; white-space: pre-wrap; }
```

**Step 3: Create RunProgress page**

```tsx
// src/client/pages/RunProgress.tsx
import { useParams } from "react-router-dom";
import { useSSE } from "../hooks/useSSE.js";
import { ChatBubble } from "../components/ChatBubble.js";
import "./RunProgress.css";

export function RunProgress() {
  const { runId } = useParams<{ runId: string }>();
  const { messages, isConnected, isDone } = useSSE(runId ? `/api/runs/${runId}/stream` : null);

  const chatMessages = messages
    .filter((m) => m.event === "chatting" && (m.data as any)?.message)
    .map((m) => m.data as { persona: string; turn: number; message: { role: string; content: string } });

  const latestStep = messages.length > 0
    ? (messages[messages.length - 1]!.data as any)?.step ?? "pending"
    : "pending";

  return (
    <div className="run-progress">
      <div className="progress-header">
        <h2>Run Progress</h2>
        <div className="progress-status">
          <span className={`badge badge-${isDone ? "pass" : "running"}`}>
            {isDone ? "Complete" : latestStep}
          </span>
          {!isDone && <span className="pulse" />}
        </div>
      </div>

      <div className="progress-steps">
        {["chatting", "evaluating", "building", "deploying", "complete"].map((step) => (
          <div key={step} className={`step ${latestStep === step ? "active" : ""}`}>{step}</div>
        ))}
      </div>

      <div className="conversation-feed">
        {chatMessages.map((msg, i) => (
          <ChatBubble
            key={i}
            role={msg.message.role as "user" | "assistant"}
            content={msg.message.content}
            turn={msg.turn}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Create RunProgress.css, wire into App.tsx, commit**

```bash
git add src/client/pages/RunProgress.tsx src/client/pages/RunProgress.css src/client/hooks/useSSE.ts src/client/components/ChatBubble.tsx src/client/components/ChatBubble.css src/client/App.tsx
git commit -m "feat: add Run Progress page with SSE streaming and chat bubbles"
```

---

### Task 13: Results Explorer Page

**Files:**
- Create: `src/client/pages/Results.tsx`
- Create: `src/client/pages/RunDetail.tsx`
- Create: `src/client/components/ScoreCard.tsx`
- Create: `src/client/components/CostBreakdown.tsx`
- Create: `src/client/components/JsonViewer.tsx`

This task creates the Results list page and the Run Detail page with expandable conversation, site_spec, evaluation, and cost sections.

**Step 1: Create ScoreCard component**

```tsx
// src/client/components/ScoreCard.tsx
interface Props { label: string; value: number | string; max?: number; status?: "pass" | "fail" }

export function ScoreCard({ label, value, max, status }: Props) {
  return (
    <div className="card" style={{ textAlign: "center", minWidth: 120 }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "var(--space-2)" }}>{label}</div>
      <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>
        {value}{max !== undefined && <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>/{max}</span>}
      </div>
      {status && <span className={`badge badge-${status}`}>{status}</span>}
    </div>
  );
}
```

**Step 2: Create CostBreakdown component**

```tsx
// src/client/components/CostBreakdown.tsx
interface Props { cost: Record<string, any> }

export function CostBreakdown({ cost }: Props) {
  const rows = Object.entries(cost).filter(([k]) => k !== "total_usd");
  return (
    <div className="card">
      <h4>Cost Breakdown</h4>
      <table style={{ width: "100%", fontSize: "var(--text-sm)" }}>
        <thead><tr><th style={{ textAlign: "left" }}>Category</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
        <tbody>
          {rows.map(([key, val]) => (
            <tr key={key}>
              <td>{key.replace(/_/g, " ")}</td>
              <td style={{ textAlign: "right" }}>${(val.usd ?? val.usd_estimate ?? 0).toFixed(4)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700, borderTop: "1px solid var(--color-border)" }}>
            <td>Total</td>
            <td style={{ textAlign: "right" }}>${(cost.total_usd ?? 0).toFixed(4)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: Create JsonViewer component**

```tsx
// src/client/components/JsonViewer.tsx
import { useState } from "react";

interface Props { data: unknown; title: string }

export function JsonViewer({ data, title }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <h4>{title}</h4>
        <span>{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <pre style={{ overflow: "auto", maxHeight: 400, marginTop: "var(--space-3)", padding: "var(--space-3)", background: "var(--color-bg)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

**Step 4: Create Results list page**

```tsx
// src/client/pages/Results.tsx
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi.js";

interface RunEntry { id: string; config: any; summary: any }

export function Results() {
  const { data: runs, loading } = useApi<RunEntry[]>("/runs");
  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Results</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
        {runs?.map((run) => (
          <Link key={run.id} to={`/results/${run.id}`} className="card" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{run.id}</strong>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {run.config?.personas?.join(", ") ?? "unknown"} | {run.config?.mode ?? "unknown"}
                </div>
              </div>
              <span className={`badge badge-${run.summary?.overall_pass ? "pass" : "fail"}`}>
                {run.summary?.overall_pass ? "PASS" : "FAIL"}
              </span>
            </div>
          </Link>
        ))}
        {runs?.length === 0 && <p style={{ color: "var(--color-text-muted)" }}>No runs yet. Start one from the Run page.</p>}
      </div>
    </div>
  );
}
```

**Step 5: Create RunDetail page**

```tsx
// src/client/pages/RunDetail.tsx
import { useParams } from "react-router-dom";
import { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { ScoreCard } from "../components/ScoreCard.js";
import { CostBreakdown } from "../components/CostBreakdown.js";
import { JsonViewer } from "../components/JsonViewer.js";

export function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, loading } = useApi<any>(`/runs/${runId}`);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  if (loading || !run) return <div>Loading...</div>;

  const personaIds = Object.keys(run.personas ?? {});
  const active = selectedPersona ?? personaIds[0] ?? null;
  const persona = active ? run.personas[active] : null;

  return (
    <div>
      <h2>Run: {runId}</h2>

      <div style={{ display: "flex", gap: "var(--space-2)", margin: "var(--space-4) 0" }}>
        {personaIds.map((id) => (
          <button key={id} className={`btn-${id === active ? "primary" : "secondary"}`} onClick={() => setSelectedPersona(id)}>
            {id}
          </button>
        ))}
      </div>

      {persona && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {persona.evaluation && (
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <ScoreCard label="Quality" value={persona.evaluation.overall_score} max={5} status={persona.evaluation.hard_fails?.length === 0 ? "pass" : "fail"} />
              <ScoreCard label="Turns" value={persona.conversation?.length ?? 0} />
              {persona.previewUrl && (
                <div className="card" style={{ textAlign: "center", minWidth: 120 }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>Preview</div>
                  <a href={persona.previewUrl} target="_blank" rel="noopener">Open Site</a>
                </div>
              )}
            </div>
          )}

          {persona.cost && <CostBreakdown cost={persona.cost} />}

          <div className="card">
            <h4>Conversation</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-3)", maxHeight: 600, overflowY: "auto" }}>
              {persona.conversation?.map((msg: any, i: number) => (
                <ChatBubble key={i} role={msg.role} content={msg.content} turn={msg.turn} />
              ))}
            </div>
          </div>

          {persona.siteSpec && <JsonViewer data={persona.siteSpec} title="Site Spec" />}
          {persona.evaluation && <JsonViewer data={persona.evaluation} title="Evaluation" />}
        </div>
      )}
    </div>
  );
}
```

**Step 6: Wire into App.tsx, commit**

```bash
git add src/client/pages/ src/client/components/ src/client/App.tsx
git commit -m "feat: add Results Explorer and Run Detail pages with scores, cost, conversation"
```

---

### Task 14: A/B Comparison Page

**Files:**
- Create: `src/client/pages/ABCompare.tsx`
- Create: `src/client/pages/ABCompare.css`

This page shows side-by-side comparison of two runs (Prompt A vs Prompt B).

**Step 1: Create ABCompare page**

The page lets the user select two runs to compare, then shows conversations, scores, and preview URLs side by side. Implementation follows the same pattern as Results/RunDetail but with a two-column layout. The component fetches both runs via `useApi` and renders them in parallel columns.

**Step 2: Create ABCompare.css with two-column grid**

**Step 3: Wire into App.tsx, commit**

```bash
git add src/client/pages/ABCompare.tsx src/client/pages/ABCompare.css src/client/App.tsx
git commit -m "feat: add A/B Comparison page with side-by-side prompt comparison"
```

---

### Task 15: Prompts View Page

**Files:**
- Create: `src/client/pages/Prompts.tsx`

Lists available prompts and shows their content. For "production", indicates it's fetched at runtime. For local overrides, shows the file contents.

**Step 1: Implement, commit**

```bash
git add src/client/pages/Prompts.tsx src/client/App.tsx
git commit -m "feat: add Prompts view page"
```

---

### Task 16: Settings Page

**Files:**
- Create: `src/client/pages/Settings.tsx`

Form for budget threshold, default models, and Supabase connection display (read-only, from env).

**Step 1: Implement, commit**

```bash
git add src/client/pages/Settings.tsx src/client/App.tsx
git commit -m "feat: add Settings page with budget and model configuration"
```

---

## Phase 4: Integration & Edge Function Discovery

### Task 17: Investigate BirthBuild Edge Function Contracts

**Files:**
- Notes saved to: `docs/edge-function-contracts.md`

Before the harness can call edge functions, we need to know the exact request/response shapes. This task reads the deployed edge function code to document:

1. `/chat` — request body shape, response body shape, how conversation history is passed
2. `/build` — request body, response body, how to know when build is done
3. `/publish` — request body, response body, where the preview URL comes from
4. How conversation completion is signalled (does `/chat` return an `is_complete` flag? Does it depend on the `mark_step_complete` tool call?)
5. What authentication is needed (anon key? Service role? User JWT?)

**Step 1: Read the edge function code from BirthBuild repo**

Check `/Users/andrew/Documents/DopamineLaboratory/Apps/BirthBuild/supabase/functions/` for `chat/index.ts`, `build/index.ts`, `publish/index.ts`.

**Step 2: Document contracts in `docs/edge-function-contracts.md`**

**Step 3: Update `edge-function-client.ts` to match actual contracts**

Any differences from what we assumed (request shapes, response fields, auth headers) get fixed here.

**Step 4: Commit**

```bash
git add docs/edge-function-contracts.md src/server/engine/edge-function-client.ts
git commit -m "docs: document edge function contracts and align client"
```

---

### Task 18: End-to-End Smoke Test

**Files:**
- Create: `tests/e2e-smoke.test.ts` (or manual script)

**Step 1: Set up .env with real credentials**

Ensure `.env` has valid Supabase URL, anon key, service role key, test tenant ID, test user ID.

**Step 2: Run a minimal integration test**

- Start the Express server
- POST to `/api/runs` with a single persona (sparse-sarah, least costly), `skipBuild: true`
- Verify conversation runs to completion
- Verify site_spec is saved
- Verify results appear at `/api/runs`

**Step 3: If build pipeline works, run with `skipBuild: false`**

Verify preview URL is returned and accessible.

**Step 4: Commit any fixes discovered**

```bash
git commit -m "fix: align edge function client with production contracts"
```

---

## Phase 5: Polish & Remaining Features

### Task 19: Cost Summary Endpoint and Dashboard Widget

**Files:**
- Create: `src/server/routes/cost.ts`
- Create: `src/client/components/CostSummaryWidget.tsx`

Aggregate costs across all runs. Show a chart or summary on the Run Config page showing total spend today/this week.

**Step 1: Create cost aggregation route**

```typescript
// src/server/routes/cost.ts
// GET /api/cost/summary — reads all runs, sums cost.json files
// Returns: { today: number, thisWeek: number, total: number, budget: number }
```

**Step 2: Add widget to RunConfig page showing spend vs budget**

**Step 3: Commit**

```bash
git add src/server/routes/cost.ts src/client/components/CostSummaryWidget.tsx
git commit -m "feat: add cost summary aggregation and dashboard widget"
```

---

### Task 20: Preserve CLI Compatibility

**Files:**
- Modify: `run.ts`

The existing CLI (`npm run harness`) must continue to work for headless runs. Verify it still functions after all the restructuring. If imports have changed, update them.

**Step 1: Run the existing CLI**

```bash
npm run harness -- --prompt prompts/birthbuild/system-prompt.md --tools prompts/birthbuild/tools.json --persona sparse-sarah --max-turns 10
```

**Step 2: Fix any broken imports**

**Step 3: Commit**

```bash
git add run.ts
git commit -m "fix: preserve CLI compatibility after v2 restructure"
```

---

### Task 21: Run All Tests and Final Verification

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All existing tests pass + new tests pass.

**Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Run the full dashboard**

```bash
npm run dev
```

Verify: Dashboard loads, personas list, can configure and start a run.

**Step 4: Commit**

```bash
git add .
git commit -m "chore: final verification — all tests passing, dashboard functional"
```

---

## Execution Sequence Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1: Scaffolding | 1-3 | Dependencies, Vite, directory structure |
| 2: Server Engine | 4-8 | Supabase client, edge functions, cost tracker, orchestrator, API routes |
| 3: Dashboard UI | 9-16 | Design tokens, layout, all pages (RunConfig, Progress, Results, A/B, Prompts, Settings) |
| 4: Integration | 17-18 | Edge function contract discovery, end-to-end smoke test |
| 5: Polish | 19-21 | Cost summary, CLI compatibility, final verification |

**Total: 21 tasks across 5 phases.**
