import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

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
  summary: "One valid inline finding.",
  verdict: "NEEDS_FIX",
  comments: [
    {
      path: "src/review/example.ts",
      line: 3,
      body: "Tighten this changed line.",
      severity: "high",
      category: "correctness",
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

describe("simulate-findings debug log", () => {
  let workspace = "";

  afterEach(async () => {
    if (workspace.length > 0) {
      await rm(workspace, { recursive: true, force: true });
      workspace = "";
    }
    vi.restoreAllMocks();
  });

  it("S7-RED-027 writes a ::warning:: to stderr when --simulate-findings replaces a non-empty live result", async () => {
    // Given: the live provider returns a non-empty review (real findings)
    // and --simulate-findings is set. The flag must inject the deterministic
    // fixture and (per the new contract) emit a sanitized ::warning:: to
    // stderr so users debugging an empty / missing live review can see
    // that the live payload was overridden.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-simulate-warning-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    // When: --simulate-findings is set on the live path against a
    // non-empty live result.
    await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--simulate-findings"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: stderr receives at least one line containing the GitHub Actions
    // ::notice:: annotation and a reference to "simulate-findings" so the
    // user can correlate the override with their flag. Live findings always
    // win — the fixture is a fallback for empty results only.
    const allCalls = stderrSpy.mock.calls.map((args) => String(args[0] ?? "")).join("");
    expect(allCalls).toContain("::notice::");
    expect(allCalls).toMatch(/simulate-findings/i);
    expect(allCalls).toMatch(/ignored/i);
  });
});
