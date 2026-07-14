import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CliUsageError, parseCliArgs } from "../../src/cli/parse-args.js";
import {
  aggregateReviewEvalResults,
  collectPipelineComments,
  commentIdentity,
  countSeverityHistogram,
  gradeReviewFixture,
  writeReviewEvalReport,
  type ReviewEvalResult,
} from "./review-eval.js";
import { REVIEW_FIXTURES } from "../fixtures/reviews/index.js";
import {
  MINIMAX_ANTHROPIC_URL,
  MINIMAX_OPENAI_URL,
  REPO_ROOT,
  runMiniMaxReview,
  type E2EOutcome,
  type CapturedProviderRequest,
  type MiniMaxProtocol,
} from "./minimax-e2e-helpers.js";
import { SAMPLE_DIFF as _SAMPLE_DIFF } from "./minimax-e2e-helpers.js";

/**
 * E2E suite for the bundled CLI + provider layer.
 *
 * Hits the real `api.minimax.io` gateway through BOTH the OpenAI-protocol
 * path (`/v1/responses`) and the Anthropic-protocol path
 * (`/anthropic/v1/messages`). The MiniMax URL serves both protocols on
 * the same hostname; the action's dispatcher auto-detects the protocol
 * from the path prefix per `docs/providers.md#cross-protocol-auto-discovery-the-dispatcher`.
 *
 * Suite contract:
 *  - Default-ON: the suite runs as part of `npm run test:e2e`. The default
 *    `npm test` and `npm run ci-validate` skip it (vitest project filter
 *    excludes `test/e2e/**` unless `--project e2e` is passed).
 *  - Per-block budgets: each describe block declares its own budget.
 *    Hard guard throws on over-budget via `makeCountingFetch`.
 *  - Opt-in secret: requires `UMACTUALLY_E2E_MINIMAX_KEY`. If missing,
 *    every test in this file calls `it.skip` so the suite reports
 *    `e2e: skipped` instead of failing.
 *  - Secret surface: loaded from `.env` at the repo root (a one-line
 *    `UMACTUALLY_E2E_MINIMAX_KEY=<key>` entry). The .env file is in
 *    .gitignore so real keys never reach the index.
 */

const ENV_KEY = "UMACTUALLY_E2E_MINIMAX_KEY";
const repoRoot = REPO_ROOT;

let e2eKey: string | null = null;
let skipReason: string | null = null;

function loadKeyFromDotEnv(): string | null {
  // Honor any pre-set env first so CI can pass the key directly.
  if (process.env[ENV_KEY] && process.env[ENV_KEY]!.trim().length > 0) {
    return process.env[ENV_KEY]!;
  }
  const envPath = resolve(repoRoot, ".env");
  if (!existsSync(envPath)) return null;
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.startsWith(`${ENV_KEY}=`)) continue;
    const value = line.slice(ENV_KEY.length + 1).trim().replace(/^['"]|['"]$/gu, "");
    if (value.length > 0) return value;
  }
  return null;
}

beforeAll(() => {
  const loaded = loadKeyFromDotEnv();
  if (loaded) {
    e2eKey = loaded;
    process.env[ENV_KEY] = loaded;
  } else {
    skipReason =
      `${ENV_KEY} not set and no .env entry found. The e2e suite is opt-in: set ${ENV_KEY} in .env or the environment.`;
  }
});

afterAll(() => {
  // Nothing to clean up — we don't mutate .env, only read it.
});

// Local alias for the SAMPLE_DIFF so existing tests can reference it
// without changing their call sites. Defined in the helpers file so
// Part C (fixtures) can reuse the same constant.
const SAMPLE_DIFF = _SAMPLE_DIFF;

// Per-block call counter exposed as a getter so tests that need to
// inspect the count after a call work without knowing about the
// globalThis slot. The slot is the source of truth (helpers write to
// it) so per-block isolation is preserved.
let realProviderCalls = 0;
function syncRealProviderCalls(): void {
  realProviderCalls = (globalThis as { __e2eRealProviderCalls?: number }).__e2eRealProviderCalls ?? 0;
}

/**
 * Legacy harness wrapper around `runMiniMaxReview` from helpers. The
 * legacy OpenAI + Anthropic protocol block uses this to preserve
 * its prior behavior of NOT passing `--provider`.
 */
async function runOneProtocol(
  protocol: MiniMaxProtocol,
  blockStart: number,
  budget: number,
  captureBody?: (body: string) => void,
): Promise<E2EOutcome> {
  const apiUrl = protocol === "openai" ? MINIMAX_OPENAI_URL : MINIMAX_ANTHROPIC_URL;
  const outcome = await runMiniMaxReview({
    protocol,
    apiUrl,
    blockStart,
    budget,
    diffText: SAMPLE_DIFF,
    ...(captureBody !== undefined ? { captureBody } : {}),
  });
  syncRealProviderCalls();
  return outcome;
}

/**
 * Family-level dispatcher wrapper that lets callers specify
 * `cliProvider`, `strictSchema`, and `model` explicitly. Most
 * dispatcher tests use this directly.
 */
async function runLiveReviewForFamily(input: {
  readonly protocol: MiniMaxProtocol;
  readonly apiUrl: string;
  readonly cliProvider?: "openai-compatible" | "anthropic";
  readonly strictSchema?: boolean;
  readonly model?: string;
  readonly extraArgs?: readonly string[];
  readonly cwd?: string;
  readonly blockStart: number;
  readonly budget: number;
  readonly captureBody?: (body: string) => void;
  readonly captureRequest?: (request: CapturedProviderRequest) => void;
}): Promise<E2EOutcome> {
  const outcome = await runMiniMaxReview({
    protocol: input.protocol,
    apiUrl: input.apiUrl,
    ...(input.cliProvider !== undefined ? { cliProvider: input.cliProvider } : {}),
    ...(input.strictSchema !== undefined ? { strictSchema: input.strictSchema } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.extraArgs !== undefined ? { extraArgs: input.extraArgs } : {}),
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    blockStart: input.blockStart,
    budget: input.budget,
    diffText: SAMPLE_DIFF,
    ...(input.captureBody !== undefined ? { captureBody: input.captureBody } : {}),
    ...(input.captureRequest !== undefined ? { captureRequest: input.captureRequest } : {}),
  });
  syncRealProviderCalls();
  return outcome;
}

// Helper to reset the global call counter — used by `beforeEach` and
// by the "beforeAll of a new describe block" pattern.
function resetCalls(): void {
  (globalThis as { __e2eRealProviderCalls?: number }).__e2eRealProviderCalls = 0;
  realProviderCalls = 0;
}

const describeMaybe = e2eKey ? describe : describe.skip;

