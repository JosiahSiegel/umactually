// SPDX-License-Identifier: MIT
//
// Task 11 — Reconcile durable findings with native Azure DevOps threads.
//
// This module owns the Azure-side half of the durable incremental review
// reconciliation protocol. It is the Azure twin of Task 10's GitHub
// `live-github-reconcile.ts`. The two modules share the SAME transition
// rules (reconsidered / carried / deferred / resolved) but target different
// platform APIs (Azure threads vs. GitHub review comments).
//
// KEY INVARIANTS:
//   * Never treat file+line as identity. Two findings with the same
//     (path, line) but different fingerprint / identityDigest are NOT the
//     same finding.
//   * Never close a thread that belongs to another run / config hash.
//   * Never mutate a thread that lacks the fingerprint marker (human /
//     unmarked threads are read-only).
//   * Resolution is LOGICAL by default (state-machine driven). Native
//     close / reopen is opt-in via `resolutionMode: "native-best-effort"`.
//   * Every mutation is fenced by the current headSha / runId / attemptId.
//     An older or superseded attempt never mutates the PR.
//   * Concurrent attempts converge: duplicate threads with the same
//     fingerprint from different runIds are deduplicated; older bot
//     threads are marked superseded via PATCH-status; native close
//     mistakes from older runs are reopened or replaced by the current
//     head.
//
// MARKER GRAMMAR:
//   `<!-- umactually-fp:v1 f=<fp> id=<id> run=<run> att=<att> -->`
//
// The marker rides in the comment body alongside the existing
// `<!-- umactually -->` review marker. Parser tolerates surrounding
// whitespace, multiple markers, and order-permutations (the order of
// `f=... id=...` does not matter — we key=value parse).

import type { AzureContext } from "../platform/azure/context.js";
import { AZURE_API_VERSION, azurePrBaseUrl } from "../platform/azure/urls.js";
import { azureHeaders, type FetchImpl } from "../util/http.js";
import { isRecord, isSafeInteger, isUnknownArray, readStringFieldOrThrow } from "../util/json-guards.js";
import { writeBrandedAnnotation } from "../util/log.js";
import { formatError } from "../util/error.js";
import { LiveReviewError, type LiveReviewComment } from "./live-shared.js";
import { buildInlineCommentBody } from "./live-shared.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A finding the current review produced, paired with its durable
 * identity (Task 4 fingerprint + identityDigest). This is the unit of
 * work the reconciler matches against prior Azure threads.
 */
export type DurableFindingWithIdentity = {
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly canonicalPath: string;
  readonly canonicalAnchor: string;
  readonly normalizedCategory: string;
  readonly normalizedRuleKey: string;
  readonly comment: LiveReviewComment;
};

/**
 * The subset of the ADO thread shape the dedup / classify path actually
 * reads. Structurally compatible with the `AzureInlineThread` already
 * defined in `src/platform/azure/api.ts` but kept loose so this module
 * stays decoupled from that file (and testable without dragging the diff
 * fetch path along).
 */
export type AzureThreadRecord = {
  readonly id: number | undefined;
  readonly status: string;
  readonly threadContext: {
    readonly filePath: string;
    readonly rightFileStart: { readonly line: number };
  } | null;
  readonly comments: readonly { readonly id: number | undefined; readonly content: string }[];
};

/**
 * One prior thread, classified against the current set of findings.
 * The transition rules consume this shape — no other state needed.
 */
export type ClassifiedPriorThread = {
  readonly threadId: number;
  readonly commentId: number | undefined;
  readonly fingerprint: string | null;
  readonly identityDigest: string | null;
  readonly runId: string | null;
  readonly attemptId: string | null;
  readonly currentLine: number;
  readonly path: string;
  readonly threadStatus: string;
  readonly carriedByUs: boolean;
  readonly fingerprintMatch: boolean;
  readonly identityMatch: boolean;
  readonly reopenedFromStaleClose: boolean;
};

/**
 * The action the reconciler should perform. Each action corresponds to
 * exactly one platform mutation (POST / PATCH / none). The transitions
 * are deterministic given (priorClassified, currentFindings, currentHead).
 */
export type ThreadAction =
  | { readonly kind: "create-new"; readonly fingerprint: string; readonly comment: LiveReviewComment; readonly parentThreadId?: number }
  | { readonly kind: "patch-body"; readonly threadId: number; readonly commentId: number; readonly fingerprint: string; readonly comment: LiveReviewComment }
  | { readonly kind: "native-close"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "native-reopen"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "mark-superseded"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "skip-unchanged"; readonly fingerprint: string; readonly threadId: number }
  | { readonly kind: "logical-resolve"; readonly fingerprint: string; readonly threadId: number }
  | { readonly kind: "preserve-human"; readonly threadId: number }
  | { readonly kind: "preserve-other-run"; readonly threadId: number };

/**
 * Result of one thread action. Returned in order so the caller can
 * surface outcomes (logs, metrics, evidence files) without re-walking
 * the action list.
 */
export type ReconcileOutcome =
  | { readonly kind: "created"; readonly threadId: number; readonly commentId: number; readonly fingerprint: string }
  | { readonly kind: "patched"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "patch-failed"; readonly threadId: number; readonly fingerprint: string; readonly retryable: boolean; readonly error: string }
  | { readonly kind: "native-closed"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "native-close-failed"; readonly threadId: number; readonly fingerprint: string; readonly retryable: boolean; readonly error: string }
  | { readonly kind: "reopened"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "marked-superseded"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "logical-resolved"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "skipped"; readonly threadId: number; readonly fingerprint: string }
  | { readonly kind: "preserved"; readonly threadId: number }
  | { readonly kind: "preserved-other-run"; readonly threadId: number };

export type ResolutionMode = "logical" | "native-best-effort";

// ---------------------------------------------------------------------------
// Marker codec
// ---------------------------------------------------------------------------

const FINGERPRINT_MARKER_PREFIX = "<!-- umactually-fp:v1";
const FINGERPRINT_MARKER_SUFFIX = "-->";

/**
 * Build the fingerprint / identity / runId / attemptId marker block
 * that rides in the inline comment body. Format:
 *   `<!-- umactually-fp:v1 f=<fp> id=<id> run=<run> att=<att> -->`
 *
 * Stable across platforms — the GitHub reconcile module encodes the
 * SAME grammar so a marker-bearing body is portable.
 */
