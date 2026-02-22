"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { designs, type DesignKey } from "@/lib/design";
import { Button } from "@/components/ui/button";

export function DesignToggle({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("design") as DesignKey) || "a";

  const setDesign = (d: DesignKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("design", d);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className={`flex items-center gap-1 rounded-lg bg-muted p-1 ${className}`}>
      {Object.entries(designs).map(([key, { name, color }]) => (
        <Button
          key={key}
          variant={current === key ? "default" : "ghost"}
          size="sm"
          onClick={() => setDesign(key as DesignKey)}
          className="text-xs"
        >
          {key.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
