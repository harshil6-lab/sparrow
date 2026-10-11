import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpDataProvider, HttpError, HttpProfileProvider, HttpProvider, NetworkError } from "../http";
import { nextRoute, type Profile } from "../../types";
import type { User } from "../../types";
import communityContract from "../../../../../contracts/community-payloads.json";

const user: User = { id: "sub-1", email: "a@b.com", displayName: "Ananya", provider: "email" };

/** Minimal Response shape: the provider only reads status / ok / text(). */
function res(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

function provider(overrides: Partial<{ token: string | null; onUnauthorized: () => void }> = {}) {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const http = new HttpProvider({
    baseUrl: "https://api.test",
    getToken: async () => overrides.token ?? "tok-123",
    onUnauthorized: overrides.onUnauthorized,
  });
  return { fetchMock, http };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("http provider (authenticated API)", () => {
  it("builds feed URLs from the shared API contract examples", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(200, { posts: [], cursor: null }));
    const data = new HttpDataProvider(http);
    for (const example of communityContract.valid.feedQueries) {
      await data.community.getCommunityFeed(Number(example.query.limit));
    }
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.test/community/feed?limit=20",
      "https://api.test/community/feed?limit=1",
    ]);
  });

  it("sends the ID token with authentication and only known fields", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(
      res(200, {
        bill: { month: "2025-06", units: 170, verified: true, createdAt: "2025-07-01T00:00:00Z" },
        verification: { baseline: false, kwh_saved: 30, drop_pct: 15, verified: true, co2_kg: 21.3, rupees_saved: 225 },
      }),
    );
    const data = new HttpDataProvider(http);

    const result = await data.addBill(user, {
      month: "2025-06",
      units: 170,
    });

    const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ' + 'tok-123');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({ month: "2025-06", units: 170 });
    expect(result.bill.id).toBe("2025-06");
    expect(result.verification.co2_kg).toBe(21.3);
    expect(result.verification.rupees_saved).toBe(225);
  });

  it("omits amount from the body when the bill has none", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(200, { bill: { month: "2025-05", units: 200 }, verification: { baseline: true } }));
    await new HttpDataProvider(http).addBill(user, { month: "2025-05", units: 200 });
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ month: "2025-05", units: 200 });
  });

  it("returns {baseline:true} for the first bill, hiding co2 and rupees", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(200, { bill: { month: "2025-05", units: 200 }, verification: { baseline: true } }));
    const { verification } = await new HttpDataProvider(http).addBill(user, { month: "2025-05", units: 200 });
    expect(verification).toEqual({ baseline: true });
    expect(verification.co2_kg).toBeUndefined();
    expect(verification.rupees_saved).toBeUndefined();
  });

  it("signs out and throws on 401", async () => {
    const onUnauthorized = vi.fn();
    const { fetchMock, http } = provider({ onUnauthorized });
    fetchMock.mockResolvedValue(res(401, { error: "unauthorized" }));
    await expect(http.request("/me", { method: "GET" })).rejects.toBeInstanceOf(HttpError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("maps a 400 body error to a message (never a stack trace)", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(400, { error: "month must be formatted as YYYY-MM" }));
    await expect(http.request("/bills", { method: "POST", body: {} })).rejects.toThrowError(
      "month must be formatted as YYYY-MM",
    );
  });

  it("retries once for GET on a network failure", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(res(200, { bills: [] }));
    await expect(http.request("/bills", { method: "GET" })).resolves.toEqual({ bills: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a POST", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(http.request("/bills", { method: "POST", body: {} })).rejects.toBeInstanceOf(NetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps GET /bills and GET /missions into a dashboard, never demo", async () => {
    const { fetchMock, http } = provider();
    fetchMock
      .mockResolvedValueOnce(res(200, { bills: [{ month: "2025-05", units: 200, amount: 1500, verified: false }] }))
      .mockResolvedValueOnce(res(200, { missions: [{ id: "standby_sweep", date: "2025-06-01" }] }));
    const dash = await new HttpDataProvider(http).getDashboard();
    expect(dash.demo).toBe(false);
    expect(dash.bills).toEqual([
      { id: "2025-05", month: "2025-05", units: 200, amount: 1500, verified: false, createdAt: expect.any(String) },
    ]);
    expect(dash.missionsDone).toEqual(["standby_sweep"]);
    expect(dash.missionDone).toBe(true);
  });

  it("completes a mission through POST /missions/{id}/complete", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(200, { id: "ac", date: "2025-06-01" }));
    await new HttpDataProvider(http).completeMission(user, "ac");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/missions/ac/complete");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it("deletes everything with DELETE /me", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(204));
    await new HttpDataProvider(http).deleteMe(user);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });
});

describe("http profile provider", () => {
  it("maps GET /me into a Profile and gates the story once", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(
      res(200, {
        language: "hi",
        introSeen: false,
        setupDone: false,
        home: { type: null, people: null, city: null, appliances: [] },
        prefs: { wifiOnly: false },
      }),
    );
    const profile = (await new HttpProfileProvider(http).load(user)) as Profile;
    expect(profile.language).toBe("hi");
    expect(profile.setupComplete).toBe(false);
    expect(profile.answers.appliances).toEqual([]);
    // A brand-new server account has introSeen=false, so the story shows once.
    expect(nextRoute(profile)).toBe("/story");
  });

  it("PUTs only the fields the backend accepts", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(200, {}));
    const profile: Profile = {
      user,
      introSeen: true,
      setupComplete: true,
      language: "en",
      answers: { homeType: "apartment", people: "3-4 people", city: "Pune", usualBill: "1000-2500", appliances: ["ac"] },
    };
    await new HttpProfileProvider(http).save(profile);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(Object.keys(body).sort()).toEqual(["home", "introSeen", "language", "setupDone"]);
    expect(Object.keys(body.home).sort()).toEqual(["appliances", "city", "people", "type"]);
    expect(body.home).toEqual({ type: "apartment", people: "3-4 people", city: "Pune", appliances: ["ac"] });
  });

  it("writes the story gate through POST /me/intro-seen", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(200, {}));
    await new HttpProfileProvider(http).setIntroSeen?.(user);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/me/intro-seen");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it("reads prefs from GET /me and PUTs only prefs on save", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValueOnce(
      res(200, { prefs: { wifiOnly: true } }),
    );
    const data = new HttpDataProvider(http);
    const settings = await data.getSettings(user);
    expect(settings.wifiOnly).toBe(true);

    fetchMock.mockResolvedValueOnce(res(200, {}));
    await data.saveSettings(user, { ...settings, savedNotes: ["ac_setpoint"] });
    const body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(Object.keys(body)).toEqual(["prefs"]);
    expect(body.prefs).toEqual({ wifiOnly: true });
  });
});
