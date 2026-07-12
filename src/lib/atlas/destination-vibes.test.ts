import { describe, expect, it } from 'vitest';

import { DESTINATION_VIBES } from './destination-vibes';

const CLOSED_VOCABULARY = new Set([
  'tropical',
  'beach',
  'romantic',
  'nightlife',
  'big_city',
  'cultural',
  'adventure',
  'foodie',
  'mountain',
]);

function expectSetContents(actual: ReadonlySet<string>, expected: string[]) {
  expect([...actual].sort()).toEqual([...expected].sort());
}

describe('DESTINATION_VIBES', () => {
  it('contains exactly the transcribed destination keys', () => {
    expect(Object.keys(DESTINATION_VIBES)).toHaveLength(82);
  });

  it('preserves spot-checked destination tag sets', () => {
    expectSetContents(DESTINATION_VIBES['CUN'], [
      'tropical',
      'beach',
      'big_city',
      'nightlife',
      'romantic',
    ]);
    expectSetContents(DESTINATION_VIBES['SJU'], [
      'tropical',
      'beach',
      'big_city',
      'cultural',
      'nightlife',
    ]);
    expectSetContents(DESTINATION_VIBES['PUJ'], ['tropical', 'beach', 'romantic']);
  });

  it('uses three-letter uppercase IATA-style keys', () => {
    for (const key of Object.keys(DESTINATION_VIBES)) {
      expect(key).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('only uses tags from the closed vocabulary', () => {
    for (const tags of Object.values(DESTINATION_VIBES)) {
      for (const tag of tags) {
        expect(CLOSED_VOCABULARY.has(tag)).toBe(true);
      }
    }
  });
});
