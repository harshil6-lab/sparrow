import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeTab } from "../HomeTab";
import type { Bill } from "../../../lib/api/data";
import "../../../i18n";

const noop = vi.fn();

const bill = (units: number, month = "2025-06"): Bill => ({
  id: `b_${month}_${units}`,
  month,
  units,
  verified: false,
  createdAt: "2025-06-01T00:00:00.000Z",
});

function renderHome(props: Partial<Parameters<typeof HomeTab>[0]> = {}) {
  return render(
    <HomeTab
      state="dawn"
      bills={[]}
      missionDone={false}
      demo={false}
      onBill={noop}
      onSweep={noop}
      onOpenMission={noop}
      onResult={noop}
      {...props}
    />,
  );
}

describe("Home, new user", () => {
  it("shows the dawn copy, zeros and no SAMPLE badge", () => {
    renderHome();
    expect(screen.getByText("Waiting for your first verified bill")).toBeInTheDocument();
    expect(screen.getByText("Your savings start at zero")).toBeInTheDocument();
    expect(screen.getByText("Nothing measured yet")).toBeInTheDocument();
    expect(screen.queryByText("SAMPLE")).toBeNull();
  });
});

describe("Home, verified bills", () => {
  it("labels every derived figure SAMPLE in demo mode", () => {
    renderHome({ state: "thriving", bills: [bill(170), bill(200)], demo: true });
    expect(screen.getByText("30 kWh saved")).toBeInTheDocument();
    expect(screen.getAllByText("SAMPLE").length).toBeGreaterThan(0);
  });

  it("shows the user's own verified result without a SAMPLE badge", () => {
    renderHome({ state: "thriving", bills: [bill(170, "2025-06"), bill(200, "2025-05")] });
    expect(screen.getByText("You saved 30 kWh, verified.")).toBeInTheDocument();
    expect(screen.getByText("30 kWh saved")).toBeInTheDocument();
    expect(screen.getByText("Verified and thriving")).toBeInTheDocument();
    expect(screen.queryByText("SAMPLE")).toBeNull();
  });

  it("shows CO2 and the user's own-rate rupees when the baseline has an amount", () => {
    renderHome({
      state: "thriving",
      bills: [bill(170, "2025-06"), { ...bill(200, "2025-05"), amount: 1500 }],
    });
    expect(screen.getByText("about 21 kg CO₂")).toBeInTheDocument();
    expect(screen.getByText("about ₹225")).toBeInTheDocument();
    expect(screen.queryByText("SAMPLE")).toBeNull();
  });

  it("keeps every derived figure SAMPLE-badged in demo mode", () => {
    renderHome({
      state: "thriving",
      demo: true,
      bills: [bill(170, "2025-06"), { ...bill(200, "2025-05"), amount: 1500 }],
    });
    expect(screen.getByText("about 21 kg CO₂")).toBeInTheDocument();
    expect(screen.getByText("about ₹225")).toBeInTheDocument();
    expect(screen.getAllByText("SAMPLE").length).toBeGreaterThanOrEqual(2);
  });

  it("prompts for the bill amount when the baseline has none", () => {
    renderHome({ state: "thriving", bills: [bill(170, "2025-06"), bill(200, "2025-05")] });
    expect(screen.getByText("Add your bill amount to see rupees")).toBeInTheDocument();
  });
});

describe("Home, completed sweep", () => {
  it("shows the completed subtitle and recorded action", () => {
    renderHome({ state: "dawn", missionDone: true });
    expect(screen.getByText("Standby sweep complete")).toBeInTheDocument();
    expect(screen.getByText("One useful action recorded")).toBeInTheDocument();
  });
});
