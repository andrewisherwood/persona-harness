# SCOPING.md — Persona Testing Harness

**Project:** Conversation Evaluation Harness for Elicitation Quality Testing
**Owner:** Dopamine Labs (infrastructure IP — vertical-agnostic)
**Date:** February 2026
**Status:** Ready for Build
**First deployment:** BirthBuild specification density testing
**Scales to:** Any Dopamine Labs chatbot product (physiotherapistbuild, therapistbuild, etc.)

---

## 1. Problem Statement

Dopamine Labs is building chatbot-driven products where the quality of the generated output is a direct function of the quality of data the chatbot elicits from the user. The chatbot's system prompt makes real-time decisions about when to follow up, how hard to probe, when to back off, and when to show a payoff signal. These decisions are conditional on the user's tone, detail level, and engagement signals.

This creates a testing problem that traditional QA can't solve:

- **Unit tests** can verify that tool calls write to the correct fields. They can't tell you that a follow-up question felt tone-deaf.
- **MAI's QA agent** can check that the build compiles and the API returns 200s. It can't evaluate whether the chatbot backed off gracefully when a user signalled discomfort.
- **Manual testing** catches these things but doesn't scale, doesn't run on every prompt change, and depends on whoever's testing being able to embody different user types convincingly.

What's needed is an automated system that simulates different user types, feeds their responses to the chatbot, records every decision the chatbot makes, and evaluates the conversation against per-persona quality criteria using a separate LLM as judge.

This is not a one-off BirthBuild thing. Every Dopamine Labs product that uses a chatbot to elicit structured data from users will need the same architecture. The personas change, the criteria change, the fields change — but the harness is the same.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Persona Testing Harness             │
│                                                  │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │  Persona      │    │  Target Chatbot       │  │
│  │  Simulator    │◄──►│  (Supabase Edge Fn    │  │
│  │  (LLM acting  │    │   or direct API)      │  │
│  │   as user)    │    │                       │  │
│  └──────┬───────┘    └───────────┬───────────┘  │
│         │                        │               │
│         ▼                        ▼               │
│  ┌──────────────────────────────────────────┐   │
│  │         Conversation Logger               │   │
│  │  Records: every message, tool call,       │   │
│  │  follow-up decision, field written,       │   │
│  │  density score at each turn               │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│                     ▼                            │
│  ┌──────────────────────────────────────────┐   │
│  │         LLM-as-Judge Evaluator            │   │
│  │  Scores conversation against per-persona  │   │
│  │  criteria rubric. Returns structured      │   │
│  │  scores + reasoning.                      │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│                     ▼                            │
│  ┌──────────────────────────────────────────┐   │
│  │         Results Store + Reporter          │   │
│  │  JSON logs, diffs between runs,           │   │
│  │  regression detection, summary report     │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

Three LLM calls in play:

1. **Persona Simulator** — an LLM acting as the user, following a persona definition and responding to the chatbot in character
2. **Target Chatbot** — the system under test (BirthBuild's chatbot, or any future product's chatbot)
3. **LLM-as-Judge Evaluator** — a separate LLM that reads the full conversation transcript and scores it against a criteria rubric

These should use different models where possible to avoid self-evaluation bias. Recommended: persona simulator uses Claude Sonnet, target chatbot uses whatever it uses in production (Claude Sonnet via Edge Function), judge uses Claude Opus for the most nuanced evaluation.

---

## 3. Persona Definitions

A persona is a structured JSON document that defines how a simulated user behaves. Personas are vertical-specific but follow a universal schema.

### 3.1 Universal Persona Schema

