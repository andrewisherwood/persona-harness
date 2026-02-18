import type { Criterion } from "../../personas/schema.js";

export const SPARSE_SARAH_CRITERIA: Criterion[] = [
  { type: "score", name: "gentle_probing", description: "When Sarah gave minimal answers, did the chatbot gently offer examples or options rather than open-ended follow-ups?" },
  { type: "score", name: "graceful_retreat", description: "After 2 unsuccessful follow-ups on a topic, did the chatbot move on without making Sarah feel she'd failed?" },
  { type: "check", name: "max_follow_ups_respected", description: "Did the chatbot ever ask more than 2 follow-ups on the same topic? (HARD FAIL if true)", hard_fail: true },
  { type: "check", name: "minimum_viable_spec", description: "Despite minimal input, does the resulting spec contain enough data to generate a functional site?" },
  { type: "range", name: "density_score_range", description: "Low density but above the functional threshold", expected_min: 8, expected_max: 14 },
];
