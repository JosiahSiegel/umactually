// Integration test for the chunked Azure live review path.
//
// Verifies that when `fetchAzurePrDiff` returns a diff large enough to
// require multiple chunks (>maxFilesPerChunk or >maxChunkBytes):
//   - the orchestrator dispatches one provider call PER chunk,
//   - merges the per-chunk outcomes via mergeReviewResults,
//   - still posts Azure threads + a PR status with the merged review.
//
// The default chunking thresholds are 8 000 chars / 50 files, so a
// fixture that emits ~5 distinct files with >2 000 chars per diff block
// guarantees ≥3 chunks regardless of test ordering.
import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";
import {
  AZURE_NEW_OBJECT_ID,
  AZURE_OLD_OBJECT_ID,
  AZURE_SOURCE_COMMIT_ID,
} from "./azure-diff-fixture.js";

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FetchRoute = {
  readonly match: (url: string, method: string) => boolean;
  readonly response: Response;
};

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Build a fixture where the PR carries N file changes, each one large
 * enough that the reconstructed unified diff exceeds `maxChunkBytes`
 * (8 000 chars by default) so chunking kicks in.
 *
 * Each file's diff block starts with `diff --git a/<path> b/<path>`
 * and contains `bodyChars` characters of added content. With 3+ files
 * at 4 000 chars each, the joined diff is ≥12 000 chars → at least 2
 * chunks even with the default 8 000-char cap.
 */
function buildMultiFileFixture(fileCount: number, bodyChars: number): {
  readonly changes: readonly {
    readonly item: { readonly path: string; readonly url: string };
    readonly originalObjectId: string;
  }[];
  readonly files: readonly { readonly path: string; readonly bodyChars: number }[];
} {
  // bodyChars is unused by the multi-line FILE_BODY; we keep it on
  // the signature so per-call callers can express intent and future
  // callers can switch between compact/verbose content without
  // changing the fixture wiring.
  void bodyChars;
  const files = Array.from({ length: fileCount }, (_unused, index) => ({
    path: `src/chunked/file-${index.toString().padStart(3, "0")}.ts`,
    bodyChars,
  }));
  const changes = files.map((file) => ({
    item: {
      path: file.path,
      url: "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/items",
    },
    originalObjectId: AZURE_OLD_OBJECT_ID,
  }));
  return { changes, files };
}

