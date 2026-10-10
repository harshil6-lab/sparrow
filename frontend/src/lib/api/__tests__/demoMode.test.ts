import { afterEach, describe, expect, it, vi } from "vitest";
import { profileFor, type User } from "../../types";

const demoUser: User = { id: "u_demo", email: "demo@example.com", displayName: "Demo", provider: "email" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("demo mode is fully local", () => {
  /**
   * "Try with sample data" must make ZERO network calls even when the build is
   * real-mode (VITE_USE_MOCK=false). A demo user is NOT an authenticated user.
   */
  it("runs the whole stack on the mock providers with no fetch calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_USE_MOCK", "false");
    sessionStorage.setItem("sparrow.demo", "1");
    vi.resetModules();

    const { createApi } = await import("../index");
    const api = createApi();

    // Mock auth: no Cognito, no ID token.
    expect(await api.auth.idToken()).toBeNull();
    const { user } = await api.auth.signInWithEmail("demo@example.com", "password123");

    await api.data.setDemo(user, true);
    const dash = await api.data.getDashboard(user);
    expect(dash.demo).toBe(true);
    expect(dash.bills.map((bill) => bill.units)).toEqual([170, 200]);
    // The SAMPLE bill carries a SAMPLE amount (200 units = Rs 1,500).
    expect(dash.bills[1].amount).toBe(1500);

    await api.data.addBill(user, { month: "2025-07", units: 150 });
    await api.data.completeMission(user, "ac");
    await api.data.getSettings(user);
    await api.profiles.save(profileFor(user, "en"));
    await api.data.deleteMe(user);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps dev/test mock mode unchanged (no fetch either)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();

    const { createApi } = await import("../index");
    const api = createApi();
    expect(await api.auth.idToken()).toBeNull();
    const dash = await api.data.getDashboard(demoUser);
    expect(dash.demo).toBe(false);
    expect(dash.bills).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});