import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";
import { azureDiffRoutes, azureRollbackDiffFixture } from "./azure-diff-fixture.js";

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FetchRoute = {
  readonly match: (url: string, method: string) => boolean;
  readonly response: Response | (() => Response);
};

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetchRecorder(routes: readonly FetchRoute[]): {
  readonly calls: readonly RecordedCall[];
  readonly fetchImpl: typeof fetch;
} {
  /** Test fetch recorder; mutation is the purpose of this fixture. */
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization") ?? "";
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? parseJson(rawBody) : null;
    calls.push({ url, method, authorization, body });
    for (const route of routes) {
      if (route.match(url, method)) {
        return typeof route.response === "function" ? route.response() : route.response;
      }
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { calls, fetchImpl };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return text;
    }
    throw error;
  }
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new TypeError(`${label} must be an object`);
}

function readArray(value: unknown, label: string): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  throw new TypeError(`${label} must be an array`);
}

function findCall(calls: readonly RecordedCall[], method: string, urlSuffix: string): RecordedCall {
  for (const call of calls) {
    if (call.method === method && call.url.endsWith(urlSuffix)) {
      return call;
    }
  }
  throw new Error(`missing ${method} ${urlSuffix}`);
}

function azureEnv(): NodeJS.ProcessEnv {
  return {
    TF_BUILD: "True",
    SYSTEM_ACCESSTOKEN: "azure-token-secret",
    SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
    SYSTEM_TEAMPROJECT: "Example Project",
    BUILD_REPOSITORY_ID: "repo-42",
    SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
    SYSTEM_PULLREQUEST_SOURCECOMMITID: "1111111111111111111111111111111111111111",
    SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
    UMACTUALLY_API_URL: "https://provider.example/v1",
    UMACTUALLY_API_KEY: "provider-key-secret",
    UMACTUALLY_MODEL: "review-model-synthetic",
  } satisfies NodeJS.ProcessEnv;
}

describe("runLive Azure partial-failure rollback (RED gap)", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  function stderrText(): string {
    if (!stderrSpy) {
      return "";
    }
    const calls: ReadonlyArray<ReadonlyArray<unknown>> = stderrSpy.mock.calls;
    return calls
      .map((call) =>
        call
          .map((chunk: unknown) => (typeof chunk === "string" ? chunk : Buffer.from(chunk as ArrayBufferLike).toString("utf8")))
          .join(""),
      )
      .join("");
  }

  it("S7-RED-021: continues posting after a thread POST 500, marks the run best-effort", async () => {
    // Given: 3 inline comments at distinct (path, line) so all three are postable,
    // and the threads POST endpoint returns 200, 500, 200 in that order.
    const providerReview = JSON.stringify({
      summary: "Azure partial-failure summary.",
      verdict: "APPROVED",
      comments: [
        {
          path: "src/review/example.ts",
          line: 3,
          body: "First inline comment.",
          severity: "medium",
          category: "maintainability",
        },
        {
          path: "src/review/example.ts",
          line: 4,
          body: "Second inline comment.",
          severity: "low",
          category: "style",
        },
        {
          path: "src/review/example.ts",
          line: 5,
          body: "Third inline comment.",
          severity: "low",
          category: "style",
        },
      ],
      suppressed_comments: [],
    });

    /** Test fetch recorder; mutation is the purpose of this fixture. */
    let threadPostCount = 0;
    const recorder = makeFetchRecorder([
      ...azureDiffRoutes(makeJsonResponse, azureRollbackDiffFixture()),
      {
        match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
        response: makeJsonResponse({ output_text: providerReview }),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
        response: () => {
          threadPostCount += 1;
          const status = threadPostCount === 2 ? 500 : 200;
          return makeJsonResponse({ id: 77 + threadPostCount }, status);
        },
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
        // Empty statuses list: new dedup helper looks here first.
        response: makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
        response: makeJsonResponse({ id: 88 }, 200),
      },
    ]);

    // When: runLive is invoked on Azure with no dry-run.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: at least 2 of 3 thread POSTs succeed, the status POST still happens, and
    // a GitHub Actions-style warning is emitted on stderr.
    expect(threadPostCount).toBeGreaterThanOrEqual(2);
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);

    const successfulThreadPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/threads?api-version=7.1"),
    );
    expect(successfulThreadPosts.length).toBeGreaterThanOrEqual(2);

    expect(findCall(recorder.calls, "POST", "/statuses?api-version=7.1")).toBeDefined();

    const stderr = stderrText();
    expect(stderr).toContain("::warning::");
  });

  it("S7-RED-022: returns exit 1, posted false, when every thread POST fails", async () => {
    // Given: 1 inline comment and the threads POST endpoint always returns 500.
    const providerReview = JSON.stringify({
      summary: "Azure all-fail summary.",
      verdict: "APPROVED",
      comments: [
        {
          path: "src/review/example.ts",
          line: 3,
          body: "Only inline comment.",
          severity: "medium",
          category: "maintainability",
        },
      ],
      suppressed_comments: [],
    });

    const recorder = makeFetchRecorder([
      ...azureDiffRoutes(makeJsonResponse, azureRollbackDiffFixture()),
      {
        match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
        response: makeJsonResponse({ output_text: providerReview }),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
        response: makeJsonResponse({ error: "boom" }, 500),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
        // Empty statuses list: new dedup helper looks here first.
        response: makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
        response: makeJsonResponse({ id: 88 }, 200),
      },
    ]);

    // When: runLive is invoked on Azure with no dry-run.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: zero threads landed -> exit 1 / posted false; a warning mentioning Azure threads
    // is emitted on stderr; the status POST is not made.
    expect(result.exitCode).toBe(1);
    expect(result.posted).toBe(false);

    const statusPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/statuses?api-version=7.1"),
    );
    expect(statusPosts).toHaveLength(0);

    const stderr = stderrText();
    expect(stderr).toContain("::warning::");
    expect(stderr).toContain("Azure thread");
  });

  it("smoke: helpers typecheck under vitest (no fetch) — referenced for compile-only coverage", () => {
    // When: a real RecordedCall is constructed and readRecord/readArray are exercised.
    const sample: RecordedCall = {
      url: "https://example.test",
      method: "POST",
      authorization: "Bearer x",
      body: { comments: [{ content: "hi" }] },
    };
    const record = readRecord(sample.body, "sample.body");
    const arr = readArray(record["comments"], "sample.body.comments");
    // Then: the helpers round-trip the fixture shape.
    expect(arr).toHaveLength(1);
  });
});
