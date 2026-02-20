import { describe, it, expect } from "vitest";
import { generateSiteFiles } from "../src/server/engine/site-generator.js";

describe("generateSiteFiles", () => {
  const minimalSpec = {
    business_name: "Test Doula",
    doula_name: "Jane Doe",
    tagline: "Supporting you through birth",
    service_area: "London",
    pages: ["home", "about", "services", "contact"],
    services: [
      { type: "birth", title: "Birth Support", description: "Full birth doula support", price: "£1,200" },
    ],
    style: "modern",
    palette: "sage_sand",
    typography: "modern",
  };

  it("generates files for all pages in spec.pages", () => {
    const files = generateSiteFiles(minimalSpec);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("index.html");
    expect(paths).toContain("about.html");
    expect(paths).toContain("services.html");
    expect(paths).toContain("contact.html");
    expect(paths).toContain("sitemap.xml");
    expect(paths).toContain("robots.txt");
  });

  it("does not generate testimonials page when no testimonials exist", () => {
    const files = generateSiteFiles({ ...minimalSpec, pages: ["home", "testimonials"] });
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain("testimonials.html");
  });

  it("generates testimonials page when testimonials exist", () => {
    const spec = {
      ...minimalSpec,
      pages: ["home", "testimonials"],
      testimonials: [{ quote: "Amazing!", name: "Sarah", context: "2024" }],
    };
    const files = generateSiteFiles(spec);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("testimonials.html");
  });

  it("does not generate faq page when faq_enabled is false", () => {
    const files = generateSiteFiles({ ...minimalSpec, pages: ["home", "faq"], faq_enabled: false });
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain("faq.html");
  });

  it("generates faq page when faq_enabled is true", () => {
    const files = generateSiteFiles({ ...minimalSpec, pages: ["home", "faq"], faq_enabled: true });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("faq.html");
  });

  it("generates valid HTML with doctype", () => {
    const files = generateSiteFiles(minimalSpec);
    const index = files.find((f) => f.path === "index.html")!;
    expect(index.content).toMatch(/^<!DOCTYPE html>/);
    expect(index.content).toContain("<html lang=\"en-GB\">");
    expect(index.content).toContain("</html>");
  });

  it("escapes HTML in user content", () => {
    const spec = { ...minimalSpec, business_name: "Jane's <Doula> & Birth" };
    const files = generateSiteFiles(spec);
    const index = files.find((f) => f.path === "index.html")!;
    expect(index.content).not.toContain("<Doula>");
    expect(index.content).toContain("&lt;Doula&gt;");
    expect(index.content).toContain("&amp;");
  });

  it("applies correct palette colours", () => {
    const files = generateSiteFiles({ ...minimalSpec, palette: "ocean_calm" });
    const index = files.find((f) => f.path === "index.html")!;
    expect(index.content).toContain("#3d6b7e"); // ocean_calm primary
  });

  it("includes Google Fonts link", () => {
    const files = generateSiteFiles(minimalSpec);
    const index = files.find((f) => f.path === "index.html")!;
    expect(index.content).toContain("fonts.googleapis.com");
  });

  it("generates sitemap with correct URLs", () => {
    const files = generateSiteFiles(minimalSpec);
    const sitemap = files.find((f) => f.path === "sitemap.xml")!;
    expect(sitemap.content).toContain("<urlset");
    expect(sitemap.content).toContain("index.html");
  });

  it("handles empty spec gracefully with defaults", () => {
    const files = generateSiteFiles({});
    expect(files.length).toBeGreaterThan(0);
    const index = files.find((f) => f.path === "index.html")!;
    expect(index.content).toContain("My Practice");
  });

  it("includes service cards on home page", () => {
    const files = generateSiteFiles(minimalSpec);
    const index = files.find((f) => f.path === "index.html")!;
    expect(index.content).toContain("Birth Support");
    expect(index.content).toContain("£1,200");
  });

  it("includes contact form on contact page", () => {
    const files = generateSiteFiles(minimalSpec);
    const contact = files.find((f) => f.path === "contact.html")!;
    expect(contact.content).toContain("data-netlify=\"true\"");
    expect(contact.content).toContain("Send Message");
  });

  it("includes navigation on all pages", () => {
    const files = generateSiteFiles(minimalSpec);
    for (const file of files.filter((f) => f.path.endsWith(".html"))) {
      expect(file.content).toContain("main-nav");
      expect(file.content).toContain("Test Doula");
    }
  });
});
