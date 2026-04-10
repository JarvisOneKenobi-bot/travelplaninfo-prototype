"use client";

import { useState, useEffect } from "react";

interface GeoOrigin {
  code: string | null;
  name: string | null;
  city: string | null;
  country: string | null;
}

interface UseGeolocateOriginResult {
  origin: GeoOrigin;
  loading: boolean;
}

const DEFAULT_ORIGIN: GeoOrigin = {
  code: null,
  name: null,
  city: null,
  country: null,
};

export function useGeolocateOrigin(): UseGeolocateOriginResult {
  const [origin, setOrigin] = useState<GeoOrigin>(DEFAULT_ORIGIN);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchGeo() {
      try {
        const res = await fetch("/api/geolocation");
        if (!res.ok) throw new Error("geolocation fetch failed");
        const data: GeoOrigin = await res.json();
        if (!cancelled) {
          setOrigin(data);
        }
      } catch {
        // Silently fail — origin stays as null values
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchGeo();

    return () => {
      cancelled = true;
    };
  }, []);

  return { origin, loading };
}
