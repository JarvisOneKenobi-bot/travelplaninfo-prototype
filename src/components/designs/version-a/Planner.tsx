import Link from "next/link";
import type { DesignKey } from "@/lib/design";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function VersionAPlanner({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-8">
      <header className="rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 p-8">
        <p className="text-sm text-orange-600 font-medium">Design A • Modern Travel Blog</p>
        <h1 className="font-display text-4xl mt-2">Trip Planner</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Build your perfect itinerary — day by day, neighborhood by neighborhood.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Plan Your Trip</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">From</label>
                <Input placeholder="Your city" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <Input placeholder="Destination" className="mt-1" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">When</label>
                <Input type="date" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Days</label>
                <Input type="number" placeholder="3" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Budget</label>
                <Input placeholder="$500" className="mt-1" />
              </div>
            </div>
            <Button className="w-full">Generate Itinerary</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Plans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Miami Weekend</p>
                  <Badge variant="secondary">Draft</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Feb 15–17</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Lisbon Week</p>
                  <Badge variant="outline">Saved</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Mar 10–17</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Popular Destinations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {["Miami", "Lisbon", "Tokyo", "Cancún"].map((city) => (
                <Button key={city} asChild variant="outline" size="sm">
                  <Link href={`/planner?design=${design}`}>{city}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
