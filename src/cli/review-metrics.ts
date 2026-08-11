// SPDX-License-Identifier: MIT
//
// Task 7 — Local-only review audit and cost metrics.
//
// The module owns the artifact-side data model for the Wave-2 observability
// surface (per the `first-class-product` plan, Task 7 § Acceptance criteria):
//
//   * Monotonic phase durations (context, provider, verification, posting, total).
//   * Provider usage + round-trip counts on BOTH successful and failed paths.
//     Absent usage is OMITTED — never zero-invented.
//   * Considered / kept / downgraded / suppressed / off-diff counts and a
//     closed reason-histogram enum so the artifact shape stays bounded.
//   * Full / incremental decision and policy / context hashes for cross-run
//     auditability.
//   * Optional local cost estimates ONLY from explicit user-configured
//     per-token prices. Absent price yields no cost field. Configured
//     price yields an exact decimal estimate marked `estimated` with
//     currency + source. Pricing is NEVER inferred from the model name.
//   * Additive JSON envelope versioning: the audit block carries its own
//     `auditSchemaVersion: 2` discriminator so existing v1 readers
//     (whose envelopes have `schemaVersion: 1`) keep parsing unchanged.
//   * Redaction: secrets and URLs (query string + fragment stripped) are
//     scrubbed from the serialized artifact. No telemetry is sent.
//
// The module is intentionally pure (no I/O, no clock side-effects) so
// tests can drive every code path with deterministic inputs and no
// real wall-clock measurement.

import { createHash } from "node:crypto";
import { redactUrlForLog } from "../util/url.js";

// ---------------------------------------------------------------------------
// Types — closed reason enum
// ---------------------------------------------------------------------------

/**
 * Closed enum of filter reasons the histogram records. Every reason the
 * pipeline can emit is enumerated here so the artifact shape stays
 * bounded (the histogram always carries every key, even if zero).
 *
 * Adding a new value here is the safe way to extend — tests pin the
 * full set so the histogram can never silently grow a new key without
 * an explicit review of the corresponding pipeline branch.
 */
export type ReasonKind =
  | "off-diff"
  | "truncation"
  | "parse-failure"
  | "budget-exhausted"
  | "secret-bearing"
  | "unsupported-language"
  | "parse-failed"
  | "below-threshold"
  | "carried-over"
  | "unchanged"
  | "manual-full";

export const REASON_KIND_VALUES: readonly ReasonKind[] = [
  "off-diff",
  "truncation",
  "parse-failure",
  "budget-exhausted",
  "secret-bearing",
  "unsupported-language",
  "parse-failed",
  "below-threshold",
  "carried-over",
  "unchanged",
  "manual-full",
] as const;

export const ALL_REASON_KINDS: ReadonlyArray<ReasonKind> = REASON_KIND_VALUES;

export type FilterHistogram = Readonly<Record<ReasonKind, number>>;

/** Return a fresh histogram object with every reason set to zero. */
export function emptyReasonHistogram(): FilterHistogram {
  const h: { -readonly [K in ReasonKind]: number } = {
    "off-diff": 0,
    "truncation": 0,
    "parse-failure": 0,
    "budget-exhausted": 0,
    "secret-bearing": 0,
    "unsupported-language": 0,
    "parse-failed": 0,
    "below-threshold": 0,
    "carried-over": 0,
    "unchanged": 0,
    "manual-full": 0,
  };
  return h;
}

// ---------------------------------------------------------------------------
// Types — counts, usage, cost
// ---------------------------------------------------------------------------

/**
 * Counts the pipeline reports per run. `considered` is the number of
 * findings the model produced before any filter; `kept` is the set that
 * survived every layer and was posted (or would be, in --dry-run).
 * `downgraded` is findings the verified-facts or confidence filter
 * softened to a lower severity. `suppressed` is findings filtered
 * without being downgraded (below threshold, off-diff, secret-bearing,
 * etc.). `offDiff` is a subset of `suppressed` carrying a citation that
 * did not anchor to the supplied diff.
 */
export type ConsideredCounts = {
  readonly considered: number;
  readonly kept: number;
  readonly downgraded: number;
  readonly suppressed: number;
  readonly offDiff: number;
};

