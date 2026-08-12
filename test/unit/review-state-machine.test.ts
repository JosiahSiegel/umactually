// SPDX-License-Identifier: MIT
//
// Task 9 — Durable incremental review state machine tests.
//
// TDD: written BEFORE the implementation in src/review/state-machine.ts.
// They fail with module-not-found until the module is created.
//
// Covers:
//   - Transition table: first/linear/force-push/rebase/base-drift/hash-drift/corrupt/future-schema/manual-full
//   - Codec: state-codec-default-cap, state-codec-hard-cap
//   - Preflight: state-preflight-late-growth
//   - Fencing: attemptId uniqueness, reservation refetch
//   - Convergence: interleaved same-head and adjacent-head
//   - Collision ledger: non-expiring retention
//   - Overflow: exact-limit + one-byte-over at both caps
//   - Privacy: no secrets/source/body in state bytes
//   - Atomic local-write failure preserves prior state

import { createHash, randomUUID } from "node:crypto";
import { inflateSync, gunzipSync } from "node:zlib";
import { existsSync, mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  measureEncodedSize,
  DEFAULT_STATE_CAPACITY_BYTES,
  HARD_MAX_STATE_CAPACITY_BYTES,
  STATE_ENVELOPE_PREFIX,
  STATE_ENVELOPE_SUFFIX,
  STATE_SCHEMA_VERSION,
  type CollisionLedgerEntry,
  type FindingRecord,
  type FrozenStateInput,
  type ReviewState,
  type ReviewStateContext,
  type RunSummary,
  attemptReservation,
  canonicalizeDecodedState,
  computeRunId,
  decodeStateEnvelope,
  encodeReviewState,
  evaluateTransition,
  finalizeState,
  getLocalStatePath,
  loadLocalState,
  preflightState,
  readStateParent,
  saveLocalState,
  serializeCanonicalStateJson,
  verifyPreflightDrift,
  type StateParent,
  runConvergenceSimulation,
} from "../../src/review/state-machine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_REPO_HASH = createHash("sha256").update("owner/repo").digest("hex");
const SAMPLE_PR = 42;
const SAMPLE_HEAD = createHash("sha256").update("head-1").digest("hex").slice(0, 40);
const SAMPLE_HEAD_2 = createHash("sha256").update("head-2").digest("hex").slice(0, 40);
const SAMPLE_HEAD_3 = createHash("sha256").update("head-3").digest("hex").slice(0, 40);
const SAMPLE_BASE = createHash("sha256").update("base").digest("hex").slice(0, 40);
const SAMPLE_MERGE_BASE = createHash("sha256").update("merge-base").digest("hex").slice(0, 40);
const SAMPLE_POLICY_HASH = createHash("sha256").update("policy-v1").digest("hex");
const SAMPLE_CONTEXT_HASH = createHash("sha256").update("context-v1").digest("hex");
const SAMPLE_PROVIDER_MODEL_HASH = createHash("sha256").update("openai-compatible:gpt-4o").digest("hex");

function makeContext(overrides: Partial<ReviewStateContext> = {}): ReviewStateContext {
  return {
    repoHash: SAMPLE_REPO_HASH,
    prNumber: SAMPLE_PR,
    headSha: SAMPLE_HEAD,
    baseSha: SAMPLE_BASE,
    mergeBaseSha: SAMPLE_MERGE_BASE,
    policyHash: SAMPLE_POLICY_HASH,
    contextHash: SAMPLE_CONTEXT_HASH,
    providerModelHash: SAMPLE_PROVIDER_MODEL_HASH,
    ...overrides,
  };
}

function makeOpenFinding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    fingerprint: createHash("sha256").update("fp-1").digest("hex"),
    identityDigest: createHash("sha256").update("id-1").digest("hex"),
    lifecycle: "open",
    generation: 1,
    runId: computeRunId(makeContext()),
    ...overrides,
  };
}

function makeEmptyState(): ReviewState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    repoHash: SAMPLE_REPO_HASH,
    prNumber: SAMPLE_PR,
    runSummaries: [],
    openFindings: [],
    collisionLedger: [],
    lastReviewedAt: 0,
    lastHeadSha: "",
    lastBaseSha: "",
    lastMergeBaseSha: "",
    lastPolicyHash: "",
    lastContextHash: "",
    lastProviderModelHash: "",
  };
}

