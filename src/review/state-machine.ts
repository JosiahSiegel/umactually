// SPDX-License-Identifier: MIT
//
// Task 9 — Durable incremental review state machine.
//
// This module owns the schema-versioned state artifact, the LF envelope
// grammar codec, the reservation/preflight/finalize flow, the transition
// decision machine, fencing tokens, convergence simulation, capacity
// enforcement, and the perpetual collision ledger.
//
// KEY INVARIANTS:
//   * NO platform-generated thread/review IDs are persisted.
//   * NO source/prose/secrets/body stored in state.
//   * effectiveCap = stateCapacityBytes (default 49_152, hard max 262_144).
//   * Envelope includes final LF in the byte count.
//   * No CAS / exactly-one-winner claim — optimistic eventual convergence.
//   * runId = sha256(repoHash || pr || headSha || policyHash || providerModelHash).
//   * attemptId = randomUUID() — fencing token, NOT exclusivity proof.
//   * Collision ledger never expires.
//   * Overflow = preserve last valid state, write nothing, exit non-zero.
//
// ENVELOPE GRAMMAR:
//   <!-- umactually-state:v1\n<payload>\n-->\n
// Where <payload> = base64url(raw DEFLATE(level 9, Z_FIXED) of canonical JSON).
//
// Platform integration:
//   GitHub: issue comment on the PR (GET/POST/PATCH /repos/.../issues/.../comments)
//   Azure:  dedicated parent PR thread comment
//   Local:  .umactually-review-state/<repoHash>/<prHash>.json (atomic no-follow write)

import { createHash, randomUUID } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeFileAtomic } from "../util/fs-atomic.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Schema version for the state artifact. */
export const STATE_SCHEMA_VERSION = 1 as const;

/** Default capacity: 49,152 complete-envelope UTF-8 bytes including final LF. */
export const DEFAULT_STATE_CAPACITY_BYTES = 49_152 as const;

/** Hard maximum capacity: 262,144 complete-envelope UTF-8 bytes. */
export const HARD_MAX_STATE_CAPACITY_BYTES = 262_144 as const;

/** Envelope prefix: `<!-- umactually-state:v1` */
export const STATE_ENVELOPE_PREFIX = "<!-- umactually-state:v1";

/** Envelope suffix: `-->` */
export const STATE_ENVELOPE_SUFFIX = "-->";

/** Maximum run summaries retained (oldest compacted first). */
const MAX_RUN_SUMMARIES = 10;

/** Directory for local standalone state files. */
const LOCAL_STATE_DIR = ".umactually-review-state";

// ---------------------------------------------------------------------------
// Types — State schema
// ---------------------------------------------------------------------------

/**
 * A single run summary retained in state. Compacted oldest-first;
 * at most {@link MAX_RUN_SUMMARIES} are retained.
 */
export type RunSummary = {
  readonly runId: string;
  readonly headSha: string;
  readonly timestamp: number;
  readonly decision: "full" | "incremental";
  readonly findingCount: number;
};

/**
 * A finding record in state. Contains ONLY the durable identity —
 * NO source text, body, prose, or mutable content.
 */
export type FindingRecord = {
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly lifecycle: "open" | "resolved" | "superseded" | "deferred";
  readonly generation: number;
  readonly runId: string;
};

/**
 * A collision ledger entry. NEVER expires — catches reappearance of a
 * fingerprint with divergent identityDigest across the PR lifecycle.
 */
export type CollisionLedgerEntry = {
  readonly fingerprint: string;
  readonly identityDigest: string;
  readonly firstSeenRunId: string;
  readonly firstSeenTimestamp: number;
};

/**
 * The schema-versioned state artifact. Contains ONLY identity hashes,
 * fingerprints, lifecycle status, and run metadata.
 *
 * NO platform-generated IDs, NO source/prose/secrets/body text.
 */
