# Prompt Management & A/B Testing — Design

## Goal

Add a prompt management UI to the persona-harness dashboard that reads/writes BirthBuild's prompt templates, and wire prompt selection + model config into the build pipeline via the `prompt_config` interface.

## Scope

**In scope:** Build prompts only — `generate-design-system` and `generate-page` edge functions.

**Out of scope:** `/chat` endpoint prompts, providers beyond Anthropic + OpenAI, version history, live template preview, prompt diff view, concurrent editing protection, prompt performance analytics.

## Architecture

The harness reads and writes BirthBuild's prompt template files directly from the filesystem. A `BIRTHBUILD_ROOT` environment variable points to the BirthBuild project root. The prompt template system consists of:

- `manifest.json` — Variant registry mapping prompt types to their variants
- `.md` files — Prompt templates with `{{variable}}` placeholders (resolved at runtime by the edge functions, not by the harness)

The harness never resolves template variables — it reads the raw `.md` content and passes it to the edge function as `prompt_config.system_prompt`. The edge function handles variable resolution from the site spec.

---

## API Layer

New/modified routes replacing the current read-only `src/server/routes/prompts.ts`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prompts` | Returns the full manifest (both prompt types + all variants) |
| GET | `/api/prompts/:type/:variant` | Returns the `.md` content for a specific variant |
| PUT | `/api/prompts/:type/:variant` | Updates the `.md` content for an existing variant |
| POST | `/api/prompts/:type` | Creates a new variant (writes `.md` file + updates manifest) |
| DELETE | `/api/prompts/:type/:variant` | Deletes a variant (removes `.md` file + updates manifest) |
| POST | `/api/prompts/:type/:variant/duplicate` | Duplicates a variant under a new name |
| PUT | `/api/prompts/:type/production` | Sets which variant is the production variant |

### Validation

- Variant names must be slug-safe (`[a-z0-9-]+`)
- Cannot delete the variant currently marked as `production`
- Cannot create a variant with a name that already exists
- `BIRTHBUILD_ROOT` must be set and the prompts directory must exist (reported via `/api/health`)

---

## Prompts Page UI

Replaces the current read-only Prompts page with a two-panel prompt editor.

### Left Sidebar

- Two collapsible groups: "Design System" and "Generate Page"
- Each group lists variants as clickable items (name + description)
- Production variant gets a "LIVE" badge
- "New Variant" button at the bottom of each group
- Context menu per variant: Duplicate, Set as Production, Delete

### Right Panel

- Variant name + description (editable inline)
- Full-height monospace textarea for `.md` template content
- "Save" button (disabled when no changes)
- Collapsible "Template Variables" reference panel listing available `{{variable}}` names

### New Variant Flow

- Click "New Variant" → modal for name (slug) and description
- Option to start blank or duplicate from an existing variant
- Creates via POST, then selects it in the editor

---

## RunConfig Integration

The current single "Prompt" dropdown is replaced with structured prompt_config controls.

### Prompt Selection

- Two dropdowns side by side: "Design System Prompt" and "Page Prompt"
- Each populated from the manifest's variants for that type
- Default: whichever variant is marked `production`, shown with "(LIVE)" suffix

### Model Config (inside Advanced Settings)

- Provider toggle: Anthropic / OpenAI
- Model name dropdown per provider:
  - Anthropic: `claude-sonnet-4-5-20250929`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`
  - OpenAI: `gpt-5.2`, `gpt-5.2-pro`, `gpt-5-mini`
- Temperature slider: 0.0–1.0 (default 0.7, step 0.1)
- Max tokens input: number field (blank = edge function default)
- API key field: shown only for OpenAI, password-type, never persisted

### A/B Mode

When enabled, a second set of prompt selection + model config appears. The orchestrator runs the build pipeline twice per persona — once with config A, once with config B.

---

## Type Changes

```typescript
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
  promptConfig?: PromptSelection;   // replaces promptSource
  promptConfigB?: PromptSelection;  // replaces promptSourceB
  maxTurns: number;
  personaModel: string;
  judgeModel: string;
  skipEvaluation: boolean;
  skipBuild: boolean;
}
```

---

## Orchestrator Wiring

1. `generateAndDeploy()` receives optional `promptConfig: PromptSelection`
2. If provided:
   - Read the design-system `.md` template from BirthBuild filesystem (variant name → manifest → file path)
   - Read the generate-page `.md` template similarly
   - Build `prompt_config` object: `{ system_prompt, model_provider, model_name, temperature, max_tokens, provider_api_key }`
   - Pass to `EdgeFunctionClient.generateDesignSystem()` and `generatePage()`
3. If absent: no `prompt_config` sent — edge functions use hardcoded defaults

## EdgeFunctionClient Changes

Both `generateDesignSystem()` and `generatePage()` accept an optional `promptConfig` parameter. When present, included in the request body as `prompt_config`.

## Security

- `providerApiKey` is passed in-memory only to the edge function HTTP call
- Never written to `summary.json`, run files, or any persistent storage
- The edge function uses it in-flight for the LLM API call and does not store it