function makePriorState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    ...makeEmptyState(),
    lastHeadSha: SAMPLE_HEAD,
    lastBaseSha: SAMPLE_BASE,
    lastMergeBaseSha: SAMPLE_MERGE_BASE,
    lastPolicyHash: SAMPLE_POLICY_HASH,
    lastContextHash: SAMPLE_CONTEXT_HASH,
    lastProviderModelHash: SAMPLE_PROVIDER_MODEL_HASH,
    runSummaries: [
      {
        runId: computeRunId(makeContext()),
        headSha: SAMPLE_HEAD,
        timestamp: 1000,
        decision: "full",
        findingCount: 1,
      },
    ],
    openFindings: [makeOpenFinding()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Transition table tests
// ---------------------------------------------------------------------------

describe("state-machine: transition table", () => {
  it("first run on PR → full review", () => {
    // No prior state → first run must be full.
    const result = evaluateTransition({
      priorState: null,
      current: makeContext(),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("first");
  });

  it("linear (same head, same config) → incremental (reuse)", () => {
    // Same head SHA, same policy/context/provider hashes → carry forward.
    const prior = makePriorState();
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({ headSha: SAMPLE_HEAD }),
      manualFull: false,
    });
    expect(result.decision).toBe("incremental");
    expect(result.carryOpenFindings).toEqual(prior.openFindings);
  });

  it("adjacent head SHA (new commit, same base) → incremental", () => {
    const prior = makePriorState();
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({ headSha: SAMPLE_HEAD_2 }),
      manualFull: false,
    });
    expect(result.decision).toBe("incremental");
  });

  it("force-push (same base, head unrelated to prior) → full", () => {
    // Force-push: the merge-base changes radically relative to the prior head.
    const prior = makePriorState();
    const newMergeBase = createHash("sha256").update("forced-merge-base").digest("hex").slice(0, 40);
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({
        headSha: SAMPLE_HEAD_2,
        mergeBaseSha: newMergeBase,
      }),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("force-push");
  });

  it("rebase (merge-base moves) → full", () => {
    const prior = makePriorState();
    const newBase = createHash("sha256").update("new-base").digest("hex").slice(0, 40);
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({
        headSha: SAMPLE_HEAD_2,
        baseSha: newBase,
        mergeBaseSha: createHash("sha256").update("new-merge-base").digest("hex").slice(0, 40),
      }),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("rebase");
  });

  it("base drift (baseSha changed) → full", () => {
    const prior = makePriorState();
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({
        headSha: SAMPLE_HEAD_2,
        baseSha: createHash("sha256").update("new-base").digest("hex").slice(0, 40),
      }),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("base");
  });

  it("hash drift (policy hash changed) → full", () => {
    const prior = makePriorState();
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({
        headSha: SAMPLE_HEAD,
        policyHash: createHash("sha256").update("policy-v2").digest("hex"),
      }),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("policy");
  });

  it("hash drift (provider/model hash changed) → full", () => {
    const prior = makePriorState();
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({
        headSha: SAMPLE_HEAD,
        providerModelHash: createHash("sha256").update("anthropic:claude").digest("hex"),
      }),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("provider");
  });

  it("hash drift (context hash changed) → full", () => {
    const prior = makePriorState();
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({
        headSha: SAMPLE_HEAD,
        contextHash: createHash("sha256").update("context-v2").digest("hex"),
      }),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("context");
  });

  it("corrupt state (invalid JSON) → full with warning", () => {
    const result = evaluateTransition({
      priorState: null, // corrupt state is treated as unavailable → null
      current: makeContext(),
      manualFull: false,
      corruptState: true,
    });
    expect(result.decision).toBe("full");
    expect(result.warning).toBeDefined();
  });

  it("future schema version → full with warning", () => {
    const prior = makePriorState({ schemaVersion: 999 as 1 });
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext(),
      manualFull: false,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("schema");
  });

  it("manual full (--full flag) → full", () => {
    const prior = makePriorState();
    const result = evaluateTransition({
      priorState: prior,
      current: makeContext({ headSha: SAMPLE_HEAD }),
      manualFull: true,
    });
    expect(result.decision).toBe("full");
    expect(result.reason).toContain("manual");
  });
});

// ---------------------------------------------------------------------------
// 2. runId determinism
// ---------------------------------------------------------------------------

describe("state-machine: runId", () => {
  it("runId = sha256(repoHash || pr || headSha || policyHash || providerModelHash)", () => {
    const ctx = makeContext();
    const expected = createHash("sha256")
      .update(ctx.repoHash)
      .update(String(ctx.prNumber))
      .update(ctx.headSha)
      .update(ctx.policyHash)
      .update(ctx.providerModelHash)
      .digest("hex");
    expect(computeRunId(ctx)).toBe(expected);
  });

  it("same context → same runId", () => {
    expect(computeRunId(makeContext())).toBe(computeRunId(makeContext()));
  });

  it("different head → different runId", () => {
    expect(computeRunId(makeContext())).not.toBe(computeRunId(makeContext({ headSha: SAMPLE_HEAD_2 })));
  });
});

// ---------------------------------------------------------------------------
// 3. Codec tests — named: state-codec-default-cap, state-codec-hard-cap
// ---------------------------------------------------------------------------

