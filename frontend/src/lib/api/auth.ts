import type { User } from "../types";

export interface AuthResult {
  user: User;
}

/**
 * Auth surface for Sparrow. Two implementations exist:
 *  - MockAuthProvider (localStorage) — used while `VITE_USE_MOCK=true`.
 *  - CognitoAuthProvider — NOT IMPLEMENTED YET (see src/lib/api/cognito.ts).
 */
export interface AuthProvider {
  /** Persisted session, if any. Resolves to null when signed out. */
  getCurrentUser(): Promise<User | null>;
  signInWithEmail(email: string): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signOut(): Promise<void>;
}

