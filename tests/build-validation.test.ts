import { describe, it, expect } from "vitest";
import { validateSpecForBuild } from "../src/server/engine/orchestrator.js";

describe("validateSpecForBuild", () => {
  const validSpec = {
    business_name: "Test Doula",
    doula_name: "Jane Doe",
    services: [{ type: "birth", title: "Birth Support", description: "Full support", price: "£1,200" }],
    service_area: "London",
  };

  it("passes for a spec with all required fields", () => {
    const result = validateSpecForBuild(validSpec);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("fails when business_name is missing", () => {
    const result = validateSpecForBuild({ ...validSpec, business_name: null });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("business_name");
  });

  it("fails when doula_name is missing", () => {
    const result = validateSpecForBuild({ ...validSpec, doula_name: "" });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("doula_name");
  });

  it("fails when services is empty", () => {
    const result = validateSpecForBuild({ ...validSpec, services: [] });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("services");
  });

  it("fails when services is not an array", () => {
    const result = validateSpecForBuild({ ...validSpec, services: null });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("services");
  });

  it("fails when service_area is missing", () => {
    const result = validateSpecForBuild({ ...validSpec, service_area: undefined });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("service_area");
  });

  it("reports all missing fields at once", () => {
    const result = validateSpecForBuild({});
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(["business_name", "doula_name", "services", "service_area"]);
  });

  it("fails for a typical empty DB spec (all nulls)", () => {
    const emptyDbSpec = {
      id: "uuid",
      user_id: "uuid",
      tenant_id: "uuid",
      business_name: null,
      doula_name: null,
      services: [],
      service_area: null,
      status: "draft",
    };
    const result = validateSpecForBuild(emptyDbSpec);
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBe(4);
  });

  it("passes with extra fields present", () => {
    const richSpec = {
      ...validSpec,
      bio: "I love supporting families",
      testimonials: [{ quote: "Amazing!", name: "Sarah", context: "2024" }],
      philosophy: "Gentle, evidence-based support",
    };
    const result = validateSpecForBuild(richSpec);
    expect(result.valid).toBe(true);
  });
});
