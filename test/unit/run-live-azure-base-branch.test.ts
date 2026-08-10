// SPDX-License-Identifier: MIT
//
// Live-orchestration coverage for the Azure `instructionFilesByBaseBranch`
// path (the parallel for the GitHub-side test in
// `run-live-orchestration.test.ts`). The base-branch fetch plumbing was
// added in the umbrella-instruction-files plan but the Azure live path
// had no test exercising it end-to-end. Two contracts are pinned:
//
//   1. The Azure orchestrator calls the `items` API pinned to
//      `versionDescriptor.version=baseCommit` (NOT sourceCommit) so
//      a PR cannot rewrite its own reviewer instructions.
//   2. When the Azure `items` API fails (HTTP 500), the orchestrator
//      logs a warning and falls back to the cwd-based default lookup,
//      without aborting the run.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";
import {
  azureDiffRoutes,
  azureReviewDiffFixture,
} from "./azure-diff-fixture.js";
import type { AzureFetchRoute } from "./azure-diff-fixture.js";

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FetchRoute = AzureFetchRoute;

const PROVIDER_REVIEW = JSON.stringify({
  summary: "Azure live summary.",
  verdict: "APPROVED",
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
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization") ?? "";
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? safeJson(rawBody) : null;
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

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function azureRoutes(): readonly FetchRoute[] {
  return [
    ...azureDiffRoutes(makeJsonResponse, azureReviewDiffFixture()),
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: makeJsonResponse({ output_text: PROVIDER_REVIEW }),
    },
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

function azureEnv(): NodeJS.ProcessEnv {
  return {
    TF_BUILD: "True",
    SYSTEM_ACCESSTOKEN: "azure-token-secret",
    SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
    SYSTEM_TEAMPROJECT: "Example Project",
    BUILD_REPOSITORY_ID: "repo-42",
    SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
    SYSTEM_PULLREQUEST_SOURCECOMMITID: "1111111111111111111111111111111111111111",
    SYSTEM_PULLREQUEST_MERGECOMMITID: "base-commit",
    SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
    UMACTUALLY_API_URL: "https://provider.example/v1",
    UMACTUALLY_API_KEY: "provider-key-secret",
    UMACTUALLY_MODEL: "review-model-synthetic",
  } satisfies NodeJS.ProcessEnv;
}

describe("runLive Azure orchestration: instructionFilesByBaseBranch", () => {
  let workspace = "";

  afterEach(async () => {
    if (workspace.length > 0) {
      await rm(workspace, { recursive: true, force: true });
      workspace = "";
    }
  });

  it("pins the Azure base-branch fetch to baseCommit (not sourceCommit)", async () => {
    // Given: Azure DevOps returns base-branch instruction content for
    // one of the default-lookup paths, and 404s on the rest. The same
    // path is also written to cwd so the additional-prompt branch
    // (which still reads cwd) doesn't throw not-found.
    workspace = await mkdtemp(join(tmpdir(), "umactually-azure-base-branch-"));
    await writeFile(join(workspace, "CLAUDE.md"), "INSTRUCTION_FROM_CWD\n", "utf8");
    const baseBranchPayload = "BASE_BRANCH_AZURE_INSTRUCTION_TOKEN";
    const routes: FetchRoute[] = [
      {
        match: (url, method) =>
          method === "GET"
          && url.includes("/items?path=CLAUDE.md")
          && url.includes("versionDescriptor.version=base-commit"),
        response: makeJsonResponse({ content: baseBranchPayload }),
      },
      {
        // Every other DEFAULT_PROMPT_FILE_PATHS entry pinned to the
        // base commit 404s.
        match: (url, method) =>
          method === "GET"
          && url.includes("/items?")
          && url.includes("versionDescriptor.version=base-commit"),
        response: new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
      },
      ...azureRoutes(),
    ];
    const recorder = makeFetchRecorder(routes);

    // When: live orchestration runs on Azure.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run", "--model", "review-model-synthetic"]),
      cwd: workspace,
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run completes successfully and the base-branch content
    // is forwarded into the provider's system prompt.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);

    // And: the items API was called with versionDescriptor.version=base-commit
    // — NOT source-commit — so a PR cannot rewrite its reviewer instructions.
    const baseBranchCalls = recorder.calls.filter(
      (call) =>
        call.method === "GET"
        && call.url.includes("/items?")
        && call.url.includes("versionDescriptor.version=base-commit"),
    );
    expect(baseBranchCalls.length).toBeGreaterThan(0);
    expect(
      baseBranchCalls.every(
        (call) => !call.url.includes("versionDescriptor.version=source-commit"),
      ),
    ).toBe(true);

    // And: the provider's system prompt carries the base-branch content.
    const providerCall = recorder.calls.find(
      (call) => call.method === "POST" && call.url === "https://provider.example/v1/responses",
    );
    expect(providerCall).toBeDefined();
    const body = providerCall!.body as { input?: readonly { role: string; content?: string }[] };
    const systemMessage = body.input?.find((entry) => entry.role === "system");
    expect(systemMessage?.content).toContain(baseBranchPayload);
  });

  it("falls back to cwd lookup when the Azure base-branch fetch fails (HTTP 500)", async () => {
    // Given: the Azure `items` API is unreachable (500 on every path).
    // `fetchAzurePrInstructions` throws and the orchestrator must log a
    // warning and proceed with the run.
    workspace = await mkdtemp(join(tmpdir(), "umactually-azure-base-branch-fail-"));
    await writeFile(join(workspace, "CLAUDE.md"), "INSTRUCTION_FROM_CWD\n", "utf8");
    const failingRoutes: FetchRoute[] = [
      {
        match: (url, method) =>
          method === "GET"
          && url.includes("/items?")
          && url.includes("versionDescriptor.version=base-commit"),
        response: new Response(JSON.stringify({ message: "boom" }), { status: 500 }),
      },
      ...azureRoutes(),
    ];
    const recorder = makeFetchRecorder(failingRoutes);

    // Capture stderr so the assertion can pin the warning log shape.
    const stderrLines: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrLines.push(String(chunk));
      return true;
    });

    try {
      const result = await runLive({
        parsed: parseCliArgs(["--platform", "azure", "--no-dry-run", "--model", "review-model-synthetic"]),
        cwd: workspace,
        env: azureEnv(),
        fetchImpl: recorder.fetchImpl,
      });

      // Then: the run still posts successfully (cwd fallback path).
      expect(result.exitCode).toBe(0);
      expect(result.posted).toBe(true);

      // And: a warning was logged explaining the fallback.
      const allStderr = stderrLines.join("");
      expect(allStderr).toContain("failed to fetch Azure base-branch instruction files");
      expect(allStderr).toContain("falling back to cwd lookup");

      // And: the provider prompt still went out (i.e. we did not
      // short-circuit out of the review because instructions failed).
      const providerCall = recorder.calls.find(
        (call) => call.method === "POST" && call.url === "https://provider.example/v1/responses",
      );
      expect(providerCall).toBeDefined();
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
