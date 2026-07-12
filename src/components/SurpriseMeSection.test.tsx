import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import esMessages from "../../messages/es/common.json";
import SurpriseMeSection from "./SurpriseMeSection";
import { INVALID_IATA_REASON } from "@/lib/atlas/travelpayouts-client";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

interface SurpriseMePayload {
  origin: string;
  destinations: unknown[];
  degraded?: {
    code: string;
    reason: string;
  };
}

function stubSurpriseFetch(payload: SurpriseMePayload) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    }))
  );
}

function renderSurpriseMeSection() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SurpriseMeSection
        tripId={123}
        originCode="CANCUN"
        vibesSummary="playa"
        budgetLabel="moderado"
      />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SurpriseMeSection degraded fallback banner", () => {
  it("renders real destination cards for non-degraded payloads", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      destinations: [
        {
          name: "Lisbon",
          airline: "TP",
          flightPrice: "$412 rt",
          nonstop: true,
          link: "https://example.test/x",
        },
      ],
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.queryAllByTestId("atlas-destination-card")).toHaveLength(1);
    });
    expect(screen.queryByTestId("surprise-fallback-banner")).toBeNull();
  });

  it("renders the shipped Spanish invalid-origin copy instead of raw engine prose", async () => {
    stubSurpriseFetch({
      origin: "CANCUN",
      destinations: [],
      degraded: { code: "invalid_origin", reason: INVALID_IATA_REASON },
    });

    renderSurpriseMeSection();

    const banner = await screen.findByTestId("surprise-fallback-banner");
    await waitFor(() => {
      expect(banner.textContent).toContain(esMessages.atlasHero.degradedInvalidOriginBody);
    });

    expect(banner.textContent).not.toContain("IATA");
    expect(banner.textContent).not.toContain("airport code");
    expect(banner.textContent).not.toContain(INVALID_IATA_REASON);
    expect(banner.textContent).not.toBe(INVALID_IATA_REASON);
    expect(screen.queryAllByTestId("atlas-destination-card")).toHaveLength(0);
  });

  it("renders raw prose for an unknown degraded code", async () => {
    stubSurpriseFetch({
      origin: "CANCUN",
      destinations: [],
      degraded: { code: "banana", reason: "some raw prose" },
    });

    renderSurpriseMeSection();

    const banner = await screen.findByTestId("surprise-fallback-banner");
    await waitFor(() => {
      expect(banner.textContent).toContain("some raw prose");
    });

    expect(screen.queryAllByTestId("atlas-destination-card")).toHaveLength(0);
  });
});