```typescript
interface Persona {
  id: string;                          // "sparse-sarah"
  name: string;                        // "Sparse Sarah"
  vertical: string;                    // "birthbuild" | "physiobuild" | etc
  
  // Who is this person?
  background: string;                  // Narrative description of the person
  
  // How do they communicate?
  communication_style: {
    detail_level: "minimal" | "moderate" | "verbose";
    tone: "hesitant" | "neutral" | "confident" | "enthusiastic";
    typical_response_length: "1-5 words" | "1-2 sentences" | "paragraph";
    quirks: string[];                  // ["uses ellipsis...", "asks 'is that okay?'"]
  };
  
  // What do they know and share?
  knowledge: {
    knows_about_their_field: "beginner" | "intermediate" | "expert";
    self_awareness: "low" | "medium" | "high";  // how well they can articulate what makes them different
    willingness_to_share: "reluctant" | "open" | "eager";
  };
  
  // What data should they provide?
  seed_data: Record<string, string>;   // key-value pairs of info they "have" but may not volunteer
  
  // What data they explicitly lack
  gaps: string[];                      // fields they genuinely don't have (e.g. "testimonials", "booking_url")
  
  // Behavioural triggers
  triggers: {
    will_elaborate_if: string[];       // conditions under which they open up
    will_shut_down_if: string[];       // conditions that cause them to withdraw
    will_skip_if: string[];            // questions they want to skip
  };
}
```

### 3.2 BirthBuild Personas

#### Sparse Sarah

```json
{
  "id": "sparse-sarah",
  "name": "Sparse Sarah",
  "vertical": "birthbuild",
  "background": "Sarah qualified as a birth doula 6 months ago through Doula UK. She's supported 4 families so far. She's not a confident writer and finds it hard to talk about herself. She knows she needs a website but dreads the process. She'll give the minimum viable answer to every question unless specifically encouraged.",
  "communication_style": {
    "detail_level": "minimal",
    "tone": "hesitant",
    "typical_response_length": "1-5 words",
    "quirks": ["answers with fragments not sentences", "says 'I think' and 'maybe'", "often answers with just a place name or service type"]
  },
  "knowledge": {
    "knows_about_their_field": "beginner",
    "self_awareness": "low",
    "willingness_to_share": "reluctant"
  },
  "seed_data": {
    "business_name": "Sarah's Doula Services",
    "doula_name": "Sarah Mitchell",
    "primary_location": "Bristol",
    "service_areas": "Bristol",
    "services": "birth doula",
    "training_provider": "Doula UK",
    "email": "sarah@email.com",
    "bio_previous_career": "teaching assistant",
    "philosophy": "being there for people"
  },
  "gaps": ["testimonials", "booking_url", "social_links", "additional_training", "signature_story"],
  "triggers": {
    "will_elaborate_if": ["given specific examples to choose from", "asked about her training experience specifically", "told that a detail will help clients find her"],
    "will_shut_down_if": ["asked to write a paragraph about herself", "asked about pricing when she's unsure", "asked more than 2 follow-ups on the same topic"],
    "will_skip_if": ["testimonials", "social media", "booking tool"]
  }
}
```

**What Sparse Sarah tests:** The elicitation floor. Can the chatbot coax useful detail from someone giving the bare minimum? Does it back off after 2 failed follow-ups? Does it avoid making her feel inadequate? Does it still produce a functional spec?

#### Detailed Dina

```json
{
  "id": "detailed-dina",
  "name": "Detailed Dina",
  "vertical": "birthbuild",
  "background": "Dina has been a birth doula for 8 years. She's supported over 100 families. She previously ran her own business (a café) so she's commercially minded and knows exactly what she wants. She has a clear brand identity, existing testimonials, and a booking system already set up. She's articulate and will often answer multiple questions in a single message.",
  "communication_style": {
    "detail_level": "verbose",
    "tone": "confident",
    "typical_response_length": "paragraph",
    "quirks": ["pre-empts the next question", "volunteers information unprompted", "uses professional terminology correctly", "sometimes gives more than was asked"]
  },
  "knowledge": {
    "knows_about_their_field": "expert",
    "self_awareness": "high",
    "willingness_to_share": "eager"
  },
  "seed_data": {
    "business_name": "Dina Hart Birth Services",
    "doula_name": "Dina Hart",
    "primary_location": "Brighton",
    "service_areas": "Brighton, Hove, Lewes, Worthing, Shoreham, East Sussex",
    "services": "birth doula, postnatal doula, hypnobirthing",
    "birth_types": "home birth, hospital, birth centre, VBAC, water birth",
    "experience_level": "100+",
    "training_provider": "Developing Doulas",
    "training_year": "2018",
    "additional_training": "spinning babies, rebozo, trauma-informed care, aromatherapy for birth",
    "bio_previous_career": "ran a café for 6 years before retraining",
    "bio_origin_story": "had a transformative home birth with her second child and knew she wanted to support other women through that experience",
    "philosophy": "evidence-based, informed choice, physiological birth where possible but no judgment",
    "client_perception": "calm, prepared, makes you feel like you've got this",
    "signature_story": "supported a first-time mum through a planned home birth that transferred to hospital — the mum later said having Dina there made the transfer feel safe rather than scary",
    "testimonials": "Dina was incredible. She supported our home birth in Lewes and I genuinely don't know how we'd have managed without her. Her calm presence and preparation made all the difference. - Emma R.",
    "email": "dina@dinahart.com",
    "phone": "07700 900123",
    "booking_url": "https://calendly.com/dinahart",
    "social_links": "instagram.com/dinahartbirth, facebook.com/dinahartbirth",
    "brand_feeling": "warm, professional, reassuring",
    "style_inspiration_url": "https://some-beautiful-doula-site.com",
    "doula_uk": "yes"
  },
  "gaps": [],
  "triggers": {
    "will_elaborate_if": ["asked about anything — she's always willing"],
    "will_shut_down_if": ["asked a question she's already answered", "treated as if she doesn't know what she wants"],
    "will_skip_if": []
  }
}
```

