import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/guest";
import { geocodeQuery } from "@/lib/geocode";

export async function POST(req: NextRequest) {
  const ctx = await getUserId();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { query } = body;
  if (!query || typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const result = await geocodeQuery(query.trim());
  return NextResponse.json(result);
}
