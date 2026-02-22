import Link from "next/link";
import type { DesignKey } from "@/lib/design";
import type { BlogPost } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdSenseSlot } from "@/components/monetization/AdSenseSlot";

export default function VersionAArticle({
  design,
  post,
}: {
  design: DesignKey;
  post: BlogPost;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <article className="space-y-6">
        <header className="rounded-2xl bg-orange-50 px-8 py-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge>{post.category}</Badge>
            <span className="text-sm text-muted-foreground">{post.readingMinutes} min read</span>
          </div>
          <h1 className="font-display text-4xl">{post.title}</h1>
          <p className="text-lg text-muted-foreground mt-3">{post.excerpt}</p>
          <p className="text-sm text-muted-foreground mt-4">By {post.author} • {post.publishedAt}</p>
        </header>

        <div className="prose prose-lg max-w-none">
          <p>This is a placeholder for the article content. In production, this would be fetched from WordPress via the headless API and rendered as MDX or HTML blocks.</p>
          <p>The migration from WordPress to Next.js will include:</p>
          <ul>
            <li>Content fetched via REST API or GraphQL</li>
            <li>Images migrated to Next.js Image optimization</li>
            <li>SEO metadata preserved</li>
            <li>301 redirects for existing URLs</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/planner?design=${design}`}>Start Planning</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/destinations?design=${design}`}>Browse Destinations</Link>
          </Button>
        </div>
      </article>

      <aside className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Related Articles</h3>
            <div className="space-y-3">
              {["Carry-on Packing List", "Budgeting a Weekend Trip", "Avoid Tourist Traps"].map((title) => (
                <Link key={title} href={`/blog?design=${design}`} className="block text-sm text-muted-foreground hover:text-foreground">
                  {title}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <AdSenseSlot slot="article-sidebar" />
      </aside>
    </div>
  );
}
