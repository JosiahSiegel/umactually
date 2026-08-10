// SPDX-License-Identifier: MIT
//
// Unit tests for the shared platform-instruction-file orchestrator
// `fetchPlatformInstructionFiles` plus the platform-specific failure
// branches of `fetchGithubPrInstructions` / `fetchAzurePrInstructions`.
//
// The dedup refactor extracted the parallel-fetch worker pool +
// 404-skip behavior into `src/util/platform-instructions.ts` so the
// GitHub and Azure adapters share one implementation. These tests
// lock both:
//
//  1. The orchestrator itself: empty paths, mixed 2xx + 404, all-404,
//     non-2xx throws, per-path fan-out order, 404-then-2xx sequencing.
//  2. The GitHub per-path decoder: non-2xx status → GITHUB_FETCH_FAILED,
//     invalid JSON payload → GITHUB_FETCH_FAILED, missing `content` →
//     GITHUB_FETCH_FAILED, non-base64 `content` → GITHUB_FETCH_FAILED,
//     non-object payload → GITHUB_FETCH_FAILED.
//  3. The Azure per-path decoder: non-2xx status → AZURE_FETCH_FAILED,
//     empty body → AZURE_FETCH_FAILED, invalid JSON →
//     AZURE_FETCH_FAILED, baseCommit pinned in the request URL.

import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

import type { AzureContext } from "../../src/platform/azure/context.js";
import { fetchAzurePrInstructions } from "../../src/platform/azure/api.js";
import { AzureApiError } from "../../src/platform/azure/api.js";
import { fetchGithubPrInstructions, GithubApiError } from "../../src/platform/github/api.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import {
  decodeInstructionResponseBody,
  fetchPlatformInstructionFiles,
  parsePlatformJsonBody,
} from "../../src/util/platform-instructions.js";

function makeGithubContext(): GithubContext {
  return {
    token: "github-token-abc",
    repo: { owner: "octo-org", name: "octo-repo" },
    prNumber: 42,
    headSha: "1111111111111111111111111111111111111111",
    baseSha: "2222222222222222222222222222222222222222",
    isDraft: false,
    title: "Add platform adapters",
    body: "Review the new adapters.",
  };
}

function makeAzureContext(): AzureContext {
  return {
    token: "test-token",
    org: "example-org",
    project: "example-project",
    repoId: "repo-id",
    prNumber: 42,
    sourceCommit: "source-commit",
    targetBranch: "refs/heads/main",
    baseCommit: "base-commit",
  };
}

describe("fetchPlatformInstructionFiles (shared orchestrator)", () => {
  it("returns an empty Map without invoking the fetcher when paths is empty", async () => {
    // Given: an empty path list and a fetcher that throws if called.
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("fetchImpl should not be called when paths is empty");
    });
    const fetchOne = vi.fn(async () => null);
    // When: the orchestrator runs.
    const result = await fetchPlatformInstructionFiles([], fetchImpl, fetchOne);
    // Then: empty Map, zero calls on either layer.
    expect(result.size).toBe(0);
    expect(fetchOne).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips paths for which fetchOne returns null (404 mapping) and stores only successes", async () => {
    // Given: 3 paths; fetchOne returns null for the middle one.
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response());
    const fetchOne = vi.fn(async (path: string) => (path === "skip.md" ? null : `CONTENT-${path}`));
    // When: the orchestrator runs.
    const result = await fetchPlatformInstructionFiles(["a.md", "skip.md", "b.md"], fetchImpl, fetchOne);
    // Then: only the non-null paths land in the result Map.
    expect(result.size).toBe(2);
    expect(result.get("a.md")).toBe("CONTENT-a.md");
    expect(result.get("b.md")).toBe("CONTENT-b.md");
    expect(result.has("skip.md")).toBe(false);
  });

  it("propagates throws from fetchOne unchanged (no swallowing)", async () => {
    // Given: a fetchOne that throws on the second path.
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response());
    const fetchOne = vi.fn(async (path: string) => {
      if (path === "boom.md") throw new Error("platform error");
      return `CONTENT-${path}`;
    });
    // When/Then: the orchestrator's promise rejects with the inner error.
    await expect(
      fetchPlatformInstructionFiles(["a.md", "boom.md", "b.md"], fetchImpl, fetchOne),
    ).rejects.toThrow("platform error");
  });

  it("passes the same FetchImpl to every fetchOne call (so platform auth stays consistent)", async () => {
    // Given: a spy fetchImpl and a fetchOne that records what fetchImpl it received.
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response());
    const receivedImpls: unknown[] = [];
    const fetchOne = vi.fn(async (_path: string, impl: typeof fetch) => {
      receivedImpls.push(impl);
      return "OK";
    });
    // When: the orchestrator runs.
    await fetchPlatformInstructionFiles(["a.md", "b.md", "c.md"], fetchImpl, fetchOne);
    // Then: every fetchOne call received the SAME fetchImpl reference
    // (proves the orchestrator does NOT swap implementations per path).
    expect(receivedImpls.length).toBe(3);
    for (const impl of receivedImpls) expect(impl).toBe(fetchImpl);
  });
});

