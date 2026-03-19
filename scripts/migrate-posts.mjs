import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const postsPath = path.join(root, "src", "content", "posts.json");
const articlesDir = path.join(root, "content", "articles");

const posts = JSON.parse(fs.readFileSync(postsPath, "utf8"));

let count = 0;
for (const post of posts) {
  const article = {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    featuredImage: post.featuredImage ?? null,
    categories: post.categories ?? [],
    date: post.date,
    modified: post.modified,
    seo: post.seo,
    affiliateOpportunities: [],
  };
  const dest = path.join(articlesDir, `${post.slug}.json`);
  fs.writeFileSync(dest, JSON.stringify(article, null, 2) + "\n");
  count++;
}

console.log(`Migrated ${count} posts to content/articles/`);
