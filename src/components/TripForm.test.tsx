import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import esMessages from "../../messages/es/common.json";
import { CANONICAL_VIBES } from "@/lib/trip-types";
import TripForm from "./TripForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePlacesAutocomplete", () => ({ usePlacesAutocomplete: () => {} }));
vi.mock("./PackageDealsCarousel", () => ({ default: () => null }));

const vibeLabels = esMessages.tripForm.vibes as Record<string, string>;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderForm() {
  // preferences prefetch on mount — keep it inert
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <TripForm />
    </NextIntlClientProvider>
  );
}

function renderExploreForm() {
  renderForm();
  fireEvent.click(screen.getByText(esMessages.tripForm.pathBTitle));
}

function renderFlightForm() {
  renderForm();
  fireEvent.click(screen.getByText(esMessages.tripForm.pathATitle));
}

// Labels like "Aventura" also exist in the INTERESTS section — scope every
// query to the vibes section (its heading is tripForm.whatVibes).
function vibesSection() {
  const heading = screen.getByText(esMessages.tripForm.whatVibes);
  return within(heading.closest("div") as HTMLElement);
}

describe("TripForm nearby-airport prompt", () => {
  it("renders nearby airport names with their codes instead of a bare code list", () => {
    renderFlightForm();

    fireEvent.change(screen.getByPlaceholderText(esMessages.tripForm.airportCodePlaceholder), {
      target: { value: "MIA" },
    });

    const prompt = screen.getByText(new RegExp(esMessages.tripForm.searchNearbyAirports));
    expect(prompt.textContent).toContain("Fort Lauderdale, Florida (FLL)");
    expect(prompt.textContent).toContain("West Palm Beach, Florida (PBI)");
    expect(prompt.textContent).not.toMatch(/:\s*FLL,\s*PBI\s*$/);
  });
});

describe("TripForm vibe picker (canonical, localized)", () => {
  it("renders all 11 canonical vibes as chips with localized labels", () => {
    renderExploreForm();

    expect(CANONICAL_VIBES).toHaveLength(11);
    for (const vibe of CANONICAL_VIBES) {
      expect(vibeLabels[vibe], `missing es translation for tripForm.vibes.${vibe}`).toBeTruthy();
      expect(
        vibesSection().getByRole("button", { name: new RegExp(vibeLabels[vibe]) }),
        `chip for "${vibe}" not rendered`
      ).toBeTruthy();
    }
  });

  it("the previously unreachable vibes are selectable", () => {
    renderExploreForm();

    for (const vibe of ["foodie", "romantic", "nightlife", "family"]) {
      const chip = vibesSection().getByRole("button", { name: new RegExp(vibeLabels[vibe]) });
      fireEvent.click(chip);
      expect(chip.className, `"${vibe}" chip did not toggle selected`).toContain("bg-pink-100");
      fireEvent.click(chip);
      expect(chip.className, `"${vibe}" chip did not toggle deselected`).not.toContain("bg-pink-100");
    }
  });
});
