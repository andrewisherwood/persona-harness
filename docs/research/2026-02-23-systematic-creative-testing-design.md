# Systematic Creative Site Generation Testing

**Date:** 23 February 2026
**Author:** Andrew Isherwood, Dopamine Laboratory
**Status:** Design — not yet implemented

---

## 1. Goal

Build a programmatic research framework that systematically tests LLM-generated website quality across models, style variables, and time. Each run varies one or more independent variables (model, palette, typography, style, brand feeling) while holding the site specification constant, deploys the result, captures accessibility trees and screenshots, and records everything in a database for comparison and publication.

---

## 2. Research Variables

### 2.1 Independent Variables (what we vary)

| Variable | Values | Source |
|----------|--------|--------|
| Model | claude-opus-4-6, claude-sonnet-4-5-20250929, gpt-5.2, gemini-*, future models | CLI arg |
| Palette | sage_sand, blush_neutral, deep_earth, ocean_calm, custom | site_spec.palette |
| Typography | modern, classic, mixed | site_spec.typography |
| Style | modern, classic, minimal | site_spec.style |
| Brand feeling | Reassuring, Warm, Professional, Calm, Bold | site_spec.brand_feeling |
| Temperature | 0.5, 0.7, 0.9 | prompt config |

### 2.2 Control Variables (held constant per test)

- Site specification content (business data, services, testimonials, bio, photos)
- Prompt structure (creative-build.ts prompt template)
- Photo set (8 Dina Hart stock photos)
- Deployment pipeline (Netlify via /build)
- Pages generated (home, about, services, testimonials, faq, contact)

### 2.3 Dependent Variables (what we measure)

| Metric | How captured | Comparison method |
|--------|-------------|-------------------|
| Accessibility tree | Playwright `page.accessibility.snapshot()` | JSON diff between runs |
| Visual output | Full-page screenshots (Playwright) | Side-by-side in dashboard |
| HTML structure | Semantic landmark analysis | Programmatic: count headings, landmarks, images, links |
| CSS complexity | Design system file size, custom property count | Numeric comparison |
| Photo usage | Count of `<img>` tags with stock photo URLs | Programmatic |
| Token usage | Input/output tokens per step | From API response |
| Cost | Calculated from token usage + model rates | Numeric |
| Generation time | Wall clock per step | Timestamps |
| Model version | Exact model ID string | Stored for historical tracking |

---

## 3. Database Schema

New tables in the existing Supabase project.

### 3.1 `creative_runs`

Primary record for each test run.

```sql
create table creative_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  -- Model
  model_provider text not null,        -- 'anthropic', 'openai', 'google'
  model_name text not null,            -- 'claude-opus-4-6', 'gpt-5.2', etc.
  model_version text,                  -- exact version string if available
  temperature numeric(3,2) not null default 0.7,
  max_tokens integer not null default 16384,

  -- Style variables (the independent variables)
  palette text not null,               -- 'sage_sand', 'blush_neutral', etc.
  typography text not null,            -- 'modern', 'classic', 'mixed'
  style text not null,                 -- 'modern', 'classic', 'minimal'
  brand_feeling text not null,         -- 'Reassuring', 'Warm', etc.

  -- Spec reference
  site_spec_name text not null,        -- 'Dina Hart Birth Services'
  site_spec_snapshot jsonb not null,   -- full spec at time of run (immutable)

  -- Results
  preview_url text,                    -- Netlify deploy URL
  total_input_tokens integer,
  total_output_tokens integer,
  total_time_s numeric(8,1),
  estimated_cost_usd numeric(8,4),

  -- Status
  status text not null default 'pending',  -- pending, generating, deploying, complete, error
  error_message text
);
```

### 3.2 `creative_run_pages`

Per-page detail for each run.

```sql
create table creative_run_pages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references creative_runs(id) on delete cascade,
  page_name text not null,             -- 'home', 'about', etc.

  -- Generated content
  html text,
  css text,                            -- only for design-system step

  -- Accessibility
  accessibility_tree jsonb,            -- Playwright snapshot

  -- Metrics
  input_tokens integer,
  output_tokens integer,
  generation_time_s numeric(8,1),

  -- HTML analysis
  img_count integer,
  heading_count integer,
  landmark_count integer,
  link_count integer,
  schema_org_present boolean,

  -- Screenshots stored in Supabase storage, path recorded here
  screenshot_path text,

  created_at timestamptz default now()
);

create index idx_creative_run_pages_run_id on creative_run_pages(run_id);
```

### 3.3 `creative_run_comparisons`

Tracks explicit comparisons between runs (for research write-ups).

```sql
create table creative_run_comparisons (
  id uuid primary key default gen_random_uuid(),
  run_a uuid references creative_runs(id),
  run_b uuid references creative_runs(id),
  variable_changed text not null,      -- which variable differs: 'model', 'palette', etc.
  notes text,                          -- researcher observations
  created_at timestamptz default now()
);
```

---

## 4. Pipeline

### 4.1 Run Execution

Extend `scripts/creative-build.ts` to:

1. Accept style variables as CLI args or a JSON config file
2. Create a `creative_runs` row at start (status: generating)
3. Generate design system + pages (existing logic)
4. After each page: capture accessibility tree, analyse HTML metrics, store in `creative_run_pages`
5. Deploy to Netlify, update `preview_url`
6. Upload screenshots to Supabase storage
7. Update status to complete

