// SPDX-License-Identifier: MIT
//
// Task 10 — Reconcile durable findings with native GitHub reviews and
// threads across incremental reviews.
//
// This module owns the GitHub-side reconciliation contract that maps
// prior marked comments/reviews to durable fingerprints (Task 4),
// classifies prior open findings into `reconsidered` vs `carried`
// based on the `priorHeadSha..currentHeadSha` delta, applies the
// transition rules defined in the plan, and emits the exact
// REST/GraphQL sequence required by the request-contract tests.
//
// Contract pins (test/unit/live-github-reconcile.test.ts):
//
//   - unchanged finding → no mutation requests fire
//   - changed finding → exactly one PATCH on the existing thread
//   - fixed finding → resolves only its matching marked thread
//     (logical resolution by default; no PATCH/POST when logical)
//   - dismissed / human reviews / unmarked bot content → NEVER touched
//   - force-push → full review, prior findings marked superseded,
//     all mutations bound to current head SHA
//   - 403 / 404 / 422 / race → warn, preserve state, never resolve
//
// Required permissions: `contents: read`, `pull-requests: write`
// (documented in `.github/SELF-REVIEW-RESOLUTION-GUIDE.md`).
//
// NEVER dismiss human reviews or unmarked bot content. NEVER resolve
// findings on a partial / budget / parse failure. NEVER run mutation
// without the current head SHA bound to the run.

import { githubHeaders } from "../util/http.js";
import type { FetchImpl } from "../util/http.js";
import type { GithubContext } from "../platform/github/context.js";
import {
  buildGithubApiBaseFromEnv,
  buildGithubRestUrl,
  type GithubApiBase,
} from "../platform/github/api-base.js";
import { writeBrandedAnnotation } from "../util/log.js";
import {
  assertNoFingerprintCollision,
  computeDurableFindingIdentity,
  FingerprintCollisionError,
  type CanonicalFindingInput,
} from "../review/fingerprint.js";
import type { ContextProvenanceResult } from "./context-provenance.js";
import { isRecord, isSafeInteger } from "../util/json-guards.js";
import type { LiveRunResult, LiveProviderOutcome } from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

const REVIEW_MARKER = "<!-- umactually -->";
const FINGERPRINT_LINE_PATTERN = /<!-- fingerprint:\s*([a-f0-9]+)\s*-->/u;

export type FindingLifecycle = "open" | "resolved" | "superseded" | "deferred";

export type ReconciledFinding = {
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly lifecycle: FindingLifecycle;
  readonly generation: number;
  readonly runId: string;
  readonly path: string;
  readonly line: number;
  readonly threadId: number;
};

export type NewProviderFinding = {
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly category?: string;
  readonly severity?: string;
};

export type TransitionDisposition =
  | "unchanged"
  | "updated"
  | "resolved"
  | "carried"
  | "superseded"
  | "deferred"
  | "posted";

export type ReconcileTransition = {
  readonly fingerprint: string;
  readonly disposition: TransitionDisposition;
  readonly priorPath: string;
  readonly priorLine: number;
  readonly priorThreadId: number;
  readonly path: string | null;
  readonly line: number | null;
  readonly note: string;
};

export type ReconcileDecision = "full" | "incremental";

export type ResolutionMode = "logical" | "native-best-effort";

export type ReconcileInput = {
  readonly context: GithubContext;
  readonly currentHeadSha: string;
  readonly priorHeadSha: string;
  readonly currentFiles: Readonly<Record<string, string>>;
  readonly deltaDiffText: string;
  readonly boundedContext: ContextProvenanceResult;
  readonly priorFindings: readonly ReconciledFinding[];
  readonly priorReviewId: number | null;
  readonly newFindings: readonly NewProviderFinding[];
  readonly runId: string;
  readonly attemptId: string;
  readonly policyHash: string;
  readonly resolutionMode: ResolutionMode;
  readonly fetchImpl: FetchImpl;
  readonly signal?: AbortSignal;
  readonly decision?: ReconcileDecision;
};

