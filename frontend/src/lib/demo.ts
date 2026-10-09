/**
 * Demo-mode intent ("Try with sample data"), carried across the login step.
 * The flag is a pending request: once a user signs in the data provider seeds
 * two sample bills for that user and this flag is cleared.
 */
const KEY = "sparrow.demoPending";

export function requestDemo(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isDemoPending(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearDemoPending(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}