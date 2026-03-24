// Root article route stub — next-intl middleware rewrites /{slug}/ to [locale=en]/{slug}/
// so this route is never reached in production. It exists only to satisfy Next.js
// route resolution and must NOT have generateStaticParams (that causes duplicate SSG).
// The canonical page is at src/app/[locale]/[slug]/page.tsx.
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// No generateStaticParams — next-intl handles static generation via [locale]/[slug]
export default function RootSlugFallback() {
  // Middleware intercepts all requests before reaching this handler.
  // If somehow reached, return 404.
  notFound();
}
