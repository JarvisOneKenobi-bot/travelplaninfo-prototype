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
  } = body;

  if (!name || !destination) {
    return NextResponse.json({ error: "name and destination are required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO trips (user_id, name, destination, start_date, end_date, budget,
        travelers_adults, travelers_children, rooms, interests, flexible_window, trip_length,
        origin, nearby_airports)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId, name, destination,
      start_date || null, end_date || null, budget || null,
      travelers_adults, travelers_children, rooms,
      JSON.stringify(interests),
      flexible_window || null, trip_length || null,
      origin || null, nearby_airports ? JSON.stringify(nearby_airports) : null
    ) as any;

  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(trip, { status: 201 });
}
