import type { AuthProvider, AuthResult } from "./auth";

/**
 * ============================================================================
 * COGNITO STUB — intentionally NOT implemented.
 * ============================================================================
 * This is the seam where AWS Cognito plugs in for Run B. The backend already
 * exposes POST /auth (see infra/template.yaml) and the flow is:
 *
 *   1. Email + password / Google federated sign-in via Cognito Hosted UI or
 *      amazon-cognito-identity-js (email only — there is NO phone/OTP path).
 *   2. Exchange the Cognito tokens for the app session, then load the profile
 *      from the profile API instead of localStorage.
 *
 * Nothing here may ship until the real endpoints and env vars exist.
 */
export function createCognitoAuthProvider(): AuthProvider {
  const notWired = (): never => {
    throw new Error(
      "Cognito is not wired yet. Set VITE_USE_MOCK=true, or implement src/lib/api/cognito.ts in Run B.",
    );
  };
  return {
    getCurrentUser(): Promise<never> {
      return Promise.resolve(notWired());
    },
    signInWithEmail(): Promise<AuthResult> {
      return Promise.resolve(notWired());
    },
    signInWithGoogle(): Promise<AuthResult> {
      return Promise.resolve(notWired());
    },
    signOut(): Promise<void> {
      return Promise.resolve(notWired());
    },
  };
}
