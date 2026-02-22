import Link from "next/link";
import type { DesignKey } from "@/lib/design";
import { destinations, posts } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function VersionCHome({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-8">
        <h1 className="font-display text-3xl">My Travel Plans</h1>
        <p className="text-emerald-100 mt-2">Welcome back! Ready to plan your next adventure?</p>
        <div className="flex gap-3 mt-6">
          <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
            <Link href={`/planner?design=${design}`}>New Trip</Link>
          </Button>
          <Button variant="outline" className="border-white text-white hover:bg-white/10">
            <Link href={`/destinations?design=${design}`}>Browse</Link>
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Active Trips", value: "2", icon: "🗓️" },
          { label: "Saved Destinations", value: "8", icon: "⭐" },
          { label: "Draft Itineraries", value: "3", icon: "📝" },
        ].map((stat) => (
          <Card key={stat.label} className="border-emerald-100">
            <CardContent className="p-4 flex items-center gap-4">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Plans */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold text-lg mb-4">Continue Planning</h2>
          <div className="space-y-3">
            {[
              { name: "Miami Weekend", dates: "Feb 15-17", status: "In Progress" },
              { name: "Lisbon Week", dates: "Mar 10-17", status: "Saved" },
            ].map((plan) => (
              <div key={plan.name} className="flex items-center justify-between p-3 rounded-lg border hover:bg-emerald-50/50 transition-colors">
                <div>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-sm text-muted-foreground">{plan.dates}</p>
                </div>
                <Badge variant={plan.status === "In Progress" ? "default" : "outline"} className="bg-emerald-100 text-emerald-700">
                  {plan.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Recommended Destinations</h3>
            <div className="space-y-3">
              {destinations.slice(0, 3).map((d) => (
                <Link key={d.slug} href={`/destinations?design=${design}`} className="flex items-center justify-between p-2 rounded hover:bg-emerald-50">
                  <span>{d.name}</span>
                  <Badge variant="outline">{d.budgetHint}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Popular Guides</h3>
            <div className="space-y-3">
              {posts.slice(0, 3).map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}?design=${design}`} className="block p-2 rounded hover:bg-emerald-50">
                  <p className="text-sm font-medium">{post.title}</p>
                  <p className="text-xs text-muted-foreground">{post.category} • {post.readingMinutes} min</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
