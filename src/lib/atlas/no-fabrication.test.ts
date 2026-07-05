import { describe, expect, it } from "vitest";
import { TOOLS } from "./tool-loop";
import { buildAtlasSystemPrompt } from "./system-prompt";

describe("Atlas D3 no-fabrication guarantees", () => {
  it("exposes exactly the allowed real-data tools and no D3-forbidden inventory tools", () => {
    const toolNames = TOOLS.map((tool) => tool.name);

    expect(toolNames).toEqual(["search_flights", "get_deals", "get_article", "surprise_me"]);
    expect(toolNames).toHaveLength(4);
    expect(toolNames).not.toContain("search_hotels");
    expect(toolNames).not.toContain("search_activities");
    expect(toolNames).not.toContain("search_restaurants");
  });

  it("includes the explicit D3 prohibition text for hotels, activities, tours, and restaurants", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });

    expect(prompt).toMatch(/must not invent/i);
    expect(prompt).toMatch(/hotels?/i);
    expect(prompt).toMatch(/activities?/i);
    expect(prompt).toMatch(/restaurants?/i);
  });

  it("includes a well-formed markdown Hotels.com/CJ link when a destination is identified", () => {
    const prompt = buildAtlasSystemPrompt({ pageContext: "Active trip to Miami, Florida" });

    expect(prompt).toMatch(/\[[^\]]+\]\(https:\/\/www\.dpbolvw\.net[^)]+\)/);
  });
});
