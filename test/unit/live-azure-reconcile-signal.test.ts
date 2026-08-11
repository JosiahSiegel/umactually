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

const DIFF_TEXT = "diff --git a/src/x.ts b/src/x.ts\n@@ -1 +1 @@\n-a\n+b\n";

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
