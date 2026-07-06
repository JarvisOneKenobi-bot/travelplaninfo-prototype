import { describe, it, expect } from "vitest";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { trimHistoryToUserStart } from "./history";

describe("trimHistoryToUserStart", () => {
  it("drops a leading assistant message (LIMIT-20 window artifact)", () => {
    const history: MessageParam[] = [
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
    ];
    expect(trimHistoryToUserStart(history)).toEqual([
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
    ]);
  });

  it("returns user-led history unchanged", () => {
    const history: MessageParam[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
    ];
    expect(trimHistoryToUserStart(history)).toEqual(history);
  });

  it("returns [] when no user message exists", () => {
    expect(trimHistoryToUserStart([{ role: "assistant", content: "a1" }])).toEqual([]);
    expect(trimHistoryToUserStart([])).toEqual([]);
  });
});
