import type { SiteSpec, ServiceItem, SocialLinks } from "../personas/schema.js";

export function createEmptySpec(): SiteSpec {
  return {
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
}

function mapToolCallToSpecUpdate(
  toolName: string,
  toolArgs: Record<string, unknown>,
): Partial<SiteSpec> | null {
  switch (toolName) {
    case "update_business_info": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.business_name === "string") update.business_name = toolArgs.business_name;
      if (typeof toolArgs.doula_name === "string") update.doula_name = toolArgs.doula_name;
      if (typeof toolArgs.primary_location === "string") update.primary_location = toolArgs.primary_location;
      if (typeof toolArgs.service_area === "string") update.service_area = toolArgs.service_area;
      if (Array.isArray(toolArgs.services)) update.services = toolArgs.services as ServiceItem[];
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_style": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.style === "string") update.style = toolArgs.style;
      if (typeof toolArgs.palette === "string") update.palette = toolArgs.palette;
      if (typeof toolArgs.typography === "string") update.typography = toolArgs.typography;
      if (typeof toolArgs.brand_feeling === "string") update.brand_feeling = toolArgs.brand_feeling;
      if (typeof toolArgs.style_inspiration_url === "string") update.style_inspiration_url = toolArgs.style_inspiration_url;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_content": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.bio === "string") update.bio = toolArgs.bio;
      if (typeof toolArgs.tagline === "string") update.tagline = toolArgs.tagline;
      if (typeof toolArgs.philosophy === "string") update.philosophy = toolArgs.philosophy;
      if (Array.isArray(toolArgs.testimonials)) update.testimonials = toolArgs.testimonials as SiteSpec["testimonials"];
      if (typeof toolArgs.faq_enabled === "boolean") update.faq_enabled = toolArgs.faq_enabled;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_bio_depth": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.bio_previous_career === "string") update.bio_previous_career = toolArgs.bio_previous_career;
      if (typeof toolArgs.bio_origin_story === "string") update.bio_origin_story = toolArgs.bio_origin_story;
      if (typeof toolArgs.training_year === "string") update.training_year = toolArgs.training_year;
      if (Array.isArray(toolArgs.additional_training)) update.additional_training = toolArgs.additional_training as string[];
      if (typeof toolArgs.client_perception === "string") update.client_perception = toolArgs.client_perception;
      if (typeof toolArgs.signature_story === "string") update.signature_story = toolArgs.signature_story;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_contact": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.email === "string") update.email = toolArgs.email;
      if (typeof toolArgs.phone === "string") update.phone = toolArgs.phone;
      if (typeof toolArgs.booking_url === "string") update.booking_url = toolArgs.booking_url;
      if (typeof toolArgs.social_links === "object" && toolArgs.social_links !== null) update.social_links = toolArgs.social_links as SocialLinks;
      if (typeof toolArgs.doula_uk === "boolean") update.doula_uk = toolArgs.doula_uk;
      if (typeof toolArgs.training_provider === "string") update.training_provider = toolArgs.training_provider;
      if (typeof toolArgs.training_year === "string") update.training_year = toolArgs.training_year;
      return Object.keys(update).length > 0 ? update : null;
    }
    case "update_pages": {
      if (Array.isArray(toolArgs.pages)) return { pages: toolArgs.pages as string[] };
      return null;
    }
    case "generate_content":
    case "mark_step_complete":
    case "trigger_photo_upload":
      return null;
    default:
      return null;
  }
}

export class SpecAccumulator {
  private spec: SiteSpec;

  constructor() {
    this.spec = createEmptySpec();
  }

  applyToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const update = mapToolCallToSpecUpdate(toolName, toolArgs);
    if (!update) return null;
    Object.assign(this.spec, update);
    return update as Record<string, unknown>;
  }

  getSpec(): SiteSpec {
    return { ...this.spec };
  }
}
