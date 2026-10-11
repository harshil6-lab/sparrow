import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { SplashScreen } from "../SplashScreen";

const env = vi.hoisted(() => ({ USE_MOCK: false }));
vi.mock("../../lib/env", () => ({
  get USE_MOCK() {
    return env.USE_MOCK;
  },
}));

vi.mock("../../lib/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn() }),
}));

const auth = vi.hoisted(() => ({
  ready: true,
  profile: null as unknown,
  completeOAuthRedirect: vi.fn(),
}));
vi.mock("../../lib/AuthProvider", () => ({
  useAuth: () => ({
    ready: auth.ready,
    profile: auth.profile,
    completeOAuthRedirect: auth.completeOAuthRedirect,
  }),
}));

function renderSplash() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/welcome" element={<div>WELCOME</div>} />
          <Route path="/login" element={<div>LOGIN</div>} />
          <Route path="/app" element={<div>APP GATE</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  vi.clearAllMocks();
  env.USE_MOCK = false;
  auth.ready = true;
  auth.profile = null;
  window.history.replaceState({}, "", "/");
});

describe("splash OAuth return", () => {
  it("does not redirect until the code exchange finishes", async () => {
    let release: ((value: { profile: unknown; error: string | null }) => void) | undefined;
    auth.completeOAuthRedirect.mockImplementation(
      () => new Promise((resolve) => {
        release = resolve;
      }),
    );
    window.history.replaceState({}, "", "/?code=abc&state=xyz");

    renderSplash();

    expect(screen.getByText("Signing you in...")).toBeInTheDocument();
    expect(screen.queryByText("WELCOME")).toBeNull();
    expect(screen.queryByText("APP GATE")).toBeNull();

    await act(async () => {
      release?.({ profile: { introSeen: true, setupComplete: true }, error: null });
    });

    expect(await screen.findByText("APP GATE")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("shows the friendly failure with the provider description", async () => {
    auth.completeOAuthRedirect.mockResolvedValue({ profile: null, error: "access_denied" });
    window.history.replaceState({}, "", "/?error=access_denied");

    renderSplash();

    expect(await screen.findByText(/couldn't finish signing you in/i)).toBeInTheDocument();
    expect(screen.getByText(/access_denied/)).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("renders the normal splash when there is no OAuth query", () => {
    renderSplash();
    expect(screen.getByText("Enter Sparrow")).toBeInTheDocument();
    expect(auth.completeOAuthRedirect).not.toHaveBeenCalled();
  });
});