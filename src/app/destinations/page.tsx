import { getDesign } from "@/lib/design";
import { makeMetadata } from "@/lib/seo";
import VersionADestinations from "@/components/designs/version-a/Destinations";
import VersionBDestinations from "@/components/designs/version-b/Destinations";
import VersionCDestinations from "@/components/designs/version-c/Destinations";
import { DesignToggle } from "@/components/designs/DesignToggle";

export const metadata = makeMetadata({ title: "Destinations", path: "/destinations" });

export default async function DestinationsPage({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
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
            <a href={`/destinations?design=${key}`} className="font-medium">Destinations</a>
            <a href={`/planner?design=${key}`} className="text-muted-foreground hover:text-foreground">Planner</a>
            <a href={`/blog?design=${key}`} className="text-muted-foreground hover:text-foreground">Guides</a>
          </nav>
          <DesignToggle />
        </div>
      </div>
      <main className="container mx-auto px-4 py-8">
        {key === "a" && <VersionADestinations design={key} />}
        {key === "b" && <VersionBDestinations design={key} />}
        {key === "c" && <VersionCDestinations design={key} />}
      </main>
    </div>
  );
}
