import { describe, it, expect } from "vitest";
import {
  detectModelProvider,
  estimateCost,
  PALETTES,
  TYPOGRAPHY_PRESETS,
  MODEL_RATES,
} from "../src/server/engine/creative-engine.js";
import type {
  CreativeBuildConfig,
  CreativeRunProgress,
} from "../src/server/engine/creative-engine.js";

describe("creative-engine", () => {
  describe("detectModelProvider", () => {
    it("detects anthropic models", () => {
      expect(detectModelProvider("claude-opus-4-6")).toBe("anthropic");
      expect(detectModelProvider("claude-sonnet-4-5-20250929")).toBe("anthropic");
      expect(detectModelProvider("claude-haiku-4-5-20251001")).toBe("anthropic");
    });

    it("detects openai models", () => {
      expect(detectModelProvider("gpt-5.2")).toBe("openai");
      expect(detectModelProvider("gpt-5.2-pro")).toBe("openai");
    });

    it("detects google models", () => {
      expect(detectModelProvider("gemini-2.0-pro")).toBe("google");
    });

    it("returns unknown for unrecognised models", () => {
      expect(detectModelProvider("llama-3")).toBe("unknown");
    });
  });

  describe("estimateCost", () => {
    it("calculates opus cost correctly", () => {
      // Opus: $15/M input, $75/M output
      const cost = estimateCost("claude-opus-4-6", 100_000, 50_000);
      // (100000 * 15 + 50000 * 75) / 1_000_000 = 1.5 + 3.75 = 5.25
      expect(cost).toBeCloseTo(5.25, 4);
    });

    it("calculates sonnet cost correctly", () => {
      // Sonnet: $3/M input, $15/M output
      const cost = estimateCost("claude-sonnet-4-5-20250929", 100_000, 50_000);
      // (100000 * 3 + 50000 * 15) / 1_000_000 = 0.3 + 0.75 = 1.05
      expect(cost).toBeCloseTo(1.05, 4);
    });

    it("calculates haiku cost correctly", () => {
      // Haiku: $0.80/M input, $4/M output
      const cost = estimateCost("claude-haiku-4-5-20251001", 100_000, 50_000);
      // (100000 * 0.8 + 50000 * 4) / 1_000_000 = 0.08 + 0.2 = 0.28
      expect(cost).toBeCloseTo(0.28, 4);
    });

    it("falls back to sonnet rates for unknown models", () => {
      const cost = estimateCost("unknown-model", 1_000_000, 1_000_000);
      // (1M * 3 + 1M * 15) / 1M = 18
      expect(cost).toBeCloseTo(18.0, 4);
    });
  });

  describe("PALETTES", () => {
    it("has four palette options", () => {
      expect(Object.keys(PALETTES)).toHaveLength(4);
    });

    it("each palette has all required colour keys", () => {
      for (const [name, palette] of Object.entries(PALETTES)) {
        expect(palette, `${name} missing keys`).toHaveProperty("background");
        expect(palette).toHaveProperty("primary");
        expect(palette).toHaveProperty("accent");
        expect(palette).toHaveProperty("text");
        expect(palette).toHaveProperty("cta");
      }
    });

    it("all colours are valid hex values", () => {
      const hexPattern = /^#[0-9a-f]{6}$/i;
      for (const palette of Object.values(PALETTES)) {
        for (const colour of Object.values(palette)) {
          expect(colour).toMatch(hexPattern);
        }
      }
    });
  });

  describe("TYPOGRAPHY_PRESETS", () => {
    it("has three typography options", () => {
      expect(Object.keys(TYPOGRAPHY_PRESETS)).toHaveLength(3);
    });

    it("each preset has heading and body fonts", () => {
      for (const [name, preset] of Object.entries(TYPOGRAPHY_PRESETS)) {
        expect(preset, `${name} missing heading`).toHaveProperty("heading");
        expect(preset, `${name} missing body`).toHaveProperty("body");
        expect(typeof preset.heading).toBe("string");
        expect(typeof preset.body).toBe("string");
      }
    });
  });

  describe("MODEL_RATES", () => {
    it("has rates for all supported models", () => {
      expect(MODEL_RATES).toHaveProperty("claude-opus-4-6");
      expect(MODEL_RATES).toHaveProperty("claude-sonnet-4-5-20250929");
      expect(MODEL_RATES).toHaveProperty("claude-haiku-4-5-20251001");
    });

    it("each rate is [input, output] tuple with positive values", () => {
      for (const [model, rates] of Object.entries(MODEL_RATES)) {
        expect(rates, `${model} should be a tuple`).toHaveLength(2);
        expect(rates[0], `${model} input rate`).toBeGreaterThan(0);
        expect(rates[1], `${model} output rate`).toBeGreaterThan(0);
        expect(rates[1], `${model} output > input`).toBeGreaterThan(rates[0]);
      }
    });
  });

  describe("CreativeBuildConfig type", () => {
    it("accepts valid config", () => {
      const config: CreativeBuildConfig = {
        model: "claude-sonnet-4-5-20250929",
        temperature: 0.7,
        palette: "sage_sand",
        typography: "mixed",
        style: "classic",
        feeling: "Reassuring",
      };
      expect(config.model).toBe("claude-sonnet-4-5-20250929");
      expect(config.temperature).toBe(0.7);
    });
  });

  describe("CreativeRunProgress type", () => {
    it("accepts all step values", () => {
      const steps: CreativeRunProgress["step"][] = [
        "init",
        "design-system",
        "page",
        "saving",
        "deploying",
        "complete",
        "error",
      ];
      expect(steps).toHaveLength(7);
    });

    it("accepts page progress with index", () => {
      const progress: CreativeRunProgress = {
        runId: "test-run",
        step: "page",
        pageName: "home",
        pageIndex: 0,
        totalPages: 6,
        message: "Generating home page...",
      };
      expect(progress.pageName).toBe("home");
      expect(progress.pageIndex).toBe(0);
    });
  });
});