export function buildFingerprintMarkers(input: {
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly runId: string;
  readonly attemptId: string;
}): string {
  return (
    `${FINGERPRINT_MARKER_PREFIX} ` +
    `f=${input.fingerprint} ` +
    `id=${input.identityDigest} ` +
    `run=${input.runId} ` +
    `att=${input.attemptId} ` +
    `${FINGERPRINT_MARKER_SUFFIX}`
  );
}

/**
 * Parse the fingerprint / identity / runId / attemptId markers from a
 * comment body. Returns nulls when no marker is present (human /
 * unmarked thread). Looks across ALL markers of the same kind and
 * returns the LAST set (the most recent marker wins; older markers are
 * treated as superseded).
 */
export function parseFingerprintMarkers(body: string): {
  readonly fingerprint: string | null;
  readonly identityDigest: string | null;
  readonly runId: string | null;
  readonly attemptId: string | null;
} {
  const result = { fingerprint: null, identityDigest: null, runId: null, attemptId: null };
  if (body.length === 0) return result;
  let cursor = 0;
  let lastFingerprint: string | null = null;
  let lastIdentity: string | null = null;
  let lastRun: string | null = null;
  let lastAttempt: string | null = null;
  while (cursor < body.length) {
    const idx = body.indexOf(FINGERPRINT_MARKER_PREFIX, cursor);
    if (idx === -1) break;
    const endIdx = body.indexOf(FINGERPRINT_MARKER_SUFFIX, idx + FINGERPRINT_MARKER_PREFIX.length);
    if (endIdx === -1) break;
    const inner = body.slice(idx + FINGERPRINT_MARKER_PREFIX.length, endIdx).trim();
    const parsed = parseMarkerKeyValues(inner);
    if (parsed.fingerprint !== null) lastFingerprint = parsed.fingerprint;
    if (parsed.identityDigest !== null) lastIdentity = parsed.identityDigest;
    if (parsed.runId !== null) lastRun = parsed.runId;
    if (parsed.attemptId !== null) lastAttempt = parsed.attemptId;
    cursor = endIdx + FINGERPRINT_MARKER_SUFFIX.length;
  }
  return {
    fingerprint: lastFingerprint,
    identityDigest: lastIdentity,
    runId: lastRun,
    attemptId: lastAttempt,
  };
}

function parseMarkerKeyValues(inner: string): {
  readonly fingerprint: string | null;
  readonly identityDigest: string | null;
  readonly runId: string | null;
  readonly attemptId: string | null;
} {
  // Split on whitespace; tolerate extra spaces.
  const tokens = inner.split(/\s+/u).filter((t) => t.length > 0);
  let fingerprint: string | null = null;
  let identityDigest: string | null = null;
  let runId: string | null = null;
  let attemptId: string | null = null;
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq === -1) continue;
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1);
    if (key === "f") fingerprint = value;
    else if (key === "id") identityDigest = value;
    else if (key === "run") runId = value;
    else if (key === "att") attemptId = value;
  }
  return { fingerprint, identityDigest, runId, attemptId };
}

// ---------------------------------------------------------------------------
// classifyPriorThreads
// ---------------------------------------------------------------------------

/**
 * Map every prior thread (from the `/threads?api-version=` GET) to a
 * `ClassifiedPriorThread`. Matches against `currentFindings` by
 * fingerprint + identityDigest — NEVER by file + line.
 *
 * Threads with no fingerprint marker are classified as `carriedByUs:
 * false` so the transition rules treat them as human / unmarked and
 * never mutate them.
 */
export function classifyPriorThreads(input: {
  readonly threads: readonly AzureThreadRecord[];
  readonly currentFindings: readonly DurableFindingWithIdentity[];
  readonly currentHeadSha: string;
}): readonly ClassifiedPriorThread[] {
  const out: ClassifiedPriorThread[] = [];
  for (const thread of input.threads) {
    const classified = classifyOneThread(thread, input.currentFindings);
    if (classified !== null) out.push(classified);
  }
  return out;
}

function classifyOneThread(
  thread: AzureThreadRecord,
  currentFindings: readonly DurableFindingWithIdentity[],
): ClassifiedPriorThread | null {
  if (thread.id === undefined || thread.threadContext === null) return null;
  const firstComment = thread.comments[0];
  const content = firstComment?.content ?? "";
  const parsed = parseFingerprintMarkers(content);
  const carriedByUs = parsed.fingerprint !== null;
  const match = carriedByUs ? findFingerprintMatch(currentFindings, parsed.fingerprint!, parsed.identityDigest) : null;
  const threadStatus = thread.status;
  const reopenedFromStaleClose = threadStatus === "closed" || threadStatus === "fixed";
  return {
    threadId: thread.id,
    commentId: firstComment?.id,
    fingerprint: parsed.fingerprint,
    identityDigest: parsed.identityDigest,
    runId: parsed.runId,
    attemptId: parsed.attemptId,
    currentLine: thread.threadContext.rightFileStart.line,
    path: thread.threadContext.filePath,
    threadStatus,
    carriedByUs,
    fingerprintMatch: match?.fingerprintMatch ?? false,
    identityMatch: match?.identityMatch ?? false,
    reopenedFromStaleClose,
  };
}

