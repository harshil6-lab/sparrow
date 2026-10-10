import type { AuthProvider, AuthResult, SignUpResult } from "./auth";
import type { User } from "../types";

const USER_KEY = "sparrow.user";
const PENDING_KEY = "sparrow.pendingSignup";

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

function userForEmail(email: string, provider: User["provider"] = "email"): User {
  return {
    id: newId(),
    email: email.trim().toLowerCase(),
    displayName: nameFromEmail(email.trim()),
    provider,
  };
}

/**
 * Local mock auth. Mimics the async shape of the real Cognito provider so the
 * two are interchangeable. It never touches the network: the whole demo
 * ("Try with sample data") and every test run on this provider.
 */
export class MockAuthProvider implements AuthProvider {
  constructor(private readonly namespace = "") {}

  private userKey(): string {
    return `${this.namespace}${USER_KEY}`;
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.namespace === "demo:" && !localStorage.getItem(this.userKey())) {
      return { id: "demo-household", email: "demo@sparrow.local", displayName: "Demo Nest", provider: "email" };
    }
    try {
      const raw = localStorage.getItem(this.userKey());
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  /** The password is accepted for interface parity and never checked. */
  async signInWithEmail(email: string): Promise<AuthResult> {
    const user = userForEmail(email);
    this.writeUser(user);
    return { user };
  }

  async signUp(email: string, _password: string): Promise<SignUpResult> {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.trim().toLowerCase() }));
    } catch {
      /* ignore */
    }
    return { needsConfirmation: true, username: email.trim().toLowerCase() };
  }

  /** Mock confirmation signs the new user straight in. */
  async confirmSignUp(email: string): Promise<void> {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    this.writeUser(userForEmail(email));
  }

  async resendSignUpCode(): Promise<void> {
    /* no-op in mock */
  }

  async resetPassword(): Promise<void> {
    /* no-op in mock */
  }

  async confirmResetPassword(): Promise<void> {
    /* no-op in mock */
  }

  /** Simulated Google sign-in: no network, no Google SDK. */
  async signInWithGoogle(): Promise<AuthResult> {
    const user: User = {
      id: newId(),
      email: "sample.tester@gmail.com",
      displayName: "Sample Tester",
      provider: "google",
    };
    this.writeUser(user);
    return { user };
  }

  async signOut(): Promise<void> {
    this.writeUser(null);
  }

  /** The mock has no real ID token: mock data never leaves the device. */
  async idToken(): Promise<string | null> {
    return null;
  }

  async deleteUser(): Promise<void> {
    /* no-op: there is no remote account in mock mode */
  }

  private writeUser(user: User | null): void {
    try {
      if (user) localStorage.setItem(this.userKey(), JSON.stringify(user));
      else localStorage.removeItem(this.userKey());
    } catch {
      /* ignore */
    }
  }
}