import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { ComponentProps } from "react";
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
  originName?: string;
  destinations: unknown[];
  degraded?: {
    code: string;
    reason: string;
  };
  preflight?: unknown;
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

function renderSurpriseMeSection(props: Partial<ComponentProps<typeof SurpriseMeSection>> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SurpriseMeSection tripId={123} originCode="CANCUN" vibesSummary="playa" budgetLabel="moderado" {...props} />
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

describe("SurpriseMeSection preflight clarification", () => {
  it("renders the interactive card instead of the dead-end banner for preflight codes", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [],
      degraded: { code: "no_match_possible", reason: "engine prose" },
      preflight: { status: "no_match_possible", wouldMatchIfAny: 40 },
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.getByTestId("surprise-clarification-card")).toBeTruthy();
    });
    expect(screen.queryByTestId("surprise-fallback-banner")).toBeNull();
  });

  it("match-any action re-fetches with match=any", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      destinations: [],
      degraded: { code: "no_match_possible", reason: "engine prose" },
      preflight: { status: "no_match_possible", wouldMatchIfAny: 40 },
    });

    renderSurpriseMeSection();
    await waitFor(() => expect(screen.getByTestId("clarify-match-any")).toBeTruthy());

    fireEvent.click(screen.getByTestId("clarify-match-any"));

    await waitFor(() => {
      const fetchMock = vi.mocked(globalThis.fetch);
      const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calledUrls.some((url) => url.includes("match=any"))).toBe(true);
    });
  });

  it("spends NOTHING until the user clicks Ask Atlas, then sends exactly one honest seed", async () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("atlas-open", listener);
    try {
      stubSurpriseFetch({
        origin: "JFK",
        originName: "New York, New York",
        destinations: [],
        degraded: { code: "no_match_possible", reason: "engine prose" },
        preflight: { status: "no_match_possible", wouldMatchIfAny: 40 },
      });

      renderSurpriseMeSection({ vibesSummary: "tropical + winter" });
      await waitFor(() => expect(screen.getByTestId("clarify-ask-atlas")).toBeTruthy());

      // Atlas costs money: NOTHING may be sent on mount or on refetch.
      expect(events).toHaveLength(0);

      fireEvent.click(screen.getByTestId("clarify-ask-atlas"));

      expect(events).toHaveLength(1);
      const message = String((events[0].detail as { message: string }).message);
      // localized vibe labels, never internal enum values
      expect(message).toContain("Tropical");
      expect(message).toContain("Escapada de Invierno");
      expect(message).not.toContain("big_city");
      expect(message).not.toContain("winter");
      // the decoded origin, never a bare 3-letter code
      expect(message).toContain("New York, New York");
      expect(message).not.toMatch(/\bJFK\b/);
    } finally {
      window.removeEventListener("atlas-open", listener);
    }
  });

  it("omits the origin phrase from the Atlas seed when the origin cannot be named", async () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("atlas-open", listener);
    try {
      stubSurpriseFetch({
        origin: "CANCUN",
        destinations: [],
        degraded: { code: "no_match_possible", reason: "engine prose" },
        preflight: { status: "no_match_possible", wouldMatchIfAny: 40 },
      });

      renderSurpriseMeSection({ vibesSummary: "tropical + winter" });
      await waitFor(() => expect(screen.getByTestId("clarify-ask-atlas")).toBeTruthy());

      expect(events).toHaveLength(0);

      fireEvent.click(screen.getByTestId("clarify-ask-atlas"));

      expect(events).toHaveLength(1);
      const message = String((events[0].detail as { message: string }).message);
      expect(message).not.toContain("CANCUN");
      expect(message).not.toMatch(/\b[A-Z]{3}\b/);
    } finally {
      window.removeEventListener("atlas-open", listener);
    }
  });

  it("keeps the plain degraded banner for non-preflight codes (TP failures stay honest)", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      destinations: [],
      degraded: { code: "no_vibe_match", reason: "engine prose" },
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.getByTestId("surprise-fallback-banner")).toBeTruthy();
    });
    expect(screen.queryByTestId("surprise-clarification-card")).toBeNull();
  });

  it("passes the resolved origin name into the hero subtitle when destinations render", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [
        { name: "Lisbon, Portugal", airline: "TP", flightPrice: "$412 rt", nonstop: true, link: "" },
      ],
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.getByText(/New York, New York/)).toBeTruthy();
    });
  });

  it("hero subtitle renders LOCALIZED vibe labels — an internal enum value on screen is a bug", async () => {
    stubSurpriseFetch({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [
        { name: "Lisbon, Portugal", airline: "TP", flightPrice: "$412 rt", nonstop: true, link: "" },
      ],
    });

    renderSurpriseMeSection({ vibesSummary: "big_city + winter" });

    await waitFor(() => {
      expect(screen.getByText(/Gran Ciudad/)).toBeTruthy();
    });
    expect(screen.getByText(/Escapada de Invierno/)).toBeTruthy();
    expect(screen.queryByText(/big_city/)).toBeNull();
  });

  it("omits the origin phrase when the origin cannot be named — a bare code is never the fallback", async () => {
    // originCode "CANCUN" is not a nameable 3-letter code and the payload has
    // no originName — the subtitle must use the no-origin variant.
    stubSurpriseFetch({
      origin: "CANCUN",
      destinations: [
        { name: "Lisbon, Portugal", airline: "TP", flightPrice: "$412 rt", nonstop: true, link: "" },
      ],
    });

    renderSurpriseMeSection();

    await waitFor(() => {
      expect(screen.queryAllByTestId("atlas-destination-card")).toHaveLength(1);
    });
    expect(screen.queryByText(/CANCUN/)).toBeNull();
  });
});
