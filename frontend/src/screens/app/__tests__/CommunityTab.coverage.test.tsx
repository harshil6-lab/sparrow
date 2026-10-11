import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../../i18n";
import { CommunityTab } from "../CommunityTab";
import type {
  CommunityComment,
  CommunityFeed,
  CommunityPost,
  CommunityTag,
  ReactionType,
} from "../../../lib/api/data";
import { HttpError } from "../../../lib/api/http";

// ─── hoisted mutable state ───────────────────────────────────────────────────

const h = vi.hoisted(() => {
  const reactions: Record<ReactionType, number> = { grow: 1, sun: 2, cheer: 3, love: 4, idea: 5 };
  const now = new Date().toISOString();
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const user = { id: "u-1", email: "a@b.com", displayName: "Ananya", provider: "email" as const };

  function makePost(overrides: Partial<CommunityPost> & { id: string; tag: CommunityTag }): CommunityPost {
    return {
      authorName: "Ananya", isMine: false, caption: "Did something green today.",
      photoUrl: null, createdAt: now, reactionCounts: { ...reactions },
      myReaction: null, commentCount: 0, ...overrides,
    };
  }

  const posts = new Map<string, CommunityPost>([
    ["p-1", makePost({ id: "p-1", tag: "energy_saving", authorName: "Asha", createdAt: hourAgo })],
    ["p-2", makePost({ id: "p-2", tag: "trees", authorName: "Ravi", createdAt: dayAgo })],
    ["p-3", makePost({ id: "p-3", tag: "energy_saving", authorName: "Meera", createdAt: dayAgo })],
  ]);
  const comments = new Map<string, CommunityComment[]>([]);
  const feedCalls: Array<{ limit: number; cursor: string | null }> = [];
  const reactionsCalls: Array<{ id: string; type: ReactionType | null }> = [];
  const addCommentCalls: Array<{ id: string; text: string }> = [];
  const deleteCommentCalls: Array<{ postId: string; commentId: string }> = [];
  const reportCalls: Array<{ id: string; reason: string }> = [];
  const deletePostCalls: string[] = [];
  const onSignUp = vi.fn();
  const saveProfile = vi.fn().mockResolvedValue(undefined);

  function makeApi() {
    const getFeed = vi.fn(async (limit = 20, cursor: string | null = null): Promise<CommunityFeed> => {
      feedCalls.push({ limit, cursor });
      const list = [...posts.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (cursor) { const idx = list.findIndex((p) => p.id === cursor); if (idx >= 0) list.splice(0, idx + 1); }
      return { posts: list.slice(0, limit), cursor: null };
    });
    const getPost = vi.fn(async (id: string): Promise<CommunityPost> => {
      const p = posts.get(id);
      if (!p) throw new HttpError(404, "post not found", "not_found");
      return p;
    });
    const createPost = vi.fn(async (input: { photo: Blob; caption: string; tag: CommunityTag; confirmAdult: boolean }) => {
      const p: CommunityPost = { id: `new-${Date.now()}`, authorName: "Ananya", isMine: true, caption: input.caption, tag: input.tag, photoUrl: null, createdAt: new Date().toISOString(), reactionCounts: { ...reactions }, myReaction: null, commentCount: 0 };
      posts.set(p.id, p);
      return p;
    });
    const deletePost = vi.fn(async (id: string) => { deletePostCalls.push(id); posts.delete(id); });
    const setReaction = vi.fn(async (id: string, type: ReactionType | null): Promise<CommunityPost> => {
      reactionsCalls.push({ id, type });
      const p = posts.get(id);
      if (!p) throw new HttpError(404, "post not found", "not_found");
      if (p.myReaction) p.reactionCounts[p.myReaction] = Math.max(0, p.reactionCounts[p.myReaction] - 1);
      if (type) p.reactionCounts[type]++;
      p.myReaction = type;
      return p;
    });
    const getComments = vi.fn(async (id: string) => ({ comments: comments.get(id) ?? [], cursor: null }));
    const addComment = vi.fn(async (id: string, text: string): Promise<CommunityComment> => {
      addCommentCalls.push({ id, text });
      const c: CommunityComment = { id: `c-${Date.now()}`, authorName: "Ananya", text, createdAt: new Date().toISOString(), isMine: true };
      if (!comments.has(id)) comments.set(id, []);
      comments.get(id)!.push(c);
      return c;
    });
    const deleteComment = vi.fn(async (postId: string, commentId: string) => {
      deleteCommentCalls.push({ postId, commentId });
      comments.get(postId)?.splice(comments.get(postId)!.findIndex((c) => c.id === commentId), 1);
    });
    const reportPost = vi.fn(async (id: string, reason: string) => {
      reportCalls.push({ id, reason });
      const p = posts.get(id);
      if (p) posts.set(id, { ...p, status: "hidden" });
    });
    return {
      getFeed, getCommunityFeed: getFeed,
      getPost, getCommunityPost: getPost,
      createPost, createCommunityPost: createPost,
      deletePost, deleteCommunityPost: deletePost,
      setReaction, setCommunityReaction: setReaction,
      getComments, getCommunityComments: getComments,
      addComment, addCommunityComment: addComment,
      deleteComment, deleteCommunityComment: deleteComment,
      reportPost, reportCommunityPost: reportPost,
    };
  }

  const apiCommunity = makeApi();

  const defaultAnswers = { homeType: null, people: null, city: null, usualBill: null, appliances: [] as string[] };
  const defaultProfile = {
    user,
    displayName: "Ananya" as string | null,
    introSeen: true,
    setupComplete: true,
    language: "en" as const,
    answers: defaultAnswers,
  };

  return {
    user, reactions, now, hourAgo, dayAgo, posts, comments,
    feedCalls, reactionsCalls, addCommentCalls,
    deleteCommentCalls, reportCalls, deletePostCalls,
    onSignUp, saveProfile, apiCommunity, makePost, defaultProfile,
  };
});

// ─── top-level mocks ──────────────────────────────────────────────────────────

vi.mock("../../../lib/api", () => {
  const ac = h.apiCommunity;
  return {
    __esModule: true,
    api: { data: { community: ac } },
    default: {
      auth: {
        getCurrentUser: async () => h.user,
        signInWithEmail: async () => ({ user: h.user }),
        signUp: async () => ({ needsConfirmation: false, username: "a@b.com" }),
        confirmSignUp: async () => {}, resendSignUpCode: async () => {},
        resetPassword: async () => {}, confirmResetPassword: async () => {},
        signInWithGoogle: async () => ({ user: h.user }), signOut: async () => {},
        idToken: async () => "tok-123", deleteUser: async () => {},
      },
      profiles: {
        load: async () => ({ ...h.user, displayName: "Ananya", introSeen: true, setupComplete: true, language: "en" as const, answers: { homeType: null, people: null, city: null, usualBill: null, appliances: [] } }),
        save: async () => {}, clear: async () => {}, setIntroSeen: async () => {},
      },
      data: {
        getDashboard: async () => ({ bills: [], missionsDone: [], missionDone: false, demo: false }),
        getBills: async () => [],
        addBill: async () => ({ bill: { id: "b-1", month: "2025-06", units: 170, verified: false, createdAt: h.now }, verification: { baseline: true } }),
        uploadBillPhoto: async () => {}, getBillPhoto: async () => "", deleteBillPhoto: async () => {},
        completeMission: async () => {},
        getSettings: async () => ({ wifiOnly: true, savedNotes: [] }),
        saveSettings: async () => {}, deleteMe: async () => {}, setDemo: async () => {},
        community: ac,
      },
    },
  };
});

const authState = vi.hoisted(() => ({ profile: { ...h.defaultProfile } }));

vi.mock("../../../lib/photos", () => ({
  compressBillPhoto: vi.fn(async (file: Blob) => file),
}));

vi.mock("../../../lib/AuthProvider", () => ({
  useAuth: () => ({
    ready: true,
    profile: authState.profile,
    saveProfile: h.saveProfile,
    signInWithEmail: vi.fn(), signUp: vi.fn(), confirmSignUp: vi.fn(), resendSignUpCode: vi.fn(),
    resetPassword: vi.fn(), confirmResetPassword: vi.fn(), signInWithGoogle: vi.fn(),
    signOut: vi.fn(), markIntroSeen: vi.fn(), completeSetup: vi.fn(), deleteAccount: vi.fn(), resetDemo: vi.fn(),
  }),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function postCard(author: string) {
  const heading = screen.getByText(author);
  return heading.closest("article") as HTMLElement;
}

function reactionButton(author: string, reaction: string) {
  return within(postCard(author)).getByRole("button", { name: new RegExp(`^${reaction}\\b`) });
}

function menuButton(author: string) {
  return within(postCard(author)).getByLabelText("Post menu");
}

function commentsButton(author: string) {
  return within(postCard(author)).getByRole("button", { name: /comments/i });
}

function shareButton(author: string) {
  return within(postCard(author)).getByRole("button", { name: "Share" });
}

function resetState() {
  authState.profile = { ...h.defaultProfile };
  h.onSignUp.mockClear();
  h.saveProfile.mockClear();
  h.saveProfile.mockResolvedValue(undefined);
  (Object.values(h.apiCommunity) as ReturnType<typeof vi.fn>[]).forEach((v) => v.mockClear());
  h.feedCalls.length = 0;
  h.reactionsCalls.length = 0;
  h.addCommentCalls.length = 0;
  h.deleteCommentCalls.length = 0;
  h.reportCalls.length = 0;
  h.deletePostCalls.length = 0;
  h.posts.clear();
  const r: Record<ReactionType, number> = { grow: 1, sun: 2, cheer: 3, love: 4, idea: 5 };
  const n = new Date().toISOString();
  const ha = new Date(Date.now() - 3600000).toISOString();
  const da = new Date(Date.now() - 86400000).toISOString();
  function mp(ov: Partial<CommunityPost> & { id: string; tag: CommunityTag }): CommunityPost {
    return { authorName: "Ananya", isMine: false, caption: "Did something green today.", photoUrl: null, createdAt: n, reactionCounts: { ...r }, myReaction: null, commentCount: 0, ...ov };
  }
  h.posts.set("p-1", mp({ id: "p-1", tag: "energy_saving", authorName: "Asha", createdAt: ha }));
  h.posts.set("p-2", mp({ id: "p-2", tag: "trees", authorName: "Ravi", createdAt: da }));
  h.posts.set("p-3", mp({ id: "p-3", tag: "energy_saving", authorName: "Meera", createdAt: da }));
  h.comments.clear();
}

function renderCommunity(props: { demo?: boolean; location?: string; signedOut?: boolean } = {}) {
  resetState();
  if (props.signedOut) {
    authState.profile = { ...h.defaultProfile, displayName: null, user: { ...h.user, id: "anonymous" } };
  }
  return render(
    <MemoryRouter initialEntries={[props.location ?? "/app/community"]}>
      <CommunityTab demo={props.demo ?? false} onSignUp={h.onSignUp} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─── feed: all tags ───────────────────────────────────────────────────────────

describe("Community feed — all tags", () => {
  it("filters by solar tag", async () => {
    const solarPost = h.makePost({ id: "p-solar", tag: "solar", authorName: "Kiran", createdAt: h.hourAgo });
    h.posts.set("p-solar", solarPost);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Solar" }));
    expect(screen.getByText("Kiran")).toBeInTheDocument();
    expect(screen.queryByText("Asha")).toBeNull();
  });

  it("filters by water tag", async () => {
    const waterPost = h.makePost({ id: "p-water", tag: "water", authorName: "Priya", createdAt: h.dayAgo });
    h.posts.set("p-water", waterPost);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Water" }));
    expect(screen.getByText("Priya")).toBeInTheDocument();
  });

  it("filters by community_drive tag", async () => {
    const drivePost = h.makePost({ id: "p-drive", tag: "community_drive", authorName: "Suresh", createdAt: h.dayAgo });
    h.posts.set("p-drive", drivePost);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Community drive" }));
    expect(screen.getByText("Suresh")).toBeInTheDocument();
  });

  it("filters by waste tag", async () => {
    const wastePost = h.makePost({ id: "p-waste", tag: "waste", authorName: "Neha", createdAt: h.dayAgo });
    h.posts.set("p-waste", wastePost);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Waste" }));
    expect(screen.getByText("Neha")).toBeInTheDocument();
  });

  it("filters by other tag", async () => {
    const otherPost = h.makePost({ id: "p-other", tag: "other", authorName: "Vikram", createdAt: h.dayAgo });
    h.posts.set("p-other", otherPost);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(screen.getByText("Vikram")).toBeInTheDocument();
  });

  it("shows caption text verbatim in post card", async () => {
    const p = h.makePost({ id: "p-cap", tag: "energy_saving", caption: "Turned off the AC by 1 degree." });
    h.posts.set("p-cap", p);
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Turned off the AC by 1 degree.")).toBeInTheDocument());
  });

  it("shows photo when photoUrl is present", async () => {
    const p = h.makePost({ id: "p-photo", tag: "solar", photoUrl: "https://cdn.test/photo.jpg" });
    h.posts.set("p-photo", p);
    renderCommunity();
    await waitFor(() => expect(screen.getByAltText("")).toBeInTheDocument());
    const img = screen.getByAltText("") as HTMLImageElement;
    expect(img.src).toContain("https://cdn.test/photo.jpg");
  });

  it("shows sparrow illustration when no photoUrl", async () => {
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    expect(document.querySelector(".community-illustration svg")).toBeTruthy();
  });
});

// ─── feed: pagination edge cases ──────────────────────────────────────────────

describe("Community feed — pagination", () => {
  it("load-more appends without duplicating existing posts", async () => {
    const more = h.makePost({ id: "p-4", tag: "solar", authorName: "Kiran", createdAt: h.dayAgo });
    h.apiCommunity.getFeed
      .mockResolvedValueOnce({ posts: [...h.posts.values()].slice(0, 2), cursor: "p-2" })
      .mockResolvedValueOnce({ posts: [more], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Kiran")).toBeInTheDocument());
    expect(screen.getAllByText("Kiran")).toHaveLength(1);
  });

  it("load-more does not appear when first load has no cursor", async () => {
    h.apiCommunity.getFeed.mockResolvedValueOnce({ posts: [h.posts.get("p-1")!], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("load-more passes correct cursor on second page", async () => {
    h.apiCommunity.getFeed.mockResolvedValueOnce({ posts: [], cursor: "abc123" });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("No posts yet. Be the first.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(h.apiCommunity.getFeed).toHaveBeenNthCalledWith(2, 20, "abc123");
  });
});

// ─── feed: loading and error transitions ──────────────────────────────────────

describe("Community feed — loading/error transitions", () => {
  it("hides skeleton after successful load", async () => {
    h.apiCommunity.getFeed.mockImplementationOnce(() => new Promise(() => {}));
    renderCommunity();
    expect(document.querySelector(".community-skeleton[aria-busy='true']")).toBeTruthy();
    await h.apiCommunity.getFeed.mockResolvedValue({ posts: [...h.posts.values()], cursor: null });
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    expect(document.querySelector(".community-skeleton")).toBeNull();
  });

  it("shows error state then recovers on retry", async () => {
    h.apiCommunity.getFeed
      .mockRejectedValueOnce(new HttpError(500, "fail", "internal_error"))
      .mockResolvedValueOnce({ posts: [...h.posts.values()], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Community could not load")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /common\.retry|Try again/i }));
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
  });

  it("shows unavailable state on getPost 404 from deep link", async () => {
    h.apiCommunity.getPost.mockRejectedValueOnce(new HttpError(404, "not found", "not_found"));
    renderCommunity({ location: "/app/community?post=missing-post" });
    await waitFor(() => expect(screen.getByText("This post is not available.")).toBeInTheDocument());
  });
});

// ─── reaction: all five types ─────────────────────────────────────────────────

describe("reactions — all types", () => {
  const reactionTypes: ReactionType[] = ["grow", "sun", "cheer", "love", "idea"];

  it.each(reactionTypes)("sets reaction %s", async (type) => {
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(reactionButton("Asha", type.charAt(0).toUpperCase() + type.slice(1)));
    expect(h.apiCommunity.setReaction).toHaveBeenCalledWith("p-1", type);
  });

  it("shows reaction counts in each button", async () => {
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    const growBtn = reactionButton("Asha", "Grow");
    expect(within(growBtn).getByText("1")).toBeInTheDocument();
  });

  it("toggles aria-pressed correctly on reaction change", async () => {
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    const growBtn = reactionButton("Asha", "Grow");
    expect(growBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(growBtn);
    await waitFor(() => expect(growBtn).toHaveAttribute("aria-pressed", "true"));
  });
});

// ─── comments: add/delete/full flow ───────────────────────────────────────────

describe("comments — full flow", () => {
  it("removes comment from list after delete", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({
      comments: [
        { id: "c-1", authorName: "Ananya", text: "mine", createdAt: h.now, isMine: true },
        { id: "c-2", authorName: "Ananya", text: "also mine", createdAt: h.now, isMine: true },
      ],
      cursor: null,
    });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    expect(screen.getByText("mine")).toBeInTheDocument();
    expect(screen.getByText("also mine")).toBeInTheDocument();
    const deleteBtns = screen.getAllByText("Delete");
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => expect(h.apiCommunity.deleteComment).toHaveBeenCalledWith("p-1", "c-1"));
    await waitFor(() => expect(screen.queryByText("mine")).toBeNull());
    expect(screen.getByText("also mine")).toBeInTheDocument();
  });

  it("does not show delete for others' comments on others' posts", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({
      comments: [{ id: "c-1", authorName: "Ravi", text: "cool", createdAt: h.now, isMine: false }],
      cursor: null,
    });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("shows delete when user is post owner even if comment is by someone else", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({
      comments: [{ id: "c-1", authorName: "Ravi", text: "nice post", createdAt: h.now, isMine: false }],
      cursor: null,
    });
    const ownPost = h.makePost({ id: "p-1", tag: "energy_saving", authorName: "Ananya", isMine: true });
    h.apiCommunity.getFeed.mockResolvedValueOnce({ posts: [ownPost], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Ananya")).toBeInTheDocument());
    fireEvent.click(commentsButton("Ananya"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("handles comment load error", async () => {
    h.apiCommunity.getComments.mockRejectedValueOnce(new HttpError(500, "fail", "internal_error"));
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    expect(h.apiCommunity.getComments).toHaveBeenCalledWith("p-1");
  });

  it("handles add comment error", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({ comments: [], cursor: null });
    h.apiCommunity.addComment.mockRejectedValueOnce(new HttpError(500, "fail", "internal_error"));
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Nice!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(h.apiCommunity.addComment).toHaveBeenCalledWith("p-1", "Nice!"));
  });

  it("clears textarea after sending comment", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({ comments: [], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Great tip!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("send button disabled when text is empty", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({ comments: [], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("send button enabled when text has content", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({ comments: [], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });
});

// ─── report: all reasons ──────────────────────────────────────────────────────

describe("report — all reasons", () => {
  const reasons: Array<{ name: string; reason: string }> = [
    { name: "Spam", reason: "spam" },
    { name: "Inappropriate", reason: "inappropriate" },
    { name: "Unsafe", reason: "unsafe" },
    { name: "Other", reason: "other" },
  ];

  it.each(reasons)("submits report reason '%s'", async (r) => {
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(menuButton("Asha"));
    fireEvent.click(screen.getByRole("button", { name: r.name }));
    await waitFor(() => expect(h.apiCommunity.reportPost).toHaveBeenCalledWith("p-1", r.reason));
  });

  it("closes report sheet after submission", async () => {
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(menuButton("Asha"));
    fireEvent.click(screen.getByRole("button", { name: "Spam" }));
    await waitFor(() => expect(screen.queryByText("Report post")).toBeNull());
  });
});

// ─── create post: disabled states ─────────────────────────────────────────────

describe("create post — disabled states", () => {
  it("shows take photo and choose from gallery buttons", async () => {
    localStorage.setItem("sparrow.community.guidelines.u-1", "1");
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Take photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose from gallery" })).toBeInTheDocument();
  });

  it("publish button disabled without photo", async () => {
    localStorage.setItem("sparrow.community.guidelines.u-1", "1");
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
    const captionArea = screen.getByPlaceholderText(/what did you do/i);
    fireEvent.change(captionArea, { target: { value: "Some caption" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    expect(screen.getByRole("button", { name: "Post", hidden: false })).toBeDisabled();
  });

  it("publish button disabled without caption", async () => {
    localStorage.setItem("sparrow.community.guidelines.u-1", "1");
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    // No photo, no caption — still disabled.
    expect(screen.getByRole("button", { name: "Post", hidden: false })).toBeDisabled();
  });

  it("publish button disabled without adult confirmation", async () => {
    localStorage.setItem("sparrow.community.guidelines.u-1", "1");
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
    // No photo, no caption, no adult check — disabled.
    expect(screen.getByRole("button", { name: "Post", hidden: false })).toBeDisabled();
  });
});

// ─── create post: S3 ticket flow with XHR form-field ordering ────────────────

describe("create post — S3 ticket XHR form order", () => {
  it("posts form fields before file in S3 XHR (no Authorization header)", async () => {
    const ticket = {
      url: "https://s3.test/upload",
      key: "c/u-1/photo.jpg",
      fields: { key: "c/u-1/photo.jpg", policy: "poly", "x-amz-algorithm": "AWS4-HMAC-SHA256" },
    };
    h.apiCommunity.createPost.mockResolvedValueOnce({
      id: "new-1", authorName: "Ananya", isMine: true, caption: "S3 ordered",
      tag: "energy_saving" as CommunityTag, photoUrl: null, createdAt: h.now,
      reactionCounts: { grow: 0, sun: 0, cheer: 0, love: 0, idea: 0 }, myReaction: null, commentCount: 0,
    });

    const formKeys: string[] = [];
    class MockXHR {
      open = vi.fn();
      send = vi.fn((body?: FormData) => {
        if (body instanceof FormData) {
          body.forEach((v, k) => formKeys.push(k));
        }
        queueMicrotask(() => this.onload?.());
      });
      upload = { onprogress: null };
      status = 204;
      setRequestHeader = vi.fn();
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
    }
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => new MockXHR() as unknown as XMLHttpRequest));

    localStorage.setItem("sparrow.community.guidelines.u-1", "1");
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
    // Manually set photo and caption to trigger create.
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector(".community-create-sheet input[type='file']") as HTMLInputElement;
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await waitFor(() => expect(screen.getByAltText("Selected community photo")).toBeInTheDocument());
    }
    fireEvent.change(screen.getByPlaceholderText(/what did you do/i), { target: { value: "S3 ordered" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    fireEvent.click(screen.getByRole("button", { name: "Post", hidden: false }));
    await waitFor(() => expect(h.apiCommunity.createPost).toHaveBeenCalled());

    // Verify S3 XHR had form fields FIRST then file LAST.
    expect(formKeys.slice(0, -1)).toEqual(["key", "policy", "x-amz-algorithm"]);
    expect(formKeys[formKeys.length - 1]).toBe("file");
    // Verify NO Authorization header sent to S3.
    const xhrInstance = vi.mocked(XMLHttpRequest).mock.results[0]?.value as unknown as { setRequestHeader: ReturnType<typeof vi.fn> };
    const authCalls = (xhrInstance.setRequestHeader as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0]?.toLowerCase() === "authorization",
    );
    expect(authCalls).toHaveLength(0);
  });
});

// ─── needs_display_name: retains photo + caption ──────────────────────────────

describe("needs_display_name — retains photo and caption", () => {
  it.fails("keeps caption and photo after entering display name", async () => {
    // BUG: After the display-name step, the photo and caption are reset to empty.
    // The component does not persist these across the nameStep transition.
    authState.profile = { ...h.defaultProfile, displayName: null };
    localStorage.setItem("sparrow.community.guidelines.u-1", "1");
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector(".community-create-sheet input[type='file']") as HTMLInputElement;
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await waitFor(() => expect(screen.getByAltText("Selected community photo")).toBeInTheDocument());
    }
    fireEvent.change(screen.getByPlaceholderText(/what did you do/i), { target: { value: "My caption" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    fireEvent.click(screen.getByRole("button", { name: "Post", hidden: false }));
    await waitFor(() => expect(screen.getByText("What should we call you?")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "NewName" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(h.apiCommunity.createPost).toHaveBeenCalled());
    const call = h.apiCommunity.createPost.mock.calls[0][0] as { caption: string };
    expect(call.caption).toBe("My caption");
  });
});

// ─── error mapping: rate_limited on feed load ─────────────────────────────────

describe("error mapping — rate limited on feed", () => {
  // BUG: rate_limited on feed load shows generic error state instead of the
  // dedicated rate-limited message "You have reached today's community limit..."
  it.fails("shows rate limited error on feed load", async () => {
    h.apiCommunity.getFeed.mockRejectedValueOnce(new HttpError(429, "rate limit", "rate_limited"));
    renderCommunity();
    await waitFor(() =>
      expect(screen.getByText("You have reached today's community limit. Try again tomorrow.")).toBeInTheDocument(),
    );
  });
});

// ─── deep link: signed-out user ──────────────────────────────────────────────

describe("deep link — signed-out user", () => {
  it("shows unavailable for missing post when signed out", async () => {
    h.apiCommunity.getPost.mockRejectedValueOnce(new HttpError(404, "not found", "not_found"));
    renderCommunity({ location: "/app/community?post=missing", signedOut: true });
    await waitFor(() => expect(screen.getByText("This post is not available.")).toBeInTheDocument());
  });

  it("shows post button in signed-out state", async () => {
    renderCommunity({ signedOut: true });
    expect(screen.getByRole("button", { name: "+ Post" })).toBeInTheDocument();
  });
});

// ─── demo mode: fetch spy ─────────────────────────────────────────────────────

describe("demo mode — fetch spy", () => {
  it("makes zero fetch calls in demo mode", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    renderCommunity({ demo: true });
    await waitFor(() => expect(screen.getByText("Create your Nest to post and join in")).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ─── share: toast timing ──────────────────────────────────────────────────────

describe("share — toast timing", () => {
  it("shows link-copied toast then hides it after 2 seconds", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(shareButton("Asha"));
    await waitFor(() => expect(screen.getByText("Link copied")).toBeInTheDocument());
    vi.advanceTimersByTime(2001);
    expect(screen.queryByText("Link copied")).toBeNull();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

// ─── guidelines sheet ─────────────────────────────────────────────────────────

describe("guidelines sheet", () => {
  it("shows guidelines title and copy", async () => {
    localStorage.clear();
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Community guidelines")).toBeInTheDocument());
    expect(screen.getByText(/Be kind\. Share energy and environment photos only\./)).toBeInTheDocument();
  });

  it("opens create sheet after accepting guidelines", async () => {
    localStorage.clear();
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Community guidelines")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
  });

  it("does not show guidelines sheet again after first acceptance", async () => {
    localStorage.setItem("sparrow.community.guidelines.u-1", "1");
    renderCommunity();
    fireEvent.click(screen.getByRole("button", { name: "+ Post" }));
    await waitFor(() => expect(screen.getByText("Create a post")).toBeInTheDocument());
    expect(screen.queryByText("Community guidelines")).toBeNull();
  });
});

// ─── XSS: comment text rendered as literal ────────────────────────────────────

describe("XSS — comment text literal render", () => {
  it("renders comment with script tag as literal text", async () => {
    const malicious = "<script>alert(1)</script>";
    h.apiCommunity.getComments.mockResolvedValueOnce({
      comments: [{ id: "c-xss", authorName: "Bot", text: malicious, createdAt: h.now, isMine: false }],
      cursor: null,
    });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    expect(screen.getByText(malicious)).toBeInTheDocument();
    expect(document.querySelectorAll("script").length).toBe(0);
  });
});

// ─── delete own post — full flow ──────────────────────────────────────────────

describe("delete own post — full flow", () => {
  it("removes post and does not show it again", async () => {
    const p = h.makePost({ id: "p-del", tag: "energy_saving", authorName: "Ananya", isMine: true });
    h.apiCommunity.getFeed.mockResolvedValueOnce({ posts: [p], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Ananya")).toBeInTheDocument());
    fireEvent.click(menuButton("Ananya"));
    await waitFor(() => expect(h.apiCommunity.deletePost).toHaveBeenCalledWith("p-del"));
    await waitFor(() => expect(screen.queryByText("Ananya")).toBeNull());
  });

  it("handles delete error gracefully", async () => {
    const p = h.makePost({ id: "p-del2", tag: "solar", authorName: "Ananya", isMine: true });
    h.apiCommunity.getFeed.mockResolvedValueOnce({ posts: [p], cursor: null });
    h.apiCommunity.deletePost.mockRejectedValueOnce(new HttpError(500, "fail", "internal_error"));
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Ananya")).toBeInTheDocument());
    fireEvent.click(menuButton("Ananya"));
    await waitFor(() => expect(screen.getByText("Community could not load")).toBeInTheDocument());
  });
});

// ─── comments sheet — close behavior ──────────────────────────────────────────

describe("comments sheet — close behavior", () => {
  it("closes comments sheet on close button click", async () => {
    h.apiCommunity.getComments.mockResolvedValueOnce({ comments: [], cursor: null });
    renderCommunity();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    fireEvent.click(commentsButton("Asha"));
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);
    await waitFor(() => expect(screen.queryByText("Comments")).toBeNull());
  });
});
