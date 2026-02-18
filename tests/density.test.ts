import { describe, it, expect } from "vitest";
import { calculateDensityScore } from "../lib/density.js";
import { createEmptySpec } from "../lib/spec-accumulator.js";

describe("calculateDensityScore", () => {
  it("returns 0 for empty spec", () => {
    const result = calculateDensityScore(createEmptySpec());
    expect(result.totalScore).toBe(0);
    expect(result.level).toBe("low");
  });

  it("scores core fields correctly", () => {
    const spec = {
      ...createEmptySpec(),
      business_name: "Test",
      doula_name: "Test Person",
      service_area: "Brighton",
      services: [{ type: "birth-support", title: "Birth Doula", description: "Support", price: "£500" }],
      email: "test@test.com",
      style: "modern",
      palette: "sage_sand",
      bio: "A bio about me",
    };
    const result = calculateDensityScore(spec);
    expect(result.coreScore).toBe(8);
  });

  it("scores depth fields correctly", () => {
    const spec = {
      ...createEmptySpec(),
      primary_location: "Brighton",
      service_area: "Brighton, Hove, Lewes",
      philosophy: "Evidence-based",
      training_provider: "Doula UK",
      training_year: "2020",
      brand_feeling: "warm",
    };
    const result = calculateDensityScore(spec);
    expect(result.depthScore).toBeGreaterThanOrEqual(5);
  });

  it("returns 'excellent' for high score", () => {
    const spec = {
      ...createEmptySpec(),
      business_name: "Dina Hart Birth Services",
      doula_name: "Dina Hart",
      service_area: "Brighton, Hove, Lewes, Worthing",
      services: [{
        type: "birth-support",
        title: "Birth Doula",
        description: "Full support",
        price: "£800",
        birth_types: ["home", "hospital", "vbac"],
        experience_level: "100+",
      }],
      email: "dina@test.com",
      style: "classic",
      palette: "deep_earth",
      bio: "Experienced doula",
      primary_location: "Brighton",
      bio_origin_story: "Had a transformative birth",
      philosophy: "Evidence-based informed choice",
      training_provider: "Developing Doulas",
      training_year: "2018",
      additional_training: ["spinning babies", "rebozo"],
      testimonials: [{ quote: "Amazing", name: "Emma R.", context: "home birth" }],
      brand_feeling: "warm, professional",
      social_links: { instagram: "insta.com/dina" },
      phone: "07700 900123",
      booking_url: "https://calendly.com/dina",
      client_perception: "calm and prepared",
      signature_story: "A memorable birth story",
    };
    const result = calculateDensityScore(spec);
    expect(result.level).toBe("excellent");
    expect(result.totalScore).toBeGreaterThanOrEqual(21);
  });

  it("returns suggestions for missing fields", () => {
    const spec = createEmptySpec();
    const result = calculateDensityScore(spec);
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
