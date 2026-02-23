import type { PageMetrics } from "./creative-run-types.js";

/**
 * Extracts structural metrics from an HTML string using regex.
 * No DOM parser required -- counts tags via case-insensitive patterns.
 */
export function extractPageMetrics(html: string): PageMetrics {
  if (html.length === 0) {
    return {
      imgCount: 0,
      headingCount: 0,
      landmarkCount: 0,
      linkCount: 0,
      schemaOrgPresent: false,
      totalHtmlSize: 0,
    };
  }

  const countTag = (pattern: RegExp): number => {
    const matches = html.match(pattern);
    return matches ? matches.length : 0;
  };

  // <img ...> or <img ... /> (self-closing)
  const imgCount = countTag(/<img\b[^>]*\/?>/gi);

  // <h1> through <h6> (opening tags only)
  const headingCount = countTag(/<h[1-6]\b[^>]*>/gi);

  // Landmark elements: header, main, nav, footer, section, article (opening tags only)
  const landmarkCount = countTag(/<(?:header|main|nav|footer|section|article)\b[^>]*>/gi);

  // <a ...> (opening tags only)
  const linkCount = countTag(/<a\b[^>]*>/gi);

  // Presence of Schema.org JSON-LD
  const schemaOrgPresent = /application\/ld\+json/i.test(html);

  const totalHtmlSize = Buffer.byteLength(html, "utf-8");

  return {
    imgCount,
    headingCount,
    landmarkCount,
    linkCount,
    schemaOrgPresent,
    totalHtmlSize,
  };
}
