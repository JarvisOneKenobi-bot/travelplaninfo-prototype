import Header from "@/components/Header";
import posts from "@/content/posts.json";
import Link from "next/link";

// Sort posts by date (most recent first)
const sortedPosts = [...posts].sort((a, b) => 
  new Date(b.date).getTime() - new Date(a.date).getTime()
);

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

export default function Guides() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-teal-800 font-medium mb-4">
            Travel Guides
          </p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Explore our travel guides
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Expert advice, itineraries, and tips for planning your next adventure.
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          <button className="px-4 py-2 bg-teal-700 text-white rounded-full text-sm font-medium">
            All Guides
          </button>
          <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-full text-sm font-medium hover:border-gray-400 transition-colors">
            Destinations
          </button>
          <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-full text-sm font-medium hover:border-gray-400 transition-colors">
            Tips & Tricks
          </button>
          <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-full text-sm font-medium hover:border-gray-400 transition-colors">
            Itineraries
          </button>
          <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-full text-sm font-medium hover:border-gray-400 transition-colors">
            Transportation
          </button>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPosts.map((post) => (
            <Link
              key={post.id}
              href={`/${post.slug}/`}
              className="block bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all"
            >
              {/* Featured Image */}
              <div className="h-44 bg-gradient-to-br from-orange-50 to-orange-100 rounded-t-xl overflow-hidden flex items-center justify-center">
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
              
              {/* Content */}
              <div className="p-5">
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
              </div>
            </Link>
          ))}
        </div>

        {/* Newsletter */}
        <div className="mt-16 bg-teal-800 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Get travel tips in your inbox
          </h2>
          <p className="text-teal-100 mb-6 max-w-xl mx-auto">
            Join 41,200+ travelers. We send weekly deals, itinerary tips, and destination guides.
          </p>
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              placeholder="you@email.com"
              className="flex-1 px-4 py-3 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-xs text-teal-300 mt-3">No spam. Unsubscribe anytime.</p>
        </div>
      </main>
    </div>
  );
}
