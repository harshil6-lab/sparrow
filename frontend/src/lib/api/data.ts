import type { User } from "../types";
import { co2Kg, missionResult, rupeesSaved, type MissionResult } from "../impact";
import { emissionFactor } from "../config";

/** A stored electricity bill. `units` are the household's own meter reading. */
export interface Bill {
  id: string;
  /** Billing month as "YYYY-MM". */
  month: string;
  units: number;
  /** Optional amount in rupees, from the user's own bill. */
  amount?: number;
  /** True when this bill beat the previous one by the verified threshold. */
  verified: boolean;
  createdAt: string;
  hasPhoto?: boolean;
  photoUrl?: string;
}

export interface Dashboard {
  /** Newest first. */
  bills: Bill[];
  /** Ids of the missions completed today. Never moves the world state. */
  missionsDone: string[];
  /** True when the recommended standby sweep has been recorded. */
  missionDone: boolean;
  /** Demo mode: every derived figure must carry a SAMPLE badge. */
  demo: boolean;
}

export interface AddBillInput {
  month: string;
  units: number;
  /** Optional rupee amount from the bill. Drives the user's own rate. */
  amount?: number;
}

/**
 * Verification computed by the backend when a bill is stored. The real API
 * returns this next to the stored bill (field names are the server's, snake
 * case). "co2_kg" is absent when the grid factor is unsourced and
 * "rupees_saved" is null when the previous bill had no amount, so the UI hides
 * those figures exactly as before.
 */
export interface Verification {
  baseline: boolean;
  kwh_saved?: number;
  drop_pct?: number;
  verified?: boolean;
  co2_kg?: number;
  rupees_saved?: number | null;
}

export interface AddBillResult {
  bill: Bill;
  verification: Verification;
}

export interface PhotoTicket {
  url: string;
  fields: Record<string, string>;
  key: string;
  maxBytes: number;
  expiresIn: number;
}

export type UploadProgress = (percent: number) => void;

/**
 * Device-local preferences. "Watch on Wi-Fi only" and the reminders live on
 * this device only; the reminders line in the UI says exactly that and never
 * claims a notification was sent.
 */
export interface Settings {
  wifiOnly: boolean;
  /** Ids of Learn notes the user saved. Drives the Learn empty state. */
  savedNotes: string[];
  reminders: {
    enabled: boolean;
    time: string;
    days: string[];
  };
}

export const DEFAULT_SETTINGS: Settings = {
  wifiOnly: true,
  savedNotes: [],
  reminders: { enabled: true, time: "19:00", days: ["Mon", "Wed", "Sat"] },
};

/**
 * The data surface behind which the real HTTP client will sit in Run B.
 * Everything here is local (localStorage) while VITE_USE_MOCK=true.
 */
export interface DataProvider {
  getDashboard(user: User): Promise<Dashboard>;
  getBills(user: User): Promise<Bill[]>;
  /** Stores a bill and returns it with the server-computed verification. */
  addBill(user: User, input: AddBillInput): Promise<AddBillResult>;
  uploadBillPhoto(
    user: User,
    month: string,
    photo: Blob,
    wifiOnly: boolean,
    onProgress?: UploadProgress,
  ): Promise<void>;
  getBillPhoto(user: User, month: string): Promise<string>;
  deleteBillPhoto(user: User, month: string): Promise<void>;
  /** Records a completed mission by id. Bills (and so the world state) are untouched. */
  completeMission(user: User, missionId: string): Promise<void>;
  getSettings(user: User): Promise<Settings>;
  saveSettings(user: User, settings: Settings): Promise<void>;
  /** Removes every stored figure for this user: bills, missions, demo, settings. */
  deleteMe(user: User): Promise<void>;
  /** "Try with sample data": seed two sample bills, or clear them. */
  setDemo(user: User, demo: boolean): Promise<void>;
}

const BILLS = "sparrow.bills.";
const MISSION = "sparrow.mission.";
const MISSIONS_DONE = "sparrow.missionsDone.";
const DEMO = "sparrow.demo.";
const SETTINGS = "sparrow.settings.";
const PHOTO = "sparrow.photo.";
const DEMO_PHOTO_LIMIT = 1024 * 1024;

function newId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode: keep the app usable */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readPhoto(user: User, month: string, namespace: string): string | null {
  return read<string | null>(`${namespace}${PHOTO}${user.id}.${month}`, null);
}

