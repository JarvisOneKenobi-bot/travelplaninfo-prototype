import fs from "fs";
import path from "path";

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featuredImage: string | null;
  categories: { name: string; slug: string }[];
  date: string;
  modified: string;
  seo: {
    title: string;
    description: string;
    canonical?: string;
    ogImage?: string;
  };
  affiliateOpportunities: string[];
  search_location?: string;
  faq?: { question: string; answer: string }[];
  schemaType?: "hotel_review" | "destination_guide" | "how_to" | "comparison";
}

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

export function getAllArticles(): Article[] {
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".json"));
  const articles: Article[] = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
      articles.push(JSON.parse(raw) as Article);
    } catch {
      console.error(`[articles] Skipping malformed file: ${f}`);
    }
  }
  return articles.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getArticle(slug: string): Article | null {
  // Sanitize slug to prevent path traversal (C1)
  const resolved = path.resolve(ARTICLES_DIR, `${slug}.json`);
  if (!resolved.startsWith(ARTICLES_DIR + path.sep)) return null;

  if (!fs.existsSync(resolved)) return null;
  try {
    const raw = fs.readFileSync(resolved, "utf8");
    return JSON.parse(raw) as Article;
  } catch {
    return null;
  }
}
