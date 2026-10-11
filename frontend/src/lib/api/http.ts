import type { AppLanguage } from "../../i18n/languages";
import type { Profile, SetupAnswers, User } from "../types";
import type { ProfileProvider } from "./profile";
import type { AddBillInput, AddBillResult, Bill, CommunityComment, CommunityDataProvider, CommunityFeed, CommunityPost, CommunityTag, Dashboard, DataProvider, Settings, UploadProgress } from "./data";
import { DEFAULT_SETTINGS } from "./data";
import { API_URL } from "../env";
import { signalUnauthorized } from "./session";
import { buildBillPayload } from "../bills";
import { buildPhotoAttachPayload, buildPhotoUploadPayload, uploadToPhotoTicket } from "../photos";

/**
 * ============================================================================
 * REAL HTTP PROVIDER (authenticated API Gateway)
 * ============================================================================
 * Sits behind the SAME interfaces as the mock providers, and only runs when
 * VITE_USE_MOCK=false (and demo mode is off). Every request carries the Cognito
 * ID token as `Authorization: Bearer <token>`; a 401 signs the user out and
 * routes to /login with the "session expired" notice.
 *
 * The user id is ALWAYS the token's `sub` â€” the client never sends a user id.
 * Requests contain only the fields the backend accepts; unknown fields would be
 * rejected with 400.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly requestId: string | null;

  constructor(status: number, message?: string, errorCode = "unknown_error", requestId: string | null = null) {
    super(message ?? `HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.errorCode = errorCode;
    this.requestId = requestId;
  }
}

/** Network / offline failure â€” mapped to the existing error states upstream. */
export class NetworkError extends Error {
  constructor(message = "network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

export interface HttpProviderOptions {
  baseUrl?: string;
  getToken: () => Promise<string | null>;
  onUnauthorized?: () => void;
}

interface RequestInitLite {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorMessage(payload: unknown, res: Response): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "message" in value) {
      const message = (value as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }

  }
  return `HTTP ${res.status}`;
}

function responseErrorCode(payload: unknown, res: Response): string {
  if (payload && typeof payload === "object" && "code" in payload) {
    const value = (payload as { code?: unknown }).code;
    if (typeof value === "string" && value) return value;
  }
  return res.headers?.get("x-sparrow-error-code") ?? "unknown_error";
}

function responseHeader(res: Response, name: string): string | null {
  return res.headers?.get(name) ?? null;
}

export class HttpProvider {
  private readonly baseUrl: string;
  private readonly options: HttpProviderOptions;

  constructor(options: HttpProviderOptions) {
    this.options = options;
    this.baseUrl = (options.baseUrl ?? API_URL).replace(/\/+$/, "");
  }

  async request<T>(path: string, init: RequestInitLite): Promise<T> {
    const token = await this.options.getToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = 'Bearer ' + token;
    const url = `${this.baseUrl}${path}`;
    const send = async (): Promise<Response> => {
      try {
        return await fetch(url, {
          method: init.method,
          headers,
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
      } catch (err) {
        throw new NetworkError(err instanceof Error ? err.message : undefined);
      }
    };

    let res: Response;
    try {
      res = await send();
      // One retry, GET only, for transient network / gateway failures.
      if (init.method === "GET" && RETRYABLE_STATUS.has(res.status)) res = await send();
    } catch (err) {
      if (init.method !== "GET") throw err;
      res = await send();
    }

    if (res.status === 401) {
      (this.options.onUnauthorized ?? signalUnauthorized)();
      throw new HttpError(401, "session expired", responseErrorCode(null, res), responseHeader(res, "apigw-requestid"));
    }
    const payload = await parseBody(res);
    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.error("[sparrow] API error", { status: res.status, body: payload });
      }
      throw new HttpError(
        res.status,
        errorMessage(payload, res),
        responseErrorCode(payload, res),
        responseHeader(res, "apigw-requestid") ?? responseHeader(res, "x-amzn-requestid"),
      );
    }
    return payload as T;
  }
}

// --- profile mapping --------------------------------------------------------

interface ServerProfile {
  displayName?: string | null;
  language?: string;
  introSeen?: boolean;
  setupDone?: boolean;
  home?: { type?: string | null; people?: string | null; city?: string | null; appliances?: string[] };
  prefs?: { wifiOnly?: boolean };
}

function profileFromServer(user: User, doc: ServerProfile): Profile {
  return {
    user,
    displayName: doc.displayName ?? null,
    introSeen: Boolean(doc.introSeen),
    setupComplete: Boolean(doc.setupDone),
    language: doc.language ?? "en",
    answers: {
      homeType: (doc.home?.type ?? null) as SetupAnswers["homeType"],
      people: doc.home?.people ?? null,
      city: doc.home?.city ?? null,
      usualBill: null,
      appliances: Array.isArray(doc.home?.appliances) ? doc.home.appliances : [],
    },
  };
}

/** Only fields the backend accepts (PROFILE_FIELDS + home/prefs sub-fields). */
function profilePatch(profile: Profile): Record<string, unknown> {
  return {
    ...(profile.displayName ? { displayName: profile.displayName } : {}),
    language: profile.language as AppLanguage,
    introSeen: profile.introSeen,
    setupDone: profile.setupComplete,
    home: {
      type: profile.answers.homeType,
      people: profile.answers.people,
      city: profile.answers.city,
      appliances: profile.answers.appliances,
    },
  };
}

/**
 * Profile provider over GET/PUT /me. GET /me creates the default profile on the
 * first call, so a brand-new account has introSeen=false and the story shows once.
 */
export class HttpProfileProvider implements ProfileProvider {
  private readonly http: HttpProvider;

