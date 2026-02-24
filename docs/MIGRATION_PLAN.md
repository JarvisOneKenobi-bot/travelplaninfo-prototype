# TravelPlanInfo — WP → Next.js/Vercel Migration Plan
**Date:** 2026-02-23  
**Status:** Active — pipeline paused, prototype deployed at travelplaninfo-proto.vercel.app  
**Scope:** 29 published posts, 3 categories, flat URL structure `/{slug}/`

---

## Current State Snapshot

| Property | Value |
|----------|-------|
| WP post count | **29 published** |
| URL pattern | `https://travelplaninfo.com/{slug}/` (flat, no `/blog/` prefix) |
| Categories | Travel Destinations (21), Uncategorized (7), Travel Planning (2) |
| WP REST API | ✅ READ_OK (public, no auth needed) |
| SEO plugin | Squirrly |
| Prototype stack | Next.js 15.5.12 · React 19 · Tailwind v3 · TypeScript |
| Prototype pages | `/` (DesignA/B/C toggle), `/hot-deals` |
| Missing prototype pages | Dynamic `/{slug}`, `/destinations`, `/guides`, `/planner` |
| CMS client libs | ❌ None installed yet |
| Pipeline | ⏸ PAUSED — no new WP content until Vercel goes live |

---

## 1. Content Inventory Strategy

### Export Method: WP REST API (recommended over WXR/XML)

The WP REST API is already live and returning clean JSON at `https://travelplaninfo.com/wp-json/wp/v2`.  
Use it. Do not mess with WXR export files — they're fragile, encoding-buggy, and require a parser.

**Extraction script (run once, commit to repo):**
```bash
# Fetch all 29 posts in one shot (they fit in per_page=100)
curl "https://travelplaninfo.com/wp-json/wp/v2/posts?per_page=100&_fields=id,slug,title,content,excerpt,date,modified,categories,tags,yoast_head_json&status=publish" \
  > src/content/posts.json

# Fetch categories
curl "https://travelplaninfo.com/wp-json/wp/v2/categories?per_page=100&_fields=id,slug,name" \
  > src/content/categories.json
```

> **Note:** Squirrly SEO meta is not exposed in the default REST response. After export, manually audit titles/descriptions for the top 10 posts. The rest can use auto-generated meta from content.

### Format Recommendation: **JSON files in repo (Option A hybrid)**

**Verdict: Static JSON — not MDX, not headless WP.**

Reasoning:
- 29 posts is a tiny corpus. JSON files are trivial to manage.
- WP content is HTML rendered by Gutenberg/Classic Editor — it is **not** Markdown. Converting to MDX introduces HTML→MDX conversion bugs, encoding issues, and shortcode debris.
- Headless WP (keep WP as API) adds a runtime dependency: if WP host goes down mid-deploy, Vercel SSG fails. Unnecessary for 29 posts.
- JSON + `dangerouslySetInnerHTML` for the body HTML is the simplest, most faithful port of WP content.
- Content is frozen (pipeline paused), so staleness is not a concern.

**Post shape:**
```typescript
// src/content/types.ts
export interface WPPost {
  id: number;
  slug: string;
  title: string;        // rendered HTML (usually plain text)
  content: string;      // full rendered HTML body
  excerpt: string;      // rendered HTML excerpt
  date: string;         // ISO 8601
  modified: string;
  categoryIds: number[];
  seoTitle?: string;    // from Squirrly if available
  seoDescription?: string;
  ogImage?: string;     // featured image URL if present
}
```

### URL Slug Preservation

WP uses flat slugs: `travelplaninfo.com/{slug}/`  
Next.js target: `travelplaninfo.com/{slug}` (no trailing slash — or match with `trailingSlash: true` in next.config)

**Action:** Set `trailingSlash: true` in `next.config.ts` to match existing WP URLs exactly. This prevents 301s from `/slug` → `/slug/` that could dilute link equity.

---

## 2. Architecture Decision

### Option Comparison

| | Option A: Static JSON in Repo | Option B: Headless WP (API at runtime) | Option C: Lightweight CMS (Sanity/Contentlayer) |
|---|---|---|---|
| **Setup complexity** | Low | Low (API already works) | Medium–High |
| **Runtime dependency** | None | WP host must stay up | CMS service must stay up |
| **Build-time fetch** | Static at deploy | ISR or SSG (re-fetches WP) | Depends on provider |
| **Content updates** | Git push required | Publish in WP, auto-revalidates | Publish in CMS dashboard |
| **WP decommission path** | ✅ Clean — cut WP completely | ❌ WP must stay forever | ✅ WP not needed |
| **Cost** | $0 | WP hosting cost continues | Free tier limits |
| **SEO risk** | Low | Medium (ISR cache miss edge case) | Low |
| **Right for 29 posts?** | ✅ Yes | Overkill | Overkill |
| **Future content scale** | Needs Git workflow | Scales naturally | Scales naturally |

