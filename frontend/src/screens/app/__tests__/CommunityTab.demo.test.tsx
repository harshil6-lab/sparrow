import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import { AuthProvider } from "../../../lib/AuthProvider";
import { LanguageProvider } from "../../../lib/LanguageProvider";
import { resetApi } from "../../../lib/api";
import { clearDemo, seedDemo } from "../../../lib/demo";
import { CommunityTab } from "../CommunityTab";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearDemo();
  localStorage.clear();
  sessionStorage.clear();
  resetApi();
});

describe("Community demo mode (local stack)", () => {
  it("makes zero fetch calls and shows SAMPLE community posts", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_USE_MOCK", "false");
    seedDemo();
    resetApi();

    render(
      <MemoryRouter initialEntries={["/app/community"]}>
        <LanguageProvider>
          <AuthProvider>
            <CommunityTab demo onSignUp={vi.fn()} />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Set the AC a little higher and kept the fan on.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Our balcony plants are thriving with a little care.")).toBeInTheDocument();
    expect(screen.getByText("Create your Nest to post and join in")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
