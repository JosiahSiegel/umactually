// SPDX-License-Identifier: MIT
//
// Unit tests for src/platform/github/api.ts → fetchGithubPrInstructions.
// Locks the four contract behaviors:
//
//   1. Happy path: each successful (2xx + base64 `content`) response is
//      decoded and stored in the result Map keyed by the request path.
//   2. Partial path: 404 responses are silently skipped; 2xx responses
//      for the surviving paths still populate the Map.
//   3. All 404: the result Map is empty.
//   4. Empty paths: no fetches are issued and the Map is empty.
//
// `FetchImpl` is replaced with `vi.fn<typeof fetch>` so we can script
// per-URL responses and assert the call shape. `Buffer.from("hello",
// "base64")` mirrors the real GitHub `contents` payload shape
// (`{content, encoding: "base64"}`) and proves the decoder tolerates
// the exact payload format the API returns.

import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

import type { GithubContext } from "../../src/platform/github/context.js";
import { fetchGithubPrInstructions } from "../../src/platform/github/api.js";

function makeContext(): GithubContext {
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

function contentsResponse(body: string): Response {
  return new Response(
    JSON.stringify({
      content: Buffer.from(body, "utf8").toString("base64"),
      encoding: "base64",
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

function notFoundResponse(): Response {
  return new Response(JSON.stringify({ message: "Not Found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchGithubPrInstructions", () => {
  it("returns a Map keyed by path with decoded content for every 2xx response", async () => {
    // Given: two paths both succeed with base64-encoded payloads.
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/contents/.github/AGENTS.md?ref=2222222222222222222222222222222222222222")) {
        return contentsResponse("hello");
      }
      if (url.endsWith("/contents/.github/CONTRIBUTING.md?ref=2222222222222222222222222222222222222222")) {
        return contentsResponse("world");
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const context = makeContext();
    const result = await fetchGithubPrInstructions(
      context,
      [".github/AGENTS.md", ".github/CONTRIBUTING.md"],
      fetchImpl,
    );

    // Then: both entries are present and base64-decoded to UTF-8.
    expect(result.size).toBe(2);
    expect(result.get(".github/AGENTS.md")).toBe("hello");
    expect(result.get(".github/CONTRIBUTING.md")).toBe("world");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("skips 404 responses and keeps only the paths that returned 2xx", async () => {
    // Given: AGENTS.md resolves, CONTRIBUTING.md 404s.
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/contents/.github/AGENTS.md?ref=2222222222222222222222222222222222222222")) {
        return contentsResponse("hello");
      }
      if (url.endsWith("/contents/.github/CONTRIBUTING.md?ref=2222222222222222222222222222222222222222")) {
        return notFoundResponse();
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const context = makeContext();
    const result = await fetchGithubPrInstructions(
      context,
      [".github/AGENTS.md", ".github/CONTRIBUTING.md"],
      fetchImpl,
    );

    // Then: only the 2xx path survives in the Map.
    expect(result.size).toBe(1);
    expect(result.get(".github/AGENTS.md")).toBe("hello");
    expect(result.has(".github/CONTRIBUTING.md")).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns an empty Map when every path 404s", async () => {
    // Given: both paths 404.
    const fetchImpl = vi.fn<typeof fetch>(async () => notFoundResponse());

    const context = makeContext();
    const result = await fetchGithubPrInstructions(
      context,
      [".github/AGENTS.md", ".github/CONTRIBUTING.md"],
      fetchImpl,
    );

    // Then: Map is empty, both fetches were attempted.
    expect(result.size).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns an empty Map without issuing any fetch when paths is empty", async () => {
    // Given: no paths to fetch.
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("fetchImpl should not be called when paths is empty");
    });

    const context = makeContext();
    const result = await fetchGithubPrInstructions(context, [], fetchImpl);

    // Then: empty Map, zero network calls.
    expect(result.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
