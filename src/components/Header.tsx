import Link from "next/link";

interface HeaderProps {
  design: string;
}

export default function Header({ design }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <span className="text-xl font-bold text-gray-900">TravelPlan</span>
          <span className="text-xl font-bold text-amber-600">Info</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Destinations</Link>
          <Link href="#" className="text-orange-600 hover:text-orange-700 transition-colors font-semibold">🔥 Hot Deals</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Planner</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Guides</Link>
        </nav>

        {/* A/B/C design toggle */}
        <div className="flex items-center gap-2">
          {["A", "B", "C"].map((d) => (
            <Link
              key={d}
              href={`/?design=${d}`}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border transition-colors ${
                design === d
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
              }`}
            >
              {d}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