/** Empty counts (all zeros) — useful as a default and in tests. */
export function emptyConsideredCounts(): ConsideredCounts {
  return { considered: 0, kept: 0, downgraded: 0, suppressed: 0, offDiff: 0 };
}

/**
 * Subset of the provider's `usage` block the audit records. Fields
 * the provider did not emit are OMITTED — never zero-invented. The
 * `roundTrips` count is independent (it is the number of HTTP
 * round-trips the orchestrator made, regardless of whether the
 * provider reported token usage).
 */
export type ProviderUsageRecord = {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly roundTrips: number;
};

/**
 * Provider usage in its wire-shape (snake_case). The provider clients
 * emit this exact shape on the terminal `response.completed` event;
 * `LiveProviderOutcome.usage` carries the same shape up through the
 * orchestrator. `normalizeProviderUsage` translates it to the
 * audit-side camelCase `ProviderUsageRecord` so the cost estimator
 * can read it without an inline snake-case adapter at every call
 * site.
 *
 * Fields absent on the wire are propagated as `undefined` so the
 * "OMIT when absent, never zero-invent" contract holds end-to-end.
 */
export type WireProviderUsage = {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly total_tokens?: number;
};

/**
 * Translate a wire-shape `ProviderUsage` into the audit-side
 * camelCase `ProviderUsageRecord`. The `roundTrips` field is the
 * orchestrator-side count, not a wire field — the caller passes it
 * in explicitly so this helper stays purely declarative.
 *
 * Round-trip propagation rule:
 *   - Provider emitted a wire usage block → caller has likely
 *     incremented `recordRoundTrip()` at the provider boundary.
 *     Pass that count in so the final audit record carries the
 *     observed HTTP round-trip count even if the provider's wire
 *     usage block was empty.
 *   - No wire usage block → caller still passes the round-trip
 *     count so the audit can attribute the round-trip separately.
 */
export function normalizeProviderUsage(
  wire: WireProviderUsage | undefined,
  roundTrips: number,
): ProviderUsageRecord {
  const out: {
    -readonly [K in keyof ProviderUsageRecord]: ProviderUsageRecord[K];
  } = { roundTrips };
  if (wire === undefined) return out as ProviderUsageRecord;
  if (typeof wire.input_tokens === "number") out.inputTokens = wire.input_tokens;
  if (typeof wire.output_tokens === "number") out.outputTokens = wire.output_tokens;
  if (typeof wire.total_tokens === "number") out.totalTokens = wire.total_tokens;
  return out as ProviderUsageRecord;
}

/**
 * Cost estimate produced from explicit per-token prices the user
 * configured in `umactually.config.json#pricing`. The estimate is
 * ALWAYS marked `"estimated"` so downstream consumers can never
 * mistake it for an authoritative cost.
 *
 * The currency and source are surfaced so the operator can audit
 * which price table the estimate was derived from. Pricing is
 * NEVER inferred from the model name — see `setPricing` for the
 * exact contract.
 */
export type CostEstimate = {
  readonly total: number;
  readonly currency: string;
  readonly source: string;
  readonly estimate: "estimated";
};

/** Pricing record read from `umactually.config.json#pricing`. */
export type PricingConfig = {
  readonly inputPricePer1kTokens?: number;
  readonly outputPricePer1kTokens?: number;
  readonly currency: string;
  readonly source: string;
};

// ---------------------------------------------------------------------------
// Types — decision + hashes + final shape
// ---------------------------------------------------------------------------

/**
 * Decision discriminator the run made. "full" = every in-scope finding
 * was reviewed; "incremental" = only findings anchored to the diff
 * delta from the prior head sha were considered. Task 9 owns the
 * state-machine; the audit only records the discriminator.
 */
export type ReviewDecision = "full" | "incremental";

/**
 * The serialized audit block. Every field is independent — a run
 * that never started a phase still emits `durations` (with zeros),
 * and a run that never observed a reason still emits `reasons`
 * (with zeros for every closed-enum value). Fields are OMITTED only
 * when the pipeline genuinely has nothing to record (e.g. no usage
 * block was emitted; no price was configured; no policy was
 * resolved).
 */