**What Detailed Dina tests:** The ceiling and the redundancy detector. Does the chatbot recognise when information has already been provided? Does it skip follow-ups that would feel redundant? Does it gracefully handle multi-field answers? Does the resulting spec capture everything she volunteered? Does it achieve a high density score without asking unnecessary questions?

#### Nervous Nora

```json
{
  "id": "nervous-nora",
  "name": "Nervous Nora",
  "vertical": "birthbuild",
  "background": "Nora qualified last month through the Developing Doulas programme. She hasn't supported any families yet. She's excited but terrified about putting herself out there. She compares herself to more experienced doulas and feels like a fraud. She needs the website but is anxious about what to say because she doesn't feel she has 'enough' to show yet.",
  "communication_style": {
    "detail_level": "moderate",
    "tone": "hesitant",
    "typical_response_length": "1-2 sentences",
    "quirks": ["self-deprecating ('I know that's not very impressive')", "asks for reassurance ('is that okay?', 'is that enough?')", "apologises unnecessarily ('sorry, I don't have much to say about that')", "uses laughing emoji to mask nervousness"]
  },
  "knowledge": {
    "knows_about_their_field": "beginner",
    "self_awareness": "medium",
    "willingness_to_share": "open"
  },
  "seed_data": {
    "business_name": "Nora James Doula",
    "doula_name": "Nora James",
    "primary_location": "Manchester",
    "service_areas": "Manchester, Salford",
    "services": "birth doula",
    "birth_types": "all types",
    "experience_level": "starting out",
    "training_provider": "Developing Doulas",
    "training_year": "2026",
    "bio_previous_career": "nurse for 12 years",
    "bio_origin_story": "always felt drawn to birth support after witnessing births during nursing, finally took the leap after her own positive birth experience",
    "philosophy": "every birth deserves compassionate support, regardless of how it unfolds",
    "email": "nora.james.doula@gmail.com",
    "brand_feeling": "gentle, approachable"
  },
  "gaps": ["testimonials", "additional_training", "booking_url", "signature_story", "social_links", "phone"],
  "triggers": {
    "will_elaborate_if": ["validated ('that's a really strong foundation')", "given permission to be new ('everyone starts somewhere')", "asked about her nursing background which she's proud of"],
    "will_shut_down_if": ["asked about experience numbers without validation", "asked for testimonials (she has none and feels bad about it)", "asked to compare herself to other doulas", "asked how many births she's attended (answer is zero and she's embarrassed)"],
    "will_skip_if": ["testimonials", "signature story", "phone number"]
  }
}
```

**What Nervous Nora tests:** The emotional edge. Does the chatbot read hesitancy and adjust? Does it validate where she is rather than highlighting what she lacks? Does it avoid asking about experience in a way that makes zero births feel inadequate? Does it lean into her nursing background (which she IS proud of) rather than dwelling on her doula inexperience? Does the resulting site frame her as a newly qualified doula with 12 years of clinical experience rather than "someone who hasn't done any births yet"?

---

## 4. Conversation Simulation

### 4.1 Persona Simulator Prompt

The persona simulator is an LLM given a persona definition and instructed to respond to the chatbot in character. It does NOT see the chatbot's system prompt — it only sees the chatbot's messages, exactly as a real user would.

