import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const db = getDb();
  const trips = db
    .prepare("SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);

  return NextResponse.json(trips);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
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
  } = body;

  if (!name || !destination) {
    return NextResponse.json({ error: "name and destination are required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO trips (user_id, name, destination, start_date, end_date, budget,
        travelers_adults, travelers_children, rooms, interests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId, name, destination,
      start_date || null, end_date || null, budget || null,
      travelers_adults, travelers_children, rooms,
      JSON.stringify(interests)
    ) as any;

  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(trip, { status: 201 });
}
