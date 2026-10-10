import { describe, expect, it } from "vitest";
import { MISSIONS, MISSION_IDS, RECOMMENDED_MISSION_ID, isMissionDone } from "../missions";

describe("mission catalogue", () => {
  it("keeps the recommended sweep plus the three designed missions", () => {
    expect(RECOMMENDED_MISSION_ID).toBe("standby_sweep");
    expect(MISSIONS.map((m) => m.id)).toEqual(["ac", "daylight", "geyser"]);
    expect(MISSION_IDS).toEqual(["standby_sweep", "ac", "daylight", "geyser"]);
  });

  it("knows which missions are done today", () => {
    expect(isMissionDone(["ac"], "ac")).toBe(true);
    expect(isMissionDone(["ac"], "geyser")).toBe(false);
    expect(isMissionDone([], "standby_sweep")).toBe(false);
  });
});