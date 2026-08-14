// SPDX-License-Identifier: MIT
//
// Failing contract tests for the parse-warnings plumbing of the
// empty-body hardening work (plan: fix-empty-finding-bodies, T12).
//
// These tests are RED until T13/T14 land:
//   - `ParseWarning["reason"]` must accept "empty-body" and
//     "body-alias" (src/cli/parse-warnings.ts:15). Until then the
//     typed constructions below fail `tsc` with union errors — that
//     IS the failing signal for this group (sanctioned per plan).
//   - `buildParseWarningsArtifact` must zero-initialize the two new
//     byReason keys (src/cli/parse-warnings.ts:126-129).
//   - The duplicate byReason literal in the artifact writer path
//     (src/cli/run.ts:549-560, `writeParseWarningsArtifact`) must
//     carry the same keys — the closed-enum tripwire lives in TWO
//     places, so this is pinned by a source-scan (the writer is a
//     private function; the artifact-path test cannot reach it).
//   - An empty-body comment the pipeline suppresses must surface as
//     exactly one warning entry with reason "empty-body", the index
//     of the comment in the ORIGINAL `comments` array the model
//     emitted, and source "comments" (mirroring how
//     collectParseWarnings indexes `review.comments[i]`).
//   - A comment whose body was recovered from a non-canonical alias
//     key (e.g. `description`) must surface as exactly one warning
//     entry with reason "body-alias" naming the alias `field` and
//     the `commentIndex` of the observation.
//
// The entry-shape groups drive the real `requestLiveReview` pipeline
// with a fetch stub (pattern: live-provider-model-discovery.test.ts)
// and assert on the JSON-serialized artifact shape, so the contract
// pins what lands in parse-warnings.json rather than an internal type.
//
// DO NOT use `as any` / `@ts-ignore` here to silence the union errors —
// they are the point.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildParseWarningsArtifact } from "../../src/cli/parse-warnings.js";
import type { ParseWarning } from "../../src/cli/parse-warnings.js";
import { requestLiveReview } from "../../src/cli/live-provider.js";
import type { ParsedCliArgs } from "../../src/cli/parse-args.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// Both anchorable positions in the fixture diff (context line 1 and
// the added line 2), so the empty-body/alias warnings under test are
// NOT polluted by off-diff ("path-not-in-diff" / "line-not-in-diff")
// warnings from collectParseWarnings.
const FIXTURE_DIFF = [
  "diff --git a/src/example.ts b/src/example.ts",
  "--- a/src/example.ts",
  "+++ b/src/example.ts",
  "@@ -1,3 +1,3 @@",
  " const marker = 1;",
  "-const old = 0;",
  "+const fresh = 2;",
].join("\n");

const API_URL = "https://provider.invalid/v1";
const API_KEY = "task-twelve-api-key-do-not-leak";
const MODEL_ID = "review-model-test";

/**
 * Structural view of a parse-warnings.json entry. The artifact is the
 * serialized contract operators consume; T13/T14 may extend the in-memory
 * `ParseWarning` type, so the entry assertions read through JSON to pin
 * the on-disk shape without depending on the not-yet-extended type.
 */
type SerializedParseWarning = {
  readonly reason: string;
  readonly source?: string;
  readonly index?: number;
  readonly field?: string;
  readonly commentIndex?: number;
  readonly modelPath?: string;
};

function parsed(): ParsedCliArgs {
  // Mirrors live-provider-model-discovery.test.ts: an explicit model so
  // no /models discovery call happens, and strict/verify defaults.
  return {
    platform: "auto",
    eventPath: null,
    diffPath: null,
    files: null,
    threadsPath: null,
    reviewPath: null,
    prNumber: "1",
    repo: "example/repo",
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: MODEL_ID,
    promptFile: null,
    promptFiles: null,
    additionalPromptFile: null,
    additionalPromptFiles: null,
    prompt: null,
    additionalPrompt: null,
    effort: null,
    provider: "openai-compatible",
    githubApiBase: null,
    includeSonarqube: false,
    includePrSonarFindings: false,
    sonarHostUrl: null,
    sonarToken: null,
    sonarProjectKey: null,
    sonarTimeoutSeconds: null,
    minimumSeverity: "medium",
    minimumSeverityInternal: null,
    maxComments: null,
    reviewFileLimit: null,
    detectLeaks: true,
    walkthrough: false,
    diagnostic: false,
    debugRawResponse: false,
    simulateFindings: false,
    reviewTimeoutSeconds: 60,
    stallSeconds: 50,
    perRequestTimeoutSeconds: 30,
    maxOutputTokens: 4096,
    dryRun: false,
    outputArtifact: null,
    strictSchema: true,
    verifyFindings: true,
    instructionFiles: true,
  };
}