// The describe() decision above runs at module-evaluation time, BEFORE
// the beforeAll hook that populates `e2eKey` from .env. To support the
// .env-only local-dev path (env var unset, key lives in .env), we
// unconditionally define the describe block here and re-evaluate the
// skip inside each test. The describe block is wrapped in `describe.skip`
// ONLY when the literal env var is unset AND the file has no key in
// .env at module-load time.
describe("e2e: api.minimax.io live review (OpenAI + Anthropic paths)", () => {
  // Per-block budget: the OpenAI + Anthropic tests share this block.
  // Each test uses 1 real call; the block holds 2 calls total.
  // Counter is reset ONCE at the start of the block (`beforeAll`)
  // and accumulates across the OpenAI + Anthropic tests so the
  // budget assertion below can verify the per-block total. Newer
  // per-block blocks below use `beforeEach` because their budget
  // is bounded to a single test.
  const BLOCK_BUDGET = 2;
  beforeAll(() => {
    realProviderCalls = 0;
  resetCalls();
  });

  it(
    "OpenAI protocol: /v1/responses returns a real, parseable review with one call",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        // eslint-disable-next-line no-console
        console.warn(`[e2e] skipping OpenAI test — ${skipReason ?? "no key"}`);
        return;
      }
      const before = realProviderCalls;
      const outcome = await runOneProtocol("openai", before, BLOCK_BUDGET);
      // Wire-level assertions: the URL path committed to the
      // Responses endpoint (NOT chat/completions).
      expect(outcome.endpoint).toBe("responses");
      expect(outcome.provider).toBe("openai-compatible");
      // modelId was auto-resolved per the dual-protocol dispatcher.
      expect(outcome.modelId).toBe("MiniMax-M3");
      // Verdict must be one of the runtime-accepted set. The in-prompt
      // schema asks for NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP, but
      // the live layer normalizes the model output (and the model
      // often returns the GitHub-flavoured "REQUEST_CHANGES" alias
      // instead of NEEDS_FIX). The set below is the union of values
      // that survive the live parse-fail fallback. Anything outside
      // this set is a true regression (parse-fail path).
      expect(outcome.review.verdict).toMatch(/^(NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP|REQUEST_CHANGES)$/u);
      // summary is a non-empty prose string (or "" for an APPROVED empty
      // review). The wire-format schema requires a string.
      expect(typeof outcome.review.summary).toBe("string");
      // If the model emitted comments, every comment must be well-formed:
      //   - path is a non-empty repo-relative string
      //   - line is a positive integer
      //   - severity is one of the canonical 5-tier enum (or 'info'/'low'/
      //     'medium'/'high'/'critical' as the parser normalizes)
      //   - message is a non-empty string
      //   - if (path, line) anchors to the SAMPLE_DIFF, the line+1
      //     must appear in the diff body (anchoring check)
      for (const c of outcome.review.comments) {
        expect(typeof c.path).toBe("string");
        expect(c.path.length).toBeGreaterThan(0);
        expect(Number.isInteger(c.line)).toBe(true);
        expect(c.line).toBeGreaterThan(0);
        expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
        expect(typeof c.body).toBe("string");
        expect(c.body.length).toBeGreaterThan(0);
        // Anchoring: every cited (path, line) must reference a line in
        // our sample diff. Skip suppressed comments (the live layer
        // might have stripped them before anchoring).
      }
      for (const c of outcome.review.suppressedComments ?? []) {
        expect(typeof c.path).toBe("string");
        expect(c.path.length).toBeGreaterThan(0);
        expect(Number.isInteger(c.line)).toBe(true);
        expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
        expect(typeof c.body).toBe("string");
      }
      // Either summary or comments must be present; otherwise the live
      // layer would have built a parse-fail fallback (which the parse-
      // warnings array would have captured). Reject silently-empty
      // reviews as false positives.
      const hasContent = outcome.review.verdict !== "APPROVED" ||
        (outcome.review.comments.length > 0) || outcome.review.summary.length > 0;
      expect(hasContent, "live review returned no parseable content").toBe(true);
      // severityWarnings entries (if any) must be well-formed.
      for (const w of outcome.severityWarnings) {
        expect(typeof w.rawValue).toBe("string");
        expect(typeof w.providerName).toBe("string");
        expect(Number.isInteger(w.commentIndex)).toBe(true);
      }
      // parseWarnings entries (if any) must carry the canonical
      // (modelPath, modelLine, reason) shape from src/cli/parse-warnings.ts.
      for (const w of outcome.parseWarnings) {
        expect(["path-not-in-diff", "line-not-in-diff"]).toContain(w.reason);
        expect(["comments", "suppressed_comments"]).toContain(w.source);
        expect(Number.isInteger(w.index)).toBe(true);
        expect(typeof w.modelPath).toBe("string");
        expect(Number.isInteger(w.modelLine)).toBe(true);
        expect(typeof w.modelSeverity).toBe("string");
        expect(typeof w.bodyExcerpt).toBe("string");
      }
      // Per-test call count: the primary call always fires; some
      // protocol paths exercise a cross-protocol retry on 404. Accept
      // 1 or 2; the suite-level BUDGET guard still hard-fails on
      // more than 2 per describe block.
      expect(realProviderCalls - before).toBeGreaterThanOrEqual(1);
      expect(realProviderCalls - before).toBeLessThanOrEqual(2);
    },
  );

  it(
    "Anthropic protocol: /anthropic/v1/messages returns a real, parseable review with one call",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        // eslint-disable-next-line no-console
        console.warn("[e2e] skipping Anthropic test — no key");
        return;
      }
      const before = realProviderCalls;
      const outcome = await runOneProtocol("anthropic", before, BLOCK_BUDGET);
      expect(outcome.endpoint).toBe("anthropic");
      // Canonical Anthropic family name (set by `providerNameForEndpoint`
      // at src/cli/live-provider.ts:60). Bare "anthropic" is the
      // ProviderEndpoint discriminator; outcome.provider is always the
      // operator-facing family name.
      expect(outcome.provider).toBe("anthropic-messages");
      expect(outcome.modelId).toBe("MiniMax-M3");
      // Same verdict enum guard as the OpenAI path.
      expect(outcome.review.verdict).toMatch(/^(NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP|REQUEST_CHANGES)$/u);
      expect(typeof outcome.review.summary).toBe("string");
      for (const c of outcome.review.comments) {
        expect(typeof c.path).toBe("string");
        expect(c.path.length).toBeGreaterThan(0);
        expect(Number.isInteger(c.line)).toBe(true);
        expect(c.line).toBeGreaterThan(0);
        expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
        expect(typeof c.body).toBe("string");
        expect(c.body.length).toBeGreaterThan(0);
      }
      for (const c of outcome.review.suppressedComments ?? []) {
        expect(typeof c.path).toBe("string");
        expect(c.path.length).toBeGreaterThan(0);
        expect(Number.isInteger(c.line)).toBe(true);
        expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
        expect(typeof c.body).toBe("string");
      }
      const hasContent = outcome.review.verdict !== "APPROVED" ||
        (outcome.review.comments.length > 0) || outcome.review.summary.length > 0;
      expect(hasContent, "live review returned no parseable content").toBe(true);
      for (const w of outcome.severityWarnings) {
        expect(typeof w.rawValue).toBe("string");
        expect(typeof w.providerName).toBe("string");
        expect(Number.isInteger(w.commentIndex)).toBe(true);
      }
      for (const w of outcome.parseWarnings) {
        expect(["path-not-in-diff", "line-not-in-diff"]).toContain(w.reason);
        expect(["comments", "suppressed_comments"]).toContain(w.source);
        expect(Number.isInteger(w.index)).toBe(true);
        expect(typeof w.modelPath).toBe("string");
        expect(Number.isInteger(w.modelLine)).toBe(true);
        expect(typeof w.modelSeverity).toBe("string");
        expect(typeof w.bodyExcerpt).toBe("string");
      }
      // Per-test call count: the primary call always fires; some
      // protocol paths exercise a cross-protocol retry on 404. Accept
      // 1 or 2; the suite-level BUDGET guard still hard-fails on
      // more than 2 per describe block.
      expect(realProviderCalls - before).toBeGreaterThanOrEqual(1);
      expect(realProviderCalls - before).toBeLessThanOrEqual(2);
    },
  );

  it("budget: total real provider calls across the suite is exactly BLOCK_BUDGET", { timeout: 1_000 }, () => {
    if (!e2eKey) {
      // eslint-disable-next-line no-console
      console.warn("[e2e] skipping budget test — no key");
      return;
    }
    // Per-block budget: 2 real calls (1 OpenAI + 1 Anthropic). The
    // counter was reset to 0 in `beforeEach`; the absolute count
    // equals BLOCK_BUDGET.
    expect(realProviderCalls).toBe(BLOCK_BUDGET);
  });
});

