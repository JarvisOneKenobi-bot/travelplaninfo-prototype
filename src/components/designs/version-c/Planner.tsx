import type { DesignKey } from "@/lib/design";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VersionCPlanner({ design }: { design: DesignKey }) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-8">
        <p className="text-emerald-100 text-sm">Design C • Interactive Planner</p>
        <h1 className="font-display text-4xl mt-2">Plan Your Trip</h1>
        <p className="text-emerald-100 mt-2">Build your perfect itinerary</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trip Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Destination</label>
                  <Input placeholder="Where are you going?" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Trip Name</label>
                  <Input placeholder="e.g., Miami Weekend" className="mt-1" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input type="date" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Travelers</label>
                  <Input type="number" placeholder="2" className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Budget ($)</label>
                <Input placeholder="500" className="mt-1" />
              </div>
              <Button className="w-full bg-emerald-600">Create Trip</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Itinerary Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Create a trip to start building your itinerary</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Trips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: "Miami Weekend", days: 3, status: "active" },
                  { name: "Lisbon Week", days: 7, status: "draft" },
                ].map((trip) => (
                  <div key={trip.name} className="p-3 rounded-lg border hover:border-emerald-300 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{trip.name}</p>
                      <Badge className={trip.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100"}>
                        {trip.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{trip.days} days</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inspiration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["Beach Getaway", "City Break", "Adventure", "Relaxation"].map((type) => (
                  <Button key={type} variant="outline" className="w-full justify-start text-sm">
                    {type}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
