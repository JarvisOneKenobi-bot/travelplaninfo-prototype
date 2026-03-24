import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/guest";
import { getDb } from "@/lib/db";

// ── Rate limiting (in-memory, per session_id, 10 req/min) ──────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

// ── POST handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const ctx = await getUserId();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = ctx.userId;

  // 2. Parse body
  let body: { message: string; session_id: string; page_context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, session_id, page_context } = body;
  if (!message || !session_id) {
    return NextResponse.json(
      { error: "message and session_id are required" },
      { status: 400 }
    );
  }

  // 3. Rate limit
  if (!checkRateLimit(session_id)) {
    return NextResponse.json(
      { error: "Atlas has reached the rate limit. Please wait a moment." },
      { status: 429 }
    );
  }

  // 4. Validate session belongs to user
  const db = getDb();
  const chatSession = db
    .prepare("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?")
    .get(session_id, userId) as { id: string } | undefined;

  if (!chatSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // 5. Load user preferences
  const prefRow = db
    .prepare("SELECT prefs FROM user_preferences WHERE user_id = ?")
    .get(userId) as { prefs: string } | undefined;
  const preferencesJson = prefRow?.prefs || "{}";

  // 5b. Load user memory (cross-session context)
  const memoryRows = db
    .prepare(
      "SELECT key, value FROM user_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50"
    )
    .all(userId) as { key: string; value: string }[];

  // Format memory context with summary-aware grouping
  const summaries = memoryRows.filter((m) =>
    m.key.startsWith("conversation_summary_")
  );
  const facts = memoryRows.filter(
    (m) => !m.key.startsWith("conversation_summary_")
  );

  let memoryContext = "";
  if (facts.length > 0) {
    memoryContext +=
      "Known preferences: " +
      facts.map((m) => `${m.key}=${m.value}`).join(", ");
  }
  if (summaries.length > 0) {
    memoryContext +=
      (memoryContext ? "\n" : "") +
      "Previous sessions: " +
      summaries.map((m) => m.value).join("; ");
  }

  // 5c. Auto-summarize previous session if needed
  // Check if this user has older sessions with 3+ exchanges that haven't been summarized
  const unsummarizedSession = db
    .prepare(
      `SELECT cs.id, DATE(cs.created_at) as session_date,
              COUNT(cm.id) as msg_count
       FROM chat_sessions cs
       JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.user_id = ?
         AND cs.id != ?
         AND NOT EXISTS (
           SELECT 1 FROM user_memory um
           WHERE um.user_id = cs.user_id
             AND um.key = 'conversation_summary_' || DATE(cs.created_at)
         )
       GROUP BY cs.id
       HAVING msg_count >= 6
       ORDER BY cs.created_at DESC
       LIMIT 1`
    )
    .get(userId, session_id) as
    | { id: string; session_date: string; msg_count: number }
    | undefined;

  if (unsummarizedSession && !ctx.isGuest) {
    // Fire-and-forget: summarize in background (don't block the chat response)
    const cookieHeader = req.headers.get("cookie") || "";
    fetch("http://localhost:3000/api/assistant/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ session_id: unsummarizedSession.id }),
    }).catch((err) =>
      console.error("Background summarization failed:", err)
    );
  }

  // 6. Save user message to chat_messages
  db.prepare(
    "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)"
  ).run(session_id, message);

  // 7. Load conversation history (last 20 messages)
  const historyRows = db
    .prepare(
      `SELECT role, content FROM chat_messages
       WHERE session_id = ?
       ORDER BY id DESC LIMIT 20`
    )
    .all(session_id) as { role: string; content: string }[];

  // Reverse to chronological order (the query returns newest first)
  const conversationHistory = historyRows.reverse().map((r) => ({
    role: r.role,
    content: r.content,
  }));

  // 8. Forward to FastAPI backend
  // The conversation history already includes the user message we just saved (step 6),
  // so we send it as-is. The backend appends `message` separately, so we must exclude
  // the latest user message from conversation_history to avoid duplication.
  const historyWithoutCurrent = conversationHistory.slice(0, -1);

  let fullResponse = "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const backendRes = await fetch("http://localhost:8766/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preferences_json: preferencesJson,
            message,
            conversation_history: historyWithoutCurrent,
            session_id,
            stream: true,
            page_context: page_context || null,
            memory_context: memoryContext,
          }),
        });

        if (!backendRes.ok || !backendRes.body) {
          const errText = `Atlas backend returned ${backendRes.status}`;
          controller.enqueue(encoder.encode(`data: {"error": "${errText}"}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const reader = backendRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE frames
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete frame in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            // Pass through to client
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            // Accumulate text (skip control messages and tool markers)
            if (
              data !== "[DONE]" &&
              !data.startsWith("[TOOL:") &&
              !data.startsWith('{"error"')
            ) {
              fullResponse += data;
            }
          }
        }

        // Process any remaining buffer
        if (buffer.startsWith("data: ")) {
          const data = buffer.slice(6).trim();
          if (data) {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            if (
              data !== "[DONE]" &&
              !data.startsWith("[TOOL:") &&
              !data.startsWith('{"error"')
            ) {
              fullResponse += data;
            }
          }
        }

        // Ensure [DONE] is sent
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        // FastAPI unreachable (ECONNREFUSED etc.)
        console.error("Atlas backend connection error:", err);
        controller.enqueue(
          encoder.encode(
            `data: {"error": "Atlas is taking a nap. Please try again in a moment."}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        // 9. Save assistant response (partial is better than nothing)
        try {
          if (fullResponse.trim()) {
            const db2 = getDb();
            db2.prepare(
              "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)"
            ).run(session_id, fullResponse.trim());
          }
        } catch (saveErr) {
          console.error("Failed to save assistant message:", saveErr);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
