import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function verifyTripOwnership(userId: string, tripId: string) {
  const db = getDb();
  const trip = db.prepare("SELECT id, user_id FROM trips WHERE id = ?").get(tripId) as any;
  return trip && String(trip.user_id) === String(userId) ? trip : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any).id;
  if (!await verifyTripOwnership(userId, id)) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const db = getDb();
  const items = db
    .prepare("SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day_number, sort_order")
    .all(id);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any).id;
  if (!await verifyTripOwnership(userId, id)) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    day_number = 1,
    category = "note",
    title,
    description,
    affiliate_program,
    affiliate_url,
    price_estimate,
    sort_order = 0,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO trip_items
        (trip_id, day_number, category, title, description, affiliate_program, affiliate_url, price_estimate, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, day_number, category, title, description || null, affiliate_program || null, affiliate_url || null, price_estimate || null, sort_order) as any;

  const item = db.prepare("SELECT * FROM trip_items WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(item, { status: 201 });
}
