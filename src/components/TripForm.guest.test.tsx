// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TripForm from "./TripForm";
import { writeGuestPrefs } from "@/lib/guest-prefs";

// TripForm mounts in 'chooser' mode and depends on router/places/carousel — mirror TripForm.test.tsx's mocks.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePlacesAutocomplete", () => ({ usePlacesAutocomplete: () => {} }));
vi.mock("./PackageDealsCarousel", () => ({ default: () => null }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

beforeEach(() => {
  localStorage.clear();
  // /api/user/preferences returns guest defaults (empty home_airport)
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ home_airport: "", interests: [] }) })) as unknown as typeof fetch);
});

describe("TripForm guest origin pre-fill", () => {
  it("pre-fills origin from guest prefs when unauthenticated + API has none", async () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    render(<TripForm />);
    // Enter flight mode so the origin input renders. With the k=>k next-intl mock, the flight card label
    // is the literal key "pathATitle" (the button's onClick calls selectMode('flight')).
    fireEvent.click(screen.getByText("pathATitle"));
    await waitFor(() => {
      expect((screen.getByTestId("trip-origin") as HTMLInputElement).value).toBe("MIA");
    });
  });
});
