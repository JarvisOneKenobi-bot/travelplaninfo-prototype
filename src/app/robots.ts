import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
      crawlDelay: 1,
    },
    sitemap: 'https://travelplaninfo.com/sitemap.xml',
  };
}
