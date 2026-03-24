// Root layout required by Next.js — actual layout is in [locale]/layout.tsx
// next-intl handles locale routing via middleware
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