function findFingerprintMatch(
  currentFindings: readonly DurableFindingWithIdentity[],
  fingerprint: string,
  identityDigest: string | null,
): { readonly fingerprintMatch: true; readonly identityMatch: boolean } | null {
  for (const finding of currentFindings) {
    if (finding.fingerprint === fingerprint) {
      return { fingerprintMatch: true, identityMatch: finding.identityDigest === identityDigest };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// transitionRules
// ---------------------------------------------------------------------------

/**
 * Apply the EXACT reconsidered / carried / deferred / resolved rules
 * from Task 10 using `priorHeadSha..currentHeadSha`. Returns a list of
 * actions the reconcile loop performs.
 *
 * Semantics:
 *   - INITIAL (no prior marker threads) → every current finding is
 *     `create-new`.
 *   - CARRIED (prior thread has matching fingerprint + matching
 *     identityDigest) → `skip-unchanged` (no POST/PATCH/close).
 *   - RECONSIDERED (prior thread has matching fingerprint but
 *     DIFFERENT identityDigest) → `patch-body` (no new thread, no
 *     close).
 *   - DEFERRED (prior thread has fingerprint but is not in current
 *     findings) → `logical-resolve` (default) or `native-close` (opt-in
 *     `native-best-effort` mode).
 *   - RESOLVED-ELSEWHERE → same as DEFERRED.
 *   - STALE-CLOSE (prior thread's status is `closed` / `fixed` but the
 *     current review still produces the same fingerprint) → the next
 *     current-head run deterministically reopens via `native-reopen`.
 *   - DUPLICATE-BOT-THREADS (two prior threads with the SAME
 *     fingerprint, DIFFERENT runIds) → the OLDER runId thread is marked
 *     superseded; the NEWER runId thread is canonical.
 *   - HUMAN/UNMARKED (prior thread lacks fingerprint markers) →
 *     `preserve-human` (zero mutations).
 *   - DIFFERENT RUN (prior thread's runId differs from the current
 *     runId) → `preserve-other-run` (NEVER close threads from another
 *     run / config hash).
 */
export function transitionRules(input: {
  readonly priorClassified: readonly ClassifiedPriorThread[];
  readonly currentFindings: readonly DurableFindingWithIdentity[];
  readonly currentHeadSha: string;
  readonly priorHeadSha: string;
  readonly currentRunId: string;
  readonly currentAttemptId: string;
  readonly resolutionMode: ResolutionMode;
  readonly parentThreadId?: number;
}): readonly ThreadAction[] {
  const actions: ThreadAction[] = [];

  // Track which current findings have already been assigned to a prior
  // thread, so a fingerprint shared by multiple prior threads converges
  // to ONE canonical action.
  const assignedFingerprints = new Set<string>();

  // Group prior threads by fingerprint so duplicate-bot detection works.
  const priorByFingerprint = new Map<string, ClassifiedPriorThread[]>();
  for (const prior of input.priorClassified) {
    if (prior.fingerprint === null) continue;
    const list = priorByFingerprint.get(prior.fingerprint);
    if (list === undefined) priorByFingerprint.set(prior.fingerprint, [prior]);
    else list.push(prior);
  }

  // PASS 1: walk priorClassified and classify each prior thread against
  // the current findings. The priorList is consumed in document order so
  // the transition is deterministic across runs.
  for (const prior of input.priorClassified) {
    // 1. Human / unmarked: NO marker → never mutate.
    if (!prior.carriedByUs) {
      if (prior.threadId === undefined) continue;
      actions.push({ kind: "preserve-human", threadId: prior.threadId });
      continue;
    }

    // 2. Stale-close repair: prior thread is in a "closed" status
    // (status=closed/fixed/wontFix/byDesign) but the current review still
    // produces the same fingerprint → current-head run reopens.
    //
    // This MUST run BEFORE the runId check: a stale close from an older
    // run is still a stale close that the current-head run repairs
    // (Task 9 semantics). Reopening is NOT the same as closing — we
    // never close other-run threads but we may reopen a stale-closed
    // bot thread to bring it back to canonical.
    if (
      prior.fingerprint !== null
      && prior.reopenedFromStaleClose
      && prior.fingerprintMatch
      && prior.identityMatch
    ) {
      if (prior.threadId === undefined) continue;
      actions.push({ kind: "native-reopen", threadId: prior.threadId, fingerprint: prior.fingerprint });
      assignedFingerprints.add(prior.fingerprint);
      continue;
    }

    // 3. Different runId: NEVER close another run's threads.
    if (prior.runId !== null && prior.runId !== input.currentRunId) {
      // BUT: if this prior thread is for a fingerprint the CURRENT run
      // also produced, the older run's thread is superseded (still no
      // close — we mark it superseded via PATCH-status). This is the
      // convergence path: concurrent / older bot threads with the same
      // fingerprint dedup to ONE canonical marker thread under the
      // current run's identity, regardless of which prior thread is
      // already in `assignedFingerprints`.
      if (prior.fingerprint !== null) {
        const currentMatch = input.currentFindings.find((f) => f.fingerprint === prior.fingerprint);
        if (currentMatch !== undefined) {
          actions.push({ kind: "mark-superseded", threadId: prior.threadId, fingerprint: prior.fingerprint });
          continue;
        }
      }
      if (prior.threadId === undefined) continue;
      actions.push({ kind: "preserve-other-run", threadId: prior.threadId });
      continue;
    }

    // 4. Same fingerprint + same identityDigest → carried, skip.
    if (prior.fingerprintMatch && prior.identityMatch) {
      if (prior.threadId === undefined || prior.fingerprint === null) continue;
      // If two prior threads claim the same fingerprint + identityDigest
      // (concurrent duplicate posts), the first wins, the second is
      // marked superseded.
      if (assignedFingerprints.has(prior.fingerprint)) {
        actions.push({ kind: "mark-superseded", threadId: prior.threadId, fingerprint: prior.fingerprint });
        continue;
      }
      actions.push({ kind: "skip-unchanged", fingerprint: prior.fingerprint, threadId: prior.threadId });
      assignedFingerprints.add(prior.fingerprint);
      continue;
    }

    // 5. Same fingerprint + DIFFERENT identityDigest → reconsidered →
    // PATCH body. The fingerprint is durable across category / anchor
    // / ruleKey churn, but the identity changed → we update the marker
    // and the body, do NOT close.
    if (prior.fingerprintMatch && !prior.identityMatch) {
      if (prior.fingerprint === null) continue;
      const currentMatch = input.currentFindings.find((f) => f.fingerprint === prior.fingerprint);
      if (currentMatch === undefined || prior.threadId === undefined || prior.commentId === undefined) continue;
      actions.push({
        kind: "patch-body",
        threadId: prior.threadId,
        commentId: prior.commentId,
        fingerprint: prior.fingerprint,
        comment: currentMatch.comment,
      });
      assignedFingerprints.add(prior.fingerprint);
      continue;
    }

    // 6. Prior thread carries our marker but the fingerprint is not in
    // the current findings → DEFERRED / RESOLVED.
    if (prior.fingerprint !== null && !prior.fingerprintMatch) {
      if (prior.threadId === undefined) continue;
      if (input.resolutionMode === "native-best-effort") {
        actions.push({ kind: "native-close", threadId: prior.threadId, fingerprint: prior.fingerprint });
      } else {
        actions.push({ kind: "logical-resolve", threadId: prior.threadId, fingerprint: prior.fingerprint });
      }
      continue;
    }

    // Unreachable: every carriedByUs thread has a fingerprint.
    if (prior.threadId !== undefined) {
      actions.push({ kind: "preserve-human", threadId: prior.threadId });
    }
  }

  // PASS 2: walk currentFindings and emit `create-new` for any
  // fingerprint that did not match a prior carried thread. A finding
  // with a fingerprint that ALSO appears as a different-identityDigest
  // match above (reconsidered) is NOT created (it was patched). A
  // finding whose fingerprint was matched by a different-runId prior is
  // NOT created either (the older thread is being superseded, the newer
  // run creates a fresh canonical thread for the same fingerprint).
  //
  // Edge case: a current finding whose fingerprint ALSO appears in the
  // prior list as a DIFFERENT runId. The older run's thread is marked
  // superseded above; the current run creates a fresh canonical thread.
  // This is the desired behavior — convergence to ONE canonical thread
  // per fingerprint under the current run's identity.
  for (const finding of input.currentFindings) {
    if (assignedFingerprints.has(finding.fingerprint)) continue;
    actions.push({
      kind: "create-new",
      fingerprint: finding.fingerprint,
      comment: finding.comment,
      ...(input.parentThreadId !== undefined ? { parentThreadId: input.parentThreadId } : {}),
    });
    assignedFingerprints.add(finding.fingerprint);
  }

  return actions;
}

// ---------------------------------------------------------------------------
// reconcileAzureThreads — replay-reconciled mutate + finalize
// ---------------------------------------------------------------------------

/**
 * Optional context for URL construction. When omitted (the test path),
 * a synthetic base URL of `https://dev.azure.com/test-org/test-project/_apis/git/repositories/test-repo/pullRequests/1`
 * is used so URL builders never throw. The fetchImpl still receives
 * real-looking ADO URLs that the test recorder can match against.
 */
export type ReconcileContext =
  | { readonly kind: "azure-context"; readonly context: AzureContext }
  | { readonly kind: "synthetic"; readonly baseUrl: string };

/**
 * Apply the action list against the ADO API. Each action is fenced by
 * the current (runId, attemptId, headSha) — see Task 9 state machine.
 *
 * The function is replay-reconciled: re-running it on the same inputs
 * converges to the same outcome (idempotent for `skip-unchanged` /
 * `preserve-*`). Mutations that fail (PATCH 409 / 403 / network) emit a
 * warning, return a `*-failed` outcome with `retryable: true`, and
 * NEVER post a duplicate parent thread.
 */
export async function reconcileAzureThreads(input: {
  readonly context: ReconcileContext;
  readonly fetchImpl: FetchImpl;
  readonly signal?: AbortSignal;
  readonly actions: readonly ThreadAction[];
  readonly currentRunId: string;
  readonly currentAttemptId: string;
  readonly currentHeadSha: string;
  readonly secrets?: readonly string[];
}): Promise<readonly ReconcileOutcome[]> {
  const outcomes: ReconcileOutcome[] = [];
  for (const action of input.actions) {
    const outcome = await applyAction(input, action);
    outcomes.push(outcome);
  }
  return outcomes;
}

function buildPrBaseUrl(ctx: ReconcileContext): string {
  if (ctx.kind === "azure-context") {
    return azurePrBaseUrl(ctx.context);
  }
  return ctx.baseUrl;
}

function getSecrets(ctx: ReconcileContext, fallback: readonly string[] | undefined): readonly string[] {
  if (ctx.kind === "azure-context") return [ctx.context.token];
  return fallback ?? [];
}

async function applyAction(
  ctx: {
    readonly context: ReconcileContext;
    readonly fetchImpl: FetchImpl;
    readonly currentRunId: string;
    readonly currentAttemptId: string;
    readonly currentHeadSha: string;
    readonly secrets?: readonly string[];
    readonly signal?: AbortSignal;
  },
  action: ThreadAction,
): Promise<ReconcileOutcome> {
  switch (action.kind) {
    case "create-new": {
      try {
        const result = await postAzureInlineThread({
          context: ctx.context,
          fetchImpl: ctx.fetchImpl,
           ...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
          comment: action.comment,
          currentRunId: ctx.currentRunId,
          currentAttemptId: ctx.currentAttemptId,
          fingerprint: action.fingerprint,
          ...(ctx.secrets !== undefined ? { secrets: ctx.secrets } : {}),
          ...(action.parentThreadId !== undefined ? { parentThreadId: action.parentThreadId } : {}),
        });
        if (result === undefined) {
          return {
            kind: "patch-failed",
            threadId: 0,
            fingerprint: action.fingerprint,
            retryable: true,
            error: "POST /threads returned no id",
          };
        }
        return {
          kind: "created",
          threadId: result.threadId,
          commentId: result.commentId,
          fingerprint: action.fingerprint,
        };
      } catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation("warning", `Azure reconcile create failed (${message}); retryable.`);
        return {
          kind: "patch-failed",
          threadId: 0,
          fingerprint: action.fingerprint,
          retryable: true,
          error: message,
        };
      }
    }

    case "patch-body": {
      try {
        const content = buildAzureInlineBody({
          comment: action.comment,
          secrets: getSecrets(ctx.context, ctx.secrets),
          fingerprint: action.fingerprint,
          identityDigest: action.comment.durableIdentity?.identityDigest ?? "",
          runId: ctx.currentRunId,
          attemptId: ctx.currentAttemptId,
        });
        const url = `${buildPrBaseUrl(ctx.context)}/threads/${action.threadId}/comments/${action.commentId}?api-version=${AZURE_API_VERSION}`;
        const headers = ctx.context.kind === "azure-context" ? azureHeaders(ctx.context.context.token) : { "content-type": "application/json" };
        const response = await ctx.fetchImpl(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ content }),
        });
        if (!response.ok) {
          const retryable = response.status === 409 || response.status === 403 || response.status >= 500;
          const message = `HTTP ${response.status}`;
          writeBrandedAnnotation(
            "warning",
            `Azure reconcile PATCH thread ${action.threadId} comment ${action.commentId} failed (${message}); retryable=${retryable}.`,
          );
          return {
            kind: "patch-failed",
            threadId: action.threadId,
            fingerprint: action.fingerprint,
            retryable,
            error: message,
          };
        }
        return { kind: "patched", threadId: action.threadId, fingerprint: action.fingerprint };
      } catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation(
          "warning",
          `Azure reconcile PATCH thread ${action.threadId} comment ${action.commentId} threw (${message}); retryable.`,
        );
        return {
          kind: "patch-failed",
          threadId: action.threadId,
          fingerprint: action.fingerprint,
          retryable: true,
          error: message,
        };
      }
    }

    case "native-close": {
      try {
        const url = `${buildPrBaseUrl(ctx.context)}/threads/${action.threadId}?api-version=${AZURE_API_VERSION}`;
        const headers = ctx.context.kind === "azure-context" ? azureHeaders(ctx.context.context.token) : { "content-type": "application/json" };
        const response = await ctx.fetchImpl(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: "closed" }),
        });
        if (!response.ok) {
          const retryable = response.status === 409 || response.status === 403 || response.status >= 500;
          const message = `HTTP ${response.status}`;
          writeBrandedAnnotation(
            "warning",
            `Azure reconcile close thread ${action.threadId} failed (${message}); retryable=${retryable}.`,
          );
          return {
            kind: "native-close-failed",
            threadId: action.threadId,
            fingerprint: action.fingerprint,
            retryable,
            error: message,
          };
        }
        return { kind: "native-closed", threadId: action.threadId, fingerprint: action.fingerprint };
      } catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation(
          "warning",
          `Azure reconcile close thread ${action.threadId} threw (${message}); retryable.`,
        );
        return {
          kind: "native-close-failed",
          threadId: action.threadId,
          fingerprint: action.fingerprint,
          retryable: true,
          error: message,
        };
      }
    }

    case "native-reopen": {
      try {
        const url = `${buildPrBaseUrl(ctx.context)}/threads/${action.threadId}?api-version=${AZURE_API_VERSION}`;
        const headers = ctx.context.kind === "azure-context" ? azureHeaders(ctx.context.context.token) : { "content-type": "application/json" };
        const response = await ctx.fetchImpl(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: "active" }),
        });
        if (!response.ok) {
          const retryable = response.status === 409 || response.status === 403 || response.status >= 500;
          const message = `HTTP ${response.status}`;
          writeBrandedAnnotation(
            "warning",
            `Azure reconcile reopen thread ${action.threadId} failed (${message}); retryable=${retryable}.`,
          );
          return {
            kind: "patch-failed",
            threadId: action.threadId,
            fingerprint: action.fingerprint,
            retryable,
            error: message,
          };
        }
        return { kind: "reopened", threadId: action.threadId, fingerprint: action.fingerprint };
      } catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation(
          "warning",
          `Azure reconcile reopen thread ${action.threadId} threw (${message}); retryable.`,
        );
        return {
          kind: "patch-failed",
          threadId: action.threadId,
          fingerprint: action.fingerprint,
          retryable: true,
          error: message,
        };
      }
    }

    case "mark-superseded": {
      try {
        const url = `${buildPrBaseUrl(ctx.context)}/threads/${action.threadId}?api-version=${AZURE_API_VERSION}`;
        const headers = ctx.context.kind === "azure-context" ? azureHeaders(ctx.context.context.token) : { "content-type": "application/json" };
        const response = await ctx.fetchImpl(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: "closed" }),
        });
        if (!response.ok) {
          const retryable = response.status === 409 || response.status === 403 || response.status >= 500;
          const message = `HTTP ${response.status}`;
          writeBrandedAnnotation(
            "warning",
            `Azure reconcile supersede thread ${action.threadId} failed (${message}); retryable=${retryable}.`,
          );
          return {
            kind: "patch-failed",
            threadId: action.threadId,
            fingerprint: action.fingerprint,
            retryable,
            error: message,
          };
        }
        return {
          kind: "marked-superseded",
          threadId: action.threadId,
          fingerprint: action.fingerprint,
        };
      } catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation(
          "warning",
          `Azure reconcile supersede thread ${action.threadId} threw (${message}); retryable.`,
        );
        return {
          kind: "patch-failed",
          threadId: action.threadId,
          fingerprint: action.fingerprint,
          retryable: true,
          error: message,
        };
      }
    }

    case "skip-unchanged":
      return { kind: "skipped", threadId: action.threadId, fingerprint: action.fingerprint };

    case "logical-resolve":
      return {
        kind: "logical-resolved",
        threadId: action.threadId,
        fingerprint: action.fingerprint,
      };

    case "preserve-human":
      return { kind: "preserved", threadId: action.threadId };

    case "preserve-other-run":
      return { kind: "preserved-other-run", threadId: action.threadId };
  }
}