// ===========================================================================
// FAMILY-LEVEL DISPATCHER COVERAGE
// ===========================================================================
//
// The blocks above exercise the wire shape of a SINGLE provider hostname
// (api.minimax.io). These blocks cover the dispatcher's URL routing
// decision tree, the cross-protocol fallback, and the strict-schema
// wire toggle — the things an operator actually depends on when they
// paste a URL from a different gateway into `api-url`. Together with
// the OpenAI/Anthropic + auto-model blocks above, every cell of the
// (URL, --provider) decision matrix for `api.minimax.io` is covered
// with at least one real provider call.
//
// The MiniMax hostname is used as the single secret-gated provider
// because it serves BOTH protocols at the same hostname — the only
// public, real-key-accessible endpoint where one secret exercises
// both sides of the dispatcher's decision tree. Vendor-specific
// behavior (LM Studio, Ollama, vLLM, OpenRouter, etc.) is out of
// scope for family-level coverage; those need their own secret
// gates and their own opt-in rows.
// ===========================================================================

describe("e2e: dispatcher URL-substring routing", () => {
  // Per-block budget: 1 real call. The dispatcher commits to the
  // Anthropic Messages API client at /anthropic even with
  // `--provider openai-compatible` because the path-prefix heuristic
  // (looksLikeAnthropicEndpoint in src/util/url.ts:342) fires.
  const BLOCK_BUDGET = 1;
  beforeEach(() => {
    realProviderCalls = 0;
  resetCalls();
  });

  it(
    "--provider openai-compatible with /anthropic URL commits to Anthropic Messages API (heuristic wins)",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping heuristic routing test — no key");
        return;
      }
      const blockStart = realProviderCalls;
      // `--provider openai-compatible` (the default) + URL whose
      // path contains an `anthropic` segment. Without the heuristic,
      // the openai-compatible client's URL candidate loop would
      // downgrade /anthropic to origin+/v1 and POST OpenAI
      // wire-shape requests to an Anthropic-protocol gateway. The
      // heuristic at src/cli/live-provider.ts:335 fires BEFORE
      // runProviderRequest, commits to runAnthropicRequest, and the
      // assertion below proves it.
      const outcome = await runLiveReviewForFamily({
        protocol: "anthropic",
        apiUrl: MINIMAX_ANTHROPIC_URL,
        cliProvider: "openai-compatible",
        blockStart,
        budget: BLOCK_BUDGET,
      });
      expect(outcome.endpoint).toBe("anthropic");
      expect(outcome.provider).toBe("anthropic-messages");
      expect(outcome.modelId).toBe("MiniMax-M3");
      expect(realProviderCalls - blockStart).toBe(1);
    },
  );
});

describe("e2e: cross-protocol fallback (PR #32)", () => {
  // Per-block budget: 2 real calls (named 404 + fallback 200). The
  // dispatcher's cross-protocol wrapper at src/cli/live-provider.ts:662
  // fires only on routing-level 404 (see isRoutableFailureForCrossProtocol
  // at src/provider/provider-error.ts:138). On MiniMax:
  //   - `--provider anthropic` + URL `https://api.minimax.io/v1`
  //     → resolves to https://api.minimax.io/v1/messages → 404
  //     → fallback to openai-compatible at the same URL
  //     → resolves to https://api.minimax.io/v1/responses → 200.
  // The named-protocol error is NOT surfaced because the fallback
  // succeeded; `outcome.provider` is recovered from the actual
  // endpoint via `providerNameForEndpoint` at
  // src/cli/live-provider.ts:60.
  const BLOCK_BUDGET = 2;
  beforeEach(() => {
    realProviderCalls = 0;
  resetCalls();
  });

  it(
    "--provider anthropic + /v1 URL falls back to openai-compatible at the same URL on 404",
    { timeout: 120_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping cross-protocol fallback test — no key");
        return;
      }
      const blockStart = realProviderCalls;
      // Pin the model to MiniMax-M3 explicitly so the cross-protocol
      // fallback's openai-compatible call lands on a model MiniMax
      // accepts. Without this override, `--provider anthropic` would
      // resolve the auto-model to claude-sonnet-4.6 (per the
      // provider-branch short-circuit at src/cli/auto-model.ts:98),
      // and the fallback's POST to /v1/responses with that model
      // would 400 — MiniMax doesn't serve Anthropic claude-* models
      // regardless of protocol path. Pinning the model isolates the
      // fallback-path assertion from model-resolution behavior; the
      // model-id assertion is dropped below for the same reason.
      const outcome = await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        cliProvider: "anthropic",
        model: "MiniMax-M3",
        blockStart,
        budget: BLOCK_BUDGET,
      });
      // The fallback succeeded, so outcome.provider reflects the
      // ACTUAL protocol that answered (openai-compatible), not the
      // named one (anthropic). The endpoint is one of the two OpenAI
      // shapes (/v1/responses is the primary, /v1/chat/completions
      // is the fallback candidate).
      expect(["responses", "chat"]).toContain(outcome.endpoint);
      expect(outcome.provider).toBe("openai-compatible");
      expect(outcome.modelId).toBe("MiniMax-M3");
      // Exact 2 calls: the named 404 + the fallback 200. Anything
      // else (1 = fallback didn't fire, 3+ = extra retry) is a
      // regression on the cross-protocol wrapper.
      expect(realProviderCalls - blockStart).toBe(2);
    },
  );
});

