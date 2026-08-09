/**
 * Runs provider-only reviews for local repositories without CI platform markers.
 * This module writes a standalone artifact and intentionally does not post to
 * GitHub, Azure DevOps, or any other platform.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { BRAND_PREFIX } from "../util/brand.js";
import { REVIEW_MARKER } from "../util/marker.js";
import { RequiredConfigError } from "../util/required-config.js";
import { requestLiveReview } from "./live-provider.js";
import {
  LiveReviewError,
  sanitizeForPost,
  type FetchImpl,
  type LiveProviderOutcome,
} from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

/**
 * Result shape for the standalone-mode review entry point.
 */
export type StandaloneRunResult =
  | { readonly kind: "ok"; readonly artifactPath: string; readonly review: { readonly comments: readonly unknown[]; readonly verdict: string; readonly summary: string } }
  | { readonly kind: "ok-no-diff"; readonly artifactPath: string; readonly note: string }
  | { readonly kind: "provider-error"; readonly exitCode: 1; readonly message: string; readonly sanitizedForLog: string; readonly hint?: string };

/**
 * Detect whether `env` represents standalone mode (no CI markers).
 * True when BOTH GITHUB_ACTIONS and TF_BUILD are missing or not
 * the canonical truthy values.
 */
export function isStandaloneMode(env: NodeJS.ProcessEnv): boolean {
  const isTruthy = (value: string | undefined): boolean =>
    value === "true" || value === "True" || value === "TRUE";
  return !isTruthy(env["GITHUB_ACTIONS"]) && !isTruthy(env["TF_BUILD"]);
}

/**
 * Run a standalone review: provider call only, no platform posting.
 * Writes ./umactually-review.json (or `overrideArtifactPath` if set)
 * to `cwd`. Exits via the result shape — provider failures are returned.
 */
export async function runStandalone(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl?: typeof fetch;
  readonly overrideArtifactPath?: string;
}): Promise<StandaloneRunResult> {
  if (input.parsed.diffPath === null) {
    // No diff was supplied and the auto-context derivation did not
    // find one (operator is in a non-CI shell outside a git repo with
    // uncommitted changes, OR explicitly chose to skip the derivation
    // with --no-context flag if implemented). Mirror the dry-run
    // short-circuit: write a no-posting artifact body and return
    // ok so `umactually review` in a terminal degrades gracefully
    // instead of throwing. Old behavior (throw TypeError) was a
    // wrapper-era assumption that the operator always has a diff to
    // review; in the CLI-only world the operator may just want to
    // confirm the CLI boots in their cwd.
    const artifactPath = resolve(
      input.cwd,
      input.overrideArtifactPath ?? "./umactually-review.json",
    );
    const note = "No diff content was found; provider review was skipped.";
    const body = {
      mode: "standalone",
      artifactPath,
      posted: false,
      note,
      provider: {
        name: input.parsed.provider ?? "openai-compatible",
        modelId: input.parsed.model ?? "(auto)",
        endpoint: input.parsed.apiUrl ?? "",
      },
      review: { summary: note, verdict: "COMMENT", comments: [] },
      parseWarnings: 0,
      severityWarnings: 0,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      marker: REVIEW_MARKER,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
    process.stdout.write(
      `${BRAND_PREFIX}standalone review (no diff) wrote ${artifactPath}\n` +
      `${BRAND_PREFIX}no diff was supplied or none could be auto-derived (e.g. cwd is not a git repo with uncommitted changes or no diff was supplied). The CLI wrote a no-posting artifact instead of failing; supply --event and --diff, or run inside a git repo with uncommitted changes, or commit your changes first.\n`,
    );
    return { kind: "ok", artifactPath, review: body.review };
  }

  const artifactPath = resolve(
    input.cwd,
    input.overrideArtifactPath ?? "./umactually-review.json",
  );
  const diffText = await readFile(input.parsed.diffPath, "utf8");
  const providerApiKey = input.parsed.apiKey ?? "";

  if (diffText.length === 0) {
    const note = "No diff content was found; provider review was skipped.";
    const body = {
      mode: "standalone",
      artifactPath,
      posted: false,
      note,
      provider: {
        name: input.parsed.provider ?? "openai-compatible",
        modelId: input.parsed.model ?? "(auto)",
        endpoint: input.parsed.apiUrl ?? "",
      },
      review: { summary: note, verdict: "COMMENT", comments: [] },
      parseWarnings: 0,
      severityWarnings: 0,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      marker: REVIEW_MARKER,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
    process.stdout.write(
      `${BRAND_PREFIX}standalone review (no diff) wrote ${artifactPath}\n` +
      `${BRAND_PREFIX}the supplied diff was empty; provider review was skipped. The CLI wrote a no-posting artifact instead of failing; check that --diff points to a non-empty unified diff, or run with --api-url / --api-key / --dry-run for a smoke test against the provider.\n`,
    );
    return { kind: "ok-no-diff", artifactPath, note };
  }

  let outcome: LiveProviderOutcome;
  try {
    const fetchImpl: FetchImpl =
      input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    outcome = await requestLiveReview({
      parsed: input.parsed,
      cwd: input.cwd,
      env: input.env,
      fetchImpl,
      platform: "github",
      diffText,
      platformToken: "",
    });
  } catch (error) {
    const message =
      error instanceof LiveReviewError || error instanceof Error
        ? error.message
        : String(error);
    // When the throw carries a remediation hint (e.g. the typed
    // RequiredConfigError carries the missing-env-var hint on its
    // `hint` field), propagate it so cli.ts can render the hint next
    // to the failure on the operator's terminal.
    const hint =
      error instanceof RequiredConfigError && error.hint !== undefined
        ? error.hint
        : undefined;
    return {
      kind: "provider-error",
      exitCode: 1,
      message,
      sanitizedForLog: sanitizeForPost(message, [providerApiKey]),
      ...(hint !== undefined ? { hint } : {}),
    };
  }

  const note = "Standalone review completed; no platform posting was attempted.";
  const review = {
    summary: outcome.review.summary,
    verdict: outcome.review.verdict,
    comments: outcome.review.comments,
  };
  const body = {
    mode: "standalone",
    artifactPath,
    posted: false,
    note,
    provider: {
      name: outcome.provider,
      modelId: outcome.modelId,
      endpoint: outcome.endpoint,
    },
    review,
    parseWarnings: outcome.parseWarnings.length,
    severityWarnings: outcome.severityWarnings.length,
    inlineThreadCount: outcome.review.comments.length,
    suppressedCommentCount: outcome.review.suppressedComments.length,
    marker: REVIEW_MARKER,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  process.stdout.write(`${BRAND_PREFIX}standalone review wrote ${artifactPath}\n`);
  return { kind: "ok", artifactPath, review };
}
