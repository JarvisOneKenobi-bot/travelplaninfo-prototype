import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const name = body.name || null;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const password_hash = await bcrypt.hash(password, 12);
  const result = db
    .prepare(
      "INSERT INTO users (email, name, password_hash, provider) VALUES (?, ?, ?, 'credentials')"
    )
    .run(email, name, password_hash) as any;

  const user = db
    .prepare("SELECT id, email, name, created_at FROM users WHERE id = ?")
    .get(result.lastInsertRowid);

  return NextResponse.json(user, { status: 201 });
}
