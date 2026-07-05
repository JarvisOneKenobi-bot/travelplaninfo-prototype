# SEO Migration Strategy

Status: Canonical SEO/content-surface strategy for TPI and for future WordPress-to-Next.js migrations based on TPI.

Sources: Fable 5 diagnosis section 8, D5, D6, D10, and current files `src/app/sitemap.ts`, `src/i18n/routing.ts`, `src/app/[locale]/[slug]/page.tsx`, `src/lib/articles.ts`.

## Current index surface inventory

Current locale setup:
- Locales: `en`, `es`, `pt`, `fr`, `de`, `it` (`src/i18n/routing.ts:3-7`).
- `localePrefix: "as-needed"`, so English paths are unprefixed and non-English paths are prefixed.

Current sitemap behavior:
- Static URLs: 7 static paths x 6 locales = 42 URLs (`src/app/sitemap.ts:12-33`).
- Article URLs: 59 articles x 6 locales = 354 URLs (`src/app/sitemap.ts:35-49`, diagnosis counted the 59-article corpus).
- Approximate total: 396 sitemap URLs for about 60 pages of unique article content.

Current article behavior:
- `getArticle(slug)` ignores locale and returns the same JSON body for every locale (`src/lib/articles.ts:43-55`).
- Article metadata currently self-canonicalizes non-English pages to their own localized URL (`src/app/[locale]/[slug]/page.tsx:61-88`).
- Sitemap alternates cluster all locales but has no `x-default` (`src/app/sitemap.ts:39-48`).

Risk: 295 non-English article URLs serve byte-identical English bodies. This is duplicate-content dilution unless canonicalized to English.

## Locale policy decision

D5 is settled:
- Non-English article URLs stay live and crawlable.
- Non-English article URLs canonicalize to the English original.
- Do not 404, drop, or noindex them now.
- This is reversible if a real translation pipeline produces localized article bodies later.

Implementation rule:
- For any article with locale != `en`, `alternates.canonical` must be `https://travelplaninfo.com/{slug}/`.
- English article canonical remains `post.seo.canonical` when present, otherwise the English URL.
- Hreflang may still list locale variants, but canonical tells search engines the English original is the preferred URL.
- Add `x-default` to the English URL in hreflang clusters when implementation touches metadata/sitemap.

## Template metadata matrix

| Template | Indexable? | Canonical | Hreflang | Schema | Notes |
|---|---:|---|---|---|---|
| Homepage `/` and locale homepages | Yes | Locale-specific homepage | Yes + x-default | WebSite/Organization when implemented | English-first; localized UI only until real localized copy exists. |
| Guides hub `/guides/` | Yes | Locale-specific hub | Yes + x-default | CollectionPage/Breadcrumb when implemented | Needs real metadata; currently part of static sitemap. |
| Destination hub `/destinations/` | Yes | Locale-specific hub | Yes + x-default | CollectionPage when implemented | Diagnosis flagged non-article templates as SEO-naked. |
| Hot deals `/hot-deals/` | Yes | Locale-specific hub | Yes + x-default | OfferCatalog or CollectionPage if supported | Must ensure affiliate links use `rel="sponsored"`. |
| Planner landing `/planner/` | Yes | Locale-specific planner landing | Yes + x-default | WebPage | Single indexable planner landing page. |
| Trip detail `/planner/[tripId]` | No | None or self for UX only | No | None | Per-user surface; must be noindex and absent from sitemap. |
| Auth pages `/signin/`, `/register/`, account/preferences | No | None or self for UX only | No | None | Must add noindex; diagnosis found no `noindex` in `src/`. |
| Article English `/{slug}/` | Yes | English URL | Yes + x-default | Article + FAQ + Breadcrumb; later schemaType-aware | Revenue content floor. |
| Article non-English `/{locale}/{slug}/` | Crawlable but not canonical | English article URL | Yes | Same content for now | D5 canonicalizes to English until translations exist. |
| Terms/privacy | Yes, low priority | Locale-specific | Optional | None | Static legal pages. |

