import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email || "").trim().toLowerCase();
  const source = (body.source || "unknown").trim().slice(0, 50);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM newsletter_subscribers WHERE email = ?")
    .get(email);

  if (existing) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }

  db.prepare(
    "INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)"
  ).run(email, source);

  return NextResponse.json({ ok: true }, { status: 201 });
}
