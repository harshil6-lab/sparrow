import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { SignUpResult } from "./api/auth";
import type { Profile, SetupAnswers } from "./types";
import { ensureProfile, withSetup } from "./api/profile";
import { useLanguage } from "./LanguageProvider";
import { clearDemo, isDemoPending } from "./demo";
import { setUnauthorizedHandler } from "./api/session";

interface AuthContextValue {
  ready: boolean;
  profile: Profile | null;
  signInWithEmail: (email: string, password?: string) => Promise<Profile>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendSignUpCode: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmResetPassword: (email: string, code: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<Profile>;
  completeOAuthRedirect: () => Promise<{ profile: Profile | null; error: string | null }>;
  signOut: () => Promise<void>;
  markIntroSeen: (seen?: boolean) => void;
  completeSetup: (answers: Partial<SetupAnswers>) => Promise<void>;
  /** Persists an edited profile (Profile > My Nest). */
  saveProfile: (next: Profile) => Promise<void>;
  /**
   * Deletes the Nest (DELETE /me) and the account. Returns "accountFailed"
   * when the Nest was cleared but the Cognito user could not be removed.
   */
  deleteAccount: () => Promise<"deleted" | "accountFailed">;
  resetDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await api.auth.getCurrentUser();
        if (!active) return;
        if (isDemoPending()) {
          const demoUser = await api.auth.getCurrentUser();
          if (!demoUser) return;
          const demoExisting = await api.profiles.load(demoUser);
          if (!active) return;
          setProfile(ensureProfile(demoUser, language, demoExisting));
          return;
        }
        if (!user) {
          setProfile(null);
          setReady(true);
          return;
        }
        const existing = await api.profiles.load(user);
        if (!active) return;
        setProfile(ensureProfile(user, language, existing));
      } catch {
        // Misconfigured / offline real mode: fall back to a signed-out state
        // rather than leaving the app stuck on the splash.
        if (active && !isDemoPending()) setProfile(null);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
    // Runs once on mount; language is read at sign-in time thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadDemo = () => {
      if (!isDemoPending()) return;
      void (async () => {
        const user = await api.auth.getCurrentUser();
        if (!user) return;
        const existing = await api.profiles.load(user);
        setProfile(ensureProfile(user, language, existing));
        setReady(true);
      })();
    };
    window.addEventListener("sparrow:demo-start", loadDemo);
    return () => window.removeEventListener("sparrow:demo-start", loadDemo);
  }, [language]);

  // The HTTP provider signals a 401 here: sign out so the router sends the user
  // to /login, where the "session expired" notice is shown.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void (async () => {
        try {
          await api.auth.signOut();
        } catch {
          /* already gone */
        }
        clearDemo();
        setProfile(null);
      })();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const persist = useCallback(async (next: Profile): Promise<void> => {
    setProfile(next);
    await api.profiles.save(next);
  }, []);

  const adopt = useCallback(
    async (user: Profile["user"]): Promise<Profile> => {
      const existing = await api.profiles.load(user);
      const next = ensureProfile(user, language, existing);
      await persist(next);
      // "Try with sample data" seeds the two SAMPLE bills locally. A demo user
      // is not an authenticated user; this stays on the mock provider.
      if (isDemoPending()) await api.data.setDemo(user, true);
      return next;
    },
    [language, persist],
  );

  const signInWithEmail = useCallback(
    async (email: string, password?: string): Promise<Profile> => {
      const { user } = await api.auth.signInWithEmail(email, password);
      return adopt(user);
    },
    [adopt],
  );

  const signUp = useCallback(
    (email: string, password: string): Promise<SignUpResult> => api.auth.signUp(email, password),
    [],
  );

  const confirmSignUp = useCallback(async (email: string, code: string): Promise<void> => {
    await api.auth.confirmSignUp(email, code);
  }, []);

  const resendSignUpCode = useCallback(async (email: string): Promise<void> => {
    await api.auth.resendSignUpCode(email);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    await api.auth.resetPassword(email);
  }, []);

  const confirmResetPassword = useCallback(
    async (email: string, code: string, password: string): Promise<void> => {
      await api.auth.confirmResetPassword(email, code, password);
    },
    [],
  );

  const signInWithGoogle = useCallback(async (): Promise<Profile> => {
    const { user } = await api.auth.signInWithGoogle();
    return adopt(user);
  }, [adopt]);

  /**
   * Finishes an OAuth (Google) redirect return. Waits for the code exchange,
   * then adopts the signed-in user. Never throws: a failed profile load leaves
   * the splash in its normal state instead of showing an error.
   */
  const completeOAuthRedirect = useCallback(async (): Promise<{ profile: Profile | null; error: string | null }> => {
    const { user, error } = await api.auth.completeOAuthRedirect();
    if (error) return { profile: null, error };
    if (!user) return { profile: null, error: null };
    try {
      return { profile: await adopt(user), error: null };
    } catch {
      return { profile: null, error: null };
    }
  }, [adopt]);

  const signOut = useCallback(async () => {
    await api.auth.signOut();
    clearDemo();
    setProfile(null);
  }, []);

  const markIntroSeen = useCallback((seen = true) => {
    setProfile((current) => {
      if (!current) return current;
      const next: Profile = { ...current, introSeen: seen };
      if (seen && api.profiles.setIntroSeen) void api.profiles.setIntroSeen(current.user);
      else void api.profiles.save(next);
      return next;
    });
  }, []);

  const completeSetup = useCallback(
    async (answers: Partial<SetupAnswers>) => {
      if (!profile) return;
      await persist(withSetup(profile, answers));
    },
    [profile, persist],
  );

  const saveProfile = useCallback(
    async (next: Profile) => {
      await persist(next);
    },
    [persist],
  );

  const deleteAccount = useCallback(async (): Promise<"deleted" | "accountFailed"> => {
    if (!profile) return "deleted";
    let accountFailed = false;
    try {
      await api.data.deleteMe(profile.user);
    } catch {
      /* Even if the Nest call fails, the local state is still cleared below. */
    }
    try {
      await api.auth.deleteUser();
    } catch {
      accountFailed = true;
    }
    await api.profiles.clear();
    try {
      await api.auth.signOut();
    } catch {
      /* ignore */
    }
    clearDemo();
    setProfile(null);
    return accountFailed ? "accountFailed" : "deleted";
  }, [profile]);

  const resetDemo = useCallback(async (): Promise<void> => {
    if (!profile || !isDemoPending()) return;
    await api.data.setDemo(profile.user, true);
    const existing = await api.profiles.load(profile.user);
    if (existing) setProfile(existing);
  }, [profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      profile,
      signInWithEmail,
      signUp,
      confirmSignUp,
      resendSignUpCode,
      resetPassword,
      confirmResetPassword,
      signInWithGoogle,
      completeOAuthRedirect,
      signOut,
      markIntroSeen,
      completeSetup,
      saveProfile,
      deleteAccount,
      resetDemo,
    }),
    [
      ready,
      profile,
      signInWithEmail,
      signUp,
      confirmSignUp,
      resendSignUpCode,
      resetPassword,
      confirmResetPassword,
      signInWithGoogle,
      completeOAuthRedirect,
      signOut,
      markIntroSeen,
      completeSetup,
      saveProfile,
      deleteAccount,
      resetDemo,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function useSession(): { kind: "user" | "demo" | "none" } {
  const { ready, profile } = useAuth();
  if (!ready || !profile) return { kind: "none" };
  return { kind: isDemoPending() ? "demo" : "user" };
}