```
You are simulating a user interacting with a website builder chatbot. 
You must stay in character as the following persona:

{persona JSON}

RULES:
- Respond as this person would. Match their communication style, 
  detail level, tone, and quirks exactly.
- Only share information from seed_data. Do not invent details.
- If seed_data has a value for something the chatbot asks about, 
  share it — but in a way that matches the persona's style. Sparse 
  Sarah says "Bristol" not "I'm based in Bristol, covering the 
  greater Bristol area."
- If the chatbot asks about something in your gaps list, respond 
  as the persona would — Sparse Sarah says "not yet", Nervous Nora 
  says "sorry, I don't have any yet 😅"
- Respond to the triggers defined in the persona. If a trigger 
  condition is met, adjust your behaviour accordingly.
- Do not break character. Do not explain what you're doing. 
  Just respond as the user.
- Keep responses natural. Real users don't answer in perfect 
  JSON or bullet points.
```

### 4.2 Conversation Loop

```typescript
interface ConversationTurn {
  turn_number: number;
  role: "assistant" | "user";
  content: string;
  tool_calls?: ToolCall[];          // chatbot's tool calls this turn
  fields_written?: Record<string, any>;  // what was saved to spec
  follow_up_triggered?: boolean;    // did the chatbot ask a follow-up?
  follow_up_topic?: string;         // what topic was the follow-up about?
  density_score?: DensityResult;    // spec density at this point
  timestamp: string;
}

async function simulateConversation(
  persona: Persona,
  chatbotEndpoint: string,
  maxTurns: number = 60
): Promise<ConversationTurn[]> {
  
  const turns: ConversationTurn[] = [];
  const chatHistory: Message[] = [];
  
  // Get initial chatbot greeting
  const greeting = await callChatbot(chatbotEndpoint, chatHistory);
  turns.push({ turn_number: 1, role: "assistant", content: greeting.message, ...});
  chatHistory.push({ role: "assistant", content: greeting.message });
  
  for (let i = 2; i <= maxTurns; i++) {
    // Simulate user response
    const userResponse = await simulatePersona(persona, chatHistory);
    
    // Check for conversation end signals
    if (userResponse.includes("[BUILD]") || greeting.buildTriggered) break;
    
    turns.push({ turn_number: i, role: "user", content: userResponse });
    chatHistory.push({ role: "user", content: userResponse });
    
    // Get chatbot response
    const botResponse = await callChatbot(chatbotEndpoint, chatHistory);
    i++;
    turns.push({ 
      turn_number: i, 
      role: "assistant", 
      content: botResponse.message,
      tool_calls: botResponse.toolCalls,
      fields_written: botResponse.fieldsWritten,
      follow_up_triggered: botResponse.isFollowUp,
      follow_up_topic: botResponse.followUpTopic,
      density_score: computeDensityScore(botResponse.currentSpec)
    });
    chatHistory.push({ role: "assistant", content: botResponse.message });
  }
  
  return turns;
}
```

### 4.3 Chatbot Integration

The harness needs to talk to the chatbot the same way the frontend does. Two integration modes:

**Mode A: Direct API** — call the Supabase Edge Function directly with the same payload the frontend sends. This tests the real system. Requires a test tenant and test user in Supabase.

**Mode B: Isolated prompt** — extract the system prompt and tool definitions, call Claude API directly without Supabase. Faster, cheaper, no database setup. Good for rapid iteration on prompt changes. Doesn't test the full pipeline.

Start with Mode B for development speed. Use Mode A for pre-deploy validation.

---

## 5. LLM-as-Judge Evaluation

After a conversation completes, the full transcript is sent to a judge LLM with a per-persona evaluation rubric.

### 5.1 Universal Evaluation Criteria

These apply to every persona in every vertical:

```typescript
interface UniversalCriteria {
  completion: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "Did the conversation reach the build/review stage?";
  };
  follow_up_appropriateness: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "Were follow-ups triggered at the right moments and avoided when unnecessary?";
  };
  redundancy_avoidance: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "Did the chatbot avoid asking for information the user had already provided?";
  };
  opt_out_respect: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "When the user signalled they wanted to skip or move on, did the chatbot respect that?";
  };
  tone_consistency: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "Did the chatbot maintain an appropriate, warm tone throughout?";
  };
  payoff_signals: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "Did the chatbot explain why specific details matter when they were provided?";
  };
  conversation_naturalness: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "Did the conversation feel like a natural chat or like a form with extra steps?";
  };
}
```