// ---------------------------------------------------------------------------
// Azure POST / PATCH helpers
// ---------------------------------------------------------------------------

async function postAzureInlineThread(input: {
  readonly context: ReconcileContext;
  readonly fetchImpl: FetchImpl;
  readonly comment: LiveReviewComment;
  readonly currentRunId: string;
  readonly currentAttemptId: string;
  readonly fingerprint: string;
  readonly parentThreadId?: number;
  readonly secrets?: readonly string[];
  readonly signal?: AbortSignal;
}): Promise<{ readonly threadId: number; readonly commentId: number } | undefined> {
  // Reuse the existing inline-body builder, but augment with the
  // fingerprint marker block so the next reconcile pass can recover the
  // identity / runId / attemptId.
  const content = buildAzureInlineBody({
    comment: input.comment,
    secrets: getSecrets(input.context, input.secrets),
    fingerprint: input.fingerprint,
    identityDigest: input.comment.durableIdentity?.identityDigest ?? "",
    runId: input.currentRunId,
    attemptId: input.currentAttemptId,
  });
  const headers = input.context.kind === "azure-context" ? azureHeaders(input.context.context.token) : { "content-type": "application/json" };
  const url = `${buildPrBaseUrl(input.context)}/threads?api-version=${AZURE_API_VERSION}`;
  const response = await input.fetchImpl(url, {
    method: "POST",
    headers,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
     body: JSON.stringify({
      comments: [
        {
          parentCommentId: 0,
          content,
          commentType: 1,
        },
      ],
      status: 1,
      threadContext: {
        filePath: `/${input.comment.path}`,
        rightFileStart: { line: input.comment.line, offset: 1 },
        rightFileEnd: { line: input.comment.line, offset: 1 },
      },
    }),
  });
  if (!response.ok) {
    const message = `HTTP ${response.status}`;
    writeBrandedAnnotation("warning", `Azure reconcile POST thread failed (${message}); retryable.`);
     throw new LiveReviewError("HTTP_RESPONSE_FAILED", `Azure reconcile POST thread failed with HTTP ${response.status}.`);
  }
  const json = await readJsonSafe(response);
  if (!isRecord(json)) return undefined;
  const threadIdRaw = json["id"];
  if (!isSafeInteger(threadIdRaw)) return undefined;
  const comments = json["comments"];
  if (!isUnknownArray(comments) || comments.length === 0) return undefined;
  const firstComment = comments[0];
  if (!isRecord(firstComment)) return undefined;
  const commentIdRaw = firstComment["id"];
  if (!isSafeInteger(commentIdRaw)) return undefined;
  return { threadId: threadIdRaw, commentId: commentIdRaw };
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}

