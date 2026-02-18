import { describe, it, expect } from "vitest";
import { SpecAccumulator } from "../lib/spec-accumulator.js";

describe("SpecAccumulator", () => {
  it("starts with an empty spec", () => {
    const acc = new SpecAccumulator();
    const spec = acc.getSpec();
    expect(spec.business_name).toBeNull();
    expect(spec.services).toEqual([]);
    expect(spec.testimonials).toEqual([]);
  });

  it("applies update_business_info tool call", () => {
    const acc = new SpecAccumulator();
    const fields = acc.applyToolCall("update_business_info", {
      business_name: "Sarah's Doula Services",
      doula_name: "Sarah Mitchell",
      primary_location: "Bristol",
    });
    expect(acc.getSpec().business_name).toBe("Sarah's Doula Services");
    expect(acc.getSpec().doula_name).toBe("Sarah Mitchell");
    expect(acc.getSpec().primary_location).toBe("Bristol");
    expect(fields).toEqual({
      business_name: "Sarah's Doula Services",
      doula_name: "Sarah Mitchell",
      primary_location: "Bristol",
    });
  });

  it("applies update_style tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_style", {
      style: "modern",
      palette: "sage_sand",
      brand_feeling: "warm and earthy",
    });
    expect(acc.getSpec().style).toBe("modern");
    expect(acc.getSpec().palette).toBe("sage_sand");
    expect(acc.getSpec().brand_feeling).toBe("warm and earthy");
  });

  it("applies update_content tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_content", {
      bio: "A great bio",
      testimonials: [{ quote: "Amazing", name: "Emma", context: "birth" }],
    });
    expect(acc.getSpec().bio).toBe("A great bio");
    expect(acc.getSpec().testimonials).toHaveLength(1);
  });

  it("applies update_bio_depth tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_bio_depth", {
      bio_previous_career: "nurse",
      additional_training: ["spinning babies", "rebozo"],
    });
    expect(acc.getSpec().bio_previous_career).toBe("nurse");
    expect(acc.getSpec().additional_training).toEqual(["spinning babies", "rebozo"]);
  });

  it("applies update_contact tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_contact", {
      email: "test@test.com",
      social_links: { instagram: "insta.com/test" },
    });
    expect(acc.getSpec().email).toBe("test@test.com");
    expect(acc.getSpec().social_links.instagram).toBe("insta.com/test");
  });

  it("applies update_pages tool call", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_pages", {
      pages: ["home", "about", "contact"],
    });
    expect(acc.getSpec().pages).toEqual(["home", "about", "contact"]);
  });

  it("returns null for non-spec tools", () => {
    const acc = new SpecAccumulator();
    const fields = acc.applyToolCall("mark_step_complete", {
      completed_step: "welcome",
      next_step: "basics",
    });
    expect(fields).toBeNull();
  });

  it("returns null for generate_content", () => {
    const acc = new SpecAccumulator();
    const fields = acc.applyToolCall("generate_content", {
      field: "bio",
      context: "some context",
    });
    expect(fields).toBeNull();
  });

  it("accumulates across multiple tool calls", () => {
    const acc = new SpecAccumulator();
    acc.applyToolCall("update_business_info", { business_name: "Test" });
    acc.applyToolCall("update_contact", { email: "a@b.com" });
    acc.applyToolCall("update_style", { style: "minimal" });
    const spec = acc.getSpec();
    expect(spec.business_name).toBe("Test");
    expect(spec.email).toBe("a@b.com");
    expect(spec.style).toBe("minimal");
  });
});