/**
 * Discriminated-union return for `runGithubReconcile`. Three terminal
 * branches:
 *   - `{ kind: "ok" }` — normal completion with mutations recorded
 *     in `transitions` / `postedThreadIds` / `updatedThreadIds`.
 *   - `{ kind: "collision" }` — the durable-fingerprint guard refused
 *     to post because the new finding set collides with prior findings;
 *     `assertNoFingerprintCollision` throws `FingerprintCollisionError`
 *     and we translate it into a typed result so the orchestrator
 *     (downstream callers) can react with a `FINGERPRINT_COLLISION`
 *     warning instead of seeing an uncaught exception escape the
 *     reconcile boundary.
 *   - `{ kind: "aborted" }` — the caller's `AbortSignal` was already
 *     aborted before the first network I/O fired. Reconcile short-
 *     circuits to preserve state; the reason field carries the abort
 *     reason text when the caller supplied one.
 */
export type ReconcileResult =
  | {
    readonly kind: "ok";
    readonly decision: ReconcileDecision;
    readonly reason: string;
    readonly transitions: readonly ReconcileTransition[];
    readonly warnings: readonly string[];
    readonly boundToHeadSha: string;
    readonly partialFailure: boolean;
    readonly resolutionMode: ResolutionMode;
    readonly postedThreadIds: readonly number[];
    readonly updatedThreadIds: readonly number[];
    readonly signalAborted: boolean;
  }
  | {
    readonly kind: "collision";
    readonly fingerprint: string;
    readonly collisionType: "within-review" | "against-persisted-state";
  }
  | {
    readonly kind: "aborted";
    readonly reason: string;
  };

type GithubReviewComment = {
  readonly id: number;
  readonly path: string;
  readonly line: number | null;
  readonly body: string;
  readonly user: { readonly login: string };
};

type GithubReview = {
  readonly id: number;
  readonly state: string;
  readonly body: string;
};

function apiBase(): GithubApiBase {
  return buildGithubApiBaseFromEnv();
}

function reviewCommentsListUrl(context: GithubContext): string {
  return buildGithubRestUrl(apiBase(), `/repos/${context.repo.owner}/${context.repo.name}/pulls/${context.prNumber}/comments`);
}

function reviewCommentUrl(context: GithubContext, id: number): string {
  return `${reviewCommentsListUrl(context)}/${id}`;
}

function reviewsListUrl(context: GithubContext): string {
  return buildGithubRestUrl(apiBase(), `/repos/${context.repo.owner}/${context.repo.name}/pulls/${context.prNumber}/reviews`);
}

function fileContentsUrl(context: GithubContext, path: string, headSha: string): string {
  const base = buildGithubRestUrl(apiBase(), `/repos/${context.repo.owner}/${context.repo.name}/contents/${encodeURIComponent(path)}`);
  return `${base}?ref=${encodeURIComponent(headSha)}`;
}

function parseReviewComment(value: unknown): GithubReviewComment | null {
  if (!isRecord(value)) return null;
  const id = value["id"];
  const path = value["path"];
  const line = value["line"];
  const body = value["body"];
  const user = value["user"];
  if (!isSafeInteger(id) || typeof path !== "string" || typeof body !== "string" || !isRecord(user)) {
    return null;
  }
  const login = user["login"];
  if (typeof login !== "string") return null;
  const lineNumber = isSafeInteger(line) ? line : null;
  return { id, path, line: lineNumber, body, user: { login } };
}

function parseReview(value: unknown): GithubReview | null {
  if (!isRecord(value)) return null;
  const id = value["id"];
  const state = value["state"];
  const body = value["body"];
  if (!isSafeInteger(id) || typeof state !== "string" || typeof body !== "string") return null;
  return { id, state, body };
}

function extractFingerprint(body: string): string | null {
  const match = FINGERPRINT_LINE_PATTERN.exec(body);
  return match !== null ? match[1]! : null;
}

export async function runGithubReconcile(
  input: ReconcileInput,
  signal?: AbortSignal,
): Promise<ReconcileResult> {
  const callerSignal = signal ?? input.signal ?? new AbortController().signal;
  const reconcileSignal = AbortSignal.any([
    callerSignal,
    AbortSignal.timeout(60_000),
  ]);

  const aborted = buildAbortedResultIfCancelled(callerSignal);
  if (aborted !== null) return aborted;

  const collision = checkFingerprintCollisions(input);
  if (collision !== null) return collision;

  const fetchInput: ReconcileInput = { ...input, signal: reconcileSignal };
  const state = createReconcileState();

  const priorCommentsOutcome = await listPriorMarkerComments(fetchInput);
  if (priorCommentsOutcome.kind === "error") {
    state.warnings.push(...priorCommentsOutcome.warnings);
    state.partialFailure = true;
    return buildOkResult(input, state, reconcileSignal);
  }

  const reviews = await listReviewsOrEmpty(fetchInput, state);
  await processAllPriorActions(fetchInput, input, priorCommentsOutcome.value, reviews, state);
  await processAllNewFindings(fetchInput, input, state);

  return buildOkResult(input, state, reconcileSignal);
}

