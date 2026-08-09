// SPDX-License-Identifier: MIT
//
// Unit tests for src/util/envelope.ts. EnvelopeV1 is the unified
// --json wire shape for `review`, `doctor`, `uninstall`, and
// `verify`. Two factories are exercised:
//
//   - `createEnvelope` — pure helper, derives `ok` from `exitCode`,
//     defaults errors/hints/warnings/data to empty values, and
//     stamps `startedAt`/`durationMs` (callers can override).
//   - `envelopeFromCommand` — async wrapper that times the worker
//     via `process.hrtime.bigint()` and converts thrown errors
//     into `{ code: "UNCAUGHT", message }` with exitCode=1.
//
// And `emitJsonEnvelope` which writes single-line JSON + trailing
// newline to any writable stream.

import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import {
  ENVELOPE_SCHEMA_VERSION,
  createEnvelope,
  emitJsonEnvelope,
  envelopeFromCommand,
  type EnvelopeCommand,
} from "../../src/util/envelope.js";

const ALLOWED_COMMANDS: readonly EnvelopeCommand[] = [
  "review",
  "doctor",
  "uninstall",
  "verify",
];

describe("createEnvelope — happy path", () => {
  it.each(ALLOWED_COMMANDS)(
    "builds a schema-version-1 envelope with ok=true for command='%s'",
    (command) => {
      // Given: a default-exitCode envelope (exitCode=0 → ok=true).
      const env = createEnvelope(command, { result: "ok" });

      // Then: every required field is populated and `ok` derives
      // from the default exit code.
      expect(env.schemaVersion).toBe(ENVELOPE_SCHEMA_VERSION);
      expect(env.schemaVersion).toBe(1);
      expect(env.command).toBe(command);
      expect(env.exitCode).toBe(0);
      expect(env.ok).toBe(true);
      expect(env.data).toEqual({ result: "ok" });
      expect(env.errors).toEqual([]);
      expect(env.hints).toEqual([]);
      expect(env.warnings).toEqual([]);
      expect(typeof env.startedAt).toBe("string");
      expect(env.durationMs).toBe(0);
    },
  );

  it("builds an envelope with ok=false when exitCode is non-zero", () => {
    // Given: an explicit non-zero exit code.
    const env = createEnvelope("review", { reason: "failed" }, { exitCode: 2 });

    // Then: ok is derived strictly from exitCode — the helper
    // forbids callers from setting `ok` independently.
    expect(env.exitCode).toBe(2);
    expect(env.ok).toBe(false);
  });

  it("preserves the supplied errors/hints/warnings arrays and data payload", () => {
    // Given: every optional collection populated with deterministic
    // values and a structured data payload.
    const errors = [
      { code: "BAD_INPUT", message: "missing field" },
      { code: "TIMEOUT", message: "upstream slow" },
    ];
    const hints = ["try --json", "rerun with --verbose"];
    const warnings = ["deprecated flag"];
    const data = { counts: { posts: 4 }, reviewId: "abc" };

    const env = createEnvelope(
      "doctor",
      data,
      { errors, hints, warnings, exitCode: 1 },
    );

    // Then: every field round-trips verbatim.
    expect(env.errors).toEqual(errors);
    expect(env.hints).toEqual(hints);
    expect(env.warnings).toEqual(warnings);
    expect(env.data).toBe(data);
    expect(env.ok).toBe(false);
  });

  it("honors the supplied startedAt and durationMs overrides", () => {
    // Given: deterministic values for the two timestamp fields.
    const env = createEnvelope(
      "verify",
      {},
      { startedAt: "2026-01-01T00:00:00.000Z", durationMs: 12345 },
    );

    // Then: the overrides are present, not replaced with the default
    // "now" timestamp / 0.
    expect(env.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(env.durationMs).toBe(12345);
  });
});

describe("createEnvelope — defensive guard", () => {
  it("throws RangeError on an unknown command name", () => {
    // Given: an unrecognized command name.
    // When/Then: a RangeError is thrown with the allowed-list hint.
    expect(() =>
      createEnvelope("nuke" as EnvelopeCommand, {}),
    ).toThrowError(RangeError);
    expect(() =>
      createEnvelope("nuke" as EnvelopeCommand, {}),
    ).toThrow(/unknown command "nuke".*review, doctor, uninstall, verify/);
  });
});

describe("envelopeFromCommand — success path", () => {
  it("captures the worker's resolved data, sets startedAt, and computes durationMs >= 0", async () => {
    // Given: a worker that resolves with a structured payload.
    const before = Date.now();
    const env = await envelopeFromCommand("review", async () => ({
      marker: "umactually",
      posted: 3,
    }));
    const after = Date.now();

    // Then: ok=true, exitCode=0, errors empty, data round-trips,
    // startedAt is a parseable ISO8601 timestamp between the before
    // and after wall-clock readings, and durationMs is a non-negative
    // number (the helper uses hrtime.bigint() internally and floors
    // the result to integer ms).
    expect(env.ok).toBe(true);
    expect(env.exitCode).toBe(0);
    expect(env.errors).toEqual([]);
    expect(env.data).toEqual({ marker: "umactually", posted: 3 });
    expect(env.command).toBe("review");

    const startedAtMs = Date.parse(env.startedAt);
    expect(Number.isNaN(startedAtMs)).toBe(false);
    expect(startedAtMs).toBeGreaterThanOrEqual(before - 5);
    expect(startedAtMs).toBeLessThanOrEqual(after + 5);
    expect(env.durationMs).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(env.durationMs)).toBe(true);
  });

  it("propagates caller-supplied errors/hints/warnings onto the success envelope", async () => {
    // Given: a worker that resolves cleanly, plus caller-supplied
    // non-empty errors/hints/warnings (the helper spreads opts first,
    // then overrides timing fields).
    const env = await envelopeFromCommand(
      "doctor",
      async () => ({ ok: true }),
      {
        errors: [{ code: "STALE", message: "config outdated" }],
        hints: ["run init"],
        warnings: ["experimental build"],
      },
    );

    // Then: ok=true (the worker did not throw), and the caller arrays
    // are preserved verbatim.
    expect(env.ok).toBe(true);
    expect(env.errors).toEqual([{ code: "STALE", message: "config outdated" }]);
    expect(env.hints).toEqual(["run init"]);
    expect(env.warnings).toEqual(["experimental build"]);
  });
});

