// allow: SIZE_OK — single live prompt plumbing suite with shared provider fetch recorder and fixtures
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";

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

const DIFF_TEXT = [
  "diff --git a/src/review/example.ts b/src/review/example.ts",
  "index 1111111..2222222 100644",
  "--- a/src/review/example.ts",
  "+++ b/src/review/example.ts",
  "@@ -1,4 +1,7 @@",
  " export function renderReview(): string {",
  "-  return \"old\";",
  "+  return \"new\";",
  " }",
  "+",
  "+export const changedLine = true;",
].join("\n");

const EVENT_JSON = JSON.stringify({
  number: 42,
  repository: { full_name: "octo-org/octo-repo" },
  pull_request: {
    number: 42,
    title: "Live review",
    body: "Exercise live review path.",
    draft: false,
    base: { sha: "2222222222222222222222222222222222222222", ref: "main" },
    head: { sha: "1111111111111111111111111111111111111111", ref: "feature/live" },
  },
});

const PROVIDER_REVIEW = JSON.stringify({
  summary: "x",
  verdict: "COMMENT",
  comments: [],
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
        return route.response;
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

function githubRoutes(providerBody: string): readonly FetchRoute[] {
  return [
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42"),
      response: new Response(DIFF_TEXT, { status: 200 }),
    },
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: makeJsonResponse({ output_text: providerBody }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42/reviews"),
      response: makeJsonResponse([]),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/pulls/42/reviews"),
      response: makeJsonResponse({ id: 9001, body: "" }, 201),
    },
  ];
}

function findCall(calls: readonly RecordedCall[], method: string, urlSuffix: string): RecordedCall {
  for (const call of calls) {
    if (call.method === method && call.url.endsWith(urlSuffix)) {
      return call;
    }
  }
  throw new Error(`missing ${method} ${urlSuffix}`);
}

/**
 * Reads the captured provider POST body and returns its `system` and `user`
 * prompt strings. The provider wire format (see `buildResponsesBody`) wraps
 * both prompts under `body.input[*].content` with role-tagged entries.
 */
function readProviderPrompts(call: RecordedCall): { readonly system: string; readonly user: string } {
  const body = readRecord(call.body, "provider request");
  const input = readArray(body["input"], "provider request input");
  let system = "";
  let user = "";
  for (const entry of input) {
    const record = readRecord(entry, "input entry");
    const role = record["role"];
    const content = record["content"];
    if (typeof content !== "string") {
      continue;
    }
    if (role === "system") {
      system = content;
    } else if (role === "user") {
      user = content;
    }
  }
  return { system, user };
}

describe("runLive inline prompt plumbing (Wave 2 / S7-RED)", () => {
  let workspace = "";

  afterEach(async () => {
    if (workspace.length > 0) {
      await rm(workspace, { recursive: true, force: true });
      workspace = "";
    }
  });

  it("S7-RED-001: inline --additional-prompt reaches the user prompt body sent to the provider", async () => {
    // Given: a GitHub Actions live environment with no file-based additional prompt
    // and an inline --additional-prompt containing a unique marker string.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-additional-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: live orchestration runs with --additional-prompt carrying the marker.
    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--additional-prompt",
        "EXTRA-INSTRUCTIONS-MARKER",
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run completes successfully (so we can inspect the recorded provider body).
    expect(result.exitCode).toBe(0);

    // Then: a single POST to /responses was captured.
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { user } = readProviderPrompts(providerCall);

    // Then: the inline additional-prompt marker is appended to the user prompt sent to the provider.
    expect(user).toContain("EXTRA-INSTRUCTIONS-MARKER");
  });

  it("S7-RED-002: inline --prompt overrides the hardcoded system prompt sent to the provider", async () => {
    // Given: a GitHub Actions live environment with an inline --prompt carrying a unique marker.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-system-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: live orchestration runs with --prompt carrying the marker.
    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--prompt",
        "CUSTOM-SYSTEM-MARKER",
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run completes successfully.
    expect(result.exitCode).toBe(0);

    // Then: a single POST to /responses was captured.
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { system } = readProviderPrompts(providerCall);

    // Then: the inline --prompt value replaces the hardcoded system prompt.
    expect(system).toContain("CUSTOM-SYSTEM-MARKER");
    // Then: the hardcoded UmActually system prompt is NOT sent when --prompt overrides it.
    expect(system).not.toContain("You are UmActually, a precise pull request reviewer.");
  });

  it("loads repository-relative --prompt-file into the provider system prompt", async () => {
    // Given: a repository-relative system prompt file with a unique marker.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-file-system-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    await mkdir(join(workspace, "prompts"), { recursive: true });
    await writeFile(join(workspace, "prompts", "system.md"), "FILE-SYSTEM-PROMPT-MARKER", "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: live orchestration runs with --prompt-file.
    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--prompt-file",
        "prompts/system.md",
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the provider receives the file content as the system prompt.
    expect(result.exitCode).toBe(0);
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { system } = readProviderPrompts(providerCall);
    expect(system).toContain("FILE-SYSTEM-PROMPT-MARKER");
    expect(system).not.toContain("You are UmActually, a precise pull request reviewer.");
  });

  it("uses the safe repository-relative reader for --additional-prompt-file", async () => {
    // Given: an additional prompt path that tries to escape the repository.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-file-escape-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: live orchestration runs with a traversal path.
    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--additional-prompt-file",
        "../outside.md",
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run fails before the provider call and does not read outside cwd.
    expect(result.exitCode).toBe(1);
    expect(result.posted).toBe(false);
    expect(result.message).toContain("Prompt file error: outside-cwd");
    expect(recorder.calls.some((call) => call.url === "https://provider.example/v1/responses")).toBe(false);
  });

  it("S7-RED-002b: inline --prompt wins over --prompt-file when both are provided", async () => {
    // Given: --prompt-file points at a file on disk with a unique marker; --prompt
    // also carries a (different) inline marker. The inline value must win.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-inline-wins-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const promptFilePath = join(workspace, "ignored.txt");
    await writeFile(promptFilePath, "FILE-PROMPT-MARKER-MUST-NOT-POST", "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: live orchestration runs with both --prompt (inline) and --prompt-file.
    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--prompt",
        "INLINE-WINS",
        "--prompt-file",
        promptFilePath,
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run completes successfully.
    expect(result.exitCode).toBe(0);

    // Then: a single POST to /responses was captured.
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { system } = readProviderPrompts(providerCall);

    // Then: the inline marker is in the system prompt and the file marker is NOT.
    expect(system).toContain("INLINE-WINS");
    expect(system).not.toContain("FILE-PROMPT-MARKER-MUST-NOT-POST");
  });

  it("ULW-AUTOLOAD-001: auto-loads CLAUDE.md from cwd into the system prompt by default", async () => {
    // Given: a CLAUDE.md file in cwd; NO --prompt-file / --prompt-files override.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-autoload-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    await writeFile(
      join(workspace, "CLAUDE.md"),
      "AUTOLOAD-CLAUDE-MARKER",
      "utf8",
    );
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: live orchestration runs with no prompt overrides.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--model", "review-model-synthetic"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run completes successfully.
    expect(result.exitCode).toBe(0);

    // Then: the provider receives the CLAUDE.md content as part of the system prompt.
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { system } = readProviderPrompts(providerCall);
    expect(system).toContain("AUTOLOAD-CLAUDE-MARKER");
  });

  it("ULW-OVERRIDE-001: --prompt-files OVERRIDES the default-lookup list (CLAUDE.md is not loaded)", async () => {
    // Given: BOTH a CLAUDE.md (would auto-load) AND an explicit override file.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-override-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    await writeFile(
      join(workspace, "CLAUDE.md"),
      "CLAUDE-MUST-NOT-POST",
      "utf8",
    );
    await writeFile(
      join(workspace, "review.md"),
      "REVIEW-OVERRIDE-MARKER",
      "utf8",
    );
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: live orchestration runs with --prompt-files.
    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--prompt-files",
        "review.md",
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run completes successfully.
    expect(result.exitCode).toBe(0);

    // Then: ONLY the override is in the system prompt; CLAUDE.md is NOT consulted.
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { system } = readProviderPrompts(providerCall);
    expect(system).toContain("REVIEW-OVERRIDE-MARKER");
    expect(system).not.toContain("CLAUDE-MUST-NOT-POST");
  });

  it("ULW-OVERRIDE-002: --additional-prompt-files (array) routes into the user prompt", async () => {
    // Mirror of ULW-OVERRIDE-001 for the user-prompt side.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-override-user-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    // CLAUDE.md present but must NOT bleed into the user prompt.
    await writeFile(
      join(workspace, "CLAUDE.md"),
      "CLAUDE-USER-MUST-NOT-POST",
      "utf8",
    );
    await writeFile(
      join(workspace, "extra.md"),
      "EXTRA-OVERRIDE-USER-MARKER",
      "utf8",
    );
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--additional-prompt-files",
        "extra.md",
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    expect(result.exitCode).toBe(0);
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { user } = readProviderPrompts(providerCall);
    expect(user).toContain("Additional instructions:");
    expect(user).toContain("EXTRA-OVERRIDE-USER-MARKER");
    expect(user).not.toContain("CLAUDE-USER-MUST-NOT-POST");
  });

  it("ULW-ENV-001: UMACTUALLY_PROMPT_FILES env var is silently ignored (simplified contract)", async () => {
    // The legacy UMACTUALLY_PROMPT_FILES env var was removed in the
    // simplified contract (Todo 4 / Todo 7). The end-to-end CLI
    // surface honors `--prompt-files` (CLI flag) only; the env var
    // is a no-op and the default-lookup list (CLAUDE.md / built-in)
    // is consulted instead. This is the negative end-to-end mirror
    // of the unit-level assertion in
    // test/unit/provider-prompts.test.ts (UMACTUALLY_PROMPT_FILES
    // env var is silently ignored).
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-env-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    // CLAUDE.md that MUST be loaded (env var is a no-op).
    await writeFile(
      join(workspace, "CLAUDE.md"),
      "CLAUDE-ENV-NOW-POSTS",
      "utf8",
    );
    await writeFile(
      join(workspace, "env-override.md"),
      "ENV-OVERRIDE-MUST-NOT-POST",
      "utf8",
    );
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    const env = githubEnv(eventPath);
    env["UMACTUALLY_PROMPT_FILES"] = "env-override.md";

    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--model", "review-model-synthetic"]),
      cwd: workspace,
      env,
      fetchImpl: recorder.fetchImpl,
    });

    expect(result.exitCode).toBe(0);
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { system } = readProviderPrompts(providerCall);
    expect(system).not.toContain("ENV-OVERRIDE-MUST-NOT-POST");
    expect(system).toContain("CLAUDE-ENV-NOW-POSTS");
  });

  it("ULW-MULTI-001: --prompt-files with multiple comma-separated paths concatenates in order", async () => {
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-multi-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    await writeFile(join(workspace, "a.md"), "FIRST-FILE-MARKER", "utf8");
    await writeFile(join(workspace, "b.md"), "SECOND-FILE-MARKER", "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    const result = await runLive({
      parsed: parseCliArgs([
        "--platform",
        "github",
        "--no-dry-run",
        "--model",
        "review-model-synthetic",
        "--prompt-files",
        "a.md,b.md",
      ]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    expect(result.exitCode).toBe(0);
    const providerCall = findCall(recorder.calls, "POST", "/v1/responses");
    const { system } = readProviderPrompts(providerCall);
    expect(system).toContain("FIRST-FILE-MARKER");
    expect(system).toContain("SECOND-FILE-MARKER");
    // And: the order is preserved (a.md before b.md in the joined content).
    const firstIdx = system.indexOf("FIRST-FILE-MARKER");
    const secondIdx = system.indexOf("SECOND-FILE-MARKER");
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("ULW-CACHE-001: runLive resets the cache on each entry point — second invocation sees fresh filesystem state", async () => {
    // Regression for the self-review concern on PR #47: the
    // process-scoped cache MUST be invalidated on each `runLive`
    // entry point so a long-lived process that invokes runLive
    // multiple times against the same cwd sees fresh filesystem
    // state on each call. Without this, a CI step that removes a
    // prompt file between reviews would crash with "not-found".
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-prompts-cache-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    await writeFile(join(workspace, "CLAUDE.md"), "CACHE-MARKER", "utf8");
    const recorder1 = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));
    const recorder2 = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // First invocation: populates the cache.
    const first = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--model", "review-model-synthetic"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder1.fetchImpl,
    });
    expect(first.exitCode).toBe(0);
    const firstCall = findCall(recorder1.calls, "POST", "/v1/responses");
    expect(readProviderPrompts(firstCall).system).toContain("CACHE-MARKER");

    // Remove the file between invocations. With the entry-point
    // reset hook, the SECOND invocation re-stats the disk and
    // finds no CLAUDE.md — so the system prompt falls through to
    // the built-in default. The run completes successfully
    // (exitCode 0).
    await rm(join(workspace, "CLAUDE.md"), { force: true });
    const second = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--model", "review-model-synthetic"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder2.fetchImpl,
    });
    expect(second.exitCode).toBe(0);
    // Then: the second invocation's system prompt did NOT include
    // CACHE-MARKER (file was gone, cache was reset, no default
    // loaded) — fell through to the built-in default.
    const secondCall = findCall(recorder2.calls, "POST", "/v1/responses");
    expect(secondCall).toBeDefined();
    expect(readProviderPrompts(secondCall).system).not.toContain("CACHE-MARKER");
    expect(readProviderPrompts(secondCall).system).toContain("You are UmActually");
  });
});

function githubEnv(eventPath: string): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_TOKEN: "github-token-secret",
    GITHUB_REPOSITORY: "octo-org/octo-repo",
    GITHUB_EVENT_PATH: eventPath,
    UMACTUALLY_API_URL: "https://provider.example/v1",
    UMACTUALLY_API_KEY: "provider-key-secret",
    UMACTUALLY_MODEL: "review-model-synthetic",
  } satisfies NodeJS.ProcessEnv;
}