  constructor(http: HttpProvider) {
    this.http = http;
  }

  async load(user: User): Promise<Profile | null> {
    const doc = await this.http.request<ServerProfile>("/me", { method: "GET" });
    return doc ? profileFromServer(user, doc) : null;
  }

  async save(profile: Profile): Promise<void> {
    await this.http.request("/me", { method: "PUT", body: profilePatch(profile) });
  }

  async clear(): Promise<void> {
    /* Server state is removed by DELETE /me (HttpDataProvider.deleteMe). */
  }

  /** POST /me/intro-seen â€” the dedicated story-gate write. */
  async setIntroSeen(_user?: User): Promise<void> {
    await this.http.request("/me/intro-seen", { method: "POST" });
  }
}

// --- bills, missions and settings -------------------------------------------

interface ServerBill {
  month: string;
  units: number;
  amount?: number;
  verified?: boolean;
  createdAt?: string;
  hasPhoto?: boolean;
}

function billFromServer(row: ServerBill): Bill {
  const bill: Bill = {
    id: row.month,
    month: row.month,
    units: row.units,
    verified: Boolean(row.verified),
    createdAt: row.createdAt ?? new Date().toISOString(),
  };
  if (typeof row.amount === "number") bill.amount = row.amount;
  if (typeof row.hasPhoto === "boolean") bill.hasPhoto = row.hasPhoto;
  return bill;
}

function notesKey(user: User): string {
  return `sparrow.learnNotes.${user.id}`;
}

function readNotes(user: User): string[] {
  try {
    const raw = localStorage.getItem(notesKey(user));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeNotes(user: User, notes: string[]): void {
  try {
    localStorage.setItem(notesKey(user), JSON.stringify(notes));
  } catch {
    /* ignore */
  }
}

export class HttpDataProvider implements DataProvider {
  private readonly http: HttpProvider;
  readonly community: CommunityDataProvider;

  constructor(http: HttpProvider) {
    this.http = http;
    this.community = {
      getCommunityFeed: (limit = 20, cursor = null) => this.http.request<CommunityFeed>(`/community/feed?${limit ? `limit=${limit}` : ""}${limit && cursor ? "&" : ""}${cursor ? `cursor=${encodeURIComponent(cursor)}` : ""}`, { method: "GET" }),
      getCommunityPost: (id) => this.http.request<CommunityPost>(`/community/posts/${encodeURIComponent(id)}`, { method: "GET" }),
      createCommunityPost: (input) => this.createCommunityPost(input),
      deleteCommunityPost: (id) => this.http.request<void>(`/community/posts/${encodeURIComponent(id)}`, { method: "DELETE" }),
      setCommunityReaction: (id, type) => this.http.request<CommunityPost>(`/community/posts/${encodeURIComponent(id)}/reaction`, { method: "PUT", body: { type } }),
      getCommunityComments: (id, cursor = null) => this.http.request<{ comments: CommunityComment[]; cursor: string | null }>(`/community/posts/${encodeURIComponent(id)}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { method: "GET" }),
      addCommunityComment: (id, text) => this.http.request<CommunityComment>(`/community/posts/${encodeURIComponent(id)}/comments`, { method: "POST", body: { text } }),
      deleteCommunityComment: (id, commentId) => this.http.request<void>(`/community/posts/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" }),
      reportCommunityPost: (id, reason) => this.http.request<void>(`/community/posts/${encodeURIComponent(id)}/report`, { method: "POST", body: { reason } }),
    };
  }

  private async createCommunityPost(input: {
    photo: Blob;
    caption: string;
    tag: CommunityTag;
    confirmAdult: boolean;
    onProgress?: UploadProgress;
  }): Promise<CommunityPost> {
    const ticket = await this.http.request<{ url: string; fields: Record<string, string>; key: string }>("/community/upload-ticket", {
      method: "POST",
      body: { contentType: input.photo.type, size: input.photo.size },
    });
    const upload = (candidate: typeof ticket) => uploadToPhotoTicket({ ...candidate, maxBytes: 5 * 1024 * 1024, expiresIn: 300 }, input.photo, input.onProgress);
    try {
      await upload(ticket);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.endsWith(": 403")) throw error;
      const refreshed = await this.http.request<typeof ticket>("/community/upload-ticket", { method: "POST", body: { contentType: input.photo.type, size: input.photo.size } });
      await upload(refreshed);
      return this.http.request<CommunityPost>("/community/posts", { method: "POST", body: { key: refreshed.key, caption: input.caption, tag: input.tag, confirmAdult: input.confirmAdult } });
    }
    return this.http.request<CommunityPost>("/community/posts", { method: "POST", body: { key: ticket.key, caption: input.caption, tag: input.tag, confirmAdult: input.confirmAdult } });
  }

  async getBills(): Promise<Bill[]> {
    const data = await this.http.request<{ bills?: ServerBill[] }>("/bills", { method: "GET" });
    return (data?.bills ?? []).map(billFromServer).reverse();
  }

  /** Missions the user has completed (ids only; never changes world state). */
  async getMissions(): Promise<string[]> {
    const data = await this.http.request<{ missions?: { id: string }[] }>("/missions", { method: "GET" });
    return (data?.missions ?? []).map((entry) => entry.id);
  }

  async getDashboard(): Promise<Dashboard> {
    const [bills, missionsDone] = await Promise.all([this.getBills(), this.getMissions()]);
    return { bills, missionsDone, missionDone: missionsDone.includes("standby_sweep"), demo: false };
  }

  async addBill(_user: User, input: AddBillInput): Promise<AddBillResult> {
    // Only month/units/amount are accepted; the local photo is not uploaded.
    const data = await this.http.request<{ bill: ServerBill; verification: AddBillResult["verification"] }>(
      "/bills",
      {
        method: "POST",
        body: buildBillPayload(input.month, input.units, input.amount),
      },
    );
    return { bill: billFromServer(data.bill), verification: data.verification };
  }

  async uploadBillPhoto(
    _user: User,
    month: string,
    photo: Blob,
    wifiOnly: boolean,
    onProgress?: UploadProgress,
  ): Promise<void> {
    if (wifiOnly && (navigator as Navigator & { connection?: { type?: string } }).connection?.type === "cellular") {
      if (!window.confirm("You chose Wi-Fi only. Upload anyway?")) throw new Error("photo upload cancelled");
    }
    const ticket = await this.http.request<{
      url: string; fields: Record<string, string>; key: string; maxBytes: number; expiresIn: number;
    }>(`/bills/${encodeURIComponent(month)}/photo/upload`, {
      method: "POST",
      body: buildPhotoUploadPayload(photo.type, photo.size),
    });
    try {
      await uploadToPhotoTicket(ticket, photo, onProgress);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.endsWith(": 403")) throw error;
      const refreshed = await this.http.request<typeof ticket>(`/bills/${encodeURIComponent(month)}/photo/upload`, {
        method: "POST",
        body: buildPhotoUploadPayload(photo.type, photo.size),
      });
      await uploadToPhotoTicket(refreshed, photo, onProgress);
      ticket.key = refreshed.key;
    }
    await this.http.request(`/bills/${encodeURIComponent(month)}/photo`, {
      method: "POST",
      body: buildPhotoAttachPayload(ticket.key),
    });
  }

  async getBillPhoto(_user: User, month: string): Promise<string> {
    const data = await this.http.request<{ url: string }>(`/bills/${encodeURIComponent(month)}/photo`, { method: "GET" });
    return data.url;
  }

  async deleteBillPhoto(_user: User, month: string): Promise<void> {
    await this.http.request(`/bills/${encodeURIComponent(month)}/photo`, { method: "DELETE" });
  }

  async completeMission(_user: User, missionId: string): Promise<void> {
    await this.http.request(`/missions/${encodeURIComponent(missionId)}/complete`, { method: "POST" });
  }

  async getSettings(user: User): Promise<Settings> {
    const doc = await this.http.request<ServerProfile>("/me", { method: "GET" });
    const prefs = doc?.prefs ?? {};
    return {
      wifiOnly: typeof prefs.wifiOnly === "boolean" ? prefs.wifiOnly : DEFAULT_SETTINGS.wifiOnly,
      savedNotes: readNotes(user),
    };
  }

  async saveSettings(user: User, settings: Settings): Promise<void> {
    writeNotes(user, settings.savedNotes);
    await this.http.request("/me", {
      method: "PUT",
      body: { prefs: { wifiOnly: settings.wifiOnly } },
    });
  }

  async deleteMe(user: User): Promise<void> {
    await this.http.request("/me", { method: "DELETE" });
    try {
      localStorage.removeItem(notesKey(user));
    } catch {
      /* ignore */
    }
  }

  /**
   * Demo mode is served entirely by the local mock provider (see createApi): a
   * demo user is NOT authenticated, so the HTTP provider must never be reached
   * for one. Nothing to do here.
   */
  async setDemo(): Promise<void> {
    /* no-op by design: demo never makes a network call */
  }
}
