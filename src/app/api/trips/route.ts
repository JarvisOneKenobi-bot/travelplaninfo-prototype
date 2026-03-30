import { NextRequest, NextResponse } from "next/server";
import { getUserId, getOrCreateGuest } from "@/lib/guest";
import { getDb } from "@/lib/db";

export async function GET() {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = ctx.userId;
  const db = getDb();
  const trips = db
    .prepare("SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);

  return NextResponse.json(trips);
}

export async function POST(req: NextRequest) {
  const ctx = await getOrCreateGuest();
  const userId = ctx.userId;
  const body = await req.json();
  const {
    name,
    destination,
    start_date,
    end_date,
    budget,
    travelers_adults = 1,
    travelers_children = 0,
    rooms = 1,
    interests = [],
    flexible_window,
    trip_length,
    origin,
    nearby_airports,
    trip_type = 'round_trip',
    want_hotel = true,
    want_car = false,
    want_limo = false,
    want_activities = true,
    budget_mode = 'preset',
    budget_amount = null,
    budget_categories = null,
  } = body;

  if (!name || !destination) {
    return NextResponse.json({ error: "name and destination are required" }, { status: 400 });
  }

  if (!['round_trip', 'one_way'].includes(trip_type)) {
    return NextResponse.json({ error: "Invalid trip_type" }, { status: 400 });
  }

  if (!['preset', 'total', 'per_day', 'per_person'].includes(budget_mode)) {
    return NextResponse.json({ error: "Invalid budget_mode" }, { status: 400 });
  }

  if (budget_mode !== 'preset') {
    const amt = Number(budget_amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "budget_amount must be a positive number" }, { status: 400 });
    }
  }

  const ALLOWED_BUDGET_CATS = ['flights', 'activities', 'food', 'accommodation', 'transport', 'cruise'];
  if (budget_categories != null) {
    if (typeof budget_categories !== 'object' || Array.isArray(budget_categories)) {
      return NextResponse.json({ error: "Invalid budget_categories" }, { status: 400 });
    }
    for (const [k, v] of Object.entries(budget_categories)) {
      if (!ALLOWED_BUDGET_CATS.includes(k) || !Number.isFinite(Number(v)) || Number(v) < 0) {
        return NextResponse.json({ error: `Invalid budget category: ${k}` }, { status: 400 });
      }
    }
  }

  if (flexible_window?.startsWith('custom:')) {
    const [, n, unit] = flexible_window.split(':');
    if (!['days', 'weeks', 'months'].includes(unit) || !Number.isFinite(+n) || +n < 1 || +n > 365) {
      return NextResponse.json({ error: "Invalid flexible_window" }, { status: 400 });
    }
  }

  if (trip_length?.startsWith('custom:')) {
    const [, n, unit] = trip_length.split(':');
    if (!['days', 'weeks', 'months'].includes(unit) || !Number.isFinite(+n) || +n < 1 || +n > 365) {
      return NextResponse.json({ error: "Invalid trip_length" }, { status: 400 });
    }
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO trips (user_id, name, destination, start_date, end_date, budget,
        travelers_adults, travelers_children, rooms, interests, flexible_window, trip_length,
        origin, nearby_airports, trip_type, want_hotel, want_car, want_limo,
        want_activities, budget_mode, budget_amount, budget_categories)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId, name, destination,
      start_date || null, end_date || null, budget || null,
      travelers_adults, travelers_children, rooms,
      JSON.stringify(interests),
      flexible_window || null, trip_length || null,
      origin || null, nearby_airports ? JSON.stringify(nearby_airports) : null,
      trip_type, want_hotel ? 1 : 0, want_car ? 1 : 0, want_limo ? 1 : 0,
      want_activities ? 1 : 0, budget_mode, budget_amount || null,
      budget_categories ? JSON.stringify(budget_categories) : null
    ) as any;

  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(trip, { status: 201 });
}
