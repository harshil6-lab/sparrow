import type { AuthProvider, AuthResult } from "./auth";
import type { User } from "../types";

const USER_KEY = "sparrow.user";

/** Deterministic-ish id without pulling in a uuid dependency. */
function newId(): string {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "friend";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Friend";
}

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Local mock auth. Mimics the async shape of a real provider so swapping in
 * Cognito later is a one-line change in src/lib/api/index.ts.
 */
export class MockAuthProvider implements AuthProvider {
  async getCurrentUser(): Promise<User | null> {
    return readStoredUser();
  }

  async signInWithEmail(email: string): Promise<AuthResult> {
    const user: User = {
      id: newId(),
      email: email.trim().toLowerCase(),
      displayName: nameFromEmail(email.trim()),
      provider: "email",
    };
    writeStoredUser(user);
    return { user };
  }

  /** Simulated Google sign-in: no network, no Google SDK. */
  async signInWithGoogle(): Promise<AuthResult> {
    const user: User = {
      id: newId(),
      email: "sample.tester@gmail.com",
      displayName: "Sample Tester",
      provider: "google",
    };
    writeStoredUser(user);
    return { user };
  }

  async signOut(): Promise<void> {
    writeStoredUser(null);
  }
}
