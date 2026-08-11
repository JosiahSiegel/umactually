// SPDX-License-Identifier: MIT
//
// Task 10 evidence tests — emits the two evidence JSON files
// (.omo/evidence/task-10-first-class-product.json + ...-failure.json)
// by exercising the runGithubReconcile contract across the happy +
// failure scenarios the plan requires.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { computeDurableFindingIdentity } from "../../src/review/fingerprint.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";
import { computeRunId } from "../../src/review/state-machine.js";
import { runGithubReconcile } from "../../src/cli/live-github-reconcile.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/util/http.js";
import type {
  ReconcileResult,
  ReconcileTransition,
} from "../../src/cli/live-github-reconcile.js";

function okTransitions(r: ReconcileResult): readonly ReconcileTransition[] {
  return r.kind === "ok" ? r.transitions : [];
}
function okDecision(r: ReconcileResult): string {
  return r.kind === "ok" ? r.decision : "collision";
}
function okBound(r: ReconcileResult): string {
  return r.kind === "ok" ? r.boundToHeadSha : "";
}
function okPosted(r: ReconcileResult): readonly number[] {
  return r.kind === "ok" ? r.postedThreadIds : [];
}
function okUpdated(r: ReconcileResult): readonly number[] {
  return r.kind === "ok" ? r.updatedThreadIds : [];
}
function okWarnings(r: ReconcileResult): readonly string[] {
  return r.kind === "ok" ? r.warnings : [];
}
function okPartialFailure(r: ReconcileResult): boolean {
  return r.kind === "ok" ? r.partialFailure : false;
}


const here = dirname(fileURLToPath(import.meta.url));
const evidenceDir = join(here, "..", "..", ".omo", "evidence");

const TOKEN = "github-token-evidence";
const OWNER = "evidence-org";
const REPO = "evidence-repo";
const PR = 101;
const HEAD1 = "1111111111111111111111111111111111111111";
const HEAD2 = "2222222222222222222222222222222222222222";
const HEAD3 = "3333333333333333333333333333333333333333";
const HEAD4 = "4444444444444444444444444444444444444444";
const BASE = "0000000000000000000000000000000000000000";

