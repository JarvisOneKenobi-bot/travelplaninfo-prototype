"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import OnboardingModal from "./OnboardingModal";
import BootstrapModal, { GUEST_BOOTSTRAP_LS_KEY } from "./BootstrapModal";

/** Returns true when the current path is the site homepage (any locale). */
function isHomePage(pathname: string): boolean {
  // Default locale (en) → "/" (no prefix, localePrefix: "as-needed")
  // Other locales → "/es", "/fr", "/de", etc.
  return pathname === "/" || /^\/[a-z]{2}$/.test(pathname);
}

export default function OnboardingWrapper() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [variant, setVariant] = useState<"none" | "bootstrap" | "full">("none");

  useEffect(() => {
    if (status === "loading") return;

    const timer = setTimeout(() => {
      if (session?.user) {
        setVariant("full");
      } else {
        // Bootstrap modal only on the homepage so it doesn't overlay mid-flow pages
        if (
          isHomePage(pathname) &&
          typeof window !== "undefined" &&
          !localStorage.getItem(GUEST_BOOTSTRAP_LS_KEY)
        ) {
          setVariant("bootstrap");
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [session, status, pathname]);

  if (variant === "bootstrap") return <BootstrapModal onClose={() => setVariant("none")} />;
  if (variant === "full") return <OnboardingModal />;
  return null;
}
