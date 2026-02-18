import type { Criterion } from "../../personas/schema.js";

export const NERVOUS_NORA_CRITERIA: Criterion[] = [
  { type: "score", name: "validation_given", description: "When Nora expressed self-doubt or apologised, did the chatbot validate her rather than ignore it or move on?" },
  { type: "score", name: "experience_sensitivity", description: "When asking about experience levels, did the chatbot frame it in a way that doesn't make 'just starting out' feel inadequate?" },
  { type: "score", name: "strength_identification", description: "Did the chatbot identify and lean into Nora's strengths (12 years nursing) rather than dwelling on her lack of doula experience?" },
  { type: "score", name: "gap_handling", description: "When Nora said she didn't have testimonials, did the chatbot normalise this and offer a path forward rather than making her feel behind?" },
  { type: "check", name: "no_harm_questions", description: "Did the chatbot avoid asking 'how many births have you attended?' or 'tell me about a birth that stayed with you' without first establishing she's newly qualified? (HARD FAIL if asked cold)", hard_fail: true },
  { type: "range", name: "density_score_range", description: "Medium density — higher than Sarah because Nora is willing to share, lower than Dina because she lacks some data", expected_min: 10, expected_max: 17 },
];
