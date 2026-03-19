import Link from "next/link";
import NewsletterForm from "@/components/NewsletterForm";

const articles = [
  {
    tag: "Planning",
    readTime: "6 min read",
    title: "A simple 3-day itinerary template you can reuse anywhere",
    desc: "A practical framework for planning: neighborhoods, anchors, and buffers.",
  },
  {
    tag: "Gear",
    readTime: "5 min read",
    title: "Carry-on packing list: what actually earns a spot",
    desc: "A no-fluff list optimized for city breaks and long weekends.",
  },
  {
    tag: "Tips",
    readTime: "7 min read",
    title: "How to avoid tourist traps (without overplanning)",
    desc: "Signals to look for, questions to ask, and how to pick tours worth it.",
  },
  {
    tag: "Budget",
    readTime: "8 min read",
    title: "Budgeting a weekend trip: a 20-minute worksheet",
    desc: "Split your spend into predictable buckets and keep wiggle room.",
  },
];

const recentPosts = [
  { title: "How to avoid tourist traps (without overplanning)", readTime: "7 min" },
  { title: "Budgeting a weekend trip: a 20-minute worksheet", readTime: "8 min" },
];

export default function LatestGuides() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Latest Guides</h2>
        <Link href="/guides" className="text-sm text-gray-900 hover:text-orange-600 transition-colors">
          All articles →
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Article cards — 2×2 grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {articles.map((a) => (
            <Link
              key={a.title}
              href="/guides"
              className="block bg-white border border-gray-200 rounded-xl p-6 hover:shadow-sm hover:border-orange-200 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1 rounded-full">
                  {a.tag}
                </span>
                <span className="text-xs text-gray-500">{a.readTime}</span>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2 leading-snug">
                {a.title}
              </h3>
              <p className="text-sm text-gray-600">{a.desc}</p>
            </Link>
          ))}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 space-y-5">
          {/* Recent Blog Posts */}
          <div className="bg-orange-50 rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Blog Posts</h3>
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <Link key={post.title} href="/guides" className="flex items-start gap-3 group">
                  <div className="w-12 h-12 rounded-lg bg-orange-200 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 leading-snug group-hover:text-orange-600 transition-colors">{post.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{post.readTime}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Stay Updated */}
          <div className="bg-orange-50 rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">📧 Stay Updated</h3>
            <p className="text-sm text-gray-600 mb-4">Get the latest travel tips and deals</p>
            <NewsletterForm source="latest-guides" />
          </div>

          {/* TODO: Insert AdSense ad unit here once approved */}
        </div>
      </div>

      <hr className="mt-8 border-gray-200" />
    </div>
  );
}
