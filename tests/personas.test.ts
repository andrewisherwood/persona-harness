import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { Persona } from "../personas/schema.js";

const PERSONAS_DIR = join(__dirname, "..", "personas", "birthbuild");

function loadPersona(filename: string): Persona {
  const raw = readFileSync(join(PERSONAS_DIR, filename), "utf-8");
  return JSON.parse(raw) as Persona;
}

describe("birthbuild personas", () => {
  const files = ["sparse-sarah.json", "detailed-dina.json", "nervous-nora.json"];

  for (const file of files) {
    describe(file, () => {
      it("is valid JSON matching Persona schema", () => {
        const persona = loadPersona(file);
        expect(persona.id).toBeTruthy();
        expect(persona.name).toBeTruthy();
        expect(persona.vertical).toBe("birthbuild");
        expect(persona.background).toBeTruthy();
        expect(persona.communication_style).toBeDefined();
        expect(persona.communication_style.detail_level).toMatch(
          /^(minimal|moderate|verbose)$/,
        );
        expect(persona.knowledge).toBeDefined();
        expect(persona.seed_data).toBeDefined();
        expect(Array.isArray(persona.gaps)).toBe(true);
        expect(persona.triggers).toBeDefined();
      });

      it("has seed_data with at least business_name", () => {
        const persona = loadPersona(file);
        expect(persona.seed_data.business_name).toBeTruthy();
      });
    });
  }
});
