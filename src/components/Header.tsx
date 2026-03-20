"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b border-gray-100" style={{ backgroundColor: "rgba(178, 107, 32, 0.7)" }}>
      <div className="w-full px-6 lg:px-12 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.webp"
            alt="TravelPlanInfo"
            width={400}
            height={400}
            style={{ height: "15rem", width: "auto", paddingTop: "15px" }}
            priority
          />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link href="/destinations" className="hover:text-gray-900 transition-colors">Destinations</Link>
          <Link href="/hot-deals" className="text-orange-600 hover:text-orange-700 transition-colors font-semibold">🔥 Hot Deals</Link>
          <Link href="/planner" className="hover:text-gray-900 transition-colors">Planner</Link>
          <Link href="/guides" className="hover:text-gray-900 transition-colors">Guides</Link>
        </nav>

        {/* Auth buttons + hamburger */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden md:block text-sm text-gray-700">
                {session.user?.name || session.user?.email}
              </span>
              <Link
                href="/planner"
                className="hidden md:block text-sm font-medium text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:border-gray-500 hover:text-gray-900 transition-colors"
              >
                My Trips
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hidden md:block text-sm font-medium text-white bg-orange-600 px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden md:block text-sm font-medium text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:border-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="hidden md:block text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: "rgba(169, 61, 4, 1)" }}
              >
                Register
              </Link>
            </>
          )}

          {/* Hamburger button — mobile only */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-6 bg-gray-700 transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block h-0.5 w-6 bg-gray-700 transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-6 bg-gray-700 transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <nav className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-4 text-sm font-medium text-gray-700">
          <Link href="/" onClick={() => setMenuOpen(false)} className="hover:text-gray-900 transition-colors">Home</Link>
          <Link href="/destinations" onClick={() => setMenuOpen(false)} className="hover:text-gray-900 transition-colors">Destinations</Link>
          <Link href="/hot-deals" onClick={() => setMenuOpen(false)} className="text-orange-600 font-semibold hover:text-orange-700 transition-colors">🔥 Hot Deals</Link>
          <Link href="/planner" onClick={() => setMenuOpen(false)} className="hover:text-gray-900 transition-colors">Planner</Link>
          <Link href="/guides" onClick={() => setMenuOpen(false)} className="hover:text-gray-900 transition-colors">Guides</Link>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            {session ? (
              <>
                <Link href="/planner" onClick={() => setMenuOpen(false)} className="flex-1 text-center text-sm font-medium text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:border-gray-500 transition-colors">
                  My Trips
                </Link>
                <button onClick={() => signOut({ callbackUrl: "/" })} className="flex-1 text-center text-sm font-medium text-white bg-orange-600 px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/signin" onClick={() => setMenuOpen(false)} className="flex-1 text-center text-sm font-medium text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:border-gray-500 transition-colors">
                  Sign In
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="flex-1 text-center text-sm font-medium text-white bg-orange-600 px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                  Register
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
