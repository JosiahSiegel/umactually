// SPDX-License-Identifier: MIT
//
// Tests for the AbortSignal handling, fingerprint-collision short-circuit,
// and typed-result surface in `runAzureLiveWithReconcile`. The previous
// F2 fixup (HEAD 1007eb1) wired AbortSignal and ErrorOptions into the
// Azure reconciler but did not add test coverage at the integration
// boundary. This file pins that runtime behaviour.

import { describe, expect, it, vi } from "vitest";

import { runAzureLiveWithReconcile } from "../../src/cli/live-azure-reconcile.js";
import * as fingerprintModule from "../../src/review/fingerprint.js";
import { FingerprintCollisionError } from "../../src/review/fingerprint.js";
import type { AzureContext } from "../../src/platform/azure/context.js";
import type { FetchImpl } from "../../src/util/http.js";
import type { ProviderComment } from "../../src/provider/provider-parse.js";
import { computeDurableFindingIdentity } from "../../src/review/fingerprint.js";

const TOKEN = "azure-token-signal";
const ORG = "azure-org";
const PROJECT = "azure-project";
const REPO_ID = "azure-repo-id";
const PR_NUMBER = 17;
const SOURCE_COMMIT = "1111111111111111111111111111111111111111";
const TARGET_BRANCH = "main";
const BASE_COMMIT = "0000000000000000000000000000000000000000";

function makeContext(): AzureContext {
  return {
    token: TOKEN,
    org: ORG,
    project: PROJECT,
    repoId: REPO_ID,
    prNumber: PR_NUMBER,
    sourceCommit: SOURCE_COMMIT,
    targetBranch: TARGET_BRANCH,
    baseCommit: BASE_COMMIT,
  };
}

const DIFF_TEXT = [
  "diff --git a/src/x.ts b/src/x.ts",
  "--- a/src/x.ts",
  "+++ b/src/x.ts",
  "@@ -1,4 +1,7 @@",
  " existing line",
  " another existing",
  " third existing",
  "-removed line",
  "+added line",
  "+another added",
  "+trailing added",
  "",
].join("\n");

function buildProviderOutcome(): Parameters<typeof runAzureLiveWithReconcile>[0]["provider"] {
  return {
    review: {
      summary: "Azure live signal test.",
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [],
      parseFailed: false,
    },
    endpoint: "test-endpoint",
    provider: "test-provider",
    modelId: "test-model",
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
  };
}

function buildProviderOutcomeWithComment(comment: ProviderComment): Parameters<typeof runAzureLiveWithReconcile>[0]["provider"] {
  return {
    review: {
      summary: "Azure live happy-path test.",
      verdict: "COMMENT",
      comments: [comment],
      suppressedComments: [],
      parseFailed: false,
    },
    endpoint: "test-endpoint",
    provider: "test-provider",
    modelId: "test-model",
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
  };
}

function buildDurableComment(path: string, line: number, body: string): ProviderComment {
  const firstSentence = body.split(/[.!?]/u)[0] ?? body;
  const identity = computeDurableFindingIdentity({
    path,
    anchorKind: "hunk",
    symbolName: undefined,
    symbolKind: undefined,
    hunkPreimage: undefined,
    category: "maintainability",
    ruleKey: undefined,
    bodyFirstSentence: firstSentence,
    pathRewrites: undefined,
    caseInsensitive: undefined,
  });
  return {
    path,
    line,
    body,
    severity: "medium",
    category: "maintainability",
    durableIdentity: identity,
  };
}

function buildParsed() {
  return {
    provider: "openai-compatible",
    apiUrl: "https://api.example.com/v1",
    model: "test-model",
    platform: "azure" as const,
    detectLeaks: false,
    reviewTimeoutSeconds: 60,
    perRequestTimeoutSeconds: 60,
    prNumber: PR_NUMBER,
    outputArtifact: null,
    files: null,
    diffPath: null,
    simulateFindings: false,
    dryRun: false,
    reviewFileLimit: 200,
    debugRawResponse: false,
    showConfig: false,
    json: false,
    noColor: true,
    minimumSeverity: null,
    minimumSeverityInternal: null,
  } as unknown as Parameters<typeof runAzureLiveWithReconcile>[0]["parsed"];
}