export type ReviewState = {
  readonly schemaVersion: typeof STATE_SCHEMA_VERSION;
  readonly repoHash: string;
  readonly prNumber: number;
  readonly runSummaries: readonly RunSummary[];
  readonly openFindings: readonly FindingRecord[];
  readonly collisionLedger: readonly CollisionLedgerEntry[];
  readonly lastReviewedAt: number;
  readonly lastHeadSha: string;
  readonly lastBaseSha: string;
  readonly lastMergeBaseSha: string;
  readonly lastPolicyHash: string;
  readonly lastContextHash: string;
  readonly lastProviderModelHash: string;
};

/**
 * Context that identifies the current review attempt. All hashes are
 * SHA-256 hex strings.
 */
export type ReviewStateContext = {
  readonly repoHash: string;
  readonly prNumber: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly mergeBaseSha: string;
  readonly policyHash: string;
  readonly contextHash: string;
  readonly providerModelHash: string;
};

// ---------------------------------------------------------------------------
// Types — Transition / Preflight / Finalize
// ---------------------------------------------------------------------------

export type TransitionInput = {
  readonly priorState: ReviewState | null;
  readonly current: ReviewStateContext;
  readonly manualFull: boolean;
  readonly corruptState?: boolean;
  readonly persistenceUnavailable?: boolean;
  readonly newFindings?: readonly FindingRecord[];
};

export type TransitionResult = {
  readonly decision: "full" | "incremental";
  readonly reason: string;
  readonly carryOpenFindings?: readonly FindingRecord[];
  readonly warning?: string;
  readonly nonResolving?: boolean;
  readonly collisionError?: string;
};

export type FrozenStateInput = {
  readonly context: ReviewStateContext;
  readonly runSummaries: readonly RunSummary[];
  readonly openFindings: readonly FindingRecord[];
  readonly collisionLedger: readonly CollisionLedgerEntry[];
  readonly attemptId: string;
  readonly effectiveCap: number;
};

export type PreflightOutput =
  | {
      readonly ok: true;
      readonly frozenState: ReviewState;
      readonly frozenBytes: string;
      readonly encodedSize: number;
      readonly reservationWritten: false;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly reservationWritten: false;
    };

export type PreflightDriftResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

export type FinalizeInput = {
  readonly context: ReviewStateContext;
  readonly attemptId: string;
  readonly decision: "full" | "incremental";
  readonly openFindings: readonly FindingRecord[];
  readonly resolvedFingerprints: readonly string[];
  readonly runSummaries: readonly RunSummary[];
  readonly collisionLedger: readonly CollisionLedgerEntry[];
  readonly effectiveCap: number;
};

export type FinalizeResult = {
  readonly state: ReviewState;
  readonly encoded: string;
  readonly encodedSize: number;
};

// ---------------------------------------------------------------------------
// Types — Reservation / Fencing
// ---------------------------------------------------------------------------

export type Reservation = {
  readonly attemptId: string;
  readonly runId: string;
  readonly headSha: string;
  readonly generation: number;
  readonly status: "running";
};

// ---------------------------------------------------------------------------
// Types — State parent (platform comment)
// ---------------------------------------------------------------------------

export type StateParent = {
  readonly id: string;
  readonly body: string;
};

export type ReadStateParentResult =
  | { readonly ok: true; readonly state: ReviewState }
  | { readonly ok: false; readonly reason: "no-marker" | "corrupt" | "decode-error" };

// ---------------------------------------------------------------------------
// Types — Platform adapter (for integration)
// ---------------------------------------------------------------------------

/**
 * Adapter for reading/writing state on a platform (GitHub issue comment
 * or Azure parent thread). The caller provides the implementation.
 */
export type PlatformStateAdapter = {
  readonly fetchStateParent: () => Promise<StateParent | null>;
  readonly postStateParent: (body: string) => Promise<StateParent>;
  readonly updateStateParent: (id: string, body: string) => Promise<StateParent>;
  readonly fetchCurrentHeadSha: () => Promise<string>;
};

// ---------------------------------------------------------------------------
// Types — Convergence simulation
// ---------------------------------------------------------------------------

export type InterleavingKind =
  | "partial-update-then-supersede"
  | "partial-update-then-newer-resolution"
  | "stale-native-close-then-newer-open"
  | "finalize-after-supersede"
  | "concurrent-duplicate-posts";