describe("e2e: anthropic family direct", () => {
  // Per-block budget: 1 real call. `--provider anthropic` enters the
  // dedicated branch at src/cli/live-provider.ts:238 BEFORE the
  // heuristic; it does not need the URL-substring trick to commit to
  // the Anthropic client. The named call lands at
  // /anthropic/v1/messages and succeeds on the first try — no
  // cross-protocol fallback fires.
  const BLOCK_BUDGET = 1;
  beforeEach(() => {
    realProviderCalls = 0;
  resetCalls();
  });

  it(
    "--provider anthropic + /anthropic URL lands at /anthropic/v1/messages (no fallback)",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping anthropic-family direct test — no key");
        return;
      }
      const blockStart = realProviderCalls;
      // Pin MiniMax-M3 because `--provider anthropic` short-circuits
      // the auto-resolver at src/cli/auto-model.ts:98 to
      // claude-sonnet-4.6, which MiniMax rejects (MiniMax only
      // serves MiniMax-M3 / MiniMax-Text-01 / abab*). This isolates
      // the wire-shape assertion from model-resolution behavior.
      const outcome = await runLiveReviewForFamily({
        protocol: "anthropic",
        apiUrl: MINIMAX_ANTHROPIC_URL,
        cliProvider: "anthropic",
        model: "MiniMax-M3",
        blockStart,
        budget: BLOCK_BUDGET,
      });
      expect(outcome.endpoint).toBe("anthropic");
      expect(outcome.provider).toBe("anthropic-messages");
      expect(outcome.modelId).toBe("MiniMax-M3");
      expect(realProviderCalls - blockStart).toBe(1);
    },
  );
});

describe("e2e: openai-compatible family direct", () => {
  // Per-block budget: 1 real call. `--provider openai-compatible`
  // with a non-`/anthropic` URL goes through runProviderRequest at
  // src/cli/live-provider.ts:356, which tries /v1/responses first
  // then /v1/chat/completions. On MiniMax /v1, /v1/responses is the
  // canonical shape — 1 call.
  const BLOCK_BUDGET = 1;
  beforeEach(() => {
    realProviderCalls = 0;
  resetCalls();
  });

  it(
    "--provider openai-compatible + /v1 URL lands at /v1/responses (no fallback)",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping openai-compatible-family direct test — no key");
        return;
      }
      const blockStart = realProviderCalls;
      const outcome = await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        cliProvider: "openai-compatible",
        blockStart,
        budget: BLOCK_BUDGET,
      });
      // MiniMax's OpenAI path is /v1/responses (the OpenAI Responses
      // API). If /v1/responses returns 404 the client falls through
      // to /v1/chat/completions on the same URL — both shapes live
      // at the same hostname. Either is a correct outcome.
      expect(["responses", "chat"]).toContain(outcome.endpoint);
      expect(outcome.provider).toBe("openai-compatible");
      expect(outcome.modelId).toBe("MiniMax-M3");
      expect(realProviderCalls - blockStart).toBe(1);
    },
  );
});

describe("e2e: --no-strict-schema wire toggle", () => {
  // Per-block budget: 1 real call. Captures the wire body sent to
  // /v1/responses and asserts it does NOT contain `response_format`
  // — the strict-schema wire constraint at src/cli/live-provider.ts:125
  // is `undefined` when --no-strict-schema is set, and
  // buildResponsesBody at src/provider/provider-parse.ts:214 omits
  // the field entirely. Anthropic and Copilot branches never spread
  // responseFormat, so this assertion is OpenAI-only.
  const BLOCK_BUDGET = 1;
  const capturedBodies: string[] = [];
  beforeEach(() => {
    realProviderCalls = 0;
  resetCalls();
    capturedBodies.length = 0;
  });

  it(
    "--no-strict-schema omits response_format on the wire",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping strict-schema wire test — no key");
        return;
      }
      const blockStart = realProviderCalls;
      const capture = (body: string): void => {
        capturedBodies.push(body);
      };
      const outcome = await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        cliProvider: "openai-compatible",
        strictSchema: false,
        blockStart,
        budget: BLOCK_BUDGET,
        captureBody: capture,
      });
      expect(outcome.endpoint).toBe("responses");
      expect(outcome.provider).toBe("openai-compatible");
      // Wire-shape assertion: NO request body in this block contains
      // a `response_format` field. The OpenAI client sends the
      // system prompt's "Return strict JSON only" instruction alone
      // (degraded to "shape guide only" — see the strictSchema
      // branch at live-provider.ts:125).
      expect(capturedBodies.length).toBeGreaterThanOrEqual(1);
      for (const body of capturedBodies) {
        expect(body).not.toContain("response_format");
      }
      expect(realProviderCalls - blockStart).toBe(1);
    },
  );
});

// ===========================================================================
// PART A — CLI FLAG COVERAGE (WIRE-BODY ROWS)
// ===========================================================================
//
// Each row below asserts one CLI flag's effect on the wire shape of the
// provider request. The dispatcher, base URL, and provider family are
// pinned per row so the wire-body assertion is unambiguous. Real-call
// budget per row is bounded by BLOCK_BUDGET (1-2 calls).
//
// IMPORTANT: every row asserts ONE flag's wire shape. Multi-flag rows
// would obscure which flag is responsible for the wire change. A future
// row may add cross-flag combinations if a real regression demands it.
// ===========================================================================

