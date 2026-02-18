import type { Criterion } from "../../personas/schema.js";

export const DETAILED_DINA_CRITERIA: Criterion[] = [
  { type: "score", name: "information_recognition", description: "When Dina volunteered information that answered multiple upcoming questions, did the chatbot recognise this and skip those questions?" },
  { type: "score", name: "multi_field_parsing", description: "When Dina gave a paragraph containing multiple field values, did the chatbot extract and save all of them?" },
  { type: "count", name: "redundant_questions", description: "Number of times the chatbot asked for information Dina had already provided. 0 = pass, 1 = warning, 2+ = fail.", fail_threshold: 2 },
  { type: "range", name: "efficiency", description: "Dina's conversations should be shorter than average. A long conversation suggests the chatbot isn't recognising pre-provided data.", expected_min: 10, expected_max: 30 },
  { type: "range", name: "density_score_range", description: "Should achieve excellent density with minimal prompting", expected_min: 21, expected_max: 25 },
];
