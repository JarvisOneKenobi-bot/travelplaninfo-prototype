import { getDb } from "./db";

interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
}

async function fetchFromGoogle(query: string): Promise<GeocodeResult> {
  const key =
    process.env.GOOGLE_GEOCODING_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return { latitude: null, longitude: null, place_id: null };

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return { latitude: null, longitude: null, place_id: null };

    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) {
      return { latitude: null, longitude: null, place_id: null };
    }

    const result = data.results[0];
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      place_id: result.place_id || null,
    };
  } catch {
    return { latitude: null, longitude: null, place_id: null };
  }
}

function getCached(normalizedQuery: string): GeocodeResult | null {
  const db = getDb();
  const row = db
    .prepare("SELECT latitude, longitude, place_id FROM geocoding_cache WHERE query = ?")
    .get(normalizedQuery) as { latitude: number | null; longitude: number | null; place_id: string | null } | undefined;

  if (!row) return null;
  return { latitude: row.latitude, longitude: row.longitude, place_id: row.place_id };
}

function saveCache(normalizedQuery: string, result: GeocodeResult) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO geocoding_cache (query, latitude, longitude, place_id)
     VALUES (?, ?, ?, ?)`
  ).run(normalizedQuery, result.latitude, result.longitude, result.place_id);
}

export async function geocodeItem(
  itemId: number,
  title: string,
  destination: string
): Promise<void> {
  // Build query from title + destination
  const query = `${title}, ${destination}`;
  const normalizedQuery = query.toLowerCase().trim();

  const db = getDb();

  // Check if already geocoded
  const existing = db
    .prepare("SELECT latitude FROM trip_items WHERE id = ?")
    .get(itemId) as { latitude: number | null } | undefined;

  if (existing?.latitude != null) return;

  // Check cache
  let result = getCached(normalizedQuery);

  if (!result) {
    result = await fetchFromGoogle(query);
    saveCache(normalizedQuery, result);
  }

  if (result.latitude != null) {
    db.prepare(
      "UPDATE trip_items SET latitude = ?, longitude = ?, place_id = ? WHERE id = ?"
    ).run(result.latitude, result.longitude, result.place_id, itemId);
  }
}

export async function geocodeQuery(query: string): Promise<GeocodeResult> {
  const normalizedQuery = query.toLowerCase().trim();

  const cached = getCached(normalizedQuery);
  if (cached) return cached;

  const result = await fetchFromGoogle(query);
  saveCache(normalizedQuery, result);
  return result;
}
