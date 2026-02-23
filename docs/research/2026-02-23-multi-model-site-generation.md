# Multi-Model Site Generation: Comparative Analysis

**Date:** 23 February 2026
**Author:** Andrew Isherwood, Dopamine Laboratory
**Status:** In progress — Claude Sonnet 4.5 vs GPT-5.2 complete; Opus 4.6 and Gemini pending

---

## Abstract

We built an automated testing harness that generates complete, production-deployed websites from a single structured data specification using different LLM backends. By holding the prompt, data, and deployment pipeline constant and swapping only the model, we can perform controlled A/B comparisons of site generation quality across providers. Early results reveal significant behavioural differences between Claude Sonnet 4.5 and GPT-5.2 that go beyond output quality into fundamental model policy territory.

---

## 1. Test Architecture

### 1.1 The Problem

Evaluating LLM-generated websites is hard. Output varies with every generation. Comparing models manually is subjective and slow. We needed a system that could:

- Hold every variable constant except the model
- Deploy real, publicly-accessible sites for visual comparison
- Run repeatedly with different model/prompt/temperature combinations
- Track costs per generation

### 1.2 The Harness

The testing harness is a Node.js/TypeScript application with a React dashboard. It orchestrates multi-step site generation through production edge functions, with the model provider configurable at runtime.

**Key components:**

- **Structured site specification** — A JSON document containing all business data: name, services, pricing, bio, testimonials, photos, style preferences, colour palette, typography. This is the single source of truth for every generation.
- **Design system generation** — An LLM call that produces a complete CSS design system (variables, reset, layout, components, responsive breakpoints), navigation HTML, and footer HTML from the spec. The prompt specifies exact colour values, font names, and required CSS selectors.
- **Page generation** — Parallel LLM calls (one per page) that produce complete HTML pages using the design system CSS, navigation, footer, and page-specific content from the spec. Stock photos are passed as URLs with alt text.
- **CSS enforcement** — A post-processing step strips all generated `<style>` blocks from pages and re-injects only the design system CSS. This prevents models from overriding brand colours or introducing conflicting styles.
- **Selector validation** — The design system output is checked for required CSS selectors. Missing selectors trigger an automatic repair cycle.
- **Automated deployment** — Generated files are deployed to Netlify via API, producing a unique preview URL per run.

### 1.3 Build-Only Mode

The harness supports a "build-only" mode that skips the conversation simulation and reuses a previously-captured site specification. This enables rapid prompt iteration: change a prompt, deploy the edge function, trigger a build, inspect the result — typically under 3 minutes per cycle.

### 1.4 Multi-Provider Routing

The edge functions accept a `prompt_config` object specifying provider, model name, temperature, max tokens, and an optional API key. A model client abstraction routes requests to the appropriate provider API (Anthropic or OpenAI), normalising tool calling conventions and response formats. This means the same prompt reaches both models through identical code paths.

---

## 2. Test Methodology

### 2.1 Control Variables

| Variable | Value |
|----------|-------|
| Site specification | "Dina Hart Birth Services" — Brighton-based doula with 4 services, 4 testimonials, full bio, 8 stock photos |
| Design system prompt | v1-structured (identical for both models) |
| Page prompt | v1-structured (identical for both models) |
| Pages generated | home, about, services, testimonials, faq, contact |
| Temperature | 0.7 |
| Stock photos | 8 images (1 hero, 1 headshot, 6 gallery) passed as Supabase storage URLs |

### 2.2 Independent Variable

| Run | Provider | Model | Max Tokens |
|-----|----------|-------|------------|
| A (baseline) | Anthropic | claude-sonnet-4-5-20250929 | 8,192 |
| B | OpenAI | gpt-5.2 | 16,384 |

GPT-5.2 required double the token budget — at 8,192 tokens it hit `max_tokens` before completing the design system tool call.

---

## 3. Results

### 3.1 Structural Compliance

