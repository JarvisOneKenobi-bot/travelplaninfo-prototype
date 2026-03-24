import { NextResponse } from "next/server";
import { getUserId } from "@/lib/guest";
import { getDb } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = ctx.userId;
  const { sessionId } = await params;

  const db = getDb();

  // Verify session belongs to user
  const chatSession = db
    .prepare("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId);

  if (!chatSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const messages = db
    .prepare(
      "SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC"
    )
    .all(sessionId);

  return NextResponse.json(messages);
}