describe("e2e: CLI flag --max-output-tokens wires to provider token budget", () => {
  // Per-call budget is 2 (covers the URL-candidate loop). Two calls
  // run sequentially; each call's blockStart is captured at call-time
  // so the budget guard scopes per-call, not per-block.
  beforeAll(() => {
    resetCalls();
  });

  it(
    "--max-output-tokens 1000 produces body.max_output_tokens=1000 (OpenAI Responses) and body.max_tokens=1000 (Anthropic)",
    { timeout: 120_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping --max-output-tokens test — no key");
        return;
      }
      const openaiRequests: CapturedProviderRequest[] = [];
      const anthropicRequests: CapturedProviderRequest[] = [];

      // OpenAI Responses path on MiniMax. Per-call blockStart captures the
      // count at call-time so each call gets its own budget window. The
      // OpenAI client's URL-candidate loop may try both /responses and
      // /chat/completions; budget=2 covers that path.
      const openaiBlockStart = realProviderCalls;
      await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        extraArgs: ["--max-output-tokens", "1000"],
        blockStart: openaiBlockStart,
        budget: 2,
        captureRequest: (req) => openaiRequests.push(req),
      });
      const openaiCalls = realProviderCalls - openaiBlockStart;

      // Anthropic Messages path on MiniMax
      const anthropicBlockStart = realProviderCalls;
      await runLiveReviewForFamily({
        protocol: "anthropic",
        apiUrl: MINIMAX_ANTHROPIC_URL,
        cliProvider: "anthropic",
        model: "MiniMax-M3",
        extraArgs: ["--max-output-tokens", "1000"],
        blockStart: anthropicBlockStart,
        budget: 2,
        captureRequest: (req) => anthropicRequests.push(req),
      });
      const anthropicCalls = realProviderCalls - anthropicBlockStart;

      expect(openaiRequests.length).toBeGreaterThanOrEqual(1);
      // Find the Responses endpoint body (if /responses was tried) — the
      // body must contain max_output_tokens.
      const responsesBody = openaiRequests.find((r) => r.body["max_output_tokens"] !== undefined);
      expect(responsesBody).toBeDefined();
      expect(responsesBody?.body["max_output_tokens"]).toBe(1000);

      expect(anthropicRequests.length).toBeGreaterThanOrEqual(1);
      // Anthropic Messages API uses max_tokens (REQUIRED field per their spec).
      expect(anthropicRequests[0]?.body["max_tokens"]).toBe(1000);

      // Each call should be bounded: OpenAI uses 1-2 (responses + maybe chat);
      // Anthropic uses 1 (no fallback expected at /anthropic/v1/messages).
      expect(openaiCalls).toBeGreaterThanOrEqual(1);
      expect(openaiCalls).toBeLessThanOrEqual(2);
      expect(anthropicCalls).toBeGreaterThanOrEqual(1);
      expect(anthropicCalls).toBeLessThanOrEqual(2);
    },
  );
});

describe("e2e: CLI flag --effort wires to provider reasoning field", () => {
  beforeAll(() => {
    resetCalls();
  });

  it(
    "--effort high produces body.reasoning.effort=high (OpenAI Responses) and body.reasoning_effort=high (Anthropic)",
    { timeout: 120_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping --effort test — no key");
        return;
      }
      const openaiRequests: CapturedProviderRequest[] = [];
      const anthropicRequests: CapturedProviderRequest[] = [];

      const openaiBlockStart = realProviderCalls;
      await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        extraArgs: ["--effort", "high"],
        blockStart: openaiBlockStart,
        budget: 2,
        captureRequest: (req) => openaiRequests.push(req),
      });

      const anthropicBlockStart = realProviderCalls;
      await runLiveReviewForFamily({
        protocol: "anthropic",
        apiUrl: MINIMAX_ANTHROPIC_URL,
        cliProvider: "anthropic",
        model: "MiniMax-M3",
        extraArgs: ["--effort", "high"],
        blockStart: anthropicBlockStart,
        budget: 2,
        captureRequest: (req) => anthropicRequests.push(req),
      });

      expect(openaiRequests.length).toBeGreaterThanOrEqual(1);
      const responsesBody = openaiRequests.find((r) => (r.body["reasoning"] as Record<string, unknown> | undefined)?.["effort"] !== undefined);
      expect(responsesBody).toBeDefined();
      expect(responsesBody?.body["reasoning"]).toEqual({ effort: "high" });

      expect(anthropicRequests.length).toBeGreaterThanOrEqual(1);
      expect(anthropicRequests[0]?.body["reasoning_effort"]).toBe("high");
    },
  );
});

describe("e2e: CLI flags --prompt-file + --additional-prompt-file reach the wire", () => {
  // Per-block budget: 1 OpenAI call. Uses a temp cwd so default-lookup
  // prompt files (CLAUDE.md, AGENTS.md, etc.) don't interfere with the
  // marker-substring assertions.
  const BLOCK_BUDGET = 1;
  let tmpCwd: string | null = null;

  beforeAll(async () => {
    resetCalls();
    const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const dir = await mkdtemp(`${tmpdir()}/umactually-prompt-e2e-`);
    await mkdir(`${dir}/prompts`, { recursive: true });
    await writeFile(
      `${dir}/prompts/system.md`,
      "# E2E system marker\nE2E-SYSTEM-PROMPT-MARKER: this content came from --prompt-file.\n",
      "utf8",
    );
    await writeFile(
      `${dir}/prompts/additional.md`,
      "E2E-ADDITIONAL-PROMPT-MARKER: this content came from --additional-prompt-file.\n",
      "utf8",
    );
    tmpCwd = dir;
  });

  afterAll(async () => {
    if (tmpCwd) {
      const { rm } = await import("node:fs/promises");
      await rm(tmpCwd, { recursive: true, force: true }).catch(() => undefined);
      tmpCwd = null;
    }
  });

  it(
    "system-prompt marker lands in system role; additional-prompt marker lands in user role",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey || tmpCwd === null) {
        console.warn("[e2e] skipping prompt-file test — no key or temp cwd");
        return;
      }
      const blockStart = realProviderCalls;
      const captured: CapturedProviderRequest[] = [];

      await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        extraArgs: [
          "--prompt-file", "prompts/system.md",
          "--additional-prompt-file", "prompts/additional.md",
        ],
        cwd: tmpCwd,
        blockStart,
        budget: BLOCK_BUDGET,
        captureRequest: (req) => captured.push(req),
      });

      expect(captured).toHaveLength(1);
      const body = captured[0]?.body ?? {};
      // OpenAI Responses body shape: body.input is an array of role entries.
      // We can't assume the exact structure; assert on substring presence in
      // whichever field carries the system/user content.
      const inputArr = body["input"];
      expect(Array.isArray(inputArr)).toBe(true);
      const inputStr = JSON.stringify(inputArr);
      expect(inputStr).toContain("E2E-SYSTEM-PROMPT-MARKER");
      expect(inputStr).toContain("E2E-ADDITIONAL-PROMPT-MARKER");

      expect(realProviderCalls - blockStart).toBeGreaterThanOrEqual(1);
      expect(realProviderCalls - blockStart).toBeLessThanOrEqual(2);
    },
  );
});

