// Unit tests for the Azure DevOps incremental review thread reconciliation
// protocol (Task 11).
//
// The reconciler owns:
//   1. classifyPriorThreads — map every existing marker-bearing thread to a
//      durable fingerprint + identityDigest (NEVER file+line alone).
//   2. transitionRules — apply the EXACT reconsidered / carried / deferred /
//      resolved rules from Task 10 using `priorHeadSha..currentHeadSha`.
//   3. Mutate + finalize — replay-reconciled POST / PATCH / DELETE loop,
//      fenced by the state-parent fencing token (Task 9).
//   4. Native-best-effort stale-close repair — when an old run's native
//      close landed, the current-head run deterministically reopens or
//      replaces it and marks the stale thread superseded.
//   5. Parent-card ordering / update semantics — preserved verbatim.
//
// Lifecycle matrix asserted below:
//   * INITIAL        — no prior marker threads → only `create-new`.
//   * UNCHANGED      — same (fingerprint, identityDigest), same head →
//                      skip (no POST/PATCH/close).
//   * CHANGED        — same fingerprint, different identityDigest →
//                      PATCH body (no close, no new thread).
//   * FIXED          — finding no longer in current → logical-resolve
//                      (default) or native-close (opt-in native-best-
//                      effort mode).
//   * STALE-CLOSE    — old run closed the marker thread; current-head
//                      run reopens or replaces and marks superseded.
//   * HUMAN/UNMARKED — no marker → ZERO mutations.
//   * DIFFERENT FP   — same (path, line), different fingerprint → ZERO
//                      mutations (NEVER treat file+line alone as identity).
//   * DIFFERENT RUN  — prior thread belongs to a different runId /
//                      configHash → NEVER closed by us.
//
// Failure-mode matrix:
//   * Stale create + stale update land after a newer attempt finalizes —
//     explicit current-head repair pass converges to one canonical marker
//     thread per fingerprint and marks stale bot threads superseded.
//   * PATCH 409 (conflict) / 403 (forbidden) → warning + replay-safe
//     retryable state, NO duplicate parent.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyPriorThreads,
  transitionRules,
  buildFingerprintMarkers,
  parseFingerprintMarkers,
  reconcileAzureThreads,
  type AzureThreadRecord,
  type DurableFindingWithIdentity,
  type ReconcileOutcome,
  type ReconcileContext,
} from "../../src/cli/live-azure-reconcile.js";

const SYNTHETIC_BASE_URL =
  "https://dev.azure.com/test-org/test-project/_apis/git/repositories/test-repo/pullRequests/42";