type ReconcileState = {
  warnings: string[];
  transitions: ReconcileTransition[];
  postedThreadIds: number[];
  updatedThreadIds: number[];
  partialFailure: boolean;
};

function createReconcileState(): ReconcileState {
  return {
    warnings: [],
    transitions: [],
    postedThreadIds: [],
    updatedThreadIds: [],
    partialFailure: false,
  };
}

function buildAbortedResultIfCancelled(callerSignal: AbortSignal): Extract<ReconcileResult, { kind: "aborted" }> | null {
  if (!callerSignal.aborted) return null;
  const rawReason = callerSignal.reason;
  const abortReason =
    rawReason === undefined || rawReason === ""
      ? "aborted"
      : rawReason instanceof Error
      ? rawReason.message
      : String(rawReason);
  return { kind: "aborted", reason: abortReason };
}

function checkFingerprintCollisions(input: ReconcileInput): Extract<ReconcileResult, { kind: "collision" }> | null {
  try {
    assertNoFingerprintCollision(
      input.newFindings.map((finding) => ({
        identity: {
          fingerprintVersion: 1,
          fingerprintDigest: finding.fingerprint,
          identityDigest: finding.identityDigest,
          canonicalPath: finding.path,
          anchorKind: "hunk",
          canonicalAnchor: "",
          normalizedCategory: finding.category ?? "",
          normalizedRuleKey: finding.fingerprint,
        },
        body: finding.body,
      })),
      input.priorFindings.map((finding) => ({
        identity: {
          fingerprintVersion: 1,
          fingerprintDigest: finding.fingerprint,
          identityDigest: finding.identityDigest,
          canonicalPath: finding.path,
          anchorKind: "hunk",
          canonicalAnchor: "",
          normalizedCategory: "",
          normalizedRuleKey: finding.fingerprint,
        },
        body: finding.fingerprint,
      })),
    );
    return null;
  } catch (error) {
    if (error instanceof FingerprintCollisionError) {
      return {
        kind: "collision",
        fingerprint: error.fingerprintDigest,
        collisionType: error.collisionType,
      };
    }
    throw error;
  }
}

async function listReviewsOrEmpty(
  fetchInput: ReconcileInput,
  state: ReconcileState,
): Promise<readonly GithubReview[]> {
  const reviewsOutcome = await listReviews(fetchInput);
  if (reviewsOutcome.kind === "error") {
    state.warnings.push(...reviewsOutcome.warnings);
    return [];
  }
  return reviewsOutcome.value;
}

async function processAllPriorActions(
  fetchInput: ReconcileInput,
  input: ReconcileInput,
  priorComments: readonly GithubReviewComment[],
  reviews: readonly GithubReview[],
  state: ReconcileState,
): Promise<void> {
  const eligibleComments = filterEligibleComments(priorComments, reviews, input.context.token);
  const deltaTouched = computeDeltaTouchedPaths(input.deltaDiffText);
  const classification = classifyPriorFindings(input.priorFindings, eligibleComments, deltaTouched);
  const newByFingerprint = buildNewFindingsIndex(input.newFindings);

  for (const candidate of classification.reconsidered) {
    const transition = await processReconsidered(fetchInput, {
      candidate,
      newByFingerprint,
      warnings: state.warnings,
      postedThreadIds: state.postedThreadIds,
      updatedThreadIds: state.updatedThreadIds,
    });
    state.transitions.push(transition);
    if (transition.disposition === "deferred") {
      state.partialFailure = true;
    }
  }
  for (const carried of classification.carried) {
    state.transitions.push(buildCarriedTransition(carried));
  }
}

