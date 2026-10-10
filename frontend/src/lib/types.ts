/** The shape of a signed-in Sparrow user. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  provider: "email" | "google";
}

export type HomeType = "apartment" | "independent" | "row";

export interface SetupAnswers {
  homeType: HomeType | null;
  people: string | null;
  city: string | null;
  usualBill: string | null;
  appliances: string[];
}

/** Everything stored against a user's "Nest". */
export interface Profile {
  user: User;
  introSeen: boolean;
  setupComplete: boolean;
  language: string;
  answers: SetupAnswers;
}

export const EMPTY_ANSWERS: SetupAnswers = {
  homeType: null,
  people: null,
  city: null,
  usualBill: null,
  appliances: [],
};

export function profileFor(user: User, language: string): Profile {
  return {
    user,
    introSeen: false,
    setupComplete: false,
    language,
    answers: { ...EMPTY_ANSWERS },
  };
}

/**
 * Which route a signed-in user should land on.
 * This is the story-gate decision and is intentionally a pure function so it can be
 * unit-tested without a router or a DOM.
 */
export function nextRoute(profile: Profile | null): "/login" | "/story" | "/setup" | "/app" {
  if (!profile) return "/login";
  if (!profile.introSeen) return "/story";
  if (!profile.setupComplete) return "/setup";
  return "/app";
}

