import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Simple in-memory rate limiter: max 5 attempts per IP per 10-minute window.
// Viable for VPS (long-lived process); resets on process restart.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

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