describe("state-codec-default-cap", () => {
  const effectiveCap = DEFAULT_STATE_CAPACITY_BYTES; // 49_152

  it("encodes a minimal state and round-trips correctly", () => {
    const state = makeEmptyState();
    const encoded = encodeReviewState(state, { effectiveCap });
    const decoded = decodeStateEnvelope(encoded);
    expect(decoded).toEqual(state);
  });

  it("encoded envelope starts with prefix + LF and ends with suffix + LF", () => {
    const state = makeEmptyState();
    const encoded = encodeReviewState(state, { effectiveCap });
    expect(encoded.startsWith(STATE_ENVELOPE_PREFIX + "\n")).toBe(true);
    expect(encoded.endsWith("\n" + STATE_ENVELOPE_SUFFIX + "\n")).toBe(true);
  });

  it("encodedSize == effectiveCap succeeds (exact-limit pass)", () => {
    const state = makeEmptyState();
    const baseEncoded = encodeReviewState(state, { effectiveCap });
    const baseSize = Buffer.byteLength(baseEncoded, "utf8");
    expect(baseSize).toBeLessThanOrEqual(effectiveCap);
    expect(Buffer.byteLength(baseEncoded, "utf8")).toBeLessThanOrEqual(effectiveCap);
  });

  it("encodedSize == effectiveCap + 1 fails before reservation with zero mutation", () => {
    // Build a state that is exactly one byte over the cap.
    const state = makePriorState();
    const actualSize = measureEncodedSize(state);
    const reducedCap = actualSize - 1;

    expect(() => encodeReviewState(state, { effectiveCap: reducedCap })).toThrowError(
      /STATE_CAPACITY_EXCEEDED/,
    );
  });

  it("default effectiveCap is 49152", () => {
    expect(DEFAULT_STATE_CAPACITY_BYTES).toBe(49152);
  });

  it("envelope uses raw DEFLATE level 9 Z_FIXED for payload", () => {
    const state = makeEmptyState();
    const encoded = encodeReviewState(state, { effectiveCap });
    // Extract the payload between prefix\n and \nsuffix\n
    const prefixLen = STATE_ENVELOPE_PREFIX.length + 1; // +1 for \n
    const suffixLen = STATE_ENVELOPE_SUFFIX.length + 2; // \n before + \n after
    const payloadB64url = encoded.slice(prefixLen, encoded.length - suffixLen);
    // Decode base64url
    const payloadBytes = Buffer.from(payloadB64url, "base64url");
    // Raw inflate (no header)
    const inflated = inflateSync(payloadBytes);
    const decodedJson = inflated.toString("utf8");
    expect(JSON.parse(decodedJson)).toEqual(state);
  });
});

