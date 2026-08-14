// allow: SIZE_OK — single soft-fail coverage suite: 8 shared cases × 3 provider
// harnesses via describe.each + 2 orchestrator cases, all reusing one stub helper.
//
// Coverage tests for the soft-fail retry branches added by the T10 wiring
// (Minimax-M3 empty-body incident). The three provider clients
// (openai-compatible / copilot / anthropic-messages) share IDENTICAL soft-fail
// semantics, so one set of 8 cases is driven through each provider via a
// per-provider harness (wire adapter + fetch stub):
//
//   A. all-empty first parse + populated retry      → retry ADOPTED
//   B. all-empty first parse + all-empty retry      → ORIGINAL returned
//   C. all-empty first parse + retry HTTP-fails     → ORIGINAL returned
//   D. all-empty first parse + retry fetch throws   → ORIGINAL returned
//   E. all-empty first parse + retry unparseable    → ORIGINAL returned
//   F. clean 0-finding review (populated summary)   → NO retry (vacuous truth)
//   G. all-populated bodies                         → NO retry
//   H. mixed bodies (some empty, some populated)    → NO retry
//
// Case A also pins the `[DEBUG-RAW] soft-fail: all N finding bodies empty;
// retrying` trace emission (UMACTUALLY_DEBUG_RAW=1).
//
// The two orchestrator cases drive `runLive` end-to-end (GitHub platform,
// fetch-routed like run-live-orchestration.test.ts) to cover
// `attachConsideredCountsToMetrics`'s `empty-body` reason counter:
//
//   I.  emptyBodyDroppedCount > 0        → incrementReason("empty-body", N)
//   J.  emptyBodyDroppedCount undefined  → counter stays 0

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";
import { runAnthropicRequest } from "../../src/provider/anthropic-messages.js";
import { runCopilotRequest } from "../../src/provider/copilot.js";
import { clearCopilotTokenCache } from "../../src/provider/copilot-token.js";
import { runProviderRequest } from "../../src/provider/openai-compatible.js";

// ---------------------------------------------------------------------------
// Fetch stub (mirrors test/unit/provider.test.ts, extended with a throw slot)
// ---------------------------------------------------------------------------

/** One scripted fetch outcome: an HTTP response, or a thrown network error. */
type StubSlot =
  | { readonly status: number; readonly body: string }
  | { readonly throw: true };

