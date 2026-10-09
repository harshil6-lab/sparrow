import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../App";
import i18n from "../i18n";

describe("app smoke", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    localStorage.clear();
  });

  it("renders the splash at / with the wordmark and language pill", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByText("Sparrow")).toBeInTheDocument();
    expect(screen.getByText("The Indian Energy Saver")).toBeInTheDocument();
    expect(screen.getByText("Enter Sparrow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /English/ })).toBeInTheDocument();
  });

  it("shows all ten languages in their own script in the picker", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /English/ }));
    const dialog = await screen.findByRole("dialog", { name: /Choose your language/ });
    for (const native of ["English", "हिन्दी", "ગુજરાતી", "বাংলা", "தமிழ்", "తెలుగు", "ಕನ್ನಡ", "മലയാളം", "ਪੰਜਾਬੀ"]) {
      expect(within(dialog).getByText(new RegExp(native))).toBeInTheDocument();
    }
  });
});


