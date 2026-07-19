import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import enMessages from "../../messages/en/common.json";
import TripContextStrip from "./TripContextStrip";

afterEach(cleanup);

function renderStrip(props: Partial<Parameters<typeof TripContextStrip>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TripContextStrip
        originLabel="New York, New York (JFK)"
        extraAirportLabels={["Newark, New Jersey", "New York (LaGuardia)"]}
        budget="midrange"
        vibes={["big_city"]}
        interests={[]}
        adults={2}
        childrenCount={0}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("TripContextStrip origin pill (decoded)", () => {
  it("renders the decoded origin city (code alongside the name is fine — never bare) and decoded nearby airports", () => {
    renderStrip();
    expect(screen.getByText(/New York, New York \(JFK\)/)).toBeTruthy();
    expect(screen.getByText(/Newark, New Jersey/)).toBeTruthy();
    expect(screen.getByText(/LaGuardia/)).toBeTruthy();
    // the old raw nearby-airport codes must be gone
    expect(screen.queryByText(/EWR|LGA\b/)).toBeNull();
  });

  it("renders NO origin pill when the origin has no decoded label — a bare code is never the fallback", () => {
    renderStrip({ originLabel: null, extraAirportLabels: [] });
    expect(screen.queryByText(/JFK/)).toBeNull();
  });
});
