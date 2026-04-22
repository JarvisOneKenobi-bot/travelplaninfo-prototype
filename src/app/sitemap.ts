import { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';
import { routing } from '@/i18n/routing';

const SITE_URL = 'https://travelplaninfo.com';

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
    routing.locales.map((locale) => ({
      url: localeUrl(path, locale),
      lastModified: now,
      changeFrequency,
      priority: locale === 'en' ? priority : priority * 0.9,
    }))
  );

  // Articles: emit one entry per locale with alternates.languages so search
  // engines cluster the translations together.
  const postUrls: MetadataRoute.Sitemap = getAllArticles().flatMap((post) => {
    const lastModified = new Date(post.modified || post.date);
    const languages = Object.fromEntries(
      routing.locales.map((loc) => [loc, localeUrl(`/${post.slug}/`, loc)])
    );
    return routing.locales.map((locale) => ({
      url: localeUrl(`/${post.slug}/`, locale),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: locale === 'en' ? 0.6 : 0.6 * 0.9,
      alternates: { languages },
    }));
  });

  return [...staticUrls, ...postUrls];
}
