import { describe, expect, it } from "vitest";
import communityContract from "../../../../contracts/community-payloads.json";
import type { CommunityTag, ReactionType } from "../api/data";

const TAGS: CommunityTag[] = ["energy_saving", "solar", "trees", "waste", "water", "community_drive", "other"];
const REACTIONS: ReactionType[] = ["grow", "sun", "cheer", "love", "idea"];

describe("community API contract (frontend ↔ backend)", () => {
  it("uses supported tags and reaction types from the shared contract", () => {
    expect(TAGS).toContain(communityContract.valid.post.tag);
    expect(REACTIONS).toContain(communityContract.valid.reaction.type);
  });

  it("documents feed limits the HTTP client emits", () => {
    const limits = communityContract.valid.feedQueries.map((q) => Number(q.query.limit));
    expect(limits).toEqual([20, 1]);
    for (const limit of limits) {
      expect(limit).toBeGreaterThanOrEqual(1);
      expect(limit).toBeLessThanOrEqual(20);
    }
  });

  it("keeps upload ticket size within the backend cap", () => {
    expect(communityContract.valid.uploadTicket.size).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
});
