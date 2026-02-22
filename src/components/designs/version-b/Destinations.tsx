import type { DesignKey } from "@/lib/design";
import { destinations } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function VersionBDestinations({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-slate-900 text-white p-8">
        <p className="text-blue-400 text-sm font-medium">Design B • Destination Guide</p>
        <h1 className="font-display text-4xl mt-2">Destination Database</h1>
        <div className="flex gap-4 mt-4 max-w-xl">
          <Input placeholder="Filter by name..." className="bg-white/10 border-white/20 text-white" />
          <Input placeholder="Region" className="bg-white/10 border-white/20 text-white" />
          <Button className="bg-blue-500">Filter</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d) => (
          <Card key={d.slug} className="hover:border-blue-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-xl">{d.name}</h3>
                  <p className="text-sm text-muted-foreground">{d.region}</p>
                </div>
                <Badge className="bg-blue-100 text-blue-700">{d.budgetHint}</Badge>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Best months</span>
                  <span className="font-medium">{d.bestMonths}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Style</span>
                  <span className="font-medium">{d.style}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">{d.tagline}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
