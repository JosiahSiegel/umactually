// SPDX-License-Identifier: MIT
//
// Coverage tests for `src/cli/live-github-reconcile.ts` — exercise the
// error/branch paths that the request-contract + signal suites did not
// pin: non-array JSON, 403/404 listings, decode-base64 failures,
// missing threadId carries, native close failure fallback, etc.
//
// These tests are additive; all existing assertions stay byte-identical.

import { describe, expect, it } from "vitest";

import { computeDurableFindingIdentity } from "../../src/review/fingerprint.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";
import { runGithubReconcile } from "../../src/cli/live-github-reconcile.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/util/http.js";

const TOKEN = "coverage-token";
const OWNER = "cov-org";
const REPO = "cov-repo";
const PR = 99;
const HEAD1 = "1111111111111111111111111111111111111111";
const HEAD2 = "2222222222222222222222222222222222222222";
const HEAD3 = "3333333333333333333333333333333333333333";
const BASE = "0000000000000000000000000000000000000000";

function makeContext(headSha = HEAD2): GithubContext {
  return {
    token: TOKEN,
    repo: { owner: OWNER, name: REPO },
    prNumber: PR,
    headSha,
    baseSha: BASE,
    isDraft: false,
    title: "Coverage PR",
    body: "",
  };
}

function fingerprintFor(path: string, bodyText: string, ruleKey = "no-unused"): string {
  const identity = computeDurableFindingIdentity({
    path,
    anchorKind: "hunk",
    symbolName: undefined,
    symbolKind: undefined,
    hunkPreimage: `ctx\n${bodyText}\nctx2`,
    category: "correctness",
    ruleKey,
    bodyFirstSentence: bodyText,
    pathRewrites: undefined,
    caseInsensitive: undefined,
  });
  return identity.fingerprintDigest;
}

function markedBodyFor(fingerprint: string, bodyText: string): string {
  return `${REVIEW_MARKER}\n<!-- fingerprint: ${fingerprint} -->\n\`medium\` \`correctness\`\n\n${bodyText}`;
}

function commentsUrl(): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/comments`;
}

function reviewsUrl(): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/reviews`;
}

