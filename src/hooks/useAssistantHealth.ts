import { useEffect, useState } from "react";

const STORAGE_KEY = "atlas_health_v1";
const CLIENT_CACHE_TTL_MS = 45 * 1000;
const FETCH_TIMEOUT_MS = 4000;

interface CachedHealth {
  healthy: boolean;
  checkedAt: number;
}

function readCache(): CachedHealth | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedHealth;
    if (Date.now() - parsed.checkedAt > CLIENT_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(healthy: boolean): void {
  try {
    const entry: CachedHealth = { healthy, checkedAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {}
}

export function useAssistantHealth(): { healthy: boolean } {
  const [healthy, setHealthy] = useState<boolean>(() => readCache()?.healthy ?? false);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setHealthy(cached.healthy);
      return;
    }

    let cancelled = false;

    fetch("/api/assistant/health", { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then((data: { healthy?: boolean }) => {
        const result = Boolean(data.healthy);
        writeCache(result);
        if (!cancelled) setHealthy(result);
      })
      .catch(() => {
        writeCache(false);
        if (!cancelled) setHealthy(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { healthy };
}
