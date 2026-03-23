import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

// ── Anthropic client (reads credentials from disk) ──────────────────────────

function getAnthropicClient(): Anthropic {
  const credsPath = path.join(
    process.env.HOME || "",
    ".openclaw/credentials/anthropic.json"
  );
  const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
  return new Anthropic({ apiKey: creds.api_key });
}

// ── POST handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  // 2. Parse body
  let body: { session_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { session_id } = body;
  if (!session_id) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    );
  }

  // 3. Validate session belongs to user
  const db = getDb();
  const chatSession = db
    .prepare(
      "SELECT id, created_at FROM chat_sessions WHERE id = ? AND user_id = ?"
    )
    .get(session_id, userId) as
    | { id: string; created_at: string }
    | undefined;

  if (!chatSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // 4. Check if already summarized for this session date
  const sessionDate = chatSession.created_at.slice(0, 10); // YYYY-MM-DD
  const summaryKey = `conversation_summary_${sessionDate}`;

  const existingSummary = db
    .prepare(
      "SELECT id FROM user_memory WHERE user_id = ? AND key = ?"
    )
    .get(userId, summaryKey) as { id: number } | undefined;

  if (existingSummary) {
    return NextResponse.json({
      ok: true,
      memories_saved: 0,
      message: "Session already summarized",
    });
  }

  // 5. Load messages from that session (up to 20)
  const messages = db
    .prepare(
      `SELECT role, content FROM chat_messages
       WHERE session_id = ?
       ORDER BY id ASC
       LIMIT 20`
    )
    .all(session_id) as { role: string; content: string }[];

  if (messages.length < 6) {
    return NextResponse.json({
      ok: true,
      memories_saved: 0,
      message: "Not enough messages to summarize",
    });
  }

  // 6. Call Anthropic claude-sonnet-4-6 to extract key facts
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const anthropic = getAnthropicClient();

  let completion: Anthropic.Message;
  try {
    completion = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Extract key facts, preferences, and decisions from this travel planning conversation as key-value pairs. Focus on: destinations searched, price sensitivity, airline preferences, travel dates, group size, and any explicit preferences stated. Return a JSON array of objects: [{"key": "string", "value": "string"}]. Only return the JSON array, no other text.\n\nConversation:\n${conversationText}`,
        },
      ],
    });
  } catch (err) {
    console.error("Anthropic summarization failed:", err);
    return NextResponse.json(
      { error: "Summarization failed" },
      { status: 502 }
    );
  }

  // 7. Parse response into key-value pairs
  const responseText =
    completion.content[0].type === "text" ? completion.content[0].text : "";

  let kvPairs: Array<{ key: string; value: string }>;
  try {
    // Handle potential markdown code fences around JSON
    const cleaned = responseText
      .replace(/^```json?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    kvPairs = JSON.parse(cleaned);
    if (!Array.isArray(kvPairs)) {
      throw new Error("Response is not an array");
    }
  } catch (parseErr) {
    console.error(
      "Failed to parse summarization response:",
      responseText,
      parseErr
    );
    // Fallback: save the raw text as a single summary entry
    kvPairs = [{ key: summaryKey, value: responseText.slice(0, 500) }];
  }

  // 8. Upsert into user_memory
  const upsert = db.prepare(
    `INSERT INTO user_memory (user_id, key, value, source)
     VALUES (?, ?, ?, 'summarizer')
     ON CONFLICT(user_id, key) DO UPDATE SET
       value      = excluded.value,
       source     = excluded.source,
       updated_at = datetime('now')`
  );

  const upsertMany = db.transaction(
    (rows: Array<{ key: string; value: string }>) => {
      for (const row of rows) {
        if (row.key && row.value) {
          upsert.run(userId, row.key, row.value);
        }
      }
      // Also save the overall summary marker so we don't re-summarize
      if (!rows.some((r) => r.key === summaryKey)) {
        const summaryValue = rows
          .map((r) => `${r.key}: ${r.value}`)
          .join("; ");
        upsert.run(userId, summaryKey, summaryValue);
      }
    }
  );

  upsertMany(kvPairs);

  // Count what we actually saved (kvPairs + possibly the summary marker)
  const hasSummaryKey = kvPairs.some((r) => r.key === summaryKey);
  const memoriesSaved = kvPairs.filter((r) => r.key && r.value).length +
    (hasSummaryKey ? 0 : 1);

  // 9. Record cost via FastAPI
  try {
    const inputTokens = completion.usage?.input_tokens ?? 0;
    const outputTokens = completion.usage?.output_tokens ?? 0;

    await fetch("http://localhost:8766/api/assistant/record-spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      }),
    });
  } catch (costErr) {
    // Non-fatal: log but don't fail the response
    console.error("Failed to record summarization cost:", costErr);
  }

  return NextResponse.json({ ok: true, memories_saved: memoriesSaved });
}
