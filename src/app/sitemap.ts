import { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';

const SITE_URL = 'https://travelplaninfo.com';
const LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'it'] as const;

function localeUrl(path: string, locale: string): string {
  if (locale === 'en') return `${SITE_URL}${path}`;
  return `${SITE_URL}/${locale}${path}`;
}

const STATIC_PAGES = [
  { path: '/', changeFrequency: 'daily' as const, priority: 1 },
  { path: '/destinations/', changeFrequency: 'weekly' as const, priority: 0.9 },
  { path: '/hot-deals/', changeFrequency: 'daily' as const, priority: 0.9 },
  { path: '/guides/', changeFrequency: 'weekly' as const, priority: 0.8 },
  { path: '/planner/', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/terms/', changeFrequency: 'yearly' as const, priority: 0.3 },
  { path: '/privacy/', changeFrequency: 'yearly' as const, priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Generate locale-aware static URLs (en is canonical, others get locale prefix)
  const staticUrls: MetadataRoute.Sitemap = STATIC_PAGES.flatMap(({ path, changeFrequency, priority }) =>
    LOCALES.map((locale) => ({
      url: localeUrl(path, locale),
      lastModified: now,
      changeFrequency,
      priority: locale === 'en' ? priority : priority * 0.9,
    }))
  );

  // Articles are English-only for now (at root level, no locale prefix)
  const postUrls: MetadataRoute.Sitemap = getAllArticles().map((post) => ({
    url: `${SITE_URL}/${post.slug}/`,
    lastModified: new Date(post.modified || post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticUrls, ...postUrls];
}