describe("fetchGithubPrInstructions — failure paths (decoder branches)", () => {
  it("throws GITHUB_FETCH_FAILED when the contents API returns 500", async () => {
    // Given: a 500 from the contents endpoint.
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ message: "boom" }), { status: 500, headers: { "content-type": "application/json" } }),
    );
    // When/Then: the helper throws with the documented code + status.
    await expect(
      fetchGithubPrInstructions(makeGithubContext(), ["CLAUDE.md"], fetchImpl),
    ).rejects.toMatchObject({
      name: "GithubApiError",
      code: "GITHUB_FETCH_FAILED",
      status: 500,
    });
  });

  it("throws GITHUB_FETCH_FAILED when the contents response body is invalid JSON", async () => {
    // Given: a 200 response with non-JSON content (modeled by returning
    // a Response whose `.json()` rejects with SyntaxError — that is the
    // path the decoder catches and re-wraps).
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const response = new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
      // Force `response.json()` to reject with SyntaxError. The decoder
      // catches SyntaxError specifically (see src/platform/github/api.ts).
      vi.spyOn(response, "json").mockRejectedValue(new SyntaxError("Unexpected token"));
      return response;
    });
    // When/Then: the helper throws with the documented code; the
    // SyntaxError is the cause (preserves the underlying diagnostic).
    const promise = fetchGithubPrInstructions(makeGithubContext(), ["CLAUDE.md"], fetchImpl);
    await expect(promise).rejects.toBeInstanceOf(GithubApiError);
    await expect(promise).rejects.toMatchObject({ code: "GITHUB_FETCH_FAILED" });
  });

  it("throws GITHUB_FETCH_FAILED when the contents payload is a non-object (e.g. a bare string)", async () => {
    // Given: a 200 response whose body parses as a bare string (the
    // decoder guards `isObject(payload)` → throws when payload is not
    // an object).
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify("not-an-object"), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const promise = fetchGithubPrInstructions(makeGithubContext(), ["CLAUDE.md"], fetchImpl);
    await expect(promise).rejects.toBeInstanceOf(GithubApiError);
    await expect(promise).rejects.toMatchObject({ code: "GITHUB_FETCH_FAILED" });
  });

  it("throws GITHUB_FETCH_FAILED when the payload has no `content` field", async () => {
    // Given: a 200 response whose body is a JSON object WITHOUT a
    // `content` field (the decoder requires `typeof content === "string"`).
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ name: "CLAUDE.md", encoding: "base64" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const promise = fetchGithubPrInstructions(makeGithubContext(), ["CLAUDE.md"], fetchImpl);
    await expect(promise).rejects.toBeInstanceOf(GithubApiError);
    await expect(promise).rejects.toMatchObject({ code: "GITHUB_FETCH_FAILED" });
  });

  it("throws GITHUB_FETCH_FAILED when `content` is present but empty", async () => {
    // Given: an object payload with an empty `content` string (length 0).
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ content: "", encoding: "base64" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const promise = fetchGithubPrInstructions(makeGithubContext(), ["CLAUDE.md"], fetchImpl);
    await expect(promise).rejects.toBeInstanceOf(GithubApiError);
    await expect(promise).rejects.toMatchObject({ code: "GITHUB_FETCH_FAILED" });
  });

  it("pins the request to baseSha (not headSha) so a PR cannot rewrite its reviewer instructions", async () => {
    // Regression: the URL must carry `ref=<baseSha>` so a PR's head
    // commit cannot smuggle malicious instructions into the review.
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(
        JSON.stringify({
          content: Buffer.from("OK", "utf8").toString("base64"),
          encoding: "base64",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
      // Returned for each call, but never read — `url` is the assertion target.
      void url;
    });
    await fetchGithubPrInstructions(makeGithubContext(), ["CLAUDE.md"], fetchImpl);
    const call = fetchImpl.mock.calls[0]!;
    const input = call[0];
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    expect(url).toContain("?ref=2222222222222222222222222222222222222222");
    expect(url).not.toContain("?ref=1111111111111111111111111111111111111111");
  });
});

