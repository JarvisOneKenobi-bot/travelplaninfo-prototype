import { NextResponse } from "next/server";
import { PREF_ENUMS } from "@/lib/preferences";

export async function GET() {
  return NextResponse.json(PREF_ENUMS);
}