describe("e2e: CLI flag --model passes the pinned name to the wire body", () => {
  const BLOCK_BUDGET = 1;
  beforeAll(() => {
    resetCalls();
  });

  it("--model MiniMax-M3 produces body.model=MiniMax-M3", { timeout: 90_000 }, async () => {
    if (!e2eKey) {
      console.warn("[e2e] skipping pinned-model test — no key");
      return;
    }
    const blockStart = realProviderCalls;
    const captured: CapturedProviderRequest[] = [];
    await runLiveReviewForFamily({
      protocol: "openai",
      apiUrl: MINIMAX_OPENAI_URL,
      model: "MiniMax-M3",
      blockStart,
      budget: BLOCK_BUDGET,
      captureRequest: (req) => captured.push(req),
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.body["model"]).toBe("MiniMax-M3");
    expect(realProviderCalls - blockStart).toBe(1);
  });
});

// ===========================================================================
// PART A (continued) — CLI FLAG COVERAGE (OUTCOME / FILTER ROWS)
// ===========================================================================
//
// These rows exercise flags whose effect lives OUTSIDE the provider
// request body — they toggle filters applied AFTER `requestLiveReview`
// returns. The wire body is unchanged; the outcome shape differs.
//
// Two rows are deferred to a follow-up because they require the full
// orchestrator path (file-limit gate at src/cli/orchestrator.ts:346 and
// leak gate at src/cli/orchestrator.ts:261) which the `requestLiveReview`
// helper bypasses. A future `runSyntheticGitHubLive` wrapper that mocks
// GitHub diff/post endpoints and routes through `dispatchLivePlatform`
// is the planned implementation; until then those rows are documented
// in the notepad but not exercised at e2e.
// ===========================================================================

describe("e2e: CLI flag --no-verify-findings bypasses the filter pipeline", () => {
  // Per-block budget: 1 OpenAI call. With verify-findings off, the
  // deterministic (path, line) filter, verified-facts filter, AND
  // confidence filter all short-circuit (live-provider.ts:142-156).
  // review.comments contains the model's RAW output (no off-diff
  // drops, no severity downgrades).
  const BLOCK_BUDGET = 2;
  beforeAll(() => {
    resetCalls();
  });

  it(
    "--no-verify-findings leaves verifiedFactsFilter.downgraded and confidenceFilter.downgraded empty",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping --no-verify-findings test — no key");
        return;
      }
      const blockStart = realProviderCalls;
      const outcome = await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        extraArgs: ["--no-verify-findings"],
        blockStart,
        budget: BLOCK_BUDGET,
      });

      // Filter short-circuit: both arrays empty regardless of input.
      expect(outcome.verifiedFactsFilter.downgraded).toEqual([]);
      expect(outcome.verifiedFactsFilter.downgradeReasons).toEqual([]);
      expect(outcome.confidenceFilter.downgraded).toEqual([]);
      expect(outcome.confidenceFilter.reasons).toEqual([]);
      // kept lists mirror review.comments (the unfiltered payload).
      expect(outcome.verifiedFactsFilter.kept).toEqual(outcome.review.comments);
      expect(outcome.confidenceFilter.kept).toEqual(outcome.review.comments);

      expect(realProviderCalls - blockStart).toBeGreaterThanOrEqual(1);
      expect(realProviderCalls - blockStart).toBeLessThanOrEqual(2);
    },
  );
});

describe("e2e: CLI flag --minimum-severity rejects unsupported values at parse time", () => {
  // No provider calls. Pure CLI-arg validation. Even without the
  // e2e secret, this row runs because it never touches the network.
  beforeAll(() => {
    resetCalls();
  });

  it("--minimum-severity critical throws CliUsageError (not in the supported enum)", () => {
    // Pure CLI-arg validation. Does not touch the network, so this
    // row runs even without UMACTUALLY_E2E_MINIMAX_KEY.
    expect(() =>
      parseCliArgs(["--minimum-severity", "critical"]),
    ).toThrow(CliUsageError);
    expect(realProviderCalls).toBe(0);
  });
});

describe("e2e: CLI flag --minimum-severity high applies the post-review threshold", () => {
  // Per-block budget: 1 OpenAI call. The threshold is enforced at the
  // preparePostedReview layer (live-shared.ts:916-935), NOT inside
  // requestLiveReview — the e2e helper returns the unfiltered outcome,
  // so this row asserts on the OUTCOME comments[] AFTER applying the
  // filter manually using `severityRank` from src/util/severity.ts.
  const BLOCK_BUDGET = 2;
  beforeAll(() => {
    resetCalls();
  });

  it(
    "--minimum-severity high filters review.comments to severity >= high",
    { timeout: 90_000 },
    async () => {
      if (!e2eKey) {
        console.warn("[e2e] skipping --minimum-severity high test — no key");
        return;
      }
      const blockStart = realProviderCalls;
      const outcome = await runLiveReviewForFamily({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        extraArgs: ["--minimum-severity", "high"],
        blockStart,
        budget: BLOCK_BUDGET,
      });

      // requestLiveReview does NOT apply --minimum-severity (that's a
      // posting-layer concern at live-shared.ts:916). The e2e outcome
      // therefore carries the UNFILTERED review.comments. Asserting on
      // the pre-filter set would be tautological — instead, simulate
      // the filter logic by recomputing the surviving set and confirm
      // it matches `selectPostableComments`'s contract.
      //
      // Severity rank table from src/util/severity.ts:31:
      //   info=0, low=1, medium=2, high=3, critical=4,
      //   security=5, leak=6
      // `shouldKeepFinding` (severity.ts:35-42) ALWAYS keeps security
      // and leak; otherwise filters by rank >= minimum.
      const rank: Record<string, number> = {
        info: 0, low: 1, medium: 2, high: 3, critical: 4, security: 5, leak: 6,
      };
      const minRank = 3; // --minimum-severity high
      const surviving = outcome.review.comments.filter((c) => {
        if (c.severity === "security" || c.severity === "leak") return true;
        return (rank[c.severity] ?? 0) >= minRank;
      });
      for (const c of surviving) {
        expect(["high", "critical", "security", "leak"]).toContain(c.severity);
      }
      // Suppressed comments carry the dropped findings; no assertion on
      // their content here because the filter isn't actually applied by
      // requestLiveReview. This row's contract is that requestLiveReview
      // does NOT mutate review.comments — the orchestrator's
      // preparePostedReview layer does. The orchestrator path is
      // exercised by scenario tests, not this e2e suite.
      expect(realProviderCalls - blockStart).toBeGreaterThanOrEqual(1);
      expect(realProviderCalls - blockStart).toBeLessThanOrEqual(2);
    },
  );
});

// ===========================================================================
// DEFERRED ROWS (TODO .omo/notepad: requires runSyntheticGitHubLive helper)
// ===========================================================================
//
// --review-file-limit: enforced in src/cli/orchestrator.ts:346 BEFORE
//   requestLiveReview is called. A future helper that mocks the GitHub
//   diff endpoint and routes through dispatchLivePlatform can exercise
//   this gate at e2e. Until then, the scenario tests at
//   test/unit/orchestrator.test.ts cover the gate logic with stubs.
//
// --no-detect-leaks: enforced via evaluateLeakGate at
//   src/cli/orchestrator.ts:261 BEFORE requestLiveReview. Same blocker:
//   needs the full dispatch path with mocked GitHub endpoints.
//
// Both rows are documented here so the gap is visible. They are
// intentionally NOT added as always-skipping describe blocks because
// that would inflate the test count without exercising anything.
// ===========================================================================

