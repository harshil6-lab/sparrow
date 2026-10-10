import { describe, expect, it, beforeEach } from "vitest";
import { MockDataProvider } from "../data";
import { worldState } from "../../world";
import type { User } from "../../types";

const user: User = { id: "u_test", email: "a@b.com", displayName: "Ananya", provider: "email" };

describe("mock data provider (per user, localStorage)", () => {
  const data = new MockDataProvider();

  beforeEach(() => {
    localStorage.clear();
  });

  it("starts a new real user with zero bills", async () => {
    const dash = await data.getDashboard(user);
    expect(dash.bills).toEqual([]);
    expect(dash.missionDone).toBe(false);
    expect(dash.demo).toBe(false);
    expect(worldState(dash.bills)).toBe("dawn");
  });

  it("keeps bills per user", async () => {
    await data.addBill(user, { month: "2025-05", units: 200 });
    const other = await data.getDashboard({ ...user, id: "u_other" });
    expect(other.bills).toEqual([]);
  });

  it("treats the first bill as an unverified baseline", async () => {
    const first = await data.addBill(user, { month: "2025-05", units: 200 });
    expect(first.verified).toBe(false);
  });

  it("verifies a later bill using the impact math (200 -> 170)", async () => {
    await data.addBill(user, { month: "2025-05", units: 200 });
    const second = await data.addBill(user, { month: "2025-06", units: 170 });
    expect(second.verified).toBe(true);
    const bills = await data.getBills(user);
    expect(bills.map((b) => b.units)).toEqual([170, 200]);
    expect(worldState(bills)).toBe("thriving");
  });

  it("seeds two SAMPLE bills in demo mode and clears them on exit", async () => {
    await data.setDemo(user, true);
    const dash = await data.getDashboard(user);
    expect(dash.demo).toBe(true);
    expect(dash.bills.map((b) => b.units)).toEqual([170, 200]);
    expect(worldState(dash.bills)).toBe("thriving");
    await data.setDemo(user, false);
    const cleared = await data.getDashboard(user);
    expect(cleared.bills).toEqual([]);
    expect(cleared.demo).toBe(false);
  });

  it("records a completed mission without ever changing world state", async () => {
    await data.addBill(user, { month: "2025-05", units: 200 });
    await data.addBill(user, { month: "2025-06", units: 180 });
    const before = await data.getBills(user);
    expect(worldState(before)).toBe("fresh");
    await data.completeMission(user);
    const after = await data.getBills(user);
    expect(worldState(after)).toBe("fresh");
    expect((await data.getDashboard(user)).missionDone).toBe(true);
    expect(after.map((b) => b.units)).toEqual(before.map((b) => b.units));
  });
});