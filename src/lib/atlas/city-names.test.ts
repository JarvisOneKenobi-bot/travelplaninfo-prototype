import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveCityName } from "./city-names";
import { resolveMetro } from "./metro";
import { resolveAirlineName } from "./airline-names";
import generatedMetros from "./generated/airport-metros.json";
import generatedAirlines from "./generated/airline-names.json";
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

describe("resolveMetro", () => {
  it("uses TravelPayouts airport city_code and falls back to the exact normalized code", () => {
    expect(resolveMetro("JFK")).toBe("NYC");
    expect(resolveMetro("LGA")).toBe("NYC");
    expect(resolveMetro("EWR")).toBe("NYC");
    expect(resolveMetro("BUR")).toBe("LAX");
    expect(resolveMetro("SNA")).toBe("LAX");
    expect(resolveMetro("NYC")).toBe("NYC");
    expect(resolveMetro(" zzz ")).toBe("ZZZ");
  });

  it("does not fabricate adjacent-city groupings beyond TP city_code", () => {
    expect(resolveMetro("ONT")).toBe("ONT");
    expect(resolveMetro("LGB")).toBe("LGB");
  });
});

describe("generated airport metro table sanity (regenerable via scripts/generate-city-names.mjs)", () => {
  const entries = Object.entries(generatedMetros as Record<string, string>);

  it("has broad coverage and pins the reported TP metro rows", () => {
    expect(entries.length).toBeGreaterThan(10000);
    expect(generatedMetros).toMatchObject({
      JFK: "NYC",
      LGA: "NYC",
      EWR: "NYC",
      BUR: "LAX",
      SNA: "LAX",
      VNY: "LAX",
      WHP: "LAX",
      ONT: "ONT",
      LGB: "LGB",
    });
  });

  it("contains only exact 3-letter airport-code to city-code mappings", () => {
    for (const [code, cityCode] of entries) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(cityCode).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("resolveAirlineName", () => {
  it("resolves 2-character airline codes, including digit-containing IATA codes", () => {
    expect(resolveAirlineName("B6")).toBe("jetBlue");
    expect(resolveAirlineName("AA")).toBe("American Airlines");
    expect(resolveAirlineName("9K")).toBe("Cape Air");
  });

  it("returns null for codes it cannot name — callers must render nothing, never the code", () => {
    expect(resolveAirlineName("X0")).toBeNull();
    expect(resolveAirlineName("")).toBeNull();
    expect(resolveAirlineName("TOOLONG")).toBeNull();
  });

  it("is case/whitespace tolerant", () => {
    expect(resolveAirlineName(" b6 ")).toBe("jetBlue");
  });
});

describe("generated airline table sanity (regenerable via scripts/generate-city-names.mjs)", () => {
  const entries = Object.entries(generatedAirlines as Record<string, string>);

  it("has broad coverage and pins owner-verified examples", () => {
    expect(entries.length).toBeGreaterThan(1000);
    expect(generatedAirlines).toMatchObject({
      B6: "jetBlue",
      AA: "American Airlines",
      DL: "Delta",
      UA: "United Airlines",
      WN: "Southwest Airlines",
      NK: "Spirit Airlines",
      "9K": "Cape Air",
      G4: "Allegiant Air",
    });
  });

  it("contains only 2-character airline-code keys with non-empty names", () => {
    for (const [code, name] of entries) {
      expect(code).toHaveLength(2);
      expect(name.trim()).toBe(name);
      expect(name).not.toBe("");
    }
  });
});

describe("server-only guard", () => {
  it("city-names.ts keeps its server-only import (client bundles must never carry ~290 KB of names)", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/atlas/city-names.ts"), "utf-8");
    expect(source).toContain('import "server-only";');
  });

  it("airline-names.ts keeps its server-only import (client bundles must never carry generated airline names)", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/atlas/airline-names.ts"), "utf-8");
    expect(source).toContain('import "server-only";');
  });
});
