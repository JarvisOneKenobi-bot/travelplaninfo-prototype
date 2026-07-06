import { describe, it, expect } from "vitest";
import { buildAtlasSystemPrompt } from "./system-prompt";

describe("buildAtlasSystemPrompt", () => {
  it("includes the D3 no-fabrication rule for hotels/activities/restaurants", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });
    expect(prompt).toMatch(/never invent|do not invent|must not invent/i);
    expect(prompt.toLowerCase()).toContain("hotel");
    expect(prompt.toLowerCase()).toContain("restaurant");
  });

  it("includes a ready-to-paste markdown link to a real Hotels.com URL when a destination is identified", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });
    expect(prompt).toMatch(/\[[^\]]+\]\(https:\/\/www\.dpbolvw\.net[^)]+\)/); // CJ_LINKS.hotelsCity domain, markdown form
  });

  it("omits the partner link entirely when no destination can be identified (safe degrade)", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "General travel questions" });
    expect(prompt).not.toContain("dpbolvw.net");
  });

  it("includes the no-fabrication rule for empty flight data", () => {
    const prompt = buildAtlasSystemPrompt({});
    expect(prompt).toMatch(/no_data/);
  });

  it("does not mention Tiqets, Kiwi.com, or Kiwitaxi (not yet configured)", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });
    expect(prompt).not.toMatch(/tiqets/i);
    expect(prompt).not.toMatch(/kiwitaxi/i);
  });

  it("instructs Atlas to distinguish 'search could not run' from 'no flights exist'", () => {
    const prompt = buildAtlasSystemPrompt({});
    expect(prompt).toMatch(/temporarily unavailable/i);
    expect(prompt).toMatch(/does not mean there are no flights/i);
  });

  it("never emits partner links for a Surprise Me trip (safe degrade)", () => {
    const prompt = buildAtlasSystemPrompt({
      pageContext: "Trip planner.\n\nActive trip: Surprise Me, flexible to flexible, 2 adults, budget: mid",
    });
    expect(prompt).not.toContain("dpbolvw.net");
    expect(prompt).not.toMatch(/Search hotels in Surprise Me/i);
    expect(prompt).toContain("not identified from the page context");
  });
});