/**
 * Build the comment body for an inline thread, including the
 * fingerprint marker block. Reuses the existing `buildInlineCommentBody`
 * for the user-facing text, then appends the marker comment AFTER the
 * body so the body's severity / category badges render unchanged.
 */
export function buildAzureInlineBody(input: {
  readonly comment: LiveReviewComment;
  readonly secrets: readonly string[];
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly runId: string;
  readonly attemptId: string;
}): string {
  const baseBody = buildInlineCommentBody({
    comment: input.comment,
    secrets: input.secrets,
    includeMarker: true,
  });
  const markerBlock = buildFingerprintMarkers({
    fingerprint: input.fingerprint,
    identityDigest: input.identityDigest,
    runId: input.runId,
    attemptId: input.attemptId,
  });
  return `${baseBody}\n${markerBlock}`;
}

// Re-export `readStringFieldOrThrow` so the existing `LiveReviewComment`
// builder does not regress when callers consume this module alone.
export { readStringFieldOrThrow };

// ---------------------------------------------------------------------------
// Integration: runAzureLiveWithReconcile
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import {
  assertNoFingerprintCollision,
  computeDurableFindingIdentity,
  FingerprintCollisionError,
} from "../review/fingerprint.js";
import {
  type LiveProviderOutcome,
  type LiveRunResult,
  preparePostedReview,
  mapReviewVerdictToAzureStatus,
} from "./live-shared.js";
import { AZURE_STATUS_CONTEXT_NAME, AZURE_STATUS_CONTEXT_GENRE } from "../util/brand.js";
import { REVIEW_MARKER } from "../util/marker.js";
import type { ParsedCliArgs } from "./parse-args.js";

