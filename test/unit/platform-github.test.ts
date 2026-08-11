import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fetchGithubPrDiff } from "../../src/platform/github/api.js";
import { readGithubContext, type GithubContext } from "../../src/platform/github/context.js";

describe("GitHub platform unit contract", () => {
  it("GITHUB-PLATFORM-001 reads pull request context from env and event payload", async () => {
    // Given: GitHub Actions env plus the pull_request event JSON file path.
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

  it("GITHUB-PLATFORM-002 fetches the PR diff with GitHub URL, auth, and diff media type", async () => {
    // Given: a typed GitHub PR context and a fake fetch implementation.
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

    // Then: the adapter uses the pull endpoint (not /files) with the diff
    // media type and bearer token. /files always returns JSON listing the
    // files regardless of Accept header; /pulls/{pr} with the diff media
    // type is the endpoint that returns the unified diff body.
    expect(observedUrl).toBe("https://api.github.com/repos/octo-org/octo-repo/pulls/42");
    expect(observedAuthorization).toBe("Bearer github-token-123");
    expect(observedAccept).toBe("application/vnd.github.v3.diff");
    expect(diffText).toBe("diff --git a/src/file.ts b/src/file.ts\n");
  });

  it("rejects partial numeric PR numbers (GITHUB_PR_NUMBER=42abc) with GITHUB_PR_NUMBER_INVALID", async () => {
    // Regression: Number.parseInt("42abc", 10) silently returns 42.
    // The strict helper now refuses and the typed error carries the
    // canonical code so the runner surfaces it to stderr instead of
    // making a 404 call to /repos/.../pulls/42.
    const tempDirectory = await mkdtemp(join(tmpdir(), "umactually-github-"));
    const eventPath = join(tempDirectory, "event.json");
    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 42,
          title: "Add platform adapters",
          body: "Review the new adapters.",
          head: { ref: "feature/strict-pr-number", sha: "1111111111111111111111111111111111111111" },
          base: { ref: "main", sha: "2222222222222222222222222222222222222222" },
          draft: false,
        },
      }),
    );
    const env: NodeJS.ProcessEnv = {
      GITHUB_TOKEN: "github-token-123",
      GITHUB_REPOSITORY: "octo-org/octo-repo",
      GITHUB_REF_NAME: "42/merge",
      GITHUB_HEAD_REF: "feature/strict-pr-number",
      GITHUB_PR_NUMBER: "42abc",
      GITHUB_HEAD_SHA: "1111111111111111111111111111111111111111",
      GITHUB_BASE_SHA: "2222222222222222222222222222222222222222",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
    };
    await expect(readGithubContext(env)).rejects.toMatchObject({
      name: "GithubContextError",
      code: "GITHUB_PR_NUMBER_INVALID",
    });
    await rm(tempDirectory, { recursive: true });
  });
});
