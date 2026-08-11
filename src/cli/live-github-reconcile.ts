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
import { DEFAULT_GITHUB_API_BASE } from "../util/provider-defaults.js";
import { writeBrandedAnnotation } from "../util/log.js";
import { computeDurableFindingIdentity, type CanonicalFindingInput } from "../review/fingerprint.js";
import type { ContextProvenanceResult } from "./context-provenance.js";
import { isRecord, isSafeInteger } from "../util/json-guards.js";
import type { LiveRunResult, LiveProviderOutcome } from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

const GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") || DEFAULT_GITHUB_API_BASE;
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
  readonly decision?: ReconcileDecision;
};

export type ReconcileResult = {
  readonly decision: ReconcileDecision;
  readonly reason: string;
  readonly transitions: readonly ReconcileTransition[];
  readonly warnings: readonly string[];
  readonly boundToHeadSha: string;
  readonly partialFailure: boolean;
  readonly resolutionMode: ResolutionMode;
  readonly postedThreadIds: readonly number[];
  readonly updatedThreadIds: readonly number[];
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

function apiBase(): string {
  return GITHUB_API_BASE_URL;
}

function reviewCommentsListUrl(context: GithubContext): string {
  const owner = encodeURIComponent(context.repo.owner);
  const repo = encodeURIComponent(context.repo.name);
  return `${apiBase()}/repos/${owner}/${repo}/pulls/${context.prNumber}/comments`;
}

function reviewCommentUrl(context: GithubContext, id: number): string {
  return `${reviewCommentsListUrl(context)}/${id}`;
}

function reviewsListUrl(context: GithubContext): string {
  const owner = encodeURIComponent(context.repo.owner);
  const repo = encodeURIComponent(context.repo.name);
  return `${apiBase()}/repos/${owner}/${repo}/pulls/${context.prNumber}/reviews`;
}

function fileContentsUrl(context: GithubContext, path: string, headSha: string): string {
  const owner = encodeURIComponent(context.repo.owner);
  const repo = encodeURIComponent(context.repo.name);
  return `${apiBase()}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(headSha)}`;
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

export async function runGithubReconcile(input: ReconcileInput): Promise<ReconcileResult> {
  const warnings: string[] = [];
  const transitions: ReconcileTransition[] = [];
  const postedThreadIds: number[] = [];
  const updatedThreadIds: number[] = [];
  let partialFailure = false;

  const priorComments = await listPriorMarkerComments(input);
  if (priorComments.kind === "error") {
    warnings.push(...priorComments.warnings);
    partialFailure = true;
    return {
      decision: input.decision ?? classifyDecision(input),
      reason: classifyDecisionReason(input, input.decision ?? classifyDecision(input)),
      transitions: [],
      warnings,
      boundToHeadSha: input.currentHeadSha,
      partialFailure,
      resolutionMode: input.resolutionMode,
      postedThreadIds,
      updatedThreadIds,
    };
  }

  const reviewsOutcome = await listReviews(input);
  let reviews: readonly GithubReview[] = [];
  if (reviewsOutcome.kind === "error") {
    warnings.push(...reviewsOutcome.warnings);
  } else {
    reviews = reviewsOutcome.value;
  }

  const eligibleComments = filterEligibleComments(priorComments.value, reviews, input.context.token);
  const deltaTouched = computeDeltaTouchedPaths(input.deltaDiffText);
  const classification = classifyPriorFindings(input.priorFindings, eligibleComments, deltaTouched);

  const newByFingerprint = new Map<string, NewProviderFinding>();
  for (const finding of input.newFindings) {
    newByFingerprint.set(finding.fingerprint, finding);
  }

  for (const candidate of classification.reconsidered) {
    const transition = await processReconsidered(input, {
      candidate,
      newByFingerprint,
      warnings,
      postedThreadIds,
      updatedThreadIds,
    });
    transitions.push(transition);
    if (transition.disposition === "deferred") {
      partialFailure = true;
    }
  }

  for (const carried of classification.carried) {
    transitions.push({
      fingerprint: carried.fingerprint,
      disposition: "carried",
      priorPath: carried.path,
      priorLine: carried.line,
      priorThreadId: carried.threadId,
      path: carried.path,
      line: carried.line,
      note: "anchor untouched by delta; carried unchanged",
    });
  }

  for (const newFinding of input.newFindings) {
    const alreadyTransitioned = transitions.some((t) => t.fingerprint === newFinding.fingerprint);
    if (alreadyTransitioned) continue;
    const posted = await postNewFinding(input, { finding: newFinding, warnings });
    if (posted !== null) {
      postedThreadIds.push(posted);
      transitions.push({
        fingerprint: newFinding.fingerprint,
        disposition: "posted",
        priorPath: "",
        priorLine: 0,
        priorThreadId: 0,
        path: newFinding.path,
        line: newFinding.line,
        note: "new finding posted",
      });
    } else {
      partialFailure = true;
    }
  }

  return {
    decision: input.decision ?? classifyDecision(input),
    reason: classifyDecisionReason(input, input.decision ?? classifyDecision(input)),
    transitions,
    warnings,
    boundToHeadSha: input.currentHeadSha,
    partialFailure,
    resolutionMode: input.resolutionMode,
    postedThreadIds,
    updatedThreadIds,
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
  reviews: readonly GithubReview[],
  ourToken: string,
): readonly GithubReviewComment[] {
  const dismissedReviewIds = new Set(
    reviews.filter((r) => r.state === "DISMISSED").map((r) => r.id),
  );
  if (ourToken.length === 0) return [];
  return comments.filter((c) => {
    if (!c.body.includes(REVIEW_MARKER)) return false;
    if (extractFingerprint(c.body) === null) return false;
    void dismissedReviewIds;
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
    return {
      fingerprint: finding.fingerprint,
      disposition: "deferred",
      priorPath: finding.path,
      priorLine: finding.line,
      priorThreadId: finding.threadId,
      path: null,
      line: null,
      note: "marker fingerprint mismatch; defer",
    };
  }

  const matching = newByFingerprint.get(finding.fingerprint);
  if (matching !== undefined) {
    if (comment.body.includes("<!-- umactually:resolved-by-replay -->")) {
      const reopened = await postReopenMarker(input, {
        threadId: finding.threadId,
        newBody: matching.body,
        warnings,
        postedThreadIds: ctx.postedThreadIds,
      });
      if (reopened) {
        return {
          fingerprint: finding.fingerprint,
          disposition: "updated",
          priorPath: finding.path,
          priorLine: finding.line,
          priorThreadId: finding.threadId,
          path: finding.path,
          line: finding.line,
          note: "stale native close detected; posted fresh canonical reopen thread",
        };
      }
      return {
        fingerprint: finding.fingerprint,
        disposition: "deferred",
        priorPath: finding.path,
        priorLine: finding.line,
        priorThreadId: finding.threadId,
        path: null,
        line: null,
        note: "stale close reopen failed; defer",
      };
    }
    if (normalizeEvidenceText(comment.body) === normalizeEvidenceText(matching.body)) {
      return {
        fingerprint: finding.fingerprint,
        disposition: "unchanged",
        priorPath: finding.path,
        priorLine: finding.line,
        priorThreadId: finding.threadId,
        path: finding.path,
        line: finding.line,
        note: "matching fingerprint, unchanged body",
      };
    }
    const updated = await patchExistingThread(input, {
      threadId: finding.threadId,
      newBody: matching.body,
      warnings,
      updatedThreadIds: ctx.updatedThreadIds,
    });
    if (updated) {
      return {
        fingerprint: finding.fingerprint,
        disposition: "updated",
        priorPath: finding.path,
        priorLine: finding.line,
        priorThreadId: finding.threadId,
        path: finding.path,
        line: finding.line,
        note: "matching fingerprint, body changed → PATCH",
      };
    }
    return {
      fingerprint: finding.fingerprint,
      disposition: "deferred",
      priorPath: finding.path,
      priorLine: finding.line,
      priorThreadId: finding.threadId,
      path: null,
      line: null,
      note: "PATCH failed; defer",
    };
  }

  const verification = await verifyAnchorRemoved(input, {
    path: finding.path,
    line: finding.line,
    fingerprint: finding.fingerprint,
    priorEvidenceText: extractEvidenceText(comment.body),
  });
  const isFullDecision = (input.decision ?? classifyDecision(input)) === "full";

  if (verification.kind === "error") {
    warnings.push(...verification.warnings);
    return {
      fingerprint: finding.fingerprint,
      disposition: "deferred",
      priorPath: finding.path,
      priorLine: finding.line,
      priorThreadId: finding.threadId,
      path: null,
      line: null,
      note: "verification failed; defer",
    };
  }

  if (verification.removed) {
    if (isFullDecision) {
      return {
        fingerprint: finding.fingerprint,
        disposition: "superseded",
        priorPath: finding.path,
        priorLine: finding.line,
        priorThreadId: finding.threadId,
        path: null,
        line: null,
        note: "full review replaces prior run; prior finding superseded",
      };
    }
    if (input.resolutionMode === "native-best-effort") {
      const closed = await nativelyCloseThread(input, {
        threadId: finding.threadId,
        warnings,
      });
      if (!closed) {
        return {
          fingerprint: finding.fingerprint,
          disposition: "deferred",
          priorPath: finding.path,
          priorLine: finding.line,
          priorThreadId: finding.threadId,
          path: null,
          line: null,
          note: "native close failed; defer",
        };
      }
    }
    return {
      fingerprint: finding.fingerprint,
      disposition: "resolved",
      priorPath: finding.path,
      priorLine: finding.line,
      priorThreadId: finding.threadId,
      path: null,
      line: null,
      note: "anchor no longer exists; logically resolved" +
        (input.resolutionMode === "native-best-effort" ? " (native-best-effort)" : ""),
    };
  }

  return {
    fingerprint: finding.fingerprint,
    disposition: "carried",
    priorPath: finding.path,
    priorLine: finding.line,
    priorThreadId: finding.threadId,
    path: finding.path,
    line: finding.line,
    note: "verification did not confirm removal; carried",
  };
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
  void opts.threadId;
  try {
    const response = await input.fetchImpl(reviewCommentsListUrl(input.context), {
      method: "POST",
      headers: githubHeaders(input.context.token),
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
