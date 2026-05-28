import { describe, it, expect } from 'vitest';
import { toTripDto, toTripDetailDto } from './trip';

describe('toTripDto', () => {
  it('maps DB row to public-facing TripDto', () => {
    const row = {
      id: 1, user_id: 42, name: 'My trip', destination: 'Cancún',
      start_date: '2026-06-01', end_date: '2026-06-08',
      budget: 'midrange', travelers_adults: 2, travelers_children: 0, rooms: 1,
      interests: '["beach","vibe:chill"]', status: 'planning',
      budget_override: null, trip_type: 'round_trip',
      want_hotel: 1, want_car: 0, want_limo: 0, want_activities: 1,
      budget_mode: 'preset', budget_amount: null, budget_categories: null,
      origin: 'MIA', nearby_airports: '["MIA","FLL","PBI"]',
      flexible_window: null, trip_length: null, entry_mode: 'direct',
      quiz_budget: 'low', quiz_vibes: '[]', quiz_when: null, quiz_who: null,
      quiz_group_size: 1, group_share: 0, group_costsplit: 0, group_consensus: 0,
      origin_auto: null,
      created_at: '2026-05-27T10:00:00Z', updated_at: '2026-05-27T10:00:00Z',
    };

    const dto = toTripDto(row);

    expect(dto.id).toBe(1);
    expect(dto.destination).toBe('Cancún');
    expect(dto.interests).toEqual(['beach', 'vibe:chill']);
    expect(dto.nearbyAirports).toEqual(['MIA', 'FLL', 'PBI']);
    expect(dto.entryMode).toBe('direct');
    expect('quiz_budget' in dto).toBe(false);
    expect('group_share' in dto).toBe(false);
    expect('origin_auto' in dto).toBe(false);
  });

  it('returns empty array for malformed interests JSON', () => {
    const row = { id: 1, name: 't', destination: 'x', interests: 'not-json' } as any;
    expect(toTripDto(row).interests).toEqual([]);
  });

  it('returns null for missing nearby_airports', () => {
    const row = { id: 1, name: 't', destination: 'x', nearby_airports: null } as any;
    expect(toTripDto(row).nearbyAirports).toBeNull();
  });
});

describe('toTripDetailDto', () => {
  it('combines trip row + items array', () => {
    const row = { id: 1, name: 't', destination: 'Cancún', interests: '[]', nearby_airports: null } as any;
    const items = [
      { id: 10, trip_id: 1, day_number: 1, category: 'flight', title: 'AA123',
        description: null, price_estimate: '$250', booked: 0, sort_order: 0,
        latitude: null, longitude: null, place_id: null, is_placeholder: 0,
        estimated_cost: 250, affiliate_program: null, affiliate_url: null },
    ];
    const detail = toTripDetailDto(row, items);
    expect(detail.id).toBe(1);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].priceEstimate).toBe('$250');
    expect(detail.items[0].estimatedCost).toBe(250);
  });
});
