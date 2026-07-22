// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BootstrapModal from "./BootstrapModal";
import { GUEST_PREFS_LS_KEY } from "@/lib/guest-prefs";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("BootstrapModal", () => {
  beforeEach(() => localStorage.clear());

  it("keeps Save disabled until a valid 3-letter IATA + 2 interests", () => {
    render(<BootstrapModal onClose={() => {}} />);
    const airport = screen.getByTestId("bootstrap-home-airport");
    const save = screen.getByTestId("bootstrap-save") as HTMLButtonElement;
    fireEvent.change(airport, { target: { value: "MI" } });
    fireEvent.click(screen.getByRole("button", { name: /beach/i }));
    fireEvent.click(screen.getByRole("button", { name: /food/i }));
    expect(save.disabled).toBe(true); // airport not yet 3 letters
    fireEvent.change(airport, { target: { value: "MIA" } });
    expect(save.disabled).toBe(false);
  });

  it("on save, writes the contract shape + dispatches the canonical event", () => {
    const detail = vi.fn();
    window.addEventListener("atlas-onboarding-complete", (e) => detail((e as CustomEvent).detail));
    render(<BootstrapModal onClose={() => {}} />);
    fireEvent.change(screen.getByTestId("bootstrap-home-airport"), { target: { value: "mia" } });
    fireEvent.click(screen.getByRole("button", { name: /beach/i }));
    fireEvent.click(screen.getByRole("button", { name: /food/i }));
    fireEvent.click(screen.getByTestId("bootstrap-save"));
    expect(JSON.parse(localStorage.getItem(GUEST_PREFS_LS_KEY)!)).toEqual({ homeAirport: "MIA", interests: ["beach", "food"] });
    expect(detail).toHaveBeenCalledWith({ homeAirport: "MIA", interests: ["beach", "food"] });
  });
});
