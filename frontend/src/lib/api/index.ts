import type { AuthProvider } from "./auth";
import type { ProfileProvider } from "./profile";
import type { DataProvider } from "./data";
import { MockAuthProvider } from "./mockAuth";
import { MockProfileProvider } from "./profile";
import { MockDataProvider } from "./data";
import { createCognitoAuthProvider } from "./cognito";
import { HttpDataProvider, HttpProfileProvider, HttpProvider } from "./http";
import { USE_MOCK } from "../env";
import { isDemoPending } from "../demo";
import { DEMO_NAMESPACE } from "../demo";

export interface Api {
  auth: AuthProvider;
  profiles: ProfileProvider;
  data: DataProvider;
}

/** Everything local (localStorage): dev, tests and every demo session. */
function mockStack(): Api {
  const namespace = isDemoPending() ? DEMO_NAMESPACE : "";
  return {
    auth: new MockAuthProvider(namespace),
    profiles: new MockProfileProvider(namespace),
    data: new MockDataProvider(namespace),
  };
}

/** Cognito auth + the authenticated HTTP API. */
function realStack(): Api {
  const auth = createCognitoAuthProvider();
  const http = new HttpProvider({ getToken: () => auth.idToken() });
  return {
    auth,
    profiles: new HttpProfileProvider(http),
    data: new HttpDataProvider(http),
  };
}

/**
 * Single place that decides which provider stack runs.
 *
 * The mock stack is used when VITE_USE_MOCK=true, and ALSO for a "Try with
 * sample data" session. A demo user is NOT an authenticated user: it never
 * talks to Cognito and never touches the network, even in a real-mode build.
 * Real mode is selected only for a genuine signed-in account.
 */
export function createApi(): Api {
  return USE_MOCK || isDemoPending() ? mockStack() : realStack();
}

export let api: Api = createApi();

/**
 * Re-evaluates the stack. Called when entering demo mode from the welcome
 * screen so the rest of that SPA session runs fully local.
 */
export function resetApi(): Api {
  api = createApi();
  return api;
}