export type ReviewMetrics = {
  readonly durations: {
    readonly contextMs: number;
    readonly providerMs: number;
    readonly verificationMs: number;
    readonly postingMs: number;
    readonly totalMs: number;
  };
  readonly counts: ConsideredCounts;
  readonly reasons: FilterHistogram;
  /**
   * Provider usage when the provider emitted a `usage` block on a
   * completed event. `undefined` when the stream was truncated, the
   * provider did not emit usage, or the operator has not configured
   * anything that needs it. NEVER zero-invented.
   */
  readonly usage?: ProviderUsageRecord;
  /**
   * Number of HTTP round-trips the orchestrator made. Always set
   * once the orchestrator has run, even if `usage` is undefined
   * (the round-trip counter does not depend on the provider's
   * `usage` block). Independent field so failed pre-provider paths
   * can still record their round-trip count.
   */
  readonly usageRoundTrips?: number;
  /**
   * Cost estimate derived from explicit per-token prices. OMITTED
   * when no price is configured, when the provider emitted no
   * usage, or when only one side of the price table is present.
   * Never defaulted to zero.
   */
  readonly cost?: CostEstimate;
  readonly decision?: ReviewDecision;
  readonly policyHash?: string;
  readonly contextHash?: string;
  /**
   * Redaction summary: how many secrets and URLs the builder
   * recorded for scrubbing. The actual secret values are NEVER
   * stored in the audit record — only the count is. The
   * `serializeReviewAudit` helper applies a redaction pass so the
   * serialized envelope never contains the original token even if
   * a future field accidentally re-introduces it.
   */
  readonly redactions: AuditRedaction;
};

// ---------------------------------------------------------------------------
// Envelope versioning
// ---------------------------------------------------------------------------

/**
 * Additive audit schema version. The audit block lives under
 * `envelope.data.audit` (or `envelope.audit` for the live-artifact
 * writer — see the artifact adapter). v1 readers that do not know
 * about the audit block keep parsing the v1 envelope unchanged;
 * v2 readers (this module's consumers) get the additional fields.
 *
 * Bumping this number is a deliberate decision: it means the audit
 * shape has changed incompatibly. Additive field additions stay
 * under v2; breaking renames or removals require a new version.
 */
export const AUDIT_SCHEMA_VERSION = 2 as const;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Clock function injected by the caller. Default = `Date.now()`. */
export type MetricsClock = () => number;

type InternalState = {
  phaseStartedAt: { context: number | null; provider: number | null; verification: number | null; posting: number | null };
  phaseEndedAt: { context: number | null; provider: number | null; verification: number | null; posting: number | null };
  runStartedAt: number;
  counts: ConsideredCounts;
  reasons: FilterHistogram;
  usage: ProviderUsageRecord | undefined;
  pricing: PricingConfig | undefined;
  decision: ReviewDecision | undefined;
  policyHash: string | undefined;
  contextHash: string | undefined;
  secrets: string[];
  urls: string[];
  roundTrips: number;
};

/**
 * Redaction summary surfaced in the audit envelope. Each secret and
 * URL is recorded by its redacted form so a downstream consumer can
 * verify "yes, this token was scrubbed" without ever reading the
 * raw value back. The count of redacted items lets a CI guard
 * detect "I expected 1 token to be redacted, the audit shows 0"
 * regressions without parsing the original source.
 */
export type AuditRedaction = {
  readonly secrets: number;
  readonly urls: number;
};

export type ReviewMetricsBuilder = {
  beginContext(): void;
  endContext(): void;
  beginProvider(): void;
  endProvider(): void;
  beginVerification(): void;
  endVerification(): void;
  beginPosting(): void;
  endPosting(): void;
  setUsage(usage: ProviderUsageRecord): void;
  recordRoundTrip(): void;
  setCounts(counts: ConsideredCounts): void;
  incrementReason(kind: ReasonKind, by?: number): void;
  setDecision(decision: ReviewDecision): void;
  setPolicyHash(hash: string): void;
  setContextHash(hash: string): void;
  setPricing(pricing: PricingConfig): void;
  recordSecret(secret: string): void;
  recordUrl(url: string): void;
  /** Freeze the captured state into a `ReviewMetrics` record. */
  finalize(): ReviewMetrics;
};

/**
 * Build a fresh review-metrics builder. The builder is single-use: once
 * `finalize` is called the captured state freezes and any subsequent
 * call to a `begin*` / `end*` / `set*` method becomes a no-op. This
 * matches the "one metrics object per run" contract the orchestrator
 * relies on.
 */
