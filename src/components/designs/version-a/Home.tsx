import Link from "next/link";
import type { DesignKey } from "@/lib/design";
import { destinations, posts } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdSenseSlot } from "@/components/monetization/AdSenseSlot";

export default function VersionAHome({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 px-6 py-16 md:px-12 md:py-24">
        <div className="max-w-2xl">
          <Badge className="mb-4 bg-orange-100 text-orange-700">Travel Deals & Guides</Badge>
          <h1 className="font-display text-4xl md:text-6xl text-foreground mb-4">
            Plan your next trip,<br />
            <span className="text-orange-600">one adventure at a time.</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Expert itineraries, hidden gems, and deals for every kind of traveler.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href={`/destinations?design=${design}`}>Explore Destinations</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/planner?design=${design}`}>Start Planning</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Destinations */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl">Featured Destinations</h2>
          <Button asChild variant="ghost">
            <Link href={`/destinations?design=${design}`}>View all →</Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {destinations.slice(0, 3).map((d) => (
            <Link key={d.slug} href={`/destinations?design=${design}`} className="group">
              <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                <div className="aspect-[4/3] bg-gradient-to-br from-orange-100 to-amber-100" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl group-hover:text-orange-600 transition-colors">{d.name}</h3>
                    <Badge variant="secondary">{d.budgetHint}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{d.tagline}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest Articles */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl">Latest Guides</h2>
          <Button asChild variant="ghost">
            <Link href={`/blog?design=${design}`}>All articles →</Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {posts.slice(0, 4).map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}?design=${design}`} className="group">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{post.category}</Badge>
                    <span className="text-xs text-muted-foreground">{post.readingMinutes} min read</span>
                  </div>
                  <h3 className="font-display text-lg group-hover:text-orange-600 transition-colors">{post.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Ad Slot */}
      <AdSenseSlot slot="home-below-articles" />
    </div>
  );
}
