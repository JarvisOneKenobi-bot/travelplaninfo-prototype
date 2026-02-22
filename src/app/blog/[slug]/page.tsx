import { notFound } from "next/navigation";
import { getDesign, parseDesign } from "@/lib/design";
import { makeMetadata } from "@/lib/seo";
import { getPostBySlug } from "@/components/designs/mockData";
import VersionAArticle from "@/components/designs/version-a/Article";
import VersionBArticle from "@/components/designs/version-b/Article";
import VersionCArticle from "@/components/designs/version-c/Article";
import { DesignToggle } from "@/components/designs/DesignToggle";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return makeMetadata({ title: post.title, description: post.excerpt, path: `/blog/${slug}` });
}

export default async function BlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ design?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const key = parseDesign(sp);
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const Page = key === "a" ? VersionAArticle : key === "b" ? VersionBArticle : VersionCArticle;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <a href={`/?design=${key}`} className="font-display text-xl font-bold">
            TravelPlanInfo
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href={`/?design=${key}`} className="text-muted-foreground hover:text-foreground">Home</a>
            <a href={`/destinations?design=${key}`} className="text-muted-foreground hover:text-foreground">Destinations</a>
            <a href={`/planner?design=${key}`} className="text-muted-foreground hover:text-foreground">Planner</a>
            <a href={`/blog?design=${key}`} className="font-medium">Guides</a>
          </nav>
          <DesignToggle />
        </div>
      </div>
      <main className="container mx-auto px-4 py-8">
        <Page design={key} post={post} />
      </main>
    </div>
  );
}
