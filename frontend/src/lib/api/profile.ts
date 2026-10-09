import type { Profile, SetupAnswers } from "../types";
import { EMPTY_ANSWERS, profileFor } from "../types";
import type { User } from "../types";

export interface ProfileProvider {
  load(user: User): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
  clear(): Promise<void>;
}

const PROFILE_PREFIX = "sparrow.profile.";

export class MockProfileProvider implements ProfileProvider {
  async load(user: User): Promise<Profile | null> {
    try {
      const raw = localStorage.getItem(PROFILE_PREFIX + user.id);
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  }

  async save(profile: Profile): Promise<void> {
    try {
      localStorage.setItem(PROFILE_PREFIX + profile.user.id, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }

  async clear(): Promise<void> {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PROFILE_PREFIX)) localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
}

export function ensureProfile(user: User, language: string, existing: Profile | null): Profile {
  if (!existing) return profileFor(user, language);
  return {
    ...existing,
    user,
    answers: { ...EMPTY_ANSWERS, ...existing.answers, appliances: existing.answers?.appliances ?? [] },
  } satisfies Profile;
}

export function withSetup(profile: Profile, answers: Partial<SetupAnswers>): Profile {
  return {
    ...profile,
    setupComplete: true,
    answers: { ...profile.answers, ...answers, appliances: answers.appliances ?? profile.answers.appliances },
  };
}
