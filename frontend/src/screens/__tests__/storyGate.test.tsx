import { describe, expect, it } from "vitest";
import type { Profile } from "../../lib/types";
import { nextRoute, profileFor } from "../../lib/types";
import { storyDoneTarget } from "../../lib/story";

function profile(overrides: Partial<Profile> = {}): Profile {
  const base = profileFor(
    { id: "u1", email: "a@b.com", displayName: "A", provider: "email" },
    "en",
  );
  return { ...base, ...overrides };
}

describe("story gate: nextRoute", () => {
  it("sends signed-out users to login", () => {
    expect(nextRoute(null)).toBe("/login");
  });

  it("sends a new user (introSeen false) to /story", () => {
    expect(nextRoute(profile({ introSeen: false }))).toBe("/story");
  });

  it("sends a user who has seen the intro but not finished setup to /setup", () => {
    expect(nextRoute(profile({ introSeen: true, setupComplete: false }))).toBe("/setup");
  });

  it("sends a fully set-up user to the app", () => {
    expect(nextRoute(profile({ introSeen: true, setupComplete: true }))).toBe("/app");
  });
});

describe("story gate: where a finished story returns to", () => {
  it("first run goes on to setup", () => {
    expect(storyDoneTarget("/story")).toBe("/setup");
  });

  it("watch-again run returns to the app", () => {
    expect(storyDoneTarget("/app/story")).toBe("/app");
  });
});


