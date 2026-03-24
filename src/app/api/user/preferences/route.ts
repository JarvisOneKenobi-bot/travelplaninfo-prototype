import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserId } from "@/lib/guest";
import { getDb } from "@/lib/db";
import {
  DEFAULT_PREFERENCES,
  mergePreferences,
  validatePreferences,
} from "@/lib/preferences";

export async function GET() {
  const ctx = await getUserId();
  if (!ctx || ctx.isGuest) return NextResponse.json(DEFAULT_PREFERENCES);

  const userId = ctx.userId;
  const db = getDb();
  const row = db
    .prepare("SELECT prefs FROM user_preferences WHERE user_id = ?")
    .get(userId) as { prefs: string } | undefined;

  if (!row) {
    return NextResponse.json(DEFAULT_PREFERENCES);
  }

  let saved: Record<string, unknown>;
  try {
    saved = JSON.parse(row.prefs);
  } catch {
    saved = {};
  }

  return NextResponse.json(mergePreferences(saved));
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();

  const validated = validatePreferences(body);
  const merged = mergePreferences(validated);

  const db = getDb();
  db.prepare(
    `INSERT INTO user_preferences (user_id, prefs, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET prefs = excluded.prefs, updated_at = excluded.updated_at`
  ).run(userId, JSON.stringify(merged));

  return NextResponse.json(merged);
}
