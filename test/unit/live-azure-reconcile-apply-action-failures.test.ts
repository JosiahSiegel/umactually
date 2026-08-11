// SPDX-License-Identifier: MIT
//
// ITER-2f coverage-lift tests for `live-azure-reconcile.ts` (new code in
// PR #209). Focuses on the `applyAction` failure branches and the
// `preserve-other-run` action kind — none of which were covered by the
// existing 23-test matrix.
//
// The `transitionRules` orchestrator is the existing 23-test contract;
// this file is additive only and never modifies those assertions.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyPriorThreads,
  transitionRules,
  buildFingerprintMarkers,
  reconcileAzureThreads,
  type AzureThreadRecord,
  type DurableFindingWithIdentity,
  type ReconcileContext,
  type ReconcileOutcome,
} from "../../src/cli/live-azure-reconcile.js";

const SYNTHETIC_BASE_URL =
  "https://dev.azure.com/test-org/test-project/_apis/git/repositories/test-repo/pullRequests/42";
const SYNTHETIC_CONTEXT: ReconcileContext = { kind: "synthetic", baseUrl: SYNTHETIC_BASE_URL };

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
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
      body: "synthetic body",
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

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

function makeRecorder(): { calls: RecordedCall[]; fetchImpl: typeof fetch } {
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
    calls.push({ url, method, body });
    return makeJsonResponse({}, 200);
  };
  return { calls, fetchImpl };
}

