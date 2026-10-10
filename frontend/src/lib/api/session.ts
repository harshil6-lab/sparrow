/**
 * Cross-module signals for the REAL (HTTP) session. Kept dependency-free so the
 * HTTP provider, the API factory and the React auth context can share it without
 * an import cycle.
 *
 * On a 401 the HTTP provider calls signalUnauthorized(): the auth context signs
 * the user out and the login screen shows the "session expired" notice.
 */
let unauthorizedHandler: (() => void) | null = null;
let sessionExpired = false;

/** Registered once by AuthProvider; cleared on unmount. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function signalUnauthorized(): void {
  sessionExpired = true;
  unauthorizedHandler?.();
}

/** Reads and clears the one-shot "session expired" flag (login screen). */
export function consumeSessionExpired(): boolean {
  const value = sessionExpired;
  sessionExpired = false;
  return value;
}