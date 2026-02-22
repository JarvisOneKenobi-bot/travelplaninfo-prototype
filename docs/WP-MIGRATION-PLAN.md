# WordPress to Next.js Migration Plan

## Overview
This document outlines the migration strategy from WordPress to Next.js for TravelPlanInfo.com.

## Migration Strategy

### 1. Content Export
- Use WordPress REST API or GraphQL (WPGraphQL) to export all content
- Export posts, pages, categories, tags, and media
- Generate mapping table of old URLs to new URLs

### 2. URL Structure Mapping
| WordPress Pattern | Next.js Pattern |
|-------------------|-----------------|
| `/category/travel/` | `/blog?category=travel` |
| `/tag/miami/` | `/blog?tag=miami` |
| `/2024/01/post-name/` | `/blog/post-name` |
| `/destinations/miami/` | `/destinations/miami` |
| `/about/` | `/about` |

### 3. 301 Redirect Strategy
**Option A: next.config.ts redirects**
```typescript
async redirects() {
  return [
    {
      source: '/:year/:month/:slug',
      destination: '/blog/:slug',
      permanent: true,
    },
  ];
}
```

**Option B: Vercel.json**
```json
{
  "redirects": [
    { "source": "/:year/:month/:slug", "destination": "/blog/:slug", "statusCode": 301 }
  ]
}
```

### 4. SEO Preservation
- Export Yoast/RankMath meta fields
- Map to Next.js metadata API
- Preserve OpenGraph images
- Transfer sitemaps

### 5. Media Migration
- Download all images from WP media library
- Upload to Vercel Blob or Cloudinary
- Update image URLs in content

### 6. Headless WP Setup (Optional)
Keep WordPress as CMS, fetch via API:
- WP REST API: `https://travelplaninfo.com/wp-json/wp/v2/posts`
- Or WPGraphQL for more flexible queries

## Rollout Plan

### Phase 1: Development (Current)
- [x] Prototype with mock data
- [x] 3 design versions (A/B/C toggle)
- [x] SEO components
- [ ] Connect to WP API

### Phase 2: Content Migration
- [ ] Export WP content
- [ ] Transform to MDX or JSON
- [ ] Import to Next.js
- [ ] Generate 301 map

### Phase 3: Staging
- [ ] Deploy to Vercel preview
- [ ] Test all redirects
- [ ] Verify SEO metadata

### Phase 4: Production
- [ ] Point domain to Vercel
- [ ] Enable all 301 redirects
- [ ] Monitor 404s
- [ ] Keep WP for 30 days, then archive

## SEO Checklist
- [ ] Title tags preserved
- [ ] Meta descriptions preserved
- [ ] OpenGraph tags configured
- [ ] JSON-LD structured data
- [ ] Sitemap.xml generated
- [ ] Robots.txt configured
- [ ] Canonical URLs set
- [ ] All images have alt text
