import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../index";
import type { User } from "../../types";

const user: User = { id: "u_account", email: "a@b.com", displayName: "Ananya", provider: "email" };

/**
 * Sign out is reversible (the Nest is kept); Delete my data is not. These two
 * flows must never be confused.
 */
describe("account flows", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the Nest when the user signs out", async () => {
    await api.data.addBill(user, { month: "2025-05", units: 200, amount: 1500 });
    await api.data.completeMission(user, "ac");
    await api.data.saveSettings(user, {
      wifiOnly: false,
      savedNotes: ["ac_setpoint"],
    });

    await api.auth.signOut();

    expect((await api.data.getBills(user)).length).toBe(1);
    expect((await api.data.getDashboard(user)).missionsDone).toEqual(["ac"]);
    expect((await api.data.getSettings(user)).wifiOnly).toBe(false);
  });

  it("removes every stored figure on delete", async () => {
    await api.data.addBill(user, { month: "2025-05", units: 200, amount: 1500 });
    await api.data.completeMission(user, "standby_sweep");
    await api.data.setDemo(user, true);

    await api.data.deleteMe(user);
    await api.profiles.clear();

    const dash = await api.data.getDashboard(user);
    expect(dash.bills).toEqual([]);
    expect(dash.missionsDone).toEqual([]);
    expect(dash.missionDone).toBe(false);
    expect(dash.demo).toBe(false);
  });
});