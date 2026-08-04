import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tests for the bare-`umactually` compact quickstart (added in v0.6.24,
 * extended to the loaded-config case in v0.6.26).
 *
 * Contract (pinned):
 *   v0.6.24 contract (unchanged):
 *   - Bare `umactually` on a TTY with no `~/.umactually/config.json`
 *     and no programmatic flags REPLACES the loud `cli: --api-url is
 *     required` + `pick a mode:` banner with a compact quickstart
 *     that leads with `umactually init`. Exits 0.
 *   - Bare `umactually` non-TTY (piped, CI) keeps the loud banner.
 *   - Programmatic flag invocations (`--json`, `--no-color`,
 *     `--api-*`, `--model`, `--platform`) keep the loud banner.
 *
 *   v0.6.26 contract additions:
 *   - Bare `umactually` when a saved config ALREADY EXISTS also runs
 *     the compact quickstart, but with a different first line that
 *     confirms what's loaded (`Loaded config (provider=X, model=Y).`)
 *     AND WITHOUT the `umactually init` block — the operator has
 *     already configured.
 *
 * Back-compat regression guards (CLI-SUB-005, CLI-SYMBIOTIC-2):
 *   - `test/unit/cli-subcommands.test.ts:CLI-SUB-005` runs dispatch([])
 *     under vitest (non-TTY), so the loud banner STILL fires there.
 *   - `test/unit/cli-bare-invocation.test.ts` calls `runCli` directly
 *     (the path the loud banner lives in), unaffected by the dispatch
 *     quickstart branch.
 *
 * Industry-standard reference: matches `rustup`, `fnm`, `volta`,
 * `nvm`, `pip`, `brew install` first-run output. Single screen, exit 0.
 */

const dispatchModule = "../../src/cli/dispatch.js";
const dispatchPath = "src/cli/dispatch.ts";

type DispatchFn = (argv: readonly string[]) => Promise<{ readonly exitCode: number }>;

interface StdoutStderrCapture {
  readonly restore: () => void;
  readonly stdout: { readonly text: string };
  readonly stderr: { readonly text: string };
}

function captureStdoutStderr(): StdoutStderrCapture {
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const stdoutState = { text: "" };
  const stderrState = { text: "" };
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdoutState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderrState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;
  return {
    stdout: stdoutState,
    stderr: stderrState,
    restore: () => {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    },
  };
}

const ENV_KEYS_TO_CLEAR = [
  "HOME",
  "USERPROFILE",
  "UMACTUALLY_API_URL",
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_MODEL",
  "GITHUB_ACTIONS",
  "TF_BUILD",
] as const;

let savedEnv: Record<string, string | undefined> = {};
let savedIsTTY: boolean | undefined;
let tempHome: string | null = null;

function clearEnv(): void {
  for (const key of ENV_KEYS_TO_CLEAR) {
    delete process.env[key];
  }
}

