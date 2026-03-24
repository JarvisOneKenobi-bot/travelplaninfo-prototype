// Root page stub — next-intl middleware rewrites / to [locale=en]/ before this is reached.
// This file must exist for Next.js App Router but the canonical page is [locale]/page.tsx.
export const dynamic = "force-dynamic";
export default function RootPage() {
  return null;
}