### **Recommendation: Option A — Static JSON in repo**

For 29 frozen posts, this is the only sensible choice. There is no active editorial workflow on this site. The goal is to decommission WP, not maintain it. Static JSON means:
- Zero runtime dependencies
- Free Vercel hobby tier is sufficient
- Full control over HTML sanitization
- WP can be shut down the day after cutover

**When to revisit:** If content volume grows past ~200 posts OR an editorial team starts adding content regularly, migrate to headless WP (keep current `wp_endpoint`) or Sanity free tier. That migration is straightforward since the data layer is already abstracted.

---

## 3. Migration Phases — Ordered Sprint Plan

### Phase 1: Content Export + Slug Audit
**Estimate: 2–3 hours | Do first, blocks everything else**

1. Run the REST API export script above. Save to `src/content/posts.json` and `src/content/categories.json`.
2. Run slug audit — confirm every WP slug maps 1:1 to the JSON:
   ```bash
   node -e "
   const posts = require('./src/content/posts.json');
   posts.forEach(p => console.log(p.slug));
   " | sort > /tmp/slug-audit.txt
   ```
3. Check for duplicate slugs, slugs with special chars, or slugs that changed between WP revisions.
4. Extract Squirrly SEO titles/descriptions: In WP admin → Squirrly SEO → export CSV, or manually note the top 10 posts' meta. Add `seoTitle` and `seoDescription` fields to JSON.
5. Download featured images: `curl` each post's featured media URL → save to `public/images/posts/`. Update JSON with local paths.
6. **Deliverable:** `src/content/posts.json` committed, slug list audited, image assets local.

---

### Phase 2: Next.js Dynamic Routing (`[slug]`)
**Estimate: 4–6 hours | Core engineering work**

**File to create:** `src/app/[slug]/page.tsx`

```typescript
// src/app/[slug]/page.tsx
import { notFound } from "next/navigation";
import posts from "@/content/posts.json";
import Header from "@/components/Header";
import type { Metadata } from "next";

// Statically generate all 29 slug pages at build time
export async function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt.replace(/<[^>]+>/g, "").slice(0, 160),
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || "",
      images: post.ogImage ? [{ url: post.ogImage }] : [],
    },
    alternates: { canonical: `https://travelplaninfo.com/${post.slug}/` },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 font-serif mb-4">{post.title}</h1>
        <p className="text-sm text-gray-400 mb-8">{new Date(post.date).toLocaleDateString()}</p>
        <article
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </main>
    </div>
  );
}
```

> The `@tailwindcss/typography` plugin is already in `package.json` — `prose` classes will style the WP HTML body correctly.

**Also create:**
- `src/app/[slug]/not-found.tsx` — graceful 404 for unknown slugs
- Category archive pages: `src/app/category/[slug]/page.tsx` (optional, Phase 2b)

---

### Phase 3: SEO Meta Tags
**Estimate: 2–3 hours | Parallel with Phase 2**

Next.js 15 uses the **Metadata API** (not `next/head` — that's legacy). The `generateMetadata` function in Phase 2 handles post pages. Also update:

**`src/app/layout.tsx` — global defaults:**
```typescript
export const metadata: Metadata = {
  metadataBase: new URL("https://travelplaninfo.com"),
  title: { default: "TravelPlanInfo", template: "%s | TravelPlanInfo" },
  description: "Expert travel planning guides, destination tips, and curated itineraries.",
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "TravelPlanInfo",
    type: "website",
  },
};
```

**`src/app/sitemap.ts` — auto-generated sitemap:**
```typescript
import posts from "@/content/posts.json";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const postEntries = posts.map((p) => ({
    url: `https://travelplaninfo.com/${p.slug}/`,
    lastModified: new Date(p.modified),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    { url: "https://travelplaninfo.com/", lastModified: new Date(), priority: 1.0 },
    { url: "https://travelplaninfo.com/hot-deals", lastModified: new Date(), priority: 0.9 },
    ...postEntries,
  ];
}
```
→ Auto-serves at `/sitemap.xml`. No plugin needed.

**`src/app/robots.ts`:**
```typescript
export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://travelplaninfo.com/sitemap.xml",
  };
}
```

---

### Phase 4: Redirect Map (WP URLs → Vercel)
**Estimate: 1–2 hours**

Since WP used `/{slug}/` and Next.js target also uses `/{slug}/` (with `trailingSlash: true`), **zero post-level redirects are needed** — the URL space is identical.

What *does* need redirects:

| WP path | Next.js path | Type |
|---------|-------------|------|
| `/wp-admin/` | → `https://[old-wp-host]/` | Block (robots) |
| `/category/worldwide-travel-destinations/` | `/destinations` (future) | 301 |
| `/category/travel-planning/` | `/guides` (future) | 301 |
| `/feed/` | 410 Gone | - |
| `/wp-login.php` | 410 Gone | - |