describe("envelopeFromCommand — failure path", () => {
  it("captures a thrown Error as { code: 'UNCAUGHT', message } and sets ok=false / exitCode=1", async () => {
    // Given: a worker that throws a plain Error.
    const env = await envelopeFromCommand("review", async () => {
      throw new Error("provider call failed");
    });

    // Then: ok=false, exitCode=1, errors carries a single UNCAUGHT
    // entry with the original message.
    expect(env.ok).toBe(false);
    expect(env.exitCode).toBe(1);
    expect(env.errors).toEqual([
      { code: "UNCAUGHT", message: "provider call failed" },
    ]);
    expect(env.data).toEqual({});
    expect(env.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("captures a thrown non-Error value as a stringified UNCAUGHT message", async () => {
    // Given: a worker that throws a non-Error value (string).
    const env = await envelopeFromCommand("doctor", async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "raw failure string";
    });

    // Then: the message is String(error) verbatim.
    expect(env.errors).toEqual([{ code: "UNCAUGHT", message: "raw failure string" }]);
    expect(env.ok).toBe(false);
  });
});

describe("emitJsonEnvelope — wire shape", () => {
  it("writes single-line JSON followed by a newline to the supplied writable", () => {
    // Given: an envelope and an in-memory writable that records writes.
    const captured: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, callback) {
        captured.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    });

    const env = createEnvelope(
      "verify",
      { result: "ok" },
      { startedAt: "2026-01-01T00:00:00.000Z", durationMs: 7 },
    );

    // When: emitJsonEnvelope writes the envelope.
    emitJsonEnvelope(env, sink);

    // Then: the captured bytes are exactly the JSON serialization
    // followed by a single trailing newline (no pretty-printing).
    const text = Buffer.concat(captured).toString("utf8");
    expect(text.endsWith("\n")).toBe(true);
    const body = text.slice(0, -1);
    expect(body).not.includes("\n");

    // And: the body round-trips through JSON.parse to the original
    // envelope shape (minus the data field, which is copied by
    // reference).
    const parsed = JSON.parse(body);
    expect(parsed.schemaVersion).toBe(ENVELOPE_SCHEMA_VERSION);
    expect(parsed.command).toBe("verify");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(parsed.durationMs).toBe(7);
    expect(parsed.data).toEqual({ result: "ok" });
  });

  it("emits to process.stdout by default (smoke check via a sink-shaped writable)", () => {
    // Given: an envelope that captures the bytes via a duck-typed
    // writable. The default arg path uses process.stdout; we
    // cannot reliably intercept stdout, but we CAN verify the
    // non-default sink path is byte-identical to calling
    // `out.write(`${JSON.stringify(env)}\n`)`.
    const env = createEnvelope("uninstall", { removed: true });

    let captured = "";
    const sink = new Writable({
      write(chunk, _enc, callback) {
        captured += chunk.toString();
        callback();
      },
    });

    emitJsonEnvelope(env, sink);

    // Then: the captured payload equals `JSON.stringify(env) + "\n"`.
    expect(captured).toBe(`${JSON.stringify(env)}\n`);
  });
});