describe("CLI first-run compact quickstart (v0.6.24)", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    clearEnv();
    savedIsTTY = process.stdout.isTTY;

    // Fresh temp HOME so ~/.umactually/config.json never exists unless
    // we explicitly write it for the "config-present" test.
    tempHome = mkdtempSync(join(tmpdir(), "umactually-quickstart-"));
    process.env["HOME"] = tempHome;
  });

  afterEach(() => {
    clearEnv();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    process.stdout.isTTY = savedIsTTY ?? false;
    if (tempHome !== null) {
      try {
        rmSync(tempHome, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; the tmp dir is throwaway.
      }
      tempHome = null;
    }
  });

  async function loadDispatch(): Promise<DispatchFn> {
    const mod = (await import(dispatchModule)) as { dispatch?: DispatchFn };
    if (typeof mod.dispatch !== "function") {
      throw new Error(`${dispatchPath} must export dispatch(argv)`);
    }
    return mod.dispatch;
  }

  it("QUICK-1: bare `umactually` on TTY + no saved config + no flags → compact quickstart, exit 0", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    let result: { readonly exitCode: number };
    try {
      result = await dispatch([]);
    } finally {
      capture.restore();
    }

    // Exit 0 — first run is not an error.
    expect(result.exitCode).toBe(0);
    // The quickstart leads with the wizard (most important action).
    const out = capture.stdout.text;
    expect(out).toContain("umactually init");
    // And summarizes the three review commands compactly.
    expect(out).toMatch(/umactually review/);
    expect(out).toMatch(/--files/);
    expect(out).toMatch(/umactually doctor/);
    // Points at --help for the full reference.
    expect(out).toContain("umactually --help");
    // The NOISY banner does NOT fire for first-time users.
    expect(capture.stderr.text).not.toContain("cli: --api-url is required");
    expect(capture.stderr.text).not.toContain("pick a mode:");
  });

  it("QUICK-2: bare `umactually` non-TTY (CI) keeps the loud banner — no quickstart", async () => {
    process.stdout.isTTY = false;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    // No quickstart in CI.
    expect(capture.stdout.text).not.toContain("umactually init\n");
    expect(capture.stdout.text).not.toMatch(/Welcome to umactually/);
    // The loud banner DOES fire (preserves CLI-SUB-005 contract).
    expect(capture.stderr.text).toContain("cli: --api-url is required");
    expect(capture.stderr.text).toContain("pick a mode:");
  });

  it("QUICK-2b: bare `umactually` with CI env var set (even if TTY) keeps the loud banner", async () => {
    // QUICK-2 only covers the non-TTY path. QUICK-6 covers the
    // isTTY-but-CI-env path (the self-review finding). This is the
    // half that verifies the loud banner is reachable when the CI
    // detector fires.
    process.stdout.isTTY = true;
    process.env["GITHUB_ACTIONS"] = "true";
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }
    delete process.env["GITHUB_ACTIONS"];

    expect(capture.stdout.text).not.toMatch(/Welcome to umactually/);
    expect(capture.stderr.text).toContain("cli: --api-url is required");
  });

  it("QUICK-3: bare `umactually` when a saved config exists shows the loaded quickstart (no init line)", async () => {
    // v0.6.26 contract change: previously (v0.6.25) the loud banner
    // fired when a saved config existed. Now the compact quickstart
    // also fires for the post-init case, but with a different first
    // line that confirms what's loaded AND WITHOUT the `umactually
    // init` line — the operator has already configured and pointing
    // them at the wizard again would be condescending.
    process.stdout.isTTY = true;
    if (tempHome !== null) {
      mkdirSync(join(tempHome, ".umactually"), { recursive: true });
      writeFileSync(
        join(tempHome, ".umactually", "config.json"),
        JSON.stringify({
          schemaVersion: 1,
          provider: "openai-compatible",
          apiUrl: "https://api.example.com/v1",
          model: "gpt-5-mini",
        }),
      );
    }
    const dispatch = await loadDispatch();
    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    expect(capture.stdout.text).toMatch(/Loaded config \(provider=openai-compatible, model=gpt-5-mini\)/);
    expect(capture.stdout.text).not.toContain("Get started with the setup wizard");
    expect(capture.stdout.text).not.toContain("\n  umactually init\n");
    expect(capture.stdout.text).toContain("umactually review --api-key");
    expect(capture.stdout.text).toContain("umactually --files");
    expect(capture.stdout.text).toContain("umactually doctor");
    expect(capture.stderr.text).not.toContain("cli: --api-url is required");
    expect(capture.stderr.text).not.toContain("pick a mode:");
  });

  it("QUICK-3b: loaded quickstart works without `model` field", async () => {
    // Some operators run init without a custom model — the wizard
    // leaves `model` undefined and the live path uses schema default
    // "auto". The loaded quickstart should NOT print `(model=undefined)`.
    process.stdout.isTTY = true;
    if (tempHome !== null) {
      mkdirSync(join(tempHome, ".umactually"), { recursive: true });
      writeFileSync(
        join(tempHome, ".umactually", "config.json"),
        JSON.stringify({ schemaVersion: 1, provider: "anthropic" }),
      );
    }
    const dispatch = await loadDispatch();
    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }
    expect(capture.stdout.text).toContain("Loaded config (provider=anthropic).");
    expect(capture.stdout.text).not.toContain("model=undefined");
    expect(capture.stdout.text).not.toContain("model=null");
  });

  it("QUICK-4: programmatic flags keep the loud banner (--json / --no-color / --api-* / --model / --platform)", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    for (const flag of ["--json", "--no-color", "--api-url", "--api-key", "--model", "--platform", "github"]) {
      const capture = captureStdoutStderr();
      try {
        await dispatch([flag]);
      } finally {
        capture.restore();
      }
      expect(capture.stdout.text).not.toMatch(/Welcome to umactually/);
      // Note: --json triggers different output; we only assert no quickstart.
    }
  });

  it("QUICK-5: quickstart uses brand prefix and ends with a trailing newline", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    // Brand prefix on the first line.
    expect(capture.stdout.text.startsWith("umactually: ")).toBe(true);
    // Trailing newline so the shell prompt doesn't glue to the output.
    expect(capture.stdout.text.endsWith("\n")).toBe(true);
  });

  it("QUICK-6: CI env vars keep the loud banner even when isTTY is true", async () => {
    // Regression guard for the self-review finding: isTTY alone is
    // not enough — automation can run on a pseudo-TTY (test runners,
    // SSH sessions). When any known CI platform env var is set, the
    // loud banner fires regardless of TTY state.
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    for (const [key, value] of [
      ["GITHUB_ACTIONS", "true"],
      ["TF_BUILD", "True"],
      ["BUILDKITE", "true"],
      ["CIRCLECI", "true"],
      ["JENKINS_URL", "https://example/jenkins"],
    ] as const) {
      process.env[key] = value;
      const capture = captureStdoutStderr();
      try {
        await dispatch([]);
      } finally {
        capture.restore();
      }
      expect(capture.stdout.text, `${key} should suppress the quickstart`).not.toMatch(/Welcome to umactually/);
      expect(capture.stderr.text, `${key} should still emit the loud banner`).toContain("cli: --api-url is required");
      delete process.env[key];
    }
  });

  it("QUICK-7: bare `CI=true` (developer-shell convention) does NOT suppress the quickstart", async () => {
    // Regression guard: many developer shells set CI=true locally.
    // The CI-detector deliberately excludes the bare `CI` var so
    // those users still see the quickstart. Only platform-specific
    // env vars (GITHUB_ACTIONS, TF_BUILD, BUILDKITE, CIRCLECI,
    // JENKINS_URL) gate the suppression.
    process.stdout.isTTY = true;
    process.env["CI"] = "true";
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    expect(capture.stdout.text).toMatch(/Welcome to umactually/);
    delete process.env["CI"];
  });
});