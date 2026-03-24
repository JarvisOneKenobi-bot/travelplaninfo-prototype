import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { mergeGuestIntoUser } from "@/lib/guest";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const realUserId = (session.user as any).id;
  const cookieStore = await cookies();
  const guestToken = cookieStore.get("tpi_guest")?.value;

  if (!guestToken) {
    return NextResponse.json({ merged: 0 });
  }

  const db = getDb();
  const guestUser = db
    .prepare("SELECT id FROM users WHERE guest_token = ?")
    .get(guestToken) as { id: number } | undefined;

  if (!guestUser) {
    cookieStore.delete("tpi_guest");
    cookieStore.delete("tpi_guest_hint");
    return NextResponse.json({ merged: 0 });
  }

  const merged = mergeGuestIntoUser(String(guestUser.id), String(realUserId));

  cookieStore.delete("tpi_guest");
  cookieStore.delete("tpi_guest_hint");

  return NextResponse.json({ merged });
}
