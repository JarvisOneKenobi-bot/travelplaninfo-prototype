import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import esMessages from "../../messages/es/common.json";
import SurpriseClarificationCard from "./SurpriseClarificationCard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const noop = () => {};

function renderCard(props: Partial<Parameters<typeof SurpriseClarificationCard>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SurpriseClarificationCard
        preflight={{ status: "no_match_possible", wouldMatchIfAny: 40 }}
        vibes={["tropical", "winter"]}
        onMatchAny={noop}
        onUseSuggestion={noop}
        onUseKnownOnly={noop}
        onAskAtlas={noop}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("SurpriseClarificationCard — no_match_possible", () => {
  it("renders localized copy with the honest any-match count and never a fabricated destination", () => {
    renderCard();

    const card = screen.getByTestId("surprise-clarification-card");
    expect(card.textContent).toContain("40");
    // localized vibe labels, not raw internal values
    expect(card.textContent).toContain("Tropical");
    expect(card.textContent).toContain("Escapada de Invierno");
    expect(card.textContent).not.toContain("big_city");
    // no destination or price appears — the card clarifies, it does not invent results
    expect(card.textContent).not.toMatch(/\$\d/);
  });

  it("match-any button reports the count and fires the callback", () => {
    const onMatchAny = vi.fn();
    renderCard({ onMatchAny });

    fireEvent.click(screen.getByTestId("clarify-match-any"));
    expect(onMatchAny).toHaveBeenCalledTimes(1);
  });

  it("offers Ask Atlas", () => {
    const onAskAtlas = vi.fn();
    renderCard({ onAskAtlas });

    fireEvent.click(screen.getByTestId("clarify-ask-atlas"));
    expect(onAskAtlas).toHaveBeenCalledTimes(1);
  });

  it("offers no month chips — for a preflight miss the month cannot change the outcome, and a control that cannot work is a dead end", () => {
    renderCard();
    expect(screen.queryAllByTestId("clarify-month")).toHaveLength(0);
  });
});

describe("SurpriseClarificationCard — unknown_vibes", () => {
  it("names the unrecognized wish, offers canonical suggestion chips and a known-only search", () => {
    const onUseSuggestion = vi.fn();
    const onUseKnownOnly = vi.fn();
    renderCard({
      preflight: { status: "unknown_vibes", unknown: ["cata de vinos"], suggestions: ["foodie"] },
      vibes: ["cata de vinos", "beach"],
      onUseSuggestion,
      onUseKnownOnly,
    });

    const card = screen.getByTestId("surprise-clarification-card");
    expect(card.textContent).toContain("cata de vinos");
    // the suggestion chip carries the localized label, not the internal value
    expect(screen.getByTestId("clarify-suggestion").textContent).toContain("Gastronomía");

    fireEvent.click(screen.getByTestId("clarify-suggestion"));
    expect(onUseSuggestion).toHaveBeenCalledWith("foodie");

    fireEvent.click(screen.getByTestId("clarify-use-known"));
    expect(onUseKnownOnly).toHaveBeenCalledTimes(1);
  });
});
