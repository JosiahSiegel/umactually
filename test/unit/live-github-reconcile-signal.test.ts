// SPDX-License-Identifier: MIT
//
// Tests for the AbortSignal handling, fingerprint-collision short-circuit,
// and signal bookkeeping in `runGithubReconcile`. These tests pin the F2
// review's runtime behavior that the previous fixup commit exposed via
// signatures only (no test coverage at HEAD 1007eb1).

import { describe, expect, it, vi } from "vitest";

import { runGithubReconcile } from "../../src/cli/live-github-reconcile.js";
import type { ReconcileInput } from "../../src/cli/live-github-reconcile.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/util/http.js";

const TOKEN = "github-token-signal";
const OWNER = "signal-org";
const REPO = "signal-repo";
const PR = 7;
const HEAD1 = "1111111111111111111111111111111111111111";
const HEAD2 = "2222222222222222222222222222222222222222";
const BASE = "0000000000000000000000000000000000000000";

function makeContext(): GithubContext {
  return {
    token: TOKEN,
    repo: { owner: OWNER, name: REPO },
    prNumber: PR,
    headSha: HEAD2,
    baseSha: BASE,
    isDraft: false,
    title: "Signal PR",
    body: "",
  };
}

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly signalAborted: boolean;
};

class CountingFetch {
  readonly calls: RecordedCall[] = [];
  private readonly responses = new Map<string, { status: number; body: unknown }[]>();

  program(method: string, url: string, response: { status: number; body: unknown }): void {
    const key = `${method} ${url}`;
    const list = this.responses.get(key) ?? [];
    list.push(response);
    this.responses.set(key, list);
  }

  /**
   * Default fetchImpl that respects the AbortSignal on every call:
   * if `init.signal.aborted === true` at call time, throw a
   * `DOMException` with name `"AbortError"` (mirroring the WHATWG
   * fetch behaviour). The fetcher records every call so tests can
   * assert "zero network I/O fired".
   */
  get fetchImpl(): FetchImpl {
    const responses = this.responses;
    const calls = this.calls;
    return async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const signal = init?.signal;
      const signalAborted = signal?.aborted === true;
      calls.push({ url, method, signalAborted });
      if (signalAborted) {
        throw new DOMException("aborted", "AbortError");
      }
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

function buildInput(overrides: Partial<ReconcileInput>): ReconcileInput {
  return {
    context: makeContext(),
    currentHeadSha: HEAD2,
    priorHeadSha: HEAD1,
    currentFiles: {},
    deltaDiffText: "",
    boundedContext: {
      items: [],
      excluded: [],
      budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 },
      semanticContextStatus: "ready",
      budgetHash: "h",
      bytesUsed: 0,
    },
    priorFindings: [],
    priorReviewId: null,
    newFindings: [],
    runId: "signal-run-id",
    attemptId: "00000000-0000-0000-0000-000000000002",
    policyHash: "policy-hash",
    resolutionMode: "logical",
    fetchImpl: async () => new Response("{}", { status: 200 }),
    ...overrides,
  };
}

const COMMENTS_URL = `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/comments`;
const REVIEWS_URL = `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/reviews`;

describe("runGithubReconcile — AbortSignal propagation", () => {
  it("returns kind: aborted with no network I/O when the caller signal is already aborted", async () => {
    const fetch = new CountingFetch();
    const controller = new AbortController();
    controller.abort(new Error("operator-cancelled"));

    const result = await runGithubReconcile(
      buildInput({ fetchImpl: fetch.fetchImpl }),
      controller.signal,
    );

    expect(result.kind).toBe("aborted");
    if (result.kind === "aborted") {
      expect(result.reason).toContain("operator-cancelled");
    }
    expect(fetch.calls).toHaveLength(0);
  });

  it("returns kind: aborted when input.signal is already aborted (no second-arg signal)", async () => {
    const fetch = new CountingFetch();
    const controller = new AbortController();
    controller.abort();

    const result = await runGithubReconcile(
      buildInput({ fetchImpl: fetch.fetchImpl, signal: controller.signal }),
    );

    expect(result.kind).toBe("aborted");
    expect(fetch.calls).toHaveLength(0);
  });

  it("propagates the AbortSignal into the underlying fetchImpl during the normal flow", async () => {
    const fetch = new CountingFetch();
    fetch.program("GET", COMMENTS_URL, { status: 200, body: [] });
    fetch.program("GET", REVIEWS_URL, { status: 200, body: [] });

    const controller = new AbortController();
    const result = await runGithubReconcile(
      buildInput({ fetchImpl: fetch.fetchImpl, signal: controller.signal }),
    );

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.signalAborted).toBe(false);
    }
    expect(fetch.calls.length).toBeGreaterThanOrEqual(2);
    for (const call of fetch.calls) {
      expect(call.signalAborted).toBe(false);
    }
    expect(fetch.calls.some((c) => c.url === COMMENTS_URL)).toBe(true);
    expect(fetch.calls.some((c) => c.url === REVIEWS_URL)).toBe(true);
  });

