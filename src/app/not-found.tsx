import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-6xl mb-6">🗺️</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Page not found</h1>
        <p className="text-lg text-gray-600 mb-8">
          Looks like this destination doesn&apos;t exist on our map. Let&apos;s get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="bg-teal-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/guides"
            className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:border-gray-500 transition-colors"
          >
            Browse Travel Guides
          </Link>
          <Link
            href="/destinations"
            className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
          >
            Explore Destinations
          </Link>
        </div>
      </main>
    </div>
  );
}
