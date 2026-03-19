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
  };
  affiliateOpportunities: string[];
}

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

export function getAllArticles(): Article[] {
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith(".json"));
  const articles = files.map(f => {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    return JSON.parse(raw) as Article;
  });
  return articles.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getArticle(slug: string): Article | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as Article;
}
