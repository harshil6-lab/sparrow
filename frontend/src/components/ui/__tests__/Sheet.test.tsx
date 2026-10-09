import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "../Sheet";

function SheetHarness({ onClose }: { onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} label="Test sheet" closeLabel="Close">
      <button type="button">First</button>
      <button type="button">Last</button>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("renders a modal dialog with the given label", () => {
    render(<SheetHarness onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Test sheet" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus inside the sheet", () => {
    render(<SheetHarness onClose={() => {}} />);
    const close = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(close).toHaveFocus();
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SheetHarness onClose={onClose} />);
    fireEvent.mouseDown(container.querySelector(".overlay")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
