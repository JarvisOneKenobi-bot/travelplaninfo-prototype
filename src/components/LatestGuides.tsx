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
        <button className="text-sm text-gray-900 hover:text-orange-600 transition-colors">
          All articles →
        </button>
      </div>

      <div className="flex gap-6">
        {/* Article cards — 2×2 grid */}
        <div className="flex-1 grid grid-cols-2 gap-6">
          {articles.map((a) => (
            <div
              key={a.title}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-sm transition-shadow cursor-pointer"
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
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 space-y-5">
          {/* Recent Blog Posts */}
          <div className="bg-orange-50 rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Blog Posts</h3>
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <div key={post.title} className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-orange-200 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 leading-snug">{post.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{post.readTime}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stay Updated */}
          <div className="bg-orange-50 rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">📧 Stay Updated</h3>
            <p className="text-sm text-gray-600 mb-4">Get the latest travel tips and deals</p>
            <input
              type="email"
              placeholder="Your email"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
            <button className="w-full py-2.5 text-sm font-medium text-white rounded-lg bg-orange-600 hover:bg-orange-700 transition-colors">
              Subscribe
            </button>
          </div>

          {/* AdSense slot */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm font-medium text-gray-500">AdSense Slot</p>
            <p className="text-xs text-gray-400 mt-1">sidebar</p>
            <p className="text-xs text-gray-400 mt-1">Replace with real AdSense script</p>
          </div>
        </div>
      </div>

      <hr className="mt-8 border-gray-200" />
    </div>
  );
}
