import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../../../i18n";
import { LearnTab } from "../LearnTab";
import { ClipPlayerSheet } from "../learn/ClipPlayerSheet";
import type { FactCard } from "../../../lib/learn";

const h = vi.hoisted(() => ({ wifiOnly: false }));

vi.mock("../../../lib/api", () => ({
  __esModule: true,
  api: { data: { getSettings: vi.fn(async () => ({ wifiOnly: h.wifiOnly, savedNotes: [] })) } },
  default: { data: {} },
}));

vi.mock("../../../lib/AuthProvider", () => ({
  useAuth: () => ({
    ready: true,
    profile: { user: { id: "u-1", email: "a@b.com", displayName: "Ananya", provider: "email" }, displayName: "Ananya" },
  }),
}));

const FACTS: FactCard[] = [
  {
    id: "ac_setpoint",
    icon: "ac",
    habit: "learn.ac_setpoint.habit",
    better_habit: "learn.ac_setpoint.better",
    why: "learn.ac_setpoint.why",
    sources: [],
    clip: null,
  },
];

function renderLearn() {
  return render(<LearnTab facts={FACTS} savedNotes={[]} onOpen={vi.fn()} />);
}

function videos() {
  return document.querySelectorAll(".learn-video__thumb img");
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  h.wifiOnly = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window.navigator as Navigator & { connection?: unknown }).connection;
});

describe("Learn watch grid", () => {
  it("renders eight clip cards from the manifest", () => {
    const { container } = renderLearn();
    expect(container.querySelectorAll(".learn-video__list li")).toHaveLength(8);
    expect(screen.getAllByRole("button", { name: /^Play / })).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Cooling" })).toBeInTheDocument();
  });

  it("shows an illustrated placeholder and a Coming soon chip when the poster fails", async () => {
    renderLearn();
    const poster = videos()[0];
    fireEvent.error(poster);
    await waitFor(() => expect(screen.getByText("Clip coming soon")).toBeInTheDocument());
    expect(document.querySelectorAll(".learn-video__poster-fallback")).toHaveLength(1);
  });

  it("opens the player with a captions track and Up next", async () => {
    renderLearn();
    fireEvent.click(screen.getByRole("button", { name: "Play AC with a fan" }));

    const video = await waitFor(() => {
      const el = document.querySelector(".learn-video__video");
      if (!el) throw new Error("no video yet");
      return el as HTMLVideoElement;
    });
    expect(video.getAttribute("preload")).toBe("none");
    const track = video.querySelector("track");
    expect(track).not.toBeNull();
    expect(track?.getAttribute("kind")).toBe("captions");
    expect(track?.hasAttribute("default")).toBe(true);
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Related habit" })).toBeInTheDocument();
  });

  it("shows Coming soon with Retry when the clip file is missing", async () => {
    renderLearn();
    fireEvent.click(screen.getByRole("button", { name: "Play AC with a fan" }));
    const video = (await waitFor(() => {
      const el = document.querySelector(".learn-video__video");
      if (!el) throw new Error("no video yet");
      return el as HTMLVideoElement;
    })) as HTMLVideoElement;
    fireEvent.error(video);
    await waitFor(() => expect(screen.getByText("This clip could not play.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("asks before playing on mobile data when Wi-Fi only is on", async () => {
    h.wifiOnly = true;
    Object.defineProperty(window.navigator, "connection", { value: { type: "cellular" }, configurable: true });
    renderLearn();

    fireEvent.click(screen.getByRole("button", { name: "Play AC with a fan" }));
    await waitFor(() => expect(screen.getByText("You are on mobile data")).toBeInTheDocument());
    expect(document.querySelector(".learn-video__video")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Play clip" }));
    await waitFor(() => expect(document.querySelector(".learn-video__video")).not.toBeNull());
  });

  it("renders no track element when the clip has no captions key", () => {
    const noCaptionsClip = {
      id: "learn-no-cap",
      title: "No Captions Clip",
      category: "Cooling" as const,
      src: "/learn/test.mp4",
      poster: "/learn/test.jpg",
      durationSec: 30,
    };
    render(
      <ClipPlayerSheet
        clip={noCaptionsClip}
        cellular={false}
        upNext={[]}
        relatedId={null}
        onClose={vi.fn()}
        onRelated={vi.fn()}
        onPlayClip={vi.fn()}
      />
    );
    const video = document.querySelector(".learn-video__video");
    expect(video).not.toBeNull();
    expect(video?.querySelector("track")).toBeNull();
  });
});