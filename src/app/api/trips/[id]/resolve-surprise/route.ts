import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/guest';
import { getDb } from '@/lib/db';
import { toTripDto } from '@/lib/dto/trip';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_trip_id' }, { status: 400 });
  }

  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const destination = typeof body?.destination === 'string' ? body.destination.trim() : '';
  if (!destination) {
    return NextResponse.json({ error: 'destination_required' }, { status: 400 });
  }
  if (destination === 'Surprise Me') {
    return NextResponse.json({ error: 'destination_must_be_real' }, { status: 400 });
  }
  if (destination.length > 200) {
    return NextResponse.json({ error: 'destination_too_long' }, { status: 400 });
  }

  const db = getDb();

  // Atomic test-and-set: only updates if the trip is still 'Surprise Me' for this user.
  const result = db
    .prepare(
      `UPDATE trips
       SET destination = ?, entry_mode = 'surprise', updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND destination = 'Surprise Me'`
    )
    .run(destination, id, ctx.userId);

  if (result.changes === 0) {
    // Either the row doesn't exist (for this user) or it was no longer 'Surprise Me'.
    // Distinguish so the client gets the right error.
    const check = db
      .prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?')
      .get(id, ctx.userId);
    if (!check) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'not_surprise_me_trip' }, { status: 400 });
  }

  const updated = db
    .prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?')
    .get(id, ctx.userId) as any;
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(toTripDto(updated));
}
