import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveCityName } from "./city-names";
import generated from "./generated/city-names.json";

describe("resolveCityName", () => {
  it("curated names win over generated ones", () => {
    expect(resolveCityName("JFK")).toBe("New York, New York");
    expect(resolveCityName("BNA")).toBe("Nashville, Tennessee");
    // YVR exists in BOTH tables — curated ("Vancouver, Canada") must win over
    // the generated "Vancouver, Canada (all airports)".
    expect(resolveCityName("YVR")).toBe("Vancouver, Canada");
  });

  it("resolves TP metro city codes via the generated table with the honest multi-airport suffix", () => {
    expect(resolveCityName("CHI")).toBe("Chicago, United States (all airports)");
    expect(resolveCityName("NYC")).toBe("New York, United States (all airports)");
    expect(resolveCityName("WAS")).toBe("Washington, United States (all airports)");
    expect(resolveCityName("PAR")).toBe("Paris, France (all airports)");
  });

  it("single-airport cities get no suffix", () => {
    expect(resolveCityName("HNL")).toBe("Honolulu, United States");
  });

  it("returns null for codes it cannot name — callers must DROP, never render the code", () => {
    expect(resolveCityName("ZZZ")).toBeNull();
    expect(resolveCityName("")).toBeNull();
    expect(resolveCityName("TOOLONG")).toBeNull();
  });

  it("is case/whitespace tolerant", () => {
    expect(resolveCityName(" chi ")).toBe("Chicago, United States (all airports)");
  });
});

describe("generated table sanity (regenerable via scripts/generate-city-names.mjs)", () => {
  const entries = Object.entries(generated as Record<string, string>);

  it("has broad coverage and honest multi-airport labeling", () => {
    expect(entries.length).toBeGreaterThan(9000);
    expect(entries.filter(([, v]) => v.endsWith(" (all airports)")).length).toBeGreaterThan(400);
  });

  it("every key is a 3-letter code and every value is a real label, never a bare code", () => {
    for (const [code, label] of entries) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(label).toMatch(/, /); // "City, Country" shape
      expect(label).not.toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("server-only guard", () => {
  it("city-names.ts keeps its server-only import (client bundles must never carry ~290 KB of names)", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/atlas/city-names.ts"), "utf-8");
    expect(source).toContain('import "server-only";');
  });
});
