import { describe, it, expect } from "vitest";
import type {
  Persona,
  SiteSpec,
} from "../personas/schema.js";

describe("schema types", () => {
  it("creates a valid Persona", () => {
    const persona: Persona = {
      id: "test-persona",
      name: "Test Persona",
      vertical: "birthbuild",
      background: "A test persona",
      communication_style: {
        detail_level: "minimal",
        tone: "neutral",
        typical_response_length: "1-2 sentences",
        quirks: [],
      },
      knowledge: {
        knows_about_their_field: "beginner",
        self_awareness: "low",
        willingness_to_share: "open",
      },
      seed_data: { business_name: "Test Business" },
      gaps: ["testimonials"],
      triggers: {
        will_elaborate_if: [],
        will_shut_down_if: [],
        will_skip_if: [],
      },
    };
    expect(persona.id).toBe("test-persona");
  });

  it("creates an empty SiteSpec", () => {
    const spec: SiteSpec = {
      business_name: null,
      doula_name: null,
      tagline: null,
      service_area: null,
      primary_location: null,
      services: [],
      email: null,
      phone: null,
      booking_url: null,
      social_links: {},
      bio: null,
      philosophy: null,
      bio_previous_career: null,
      bio_origin_story: null,
      training_year: null,
      additional_training: [],
      client_perception: null,
      signature_story: null,
      testimonials: [],
      faq_enabled: false,
      style: null,
      palette: null,
      typography: null,
      brand_feeling: null,
      style_inspiration_url: null,
      doula_uk: false,
      training_provider: null,
      pages: [],
    };
    expect(spec.business_name).toBeNull();
    expect(spec.services).toEqual([]);
  });
});
