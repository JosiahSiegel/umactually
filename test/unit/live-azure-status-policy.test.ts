// Unit tests for the Azure DevOps PR status policy.
//
// Three concerns from PR #42's Checks panel:
//
//   1. (CRITICAL) The CLI's `mapReviewVerdictToAzureStatus` returned
//      `state="failed"` for `verdict=NEEDS_FIX`. A failing UmActually
//      review is a *finding*, not a merge-blocking check; build #N
//      succeeded but the Checks panel lit up red because of one verdict.
//      Fix: NEEDS_FIX must map to `"pending"` so the check stays out of
//      the merge gate (and so the merge gate is owned by the ADO
//      branch-policy check, which is independent of verdict semantics).
//
//   2. (CRITICAL) PR #42 has 34 `UmActually` status entries because the
//      CLI never dedups — each build invocation posts a fresh status.
//      The documented API surface at
//        https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/update?view=azure-devops-rest-7.1
//      only supports `op:"remove"` on the collection endpoint; there is
//      NO `PATCH .../statuses/{id}` endpoint that updates a status in
//      place. The documented single-status deletion endpoint is
//        DELETE .../pullRequests/{id}/statuses/{statusId}?api-version=7.1
//      (status 204 No Content on success).
//      So: when about to POST a new `umactually-pr-review-status`, the
//      CLI must list the existing ones, DELETE the previous
//      `umactually-pr-review-status` entries (best-effort), then POST
//      the new one. This keeps the Checks panel at exactly one entry
//      per run going forward.
//
//   3. (MEDIUM) The check NAME visible in the Checks flyout used to be
//      `context.name="UmActually"`, which is a brand-name collision
//      with the policy check. ADO groups statuses by `context.name +
//      context.genre`, so collapsing to a single entry per run is owned
//      by the dedup logic, not by the name. To be unambiguous going
//      forward we use `context.name="umactually-pr-review-status"` and
//      `context.genre="pr-review"`, so any status that escapes the
//      dedup is obviously identifiable as the CLI's.
//
// Reference contracts:
//   POST   https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullRequests/{prId}/statuses?api-version=7.1
//   GET    same URL (list; response includes `id`, `state`, `context.name`, `context.genre`)
//   DELETE https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullRequests/{prId}/statuses/{statusId}?api-version=7.1
//
// State values per Microsoft Learn: notSet | pending | succeeded | failed | error | notApplicable.
//
// Created to drive the RED→GREEN transition for the two real bugs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { mapReviewVerdictToAzureStatus } from "../../src/cli/live-shared.js";
import { runLive } from "../../src/cli/orchestrator.js";
import { azureDiffRoutes, azureReviewDiffFixture } from "./azure-diff-fixture.js";
import type { AzureFetchRoute } from "./azure-diff-fixture.js";

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FreshableRoute = {
  readonly match: (url: string, method: string) => boolean;
  readonly response: Response | (() => Response);
};

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetchRecorder(routes: readonly FreshableRoute[]): {
  readonly calls: RecordedCall[];
  readonly fetchImpl: typeof fetch;
} {
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

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new TypeError(`${label} must be an object`);
}

function freshable(routes: readonly AzureFetchRoute[]): FreshableRoute[] {
  return routes.map((route) => ({
    match: route.match,
    response: () => route.response,
  }));
}

function providerReviewFor(verdict: string, summary: string): string {
  return JSON.stringify({
    summary,
    verdict,
    comments: [
      {
        path: "src/review/example.ts",
        line: 3,
        body: "Azure inline comment.",
        severity: "medium",
        category: "maintainability",
      },
    ],
    suppressed_comments: [],
  });
}

