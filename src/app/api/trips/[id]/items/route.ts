import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/guest";
import { getDb } from "@/lib/db";
import { geocodeItem } from "@/lib/geocode";
import { parseCost } from "@/lib/cost-utils";

const VALID_CATEGORIES = new Set([
  "flight",
  "hotel",
  "car_rental",
  "activity",
  "restaurant",
  "transportation",
  "note",
]);

type Params = { params: Promise<{ id: string }> };

async function verifyTripOwnership(userId: string, tripId: string) {
  const db = getDb();
  const trip = db.prepare("SELECT id, user_id FROM trips WHERE id = ?").get(tripId) as any;
  return trip && String(trip.user_id) === String(userId) ? trip : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = ctx.userId;
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
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = ctx.userId;
  if (!await verifyTripOwnership(userId, id)) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const body = await req.json();
  let {
    day_number = 1,
    category = "note",
    title,
    description,
    affiliate_program,
    affiliate_url,
    price_estimate,
    sort_order = 0,
    is_placeholder = 0,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Normalize legacy 'car' category
  if (category === "car") category = "car_rental";

  // Validate category
  if (!VALID_CATEGORIES.has(category)) {
    category = "note";
  }

  const db = getDb();

  // Get trip destination for geocoding
  const trip = db.prepare("SELECT destination FROM trips WHERE id = ?").get(id) as { destination: string } | undefined;
  const destination = trip?.destination || "";

  const estimated_cost = parseCost(price_estimate);

  const result = db
    .prepare(
      `INSERT INTO trip_items
        (trip_id, day_number, category, title, description, affiliate_program, affiliate_url, price_estimate, estimated_cost, sort_order, is_placeholder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, day_number, category, title, description || null, affiliate_program || null, affiliate_url || null, price_estimate || null, estimated_cost, sort_order, is_placeholder ? 1 : 0) as any;

  const item = db.prepare("SELECT * FROM trip_items WHERE id = ?").get(result.lastInsertRowid);

  // Fire-and-forget geocoding (do not await — respond immediately)
  const itemId = Number(result.lastInsertRowid);
  geocodeItem(itemId, title, destination).catch(() => {});

  return NextResponse.json(item, { status: 201 });
}
