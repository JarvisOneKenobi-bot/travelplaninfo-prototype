import type { DesignKey } from "@/lib/design";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VersionBPlanner({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-slate-900 text-white p-8">
        <p className="text-blue-400 text-sm font-medium">Design B • Destination Guide</p>
        <h1 className="font-display text-4xl mt-2">Trip Builder</h1>
        <p className="text-slate-300 mt-2">Compare flights, hotels, and activities</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Flights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Input placeholder="From" />
                <Input placeholder="To" />
                <Input type="date" />
              </div>
              <Button className="w-full mt-4 bg-blue-500">Search Flights</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Search Hotels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Input placeholder="Destination" />
                <Input type="date" placeholder="Check-in" />
                <Input type="date" placeholder="Check-out" />
              </div>
              <Button className="w-full mt-4 bg-blue-500">Search Hotels</Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Trip</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No trips planned yet</p>
                <p className="text-sm mt-1">Use the search boxes to start</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["Nonstop", "Direct", "Refundable", "Flexible"].map((f) => (
                  <Badge key={f} variant="outline" className="cursor-pointer hover:bg-slate-100">
                    {f}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
