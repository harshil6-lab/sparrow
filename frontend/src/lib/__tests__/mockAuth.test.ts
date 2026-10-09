import { describe, expect, it, beforeEach } from "vitest";
import { MockAuthProvider } from "../api/mockAuth";
import { MockProfileProvider, ensureProfile, withSetup } from "../api/profile";

describe("mock auth", () => {
  const auth = new MockAuthProvider();

  beforeEach(() => {
    localStorage.clear();
  });

  it("starts signed out", async () => {
    expect(await auth.getCurrentUser()).toBeNull();
  });

  it("signs in with email and persists a session", async () => {
    const { user } = await auth.signInWithEmail("Ananya.Rao@Example.com");
    expect(user.provider).toBe("email");
    expect(user.email).toBe("ananya.rao@example.com");
    expect(user.displayName).toBe("Ananya Rao");
    const restored = await auth.getCurrentUser();
    expect(restored?.id).toBe(user.id);
  });

  it("simulates Google sign-in with no phone/OTP step", async () => {
    const { user } = await auth.signInWithGoogle();
    expect(user.provider).toBe("google");
    expect(user.email).toContain("@");
  });

  it("signs out", async () => {
    await auth.signInWithEmail("a@b.com");
    await auth.signOut();
    expect(await auth.getCurrentUser()).toBeNull();
  });
});

describe("mock profile store", () => {
  const profiles = new MockProfileProvider();

  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps introSeen false for a new profile", async () => {
    const { user } = await new MockAuthProvider().signInWithEmail("new@user.com");
    const profile = ensureProfile(user, "en", null);
    expect(profile.introSeen).toBe(false);
    expect(profile.setupComplete).toBe(false);
    await profiles.save(profile);
    const loaded = await profiles.load(user);
    expect(loaded?.introSeen).toBe(false);
  });

  it("marks setup complete when answers are saved", async () => {
    const { user } = await new MockAuthProvider().signInWithEmail("done@user.com");
    const base = ensureProfile(user, "en", null);
    const saved = withSetup(base, { homeType: "apartment", appliances: ["ac"] });
    expect(saved.setupComplete).toBe(true);
    expect(saved.answers.appliances).toEqual(["ac"]);
    expect(saved.introSeen).toBe(false);
  });
});
