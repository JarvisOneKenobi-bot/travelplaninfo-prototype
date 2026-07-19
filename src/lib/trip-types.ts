// Shared trip-planning constants and types.

export interface TrendingDestination {
  city: string;
  country: string;
  code: string; // airport code
  image: string;
  viatorDestId?: string;
  gygLocationId?: string;
  discoverCarsSlug?: string;
  articleSlug?: string;
}

// The canonical vibe vocabulary — the single source of truth for every vibe a
// user can pick anywhere in the product. The taxonomy in
// src/lib/atlas/destination-vibes.ts is typed against CanonicalVibe (a stray
// tag is a compile error) and vibe-vocabulary.guard.test.ts fails the build if
// picker and taxonomy ever drift apart again.
export const CANONICAL_VIBES = [
  'tropical', 'mountains', 'big_city', 'beach', 'winter', 'cultural', 'adventure',
  'foodie', 'romantic', 'nightlife', 'family',
] as const;

export type CanonicalVibe = (typeof CANONICAL_VIBES)[number];

export const VIBE_ICONS: Record<CanonicalVibe, string> = {
  tropical: '🌴',
  mountains: '🏔️',
  big_city: '🏙️',
  beach: '🌊',
  winter: '❄️',
  cultural: '🏛️',
  adventure: '🏕️',
  foodie: '🍜',
  romantic: '💕',
  nightlife: '🎶',
  family: '👨‍👩‍👧‍👦',
};

// English default labels; the UI renders localized labels from
// messages/*/common.json tripForm.vibes (same keys).
export const VIBE_LABELS: Record<CanonicalVibe, string> = {
  tropical: 'Tropical',
  mountains: 'Mountains',
  big_city: 'Big City',
  beach: 'Beach',
  winter: 'Winter Escapade',
  cultural: 'Cultural',
  adventure: 'Adventure',
  foodie: 'Food',
  romantic: 'Romantic',
  nightlife: 'Nightlife',
  family: 'Family',
};

export const VIBE_OPTIONS: { value: CanonicalVibe; label: string; icon: string }[] =
  CANONICAL_VIBES.map((value) => ({ value, label: VIBE_LABELS[value], icon: VIBE_ICONS[value] }));
