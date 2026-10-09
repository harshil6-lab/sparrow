import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Profile, SetupAnswers } from "./types";
import { ensureProfile, withSetup } from "./api/profile";
import { useLanguage } from "./LanguageProvider";
import { clearDemoPending, isDemoPending } from "./demo";

interface AuthContextValue {
  ready: boolean;
  profile: Profile | null;
  signInWithEmail: (email: string) => Promise<Profile>;
  signInWithGoogle: () => Promise<Profile>;
  signOut: () => Promise<void>;
  markIntroSeen: (seen?: boolean) => void;
  completeSetup: (answers: Partial<SetupAnswers>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await api.auth.getCurrentUser();
      if (!active) return;
      if (!user) {
        setProfile(null);
        setReady(true);
        return;
      }
      const existing = await api.profiles.load(user);
      if (!active) return;
      const ensured = ensureProfile(user, language, existing);
      setProfile(ensured);
      setReady(true);
    })();
    return () => {
      active = false;
    };
    // Runs once on mount; language is read at sign-in time thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (next: Profile): Promise<void> => {
    setProfile(next);
    await api.profiles.save(next);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string): Promise<Profile> => {
      const { user } = await api.auth.signInWithEmail(email);
      const existing = await api.profiles.load(user);
      const next = ensureProfile(user, language, existing);
      await persist(next);
      if (isDemoPending()) {
        await api.data.setDemo(user, true);
        clearDemoPending();
      }
      return next;
    },
    [language, persist],
  );

  const signInWithGoogle = useCallback(async (): Promise<Profile> => {
    const { user } = await api.auth.signInWithGoogle();
    const existing = await api.profiles.load(user);
    const next = ensureProfile(user, language, existing);
    await persist(next);
      if (isDemoPending()) {
        await api.data.setDemo(user, true);
        clearDemoPending();
      }
    return next;
  }, [language, persist]);

  const signOut = useCallback(async () => {
    await api.auth.signOut();
    setProfile(null);
  }, []);

  const markIntroSeen = useCallback(
    (seen = true) => {
      setProfile((current) => {
        if (!current) return current;
        const next: Profile = { ...current, introSeen: seen };
        void api.profiles.save(next);
        return next;
      });
    },
    [],
  );

  const completeSetup = useCallback(
    async (answers: Partial<SetupAnswers>) => {
      if (!profile) return;
      await persist(withSetup(profile, answers));
    },
    [profile, persist],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      profile,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      markIntroSeen,
      completeSetup,
    }),
    [ready, profile, signInWithEmail, signInWithGoogle, signOut, markIntroSeen, completeSetup],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

