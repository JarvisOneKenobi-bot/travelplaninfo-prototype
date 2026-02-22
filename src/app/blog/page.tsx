import Link from "next/link";
import { getDesign } from "@/lib/design";
import { makeMetadata } from "@/lib/seo";
import { posts } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DesignToggle } from "@/components/designs/DesignToggle";

export const metadata = makeMetadata({ title: "Travel Guides", path: "/blog" });

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
  const sp = await searchParams;
  const { key } = getDesign(sp);

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
        <header className="mb-8">
          <h1 className="font-display text-4xl">Travel Guides</h1>
          <p className="text-muted-foreground mt-2">Expert advice for better trips</p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}?design=${key}`}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge>{post.category}</Badge>
                    <span className="text-sm text-muted-foreground">{post.readingMinutes} min read</span>
                  </div>
                  <h2 className="font-display text-xl mb-2">{post.title}</h2>
                  <p className="text-muted-foreground">{post.excerpt}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