export function buildReviewMetrics(opts: { now?: MetricsClock } = {}): ReviewMetricsBuilder {
  const now = opts.now ?? (() => Date.now());
  const state: InternalState = {
    phaseStartedAt: { context: null, provider: null, verification: null, posting: null },
    phaseEndedAt: { context: null, provider: null, verification: null, posting: null },
    runStartedAt: now(),
    counts: emptyConsideredCounts(),
    reasons: emptyReasonHistogram(),
    usage: undefined,
    pricing: undefined,
    decision: undefined,
    policyHash: undefined,
    contextHash: undefined,
    secrets: [],
    urls: [],
    roundTrips: 0,
  };
  let finalized = false;
  const guard = (): boolean => {
    if (finalized) return false;
    return true;
  };
  const stamp = (which: "context" | "provider" | "verification" | "posting", end: boolean): void => {
    if (!guard()) return;
    const bucket = (end ? state.phaseEndedAt : state.phaseStartedAt) as Record<typeof which, number | null>;
    bucket[which] = now();
  };
  const builder: ReviewMetricsBuilder = {
    beginContext: () => stamp("context", false),
    endContext: () => stamp("context", true),
    beginProvider: () => stamp("provider", false),
    endProvider: () => stamp("provider", true),
    beginVerification: () => stamp("verification", false),
    endVerification: () => stamp("verification", true),
    beginPosting: () => stamp("posting", false),
    endPosting: () => stamp("posting", true),
    setUsage: (usage) => {
      if (!guard()) return;
      state.usage = usage;
    },
    recordRoundTrip: () => {
      if (!guard()) return;
      state.roundTrips += 1;
    },
    setCounts: (counts) => {
      if (!guard()) return;
      state.counts = counts;
    },
    incrementReason: (kind, by = 1) => {
      if (!guard()) return;
      if (!REASON_KIND_VALUES.includes(kind)) {
        // Defensive: an unknown reason must NEVER silently grow the
        // histogram. The contract is that the histogram is closed.
        // Throwing here surfaces the offending call site loudly.
        throw new RangeError(
          `incrementReason: unknown kind "${kind}". Expected one of: ${REASON_KIND_VALUES.join(", ")}`,
        );
      }
      const current = state.reasons[kind] ?? 0;
      const next: { -readonly [K in ReasonKind]: number } = {
        "off-diff": state.reasons["off-diff"],
        "truncation": state.reasons["truncation"],
        "parse-failure": state.reasons["parse-failure"],
        "budget-exhausted": state.reasons["budget-exhausted"],
        "secret-bearing": state.reasons["secret-bearing"],
        "unsupported-language": state.reasons["unsupported-language"],
        "parse-failed": state.reasons["parse-failed"],
        "below-threshold": state.reasons["below-threshold"],
        "carried-over": state.reasons["carried-over"],
        "unchanged": state.reasons["unchanged"],
        "manual-full": state.reasons["manual-full"],
      };
      next[kind] = current + by;
      state.reasons = next;
    },
    setDecision: (decision) => {
      if (!guard()) return;
      state.decision = decision;
    },
    setPolicyHash: (hash) => {
      if (!guard()) return;
      state.policyHash = hash;
    },
    setContextHash: (hash) => {
      if (!guard()) return;
      state.contextHash = hash;
    },
    setPricing: (pricing) => {
      if (!guard()) return;
      state.pricing = pricing;
    },
    recordSecret: (secret) => {
      if (!guard()) return;
      if (secret.length > 0 && !state.secrets.includes(secret)) {
        state.secrets.push(secret);
      }
    },
    recordUrl: (url) => {
      if (!guard()) return;
      if (url.length > 0 && !state.urls.includes(url)) {
        state.urls.push(url);
      }
    },
    finalize: () => {
      finalized = true;
      return finalizeFromState(state, now());
    },
  };
  return builder;
}

/**
 * Freeze the builder's captured state into a `ReviewMetrics` record.
 * Performs the duration arithmetic, the cost estimate (if applicable),
 * and the OMIT-when-absent contract.
 */
export function finalizeReviewMetrics(builder: ReviewMetricsBuilder): ReviewMetrics {
  return builder.finalize();
}