### 5.2 Per-Persona Criteria

These are specific to each persona and test the failure modes that persona represents:

#### Sparse Sarah — Elicitation Floor

```typescript
{
  gentle_probing: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "When Sarah gave minimal answers, did the chatbot gently offer examples or options rather than open-ended follow-ups?";
  },
  graceful_retreat: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "After 2 unsuccessful follow-ups on a topic, did the chatbot move on without making Sarah feel she'd failed?";
  },
  max_follow_ups_respected: {
    check: boolean;
    description: "Did the chatbot ever ask more than 2 follow-ups on the same topic?";
    // HARD FAIL if true
  },
  minimum_viable_spec: {
    check: boolean;
    description: "Despite minimal input, does the resulting spec contain enough data to generate a functional site?";
  },
  density_score_range: {
    expected_min: 8,
    expected_max: 14,
    actual: number;
    description: "Low density but above the functional threshold";
  }
}
```

#### Detailed Dina — Redundancy Detection

```typescript
{
  information_recognition: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "When Dina volunteered information that answered multiple upcoming questions, did the chatbot recognise this and skip those questions?";
  },
  multi_field_parsing: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "When Dina gave a paragraph containing multiple field values, did the chatbot extract and save all of them?";
  },
  redundant_questions: {
    count: number;
    description: "Number of times the chatbot asked for information Dina had already provided";
    // 0 = pass, 1 = warning, 2+ = fail
  },
  efficiency: {
    total_turns: number;
    description: "Dina's conversations should be shorter than average because she volunteers so much. A long conversation suggests the chatbot isn't recognising pre-provided data.";
    expected_max_turns: 30;
  },
  density_score_range: {
    expected_min: 21,
    expected_max: 25,
    actual: number;
    description: "Should achieve excellent density with minimal prompting";
  }
}
```

#### Nervous Nora — Emotional Intelligence

```typescript
{
  validation_given: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "When Nora expressed self-doubt or apologised, did the chatbot validate her rather than ignore it or move on?";
  },
  experience_sensitivity: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "When asking about experience levels, did the chatbot frame it in a way that doesn't make 'just starting out' feel inadequate?";
  },
  strength_identification: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "Did the chatbot identify and lean into Nora's strengths (12 years nursing) rather than dwelling on her lack of doula experience?";
  },
  gap_handling: {
    score: 1 | 2 | 3 | 4 | 5;
    description: "When Nora said she didn't have testimonials, did the chatbot normalise this and offer a path forward rather than making her feel behind?";
  },
  no_harm_questions: {
    check: boolean;
    description: "Did the chatbot avoid asking 'how many births have you attended?' or 'tell me about a birth that stayed with you' without first establishing she's newly qualified?";
    // HARD FAIL if it asked these cold
  },
  density_score_range: {
    expected_min: 10,
    expected_max: 17,
    actual: number;
    description: "Medium density — higher than Sarah because Nora is willing to share, lower than Dina because she lacks some data";
  }
}
```

### 5.3 Judge Prompt Template

```
You are evaluating a conversation between a chatbot website builder 
and a user. The user is a simulated persona with specific 
characteristics. Your job is to score the chatbot's performance 
against the criteria below.

## Persona Profile
{persona JSON}

## Full Conversation Transcript
{conversation turns as formatted text}

## Evaluation Criteria

### Universal Criteria
{universal criteria list with descriptions}

### Persona-Specific Criteria
{per-persona criteria list with descriptions}

## Instructions

For each criterion:
1. State the criterion name
2. Give a score (1-5 scale or boolean as specified)
3. Provide 1-2 sentences of reasoning citing specific turn numbers
4. Flag any HARD FAIL conditions

Then provide:
- An overall quality score (1-5)
- The single most important improvement the chatbot could make 
  for this persona type
- Whether this conversation would pass regression testing 
  (yes/no with reasoning)

Respond in JSON format matching this schema:
{output schema}
```

---

## 6. Results & Reporting

### 6.1 Run Output Structure

