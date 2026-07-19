#!/usr/bin/env node
// Regenerates src/lib/atlas/generated/city-names.json,
// src/lib/atlas/generated/airport-metros.json, and
// src/lib/atlas/generated/airline-names.json from TravelPayouts' own public
// data (no token needed).
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
//
// Airport metro recipe (do not change without updating city-names.test.ts):
//   - source of truth: api.travelpayouts.com/data/en/airports.json
//   - map each airport row's code -> city_code, normalized to uppercase.
//   - omit malformed rows only (missing/non-3-letter code or city_code).
//   - do NOT hand-write or infer metro groups. If TP says ONT -> ONT and
//     LGB -> LGB, they remain separate cities from LAX.
//
// Airline recipe (do not change without updating city-names.test.ts):
//   - source of truth: api.travelpayouts.com/data/en/airlines.json
//   - map each airline row's code -> name, normalized code to uppercase.
//   - airline codes can include digits (B6, 9K, G4); do not require letters-only.
//   - collapse whitespace in names.
//   - omit rows without a usable code/name. Runtime callers render NOTHING for
//     unnameable airline codes; a raw code must never reach a user.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.travelpayouts.com/data/en";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "atlas", "generated");
const OUT = join(OUT_DIR, "city-names.json");
const METRO_OUT = join(OUT_DIR, "airport-metros.json");
const AIRLINE_OUT = join(OUT_DIR, "airline-names.json");

async function getJson(name) {
  if (process.env.TP_DATA_DIR) {
    return JSON.parse(await readFile(join(process.env.TP_DATA_DIR, name), "utf-8"));
  }
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name} -> HTTP ${res.status}`);
  return res.json();
}

const [cities, airports, countries, airlines] = await Promise.all([
  getJson("cities.json"),
  getJson("airports.json"),
  getJson("countries.json"),
  getJson("airlines.json"),
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

const airportMetros = {};
for (const airport of airports) {
  const code = String(airport.code ?? "").trim().toUpperCase();
  const cityCode = String(airport.city_code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || !/^[A-Z]{3}$/.test(cityCode)) continue;
  airportMetros[code] = cityCode;
}
const sortedAirportMetros = Object.fromEntries(Object.entries(airportMetros).sort(([a], [b]) => a.localeCompare(b)));

const airlineNames = {};
for (const airline of airlines) {
  const code = String(airline.code ?? "").trim().toUpperCase();
  const name = String(airline.name ?? "").replace(/\s+/g, " ").trim();
  if (code.length !== 2 || !name) continue;
  airlineNames[code] = name;
}
const sortedAirlineNames = Object.fromEntries(Object.entries(airlineNames).sort(([a], [b]) => a.localeCompare(b)));

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, `${JSON.stringify(sorted, null, 1)}\n`);
await writeFile(METRO_OUT, `${JSON.stringify(sortedAirportMetros, null, 1)}\n`);
await writeFile(AIRLINE_OUT, `${JSON.stringify(sortedAirlineNames, null, 1)}\n`);
console.log(
  `wrote ${Object.keys(sorted).length} city names (${Object.values(sorted).filter((v) => v.endsWith("(all airports)")).length} multi-airport) to ${OUT}`
);
console.log(`wrote ${Object.keys(sortedAirportMetros).length} airport metro mappings to ${METRO_OUT}`);
console.log(`wrote ${Object.keys(sortedAirlineNames).length} airline names to ${AIRLINE_OUT}`);
