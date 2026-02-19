# BirthBuild: Programmatic Test Harness

## Goal

Build a test script that runs a persona conversation through the chatbot, captures the resulting site_spec, triggers a build, and deploys a preview site — all without manual intervention. This lets us test prompt changes end-to-end: change the chatbot prompt or generation prompt, run the harness, inspect the output site.

## Current Architecture

```
Persona Harness (simulated conversation)
    ↓ messages
Chatbot Edge Function (/api/chat)
    ↓ writes to
Supabase (site_specs table)
    ↓ read by
Build Edge Function (/api/build)
    ↓ generates
Static HTML/CSS/JS
    ↓ deployed via
Netlify Deploy API → preview URL
```

## What We Need

A test runner script that can operate in two modes:

### Mode 1: Full Pipeline Test (conversation → site)

Runs a persona through the actual chatbot endpoint, letting the chatbot populate the site_spec naturally. This tests the chatbot prompt changes (colour capture, font capture, etc).

```
test-harness.ts run-persona --persona dina-hart
```

Steps:
1. Read the persona script (a JSON file with the persona's responses to each chatbot question)
2. Create a fresh site_spec record in Supabase for this test run
3. Send each persona message to the chatbot endpoint in sequence, passing the conversation history
4. After the final message, read the resulting site_spec from Supabase
5. Validate the site_spec against expected values (see assertions below)
6. Trigger the build endpoint
7. Wait for build completion (poll status)
8. Output the preview URL
9. Run visual assertions against the deployed site (optional, stretch goal)

### Mode 2: Direct Build Test (fixed site_spec → site)

Bypasses the chatbot entirely. Writes a known-correct site_spec directly to Supabase and triggers the build. This tests the generation prompt changes (hero overlay, service card images, social icons, colour enforcement).

```
test-harness.ts build-from-spec --spec dina-hart-fixture.json
```

Steps:
1. Read the fixture JSON (a complete site_spec with correct values)
2. Upsert into Supabase site_specs table
3. Trigger the build endpoint
4. Wait for build completion
5. Output the preview URL
6. Run assertions against the deployed site

## Persona Script Format

Each persona is a JSON file that maps chatbot steps to the persona's responses. The harness sends these in sequence.

```json
{
  "persona_name": "Dina Hart",
  "description": "Brighton-based birth doula, custom terracotta/teal palette, Montserrat/Lora fonts",
  "responses": [
    {
      "step": "business_name",
      "message": "Dina Hart Doula"
    },
    {
      "step": "doula_name",
      "message": "Dina Hart"
    },
    {
      "step": "service_area",
      "message": "I'm based in Lewes but I cover Brighton, Hove, Worthing, Shoreham, and across East Sussex"
    },
    {
      "step": "services",
      "message": "Both — birth doula and postnatal support. I also do standalone antenatal preparation sessions."
    },
    {
      "step": "style_inspiration",
      "message": "I love the Carriage House Birth website — calm, spacious, beautiful typography, lots of white space. Grown-up and capable feeling."
    },
    {
      "step": "style",
      "choice": "modern"
    },
    {
      "step": "palette",
      "choice": "custom"
    },
    {
      "step": "custom_colours",
      "message": "My brand colours are a warm terracotta/rust paired with a deep teal. The terracotta is quite a rich, warm rust — not too orange, not too brown. The teal is deep and grounding, almost like a peacock teal but a bit more muted. I also have a cream/off-white as a neutral base and a soft blush as an accent. Here are my hex codes: terracotta #B7553A, teal #2A6B6A, cream #FAF6F1, blush #E8CFC4."
    },
    {
      "step": "typography",
      "choice": "mixed",
      "message": "I use Montserrat for headings and Lora for body text. My graphic designer set those up as part of my brand kit."
    },
    {
      "step": "bio",
      "message": "I ran a café in Brighton for several years before I became a doula, but it was my own birth experiences that changed the trajectory of my life. My first birth was in hospital — quite medicalised, and I came away feeling like it had happened to me rather than something I'd done. When I got pregnant the second time, I knew I wanted something different. I hired a doula, did a lot of preparation, and had an incredible home birth. That experience pulled me toward this work. Since training with Developing Doulas in 2018, I've supported over 100 families through all types of birth: home, hospital, birth centre, VBAC, water birth, caesarean. My approach is grounded in evidence-based information, informed choice, and absolutely no judgement."
    },
    {
      "step": "testimonials",
      "message": "Here are three:\n\n\"Dina was incredible. She supported our home birth in Lewes and I genuinely don't know how we'd have managed without her. Her calm presence and preparation made all the difference.\" — Emma R. (Home birth, transferred to hospital)\n\n\"Dina supported us both during birth and postnatally, and having that continuity was so valuable. She knew our birth story, she knew our baby, and she helped us process everything in those early weeks when we were exhausted and overwhelmed.\" — Liz & Tom H. (Birth and postnatal support, Hove)\n\n\"I can't recommend Dina enough. She's warm, professional, and made me feel like I could do it even when I was doubting myself. Her preparation and calm energy got me through.\" — Rachel K. (First-time mum, hospital birth, Worthing)"
    },
    {
      "step": "pricing",
      "choice": "no"
    },
    {
      "step": "faq",
      "choice": "yes"
    },
    {
      "step": "email",
      "message": "dina@dinahart.com"
    },
    {
      "step": "phone",
      "message": "07700 900123"
    },
    {
      "step": "booking_url",
      "message": "calendly.com/dinahart"
    },
    {
      "step": "social_links",
      "message": "Instagram: @dinahartdoula, Facebook: Dina Hart Doula"
    },
    {
      "step": "doula_uk",
      "message": "Yes"
    },
    {
      "step": "training_provider",
      "message": "Developing Doulas, 2018"
    },
    {
      "step": "build",
      "choice": "build"
    }
  ],
  "assertions": {
    "site_spec": {
      "custom_colours.primary": "#B7553A",
      "custom_colours.secondary": "#2A6B6A",
      "custom_colours.background": "#FAF6F1",
      "custom_colours.accent": "#E8CFC4",
      "font_heading": "Montserrat",
      "font_body": "Lora",
      "palette": "custom",
      "style": "modern",
      "typography": "mixed"
    },
    "deployed_site": {
      "css_variables": {
        "--colour-primary": "#B7553A",
        "--colour-secondary": "#2A6B6A",
        "--colour-bg": "#FAF6F1"
      },
      "fonts_loaded": ["Montserrat", "Lora"],
      "hero_has_overlay": true,
      "hero_text_colour": "white",
      "service_cards_have_images": true,
      "footer_has_svg_icons": true,
      "no_text_social_links": true
    }
  }
}
```

## Site Spec Fixture Format (for Mode 2)

A complete, known-correct site_spec JSON that bypasses the chatbot entirely. Use this to test generation prompt changes in isolation.

```json
{
  "business_name": "Dina Hart Doula",
  "doula_name": "Dina Hart",
  "tagline": "Empowering birth support across Brighton & East Sussex — because you've got this.",
  "service_area": "Brighton, Hove, Lewes, Worthing, Shoreham, East Sussex",
  "services": [
    {
      "name": "Birth Doula Support",
      "description": "Continuous support throughout your labour and birth, wherever and however you choose to birth. Includes antenatal preparation sessions with hypnobirthing techniques, birth preferences planning, and postpartum follow-up."
    },
    {
      "name": "Postnatal Support",
      "description": "Daytime support in those early weeks, including feeding support, light household tasks, birth processing, and reassuring guidance as you find your rhythm as a family."
    },
    {
      "name": "Antenatal Preparation Sessions",
      "description": "Focused birth preparation using hypnobirthing techniques, breathing and relaxation practices, and birth preferences planning. Available as standalone sessions or as part of birth doula package."
    }
  ],
  "design": {
    "style": "modern",
    "palette": "custom",
    "custom_colours": {
      "background": { "hex": "#FAF6F1", "description": "warm cream/off-white" },
      "primary": { "hex": "#B7553A", "description": "terracotta/rust — rich warm, not too orange, not too brown" },
      "secondary": { "hex": "#2A6B6A", "description": "deep teal — peacock but more muted" },
      "accent": { "hex": "#E8CFC4", "description": "soft blush" },
      "text": { "hex": "#2D2926", "description": "near-black" },
      "cta": { "hex": "#2A6B6A", "description": "deep teal (same as secondary)" }
    },
    "typography": "mixed",
    "font_heading": "Montserrat",
    "font_body": "Lora"
  },
  "content": {
    "bio": "I ran a café in Brighton for several years before I became a doula, but it was my own birth experiences that changed the trajectory of my life.\n\nMy first birth was in hospital — quite medicalised, and I came away feeling like it had happened to me rather than something I'd done. When I got pregnant the second time, I knew I wanted something different. I hired a doula, did a lot of preparation, and had an incredible home birth.\n\nThat experience pulled me toward this work. Since training with Developing Doulas in 2018, I've supported over 100 families through all types of birth: home, hospital, birth centre, VBAC, water birth, caesarean.\n\nMy approach is grounded in evidence-based information, informed choice, and absolutely no judgement. What matters is that you feel informed, capable, and held — whatever your birth looks like.",
    "philosophy": "Evidence-based, informed choice, no judgment. I support physiological birth where possible, but I'm absolutely not judgmental if you want an epidural or end up with a caesarean. My role is to help you access your own strength and feel capable, whatever your birth looks like.",
    "testimonials": [
      {
        "quote": "Dina was incredible. She supported our home birth in Lewes and I genuinely don't know how we'd have managed without her. Her calm presence and preparation made all the difference.",
        "name": "Emma R.",
        "context": "Home birth (transferred to hospital)"
      },
      {
        "quote": "Dina supported us both during birth and postnatally, and having that continuity was so valuable. She knew our birth story, she knew our baby, and she helped us process everything in those early weeks when we were exhausted and overwhelmed.",
        "name": "Liz & Tom H.",
        "context": "Birth and postnatal support, Hove"
      },
      {
        "quote": "I can't recommend Dina enough. She's warm, professional, and made me feel like I could do it even when I was doubting myself. Her preparation and calm energy got me through.",
        "name": "Rachel K.",
        "context": "First-time mum, hospital birth, Worthing"
      }
    ],
    "faq": true
  },
  "contact": {
    "email": "dina@dinahart.com",
    "phone": "07700 900123",
    "booking_url": "calendly.com/dinahart"
  },
  "social": {
    "instagram": "https://instagram.com/dinahartdoula",
    "facebook": "https://facebook.com/dinahartdoula"
  },
  "accreditation": {
    "doula_uk": true,
    "training_provider": "Developing Doulas (2018)"
  },
  "seo": {
    "primary_keyword": "birth doula Brighton"
  },
  "pages": ["home", "about", "services", "testimonials", "faq", "contact"]
}
```

## Test Runner Implementation

Create `scripts/test-harness.ts` in the BirthBuild repo. It needs:

### Dependencies
- Supabase JS client (already in the project)
- Node fetch or similar for calling Edge Functions
- A way to read persona scripts from `test/personas/`

### Environment Variables
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=     # Service role to bypass RLS for test writes
BIRTHBUILD_CHAT_ENDPOINT=      # e.g. https://[project-ref].supabase.co/functions/v1/chat
BIRTHBUILD_BUILD_ENDPOINT=     # e.g. https://[project-ref].supabase.co/functions/v1/build
TEST_TENANT_ID=                # A dedicated test tenant
TEST_USER_ID=                  # A dedicated test user
```

### Core Functions

```typescript
// Mode 1: Run persona through chatbot
async function runPersona(personaPath: string) {
  const persona = JSON.parse(fs.readFileSync(personaPath, 'utf-8'));
  
  // 1. Create fresh site_spec
  const siteSpecId = await createTestSiteSpec();
  
  // 2. Send each message through the chat endpoint
  let chatHistory = [];
  for (const response of persona.responses) {
    const message = response.message || response.choice;
    const result = await sendChatMessage(siteSpecId, message, chatHistory);
    chatHistory = result.chat_history;
    
    // Brief pause to simulate real conversation timing
    await sleep(500);
  }
  
  // 3. Read final site_spec
  const finalSpec = await getSiteSpec(siteSpecId);
  
  // 4. Run assertions on the spec
  const specResults = assertSiteSpec(finalSpec, persona.assertions.site_spec);
  console.log('Site spec assertions:', specResults);
  
  // 5. Trigger build
  const buildResult = await triggerBuild(siteSpecId);
  
  // 6. Wait for deployment
  const previewUrl = await waitForDeploy(siteSpecId, 120); // 2 min timeout
  console.log('Preview URL:', previewUrl);
  
  // 7. Run deployed site assertions (if available)
  if (persona.assertions.deployed_site) {
    const siteResults = await assertDeployedSite(previewUrl, persona.assertions.deployed_site);
    console.log('Deployed site assertions:', siteResults);
  }
  
  return { siteSpecId, previewUrl, specResults };
}

// Mode 2: Build from fixture
async function buildFromSpec(fixturePath: string) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  
  // 1. Upsert fixture as site_spec
  const siteSpecId = await upsertTestSiteSpec(fixture);
  
  // 2. Trigger build
  await triggerBuild(siteSpecId);
  
  // 3. Wait for deployment
  const previewUrl = await waitForDeploy(siteSpecId, 120);
  console.log('Preview URL:', previewUrl);
  
  return { siteSpecId, previewUrl };
}
```

### Deployed Site Assertions

After the site deploys, fetch the HTML/CSS and check:

```typescript
async function assertDeployedSite(url: string, expected: any) {
  const results = [];
  
  // Fetch the page
  const html = await fetch(url).then(r => r.text());
  
  // Extract CSS variables from <style> tags
  const cssVarMatch = html.match(/:root\s*\{([^}]+)\}/);
  if (cssVarMatch && expected.css_variables) {
    for (const [varName, expectedValue] of Object.entries(expected.css_variables)) {
      const regex = new RegExp(`${varName.replace('--', '--')}:\\s*([^;]+);`);
      const match = cssVarMatch[1].match(regex);
      const actual = match ? match[1].trim() : null;
      results.push({
        check: `CSS var ${varName}`,
        expected: expectedValue,
        actual,
        pass: actual?.toLowerCase() === (expectedValue as string).toLowerCase()
      });
    }
  }
  
  // Check fonts loaded (look for Google Fonts links or @font-face)
  if (expected.fonts_loaded) {
    for (const font of expected.fonts_loaded) {
      const fontFound = html.includes(font);
      results.push({
        check: `Font loaded: ${font}`,
        pass: fontFound
      });
    }
  }
  
  // Check hero has overlay (look for hero__overlay or gradient overlay class)
  if (expected.hero_has_overlay) {
    const hasOverlay = html.includes('hero__overlay') || 
                       html.includes('hero-overlay') ||
                       (html.includes('position: absolute') && html.includes('gradient'));
    results.push({
      check: 'Hero has gradient overlay',
      pass: hasOverlay
    });
  }
  
  // Check service cards have images
  if (expected.service_cards_have_images) {
    // Look for img tags inside card elements on the homepage
    const cardImgPattern = /class="card[^"]*"[^>]*>[\s\S]*?<img/g;
    const cardImages = html.match(cardImgPattern);
    results.push({
      check: 'Service cards have images',
      pass: (cardImages?.length || 0) >= 2
    });
  }
  
  // Check footer has SVG icons (not text labels)
  if (expected.footer_has_svg_icons) {
    const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/);
    if (footerMatch) {
      const hasSvg = footerMatch[0].includes('<svg');
      const hasTextLabel = footerMatch[0].match(/>Facebook<\/a>/) || 
                           footerMatch[0].match(/>Instagram<\/a>/);
      results.push({
        check: 'Footer uses SVG icons',
        pass: hasSvg && !hasTextLabel
      });
    }
  }
  
  return results;
}
```

## File Structure

```
birthbuild/
├── scripts/
│   └── test-harness.ts          # The test runner
├── test/
│   ├── personas/
│   │   ├── dina-hart.json       # Dina persona script (Mode 1)
│   │   ├── sarah-bristol.json   # Another persona for variety
│   │   └── minimal-preset.json  # Uses a preset palette (regression test)
│   └── fixtures/
│       ├── dina-hart-spec.json  # Known-correct site_spec (Mode 2)
│       └── sage-sand-spec.json  # Preset palette fixture
```

## Usage

```bash
# Test the full pipeline with Dina's persona
npx tsx scripts/test-harness.ts run-persona --persona test/personas/dina-hart.json

# Test just the build with a known-correct spec
npx tsx scripts/test-harness.ts build-from-spec --spec test/fixtures/dina-hart-spec.json

# Run all personas (regression test after prompt changes)
npx tsx scripts/test-harness.ts run-all
```

## What This Unlocks

1. **Change the chatbot prompt** → run Mode 1 → check if the site_spec captures correct hex codes
2. **Change the generation prompt** → run Mode 2 with the fixture → check if the output CSS uses the right colours
3. **Change both** → run Mode 1 end-to-end → check everything
4. **Add a new persona** → drop a JSON file in test/personas/ → run it
5. **Regression testing** → run all personas after any prompt change to make sure nothing broke
6. **A/B comparison** → run the same persona with two different generation prompts, compare the output URLs side by side

## Priority

Start with **Mode 2** (build from fixture). It's simpler — no chatbot interaction, just a JSON write and a build trigger. This lets you test the visual upgrades (hero overlay, service card images, social icons) immediately. Mode 1 (full persona pipeline) can come after the chatbot prompt changes are implemented.
