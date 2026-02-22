import { getDesign } from "@/lib/design";
import { makeMetadata } from "@/lib/seo";
import VersionAPlanner from "@/components/designs/version-a/Planner";
import VersionBPlanner from "@/components/designs/version-b/Planner";
import VersionCPlanner from "@/components/designs/version-c/Planner";
import { DesignToggle } from "@/components/designs/DesignToggle";

export const metadata = makeMetadata({ title: "Trip Planner", path: "/planner" });

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
  const sp = await searchParams;
  const { key } = getDesign(sp);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <a href={`/?design=${key}`} className="font-display text-xl font-bold">
            TravelPlanInfo
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href={`/?design=${key}`} className="text-muted-foreground hover:text-foreground">Home</a>
            <a href={`/destinations?design=${key}`} className="text-muted-foreground hover:text-foreground">Destinations</a>
            <a href={`/planner?design=${key}`} className="font-medium">Planner</a>
            <a href={`/blog?design=${key}`} className="text-muted-foreground hover:text-foreground">Guides</a>
          </nav>
          <DesignToggle />
        </div>
      </div>
      <main className="container mx-auto px-4 py-8">
        {key === "a" && <VersionAPlanner design={key} />}
        {key === "b" && <VersionBPlanner design={key} />}
        {key === "c" && <VersionCPlanner design={key} />}
      </main>
    </div>
  );
}