/**
 * Build a `ReviewMetrics` record from a pre-validated internal state.
 * Public so tests and the live orchestrator can produce the same
 * record directly without going through the builder's `begin*` /
 * `end*` lifecycle (e.g. when reading a pre-captured metrics object
 * off the wire).
 */
export function finalizeFromState(state: InternalState, nowMs: number): ReviewMetrics {
  const duration = (started: number | null, ended: number | null): number => {
    if (started === null || ended === null) return 0;
    const delta = ended - started;
    return delta < 0 ? 0 : delta;
  };
  const contextMs = duration(state.phaseStartedAt.context, state.phaseEndedAt.context);
  const providerMs = duration(state.phaseStartedAt.provider, state.phaseEndedAt.provider);
  const verificationMs = duration(state.phaseStartedAt.verification, state.phaseEndedAt.verification);
  const postingMs = duration(state.phaseStartedAt.posting, state.phaseEndedAt.posting);
  // totalMs is anchored on run start (captured at `buildReviewMetrics`
  // time) and `now`. This guarantees totalMs >= sum of phases even
  // when the orchestrator's pre/post timing diverges from a
  // per-phase begin/end pair.
  const totalMs = Math.max(0, nowMs - state.runStartedAt);

  // The provider usage record carries the round-trip count even when
  // the provider emitted no usage block. We split the two so callers
  // can read round-trips on the failed-path even if `usage` itself is
  // undefined.
  const usage = state.usage;
  const roundTrips = state.roundTrips + (usage?.roundTrips ?? 0);

  let cost: CostEstimate | undefined;
  if (usage !== undefined && state.pricing !== undefined) {
    const p = state.pricing;
    if (
      typeof p.inputPricePer1kTokens === "number" &&
      typeof p.outputPricePer1kTokens === "number" &&
      Number.isFinite(p.inputPricePer1kTokens) &&
      Number.isFinite(p.outputPricePer1kTokens) &&
      p.inputPricePer1kTokens >= 0 &&
      p.outputPricePer1kTokens >= 0
    ) {
      // Only compute the estimate when BOTH sides of the price table
      // are present. Missing one side is a configuration error and the
      // estimate is omitted so the operator is not misled by a partial
      // price assumption. Also require the corresponding usage field
      // so a price + missing tokens case does not silently fabricate
      // zero usage.
      const inputTokens = usage.inputTokens;
      const outputTokens = usage.outputTokens;
      if (typeof inputTokens === "number" && typeof outputTokens === "number") {
        const inputCost = (inputTokens / 1000) * p.inputPricePer1kTokens;
        const outputCost = (outputTokens / 1000) * p.outputPricePer1kTokens;
        const total = inputCost + outputCost;
        if (Number.isFinite(total)) {
          cost = {
            total,
            currency: p.currency,
            source: p.source,
            estimate: "estimated",
          };
        }
      }
    }
  }

  const out: {
    -readonly [K in keyof ReviewMetrics]: ReviewMetrics[K];
  } = {
    durations: { contextMs, providerMs, verificationMs, postingMs, totalMs },
    counts: state.counts,
    reasons: state.reasons,
    ...(usage !== undefined
      ? { usage: { ...usage, roundTrips } }
      : {}),
    ...(roundTrips > 0 ? { usageRoundTrips: roundTrips } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...(state.decision !== undefined ? { decision: state.decision } : {}),
    ...(state.policyHash !== undefined ? { policyHash: state.policyHash } : {}),
    ...(state.contextHash !== undefined ? { contextHash: state.contextHash } : {}),
    redactions: {
      secrets: state.secrets.length,
      urls: state.urls.length,
    },
  };
  return out as ReviewMetrics;
}

// ---------------------------------------------------------------------------
// Hashing — policy + context
// ---------------------------------------------------------------------------

/**
 * Stable canonicalization for JSON object inputs: sort keys
 * deterministically. Recurses into nested objects and arrays. Used by
 * the policy + context hashers so two callers that build the same
 * logical policy in different property-order produce the same hash.
 */
function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalizeJson(obj[k]);
  }
  return sorted;
}

/**
 * Redact every secret the operator asked us to remember, AND strip
 * any URL query string + fragment, before hashing. This is the
 * "no token leaks into the audit hash" guarantee: even if the
 * caller accidentally passes a struct that contains
 * `{ token: "abc" }` or `"https://x?token=abc"`, the hash is taken
 * over the redacted form so a leak in one run does not propagate
 * to all downstream comparison consumers.
 */