Each test run produces:

```
runs/
├── 2026-02-18T14-30-00/
│   ├── meta.json                    # run metadata (prompt version, model, timestamp)
│   ├── sparse-sarah/
│   │   ├── conversation.json        # full turn-by-turn transcript
│   │   ├── evaluation.json          # judge scores + reasoning
│   │   └── spec-snapshot.json       # final site spec state
│   ├── detailed-dina/
│   │   ├── conversation.json
│   │   ├── evaluation.json
│   │   └── spec-snapshot.json
│   ├── nervous-nora/
│   │   ├── conversation.json
│   │   ├── evaluation.json
│   │   └── spec-snapshot.json
│   └── summary.json                 # aggregate scores, pass/fail, regressions
```

### 6.2 Summary Report

```typescript
interface TestRunSummary {
  run_id: string;
  timestamp: string;
  prompt_version: string;           // git hash or version tag of system prompt
  model: string;                    // "claude-sonnet-4-5-20250929"
  
  personas: {
    [persona_id: string]: {
      passed: boolean;
      overall_score: number;
      hard_fails: string[];         // list of hard-fail criteria triggered
      density_score: DensityResult;
      total_turns: number;
      universal_scores: Record<string, number>;
      persona_scores: Record<string, number | boolean>;
      top_improvement: string;
    }
  };
  
  regression: {
    detected: boolean;
    details: string[];              // what regressed vs previous run
  };
  
  overall_pass: boolean;            // all personas passed, no regressions
}
```

### 6.3 Regression Detection

On each run, compare against the previous run's scores:

- **Score drop > 1 point** on any criterion → flag as regression
- **Hard fail triggered** that wasn't triggered previously → flag as regression
- **Density score outside expected range** → flag as regression
- **Turn count increase > 30%** for Detailed Dina → flag (chatbot getting less efficient)
- **Turn count decrease > 30%** for Sparse Sarah → flag (chatbot giving up too early)

### 6.4 Human-Readable Report

Generate a markdown summary for each run:

```markdown
# Persona Test Run — 2026-02-18 14:30

**Prompt version:** abc123f
**Model:** claude-sonnet-4-5
**Result:** ✅ PASS (no regressions)

## Sparse Sarah
Score: 3.8/5 | Density: 11/25 (medium) | Turns: 28
✅ Graceful retreat after 2 follow-ups (turn 14, turn 22)
✅ Offered examples when Sarah gave one-word answers
⚠️ Follow-up on philosophy felt slightly pushy (turn 18)

## Detailed Dina  
Score: 4.6/5 | Density: 24/25 (excellent) | Turns: 22
✅ Recognised multi-field answers (turns 6, 12, 15)
✅ Skipped 4 questions Dina had pre-answered
❌ Asked about training provider after Dina mentioned it in turn 8

## Nervous Nora
Score: 4.2/5 | Density: 14/25 (medium) | Turns: 32
✅ Validated self-doubt at turns 9, 16, 24
✅ Leaned into nursing background at turn 12
✅ Normalised lack of testimonials at turn 20
⚠️ Experience level question at turn 14 could be warmer
```

---

## 7. Implementation

### 7.1 Tech Stack

```
persona-harness/
├── package.json
├── tsconfig.json
├── personas/
│   ├── schema.ts                    # Persona type definitions
│   ├── birthbuild/
│   │   ├── sparse-sarah.json
│   │   ├── detailed-dina.json
│   │   └── nervous-nora.json
│   └── [future-vertical]/
├── criteria/
│   ├── universal.ts                 # Universal evaluation criteria
│   └── birthbuild/
│       ├── sparse-sarah.ts          # Per-persona criteria
│       ├── detailed-dina.ts
│       └── nervous-nora.ts
├── lib/
│   ├── simulator.ts                 # Persona simulation LLM calls
│   ├── chatbot-client.ts            # Interface to target chatbot
│   ├── judge.ts                     # LLM-as-judge evaluation
│   ├── logger.ts                    # Conversation logging
│   ├── reporter.ts                  # Summary + regression reports
│   └── density.ts                   # Density score (imported from BirthBuild or standalone)
├── runs/                            # Output directory for run results
├── run.ts                           # CLI entry point
└── README.md
```

### 7.2 CLI Interface

