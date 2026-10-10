import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoryScreen } from "../StoryScreen";
import i18n from "../../i18n";

const markIntroSeen = vi.fn();
const navigate = vi.fn();

vi.mock("../../lib/AuthProvider", () => ({
  useAuth: () => ({ markIntroSeen }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

// VITE_STORY_URL is set for this suite so the video path is exercised.
vi.mock("../../lib/env", () => ({ STORY_URL: "https://example.test/story.mp4", USE_MOCK: true }));

function renderStory(mode: "first" | "watchAgain", path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StoryScreen mode={mode} />
    </MemoryRouter>,
  );
}

describe("story player gate behaviour", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    markIntroSeen.mockClear();
    navigate.mockClear();
  });

  it("falls back to the illustrated frames when the video errors", () => {
    const { container } = renderStory("first", "/story");
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    fireEvent.error(video!);
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("marks introSeen and navigates onward when Skip is pressed on first run", () => {
    renderStory("first", "/story");
    fireEvent.click(screen.getByText("Skip"));
    expect(markIntroSeen).toHaveBeenCalledWith(true);
    expect(navigate).toHaveBeenCalledWith("/setup", { replace: true });
  });

  it("watch-again mode never changes introSeen", () => {
    renderStory("watchAgain", "/app/story");
    fireEvent.click(screen.getByText("Skip"));
    expect(markIntroSeen).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/app", { replace: true });
  });

  it("shows a Play button when autoplay is blocked", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new Error("blocked"));
    renderStory("first", "/story");
    expect(await screen.findByText("Play")).toBeInTheDocument();
    play.mockRestore();
  });
});