**`next.config.ts` redirects:**
```typescript
async redirects() {
  return [
    {
      source: "/category/worldwide-travel-destinations",
      destination: "/destinations",
      permanent: true,
    },
    {
      source: "/category/travel-planning",
      destination: "/guides",
      permanent: true,
    },
    { source: "/feed", destination: "/", permanent: false },
    { source: "/feed/", destination: "/", permanent: false },
  ];
},
```

**Trailing slash:** Set `trailingSlash: true` in `next.config.ts` — this ensures `/monaco/` works identically to WP's `/monaco/`.

---

### Phase 5: DNS Cutover Checklist
**Estimate: 30 min (excluding propagation wait)**

Pre-cutover (must be done while WP is still live):
- [ ] Vercel custom domain `travelplaninfo.com` added and SSL cert issued (takes ~5 min)
- [ ] `www.travelplaninfo.com` → same Vercel project
- [ ] All 29 post slugs tested on Vercel preview URL
- [ ] `sitemap.xml` returning 200 on Vercel
- [ ] `robots.txt` returning 200 on Vercel
- [ ] Core Web Vitals passing in Lighthouse (prototype target: LCP < 2.5s)
- [ ] Google Search Console property verified for `travelplaninfo-proto.vercel.app`

Cutover steps (do during low-traffic window — early morning EST):
1. In domain registrar (or Cloudflare): Change A/CNAME to Vercel's IPs
2. Verify propagation: `dig travelplaninfo.com +short` returns Vercel IP
3. Test live: `curl -I https://travelplaninfo.com/monaco/` → expect 200
4. Submit new sitemap in Google Search Console
5. Request re-crawl of homepage + top 5 posts

---

### Phase 6: WP Decommission
**Estimate: 1 hour — do 30 days post-cutover**

Wait 30 days after cutover to catch any edge cases in GSC/analytics.

1. Export full WXR backup from WP admin (insurance copy)
2. Export WP database: `mysqldump` → compress → store in `/home/jarvis/.openclaw/workspace/backups/`
3. Download all `/wp-content/uploads/` images (if not already in `public/images/`)
4. Cancel WP hosting plan
5. Update `sites.json`: set `auth_status: "DECOMMISSIONED"`, remove `pipeline_paused` flag
6. Update `MEMORY.md` and `session-recovery.md` with decommission date

---

## 4. SEO Protection Checklist

### Pre-launch (must complete before DNS cut)
- [ ] **301 redirects:** All category URLs redirect correctly (see Phase 4)
- [ ] **Trailing slash consistency:** `trailingSlash: true` in `next.config.ts` — matches WP's URL format exactly
- [ ] **Canonical tags:** Every post page includes `<link rel="canonical" href="https://travelplaninfo.com/{slug}/" />`
- [ ] **sitemap.xml:** Auto-generated via `src/app/sitemap.ts`, includes all 29 posts + homepage + hot-deals
- [ ] **robots.txt:** Allows all crawlers, points to sitemap
- [ ] **og:image:** Featured image URL populated in post JSON; fallback to site-level OG image for posts without one
- [ ] **og:title / og:description:** Per-post via `generateMetadata`
- [ ] **og:type:** `article` for post pages, `website` for homepage
- [ ] **Twitter card:** `card: "summary_large_image"` in metadata
- [ ] **Structured data (JSON-LD):** `Article` schema per post — add `<script type="application/ld+json">` in post page template

### Post-launch (within 48 hours)
- [ ] **Google Search Console:** Add `travelplaninfo.com` as new property (or confirm existing)
- [ ] **Submit new sitemap:** `https://travelplaninfo.com/sitemap.xml` in GSC
- [ ] **Request indexing** for homepage + top 10 posts manually via GSC URL inspection
- [ ] **Monitor coverage report** for 7 days — watch for unexpected 404s
- [ ] **Bing Webmaster Tools:** Submit sitemap (often forgotten, ~15% of search traffic)
- [ ] **Check internal links:** Any `travelplaninfo.com` URLs in post body content should remain valid

---

