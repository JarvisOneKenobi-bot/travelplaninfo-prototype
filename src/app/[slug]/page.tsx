import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import posts from "@/content/posts.json";

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate static params for all posts (SSG)
export async function generateStaticParams() {
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate SEO metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return {
      title: "Post Not Found | TravelPlanInfo",
    };
  }

  return {
    title: post.seo.title || post.title,
    description: post.seo.description || post.excerpt,
    openGraph: {
      title: post.seo.title || post.title,
      description: post.seo.description || post.excerpt,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.modified,
      authors: ["TravelPlanInfo"],
      images: (post.seo as any).ogImage ? [(post.seo as any).ogImage] : [],
    },
    alternates: {
      canonical: post.seo.canonical || `https://travelplaninfo.com/${slug}/`,
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  const formattedDate = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-orange-600 transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{post.categories?.[0]?.name || "Article"}</span>
        </nav>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="mb-8 relative rounded-2xl overflow-hidden aspect-[16/9]">
            <Image
              src={post.featuredImage}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-200">
          <time dateTime={post.date}>{formattedDate}</time>
          {post.categories && post.categories.length > 0 && (
            <>
              <span>•</span>
              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-medium">
                {post.categories[0].name}
              </span>
            </>
          )}
        </div>

        {/* Content */}
        <article
          className="prose prose-lg prose-orange max-w-none
            prose-headings:font-bold prose-headings:text-gray-900
            prose-p:text-gray-700 prose-p:leading-relaxed
            prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl prose-img:shadow-md
            prose-ul:text-gray-700 prose-ol:text-gray-700
            prose-li:marker:text-orange-500
            prose-blockquote:border-l-orange-500 prose-blockquote:bg-orange-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
            prose-strong:text-gray-900
            prose-code:text-orange-600 prose-code:bg-orange-50 prose-code:px-2 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
            prose-hr:border-gray-200"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Share / Back */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium transition-colors"
          >
            ← Back to all articles
          </Link>
        </div>
      </main>
    </>
  );
}
