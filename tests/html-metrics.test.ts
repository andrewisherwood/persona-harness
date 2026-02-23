import { describe, it, expect } from "vitest";
import { extractPageMetrics } from "../src/server/engine/html-metrics.js";

describe("extractPageMetrics", () => {
  it("counts img tags", () => {
    const html = '<div><img src="a.png"><img src="b.png"></div>';
    const result = extractPageMetrics(html);
    expect(result.imgCount).toBe(2);
  });

  it("counts heading tags h1-h6", () => {
    const html = "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>";
    const result = extractPageMetrics(html);
    expect(result.headingCount).toBe(3);
  });

  it("counts landmark elements", () => {
    const html = [
      "<header>h</header>",
      "<main>m</main>",
      "<nav>n</nav>",
      "<footer>f</footer>",
      "<section>s</section>",
      "<article>a</article>",
    ].join("");
    const result = extractPageMetrics(html);
    expect(result.landmarkCount).toBe(6);
  });

  it("counts link tags", () => {
    const html = '<a href="/about">About</a><a href="/contact">Contact</a>';
    const result = extractPageMetrics(html);
    expect(result.linkCount).toBe(2);
  });

  it("detects Schema.org JSON-LD", () => {
    const html = '<script type="application/ld+json">{"@type":"Organization"}</script>';
    const result = extractPageMetrics(html);
    expect(result.schemaOrgPresent).toBe(true);
  });

  it("returns false for missing Schema.org", () => {
    const html = "<html><body><p>No schema here</p></body></html>";
    const result = extractPageMetrics(html);
    expect(result.schemaOrgPresent).toBe(false);
  });

  it("calculates total HTML size in bytes", () => {
    const html = "<p>Hello</p>";
    const result = extractPageMetrics(html);
    expect(result.totalHtmlSize).toBe(Buffer.byteLength(html, "utf-8"));
  });

  it("handles empty string", () => {
    const result = extractPageMetrics("");
    expect(result.imgCount).toBe(0);
    expect(result.headingCount).toBe(0);
    expect(result.landmarkCount).toBe(0);
    expect(result.linkCount).toBe(0);
    expect(result.schemaOrgPresent).toBe(false);
    expect(result.totalHtmlSize).toBe(0);
  });

  it("handles self-closing img tags", () => {
    const html = '<img src="a.png" /><img src="b.png"/>';
    const result = extractPageMetrics(html);
    expect(result.imgCount).toBe(2);
  });

  it("is case-insensitive for tag names", () => {
    const html = '<H1>Title</H1><IMG src="photo.jpg"><A href="/">Home</A>';
    const result = extractPageMetrics(html);
    expect(result.headingCount).toBe(1);
    expect(result.imgCount).toBe(1);
    expect(result.linkCount).toBe(1);
  });
});