/**
 * Fetch stub that returns the same OpenAI-Responses-shaped success body
 * on every call. Cycling (rather than exhausting) keeps the stub robust
 * against the self-healing retry paths, which may issue extra calls.
 */
function makeCyclingResponsesFetchStub(reviewJson: string): typeof fetch {
  const responseBody = {
    id: "response-task-twelve",
    model: MODEL_ID,
    output: [{ type: "message", content: [{ type: "output_text", text: reviewJson }] }],
  };
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  return fetchImpl;
}

async function runLiveReview(reviewJson: string) {
  return requestLiveReview({
    parsed: parsed(),
    cwd: process.cwd(),
    env: {},
    fetchImpl: makeCyclingResponsesFetchStub(reviewJson),
    platform: "github",
    diffText: FIXTURE_DIFF,
    platformToken: "platform-token",
  });
}

function serializeWarnings(warnings: readonly unknown[]): readonly SerializedParseWarning[] {
  return JSON.parse(JSON.stringify(warnings)) as readonly SerializedParseWarning[];
}

// ---------------------------------------------------------------------------
// Group 1 — ParseWarning["reason"] accepts the new values (tsc signal)
// ---------------------------------------------------------------------------

describe("ParseWarning reason union — empty-body + body-alias", () => {
  it("constructs a typed ParseWarning with reason 'empty-body'", () => {
    const warning: ParseWarning = {
      reason: "empty-body",
      source: "comments",
      index: 0,
      modelPath: "src/example.ts",
      modelLine: 1,
      modelSeverity: "medium",
      bodyExcerpt: "",
    };
    expect(warning.reason).toBe("empty-body");
  });

  it("constructs a typed ParseWarning with reason 'body-alias'", () => {
    const warning: ParseWarning = {
      reason: "body-alias",
      source: "comments",
      index: 0,
      modelPath: "src/example.ts",
      modelLine: 1,
      modelSeverity: "medium",
      bodyExcerpt: "recovered from description",
    };
    expect(warning.reason).toBe("body-alias");
  });
});

// ---------------------------------------------------------------------------
// Group 2 — buildParseWarningsArtifact zero-initializes the new byReason keys
// ---------------------------------------------------------------------------

