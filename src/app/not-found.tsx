import Link from "next/link";
import Image from "next/image";
// Root-level not-found — rendered outside [locale]/layout.tsx so cannot use Header
// (Header requires SessionProvider and NextIntlClientProvider).
// Use static import of English messages as fallback since next-intl hooks are unavailable.
import enMessages from "../../messages/en/common.json";

const nf = enMessages.notFound;

export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        {/* Minimal static header — no auth hooks */}
        <header className="sticky top-0 z-50 backdrop-blur border-b border-gray-100" style={{ backgroundColor: "rgba(178, 107, 32, 0.7)" }}>
          <div className="w-full px-6 lg:px-12 h-16 flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.webp"
                alt="TravelPlanInfo"
                width={400}
                height={400}
                style={{ height: "15rem", width: "auto", paddingTop: "15px" }}
                priority
              />
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-24 text-center">
          <p className="text-6xl mb-6">🗺️</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{nf.title}</h1>
          <p className="text-lg text-gray-600 mb-8">
            {nf.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="bg-teal-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors"
            >
              {nf.backToHome}
            </Link>
            <Link
              href="/guides"
              className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:border-gray-500 transition-colors"
            >
              {nf.browseGuides}
            </Link>
            <Link
              href="/destinations"
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              {nf.exploreDestinations}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
