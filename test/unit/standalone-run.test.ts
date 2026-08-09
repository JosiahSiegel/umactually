import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
import { isStandaloneMode, runStandalone } from "../../src/cli/standalone-run.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

const API_URL = "https://provider.invalid/v1";
const API_KEY = "standalone-test-key";
const MODEL_ID = "test-model";
const REVIEW = {
  summary: "No actionable findings.",
  verdict: "APPROVED",
  comments: [],
  suppressedComments: [],
} as const;

function providerResponse(): Response {
  const reviewText = JSON.stringify({
    summary: REVIEW.summary,
    verdict: REVIEW.verdict,
    comments: REVIEW.comments,
    suppressed_comments: REVIEW.suppressedComments,
  });
  return new Response(JSON.stringify({
    id: "resp_standalone",
    model: "test-model",
    output: [{ type: "message", content: [{ type: "output_text", text: reviewText }] }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("isStandaloneMode", () => {
  it("returns true when the environment has no CI markers", () => {
    expect(isStandaloneMode({})).toBe(true);
  });

  it("returns false for the canonical GitHub Actions marker", () => {
    expect(isStandaloneMode({ GITHUB_ACTIONS: "true" })).toBe(false);
  });

  it("returns false for the canonical Azure Pipelines marker", () => {
    expect(isStandaloneMode({ TF_BUILD: "True" })).toBe(false);
  });

  it("returns false for the uppercase canonical CI marker", () => {
    expect(isStandaloneMode({ GITHUB_ACTIONS: "TRUE" })).toBe(false);
  });

  it("returns true for a non-canonical truthy-looking marker", () => {
    expect(isStandaloneMode({ GITHUB_ACTIONS: "yes" })).toBe(true);
  });
});

describe("runStandalone", () => {
  let cwd: string;
  let eventPath: string;
  let diffPath: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "umactually-standalone-"));
    eventPath = join(cwd, "event.json");
    diffPath = join(cwd, "review.diff");
    writeFileSync(eventPath, JSON.stringify({ pull_request: { number: null } }), "utf8");
    writeFileSync(diffPath, "diff --git a/file.ts b/file.ts\n+const answer = 42;\n", "utf8");
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("returns ok and writes the default artifact after a valid provider response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse());
    const parsed = parseCliArgs([
      "--api-url", API_URL, "--api-key", API_KEY, "--model", MODEL_ID, "--event", eventPath, "--diff", diffPath,
    ]);

    const result = await runStandalone({ parsed, cwd, env: {}, fetchImpl });

    const artifactPath = resolve(cwd, "umactually-review.json");
    expect(result).toMatchObject({ kind: "ok", artifactPath, review: {
      summary: REVIEW.summary,
      verdict: REVIEW.verdict,
      comments: REVIEW.comments,
    } });
    expect(existsSync(artifactPath)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("writes the standalone artifact contract with the canonical marker", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse());
    const parsed = parseCliArgs([
      "--api-url", API_URL, "--api-key", API_KEY, "--model", MODEL_ID, "--event", eventPath, "--diff", diffPath,
    ]);

    await runStandalone({ parsed, cwd, env: {}, fetchImpl });

    const artifact = JSON.parse(readFileSync(join(cwd, "umactually-review.json"), "utf8"));
    expect(artifact).toMatchObject({
      mode: "standalone",
      artifactPath: resolve(cwd, "umactually-review.json"),
      posted: false,
      review: {
        summary: REVIEW.summary,
        verdict: REVIEW.verdict,
        comments: REVIEW.comments,
      },
      marker: REVIEW_MARKER,
    });
  });

  it("returns provider-error with exit code 1 when the provider rejects the request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new Error("401 unauthorized")));
    const parsed = parseCliArgs([
      "--api-url", API_URL, "--api-key", API_KEY, "--model", MODEL_ID, "--event", eventPath, "--diff", diffPath,
    ]);

    const result = await runStandalone({ parsed, cwd, env: {}, fetchImpl });

    expect(result).toMatchObject({ kind: "provider-error", exitCode: 1 });
  });

  it("returns ok-no-diff, writes an artifact, and skips the provider for an empty diff", async () => {
    writeFileSync(diffPath, "", "utf8");
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse());
    const parsed = parseCliArgs([
      "--api-url", API_URL, "--api-key", API_KEY, "--model", MODEL_ID, "--event", eventPath, "--diff", diffPath,
    ]);

    const result = await runStandalone({ parsed, cwd, env: {}, fetchImpl });

    expect(result).toMatchObject({
      kind: "ok-no-diff",
      artifactPath: resolve(cwd, "umactually-review.json"),
    });
    expect(existsSync(join(cwd, "umactually-review.json"))).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("writes the 'standalone review wrote' stdout banner after a successful provider response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse());
    const parsed = parseCliArgs([
      "--api-url", API_URL, "--api-key", API_KEY, "--model", MODEL_ID, "--event", eventPath, "--diff", diffPath,
    ]);

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const result = await runStandalone({ parsed, cwd, env: {}, fetchImpl });

      expect(result).toMatchObject({ kind: "ok" });
      const written = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
      expect(written).toContain("umactually: standalone review wrote ");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("writes the 'standalone review (no diff) wrote' stdout banner for an empty diff", async () => {
    writeFileSync(diffPath, "", "utf8");
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse());
    const parsed = parseCliArgs([
      "--api-url", API_URL, "--api-key", API_KEY, "--model", MODEL_ID, "--event", eventPath, "--diff", diffPath,
    ]);

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const result = await runStandalone({ parsed, cwd, env: {}, fetchImpl });

      expect(result).toMatchObject({ kind: "ok-no-diff" });
      const written = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
      expect(written).toContain("umactually: standalone review (no diff) wrote ");
    } finally {
      vi.restoreAllMocks();
    }
  });
});
