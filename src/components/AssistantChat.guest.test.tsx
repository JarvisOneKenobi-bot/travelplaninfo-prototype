// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readGuestPrefs, writeGuestPrefs } from "@/lib/guest-prefs";

// The body-builder contract: when guest prefs exist, include them; else omit.
function buildBody(message: string, sid: string, pageContext: string) {
  const gp = readGuestPrefs();
  return { message, session_id: sid, page_context: pageContext, ...(gp ? { guest_prefs: gp } : {}) };
}

describe("chat POST body includes guest_prefs when present", () => {
  beforeEach(() => localStorage.clear());
  it("omits guest_prefs when none stored", () => {
    expect(buildBody("hi", "s1", "ctx")).not.toHaveProperty("guest_prefs");
  });
  it("includes validated guest_prefs when stored", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    expect(buildBody("hi", "s1", "ctx").guest_prefs).toEqual({ homeAirport: "MIA", interests: ["beach"] });
  });
});