describe("buildParseWarningsArtifact — byReason zero-init for the new reasons", () => {
  it("zero-initializes byReason['empty-body'] on a clean review", () => {
    const artifact = buildParseWarningsArtifact({
      review: { comments: [], suppressedComments: [] },
      diffText: FIXTURE_DIFF,
    });
    expect(artifact.summary.byReason["empty-body"]).toBe(0);
  });

  it("zero-initializes byReason['body-alias'] on a clean review", () => {
    const artifact = buildParseWarningsArtifact({
      review: { comments: [], suppressedComments: [] },
      diffText: FIXTURE_DIFF,
    });
    expect(artifact.summary.byReason["body-alias"]).toBe(0);
  });

  it("keeps the existing reasons zero-initialized alongside the new keys", () => {
    const artifact = buildParseWarningsArtifact({
      review: { comments: [], suppressedComments: [] },
      diffText: FIXTURE_DIFF,
    });
    expect(artifact.summary.byReason["path-not-in-diff"]).toBe(0);
    expect(artifact.summary.byReason["line-not-in-diff"]).toBe(0);
    expect(artifact.summary.byReason["empty-body"]).toBe(0);
    expect(artifact.summary.byReason["body-alias"]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Group 3 — the duplicate byReason literal in the run.ts writer path
// ---------------------------------------------------------------------------

describe("writeParseWarningsArtifact (src/cli/run.ts) — duplicate byReason literal", () => {
  it("zero-initializes 'empty-body' and 'body-alias' in the writer's byReason literal", async () => {
    // The writer is a private function in run.ts, so the artifact-path
    // unit test cannot invoke it directly. Pin the initializer by
    // source-scan (same pattern as test-marker-literals.test.ts): the
    // closed-enum tripwire lives in BOTH parse-warnings.ts and run.ts.
    const source = await readFile(
      resolve(import.meta.dirname, "..", "..", "src", "cli", "run.ts"),
      "utf8",
    );
    const writerStart = source.indexOf("async function writeParseWarningsArtifact");
    expect(writerStart).toBeGreaterThanOrEqual(0);
    const writerSource = source.slice(writerStart);
    expect(writerSource).toContain('"empty-body": 0');
    expect(writerSource).toContain('"body-alias": 0');
  });
});

// ---------------------------------------------------------------------------
// Group 4 — empty-body suppressed finding produces one warning entry
// ---------------------------------------------------------------------------

describe("empty-body suppressed finding → parse-warnings entry", () => {
  // Mixed review (one populated + one empty-body finding): the populated
  // finding must post while the empty one is suppressed with disclosure.
  const REVIEW_JSON = JSON.stringify({
    summary: "Two findings; one arrived with an empty body.",
    verdict: "NEEDS_FIX",
    comments: [
      {
        path: "src/example.ts",
        line: 2,
        body: "Populated finding: the added line shadows nothing, but deserves a note.",
        severity: "medium",
        category: "correctness",
      },
      {
        path: "src/example.ts",
        line: 1,
        body: "",
        severity: "low",
        category: "style",
      },
    ],
    suppressed_comments: [],
  });

  it("records exactly one 'empty-body' warning for the suppressed finding", async () => {
    const outcome = await runLiveReview(REVIEW_JSON);
    const entries = serializeWarnings(outcome.parseWarnings);
    const emptyBodyEntries = entries.filter((entry) => entry.reason === "empty-body");
    expect(emptyBodyEntries).toHaveLength(1);
  }, 30000);

  it("attributes the 'empty-body' warning to the comments array at the model's index", async () => {
    const outcome = await runLiveReview(REVIEW_JSON);
    const entries = serializeWarnings(outcome.parseWarnings);
    const emptyBody = entries.find((entry) => entry.reason === "empty-body");
    expect(emptyBody).toBeDefined();
    // Contract: `source` names the array the model emitted the comment in
    // ("comments"), and `index` is the position in that ORIGINAL array
    // (review.comments[1] — the second finding), mirroring how
    // collectParseWarnings indexes review.comments[i].
    expect(emptyBody?.source).toBe("comments");
    expect(emptyBody?.index).toBe(1);
    expect(emptyBody?.modelPath).toBe("src/example.ts");
  }, 30000);
});

// ---------------------------------------------------------------------------
// Group 5 — alias-used finding produces one warning entry naming the field
// ---------------------------------------------------------------------------

describe("body-alias finding → parse-warnings entry", () => {
  const REVIEW_JSON = JSON.stringify({
    summary: "One finding whose body text arrived under a synonym key.",
    verdict: "COMMENT",
    comments: [
      {
        path: "src/example.ts",
        line: 2,
        description: "Body recovered from the non-canonical description alias key.",
        severity: "medium",
        category: "correctness",
      },
    ],
    suppressed_comments: [],
  });

  it("records exactly one 'body-alias' warning for the alias resolution", async () => {
    const outcome = await runLiveReview(REVIEW_JSON);
    const entries = serializeWarnings(outcome.parseWarnings);
    const aliasEntries = entries.filter((entry) => entry.reason === "body-alias");
    expect(aliasEntries).toHaveLength(1);
  }, 30000);

  it("names the alias field and the comment index in the 'body-alias' entry", async () => {
    const outcome = await runLiveReview(REVIEW_JSON);
    const entries = serializeWarnings(outcome.parseWarnings);
    const aliasEntry = entries.find((entry) => entry.reason === "body-alias");
    expect(aliasEntry).toBeDefined();
    expect(aliasEntry?.field).toBe("description");
    expect(aliasEntry?.commentIndex).toBe(0);
  }, 30000);
});