function makeFetchStub(slots: readonly StubSlot[]): {
  readonly urls: readonly string[];
  readonly fetch: typeof fetch;
} {
  const urls: string[] = [];
  let index = 0;
  const stubbed: typeof fetch = async (input, init) => {
    void init;
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    urls.push(url);
    const slot = slots[index];
    if (slot === undefined) {
      throw new Error(`fetch stub exhausted at call #${index + 1}`);
    }
    index += 1;
    if ("throw" in slot) {
      throw new Error("synthetic soft-fail retry network outage");
    }
    return new Response(slot.body, {
      status: slot.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { urls, fetch: stubbed };
}

// ---------------------------------------------------------------------------
// Scenario DSL — provider-agnostic steps mapped to each provider's wire shape
// ---------------------------------------------------------------------------

type ScenarioStep =
  | { readonly kind: "review"; readonly review: unknown }
  | { readonly kind: "prose"; readonly text: string }
  | { readonly kind: "status"; readonly status: number; readonly body: string }
  | { readonly kind: "throw" };

/** Per-provider wire formats for a 200 response carrying a review / prose. */
type WireAdapter = {
  readonly review: (review: unknown) => string;
  readonly prose: (text: string) => string;
};

function stepToSlot(step: ScenarioStep, wire: WireAdapter): StubSlot {
  if (step.kind === "review") {
    return { status: 200, body: wire.review(step.review) };
  }
  if (step.kind === "prose") {
    return { status: 200, body: wire.prose(step.text) };
  }
  if (step.kind === "status") {
    return { status: step.status, body: step.body };
  }
  return { throw: true };
}

// ---------------------------------------------------------------------------
// Shared review fixtures
// ---------------------------------------------------------------------------

function finding(line: number, body: string): Record<string, unknown> {
  return { path: "src/auth.ts", line, body, severity: "high", category: "security" };
}

/** Schema-valid but hollow: verdict + summary populated, ALL bodies empty/whitespace. */
const HOLLOW_FIRST = {
  summary: "Hollow first review.",
  verdict: "NEEDS_FIX",
  comments: [finding(1, ""), finding(2, "   ")],
  suppressed_comments: [],
};

/** A second hollow payload with a DIFFERENT summary so wrong adoption is visible. */
const HOLLOW_RETRY = {
  summary: "Hollow retry review.",
  verdict: "NEEDS_FIX",
  comments: [finding(1, ""), finding(2, "")],
  suppressed_comments: [],
};

const POPULATED_REVIEW = {
  summary: "Recovered review.",
  verdict: "NEEDS_FIX",
  comments: [finding(1, "Real body one."), finding(2, "Real body two.")],
  suppressed_comments: [],
};

/** Clean 0-finding review: populated summary, EMPTY comments array (vacuous truth). */
const CLEAN_ZERO_FINDINGS = {
  summary: "Clean review.",
  verdict: "APPROVED",
  comments: [],
  suppressed_comments: [],
};

const MIXED_REVIEW = {
  summary: "Mixed review.",
  verdict: "DISCUSS",
  comments: [finding(1, ""), finding(2, "Populated body.")],
  suppressed_comments: [],
};

const APOLOGY_PROSE = "I apologize — I could not format the findings as JSON.";

type SoftFailCase = {
  readonly label: string;
  readonly steps: readonly ScenarioStep[];
  readonly expectInferenceCalls: number;
  readonly expectSummary: string;
  readonly expectFirstCommentBody?: string;
  readonly expectCommentCount?: number;
  /** Also pin the [DEBUG-RAW] soft-fail trace line (UMACTUALLY_DEBUG_RAW=1). */
  readonly withDebugTrace?: boolean;
};

const SOFT_FAIL_CASES: readonly SoftFailCase[] = [
  {
    label: "A: all-empty first parse, populated retry → retry adopted",
    steps: [
      { kind: "review", review: HOLLOW_FIRST },
      { kind: "review", review: POPULATED_REVIEW },
    ],
    expectInferenceCalls: 2,
    expectSummary: "Recovered review.",
    expectFirstCommentBody: "Real body one.",
    withDebugTrace: true,
  },
  {
    label: "B: all-empty first parse, all-empty retry → original returned",
    steps: [
      { kind: "review", review: HOLLOW_FIRST },
      { kind: "review", review: HOLLOW_RETRY },
    ],
    expectInferenceCalls: 2,
    expectSummary: "Hollow first review.",
    expectFirstCommentBody: "",
  },
  {
    label: "C: all-empty first parse, retry HTTP-fails → original returned",
    steps: [
      { kind: "review", review: HOLLOW_FIRST },
      { kind: "status", status: 500, body: '{"error":"internal"}' },
    ],
    expectInferenceCalls: 2,
    expectSummary: "Hollow first review.",
  },
  {
    label: "D: all-empty first parse, retry fetch throws → original returned",
    steps: [
      { kind: "review", review: HOLLOW_FIRST },
      { kind: "throw" },
    ],
    expectInferenceCalls: 2,
    expectSummary: "Hollow first review.",
  },
  {
    label: "E: all-empty first parse, retry unparseable → original returned",
    steps: [
      { kind: "review", review: HOLLOW_FIRST },
      { kind: "prose", text: APOLOGY_PROSE },
    ],
    expectInferenceCalls: 2,
    expectSummary: "Hollow first review.",
  },
  {
    label: "F: clean 0-finding review (vacuous truth) → NO retry fired",
    steps: [{ kind: "review", review: CLEAN_ZERO_FINDINGS }],
    expectInferenceCalls: 1,
    expectSummary: "Clean review.",
    expectCommentCount: 0,
  },
  {
    label: "G: all-populated bodies → NO retry fired",
    steps: [{ kind: "review", review: POPULATED_REVIEW }],
    expectInferenceCalls: 1,
    expectSummary: "Recovered review.",
    expectFirstCommentBody: "Real body one.",
  },
  {
    label: "H: mixed bodies (some empty, some populated) → NO retry fired",
    steps: [{ kind: "review", review: MIXED_REVIEW }],
    expectInferenceCalls: 1,
    expectSummary: "Mixed review.",
    expectCommentCount: 2,
  },
];

// ---------------------------------------------------------------------------
// Provider harnesses
// ---------------------------------------------------------------------------

type InferenceOutcome = {
  readonly ok: boolean;
  readonly summary: string | null;
  readonly firstCommentBody: string | null;
  readonly commentCount: number;
  readonly inferenceCalls: number;
  readonly errorMessage: string | null;
};

type ProviderHarness = {
  readonly name: string;
  readonly wire: WireAdapter;
  run(steps: readonly ScenarioStep[]): Promise<InferenceOutcome>;
};

const OPENAI_WIRE: WireAdapter = {
  review: (review) => JSON.stringify({ output_text: JSON.stringify(review) }),
  prose: (text) => JSON.stringify({ output_text: text }),
};

const COPILOT_WIRE: WireAdapter = {
  review: (review) => JSON.stringify({
    choices: [{ message: { role: "assistant", content: JSON.stringify(review) }, finish_reason: "stop" }],
  }),
  prose: (text) => JSON.stringify({
    choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }],
  }),
};

const ANTHROPIC_WIRE: WireAdapter = {
  review: (review) => JSON.stringify({
    id: "msg_soft_fail_coverage",
    model: "claude-sonnet-4.6",
    role: "assistant",
    content: [{ type: "text", text: JSON.stringify(review) }],
    stop_reason: "end_turn",
  }),
  prose: (text) => JSON.stringify({
    id: "msg_soft_fail_coverage",
    model: "claude-sonnet-4.6",
    role: "assistant",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
  }),
};

const COPILOT_TOKEN_SLOT: StubSlot = {
  status: 200,
  body: JSON.stringify({
    token: "tid=softfail-coverage",
    expires_at: 9_999_999_999,
    endpoints: { api: "https://api.individual.githubcopilot.com" },
  }),
};

const openAiHarness: ProviderHarness = {
  name: "openai-compatible",
  wire: OPENAI_WIRE,
  async run(steps) {
    const stub = makeFetchStub(steps.map((step) => stepToSlot(step, OPENAI_WIRE)));
    const result = await runProviderRequest({
      baseUrl: "https://provider.example/v1",
      apiKey: "sk-openai-softfail-do-not-leak",
      model: "review-model-synthetic",
      system: "system prompt",
      user: "user prompt",
      requestTimeoutMs: 5_000,
      fetchImpl: stub.fetch,
    });
    if (!result.ok) {
      return { ok: false, summary: null, firstCommentBody: null, commentCount: 0, inferenceCalls: stub.urls.length, errorMessage: result.error.message };
    }
    return {
      ok: true,
      summary: result.review.summary,
      firstCommentBody: result.review.comments[0]?.body ?? null,
      commentCount: result.review.comments.length,
      inferenceCalls: stub.urls.length,
      errorMessage: null,
    };
  },
};

const copilotHarness: ProviderHarness = {
  name: "copilot",
  wire: COPILOT_WIRE,
  async run(steps) {
    const stub = makeFetchStub([
      COPILOT_TOKEN_SLOT,
      ...steps.map((step) => stepToSlot(step, COPILOT_WIRE)),
    ]);
    const result = await runCopilotRequest({
      githubToken: "gho_softfail_coverage",
      apiBase: undefined,
      system: "system prompt",
      user: "user prompt",
      model: "gpt-5",
      requestTimeoutMs: 5_000,
      fetchImpl: stub.fetch,
    });
    // Subtract the token-exchange fetch: the cache is cleared before every
    // test, so exactly one token call precedes the inference calls.
    const inferenceCalls = stub.urls.length - 1;
    if (!result.ok) {
      return { ok: false, summary: null, firstCommentBody: null, commentCount: 0, inferenceCalls, errorMessage: result.error.message };
    }
    return {
      ok: true,
      summary: result.review.summary,
      firstCommentBody: result.review.comments[0]?.body ?? null,
      commentCount: result.review.comments.length,
      inferenceCalls,
      errorMessage: null,
    };
  },
};

const anthropicHarness: ProviderHarness = {
  name: "anthropic-messages",
  wire: ANTHROPIC_WIRE,
  async run(steps) {
    const stub = makeFetchStub(steps.map((step) => stepToSlot(step, ANTHROPIC_WIRE)));
    const result = await runAnthropicRequest({
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant-softfail-do-not-leak",
      model: "claude-sonnet-4.6",
      system: "system prompt",
      user: "user prompt",
      requestTimeoutMs: 5_000,
      fetchImpl: stub.fetch,
    });
    if (!result.ok) {
      return { ok: false, summary: null, firstCommentBody: null, commentCount: 0, inferenceCalls: stub.urls.length, errorMessage: result.error.message };
    }
    return {
      ok: true,
      summary: result.review.summary,
      firstCommentBody: result.review.comments[0]?.body ?? null,
      commentCount: result.review.comments.length,
      inferenceCalls: stub.urls.length,
      errorMessage: null,
    };
  },
};

const HARNESSES: readonly ProviderHarness[] = [openAiHarness, copilotHarness, anthropicHarness];

// ---------------------------------------------------------------------------
// stderr capture + debug-raw toggle
// ---------------------------------------------------------------------------

let stderrSpy: ReturnType<typeof vi.spyOn>;
let stderrOutput: string[];

function stderrText(): string {
  return stderrOutput.join("");
}

/** Set UMACTUALLY_DEBUG_RAW=1 when `enabled`; returns a restore function. */
function withDebugRawEnv(enabled: boolean): () => void {
  const previous = process.env["UMACTUALLY_DEBUG_RAW"];
  if (enabled) {
    process.env["UMACTUALLY_DEBUG_RAW"] = "1";
  }
  return () => {
    if (previous === undefined) {
      delete process.env["UMACTUALLY_DEBUG_RAW"];
    } else {
      process.env["UMACTUALLY_DEBUG_RAW"] = previous;
    }
  };
}

beforeEach(() => {
  clearCopilotTokenCache();
  stderrOutput = [];
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderrOutput.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  });
});

