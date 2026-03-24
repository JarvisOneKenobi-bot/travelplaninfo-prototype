import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

// ── GET — Load all memory for authenticated user ─────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const db = getDb();
  const memories = db
    .prepare(
      `SELECT key, value, source, updated_at
       FROM user_memory
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(userId) as { key: string; value: string; source: string; updated_at: string }[];

  return NextResponse.json({ memories });
}

// ── POST — Upsert key-value memory entries ───────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  let body: { entries: Array<{ key: string; value: string; source?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { entries } = body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "entries array is required" }, { status: 400 });
  }

  // Validate key/value lengths
  for (const entry of entries) {
    if (!entry.key || entry.key.length > 100) {
      return NextResponse.json({ error: "key must be 1-100 characters" }, { status: 400 });
    }
    if (typeof entry.value !== "string" || entry.value.length > 1000) {
      return NextResponse.json({ error: "value must be a string of max 1000 characters" }, { status: 400 });
    }
  }

  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO user_memory (user_id, key, value, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET
       value      = excluded.value,
       source     = excluded.source,
       updated_at = datetime('now')`
  );

  const upsertMany = db.transaction(
    (rows: Array<{ key: string; value: string; source?: string }>) => {
      for (const row of rows) {
        upsert.run(userId, row.key, row.value, row.source ?? "atlas");
      }
    }
  );

  upsertMany(entries);

  return NextResponse.json({ ok: true, count: entries.length });
}
