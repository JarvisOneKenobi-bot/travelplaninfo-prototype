import type { DesignKey } from "@/lib/design";
import { destinations } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VersionCDestinations({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-8">
        <p className="text-emerald-100 text-sm">Design C • Interactive Planner</p>
        <h1 className="font-display text-4xl mt-2">Destinations</h1>
        <p className="text-emerald-100 mt-2">Find your perfect trip match</p>
        <div className="mt-4">
          <Input placeholder="Search destinations..." className="max-w-md bg-white/20 border-0 text-white placeholder:text-emerald-200" />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d) => (
          <Card key={d.slug} className="border-emerald-100 hover:border-emerald-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{d.name}</h3>
                  <p className="text-sm text-muted-foreground">{d.region}</p>
                </div>
                <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">{d.tagline}</p>
              <div className="flex gap-2 mt-4">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{d.bestMonths}</Badge>
                <Badge variant="outline">{d.style}</Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1 bg-emerald-600">Add to Trip</Button>
                <Button size="sm" variant="outline" className="flex-1">View Guide</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
