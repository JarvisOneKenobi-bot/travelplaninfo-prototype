import Link from "next/link";

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TripModes from "@/components/TripModes";
import DesignA from "@/components/DesignA";
import posts from "@/content/posts.json";

// Sort posts by date (most recent first) and take top 6
const latestPosts = [...posts]
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 6);

// Extract plain text from HTML excerpt
function getPlainText(html: string, maxLength: number): string {
  const text = html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');
  return text.length > maxLength ? text.slice(0, maxLength).trim() + '...' : text;
}

// Format date for display
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function LatestArticles() {
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-gray-900">Latest Articles</h2>
        <Link href="/guides" className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {latestPosts.map((post) => (
          <a
            key={post.id}
            href={`/${post.slug}/`}
            className="block rounded-xl p-6 shadow-sm border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all"
          >
            {/* Featured Image */}
            <div className="h-40 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg mb-4 overflow-hidden flex items-center justify-center">
              {post.featuredImage ? (
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl">✈️</span>
              )}
            </div>
            
            {/* Category */}
            {post.categories && post.categories.length > 0 && (
              <span className="text-xs font-medium bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                {post.categories[0].name}
              </span>
            )}
            
            {/* Title */}
            <h3 className="text-lg font-bold text-gray-900 mt-3 mb-2 line-clamp-2">
              {post.title}
            </h3>
            
            {/* Excerpt */}
            <p className="text-sm text-gray-500 mb-4 line-clamp-2">
              {getPlainText(post.excerpt, 100)}
            </p>
            
            {/* Date */}
            <p className="text-xs text-gray-400">
              {formatDate(post.date)}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="w-full px-6 lg:px-12 py-8 space-y-8">
        <Hero />
        <TripModes />
        <LatestArticles />
        <DesignA />
      </main>
    </div>
  );
}
