import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

// The Anthropic Messages API requires the first message to be role "user".
// The chat route's ORDER BY id DESC LIMIT 20 window can start on an
// assistant row once a session exceeds ~10 exchanges — trim to the first
// user turn so the request never 400s.
export function trimHistoryToUserStart(history: MessageParam[]): MessageParam[] {
  const firstUser = history.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : history.slice(firstUser);
}
