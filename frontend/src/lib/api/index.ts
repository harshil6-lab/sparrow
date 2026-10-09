import type { AuthProvider } from "./auth";
import type { ProfileProvider } from "./profile";
import { MockAuthProvider } from "./mockAuth";
import { MockProfileProvider } from "./profile";
import { createCognitoAuthProvider } from "./cognito";
import { USE_MOCK } from "../env";

export interface Api {
  auth: AuthProvider;
  profiles: ProfileProvider;
}

/**
 * Single place that decides which provider stack runs.
 * With `VITE_USE_MOCK=true` everything is local (localStorage); flip the flag
 * (and set the Cognito env vars) to move to the real backend.
 */
export function createApi(): Api {
  if (USE_MOCK) {
    return { auth: new MockAuthProvider(), profiles: new MockProfileProvider() };
  }
  return { auth: createCognitoAuthProvider(), profiles: new MockProfileProvider() };
}

export const api: Api = createApi();