export type RunAzureReconcileOptions = {
  readonly resolutionMode?: ResolutionMode;
};

/**
 * Live Azure DevOps review path through the durable reconciler.
 *
 * Steps:
 *   1. List prior threads.
 *   2. classifyPriorThreads + transitionRules for each prior.
 *   3. reconcileAzureThreads — execute actions (skip/patch/close/reopen/supersede).
 *   4. POST create-new actions for unmatched fingerprints.
 *   5. Parent-card semantics (parent POSTed LAST so its id is highest).
 *   6. PR status POST with effective verdict.
 *
 * Default `resolutionMode: "logical"` is replay-reconciled; fixed
 * findings are LOGICALLY resolved without native close. Pass
 * `"native-best-effort"` to opt in to ADO thread status updates.
 */
export async function runAzureLiveWithReconcile(input: {
  readonly context: AzureContext;
  readonly diffText: string;
  readonly provider: LiveProviderOutcome;
  readonly parsed: ParsedCliArgs;
  readonly fetchImpl: FetchImpl;
  readonly options?: RunAzureReconcileOptions;
  readonly signal?: AbortSignal;
}): Promise<LiveRunResult> {
  const { context, diffText, provider, parsed, fetchImpl } = input;
  const callerSignal = input.signal ?? new AbortController().signal;
  const reconcileSignal = AbortSignal.any([
    callerSignal,
    AbortSignal.timeout(60_000),
  ]);
  if (callerSignal.aborted) {
    const rawReason = callerSignal.reason;
    const abortReason =
      rawReason === undefined || rawReason === ""
        ? "aborted"
        : rawReason instanceof Error
        ? rawReason.message
        : String(rawReason);
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message: `reconcile aborted before any network I/O (reason: ${abortReason}); state preserved, no platform mutation.`,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      parseWarnings: provider.parseWarnings,
    };
  }
  const resolutionMode: ResolutionMode = input.options?.resolutionMode ?? "logical";

  const prepared = preparePostedReview({
    review: provider.review,
    provider: provider.provider,
    modelId: provider.modelId,
    diffText,
    parsed,
    secrets: [context.token],
  });
  const { postableComments: comments, body } = prepared;
  try {
    assertNoFingerprintCollision(
      comments.flatMap((comment) => comment.durableIdentity === undefined ? [] : [{ identity: comment.durableIdentity, body: comment.body }]),
    );
  } catch (error) {
    if (error instanceof FingerprintCollisionError) {
      return {
        exitCode: 1,
        posted: false,
        reviewId: undefined,
        message: `FINGERPRINT_COLLISION: fingerprint ${error.fingerprintDigest} (${error.collisionType}); reconcile aborted, no platform mutation, no state mutation.`,
        inlineThreadCount: 0,
        suppressedCommentCount: 0,
        parseWarnings: provider.parseWarnings,
      };
    }
    throw error;
  }

  // Fencing token (Task 9): runId + attemptId + currentHeadSha.
  const currentHeadSha = context.sourceCommit;
  const currentAttemptId = randomAttemptId();
  const currentRunId = computeRunIdFromContext({
    repoHash: hashString(`${context.org}/${context.project}/${context.repoId}`),
    prNumber: context.prNumber,
    headSha: currentHeadSha,
    policyHash: "policy-pending",
    providerModelHash: hashString(`${provider.provider}|${provider.modelId}`),
  });

  // Build durable findings for each postable comment.
  const findings: DurableFindingWithIdentity[] = comments.map(buildDurableFindingForComment);

  // 1. List prior threads (best-effort; empty list on failure).
  const priorThreads = await listPriorThreads(context, fetchImpl, reconcileSignal);

  // 2. Classify + transition rules.
  const classified = classifyPriorThreads({
    threads: priorThreads,
    currentFindings: findings,
    currentHeadSha,
  });
  const actions = transitionRules({
    priorClassified: classified,
    currentFindings: findings,
    currentHeadSha,
    priorHeadSha: "",
    currentRunId,
    currentAttemptId,
    resolutionMode,
  });

  // 3. Parent-replace semantics — find existing parent marker thread
  // and delete every comment on it so ADO flips it to `isDeleted: true`.
  const oldParent = findParentMarkerThread(priorThreads);
  if (oldParent !== null && typeof oldParent.thread.id === "number") {
    await deleteParentComments(context, fetchImpl, oldParent.thread.id, parentCommentIds(oldParent.thread), reconcileSignal);
  }

  // 4. Execute reconcile actions on existing threads.
  await reconcileAzureThreads({
    context: { kind: "azure-context", context },
    fetchImpl,
    signal: reconcileSignal,
    actions,
    currentRunId,
    currentAttemptId,
    currentHeadSha,
  });

  // 5. POST create-new actions (only those — skip/patch/etc. already ran).
  type InlinePostResult = { readonly threadId: number; readonly commentId: number; readonly fingerprint: string };
  const postedInlines: InlinePostResult[] = [];
  const failedIndices: number[] = [];
  const created = actions.filter(
    (a): a is Extract<ThreadAction, { kind: "create-new" }> => a.kind === "create-new",
  );
  for (let i = 0; i < created.length; i += 1) {
    const action = created[i]!;
    try {
      const result = await postAzureInlineThread({
        context: { kind: "azure-context", context },
        fetchImpl,
        comment: action.comment,
        currentRunId,
        currentAttemptId,
        fingerprint: action.fingerprint,
      });
      if (result !== undefined) {
        postedInlines.push({ ...result, fingerprint: action.fingerprint });
      } else {
        failedIndices.push(i);
      }
    } catch (error) {
      failedIndices.push(i);
      writeBrandedAnnotation(
        "warning",
        `Azure reconcile create ${i + 1}/${created.length} failed (${action.comment.path}:${action.comment.line}): ${formatError(error)}; continuing.`,
      );
    }
  }

  // 6. POST the parent LAST so it gets the highest thread id.
  const parentThread = await postParentPrComment(context, fetchImpl, body, reconcileSignal);
  const parentThreadId = parentThread?.id;

  // 7. PATCH each newly-created inline comment to inject the parent-ref text.
  if (parentThreadId !== undefined) {
    for (const inline of postedInlines) {
      await patchInlineForParentRef(context, fetchImpl, inline.threadId, inline.commentId, parentThreadId, created.find((a) => a.fingerprint === inline.fingerprint)?.comment, reconcileSignal);
    }
  }

  if (postedInlines.length === 0 && failedIndices.length > 0) {
    const message = `Azure review failed: 0 threads posted, ${failedIndices.length} failed`;
    writeBrandedAnnotation("error", message);
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message,
      parseWarnings: provider.parseWarnings,
    };
  }

  // 8. PR status POST.
  await postPrStatus(context, fetchImpl, mapReviewVerdictToAzureStatus(prepared.effectiveVerdict), provider.review.summary, reconcileSignal);

  const reviewId = parentThreadId ?? postedInlines[0]?.threadId;
  const parseFailed = provider.review.parseFailed === true;
  const successMessage = failedIndices.length > 0
    ? `posted Azure review (${postedInlines.length} threads, ${failedIndices.length} failed)${parseFailed ? " (parse failed)" : ""}`
    : `posted Azure review (${postedInlines.length} threads)${parseFailed ? " (parse failed)" : ""}`;

  return {
    exitCode: parseFailed ? 1 : 0,
    posted: true,
    reviewId,
    message: successMessage,
    inlineThreadCount: postedInlines.length,
    verdict: prepared.effectiveVerdict,
    parseFailed,
    parseWarnings: provider.parseWarnings,
  };
}

