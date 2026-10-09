import type { User } from "../types";
import { missionResult } from "../impact";

/** A stored electricity bill. `units` are the household's own meter reading. */
export interface Bill {
  id: string;
  /** Billing month as "YYYY-MM". */
  month: string;
  units: number;
  /** Optional locally-stored photo (data URL). Never parsed. */
  photoDataUrl?: string;
  /** True when this bill beat the previous one by the verified threshold. */
  verified: boolean;
  createdAt: string;
}

export interface Dashboard {
  /** Newest first. */
  bills: Bill[];
  missionDone: boolean;
  /** Demo mode: every derived figure must carry a SAMPLE badge. */
  demo: boolean;
}

export interface AddBillInput {
  month: string;
  units: number;
  photoDataUrl?: string;
}

/**
 * The data surface behind which the real HTTP client will sit in Run B.
 * Everything here is local (localStorage) while VITE_USE_MOCK=true.
 */
export interface DataProvider {
  getDashboard(user: User): Promise<Dashboard>;
  getBills(user: User): Promise<Bill[]>;
  addBill(user: User, input: AddBillInput): Promise<Bill>;
  completeMission(user: User): Promise<void>;
  /** "Try with sample data": seed two sample bills, or clear them. */
  setDemo(user: User, demo: boolean): Promise<void>;
}

const BILLS = "sparrow.bills.";
const MISSION = "sparrow.mission.";
const DEMO = "sparrow.demo.";

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

function monthOffset(base: Date, offset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Per-user bill store in localStorage. New real users start with zero bills. */
export class MockDataProvider implements DataProvider {
  async getBills(user: User): Promise<Bill[]> {
    return read<Bill[]>(BILLS + user.id, []);
  }

  async getDashboard(user: User): Promise<Dashboard> {
    return {
      bills: await this.getBills(user),
      missionDone: read<boolean>(MISSION + user.id, false),
      demo: read<boolean>(DEMO + user.id, false),
    };
  }

  async addBill(user: User, input: AddBillInput): Promise<Bill> {
    const bills = await this.getBills(user);
    const previous = bills[0];
    const bill: Bill = {
      id: newId(),
      month: input.month,
      units: input.units,
      verified: previous ? missionResult(previous.units, input.units).verified : false,
      createdAt: new Date().toISOString(),
    };
    if (input.photoDataUrl) bill.photoDataUrl = input.photoDataUrl;
    write(BILLS + user.id, [bill, ...bills]);
    return bill;
  }

  async completeMission(user: User): Promise<void> {
    write(MISSION + user.id, true);
  }

  async setDemo(user: User, demo: boolean): Promise<void> {
    if (!demo) {
      remove(BILLS + user.id);
      remove(MISSION + user.id);
      write(DEMO + user.id, false);
      return;
    }
    const now = new Date();
    const seeded: Bill[] = [
      { id: newId(), month: monthOffset(now, 0), units: 170, verified: true, createdAt: now.toISOString() },
      { id: newId(), month: monthOffset(now, -1), units: 200, verified: false, createdAt: now.toISOString() },
    ];
    seeded[0].verified = missionResult(seeded[1].units, seeded[0].units).verified;
    write(BILLS + user.id, seeded);
    write(MISSION + user.id, false);
    write(DEMO + user.id, true);
  }
}