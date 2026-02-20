/**
 * Self-contained site generator for the persona harness.
 * Generates HTML/CSS files from a site spec, ported from BirthBuild's
 * page generators (palettes, shared, home, about, services, contact,
 * testimonials, faq, seo).
 *
 * Takes a raw site spec object (from Supabase or SpecAccumulator)
 * and returns BuildFile[] ready for the /build endpoint.
 */

import type { BuildFile } from "./edge-function-client.js";

// ---------------------------------------------------------------------------
// Types (subset of BirthBuild's SiteSpec relevant for generation)
// ---------------------------------------------------------------------------

interface ServiceItem {
  type: string;
  title: string;
  description: string;
  price: string;
}

interface Testimonial {
  quote: string;
  name: string;
  context: string;
}

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  [key: string]: string | undefined;
}

interface CustomColours {
  background: string;
  primary: string;
  accent: string;
  text: string;
  cta: string;
}

type StyleOption = "modern" | "classic" | "minimal";
type PaletteOption = "sage_sand" | "blush_neutral" | "deep_earth" | "ocean_calm" | "custom";
type TypographyOption = "modern" | "classic" | "mixed";

/** Normalized spec object for generation — all fields have safe defaults. */
interface NormalizedSpec {
  business_name: string;
  doula_name: string;
  tagline: string;
  service_area: string;
  primary_location: string;
  services: ServiceItem[];
  email: string;
  phone: string;
  booking_url: string;
  social_links: SocialLinks;
  bio: string;
  philosophy: string;
  testimonials: Testimonial[];
  faq_enabled: boolean;
  style: StyleOption;
  palette: PaletteOption;
  custom_colours: CustomColours | null;
  typography: TypographyOption;
  doula_uk: boolean;
  training_provider: string;
  training_year: string;
  additional_training: string[];
  pages: string[];
  subdomain_slug: string;
  primary_keyword: string;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

const PALETTES: Record<string, CustomColours> = {
  sage_sand: { background: "#f5f0e8", primary: "#5f7161", accent: "#a8b5a0", text: "#2d2d2d", cta: "#5f7161" },
  blush_neutral: { background: "#fdf6f0", primary: "#c9928e", accent: "#e8cfc4", text: "#3d3d3d", cta: "#c9928e" },
  deep_earth: { background: "#f0ebe3", primary: "#6b4c3b", accent: "#a67c52", text: "#2b2b2b", cta: "#6b4c3b" },
  ocean_calm: { background: "#f0f4f5", primary: "#3d6b7e", accent: "#7ca5b8", text: "#2c3e50", cta: "#3d6b7e" },
};

function resolvePalette(palette: PaletteOption, custom: CustomColours | null): CustomColours {
  if (palette === "custom" && custom) return custom;
  return PALETTES[palette] ?? PALETTES.sage_sand!;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

interface TypographyConfig {
  heading: string;
  body: string;
  googleFontsUrl: string;
}

const TYPOGRAPHY: Record<TypographyOption, TypographyConfig> = {
  modern: {
    heading: "Inter", body: "Inter",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  classic: {
    heading: "Playfair Display", body: "Source Sans 3",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Sans+3:wght@400;600&display=swap",
  },
  mixed: {
    heading: "DM Serif Display", body: "Inter",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap",
  },
};

// ---------------------------------------------------------------------------
// HTML escaping (security-critical)
// ---------------------------------------------------------------------------

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ---------------------------------------------------------------------------
// Social link validation
// ---------------------------------------------------------------------------

function getValidSocialLinks(links: SocialLinks): Array<{ platform: string; url: string }> {
  const result: Array<{ platform: string; url: string }> = [];
  for (const [platform, url] of Object.entries(links)) {
    if (url && url.startsWith("https://") && url.length <= 500) {
      result.push({ platform, url });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Normalize spec — safe defaults for all fields
// ---------------------------------------------------------------------------

function normalize(raw: Record<string, unknown>): NormalizedSpec {
  return {
    business_name: (raw.business_name as string) ?? "My Practice",
    doula_name: (raw.doula_name as string) ?? "",
    tagline: (raw.tagline as string) ?? "",
    service_area: (raw.service_area as string) ?? "",
    primary_location: (raw.primary_location as string) ?? "",
    services: Array.isArray(raw.services) ? raw.services as ServiceItem[] : [],
    email: (raw.email as string) ?? "",
    phone: (raw.phone as string) ?? "",
    booking_url: (raw.booking_url as string) ?? "",
    social_links: (raw.social_links as SocialLinks) ?? {},
    bio: (raw.bio as string) ?? "",
    philosophy: (raw.philosophy as string) ?? "",
    testimonials: Array.isArray(raw.testimonials) ? raw.testimonials as Testimonial[] : [],
    faq_enabled: raw.faq_enabled === true,
    style: (["modern", "classic", "minimal"].includes(raw.style as string) ? raw.style : "modern") as StyleOption,
    palette: (["sage_sand", "blush_neutral", "deep_earth", "ocean_calm", "custom"].includes(raw.palette as string) ? raw.palette : "sage_sand") as PaletteOption,
    custom_colours: raw.custom_colours as CustomColours | null ?? null,
    typography: (["modern", "classic", "mixed"].includes(raw.typography as string) ? raw.typography : "modern") as TypographyOption,
    doula_uk: raw.doula_uk === true,
    training_provider: (raw.training_provider as string) ?? "",
    training_year: (raw.training_year as string) ?? "",
    additional_training: Array.isArray(raw.additional_training) ? raw.additional_training as string[] : [],
    pages: Array.isArray(raw.pages) && raw.pages.length > 0 ? raw.pages as string[] : ["home", "about", "services", "contact"],
    subdomain_slug: (raw.subdomain_slug as string) ?? "",
    primary_keyword: (raw.primary_keyword as string) ?? "Doula",
  };
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

function generateCss(colours: CustomColours, headingFont: string, bodyFont: string, style: StyleOption): string {
  const cardRadius = style === "modern" ? "8px" : style === "classic" ? "4px" : "2px";
  const btnRadius = style === "modern" ? "6px" : style === "classic" ? "4px" : "2px";

  return `
    :root {
      --colour-bg: ${colours.background};
      --colour-primary: ${colours.primary};
      --colour-accent: ${colours.accent};
      --colour-text: ${colours.text};
      --colour-cta: ${colours.cta};
      --font-heading: '${headingFont}', sans-serif;
      --font-body: '${bodyFont}', sans-serif;
      --radius: ${cardRadius};
      --btn-radius: ${btnRadius};
      --max-width: 1100px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-body); color: var(--colour-text);
      background-color: var(--colour-bg); font-size: 1rem; line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3 { font-family: var(--font-heading); line-height: 1.2; color: var(--colour-primary); }
    a { color: var(--colour-primary); text-decoration: underline; }
    a:hover { opacity: 0.85; }
    *:focus-visible { outline: 2px solid var(--colour-primary); outline-offset: 2px; }
    img { max-width: 100%; height: auto; display: block; }
    .skip-link { position: absolute; left: -9999px; top: auto; padding: 0.5rem 1rem; background: var(--colour-primary); color: #fff; z-index: 1000; text-decoration: none; }
    .skip-link:focus { left: 1rem; top: 1rem; }
    .site-header { background: var(--colour-bg); border-bottom: 1px solid var(--colour-accent); position: sticky; top: 0; z-index: 100; }
    .header-inner { max-width: var(--max-width); margin: 0 auto; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
    .wordmark-link { text-decoration: none; font-family: var(--font-heading); font-size: 1.5rem; font-weight: 600; color: var(--colour-primary); }
    .nav-toggle-checkbox { display: none; }
    .nav-toggle-label { display: none; cursor: pointer; padding: 0.5rem; }
    .nav-toggle-icon { display: block; width: 24px; height: 2px; background: var(--colour-text); position: relative; }
    .nav-toggle-icon::before, .nav-toggle-icon::after { content: ''; display: block; width: 24px; height: 2px; background: var(--colour-text); position: absolute; left: 0; }
    .nav-toggle-icon::before { top: -7px; }
    .nav-toggle-icon::after { top: 7px; }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-link { text-decoration: none; font-weight: 500; font-size: 0.95rem; color: var(--colour-text); transition: color 0.2s; }
    .nav-link:hover, .nav-link--active { color: var(--colour-primary); }
    @media (max-width: 768px) {
      .nav-toggle-label { display: block; }
      .main-nav { display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--colour-bg); border-bottom: 1px solid var(--colour-accent); padding: 1rem 1.5rem; }
      .nav-toggle-checkbox:checked ~ .main-nav { display: block; }
      .nav-links { flex-direction: column; gap: 0.75rem; }
    }
    .section { padding: 4rem 1.5rem; }
    .section-inner { max-width: var(--max-width); margin: 0 auto; }
    .section--alt { background: rgba(0,0,0,0.02); }
    .section-title { font-size: 2rem; margin-bottom: 1.5rem; }
    .section-subtitle { font-size: 1.1rem; color: var(--colour-text); opacity: 0.8; margin-bottom: 2rem; }
    .hero--text-only { padding: 5rem 1.5rem; text-align: center; }
    .hero--text-only .hero-inner { max-width: var(--max-width); margin: 0 auto; }
    .hero--text-only h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .hero--text-only .tagline { font-size: 1.2rem; opacity: 0.85; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }
    @media (min-width: 769px) { .hero--text-only h1 { font-size: 3.5rem; } }
    .btn { display: inline-block; padding: 0.75rem 2rem; background: var(--colour-cta); color: #fff; text-decoration: none; border-radius: var(--btn-radius); font-weight: 600; border: none; cursor: pointer; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .btn--outline { background: transparent; color: var(--colour-cta); border: 2px solid var(--colour-cta); }
    .btn--outline:hover { background: var(--colour-cta); color: #fff; }
    .cards { display: grid; gap: 1.5rem; }
    @media (min-width: 640px) { .cards { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 900px) { .cards { grid-template-columns: repeat(3, 1fr); } }
    .card { background: #fff; border-radius: var(--radius); padding: 2rem; border: 1px solid var(--colour-accent); }
    .card h3 { margin-bottom: 0.75rem; font-size: 1.25rem; }
    .card p { margin-bottom: 1rem; }
    .card .price { font-weight: 600; color: var(--colour-primary); margin-bottom: 1rem; display: block; }
    .testimonial { background: #fff; border-left: 4px solid var(--colour-accent); padding: 2rem; margin-bottom: 1.5rem; border-radius: var(--radius); }
    .testimonial blockquote { font-style: italic; font-size: 1.05rem; margin-bottom: 0.75rem; }
    .testimonial cite { font-style: normal; font-weight: 600; display: block; }
    .testimonial .context { font-size: 0.9rem; opacity: 0.7; }
    .faq-item { border-bottom: 1px solid var(--colour-accent); }
    .faq-item summary { padding: 1.25rem 0; cursor: pointer; font-weight: 600; font-size: 1.05rem; list-style: none; }
    .faq-item summary::-webkit-details-marker { display: none; }
    .faq-item summary::before { content: '+'; margin-right: 0.75rem; font-size: 1.2rem; }
    .faq-item[open] summary::before { content: '\\2212'; }
    .faq-item .faq-answer { padding: 0 0 1.25rem; line-height: 1.7; }
    .contact-form { max-width: 600px; }
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
    .form-group input, .form-group textarea { width: 100%; padding: 0.75rem; border: 1px solid var(--colour-accent); border-radius: var(--radius); font-family: var(--font-body); font-size: 1rem; }
    .form-group textarea { min-height: 150px; resize: vertical; }
    .form-group input:focus, .form-group textarea:focus { outline: 2px solid var(--colour-primary); outline-offset: 2px; }
    .contact-info { margin-top: 2rem; }
    .contact-info dt { font-weight: 600; margin-top: 1rem; }
    .contact-info dd { margin-left: 0; }
    .about-grid { display: grid; gap: 2rem; }
    @media (min-width: 769px) { .about-grid { grid-template-columns: 2fr 1fr; } }
    .qualifications { margin-top: 2rem; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: var(--radius); }
    .site-footer { background: var(--colour-primary); color: rgba(255,255,255,0.9); padding: 2rem 1.5rem; text-align: center; }
    .footer-inner { max-width: var(--max-width); margin: 0 auto; }
    .footer-social { margin-bottom: 1.5rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; }
    .footer-social a { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; text-decoration: none; transition: background 0.2s; }
    .footer-social a:hover { background: rgba(255,255,255,0.25); opacity: 1; }
    .footer-copyright { font-size: 0.9rem; margin-bottom: 0.25rem; }
    .footer-privacy { font-size: 0.8rem; opacity: 0.7; }
    .text-center { text-align: center; }
    .mt-2 { margin-top: 2rem; }
  `;
}

// ---------------------------------------------------------------------------
// Head generation
// ---------------------------------------------------------------------------

function generateHead(css: string, googleFontsUrl: string, pageTitle: string, pageDescription: string): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' https://*.supabase.co data:",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");

  return `<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(pageDescription)}" />
    <meta property="og:title" content="${esc(pageTitle)}" />
    <meta property="og:description" content="${esc(pageDescription)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${googleFontsUrl}" rel="stylesheet" />
    <style>${css}</style>
  </head>`;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

interface NavItem { slug: string; label: string; filename: string; }

const PAGE_CONFIG: Record<string, { label: string; filename: string }> = {
  home: { label: "Home", filename: "index.html" },
  about: { label: "About", filename: "about.html" },
  services: { label: "Services", filename: "services.html" },
  contact: { label: "Contact", filename: "contact.html" },
  testimonials: { label: "Testimonials", filename: "testimonials.html" },
  faq: { label: "FAQ", filename: "faq.html" },
};

function getNavItems(pages: string[]): NavItem[] {
  return pages
    .map((slug) => {
      const cfg = PAGE_CONFIG[slug];
      return cfg ? { slug, ...cfg } : null;
    })
    .filter((item): item is NavItem => item !== null);
}

function generateNav(spec: NormalizedSpec, activePage: string): string {
  const navItems = getNavItems(spec.pages);
  const links = navItems
    .map((item) => {
      const isCurrent = item.slug === activePage;
      return `<a href="${item.filename}" class="nav-link${isCurrent ? " nav-link--active" : ""}" ${isCurrent ? 'aria-current="page"' : ""}>${esc(item.label)}</a>`;
    })
    .join("\n          ");

  return `<a href="#main" class="skip-link">Skip to content</a>
  <header class="site-header" role="banner">
    <div class="header-inner">
      <a href="index.html" class="wordmark-link" aria-label="${esc(spec.business_name)}">${esc(spec.business_name)}</a>
      <input type="checkbox" id="nav-toggle" class="nav-toggle-checkbox" aria-hidden="true" />
      <label for="nav-toggle" class="nav-toggle-label" aria-label="Open navigation menu">
        <span class="nav-toggle-icon"></span>
      </label>
      <nav class="main-nav" aria-label="Main navigation">
        <div class="nav-links">
          ${links}
        </div>
      </nav>
    </div>
  </header>`;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function generateFooter(spec: NormalizedSpec): string {
  const year = new Date().getFullYear();
  const validLinks = getValidSocialLinks(spec.social_links);
  const socialHtml = validLinks.length > 0
    ? `<div class="footer-social">
        ${validLinks.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(l.platform)}">${esc(l.platform)}</a>`).join("\n        ")}
      </div>`
    : "";

  return `<footer class="site-footer" role="contentinfo">
    <div class="footer-inner">
      ${socialHtml}
      <p class="footer-copyright">&copy; ${year} ${esc(spec.business_name)}. All rights reserved.</p>
      <p class="footer-privacy">This site does not use tracking cookies.</p>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

function wrapPage(head: string, nav: string, main: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
${head}
<body>
  ${nav}
  <main id="main">
    ${main}
  </main>
  ${footer}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Page generators
// ---------------------------------------------------------------------------

function generateHomePage(spec: NormalizedSpec, css: string, googleFontsUrl: string): string {
  const entityH1 = spec.service_area
    ? `${esc(spec.business_name)} &mdash; ${esc(spec.primary_keyword)} in ${esc(spec.service_area)}`
    : esc(spec.business_name);

  const heroHtml = `<section class="hero hero--text-only">
    <div class="hero-inner">
      <h1>${entityH1}</h1>
      ${spec.tagline ? `<p class="tagline">${esc(spec.tagline)}</p>` : ""}
      ${spec.pages.includes("contact") ? `<a href="contact.html" class="btn">Get in Touch</a>` : ""}
    </div>
  </section>`;

  let servicesHtml = "";
  if (spec.services.length > 0) {
    const cards = spec.services.slice(0, 3)
      .map((svc) => `<div class="card">
          <h3>${esc(svc.title)}</h3>
          <p>${esc(svc.description)}</p>
          <span class="price">${esc(svc.price)}</span>
        </div>`)
      .join("\n      ");
    const viewAll = spec.services.length > 3 && spec.pages.includes("services")
      ? `<div class="text-center mt-2"><a href="services.html" class="btn btn--outline">View All Services</a></div>` : "";
    servicesHtml = `<section class="section section--alt" id="services">
    <div class="section-inner">
      <h2 class="section-title">Services</h2>
      <div class="cards">${cards}</div>
      ${viewAll}
    </div>
  </section>`;
  }

  let testimonialHtml = "";
  if (spec.testimonials.length > 0) {
    const first = spec.testimonials[0]!;
    testimonialHtml = `<section class="section" id="testimonials">
    <div class="section-inner">
      <h2 class="section-title">What Families Say</h2>
      <div class="testimonial">
        <blockquote>&ldquo;${esc(first.quote)}&rdquo;</blockquote>
        <cite>${esc(first.name)}</cite>
        <span class="context">${esc(first.context)}</span>
      </div>
    </div>
  </section>`;
  }

  let aboutHtml = "";
  if (spec.bio) {
    const teaser = spec.bio.length > 200 ? spec.bio.substring(0, 200) + "..." : spec.bio;
    const readMore = spec.pages.includes("about")
      ? `<a href="about.html" class="btn btn--outline">Read More About Me</a>` : "";
    aboutHtml = `<section class="section section--alt" id="about">
    <div class="section-inner">
      <h2 class="section-title">About</h2>
      <p>${esc(teaser)}</p>
      <div class="mt-2">${readMore}</div>
    </div>
  </section>`;
  }

  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Ready to Begin Your Journey?</h2>
      <p class="section-subtitle">${spec.service_area ? `Supporting families across ${esc(spec.service_area)}.` : "Supporting families through pregnancy, birth, and beyond."}</p>
      <a href="contact.html" class="btn">Book a Free Consultation</a>
    </div>
  </section>` : "";

  const pageTitle = `${spec.business_name} | Birth Worker`;
  const pageDescription = spec.tagline || `${spec.business_name} birth work services${spec.service_area ? ` in ${spec.service_area}` : ""}`;
  const head = generateHead(css, googleFontsUrl, pageTitle, pageDescription);
  const nav = generateNav(spec, "home");
  const footer = generateFooter(spec);
  return wrapPage(head, nav, `${heroHtml}\n    ${servicesHtml}\n    ${testimonialHtml}\n    ${aboutHtml}\n    ${ctaHtml}`, footer);
}

function generateAboutPage(spec: NormalizedSpec, css: string, googleFontsUrl: string): string {
  const doulaName = spec.doula_name || "Me";
  const pageTitle = `About ${doulaName} | ${spec.business_name}`;
  const pageDescription = spec.bio ? spec.bio.substring(0, 160) : `Learn more about ${doulaName}`;

  const bioHtml = spec.bio
    ? spec.bio.split("\n").filter((l) => l.trim()).map((p) => `<p>${esc(p)}</p>`).join("\n          ")
    : `<p>More information coming soon.</p>`;

  const philosophyHtml = spec.philosophy
    ? `<section class="section section--alt">
    <div class="section-inner">
      <h2 class="section-title">My Philosophy</h2>
      <p>${esc(spec.philosophy)}</p>
    </div>
  </section>` : "";

  const qualifications: string[] = [];
  if (spec.doula_uk) qualifications.push("Doula UK Recognised Doula");
  if (spec.training_provider) qualifications.push(`Trained with ${esc(spec.training_provider)}`);
  const qualHtml = qualifications.length > 0
    ? `<div class="qualifications">
        <h2>Qualifications &amp; Accreditation</h2>
        <ul>${qualifications.map((q) => `<li>${q}</li>`).join("")}</ul>
      </div>` : "";

  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Let's Work Together</h2>
      <p class="section-subtitle">I'd love to hear about your birth wishes and how I can support you.</p>
      <a href="contact.html" class="btn">Get in Touch</a>
    </div>
  </section>` : "";

  const head = generateHead(css, googleFontsUrl, pageTitle, pageDescription);
  const nav = generateNav(spec, "about");
  const footer = generateFooter(spec);
  return wrapPage(head, nav, `<section class="section">
      <div class="section-inner">
        <h1 class="section-title">About ${esc(doulaName)}</h1>
        <div>${bioHtml}${qualHtml}</div>
      </div>
    </section>
    ${philosophyHtml}
    ${ctaHtml}`, footer);
}

function generateServicesPage(spec: NormalizedSpec, css: string, googleFontsUrl: string): string {
  const pageTitle = `Services | ${spec.business_name}`;
  const pageDescription = `Explore services offered by ${spec.doula_name || spec.business_name}${spec.service_area ? ` in ${spec.service_area}` : ""}`;
  const hasContact = spec.pages.includes("contact");

  const cards = spec.services
    .map((svc) => `<div class="card">
        <h2>${esc(svc.title)}</h2>
        <p>${esc(svc.description)}</p>
        <span class="price">${esc(svc.price)}</span>
        ${hasContact ? `<a href="contact.html" class="btn btn--outline">Enquire</a>` : ""}
      </div>`)
    .join("\n      ");

  const ctaHtml = hasContact
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Interested in My Services?</h2>
      <a href="contact.html" class="btn">Book a Consultation</a>
    </div>
  </section>` : "";

  const head = generateHead(css, googleFontsUrl, pageTitle, pageDescription);
  const nav = generateNav(spec, "services");
  const footer = generateFooter(spec);
  return wrapPage(head, nav, `<section class="section">
      <div class="section-inner">
        <h1 class="section-title">${esc(pageTitle)}</h1>
        <div class="cards">${cards}</div>
      </div>
    </section>
    ${ctaHtml}`, footer);
}

function generateContactPage(spec: NormalizedSpec, css: string, googleFontsUrl: string): string {
  const pageTitle = `Contact | ${spec.business_name}`;
  const pageDescription = `Get in touch with ${spec.doula_name || spec.business_name}`;

  const formHtml = `<form name="contact" method="POST" data-netlify="true" class="contact-form" aria-label="Contact form">
        <input type="hidden" name="form-name" value="contact" />
        <div class="form-group">
          <label for="contact-name">Your Name</label>
          <input type="text" id="contact-name" name="name" required autocomplete="name" />
        </div>
        <div class="form-group">
          <label for="contact-email">Your Email</label>
          <input type="email" id="contact-email" name="email" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="contact-message">Your Message</label>
          <textarea id="contact-message" name="message" required></textarea>
        </div>
        <button type="submit" class="btn">Send Message</button>
      </form>`;

  const contactItems: string[] = [];
  if (spec.email) contactItems.push(`<dt>Email</dt><dd><a href="mailto:${esc(spec.email)}">${esc(spec.email)}</a></dd>`);
  if (spec.phone) contactItems.push(`<dt>Phone</dt><dd><a href="tel:${esc(spec.phone)}">${esc(spec.phone)}</a></dd>`);
  if (spec.booking_url && spec.booking_url.startsWith("https://")) {
    contactItems.push(`<dt>Book Online</dt><dd><a href="${esc(spec.booking_url)}" target="_blank" rel="noopener noreferrer">Schedule a consultation</a></dd>`);
  }
  if (spec.service_area) contactItems.push(`<dt>Service Area</dt><dd>${esc(spec.service_area)}</dd>`);
  const contactInfoHtml = contactItems.length > 0
    ? `<dl class="contact-info">${contactItems.join("\n          ")}</dl>` : "";

  const head = generateHead(css, googleFontsUrl, pageTitle, pageDescription);
  const nav = generateNav(spec, "contact");
  const footer = generateFooter(spec);
  return wrapPage(head, nav, `<section class="section">
      <div class="section-inner">
        <h1 class="section-title">Contact ${esc(spec.business_name)}</h1>
        <p class="section-subtitle">I'd love to hear from you.</p>
        <div class="about-grid">
          <div>${formHtml}</div>
          <div>${contactInfoHtml}</div>
        </div>
      </div>
    </section>`, footer);
}

function generateTestimonialsPage(spec: NormalizedSpec, css: string, googleFontsUrl: string): string {
  const pageTitle = `Testimonials | ${spec.business_name}`;
  const pageDescription = `Read what families say about working with ${spec.doula_name || spec.business_name}.`;

  const cards = spec.testimonials
    .map((t) => `<div class="testimonial">
        <blockquote>&ldquo;${esc(t.quote)}&rdquo;</blockquote>
        <cite>${esc(t.name)}</cite>
        <span class="context">${esc(t.context)}</span>
      </div>`)
    .join("\n      ");

  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Start Your Journey</h2>
      <a href="contact.html" class="btn">Get in Touch</a>
    </div>
  </section>` : "";

  const head = generateHead(css, googleFontsUrl, pageTitle, pageDescription);
  const nav = generateNav(spec, "testimonials");
  const footer = generateFooter(spec);
  return wrapPage(head, nav, `<section class="section">
      <div class="section-inner">
        <h1 class="section-title">Client Reviews | ${esc(spec.business_name)}</h1>
        <p class="section-subtitle">Kind words from the families I've had the privilege of supporting.</p>
        ${cards}
      </div>
    </section>
    ${ctaHtml}`, footer);
}

const FAQ_ITEMS = [
  { q: "What does a doula do?", a: (area: string) => `A doula provides continuous emotional, physical, and informational support before, during, and after birth.${area ? ` I work with families across ${area}.` : ""} Unlike midwives, doulas do not provide medical care but instead complement the medical team.` },
  { q: "When should I hire a doula?", a: () => `Many families choose to engage a doula during the second trimester, around 20-24 weeks, but it's never too early or too late to reach out.` },
  { q: "Do you work alongside midwives and doctors?", a: () => `Absolutely. A doula works alongside your medical team, not in place of them.` },
  { q: "What happens if my birth doesn't go to plan?", a: () => `Birth is unpredictable, and I'm trained to support you through any scenario. My role is to ensure you feel informed and empowered regardless of how your birth unfolds.` },
  { q: "Can my partner still be involved if I have a doula?", a: () => `Yes! Having a doula doesn't replace your partner's role — it enhances it.` },
  { q: "How do I know if a doula is right for me?", a: () => `I offer a free initial consultation where we can chat about your needs. There's no obligation.` },
];

function generateFaqPage(spec: NormalizedSpec, css: string, googleFontsUrl: string): string {
  const pageTitle = `FAQ | ${spec.business_name}`;
  const pageDescription = `Frequently asked questions about doula support${spec.service_area ? ` in ${spec.service_area}` : ""}.`;

  const items = FAQ_ITEMS
    .map((item) => `<details class="faq-item">
        <summary>${esc(item.q)}</summary>
        <div class="faq-answer"><p>${esc(item.a(spec.service_area))}</p></div>
      </details>`)
    .join("\n      ");

  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Still Have Questions?</h2>
      <a href="contact.html" class="btn">Contact Me</a>
    </div>
  </section>` : "";

  const head = generateHead(css, googleFontsUrl, pageTitle, pageDescription);
  const nav = generateNav(spec, "faq");
  const footer = generateFooter(spec);
  return wrapPage(head, nav, `<section class="section">
      <div class="section-inner">
        <h1 class="section-title">FAQ | ${esc(spec.business_name)}</h1>
        <p class="section-subtitle">Common questions about doula support and working together.</p>
        ${items}
      </div>
    </section>
    ${ctaHtml}`, footer);
}

// ---------------------------------------------------------------------------
// SEO files
// ---------------------------------------------------------------------------

function generateSitemap(pages: Array<{ filename: string }>, baseUrl: string): string {
  const today = new Date().toISOString().split("T")[0];
  const urls = pages
    .map((p) => `  <url>
    <loc>${baseUrl}/${p.filename}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p.filename === "index.html" ? "1.0" : "0.8"}</priority>
  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate all BuildFile[] from a raw site spec object.
 * This is the only function the orchestrator needs to call.
 */
export function generateSiteFiles(rawSpec: Record<string, unknown>): BuildFile[] {
  const spec = normalize(rawSpec);
  const colours = resolvePalette(spec.palette, spec.custom_colours);
  const typo = TYPOGRAPHY[spec.typography] ?? TYPOGRAPHY.modern!;
  const css = generateCss(colours, typo.heading, typo.body, spec.style);
  const googleFontsUrl = typo.googleFontsUrl;

  const files: BuildFile[] = [];
  const generatedPages: Array<{ filename: string }> = [];

  const navItems = getNavItems(spec.pages);
  for (const navItem of navItems) {
    let html: string | null = null;
    switch (navItem.slug) {
      case "home":
        html = generateHomePage(spec, css, googleFontsUrl);
        break;
      case "about":
        html = generateAboutPage(spec, css, googleFontsUrl);
        break;
      case "services":
        html = generateServicesPage(spec, css, googleFontsUrl);
        break;
      case "contact":
        html = generateContactPage(spec, css, googleFontsUrl);
        break;
      case "testimonials":
        if (spec.testimonials.length > 0) {
          html = generateTestimonialsPage(spec, css, googleFontsUrl);
        }
        break;
      case "faq":
        if (spec.faq_enabled) {
          html = generateFaqPage(spec, css, googleFontsUrl);
        }
        break;
    }
    if (html) {
      files.push({ path: navItem.filename, content: html });
      generatedPages.push({ filename: navItem.filename });
    }
  }

  // SEO files
  const baseUrl = spec.subdomain_slug
    ? `https://${spec.subdomain_slug}.birthbuild.com`
    : "https://example.birthbuild.com";
  files.push({ path: "sitemap.xml", content: generateSitemap(generatedPages, baseUrl) });
  files.push({ path: "robots.txt", content: generateRobotsTxt(baseUrl) });

  return files;
}