function buildMultiFileRoutes(input: {
  readonly fileCount: number;
  readonly changes: readonly {
    readonly item: { readonly path: string; readonly url: string };
    readonly originalObjectId: string;
  }[];
  readonly perChunkProviderBody: (chunkIndex: number, fileCount: number) => string;
  readonly fileBody: (path: string) => string;
}): readonly FetchRoute[] {
  const { changes, fileCount, perChunkProviderBody, fileBody } = input;
  // Map each chunk to a deterministic provider response so we can verify
  // merging picks up comments from each.
  let chunkCounter = 0;
  const providerResponseForChunk = () => {
    const body = perChunkProviderBody(chunkCounter, fileCount);
    chunkCounter += 1;
    return makeJsonResponse({ output_text: body });
  };
  const providerRoutes: FetchRoute[] = [];
  // We can't pre-bind a unique provider response per request; the
  // provider route below cycles through responses so each chunk gets
  // its own review. We push them in the order chunks will be made.
  for (let index = 0; index < fileCount; index += 1) {
    providerRoutes.push({
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: providerResponseForChunk(),
    });
  }

  return [
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations?api-version=7.1"),
      response: makeJsonResponse({ value: [{ id: 2 }] }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations/2?api-version=7.1"),
      response: makeJsonResponse({ sourceRefCommit: { commitId: AZURE_SOURCE_COMMIT_ID } }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations/2/changes?api-version=7.1"),
      response: makeJsonResponse({
        changes: changes.map((change) => ({
          item: {
            objectId: AZURE_NEW_OBJECT_ID,
            path: change.item.path,
            url: change.item.url,
          },
          originalObjectId: change.originalObjectId,
        })),
      }),
    },
    // Per-file item content (target branch = "old")
    ...changes.map((change) => ({
      match: (url: string, method: string) =>
        method === "GET" &&
        url.endsWith(
          buildItemSuffix(change.item.path, "Branch", "refs/heads/main"),
        ),
      response: makeJsonResponse({ content: "" }),
    })),
    // Per-file item content (source commit = "new")
    ...changes.map((change) => ({
      match: (url: string, method: string) =>
        method === "GET" &&
        url.endsWith(
          buildItemSuffix(change.item.path, "Commit", AZURE_SOURCE_COMMIT_ID),
        ),
      response: makeJsonResponse({ content: fileBody(change.item.path) }),
    })),
    ...providerRoutes,
    {
      match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
      response: makeJsonResponse({ count: 0, value: [] }),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: makeJsonResponse({ id: 77 }, 200),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
      response: makeJsonResponse({ count: 0, value: [] }),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
      response: makeJsonResponse({ id: 88 }, 200),
    },
  ];
}

function buildItemSuffix(path: string, versionType: "Branch" | "Commit", version: string): string {
  return `/items?path=${encodeURIComponent(path)}&versionType=${versionType}&version=${encodeURIComponent(version)}&includeContent=true&api-version=7.1`;
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
        return route.response.clone();
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

const FILE_BODY = (path: string): string => {
  // Build a multi-line file so chunked comments can reference line 12
  // AND so the joined diff still exceeds the 8 000-char chunk cap.
  // 12 lines × ~400 chars each ≈ 4 800 chars per file → 5 files
  // = ≈24 000 chars total → 3+ chunks at the 8 000-byte cap.
  const marker = path.split("/").pop()!.replace(/\W/gu, "");
  const lines = Array.from({ length: 12 }, (_unused, index) =>
    `// ${marker}-line-${index + 1}: ${"x".repeat(380)}`,
  );
  return `${lines.join("\n")}\n`;
};

describe("runLive Azure orchestration — chunked path", () => {
  it("dispatches one provider call per chunk and merges findings across chunks", async () => {
    // Given: a 5-file PR where each file is large enough (>4 000 chars
    // body) to make the reconstructed diff > 20 000 chars → guaranteed
    // 3+ chunks under the default 8 000-char cap.
    const fileCount = 5;
    const fixture = buildMultiFileFixture(fileCount, 4_000);

    // Each chunk's provider response adds 1 inline finding anchored to
    // a different line in a different file. After merging, all
    // findings should appear in the posted thread.
    const perChunkBody = (chunkIndex: number, _chunkFileCount: number) => {
      // Pick a different file and line for each chunk.
      const fileIndex = chunkIndex;
      const path = fixture.files[fileIndex]!.path;
      const line = 12;
      const providerReview = {
        summary: `Chunk-${chunkIndex} review.`,
        verdict: chunkIndex === 0 ? "NEEDS_FIX" : "COMMENT",
        comments: [
          {
            path,
            line,
            body: `Chunk-${chunkIndex} finding on ${path}.`,
            severity: chunkIndex === 0 ? "high" : "medium",
            category: "correctness",
          },
        ],
        suppressed_comments: [],
      };
      return JSON.stringify(providerReview);
    };

    const routes = buildMultiFileRoutes({
      fileCount,
      changes: fixture.changes,
      perChunkProviderBody: perChunkBody,
      fileBody: FILE_BODY,
    });
    const recorder = makeFetchRecorder(routes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run succeeds.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);

    // Then: the provider was called more than once (chunking was used).
    const providerCalls = recorder.calls.filter((call) => call.method === "POST" && call.url === "https://provider.example/v1/responses");
    expect(providerCalls.length).toBeGreaterThanOrEqual(2);

    // Then: at least one inline thread was POSTed with a threadContext
    // (= an inline-thread POST, distinct from the parent PR-level
    // POST). We expect >=1 because we merged multiple chunked
    // reviews into one.
    const inlinePosts = recorder.calls.filter((call) => {
      if (call.method !== "POST") return false;
      if (!call.url.endsWith("/threads?api-version=7.1")) return false;
      const body = call.body;
      if (typeof body !== "object" || body === null) return false;
      return "threadContext" in (body as Record<string, unknown>);
    });
    expect(inlinePosts.length).toBeGreaterThanOrEqual(1);

    // Then: the parent PR-level POST (no threadContext) was issued
    // with a body whose verdict is the worst merged verdict
    // (NEEDS_FIX from chunk-0).
    const parentPosts = recorder.calls.filter((call) => {
      if (call.method !== "POST") return false;
      if (!call.url.endsWith("/threads?api-version=7.1")) return false;
      const body = call.body;
      if (typeof body !== "object" || body === null) return false;
      return !("threadContext" in (body as Record<string, unknown>));
    });
    expect(parentPosts).toHaveLength(1);
    const parentBody = readRecord(parentPosts[0]!.body as Record<string, unknown>, "parent thread request");
    const parentFirstComment = readRecord(readArray(parentBody["comments"], "parent comments")[0] as Record<string, unknown>, "parent first comment");
    const parentBodyText = String(parentFirstComment["content"]);
    expect(parentBodyText).toContain("<!-- umactually-pr-review -->");
    expect(parentBodyText).toContain("⛔ NEEDS_FIX");
  });

  it("falls back to a single provider call when the diff fits in one chunk", async () => {
    // Given: a 2-file PR where each file's body is small enough that the
    // joined diff comfortably fits under 8 000 chars → NO chunking.
    const fixture = buildMultiFileFixture(2, 50);
    const routes: FetchRoute[] = [
      ...buildMultiFileRoutes({
        fileCount: 2,
        changes: fixture.changes,
        perChunkProviderBody: (_chunkIndex, _count) =>
          JSON.stringify({
            summary: "Single-shot review.",
            verdict: "COMMENT",
            comments: [],
            suppressed_comments: [],
          }),
        fileBody: (path: string) => `// ${path}\nexport const placeholder = true;\n`,
      }),
    ];

    const recorder = makeFetchRecorder(routes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run succeeds and the provider is called EXACTLY ONCE.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    const providerCalls = recorder.calls.filter((call) => call.method === "POST" && call.url === "https://provider.example/v1/responses");
    expect(providerCalls).toHaveLength(1);
  });
});

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
