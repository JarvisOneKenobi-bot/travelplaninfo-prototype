import Header from "@/components/Header";
import Hero from "@/components/Hero";
import DesignA from "@/components/DesignA";
import DesignB from "@/components/DesignB";
import DesignC from "@/components/DesignC";

interface PageProps {
  searchParams: Promise<{ design?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const design = (params.design || "A").toUpperCase();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <Hero />
        {design === "B" ? <DesignB /> : design === "C" ? <DesignC /> : <DesignA />}
      </main>
    </div>
  );
}
