import { getAllArticles } from "@/lib/articles";
import type { Article } from "@/lib/articles";

export interface GetArticleToolResult {
  articles: {
    slug: string;
    title: string;
    excerpt: string;
    url: string;
  }[];
}

function relevanceRank(article: Article, query: string): number | null {
  const title = article.title.toLowerCase();
  const excerpt = article.excerpt.toLowerCase();
  const searchLocation = article.search_location?.toLowerCase() ?? "";

  if (title.includes(query)) return 0;
  if (excerpt.includes(query) || searchLocation.includes(query)) return 1;
  return null;
}

export function getArticleTool(query: string): GetArticleToolResult {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return { articles: [] };

  const articles = getAllArticles()
    .map((article) => ({ article, rank: relevanceRank(article, normalizedQuery) }))
    .filter((item): item is { article: Article; rank: number } => item.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map(({ article }) => ({
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      url: `/${article.slug}`,
    }));

  return { articles };
}
