#!/usr/bin/env node
// Regenerates src/lib/atlas/generated/city-names.json from TravelPayouts' own
// public data (no token needed).
//   Run:            node scripts/generate-city-names.mjs
//   Offline rerun:  TP_DATA_DIR=/path/to/cached node scripts/generate-city-names.mjs
//
// Recipe (do not change without updating city-names.test.ts):
//   - source of truth: api.travelpayouts.com/data/en/{cities,airports,countries}.json
//   - include every city that has >= 1 entry in airports.json (city_code match).
//     ALL airport-table rows count: TP lists metro codes and pseudo-stations
//     there, and that is exactly the population its price API can return.
//   - label: "{city name}, {country name}" (whitespace collapsed)
//   - ">= 2 airports" => append " (all airports)" — a CHI price may be O'Hare
//     OR Midway; printing bare "Chicago" would invite a false assumption.
//     Never remap a metro code to one airport: that would fabricate precision.
//   - a city we cannot label (missing name/country) is omitted: the runtime
//     DROPS unnameable codes rather than showing them.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.travelpayouts.com/data/en";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "atlas", "generated");
const OUT = join(OUT_DIR, "city-names.json");

async function getJson(name) {
  if (process.env.TP_DATA_DIR) {
    return JSON.parse(await readFile(join(process.env.TP_DATA_DIR, name), "utf-8"));
  }
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name} -> HTTP ${res.status}`);
  return res.json();
}

const [cities, airports, countries] = await Promise.all([
  getJson("cities.json"),
  getJson("airports.json"),
  getJson("countries.json"),
]);

const countryName = new Map(countries.map((c) => [c.code, c.name]));

const airportCount = new Map();
for (const airport of airports) {
  const cityCode = airport.city_code;
  if (cityCode) airportCount.set(cityCode, (airportCount.get(cityCode) ?? 0) + 1);
}

const table = {};
for (const city of cities) {
  const code = city.code;
  const name = (city.name ?? "").replace(/\s+/g, " ").trim();
  const country = countryName.get(city.country_code);
  const count = airportCount.get(code) ?? 0;
  if (!code || !/^[A-Z]{3}$/.test(code) || !name || !country || count === 0) continue;
  table[code] = `${name}, ${country}${count >= 2 ? " (all airports)" : ""}`;
}

const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(
  `wrote ${Object.keys(sorted).length} city names (${Object.values(sorted).filter((v) => v.endsWith("(all airports)")).length} multi-airport) to ${OUT}`
);
