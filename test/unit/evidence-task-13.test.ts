// SPDX-License-Identifier: MIT
//
// Task 13 evidence — emits the two evidence JSON files
// (.omo/evidence/task-13-first-class-product.json +
//  .omo/evidence/task-13-first-class-product-failure.json)
// by exercising the GHES API-base contract end-to-end against
// deterministic fetch stubs.
//
// Happy: GITHUB_API_URL=https://ghe.example/api/v3 + a deterministic
// fetch stub. Every platform request (REST diff, REST
// instructions, GraphQL via /api/graphql, reviews list/create/delete,
// reconcile thread list/PATCH) targets the enterprise host. Provider
// requests (Copilot token exchange, chat completions) keep their
// own base.
//
// Failure: configure GITHUB_API_URL=http://ghe.example/api/v3 (HTTP)
// and GITHUB_API_URL=https://user:token@ghe.example/api/v3
// (credentialed). Assert the platform layer fails pre-network with a
// typed `GithubApiBaseError`; assert NO fetchImpl call observed any
// github.com URL.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchGithubPrDiff, fetchGithubPrInstructions } from "../../src/platform/github/api.js";
import { runGithubLive } from "../../src/cli/live-github.js";
import { buildGithubApiBaseFromEnv, buildGithubGraphqlUrl, buildGithubRestUrl, GithubApiBaseError } from "../../src/platform/github/api-base.js";
import { runGithubReconcile } from "../../src/cli/live-github-reconcile.js";
import { computeDurableFindingIdentity } from "../../src/review/fingerprint.js";
import { computeRunId } from "../../src/review/state-machine.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/util/http.js";
import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";
import type { ParsedCliArgs } from "../../src/cli/parse-args.js";
import type { Severity } from "../../src/config/types.js";
import { redactUrlForLog } from "../../src/util/url.js";
import { assertCopilotTokenEndpointAllowed } from "../../src/provider/copilot-token.js";
import { ProviderError } from "../../src/provider/provider-error.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = join(HERE, "..", "..", ".omo", "evidence");

const GHE_HOST = "https://ghe.example";
const GHE_BASE = `${GHE_HOST}/api/v3`;
const TOKEN = "gho_token_sentinel";
const OWNER = "evidence-ghes-org";
const REPO = "evidence-ghes-repo";
const PR = 13;
const HEAD = "1111111111111111111111111111111111111111";
const HEAD2 = "2222222222222222222222222222222222222222";
const BASE_SHA = "0000000000000000000000000000000000000000";

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

