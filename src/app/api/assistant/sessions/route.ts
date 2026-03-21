import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const db = getDb();
  const sessions = db
    .prepare(
      "SELECT id, title, created_at FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    )
    .all(userId);

  return NextResponse.json(sessions);
}

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const id = randomUUID();
  const db = getDb();

  db.prepare(
    "INSERT INTO chat_sessions (id, user_id) VALUES (?, ?)"
  ).run(id, userId);

  const created = db
    .prepare("SELECT id, title, created_at FROM chat_sessions WHERE id = ?")
    .get(id);

  return NextResponse.json(created, { status: 201 });
}
