// Trip DTOs — public-facing shapes returned by trip API endpoints.
// Stops leaking raw `SELECT *` shape (incl. dead quiz_*/group_* columns).

export interface TripDto {
  id: number;
  userId: number;
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  travelersAdults: number;
  travelersChildren: number;
  rooms: number;
  interests: string[];
  status: string;
  budgetOverride: number | null;
  tripType: string;
  wantHotel: boolean;
  wantCar: boolean;
  wantLimo: boolean;
  wantActivities: boolean;
  budgetMode: string;
  budgetAmount: number | null;
  budgetCategories: Record<string, number> | null;
  origin: string | null;
  nearbyAirports: string[] | null;
  flexibleWindow: string | null;
  tripLength: string | null;
  entryMode: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripItemDto {
  id: number;
  tripId: number;
  dayNumber: number;
  category: string;
  title: string;
  description: string | null;
  priceEstimate: string | null;
  booked: boolean;
  sortOrder: number;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  isPlaceholder: boolean;
  estimatedCost: number | null;
  affiliateProgram: string | null;
  affiliateUrl: string | null;
}

export interface TripDetailDto extends TripDto {
  items: TripItemDto[];
}

function safeJsonArray(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonArrayOrNull(s: unknown): string[] | null {
  if (s === null || s === undefined) return null;
  if (typeof s !== 'string') return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeJsonObject(s: unknown): Record<string, number> | null {
  if (s === null || s === undefined) return null;
  if (typeof s !== 'string') return null;
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function toTripDto(row: any): TripDto {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    destination: row.destination,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    budget: row.budget ?? null,
    travelersAdults: row.travelers_adults ?? 1,
    travelersChildren: row.travelers_children ?? 0,
    rooms: row.rooms ?? 1,
    interests: safeJsonArray(row.interests),
    status: row.status ?? 'planning',
    budgetOverride: row.budget_override ?? null,
    tripType: row.trip_type ?? 'round_trip',
    wantHotel: Boolean(row.want_hotel),
    wantCar: Boolean(row.want_car),
    wantLimo: Boolean(row.want_limo),
    wantActivities: Boolean(row.want_activities),
    budgetMode: row.budget_mode ?? 'preset',
    budgetAmount: row.budget_amount ?? null,
    budgetCategories: safeJsonObject(row.budget_categories),
    origin: row.origin ?? null,
    nearbyAirports: safeJsonArrayOrNull(row.nearby_airports),
    flexibleWindow: row.flexible_window ?? null,
    tripLength: row.trip_length ?? null,
    entryMode: row.entry_mode ?? 'direct',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTripItemDto(row: any): TripItemDto {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayNumber: row.day_number ?? 1,
    category: row.category ?? 'note',
    title: row.title,
    description: row.description ?? null,
    priceEstimate: row.price_estimate ?? null,
    booked: Boolean(row.booked),
    sortOrder: row.sort_order ?? 0,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    placeId: row.place_id ?? null,
    isPlaceholder: Boolean(row.is_placeholder),
    estimatedCost: row.estimated_cost ?? null,
    affiliateProgram: row.affiliate_program ?? null,
    affiliateUrl: row.affiliate_url ?? null,
  };
}

export function toTripDetailDto(row: any, items: any[]): TripDetailDto {
  return { ...toTripDto(row), items: items.map(toTripItemDto) };
}

export function toTripsListDto(rows: any[]): TripDto[] {
  return rows.map(toTripDto);
}
