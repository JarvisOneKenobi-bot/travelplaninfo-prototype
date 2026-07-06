import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";

// In-memory DB — never touches the real data/tpi.db. Mirrors the
// assistant_cost schema added to src/lib/db.ts in this task.
let memDb: Database.Database;
vi.mock("@/lib/db", () => ({
  getDb: () => memDb,
}));

import { recordAssistantSpend, getAssistantMonthlySpendUsd, ASSISTANT_SPEND_CAP_USD, isSpendCapReached } from "./spend";

describe("assistant spend tracking", () => {
  beforeEach(() => {
    memDb = new Database(":memory:");
    memDb.exec(`
      CREATE TABLE assistant_cost (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        model TEXT NOT NULL,
        usd REAL NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(date, model)
      );
    `);
  });

  it("records spend and computes cost from token usage", () => {
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    const spend = getAssistantMonthlySpendUsd();
    // 1M input tokens @ $2/MTok + 1M output tokens @ $10/MTok = $12.00
    expect(spend).toBeCloseTo(12.0, 5);
  });

  it("accumulates multiple calls into the same day's row", () => {
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 500_000, outputTokens: 0 });
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 500_000, outputTokens: 0 });
    expect(getAssistantMonthlySpendUsd()).toBeCloseTo(2.0, 5);
  });

  it("exposes the spend cap constant", () => {
    expect(typeof ASSISTANT_SPEND_CAP_USD).toBe("number");
    expect(ASSISTANT_SPEND_CAP_USD).toBeGreaterThan(0);
  });

  it("prices claude-sonnet-4-6 at its own rate, not Sonnet 5's", () => {
    recordAssistantSpend("claude-sonnet-4-6", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // $3/MTok in + $15/MTok out = $18.00
    expect(getAssistantMonthlySpendUsd()).toBeCloseTo(18.0, 5);
  });

  it("prices unknown models at the most expensive known rate and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    recordAssistantSpend("claude-future-9", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(getAssistantMonthlySpendUsd()).toBeCloseTo(18.0, 5);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("exposes isSpendCapReached against the cap constant", () => {
    expect(isSpendCapReached()).toBe(false);
    recordAssistantSpend("claude-sonnet-5", { inputTokens: 0, outputTokens: 1_100_000 }); // $11 > $10
    expect(isSpendCapReached()).toBe(true);
  });
});
