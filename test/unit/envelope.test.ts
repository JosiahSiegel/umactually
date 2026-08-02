// SPDX-License-Identifier: MIT
//
// M1 EnvelopeV1 — unified CLI JSON envelope contract.
//
// Every `--json` subcommand output (review, doctor, uninstall, verify)
// must serialize under this exact shape so CI consumers can rely on a
// single parser. See `.omo/plans/cli-simplification-hyperplan-bundle.md`
// §1.M1 for the contract and the rationale.

import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import {
  createEnvelope,
  emitJsonEnvelope,
  envelopeFromCommand,
  type Envelope,
  type EnvelopeError,
} from "../../src/util/envelope.js";

const REQUIRED_KEYS = [
  "schemaVersion",
  "command",
  "exitCode",
  "ok",
  "startedAt",
  "durationMs",
  "data",
  "errors",
  "hints",
  "warnings",
] as const;

describe("createEnvelope", () => {
  it("ENVELOPE-001: includes all 10 required top-level keys", () => {
    // Given: a basic data payload
    const env = createEnvelope("review", { foo: 1 });

    // Then: every required key is present
    for (const key of REQUIRED_KEYS) {
      expect(env).toHaveProperty(key);
    }
  });

  it("ENVELOPE-002: schemaVersion is the literal 1", () => {
    const env = createEnvelope("review", {});
    expect(env.schemaVersion).toBe(1);
  });

  it("ENVELOPE-003: command is preserved verbatim", () => {
    expect(createEnvelope("review", {}).command).toBe("review");
    expect(createEnvelope("doctor", {}).command).toBe("doctor");
    expect(createEnvelope("uninstall", {}).command).toBe("uninstall");
    expect(createEnvelope("verify", {}).command).toBe("verify");
  });

  it("ENVELOPE-004: ok is true when exitCode === 0", () => {
    const env = createEnvelope("review", {}, { exitCode: 0 });
    expect(env.ok).toBe(true);
  });

  it("ENVELOPE-005: ok is false when exitCode !== 0", () => {
    expect(createEnvelope("review", {}, { exitCode: 1 }).ok).toBe(false);
    expect(createEnvelope("review", {}, { exitCode: 2 }).ok).toBe(false);
    expect(createEnvelope("review", {}, { exitCode: 127 }).ok).toBe(false);
  });

  it("ENVELOPE-006: exitCode defaults to 0 when omitted (callers must pass non-zero on failure)", () => {
    // The contract is that ok IS derived from exitCode — ok ===
    // (exitCode === 0). If a caller forgets to pass exitCode, the
    // envelope falls back to a 0/ok=true shape; the caller is
    // expected to pass the real exit code explicitly when handling
    // failure paths. We pin the default so any change to the
    // derivation rule is a deliberate choice.
    const env = createEnvelope("review", {});
    expect(env.exitCode).toBe(0);
    expect(env.ok).toBe(true);
  });

  it("ENVELOPE-007: data field carries the supplied payload unchanged", () => {
    const payload = {
      verdict: "COMMENT",
      comments: [{ path: "src/foo.ts", line: 12, body: "x" }],
      resolvedConfig: { apiUrl: "https://api.example/v1" },
    };
    const env = createEnvelope("review", payload);
    expect(env.data).toEqual(payload);
  });

  it("ENVELOPE-008: errors, hints, warnings default to empty arrays when omitted", () => {
    const env = createEnvelope("doctor", {});
    expect(env.errors).toEqual([]);
    expect(env.hints).toEqual([]);
    expect(env.warnings).toEqual([]);
  });

  it("ENVELOPE-009: errors, hints, warnings are passed through when supplied", () => {
    const errors: EnvelopeError[] = [{ code: "PARSE_FAIL", message: "missing JSON fence" }];
    const env = createEnvelope("review", {}, { errors, hints: ["retry once"], warnings: ["low confidence"] });
    expect(env.errors).toEqual(errors);
    expect(env.hints).toEqual(["retry once"]);
    expect(env.warnings).toEqual(["low confidence"]);
  });

  it("ENVELOPE-010: startedAt is a parseable ISO8601 timestamp close to now", () => {
    const before = Date.now();
    const env = createEnvelope("review", {});
    const after = Date.now();
    const ts = Date.parse(env.startedAt);
    expect(Number.isFinite(ts)).toBe(true);
    // Allow a tiny skew for the clock advancing between the two reads.
    expect(ts).toBeGreaterThanOrEqual(before - 5);
    expect(ts).toBeLessThanOrEqual(after + 5);
  });

  it("ENVELOPE-011: durationMs is a non-negative integer", () => {
    const env = createEnvelope("review", {});
    expect(typeof env.durationMs).toBe("number");
    expect(Number.isInteger(env.durationMs)).toBe(true);
    expect(env.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("ENVELOPE-012: explicit startedAt / durationMs overrides are honored", () => {
    const env = createEnvelope(
      "review",
      {},
      { startedAt: "2026-01-01T00:00:00.000Z", durationMs: 4242 },
    );
    expect(env.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(env.durationMs).toBe(4242);
  });

  it("ENVELOPE-013: returned object is structurally an Envelope (round-trips through JSON.stringify cleanly)", () => {
    const env: Envelope = createEnvelope("review", { x: 1 }, {
      errors: [{ code: "X", message: "y" }],
    });
    const text = JSON.stringify(env);
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toEqual(env);
  });
});

describe("envelopeFromCommand", () => {
  it("ENVELOPE-020: produces an envelope with a measured durationMs > 0 when the worker yields", async () => {
    // The helper starts an hrtime clock before awaiting the worker,
    // then closes the clock on completion. We force the worker to
    // yield for ~5ms via setTimeout so the duration crosses the
    // millisecond boundary reliably (a no-op worker can complete in
    // microseconds on a fast machine and round down to 0).
    const env = await envelopeFromCommand("review", async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      return { data: "x" };
    });
    expect(env.command).toBe("review");
    expect(env.data).toEqual({ data: "x" });
    expect(env.ok).toBe(true);
    expect(env.durationMs).toBeGreaterThan(0);
    expect(env.exitCode).toBe(0);
  });

  it("ENVELOPE-021: maps a thrown error to a non-ok envelope with errors[] populated", async () => {
    const env = await envelopeFromCommand("review", async () => {
      throw new Error("kaboom");
    });
    expect(env.ok).toBe(false);
    expect(env.exitCode).toBe(1);
    expect(env.errors).toEqual([{ code: "UNCAUGHT", message: "kaboom" }]);
  });

  it("ENVELOPE-022: maps a non-Error throw to a stringified message", async () => {
    const env = await envelopeFromCommand("review", async () => {
      throw "string-throw";
    });
    expect(env.errors[0]).toEqual({ code: "UNCAUGHT", message: "string-throw" });
  });

  it("ENVELOPE-023: durationMs is always set to a non-negative integer, even on worker error", async () => {
    const env = await envelopeFromCommand("review", async () => {
      throw new Error("x");
    });
    expect(env.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("emitJsonEnvelope", () => {
  function makeCapturingWritable(): {
    readonly stream: Writable;
    readonly chunks: string[];
  } {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer | string, _enc, cb): void {
        chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
        cb();
      },
    });
    return { stream, chunks };
  }

  it("ENVELOPE-030: writes valid JSON followed by a newline to the supplied writable", () => {
    const { stream, chunks } = makeCapturingWritable();
    const env = createEnvelope("doctor", { checks: [] }, { exitCode: 0 });
    emitJsonEnvelope(env, stream);
    expect(chunks).toHaveLength(1);
    const text = chunks[0] ?? "";
    expect(text.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(text)).not.toThrow();
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toEqual(env);
  });

  it("ENVELOPE-031: defaults to process.stdout when no stream is supplied", () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      const env = createEnvelope("review", { ok: true });
      emitJsonEnvelope(env);
      expect(spy).toHaveBeenCalledTimes(1);
      const firstCall = spy.mock.calls[0];
      expect(firstCall).toBeDefined();
      const arg = firstCall?.[0];
      expect(typeof arg).toBe("string");
      expect(() => JSON.parse(arg as string)).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