```bash
# Single run
npx tsx scripts/creative-build.ts --model claude-opus-4-6 --palette sage_sand --style classic --feeling Reassuring

# Matrix run (all combinations of specified variables)
npx tsx scripts/creative-matrix.ts --models claude-opus-4-6,claude-sonnet-4-5-20250929 --palettes sage_sand,blush_neutral --feeling Reassuring
```

### 4.2 Matrix Testing

A new `scripts/creative-matrix.ts` generates the cartesian product of specified variables and runs them sequentially (respecting rate limits and requiring cost approval for each).

Example: 2 models x 4 palettes x 1 feeling = 8 runs.

### 4.3 HTML Analysis

Programmatic metrics extracted from generated HTML:

```typescript
interface PageMetrics {
  imgCount: number;          // <img> tags
  headingCount: number;      // h1-h6 tags
  landmarkCount: number;     // <header>, <main>, <nav>, <footer>, <section>, <article>
  linkCount: number;         // <a> tags
  schemaOrgPresent: boolean; // JSON-LD script block
  cssClassCount: number;     // unique class names used
  inlineStyleCount: number;  // elements with style="" attributes
  totalHtmlSize: number;     // bytes
}
```

### 4.4 Accessibility Tree Diffing

Compare accessibility trees between runs to identify structural differences:

- Same model, different palette → tree should be identical (layout doesn't change)
- Same palette, different model → tree will differ (models make different layout choices)
- Changes in heading hierarchy, landmark structure, image alt text coverage

---

## 5. Dashboard

### 5.1 New Pages in Persona Harness

| Route | Purpose |
|-------|---------|
| `/research` | List all creative runs, filterable by model/palette/style/feeling |
| `/research/:id` | Single run detail: preview iframe, accessibility tree, metrics, screenshots |
| `/research/compare?a=:id&b=:id` | Side-by-side comparison of two runs |
| `/research/matrix/:id` | Matrix view showing grid of runs by variable combination |

### 5.2 Research List View

Table/grid with columns: model, palette, style, feeling, preview thumbnail, cost, time, status. Sortable and filterable. Click to view detail or select two for comparison.

### 5.3 Comparison View

- Side-by-side iframe previews (responsive, can switch pages)
- Accessibility tree diff (JSON diff highlighting structural differences)
- Metrics comparison table
- Screenshot overlay/slider

### 5.4 Matrix View

Grid layout where rows are one variable (e.g. model) and columns are another (e.g. palette). Each cell shows a thumbnail preview. Click any cell to view detail or compare with adjacent cells.

---

## 6. Long-Term Model Tracking

### 6.1 Model Registry

As new models are released (Claude 5, GPT-6, Gemini 3, etc.), the framework should make it trivial to:

1. Add the model to the provider list in `model-client.ts`
2. Run the standard test matrix against it
3. Compare results to the historical baseline

The `model_name` and `model_version` fields in `creative_runs` provide the historical record. Dashboard filtering by model enables trend analysis over time.

### 6.2 Baseline Runs

Designate specific runs as "baselines" for each model. When a new model version is tested, compare against the previous version's baseline to detect improvements or regressions.

### 6.3 Publishing

The database provides the structured data needed for research publications:

- Controlled methodology (same spec, same photos, same prompt)
- Quantitative metrics (tokens, cost, time, HTML structure)
- Qualitative comparison (deployed live sites, screenshots)
- Accessibility analysis (tree diffing)
- Reproducible (same script + spec = same test conditions)

Research write-ups can pull directly from the database to generate tables, charts, and comparison grids.

---

## 7. Implementation Plan

### Phase 1: Database + CLI (foundation)

1. Create Supabase migration for `creative_runs` and `creative_run_pages` tables
2. Extend `creative-build.ts` to write results to database
3. Add HTML metrics extraction
4. Add accessibility tree capture (already working)
5. Add screenshot upload to Supabase storage

### Phase 2: Dashboard (visualisation)

6. Add `/research` route with run list
7. Add `/research/:id` detail view with iframe preview
8. Add `/research/compare` side-by-side view
9. Add accessibility tree diff viewer

### Phase 3: Matrix Testing (scale)

10. Build `creative-matrix.ts` for cartesian product runs
11. Add `/research/matrix` grid view
12. Add cost approval gate per run
13. Add OpenAI and Gemini support to creative-build.ts

### Phase 4: Publishing (output)

14. Export functions for research tables/charts
15. Baseline designation and regression detection
16. Comparison report generator (markdown)

---

## 8. Cost Management

Each creative Opus build costs ~$6.55. A full matrix of 2 models x 4 palettes x 3 styles x 3 feelings = 72 runs = ~$470. This requires explicit approval.

Safeguards:
- `creative-matrix.ts` prints estimated total cost before starting and requires confirmation
- Individual runs print cost at completion
- Dashboard shows cumulative research spend
- Daily budget cap in harness-config.json applies

---

## 9. Technical Notes

- Creative builds bypass edge functions entirely (direct API calls) so edge function rate limits don't apply
- Netlify deployment via `/build` edge function still has rate limits — deploy sequentially
- Supabase storage for screenshots (cheaper than database BLOB)
- Accessibility trees stored as JSONB for direct querying
- The `site_spec_snapshot` in `creative_runs` captures the exact spec used, so historical runs remain valid even if the spec evolves