function monthOffset(base: Date, offset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The same verification the backend computes in post_bills, so mock and real
 * modes return an identical shape (and the UI hides missing figures either way).
 */
function verificationFor(previous: Bill | undefined, result: MissionResult | null): Verification {
  if (!previous || !result) return { baseline: true };
  const factor = emissionFactor();
  return {
    baseline: false,
    kwh_saved: result.kwhSaved,
    drop_pct: result.dropPct,
    verified: result.verified,
    rupees_saved: rupeesSaved(result.kwhSaved, previous.amount ?? null, previous.units),
    ...(factor !== null ? { co2_kg: co2Kg(result.kwhSaved, factor) } : {}),
  };
}

/** Per-user bill store in localStorage. New real users start with zero bills. */
export class MockDataProvider implements DataProvider {
  constructor(private readonly namespace = "") {}

  private key(prefix: string, user: User): string {
    return `${this.namespace}${prefix}${user.id}`;
  }

  async getBills(user: User): Promise<Bill[]> {
    return read<Bill[]>(this.key(BILLS, user), []);
  }

  async getMissionsDone(user: User): Promise<string[]> {
    const done = read<string[]>(this.key(MISSIONS_DONE, user), []);
    return Array.isArray(done) ? done : [];
  }

  async getDashboard(user: User): Promise<Dashboard> {
    const missionsDone = await this.getMissionsDone(user);
    return {
      bills: await this.getBills(user),
      missionsDone,
      missionDone: missionsDone.includes("standby_sweep") || read<boolean>(this.key(MISSION, user), false),
      demo: read<boolean>(this.key(DEMO, user), false),
    };
  }

  async addBill(user: User, input: AddBillInput): Promise<AddBillResult> {
    const bills = await this.getBills(user);
    const remaining = bills.filter((bill) => bill.month !== input.month);
    const previous = remaining[0];
    const result = previous ? missionResult(previous.units, input.units) : null;
    const bill: Bill = {
      id: newId(),
      month: input.month,
      units: input.units,
      verified: result ? result.verified : false,
      createdAt: new Date().toISOString(),
      hasPhoto: Boolean(previous?.hasPhoto),
      photoUrl: previous?.photoUrl,
    };
    if (typeof input.amount === "number") bill.amount = input.amount;
    write(this.key(BILLS, user), [bill, ...remaining].sort((a, b) => b.month.localeCompare(a.month)));
    return { bill, verification: verificationFor(previous, result) };
  }

  async uploadBillPhoto(user: User, month: string, photo: Blob): Promise<void> {
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("photo could not be saved"));
      reader.readAsDataURL(photo);
    });
    const existing = Object.keys(localStorage)
      .filter((key) => key.startsWith(`${this.namespace}${PHOTO}${user.id}.`))
      .reduce((total, key) => total + (localStorage.getItem(key)?.length ?? 0), 0);
    if (existing + dataUrl.length > DEMO_PHOTO_LIMIT) throw new Error("demo photo storage limit");
    write(`${this.namespace}${PHOTO}${user.id}.${month}`, dataUrl);
    const bills = await this.getBills(user);
    write(this.key(BILLS, user), bills.map((bill) => bill.month === month ? { ...bill, hasPhoto: true } : bill));
  }

  async getBillPhoto(user: User, month: string): Promise<string> {
    const photo = readPhoto(user, month, this.namespace);
    if (!photo) throw new Error("photo not found");
    return photo;
  }

  async deleteBillPhoto(user: User, month: string): Promise<void> {
    remove(`${this.namespace}${PHOTO}${user.id}.${month}`);
    const bills = await this.getBills(user);
    write(this.key(BILLS, user), bills.map((bill) => bill.month === month ? { ...bill, hasPhoto: false, photoUrl: undefined } : bill));
  }

  async completeMission(user: User, missionId: string): Promise<void> {
    const done = await this.getMissionsDone(user);
    if (!done.includes(missionId)) write(this.key(MISSIONS_DONE, user), [...done, missionId]);
    if (missionId === "standby_sweep") write(this.key(MISSION, user), true);
  }

  async getSettings(user: User): Promise<Settings> {
    const stored = read<Partial<Settings>>(this.key(SETTINGS, user), {});
    return {
      wifiOnly: typeof stored.wifiOnly === "boolean" ? stored.wifiOnly : DEFAULT_SETTINGS.wifiOnly,
      savedNotes: Array.isArray(stored.savedNotes) ? stored.savedNotes : [],
      reminders: { ...DEFAULT_SETTINGS.reminders, ...(stored.reminders ?? {}) },
    };
  }

  async saveSettings(user: User, settings: Settings): Promise<void> {
    write(this.key(SETTINGS, user), settings);
  }

  async deleteMe(user: User): Promise<void> {
    remove(this.key(BILLS, user));
    remove(this.key(MISSION, user));
    remove(this.key(MISSIONS_DONE, user));
    remove(this.key(DEMO, user));
    remove(this.key(SETTINGS, user));
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${this.namespace}${PHOTO}${user.id}.`)) remove(key);
    }
  }

  async setDemo(user: User, demo: boolean): Promise<void> {
    if (!demo) {
      remove(this.key(BILLS, user));
      remove(this.key(MISSION, user));
      remove(this.key(MISSIONS_DONE, user));
      write(this.key(DEMO, user), false);
      return;
    }
    const now = new Date();
    const seeded: Bill[] = [
      { id: newId(), month: monthOffset(now, 0), units: 170, amount: 1275, verified: true, createdAt: now.toISOString() },
      { id: newId(), month: monthOffset(now, -1), units: 200, amount: 1500, verified: false, createdAt: now.toISOString() },
    ];
    seeded[0].verified = missionResult(seeded[1].units, seeded[0].units).verified;
    write(this.key(BILLS, user), seeded);
    write(this.key(MISSION, user), false);
    write(this.key(MISSIONS_DONE, user), []);
    write(this.key(DEMO, user), true);
  }
}
