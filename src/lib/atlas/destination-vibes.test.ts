import { describe, expect, it } from 'vitest';
import type { CanonicalVibe } from '@/lib/trip-types';
import { DESTINATION_VIBES } from './destination-vibes';

// The only rename in the migration. Everything else is purely additive.
const RENAMES: Record<string, string> = { mountain: 'mountains' };

// Frozen pre-fix table (destination-vibes.ts as of 1f2c54d). Test fixture only —
// the singular 'mountain' below is the frozen BUG, not product vocabulary.
const PRE_MIGRATION_TAGS: Record<string, string[]> = {
  CUN: ['tropical', 'beach', 'big_city', 'nightlife', 'romantic'],
  SJU: ['tropical', 'beach', 'big_city', 'cultural', 'nightlife'],
  PUJ: ['tropical', 'beach', 'romantic'],
  MBJ: ['tropical', 'beach', 'romantic', 'adventure'],
  NAS: ['tropical', 'beach', 'romantic'],
  GCM: ['tropical', 'beach', 'romantic'],
  BGI: ['tropical', 'beach', 'romantic', 'cultural'],
  ANU: ['tropical', 'beach', 'romantic'],
  STT: ['tropical', 'beach', 'romantic', 'adventure'],
  STX: ['tropical', 'beach', 'adventure'],
  SXM: ['tropical', 'beach', 'nightlife', 'romantic'],
  PLS: ['tropical', 'beach', 'romantic'],
  SJD: ['tropical', 'beach', 'romantic', 'adventure'],
  PVR: ['tropical', 'beach', 'romantic', 'nightlife'],
  CTG: ['tropical', 'beach', 'cultural', 'romantic'],
  SDQ: ['tropical', 'beach', 'big_city'],
  ZIH: ['tropical', 'beach', 'romantic'],
  HAV: ['tropical', 'beach', 'cultural'],
  MCO: ['beach', 'big_city', 'adventure'],
  MIA: ['beach', 'big_city', 'nightlife', 'tropical'],
  FLL: ['beach', 'tropical'],
  TPA: ['beach'],
  RSW: ['beach'],
  SAN: ['beach', 'big_city', 'foodie'],
  HNL: ['tropical', 'beach', 'romantic', 'adventure'],
  JFK: ['big_city', 'cultural', 'foodie', 'nightlife'],
  LGA: ['big_city', 'cultural', 'foodie', 'nightlife'],
  EWR: ['big_city', 'cultural', 'foodie', 'nightlife'],
  LAX: ['big_city', 'beach', 'cultural', 'foodie', 'nightlife'],
  ORD: ['big_city', 'cultural', 'foodie'],
  LAS: ['nightlife', 'big_city', 'adventure'],
  ATL: ['big_city', 'cultural', 'foodie'],
  DFW: ['big_city', 'foodie'],
  DEN: ['mountain', 'adventure', 'big_city'],
  SEA: ['big_city', 'cultural', 'foodie', 'mountain'],
  BOS: ['big_city', 'cultural', 'foodie'],
  SFO: ['big_city', 'cultural', 'foodie'],
  MSY: ['cultural', 'foodie', 'nightlife'],
  BNA: ['cultural', 'nightlife', 'foodie'],
  AUS: ['cultural', 'nightlife', 'foodie'],
  PDX: ['foodie', 'cultural'],
  PHX: ['adventure', 'mountain'],
  LHR: ['big_city', 'cultural', 'foodie'],
  CDG: ['big_city', 'cultural', 'foodie', 'romantic'],
  FCO: ['big_city', 'cultural', 'foodie', 'romantic'],
  BCN: ['big_city', 'beach', 'cultural', 'foodie', 'nightlife'],
  MAD: ['big_city', 'cultural', 'foodie', 'nightlife'],
  AMS: ['big_city', 'cultural', 'nightlife'],
  LIS: ['big_city', 'cultural', 'foodie', 'beach', 'romantic'],
  ATH: ['cultural', 'beach', 'foodie', 'romantic'],
  IST: ['big_city', 'cultural', 'foodie'],
  DUB: ['cultural', 'foodie'],
  CPH: ['cultural', 'foodie', 'big_city'],
  PRG: ['cultural', 'romantic', 'nightlife'],
  BUD: ['cultural', 'nightlife', 'romantic'],
  KEF: ['adventure', 'romantic'],
  GIG: ['beach', 'big_city', 'cultural', 'nightlife', 'tropical'],
  GRU: ['big_city', 'cultural', 'foodie'],
  EZE: ['big_city', 'cultural', 'foodie', 'nightlife'],
  BOG: ['big_city', 'cultural', 'foodie', 'mountain'],
  MDE: ['big_city', 'cultural', 'foodie', 'mountain'],
  LIM: ['big_city', 'cultural', 'foodie'],
  SJO: ['adventure', 'tropical', 'beach'],
  PTY: ['big_city', 'tropical', 'beach'],
  BZE: ['tropical', 'beach', 'adventure'],
  BKK: ['big_city', 'cultural', 'foodie', 'nightlife', 'tropical'],
  DPS: ['tropical', 'beach', 'cultural', 'romantic', 'adventure'],
  SIN: ['big_city', 'cultural', 'foodie'],
  HKG: ['big_city', 'cultural', 'foodie'],
  NRT: ['big_city', 'cultural', 'foodie'],
  HND: ['big_city', 'cultural', 'foodie'],
  ICN: ['big_city', 'cultural', 'foodie'],
  DXB: ['big_city', 'beach'],
  CMB: ['tropical', 'beach', 'cultural'],
  SYD: ['big_city', 'beach', 'cultural', 'foodie'],
  AKL: ['adventure', 'cultural'],
  CPT: ['big_city', 'beach', 'adventure', 'cultural', 'foodie'],
  NBO: ['adventure', 'cultural'],
  RAK: ['cultural', 'foodie', 'romantic'],
  CAI: ['cultural', 'big_city'],
  HRG: ['beach', 'tropical'],
  SSH: ['beach', 'tropical'],
};

