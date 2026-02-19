# BirthBuild Edge Function Contracts

Production endpoint contracts for the BirthBuild Supabase Edge Functions. These were verified against the live edge functions and differ significantly from earlier assumptions.

## Authentication

All endpoints require a **user JWT token** in the `Authorization` header (not the Supabase anon key, not a Bearer-prefixed key).

```
Authorization: <jwt-token>
```

---

## `/chat` Endpoint

Sends a message to the BirthBuild chatbot. The request contains the full conversation history; the server does not maintain session state.

### Request

```
POST /functions/v1/chat
```

```json
{
  "messages": [
    { "role": "user", "content": "I want a website for my bakery" },
    { "role": "assistant", "content": "Great! Let me help you..." },
    { "role": "user", "content": "I want it in blue" }
  ]
}
```

- `messages` - Full conversation history as an array of `{ role, content }` objects.
- There is **no** `site_spec_id`, `message`, or `chat_history` field. The entire conversation is passed as `messages`.

### Response

Raw Claude API format:

```json
{
  "content": [
    { "type": "text", "text": "I'll update the colour scheme to blue." },
    {
      "type": "tool_use",
      "id": "toolu_abc123",
      "name": "update_style",
      "input": { "primary_color": "#0000ff" }
    }
  ],
  "stop_reason": "tool_use",
  "model": "claude-sonnet-4-5-20250929",
  "usage": { "input_tokens": 1500, "output_tokens": 200 }
}
```

- `content` - Array of content blocks, each either `text` or `tool_use`.
- `stop_reason` - One of `"end_turn"`, `"tool_use"`, `"max_tokens"`.
- `model` - The Claude model used.
- `usage` - Token counts for the request.

### Detecting Conversation Completion

The conversation is complete when the response contains a `tool_use` block with:
- `name === "mark_step_complete"`
- `input.next_step === "complete"`

Example:

```json
{
  "type": "tool_use",
  "id": "toolu_xyz",
  "name": "mark_step_complete",
  "input": { "completed_step": "review", "next_step": "complete" }
}
```

---

## `/build` Endpoint

Triggers a site build from generated HTML/CSS files. Returns immediately with a preview URL (no polling needed).

### Request

```
POST /functions/v1/build
```

```json
{
  "site_spec_id": "uuid-here",
  "files": [
    { "path": "index.html", "content": "<!DOCTYPE html>..." },
    { "path": "styles.css", "content": "body { ... }" }
  ]
}
```

- `site_spec_id` - The UUID of the site spec.
- `files` - Array of `{ path, content }` objects with the generated site files.

### Response

```json
{
  "success": true,
  "preview_url": "https://preview.birthbuild.com/abc123"
}
```

The response is **synchronous** -- no polling is required.

---

## `/publish` Endpoint

Publishes or unpublishes a built site.

### Request

```
POST /functions/v1/publish
```

```json
{
  "site_spec_id": "uuid-here",
  "action": "publish"
}
```

- `site_spec_id` - The UUID of the site spec.
- `action` - Either `"publish"` or `"unpublish"`.

### Response (publish)

```json
{
  "success": true,
  "deploy_url": "https://my-bakery.birthbuild.com"
}
```

### Response (unpublish)

```json
{
  "success": true
}
```

---

## Key Differences from Original Assumptions

| Aspect | Original Assumption | Actual Contract |
|--------|-------------------|-----------------|
| Chat request format | `{ site_spec_id, message, chat_history }` | `{ messages }` |
| Chat response format | `{ message, chat_history, is_complete }` | Raw Claude API: `{ content[], stop_reason, model, usage }` |
| Completion detection | `is_complete` boolean field | `mark_step_complete` tool call with `next_step === "complete"` |
| Auth header | `Bearer <anon_key>` | `<jwt_token>` (no Bearer prefix) |
| Build request | `{ site_spec_id }` only | `{ site_spec_id, files[] }` -- requires pre-generated files |
| Build response | Returns `buildId`, requires polling | Returns `{ success, preview_url }` synchronously |
| Publish request | `{ site_spec_id }` only | `{ site_spec_id, action }` where action is publish/unpublish |
| Publish response | `{ previewUrl }` | `{ success, deploy_url }` |
