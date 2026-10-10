import type { User } from "../types";

export interface AuthResult {
  user: User;
}

/** Result of a sign-up attempt: Cognito emails a code before first sign-in. */
export interface SignUpResult {
  needsConfirmation: boolean;
  /** Cognito username (the email address) to confirm/resend against. */
  username: string;
}

/** Friendly, already-mapped failure codes the login screen turns into copy. */
export type AuthErrorCode =
  | "wrongPassword"
  | "userExists"
  | "badCode"
  | "expiredCode"
  | "unconfirmed"
  | "invalidPassword"
  | "limit"
  | "network"
  | "unknown";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Auth surface for Sparrow. Two implementations exist:
 *  - MockAuthProvider (localStorage) — used while `VITE_USE_MOCK=true` and for
 *    every "Try with sample data" session (a demo user is NOT authenticated).
 *  - CognitoAuthProvider — the real User Pool (dynamic aws-amplify import).
 *
 * Email + password and Google only. There is NO phone/OTP path.
 */
export interface AuthProvider {
  /** Persisted session, if any. Resolves to null when signed out. */
  getCurrentUser(): Promise<User | null>;
  /** Signs in an existing user. Password is required in real mode. */
  signInWithEmail(email: string, password?: string): Promise<AuthResult>;
  /** Registers a new user; Cognito then emails a confirmation code. */
  signUp(email: string, password: string): Promise<SignUpResult>;
  /** Confirms a sign-up with the 6-digit emailed code. */
  confirmSignUp(email: string, code: string): Promise<void>;
  /** Re-sends the sign-up confirmation code. */
  resendSignUpCode(email: string): Promise<void>;
  /** Starts the forgot-password flow (emails a reset code). */
  resetPassword(email: string): Promise<void>;
  /** Completes a reset with the emailed code and a new password. */
  confirmResetPassword(email: string, code: string, password: string): Promise<void>;
  /** Google federated sign-in. Mock mode simulates it; real mode redirects. */
  signInWithGoogle(): Promise<AuthResult>;
  signOut(): Promise<void>;
  /** ID token for the API's `Authorization` header. Null in mock mode. */
  idToken(): Promise<string | null>;
  /** Removes the Cognito account itself (no-op in mock mode). */
  deleteUser(): Promise<void>;
}