describe("live-azure-reconcile — applyAction failure branches (ITER-2f coverage)", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("create-new: POST /threads returns 200 with no id → patch-failed with retryable=true", async () => {
    const { calls } = makeRecorder();
    const fetchImplNoId: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      const body = typeof rawBody === "string" ? safeParseJson(rawBody) : null;
      calls.push({ url, method, body });
      if (method === "POST" && url.includes("/threads?")) {
        return makeJsonResponse({}, 200);
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
      fetchImpl: fetchImplNoId,
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("patch-failed");
    if (outcomes[0]!.kind === "patch-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.threadId).toBe(0);
      expect(outcomes[0]!.error).toBe("POST /threads returned no id");
    }
  });

  it("create-new: POST /threads throws → patch-failed with retryable=true + stderr warning", async () => {
    const throwingFetch: typeof fetch = async () => {
      throw new Error("network down");
    };

    const actions = transitionRules({
      priorClassified: [],
      currentFindings: [
        finding({ fingerprint: "fp-B", identityDigest: "id-B", path: "/src/b.ts", line: 1 }),
      ],
      currentHeadSha: "head-NEW",
      priorHeadSha: "",
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
      fetchImpl: throwingFetch,
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("patch-failed");
    if (outcomes[0]!.kind === "patch-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.error).toBe("network down");
    }
    const stderrLines = (stderrSpy?.mock.calls ?? []).map((args: unknown) =>
      String((args as readonly unknown[])[0] ?? ""),
    );
    expect(
      stderrLines.some((line: string) => line.includes("warning") && line.includes("network down")),
    ).toBe(true);
  });

  it("patch-body: PATCH /threads/.../comments/... returns HTTP 409 → patch-failed retryable", async () => {
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
    const conflictingFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      if (method === "PATCH" && url.includes("/comments/800")) {
        return new Response("conflict", { status: 409 });
      }
      return makeJsonResponse({}, 200);
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl: conflictingFetch,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("patch-failed");
    if (outcomes[0]!.kind === "patch-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.error).toBe("HTTP 409");
    }
  });

  it("patch-body: PATCH throws → patch-failed retryable + stderr warning", async () => {
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
    const throwingFetch: typeof fetch = async () => {
      throw new Error("patch exploded");
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl: throwingFetch,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("patch-failed");
    if (outcomes[0]!.kind === "patch-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.error).toBe("patch exploded");
    }
  });

  it("native-close: PATCH /threads/...?status=closed returns HTTP 500 → native-close-failed", async () => {
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
    const serverErrorFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      if (method === "PATCH" && url.includes("/threads/700?")) {
        return new Response("server error", { status: 500 });
      }
      return makeJsonResponse({}, 200);
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl: serverErrorFetch,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("native-close-failed");
    if (outcomes[0]!.kind === "native-close-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.threadId).toBe(700);
      expect(outcomes[0]!.error).toBe("HTTP 500");
    }
  });

  it("native-close: PATCH throws → native-close-failed retryable", async () => {
    const prior = asThreadRecord({
      id: 701,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 801,
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
    const throwingFetch: typeof fetch = async () => {
      throw new Error("socket reset");
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-SAME",
      currentAttemptId: "att-SAME",
      currentHeadSha: "head-NEW",
      fetchImpl: throwingFetch,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("native-close-failed");
    if (outcomes[0]!.kind === "native-close-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.threadId).toBe(701);
      expect(outcomes[0]!.error).toBe("socket reset");
    }
  });

  it("native-reopen: PATCH /threads/...?status=active returns HTTP 403 → patch-failed retryable=false", async () => {
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
          runId: "run-PREV",
          attemptId: "att-PREV",
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
    const forbiddenFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      if (method === "PATCH" && url.includes("/threads/900?")) {
        return new Response("forbidden", { status: 403 });
      }
      return makeJsonResponse({}, 200);
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      currentHeadSha: "head-NEW",
      fetchImpl: forbiddenFetch,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("patch-failed");
    if (outcomes[0]!.kind === "patch-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.threadId).toBe(900);
      expect(outcomes[0]!.error).toBe("HTTP 403");
    }
  });

  it("native-reopen: PATCH throws → patch-failed retryable", async () => {
    const prior = asThreadRecord({
      id: 901,
      status: "closed",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 902,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-PREV",
          attemptId: "att-PREV",
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
    const throwingFetch: typeof fetch = async () => {
      throw new Error("reopen timeout");
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEW",
      currentAttemptId: "att-NEW",
      currentHeadSha: "head-NEW",
      fetchImpl: throwingFetch,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("patch-failed");
    if (outcomes[0]!.kind === "patch-failed") {
      expect(outcomes[0]!.retryable).toBe(true);
      expect(outcomes[0]!.threadId).toBe(901);
      expect(outcomes[0]!.error).toBe("reopen timeout");
    }
  });

  it("mark-superseded: PATCH /threads/...?status=closed returns HTTP 500 → patch-failed retryable", async () => {
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
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [currentFinding],
      currentHeadSha: "head-NEWER",
      priorHeadSha: "head-EVEN-OLDER",
      currentRunId: "run-NEWER",
      currentAttemptId: "att-NEWER",
      resolutionMode: "logical",
    });
    const olderServerErrorFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      if (method === "PATCH" && url.includes("/threads/1001?")) {
        return new Response("server error", { status: 500 });
      }
      return makeJsonResponse({}, 200);
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEWER",
      currentAttemptId: "att-NEWER",
      currentHeadSha: "head-NEWER",
      fetchImpl: olderServerErrorFetch,
    });
    const supersedeFailure = outcomes.find((o) => o.kind === "patch-failed" && o.threadId === 1001);
    expect(supersedeFailure).toBeDefined();
    if (supersedeFailure && supersedeFailure.kind === "patch-failed") {
      expect(supersedeFailure.retryable).toBe(true);
      expect(supersedeFailure.error).toBe("HTTP 500");
    }
  });

  it("mark-superseded: PATCH throws → patch-failed retryable", async () => {
    const newerThread = asThreadRecord({
      id: 2000,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 2001,
      content: "<!-- umactually -->\n" +
        buildFingerprintMarkers({
          fingerprint: "fp-A",
          identityDigest: "id-A",
          runId: "run-NEWER",
          attemptId: "att-NEWER",
        }),
    });
    const olderThread = asThreadRecord({
      id: 2001,
      status: "active",
      filePath: "/src/a.ts",
      line: 1,
      commentId: 2002,
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
    const actions = transitionRules({
      priorClassified: classified,
      currentFindings: [currentFinding],
      currentHeadSha: "head-NEWER",
      priorHeadSha: "head-EVEN-OLDER",
      currentRunId: "run-NEWER",
      currentAttemptId: "att-NEWER",
      resolutionMode: "logical",
    });
    const throwingFetch: typeof fetch = async () => {
      throw new Error("supersede lost");
    };
    const outcomes = await reconcileAzureThreads({
      context: SYNTHETIC_CONTEXT,
      actions,
      currentRunId: "run-NEWER",
      currentAttemptId: "att-NEWER",
      currentHeadSha: "head-NEWER",
      fetchImpl: throwingFetch,
    });
    const supersedeFailure = outcomes.find((o) => o.kind === "patch-failed" && o.threadId === 2001);
    expect(supersedeFailure).toBeDefined();
    if (supersedeFailure && supersedeFailure.kind === "patch-failed") {
      expect(supersedeFailure.retryable).toBe(true);
      expect(supersedeFailure.error).toBe("supersede lost");
    }
  });
});
