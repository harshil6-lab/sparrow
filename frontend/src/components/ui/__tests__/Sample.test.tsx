import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sample } from "../Sample";
import { profileFor } from "../../../lib/types";

describe("SAMPLE badge", () => {
  it("renders the SAMPLE label for any non-user figure", () => {
    render(<Sample />);
    expect(screen.getByText("SAMPLE")).toBeInTheDocument();
  });
});

describe("zero state for new users", () => {
  it("starts a new Nest with empty answers and no numbers", () => {
    const profile = profileFor(
      { id: "u1", email: "n@e.com", displayName: "N", provider: "email" },
      "en",
    );
    expect(profile.introSeen).toBe(false);
    expect(profile.setupComplete).toBe(false);
    expect(profile.answers.appliances).toEqual([]);
    expect(profile.answers.homeType).toBeNull();
    expect(profile.answers.usualBill).toBeNull();
  });
});

