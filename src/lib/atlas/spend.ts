import { getDb } from "@/lib/db";

// Introductory Sonnet 5 pricing through 2026-08-31. After that date, revert
// to standard pricing: input $3.00/MTok, output $15.00/MTok.
export const SONNET5_PRICE_PER_MTOK = { input: 2.0, output: 10.0 };

export const ASSISTANT_SPEND_CAP_USD = 10.0; // must match command-post/routers/assistant.py's ASSISTANT_SPEND_CAP

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordAssistantSpend(
  model: string,
  usage: { inputTokens: number; outputTokens: number }
): void {
  const usd =
    (usage.inputTokens / 1_000_000) * SONNET5_PRICE_PER_MTOK.input +
    (usage.outputTokens / 1_000_000) * SONNET5_PRICE_PER_MTOK.output;
  const date = todayUtc();
  const db = getDb();
  db.prepare(
    `INSERT INTO assistant_cost (date, model, usd, input_tokens, output_tokens)
     VALUES (@date, @model, @usd, @inputTokens, @outputTokens)
     ON CONFLICT(date, model) DO UPDATE SET
       usd = usd + excluded.usd,
       input_tokens = input_tokens + excluded.input_tokens,
       output_tokens = output_tokens + excluded.output_tokens`
  ).run({ date, model, usd, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
}

export function getAssistantMonthlySpendUsd(): number {
  const monthPrefix = todayUtc().slice(0, 7); // YYYY-MM
  const row = getDb()
    .prepare(`SELECT COALESCE(SUM(usd), 0) AS total FROM assistant_cost WHERE date LIKE @pattern`)
    .get({ pattern: `${monthPrefix}%` }) as { total: number };
  return row.total;
}