const NEW_CODES = [
  'YVR', 'SLC', 'ZRH', 'GVA', 'MUC', 'AGP',
  'NYC', 'CHI', 'ORL', 'WAS', 'PAR', 'LON', 'YTO', 'HOU', 'PIT', 'MOW', 'RDU', 'ANC', 'BEG',
];

describe('DESTINATION_VIBES (canonical)', () => {
  it('contains every pre-fix destination plus the 19 new codes (101 total)', () => {
    const keys = Object.keys(DESTINATION_VIBES);
    expect(keys).toHaveLength(101);
    for (const code of Object.keys(PRE_MIGRATION_TAGS)) {
      expect(keys, `destination ${code} was dropped by the migration`).toContain(code);
    }
    for (const code of NEW_CODES) {
      expect(keys, `new code ${code} is missing`).toContain(code);
    }
  });

  it('no destination lost information: new tags superset of old tags with the rename applied', () => {
    for (const [code, oldTags] of Object.entries(PRE_MIGRATION_TAGS)) {
      for (const oldTag of oldTags) {
        const migrated = RENAMES[oldTag] ?? oldTag;
        expect(
          DESTINATION_VIBES[code].has(migrated as CanonicalVibe),
          `${code} lost tag "${oldTag}" (expected "${migrated}")`
        ).toBe(true);
      }
    }
  });

  it('every destination has a three-letter uppercase key and at least one tag', () => {
    for (const [code, tags] of Object.entries(DESTINATION_VIBES)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(tags.size).toBeGreaterThanOrEqual(1);
    }
  });

  it('spot-checks exact editorial tag sets', () => {
    const sorted = (code: string) => [...DESTINATION_VIBES[code]].sort();
    expect(sorted('CUN')).toEqual(['beach', 'big_city', 'family', 'nightlife', 'romantic', 'tropical']);
    expect(sorted('DEN')).toEqual(['adventure', 'big_city', 'mountains', 'winter']);
    expect(sorted('KEF')).toEqual(['adventure', 'mountains', 'romantic', 'winter']);
    // Jose 2026-07-12: Vancouver is NOT a beach destination. No 'beach' here.
    expect(sorted('YVR')).toEqual(['big_city', 'family', 'foodie', 'mountains', 'winter']);
    expect(sorted('ORL')).toEqual(['adventure', 'family']);
    expect(sorted('PAR')).toEqual(['big_city', 'cultural', 'foodie', 'romantic']);
    expect(sorted('ANC')).toEqual(['adventure', 'mountains', 'winter']);
    expect(sorted('NYC')).toEqual(['big_city', 'cultural', 'foodie', 'nightlife', 'romantic']);
  });

  it('exactly two 2-vibe combinations are unsatisfiable at overlap 2 — both genuinely contradictory under the snow/ski reading of Winter Escapade (the designed no-match fixtures)', () => {
    const all = Object.values(DESTINATION_VIBES);
    const vocabulary = [...new Set(all.flatMap((tags) => [...tags]))].sort();
    const impossible: string[] = [];
    for (let i = 0; i < vocabulary.length; i += 1) {
      for (let j = i + 1; j < vocabulary.length; j += 1) {
        const a = vocabulary[i] as CanonicalVibe;
        const b = vocabulary[j] as CanonicalVibe;
        if (!all.some((tags) => tags.has(a) && tags.has(b))) impossible.push(`${a}+${b}`);
      }
    }
    // Vancouver losing 'beach' (Jose) makes beach+winter impossible too. Both
    // pairs route to the no_match_possible clarification card. Inventing a
    // destination to carry either pair would be fabrication.
    expect(impossible).toEqual(['beach+winter', 'tropical+winter']);
  });
});