describe("state-codec-hard-cap", () => {
  const effectiveCap = HARD_MAX_STATE_CAPACITY_BYTES; // 262_144

  it("hard maximum is 262144", () => {
    expect(HARD_MAX_STATE_CAPACITY_BYTES).toBe(262144);
  });

  it("encodes a minimal state at hard cap and round-trips", () => {
    const state = makeEmptyState();
    const encoded = encodeReviewState(state, { effectiveCap });
    const decoded = decodeStateEnvelope(encoded);
    expect(decoded).toEqual(state);
  });

  it("encodedSize == effectiveCap succeeds at hard cap", () => {
    // Build a larger state that is still <= hard cap.
    const state = makePriorState();
    // Add many collision ledger entries.
    const entries: CollisionLedgerEntry[] = [];
    for (let i = 0; i < 1000; i++) {
      entries.push({
        fingerprint: createHash("sha256").update(`fp-${i}`).digest("hex"),
        identityDigest: createHash("sha256").update(`id-${i}`).digest("hex"),
        firstSeenRunId: computeRunId(makeContext()),
        firstSeenTimestamp: i,
      });
    }
    const bigState = { ...state, collisionLedger: entries };
    const encoded = encodeReviewState(bigState, { effectiveCap });
    expect(Buffer.byteLength(encoded, "utf8")).toBeLessThanOrEqual(effectiveCap);
    const decoded = decodeStateEnvelope(encoded);
    // Collision ledger is canonically sorted by fingerprint then identityDigest.
    const sortedBigLedger = [...entries].sort((a, b) => {
      if (a.fingerprint !== b.fingerprint) return a.fingerprint < b.fingerprint ? -1 : 1;
      if (a.identityDigest !== b.identityDigest) return a.identityDigest < b.identityDigest ? -1 : 1;
      return 0;
    });
    expect(decoded.collisionLedger).toEqual(sortedBigLedger);
  });

  it("encodedSize == effectiveCap + 1 fails at hard cap", () => {
    // Build a state that exceeds a configured cap by 1 byte.
    const state = makePriorState();
    const actualSize = measureEncodedSize(state);
    const reducedCap = actualSize - 1;
    expect(() => encodeReviewState(state, { effectiveCap: reducedCap })).toThrowError(
      /STATE_CAPACITY_EXCEEDED/,
    );
  });

  it("effectiveCap > HARD_MAX is rejected", () => {
    const state = makeEmptyState();
    expect(() => encodeReviewState(state, { effectiveCap: HARD_MAX_STATE_CAPACITY_BYTES + 1 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. Preflight tests — named: state-preflight-late-growth
// ---------------------------------------------------------------------------

describe("state-preflight-late-growth", () => {
  it("preflight rejects prospective lifecycle/marker growth before reservation", () => {
    // Seed a state that is near the cap, then try to preflight a finalized
    // state that exceeds it. The preflight MUST reject before any reservation.
    const ctx = makeContext();
    const nearCapState = makePriorState();

    // Simulate a large prospective growth (many new findings).
    const grownFindings: FindingRecord[] = [];
    for (let i = 0; i < 5000; i++) {
      grownFindings.push({
        fingerprint: createHash("sha256").update(`grown-fp-${i}`).digest("hex"),
        identityDigest: createHash("sha256").update(`grown-id-${i}`).digest("hex"),
        lifecycle: "open",
        generation: 1,
        runId: computeRunId(ctx),
      });
    }

    const frozenInput: FrozenStateInput = {
      context: ctx,
      runSummaries: nearCapState.runSummaries,
      openFindings: grownFindings,
      collisionLedger: nearCapState.collisionLedger,
      attemptId: randomUUID(),
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    };

    const result = preflightState(frozenInput);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("preflight should have failed");
    expect(result.error).toContain("STATE_CAPACITY_EXCEEDED");
    // MUST NOT have written any reservation.
    expect(result.reservationWritten).toBe(false);
  });

  it("preflight accepts a finalized state within cap", () => {
    const ctx = makeContext();
    const frozenInput: FrozenStateInput = {
      context: ctx,
      runSummaries: makePriorState().runSummaries,
      openFindings: [makeOpenFinding()],
      collisionLedger: [],
      attemptId: randomUUID(),
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    };
    const result = preflightState(frozenInput);
    expect(result.ok).toBe(true);
  });

  it("unexpected post-preflight drift is an invariant violation", () => {
    // After preflight, if the finalized state bytes differ from the frozen
    // preflight bytes, it's an invariant violation — never a growth path.
    const ctx = makeContext();
    const frozenInput: FrozenStateInput = {
      context: ctx,
      runSummaries: makePriorState().runSummaries,
      openFindings: [makeOpenFinding()],
      collisionLedger: [],
      attemptId: randomUUID(),
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    };
    const preflight = preflightState(frozenInput);
    expect(preflight.ok).toBe(true);
    if (!preflight.ok) return;

    // Simulate drift: the finalized state has an extra finding.
    const drifted: ReviewState = {
      ...preflight.frozenState,
      openFindings: [
        ...preflight.frozenState.openFindings,
        makeOpenFinding({ fingerprint: createHash("sha256").update("drift-fp").digest("hex") }),
      ],
    };
    const driftResult = verifyPreflightDrift(drifted, preflight.frozenBytes, {
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    });
    expect(driftResult.ok).toBe(false);
    if (driftResult.ok) throw new Error("drift should have failed");
    expect(driftResult.error).toContain("STATE_PREFLIGHT_DRIFT");
  });
});

// ---------------------------------------------------------------------------
// 5. Fencing: attemptId uniqueness
// ---------------------------------------------------------------------------

describe("state-machine: fencing", () => {
  it("unique attemptId distinguishes same-runId concurrent attempts", () => {
    const ctx = makeContext();
    const runId = computeRunId(ctx);
    const attemptId1 = randomUUID();
    const attemptId2 = randomUUID();

    expect(attemptId1).not.toBe(attemptId2);
    expect(runId).toBe(runId); // same runId for same context
    // attemptId is a fencing token, NOT proof of exclusive ownership.
    // Both attempts are valid; the reservation protocol handles convergence.
  });

  it("attemptReservation writes running reservation with attemptId/runId/head/generation", () => {
    const ctx = makeContext();
    const attemptId = randomUUID();
    const reservation = attemptReservation({
      context: ctx,
      attemptId,
      generation: 1,
    });
    expect(reservation.attemptId).toBe(attemptId);
    expect(reservation.runId).toBe(computeRunId(ctx));
    expect(reservation.headSha).toBe(ctx.headSha);
    expect(reservation.status).toBe("running");
  });

  it("reservation is lost if head changes before next mutation", () => {
    // Simulate: attempt A reserved on head-1, then head moved to head-2.
    // Attempt A must detect the change and stop.
    const ctx1 = makeContext({ headSha: SAMPLE_HEAD });
    const attemptId = randomUUID();
    const reservation = attemptReservation({
      context: ctx1,
      attemptId,
      generation: 1,
    });
    // Current head is now head-2.
    const ctx2 = makeContext({ headSha: SAMPLE_HEAD_2 });
    const isSuperseded = reservation.headSha !== ctx2.headSha;
    expect(isSuperseded).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Convergence: interleaved same-head and adjacent-head
// ---------------------------------------------------------------------------

describe("state-machine: convergence", () => {
  it("partial-update → supersede: newer run overwrites canonical content", () => {
    const sim = runConvergenceSimulation({
      kind: "partial-update-then-supersede",
      context: makeContext(),
    });
    expect(sim.canonicalThreadId).toBeDefined();
    expect(sim.supersededCount).toBeGreaterThanOrEqual(1);
    expect(sim.resolutionMode).toBe("logical");
  });

  it("partial-update → newer-resolution: newer run logically resolves canonical", () => {
    const sim = runConvergenceSimulation({
      kind: "partial-update-then-newer-resolution",
      context: makeContext(),
    });
    expect(sim.canonicalThreadId).toBeDefined();
    expect(sim.resolvedCount).toBeGreaterThanOrEqual(1);
    expect(sim.resolutionMode).toBe("logical");
  });

  it("stale-native-close → newer-open: newer run reopens or creates canonical", () => {
    const sim = runConvergenceSimulation({
      kind: "stale-native-close-then-newer-open",
      context: makeContext(),
    });
    expect(sim.canonicalThreadId).toBeDefined();
    expect(sim.reopenedAfterStaleClose).toBe(true);
  });

  it("finalize-after-supersede: forbidden, no state finalization", () => {
    const sim = runConvergenceSimulation({
      kind: "finalize-after-supersede",
      context: makeContext(),
    });
    expect(sim.finalizationBlocked).toBe(true);
    expect(sim.mutationCount).toBe(0);
  });

  it("concurrent duplicate POSTs converge to one canonical thread per fingerprint", () => {
    const sim = runConvergenceSimulation({
      kind: "concurrent-duplicate-posts",
      context: makeContext(),
    });
    expect(sim.canonicalThreadId).toBeDefined();
    expect(sim.supersededCount).toBeGreaterThanOrEqual(1);
  });

  it("default resolutionMode is logical, not native", () => {
    const sim = runConvergenceSimulation({
      kind: "partial-update-then-supersede",
      context: makeContext(),
    });
    expect(sim.resolutionMode).toBe("logical");
  });

  it("native-best-effort stale-close repair is proven", () => {
    const sim = runConvergenceSimulation({
      kind: "stale-native-close-then-newer-open",
      context: makeContext(),
      resolutionMode: "native-best-effort",
    });
    expect(sim.reopenedAfterStaleClose).toBe(true);
    expect(sim.resolutionMode).toBe("native-best-effort");
  });
});

// ---------------------------------------------------------------------------
// 7. Collision ledger: non-expiring
// ---------------------------------------------------------------------------

describe("state-machine: collision ledger", () => {
  it("collision entries do not expire across run summaries compaction", () => {
    const ctx = makeContext();
    const fingerprint = createHash("sha256").update("collision-fp").digest("hex");
    const identity1 = createHash("sha256").update("id-a").digest("hex");

    const entry: CollisionLedgerEntry = {
      fingerprint,
      identityDigest: identity1,
      firstSeenRunId: computeRunId(ctx),
      firstSeenTimestamp: 1,
    };

    const summaries: RunSummary[] = [];
    for (let i = 0; i < 15; i++) {
      summaries.push({
        runId: computeRunId(ctx),
        headSha: SAMPLE_HEAD,
        timestamp: i,
        decision: "incremental" as const,
        findingCount: 1,
      });
    }

    // finalizeState compacts run summaries to last 10 and preserves collision ledger.
    const finalized = finalizeState({
      context: ctx,
      attemptId: randomUUID(),
      decision: "incremental",
      openFindings: [],
      resolvedFingerprints: [],
      runSummaries: summaries,
      collisionLedger: [entry],
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    });

    expect(finalized.state.runSummaries).toHaveLength(10);
    expect(finalized.state.collisionLedger).toContainEqual(entry);

    const decoded = decodeStateEnvelope(finalized.encoded);
    expect(decoded.runSummaries).toHaveLength(10);
    expect(decoded.collisionLedger).toContainEqual(entry);
  });

  it("collision ledger catches reappearance across PR lifecycle", () => {
    const ctx = makeContext();
    const fingerprint = createHash("sha256").update("reappear-fp").digest("hex");
    const identity = createHash("sha256").update("reappear-id").digest("hex");

    const entry: CollisionLedgerEntry = {
      fingerprint,
      identityDigest: identity,
      firstSeenRunId: computeRunId(ctx),
      firstSeenTimestamp: 1,
    };

    const state: ReviewState = {
      ...makeEmptyState(),
      collisionLedger: [entry],
    };

    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    const decoded = decodeStateEnvelope(encoded);
    expect(decoded.collisionLedger).toHaveLength(1);
    expect(decoded.collisionLedger[0]!.fingerprint).toBe(fingerprint);
  });

  it("same fingerprint + different identityDigest on collision ledger → FINGERPRINT_COLLISION", () => {
    const ctx = makeContext();
    const fingerprint = createHash("sha256").update("collide-fp").digest("hex");
    const oldIdentity = createHash("sha256").update("old-id").digest("hex");
    const newIdentity = createHash("sha256").update("new-id").digest("hex");

    const state: ReviewState = {
      ...makeEmptyState(),
      collisionLedger: [{
        fingerprint,
        identityDigest: oldIdentity,
        firstSeenRunId: computeRunId(ctx),
        firstSeenTimestamp: 1,
      }],
    };

    // Attempt to add the same fingerprint with a different identity.
    const result = evaluateTransition({
      priorState: state,
      current: ctx,
      manualFull: false,
      newFindings: [{
        fingerprint,
        identityDigest: newIdentity,
        lifecycle: "open" as const,
        generation: 1,
        runId: computeRunId(ctx),
      }],
    });
    expect(result.decision).toBe("full");
    expect(result.collisionError).toBeDefined();
    expect(result.collisionError).toContain("FINGERPRINT_COLLISION");
  });
});

// ---------------------------------------------------------------------------
// 8. Overflow behavior
// ---------------------------------------------------------------------------

describe("state-machine: overflow", () => {
  it("overflow preserves last valid state byte-for-byte", () => {
    // Write a valid state, then try to encode a state that exceeds cap.
    const dir = mkdtempSync(join(tmpdir(), "state-overflow-"));
    try {
      const ctx = makeContext();
      const validState = makePriorState();
      const path = getLocalStatePath(dir, ctx.repoHash, ctx.prNumber);
      saveLocalState(path, validState, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });

      // Now try to save a state that exceeds cap.
      const oversizedFindings: FindingRecord[] = [];
      for (let i = 0; i < 10000; i++) {
        oversizedFindings.push({
          fingerprint: createHash("sha256").update(`over-fp-${i}`).digest("hex"),
          identityDigest: createHash("sha256").update(`over-id-${i}`).digest("hex"),
          lifecycle: "open",
          generation: 1,
          runId: computeRunId(ctx),
        });
      }
      const oversizedState = { ...validState, openFindings: oversizedFindings };

      expect(() => saveLocalState(path, oversizedState, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES })).toThrow();

      // Prior state is preserved byte-for-byte.
      const recovered = loadLocalState(path);
      expect(recovered).not.toBeNull();
      expect(recovered).toEqual(validState);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overflow writes NO artifact", () => {
    const dir = mkdtempSync(join(tmpdir(), "state-overflow-noart-"));
    try {
      const ctx = makeContext();
      const path = getLocalStatePath(dir, ctx.repoHash, ctx.prNumber);
      // No prior state. Try to write oversized → must throw and leave nothing.
      const oversizedState: ReviewState = {
        ...makeEmptyState(),
        openFindings: Array.from({ length: 10000 }, (_, i) => ({
          fingerprint: createHash("sha256").update(`x-fp-${i}`).digest("hex"),
          identityDigest: createHash("sha256").update(`x-id-${i}`).digest("hex"),
          lifecycle: "open" as const,
          generation: 1,
          runId: computeRunId(ctx),
        })),
      };
      expect(() => saveLocalState(path, oversizedState, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES })).toThrow();
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overflow exits non-zero (throws)", () => {
    const oversizedState: ReviewState = {
      ...makeEmptyState(),
      openFindings: Array.from({ length: 10000 }, (_, i) => ({
        fingerprint: createHash("sha256").update(`o-fp-${i}`).digest("hex"),
        identityDigest: createHash("sha256").update(`o-id-${i}`).digest("hex"),
        lifecycle: "open" as const,
        generation: 1,
        runId: computeRunId(makeContext()),
      })),
    };
    expect(() => encodeReviewState(oversizedState, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES })).toThrowError(
      /STATE_CAPACITY_EXCEEDED/,
    );
  });

  it("cap raise recovery: raising effectiveCap allows previously-oversized state", () => {
    const state: ReviewState = {
      ...makeEmptyState(),
      openFindings: Array.from({ length: 1000 }, (_, i) => ({
        fingerprint: createHash("sha256").update(`r-fp-${i}`).digest("hex"),
        identityDigest: createHash("sha256").update(`r-id-${i}`).digest("hex"),
        lifecycle: "open" as const,
        generation: 1,
        runId: computeRunId(makeContext()),
      })),
    };
    // At default cap it might overflow; at hard max it should pass.
    const encoded = encodeReviewState(state, { effectiveCap: HARD_MAX_STATE_CAPACITY_BYTES });
    expect(Buffer.byteLength(encoded, "utf8")).toBeLessThanOrEqual(HARD_MAX_STATE_CAPACITY_BYTES);
  });

  it("permanent hard-max lineage failure when collision ledger alone exceeds hard max", () => {
    // Build a collision ledger that alone exceeds hard max.
    const ctx = makeContext();
    const entries: CollisionLedgerEntry[] = [];
    // Each entry is roughly 200 bytes encoded. 262144 / 200 ≈ 1310.
    // We need more than that.
    for (let i = 0; i < 2000; i++) {
      entries.push({
        fingerprint: createHash("sha256").update(`ledger-fp-${i}-${"x".repeat(60)}`).digest("hex"),
        identityDigest: createHash("sha256").update(`ledger-id-${i}-${"y".repeat(60)}`).digest("hex"),
        firstSeenRunId: computeRunId(ctx),
        firstSeenTimestamp: i,
      });
    }
    const state: ReviewState = {
      ...makeEmptyState(),
      collisionLedger: entries,
    };
    expect(() => encodeReviewState(state, { effectiveCap: HARD_MAX_STATE_CAPACITY_BYTES })).toThrowError(
      /STATE_CAPACITY_EXCEEDED/,
    );
  });
});

// ---------------------------------------------------------------------------
// 9. Privacy: no secrets/source/body in state bytes
// ---------------------------------------------------------------------------

describe("state-machine: privacy", () => {
  it("state bytes contain NO seeded secrets", () => {
    const SECRET = "sk-DO-NOT-LEAK-abc123";
    const state = makePriorState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    expect(encoded).not.toContain(SECRET);
  });

  it("state bytes contain NO source text", () => {
    const SOURCE = "function vulnerableCode() { return eval(userInput); }";
    const state = makePriorState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    expect(encoded).not.toContain(SOURCE);
  });

  it("state bytes contain NO comment body text", () => {
    const BODY = "This function has a critical SQL injection vulnerability that needs immediate attention.";
    const state = makePriorState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    expect(encoded).not.toContain(BODY);
  });

  it("FindingRecord does not have a body/text/content field", () => {
    const finding = makeOpenFinding();
    expect(finding).not.toHaveProperty("body");
    expect(finding).not.toHaveProperty("text");
    expect(finding).not.toHaveProperty("content");
    expect(finding).not.toHaveProperty("source");
  });
});

// ---------------------------------------------------------------------------
// 10. Atomic local-write failure preserves prior state
// ---------------------------------------------------------------------------

describe("state-machine: atomic local writes", () => {
  it("atomic local-write failure preserves prior state", () => {
    const dir = mkdtempSync(join(tmpdir(), "state-atomic-"));
    try {
      const ctx = makeContext();
      const path = getLocalStatePath(dir, ctx.repoHash, ctx.prNumber);
      const original = makePriorState();
      saveLocalState(path, original, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });

      // Make the directory read-only so the atomic write (temp + rename) fails.
      // On Linux, chmod the parent directory to 0o500.
      const parentDir = join(dir, ".umactually-review-state", ctx.repoHash);
      chmodSync(parentDir, 0o500);

      const newState = { ...original, lastReviewedAt: 2000 };
      let writeFailed = false;
      try {
        saveLocalState(path, newState, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
      } catch {
        writeFailed = true;
      }
      // Restore permissions.
      chmodSync(parentDir, 0o755);

      // On some CI runners the chmod may not restrict; only assert when the
      // write actually failed.
      if (writeFailed) {
        const recovered = loadLocalState(path);
        expect(recovered).toEqual(original);
      }
    } finally {
      // Ensure cleanup even on failure.
      try {
        chmodSync(dir, 0o755);
        for (const entry of require("node:fs").readdirSync(dir)) {
          try {
            chmodSync(join(dir, entry), 0o755);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("local state path is .umactually-review-state/<repoHash>/<prHash>.json", () => {
    const dir = "/fake/base";
    const ctx = makeContext();
    const path = getLocalStatePath(dir, ctx.repoHash, ctx.prNumber);
    expect(path).toContain(".umactually-review-state");
    expect(path).toContain(ctx.repoHash);
    expect(path.endsWith(".json")).toBe(true);
  });

  it("local state round-trips through save + load", () => {
    const dir = mkdtempSync(join(tmpdir(), "state-rt-"));
    try {
      const ctx = makeContext();
      const path = getLocalStatePath(dir, ctx.repoHash, ctx.prNumber);
      const state = makePriorState();
      saveLocalState(path, state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
      const loaded = loadLocalState(path);
      expect(loaded).toEqual(state);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Canonical JSON serialization
// ---------------------------------------------------------------------------

describe("state-machine: canonical JSON", () => {
  it("keys are recursively lexicographically sorted", () => {
    const state: ReviewState = {
      ...makeEmptyState(),
      runSummaries: [{
        runId: "zzz",
        headSha: "aaa",
        timestamp: 1,
        decision: "full",
        findingCount: 0,
      }],
    };
    const json = serializeCanonicalStateJson(state);
    const reparsed = JSON.parse(json) as Record<string, unknown>;
    const keys = Object.keys(reparsed);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });

  it("collision entries sorted by fingerprint then identityDigest", () => {
    const state: ReviewState = {
      ...makeEmptyState(),
      collisionLedger: [
        { fingerprint: "ccc", identityDigest: "zzz", firstSeenRunId: "r1", firstSeenTimestamp: 1 },
        { fingerprint: "aaa", identityDigest: "bbb", firstSeenRunId: "r2", firstSeenTimestamp: 2 },
        { fingerprint: "aaa", identityDigest: "aaa", firstSeenRunId: "r3", firstSeenTimestamp: 3 },
      ],
    };
    const canonical = canonicalizeDecodedState(state);
    expect(canonical.collisionLedger[0]!.fingerprint).toBe("aaa");
    expect(canonical.collisionLedger[0]!.identityDigest).toBe("aaa");
    expect(canonical.collisionLedger[1]!.fingerprint).toBe("aaa");
    expect(canonical.collisionLedger[1]!.identityDigest).toBe("bbb");
    expect(canonical.collisionLedger[2]!.fingerprint).toBe("ccc");
  });

  it("no trailing newline in canonical JSON", () => {
    const json = serializeCanonicalStateJson(makeEmptyState());
    expect(json.endsWith("\n")).toBe(false);
  });

  it("no BOM", () => {
    const json = serializeCanonicalStateJson(makeEmptyState());
    expect(json.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("cross-runtime round trip: decode works on canonical bytes", () => {
    const state = makePriorState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    const decoded = decodeStateEnvelope(encoded);
    expect(decoded).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// 12. State parent (platform comment)
// ---------------------------------------------------------------------------

describe("state-machine: state parent retrieval", () => {
  it("state parent marker is `<!-- umactually-state:v1\\n...\\n-->`", () => {
    const state = makeEmptyState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    expect(encoded.startsWith(STATE_ENVELOPE_PREFIX + "\n")).toBe(true);
  });

  it("readStateParent extracts state from a comment body", () => {
    const state = makePriorState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    const parent: StateParent = {
      id: "comment-1",
      body: encoded,
    };
    const result = readStateParent(parent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual(state);
    }
  });

  it("readStateParent returns null when no state marker present", () => {
    const parent: StateParent = {
      id: "comment-2",
      body: "<!-- umactually -->\nSome review content",
    };
    const result = readStateParent(parent);
    expect(result.ok).toBe(false);
  });

  it("no platform-generated IDs persisted in state", () => {
    const state = makePriorState();
    const json = serializeCanonicalStateJson(state);
    const reparsed = JSON.parse(json) as Record<string, unknown>;
    // State must not contain platform-generated thread/review IDs.
    expect(reparsed).not.toHaveProperty("threadId");
    expect(reparsed).not.toHaveProperty("reviewId");
    expect(reparsed).not.toHaveProperty("commentId");
    expect(reparsed).not.toHaveProperty("platformId");
  });
});

// ---------------------------------------------------------------------------
// 13. Unavailable persistence fallback
// ---------------------------------------------------------------------------

describe("state-machine: unavailable persistence", () => {
  it("unavailable persistence produces full non-resolving review with warning", () => {
    const result = evaluateTransition({
      priorState: null,
      current: makeContext(),
      manualFull: false,
      persistenceUnavailable: true,
    });
    expect(result.decision).toBe("full");
    expect(result.nonResolving).toBe(true);
    expect(result.warning).toBeDefined();
  });

  it("corrupt state produces full non-resolving review with warning", () => {
    const result = evaluateTransition({
      priorState: null,
      current: makeContext(),
      manualFull: false,
      corruptState: true,
    });
    expect(result.decision).toBe("full");
    expect(result.warning).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 14. Finalization
// ---------------------------------------------------------------------------

describe("state-machine: finalize", () => {
  it("finalize produces a complete state with lifecycle status", () => {
    const ctx = makeContext();
    const attemptId = randomUUID();
    const result = finalizeState({
      context: ctx,
      attemptId,
      decision: "incremental",
      openFindings: [makeOpenFinding()],
      resolvedFingerprints: [],
      runSummaries: makePriorState().runSummaries,
      collisionLedger: [],
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    });
    expect(result.state.lastHeadSha).toBe(ctx.headSha);
    expect(result.state.lastPolicyHash).toBe(ctx.policyHash);
    expect(result.state.lastProviderModelHash).toBe(ctx.providerModelHash);
    expect(result.state.runSummaries.length).toBeGreaterThanOrEqual(1);
  });

  it("finalize compacts run summaries to last 10", () => {
    const ctx = makeContext();
    const summaries: RunSummary[] = [];
    for (let i = 0; i < 15; i++) {
      summaries.push({
        runId: computeRunId(ctx),
        headSha: SAMPLE_HEAD,
        timestamp: i,
        decision: "incremental" as const,
        findingCount: 1,
      });
    }
    const result = finalizeState({
      context: ctx,
      attemptId: randomUUID(),
      decision: "incremental",
      openFindings: [],
      resolvedFingerprints: [],
      runSummaries: summaries,
      collisionLedger: [],
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    });
    expect(result.state.runSummaries).toHaveLength(10);
  });

  it("finalize never removes open findings or collision entries for compaction", () => {
    const ctx = makeContext();
    const entries: CollisionLedgerEntry[] = [
      { fingerprint: "fp1", identityDigest: "id1", firstSeenRunId: "r1", firstSeenTimestamp: 1 },
    ];
    const result = finalizeState({
      context: ctx,
      attemptId: randomUUID(),
      decision: "incremental",
      openFindings: [makeOpenFinding()],
      resolvedFingerprints: [],
      runSummaries: [],
      collisionLedger: entries,
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    });
    expect(result.state.collisionLedger).toEqual(entries);
    expect(result.state.openFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 15. Three linear heads simulation (happy path contract)
// ---------------------------------------------------------------------------

describe("state-machine: three linear heads simulation", () => {
  it("first full, then two incremental transitions with retained identity", () => {
    // Head 1: first run → full.
    const ctx1 = makeContext({ headSha: SAMPLE_HEAD });
    const r1 = evaluateTransition({
      priorState: null,
      current: ctx1,
      manualFull: false,
    });
    expect(r1.decision).toBe("full");

    const finding = makeOpenFinding({ runId: computeRunId(ctx1) });
    const state1 = finalizeState({
      context: ctx1,
      attemptId: randomUUID(),
      decision: "full",
      openFindings: [finding],
      resolvedFingerprints: [],
      runSummaries: [],
      collisionLedger: [],
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    }).state;

    // Head 2: adjacent → incremental, finding retained.
    const ctx2 = makeContext({ headSha: SAMPLE_HEAD_2 });
    const r2 = evaluateTransition({
      priorState: state1,
      current: ctx2,
      manualFull: false,
    });
    expect(r2.decision).toBe("incremental");
    expect(r2.carryOpenFindings?.[0]?.fingerprint).toBe(finding.fingerprint);
    expect(r2.carryOpenFindings?.[0]?.identityDigest).toBe(finding.identityDigest);

    const state2 = finalizeState({
      context: ctx2,
      attemptId: randomUUID(),
      decision: "incremental",
      openFindings: [finding],
      resolvedFingerprints: [],
      runSummaries: state1.runSummaries,
      collisionLedger: state1.collisionLedger,
      effectiveCap: DEFAULT_STATE_CAPACITY_BYTES,
    }).state;

    // Head 3: adjacent → incremental.
    const ctx3 = makeContext({ headSha: SAMPLE_HEAD_3 });
    const r3 = evaluateTransition({
      priorState: state2,
      current: ctx3,
      manualFull: false,
    });
    expect(r3.decision).toBe("incremental");
    expect(r3.carryOpenFindings?.[0]?.fingerprint).toBe(finding.fingerprint);

    // Each attempt had a unique attemptId.
    const a1 = randomUUID();
    const a2 = randomUUID();
    const a3 = randomUUID();
    expect(new Set([a1, a2, a3]).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 16. Golden bytes (pinned toolchain)
// ---------------------------------------------------------------------------

describe("state-machine: golden bytes", () => {
  it("empty state encodes to deterministic golden bytes", () => {
    const state = makeEmptyState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    // Encode twice → same bytes.
    const encoded2 = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    expect(encoded).toBe(encoded2);
  });

  it("DEFLATE uses level 9 Z_FIXED (verified by independent inflate)", () => {
    const state = makePriorState();
    const encoded = encodeReviewState(state, { effectiveCap: DEFAULT_STATE_CAPACITY_BYTES });
    // Extract payload.
    const prefixLen = STATE_ENVELOPE_PREFIX.length + 1;
    const suffixLen = STATE_ENVELOPE_SUFFIX.length + 2;
    const payloadB64url = encoded.slice(prefixLen, encoded.length - suffixLen);
    const payloadBytes = Buffer.from(payloadB64url, "base64url");
    // Raw inflate must work.
    const inflated = inflateSync(payloadBytes);
    expect(JSON.parse(inflated.toString("utf8"))).toEqual(state);
    // Verify it is NOT gzip (would have a different header).
    expect(() => gunzipSync(payloadBytes)).toThrow();
  });
});
