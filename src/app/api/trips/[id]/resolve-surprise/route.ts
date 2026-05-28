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
  const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(id, ctx.userId) as any;
  if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (trip.destination !== 'Surprise Me') {
    return NextResponse.json({ error: 'not_surprise_me_trip' }, { status: 400 });
  }

  // Atomic write: destination + entry_mode='surprise' + updated_at
  const now = new Date().toISOString();
  db.prepare(`UPDATE trips
              SET destination = ?, entry_mode = 'surprise', updated_at = ?
              WHERE id = ? AND user_id = ?`)
    .run(destination, now, id, ctx.userId);

  const updated = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as any;
  return NextResponse.json(toTripDto(updated));
}