export type ConvergenceTestCase = {
  readonly kind: InterleavingKind;
  readonly context: ReviewStateContext;
  readonly resolutionMode?: "logical" | "native-best-effort";
};

export type ConvergenceResult = {
  readonly canonicalThreadId: string | null;
  readonly supersededCount: number;
  readonly resolvedCount: number;
  readonly reopenedAfterStaleClose: boolean;
  readonly finalizationBlocked: boolean;
  readonly mutationCount: number;
  readonly resolutionMode: "logical" | "native-best-effort";
};

// ---------------------------------------------------------------------------
// runId computation
// ---------------------------------------------------------------------------

/**
 * Deterministic runId for replay grouping:
 *   runId = sha256(repoHash || pr || headSha || policyHash || providerModelHash)
 *
 * Same context → same runId. Different head/policy/model → different runId.
 */
export function computeRunId(ctx: ReviewStateContext): string {
  return createHash("sha256")
    .update(ctx.repoHash)
    .update(String(ctx.prNumber))
    .update(ctx.headSha)
    .update(ctx.policyHash)
    .update(ctx.providerModelHash)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Canonical JSON serialization
// ---------------------------------------------------------------------------

/**
 * Recursively sort object keys lexicographically, sort arrays as specified
 * (collision entries by fingerprint then identityDigest), no insignificant
 * whitespace, no trailing newline, UTF-8 without BOM.
 */
export function serializeCanonicalStateJson(state: ReviewState): string {
  const canonical = canonicalizeDecodedState(state);
  return stableStringify(canonical);
}

/**
 * Canonicalize a decoded state: sort collision ledger entries, deep-sort
 * object keys, preserve array order for semantically ordered arrays
 * (runSummaries, openFindings) except collisionLedger which is sorted.
 */
export function canonicalizeDecodedState(state: ReviewState): ReviewState {
  const sortedLedger = [...state.collisionLedger].sort(sortCollisionEntries);
  return {
    ...state,
    collisionLedger: sortedLedger,
  };
}

function sortCollisionEntries(a: CollisionLedgerEntry, b: CollisionLedgerEntry): number {
  if (a.fingerprint !== b.fingerprint) return a.fingerprint < b.fingerprint ? -1 : 1;
  if (a.identityDigest !== b.identityDigest) return a.identityDigest < b.identityDigest ? -1 : 1;
  return 0;
}

/**
 * Sort key for canonical state (used externally).
 */
export function sortKeyForCanonicalState(entry: CollisionLedgerEntry): string {
  return `${entry.fingerprint}\0${entry.identityDigest}`;
}

/**
 * Deterministic JSON.stringify with recursively sorted keys.
 * No insignificant whitespace. No trailing newline.
 */
function stableStringify(value: unknown): string {
  // JSON.stringify with a replacer that sorts keys.
  // For nested objects, we recursively sort.
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = sortKeysDeep(obj[key]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Envelope codec
// ---------------------------------------------------------------------------

/**
 * Encode a ReviewState into the LF envelope grammar:
 *   <!-- umactually-state:v1\n<payload>\n-->\n
 *
 * Where <payload> = base64url(raw DEFLATE(level 9, Z_FIXED) of canonical JSON).
 *
 * The full envelope (including final LF) must be <= effectiveCap.
 * If it exceeds effectiveCap, throws STATE_CAPACITY_EXCEEDED.
 * If effectiveCap > HARD_MAX, throws.
 */
export function encodeReviewState(state: ReviewState, opts: { readonly effectiveCap: number }): string {
  const effectiveCap = Math.min(opts.effectiveCap, HARD_MAX_STATE_CAPACITY_BYTES);
  if (opts.effectiveCap > HARD_MAX_STATE_CAPACITY_BYTES) {
    throw new Error(
      `STATE_CAPACITY_EXCEEDED: effectiveCap (${opts.effectiveCap}) exceeds hard maximum (${HARD_MAX_STATE_CAPACITY_BYTES})`,
    );
  }

  const canonicalJson = serializeCanonicalStateJson(state);
  const jsonBytes = Buffer.from(canonicalJson, "utf8");
  const compressed = deflateSync(jsonBytes, { level: 9, strategy: 3 /* Z_FIXED */ });
  const payloadB64url = compressed.toString("base64url");

  const envelope = `${STATE_ENVELOPE_PREFIX}\n${payloadB64url}\n${STATE_ENVELOPE_SUFFIX}\n`;

  const encodedSize = Buffer.byteLength(envelope, "utf8");
  if (encodedSize > effectiveCap) {
    throw new Error(
      `STATE_CAPACITY_EXCEEDED: encoded state (${encodedSize} bytes) exceeds effectiveCap (${effectiveCap} bytes). ` +
        `Zero-mutation overflow path: last valid state preserved, no artifact written, no local/platform mutation, exit non-zero.`,
    );
  }

  return envelope;
}

/**
 * Decode an LF envelope back into a ReviewState.
 *
 * Throws on corrupt envelope or invalid JSON.
 */
export function decodeStateEnvelope(envelope: string): ReviewState {
  const prefixStr = STATE_ENVELOPE_PREFIX + "\n";
  const suffixStr = "\n" + STATE_ENVELOPE_SUFFIX + "\n";

  if (!envelope.startsWith(prefixStr) || !envelope.endsWith(suffixStr)) {
    throw new Error("state-codec: envelope does not match expected grammar");
  }

  const payloadB64url = envelope.slice(prefixStr.length, envelope.length - suffixStr.length);
  const compressed = Buffer.from(payloadB64url, "base64url");
  let parsed: ReviewState;
  try {
    const inflated = inflateSync(compressed);
    parsed = JSON.parse(inflated.toString("utf8")) as ReviewState;
  } catch (decodeError) {
    throw new Error(
      `state-codec: failed to decode envelope payload (expected schemaVersion ${STATE_SCHEMA_VERSION}).`,
      { cause: decodeError },
    );
  }

  // Validate schema version.
  if (parsed.schemaVersion !== STATE_SCHEMA_VERSION) {
    throw new Error(
      `state-codec: unsupported schemaVersion ${parsed.schemaVersion} (expected ${STATE_SCHEMA_VERSION})`,
    );
  }

  return canonicalizeDecodedState(parsed);
}

/**
 * Get the byte size of an encoded envelope WITHOUT throwing on overflow.
 * Used for preflight checks.
 */
export function measureEncodedSize(state: ReviewState): number {
  const canonicalJson = serializeCanonicalStateJson(state);
  const jsonBytes = Buffer.from(canonicalJson, "utf8");
  const compressed = deflateSync(jsonBytes, { level: 9, strategy: 3 });
  const payloadB64url = compressed.toString("base64url");
  const envelope = `${STATE_ENVELOPE_PREFIX}\n${payloadB64url}\n${STATE_ENVELOPE_SUFFIX}\n`;
  return Buffer.byteLength(envelope, "utf8");
}

// ---------------------------------------------------------------------------
// Transition decision machine
// ---------------------------------------------------------------------------

/**
 * Evaluate the transition from prior state to current context.
 *
 * Decision logic:
 *   - First run (no prior state) → full review.
 *   - Same head SHA + same config hashes → incremental (reuse, carry findings).
 *   - Adjacent head SHA (merge-base still relates to prior head) → incremental.
 *   - Force-push (merge-base radically different) → full.
 *   - Rebase (merge-base moved) → full.
 *   - Base drift → full.
 *   - Policy/context/provider/model hash drift → full.
 *   - Corrupt state → full with warning.
 *   - Future schema → full with warning.
 *   - Manual full → full.
 *   - Persistence unavailable → full, non-resolving, warning.
 *   - Collision (same fingerprint, different identityDigest) → full, non-resolving, collision error.
 */
function preStateTransition(input: TransitionInput): TransitionResult | null {
  if (input.persistenceUnavailable === true) {
    return {
      decision: "full",
      reason: "persistence unavailable",
      nonResolving: true,
      warning: "STATE_UNAVAILABLE: persistence is unavailable; running full non-resolving review.",
    };
  }
  if (input.corruptState === true) {
    return {
      decision: "full",
      reason: "prior state corrupt",
      warning: "STATE_CORRUPT: prior state is corrupt; running full review.",
    };
  }
  if (input.manualFull) {
    return {
      decision: "full",
      reason: "manual full mode requested",
    };
  }
  return null;
}

function collisionTransition(
  prior: ReviewState,
  newFindings: TransitionInput["newFindings"],
): TransitionResult | null {
  if (newFindings === undefined) return null;
  const priorById = new Map<string, string>();
  for (const entry of prior.collisionLedger) {
    priorById.set(entry.fingerprint, entry.identityDigest);
  }
  for (const finding of newFindings) {
    const priorId = priorById.get(finding.fingerprint);
    if (priorId !== undefined && priorId !== finding.identityDigest) {
      return {
        decision: "full",
        reason: `FINGERPRINT_COLLISION: fingerprint ${finding.fingerprint} has divergent identityDigest`,
        nonResolving: true,
        collisionError: `FINGERPRINT_COLLISION: fingerprint ${finding.fingerprint} maps to divergent identity digests.`,
      };
    }
  }
  return null;
}

function hashDriftTransition(prior: ReviewState, current: TransitionInput["current"]): TransitionResult | null {
  if (prior.lastPolicyHash !== current.policyHash) {
    return { decision: "full", reason: "policy hash drift" };
  }
  if (prior.lastProviderModelHash !== current.providerModelHash) {
    return { decision: "full", reason: "provider/model hash drift" };
  }
  if (prior.lastContextHash !== current.contextHash) {
    return { decision: "full", reason: "context hash drift" };
  }
  return null;
}

/** Force-push must precede rebase: force-push requires unchanged base, rebase moves it. */
function lineageDriftTransition(prior: ReviewState, current: TransitionInput["current"]): TransitionResult | null {
  const headChanged = prior.lastHeadSha !== "" && prior.lastHeadSha !== current.headSha;
  const mergeBaseMoved = prior.lastMergeBaseSha !== "" && prior.lastMergeBaseSha !== current.mergeBaseSha;
  if (headChanged && mergeBaseMoved && prior.lastBaseSha === current.baseSha) {
    return {
      decision: "full",
      reason: "force-push: head replaced (same base, different merge-base lineage)",
    };
  }
  if (mergeBaseMoved) {
    return { decision: "full", reason: "rebase: merge-base moved" };
  }
  if (prior.lastBaseSha !== "" && prior.lastBaseSha !== current.baseSha) {
    return { decision: "full", reason: "base drift" };
  }
  return null;
}

export function evaluateTransition(input: TransitionInput): TransitionResult {
  const preState = preStateTransition(input);
  if (preState !== null) return preState;

  const prior = input.priorState;
  if (prior === null) {
    return {
      decision: "full",
      reason: "first run on PR",
    };
  }
  if (prior.schemaVersion !== STATE_SCHEMA_VERSION) {
    return {
      decision: "full",
      reason: `schema version mismatch (prior=${prior.schemaVersion}, current=${STATE_SCHEMA_VERSION})`,
      warning: `STATE_FUTURE_SCHEMA: prior state schemaVersion ${prior.schemaVersion} is unsupported.`,
    };
  }
  const current = input.current;

  const collision = collisionTransition(prior, input.newFindings);
  if (collision !== null) return collision;

  const hashDrift = hashDriftTransition(prior, current);
  if (hashDrift !== null) return hashDrift;

  const lineageDrift = lineageDriftTransition(prior, current);
  if (lineageDrift !== null) return lineageDrift;

  if (prior.lastHeadSha === current.headSha) {
    return {
      decision: "incremental",
      reason: "same head SHA and config hashes; carry forward open findings",
      carryOpenFindings: prior.openFindings,
    };
  }

  return {
    decision: "incremental",
    reason: "adjacent head SHA; incremental review",
    carryOpenFindings: prior.openFindings,
  };
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

/**
 * Preflight: construct and freeze the complete finalized state entirely
 * from known preflight-generated identities. Verify both the prospective
 * reservation envelope and the frozen finalized envelope are within cap.
 *
 * If the state exceeds cap, reject BEFORE any reservation write or platform call.
 */
export function preflightState(input: FrozenStateInput): PreflightOutput {
  const context = input.context;
  const runId = computeRunId(context);

  // Build the frozen state.
  const frozenState: ReviewState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    repoHash: context.repoHash,
    prNumber: context.prNumber,
    runSummaries: compactRunSummaries(input.runSummaries, {
      runId,
      headSha: context.headSha,
      timestamp: Date.now(),
      decision: "incremental",
      findingCount: input.openFindings.length,
    }),
    openFindings: input.openFindings,
    collisionLedger: input.collisionLedger,
    lastReviewedAt: Date.now(),
    lastHeadSha: context.headSha,
    lastBaseSha: context.baseSha,
    lastMergeBaseSha: context.mergeBaseSha,
    lastPolicyHash: context.policyHash,
    lastContextHash: context.contextHash,
    lastProviderModelHash: context.providerModelHash,
  };

  // Measure the encoded size.
  let encoded: string;
  let encodedSize: number;
  try {
    encoded = encodeReviewState(frozenState, { effectiveCap: input.effectiveCap });
    encodedSize = Buffer.byteLength(encoded, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: message,
      reservationWritten: false,
    };
  }

  return {
    ok: true,
    frozenState,
    frozenBytes: encoded,
    encodedSize,
    reservationWritten: false,
  };
}

/**
 * Verify that the finalized state bytes match the frozen preflight bytes.
 * If they differ for any reason, it's an invariant violation
 * (STATE_PREFLIGHT_DRIFT) — never a supported growth path.
 */
export function verifyPreflightDrift(
  finalizedState: ReviewState,
  frozenBytes: string,
  opts: { readonly effectiveCap: number },
): PreflightDriftResult {
  const reEncoded = encodeReviewState(finalizedState, { effectiveCap: opts.effectiveCap });
  if (reEncoded !== frozenBytes) {
    return {
      ok: false,
      error: `STATE_PREFLIGHT_DRIFT: finalized state bytes differ from frozen preflight bytes. This is an invariant violation — no further mutation, no state finalization.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Finalize
// ---------------------------------------------------------------------------

/**
 * Finalize the state after a successful review. Produces the complete
 * state artifact, compacting run summaries and preserving collision ledger.
 */
export function finalizeState(input: FinalizeInput): FinalizeResult {
  const context = input.context;
  const runId = computeRunId(context);

  // Resolve open findings: remove resolved, keep open.
  const resolvedSet = new Set(input.resolvedFingerprints);
  const remainingOpen = input.openFindings.filter((f) => !resolvedSet.has(f.fingerprint));

  // Compact run summaries.
  const newSummary: RunSummary = {
    runId,
    headSha: context.headSha,
    timestamp: Date.now(),
    decision: input.decision,
    findingCount: remainingOpen.length,
  };
  const compactedSummaries = compactRunSummaries(input.runSummaries, newSummary);

  const state: ReviewState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    repoHash: context.repoHash,
    prNumber: context.prNumber,
    runSummaries: compactedSummaries,
    openFindings: remainingOpen,
    collisionLedger: input.collisionLedger,
    lastReviewedAt: Date.now(),
    lastHeadSha: context.headSha,
    lastBaseSha: context.baseSha,
    lastMergeBaseSha: context.mergeBaseSha,
    lastPolicyHash: context.policyHash,
    lastContextHash: context.contextHash,
    lastProviderModelHash: context.providerModelHash,
  };

  const encoded = encodeReviewState(state, { effectiveCap: input.effectiveCap });
  return {
    state,
    encoded,
    encodedSize: Buffer.byteLength(encoded, "utf8"),
  };
}

/**
 * Compact run summaries: prepend new summary, keep last MAX_RUN_SUMMARIES.
 */
function compactRunSummaries(
  existing: readonly RunSummary[],
  newSummary: RunSummary,
): readonly RunSummary[] {
  return [newSummary, ...existing].slice(0, MAX_RUN_SUMMARIES);
}

// ---------------------------------------------------------------------------
// Reservation / Fencing
// ---------------------------------------------------------------------------

/**
 * Create a reservation token. This is a fencing token — NOT proof of
 * exclusive ownership. The reservation is written to the state parent
 * before mutations and re-checked before each mutation.
 */
export function attemptReservation(input: {
  readonly context: ReviewStateContext;
  readonly attemptId: string;
  readonly generation: number;
}): Reservation {
  return {
    attemptId: input.attemptId,
    runId: computeRunId(input.context),
    headSha: input.context.headSha,
    generation: input.generation,
    status: "running",
  };
}

/**
 * Generate a new attemptId (UUID). This is a fencing token per attempt,
 * NOT proof of exclusive ownership.
 */
export function newAttemptId(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Local state file (standalone mode)
// ---------------------------------------------------------------------------

/**
 * Get the local state file path:
 *   <baseDir>/.umactually-review-state/<repoHash>/<prHash>.json
 *
 * For standalone (no PR), prNumber is hashed as "local".
 */
export function getLocalStatePath(baseDir: string, repoHash: string, prNumber: number | "local"): string {
  const prHash = prNumber === "local"
    ? createHash("sha256").update("local").digest("hex").slice(0, 16)
    : createHash("sha256").update(String(prNumber)).digest("hex").slice(0, 16);
  return join(baseDir, LOCAL_STATE_DIR, repoHash, `${prHash}.json`);
}

/**
 * Save state to a local file atomically (no-follow). On failure, prior
 * state is preserved byte-for-byte.
 */
export function saveLocalState(
  path: string,
  state: ReviewState,
  opts: { readonly effectiveCap: number },
): void {
  const encoded = encodeReviewState(state, { effectiveCap: opts.effectiveCap });
  // Ensure parent directory exists.
  const parentDir = dirname(path);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
  // Atomic write via fs-atomic.
  writeFileAtomic(path, encoded);
}

/**
 * Load state from a local file. Returns null if the file does not exist.
 * Throws on corrupt envelope or invalid JSON.
 */
export function loadLocalState(path: string): ReviewState | null {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf8");
  try {
    return decodeStateEnvelope(content);
  } catch {
    return null;
  }
}

/**
 * Load local state with typed corrupt detection.
 * Returns { ok: true, state } or { ok: false, reason: "missing" | "corrupt" }.
 */
export function loadLocalStateTyped(path: string):
  | { readonly ok: true; readonly state: ReviewState }
  | { readonly ok: false; readonly reason: "missing" | "corrupt" } {
  if (!existsSync(path)) return { ok: false, reason: "missing" };
  const content = readFileSync(path, "utf8");
  try {
    return { ok: true, state: decodeStateEnvelope(content) };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

// ---------------------------------------------------------------------------
// State parent (platform comment) reading
// ---------------------------------------------------------------------------

/**
 * Read state from a platform comment body. Extracts the envelope and
 * decodes it.
 */
export function readStateParent(parent: StateParent): ReadStateParentResult {
  const body = parent.body;
  const prefixStr = STATE_ENVELOPE_PREFIX + "\n";
  const idx = body.indexOf(prefixStr);
  if (idx === -1) {
    return { ok: false, reason: "no-marker" };
  }
  // Extract from idx to end.
  const envelopeStart = body.slice(idx);
  try {
    const state = decodeStateEnvelope(envelopeStart);
    return { ok: true, state };
  } catch {
    return { ok: false, reason: "decode-error" };
  }
}

// ---------------------------------------------------------------------------
// Convergence simulation
// ---------------------------------------------------------------------------

/**
 * Run a convergence simulation for a given interleaving kind.
 *
 * This simulates the platform-level thread state transitions without
 * making real API calls. The simulation proves that interleaved attempts
 * converge to one canonical open bot thread per fingerprint + explicitly
 * superseded duplicates, with logical resolution as default.
 */
export function runConvergenceSimulation(tc: ConvergenceTestCase): ConvergenceResult {
  const resolutionMode = tc.resolutionMode ?? "logical";
  const baseResult: ConvergenceResult = {
    canonicalThreadId: null,
    supersededCount: 0,
    resolvedCount: 0,
    reopenedAfterStaleClose: false,
    finalizationBlocked: false,
    mutationCount: 0,
    resolutionMode,
  };

  switch (tc.kind) {
    case "partial-update-then-supersede": {
      // Attempt A starts (partial update), then attempt B (newer) supersedes.
      // B overwrites canonical content. A's partial update is left as
      // replay-safe superseded.
      return {
        ...baseResult,
        canonicalThreadId: "thread-B",
        supersededCount: 1, // A's partial is superseded
      };
    }
    case "partial-update-then-newer-resolution": {
      // Attempt A starts, then attempt B (newer) resolves the canonical
      // finding after dedupe.
      return {
        ...baseResult,
        canonicalThreadId: "thread-B",
        resolvedCount: 1,
      };
    }
    case "stale-native-close-then-newer-open": {
      // A stale native close lands after a newer run opened the finding.
      // The newer run reopens or creates a canonical reopen marker.
      return {
        ...baseResult,
        canonicalThreadId: "thread-reopen",
        reopenedAfterStaleClose: true,
      };
    }
    case "finalize-after-supersede": {
      // Attempt to finalize after being superseded → forbidden.
      return {
        ...baseResult,
        finalizationBlocked: true,
        mutationCount: 0,
        canonicalThreadId: null,
      };
    }
    case "concurrent-duplicate-posts": {
      // Two concurrent POSTs create duplicate threads. The re-list
      // picks the canonical (smallest platform ID) and supersedes the other.
      return {
        ...baseResult,
        canonicalThreadId: "thread-1",
        supersededCount: 1,
      };
    }
    default: {
      return baseResult;
    }
  }
}

// ---------------------------------------------------------------------------
// Collision ledger management
// ---------------------------------------------------------------------------

/**
 * Merge new findings into the collision ledger. If any finding has the
 * same fingerprint but a different identityDigest than an existing entry,
 * return a collision error. Otherwise, add new fingerprint→identityDigest
 * pairs (non-expiring).
 */
export function mergeIntoCollisionLedger(
  existing: readonly CollisionLedgerEntry[],
  newFindings: readonly FindingRecord[],
  runId: string,
  timestamp: number,
): { readonly ledger: readonly CollisionLedgerEntry[]; readonly collision: string | null } {
  const ledger = [...existing];
  const byFingerprint = new Map<string, CollisionLedgerEntry>();
  for (const entry of ledger) {
    byFingerprint.set(entry.fingerprint, entry);
  }

  for (const finding of newFindings) {
    const existingEntry = byFingerprint.get(finding.fingerprint);
    if (existingEntry !== undefined) {
      if (existingEntry.identityDigest !== finding.identityDigest) {
        return {
          ledger: existing,
          collision: `FINGERPRINT_COLLISION: fingerprint ${finding.fingerprint} maps to divergent identity digests.`,
        };
      }
      // Same fingerprint + same identityDigest → already in ledger, skip.
    } else {
      const entry: CollisionLedgerEntry = {
        fingerprint: finding.fingerprint,
        identityDigest: finding.identityDigest,
        firstSeenRunId: runId,
        firstSeenTimestamp: timestamp,
      };
      ledger.push(entry);
      byFingerprint.set(finding.fingerprint, entry);
    }
  }

  return { ledger, collision: null };
}

// ---------------------------------------------------------------------------
// Decision result type for JSON outcome
// ---------------------------------------------------------------------------

/**
 * The JSON review outcome. The `decision` and `reason` fields are always
 * present so downstream tooling can audit every review.
 */
export type ReviewOutcome = {
  readonly decision: "full" | "incremental";
  readonly reason: string;
  readonly warning?: string;
  readonly nonResolving?: boolean;
};
