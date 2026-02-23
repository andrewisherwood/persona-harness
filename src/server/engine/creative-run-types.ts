/**
 * Types for creative run research framework.
 * Supports systematic comparison of LLM-generated websites.
 */

/** Structural metrics extracted from a single generated HTML page. */
export interface PageMetrics {
  imgCount: number;
  headingCount: number;
  landmarkCount: number;
  linkCount: number;
  schemaOrgPresent: boolean;
  totalHtmlSize: number;
}
