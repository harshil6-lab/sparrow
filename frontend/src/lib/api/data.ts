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

export type CommunityTag = "energy_saving" | "solar" | "trees" | "waste" | "water" | "community_drive" | "other";
export type ReactionType = "grow" | "sun" | "cheer" | "love" | "idea";
export type ReportReason = "spam" | "inappropriate" | "unsafe" | "other";

export interface CommunityComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  isMine: boolean;
}

export interface CommunityPost {
  id: string;
  authorName: string;
  isMine: boolean;
  caption: string;
  tag: CommunityTag;
  photoUrl: string | null;
  createdAt: string;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  commentCount: number;
  status?: "visible" | "hidden";
  comments?: CommunityComment[];
}

export interface CommunityFeed {
  posts: CommunityPost[];
  cursor: string | null;
}

export interface CommunityDataProvider {
  getCommunityFeed(limit?: number, cursor?: string | null): Promise<CommunityFeed>;
  getCommunityPost(id: string): Promise<CommunityPost>;
  createCommunityPost(input: {
    photo: Blob;
    caption: string;
    tag: CommunityTag;
    confirmAdult: boolean;
    onProgress?: UploadProgress;
  }): Promise<CommunityPost>;
  deleteCommunityPost(id: string): Promise<void>;
  setCommunityReaction(id: string, type: ReactionType | null): Promise<CommunityPost>;
  getCommunityComments(id: string, cursor?: string | null): Promise<{ comments: CommunityComment[]; cursor: string | null }>;
  addCommunityComment(id: string, text: string): Promise<CommunityComment>;
  deleteCommunityComment(id: string, commentId: string): Promise<void>;
  reportCommunityPost(id: string, reason: ReportReason): Promise<void>;
}

export type UploadProgress = (percent: number) => void;

/**
 * Device-local preferences. Wi-Fi-only is consumed by photo upload and video
 * playback. There is no notification system, so reminders are not exposed.
 */
export interface Settings {
  wifiOnly: boolean;
  /** Ids of Learn notes the user saved. Drives the Learn empty state. */
  savedNotes: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  wifiOnly: true,
  savedNotes: [],
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
  community: CommunityDataProvider;
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
  readonly community: CommunityDataProvider;

  private readonly communityPosts = new Map<string, CommunityPost[]>();

  constructor(private readonly namespace = "") {
    this.community = this.createCommunityProvider();
  }

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

  private createCommunityProvider(): CommunityDataProvider {
    const reactions = (): Record<ReactionType, number> => ({ grow: 0, sun: 0, cheer: 0, love: 0, idea: 0 });
    const sample = (): CommunityPost[] => [
      { id: "demo-1", authorName: "Asha", isMine: false, caption: "Set the AC a little higher and kept the fan on.", tag: "energy_saving", photoUrl: null, createdAt: new Date(Date.now() - 3600000).toISOString(), reactionCounts: reactions(), myReaction: null, commentCount: 0 },
      { id: "demo-2", authorName: "Ravi", isMine: false, caption: "Our balcony plants are thriving with a little care.", tag: "trees", photoUrl: null, createdAt: new Date(Date.now() - 86400000).toISOString(), reactionCounts: reactions(), myReaction: null, commentCount: 0 },
      { id: "demo-3", authorName: "Meera", isMine: false, caption: "Switched off standby power before bedtime.", tag: "energy_saving", photoUrl: null, createdAt: new Date(Date.now() - 172800000).toISOString(), reactionCounts: reactions(), myReaction: null, commentCount: 0 },
    ];
    const posts = () => {
      const existing = this.communityPosts.get(this.namespace);
      if (existing) return existing;
      const seeded = this.namespace ? sample() : [];
      this.communityPosts.set(this.namespace, seeded);
      return seeded;
    };
    return {
      getCommunityFeed: async () => ({ posts: posts(), cursor: null }),
      getCommunityPost: async (id) => {
        const post = posts().find((entry) => entry.id === id);
        if (!post) throw new Error("post not found");
        return post;
      },
      createCommunityPost: async ({ caption, tag }) => {
        const post: CommunityPost = { id: `demo-${Date.now()}`, authorName: "Demo", isMine: true, caption, tag, photoUrl: null, createdAt: new Date().toISOString(), reactionCounts: reactions(), myReaction: null, commentCount: 0 };
        posts().unshift(post);
        return post;
      },
      deleteCommunityPost: async (id) => {
        this.communityPosts.set(this.namespace, posts().filter((entry) => entry.id !== id));
      },
      setCommunityReaction: async (id, type) => {
        const post = posts().find((entry) => entry.id === id);
        if (!post) throw new Error("post not found");
        if (post.myReaction) post.reactionCounts[post.myReaction] -= 1;
        if (type) post.reactionCounts[type] += 1;
        post.myReaction = type;
        return post;
      },
      getCommunityComments: async () => ({ comments: [], cursor: null }),
      addCommunityComment: async (_id, text) => ({ id: `comment-${Date.now()}`, authorName: "Demo", text, createdAt: new Date().toISOString(), isMine: true }),
      deleteCommunityComment: async () => undefined,
      reportCommunityPost: async () => undefined,
    };
  }
}
