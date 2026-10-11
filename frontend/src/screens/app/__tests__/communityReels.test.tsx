import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../../i18n";
import { CommunityTab } from "../CommunityTab";
import type { CommunityComment, CommunityPost, ReactionType } from "../../../lib/api/data";

const h = vi.hoisted(() => {
  const made = (over: Partial<CommunityPost> & { id: string }): CommunityPost => ({
    authorName: "Asha",
    isMine: false,
    caption: "Set the AC a little higher and kept the fan on.",
    tag: "energy_saving",
    photoUrl: null,
    createdAt: new Date().toISOString(),
    reactionCounts: { grow: 0, sun: 0, cheer: 0, love: 0, idea: 0 },
    myReaction: null,
    commentCount: 0,
    ...over,
  });

  const state = {
    posts: [
      made({ id: "p-1" }),
      made({ id: "p-2", authorName: "Ravi", caption: "Our balcony plants are thriving." }),
      made({ id: "p-3", authorName: "Meera", caption: "Switched off standby power." }),
    ] as CommunityPost[],
    reactions: [] as Array<{ id: string; type: ReactionType | null }>,
    comments: [] as CommunityComment[],
    adds: [] as string[],
  };

  const community = {
    getCommunityFeed: vi.fn(async () => ({ posts: [...state.posts], cursor: null })),
    getCommunityPost: vi.fn(async (id: string) => state.posts.find((post) => post.id === id) ?? state.posts[0]),
    createCommunityPost: vi.fn(),
    deleteCommunityPost: vi.fn(async () => {}),
    setCommunityReaction: vi.fn(async (id: string, type: ReactionType | null) => {
      state.reactions.push({ id, type });
      return { ...state.posts[0], id, myReaction: type };
    }),
    getCommunityComments: vi.fn(async () => ({ comments: [...state.comments], cursor: null })),
    addCommunityComment: vi.fn(async (_id: string, text: string) => {
      state.adds.push(text);
      const comment: CommunityComment = { id: "c-new", authorName: "Asha", text, createdAt: new Date().toISOString(), isMine: true };
      state.comments.push(comment);
      return comment;
    }),
    deleteCommunityComment: vi.fn(async () => {}),
    reportCommunityPost: vi.fn(async () => {}),
  };

  return { state, community, made };
});

vi.mock("../../../lib/api", () => ({
  __esModule: true,
  api: { data: { community: h.community } },
  default: { data: { community: h.community } },
}));

vi.mock("../../../lib/AuthProvider", () => ({
  useAuth: () => ({
    ready: true,
    profile: { user: { id: "u-1", email: "a@b.com", displayName: "Ananya", provider: "email" }, displayName: "Ananya" },
    saveProfile: vi.fn(),
  }),
}));

function renderTab(demo = false) {
  return render(
    <MemoryRouter initialEntries={["/app/community"]}>
      <CommunityTab demo={demo} onSignUp={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  localStorage.clear();
  h.state.posts = [h.made({ id: "p-1" })];
  h.state.reactions.length = 0;
  h.state.comments.length = 0;
  h.state.adds.length = 0;
  for (const fn of Object.values(h.community)) fn.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reaction popover", () => {
  it("sets, switches and removes a reaction through the popover", async () => {
    renderTab();
    await screen.findByText("Asha");

    fireEvent.click(screen.getByRole("button", { name: "React" }));
    fireEvent.click(screen.getByRole("button", { name: "Sun" }));
    await waitFor(() => expect(h.community.setCommunityReaction).toHaveBeenCalledWith("p-1", "sun"));

    fireEvent.click(screen.getByRole("button", { name: "React" }));
    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    await waitFor(() => expect(h.community.setCommunityReaction).toHaveBeenLastCalledWith("p-1", "love"));

    fireEvent.click(screen.getByRole("button", { name: "React" }));
    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    await waitFor(() => expect(h.community.setCommunityReaction).toHaveBeenLastCalledWith("p-1", null));
  });
});

describe("comment composer", () => {
  it("shows a pinned composer and sends a comment", async () => {
    renderTab();
    await screen.findByText("Asha");

    fireEvent.click(screen.getByRole("button", { name: /comments/i }));
    const input = await screen.findByPlaceholderText("Add a comment");
    expect(input).toBeVisible();
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    fireEvent.change(input, { target: { value: "Nice work" } });
    expect(screen.getByText("9/300")).toBeInTheDocument();
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => expect(h.community.addCommunityComment).toHaveBeenCalledWith("p-1", "Nice work"));
    expect(screen.getAllByText("Nice work")).toHaveLength(1);
    expect(h.community.addCommunityComment).toHaveBeenCalledTimes(1);
  });
});

describe("share", () => {
  it("shares the post link through the Web Share API", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", { value: share, configurable: true });
    renderTab();
    await screen.findByText("Asha");

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(String(share.mock.calls[0][0].url)).toContain("/app/community?post=p-1");
  });
});

describe("demo mode", () => {
  it("renders three SAMPLE posts without touching the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    h.state.posts = [
      h.made({ id: "p-1" }),
      h.made({ id: "p-2", authorName: "Ravi", caption: "Our balcony plants are thriving." }),
      h.made({ id: "p-3", authorName: "Meera", caption: "Switched off standby power." }),
    ];
    renderTab(true);

    await screen.findByText("Set the AC a little higher and kept the fan on.");
    expect(screen.getAllByText("SAMPLE")).toHaveLength(3);
    expect(screen.getByText("Create your Nest to post and join in")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});