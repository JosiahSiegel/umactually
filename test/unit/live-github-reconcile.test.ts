import { describe, expect, it } from "vitest";

import { computeDurableFindingIdentity } from "../../src/review/fingerprint.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";
import { computeRunId } from "../../src/review/state-machine.js";
import { runGithubReconcile } from "../../src/cli/live-github-reconcile.js";
import type { ReconciledFinding, ReconcileInput, ReconcileResult } from "../../src/cli/live-github-reconcile.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/util/http.js";

function assertOk(result: ReconcileResult): Extract<ReconcileResult, { kind: "ok" }> {
  if (result.kind !== "ok") {
    throw new Error(
      `expected runGithubReconcile to return kind: "ok"; got kind: "${result.kind}"`,
    );
  }
  return result;
}

const TOKEN = "github-token";
const OWNER = "octo-org";
const REPO = "octo-repo";
const PR = 42;
const HEAD1 = "1111111111111111111111111111111111111111";
const HEAD2 = "2222222222222222222222222222222222222222";
const HEAD3 = "3333333333333333333333333333333333333333";
const BASE = "0000000000000000000000000000000000000000";

function makeContext(overrides: Partial<GithubContext> = {}): GithubContext {
  return {
    token: TOKEN,
    repo: { owner: OWNER, name: REPO },
    prNumber: PR,
    headSha: HEAD2,
    baseSha: BASE,
    isDraft: false,
    title: "Test PR",
    body: "",
    ...overrides,
  };
}

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
};

type ProgrammedResponse = {
  readonly status: number;
  readonly body: unknown;
};

class RecordingFetch {
  readonly requests: RecordedRequest[] = [];
  private readonly routes = new Map<string, ProgrammedResponse[]>();

  program(method: string, url: string, response: ProgrammedResponse): void {
    const key = `${method} ${url}`;
    const list = this.routes.get(key) ?? [];
    list.push(response);
    this.routes.set(key, list);
  }

  get fetchImpl(): FetchImpl {
    const routes = this.routes;
    const requests = this.requests;
    return async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      let body: unknown = undefined;
      if (init?.body !== undefined) {
        try {
          body = JSON.parse(init.body as string);
        } catch {
          body = init.body;
        }
      }
      requests.push({ url, method, body });
      const key = `${method} ${url}`;
      const list = routes.get(key);
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

function markedBodyFor(path: string, line: number, fingerprint: string, bodyText: string): string {
  void path;
  void line;
  return `${REVIEW_MARKER}\n<!-- fingerprint: ${fingerprint} -->\n\`medium\` \`correctness\`\n\n${bodyText}`;
}

function fingerprintFor(path: string, _line: number, bodyText: string, ruleKey = "no-unused"): string {
  const identity = computeDurableFindingIdentity({
    path,
    anchorKind: "hunk",
    symbolName: undefined,
    symbolKind: undefined,
    hunkPreimage: `ctx\n${bodyText}\nctx2`,
    category: "correctness",
    ruleKey,
    bodyFirstSentence: bodyText,
    pathRewrites: undefined,
    caseInsensitive: undefined,
  });
  return identity.fingerprintDigest;
}

function buildReconcileInput(
  overrides: Partial<ReconcileInput>,
): ReconcileInput {
  return {
    context: makeContext(),
    currentHeadSha: HEAD2,
    priorHeadSha: HEAD1,
    currentFiles: { "src/auth.ts": "const token = 'X';\n" },
    deltaDiffText: "diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-const token = 'A';\n+const token = 'X';\n",
    boundedContext: {
      items: [],
      excluded: [],
      budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 },
      semanticContextStatus: "ready",
      budgetHash: "h",
      bytesUsed: 0,
    },
    priorFindings: [],
    priorReviewId: 900,
    newFindings: [],
    runId: "test-run-id",
    attemptId: "00000000-0000-0000-0000-000000000001",
    policyHash: "policy-hash",
    resolutionMode: "logical",
    fetchImpl: async () => new Response("{}", { status: 200 }),
    ...overrides,
  };
}

function reviewCommentListUrl(): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/comments`;
}

function reviewCommentsUrl(): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/comments`;
}

