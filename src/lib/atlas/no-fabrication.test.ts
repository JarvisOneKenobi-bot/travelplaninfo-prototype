import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const SURPRISE_PATH_FILES = [
  "src/app/api/surprise-me/route.ts",
  "src/components/SurpriseMeSection.tsx",
  "src/components/AtlasHeroSection.tsx",
  "src/components/DestinationCard.tsx",
  "src/lib/atlas/surprise-query.ts",
  "src/lib/atlas/surprise.ts",
  "src/lib/atlas/destination-vibes.ts",
];

const BANNED_SUBSTRINGS = [
  "$89",
  "$95",
  "$75",
  "$127",
  "$159",
  "$189",
  "/night",
  "hotelPrice",
  "Spirit NK",
  "JetBlue",
  "V1_FALLBACK",
  "FALLBACK",
];

describe("Surprise Me fabrication tripwire", () => {
  it.each(SURPRISE_PATH_FILES)("%s contains no banned Surprise Me fabricated literals", (file) => {
    const content = readFileSync(resolve(process.cwd(), file), "utf-8");

    for (const literal of BANNED_SUBSTRINGS) {
      expect(content, `${file} must not contain ${literal}`).not.toContain(literal);
    }
  });

  it("does not bake MIA origin substitution into the Surprise Me engine", () => {
    const file = "src/lib/atlas/surprise.ts";
    const content = readFileSync(resolve(process.cwd(), file), "utf-8");

    expect(content, `${file} must not contain MIA`).not.toContain("MIA");
  });

  it("delegates Surprise Me client query construction so flexible never reaches the API as a vibe", () => {
    const file = "src/components/SurpriseMeSection.tsx";
    const content = readFileSync(resolve(process.cwd(), file), "utf-8");

    // The flexible sentinel must never be reachable as a vibe param from the client.
    expect(content, `${file} must delegate Surprise Me query construction`).toContain("buildSurpriseQuery");
    expect(content, `${file} must not set a vibes param inline`).not.toMatch(/set\(\s*.vibes./);
    expect(content, `${file} must not construct query params inline`).not.toContain("new URLSearchParams");
  });
});
