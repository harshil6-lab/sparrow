import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider, useSession } from "../AuthProvider";
import { LanguageProvider } from "../LanguageProvider";
import { resetApi } from "../api";
import { seedDemo, clearDemo } from "../demo";
import { profileFor } from "../types";
import "../../i18n";

function Probe() {
  return <output>{useSession().kind}</output>;
}

function renderProbe() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  clearDemo();
  localStorage.clear();
  sessionStorage.clear();
});

describe("session kinds", () => {
  it("reports none without a profile", async () => {
    resetApi();
    renderProbe();
    expect(await screen.findByText("none")).toBeInTheDocument();
  });

  it("reports user for a real local mock user", async () => {
    const user = { id: "u_session", email: "user@example.com", displayName: "User", provider: "email" as const };
    localStorage.setItem("sparrow.user", JSON.stringify(user));
    localStorage.setItem(`sparrow.profile.${user.id}`, JSON.stringify({ ...profileFor(user, "en"), introSeen: true, setupComplete: true }));
    resetApi();
    renderProbe();
    await waitFor(() => expect(screen.getByText("user")).toBeInTheDocument());
  });

  it("reports demo for the session-scoped sample Nest", async () => {
    seedDemo();
    resetApi();
    renderProbe();
    await waitFor(() => expect(screen.getByText("demo")).toBeInTheDocument());
  });
});
