import type { AuthProvider, AuthErrorCode, AuthResult, SignUpResult } from "./auth";
import { AuthError } from "./auth";
import type { User } from "../types";
import {
  COGNITO_CLIENT_ID,
  COGNITO_DOMAIN,
  COGNITO_REGION,
  COGNITO_USER_POOL_ID,
} from "../env";

/**
 * ============================================================================
 * REAL COGNITO PROVIDER (aws-amplify v6, modular)
 * ============================================================================
 * The amplify packages are pulled in with a DYNAMIC import inside these
 * methods only, so nothing in the splash / first-paint path is loaded until a
 * real sign-in is attempted. Mock mode never touches this file's dependencies.
 *
 * All failures surface as an AuthError with a friendly `code`; the login screen
 * maps that code to a translated sentence. Stack traces never reach the UI.
 */
type AuthModule = typeof import("aws-amplify/auth");

let configurePromise: Promise<AuthModule> | null = null;

function redirectUrl(): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/`;
}

function requireConfig(): void {
  if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID || !COGNITO_REGION) {
    throw new AuthError(
      "unknown",
      "Cognito is not configured: set VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID / VITE_COGNITO_REGION.",
    );
  }
}

/** Loads + configures the modular auth module exactly once (lazy). */
function loadAuth(): Promise<AuthModule> {
  requireConfig();
  if (!configurePromise) {
    configurePromise = (async () => {
      const [{ Amplify }, auth] = await Promise.all([import("aws-amplify"), import("aws-amplify/auth")]);
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: COGNITO_USER_POOL_ID,
            userPoolClientId: COGNITO_CLIENT_ID,
            ...(COGNITO_DOMAIN
              ? {
                  loginWith: {
                    oauth: {
                      domain: COGNITO_DOMAIN,
                      scopes: ["openid", "email", "profile"] as string[],
                      redirectSignIn: [redirectUrl()],
                      redirectSignOut: [redirectUrl()],
                      responseType: "code" as const,
                    },
                  },
                }
              : {}),
          },
        },
      });
      return auth;
    })();
  }
  return configurePromise;
}

const ERROR_MAP: Record<string, AuthErrorCode> = {
  NotAuthorizedException: "wrongPassword",
  UserNotFoundException: "wrongPassword",
  UsernameExistsException: "userExists",
  AliasExistsException: "userExists",
  CodeMismatchException: "badCode",
  ExpiredCodeException: "expiredCode",
  UserNotConfirmedException: "unconfirmed",
  InvalidPasswordException: "invalidPassword",
  InvalidParameterException: "invalidPassword",
  LimitExceededException: "limit",
  TooManyRequestsException: "limit",
  NetworkError: "network",
};

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = String((err as { message?: unknown })?.message ?? "");
  return /network|failed to fetch|fetch failed|load failed|timeout/i.test(message);
}

function mapError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const named = err as { name?: string; __type?: string };
  const code =
    ERROR_MAP[named?.name ?? ""] ?? ERROR_MAP[(named?.__type ?? "").split("#").pop() ?? ""] ?? (isNetworkError(err) ? "network" : "unknown");
  return new AuthError(code, named?.name || String(err));
}

function displayName(email: string): string {
  const local = email.split("@")[0] ?? "friend";
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Friend"
  );
}

/** Builds the app user from the Cognito ID token claims. Never a client-sent id. */
function userFromSession(session: Awaited<ReturnType<AuthModule["fetchAuthSession"]>>): User | null {
  const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
  const id = session.userSub ?? (typeof payload?.sub === "string" ? payload.sub : undefined);
  if (!id) return null;
  const email = typeof payload?.email === "string" ? payload.email : "";
  const name = typeof payload?.name === "string" ? payload.name : "";
  const provider: User["provider"] = payload?.identities ? "google" : "email";
  return { id, email, displayName: name || displayName(email), provider };
}

export function createCognitoAuthProvider(): AuthProvider {
  return {
    async getCurrentUser(): Promise<User | null> {
      const auth = await loadAuth();
      const session = await auth.fetchAuthSession();
      return userFromSession(session);
    },

    async signInWithEmail(email: string, password = ""): Promise<AuthResult> {
      const auth = await loadAuth();
      try {
        const output = await auth.signIn({ username: email.trim().toLowerCase(), password });
        if (!output.isSignedIn) {
          const step = output.nextStep?.signInStep;
          if (step === "CONFIRM_SIGN_UP") throw new AuthError("unconfirmed");
          throw new AuthError("unknown", `unexpected sign-in step: ${String(step)}`);
        }
        const user = userFromSession(await auth.fetchAuthSession());
        if (!user) throw new AuthError("unknown", "signed in without a session");
        return { user };
      } catch (err) {
        throw mapError(err);
      }
    },

    async signUp(email: string, password: string): Promise<SignUpResult> {
      const auth = await loadAuth();
      const username = email.trim().toLowerCase();
      try {
        const output = await auth.signUp({
          username,
          password,
          options: { userAttributes: { email: username } },
        });
        return { needsConfirmation: !output.isSignUpComplete, username };
      } catch (err) {
        throw mapError(err);
      }
    },

    async confirmSignUp(email: string, code: string): Promise<void> {
      const auth = await loadAuth();
      try {
        await auth.confirmSignUp({ username: email.trim().toLowerCase(), confirmationCode: code.trim() });
      } catch (err) {
        throw mapError(err);
      }
    },

    async resendSignUpCode(email: string): Promise<void> {
      const auth = await loadAuth();
      try {
        await auth.resendSignUpCode({ username: email.trim().toLowerCase() });
      } catch (err) {
        throw mapError(err);
      }
    },

    async resetPassword(email: string): Promise<void> {
      const auth = await loadAuth();
      try {
        await auth.resetPassword({ username: email.trim().toLowerCase() });
      } catch (err) {
        throw mapError(err);
      }
    },

    async confirmResetPassword(email: string, code: string, password: string): Promise<void> {
      const auth = await loadAuth();
      try {
        await auth.confirmResetPassword({
          username: email.trim().toLowerCase(),
          confirmationCode: code.trim(),
          newPassword: password,
        });
      } catch (err) {
        throw mapError(err);
      }
    },

    /** Google via the Hosted UI: the browser leaves the page, so this never resolves. */
    async signInWithGoogle(): Promise<AuthResult> {
      const auth = await loadAuth();
      await auth.signInWithRedirect({ provider: "Google" });
      return new Promise<AuthResult>(() => {
        /* redirected away */
      });
    },

    async signOut(): Promise<void> {
      const auth = await loadAuth();
      await auth.signOut();
    },

    async idToken(): Promise<string | null> {
      const auth = await loadAuth();
      const session = await auth.fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    },

    async deleteUser(): Promise<void> {
      const auth = await loadAuth();
      await auth.deleteUser();
    },
  };
}