  it("returns kind: ok with signal bookkeeping when a hung fetch is aborted by the 60s timeout (no mutations)", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      queueMicrotask(() => controller.abort(new Error("60s-timeout-mock")));
      return controller.signal;
    });
    try {
      const hungFetchImpl: FetchImpl = (_input, init) => {
        const signal = init?.signal ?? undefined;
        if (signal === undefined) {
          throw new Error("expected signal");
        }
        return new Promise<Response>((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      };

      const result = await runGithubReconcile(buildInput({ fetchImpl: hungFetchImpl }));

      expect(result.kind).toBe("ok");
      if (result.kind === "ok") {
        expect(result.transitions).toHaveLength(0);
        expect(result.postedThreadIds).toHaveLength(0);
        expect(result.partialFailure).toBe(true);
        expect(result.signalAborted).toBe(true);
      }
      expect(timeoutSpy).toHaveBeenCalled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});

describe("runGithubReconcile — fingerprint-collision short-circuit", () => {
  it("returns kind: collision (within-review) without posting when two new findings share a fingerprint with divergent identityDigest", async () => {
    const fetch = new CountingFetch();

    const sharedFingerprint = "fp-collision-shared";

    const result = await runGithubReconcile(
      buildInput({
        fetchImpl: fetch.fetchImpl,
        priorFindings: [],
        newFindings: [
          {
            fingerprint: sharedFingerprint,
            identityDigest: "id-a",
            path: "src/auth.ts",
            line: 1,
            body: "first body",
          },
          {
            fingerprint: sharedFingerprint,
            identityDigest: "id-b",
            path: "src/auth.ts",
            line: 1,
            body: "second body divergent",
          },
        ],
      }),
    );

    expect(result.kind).toBe("collision");
    if (result.kind === "collision") {
      expect(result.fingerprint).toBe(sharedFingerprint);
      expect(result.collisionType).toBe("within-review");
    }
    expect(fetch.calls).toHaveLength(0);
  });

  it("returns kind: collision (against-persisted-state) when new+prior share a fingerprint with divergent identityDigest", async () => {
    const fetch = new CountingFetch();

    const sharedFingerprint = "fp-collision-prior";

    const result = await runGithubReconcile(
      buildInput({
        fetchImpl: fetch.fetchImpl,
        priorFindings: [
          {
            fingerprint: sharedFingerprint,
            identityDigest: "id-prior",
            lifecycle: "open",
            generation: 1,
            runId: "r1",
            path: "src/auth.ts",
            line: 1,
            threadId: 9001,
          },
        ],
        newFindings: [
          {
            fingerprint: sharedFingerprint,
            identityDigest: "id-new-different",
            path: "src/auth.ts",
            line: 1,
            body: "new body",
          },
        ],
      }),
    );

    expect(result.kind).toBe("collision");
    if (result.kind === "collision") {
      expect(result.fingerprint).toBe(sharedFingerprint);
      expect(result.collisionType).toBe("against-persisted-state");
    }
    expect(fetch.calls).toHaveLength(0);
  });
});

describe("runGithubReconcile — empty-prior coverage (ITER-2e)", () => {
  it("returns kind: ok with empty transitions when no new and no prior findings", async () => {
    const fetch = new CountingFetch();
    const result = await runGithubReconcile(
      buildInput({ fetchImpl: fetch.fetchImpl }),
    );
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.transitions).toEqual([]);
    }
  });
});
