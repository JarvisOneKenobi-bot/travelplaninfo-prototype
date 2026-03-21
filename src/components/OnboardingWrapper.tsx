"use client";

import { useSession } from "next-auth/react";
import OnboardingModal from "./OnboardingModal";

export default function OnboardingWrapper() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return <OnboardingModal />;
}