Acceptance: a crawl of the fixed production site must match this matrix.

## Schema plan

Current state:
- Article template hardcodes `@type: "Article"` (`src/app/[locale]/[slug]/page.tsx:110-124`).
- FAQ schema renders when `faq` exists (`src/app/[locale]/[slug]/page.tsx:136-164`).
- `schemaType` exists in the TypeScript interface (`src/lib/articles.ts:21-22`) and appears in sample articles as `destination_guide`, but is not currently wired.

Decision from D6: because TPI is the reference implementation, fix the content model properly rather than deleting useful fields.

Implementation direction:
- Keep `schemaType` in the article contract.
- Map supported values to rendered schema enhancements:
  - `destination_guide`: Article plus destination/travel guide contextual fields when safe.
  - `how_to`: HowTo only if the article body actually has ordered steps.
  - `comparison`: Article plus ItemList only if the content has explicit compared entities.
  - `hotel_review`: Do not emit Review schema unless the article contains first-party review criteria and ratings that meet Google guidelines.
- Do not emit schema that claims facts the JSON/content does not support.

## Internal-linking policy

Guide -> planner:
- Every destination guide should offer a clear planner CTA that passes destination/search context where available.
- `search_location` should feed CTA destination/search context instead of falling back to `categories[0].name` forever (`src/app/[locale]/[slug]/page.tsx:218-222`). See `CONTENT_MODEL.md`.

Planner -> guides:
- Atlas may recommend relevant TPI articles via `get_article`, but must not use article search as a substitute for live destination/flight data.
- Planner/sidebar links should use the same D7 affiliate partner set as articles.

Guide clusters:
- Related guide links should prioritize topical relevance and conversion path, not raw recency.
- Future migration sites should inherit the matrix and validation rules, not the current duplicate-locale defect.

## Affiliate SEO/compliance hygiene

- Affiliate links should use `rel="sponsored"` where applicable.
- Diagnosis flagged Aviasales links without `rel="sponsored"` on destination surfaces while CJ links had it. Fix as Phase 3/4 cleanup.
- Affiliate URLs must come from `src/config/affiliates.ts` or its successor metadata wrapper after D7; no scattered hardcoded program truth.

## What gets generalized to other sites

Because D6 confirms TPI as the reference implementation, future WP-to-Next migrations should inherit:
- JSON article sidecar contract after `CONTENT_MODEL.md` validation is enforced.
- Locale/canonical matrix from this doc.
- Sitemap generation strategy that avoids multiplying untranslated content.
- Schema rendering rules tied to validated fields.
- Production verification gates from `VERIFICATION_CHECKLIST.md`.
- Env-preflight and deploy discipline from `ARCHITECTURE.md`.

What stays TPI-specific:
- Atlas as a travel-planning assistant.
- Travelpayouts/Aviasales flight tooling.
- TPI's exact affiliate partner mix and planner paths.
- Travel-specific schema choices.

## GSC and analytics timing

D10 explicitly deviates from the diagnosis roadmap: GSC and lightweight analytics start now alongside Phase 0-3 work, not later in Phase 4.

Minimum Phase 1/2 measurement setup:
- GSC property/verification documented.
- Sitemap submitted or resubmitted after canonical changes.
- Lightweight event tracking plan for guide -> planner starts, trip creation, Atlas health-hidden impressions, Atlas search consent, tool result rendered, and affiliate click.
- Server-side affiliate-click-per-trip-session remains the MVP metric even if a client analytics layer is added.

## Acceptance checks

A crawl of the fixed site must verify:
- Non-English article pages canonicalize to the English original.
- English article pages canonicalize to English.
- Sitemap URL counts reconcile to the matrix.
- Auth/account/trip detail pages are noindex and absent from the sitemap.
- Hub pages have canonical metadata.
- FAQ schema remains valid on article pages that carry `faq`.
- No fabricated or schema-unsupported structured data is emitted.