| Criterion | Claude Sonnet 4.5 | GPT-5.2 |
|-----------|-------------------|---------|
| All 6 pages generated | Yes | Yes |
| Valid HTML5 | Yes | Yes |
| Semantic landmarks | Yes | Yes |
| Design system CSS applied | Yes | Yes |
| Correct colour palette | Yes | Yes |
| Correct typography | Yes | Yes |
| Navigation with all pages | Yes | Yes |
| Footer with social icons | Yes | Yes |
| CSS-only mobile hamburger | Yes | Yes |
| JSON-LD structured data | Yes | Yes |
| British English | Yes | Yes |

Both models produced structurally valid, well-organised HTML with correct brand colours and typography. GPT-5.2's CSS design system was thorough and well-commented.

### 3.2 Visual Richness

| Element | Claude Sonnet 4.5 | GPT-5.2 |
|---------|-------------------|---------|
| Hero section | Full-bleed photo with gradient overlay | Text-only gradient (no photo) |
| Service cards | Photo cards with images | Plain text cards |
| About section | Headshot + two-column grid | Text only |
| Total `<img>` tags in homepage | 5 | 0 |
| Stock photos used | 5 of 8 | 0 of 8 |

This is the most significant finding. GPT-5.2 produced **zero image tags** across the entire homepage despite:

1. Eight stock photo URLs listed in the `## Photos` section of the prompt
2. Explicit instructions: "PHOTOS ARE PROVIDED — you MUST use them"
3. Literal HTML templates with exact `<img>` markup to copy
4. Three successive prompt strengthening iterations

### 3.3 Content Quality

| Aspect | Claude Sonnet 4.5 | GPT-5.2 |
|--------|-------------------|---------|
| Heading copy | Good — natural, varied | Very good — warmer, more human |
| Service descriptions | Faithful to spec | Faithful to spec, slightly tighter |
| Bio extract | Verbatim from spec | Paraphrased, well-edited |
| CTA copy | Functional | More varied, contextual |
| Section structure | 5 sections | 5–6 sections, richer hierarchy |
| Overall tone | Professional, clean | Professional, warmer |

GPT-5.2's copywriting was arguably stronger. It paraphrased the bio into a more compelling narrative extract rather than copying verbatim. Heading choices ("Support that meets you where you are", "Let's talk about your birth") felt warmer and more client-appropriate than Claude's more functional headings.

### 3.4 Technical Differences

| Metric | Claude Sonnet 4.5 | GPT-5.2 |
|--------|-------------------|---------|
| Max tokens required | 8,192 | 16,384 |
| Design system CSS size | ~8.5KB | ~9.2KB |
| Required API fix | None | `max_completion_tokens` (not `max_tokens`) |
| Build time (6 pages) | ~2 min | ~5 min |

GPT-5.2 required an API compatibility fix — OpenAI's newer models reject the `max_tokens` parameter in favour of `max_completion_tokens`. This caused silent 400 errors until diagnosed.

---

## 4. Analysis

### 4.1 The Image Problem

GPT-5.2's refusal to include external image URLs appears systematic. Across three prompt iterations — from soft ("if photos are available, insert `<img>` tags") to hard ("PHOTOS ARE PROVIDED — you MUST use them") to literal (providing exact `<img>` HTML to copy) — the model consistently generated image-free HTML.

The generated HTML contained zero references to `supabase.co` or any external domain. The model used `.hero--text-only` (the explicitly-documented no-photo fallback) even when the prompt said "do NOT use .hero--text-only".

**Hypothesis:** GPT-5.2 has a safety behaviour that strips or avoids embedding external URLs in generated HTML/code output. This may be a deliberate policy choice to prevent the model from being used to generate phishing pages or sites that load external resources. Whatever the cause, it makes GPT-5.2 unsuitable for image-rich site generation without a post-processing injection step.

### 4.2 Prompt Compliance vs Creative Quality

An unexpected inversion emerged: the model that followed instructions less faithfully (GPT-5.2) produced better prose. Its heading copy, bio paraphrasing, and CTA language were warmer and more commercially effective. Claude followed the structural instructions precisely but produced more functional, less inspired copy.

This suggests a potential hybrid approach: use Claude for structural generation (where exact compliance matters) and GPT for copywriting refinement (where creative interpretation adds value).

### 4.3 Token Economics