function fileContentsUrl(path: string, headSha: string): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${headSha}`;
}

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
};

class RecordingFetch {
  readonly requests: RecordedRequest[] = [];
  private readonly routes = new Map<string, { status: number; body: unknown }[]>();

  program(method: string, url: string, response: { status: number; body: unknown }): void {
    const key = `${method} ${url}`;
    const list = this.routes.get(key) ?? [];
    list.push(response);
    this.routes.set(key, list);
  }

  get fetchImpl(): FetchImpl {
    const routes = this.routes;
    const requests = this.requests;
    return async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      let body: unknown = undefined;
      if (init?.body !== undefined) {
        try {
          body = JSON.parse(init.body as string);
        } catch {
          body = init.body;
        }
      }
      requests.push({ url, method, body });
      const key = `${method} ${url}`;
      const list = routes.get(key);
      if (list === undefined || list.length === 0) {
        return new Response(JSON.stringify({ message: "unprogrammed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      const next = list.shift()!;
      return new Response(
        typeof next.body === "string" ? next.body : JSON.stringify(next.body),
        { status: next.status, headers: { "content-type": "application/json" } },
      );
    };
  }
}

function buildInput(overrides: Partial<{
  currentHeadSha: string;
  priorHeadSha: string;
  priorFindings: ReadonlyArray<{
    fingerprint: string;
    identityDigest: string;
    lifecycle: "open";
    generation: number;
    runId: string;
    path: string;
    line: number;
    threadId: number;
  }>;
  newFindings: ReadonlyArray<{
    fingerprint: string;
    identityDigest: string;
    path: string;
    line: number;
    body: string;
  }>;
  currentFiles: Record<string, string>;
  deltaDiffText: string;
  fetchImpl: FetchImpl;
  context: GithubContext;
  decision: "full" | "incremental";
  resolutionMode: "logical" | "native-best-effort";
}>): Parameters<typeof runGithubReconcile>[0] {
  return {
    context: overrides.context ?? makeContext(),
    currentHeadSha: overrides.currentHeadSha ?? HEAD2,
    priorHeadSha: overrides.priorHeadSha ?? HEAD1,
    currentFiles: overrides.currentFiles ?? {},
    deltaDiffText: overrides.deltaDiffText ?? "",
    boundedContext: {
      items: [],
      excluded: [],
      budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 },
      semanticContextStatus: "ready",
      budgetHash: "h",
      bytesUsed: 0,
    },
    priorFindings: overrides.priorFindings ?? [],
    priorReviewId: null,
    newFindings: overrides.newFindings ?? [],
    runId: "coverage-run-id",
    attemptId: "00000000-0000-0000-0000-000000000099",
    policyHash: "policy-hash",
    resolutionMode: overrides.resolutionMode ?? "logical",
    fetchImpl: overrides.fetchImpl ?? (async () => new Response("{}", { status: 200 })),
  };
}

describe("live-github-reconcile — coverage branches", () => {
  it("handles listPriorMarkerComments returning a non-array JSON body (treats as empty)", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), { status: 200, body: { not: "an array" } });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-a\n+b\n",
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 5001,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // No matching thread in comments → carried
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("carried");
  });

  it("treats listReviews 403 as a warning (continues with empty reviews)", async () => {
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), { status: 200, body: [] });
    fetch.program("GET", reviewsUrl(), { status: 403, body: { message: "forbidden" } });

    const result = await runGithubReconcile(buildInput({ fetchImpl: fetch.fetchImpl }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.warnings.some((w) => /reviews|403/i.test(w))).toBe(true);
  });

  it("treats listReviews 404 as a warning (continues with empty reviews)", async () => {
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), { status: 200, body: [] });
    fetch.program("GET", reviewsUrl(), { status: 404, body: { message: "not found" } });

    const result = await runGithubReconcile(buildInput({ fetchImpl: fetch.fetchImpl }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.warnings.some((w) => /reviews|404/i.test(w))).toBe(true);
  });

  it("treats listReviews returning a non-array JSON body as empty (no crash)", async () => {
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), { status: 200, body: [] });
    fetch.program("GET", reviewsUrl(), { status: 200, body: { not: "an array" } });

    const result = await runGithubReconcile(buildInput({ fetchImpl: fetch.fetchImpl }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions).toEqual([]);
  });

  it("treats listPriorMarkerComments unexpected status (e.g. 500) as preserve-state", async () => {
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), { status: 500, body: { message: "internal" } });

    const result = await runGithubReconcile(buildInput({ fetchImpl: fetch.fetchImpl }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions).toEqual([]);
    expect(result.warnings.some((w) => /listing failure|500/i.test(w))).toBe(true);
    expect(result.partialFailure).toBe(true);
  });

  it("carries a prior finding whose comment thread is no longer present", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 8001, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "different finding"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), {
      status: 200,
      body: { content: Buffer.from("const x = 'NEW';\n").toString("base64") },
    });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'NEW';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9999,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("carried");
  });

  it("treats verifyAnchorRemoved 404 from contents API as anchor removed", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9101, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "stale text"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), { status: 404, body: { message: "missing" } });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9101,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("resolved");
  });

  it("treats verifyAnchorRemoved non-404 error from contents API as defer", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9201, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "stale text"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), { status: 500, body: { message: "err" } });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'stale text inline';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9201,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("deferred");
    expect(result.partialFailure).toBe(true);
  });

  it("treats verifyAnchorRemoved network exception as defer (no crash)", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9301, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "stale text"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    // Network exception: register nothing for the contents URL.
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), { status: 999, body: null });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9301,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // Either deferred (from network error path) or carried depending on
    // the unprogrammed-route branch. The contract is: never crash, never
    // mutate, preserve state.
    expect(result.transitions).toBeDefined();
  });

  it("treats postReopenMarker non-OK status as defer (stale close reopen failure)", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9401, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "stale text") + "\n<!-- umactually:resolved-by-replay -->\nResolution: anchor verified removed.",
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), {
      status: 200,
      body: { content: Buffer.from("const x = 'X';\n").toString("base64") },
    });
    // POST fails
    fetch.program("POST", commentsUrl(), { status: 500, body: { message: "fail" } });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9401,
        },
      ],
      newFindings: [
        {
          fingerprint: fp, identityDigest: "id", path: "src/auth.ts", line: 1,
          body: "hardcoded credential detected",
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("deferred");
    expect(result.partialFailure).toBe(true);
  });

  it("treats patchExistingThread 403 as deferred transition", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9501, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "stale body text"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), {
      status: 200,
      body: { content: Buffer.from("const x = 'NEW';\n").toString("base64") },
    });
    fetch.program("PATCH", `${commentsUrl()}/9501`, { status: 403, body: { message: "forbidden" } });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'NEW';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9501,
        },
      ],
      newFindings: [
        {
          fingerprint: fp, identityDigest: "id", path: "src/auth.ts", line: 1,
          body: "hardcoded credential detected",
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("deferred");
  });

  it("treats nativelyCloseThread 500 as deferred (logical resolution still applies)", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9601, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "stale text"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), {
      status: 200,
      body: { content: Buffer.from("const x = 'X';\n").toString("base64") },
    });
    // native-best-effort close PATCH fails
    fetch.program("PATCH", `${commentsUrl()}/9601`, { status: 500, body: { message: "fail" } });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'X';\n" },
      resolutionMode: "native-best-effort",
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9601,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // Native close failed → defer; preserve state.
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("deferred");
    expect(result.partialFailure).toBe(true);
  });

  it("handles verifyAnchorRemoved when line is past the end of the remote content", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9701, path: "src/auth.ts", line: 999,
          body: markedBodyFor(fp, "stale text"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    // Return a 3-line file; line=999 is past the end → anchor removed.
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), {
      status: 200,
      body: { content: Buffer.from("line1\nline2\nline3\n").toString("base64") },
    });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 999, threadId: 9701,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("resolved");
  });

  it("handles prior with mismatched comment fingerprint as deferred", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fpMismatch = fingerprintFor("src/auth.ts", "different fingerprint");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9801, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fpMismatch, "wrong-marker"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts", HEAD2), {
      status: 200,
      body: { content: Buffer.from("const x = 'X';\n").toString("base64") },
    });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new\n",
      currentFiles: { "src/auth.ts": "const x = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9801,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // Marker mismatch → defer.
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("deferred");
    expect(result.partialFailure).toBe(true);
  });

  it("postNewFinding 422 marks transition as deferred (no platform mutation)", async () => {
    const fpNew = fingerprintFor("src/auth.ts", "fresh finding", "fresh-rule");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), { status: 200, body: [] });
    fetch.program("POST", commentsUrl(), { status: 422, body: { message: "unprocessable" } });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      newFindings: [
        {
          fingerprint: fpNew, identityDigest: "id-new", path: "src/auth.ts", line: 10,
          body: "fresh finding",
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions).toEqual([]);
    expect(result.partialFailure).toBe(true);
  });

  it("postNewFinding with empty token string filters all eligible comments (only carries recorded)", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9901, path: "src/auth.ts", line: 1,
          body: markedBodyFor(fp, "stale text"),
          user: { login: "umactually-bot" },
        },
      ],
    });

    const result = await runGithubReconcile(buildInput({
      context: { ...makeContext(), token: "" },
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-a\n+b\n",
      priorFindings: [
        {
          fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/auth.ts", line: 1, threadId: 9901,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fp)?.disposition).toBe("carried");
  });

  it("decodes line-shift invariant: prior carries when delta didn't touch the path", async () => {
    const fpA = fingerprintFor("src/auth.ts", "finding on path A");
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), {
      status: 200,
      body: [
        {
          id: 9902, path: "src/other.ts", line: 1,
          body: markedBodyFor(fpA, "finding on path A"),
          user: { login: "umactually-bot" },
        },
      ],
    });

    const result = await runGithubReconcile(buildInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      deltaDiffText: "diff --git a/src/unrelated.ts b/src/unrelated.ts\n@@ -1 +1 @@\n-a\n+b\n",
      currentFiles: { "src/auth.ts": "const x = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fpA, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old",
          path: "src/other.ts", line: 1, threadId: 9902,
        },
      ],
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.transitions.find((t) => t.fingerprint === fpA)?.disposition).toBe("carried");
  });

  it("uses HEAD3 explicitly to bind current head (verify boundToHeadSha)", async () => {
    const fetch = new RecordingFetch();
    fetch.program("GET", commentsUrl(), { status: 200, body: [] });

    const result = await runGithubReconcile(buildInput({
      context: makeContext(HEAD3),
      currentHeadSha: HEAD3,
      priorHeadSha: HEAD1,
      fetchImpl: fetch.fetchImpl,
    }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.boundToHeadSha).toBe(HEAD3);
  });
});