// Shared types and constants for the three-mode entry system

export type EntryMode = 'direct' | 'surprise';

export type BudgetTier = 'budget' | 'mid_range' | 'premium' | 'luxury';

export type QuizWhen = 'specific' | 'flexible' | 'no_idea';

export type QuizWho = 'solo' | 'couple' | 'family' | 'friends';

export interface QuizAnswers {
  budget_tier: BudgetTier | null;
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

export const BUDGET_TIERS: { value: BudgetTier; label: string; range: string }[] = [
  { value: 'budget', label: 'Budget', range: 'Under $1K' },
  { value: 'mid_range', label: 'Mid-Range', range: '$1K-$3K' },
  { value: 'premium', label: 'Premium', range: '$3K-$5K' },
  { value: 'luxury', label: 'Luxury', range: '$5K+' },
];

export const PRESET_VIBES = [
  'beach', 'city', 'adventure', 'food', 'culture', 'nature', 'nightlife', 'wellness',
] as const;

export const QUIZ_WHO_OPTIONS: { value: QuizWho; label: string; icon: string }[] = [
  { value: 'solo', label: 'Solo', icon: '🧳' },
  { value: 'couple', label: 'Couple', icon: '💑' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'friends', label: 'Friends', icon: '🎉' },
];
