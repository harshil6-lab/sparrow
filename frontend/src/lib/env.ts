/** True when the app should run against in-browser mock providers. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

/** Optional hosted story video. When unset the illustrated frames are used. */
export const STORY_URL = import.meta.env.VITE_STORY_URL ?? "";

/**
 * Solar tab flag. Off by default: the tab bar then shows four tabs and no
 * Solar route is reachable. The Solar code path is kept for later.
 */
export const FEATURE_SOLAR = import.meta.env.VITE_FEATURE_SOLAR === "true";

/** Optional hosted Learn clip. When unset the clip sheet says "Coming soon". */
export const LEARN_CLIP_URL = import.meta.env.VITE_LEARN_CLIP_URL ?? "";

/**
 * Real backend wiring. Empty in dev, filled by .env.production. These are all
 * PUBLIC identifiers (no secrets): the API base URL and the Cognito ids.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
export const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION ?? "";
export const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "";
export const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "";
/** Hosted UI domain, e.g. sparrow-dev-harsh.auth.ap-south-1.amazoncognito.com */
export const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN ?? "";
/** Google federation is opt-in; off unless .env sets VITE_COGNITO_GOOGLE=true. */
export const COGNITO_GOOGLE = import.meta.env.VITE_COGNITO_GOOGLE === "true";