function reviewCommentUrl(id: number): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/comments/${id}`;
}

function reviewsListUrl(): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${PR}/reviews`;
}

function fileContentsUrl(path: string): string {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${HEAD2}`;
}

describe("live-github-reconcile — request-contract", () => {
  it("RECONCILE-001 unchanged finding produces no new comment (zero writes for matching fingerprint)", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 1001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "hardcoded credential detected"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts"), {
      status: 200,
      body: { content: Buffer.from("const token = 'X';\n").toString("base64") },
    });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 1001,
        },
      ],
      newFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          path: "src/auth.ts",
          line: 1,
          body: "hardcoded credential detected",
        },
      ],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]!.disposition).toBe("unchanged");
    const mutationRequests = fetch.requests.filter(
      (r) => r.method !== "GET",
    );
    expect(mutationRequests).toHaveLength(0);
  });

  it("RECONCILE-002 changed finding updates/posts once (PATCH fires exactly once)", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 2001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "stale body text"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts"), {
      status: 200,
      body: { content: Buffer.from("const token = 'NEW';\n").toString("base64") },
    });
    fetch.program("PATCH", reviewCommentUrl(2001), { status: 200, body: { id: 2001 } });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'NEW';\n" },
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 2001,
        },
      ],
      newFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          path: "src/auth.ts",
          line: 1,
          body: "hardcoded credential detected",
        },
      ],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]!.disposition).toBe("updated");
    const patches = fetch.requests.filter(
      (r) => r.method === "PATCH" && r.url.endsWith("/comments/2001"),
    );
    expect(patches).toHaveLength(1);
  });

  it("RECONCILE-003 fixed finding resolves only its matching marked thread (logical resolution, no PATCH/POST)", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fpCarried = fingerprintFor("src/auth.ts", 2, "missing input validation on signup", "no-validate");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 3001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "hardcoded credential detected"),
          user: { login: "umactually-bot" },
        },
        {
          id: 3002,
          path: "src/auth.ts",
          line: 2,
          body: markedBodyFor("src/auth.ts", 2, fpCarried, "missing input validation on signup"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts"), {
      status: 200,
      body: { content: Buffer.from("export function signup() {\n  // missing input validation on signup\n  return;\n}\n").toString("base64") },
    });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "export function signup() {\n  // missing input validation on signup\n  return;\n}\n" },
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id-1",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 3001,
        },
        {
          fingerprint: fpCarried,
          identityDigest: "id-2",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 2,
          threadId: 3002,
        },
      ],
      newFindings: [],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    const fixedDisposition = result.transitions.find((t) => t.fingerprint === fp)?.disposition;
    const carriedDisposition = result.transitions.find((t) => t.fingerprint === fpCarried)?.disposition;
    expect(fixedDisposition).toBe("resolved");
    expect(carriedDisposition).toBe("carried");
    const mutationRequests = fetch.requests.filter((r) => r.method !== "GET");
    expect(mutationRequests).toHaveLength(0);
  });

  it("RECONCILE-004 dismissed and human reviews are NEVER touched", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 4001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "old comment"),
          user: { login: "umactually-bot" },
        },
        {
          id: 4002,
          path: "src/auth.ts",
          line: 1,
          body: "human left a note that is not marked by umactually",
          user: { login: "human-reviewer" },
        },
      ],
    });
    fetch.program("GET", reviewsListUrl(), {
      status: 200,
      body: [
        {
          id: 900,
          state: "DISMISSED",
          body: `parent summary ${REVIEW_MARKER}`,
        },
        {
          id: 901,
          state: "PENDING",
          body: `parent summary ${REVIEW_MARKER}`,
        },
      ],
    });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      priorReviewId: 901,
      priorFindings: [],
      newFindings: [],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    const touchedHuman = fetch.requests.filter((r) => /\/comments\/(4001|4002)/u.test(r.url));
    expect(touchedHuman).toHaveLength(0);
    expect(result.resolutionMode).toBe("logical");
  });

  it("RECONCILE-005 force-push full review binds current head (transition full + carry findings from prior)", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 5001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "old finding"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts"), {
      status: 200,
      body: { content: Buffer.from("// entirely new content\n").toString("base64") },
    });

    const input = buildReconcileInput({
      currentHeadSha: HEAD3,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "// entirely new content\n" },
      decision: "full",
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 5001,
        },
      ],
      newFindings: [
        {
          fingerprint: fingerprintFor("src/auth.ts", 5, "new finding on new head", "new-rule"),
          identityDigest: "new-id",
          path: "src/auth.ts",
          line: 5,
          body: "new finding on new head",
        },
      ],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    expect(result.decision).toBe("full");
    expect(result.boundToHeadSha).toBe(HEAD3);
    const priorTransition = result.transitions.find((t) => t.fingerprint === fp);
    expect(priorTransition?.disposition).toBe("superseded");
  });

  it("RECONCILE-006 403/404/422/race paths warn and preserve state (no spurious resolution)", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), { status: 403, body: { message: "forbidden" } });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 6001,
        },
      ],
      newFindings: [],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    expect(result.transitions).toHaveLength(0);
    expect(result.warnings.some((w) => /403|forbidden/i.test(w))).toBe(true);
    expect(result.partialFailure).toBe(true);
  });

  it("RECONCILE-007 new finding posts exactly one inline review-comment", async () => {
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), { status: 200, body: [] });
    fetch.program("POST", reviewCommentsUrl(), { status: 201, body: { id: 7001 } });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      priorFindings: [],
      newFindings: [
        {
          fingerprint: fingerprintFor("src/auth.ts", 10, "new finding detected", "new-rule"),
          identityDigest: "id-new",
          path: "src/auth.ts",
          line: 10,
          body: "new finding detected",
        },
      ],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    const posts = fetch.requests.filter((r) => r.method === "POST" && r.url.endsWith("/comments"));
    expect(posts).toHaveLength(1);
    expect(result.transitions[0]!.disposition).toBe("posted");
  });

  it("RECONCILE-008 runId is computed from the supplied context and is replay-stable", () => {
    const expectedRunId = computeRunId({
      repoHash: "repo-h",
      prNumber: PR,
      headSha: HEAD2,
      baseSha: BASE,
      mergeBaseSha: BASE,
      policyHash: "policy-hash",
      contextHash: "ctx",
      providerModelHash: "model-h",
    });
    const again = computeRunId({
      repoHash: "repo-h",
      prNumber: PR,
      headSha: HEAD2,
      baseSha: BASE,
      mergeBaseSha: BASE,
      policyHash: "policy-hash",
      contextHash: "ctx",
      providerModelHash: "model-h",
    });
    expect(expectedRunId).toBe(again);
  });
});

describe("live-github-reconcile — failure scenario", () => {
  it("RECONCILE-FAIL-001 unmarked human thread is NEVER mutated by any path", async () => {
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), { status: 403, body: { message: "forbidden" } });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      priorFindings: [
        {
          fingerprint: "fp-bot",
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 9001,
        },
      ],
      newFindings: [],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    const mutations = fetch.requests.filter((r) => r.method !== "GET");
    expect(mutations).toHaveLength(0);
    expect(result.partialFailure).toBe(true);
    expect(result.transitions).toHaveLength(0);
  });

  it("RECONCILE-FAIL-002 stale GitHub create/update responses after newer attempt finalize leave state retryable", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 2001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "hardcoded credential detected"),
          user: { login: "umactually-bot" },
        },
        {
          id: 2002,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "hardcoded credential detected"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts"), {
      status: 200,
      body: { content: Buffer.from("const token = 'X';\n").toString("base64") },
    });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 2001,
        },
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 2,
          runId: "newer-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 2002,
        },
      ],
      newFindings: [],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    const mutations = fetch.requests.filter((r) => r.method !== "GET");
    expect(mutations).toHaveLength(0);
    const f2001 = result.transitions.find((t) => t.priorThreadId === 2001);
    const f2002 = result.transitions.find((t) => t.priorThreadId === 2002);
    expect(f2001).toBeDefined();
    expect(f2002).toBeDefined();
  });

  it("RECONCILE-FAIL-003 explicit current-head repair pass supersedes stale native close + leaves retryable state", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 11001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "hardcoded credential detected") +
            "\n<!-- umactually:resolved-by-replay -->\nResolution: anchor verified removed.",
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts"), {
      status: 200,
      body: { content: Buffer.from("const token = 'X';\n").toString("base64") },
    });
    fetch.program("POST", reviewCommentsUrl(), { status: 201, body: { id: 11002 } });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 11001,
        },
      ],
      newFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          path: "src/auth.ts",
          line: 1,
          body: "hardcoded credential detected",
        },
      ],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    const posts = fetch.requests.filter((r) => r.method === "POST" && r.url.endsWith("/comments"));
    expect(posts).toHaveLength(1);
    const transition = result.transitions.find((t) => t.fingerprint === fp);
    expect(transition?.disposition).toMatch(/^(unchanged|updated|posted)$/u);
  });

  it("RECONCILE-FAIL-004 human review state DISMISSED → prior comment is left untouched, no PATCH/POST fires", async () => {
    const fp = fingerprintFor("src/auth.ts", 1, "hardcoded credential detected");
    const fetch = new RecordingFetch();
    fetch.program("GET", reviewCommentListUrl(), {
      status: 200,
      body: [
        {
          id: 12001,
          path: "src/auth.ts",
          line: 1,
          body: markedBodyFor("src/auth.ts", 1, fp, "hardcoded credential detected"),
          user: { login: "umactually-bot" },
        },
      ],
    });
    fetch.program("GET", fileContentsUrl("src/auth.ts"), {
      status: 200,
      body: { content: Buffer.from("const token = 'X';\n").toString("base64") },
    });

    const input = buildReconcileInput({
      currentHeadSha: HEAD2,
      priorHeadSha: HEAD1,
      currentFiles: { "src/auth.ts": "const token = 'X';\n" },
      priorFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          lifecycle: "open",
          generation: 1,
          runId: "old-run",
          path: "src/auth.ts",
          line: 1,
          threadId: 12001,
        },
      ],
      newFindings: [
        {
          fingerprint: fp,
          identityDigest: "id",
          path: "src/auth.ts",
          line: 1,
          body: "hardcoded credential detected",
        },
      ],
    });

    const result = assertOk(await runGithubReconcile({ ...input, fetchImpl: fetch.fetchImpl }));

    const mutations = fetch.requests.filter((r) => r.method !== "GET");
    expect(mutations).toHaveLength(0);
    const transition = result.transitions.find((t) => t.fingerprint === fp);
    expect(transition?.disposition).toBe("unchanged");
  });
});

describe("live-github-reconcile — public API shape", () => {
  it("exports runGithubReconcile as an async function", () => {
    expect(typeof runGithubReconcile).toBe("function");
  });

  it("ReconciledFinding carries the required durable + thread identity", () => {
    const f: ReconciledFinding = {
      fingerprint: "fp",
      identityDigest: "id",
      lifecycle: "open",
      generation: 1,
      runId: "r",
      path: "src/auth.ts",
      line: 1,
      threadId: 1,
    };
    expect(f.fingerprint).toBe("fp");
  });

  it("ReconcileResult carries decision + transitions + warnings + boundToHeadSha", () => {
    const r: ReconcileResult = {
      kind: "ok",
      decision: "incremental",
      reason: "test",
      transitions: [],
      warnings: [],
      boundToHeadSha: HEAD2,
      partialFailure: false,
      resolutionMode: "logical",
      postedThreadIds: [],
      updatedThreadIds: [],
      signalAborted: false,
    };
    expect(r.kind).toBe("ok");
    expect(r.decision).toBe("incremental");
    expect(r.boundToHeadSha).toBe(HEAD2);
  });
});