function redactForHash(value: unknown): unknown {
  if (typeof value === "string") {
    return redactUrlForLog(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactForHash);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      out[k] = redactForHash(obj[k]);
    }
    return out;
  }
  return value;
}

/**
 * SHA-256 hex digest of the canonicalized + redacted JSON of the
 * policy. Two policies with the same logical contents (modulo key
 * order, secret literals, or query-string parameters) hash equal.
 *
 * Format: lowercase hex, 64 chars.
 */
export function computePolicyHash(policy: unknown): string {
  const redacted = redactForHash(policy);
  const canonical = JSON.stringify(canonicalizeJson(redacted));
  return createHash("sha256").update(canonical).digest("hex");
}

/** Same contract as `computePolicyHash`, applied to the context input. */
export function computeContextHash(context: unknown): string {
  const redacted = redactForHash(context);
  const canonical = JSON.stringify(canonicalizeJson(redacted));
  return createHash("sha256").update(canonical).digest("hex");
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Redact a URL's query string and fragment. Thin re-export of the
 * canonical URL redaction helper in `src/util/url.ts` so audit-block
 * consumers do not have to import the URL utility directly.
 *
 * Always returns a string; never throws. Unparseable input is
 * substring-stripped, never silently accepted.
 */
export function redactUrl(value: string): string {
  return redactUrlForLog(value);
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a `ReviewMetrics` record to a single-line JSON string.
 * Performs the secret + URL redaction pass before stringifying so the
 * artifact never contains a token, query string, or fragment.
 *
 * The audit block carries its own `auditSchemaVersion: 2` marker so
 * v1 readers can detect "this is the new audit format" without
 * breaking on unknown top-level fields.
 *
 * Callers that want a stable, byte-for-byte artifact (e.g. evidence
 * snapshots) should use this helper rather than `JSON.stringify` so
 * the redaction pass is not bypassed.
 */
export function serializeReviewAudit(metrics: ReviewMetrics): string {
  return JSON.stringify(wrapAuditEnvelope(metrics));
}

// ---------------------------------------------------------------------------
// Audit envelope wrapping
// ---------------------------------------------------------------------------

/**
 * Wrap a `ReviewMetrics` record under the additive `audit` envelope
 * shape that gets attached to either the v1 CLI envelope's `data`
 * block or the live-artifact body's `audit` field. The wrapper is
 * additive: existing envelope consumers that do not know about the
 * audit block ignore it; new consumers that do can detect the
 * schema version from `auditSchemaVersion`.
 */
export function wrapAuditEnvelope(metrics: ReviewMetrics): {
  readonly audit: {
    readonly auditSchemaVersion: typeof AUDIT_SCHEMA_VERSION;
    readonly durations: ReviewMetrics["durations"];
    readonly counts: ReviewMetrics["counts"];
    readonly reasons: ReviewMetrics["reasons"];
    readonly usage?: ReviewMetrics["usage"];
    readonly usageRoundTrips?: ReviewMetrics["usageRoundTrips"];
    readonly cost?: ReviewMetrics["cost"];
    readonly decision?: ReviewMetrics["decision"];
    readonly policyHash?: ReviewMetrics["policyHash"];
    readonly contextHash?: ReviewMetrics["contextHash"];
    readonly redactions: AuditRedaction;
  };
} {
  return {
    audit: {
      auditSchemaVersion: AUDIT_SCHEMA_VERSION,
      durations: metrics.durations,
      counts: metrics.counts,
      reasons: metrics.reasons,
      ...(metrics.usage !== undefined ? { usage: metrics.usage } : {}),
      ...(metrics.usageRoundTrips !== undefined ? { usageRoundTrips: metrics.usageRoundTrips } : {}),
      ...(metrics.cost !== undefined ? { cost: metrics.cost } : {}),
      ...(metrics.decision !== undefined ? { decision: metrics.decision } : {}),
      ...(metrics.policyHash !== undefined ? { policyHash: metrics.policyHash } : {}),
      ...(metrics.contextHash !== undefined ? { contextHash: metrics.contextHash } : {}),
      redactions: metrics.redactions,
    },
  };
}