function buildNewFindingsIndex(newFindings: readonly NewProviderFinding[]): ReadonlyMap<string, NewProviderFinding> {
  const m = new Map<string, NewProviderFinding>();
  for (const finding of newFindings) {
    m.set(finding.fingerprint, finding);
  }
  return m;
}

function buildCarriedTransition(carried: ReconciledFinding): ReconcileTransition {
  return {
    fingerprint: carried.fingerprint,
    disposition: "carried",
    priorPath: carried.path,
    priorLine: carried.line,
    priorThreadId: carried.threadId,
    path: carried.path,
    line: carried.line,
    note: "anchor untouched by delta; carried unchanged",
  };
}

async function processAllNewFindings(
  fetchInput: ReconcileInput,
  input: ReconcileInput,
  state: ReconcileState,
): Promise<void> {
  for (const newFinding of input.newFindings) {
    if (state.transitions.some((t) => t.fingerprint === newFinding.fingerprint)) continue;
    const posted = await postNewFinding(fetchInput, { finding: newFinding, warnings: state.warnings });
    if (posted !== null) {
      state.postedThreadIds.push(posted);
      state.transitions.push(buildPostedTransition(newFinding));
    } else {
      state.partialFailure = true;
    }
  }
}

function buildPostedTransition(newFinding: NewProviderFinding): ReconcileTransition {
  return {
    fingerprint: newFinding.fingerprint,
    disposition: "posted",
    priorPath: "",
    priorLine: 0,
    priorThreadId: 0,
    path: newFinding.path,
    line: newFinding.line,
    note: "new finding posted",
  };
}

function buildOkResult(
  input: ReconcileInput,
  state: ReconcileState,
  reconcileSignal: AbortSignal,
): Extract<ReconcileResult, { kind: "ok" }> {
  const decision = input.decision ?? classifyDecision(input);
  return {
    kind: "ok",
    decision,
    reason: classifyDecisionReason(input, decision),
    transitions: state.transitions,
    warnings: state.warnings,
    boundToHeadSha: input.currentHeadSha,
    partialFailure: state.partialFailure,
    resolutionMode: input.resolutionMode,
    postedThreadIds: state.postedThreadIds,
    updatedThreadIds: state.updatedThreadIds,
    signalAborted: reconcileSignal.aborted,
  };
}

type ListOutcome<T> =
  | { readonly kind: "ok"; readonly value: readonly T[] }
  | { readonly kind: "error"; readonly warnings: readonly string[] };