afterEach(() => {
  stderrSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// The 8 soft-fail cases × 3 providers
// ---------------------------------------------------------------------------

describe.each(HARNESSES)("provider soft-fail retry branches — $name", (harness) => {
  it.each(SOFT_FAIL_CASES)("$label", async (testCase) => {
    const restore = withDebugRawEnv(testCase.withDebugTrace === true);
    try {
      // When: the provider runs the scripted first attempt (+ retry when fired).
      const outcome = await harness.run(testCase.steps);

      // Then: the soft-fail path resolves to a SUCCESS (never a parse error).
      expect(outcome.ok, `provider error: ${outcome.errorMessage ?? "unknown"}`).toBe(true);
      expect(outcome.summary).toBe(testCase.expectSummary);

      // And: the first comment body matches (retry adopted vs original kept).
      if (testCase.expectFirstCommentBody !== undefined) {
        expect(outcome.firstCommentBody).toBe(testCase.expectFirstCommentBody);
      }
      if (testCase.expectCommentCount !== undefined) {
        expect(outcome.commentCount).toBe(testCase.expectCommentCount);
      }

      // And: exactly the expected number of inference calls hit the wire —
      // 2 when the soft-fail retry fired, 1 when the gate did not trigger.
      expect(outcome.inferenceCalls).toBe(testCase.expectInferenceCalls);

      // And (debug cases): the [DEBUG-RAW] soft-fail trace line was emitted.
      if (testCase.withDebugTrace === true) {
        expect(stderrText()).toMatch(/soft-fail: all 2 finding bodies empty; retrying/u);
      }
    } finally {
      restore();
    }
  }, 10_000);
});

// ---------------------------------------------------------------------------
// Orchestrator cases — attachConsideredCountsToMetrics empty-body counter
// (private function; driven end-to-end through `runLive` on the GitHub
// platform, mirroring test/unit/run-live-orchestration.test.ts)
// ---------------------------------------------------------------------------

const LIVE_DIFF_TEXT = [
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

const LIVE_EVENT_JSON = JSON.stringify({
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

const PROVIDER_RESPONSES_URL = "https://provider.example/v1/responses";

/** Hollow live review: both findings anchored to the diff with empty bodies. */
const LIVE_HOLLOW_REVIEW_BODY = JSON.stringify({
  summary: "Hollow live review.",
  verdict: "NEEDS_FIX",
  comments: [
    { path: "src/review/example.ts", line: 3, body: "", severity: "high", category: "correctness" },
    { path: "src/review/example.ts", line: 3, body: "", severity: "high", category: "correctness" },
  ],
  suppressed_comments: [],
});

const LIVE_POPULATED_REVIEW_BODY = JSON.stringify({
  summary: "One valid inline finding.",
  verdict: "NEEDS_FIX",
  comments: [
    { path: "src/review/example.ts", line: 3, body: "Tighten this changed line.", severity: "high", category: "correctness" },
  ],
  suppressed_comments: [],
});

function liveGithubEnv(eventPath: string): NodeJS.ProcessEnv {
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

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("orchestrator — empty-body audit reason counter (attachConsideredCountsToMetrics)", () => {
  let workspace = "";

  afterEach(async () => {
    if (workspace.length > 0) {
      await rm(workspace, { recursive: true, force: true });
      workspace = "";
    }
  });

  /**
   * Runs the full live GitHub flow with a queue of provider response bodies
   * (each body is the JSON string wrapped in `{ output_text: ... }`). Returns
   * the run result plus the number of provider inference POSTs observed.
   */
  async function runLiveWithProviderReviews(
    reviewBodies: readonly string[],
  ): Promise<{ readonly result: Awaited<ReturnType<typeof runLive>>; readonly providerPosts: number }> {
    workspace = await mkdtemp(join(tmpdir(), "umactually-softfail-live-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, LIVE_EVENT_JSON, "utf8");

    let providerIndex = 0;
    let providerPosts = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const method = init?.method ?? "GET";
      if (method === "POST" && url === PROVIDER_RESPONSES_URL) {
        const body = reviewBodies[providerIndex];
        if (body === undefined) {
          throw new Error(`provider stub exhausted at call #${providerIndex + 1}`);
        }
        providerIndex += 1;
        providerPosts += 1;
        return jsonResponse({ output_text: body });
      }
      if (method === "GET" && url.endsWith("/pulls/42")) {
        return new Response(LIVE_DIFF_TEXT, { status: 200 });
      }
      if (method === "GET" && url.endsWith("/pulls/42/reviews")) {
        return jsonResponse([]);
      }
      if (method === "POST" && url.endsWith("/pulls/42/reviews")) {
        return jsonResponse({ id: 9001, body: "" }, 201);
      }
      // Unmatched reads (base-branch instruction-file /contents fetches)
      // throw; the orchestrator catches and falls back to cwd lookup.
      throw new Error(`unexpected ${method} ${url}`);
    };

    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--model", "review-model-synthetic"]),
      cwd: workspace,
      env: liveGithubEnv(eventPath),
      fetchImpl,
    });
    return { result, providerPosts };
  }

  it("Case I: increments empty-body by emptyBodyDroppedCount when hollow findings were dropped", async () => {
    // Given: BOTH the first provider response and the soft-fail retry return
    // the same hollow review (all bodies empty). The provider keeps the
    // original; the partition layer drops 2 empty-body findings, so
    // emptyBodyDroppedCount === 2 reaches attachConsideredCountsToMetrics.
    const { result, providerPosts } = await runLiveWithProviderReviews([
      LIVE_HOLLOW_REVIEW_BODY,
      LIVE_HOLLOW_REVIEW_BODY,
    ]);

    // Then: the run posted successfully and the soft-fail retry fired once.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(providerPosts).toBe(2);

    // And: the audit reason histogram counted both empty-body drops.
    expect(result.metrics?.reasons["empty-body"]).toBe(2);
  }, 30_000);

  it("Case J: does NOT increment empty-body when emptyBodyDroppedCount is undefined", async () => {
    // Given: the provider returns a fully populated review on the first
    // attempt — no soft-fail retry, no empty-body partition, so
    // emptyBodyDroppedCount is undefined on the outcome.
    const { result, providerPosts } = await runLiveWithProviderReviews([
      LIVE_POPULATED_REVIEW_BODY,
    ]);

    // Then: the run posted successfully with a single provider call.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(providerPosts).toBe(1);

    // And: the empty-body counter stays at its zero-initialized value.
    expect(result.metrics?.reasons["empty-body"]).toBe(0);
  }, 30_000);
});
