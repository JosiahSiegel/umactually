import { Writable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CLI_MODES_TEXT, printModesBanner } from "../../src/cli/modes-help.js";

// printModesBanner's only contract is "write CLI_MODES_TEXT to the chosen
// stream". The default-stream branch is reached when the caller passes
// `undefined`; the explicit-stream branch is reached when the caller
// passes a NodeJS.WritableStream. We cover both with the same pattern
// the rest of this repo uses (see test/unit/cli-bare-invocation.test.ts
// :39-50 for the stdout.write mock) and we pin the exact bytes written
// so a future refactor that re-shapes the banner regresses loudly.
describe("printModesBanner", () => {
  let originalStdoutWrite: typeof process.stdout.write;
  let stdoutBuf = "";

  beforeEach(() => {
    originalStdoutWrite = process.stdout.write.bind(process.stdout);
    stdoutBuf = "";
    process.stdout.write = ((c: string | Uint8Array): boolean => {
      stdoutBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    stdoutBuf = "";
  });

  it("default-stream branch: writes CLI_MODES_TEXT to process.stdout when called with undefined", () => {
    // Given: no explicit stream — printModesBanner must fall through
    // to process.stdout (the canonical default for "print a banner to
    // the operator's terminal").
    printModesBanner(undefined);

    // Then: process.stdout.write was called with the exact bytes of
    // CLI_MODES_TEXT, and nothing else was written.
    expect(stdoutBuf).toBe(CLI_MODES_TEXT);
  });

  it("explicit-stream branch: writes CLI_MODES_TEXT to the caller-provided stream and leaves process.stdout untouched", () => {
    // Given: an in-memory Writable that captures every chunk the
    // banner is written to. This is the only branch where a custom
    // stream is supplied — every other test in this file should hit
    // the default-stream branch above.
    const captured: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer | string, _enc, cb): void {
        captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
        cb();
      },
    });

    printModesBanner(stream);

    // Then: the banner landed on the supplied stream — and nowhere
    // else. process.stdout.write must NOT have been called, because
    // the explicit stream short-circuits the default.
    expect(captured).toEqual([CLI_MODES_TEXT]);
    expect(stdoutBuf).toBe("");
  });
});