async function listPriorMarkerComments(input: ReconcileInput): Promise<ListOutcome<GithubReviewComment>> {
  try {
    const response = await input.fetchImpl(reviewCommentsListUrl(input.context), {
      method: "GET",
      headers: githubHeaders(input.context.token),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (response.status === 403 || response.status === 404 || response.status === 422) {
      return {
        kind: "error",
        warnings: [
          `failed to list prior marked comments (HTTP ${response.status}); preserve state, no resolution applied`,
        ],
      };
    }
    if (!response.ok) {
      return {
        kind: "error",
        warnings: [
          `unexpected listing failure (HTTP ${response.status}); preserve state, no resolution applied`,
        ],
      };
    }
    const json = await readJsonSafe(response);
    if (!Array.isArray(json)) {
      return { kind: "ok", value: [] };
    }
    const parsed: GithubReviewComment[] = [];
    for (const entry of json) {
      const comment = parseReviewComment(entry);
      if (comment !== null) parsed.push(comment);
    }
    return { kind: "ok", value: parsed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "error", warnings: [`network error listing comments: ${msg}; preserve state`] };
  }
}

async function listReviews(input: ReconcileInput): Promise<ListOutcome<GithubReview>> {
  try {
    const response = await input.fetchImpl(reviewsListUrl(input.context), {
      method: "GET",
      headers: githubHeaders(input.context.token),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (response.status === 403 || response.status === 404) {
      return {
        kind: "error",
        warnings: [
          `failed to list reviews (HTTP ${response.status}); preserve state, no resolution applied`,
        ],
      };
    }
    if (!response.ok) {
      return { kind: "error", warnings: [`unexpected reviews-list failure (HTTP ${response.status})`] };
    }
    const json = await readJsonSafe(response);
    if (!Array.isArray(json)) {
      return { kind: "ok", value: [] };
    }
    const parsed: GithubReview[] = [];
    for (const entry of json) {
      const review = parseReview(entry);
      if (review !== null) parsed.push(review);
    }
    return { kind: "ok", value: parsed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "error", warnings: [`network error listing reviews: ${msg}`] };
  }
}

function filterEligibleComments(
  comments: readonly GithubReviewComment[],
  _reviews: readonly GithubReview[],
  ourToken: string,
): readonly GithubReviewComment[] {
  if (ourToken.length === 0) return [];
  return comments.filter((c) => {
    if (!c.body.includes(REVIEW_MARKER)) return false;
    if (extractFingerprint(c.body) === null) return false;
    return true;
  });
}

function computeDeltaTouchedPaths(deltaDiffText: string): ReadonlySet<string> {
  const out = new Set<string>();
  const lines = deltaDiffText.split("\n");
  for (const line of lines) {
    const match = /^diff --git a\/(.+?) b\/(.+?)$/u.exec(line);
    if (match !== null) {
      out.add(match[1]!);
      out.add(match[2]!);
    }
  }
  return out;
}

type Classification = {
  readonly reconsidered: readonly PriorCandidate[];
  readonly carried: readonly ReconciledFinding[];
};

type PriorCandidate = {
  readonly finding: ReconciledFinding;
  readonly comment: GithubReviewComment;
};

function classifyPriorFindings(
  prior: readonly ReconciledFinding[],
  comments: readonly GithubReviewComment[],
  deltaTouched: ReadonlySet<string>,
): Classification {
  const reconsidered: PriorCandidate[] = [];
  const carried: ReconciledFinding[] = [];
  const commentByThreadId = new Map<number, GithubReviewComment>();
  for (const c of comments) commentByThreadId.set(c.id, c);

  for (const finding of prior) {
    const comment = commentByThreadId.get(finding.threadId);
    if (comment === undefined) {
      carried.push(finding);
      continue;
    }
    if (deltaTouched.has(finding.path)) {
      reconsidered.push({ finding, comment });
      continue;
    }
    carried.push(finding);
  }
  return { reconsidered, carried };
}

type ProcessContext = {
  readonly candidate: PriorCandidate;
  readonly newByFingerprint: ReadonlyMap<string, NewProviderFinding>;
  readonly warnings: string[];
  readonly postedThreadIds: number[];
  readonly updatedThreadIds: number[];
};

async function processReconsidered(input: ReconcileInput, ctx: ProcessContext): Promise<ReconcileTransition> {
  const { candidate, newByFingerprint, warnings } = ctx;
  const { finding, comment } = candidate;

  const commentFingerprint = extractFingerprint(comment.body);
  if (commentFingerprint === null || commentFingerprint !== finding.fingerprint) {
    return deferredTransition(finding, "marker fingerprint mismatch; defer");
  }

  const matching = newByFingerprint.get(finding.fingerprint);
  if (matching !== undefined) {
    return processMatchingFinding(input, ctx, matching);
  }

  const verification = await verifyAnchorRemoved(input, {
    path: finding.path,
    line: finding.line,
    fingerprint: finding.fingerprint,
    priorEvidenceText: extractEvidenceText(comment.body),
  });
  if (verification.kind === "error") {
    warnings.push(...verification.warnings);
    return deferredTransition(finding, "verification failed; defer");
  }
  return processResolvedAnchor(input, finding, verification.removed, warnings);
}

async function processMatchingFinding(
  input: ReconcileInput,
  ctx: ProcessContext,
  matching: NewProviderFinding,
): Promise<ReconcileTransition> {
  const { finding, comment } = ctx.candidate;
  const { warnings } = ctx;

  if (comment.body.includes("<!-- umactually:resolved-by-replay -->")) {
    const reopened = await postReopenMarker(input, {
      threadId: finding.threadId,
      newBody: matching.body,
      warnings,
      postedThreadIds: ctx.postedThreadIds,
    });
    if (reopened) {
      return { ...findingTransition(finding, finding.path, finding.line),
        disposition: "updated",
        note: "stale native close detected; posted fresh canonical reopen thread" };
    }
    return deferredTransition(finding, "stale close reopen failed; defer");
  }

  if (normalizeEvidenceText(comment.body) === normalizeEvidenceText(matching.body)) {
    return { ...findingTransition(finding, finding.path, finding.line),
      disposition: "unchanged",
      note: "matching fingerprint, unchanged body" };
  }

  const updated = await patchExistingThread(input, {
    threadId: finding.threadId,
    newBody: matching.body,
    warnings,
    updatedThreadIds: ctx.updatedThreadIds,
  });
  if (updated) {
    return { ...findingTransition(finding, finding.path, finding.line),
      disposition: "updated",
      note: "matching fingerprint, body changed → PATCH" };
  }
  return deferredTransition(finding, "PATCH failed; defer");
}

async function processResolvedAnchor(
  input: ReconcileInput,
  finding: ReconciledFinding,
  removed: boolean,
  warnings: string[],
): Promise<ReconcileTransition> {
  if (!removed) {
    return { ...findingTransition(finding, finding.path, finding.line),
      disposition: "carried",
      note: "verification did not confirm removal; carried" };
  }
  const isFullDecision = (input.decision ?? classifyDecision(input)) === "full";
  if (isFullDecision) {
    return { ...deferredTransitionBase(finding),
      disposition: "superseded",
      note: "full review replaces prior run; prior finding superseded" };
  }
  if (input.resolutionMode === "native-best-effort") {
    const closed = await nativelyCloseThread(input, {
      threadId: finding.threadId,
      warnings,
    });
    if (!closed) {
      return deferredTransition(finding, "native close failed; defer");
    }
  }
  return { ...deferredTransitionBase(finding),
    disposition: "resolved",
    note: "anchor no longer exists; logically resolved" +
      (input.resolutionMode === "native-best-effort" ? " (native-best-effort)" : "") };
}

type TransitionBase = {
  readonly fingerprint: string;
  readonly priorPath: string;
  readonly priorLine: number;
  readonly priorThreadId: number;
  readonly path: string | null;
  readonly line: number | null;
  readonly note: string;
};

function findingTransition(finding: ReconciledFinding, path: string, line: number): TransitionBase {
  return {
    fingerprint: finding.fingerprint,
    priorPath: finding.path,
    priorLine: finding.line,
    priorThreadId: finding.threadId,
    path,
    line,
    note: "",
  };
}

function deferredTransitionBase(finding: ReconciledFinding): TransitionBase {
  return {
    fingerprint: finding.fingerprint,
    priorPath: finding.path,
    priorLine: finding.line,
    priorThreadId: finding.threadId,
    path: null,
    line: null,
    note: "",
  };
}

function deferredTransition(finding: ReconciledFinding, note: string): ReconcileTransition {
  return { ...deferredTransitionBase(finding), disposition: "deferred", note };
}

type VerifyOutcome =
  | { readonly kind: "ok"; readonly removed: boolean }
  | { readonly kind: "error"; readonly warnings: readonly string[] };

async function verifyAnchorRemoved(input: ReconcileInput, opts: {
  readonly path: string;
  readonly line: number;
  readonly fingerprint: string;
  readonly priorEvidenceText: string;
}): Promise<VerifyOutcome> {
  const currentContent = input.currentFiles[opts.path];
  if (currentContent === undefined) {
    return { kind: "ok", removed: true };
  }
  if (currentContent.length === 0) {
    return { kind: "ok", removed: true };
  }
  if (opts.priorEvidenceText.length > 0) {
    const normalized = normalizeEvidenceText(opts.priorEvidenceText);
    const fileNormalized = normalizeEvidenceText(currentContent);
    if (!fileNormalized.includes(normalized)) {
      return { kind: "ok", removed: true };
    }
  }
  try {
    const response = await input.fetchImpl(fileContentsUrl(input.context, opts.path, input.currentHeadSha), {
      method: "GET",
      headers: githubHeaders(input.context.token),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (response.status === 404) {
      return { kind: "ok", removed: true };
    }
    if (!response.ok) {
      return {
        kind: "error",
        warnings: [`contents API HTTP ${response.status} for ${opts.path}; cannot verify anchor`],
      };
    }
    const remoteBody = await readJsonSafe(response);
    const remoteContent = decodeContentsBase64(remoteBody);
    if (remoteContent === null) {
      return { kind: "ok", removed: false };
    }
    const lineCount = remoteContent.split("\n").length;
    if (opts.line > lineCount) {
      return { kind: "ok", removed: true };
    }
    return { kind: "ok", removed: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "error", warnings: [`contents API error for ${opts.path}: ${msg}`] };
  }
}

function decodeContentsBase64(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const content = payload["content"];
  if (typeof content !== "string") return null;
  try {
    return Buffer.from(content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function extractEvidenceText(body: string): string {
  return body
    .replace(/<!--[^>]*-->/gu, "")
    .replace(/`[^`]+`/gu, "")
    .trim();
}

async function patchExistingThread(input: ReconcileInput, opts: {
  readonly threadId: number;
  readonly newBody: string;
  readonly warnings: string[];
  readonly updatedThreadIds: number[];
}): Promise<boolean> {
  try {
    const response = await input.fetchImpl(reviewCommentUrl(input.context, opts.threadId), {
      method: "PATCH",
      headers: githubHeaders(input.context.token),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      body: JSON.stringify({ body: opts.newBody }),
    });
    if (response.status === 403 || response.status === 404 || response.status === 422) {
      opts.warnings.push(`PATCH thread ${opts.threadId} failed HTTP ${response.status}; leave unchanged`);
      return false;
    }
    if (!response.ok) {
      opts.warnings.push(`PATCH thread ${opts.threadId} unexpected HTTP ${response.status}`);
      return false;
    }
    opts.updatedThreadIds.push(opts.threadId);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    opts.warnings.push(`PATCH thread ${opts.threadId} error: ${msg}`);
    return false;
  }
}

async function nativelyCloseThread(input: ReconcileInput, opts: {
  readonly threadId: number;
  readonly warnings: string[];
}): Promise<boolean> {
  try {
    const response = await input.fetchImpl(reviewCommentUrl(input.context, opts.threadId), {
      method: "PATCH",
      headers: githubHeaders(input.context.token),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      body: JSON.stringify({
        body: `<!-- umactually:resolved-by-replay -->\nResolution: anchor verified removed by reconcile.`,
      }),
    });
    if (!response.ok) {
      opts.warnings.push(`native close PATCH failed HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    opts.warnings.push(`native close error: ${msg}`);
    return false;
  }
}

async function postReopenMarker(input: ReconcileInput, opts: {
  readonly threadId: number;
  readonly newBody: string;
  readonly warnings: string[];
  readonly postedThreadIds: number[];
}): Promise<boolean> {
  try {
    const response = await input.fetchImpl(reviewCommentsListUrl(input.context), {
      method: "POST",
      headers: githubHeaders(input.context.token),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      body: JSON.stringify({ body: opts.newBody }),
    });
    if (!response.ok) {
      opts.warnings.push(`reopen POST failed HTTP ${response.status}`);
      return false;
    }
    const json = await readJsonSafe(response);
    if (isRecord(json) && isSafeInteger(json["id"])) {
      opts.postedThreadIds.push(json["id"]);
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    opts.warnings.push(`reopen POST error: ${msg}`);
    return false;
  }
}

async function postNewFinding(input: ReconcileInput, opts: {
  readonly finding: NewProviderFinding;
  readonly warnings: string[];
}): Promise<number | null> {
  try {
    const response = await input.fetchImpl(reviewCommentsListUrl(input.context), {
      method: "POST",
      headers: githubHeaders(input.context.token),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      body: JSON.stringify({
        commit_id: input.currentHeadSha,
        path: opts.finding.path,
        line: opts.finding.line,
        side: "RIGHT",
        body: opts.finding.body,
      }),
    });
    if (response.status === 403 || response.status === 404 || response.status === 422) {
      opts.warnings.push(`POST new finding failed HTTP ${response.status}; mark deferred`);
      return null;
    }
    if (!response.ok) {
      opts.warnings.push(`POST new finding unexpected HTTP ${response.status}; mark deferred`);
      return null;
    }
    const json = await readJsonSafe(response);
    if (isRecord(json) && isSafeInteger(json["id"])) {
      return json["id"];
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    opts.warnings.push(`POST new finding error: ${msg}`);
    return null;
  }
}

function classifyDecision(input: ReconcileInput): ReconcileDecision {
  if (input.priorFindings.length === 0) return "full";
  if (input.priorHeadSha === input.currentHeadSha) return "incremental";
  return "incremental";
}

function classifyDecisionReason(input: ReconcileInput, decision: ReconcileDecision): string {
  if (decision === "full") {
    if (input.priorFindings.length === 0) return "first run on PR";
    return "force-push or rebased head; full review";
  }
  if (input.priorHeadSha === input.currentHeadSha) return "same head SHA; incremental review";
  return "incremental review";
}

function normalizeEvidenceText(body: string): string {
  return body
    .replace(/<!--[^>]*-->/gu, "")
    .replace(/`[^`]+`/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

async function readJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function fingerprintFromProviderComment(input: {
  readonly path: string;
  readonly body: string;
  readonly category: string;
  readonly ruleKey?: string;
}): { readonly fingerprint: string; readonly identityDigest: string } {
  const identityInput: CanonicalFindingInput = {
    path: input.path,
    anchorKind: "hunk",
    symbolName: undefined,
    symbolKind: undefined,
    hunkPreimage: input.body,
    category: input.category,
    ruleKey: input.ruleKey,
    bodyFirstSentence: input.body,
    pathRewrites: undefined,
    caseInsensitive: undefined,
  };
  const identity = computeDurableFindingIdentity(identityInput);
  return { fingerprint: identity.fingerprintDigest, identityDigest: identity.identityDigest };
}

export function summarizeReconcileForLog(result: ReconcileResult): void {
  if (result.kind === "collision") {
    writeBrandedAnnotation(
      "warning",
      `FINGERPRINT_COLLISION: fingerprint ${result.fingerprint} (${result.collisionType}); reconcile aborted, no platform mutation, no state mutation.`,
    );
    return;
  }
  if (result.kind === "aborted") {
    writeBrandedAnnotation(
      "warning",
      `reconcile aborted before any network I/O (reason: ${result.reason}); state preserved, no platform mutation.`,
    );
    return;
  }
  if (result.partialFailure) {
    writeBrandedAnnotation(
      "warning",
      `reconcile partial failure: ${result.transitions.length} transitions, ${result.warnings.length} warning(s); state preserved`,
    );
  }
}

export type RunGithubReconcileOptions = {
  readonly priorFindings: readonly ReconciledFinding[];
  readonly runId: string;
  readonly attemptId: string;
  readonly resolutionMode: ResolutionMode;
};

export async function runGithubLiveWithReconcile(input: {
  readonly context: GithubContext;
  readonly diffText: string;
  readonly provider: LiveProviderOutcome;
  readonly parsed: ParsedCliArgs;
  readonly fetchImpl: FetchImpl;
  readonly options: RunGithubReconcileOptions;
}): Promise<LiveRunResult> {
  const { runGithubLive } = await import("./live-github.js");
  const { context, diffText, provider, parsed, fetchImpl, options } = input;

  const newFindings: NewProviderFinding[] = provider.review.comments.map((comment) => {
    const identity = computeDurableFindingIdentity({
      path: comment.path,
      anchorKind: "hunk",
      symbolName: undefined,
      symbolKind: undefined,
      hunkPreimage: comment.body,
      category: comment.category,
      ruleKey: undefined,
      bodyFirstSentence: comment.body,
      pathRewrites: undefined,
      caseInsensitive: undefined,
    });
    return {
      fingerprint: identity.fingerprintDigest,
      identityDigest: identity.identityDigest,
      path: comment.path,
      line: comment.line,
      body: comment.body,
    };
  });

  const reconcileInput: ReconcileInput = {
    context,
    currentHeadSha: context.headSha,
    priorHeadSha: context.headSha,
    currentFiles: {},
    deltaDiffText: diffText,
    boundedContext: {
      items: [],
      excluded: [],
      budgets: { totalBytes: 0, perFileBytes: 0, maxItems: 0, maxFilesParsed: 0, wallTimeMs: 0 },
      semanticContextStatus: "ready",
      budgetHash: "h",
      bytesUsed: 0,
    },
    priorFindings: options.priorFindings,
    priorReviewId: null,
    newFindings,
    runId: options.runId,
    attemptId: options.attemptId,
    policyHash: "policy-hash",
    resolutionMode: options.resolutionMode,
    fetchImpl,
  };
  const reconcileResult = await runGithubReconcile(reconcileInput);
  summarizeReconcileForLog(reconcileResult);

  return runGithubLive({
    context,
    diffText,
    provider,
    parsed,
    fetchImpl,
  });
}
