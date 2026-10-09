/** True when the app should run against in-browser mock providers. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

/** Optional hosted story video. When unset the illustrated frames are used. */
export const STORY_URL = import.meta.env.VITE_STORY_URL ?? "";
