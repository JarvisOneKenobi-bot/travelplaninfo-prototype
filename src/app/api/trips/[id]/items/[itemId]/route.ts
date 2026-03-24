import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/guest";
import { getDb } from "@/lib/db";
import { parseCost } from "@/lib/cost-utils";

type Params = { params: Promise<{ id: string; itemId: string }> };

async function verifyItemOwnership(userId: string, tripId: string, itemId: string) {
  const db = getDb();
  const trip = db.prepare("SELECT id, user_id FROM trips WHERE id = ?").get(tripId) as any;
  if (!trip || String(trip.user_id) !== String(userId)) return null;
  const item = db.prepare("SELECT * FROM trip_items WHERE id = ? AND trip_id = ?").get(itemId, tripId) as any;
  return item || null;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const userId = ctx.userId;
  if (!await verifyItemOwnership(userId, id, itemId)) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const body = await req.json();
  const db = getDb();

  db.prepare(
    `UPDATE trip_items SET
      day_number = COALESCE(?, day_number),
      category = COALESCE(?, category),
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      affiliate_program = COALESCE(?, affiliate_program),
      affiliate_url = COALESCE(?, affiliate_url),
      price_estimate = COALESCE(?, price_estimate),
      booked = COALESCE(?, booked),
      sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  ).run(
    body.day_number ?? null, body.category ?? null, body.title ?? null,
    body.description ?? null, body.affiliate_program ?? null, body.affiliate_url ?? null,
    body.price_estimate ?? null,
    body.booked != null ? (body.booked ? 1 : 0) : null,
    body.sort_order ?? null,
    itemId
  );

  // Recalculate estimated_cost when price_estimate is explicitly provided
  if ('price_estimate' in body) {
    const newCost = parseCost(body.price_estimate ?? null);
    db.prepare('UPDATE trip_items SET estimated_cost = ? WHERE id = ?').run(newCost, itemId);
  }

  const item = db.prepare("SELECT * FROM trip_items WHERE id = ?").get(itemId);
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const userId = ctx.userId;
  if (!await verifyItemOwnership(userId, id, itemId)) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const db = getDb();
  db.prepare("DELETE FROM trip_items WHERE id = ?").run(itemId);
  return NextResponse.json({ deleted: true });
}
