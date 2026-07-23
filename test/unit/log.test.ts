import { afterEach, describe, expect, it, vi } from "vitest";

import { logDebug, logError, logNotice, logWarning } from "../../src/util/log.js";

describe("log annotation fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to console.error when stderr write throws for warnings", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logWarning("scan", "warning message");

    // Fallback routes through console.error with the SAME `formatted`
    // string the normal write would have produced — i.e. it respects
    // the quiet-mode strip in formatAnnotation. Under vitest, the
    // `::warning::` prefix is stripped, so the fallback emits the
    // brand-prefixed line only.
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("umactually: scan warning message");
  });

  it("falls back to console.error when stderr write throws for errors", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("orchestrator", "fatal failure");

    // Under vitest, the `::error::` prefix is stripped (quiet mode).
    // The fallback emits the brand-prefixed line only — see the
    // matching comment in src/util/log.ts.
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("umactually: orchestrator fatal failure");
  });

  it("falls back to console.error when stderr write throws for notices", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logNotice("info", "notice message");

    // Under vitest, the `::notice::` prefix is stripped (quiet mode).
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("umactually: info notice message");
  });

  it("does not fall back to console.error for debug annotations", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logDebug("trace", "debug message");

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