const SYNTHETIC_CONTEXT: ReconcileContext = { kind: "synthetic", baseUrl: SYNTHETIC_BASE_URL };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeErrorResponse(value: unknown, status: number): Response {
  return new Response(typeof value === "string" ? value : JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function asThreadRecord(value: {
  readonly id: number;
  readonly status: string;
  readonly filePath: string;
  readonly line: number;
  readonly commentId: number;
  readonly content: string;
}): AzureThreadRecord {
  return {
    id: value.id,
    status: value.status,
    threadContext: {
      filePath: value.filePath,
      rightFileStart: { line: value.line },
    },
    comments: [{ id: value.commentId, content: value.content }],
  };
}

function finding(value: {
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly path: string;
  readonly line: number;
  readonly body?: string;
}): DurableFindingWithIdentity {
  return {
    fingerprint: value.fingerprint,
    identityDigest: value.identityDigest,
    canonicalPath: value.path,
    canonicalAnchor: "hunk:0",
    normalizedCategory: "maintainability",
    normalizedRuleKey: "synthetic",
    comment: {
      path: value.path,
      line: value.line,
      body: value.body ?? "synthetic body",
      severity: "medium",
      category: "maintainability",
      durableIdentity: {
        fingerprintVersion: 1,
        fingerprintDigest: value.fingerprint,
        identityDigest: value.identityDigest,
        canonicalPath: value.path,
        anchorKind: "hunk",
        canonicalAnchor: "hunk:0",
        normalizedCategory: "maintainability",
        normalizedRuleKey: "synthetic",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Marker codec tests
// ---------------------------------------------------------------------------

describe("buildFingerprintMarkers / parseFingerprintMarkers", () => {
  it("round-trips fingerprint + identity + runId + attemptId through the comment body", () => {
    const body = buildFingerprintMarkers({
      fingerprint: "f-abc",
      identityDigest: "i-abc",
      runId: "run-xyz",
      attemptId: "att-123",
    });
    expect(body).toContain("<!-- umactually-fp:v1");
    expect(body).toContain("f-abc");
    expect(body).toContain("i-abc");
    expect(body).toContain("run-xyz");
    expect(body).toContain("att-123");

    const parsed = parseFingerprintMarkers(body);
    expect(parsed.fingerprint).toBe("f-abc");
    expect(parsed.identityDigest).toBe("i-abc");
    expect(parsed.runId).toBe("run-xyz");
    expect(parsed.attemptId).toBe("att-123");
  });

  it("returns nulls when no marker present (human/unmarked thread)", () => {
    const parsed = parseFingerprintMarkers("User wrote a comment with no markers.");
    expect(parsed.fingerprint).toBeNull();
    expect(parsed.identityDigest).toBeNull();
    expect(parsed.runId).toBeNull();
    expect(parsed.attemptId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classifyPriorThreads
// ---------------------------------------------------------------------------

describe("classifyPriorThreads", () => {
  const HEAD_B = "head-B-bbbbbbbbbbbbbb";

  it("marks a thread without fingerprint markers as human/unmarked — carriedByUs=false, fingerprintMatch=false", () => {
    const unmarked: AzureThreadRecord = asThreadRecord({
      id: 100,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 1,
      content: "<!-- umactually -->\nhuman comment without fp marker",
    });
    const current: readonly DurableFindingWithIdentity[] = [
      finding({ fingerprint: "fp-current", identityDigest: "id-current", path: "/src/a.ts", line: 1 }),
    ];
    const classified = classifyPriorThreads({
      threads: [unmarked],
      currentFindings: current,
      currentHeadSha: HEAD_B,
    });
    expect(classified).toHaveLength(1);
    const c = classified[0]!;
    expect(c.carriedByUs).toBe(false);
    expect(c.fingerprintMatch).toBe(false);
    expect(c.identityMatch).toBe(false);
  });

  it("matches a marker thread against a current finding by fingerprint+identityDigest (not file+line)", () => {
    const marked: AzureThreadRecord = asThreadRecord({
      id: 200,
      status: "active",
      filePath: "/src/a.ts",
      line: 5,
      commentId: 2,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-A",
          attemptId: "att-A",
        }) + "\nBody of finding A",
    });
    const currentSame: readonly DurableFindingWithIdentity[] = [
      finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 999 /* shifted */ }),
    ];
    const classified = classifyPriorThreads({
      threads: [marked],
      currentFindings: currentSame,
      currentHeadSha: HEAD_B,
    });
    expect(classified[0]!.fingerprintMatch).toBe(true);
    expect(classified[0]!.identityMatch).toBe(true);
    // The classifier reports the prior thread's line (5); line shifts
    // do not affect identity matching.
    expect(classified[0]!.currentLine).toBe(5);
  });

  it("NEVER treats file+line alone as identity — different fingerprint same-line is unmatched", () => {
    const marked: AzureThreadRecord = asThreadRecord({
      id: 300,
      status: "active",
      filePath: "/src/a.ts",
      line: 7,
      commentId: 3,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-OLD",
          identityDigest: "id-OLD",
          runId: "run-X",
          attemptId: "att-X",
        }),
    });
    const current: readonly DurableFindingWithIdentity[] = [
      finding({ fingerprint: "fp-NEW", identityDigest: "id-NEW", path: "/src/a.ts", line: 7 }),
    ];
    const classified = classifyPriorThreads({
      threads: [marked],
      currentFindings: current,
      currentHeadSha: HEAD_B,
    });
    expect(classified[0]!.fingerprintMatch).toBe(false);
    expect(classified[0]!.identityMatch).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transitionRules
// ---------------------------------------------------------------------------

describe("transitionRules (logical-resolution is default)", () => {
  const HEAD_PRIOR = "head-P-prior";
  const HEAD_CURRENT = "head-C-current";
  const RUN_CURRENT = "run-current";
  const ATTEMPT_CURRENT = "att-current";

  it("INITIAL — no prior threads → only `create-new` actions, no PATCH, no close", () => {
    const findings: readonly DurableFindingWithIdentity[] = [
      finding({ fingerprint: "fp-1", identityDigest: "id-1", path: "/src/a.ts", line: 1 }),
    ];
    const actions = transitionRules({
      priorClassified: [],
      currentFindings: findings,
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: "",
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "logical",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("create-new");
    expect(actions.some((a) => a.kind === "patch-body")).toBe(false);
    expect(actions.some((a) => a.kind === "native-close")).toBe(false);
    expect(actions.some((a) => a.kind === "logical-resolve")).toBe(false);
  });

  it("UNCHANGED — same fingerprint + same identity → `skip-unchanged`, ZERO POST/PATCH/close", () => {
    const prior = asThreadRecord({
      id: 1,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 11,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: RUN_CURRENT,
          attemptId: ATTEMPT_CURRENT,
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: HEAD_CURRENT,
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: HEAD_PRIOR,
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "logical",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("skip-unchanged");
  });

  it("CHANGED — same fingerprint, different identityDigest → `patch-body`, no close, no new thread", () => {
    const prior = asThreadRecord({
      id: 1,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 11,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-OLD",
          runId: RUN_CURRENT,
          attemptId: ATTEMPT_CURRENT,
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-NEW", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: HEAD_CURRENT,
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-NEW", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: HEAD_PRIOR,
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "logical",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("patch-body");
    expect(actions.some((a) => a.kind === "native-close")).toBe(false);
    expect(actions.some((a) => a.kind === "create-new")).toBe(false);
  });

  it("FIXED (logical) — finding no longer current → `logical-resolve`, NO native close", () => {
    const prior = asThreadRecord({
      id: 1,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 11,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: RUN_CURRENT,
          attemptId: ATTEMPT_CURRENT,
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: HEAD_PRIOR,
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "logical",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("logical-resolve");
    expect(actions.some((a) => a.kind === "native-close")).toBe(false);
  });

  it("FIXED (native-best-effort) — opt-in mode promotes `logical-resolve` to `native-close`", () => {
    const prior = asThreadRecord({
      id: 1,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 11,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: RUN_CURRENT,
          attemptId: ATTEMPT_CURRENT,
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: HEAD_PRIOR,
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "native-best-effort",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("native-close");
  });

  it("HUMAN/UNMARKED — thread lacks fingerprint markers → ZERO mutations", () => {
    const human = asThreadRecord({
      id: 1,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 11,
      content: "<!-- umactually -->\nhuman wrote this, no fp marker",
    });
    const classified = classifyPriorThreads({
      threads: [human],
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: HEAD_PRIOR,
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "native-best-effort",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("preserve-human");
    expect(actions.some((a) => a.kind === "native-close")).toBe(false);
  });

  it("DIFFERENT RUN — prior runId differs → `preserve-other-run`, NO close", () => {
    const other = asThreadRecord({
      id: 1,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 11,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-OTHER",
          attemptId: "att-OTHER",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [other],
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: HEAD_PRIOR,
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "native-best-effort",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("preserve-other-run");
    expect(actions.some((a) => a.kind === "native-close")).toBe(false);
  });

  it("STALE-CLOSE — current run's prior attempt closed the thread (status=closed) → current-head run reopens via `native-reopen`", () => {
    const prior = asThreadRecord({
      id: 1,
      status: "closed",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 11,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: RUN_CURRENT,
          attemptId: ATTEMPT_CURRENT,
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: HEAD_CURRENT,
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: HEAD_CURRENT,
      priorHeadSha: HEAD_PRIOR,
      currentRunId: RUN_CURRENT,
      currentAttemptId: ATTEMPT_CURRENT,
      resolutionMode: "logical",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("native-reopen");
  });
});

// ---------------------------------------------------------------------------
// reconcileAzureThreads — POST/PATCH/close count assertions
// ---------------------------------------------------------------------------

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
};

function makeRecorder(): {
  readonly calls: RecordedCall[];
  readonly fetchImpl: typeof fetch;
} {
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
    calls.push({ url, method, body });
    // Default response: empty 200 unless route overrides.
    return makeJsonResponse({}, 200);
  };
  return { calls, fetchImpl };
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

describe("reconcileAzureThreads — POST/PATCH/close counts", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("INITIAL lifecycle — zero prior → exactly one POST, zero PATCH, zero DELETE", async () => {
    const recorder = makeRecorder();
    // Override /threads POST → return thread id 500.
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
      recorder.calls.push({ url, method, body });
      if (method === "POST" && url.includes("/threads?")) {
        return makeJsonResponse({ id: 500, comments: [{ id: 600 }] }, 200);
      }
      return makeJsonResponse({}, 200);
    };

    const actions = transitionRules({
      priorClassified: [],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
      priorHeadSha: "",
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      resolutionMode: "logical",
    });

    const outcomes: readonly ReconcileOutcome[] = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const posts = recorder.calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    const patches = recorder.calls.filter((c) => c.method === "PATCH");
    const deletes = recorder.calls.filter((c) => c.method === "DELETE");
    expect(posts).toHaveLength(1);
    expect(patches).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("created");
    expect(outcomes[0]!.threadId).toBe(500);
  });

  it("UNCHANGED carried — zero prior mutations on POST/PATCH/DELETE", async () => {
    const recorder = makeRecorder();
    const fetchImpl = recorder.fetchImpl;

    const prior = asThreadRecord({
      id: 700,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 800,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-SAME",
          attemptId: "att-SAME",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      resolutionMode: "logical",
    });
    expect(actions.every((a) => a.kind === "skip-unchanged")).toBe(true);

    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const posts = recorder.calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    const patches = recorder.calls.filter((c) => c.method === "PATCH");
    const deletes = recorder.calls.filter((c) => c.method === "DELETE");
    expect(posts).toHaveLength(0);
    expect(patches).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("skipped");
  });

  it("CHANGED — exactly one PATCH, zero POST, zero DELETE", async () => {
    const recorder = makeRecorder();
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
      recorder.calls.push({ url, method, body });
      return makeJsonResponse({}, 200);
    };

    const prior = asThreadRecord({
      id: 700,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 800,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-OLD",
          runId: "run-SAME",
          attemptId: "att-SAME",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-NEW", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-NEW", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      resolutionMode: "logical",
    });

    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const posts = recorder.calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    const patches = recorder.calls.filter((c) => c.method === "PATCH");
    const deletes = recorder.calls.filter((c) => c.method === "DELETE");
    expect(posts).toHaveLength(0);
    expect(patches).toHaveLength(1);
    expect(deletes).toHaveLength(0);
    expect(outcomes[0]!.kind).toBe("patched");
    // PATCH body carries the new identity markers.
    const patchBody = JSON.stringify(patches[0]!.body);
    expect(patchBody).toContain("id-NEW");
    expect(patchBody).not.toContain("id-OLD");
  });

  it("FIXED (logical default) — exactly one logical-resolve marker in outcomes, zero DELETE/POST/PATCH", async () => {
    const recorder = makeRecorder();
    const fetchImpl = recorder.fetchImpl;

    const prior = asThreadRecord({
      id: 700,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 800,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-SAME",
          attemptId: "att-SAME",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      resolutionMode: "logical",
    });
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const posts = recorder.calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    const patches = recorder.calls.filter((c) => c.method === "PATCH");
    const deletes = recorder.calls.filter((c) => c.method === "DELETE");
    expect(posts).toHaveLength(0);
    expect(patches).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(outcomes[0]!.kind).toBe("logical-resolved");
  });

  it("FIXED (native-best-effort) — exactly one DELETE-equivalent (status PATCH) on the prior thread", async () => {
    const recorder = makeRecorder();
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
      recorder.calls.push({ url, method, body });
      return makeJsonResponse({}, 200);
    };

    const prior = asThreadRecord({
      id: 700,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 800,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-SAME",
          attemptId: "att-SAME",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      resolutionMode: "native-best-effort",
    });

    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const patches = recorder.calls.filter((c) => c.method === "PATCH" && c.url.includes("/threads/700?"));
    expect(patches.length).toBeGreaterThanOrEqual(1);
    expect(patches[0]!.body).toMatchObject({ status: "closed" });
    expect(outcomes[0]!.kind).toBe("native-closed");
  });

  it("STALE-CLOSE — current-head run reopens via PATCH status=active and marks superseded", async () => {
    const recorder = makeRecorder();
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
      recorder.calls.push({ url, method, body });
      return makeJsonResponse({}, 200);
    };

    const prior = asThreadRecord({
      id: 900,
      status: "closed",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 901,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-OLD",
          attemptId: "att-OLD",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      resolutionMode: "logical",
    });

    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const patches = recorder.calls.filter((c) => c.method === "PATCH" && c.url.includes("/threads/900?"));
    expect(patches.length).toBeGreaterThanOrEqual(1);
    // The reopen PATCH must set status=active on the stale thread.
    expect(patches[0]!.body).toMatchObject({ status: "active" });
    expect(outcomes.some((o) => o.kind === "reopened")).toBe(true);
  });

  it("HUMAN/UNMARKED thread → ZERO POST/PATCH/DELETE, outcome=preserved", async () => {
    const recorder = makeRecorder();
    const fetchImpl = recorder.fetchImpl;

    const human = asThreadRecord({
      id: 950,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 951,
      content: "<!-- umactually -->\nhuman wrote this",
    });
    const classified = classifyPriorThreads({
      threads: [human],
      currentFindings: [],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      resolutionMode: "native-best-effort",
    });
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const posts = recorder.calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    const patches = recorder.calls.filter((c) => c.method === "PATCH");
    const deletes = recorder.calls.filter((c) => c.method === "DELETE");
    expect(posts).toHaveLength(0);
    expect(patches).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(outcomes[0]!.kind).toBe("preserved");
  });

  it("DIFFERENT RUN thread → ZERO mutations, outcome=preserved-other-run", async () => {
    const recorder = makeRecorder();
    const fetchImpl = recorder.fetchImpl;

    const other = asThreadRecord({
      id: 960,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 961,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-OTHER",
          attemptId: "att-OTHER",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [other],
      currentFindings: [],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      resolutionMode: "native-best-effort",
    });
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    const posts = recorder.calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    const patches = recorder.calls.filter((c) => c.method === "PATCH");
    const deletes = recorder.calls.filter((c) => c.method === "DELETE");
    expect(posts).toHaveLength(0);
    expect(patches).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(outcomes[0]!.kind).toBe("preserved-other-run");
  });

  it("FAILED PATCH (409 conflict) → warning + replay-safe retryable state without duplicate parent", async () => {
    const recorder = makeRecorder();
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
      recorder.calls.push({ url, method, body });
      if (method === "PATCH") {
        return makeErrorResponse({ message: "TF400002: conflict" }, 409);
      }
      return makeJsonResponse({}, 200);
    };

    const prior = asThreadRecord({
      id: 970,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 971,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-OLD",
          runId: "run-SAME",
          attemptId: "att-SAME",
        }),
    });
    const classified = classifyPriorThreads({
      threads: [prior],
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-NEW", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
    });
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [
        finding({ fingerprint: "fp-A", identityDigest: "id-NEW", path: "/src/a.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
      priorHeadSha: "head-OLD",
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      resolutionMode: "logical",
    });

    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl,
    });

    // Failed PATCH should NOT post a duplicate thread. Outcome carries
    // an error + retryable marker.
    const posts = recorder.calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    expect(posts).toHaveLength(0);
    expect(outcomes[0]!.kind).toBe("patch-failed");
    if (outcomes[0]!.kind === "patch-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.threadId).toBe(970);
    }
    // Stderr captured the warning.
    const stderrLines = (stderrSpy?.mock.calls ?? []).map((args: unknown) =>
      String((args as readonly unknown[])[0] ?? ""),
    );
    expect(stderrLines.some((line: string) => line.includes("warning") && line.includes("970"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Convergence: interleaved runs at fence/mutation/finalize boundaries
// ---------------------------------------------------------------------------

describe("convergence — interleaved runs converge to one canonical marker thread per fingerprint", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("older run's stale create + stale update that arrive AFTER newer run finalized → explicit current-head repair converges to one canonical marker thread, stale bot threads marked superseded", async () => {
    // Scenario:
    //   - Prior state has TWO bot threads with the same fingerprint but
    //     different runIds: one from a NEWER run (canonical), one from
    //     an OLDER run (stale).
    //   - The OLDER run lands a stale create and a stale update AFTER
    //     the NEWER run already finalized.
    //   - The reconciler must converge to ONE canonical marker thread
    //     (the one with currentHeadSha + currentRunId) and the older
    //     run's thread must be marked superseded (PATCH status=closed +
    //     superseded marker).
    const calls: RecordedCall[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
      calls.push({ url, method, body });
      return makeJsonResponse({}, 200);
    };

    const newerThread = asThreadRecord({
      id: 1000,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 1001,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-NEWER",
          attemptId: "att-NEWER",
        }),
    });
    const olderThread = asThreadRecord({
      id: 1001,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 1002,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-OLDER",
          attemptId: "att-OLDER",
        }),
    });

    const currentFinding = finding({ fingerprint: "fp-A", identityDigest: "id-A", path: "/src/a.ts", line: 1 });
    const classified = classifyPriorThreads({
      threads: [newerThread, olderThread],
      currentFindings: [currentFinding],
      currentHeadSha: "head-NEWER",
    });

    // Two prior threads with the same fingerprint but different runIds →
    // the older one (run-OLDER) must be marked superseded; the newer one
    // (run-NEWER) is canonical and is the carried/skip-unchanged entry.
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [currentFinding],
      currentHeadSha: "head-NEWER",
      priorHeadSha: "head-EVEN-OLDER",
      currentRunId: "run-NEWER",
      currentAttemptId: "att-NEWER",
      resolutionMode: "logical",
    });

    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEWER",
      currentAttemptId: "att-NEWER",
      currentHeadSha: "head-NEWER",
      fetchImpl,
    });

    const posts = calls.filter((c) => c.method === "POST" && c.url.includes("/threads?"));
    const patches = calls.filter((c) => c.method === "PATCH");
    const deletes = calls.filter((c) => c.method === "DELETE");

    // CRITICAL: NO new POST (we already have a canonical marker thread).
    expect(posts).toHaveLength(0);
    // CRITICAL: the older run's thread (id=1001) must be marked superseded
    // (PATCH closed + superseded marker); the newer thread (id=1000) is
    // skipped.
    const olderPatches = patches.filter((p) => p.url.includes("/threads/1001?"));
    expect(olderPatches.length).toBeGreaterThanOrEqual(1);
    expect(olderPatches[0]!.body).toMatchObject({ status: "closed" });
    const newerPatches = patches.filter((p) => p.url.includes("/threads/1000?"));
    expect(newerPatches).toHaveLength(0);
    // NO DELETE (we use PATCH-status to mark superseded on Azure threads).
    expect(deletes).toHaveLength(0);
    // Outcomes: one superseded, one skipped.
    expect(outcomes.some((o) => o.kind === "marked-superseded" && o.threadId === 1001)).toBe(true);
    expect(outcomes.some((o) => o.kind === "skipped" && o.threadId === 1000)).toBe(true);
  });
});