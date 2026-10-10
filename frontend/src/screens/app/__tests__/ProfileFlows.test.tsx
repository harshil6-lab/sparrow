import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmSheet } from "../ProfileSheets";
import { LanguageList } from "../../../components/ui/LanguageList";
import { LANGUAGES } from "../../../i18n/languages";
import i18n, { persistLanguage, readStoredLanguage } from "../../../i18n";

const noop = vi.fn();

describe("Delete my data", () => {
  it("only confirms on the exact word DELETE", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmSheet open kind="delete" onConfirm={onConfirm} onBack={noop} />);

    const confirm = screen.getByRole("button", { name: "Delete my data" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText("Type DELETE"), "delete");
    expect(confirm).toBeDisabled();

    await user.clear(screen.getByLabelText("Type DELETE"));
    await user.type(screen.getByLabelText("Type DELETE"), "DELETE");
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing but a tap when signing out", () => {
    render(<ConfirmSheet open kind="signout" onConfirm={noop} onBack={noop} />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.queryByLabelText("Type DELETE")).toBeNull();
  });
});

describe("Language picker", () => {
  it("lists all ten languages in their own script and marks the unreviewed ones", () => {
    render(<LanguageList open value="en" onChange={noop} onClose={noop} />);
    for (const lang of LANGUAGES) {
      expect(screen.getByText(lang.native, { exact: false })).toBeInTheDocument();
    }
    // The eight unreviewed languages carry the beta tag; en and hi do not.
    expect(screen.getAllByText("beta", { exact: false }).length).toBe(8);
  });

  it("applies a new language instantly", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LanguageList open value="en" onChange={onChange} onClose={noop} />);
    await user.click(screen.getByText("हिन्दी", { exact: false }));
    expect(onChange).toHaveBeenCalledWith("hi");
  });

  it("persists the choice and applies it to the copy", async () => {
    persistLanguage("hi");
    expect(readStoredLanguage()).toBe("hi");
    await i18n.changeLanguage("hi");
    expect(String(i18n.t("missions.title"))).toBe("आज का मिशन");
    await i18n.changeLanguage("en");
  });
});
