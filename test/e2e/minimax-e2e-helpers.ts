/**
 * Shared harness for the MiniMax e2e suite.
 *
 * Extracted from `test/e2e/minimax-e2e.test.ts` so that the test file can
 * focus on per-row assertions rather than re-implementing the harness
 * (counting fetch, body-sniffing fetch, CLI invocation, outcome mapping).
 *
 * Contract:
 *  - All `runMiniMaxReview` calls MUST set `budget` and `blockStart`. The
 *    counting fetch throws when the block exceeds its budget — this is a
 *    hard guard against accidentally re-billing the upstream gateway.
 *  - Body-sniffing captures the LAST request body sent to the matching URL
 *    prefix. Use this to assert wire-shape contracts (model name, token
 *    budget, prompt-file marker, etc.). The captured body is parsed JSON;
 *    never substring-match on raw bytes.
 *  - The `E2EOutcome` shape EXTENDS the prior mapper by carrying
 *    `verifiedFactsFilter` and `confidenceFilter` so Part B and Part C can
 *    assert filter-pipeline correctness.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { requestLiveReview } from "../../src/cli/live-provider.js";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import type { FetchImpl } from "../../src/util/http.js";
import type { ProviderComment } from "../../src/provider/provider-parse.js";
import type { ParseWarning } from "../../src/cli/parse-warnings.js";
import type { VerifiedFactsFilterResult } from "../../src/cli/verify-findings.js";
import type { ConfidenceFilterResult } from "../../src/review/filter-confidence.js";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "..", "..");

export const MINIMAX_OPENAI_URL = "https://api.minimax.io/v1";
export const MINIMAX_ANTHROPIC_URL = "https://api.minimax.io/anthropic";

export type MiniMaxProtocol = "openai" | "anthropic";

export type E2ESeverityWarning = {
  readonly rawValue: string;
  readonly providerName: string;
  readonly commentIndex: number;
};

export type E2EReview = {
  readonly summary: string;
  readonly verdict: string;
  readonly comments: readonly ProviderComment[];
  readonly suppressedComments: readonly ProviderComment[];
};

export type E2EOutcome = {
  readonly review: E2EReview;
  readonly endpoint: string;
  readonly provider: string;
  readonly modelId: string;
  readonly severityWarnings: readonly E2ESeverityWarning[];
  readonly parseWarnings: readonly ParseWarning[];
  readonly verifiedFactsFilter: VerifiedFactsFilterResult;
  readonly confidenceFilter: ConfidenceFilterResult;
};

export type CapturedProviderRequest = {
  readonly url: string;
  readonly method: string;
  readonly body: Readonly<Record<string, unknown>>;
};

export type CountingFetchOptions = {
  readonly label: string;
  readonly baseUrl: string;
  readonly budget: number;
  readonly blockStart: number;
  /** Optional: capture each request body so tests can assert wire shape. */
  readonly captureBody?: (body: string) => void;
  /** Optional: capture parsed request body as JSON for wire-shape assertions. */
  readonly captureRequest?: (request: CapturedProviderRequest) => void;
};

export function makeCountingFetch(options: CountingFetchOptions): FetchImpl {
  const { label, baseUrl, budget, blockStart, captureBody, captureRequest } = options;
  const realFetch = globalThis.fetch;
  return (async (input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(baseUrl)) {
      // Module-level counter is intentional: the e2e suite uses one shared
      // process and only one block runs at a time. blockStart subtracts
      // any prior-block consumption so per-block budgets are local.
      const realProviderCalls = (globalThis as { __e2eRealProviderCalls?: number }).__e2eRealProviderCalls ?? 0;
      const updated = realProviderCalls + 1;
      (globalThis as { __e2eRealProviderCalls?: number }).__e2eRealProviderCalls = updated;
      const used = updated - blockStart;
      if (used > budget) {
        throw new Error(
          `[e2e] ${label} exceeded provider-call budget (${budget}). ` +
            `Used ${used} of ${budget} calls; this is a suite regression.`,
        );
      }
      if (captureBody && init?.body !== undefined) {
        const bodyText = typeof init.body === "string" ? init.body : String(init.body);
        captureBody(bodyText);
      }
      if (captureRequest && init?.body !== undefined) {
        const bodyText = typeof init.body === "string" ? init.body : String(init.body);
        try {
          const parsed = JSON.parse(bodyText) as Record<string, unknown>;
          captureRequest({ url, method: init.method ?? "POST", body: parsed });
        } catch {
          // Non-JSON body — capture as empty object so callers can still
          // detect the request fired but skip wire-shape assertions.
          captureRequest({ url, method: init.method ?? "POST", body: {} });
        }
      }
    }
    return realFetch(input as never, init as never);
  }) as unknown as FetchImpl;
}

/**
 * Read the current real-provider-call count. Used by per-block assertions.
 * The counter lives on `globalThis` so it survives module re-imports under
 * vitest's isolate-helpers mode.
 */
