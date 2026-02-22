import Link from "next/link";
import type { DesignKey } from "@/lib/design";
import { destinations } from "@/components/designs/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function VersionADestinations({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 p-8">
        <p className="text-sm text-orange-600 font-medium">Design A • Modern Travel Blog</p>
        <h1 className="font-display text-4xl mt-2">Destinations</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Curated guides for every style of travel — from city breaks to beach getaways.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d) => (
          <Link key={d.slug} href={`/destinations?design=${design}`} className="group">
            <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="aspect-[16/9] bg-gradient-to-br from-orange-100 to-rose-100" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-xl group-hover:text-orange-600 transition-colors">{d.name}</h3>
                    <p className="text-sm text-muted-foreground">{d.region}</p>
                  </div>
                  <Badge variant="secondary">{d.budgetHint}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{d.tagline}</p>
                <div className="flex gap-2 mt-4">
                  <Badge variant="outline" className="text-xs">{d.bestMonths}</Badge>
                  <Badge variant="outline" className="text-xs">{d.style}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
