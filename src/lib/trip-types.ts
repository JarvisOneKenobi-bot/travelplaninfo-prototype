// Shared types and constants for the three-mode entry system

export type EntryMode = 'direct' | 'surprise';

export type QuizBudgetTier = 'budget' | 'mid_range' | 'premium' | 'luxury';

export type QuizWhen = 'specific' | 'flexible' | 'no_idea';

export type QuizWho = 'solo' | 'couple' | 'family' | 'friends';

export interface QuizAnswers {
  budget_tier: QuizBudgetTier | null;
  vibes: string[];
  when: QuizWhen | null;
  when_dates?: { start: string; end: string };
  when_months?: string[];
  who: QuizWho;
  group_size: number;
  group_share: boolean;
  group_costsplit: boolean;
  group_consensus: boolean;
}

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

export interface DestinationSuggestion {
  city: string;
  country: string;
  flightPrice: number | null;
  hotelPrice: number | null;
  bestFor: string;
  image: string;
}

export const BUDGET_TIERS: { value: QuizBudgetTier; label: string; range: string }[] = [
  { value: 'budget', label: 'Budget', range: 'Under $1K' },
  { value: 'mid_range', label: 'Mid-Range', range: '$1K-$3K' },
  { value: 'premium', label: 'Premium', range: '$3K-$5K' },
  { value: 'luxury', label: 'Luxury', range: '$5K+' },
];

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

export const PRESET_VIBES = [
  'beach', 'city', 'adventure', 'food', 'culture', 'nature', 'nightlife', 'wellness',
] as const;

export const QUIZ_WHO_OPTIONS: { value: QuizWho; label: string; icon: string }[] = [
  { value: 'solo', label: 'Solo', icon: '🧳' },
  { value: 'couple', label: 'Couple', icon: '💑' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'friends', label: 'Friends', icon: '🎉' },
];
