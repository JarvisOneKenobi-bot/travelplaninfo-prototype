import { NextResponse } from "next/server";
import { getAssistantHealth } from "@/lib/assistant-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const health = await getAssistantHealth();
  return NextResponse.json(health);
}
