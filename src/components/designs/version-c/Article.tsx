import Link from "next/link";
import type { DesignKey } from "@/lib/design";
import type { BlogPost } from "@/components/designs/mockData";
import { posts } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function VersionCArticle({
  design,
  post,
}: {
  design: DesignKey;
  post: BlogPost;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <article className="space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-white/20 text-white">{post.category}</Badge>
            <span className="text-emerald-100">{post.readingMinutes} min read</span>
          </div>
          <h1 className="font-display text-4xl">{post.title}</h1>
          <p className="text-emerald-100 mt-3 text-lg">{post.excerpt}</p>
          <div className-3 mt-="flex gap6">
            <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
              <Link href={`/planner?design=${design}`}>Add to Trip</Link>
            </Button>
            <Button variant="outline" className="border-white text-white hover:bg-white/10">
              <Link href={`/destinations?design=${design}`}>Browse</Link>
            </Button>
          </div>
        </header>

        <div className="prose max-w-none">
          <p>Article content placeholder. Full migration from WordPress in progress.</p>
        </div>
      </article>

      <aside className="space-y-4">
        <Card className="border-emerald-100">
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Article Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{post.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Read time</span>
                <span>{post.readingMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author</span>
                <span>{post.author}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100">
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                Save Article
              </Button>
              <Button variant="outline" className="w-full justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                Add to Trip
              </Button>
              <Button variant="outline" className="w-full justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100">
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">More Guides</h3>
            <div className="space-y-2">
              {posts.slice(0, 3).map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}?design=${design}`} className="block p-2 rounded hover:bg-emerald-50 text-sm">
                  {p.title}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