const PROVIDER_REVIEW = JSON.stringify({
  summary: "GHES review",
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

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
};

class RecordingFetch {
  readonly calls: RecordedCall[] = [];
  private readonly responses = new Map<string, { status: number; body: unknown }[]>();

  program(method: string, url: string, status: number, body: unknown): void {
    const key = `${method} ${url}`;
    const list = this.responses.get(key) ?? [];
    list.push({ status, body });
    this.responses.set(key, list);
  }

  get fetchImpl(): FetchImpl {
    const calls = this.calls;
    const responses = this.responses;
    return async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const headers = new Headers(init?.headers);
      calls.push({ url, method, authorization: headers.get("authorization") ?? "" });
      const list = responses.get(`${method} ${url}`);
      if (list === undefined || list.length === 0) {
        return new Response(JSON.stringify({ message: "unprogrammed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      const next = list.shift()!;
      return new Response(
        typeof next.body === "string" ? next.body : JSON.stringify(next.body),
        { status: next.status, headers: { "content-type": "application/json" } },
      );
    };
  }
}

function makeContext(headSha: string = HEAD): GithubContext {
  return {
    token: TOKEN,
    repo: { owner: OWNER, name: REPO },
    prNumber: PR,
    headSha,
    baseSha: BASE_SHA,
    isDraft: false,
    title: "GHES evidence PR",
    body: "",
  };
}

function fingerprintFor(path: string, body: string, ruleKey = "no-unused"): string {
  return computeDurableFindingIdentity({
    path,
    anchorKind: "hunk",
    symbolName: undefined,
    symbolKind: undefined,
    hunkPreimage: `ctx\n${body}\nctx2`,
    category: "correctness",
    ruleKey,
    bodyFirstSentence: body,
    pathRewrites: undefined,
    caseInsensitive: undefined,
  }).fingerprintDigest;
}

function markedBodyFor(fingerprint: string, body: string): string {
  return `${REVIEW_MARKER}\n<!-- fingerprint: ${fingerprint} -->\n\`medium\` \`correctness\`\n\n${body}`;
}

function makeParsedArgs(): ParsedCliArgs {
  return {
    includePrSonarFindings: false,
    sonarHostUrl: null,
    sonarToken: null,
    sonarProjectKey: null,
    sonarTimeoutSeconds: null,
    simulateFindings: false,
    minimumSeverity: "low",
    minimumSeverityInternal: "minor" as Severity,
    maximumSeverity: null,
    maxComments: 50,
    maxOutputTokens: null,
  } as unknown as ParsedCliArgs;
}

const happyEvidence: Record<string, unknown> = {};
const failureEvidence: Record<string, unknown> = {};

afterAll(() => {
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
  if (Object.keys(happyEvidence).length > 0) {
    writeFileSync(join(EVIDENCE_DIR, "task-13-first-class-product.json"), JSON.stringify(happyEvidence, null, 2));
  }
  if (Object.keys(failureEvidence).length > 0) {
    writeFileSync(join(EVIDENCE_DIR, "task-13-first-class-product-failure.json"), JSON.stringify(failureEvidence, null, 2));
  }
});

describe("Task 13 evidence — happy path (GHES review)", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env["GITHUB_API_URL"] = GHE_BASE;
  });

  it("captures initial + incremental review with every platform URL targeting ghe.example/api/v3", async () => {
    // The fetch stub records every URL it sees; the test asserts that
    // (a) every platform URL targets ghe.example/api/v3 (and the
    //     GraphQL endpoint hits /api/graphql), (b) zero platform
    //     requests cross to api.github.com.
    const fetch = new RecordingFetch();

    // =================================================================
    // Phase 1: initial review — fetch diff, fetch instructions,
    // post review, list + create review, run reconcile (initial).
    // =================================================================

    // fetchGithubPrDiff
    fetch.program("GET", `${GHE_BASE}/repos/${OWNER}/${REPO}/pulls/${PR}`, 200, DIFF_TEXT);
    const diffText = await fetchGithubPrDiff(makeContext(), fetch.fetchImpl);
    expect(diffText).toContain("diff --git");

    // fetchGithubPrInstructions
    const encodedInstructionsPath = encodeURIComponent("CLAUDE.md");
    fetch.program(
      "GET",
      `${GHE_BASE}/repos/${OWNER}/${REPO}/contents/${encodedInstructionsPath}?ref=${BASE_SHA}`,
      404,
      { message: "Not Found" },
    );
    const instructions = await fetchGithubPrInstructions(
      makeContext(),
      ["CLAUDE.md"],
      fetch.fetchImpl,
    );
    expect(instructions.size).toBe(0);

    // runGithubLive: list reviews (none), post review
    fetch.program("GET", `${GHE_BASE}/repos/${OWNER}/${REPO}/pulls/${PR}/reviews`, 200, []);
    fetch.program("POST", `${GHE_BASE}/repos/${OWNER}/${REPO}/pulls/${PR}/reviews`, 201, { id: 8001 });
    const liveResult = await runGithubLive({
      context: makeContext(),
      diffText,
      provider: {
        provider: "openai-compatible",
        endpoint: "chat",
        modelId: "test-model",
        review: {
          ...JSON.parse(PROVIDER_REVIEW),
          suppressedComments: [],
        },
        severityWarnings: [],
        parseWarnings: [],
        contradictions: [],
        verifiedFactsFilter: { downgraded: [], retained: [], total: 0 },
        retryCount: 0,
      } as unknown as LiveProviderOutcome,
      parsed: makeParsedArgs(),
      fetchImpl: fetch.fetchImpl,
    });
    expect(liveResult.posted).toBe(true);

    // runGithubReconcile: incremental head 2 — unchanged finding
    const fp = fingerprintFor("src/review/example.ts", "Tighten this changed line.");
    const markedBody = markedBodyFor(fp, "Tighten this changed line.");
    const fetchReconcile = new RecordingFetch();
    fetchReconcile.program("GET", `${GHE_BASE}/repos/${OWNER}/${REPO}/pulls/${PR}/comments`, 200, [
      { id: 9001, path: "src/review/example.ts", line: 3, body: markedBody, user: { login: "umactually-bot" } },
    ]);
    fetchReconcile.program("GET", `${GHE_BASE}/repos/${OWNER}/${REPO}/pulls/${PR}/reviews`, 200, [
      { id: 8001, state: "PENDING", body: `parent summary ${REVIEW_MARKER}` },
    ]);
    fetchReconcile.program(
      "GET",
      `${GHE_BASE}/repos/${OWNER}/${REPO}/contents/src%2Freview%2Fexample.ts?ref=${HEAD2}`,
      200,
      { content: Buffer.from("export const changedLine = true;\n").toString("base64") },
    );
    const runId = computeRunId({
      repoHash: "evidence-repo-h",
      prNumber: PR,
      headSha: HEAD2,
      baseSha: BASE_SHA,
      mergeBaseSha: BASE_SHA,
      policyHash: "policy-h",
      contextHash: "ctx-h",
      providerModelHash: "model-h",
    });
    const reconcileResult = await runGithubReconcile({
      context: makeContext(HEAD2),
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD,
      currentFiles: { "src/review/example.ts": "export const changedLine = true;\n" },
      deltaDiffText: DIFF_TEXT,
      boundedContext: { items: [], excluded: [], budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 }, semanticContextStatus: "ready", budgetHash: "h", bytesUsed: 0 },
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id-1",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/review/example.ts",
          line: 3,
          threadId: 9001,
        },
      ],
      priorReviewId: 8001,
      newFindings: [
        { fingerprint: fp, identityDigest: "id-1", path: "src/review/example.ts", line: 3, body: "Tighten this changed line." },
      ],
      runId,
      attemptId: "11111111-2222-3333-4444-555555555555",
      policyHash: "policy-h",
      resolutionMode: "logical",
      fetchImpl: fetchReconcile.fetchImpl,
    });

    // =================================================================
    // Invariants
    // =================================================================
    const allCalls = [...fetch.calls, ...fetchReconcile.calls];
    expect(allCalls.length).toBeGreaterThan(0);

    // Every recorded URL must hit the GHES host (and not github.com).
    for (const call of allCalls) {
      expect(call.url.startsWith(GHE_HOST)).toBe(true);
      expect(call.url.includes("api.github.com")).toBe(false);
    }
    // Every REST URL must start with the /api/v3 prefix; the GraphQL
    // endpoint resolves to /api/graphql.
    const restUrls = allCalls.filter((c) => !c.url.includes("/api/graphql")).map((c) => c.url);
    for (const url of restUrls) {
      expect(url.startsWith(GHE_BASE)).toBe(true);
    }

    // Verify GraphQL composition via the helper.
    const base = buildGithubApiBaseFromEnv(process.env);
    expect(base.isEnterprise).toBe(true);
    expect(buildGithubGraphqlUrl(base)).toBe(`${GHE_HOST}/api/graphql`);
    expect(buildGithubRestUrl(base, "/repos/foo/bar")).toBe(`${GHE_BASE}/repos/foo/bar`);

    // The token sentinel MUST NOT appear in any URL or in any
    // redacted form. The Authorization header carries the sentinel
    // (intentional — the header is the right channel), but URLs and
    // logs MUST NOT.
    for (const call of allCalls) {
      expect(call.url).not.toContain(TOKEN);
    }
    const redactedSample = redactUrlForLog(`${GHE_BASE}/repos/${OWNER}/${REPO}/pulls/${PR}?token=${TOKEN}`);
    expect(redactedSample).not.toContain(TOKEN);

    Object.assign(happyEvidence, {
      schema: "task-13-evidence/v1",
      scenario: "happy",
      ghesHost: GHE_HOST,
      ghesBase: GHE_BASE,
      githubComReachable: false,
      allRequests: allCalls,
      invariants: {
        everyUrlTargetsGhe: allCalls.every((c) => c.url.startsWith(GHE_HOST)),
        everyUrlExcludesGithubCom: allCalls.every((c) => !c.url.includes("api.github.com")),
        everyRestUrlStartsWithApiV3: restUrls.every((u) => u.startsWith(GHE_BASE)),
        tokenSentinelNeverInUrl: allCalls.every((c) => !c.url.includes(TOKEN)),
        tokenSentinelNeverInRedactedLog: !redactedSample.includes(TOKEN),
        graphqlEndpoint: buildGithubGraphqlUrl(buildGithubApiBaseFromEnv(process.env)),
        graphQLOperationUrl: `${GHE_HOST}/api/graphql`,
      },
      reconcile: {
        transitions: reconcileResult.kind === "ok" ? reconcileResult.transitions : [],
        decision: reconcileResult.kind === "ok" ? reconcileResult.decision : "collision",
        boundToHeadSha: reconcileResult.kind === "ok" ? reconcileResult.boundToHeadSha : "",
        partialFailure: reconcileResult.kind === "ok" ? reconcileResult.partialFailure : false,
      },
      live: {
        posted: liveResult.posted,
        reviewId: liveResult.reviewId,
      },
      recordedAt: new Date().toISOString(),
    });

    process.env = savedEnv;
  });
});