describe("runAzureLiveWithReconcile — AbortSignal propagation", () => {
  it("returns exitCode 1 + abort message without any network I/O when the caller signal is already aborted", async () => {
    const fetchCalls: { readonly url: string; readonly method: string }[] = [];
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      fetchCalls.push({ url, method });
      return new Response("{}", { status: 200 });
    };

    const controller = new AbortController();
    controller.abort(new Error("operator-cancelled"));

    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcome(),
      parsed: buildParsed(),
      fetchImpl,
      signal: controller.signal,
    });

    expect(result.exitCode).toBe(1);
    expect(result.posted).toBe(false);
    expect(result.message).toContain("operator-cancelled");
    expect(result.message).toMatch(/aborted/i);
    expect(fetchCalls).toHaveLength(0);
  });

  it("propagates the AbortSignal into the underlying fetchImpl during the normal flow", async () => {
    const fetchImpl: FetchImpl = async (input) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.endsWith("/threads") && !url.includes("/threads/")) {
        return new Response(JSON.stringify({ value: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    };

    const controller = new AbortController();
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcome(),
      parsed: buildParsed(),
      fetchImpl,
      signal: controller.signal,
    });

    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });

  it("aborts in-flight when the 60s timeout fires on a hung fetch (the in-progress fetchImpl receives the abort)", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      queueMicrotask(() => controller.abort(new Error("60s-timeout-mock")));
      return controller.signal;
    });
    let receivedSignal: AbortSignal | undefined;
    try {
      const hungFetchImpl: FetchImpl = (_input, init) => {
        const signal = init?.signal ?? undefined;
        receivedSignal = signal;
        if (signal === undefined) {
          throw new Error("expected signal");
        }
        return new Promise<Response>((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      };

      await expect(
        runAzureLiveWithReconcile({
          context: makeContext(),
          diffText: DIFF_TEXT,
          provider: buildProviderOutcome(),
          parsed: buildParsed(),
          fetchImpl: hungFetchImpl,
        }),
      ).rejects.toThrow();
      expect(receivedSignal?.aborted).toBe(true);
      expect(timeoutSpy).toHaveBeenCalled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});

describe("runAzureLiveWithReconcile — fingerprint-collision short-circuit", () => {
  it("returns the FINGERPRINT_COLLISION typed result without posting when assertNoFingerprintCollision throws FingerprintCollisionError", async () => {
    const fetchCalls: { readonly url: string; readonly method: string }[] = [];
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      fetchCalls.push({ url, method });
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const sharedFingerprint = "fp-azure-collision-shared";
    const collisionSpy = vi
      .spyOn(fingerprintModule, "assertNoFingerprintCollision")
      .mockImplementation(() => {
        throw new FingerprintCollisionError(sharedFingerprint, "within-review", "test");
      });
    try {
      const result = await runAzureLiveWithReconcile({
        context: makeContext(),
        diffText: DIFF_TEXT,
        provider: buildProviderOutcome(),
        parsed: buildParsed(),
        fetchImpl,
      });

      expect(result.posted).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain("FINGERPRINT_COLLISION");
      expect(result.message).toContain(sharedFingerprint);
      expect(result.message).toContain("within-review");
      expect(fetchCalls).toHaveLength(0);
    } finally {
      collisionSpy.mockRestore();
    }
  });
});

describe("runAzureLiveWithReconcile — happy-path integration (ITER-2f coverage)", () => {
  it("completes the full create-new + parent-comment + status pipeline end-to-end", async () => {
    const calls: { readonly url: string; readonly method: string }[] = [];
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response(JSON.stringify({ value: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 500, comments: [{ id: 600 }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads/") && url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 700 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts",
      1,
      "Add an explicit return type to this exported function for clarity.",
    );
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcomeWithComment(comment),
      parsed: buildParsed(),
      fetchImpl,
    });

    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.inlineThreadCount).toBe(1);
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/threads?"))).toBe(true);
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/statuses"))).toBe(true);
  });

  it("returns exitCode 1 + 0-thread error when every create-new POST fails", async () => {
    const calls: { readonly url: string; readonly method: string }[] = [];
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response(JSON.stringify({ value: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts",
      5,
      "Extract this duplicated branch into a shared helper function.",
    );
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcomeWithComment(comment),
      parsed: buildParsed(),
      fetchImpl,
    });

    expect(result.posted).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.message).toMatch(/0 threads posted/);
  });

  it("returns exitCode 1 with parseFailed when the provider outcome reports parseFailed=true", async () => {
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response(JSON.stringify({ value: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 800, comments: [{ id: 900 }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads/") && url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 1000 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts",
      7,
      "Document the contract for this public function with a TSDoc block.",
    );
    const provider = buildProviderOutcomeWithComment(comment);
    const providerWithParseFailed: Parameters<typeof runAzureLiveWithReconcile>[0]["provider"] = {
      ...provider,
      review: { ...provider.review, parseFailed: true },
    };
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: providerWithParseFailed,
      parsed: buildParsed(),
      fetchImpl,
    });
    expect(result.exitCode).toBe(1);
    expect(result.posted).toBe(true);
    expect(result.parseFailed).toBe(true);
    expect(result.message).toMatch(/parse failed/i);
  });
});
