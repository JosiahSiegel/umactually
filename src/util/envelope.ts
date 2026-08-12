// SPDX-License-Identifier: MIT
//
// M1 — EnvelopeV1: unified JSON output contract for every `--json`
// subcommand (review, doctor, uninstall, verify).
//
// Every `--json` subcommand emits the SAME shape so CI consumers can
// rely on a single parser. The shape is a STRICT SUPERSET of the
// pre-M1 per-command JSON contracts: existing top-level fields like
// `command`, `exitCode`, `schemaVersion`, `resolvedConfig`, and
// `outcome` continue to appear at the top level (so legacy consumers
// do not break), AND the full original payload is preserved under
// `data` for consumers that prefer the new structure.

import type { Writable } from "node:stream";

export const ENVELOPE_SCHEMA_VERSION = 1 as const;

export type EnvelopeCommand = "review" | "doctor" | "uninstall" | "verify";

export type EnvelopeError = {
  readonly code: string;
  readonly message: string;
};

/**
 * Anything that fits under `data`. We deliberately leave this loose
 * (Record<string, unknown>) so each subcommand keeps its domain shape.
 * The envelope is the WRAPPER, not the contract for `data`.
 */
export type EnvelopeData = Record<string, unknown>;

export type CreateEnvelopeOptions = {
  readonly exitCode?: number;
  readonly errors?: readonly EnvelopeError[];
  readonly hints?: readonly string[];
  readonly warnings?: readonly string[];
  /**
   * Override the started-at timestamp (ISO8601 string). The default
   * captures `new Date().toISOString()` at call time. Provided so
   * tests and migration paths can pin a deterministic value without
   * having to monkey-patch `Date`.
   */
  readonly startedAt?: string;
  /**
   * Override the elapsed duration. The default is 0 (pure helpers do
   * not measure). The async `envelopeFromCommand` measures the
   * wall-clock duration of the worker and overrides this.
   */
  readonly durationMs?: number;
};

export type Envelope = {
  readonly schemaVersion: typeof ENVELOPE_SCHEMA_VERSION;
  readonly command: EnvelopeCommand;
  readonly exitCode: number;
  readonly ok: boolean;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly data: EnvelopeData;
  readonly errors: readonly EnvelopeError[];
  readonly hints: readonly string[];
  readonly warnings: readonly string[];
};

const ALLOWED_COMMANDS: readonly EnvelopeCommand[] = ["review", "doctor", "uninstall", "verify"];

/**
 * Build an EnvelopeV1 record. Pure: no I/O, no clock side-effects
 * beyond reading `new Date()` once. The `data` payload is copied by
 * reference (envelope consumers are expected to be read-only).
 *
 * `ok` is derived from `exitCode`: it is `true` iff `exitCode === 0`.
 * This is the single source of truth for the success/failure flag —
 * callers MUST NOT set `ok` independently, otherwise the envelope
 * could lie about its own exit code.
 */
export function createEnvelope(
  command: EnvelopeCommand,
  data: EnvelopeData,
  opts: CreateEnvelopeOptions = {},
): Envelope {
  if (!ALLOWED_COMMANDS.includes(command)) {
    // Defensive guard: an unknown command name means the envelope
    // would lie about its origin, which a CI consumer would not be
    // able to detect. Surface it loudly rather than papering over.
    throw new RangeError(
      `createEnvelope: unknown command "${command}". Expected one of: ${ALLOWED_COMMANDS.join(", ")}`,
    );
  }
  const exitCode = opts.exitCode ?? 0;
  return {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    command,
    exitCode,
    ok: exitCode === 0,
    startedAt: opts.startedAt ?? new Date().toISOString(),
    durationMs: opts.durationMs ?? 0,
    data,
    errors: opts.errors ?? [],
    hints: opts.hints ?? [],
    warnings: opts.warnings ?? [],
  };
}

/**
 * Convenience wrapper around `createEnvelope` that measures wall-clock
 * duration around an async worker. Errors thrown by the worker are
 * captured as a single `{ code: "UNCAUGHT", message }` entry in
 * `errors[]` and the envelope is marked `ok: false` with `exitCode: 1`.
 *
 * Use this when you want a uniform envelope-with-timing contract for
 * a CLI subcommand body; for hand-built envelopes (e.g. inside a
 * dispatch layer that already tracks its own clock) use
 * `createEnvelope` directly.
 */
/**
 * Convert a nanosecond bigint delta to a millisecond integer using
 * integer division. We use `Number()` and `Math.trunc` rather than
 * `Number(bigint / 1_000_000n)` so the result is bounded to
 * `Number.MAX_SAFE_INTEGER` — safe durations are well within range.
 */
function hrtimeDeltaMs(startNs: bigint, endNs: bigint): number {
  const deltaNs = endNs - startNs;
  return Math.max(0, Math.trunc(Number(deltaNs / 1_000_000n)));
}

export async function envelopeFromCommand(
  command: EnvelopeCommand,
  worker: () => Promise<EnvelopeData>,
  opts: Omit<CreateEnvelopeOptions, "durationMs" | "startedAt" | "exitCode"> = {},
): Promise<Envelope> {
  const startedAt = new Date().toISOString();
  const startNs = process.hrtime.bigint();
  try {
    const data = await worker();
    const durationMs = hrtimeDeltaMs(startNs, process.hrtime.bigint());
    return createEnvelope(command, data, {
      ...opts,
      startedAt,
      durationMs,
      exitCode: 0,
    });
  } catch (err) {
    const durationMs = hrtimeDeltaMs(startNs, process.hrtime.bigint());
    const message = err instanceof Error ? err.message : String(err);
    return createEnvelope(command, {}, {
      ...opts,
      startedAt,
      durationMs,
      exitCode: 1,
      errors: [{ code: "UNCAUGHT", message }],
    });
  }
}

/**
 * Serialize an envelope to JSON and write it (followed by a single
 * `\n`) to the supplied writable stream. Defaults to `process.stdout`.
 *
 * Uses `JSON.stringify` without indentation so the output is
 * single-line (matches the pre-M1 wire shape); downstream tools
 * already pipe through `jq -c` and the human output is the OTHER
 * branch (the `format*Human` functions).
 */
export function emitJsonEnvelope(envelope: Envelope, out: Writable = process.stdout): void {
  out.write(`${JSON.stringify(envelope)}\n`);
}