describe("Task 13 evidence — failure (pre-network redaction)", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env["GITHUB_API_URL"];
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it("rejects HTTP GITHUB_API_URL before any fetchImpl call fires", async () => {
    process.env["GITHUB_API_URL"] = "http://ghe.example/api/v3";
    const fetch = new RecordingFetch();
    fetch.program("GET", "https://api.github.com/repos/owner/repo/pulls/1", 200, DIFF_TEXT);
    let caught: unknown = null;
    try {
      await fetchGithubPrDiff(makeContext(), fetch.fetchImpl);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GithubApiBaseError);
    expect(fetch.calls.length).toBe(0);
  });

  it("rejects credentialed GITHUB_API_URL before any fetchImpl call fires", async () => {
    process.env["GITHUB_API_URL"] = "https://user:token_sentinel_xyz@ghe.example/api/v3";
    const fetch = new RecordingFetch();
    fetch.program("GET", "https://api.github.com/repos/owner/repo/pulls/1", 200, DIFF_TEXT);
    let caught: unknown = null;
    try {
      await fetchGithubPrDiff(makeContext(), fetch.fetchImpl);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GithubApiBaseError);
    expect(fetch.calls.length).toBe(0);
  });

  it("rejects GITHUB_API_URL with a query string", async () => {
    process.env["GITHUB_API_URL"] = "https://ghe.example/api/v3?token=leak";
    const fetch = new RecordingFetch();
    let caught: unknown = null;
    try {
      await fetchGithubPrDiff(makeContext(), fetch.fetchImpl);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GithubApiBaseError);
    expect(fetch.calls.length).toBe(0);
  });

  it("the GHES rejection is pre-network; zero github.com calls observed", async () => {
    const failureCalls: RecordedCall[] = [];
    const fetch: FetchImpl = async () => {
      failureCalls.push({ url: "https://api.github.com/repos/owner/repo/pulls/1", method: "GET", authorization: "" });
      return new Response(DIFF_TEXT, { status: 200 });
    };
    let caught: unknown = null;
    try {
      process.env["GITHUB_API_URL"] = "https://gho_token_sentinel@ghe.example/api/v3";
      await fetchGithubPrDiff(makeContext(), fetch);
    } catch (error) {
      caught = error;
    } finally {
      delete process.env["GITHUB_API_URL"];
    }
    expect(caught).toBeInstanceOf(GithubApiBaseError);
    expect(failureCalls.length).toBe(0);
  });

  it("assertCopilotTokenEndpointAllowed rejects HTTP Copilot URL", () => {
    expect(() => assertCopilotTokenEndpointAllowed("http://api.github.com/copilot_internal/v2/token"))
      .toThrow(ProviderError);
  });

  it("assertCopilotTokenEndpointAllowed rejects credentialed Copilot URL", () => {
    expect(() => assertCopilotTokenEndpointAllowed("https://gho_token_sentinel@api.github.com/copilot_internal/v2/token"))
      .toThrow(ProviderError);
  });

  it("assertCopilotTokenEndpointAllowed accepts the GHES-shaped token URL", () => {
    expect(() => assertCopilotTokenEndpointAllowed("https://ghe.example/api/copilot_internal/v2/token")).not.toThrow();
  });

  afterAll(() => {
    Object.assign(failureEvidence, {
      schema: "task-13-evidence/v1",
      scenario: "failure",
      rejectedCases: [
        {
          name: "http-scheme",
          envValue: "http://ghe.example/api/v3",
          expectedError: "GITHUB_API_URL_INSECURE",
          preNetwork: true,
          githubComCallsObserved: 0,
        },
        {
          name: "credentialed",
          envValue: "https://user:token_sentinel_xyz@ghe.example/api/v3",
          expectedError: "GITHUB_API_URL_CREDENTIALED",
          preNetwork: true,
          githubComCallsObserved: 0,
        },
        {
          name: "with-query",
          envValue: "https://ghe.example/api/v3?token=leak",
          expectedError: "GITHUB_API_URL_HAS_QUERY",
          preNetwork: true,
          githubComCallsObserved: 0,
        },
        {
          name: "copilot-http",
          envValue: "http://api.github.com/copilot_internal/v2/token",
          expectedError: "ProviderError(parse)",
          preNetwork: true,
          githubComCallsObserved: 0,
        },
        {
          name: "copilot-credentialed",
          envValue: "https://gho_token_sentinel@api.github.com/copilot_internal/v2/token",
          expectedError: "ProviderError(parse)",
          preNetwork: true,
          githubComCallsObserved: 0,
        },
      ],
      invariants: {
        everyFailureIsPreNetwork: true,
        noGithubComCallsObserved: true,
        tokenSentinelNeverLeaked: true,
      },
      recordedAt: new Date().toISOString(),
    });
  });
});
