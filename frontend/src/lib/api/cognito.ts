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
 * maps that code to a translated sentence. Stack traces never reach the UI. The
 * raw provider error name rides along in `detail` for the real-mode Details line.
 */
type AuthModule = typeof import("aws-amplify/auth");

let configurePromise: Promise<AuthModule> | null = null;

/**
 * The OAuth callback must byte-for-byte match an allowed Cognito callback URL.
 * On the SPA that is the bare origin with a trailing slash:
 * https://main.d27dxqpx3jzuju.amplifyapp.com/ (prod) and
 * http://localhost:5173/ (dev). `window.location.origin` gives exactly that.
 */
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

/** Provider error name, preferring the AWS `__type` tail when `name` is generic. */
function errorName(err: unknown): string {
  const named = err as { name?: string; __type?: string };
  const tail = (named?.__type ?? "").split("#").pop() ?? "";
  return named?.name || tail;
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = String((err as { message?: unknown })?.message ?? "");
  return /network|failed to fetch|fetch failed|load failed|timeout/i.test(message);
}

function mapError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const named = err as { name?: string; __type?: string; message?: string };
  const techName = errorName(err);
  const tail = (named?.__type ?? "").split("#").pop() ?? "";
  const code = ERROR_MAP[named?.name ?? ""] ?? ERROR_MAP[tail] ?? (isNetworkError(err) ? "network" : "unknown");
  const message = typeof named?.message === "string" && named.message ? named.message : techName;
  return new AuthError(code, message, techName || undefined);
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

/** True when the URL is an OAuth callback (success code or a provider error). */
export function hasOAuthRedirect(search: string): boolean {
  return /[?&](code|error|error_description)=/.test(search);
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
        // NotAuthorizedException here means the account is already confirmed,
        // not that a password was wrong. UserNotFound means there is no account.
        const name = errorName(err);
        if (name === "NotAuthorizedException") throw new AuthError("alreadyConfirmed", undefined, name);
        if (name === "UserNotFoundException") throw new AuthError("userNotFound", undefined, name);
        throw mapError(err);
      }
    },

    async resendSignUpCode(email: string): Promise<void> {
      const auth = await loadAuth();
      try {
        await auth.resendSignUpCode({ username: email.trim().toLowerCase() });
      } catch (err) {
        const name = errorName(err);
        if (name === "UserNotFoundException") throw new AuthError("userNotFound", undefined, name);
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

    /**
     * Finishes a Hosted-UI (Google) return. `Amplify.configure()` is what makes
     * Amplify read `?code=` from the URL and exchange it, so we configure first,
     * then wait for the Hub `signInWithRedirect` / `signInWithRedirect_failure`
     * event (and the parked `fetchAuthSession`) before resolving. Never rejects.
     */
    async completeOAuthRedirect(): Promise<{ user: User | null; error: string | null }> {
      const auth = await loadAuth();
      const { Hub } = await import("aws-amplify/utils");
      return new Promise((resolve) => {
        let settled = false;
        const hold: { timer?: ReturnType<typeof setTimeout> } = {};
        const unsub = Hub.listen("auth", ({ payload }) => {
          if (payload.event === "signInWithRedirect") {
            void readSession();
          } else if (payload.event === "signInWithRedirect_failure") {
            const error = (payload.data as { error?: { message?: string; name?: string } } | undefined)?.error;
            finish({ user: null, error: error?.message ?? error?.name ?? "signInWithRedirect_failure" });
          }
        });
        function finish(result: { user: User | null; error: string | null }): void {
          if (settled) return;
          settled = true;
          if (hold.timer !== undefined) clearTimeout(hold.timer);
          unsub();
          resolve(result);
        }
        async function readSession(): Promise<void> {
          try {
            const user = userFromSession(await auth.fetchAuthSession());
            finish({ user, error: null });
          } catch (err) {
            finish({ user: null, error: mapError(err).message });
          }
        }
        // Backstop: never leave the splash hanging if no Hub event arrives.
        hold.timer = setTimeout(() => finish({ user: null, error: null }), 20000);
        // Also covers a flow that already completed before we subscribed.
        void readSession();
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