GPT-5.2 required 2x the token budget for the design system generation step. Combined with longer generation times (~5 min vs ~2 min for a full 6-page build), the per-site cost difference is material at scale. The "1/10th the cost" hypothesis that motivated this comparison does not hold for this use case — output tokens are the expensive dimension, and GPT-5.2 used more of them while producing less visually complete output.

---

## 5. Prompt Engineering Insights

### 5.1 CSS Enforcement Architecture

A critical discovery from the prompt optimisation sessions preceding this comparison: when a post-processor strips and replaces CSS (`enforceDesignSystemCss()`), every CSS class referenced in page HTML must be defined in the design system prompt. Page-level styles are discarded. This constraint applies equally to all models.

**Required CSS selectors** are validated programmatically. Missing selectors trigger a repair prompt. This creates a reliable quality floor regardless of which model generates the output.

### 5.2 What Works Across Models

Both models reliably:

- Follow colour palette constraints when values are given as exact hex codes with strong "do not modify" language
- Generate valid semantic HTML with proper landmark roles
- Use CSS custom properties consistently when the `:root` block is specified
- Produce working CSS-only hamburger menus from a checkbox hack description
- Generate valid JSON-LD structured data
- Respect British English spelling when instructed

### 5.3 What Diverges Across Models

- **External resource embedding** — Claude embeds provided URLs; GPT-5.2 does not
- **Conditional instruction following** — Claude follows "if X, do Y; otherwise do Z" precisely; GPT-5.2 gravitates toward the simpler branch
- **Token efficiency** — Claude completes the same design system in half the tokens
- **Creative interpretation** — GPT-5.2 paraphrases and improves copy; Claude reproduces more faithfully

---

## 6. Next Steps

### 6.1 Pending Model Tests

| Model | Provider | Hypothesis |
|-------|----------|-----------|
| Claude Opus 4.6 | Anthropic | Higher quality at higher cost — does the premium justify itself for site generation? |
| Gemini | Google | Third provider comparison — does the image embedding issue repeat? |

### 6.2 Post-Processing Image Injection

If GPT-5.2's image avoidance is confirmed as a persistent model behaviour (not a transient issue), a programmatic image injection step could be built. This would detect `.hero--text-only` and plain `.card` elements in the output HTML and replace them with their photo-bearing equivalents using the known photo URLs. This would allow GPT-5.2's superior copywriting to be combined with programmatic visual richness.

### 6.3 Prompt Simplification

The current design system prompt is ~120 lines with detailed per-selector requirements. A simplification experiment would test whether models can produce equivalent output from a shorter, less prescriptive prompt — and whether the answer differs by model.

---

## 7. Live Comparison URLs

| Model | URL |
|-------|-----|
| Claude Sonnet 4.5 | https://birthbuild-dina-hart-1joo.netlify.app |
| GPT-5.2 (attempt 1, 8k tokens — failed) | — |
| GPT-5.2 (attempt 2, 16k tokens, no photo fix) | https://birthbuild-dina-hart-tlb8.netlify.app |
| GPT-5.2 (attempt 3, strengthened prompt) | https://birthbuild-dina-hart-ebo1.netlify.app |
| GPT-5.2 (attempt 4, literal HTML templates) | https://birthbuild-dina-hart-p9zv.netlify.app |

All four GPT-5.2 builds contain zero `<img>` tags in `<main>`, confirming the behaviour is consistent across prompt variations.

---

## Appendix A: Infrastructure Built During This Research

| Component | Purpose |
|-----------|---------|
| Multi-provider model client | Routes LLM calls to Anthropic or OpenAI with normalised tool calling |
| `prompt_config` pipeline | Passes provider/model/temperature/key from dashboard UI through API server to edge functions |
| `OPENAI_API_KEY` environment injection | Server reads key from `.env` so it doesn't need entering per-run |
| `max_completion_tokens` fix | OpenAI GPT-5.2 rejects deprecated `max_tokens` parameter |
| CSS selector validation + repair | Automated quality gate for design system output |
| `enforceDesignSystemCss()` | Post-processor ensuring brand fidelity regardless of model behaviour |
| Build-only mode | Rapid iteration (~2 min/cycle) reusing saved site specifications |
| Automated Netlify deployment | Each build produces a unique, publicly-accessible preview URL |
