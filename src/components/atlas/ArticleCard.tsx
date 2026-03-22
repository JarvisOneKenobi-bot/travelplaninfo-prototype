"use client";

interface ArticleData {
  slug: string;
  title: string;
  excerpt: string;
  url: string;
  categories?: string[];
}

export default function ArticleCard({ article }: { article: ArticleData }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <p className="font-medium text-sm text-gray-900 leading-snug">{article.title}</p>
      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{article.excerpt}</p>
      {article.categories && article.categories.length > 0 && (
        <div className="flex gap-1 mt-1.5">
          {article.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5"
            >
              {cat}
            </span>
          ))}
        </div>
      )}
      <a
        href={article.url}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-3 py-1.5 transition-colors"
      >
        Read Guide
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}
