import { afterEach, describe, expect, it, vi } from "vitest";
import communityContract from "../../../../../contracts/community-payloads.json";
import { HttpDataProvider, HttpError, HttpProvider } from "../http";

function res(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
    headers: { get: () => null },
  } as unknown as Response;
}

type XhrInstance = {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  upload: { onprogress: ((event: ProgressEvent) => void) | null };
  status: number;
  setRequestHeader: ReturnType<typeof vi.fn>;
};

function installXhrMock(onSend?: (form: FormData, xhr: XhrInstance) => void) {
  const instances: XhrInstance[] = [];
  class MockXHR implements XhrInstance {
    open = vi.fn();
    send = vi.fn((body?: FormData) => {
      if (body instanceof FormData) onSend?.(body, this);
      queueMicrotask(() => this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent));
      queueMicrotask(() => {
        if (this.status >= 200 && this.status < 300) this.onload?.();
        else this.onload?.();
      });
    });
    upload: XhrInstance["upload"] = { onprogress: null };
    status = 204;
    setRequestHeader = vi.fn();
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  vi.stubGlobal(
    "XMLHttpRequest",
    vi.fn(function XMLHttpRequest(this: XhrInstance) {
      const xhr = new MockXHR();
      instances.push(xhr);
      return xhr;
    }),
  );
  return instances;
}

function provider(overrides: Partial<{ token: string | null; onUnauthorized: () => void }> = {}) {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const onUnauthorized = overrides.onUnauthorized ?? vi.fn();
  const http = new HttpProvider({
    baseUrl: "https://api.test",
    getToken: async () => overrides.token ?? "tok-123",
    onUnauthorized,
  });
  return { fetchMock, http, onUnauthorized };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("community HTTP create post", () => {
  it("requests upload ticket, POSTs form fields before file (no auth on S3), then creates post", async () => {
    const { fetchMock, http } = provider();
    const ticket = {
      url: "https://uploads.test/s3",
      key: "c/user-a/photo.jpg",
      fields: { key: "c/user-a/photo.jpg", policy: "abc", "x-amz-algorithm": "AWS4-HMAC-SHA256" },
    };
    fetchMock
      .mockResolvedValueOnce(res(200, ticket))
      .mockResolvedValueOnce(
        res(200, {
          id: "post-1",
          authorName: "Ananya",
          isMine: true,
          caption: communityContract.valid.post.caption,
          tag: communityContract.valid.post.tag,
          photoUrl: "https://cdn.test/photo.jpg",
          createdAt: "2025-07-01T00:00:00Z",
          reactionCounts: { grow: 0, sun: 0, cheer: 0, love: 0, idea: 0 },
          myReaction: null,
          commentCount: 0,
        }),
      );

    const formEntries: string[] = [];
    installXhrMock((form) => {
      form.forEach((_value, key) => formEntries.push(key));
    });

    const photo = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    Object.defineProperty(photo, "size", { value: communityContract.valid.uploadTicket.size });

    const data = new HttpDataProvider(http);
    const post = await data.community.createCommunityPost({
      photo,
      caption: communityContract.valid.post.caption,
      tag: communityContract.valid.post.tag,
      confirmAdult: communityContract.valid.post.confirmAdult,
      onProgress: vi.fn(),
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.test/community/upload-ticket",
      "https://api.test/community/posts",
    ]);
    const ticketInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(ticketInit.body))).toEqual(communityContract.valid.uploadTicket);
    expect((ticketInit.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");

    const xhr = vi.mocked(XMLHttpRequest).mock.results[0]?.value as XhrInstance;
    expect(xhr.open).toHaveBeenCalledWith("POST", ticket.url);
    expect(xhr.setRequestHeader).not.toHaveBeenCalledWith("Authorization", expect.anything());
    expect(formEntries.slice(0, 3)).toEqual(["key", "policy", "x-amz-algorithm"]);
    expect(formEntries[formEntries.length - 1]).toBe("file");

    const postInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(postInit.body))).toEqual(communityContract.valid.post);
    expect(post.caption).toBe(communityContract.valid.post.caption);
  });

  it("retries upload ticket once when S3 POST returns 403", async () => {
    const { fetchMock, http } = provider();
    const ticket1 = { url: "https://uploads.test/one", key: "c/user-a/a.jpg", fields: { key: "c/user-a/a.jpg" } };
    const ticket2 = { url: "https://uploads.test/two", key: "c/user-a/b.jpg", fields: { key: "c/user-a/b.jpg" } };
    fetchMock
      .mockResolvedValueOnce(res(200, ticket1))
      .mockResolvedValueOnce(res(200, ticket2))
      .mockResolvedValueOnce(
        res(200, {
          id: "post-2",
          authorName: "Ananya",
          isMine: true,
          caption: "Saved energy today",
          tag: "energy_saving",
          photoUrl: null,
          createdAt: "2025-07-01T00:00:00Z",
          reactionCounts: { grow: 0, sun: 0, cheer: 0, love: 0, idea: 0 },
          myReaction: null,
          commentCount: 0,
        }),
      );

    let uploadAttempt = 0;
    installXhrMock((_form, xhr) => {
      uploadAttempt += 1;
      xhr.status = uploadAttempt === 1 ? 403 : 204;
    });

    const photo = new Blob(["x"], { type: "image/jpeg" });
    Object.defineProperty(photo, "size", { value: 1024 });
    await new HttpDataProvider(http).community.createCommunityPost({
      photo,
      caption: "Saved energy today",
      tag: "energy_saving",
      confirmAdult: true,
    });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("upload-ticket"))).toHaveLength(2);
    expect(JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body)).key).toBe(ticket2.key);
    expect(uploadAttempt).toBe(2);
  });
});

describe("community HTTP errors and session", () => {
  it("maps moderation_rejected, moderation_unavailable, and rate_limited codes", async () => {
    const { fetchMock, http } = provider();
    const data = new HttpDataProvider(http);
    const cases: Array<[number, string, string]> = [
      [400, "photo did not pass moderation", "moderation_rejected"],
      [503, "moderation is temporarily unavailable", "moderation_unavailable"],
      [429, "rate limit", "rate_limited"],
    ];
    for (const [status, message, code] of cases) {
      fetchMock.mockResolvedValueOnce(res(status, { error: message, code }));
      await expect(
        http.request("/community/posts", { method: "POST", body: communityContract.valid.post }),
      ).rejects.toMatchObject({ status, errorCode: code });
    }
    await expect(data.community.getCommunityFeed(20)).resolves.toEqual(expect.anything());
  });

  it("signs out on 401 for community feed", async () => {
    const onUnauthorized = vi.fn();
    const { fetchMock, http } = provider({ onUnauthorized });
    fetchMock.mockResolvedValue(res(401, { error: "unauthorized", code: "unauthorized" }));
    const data = new HttpDataProvider(http);
    await expect(data.community.getCommunityFeed()).rejects.toBeInstanceOf(HttpError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("returns needs_display_name from POST /community/posts", async () => {
    const { fetchMock, http } = provider();
    fetchMock.mockResolvedValue(res(400, { error: "a profile displayName is required", code: "needs_display_name" }));
    await expect(
      http.request("/community/posts", { method: "POST", body: communityContract.valid.post }),
    ).rejects.toMatchObject({ errorCode: "needs_display_name" });
  });
});
