import Link from "next/link";
import type { DesignKey } from "@/lib/design";
import { destinations, posts } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TravelpayoutsSlot } from "@/components/monetization/AdSenseSlot";

export default function VersionBHome({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-10">
      {/* Portal Header */}
      <section className="rounded-2xl bg-slate-900 text-white px-6 py-12 md:px-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="font-display text-3xl md:text-4xl">
              Travel<span className="text-blue-400">Plan</span>Info
            </h1>
            <p className="text-slate-300 mt-2">Your destination database</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Input placeholder="Search destinations..." className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
            <Button className="bg-blue-500 hover:bg-blue-600">Search</Button>
          </div>
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-2 mt-6">
          {["Beach", "City Break", "Nature", "Family", "Adventure", "Romantic"].map((cat) => (
            <Link key={cat} href={`/destinations?design=${design}`} className="px-3 py-1 rounded-full bg-white/10 text-sm hover:bg-white/20 transition-colors">
              {cat}
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Destinations", value: "50+" },
          { label: "Countries", value: "25" },
          { label: "Itineraries", value: "200+" },
          { label: "Deals", value: "Daily" },
        ].map((stat) => (
          <Card key={stat.label} className="text-center">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-blue-600">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Destinations Grid */}
      <section>
        <h2 className="font-display text-2xl mb-4">Top Destinations</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((d) => (
            <Link key={d.slug} href={`/destinations?design=${design}`}>
              <Card className="transition-all hover:border-blue-300 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{d.name}</h3>
                      <p className="text-sm text-muted-foreground">{d.region}</p>
                    </div>
                    <Badge variant="secondary">{d.bestMonths}</Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">{d.style}</Badge>
                    <Badge variant="outline" className="text-xs">{d.budgetHint}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Travelpayouts Widget */}
      <TravelpayoutsSlot type="flight" />

      {/* Latest Guides */}
      <section>
        <h2 className="font-display text-2xl mb-4">Travel Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {posts.slice(0, 4).map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}?design=${design}`}>
              <Card className="transition-all hover:border-blue-300">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{post.category}</Badge>
                    <span className="text-xs text-muted-foreground">{post.readingMinutes} min</span>
                  </div>
                  <h3 className="font-medium">{post.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
