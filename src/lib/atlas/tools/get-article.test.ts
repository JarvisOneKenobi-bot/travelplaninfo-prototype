import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/articles", () => ({
  getAllArticles: () => [
    { slug: "miami-airport-transfers", title: "Miami Airport Transfers Guide", excerpt: "Getting from MIA to downtown", search_location: "Miami" },
    { slug: "cancun-resorts", title: "Best Cancun Resorts", excerpt: "Top all-inclusive picks", search_location: "Cancun" },
  ],
}));

import { getArticleTool } from "./get-article";

describe("getArticleTool", () => {
  it("matches articles by destination", () => {
    const result = getArticleTool("Miami");
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.articles[0].slug).toBe("miami-airport-transfers");
  });

  it("returns an empty array for no matches, never fabricates an article", () => {
    const result = getArticleTool("Antarctica");
    expect(result.articles).toEqual([]);
  });
});
