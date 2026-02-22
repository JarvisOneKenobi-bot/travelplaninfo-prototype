import type { DesignKey } from "@/lib/design";
import type { BlogPost } from "@/components/designs/mockData";
import { posts } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function VersionBArticle({
  design,
  post,
}: {
  design: DesignKey;
  post: BlogPost;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <article className="space-y-6">
        <header className="rounded-2xl bg-slate-900 text-white p-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-blue-500">{post.category}</Badge>
            <span className="text-slate-300">{post.readingMinutes} min read</span>
          </div>
          <h1 className="font-display text-4xl">{post.title}</h1>
          <p className="text-slate-300 mt-3 text-lg">{post.excerpt}</p>
        </header>

        <div className="prose max-w-none">
          <p>Article content placeholder. Migrate from WordPress with full SEO preservation.</p>
        </div>
      </article>

      <aside className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Quick Facts</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reading time</span>
                <span>{post.readingMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{post.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author</span>
                <span>{post.author}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Related</h3>
            <div className="space-y-2">
              {posts.slice(0, 3).map((p) => (
                <a key={p.slug} href={`/blog/${p.slug}?design=${design}`} className="block text-sm text-muted-foreground hover:text-foreground">
                  {p.title}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