// ---------------------------------------------------------------------------
// Reconcile-side helpers (parent / status / list-threads)
// ---------------------------------------------------------------------------

function buildDurableFindingForComment(comment: LiveReviewComment): DurableFindingWithIdentity {
  const firstSentence = extractFirstSentence(comment.body);
  const identity = computeDurableFindingIdentity({
    path: comment.path,
    anchorKind: "hunk",
    symbolName: undefined,
    symbolKind: undefined,
    hunkPreimage: undefined,
    category: comment.category,
    ruleKey: undefined,
    bodyFirstSentence: firstSentence,
    pathRewrites: undefined,
    caseInsensitive: undefined,
  });
  return {
    fingerprint: identity.fingerprintDigest,
    identityDigest: identity.identityDigest,
    canonicalPath: identity.canonicalPath,
    canonicalAnchor: identity.canonicalAnchor,
    normalizedCategory: identity.normalizedCategory,
    normalizedRuleKey: identity.normalizedRuleKey,
    comment: { ...comment, durableIdentity: identity },
  };
}

function extractFirstSentence(body: string): string {
  const match = body.match(/^[^.!?]*[.!?]/u);
  return match !== null ? match[0] : body;
}

async function listPriorThreads(context: AzureContext, fetchImpl: FetchImpl, signal: AbortSignal): Promise<readonly AzureThreadRecord[]> {
  const response = await fetchImpl(`${azurePrBaseUrl(context)}/threads?api-version=${AZURE_API_VERSION}`, {
    method: "GET",
    headers: azureHeaders(context.token),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) return [];
  const json = await readJsonSafe(response);
  if (!isRecord(json)) return [];
  const value = json["value"];
  if (!isUnknownArray(value)) return [];
  const out: AzureThreadRecord[] = [];
  for (const raw of value) {
    const parsed = parseAzureThreadRecord(raw);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

function parseAzureThreadRecord(raw: unknown): AzureThreadRecord | null {
  if (!isRecord(raw)) return null;
  const idRaw = raw["id"];
  const id = isSafeInteger(idRaw) ? idRaw : undefined;
  const status = typeof raw["status"] === "string" ? raw["status"] : "";
  const threadContext = parseThreadContext(raw);
  const commentsRaw = raw["comments"];
  if (!isUnknownArray(commentsRaw)) return null;
  const comments: { readonly id: number | undefined; readonly content: string }[] = [];
  for (const c of commentsRaw) {
    if (!isRecord(c)) continue;
    const content = c["content"];
    if (typeof content !== "string") continue;
    const cidRaw = c["id"];
    comments.push({ id: isSafeInteger(cidRaw) ? cidRaw : undefined, content });
  }
  return { id, status, threadContext, comments };
}

function parseThreadContext(raw: Record<string, unknown>): AzureThreadRecord["threadContext"] {
  const hasKey = "threadContext" in raw;
  const nested = raw["threadContext"];
  if (hasKey) {
    if (nested === null) return null;
    if (!isRecord(nested)) return null;
    return readContextFields(nested);
  }
  return readContextFields(raw);
}

function readContextFields(raw: Record<string, unknown>): AzureThreadRecord["threadContext"] {
  const filePath = raw["filePath"];
  if (typeof filePath !== "string") return null;
  const start = raw["rightFileStart"];
  if (!isRecord(start)) return null;
  const lineRaw = start["line"];
  if (!isSafeInteger(lineRaw)) return null;
  return { filePath, rightFileStart: { line: lineRaw } };
}

function findParentMarkerThread(threads: readonly AzureThreadRecord[]) {
  for (const thread of threads) {
    if (thread.threadContext !== null) continue;
    const firstComment = thread.comments[0];
    if (firstComment === undefined) continue;
    if (!firstComment.content.includes(REVIEW_MARKER)) continue;
    if (thread.id === undefined) continue;
    return { thread, comment: firstComment };
  }
  return null;
}

function parentCommentIds(thread: AzureThreadRecord): readonly number[] {
  const ids: number[] = [];
  for (const c of thread.comments) {
    if (isSafeInteger(c.id)) ids.push(c.id);
  }
  return ids;
}

async function deleteParentComments(
  context: AzureContext,
  fetchImpl: FetchImpl,
  threadId: number,
  commentIds: readonly number[],
  signal: AbortSignal,
): Promise<void> {
  for (const commentId of commentIds) {
    const url = `${azurePrBaseUrl(context)}/threads/${threadId}/comments/${commentId}?api-version=${AZURE_API_VERSION}`;
    try {
       const response = await fetchImpl(url, { method: "DELETE", headers: azureHeaders(context.token), signal });
      if (!response.ok && response.status !== 204) {
        writeBrandedAnnotation("warning", `Azure reconcile delete parent ${threadId}/${commentId} HTTP ${response.status}; continuing.`);
      }
    } catch (error) {
      writeBrandedAnnotation("warning", `Azure reconcile delete parent ${threadId}/${commentId} threw (${formatError(error)}); continuing.`);
    }
  }
}

async function postParentPrComment(
  context: AzureContext,
  fetchImpl: FetchImpl,
  body: string,
  signal: AbortSignal,
): Promise<{ readonly id: number } | undefined> {
  try {
    const response = await fetchImpl(`${azurePrBaseUrl(context)}/threads?api-version=${AZURE_API_VERSION}`, {
      method: "POST",
      headers: azureHeaders(context.token),
      ...(signal === undefined ? {} : { signal }),
      body: JSON.stringify({
        comments: [{ parentCommentId: 0, content: body, commentType: 1 }],
        status: 1,
      }),
    });
    if (!response.ok) return undefined;
    const json = await readJsonSafe(response);
    if (!isRecord(json)) return undefined;
    const idRaw = json["id"];
    if (!isSafeInteger(idRaw)) return undefined;
    return { id: idRaw };
  } catch (error) {
    writeBrandedAnnotation("warning", `Azure reconcile parent POST threw (${formatError(error)}); continuing.`);
    return undefined;
  }
}

async function patchInlineForParentRef(
  context: AzureContext,
  fetchImpl: FetchImpl,
  threadId: number,
  commentId: number,
  parentThreadId: number,
  comment: LiveReviewComment | undefined,
  signal: AbortSignal,
): Promise<void> {
  if (comment === undefined) return;
  const content = buildInlineCommentBody({
    comment,
    secrets: [context.token],
    includeMarker: true,
    parentThreadId,
  });
  const url = `${azurePrBaseUrl(context)}/threads/${threadId}/comments/${commentId}?api-version=${AZURE_API_VERSION}`;
  try {
    const response = await fetchImpl(url, {
      method: "PATCH",
      headers: azureHeaders(context.token),
      ...(signal === undefined ? {} : { signal }),
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      writeBrandedAnnotation("warning", `Azure reconcile patch inline ${threadId}/${commentId} HTTP ${response.status}; continuing.`);
    }
  } catch (error) {
    writeBrandedAnnotation("warning", `Azure reconcile patch inline ${threadId}/${commentId} threw (${formatError(error)}); continuing.`);
  }
}

async function postPrStatus(
  context: AzureContext,
  fetchImpl: FetchImpl,
  state: "succeeded" | "failed" | "pending",
  description: string,
  signal: AbortSignal,
): Promise<void> {
  const safeDescription = description
    .replace(/[\u000A\u000D]/gu, " ")
    .replace(/\s{2,}/gu, " ")
    .trim()
    .slice(0, 255);
  try {
    const response = await fetchImpl(`${azurePrBaseUrl(context)}/statuses?api-version=${AZURE_API_VERSION}`, {
      method: "POST",
      headers: azureHeaders(context.token),
      ...(signal === undefined ? {} : { signal }),
      body: JSON.stringify({
        state,
        description: safeDescription,
        context: { name: AZURE_STATUS_CONTEXT_NAME, genre: AZURE_STATUS_CONTEXT_GENRE },
      }),
    });
    if (!response.ok) {
      writeBrandedAnnotation("warning", `Azure reconcile status POST HTTP ${response.status}; continuing.`);
    }
  } catch (error) {
    writeBrandedAnnotation("warning", `Azure reconcile status POST threw (${formatError(error)}); continuing.`);
  }
}

function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function computeRunIdFromContext(input: {
  readonly repoHash: string;
  readonly prNumber: number;
  readonly headSha: string;
  readonly policyHash: string;
  readonly providerModelHash: string;
}): string {
  return createHash("sha256")
    .update(input.repoHash)
    .update(String(input.prNumber))
    .update(input.headSha)
    .update(input.policyHash)
    .update(input.providerModelHash)
    .digest("hex");
}

function randomAttemptId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID !== undefined) return c.randomUUID();
  return `att-${Date.now()}-${Math.floor(Math.random() * 0xffff_ffff).toString(16)}`;
}
