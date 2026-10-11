import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../AppShell";
import { AuthProvider } from "../../../lib/AuthProvider";
import { LanguageProvider } from "../../../lib/LanguageProvider";
import type { User } from "../../../lib/types";
import "../../../i18n";

const USER: User = { id: "u_test", email: "ananya@example.com", displayName: "Ananya Rao", provider: "email" };
const PROFILE = {
  user: USER,
  introSeen: true,
  setupComplete: true,
  language: "en",
  answers: {
    homeType: "apartment",
    people: "3\u20134 people",
    city: "Pune",
    usualBill: null,
    appliances: ["Air conditioner"],
  },
};

function seed() {
  localStorage.setItem("sparrow.user", JSON.stringify(USER));
  localStorage.setItem(`sparrow.profile.${USER.id}`, JSON.stringify(PROFILE));
  localStorage.setItem("sparrow-language", "en");
}

function renderApp(path: string) {
  seed();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("Solar feature flag", () => {
  it("shows four tabs and never a Solar tab", async () => {
    renderApp("/app");
    expect((await screen.findAllByRole("button", { name: "Home" })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Missions" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Learn" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Me" }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: "Solar" }).length).toBe(0);
  });

  it("does not reach the Solar route while the flag is off", async () => {
    renderApp("/app/solar");
    expect(await screen.findByText("HOW IS MY HOME DOING?")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Solar" }).length).toBe(0);
  });
});

describe("Missions tab", () => {
  it("opens a mission detail sheet and records it without moving the world state", async () => {
    const user = userEvent.setup();
    renderApp("/app/missions");
    expect(await screen.findByRole("heading", { name: "Today\u2019s mission" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /COOLING/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mark as done/i }));
    expect(await screen.findByText("Done today")).toBeInTheDocument();

    // The action is stored, and no bill (and so no world state) was created.
    expect(JSON.parse(localStorage.getItem(`sparrow.missionsDone.${USER.id}`) ?? "[]")).toEqual(["ac"]);
    expect(localStorage.getItem(`sparrow.bills.${USER.id}`)).toBeNull();
  });
});

describe("Learn tab", () => {
  it("shows cited source links for every Learn card", async () => {
    renderApp("/app/learn");
    const links = await screen.findAllByRole("link");
    expect(links.some((link) => link.getAttribute("href")?.includes("AU2613.pdf"))).toBe(true);
    expect(screen.queryByText("Source pending")).not.toBeInTheDocument();
    const httpsLinks = document.querySelectorAll('a[href^="https://"]');
    expect(httpsLinks.length).toBe(7);
    httpsLinks.forEach((link) => expect(link).toHaveAttribute("rel", "noopener noreferrer"));
  });
});
