import { describe, expect, it } from "vitest";
import contract from "../../../../contracts/bill-photo.json";
import { buildPhotoAttachPayload, buildPhotoUploadPayload } from "../photos";

describe("bill photo contract", () => {
  it("builds the valid upload examples without extra fields", () => {
    for (const example of contract.upload.valid) {
      expect(buildPhotoUploadPayload(example.contentType, example.size)).toEqual(example);
    }
  });

  it("builds the valid attach examples without extra fields", () => {
    for (const example of contract.attach.valid) {
      expect(buildPhotoAttachPayload(example.key)).toEqual(example);
    }
  });
});
