import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { auth } from "./auth";
import { getDb } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserContext {
  userId: string;
  isGuest: boolean;
  guestToken?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUEST_COOKIE = "tpi_guest";
const GUEST_HINT_COOKIE = "tpi_guest_hint";
const GUEST_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// ---------------------------------------------------------------------------
// getUserId — resolve the current caller to a UserContext (or null)
// ---------------------------------------------------------------------------

export async function getUserId(): Promise<UserContext | null> {
  // 1. Check NextAuth session first
  const session = await auth();
  if (session?.user) {
    const userId = (session.user as any).id as string | undefined;
    if (userId) {
      return { userId, isGuest: false };
    }
  }

  // 2. Fall back to guest cookie
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_COOKIE)?.value;
  if (!guestToken) return null;

  const db = getDb();
  const row = db
    .prepare("SELECT id FROM users WHERE guest_token = ?")
    .get(guestToken) as { id: number } | undefined;

  if (!row) return null;

  return { userId: String(row.id), isGuest: true, guestToken };
}

// ---------------------------------------------------------------------------
// getOrCreateGuest — guaranteed to return a UserContext
// ---------------------------------------------------------------------------

/**
 * Race condition: concurrent requests before cookie is set may create
 * duplicate guest users. Impact is minimal (orphaned guest with no trips).
 * Accepted trade-off.
 */
export async function getOrCreateGuest(): Promise<UserContext> {
  const existing = await getUserId();
  if (existing) return existing;

  const db = getDb();
  const guestToken = randomUUID();
  const email = `guest-${guestToken}@guest.local`;

  db.prepare(
    "INSERT INTO users (email, name, provider, guest_token) VALUES (?, ?, 'guest', ?)"
  ).run(email, "Guest Traveler", guestToken);

  const row = db
    .prepare("SELECT id FROM users WHERE guest_token = ?")
    .get(guestToken) as { id: number };

  // Set server-side auth cookie (httpOnly)
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(GUEST_COOKIE, guestToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: GUEST_MAX_AGE,
    path: "/",
  });

  // Set client-readable hint cookie (NOT httpOnly)
  cookieStore.set(GUEST_HINT_COOKIE, "1", {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    maxAge: GUEST_MAX_AGE,
    path: "/",
  });

  return { userId: String(row.id), isGuest: true, guestToken };
}

// ---------------------------------------------------------------------------
// mergeGuestIntoUser — transfer guest data to a real user account
// ---------------------------------------------------------------------------

/**
 * Merge precedence: Real user's memory/preferences win on UNIQUE conflicts.
 * Guest's conflicting rows are cascade-deleted with the guest user.
 *
 * Tables merged:
 *  - trips, chat_sessions       → re-parented via UPDATE SET user_id
 *  - user_memory                → UPDATE OR IGNORE (real user wins on conflict)
 *  - user_preferences           → UPDATE OR IGNORE (real user wins on conflict)
 *  - guest user row             → DELETE (ON DELETE CASCADE cleans orphaned child rows)
 */
export function mergeGuestIntoUser(
  guestUserId: string,
  realUserId: string
): number {
  const db = getDb();

  const merged = db.transaction(() => {
    // Re-parent trips
    const tripResult = db
      .prepare("UPDATE trips SET user_id = ? WHERE user_id = ?")
      .run(realUserId, guestUserId);

    // Re-parent chat sessions
    db.prepare("UPDATE chat_sessions SET user_id = ? WHERE user_id = ?").run(
      realUserId,
      guestUserId
    );

    // Merge user_memory — real user's data wins on UNIQUE(user_id, key) conflict
    db.prepare(
      "UPDATE OR IGNORE user_memory SET user_id = ? WHERE user_id = ?"
    ).run(realUserId, guestUserId);

    // Merge user_preferences — real user's data wins on PRIMARY KEY conflict
    db.prepare(
      "UPDATE OR IGNORE user_preferences SET user_id = ? WHERE user_id = ?"
    ).run(realUserId, guestUserId);

    // Delete the guest user row — ON DELETE CASCADE cleans any remaining
    // orphaned child rows (memory/preferences that lost the conflict)
    // Defense-in-depth: only delete if it's actually a guest user
    db.prepare("DELETE FROM users WHERE id = ? AND guest_token IS NOT NULL").run(guestUserId);

    return tripResult.changes;
  })();

  return merged;
}