describe("Azure PR status policy: verdict mapping + delete-then-post dedup", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("AZURE-STATUS-POLICY-1: NEEDS_FIX verdict maps to 'pending', not 'failed'", () => {
    // RED → GREEN documentation: prior to the fix this returned
    // 'failed', which made the Checks panel light up red even on
    // builds that succeeded.
    expect(mapReviewVerdictToAzureStatus("NEEDS_FIX")).toBe("pending");
  });

  it("AZURE-STATUS-POLICY-1b: APPROVED / COMMENT / DISCUSS / SHIP map to 'succeeded'", () => {
    // Sanity-check the rest of the mapping table so the fix doesn't
    // accidentally regress other verdicts.
    expect(mapReviewVerdictToAzureStatus("APPROVED")).toBe("succeeded");
    expect(mapReviewVerdictToAzureStatus("COMMENT")).toBe("succeeded");
    expect(mapReviewVerdictToAzureStatus("DISCUSS")).toBe("succeeded");
    expect(mapReviewVerdictToAzureStatus("SHIP")).toBe("succeeded");
  });

  it("AZURE-STATUS-POLICY-1c: unknown verdict maps to 'pending' as the safe default", () => {
    expect(mapReviewVerdictToAzureStatus("")).toBe("pending");
    expect(mapReviewVerdictToAzureStatus("UNKNOWN")).toBe("pending");
    expect(mapReviewVerdictToAzureStatus("needs_fix")).toBe("pending");
  });

  it("AZURE-STATUS-POLICY-2: postAzureStatus DELETEs the existing status with the same context, then POSTs a new one", async () => {
    // The live API only exposes a single-status DELETE; the documented
    // PATCH collection endpoint only supports `op:"remove"` (see the
    // Microsoft Learn doc cited in the file header). So the documented
    // way to keep the panel to one entry per run is:
    //   GET .../statuses                   (find existing by context)
    //   DELETE .../statuses/{id}           (best-effort per id)
    //   POST   .../statuses                (fresh status)
    //
    // The fixture pre-seeds ONE existing status with the same context
    // (id=9001, state=failed, context.name="umactually-pr-review-status",
    // genre="pr-review"), simulating the 34-entry mess on PR #42 before
    // the fix. After the run we assert:
    //   - DELETE was issued for id=9001
    //   - exactly one POST was issued (with the new state, NOT 'failed',
    //     because verdict=NEEDS_FIX now maps to 'pending')
    //   - no other POST /statuses calls remain pending
    const existingStatuses = {
      count: 1,
      value: [
        {
          id: 9001,
          state: "failed",
          description: "stale failed legacy status",
          creationDate: "2026-07-01T20:00:00Z",
          updatedDate: "2026-07-01T20:00:00Z",
          context: { name: "umactually-pr-review-status", genre: "pr-review" },
        },
      ],
    };
    let threadPostCount = 0;
    let newStatusPostCount = 0;
    let deleteCallCount = 0;
    const routes: FreshableRoute[] = [
      ...freshable(azureDiffRoutes(makeJsonResponse, azureReviewDiffFixture())),
      {
        match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
        response: () => makeJsonResponse({ output_text: providerReviewFor("NEEDS_FIX", "Found issues.") }),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: () => makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
        response: () => makeJsonResponse({ id: 77 + (threadPostCount += 1) }, 200),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse(existingStatuses),
      },
      {
        match: (url, method) => method === "DELETE" && url.endsWith("/statuses/9001?api-version=7.1"),
        response: () => {
          deleteCallCount += 1;
          return new Response(null, { status: 204 });
        },
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse({ id: 9000 + (++newStatusPostCount) }, 200),
      },
    ];
    const recorder = makeFetchRecorder(routes);

    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    expect(result.exitCode).toBe(0);

    // The GET on /statuses fires (list existing).
    const listStatusesCalls = recorder.calls.filter(
      (call) => call.method === "GET" && call.url.endsWith("/statuses?api-version=7.1"),
    );
    expect(listStatusesCalls.length).toBeGreaterThanOrEqual(1);

    // The DELETE on /statuses/9001 fires for the pre-existing one.
    const deleteCalls = recorder.calls.filter(
      (call) => call.method === "DELETE" && call.url.endsWith("/statuses/9001?api-version=7.1"),
    );
    expect(deleteCalls.length).toBe(1);
    expect(deleteCallCount).toBe(1);

    // Exactly one POST /statuses with the new state (= pending because NEEDS_FIX)
    // and the renamed context — never with state="failed".
    const statusPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/statuses?api-version=7.1"),
    );
    expect(statusPosts.length).toBe(1);
    const postBody = readRecord(statusPosts[0]?.body as Record<string, unknown>, "status POST body");
    expect(postBody["state"]).toBe("pending");
    const context = readRecord(postBody["context"] as Record<string, unknown>, "status POST context");
    expect(context["name"]).toBe("umactually-pr-review-status");
    expect(context["genre"]).toBe("pr-review");
  });

  it("AZURE-STATUS-POLICY-3: postAzureStatus POSTs a new status (no DELETE) when no existing one shares the context", async () => {
    // The list endpoint returns ONLY unrelated statuses (different
    // context.name), so the dedup helper should find nothing and the
    // POST should fire directly — no DELETE traffic should be emitted.
    const existingUnrelated = {
      count: 1,
      value: [
        {
          id: 8000,
          state: "succeeded",
          description: "policy check",
          creationDate: "2026-07-01T20:00:00Z",
          updatedDate: "2026-07-01T20:00:00Z",
          context: { name: "codecoverage", genre: "umactually-pr-review" },
        },
      ],
    };
    let threadPostCount = 0;
    const routes: FreshableRoute[] = [
      ...freshable(azureDiffRoutes(makeJsonResponse, azureReviewDiffFixture())),
      {
        match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
        response: () => makeJsonResponse({ output_text: providerReviewFor("APPROVED", "All clean.") }),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: () => makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
        response: () => makeJsonResponse({ id: 77 + (threadPostCount += 1) }, 200),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse(existingUnrelated),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse({ id: 7001 }, 200),
      },
    ];
    const recorder = makeFetchRecorder(routes);

    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    expect(result.exitCode).toBe(0);

    // DELETE must not fire when there are no matching-context statuses.
    const deleteCalls = recorder.calls.filter(
      (call) => call.method === "DELETE",
    );
    expect(deleteCalls.length).toBe(0);

    // Exactly one POST.
    const statusPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/statuses?api-version=7.1"),
    );
    expect(statusPosts.length).toBe(1);
    const postBody = readRecord(statusPosts[0]?.body as Record<string, unknown>, "status POST body");
    expect(postBody["state"]).toBe("succeeded");
    const context = readRecord(postBody["context"] as Record<string, unknown>, "status POST context");
    expect(context["name"]).toBe("umactually-pr-review-status");
    expect(context["genre"]).toBe("pr-review");
  });

  it("AZURE-STATUS-POLICY-4: listStatuses returns the most recent umactually-pr-review-status entry", async () => {
    // Same dedup contract as AZURE-STATUS-POLICY-2 but verifies that a
    // status with the right context but DIFFERENT id is still found
    // (so the helper is not memoized on a specific id) and that the
    // hit goes to DELETE on the right id.
    const existingStatuses = {
      count: 3,
      value: [
        {
          id: 5001,
          state: "pending",
          description: "oldest entry",
          creationDate: "2026-07-01T10:00:00Z",
          updatedDate: "2026-07-01T10:00:00Z",
          context: { name: "umactually-pr-review-status", genre: "pr-review" },
        },
        {
          id: 5002,
          state: "failed",
          description: "newer entry",
          creationDate: "2026-07-01T11:00:00Z",
          updatedDate: "2026-07-01T11:00:00Z",
          context: { name: "umactually-pr-review-status", genre: "pr-review" },
        },
        {
          id: 8001,
          state: "pending",
          description: "policy check",
          creationDate: "2026-07-01T09:00:00Z",
          updatedDate: "2026-07-01T09:00:00Z",
          context: { name: "other-policy", genre: "pr-review" },
        },
      ],
    };
    let threadPostCount = 0;
    let deleteCount = 0;
    const deletedIds: number[] = [];
    const routes: FreshableRoute[] = [
      ...freshable(azureDiffRoutes(makeJsonResponse, azureReviewDiffFixture())),
      {
        match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
        response: () => makeJsonResponse({ output_text: providerReviewFor("COMMENT", "ran cleanly") }),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: () => makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
        response: () => makeJsonResponse({ id: 77 + (threadPostCount += 1) }, 200),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse(existingStatuses),
      },
      {
        match: (url, method) =>
          method === "DELETE" && /\/statuses\/\d+\?api-version=7\.1$/.test(url),
        response: () => {
          deleteCount += 1;
          const url = (recorder.calls[recorder.calls.length - 1]?.url ?? "");
          const m = url.match(/\/statuses\/(\d+)\?api-version=7\.1$/);
          if (m && m[1]) deletedIds.push(Number.parseInt(m[1], 10));
          return new Response(null, { status: 204 });
        },
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse({ id: 5003 }, 200),
      },
    ];
    const recorder = makeFetchRecorder(routes);

    await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Both `umactually-pr-review-status` entries (id 5001 and 5002)
    // must be removed; the unrelated entry id 8001 must NOT be touched.
    expect(deleteCount).toBe(2);
    expect(deletedIds.sort((a, b) => a - b)).toEqual([5001, 5002]);

    const statusPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/statuses?api-version=7.1"),
    );
    expect(statusPosts.length).toBe(1);
    const postBody = readRecord(statusPosts[0]?.body as Record<string, unknown>, "status POST body");
    expect(postBody["state"]).toBe("succeeded"); // COMMENT ⇒ succeeded per the mapping fix
    const context = readRecord(postBody["context"] as Record<string, unknown>, "status POST context");
    expect(context["name"]).toBe("umactually-pr-review-status");
  });
});