## 5. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | **WP HTML content breaks in Next.js** — shortcodes, WP-specific HTML classes, embedded iframes don't render correctly | Medium | High | Audit all 29 posts' `content` HTML before launch. Write a sanitization pass with `DOMParser` or `rehype` to strip `[shortcode]` debris and fix relative URLs. |
| 2 | **Image URLs break** — WP posts link to `travelplaninfo.com/wp-content/uploads/...` which 404s after WP goes down | High | High | Before Phase 6, download all referenced images to `public/images/posts/` and run a find-replace in `posts.json` to update URLs to local paths. Script: `grep -o 'https://travelplaninfo.com/wp-content/[^"]*' posts.json` |
| 3 | **Google ranking drop post-cutover** — Google re-evaluates the pages even with perfect 301s | Low–Medium | Medium | Do NOT change URL structure. Keep exact slugs. Submit sitemap immediately. Monitor GSC impressions daily for 2 weeks. Normal 10–20% temporary dip is expected; recover in 4–8 weeks. |
| 4 | **Trailing slash mismatch creates redirect loops** — `travelplaninfo.com/monaco` vs `/monaco/` | Medium | Medium | Set `trailingSlash: true` once and test all 29 slugs on Vercel preview before cutting DNS. Run `curl -I` on 5 representative URLs. |
| 5 | **Vercel cold start / Edge cache miss** — First visitor after deploy gets slow TTFB | Low | Low | All 29 pages are statically generated (`generateStaticParams`). Zero cold start risk. Vercel SSG = pre-rendered HTML at the CDN edge. |

---

## 6. Go-Live Criteria (DNS Cutover Gate)

All of the following must be `✅` before DNS is touched:

### Content
- [ ] All 29 post slugs return HTTP 200 on `travelplaninfo-proto.vercel.app/{slug}`
- [ ] Post content renders correctly (no raw `[shortcode]` text, no broken images)
- [ ] Homepage (`/`) loads with correct design variant (Design A is default)
- [ ] `/hot-deals` page loads correctly

### SEO
- [ ] `https://travelplaninfo-proto.vercel.app/sitemap.xml` returns valid XML with all 29 posts
- [ ] `https://travelplaninfo-proto.vercel.app/robots.txt` returns valid content
- [ ] `<link rel="canonical">` present on all post pages (verify with `curl | grep canonical`)
- [ ] `og:title`, `og:description`, `og:image` present on homepage and 3 test posts

### Performance
- [ ] Lighthouse Performance score ≥ 85 on homepage (mobile)
- [ ] Lighthouse SEO score = 100 on at least one post page
- [ ] LCP < 2.5s on homepage (mobile, 4G simulated)

### Infrastructure
- [ ] Vercel custom domain `travelplaninfo.com` added → SSL cert issued (green padlock)
- [ ] `www.travelplaninfo.com` redirects to apex (or vice versa — pick one, be consistent)
- [ ] `next.config.ts` has `trailingSlash: true`
- [ ] All category redirects tested (`/category/worldwide-travel-destinations` → 301)
- [ ] Google Search Console property exists for `travelplaninfo.com`

### Rollback Plan
- WP site stays **live and untouched** for 30 days post-cutover
- If something breaks: flip DNS back to WP in < 5 minutes (TTL should be set to 300s before cutover)
- Keep WP hosting paid through at least 2026-04-01

---

## Recommended Implementation Order (Week-by-Week)

```
Week 1 (Now)
├── Phase 1: Content export + slug audit                  [2–3 hrs]
├── Phase 2: [slug]/page.tsx dynamic routing              [4–6 hrs]
└── Phase 3: SEO metadata + sitemap + robots              [2–3 hrs]

Week 2
├── Phase 4: Redirect map in next.config.ts               [1–2 hrs]
├── Navigation wiring (Destinations, Guides, Planner)     [3–4 hrs]
├── Category archive pages /destinations, /guides         [3–4 hrs]
└── Full audit: all 29 posts visually verified            [2 hrs]

Week 3
├── Performance audit (Lighthouse)                        [1 hr]
├── Vercel custom domain + SSL                            [30 min]
├── Pre-cutover SEO checklist sign-off                    [1 hr]
└── Phase 5: DNS cutover                                  [30 min]

Week 4 (post-launch)
├── GSC monitoring — daily 15-min check                   [ongoing]
├── Fix any crawl errors surfaced in GSC                  [as needed]
└── Begin Phase 6: WP decommission planning               [after day 30]
```

**Total engineering time to go-live: ~20–25 hours**

---

## Quick Reference: Key Files to Create

```
src/
├── content/
│   ├── posts.json          ← Export from WP REST API (Phase 1)
│   └── categories.json     ← Export from WP REST API (Phase 1)
├── app/
│   ├── [slug]/
│   │   └── page.tsx        ← Dynamic post route (Phase 2)
│   ├── sitemap.ts          ← Auto-generated sitemap (Phase 3)
│   └── robots.ts           ← robots.txt (Phase 3)
└── components/
    └── PostLayout.tsx      ← Shared layout for post pages (Phase 2)

next.config.ts              ← trailingSlash: true + redirects (Phase 4)
```

---

*Plan authored by Jarvis strategic planning sub-agent · 2026-02-23*  
*WP REST API confirmed live at https://travelplaninfo.com/wp-json/wp/v2 (29 posts, READ_OK)*