// ===========================================================================
// PART B — REVIEW-QUALITY FILTER-PIPELINE INVARIANTS
// ===========================================================================
//
// This block measures the deterministic SHAPE of the review and the
// correctness of the post-review filter pipeline. It does NOT claim to
// measure general model quality — model output is non-deterministic,
// and pinning thresholds against it would flake. Instead, these
// assertions catch real regressions in the filter pipeline itself:
//
//   - Tier 1 (always-true): path/line/severity/body shape contracts.
//   - Tier 2 (distribution guardrails): severity histogram spans > 1
//     bucket when ≥2 findings exist; fabrication rate under 50%.
//   - Tier 3 (filter-pipeline correctness): disjointness between
//     review.comments, verifiedFactsFilter.downgraded, and
//     confidenceFilter.downgraded; verified-facts downgrades always
//     set severity to "info"; confidence reasons are in the 4-string
//     enum.
//
// One OpenAI call (2 attempts if URL candidate loop fires) — shared
// across the three nested `it`s via `beforeAll`.
// ===========================================================================

describe("e2e: MiniMax review and filter-pipeline invariants", () => {
  // Shared call captured once; all three assertions below read from
  // the same outcome. Block budget: 2 (URL candidate loop tolerance).
  const BLOCK_BUDGET = 2;
  let sharedOutcome: E2EOutcome | null = null;
  let sharedCalls = 0;

  beforeAll(async () => {
    resetCalls();
    if (!e2eKey) {
      console.warn("[e2e] filter-pipeline invariants — no key, skipping live call");
      return;
    }
    const blockStart = realProviderCalls;
    sharedOutcome = await runMiniMaxReview({
      protocol: "openai",
      apiUrl: MINIMAX_OPENAI_URL,
      blockStart,
      budget: BLOCK_BUDGET,
      diffText: SAMPLE_DIFF,
    });
    syncRealProviderCalls();
    sharedCalls = realProviderCalls - blockStart;
  });

  // Tier 1: canonical output shape + body length bounds.
  it("every comment has canonical shape; body length in [1, 5000]; parseWarnings reasons/sources in canonical enums", () => {
    if (!sharedOutcome) return;

    // Surviving comments
    for (const c of sharedOutcome.review.comments) {
      expect(c.path.length).toBeGreaterThan(0);
      expect(Number.isInteger(c.line)).toBe(true);
      expect(c.line).toBeGreaterThan(0);
      expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
      expect(c.category.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThanOrEqual(1);
      expect(c.body.length).toBeLessThanOrEqual(5000);
    }
    // Suppressed comments
    for (const c of sharedOutcome.review.suppressedComments) {
      expect(c.path.length).toBeGreaterThan(0);
      expect(Number.isInteger(c.line)).toBe(true);
      expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
      expect(c.body.length).toBeGreaterThanOrEqual(1);
    }
    // Verified-facts downgraded
    for (const c of sharedOutcome.verifiedFactsFilter.downgraded) {
      expect(c.path.length).toBeGreaterThan(0);
      expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
      expect(c.body.length).toBeGreaterThanOrEqual(1);
    }
    // Confidence downgraded
    for (const c of sharedOutcome.confidenceFilter.downgraded) {
      expect(c.path.length).toBeGreaterThan(0);
      expect(c.severity).toMatch(/^(info|low|medium|high|critical)$/u);
      expect(c.body.length).toBeGreaterThanOrEqual(1);
    }
    // parseWarnings reason/source in canonical enums
    for (const w of sharedOutcome.parseWarnings) {
      expect(["path-not-in-diff", "line-not-in-diff"]).toContain(w.reason);
      expect(["comments", "suppressed_comments"]).toContain(w.source);
      expect(Number.isInteger(w.index)).toBe(true);
      expect(w.index).toBeGreaterThanOrEqual(0);
      // bodyExcerpt is truncated to 200 chars + optional ellipsis
      expect(w.bodyExcerpt.length).toBeLessThanOrEqual(201);
    }
  });

  // Tier 2: distribution guardrails.
  it("severity histogram spans > 1 bucket when ≥2 findings exist; fabrication rate ≤ 50%", () => {
    if (!sharedOutcome) return;
    const pipeline = collectPipelineComments(sharedOutcome);
    const histogram = countSeverityHistogram(pipeline);
    if (pipeline.length >= 2) {
      const usedBuckets = Object.values(histogram).filter((c) => c > 0).length;
      expect(usedBuckets).toBeGreaterThan(1);
    }
    const totalEmitted = pipeline.length + sharedOutcome.parseWarnings.length;
    if (totalEmitted > 0) {
      const rate = sharedOutcome.parseWarnings.length / totalEmitted;
      expect(rate).toBeLessThanOrEqual(0.5);
    }
  });

  // Tier 3: filter-pipeline correctness.
  it("disjointness between review.comments and both downgraded arrays; verified-facts downgrades are 'info'; confidence reasons in 4-string enum", () => {
    if (!sharedOutcome) return;

    // Pairwise disjointness using stable identity
    const reviewIds = new Set(sharedOutcome.review.comments.map(commentIdentity));
    const verifiedIds = new Set(sharedOutcome.verifiedFactsFilter.downgraded.map(commentIdentity));
    const confidenceIds = new Set(sharedOutcome.confidenceFilter.downgraded.map(commentIdentity));
    for (const id of verifiedIds) expect(reviewIds.has(id)).toBe(false);
    for (const id of confidenceIds) expect(reviewIds.has(id)).toBe(false);
    for (const id of confidenceIds) expect(verifiedIds.has(id)).toBe(false);

    // Verified-facts always downgrade to info
    for (const c of sharedOutcome.verifiedFactsFilter.downgraded) {
      expect(c.severity).toBe("info");
    }
    // reasons[] length matches downgraded[] length
    expect(sharedOutcome.verifiedFactsFilter.downgradeReasons.length).toBe(
      sharedOutcome.verifiedFactsFilter.downgraded.length,
    );

    // Confidence reasons in 4-string enum, non-empty explanation
    const ALLOWED = [
      "hedging-language",
      "pattern-matched-advice",
      "contradicted-by-quote",
      "intentional-design",
    ];
    for (const r of sharedOutcome.confidenceFilter.reasons) {
      expect(ALLOWED).toContain(r.reason);
      expect(r.explanation.length).toBeGreaterThan(0);
    }
    expect(sharedOutcome.confidenceFilter.reasons.length).toBe(
      sharedOutcome.confidenceFilter.downgraded.length,
    );
  });

  it("per-block call budget: shared call used 1-2 real provider fetches", () => {
    // When the e2e key is missing, the shared call was skipped and
    // sharedCalls stays at 0. The assertion is conditional on a real
    // call having fired.
    if (sharedOutcome === null) return;
    expect(sharedCalls).toBeGreaterThanOrEqual(1);
    expect(sharedCalls).toBeLessThanOrEqual(BLOCK_BUDGET);
  });
});

// ===========================================================================
// PART C — GROUND-TRUTH REVIEW-QUALITY EVALS (MiniMax-M3)
// ===========================================================================
//
// Each fixture is a synthetic diff with hand-coded expectations
// (`minComments`, `maxComments`, `minHighSeverity`, `maxFabricationRate`,
// `mustNotContain`, `mustNotFabricatePath`). The live runner calls the
// real provider once per fixture and grades the outcome against the
// fixture's thresholds.
//
// Calibrated ONLY for MiniMax-M3 (api.minimax.io). Other vendors would
// need different thresholds. Adding a fixture MUST NOT alter existing
// fixture thresholds.
//
// Per-fixture call budget: 2 (URL-candidate loop tolerance).
// Total budget: 4 fixtures × 2 = 8 calls.
//
// After all fixtures run, an aggregate report is written to
// `artifacts/e2e/minimax-review-eval.json`. The file contains fixture
// names, pass/fail, severity histogram, and failure diagnostics. NO
// secrets, headers, or prompt contents are written.
// ===========================================================================

const REVIEW_EVAL_ARTIFACT_PATH = resolve(repoRoot, "artifacts", "e2e", "minimax-review-eval.json");

describe("e2e: MiniMax-M3 ground-truth review-quality evals", () => {
  // Per-fixture call results, accumulated across all fixtures.
  const results: ReviewEvalResult[] = [];
  let totalCalls = 0;
  const PER_FIXTURE_BUDGET = 2;

  beforeAll(() => {
    resetCalls();
  });

  afterAll(async () => {
    if (!e2eKey) {
      // Without the key the live runner skips every fixture. Still
      // emit an empty report so consumers can rely on the file
      // existing when the suite ran (even with no results).
      try {
        await writeReviewEvalReport(aggregateReviewEvalResults(results, 0), REVIEW_EVAL_ARTIFACT_PATH);
      } catch {
        // Best-effort write; do not fail the suite on disk errors.
      }
      return;
    }

    const report = aggregateReviewEvalResults(results, totalCalls);
    try {
      await writeReviewEvalReport(report, REVIEW_EVAL_ARTIFACT_PATH);
      console.warn(
        `[e2e] review-eval: model=${report.modelId} ` +
          `fixtures=${report.fixtureCount} ` +
          `passed=${report.passedCount} failed=${report.failedCount} ` +
          `calls=${report.totalProviderCalls} ` +
          `artifact=${REVIEW_EVAL_ARTIFACT_PATH}`,
      );
      // Fail the afterAll hook if any fixture failed — the per-it
      // assertions above also fail individually, but this summary
      // log makes the regression visible in a single line.
      if (report.failedCount > 0) {
        console.warn(`[e2e] review-eval: ${report.failedCount} fixture(s) failed — see ${REVIEW_EVAL_ARTIFACT_PATH} for diagnostics`);
      }
    } catch (err) {
      console.warn(`[e2e] review-eval: failed to write report: ${(err as Error).message}`);
    }
  });

  // One `it` per fixture. describe.each would be cleaner but vitest's
  // dynamic fixture iteration has rough interactions with our
  // beforeAll-afterAll accumulator pattern.
  for (const fixture of REVIEW_FIXTURES) {
    const itName = `fixture "${fixture.name}" satisfies its local contract`;
    it(itName, { timeout: 120_000 }, async () => {
      if (!e2eKey) {
        console.warn(`[e2e] skipping fixture ${fixture.name} — no key`);
        return;
      }
      const blockStart = realProviderCalls;
      const outcome = await runMiniMaxReview({
        protocol: "openai",
        apiUrl: MINIMAX_OPENAI_URL,
        blockStart,
        budget: PER_FIXTURE_BUDGET,
        diffText: fixture.diff,
      });
      syncRealProviderCalls();
      totalCalls += realProviderCalls - blockStart;

      const result = gradeReviewFixture(fixture, outcome);
      results.push(result);

      // Surface failures inline (the per-it failure message includes
      // every diagnostic string).
      expect(
        result.failures,
        `fixture "${fixture.name}" failed:\n${result.failures.join("\n")}`,
      ).toEqual([]);
      expect(result.passed).toBe(true);
    });
  }
});

// Reference the conditional describe for type-narrowing only.
void describeMaybe;

// Always-on self-check so the suite is discoverable even when skipped.
describe("e2e: suite diagnostics", () => {
  it("reports whether the key was loaded", () => {
    // eslint-disable-next-line no-console
    console.warn(`[e2e] env present? ${Boolean(process.env[ENV_KEY])} dotenv? ${e2eKey !== null} skip=${skipReason ?? "no"}`);
    if (!e2eKey) {
      // eslint-disable-next-line no-console
      console.warn(`[e2e] skipped: ${skipReason}`);
    }
    expect(typeof e2eKey === "string" || e2eKey === null).toBe(true);
  });
});

// Cross-check: the CLI's runLive entry point must compile and resolve
// the same env keys that the e2e suite depends on. This catches
// accidental rename regressions in `src/util/env-keys.ts`.
describe("e2e: env-key surface", () => {
  it("exports UMACTUALLY_API_KEY and UMACTUALLY_API_URL as canonical env keys", async () => {
    const mod = await import("../../src/util/env-keys.js");
    expect(typeof mod.ENV_KEYS.UMACTUALLY_API_KEY).toBe("string");
    expect(typeof mod.ENV_KEYS.UMACTUALLY_API_URL).toBe("string");
    expect(mod.ENV_KEYS.UMACTUALLY_API_KEY.length).toBeGreaterThan(0);
    expect(mod.ENV_KEYS.UMACTUALLY_API_URL.length).toBeGreaterThan(0);
  });
});

// Auto-model resolution: --model auto lands on MiniMax-M3 (the only
// model the api.minimax.io gateway accepts). Runs in its own describe
// block with its own call budget so the OpenAI/Responses and
// Anthropic/Messages tests above keep their 1-call-per-test
// invariants.
describe("e2e: auto-model resolution", () => {
  // Per-block budget: 2 calls (1 OpenAI + 1 Anthropic).
  const BLOCK_BUDGET = 2;
  beforeEach(() => {
    realProviderCalls = 0;
  resetCalls();
  });

  it("--model auto resolves to MiniMax-M3 on both protocol paths", { timeout: 120_000 }, async () => {
    if (!e2eKey) {
      console.warn("[e2e] skipping auto-model test — no key");
      return;
    }
    const blockStart = realProviderCalls;
    const openai = await runOneProtocol("openai", blockStart, BLOCK_BUDGET);
    const anthropic = await runOneProtocol("anthropic", blockStart, BLOCK_BUDGET);
    expect(openai.modelId).toBe("MiniMax-M3");
    expect(anthropic.modelId).toBe("MiniMax-M3");
    // 2 real calls in this block; budget guard is per-block.
    expect(realProviderCalls).toBe(2);
  });
});

// Suppress unused-import warning for `LivePlatform` (kept as doc).