```bash
# Run all personas for a vertical
npx persona-harness run --vertical birthbuild

# Run a single persona
npx persona-harness run --persona sparse-sarah

# Run against a live endpoint (Mode A)
npx persona-harness run --vertical birthbuild --endpoint https://xxx.supabase.co/functions/v1/chat

# Run against an isolated prompt (Mode B)
npx persona-harness run --vertical birthbuild --prompt ./system-prompt.md

# Compare two runs
npx persona-harness diff runs/2026-02-18T14-30-00 runs/2026-02-18T16-00-00

# Generate human-readable report
npx persona-harness report runs/2026-02-18T14-30-00
```

### 7.3 Plugin Architecture (for Claude Code)

To integrate with your existing workflow, this can be packaged as a Claude Code command:

```
/persona-test birthbuild           # run all BirthBuild personas
/persona-test sparse-sarah         # run single persona
/persona-test --diff last          # compare with last run
```

The command reads the current system prompt from the repo, runs all personas, evaluates, and reports — all within Claude Code's context.

---

## 8. Implementation Plan

### Phase 1: Core Harness
**Effort:** 3-4 hours
- Persona schema + 3 BirthBuild personas (from this doc)
- Conversation simulator (persona LLM + chatbot client)
- Conversation logger
- CLI runner with Mode B (isolated prompt)

### Phase 2: Judge + Criteria
**Effort:** 2-3 hours
- Universal criteria definitions
- Per-persona criteria (Sparse Sarah, Detailed Dina, Nervous Nora)
- Judge prompt template
- JSON output parser

### Phase 3: Reporting + Regression
**Effort:** 2-3 hours
- Summary report generator (JSON + markdown)
- Run-to-run diff and regression detection
- Human-readable report with turn-level citations

### Phase 4: Integration
**Effort:** 1-2 hours
- Mode A (live endpoint) support
- Claude Code plugin/command wrapper
- Git hook option: auto-run on system prompt file changes

**Total estimated effort: 8-12 hours**

---

## 9. Scaling to Other Verticals

When Dopamine Labs launches physiotherapistbuild.com:

1. Create `personas/physiobuild/` directory
2. Define 3-4 personas following the same schema (e.g. "Sparse Sam" the newly qualified physio, "Detailed Diana" the experienced practice owner, "Anxious Alex" the career-changer)
3. Create `criteria/physiobuild/` with per-persona evaluation criteria
4. Run: `npx persona-harness run --vertical physiobuild`

The harness, simulator, judge, logger, reporter, and regression detection are all reused. Only the personas and criteria are vertical-specific.

---

## 10. Cost Estimate Per Run

Each conversation: ~30-40 turns × 3 LLM calls per turn (persona sim, chatbot, tool calls)
Plus 1 judge call per persona.

**Per persona (Mode B, Sonnet for all):**
- Persona simulator: ~15 calls × ~500 tokens avg = ~7,500 tokens
- Chatbot: ~15 calls × ~800 tokens avg = ~12,000 tokens
- Judge: 1 call × ~5,000 tokens = ~5,000 tokens
- Total: ~25,000 tokens ≈ $0.20

**Per full run (3 personas):** ~$0.60

**Per full run with Opus judge:** ~$1.50

This is cheap enough to run on every prompt change.

---

## 11. Future Considerations

- **A/B prompt testing:** Run same personas against two different system prompts, use judge to pick the winner
- **Persona generation:** Use LLM to generate new personas from real user conversation patterns (anonymised)
- **Continuous monitoring:** Run nightly against production endpoint, alert on regression
- **Benchmark database:** Track scores over time, visualise prompt quality trends
- **Custom personas:** Instructors can define their own test personas matching their specific student demographics

---

## 12. Relationship to Other Modules

```
Persona Testing Harness (this doc)
  ↑ validates
  │
  ├── Specification Density Module (SCOPING-SPEC-DENSITY.md)
  │   └── System prompt elicitation quality
  │
  ├── Agentic SEO Module (SCOPING-AGENTIC-SEO.md)
  │   └── Schema richness depends on spec density
  │
  └── Future vertical chatbots
      └── Same harness, different personas
```

---

*SCOPING-PERSONA-HARNESS.md — Dopamine Labs Conversation Evaluation Infrastructure*
*February 2026*