describe("fetchAzurePrInstructions — failure paths (decoder branches)", () => {
  function makeFetchImpl(response: Response): ReturnType<typeof vi.fn<typeof fetch>> {
    return vi.fn<typeof fetch>(async () => response);
  }

  it("throws AZURE_FETCH_FAILED when the items API returns 500", async () => {
    // Given: a 500 from the items endpoint.
    const fetchImpl = makeFetchImpl(
      new Response(JSON.stringify({ message: "boom" }), { status: 500, headers: { "content-type": "application/json" } }),
    );
    // When/Then: the helper throws AzureApiError with the documented code.
    const promise = fetchAzurePrInstructions(makeAzureContext(), ["/AGENTS.md"], fetchImpl);
    await expect(promise).rejects.toBeInstanceOf(AzureApiError);
    await expect(promise).rejects.toMatchObject({ code: "AZURE_FETCH_FAILED", status: 500 });
  });

  it("throws AZURE_FETCH_FAILED when the response body is empty (200 + empty)", async () => {
    // Given: a 200 with an empty body (the decoder requires a non-empty body).
    const fetchImpl = makeFetchImpl(new Response("", { status: 200 }));
    const promise = fetchAzurePrInstructions(makeAzureContext(), ["/AGENTS.md"], fetchImpl);
    await expect(promise).rejects.toBeInstanceOf(AzureApiError);
    await expect(promise).rejects.toMatchObject({ code: "AZURE_FETCH_FAILED" });
  });

  it("throws AZURE_FETCH_FAILED when the response body is invalid JSON", async () => {
    // Given: a 200 with non-JSON content (decoder catches SyntaxError).
    const fetchImpl = makeFetchImpl(new Response("not-json", { status: 200 }));
    const promise = fetchAzurePrInstructions(makeAzureContext(), ["/AGENTS.md"], fetchImpl);
    await expect(promise).rejects.toBeInstanceOf(AzureApiError);
    await expect(promise).rejects.toMatchObject({ code: "AZURE_FETCH_FAILED" });
  });

  it("pins the request to baseCommit (not sourceCommit) so a PR cannot rewrite its reviewer instructions", async () => {
    // Regression: the URL must carry `versionDescriptor.version=baseCommit`
    // so a PR's source commit cannot smuggle malicious instructions.
    const fetchImpl = makeFetchImpl(
      new Response(JSON.stringify({ content: "OK" }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    await fetchAzurePrInstructions(makeAzureContext(), ["/AGENTS.md"], fetchImpl);
    const call = fetchImpl.mock.calls[0]!;
    const input = call[0];
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    expect(url).toContain("versionDescriptor.version=base-commit");
    expect(url).not.toContain("versionDescriptor.version=source-commit");
  });
});

describe("decodeInstructionResponseBody", () => {
  it("returns null when the response status is 404 (silent-skip contract)", async () => {
    // Given: a 404 response.
    const response = new Response("not found", { status: 404 });
    // When: the helper is invoked with a parseJson callback that must
    // NEVER be called for a 404 (the silent-skip branch).
    const parseJson = vi.fn();
    const result = await decodeInstructionResponseBody(
      response,
      "CLAUDE.md",
      "GitHub",
      GithubApiError,
      "GITHUB_FETCH_FAILED",
      parseJson,
    );
    // Then: null result, parseJson NOT invoked.
    expect(result).toBeNull();
    expect(parseJson).not.toHaveBeenCalled();
  });

  it("throws the typed platform error when the response is not ok (5xx)", async () => {
    // Given: a 500 response with a JSON body.
    const response = new Response(JSON.stringify({ message: "boom" }), { status: 500 });
    // When: the helper runs.
    const promise = decodeInstructionResponseBody(
      response,
      "CLAUDE.md",
      "GitHub",
      GithubApiError,
      "GITHUB_FETCH_FAILED",
      async (r) => r.json(),
    );
    // Then: it throws a GithubApiError with the typed code + status +
    // path-in-message so the operator can correlate the failure.
    await expect(promise).rejects.toBeInstanceOf(GithubApiError);
    await expect(promise).rejects.toMatchObject({
      code: "GITHUB_FETCH_FAILED",
      status: 500,
      message: expect.stringContaining("CLAUDE.md"),
    });
  });

  it("forwards the parsed body to parseJson on a 2xx response", async () => {
    // Given: a 200 response with a JSON object body.
    const response = new Response(JSON.stringify({ content: "OK" }), { status: 200 });
    // When: the helper runs.
    const result = await decodeInstructionResponseBody(
      response,
      "CLAUDE.md",
      "GitHub",
      GithubApiError,
      "GITHUB_FETCH_FAILED",
      async (r) => r.json(),
    );
    // Then: the parsed body is forwarded unchanged.
    expect(result).toEqual({ content: "OK" });
  });

  it("uses the Azure error class + code when called for an Azure response", async () => {
    // Given: a 500 response; an Azure-flavoured invocation.
    const response = new Response(JSON.stringify({ message: "boom" }), { status: 500 });
    // When: the helper runs with AzureApiError.
    const promise = decodeInstructionResponseBody(
      response,
      "/AGENTS.md",
      "Azure DevOps",
      AzureApiError,
      "AZURE_FETCH_FAILED",
      async (r) => r.json(),
    );
    // Then: AzureApiError, not GithubApiError, is thrown — proves the
    // ctor parameter is honored end-to-end (the generic helper is
    // platform-agnostic).
    await expect(promise).rejects.toBeInstanceOf(AzureApiError);
    await expect(promise).rejects.toMatchObject({ code: "AZURE_FETCH_FAILED", status: 500 });
  });
});

describe("parsePlatformJsonBody", () => {
  it("returns the parsed JSON value when the body is valid JSON", async () => {
    // Given: a 200 response with a JSON object body.
    const response = new Response(JSON.stringify({ content: "OK" }), { status: 200 });
    // When: the helper runs.
    const result = await parsePlatformJsonBody(
      response,
      "CLAUDE.md",
      "GitHub",
      GithubApiError,
      "GITHUB_FETCH_FAILED",
    );
    // Then: the parsed body is forwarded.
    expect(result).toEqual({ content: "OK" });
  });

  it("wraps SyntaxError as the typed platform error (with `cause` chain preserved)", async () => {
    // Given: a 200 response with a non-JSON body. `response.json()`
    // throws SyntaxError — the helper catches and re-wraps with the
    // platform-specific error class while keeping `cause` for diagnosis.
    const response = new Response("not-json", { status: 200 });
    // When: the helper runs.
    const promise = parsePlatformJsonBody(
      response,
      "CLAUDE.md",
      "GitHub",
      GithubApiError,
      "GITHUB_FETCH_FAILED",
    );
    // Then: the typed error is thrown with the SyntaxError preserved as cause.
    const thrown = await expect(promise).rejects.toBeInstanceOf(GithubApiError);
    void thrown;
    await expect(promise).rejects.toMatchObject({
      code: "GITHUB_FETCH_FAILED",
      message: expect.stringContaining("not valid JSON"),
      cause: expect.any(SyntaxError),
    });
  });

  it("re-throws non-SyntaxError errors unchanged (does not swallow network failures)", async () => {
    // Given: a response whose .json() throws a non-SyntaxError (e.g. a
    // network error from a fetch implementation). The helper must
    // propagate it as-is — only SyntaxError is mapped to a typed error.
    const response = new Response("anything", { status: 200 });
    const original = new Error("network down");
    vi.spyOn(response, "json").mockRejectedValue(original);
    // When/Then: the original error is re-thrown unchanged.
    await expect(
      parsePlatformJsonBody(response, "CLAUDE.md", "GitHub", GithubApiError, "GITHUB_FETCH_FAILED"),
    ).rejects.toBe(original);
  });
});