export function getRealProviderCalls(): number {
  return (globalThis as { __e2eRealProviderCalls?: number }).__e2eRealProviderCalls ?? 0;
}

export function resetRealProviderCalls(): void {
  (globalThis as { __e2eRealProviderCalls?: number }).__e2eRealProviderCalls = 0;
}

/**
 * Family-level dispatcher harness. Runs `requestLiveReview` against an
 * explicit (provider family, API URL, optional CLI flags) combination so
 * the e2e rows can exercise any URL × provider combination.
 *
 * `cliProvider` is OPTIONAL: when omitted, no `--provider` flag is passed
 * to `parseCliArgs`, so the dispatcher's URL-substring heuristic picks the
 * protocol. This matches the production operator experience.
 *
 * `extraArgs` are appended to the baseline argument list AFTER all
 * defaults. Useful for adding `--max-output-tokens`, `--effort`, etc.
 */
export async function runMiniMaxReview(input: {
  readonly protocol: MiniMaxProtocol;
  readonly apiUrl: string;
  readonly cliProvider?: "openai-compatible" | "anthropic";
  readonly strictSchema?: boolean;
  readonly model?: string;
  readonly extraArgs?: readonly string[];
  readonly diffText?: string;
  readonly cwd?: string;
  readonly blockStart: number;
  readonly budget: number;
  readonly captureBody?: (body: string) => void;
  readonly captureRequest?: (request: CapturedProviderRequest) => void;
}): Promise<E2EOutcome> {
  const { protocol, apiUrl, blockStart, budget, captureBody, captureRequest, cliProvider } = input;
  const strictSchema = input.strictSchema ?? true;
  const model = input.model ?? "auto";
  const diffText = input.diffText;
  const cwd = input.cwd ?? REPO_ROOT;
  const extraArgs = input.extraArgs ?? [];

  const fetchImpl = makeCountingFetch({
    label: cliProvider === undefined ? `${protocol}-protocol` : `${cliProvider}-${protocol}-protocol`,
    baseUrl: apiUrl,
    budget,
    blockStart,
    ...(captureBody !== undefined ? { captureBody } : {}),
    ...(captureRequest !== undefined ? { captureRequest } : {}),
  });
  const apiKey = process.env["UMACTUALLY_E2E_MINIMAX_KEY"] ?? "";
  const parsed = parseCliArgs([
    "--platform", "github",
    "--no-dry-run",
    "--no-detect-leaks",
    "--api-url", apiUrl,
    "--model", model,
    "--effort", "low",
    "--review-timeout-seconds", "120",
    "--stall-seconds", "90",
    "--per-request-timeout-seconds", "90",
    "--review-file-limit", "0",
    ...(cliProvider !== undefined ? ["--provider", cliProvider] : []),
    ...(strictSchema ? ["--strict-schema"] : ["--no-strict-schema"]),
    ...extraArgs,
  ]);

  const outcome = await requestLiveReview({
    parsed,
    cwd,
    env: { ...process.env, UMACTUALLY_API_URL: apiUrl, UMACTUALLY_API_KEY: apiKey },
    fetchImpl,
    platform: "github",
    diffText: diffText ?? "",
    platformToken: "e2e-platform-token-not-validated-against-github",
  });

  return {
    review: {
      summary: outcome.review.summary,
      verdict: outcome.review.verdict,
      comments: outcome.review.comments as readonly ProviderComment[],
      suppressedComments: (outcome.review.suppressedComments ?? []) as readonly ProviderComment[],
    },
    endpoint: outcome.endpoint,
    provider: outcome.provider,
    modelId: outcome.modelId,
    severityWarnings: (outcome.severityWarnings ?? []).map((w) => ({
      rawValue: w.rawValue,
      providerName: w.providerName,
      commentIndex: w.commentIndex,
    })),
    parseWarnings: outcome.parseWarnings ?? [],
    verifiedFactsFilter: outcome.verifiedFactsFilter,
    confidenceFilter: outcome.confidenceFilter ?? { kept: [], downgraded: [], reasons: [] },
  };
}

/**
 * Standard sample diff used by most e2e rows. 3 anchorable lines; realistic
 * for MiniMax-M3 which typically emits 0-3 findings on it.
 */
export const SAMPLE_DIFF = [
  "diff --git a/src/example.ts b/src/example.ts",
  "index 0000000..1111111 100644",
  "--- a/src/example.ts",
  "+++ b/src/example.ts",
  "@@ -1,1 +1,3 @@",
  " export const greeting = 'hello';",
  "+// TODO: improve greeting to support i18n",
  "+export const greeting2 = (lang: string) => lang === 'en' ? 'hello' : 'hola';",
].join("\n");

/**
 * Block-budget guard: returns true if `realProviderCalls - blockStart` is
 * within `budget`. Use in `it` assertions: `expect(withinBlockBudget(...)).toBe(true)`.
 */
export function withinBlockBudget(
  blockStart: number,
  budget: number,
): boolean {
  const used = getRealProviderCalls() - blockStart;
  return used >= 0 && used <= budget;
}