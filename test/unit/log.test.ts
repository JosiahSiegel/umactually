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

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("::warning::umactually-pr-review: scan warning message");
  });

  it("falls back to console.error when stderr write throws for errors", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("orchestrator", "fatal failure");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("::error::umactually-pr-review: orchestrator fatal failure");
  });

  it("falls back to console.error when stderr write throws for notices", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logNotice("info", "notice message");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("::notice::umactually-pr-review: info notice message");
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
