#!/usr/bin/env node
/**
 * TravelPlanInfo WP → Vercel Export Script
 * Fetches all posts from WP REST API, strips Elementor markup,
 * downloads images, and produces src/content/posts.json
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { createWriteStream } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "src", "content");
const IMG_DIR = join(ROOT, "public", "images", "posts");
const WP_BASE = "https://travelplaninfo.com/wp-json/wp/v2";

mkdirSync(CONTENT_DIR, { recursive: true });
mkdirSync(IMG_DIR, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "TPI-Export/1.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)); }
      });
    }).on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (existsSync(destPath)) { resolve(destPath); return; }
    const proto = url.startsWith("https") ? https : http;
    const file = createWriteStream(destPath);
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(destPath); });
    }).on("error", (err) => {
      file.close();
      reject(err);
    });
  });
}

// Strip Elementor wrapper divs — keep semantic HTML only
function stripElementor(html) {
  if (!html) return "";

  // Remove Elementor section/column/widget wrappers but keep inner content
  let clean = html
    // Remove elementor section/container/column divs (keep content)
    .replace(/<(section|div)[^>]*class="[^"]*elementor[^"]*"[^>]*>/gi, "")
    .replace(/<\/(section|div)>/gi, "")
    // Remove empty paragraphs and excess whitespace
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    // Clean up wp:image figure wrappers — keep the img tag
    .replace(/<figure[^>]*class="[^"]*wp-block-image[^"]*"[^>]*>/gi, "")
    .replace(/<\/figure>/gi, "")
    // Remove style/script tags
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Normalize headings from elementor-heading-title
    .replace(/<h([1-6])[^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>/gi, "<h$1>")
    // Clean excessive whitespace
    .replace(/\s{2,}/g, " ")
    .trim();

  return clean;
}

// Extract image URLs from HTML content
function extractImageUrls(html) {
  const urls = [];
  const re = /src="(https?:\/\/travelplaninfo\.com\/wp-content\/uploads\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    urls.push(m[1]);
  }
  return [...new Set(urls)];
}

// Convert absolute WP image URLs to local /images/posts/ paths
function localizeImageUrls(html, urlMap) {
  let out = html;
  for (const [orig, local] of Object.entries(urlMap)) {
    out = out.split(orig).join(local);
  }
  return out;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📡 Fetching posts from WP REST API...");

  // Fetch all posts with pagination
  let allPosts = [];
  let page = 1;
  while (true) {
    const url = `${WP_BASE}/posts?per_page=100&page=${page}&_fields=id,slug,title,excerpt,content,date,modified,categories,tags,featured_media,yoast_head_json`;
    const posts = await fetchJson(url);
    if (!Array.isArray(posts) || posts.length === 0) break;
    allPosts = allPosts.concat(posts);
    if (posts.length < 100) break;
    page++;
  }
  console.log(`✅ Fetched ${allPosts.length} posts`);

  // Fetch categories map
  const cats = await fetchJson(`${WP_BASE}/categories?per_page=100&_fields=id,slug,name`);
  const catMap = Object.fromEntries(cats.map((c) => [c.id, { slug: c.slug, name: c.name }]));

  // Fetch featured media URLs
  const mediaIds = [...new Set(allPosts.map((p) => p.featured_media).filter(Boolean))];
  console.log(`🖼  Fetching ${mediaIds.length} featured media items...`);
  const mediaMap = {};
  for (const id of mediaIds) {
    try {
      const media = await fetchJson(`${WP_BASE}/media/${id}?_fields=id,source_url,media_details`);
      mediaMap[id] = {
        original: media.source_url,
        medium: media.media_details?.sizes?.medium?.source_url || media.source_url,
        large: media.media_details?.sizes?.large?.source_url || media.source_url,
      };
    } catch (e) {
      console.warn(`  ⚠️  Media ${id} failed: ${e.message}`);
    }
  }

  // Process posts
  console.log("🔧 Processing posts...");
  const urlMap = {}; // original WP URL → local path

  // Collect all image URLs first
  for (const post of allPosts) {
    const content = post.content?.rendered || "";
    const imgUrls = extractImageUrls(content);
    for (const url of imgUrls) {
      if (!urlMap[url]) {
        const filename = url.split("/").pop();
        urlMap[url] = `/images/posts/${filename}`;
      }
    }
    // Add featured media
    if (post.featured_media && mediaMap[post.featured_media]) {
      const fm = mediaMap[post.featured_media];
      for (const [key, src] of Object.entries(fm)) {
        if (src && !urlMap[src]) {
          const filename = src.split("/").pop();
          urlMap[src] = `/images/posts/${filename}`;
        }
      }
    }
  }

  // Download all images
  console.log(`⬇️  Downloading ${Object.keys(urlMap).length} images...`);
  let dlOk = 0, dlFail = 0;
  for (const [origUrl, localPath] of Object.entries(urlMap)) {
    const dest = join(ROOT, "public", localPath);
    try {
      await downloadFile(origUrl, dest);
      dlOk++;
    } catch (e) {
      console.warn(`  ⚠️  Failed ${origUrl}: ${e.message}`);
      dlFail++;
    }
  }
  console.log(`  ✅ ${dlOk} downloaded, ⚠️  ${dlFail} failed`);

  // Build final JSON
  const output = allPosts.map((post) => {
    const rawContent = post.content?.rendered || "";
    const cleanContent = localizeImageUrls(stripElementor(rawContent), urlMap);
    const rawExcerpt = post.excerpt?.rendered || "";
    const cleanExcerpt = rawExcerpt.replace(/<[^>]+>/g, "").trim();

    const yoast = post.yoast_head_json || {};
    const featuredMedia = post.featured_media && mediaMap[post.featured_media]
      ? localizeImageUrls(mediaMap[post.featured_media].large || mediaMap[post.featured_media].original, urlMap)
      : null;

    return {
      id: post.id,
      slug: post.slug,
      title: post.title?.rendered || "",
      excerpt: cleanExcerpt,
      content: cleanContent,
      date: post.date,
      modified: post.modified,
      categories: (post.categories || []).map((id) => catMap[id] || { id }),
      featuredImage: featuredMedia,
      seo: {
        title: yoast.title || post.title?.rendered || "",
        description: yoast.description || cleanExcerpt,
        ogImage: yoast.og_image?.[0]?.url
          ? localizeImageUrls(yoast.og_image[0].url, urlMap)
          : featuredMedia,
        canonical: `https://travelplaninfo.com/${post.slug}/`,
      },
    };
  });

  // Sort by date desc
  output.sort((a, b) => new Date(b.date) - new Date(a.date));

  const outPath = join(CONTENT_DIR, "posts.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Exported ${output.length} posts → ${outPath}`);
  console.log(`\n📋 Slugs:`);
  output.forEach((p) => console.log(`   /${p.slug}/  [${p.categories.map((c) => c.name).join(", ")}]`));
}

main().catch((e) => { console.error("❌ Export failed:", e); process.exit(1); });
