import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  isRoutableFailureForCrossProtocol,
  isRoutableFailureForUrlCandidate,
} from "../../src/provider/provider-error.js";

const providerErrorSource = new URL("../../src/provider/provider-error.ts", import.meta.url);

describe("provider routing-failure predicates", () => {
  it("DRY-ROUTE-001 treats 404 and 400 as URL-candidate routing failures", () => {
    // Given: URL-candidate failures that mean a different base URL shape may route.
    const statuses = [404, 400] as const;

    // When: each status is checked against the URL-candidate predicate.
    const results = statuses.map((status) => isRoutableFailureForUrlCandidate({ status }));

    // Then: both statuses advance to the next URL candidate.
    expect(results).toEqual([true, true]);
  });

  it("DRY-ROUTE-002 rejects non-routing statuses for URL-candidate fallback", () => {
    // Given: statuses that should not be fixed by trying another URL candidate.
    const statuses = [401, 500, 422, null] as const;

    // When: each status is checked against the URL-candidate predicate.
    const results = statuses.map((status) => isRoutableFailureForUrlCandidate({ status }));

    // Then: none of them advance to another URL candidate.
    expect(results).toEqual([false, false, false, false]);
  });

  it("DRY-ROUTE-003 keeps cross-protocol fallback restricted to 404 only", () => {
    // Given: cross-protocol dispatcher statuses including routing and payload failures.
    const statuses = [404, 400, null] as const;

    // When: each status is checked against the cross-protocol predicate.
    const results = statuses.map((status) => isRoutableFailureForCrossProtocol({ status }));

    // Then: only a true route miss crosses protocol boundaries.
    expect(results).toEqual([true, false, false]);
  });

  it("DRY-ROUTE-004 documents why 400 is excluded from cross-protocol fallback", async () => {
    // Given: the provider-error module owns the shared routing-failure predicates.
    const source = await readFile(providerErrorSource, "utf8");

    // When: the rationale comment is inspected.
    const hasRationale = source.includes(
      "Firing cross-protocol fallback on a payload-400 would silently mask wire-shape bugs",
    );

    // Then: the cross-protocol 400 exclusion remains explicitly documented.
    expect(hasRationale).toBe(true);
  });
});
