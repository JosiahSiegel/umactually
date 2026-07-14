import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * M4 — `--no-color` / `NO_COLOR` policy.
 *
 * Pure unit seam: `resolveColorPolicy(opts)` returns `true` when color
 * should be emitted, `false` when it should be suppressed. The function
 * is the single source of truth that downstream renderers consult
 * before emitting ANSI escapes.
 *
 * Precedence (top wins):
 *   1. `--no-color` flag (`opts.noColor`)
 *   2. `NO_COLOR` env var (any non-empty value per https://no-color.org)
 *   3. `opts.json === true` (JSON output mode implies no-color)
 *   4. `opts.isTTY === false` (piped/redirected output suppresses color)
 *   5. otherwise `true` (TTY + no overrides → emit color)
 *
 * The fifth test (CLI-COLOR-005) is an integration assertion that the
 * wired-up `dispatch(['review', '--no-color', '--help'])` surface
 * produces zero ANSI escapes on stdout, locking the contract end-to-end.
 */
describe("CLI no-color policy (M4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CLI-COLOR-001: explicit --no-color resolves false even when isTTY=true", async () => {
    const mod = (await import("../../src/cli/no-color.js").catch(() => ({}))) as {
      readonly resolveColorPolicy?: (
        opts: { readonly noColor: boolean; readonly json: boolean; readonly env: NodeJS.ProcessEnv; readonly isTTY: boolean },
      ) => boolean;
    };
    expect(typeof mod.resolveColorPolicy).toBe("function");

    const result = mod.resolveColorPolicy!({
      noColor: true,
      json: false,
      env: {},
      isTTY: true,
    });
    expect(result).toBe(false);
  });

  it("CLI-COLOR-002: NO_COLOR='1' and NO_COLOR='anything' both resolve false", async () => {
    const mod = (await import("../../src/cli/no-color.js").catch(() => ({}))) as {
      readonly resolveColorPolicy?: (
        opts: { readonly noColor: boolean; readonly json: boolean; readonly env: NodeJS.ProcessEnv; readonly isTTY: boolean },
      ) => boolean;
    };
    expect(typeof mod.resolveColorPolicy).toBe("function");

    // Per https://no-color.org — any non-empty value disables color.
    // Two representative values: canonical '1' and an arbitrary token.
    const oneResult = mod.resolveColorPolicy!({
      noColor: false,
      json: false,
      env: { NO_COLOR: "1" },
      isTTY: true,
    });
    expect(oneResult).toBe(false);

    const anyResult = mod.resolveColorPolicy!({
      noColor: false,
      json: false,
      env: { NO_COLOR: "anything-non-empty" },
      isTTY: true,
    });
    expect(anyResult).toBe(false);
  });

  it("CLI-COLOR-003: isTTY=false resolves false even with no other override", async () => {
    const mod = (await import("../../src/cli/no-color.js").catch(() => ({}))) as {
      readonly resolveColorPolicy?: (
        opts: { readonly noColor: boolean; readonly json: boolean; readonly env: NodeJS.ProcessEnv; readonly isTTY: boolean },
      ) => boolean;
    };
    expect(typeof mod.resolveColorPolicy).toBe("function");

    // No flags set, NO_COLOR unset, but piped/redirected (isTTY=false).
    const result = mod.resolveColorPolicy!({
      noColor: false,
      json: false,
      env: {},
      isTTY: false,
    });
    expect(result).toBe(false);
  });

  it("CLI-COLOR-004: json=true resolves false (JSON mode implies no-color)", async () => {
    const mod = (await import("../../src/cli/no-color.js").catch(() => ({}))) as {
      readonly resolveColorPolicy?: (
        opts: { readonly noColor: boolean; readonly json: boolean; readonly env: NodeJS.ProcessEnv; readonly isTTY: boolean },
      ) => boolean;
    };
    expect(typeof mod.resolveColorPolicy).toBe("function");

    // Even with TTY and no --no-color and no NO_COLOR, JSON output mode
    // must be color-free so downstream `jq` pipelines are not corrupted
    // by stray ANSI escapes.
    const result = mod.resolveColorPolicy!({
      noColor: false,
      json: true,
      env: {},
      isTTY: true,
    });
    expect(result).toBe(false);
  });

  it("CLI-COLOR-005: dispatch(['review','--no-color','--help']) emits zero ANSI escapes on stdout", async () => {
    // End-to-end smoke: when the user invokes `umactually review
    // --no-color --help`, the help text reaches stdout with NO ANSI
    // escape sequences. This locks the seam's behavior through the
    // public dispatch entry point so a future renderer refactor
    // can't reintroduce color into the help pipeline.
    let stdout = "";
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });

    let exitCode = -1;
    try {
      const dispatchMod = (await import("../../src/cli/dispatch.js").catch(() => ({}))) as {
        readonly dispatch?: (args: readonly string[]) => Promise<number>;
      };
      expect(typeof dispatchMod.dispatch).toBe("function");
      exitCode = await dispatchMod.dispatch!(["review", "--no-color", "--help"]);
    } finally {
      stdoutSpy.mockRestore();
    }

    expect(exitCode).toBe(0);
    // CSI escapes: ESC [ … final-byte. Match the canonical ANSI regex.
    const ANSI_RE = /\x1B\[[0-?]*[ -/]*[@-~]/u;
    expect(ANSI_RE.test(stdout)).toBe(false);
  });
});