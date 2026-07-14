import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  isRecord,
  type GithubFixture,
  REVIEW_MARKER,
  runGithubCli,
  startGithubFixture,
} from "../helpers/cli-only-github-fixture.js";

const PROVIDER_REVIEW_URL = new URL("../fixtures/github/provider-review.json", import.meta.url);

function parseJsonLine(stdout: string): Record<string, unknown> {
  const lines = stdout.trimEnd().split(/\r?\n/u);
  expect(lines).toHaveLength(1);
  const parsed: unknown = JSON.parse(lines[0] ?? "");
  if (!isRecord(parsed)) {
    throw new TypeError("CLI JSON envelope must be an object");
  }
  return parsed;
}

function postedBodies(fixture: GithubFixture): readonly string[] {
  return fixture.calls
    .filter((call) => call.method === "POST" && call.path.endsWith("/pulls/42/reviews"))
    .map((call) => call.body);
}

describe("CLI-only GitHub live contracts", () => {
  let fixture: GithubFixture | undefined;

  afterEach(async () => {
    if (fixture !== undefined) {
      await fixture.close();
      fixture = undefined;
    }
  });

  it("E2E-A: bare GitHub live invocation derives plumbing and posts one JSON outcome", async () => {
    // Given: a provider and GitHub API exposed by one deterministic local server.
    const providerReview = await readFile(PROVIDER_REVIEW_URL, "utf8");
    fixture = await startGithubFixture({ providerBody: providerReview });

    // When: the published shim receives no wrapper-era plumbing flags.
    const result = await runGithubCli(fixture.apiUrl);

    // Then: the CLI succeeds, emits one envelope, and performs the live GitHub surface.
    expect(result.status).toBe(0);
    const envelope = parseJsonLine(result.stdout);
    expect(envelope).toMatchObject({ schemaVersion: 1, command: "review", exitCode: 0 });
    expect(envelope["outcome"]).toMatchObject({ ok: true });
    expect(envelope["outcome"]).not.toMatchObject({ parseFailed: true });
    expect(fixture.calls).toContainEqual(expect.objectContaining({
      method: "GET",
      path: "/repos/example/umactually-fixture/pulls/42",
    }));
    expect(postedBodies(fixture)).toHaveLength(1);
    expect(postedBodies(fixture)[0]).toContain(REVIEW_MARKER);
  });

  it("E2E-B: an existing submitted marker review is deleted before its replacement is posted", async () => {
    // Given: GitHub already contains one submitted marker review.
    const providerReview = await readFile(PROVIDER_REVIEW_URL, "utf8");
    fixture = await startGithubFixture({
      providerBody: providerReview,
      existingReviews: [{ id: 7001, state: "COMMENTED", body: `${REVIEW_MARKER}\nold review` }],
    });

    // When: the CLI posts the new review.
    const result = await runGithubCli(fixture.apiUrl);

    // Then: exactly one old review is deleted and one replacement is created.
    expect(result.status).toBe(0);
    expect(fixture.calls.filter((call) => call.method === "DELETE")).toEqual([
      expect.objectContaining({ path: "/repos/example/umactually-fixture/pulls/42/reviews/7001" }),
    ]);
    expect(postedBodies(fixture)).toHaveLength(1);
  });

  it("E2E-C: malformed provider output posts a bounded parse-fail marker card and exits one", async () => {
    // Given: malformed output with distinct head and tail diagnostics beyond the 16 KB budget.
    const malformed = `HEAD-DIAGNOSTIC\n${"x".repeat(24_000)}\nTAIL-DIAGNOSTIC`;
    fixture = await startGithubFixture({ providerBody: malformed });

    // When: the CLI cannot parse the provider review.
    const result = await runGithubCli(fixture.apiUrl);

    // Then: CI fails but GitHub still receives one bounded diagnostic review.
    expect(result.status).toBe(1);
    const posts = postedBodies(fixture);
    expect(posts).toHaveLength(1);
    const body = posts[0] ?? "";
    expect(body).toContain(REVIEW_MARKER);
    expect(body).toContain("parseFailed");
    expect(body).toContain("HEAD-DIAGNOSTIC");
    expect(body).toContain("TAIL-DIAGNOSTIC");
    expect(body.length).toBeLessThan(20_000);
  });
});
