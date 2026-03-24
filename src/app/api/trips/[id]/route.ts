import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/guest";
import { getDb } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function getOwnedTrip(userId: string, tripId: string) {
  const db = getDb();
  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(tripId) as any;
  if (!trip) return null;
  if (String(trip.user_id) !== String(userId)) return null;
  return trip;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = ctx.userId;
  const trip = await getOwnedTrip(userId, id);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const db = getDb();
  const items = db
    .prepare("SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day_number, sort_order")
    .all(id);

  return NextResponse.json({ ...trip, items });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = ctx.userId;
  const trip = await getOwnedTrip(userId, id);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const body = await req.json();
  const db = getDb();
  db.prepare(
    `UPDATE trips SET
      name = COALESCE(?, name),
      destination = COALESCE(?, destination),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      budget = COALESCE(?, budget),
      travelers_adults = COALESCE(?, travelers_adults),
      travelers_children = COALESCE(?, travelers_children),
      rooms = COALESCE(?, rooms),
      interests = COALESCE(?, interests),
      status = COALESCE(?, status),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    body.name ?? null, body.destination ?? null,
    body.start_date ?? null, body.end_date ?? null, body.budget ?? null,
    body.travelers_adults ?? null, body.travelers_children ?? null, body.rooms ?? null,
    body.interests != null ? JSON.stringify(body.interests) : null,
    body.status ?? null,
    id
  );

  // budget_override is nullable-as-feature: null means "use auto", so COALESCE won't work
  // Client sends null to clear override, positive number to set custom budget
  if ('budget_override' in body) {
    const val = body.budget_override;
    db.prepare('UPDATE trips SET budget_override = ? WHERE id = ?')
      .run(val == null ? null : val, id);
  }

  const updated = db.prepare("SELECT * FROM trips WHERE id = ?").get(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = ctx.userId;
  const trip = await getOwnedTrip(userId, id);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const db = getDb();
  db.prepare("DELETE FROM trips WHERE id = ?").run(id);
  return NextResponse.json({ deleted: true });
}
