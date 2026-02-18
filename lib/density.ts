import type { SiteSpec, DensityLevel, DensityResult } from "../personas/schema.js";

const MAX_CORE = 8;
const MAX_DEPTH = 17;
const MAX_TOTAL = MAX_CORE + MAX_DEPTH;

function getLevelForScore(score: number): DensityLevel {
  if (score >= 21) return "excellent";
  if (score >= 16) return "high";
  if (score >= 9) return "medium";
  return "low";
}

export function calculateDensityScore(spec: SiteSpec): DensityResult {
  let coreScore = 0;
  let depthScore = 0;

  // Core fields (8 points)
  if (spec.business_name) coreScore++;
  if (spec.doula_name) coreScore++;
  if (spec.service_area) coreScore++;
  if (spec.services && spec.services.length > 0) coreScore++;
  if (spec.email) coreScore++;
  if (spec.style) coreScore++;
  if (spec.palette) coreScore++;
  if (spec.bio) coreScore++;

  // Depth fields (17 points)
  if (spec.primary_location) depthScore++;
  if (spec.service_area) {
    const areas = spec.service_area.split(",").map((a) => a.trim()).filter(Boolean);
    if (areas.length >= 3) depthScore++;
  }
  if (spec.services?.some((s) => Array.isArray(s.birth_types) && s.birth_types.length > 0)) depthScore++;
  if (spec.services?.some((s) => s.experience_level)) depthScore++;
  if (spec.bio_origin_story) depthScore++;
  if (spec.philosophy) depthScore++;
  if (spec.training_provider) depthScore++;
  if (spec.training_year) depthScore++;
  if (spec.additional_training && spec.additional_training.length > 0) depthScore++;
  if (spec.testimonials && spec.testimonials.length > 0) depthScore++;
  if (spec.testimonials?.some((t) => t.name && t.context)) depthScore++;
  if (spec.brand_feeling) depthScore++;
  if (spec.social_links) {
    const hasAny = Object.values(spec.social_links).some((v) => typeof v === "string" && v.length > 0);
    if (hasAny) depthScore++;
  }
  if (spec.phone) depthScore++;
  if (spec.booking_url) depthScore++;
  if (spec.client_perception) depthScore++;
  if (spec.signature_story) depthScore++;

  const totalScore = coreScore + depthScore;
  const percentage = Math.round((totalScore / MAX_TOTAL) * 100);
  const level = getLevelForScore(totalScore);

  const suggestions: string[] = [];
  if (!spec.bio_origin_story && suggestions.length < 3) suggestions.push("Add an origin story for a more personal About page.");
  if ((!spec.testimonials || spec.testimonials.length === 0) && suggestions.length < 3) suggestions.push("Add a client testimonial to build trust.");
  if (!spec.philosophy && suggestions.length < 3) suggestions.push("Describe your philosophy or approach.");
  if (!spec.primary_location && suggestions.length < 3) suggestions.push("Add your primary location.");
  if (!spec.training_provider && suggestions.length < 3) suggestions.push("Mention your training provider.");
  if (!spec.brand_feeling && suggestions.length < 3) suggestions.push("Describe the feeling you want your site to give.");
  if (!spec.client_perception && suggestions.length < 3) suggestions.push("Share what clients say about you most often.");
  if ((!spec.additional_training || spec.additional_training.length === 0) && suggestions.length < 3) suggestions.push("List any additional training or CPD.");
  if (!spec.signature_story && suggestions.length < 3) suggestions.push("Share a memorable birth story.");
  if (!spec.booking_url && suggestions.length < 3) suggestions.push("Add a booking link.");

  return { coreScore, depthScore, totalScore, percentage, level, suggestions: suggestions.slice(0, 3) };
}
