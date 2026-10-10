/**
 * Demo-mode intent ("Try with sample data").
 *
 * A demo user is NOT an authenticated user: while this flag is set the whole
 * API stack is the local mock (see src/lib/api/index.ts), so a demo session
 * makes ZERO network calls — even when the app is built in real mode. The flag
 * is set on the welcome screen and cleared on sign-out / delete.
 */
import type { Bill } from "./api/data";
import { profileFor } from "./types";

const KEY = "sparrow.demo";
export const DEMO_NAMESPACE = "demo:";
export const DEMO_USER = {
  id: "demo-household",
  email: "demo@sparrow.local",
  displayName: "Demo Nest",
  provider: "email" as const,
};

export function requestDemo(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isDemoPending(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1" || localStorage.getItem("sparrow.demoPending") === "1";
  } catch {
    return false;
  }
}

export function clearDemo(): void {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem("sparrow.demoPending");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DEMO_NAMESPACE)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function seedDemo(): void {
  requestDemo();
  const now = new Date();
  const month = (offset: number): string => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
  const previous: Bill = {
    id: "demo-previous",
    month: month(-1),
    units: 200,
    amount: 1500,
    verified: false,
    createdAt: now.toISOString(),
  };
  const current: Bill = {
    id: "demo-current",
    month: month(0),
    units: 170,
    amount: 1275,
    verified: true,
    createdAt: now.toISOString(),
  };
  const profile = profileFor(DEMO_USER, "en");
  profile.introSeen = true;
  profile.setupComplete = true;
  profile.answers = {
    homeType: "apartment",
    people: "3–4 people",
    city: "Pune",
    usualBill: null,
    appliances: ["Air conditioner", "Geyser", "Refrigerator"],
  };
  localStorage.setItem(`${DEMO_NAMESPACE}sparrow.user`, JSON.stringify(DEMO_USER));
  localStorage.setItem(`${DEMO_NAMESPACE}sparrow.profile.${DEMO_USER.id}`, JSON.stringify(profile));
  localStorage.setItem(`${DEMO_NAMESPACE}sparrow.bills.${DEMO_USER.id}`, JSON.stringify([current, previous]));
  localStorage.setItem(`${DEMO_NAMESPACE}sparrow.missionsDone.${DEMO_USER.id}`, JSON.stringify([]));
  localStorage.setItem(`${DEMO_NAMESPACE}sparrow.mission.${DEMO_USER.id}`, "false");
  localStorage.setItem(`${DEMO_NAMESPACE}sparrow.demo.${DEMO_USER.id}`, "true");
}

export function notifyDemoStarted(): void {
  window.dispatchEvent(new Event("sparrow:demo-start"));
}