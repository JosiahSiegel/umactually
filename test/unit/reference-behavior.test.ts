import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { REVIEW_MARKER, commentBodyHasMarker } from "../../src/util/marker.js";

const compatibilityPath = new URL("../../src/review/compatibility.ts", import.meta.url);
const priorMarker = `<!-- ${["auto", "pr", "review"].join("-")} -->`;

describe("current review marker contract", () => {
  it("GH-S1-001 recognizes only the current marker in untrusted comment bodies", () => {
    // Given: external comments containing either the current marker or only the prior marker.
    const currentMarkerBody = `${REVIEW_MARKER}\nCurrent review body.`;
    const priorMarkerBody = `${priorMarker}\nPrior review body.`;

    // When: the runtime marker detector evaluates each body.
    const recognizesCurrentMarker = commentBodyHasMarker(currentMarkerBody);
    const recognizesPriorMarker = commentBodyHasMarker(priorMarkerBody);

    // Then: only the current marker participates in deduplication.
    expect(recognizesCurrentMarker).toBe(true);
    expect(recognizesPriorMarker).toBe(false);
  });

  it("GH-S1-002 keeps the existing-review fixture current-marker-only", async () => {
    // Given: the external GitHub comments fixture.
    const existingCommentsJson = await readFile(
      new URL("../fixtures/github/existing-review-comments.json", import.meta.url),
      "utf8",
    );

    // When: fixture bodies are inspected through their machine-consumed markers.
    const containsCurrentMarker = existingCommentsJson.includes(REVIEW_MARKER);
    const containsPriorMarker = existingCommentsJson.includes(priorMarker);

    // Then: stale fixture state cannot reintroduce prior-marker recognition.
    expect(containsCurrentMarker).toBe(true);
    expect(containsPriorMarker).toBe(false);
  });

  it("GH-S1-003 removes the standalone compatibility verifier", async () => {
    // Given: the former compatibility module path.
    // When: the filesystem is queried for that product module.
    const compatibilityModuleExists = await access(compatibilityPath).then(
      () => true,
      () => false,
    );

    // Then: there is no compatibility replacement outside the marker detector.
    expect(compatibilityModuleExists).toBe(false);
  });
});
