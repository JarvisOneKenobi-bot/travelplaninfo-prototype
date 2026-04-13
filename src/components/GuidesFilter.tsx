"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  featuredImage: string | null;
  categories: { slug: string; name: string }[];
  date: string;
}

function getPlainText(html: string, maxLength: number): string {
  const text = html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ");
  return text.length > maxLength ? text.slice(0, maxLength).trim() + "..." : text;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FILTER_CATEGORIES = [
  { label: "All Guides", value: "all" },
  { label: "Destinations", value: "destinations" },
  { label: "Itineraries", value: "itineraries" },
  { label: "Planning & Tips", value: "planning-tips" },
  { label: "Things to Do", value: "things-to-do" },
];

export default function GuidesFilter({ posts }: { posts: Post[] }) {
  const [activeCategory, setActiveCategory] = useState("all");

  const countFor = (value: string) =>
    value === "all"
      ? posts.length
      : posts.filter((p) => p.categories.some((c) => c.slug === value)).length;

  const filtered =
    activeCategory === "all"
      ? posts
      : posts.filter((p) => p.categories.some((c) => c.slug === activeCategory));

  return (
    <>
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {FILTER_CATEGORIES.map((cat) => {
          const count = countFor(cat.value);
          const isEmpty = count === 0;
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => !isEmpty && setActiveCategory(cat.value)}
              disabled={isEmpty}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-teal-700 text-white"
                  : isEmpty
                  ? "bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-700 border border-gray-300 hover:border-gray-400"
              }`}
            >
              {cat.label}
              <span className={`ml-1.5 text-xs ${isActive ? "text-teal-200" : isEmpty ? "text-gray-300" : "text-gray-400"}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((post) => (
          <Link
            key={post.slug}
            href={`/${post.slug}/`}
            className="block bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all"
          >
            <div className="relative h-44 bg-gradient-to-br from-orange-50 to-orange-100 rounded-t-xl overflow-hidden">
              {post.featuredImage ? (
                <Image
                  src={post.featuredImage}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-5xl">✈️</span>
              )}
            </div>

            <div className="p-5">
              {post.categories && post.categories.length > 0 && (
                <span className="text-xs font-medium bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                  {post.categories[0].name}
                </span>
              )}
              <h3 className="text-lg font-bold text-gray-900 mt-3 mb-2 line-clamp-2">
                {post.title}
              </h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                {getPlainText(post.excerpt, 100)}
              </p>
              <p className="text-xs text-gray-400">{formatDate(post.date)}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