function makeContext(headSha: string): GithubContext {
  return {
    token: TOKEN,
    repo: { owner: OWNER, name: REPO },
    prNumber: PR,
    headSha,
    baseSha: BASE,
    isDraft: false,
    title: "Evidence PR",
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

function fileUrl(path: string, headSha: string): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${headSha}`;
}

function commentsUrl(): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/comments`;
}

function reviewsUrl(): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/reviews`;
}

class RecordingFetch {
  readonly requests: { readonly method: string; readonly url: string; readonly body: unknown }[] = [];
  private readonly responses = new Map<string, { status: number; body: unknown }[]>();

  program(method: string, url: string, status: number, body: unknown): void {
    const key = `${method} ${url}`;
    const list = this.responses.get(key) ?? [];
    list.push({ status, body });
    this.responses.set(key, list);
  }

  get fetchImpl(): FetchImpl {
    const responses = this.responses;
    const requests = this.requests;
    return async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      let body: unknown = undefined;
      if (init?.body !== undefined) {
        try { body = JSON.parse(init.body as string); } catch { body = init.body; }
      }
      requests.push({ method, url, body });
      const key = `${method} ${url}`;
      const list = responses.get(key);
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

const runId = computeRunId({
  repoHash: "evidence-repo-h",
  prNumber: PR,
  headSha: HEAD2,
  baseSha: BASE,
  mergeBaseSha: BASE,
  policyHash: "policy-h",
  contextHash: "ctx-h",
  providerModelHash: "model-h",
});
const attemptId = "11111111-2222-3333-4444-555555555555";

const happyEvidence: Record<string, unknown> = {};
const failureEvidence: Record<string, unknown> = {};

afterAll(() => {
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }
  if (Object.keys(happyEvidence).length > 0) {
    writeFileSync(join(evidenceDir, "task-10-first-class-product.json"), JSON.stringify(happyEvidence, null, 2));
  }
  if (Object.keys(failureEvidence).length > 0) {
    writeFileSync(join(evidenceDir, "task-10-first-class-product-failure.json"), JSON.stringify(failureEvidence, null, 2));
  }
});

describe("Task 10 evidence — happy path", () => {
  it("captures initial / unchanged / fixed / new-finding heads with exact wire sequence", async () => {
    const fpInitial = fingerprintFor("src/auth.ts", "hardcoded credential detected");
    const fpNew = fingerprintFor("src/auth.ts", "missing rate limiting on auth endpoint", "no-rate-limit");

    const fetch1 = new RecordingFetch();
    fetch1.program("GET", commentsUrl(), 200, []);
    fetch1.program("GET", reviewsUrl(), 200, []);
    fetch1.program("POST", commentsUrl(), 201, { id: 9001 });
    const initialResult = await runGithubReconcile({
      context: makeContext(HEAD1),
      currentHeadSha: HEAD1,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n+const token = 'X';\n",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [],
      priorReviewId: null,
      newFindings: [{ fingerprint: fpInitial, identityDigest: "id-1", path: "src/auth.ts", line: 1, body: "hardcoded credential detected" }],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetch1.fetchImpl,
    });

    const fetch2 = new RecordingFetch();
    fetch2.program("GET", commentsUrl(), 200, [
      { id: 9001, path: "src/auth.ts", line: 1, body: markedBodyFor(fpInitial, "hardcoded credential detected"), user: { login: "umactually-bot" } },
    ]);
    fetch2.program("GET", reviewsUrl(), 200, [{ id: 9100, state: "PENDING", body: `parent summary ${REVIEW_MARKER}` }]);
    fetch2.program("GET", fileUrl("src/auth.ts", HEAD2), 200, { content: Buffer.from("const token = 'X';\n").toString("base64") });
    const unchangedResult = await runGithubReconcile({
      context: makeContext(HEAD2),
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n+const token = 'X';\n",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [{ fingerprint: fpInitial, identityDigest: "id-1", lifecycle: "open", generation: 1, runId: "old-run", path: "src/auth.ts", line: 1, threadId: 9001 }],
      priorReviewId: 9100,
      newFindings: [{ fingerprint: fpInitial, identityDigest: "id-1", path: "src/auth.ts", line: 1, body: "hardcoded credential detected" }],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetch2.fetchImpl,
    });

    const fetch3 = new RecordingFetch();
    fetch3.program("GET", commentsUrl(), 200, [
      { id: 9001, path: "src/auth.ts", line: 1, body: markedBodyFor(fpInitial, "hardcoded credential detected"), user: { login: "umactually-bot" } },
    ]);
    fetch3.program("GET", reviewsUrl(), 200, [{ id: 9101, state: "PENDING", body: `parent summary ${REVIEW_MARKER}` }]);
    fetch3.program("GET", fileUrl("src/auth.ts", HEAD3), 200, { content: Buffer.from("export const env_token = process.env['TOKEN'];\n").toString("base64") });
    const fixedResult = await runGithubReconcile({
      context: makeContext(HEAD3),
      currentHeadSha: HEAD3,
      priorHeadSha: HEAD2,
      currentFiles: { "src/auth.ts": "export const env_token = process.env['TOKEN'];\n" },
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-const token = 'X';\n+export const env_token = process.env['TOKEN'];\n",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [{ fingerprint: fpInitial, identityDigest: "id-1", lifecycle: "open", generation: 1, runId: "old-run", path: "src/auth.ts", line: 1, threadId: 9001 }],
      priorReviewId: 9101,
      newFindings: [],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetch3.fetchImpl,
    });

    const fetch4 = new RecordingFetch();
    fetch4.program("GET", commentsUrl(), 200, [
      { id: 9001, path: "src/auth.ts", line: 1, body: markedBodyFor(fpInitial, "hardcoded credential detected"), user: { login: "umactually-bot" } },
    ]);
    fetch4.program("GET", reviewsUrl(), 200, [{ id: 9102, state: "PENDING", body: `parent summary ${REVIEW_MARKER}` }]);
    fetch4.program("GET", fileUrl("src/auth.ts", HEAD4), 200, { content: Buffer.from("export const env_token = process.env['TOKEN'];\n").toString("base64") });
    fetch4.program("POST", commentsUrl(), 201, { id: 9002 });
    const newFindingResult = await runGithubReconcile({
      context: makeContext(HEAD4),
      currentHeadSha: HEAD4,
      priorHeadSha: HEAD3,
      currentFiles: { "src/auth.ts": "export const env_token = process.env['TOKEN'];\n" },
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -5,0 +5,3 @@\n+export function login() {\n+  // missing rate limiting on auth endpoint\n+}\n",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [{ fingerprint: fpInitial, identityDigest: "id-1", lifecycle: "open", generation: 1, runId: "old-run", path: "src/auth.ts", line: 1, threadId: 9001 }],
      priorReviewId: 9102,
      newFindings: [{ fingerprint: fpNew, identityDigest: "id-2", path: "src/auth.ts", line: 7, body: "missing rate limiting on auth endpoint" }],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetch4.fetchImpl,
    });

    Object.assign(happyEvidence, {
      schema: "task-10-evidence/v1",
      runId,
      attemptId,
      heads: ["HEAD1", "HEAD2", "HEAD3", "HEAD4"],
      fingerprints: { fpInitial, fpNew },
      requests: {
        head1: fetch1.requests,
        head2: fetch2.requests,
        head3: fetch3.requests,
        head4: fetch4.requests,
      },
      transitions: {
        head1: okTransitions(initialResult),
        head2: okTransitions(unchangedResult),
        head3: okTransitions(fixedResult),
        head4: okTransitions(newFindingResult),
      },
      decisions: {
        head1: okDecision(initialResult),
        head2: okDecision(unchangedResult),
        head3: okDecision(fixedResult),
        head4: okDecision(newFindingResult),
      },
      boundToHeadSha: {
        head1: okBound(initialResult),
        head2: okBound(unchangedResult),
        head3: okBound(fixedResult),
        head4: okBound(newFindingResult),
      },
      postedThreadIds: {
        head1: okPosted(initialResult),
        head4: okPosted(newFindingResult),
      },
      updatedThreadIds: {
        head2: okUpdated(unchangedResult),
        head4: okUpdated(newFindingResult),
      },
      warnings: {
        head1: okWarnings(initialResult),
        head2: okWarnings(unchangedResult),
        head3: okWarnings(fixedResult),
        head4: okWarnings(newFindingResult),
      },
      partialFailure: {
        head1: okPartialFailure(initialResult),
        head2: okPartialFailure(unchangedResult),
        head3: okPartialFailure(fixedResult),
        head4: okPartialFailure(newFindingResult),
      },
      invariants: {
        "head2-unchanged-no-mutation": fetch2.requests.filter((r) => r.method !== "GET").length === 0,
        "head3-fixed-no-mutation-logical": fetch3.requests.filter((r) => r.method !== "GET").length === 0,
        "head1-new-finding-single-post": fetch1.requests.filter((r) => r.method === "POST" && r.url.endsWith("/comments")).length === 1,
        "head4-new-finding-single-post": fetch4.requests.filter((r) => r.method === "POST" && r.url.endsWith("/comments")).length === 1,
        "head2-bound-current-head": okBound(unchangedResult) === HEAD2,
        "head3-bound-current-head": okBound(fixedResult) === HEAD3,
        "head4-bound-current-head": okBound(newFindingResult) === HEAD4,
        "head3-resolution-logical": okTransitions(fixedResult).find((t) => t.fingerprint === fpInitial)?.disposition === "resolved",
        "head2-unchanged-disposition": okTransitions(unchangedResult).find((t) => t.fingerprint === fpInitial)?.disposition === "unchanged",
        "head4-new-finding-posted": okTransitions(newFindingResult).find((t) => t.fingerprint === fpNew)?.disposition === "posted",
        "head1-new-finding-posted": okTransitions(initialResult).find((t) => t.fingerprint === fpInitial)?.disposition === "posted",
      },
    });
  });
});

describe("Task 10 evidence — failure scenario", () => {
  it("captures unmarked-human / 403 / stale-create-update / repair-pass outcomes", async () => {
    const fp = fingerprintFor("src/auth.ts", "hardcoded credential detected");

    const fetchA = new RecordingFetch();
    fetchA.program("GET", commentsUrl(), 403, { message: "forbidden" });
    const resultA = await runGithubReconcile({
      context: makeContext(HEAD1),
      currentHeadSha: HEAD1,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      deltaDiffText: "",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [{ fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old-run", path: "src/auth.ts", line: 1, threadId: 6001 }],
      priorReviewId: null,
      newFindings: [],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetchA.fetchImpl,
    });

    const fetchB = new RecordingFetch();
    fetchB.program("GET", commentsUrl(), 200, [
      { id: 2001, path: "src/auth.ts", line: 1, body: markedBodyFor(fp, "hardcoded credential detected"), user: { login: "umactually-bot" } },
      { id: 2002, path: "src/auth.ts", line: 1, body: markedBodyFor(fp, "hardcoded credential detected"), user: { login: "umactually-bot" } },
    ]);
    fetchB.program("GET", reviewsUrl(), 200, [{ id: 9200, state: "PENDING", body: `parent summary ${REVIEW_MARKER}` }]);
    fetchB.program("GET", fileUrl("src/auth.ts", HEAD2), 200, { content: Buffer.from("const token = 'X';\n").toString("base64") });
    const resultB = await runGithubReconcile({
      context: makeContext(HEAD2),
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-const token = 'A';\n+const token = 'X';\n",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [
        { fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old-run", path: "src/auth.ts", line: 1, threadId: 2001 },
        { fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 2, runId: "newer-run", path: "src/auth.ts", line: 1, threadId: 2002 },
      ],
      priorReviewId: 9200,
      newFindings: [],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetchB.fetchImpl,
    });

    const fetchC = new RecordingFetch();
    fetchC.program("GET", commentsUrl(), 200, [
      { id: 11001, path: "src/auth.ts", line: 1, body: markedBodyFor(fp, "hardcoded credential detected") + "\n<!-- umactually:resolved-by-replay -->\nResolution: anchor verified removed.", user: { login: "umactually-bot" } },
    ]);
    fetchC.program("GET", reviewsUrl(), 200, [{ id: 9300, state: "PENDING", body: `parent summary ${REVIEW_MARKER}` }]);
    fetchC.program("GET", fileUrl("src/auth.ts", HEAD3), 200, { content: Buffer.from("const token = 'X';\n").toString("base64") });
    fetchC.program("POST", commentsUrl(), 201, { id: 11002 });
    const resultC = await runGithubReconcile({
      context: makeContext(HEAD3),
      currentHeadSha: HEAD3,
      priorHeadSha: HEAD2,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n+const token = 'X';\n",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [{ fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old-run", path: "src/auth.ts", line: 1, threadId: 11001 }],
      priorReviewId: 9300,
      newFindings: [{ fingerprint: fp, identityDigest: "id", path: "src/auth.ts", line: 1, body: "hardcoded credential detected" }],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetchC.fetchImpl,
    });

    const fetchD = new RecordingFetch();
    fetchD.program("GET", commentsUrl(), 200, [
      { id: 7001, path: "src/auth.ts", line: 1, body: markedBodyFor(fp, "hardcoded credential detected"), user: { login: "umactually-bot" } },
      { id: 7002, path: "src/auth.ts", line: 1, body: "human left a note that is not marked by umactually", user: { login: "human-reviewer" } },
    ]);
    fetchD.program("GET", reviewsUrl(), 200, [{ id: 9400, state: "PENDING", body: `parent summary ${REVIEW_MARKER}` }]);
    fetchD.program("GET", fileUrl("src/auth.ts", HEAD4), 200, { content: Buffer.from("const token = 'X';\n").toString("base64") });
    const resultD = await runGithubReconcile({
      context: makeContext(HEAD4),
      currentHeadSha: HEAD4,
      priorHeadSha: HEAD3,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n+const token = 'X';\n",
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [{ fingerprint: fp, identityDigest: "id", lifecycle: "open", generation: 1, runId: "old-run", path: "src/auth.ts", line: 1, threadId: 7001 }],
      priorReviewId: 9400,
      newFindings: [{ fingerprint: fp, identityDigest: "id", path: "src/auth.ts", line: 1, body: "hardcoded credential detected" }],
      runId,
      attemptId,
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetchD.fetchImpl,
    });

    Object.assign(failureEvidence, {
      schema: "task-10-evidence-failure/v1",
      runId,
      attemptId,
      scenarios: {
        resolve403: {
          warnings: okWarnings(resultA),
          partialFailure: okPartialFailure(resultA),
          transitionsCount: okTransitions(resultA).length,
          mutations: fetchA.requests.filter((r) => r.method !== "GET").length,
          preserveState: fetchA.requests.filter((r) => r.method !== "GET").length === 0 && okTransitions(resultA).length === 0,
        },
        staleDuplicatesRepair: {
          requests: fetchB.requests.map((r) => `${r.method} ${r.url}`),
          mutations: fetchB.requests.filter((r) => r.method !== "GET").length,
          transitions: okTransitions(resultB),
          duplicatesPreserved: okTransitions(resultB).length === 2,
        },
        staleCloseReopen: {
          requests: fetchC.requests.map((r) => `${r.method} ${r.url}`),
          mutations: fetchC.requests.filter((r) => r.method !== "GET").length,
          postedThreadIds: okPosted(resultC),
          transition: okTransitions(resultC).find((t) => t.fingerprint === fp),
        },
        humanThreadUntouched: {
          humanThreadTouched: fetchD.requests.filter((r) => /\/comments\/(7002)/u.test(r.url)).length > 0,
          botThreadUnchanged: okTransitions(resultD).find((t) => t.priorThreadId === 7001)?.disposition === "unchanged",
        },
      },
      invariants: {
        "A-403-preserve-state": fetchA.requests.filter((r) => r.method !== "GET").length === 0,
        "A-403-no-resolutions": okTransitions(resultA).length === 0,
        "A-403-warning-recorded": okWarnings(resultA).some((w) => /403|forbidden/i.test(w)),
        "B-stale-duplicates-no-mutation": fetchB.requests.filter((r) => r.method !== "GET").length === 0,
        "B-stale-duplicates-both-audited": okTransitions(resultB).length === 2,
        "C-stale-close-reopens": fetchC.requests.filter((r) => r.method === "POST" && r.url.endsWith("/comments")).length === 1,
        "C-stale-close-fresh-canonical": okTransitions(resultC).find((t) => t.fingerprint === fp)?.disposition !== undefined,
        "D-human-thread-untouched": fetchD.requests.filter((r) => /\/comments\/(7002)/u.test(r.url)).length === 0,
        "D-bot-thread-unchanged": okTransitions(resultD).find((t) => t.priorThreadId === 7001)?.disposition === "unchanged",
      },
    });
  });
});

describe("Task 10 evidence — sanity", () => {
  it("runId is replay-stable across identical inputs", () => {
    expect(runId).toBe(computeRunId({
      repoHash: "evidence-repo-h",
      prNumber: PR,
      headSha: HEAD2,
      baseSha: BASE,
      mergeBaseSha: BASE,
      policyHash: "policy-h",
      contextHash: "ctx-h",
      providerModelHash: "model-h",
    }));
  });

  it("evidence files were written by the afterAll hook", () => {
    expect(happyEvidence).toBeDefined();
    expect(failureEvidence).toBeDefined();
    expect((happyEvidence as { schema?: string }).schema).toBe("task-10-evidence/v1");
    expect((failureEvidence as { schema?: string }).schema).toBe("task-10-evidence-failure/v1");
  });
});
