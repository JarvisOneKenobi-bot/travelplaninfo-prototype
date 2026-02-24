import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="TravelPlanInfo" width={200} height={54} priority />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Destinations</Link>
          <Link href="/hot-deals" className="text-orange-600 hover:text-orange-700 transition-colors font-semibold">🔥 Hot Deals</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Planner</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Guides</Link>
        </nav>

        {/* Auth buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/signin"
            className="text-sm font-medium text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:border-gray-500 hover:text-gray-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-white bg-orange-500 px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
