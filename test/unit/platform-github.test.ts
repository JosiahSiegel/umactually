import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { expectFutureModule } from "../helpers/assert-red-module.js";

type GithubContext = {
  readonly token: string;
  readonly repo: {
    readonly owner: string;
    readonly name: string;
  };
  readonly prNumber: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly isDraft: boolean;
  readonly title: string;
  readonly body: string;
};

type ReadGithubContext = (env: NodeJS.ProcessEnv) => Promise<GithubContext>;
type FetchGithubPrDiff = (ctx: GithubContext, fetchImpl?: typeof fetch) => Promise<string>;

const githubContextModule = "../../src/platform/github/context.js";
const githubApiModule = "../../src/platform/github/api.js";
const githubContextPath = "src/platform/github/context.ts";
const githubApiPath = "src/platform/github/api.ts";

function isReadGithubContext(value: unknown): value is ReadGithubContext {
  return typeof value === "function";
}

function isFetchGithubPrDiff(value: unknown): value is FetchGithubPrDiff {
  return typeof value === "function";
}

async function loadReadGithubContext(): Promise<ReadGithubContext> {
  const moduleNamespace = await expectFutureModule(githubContextModule);
  const readGithubContext = moduleNamespace["readGithubContext"];
  if (!isReadGithubContext(readGithubContext)) {
    expect.fail(`RED: ${githubContextPath} must export readGithubContext(env)`);
  }
  return readGithubContext;
}

async function loadFetchGithubPrDiff(): Promise<FetchGithubPrDiff> {
  const moduleNamespace = await expectFutureModule(githubApiModule);
  const fetchGithubPrDiff = moduleNamespace["fetchGithubPrDiff"];
  if (!isFetchGithubPrDiff(fetchGithubPrDiff)) {
    expect.fail(`RED: ${githubApiPath} must export fetchGithubPrDiff(ctx, fetchImpl?)`);
  }
  return fetchGithubPrDiff;
}

describe("GitHub platform unit contract", () => {
  it("GITHUB-PLATFORM-RED-001 reads pull request context from env and event payload", async () => {
    // Given: GitHub Actions env plus the pull_request event JSON file path.
    const readGithubContext = await loadReadGithubContext();
    const tempDirectory = await mkdtemp(join(tmpdir(), "umactually-github-"));
    const eventPath = join(tempDirectory, "event.json");
    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 42,
          title: "Add platform adapters",
          body: "Review the new adapters.",
          draft: true,
        },
      }),
    );
    const env: NodeJS.ProcessEnv = {
      GITHUB_TOKEN: "github-token-123",
      GITHUB_REPOSITORY: "octo-org/octo-repo",
      GITHUB_REF_NAME: "42/merge",
      GITHUB_HEAD_REF: "feature/platform-adapters",
      GITHUB_PR_NUMBER: "42",
      GITHUB_HEAD_SHA: "1111111111111111111111111111111111111111",
      GITHUB_BASE_SHA: "2222222222222222222222222222222222222222",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
    };

    // When: the GitHub adapter parses the process environment boundary.
    const context = await readGithubContext(env);
    await rm(tempDirectory, { recursive: true });

    // Then: the typed context carries only the needed PR fields.
    expect(context).toEqual({
      token: "github-token-123",
      repo: { owner: "octo-org", name: "octo-repo" },
      prNumber: 42,
      headSha: "1111111111111111111111111111111111111111",
      baseSha: "2222222222222222222222222222222222222222",
      isDraft: true,
      title: "Add platform adapters",
      body: "Review the new adapters.",
    });
  });

  it("GITHUB-PLATFORM-RED-002 fetches the PR diff with GitHub URL, auth, and diff media type", async () => {
    // Given: a typed GitHub PR context and a fake fetch implementation.
    const fetchGithubPrDiff = await loadFetchGithubPrDiff();
    const context: GithubContext = {
      token: "github-token-123",
      repo: { owner: "octo-org", name: "octo-repo" },
      prNumber: 42,
      headSha: "1111111111111111111111111111111111111111",
      baseSha: "2222222222222222222222222222222222222222",
      isDraft: false,
      title: "Add platform adapters",
      body: "Review the new adapters.",
    };
    let observedUrl = "";
    let observedAuthorization = "";
    let observedAccept = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      observedUrl = String(input);
      const headers = new Headers(init?.headers);
      observedAuthorization = headers.get("authorization") ?? "";
      observedAccept = headers.get("accept") ?? "";
      return new Response("diff --git a/src/file.ts b/src/file.ts\n", { status: 200 });
    };

    // When: the GitHub API adapter requests the diff.
    const diffText = await fetchGithubPrDiff(context, fetchImpl);

    // Then: the adapter uses the pull files endpoint with diff media type and bearer token.
    expect(observedUrl).toBe("https://api.github.com/repos/octo-org/octo-repo/pulls/42/files");
    expect(observedAuthorization).toBe("Bearer github-token-123");
    expect(observedAccept).toBe("application/vnd.github.v3.diff");
    expect(diffText).toBe("diff --git a/src/file.ts b/src/file.ts\n");
  });
});
