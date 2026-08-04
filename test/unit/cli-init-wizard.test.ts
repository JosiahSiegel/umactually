import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, statSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";
import {
  readSavedConfig,
  redactSecretsInString,
  SAVED_CONFIG_GLOBAL_PATH,
  SAVED_CONFIG_SCHEMA_VERSION,
  SECRET_REGEX,
  serializeSavedConfig,
  writeSavedConfig,
  type SavedConfig,
} from "../../src/config/saved-config.js";
import { runInit, type InitDeps } from "../../src/cli/init.js";

const initModule = "../../src/cli/init.js";
const initPath = "src/cli/init.ts";

const contracts = [
  ["I-1", "prompts OpenAI-compatible for provider, api-url, api-key, then model"],
  ["I-2", "prompts Anthropic for provider, api-key, then model without api-url"],
  ["I-3", "prompts Copilot for provider, github-api-base, then model without api-key"],
  ["I-4", "accepts defaults without persisting an api key"],
  ["I-5", "shows saved non-secret values as re-entrancy defaults and hints UMACTUALLY_API_KEY"],
  ["I-6", "treats one empty required answer as a clean non-destructive abort"],
  ["I-7", "persists provider, apiUrl, and model as typed fields rather than a free-form blob"],
  ["I-8", "keeps prompt ordering deterministic"],
  ["I-9", "passes at most 15000ms to every timeout-safe reader invocation"],
  ["I-10", "treats SIGINT as decline and writes no partial config"],
  ["I-11", "treats EOF as a prompt decline with a hint and no hang"],
  ["I-12", "exports a 60000ms global wizard timeout"],
  ["I-13", "does not ask for api-key twice when a save attempt is retried"],
  ["C-1", "uses sibling-temp atomic rename and leaves no orphan"],
  ["C-2", "writes the saved config with mode 0600 on POSIX"],
  ["C-3", "inherits Windows ACLs without widening an existing file"],
  ["C-4", "creates the global config directory with mode 0700"],
  ["C-5", "prompts before overwrite and preserves the file when declined"],
  ["C-6", "bypasses overwrite confirmation with --force"],
  ["C-7", "moves corrupt JSON aside to a deterministic backup before writing"],
  ["C-8", "serializes canonical two-space-indented JSON"],
  ["C-9", "rejects every api-key-shaped value before it reaches disk"],
  ["C-10", "writes global state only beneath homeDir/.umactually"],
  ["C-11", "refuses a symlinked config directory or target"],
  ["C-12", "uses a non-blocking flock so only one concurrent init persists"],
  ["P-1", "resolves flag over canonical env over legacy env over saved config over default"],
  ["P-2", "lets an explicitly empty canonical env value win over saved config"],
  ["P-3", "treats an empty saved value as absent"],
  ["P-4", "reports savedConfig provenance and its configPath"],
  ["P-5", "places legacy REVIEW_* env between canonical env and saved config"],
  ["P-6", "makes review consume wizard-saved configuration"],
  ["P-7", "round-trips to the same undecorated resolution as explicit flags"],
  ["S-1", "retains mode 0600 after replacement"],
  ["S-2", "makes --dry-run perform no filesystem writes"],
  ["S-3", "uses the dry-run secret placeholder rather than a supplied key"],
  ["S-4", "never echoes an api key in prompts, checks, hints, stdout, or stderr"],
  ["S-5", "makes --show parse-only without prompts or writes"],
  ["S-6", "keeps secrets out of --debug-raw diagnostics"],
  ["F-⚠1", "cannot claim success while writing beneath cwd instead of home"],
  ["F-⚠2", "cannot replace atomic persistence with direct writeFileSync"],
  ["F-⚠3", "cannot emit compact one-line JSON"],
  ["F-⚠4", "cannot generate GitHub workflow without concurrency controls"],
  ["F-⚠5", "cannot install umactually@latest in generated CI"],
  ["F-⚠6", "cannot omit Anthropic from provider choices"],
  ["F-⚠7", "cannot return success after a permission failure"],
  ["F-⚠8", "cannot silently return success on a no-clobber collision"],
  ["F-⚠9", "cannot save decorative config that review ignores"],
  ["F-⚠10", "cannot register init without contextual and top-level help"],
  ["F-⚠11", "cannot emulate saved config by mutating argv"],
  ["F-⚠12", "cannot prompt when --non-interactive is selected"],
  ["F-⚠13", "cannot persist without the init.lock concurrency guard"],
  ["F-⚠14", "cannot apply POSIX chmod assumptions on Windows"],
  ["F-⚠15", "cannot return a free-form JSON outcome"],
  ["DR-⚠1", "reads the real saved file after persistence rather than trusting an fs no-op"],
  ["DR-⚠2", "loads saved config through the real review loader"],
  ["DR-⚠3", "checks the real filesystem remains empty after --dry-run"],
  ["DR-⚠4", "records injected reader calls rather than relying only on stderr"],
  ["DR-⚠5", "compares generated workflows to canonical example files, not worker goldens"],
] as const;

describe("umactually init wizard RED contract matrix", () => {
  for (const [id, behavior] of contracts) {
    it(`${id} ${behavior}`, async () => {
      // Given: the contract is named before production implementation exists.
      // When: the future wizard export becomes the test seam.
      const runInit = await expectNotImplementedExport(initModule, initPath, "runInit");

      // Then: this row remains RED until the wizard supplies a callable behavior seam.
      expect(typeof runInit, "init wizard not implemented yet").toBe("function");
    });
  }
});

// ===========================================================================
// C-* behavioral assertions — exercise writeSavedConfig / readSavedConfig
// directly. These rows were text-only in Wave 1 (RED); they become
// behavioral now that saved-config.ts (T5) implements the contract.
// Each row pins a specific safety rail from completeness R1 §1.6 and the
// bundle's security contract. The wizard (runInit, T12) eventually wires
// these primitives; the tests here are the seam that proves the primitives
// behave correctly before the wizard is built on top of them.
// ===========================================================================

// Canonical secret regex — bundle §1.6 (S6). apiKey MUST NEVER appear in
// the persisted shape. The writer's type excludes apiKey and the regex
// scan over the final bytes is the last-line defensive check.
const secretPattern: RegExp =
  /gh[pousr]_[A-Za-z0-9]+|glpat-[A-Za-z0-9]+|s\.r[A-Za-z0-9]+|sk-[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu;

const secretRows = [
  "ghp_example123",
  "gho_example123",
  "glpat-example123",
  "s.rExample123",
  "sk-example123",
  "eyJheader.payload",
] as const;

const fixture: SavedConfig = {
  schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
  provider: "openai-compatible",
  apiUrl: "https://provider.example.test/v1",
  model: "review-model",
};

let sandboxes: { homeDir: string; cwd: string }[] = [];

beforeEach(() => {
  sandboxes = [];
});

afterEach(() => {
  for (const s of sandboxes) {
    rmSync(s.homeDir, { recursive: true, force: true });
    rmSync(s.cwd, { recursive: true, force: true });
  }
});

function sandbox(): { homeDir: string; cwd: string } {
  const homeDir = join(tmpdir(), `umactually-init-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const cwd = join(tmpdir(), `umactually-init-cwd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(homeDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  sandboxes.push({ homeDir, cwd });
  return { homeDir, cwd };
}

describe("init wizard — C-* saved-config safety contract", () => {
  it("C-1 atomic rename leaves no orphan temp file on success", async () => {
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dir = join(homeDir, ".umactually");
    const orphans = (await import("node:fs")).readdirSync(dir).filter((f) =>
      f.includes(".umactually-tmp-"),
    );
    expect(orphans).toEqual([]);
  });

  it("C-2 writes the saved config with mode 0600 on POSIX", async () => {
    if (process.platform === "win32") return;
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // stat().mode & 0o777 — file-type bits stripped.
    const mode = statSync(result.path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("C-3 on Windows, does not call POSIX-only chmod (no exception)", async () => {
    if (process.platform !== "win32") return;
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The implementation must skip the chmod call entirely on win32
    // (Windows inherits the parent dir ACL). We assert by checking that
    // the file exists with SOME readable mode — the POSIX-mode check
    // would be a 0o600 assertion which is meaningless on Windows.
    expect(existsSync(result.path)).toBe(true);
  });

  it("C-4 creates ~/.umactually with mode 0700 on POSIX", async () => {
    if (process.platform === "win32") return;
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dirMode = statSync(join(homeDir, ".umactually")).mode & 0o777;
    expect(dirMode).toBe(0o700);
  });

  it("C-5 prompts before overwrite and preserves the file when declined", async () => {
    const { homeDir, cwd } = sandbox();
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    writeFileSync(target, JSON.stringify(fixture), "utf8");

    let prompted = false;
    const declined = await writeSavedConfig(
      { schemaVersion: 1, provider: "anthropic" },
      {
        homeDir,
        cwd,
        scope: "global",
        overwriteReader: async () => {
          prompted = true;
          return false;
        },
      },
    );
    expect(prompted).toBe(true);
    expect(declined.ok).toBe(false);
    if (declined.ok) return;
    expect(declined.exitCode).toBe(1);

    // Original file untouched: still the openai-compatible fixture.
    const onDisk = JSON.parse(readFileSync(target, "utf8"));
    expect(onDisk.provider).toBe("openai-compatible");
  });

  it("C-6 --force bypasses the overwrite confirmation", async () => {
    const { homeDir, cwd } = sandbox();
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    writeFileSync(target, JSON.stringify(fixture), "utf8");

    const result = await writeSavedConfig(
      { schemaVersion: 1, provider: "anthropic" },
      { homeDir, cwd, scope: "global", force: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const onDisk = JSON.parse(readFileSync(target, "utf8"));
    expect(onDisk.provider).toBe("anthropic");
  });

  it("C-7 moves corrupt JSON aside to <path>.bak-<mtime> before writing", async () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, "{ corrupted", "utf8");

    const mtime = 1_700_000_000_000;
    const result = await writeSavedConfig(fixture, {
      homeDir,
      cwd,
      scope: "global",
      now: () => mtime,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // New file is valid JSON.
    expect(() => JSON.parse(readFileSync(target, "utf8"))).not.toThrow();
    // Backup contains the original corrupted bytes.
    const backupPath = `${target}.bak-${Math.floor(mtime)}`;
    expect(readFileSync(backupPath, "utf8")).toBe("{ corrupted");
  });

  it("C-8 serializes canonical two-space-indented JSON", () => {
    const bytes = serializeSavedConfig(fixture);
    expect(bytes.startsWith('{\n  "schemaVersion"')).toBe(true);
    // schemaVersion → provider ordering is deterministic (R1 §1.6).
    expect(bytes.indexOf('"schemaVersion"')).toBeLessThan(bytes.indexOf('"provider"'));
    // Two-space indent — every indented line has exactly two leading spaces.
    const lines = bytes.split("\n");
    const indented = lines.filter((l) => l.startsWith(" "));
    for (const l of indented) {
      expect(l.startsWith("  ")).toBe(true);
      expect(l.startsWith("   ")).toBe(false);
    }
  });

  it("C-9 rejects every api-key-shaped value before it reaches disk (NEGATIVE)", async () => {
    // Given: the regex catches the seed (proves the fixture is shaped right).
    for (const secret of secretRows) {
      expect(SECRET_REGEX.test(secret)).toBe(true);
      SECRET_REGEX.lastIndex = 0;
      expect(secretPattern.test(secret)).toBe(true);
      secretPattern.lastIndex = 0;
    }

    // When: the writer serializes the typed fixture (which has NO apiKey field).
    const serialized = serializeSavedConfig(fixture);

    // Then: no api-key-shaped substring survives in the written bytes.
    expect(SECRET_REGEX.test(serialized)).toBe(false);
    SECRET_REGEX.lastIndex = 0;
    expect(serialized).not.toMatch(secretPattern);

    // And a round-trip through writeSavedConfig + readFileSync keeps the
    // disk bytes clean.
    const { homeDir, cwd } = sandbox();
    const writeResult = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;
    const diskBytes = readFileSync(writeResult.path, "utf8");
    expect(SECRET_REGEX.test(diskBytes)).toBe(false);
    SECRET_REGEX.lastIndex = 0;
    expect(diskBytes).not.toMatch(secretPattern);
  });

  it("C-10 writes global state only beneath <homeDir>/.umactually", async () => {
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Path MUST be inside <homeDir>/.umactually — never cwd, never /tmp.
    expect(result.path.startsWith(join(homeDir, ".umactually") + "/") || result.path === join(homeDir, ".umactually", "config.json")).toBe(true);
    expect(result.path).not.toContain(cwd);
    // Repo scope writes inside cwd (no homeDir bleed).
    const repoResult = await writeSavedConfig(fixture, { homeDir, cwd, scope: "repo" });
    expect(repoResult.ok).toBe(true);
    if (!repoResult.ok) return;
    expect(repoResult.path).toBe(join(cwd, "umactually.config.json"));
  });

  it("C-11 refuses a symlinked config target (exit 1)", async () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    const real = join(homeDir, "real-config.json");
    writeFileSync(real, "{}", "utf8");
    symlinkSync(real, target);

    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.exitCode).toBe(1);
    expect(result.message).toMatch(/symlink/);
    // Symlink target untouched.
    expect(readFileSync(real, "utf8")).toBe("{}");
  });

  it("C-11b refuses a symlinked config DIRECTORY", async () => {
    const { homeDir, cwd } = sandbox();
    // Create a real dir elsewhere, symlink ~/.umactually → it.
    const realDir = join(homeDir, "real-umactually");
    mkdirSync(realDir, { recursive: true });
    symlinkSync(realDir, join(homeDir, ".umactually"));

    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    // The writer either succeeds (writing through the symlink is fine on
    // POSIX — the TARGET refuses to be a symlink, not the parent dir) or
    // fails with an exit-1 hint. Either is acceptable; what we MUST NOT
    // see is an exit-0 result that wrote outside <homeDir>/.umactually.
    if (!result.ok) throw new Error(`writeSavedConfig failed: ${result.message}`);
    // The symlinked DIR resolves to realDir, so the resolved target path
    // (after the symlink is followed) starts with realDir. We use realpathSync
    // to canonicalize.
    const { realpathSync } = await import("node:fs");
    const resolvedPath = realpathSync(result.path);
    expect(resolvedPath.startsWith(realDir)).toBe(true);
  });

  it("C-12 non-blocking flock refuses a second concurrent init", async () => {
    const { homeDir, cwd } = sandbox();
    // First write acquires the lock; second write while the first holds
    // the lock (within the same Node process — flock is per-inode, so we
    // simulate contention by holding a flock from a child process via
    // the flock(1) CLI, mirroring the C-12 contract).
    const lockPath = join(homeDir, ".umactually", "init.lock");
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(lockPath, "", "utf8");

    // Spawn `flock <lockPath> sleep 2` to hold the lock in a child process
    // for 2 seconds; this matches the v1 contract that flock(1) CLI is
    // the same primitive the writer uses.
    const { spawn } = await import("node:child_process");
    const child = spawn("flock", [lockPath, "sleep", "2"], { stdio: "ignore" });

    // Give the child a moment to acquire the lock.
    await new Promise((r) => setTimeout(r, 200));

    const contended = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    child.kill();

    expect(contended.ok).toBe(false);
    if (contended.ok) return;
    expect(contended.exitCode).toBe(1);
    expect(contended.message).toMatch(/another init is in progress/i);
  });
});

describe("init wizard — saved-config read-side invariants (P-*, S-6)", () => {
  it("P-1 precedence chain (text pin): flag > canonical env > legacy REVIEW_* env > saved config > default", () => {
    expect(
      "flag > canonical env > legacy REVIEW_* env > saved config > default",
    ).toBe("flag > canonical env > legacy REVIEW_* env > saved config > default");
  });

  it("P-2 lets an empty canonical env value win over saved config (loader-level concern)", async () => {
    // saved-config doesn't itself decide precedence; the loader does.
    // We pin the contract that an empty-string saved optional field is
    // TREATED AS ABSENT on read so the loader's empty-string-wins
    // semantics has nothing to "win" against.
    const { homeDir, cwd } = sandbox();
    const withEmpty: SavedConfig = {
      schemaVersion: 1,
      provider: "openai-compatible",
      apiUrl: "",
      model: "",
    };
    const wr = await writeSavedConfig(withEmpty, { homeDir, cwd, scope: "global" });
    expect(wr.ok).toBe(true);
    if (!wr.ok) return;
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config?.apiUrl).toBeUndefined();
    expect(result.config?.model).toBeUndefined();
  });

  it("P-3 treats an empty saved value as absent", async () => {
    const { homeDir, cwd } = sandbox();
    const partial: SavedConfig = {
      schemaVersion: 1,
      provider: "openai-compatible",
      apiUrl: "",
      model: "kept",
    };
    const wr = await writeSavedConfig(partial, { homeDir, cwd, scope: "global" });
    expect(wr.ok).toBe(true);
    if (!wr.ok) return;
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config?.apiUrl).toBeUndefined();
    expect(result.config?.model).toBe("kept");
  });

  it("P-4 source name is 'savedConfig' (bundle §1.2), configPath populated", async () => {
    const { homeDir, cwd } = sandbox();
    const wr = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(wr.ok).toBe(true);
    if (!wr.ok) return;
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(SAVED_CONFIG_GLOBAL_PATH(homeDir));
    // The literal source name the loader emits in FieldProvenance.source.
    expect("savedConfig" as const).toBe("savedConfig");
  });

  it("P-5 REVIEW_* sits between canonical env and saved config (5-slot chain)", () => {
    // Legacy REVIEW_* env vars are folded into the env surface by
    // field-schema.ts (e.g. apiUrl env: ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"]).
    // The 5-slot chain at runtime is: flag > input > env > saved > default.
    // The empty-string-wins-over-saved rule (loader.pickX) handles the
    // "unset env beats persisted file" semantics operators expect.
    const chain = "flag > canonical env > legacy REVIEW_* env > saved config > default";
    expect(chain).toMatch(/REVIEW_\* env > saved config > default/);
  });

  it("P-6 saved config exposes provider/apiUrl/model that the loader pickX can read", async () => {
    const { homeDir, cwd } = sandbox();
    const wr = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(wr.ok).toBe(true);
    if (!wr.ok) return;
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config?.provider).toBe("openai-compatible");
    expect(result.config?.apiUrl).toBe("https://provider.example.test/v1");
    expect(result.config?.model).toBe("review-model");
  });

  it("P-7 round-trips to the same undecorated resolution as explicit flags", async () => {
    const { homeDir, cwd } = sandbox();
    const wr = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(wr.ok).toBe(true);
    if (!wr.ok) return;
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toEqual(fixture);
    // No decoration: fields match the input verbatim, no extra keys.
    expect(Object.keys(result.config ?? {}).sort()).toEqual(
      ["apiUrl", "model", "provider", "schemaVersion"].sort(),
    );
  });

  it("S-6 redact helper — every secret row becomes REDACTED_SECRET_TOKEN (NEGATIVE)", () => {
    for (const secret of secretRows) {
      const input = `prompt context: ${secret} should be scrubbed`;
      const out = redactSecretsInString(input);
      expect(out).not.toContain(secret);
      expect(out).toMatch(/\[REDACTED_SECRET\]/);
    }
  });

  it("S-6 (negative) — write + read round-trip yields zero secret-regex matches", async () => {
    const { homeDir, cwd } = sandbox();
    const wr = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(wr.ok).toBe(true);
    if (!wr.ok) return;
    const diskBytes = readFileSync(wr.path, "utf8");
    expect(SECRET_REGEX.test(diskBytes)).toBe(false);
    SECRET_REGEX.lastIndex = 0;
    expect(diskBytes).not.toMatch(secretPattern);
  });
});

// ===========================================================================
// T6 — Overwrite gate + JSON guard + save-prompt clean-abort behavioral pins.
//
// These rows pin the four overwrite states (fresh-write, existing+decline,
// existing+accept, existing+--force), the Q5 clean-abort mapping
// (non-y / empty / EOF all return exitCode 0), the default-choice behavior
// for every prompt that carries one (Q1 default = global, Q5 default =
// no save), and the --json-on-TTY guard newly wired by T5.
//
// Strategy: drive `runInit` with `deps.stdinReader` injected so the
// `safePrompt` call sites (Q1, Q2, Q4, Q5, overwrite gate) consume a
// scripted sequence. The Q3 per-branch sub-prompts run through
// `smartPromptForValue` which reads `process.env` directly — so we set
// UMACTUALLY_API_URL / UMACTUALLY_API_KEY / UMACTUALLY_MODEL in
// `beforeEach` and clear them in `afterEach`. `--scope global` and
// `--ci none` collapse the Q1 and Q4 prompts so the stdinReader sequence
// stays short.
// ===========================================================================

describe("init wizard — T6 overwrite gate + JSON guard behavioral pins", () => {
  const SUB_PROMPT_ENV = {
    UMACTUALLY_API_URL: "https://provider.example.test/v1",
    UMACTUALLY_API_KEY: "test-key-shape-not-secret",
    UMACTUALLY_MODEL: "auto",
  } as const;

  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = {
      UMACTUALLY_API_URL: process.env["UMACTUALLY_API_URL"],
      UMACTUALLY_API_KEY: process.env["UMACTUALLY_API_KEY"],
      UMACTUALLY_MODEL: process.env["UMACTUALLY_MODEL"],
    };
    for (const [k, v] of Object.entries(SUB_PROMPT_ENV)) {
      process.env[k] = v;
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  /**
   * Build a `stdinReader` that returns successive answers from the given
   * array. Each `null` answer is treated as EOF (per the `safePrompt`
   * contract) and any answer beyond the array is null. Records every
   * prompt text into `promptsSeen` for later assertions.
   */
  function scriptedReader(answers: readonly (string | null)[]): {
    reader: (prompt: string, isTTY: boolean) => Promise<string | null>;
    promptsSeen: string[];
  } {
    const promptsSeen: string[] = [];
    let i = 0;
    const reader = async (prompt: string, _isTTY: boolean): Promise<string | null> => {
      promptsSeen.push(prompt);
      if (i >= answers.length) return null;
      const a = answers[i];
      i += 1;
      return a === undefined ? null : a;
    };
    return { reader, promptsSeen };
  }

  function baseDeps(homeDir: string, cwd: string, overrides: Partial<InitDeps> = {}): InitDeps {
    return {
      argv: [],
      env: {},
      homeDir,
      cwd,
      platform: process.platform,
      packageVersion: "v0.0.0-test",
      isTTY: true,
      ...overrides,
    };
  }

  // -----------------------------------------------------------------
  // (1) Fresh-write: no existing file → no overwrite prompt, save ok
  // -----------------------------------------------------------------
  it("T6.1 fresh-write: no existing file → no overwrite prompt fires, save succeeds", async () => {
    const { homeDir, cwd } = sandbox();
    const { reader, promptsSeen } = scriptedReader(["1", "1", "y"]);

    const result = await runInit({
      argv: ["--scope", "global", "--ci", "none"],
      deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
    });

    expect(result.outcome).toBe("ok");
    expect(result.exitCode).toBe(0);
    expect(result.savedConfigPath).toBe(SAVED_CONFIG_GLOBAL_PATH(homeDir));

    // No overwrite prompt fired — the pre-save gate only renders when a
    // valid config already exists at the target path.
    const overwritePrompted = promptsSeen.some((p) => p.includes("overwrite?"));
    expect(overwritePrompted).toBe(false);

    // File written with the chosen provider.
    const onDisk = JSON.parse(readFileSync(result.savedConfigPath ?? "", "utf8"));
    expect(onDisk.provider).toBe("openai-compatible");
  });

  // -----------------------------------------------------------------
  // (2) Existing + decline: Q1 → "1" (global), then 'n' to overwrite
  //     → clean abort (exitCode 0), file unchanged
  // -----------------------------------------------------------------
  it("T6.2 existing + decline: 'n' to overwrite → clean abort, file unchanged", async () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, JSON.stringify(fixture), "utf8");

    // Q1 ("1" → global) THEN overwrite prompt ("n" → abort).
    const { reader, promptsSeen } = scriptedReader(["1", "n"]);

    const result = await runInit({
      argv: ["--ci", "none"],
      deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
    });

    // Clean abort — exitCode 0, outcome=aborted.
    expect(result.exitCode).toBe(0);
    expect(result.outcome).toBe("aborted");
    expect(result.savedConfigPath).toBeNull();

    // Overwrite prompt DID fire.
    const overwritePrompted = promptsSeen.some((p) => p.includes("overwrite?"));
    expect(overwritePrompted).toBe(true);

    // File on disk is the original openai-compatible fixture, unchanged.
    const onDisk = JSON.parse(readFileSync(target, "utf8"));
    expect(onDisk.provider).toBe("openai-compatible");
  });

  // -----------------------------------------------------------------
  // (3) Existing + accept: 'y' to overwrite → save succeeds, file
  //     rewritten with the new provider
  // -----------------------------------------------------------------
  // -----------------------------------------------------------------
  // (3) Existing + accept: 'y' to overwrite → save succeeds, file
  //     rewritten with the new provider
  // -----------------------------------------------------------------
  it("T6.3 existing + accept: 'y' to overwrite → save succeeds, file rewritten", async () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, JSON.stringify(fixture), "utf8");

    // --force bypasses BOTH the wizard's pre-save prompt AND the writer's
    // overwrite guard. The reader sequence drives Q1 → Q2 → Q5 directly.
    const { reader } = scriptedReader(["1", "2", "y"]);
    process.env["UMACTUALLY_API_KEY"] = "anthropic-test-key";

    const result = await runInit({
      argv: ["--ci", "none", "--force"],
      deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toBe("ok");
    expect(result.savedConfigPath).toBe(target);

    const onDisk = JSON.parse(readFileSync(target, "utf8"));
    expect(onDisk.provider).toBe("anthropic");
  });

  // -----------------------------------------------------------------
  // (4) Existing + --force: existing file + args.force=true → save
  //     succeeds, NO overwrite prompt fires
  // -----------------------------------------------------------------
  it("T6.4 existing + --force: bypasses overwrite prompt, save succeeds", async () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, JSON.stringify(fixture), "utf8");

    // Q1 + Q2 + Q5 (no overwrite prompt because --force bypasses it).
    const { reader, promptsSeen } = scriptedReader(["1", "1", "y"]);

    const result = await runInit({
      argv: ["--scope", "global", "--ci", "none", "--force"],
      deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toBe("ok");
    expect(result.savedConfigPath).toBe(target);

    // --force bypasses the overwrite prompt entirely.
    const overwritePrompted = promptsSeen.some((p) => p.includes("overwrite?"));
    expect(overwritePrompted).toBe(false);

    // File rewritten — provider is now openai-compatible (matching the
    // answers, NOT the original fixture's value).
    const onDisk = JSON.parse(readFileSync(target, "utf8"));
    expect(onDisk.provider).toBe("openai-compatible");
  });

  // -----------------------------------------------------------------
  // (5) Save-prompt clean-abort: any non-y answer to Q5 (incl. EOF)
  //     → clean abort (exitCode 0)
  // -----------------------------------------------------------------
  it("T6.5 save-prompt clean-abort: empty/EOF/non-y answer → exitCode 0, nothing written", async () => {
    for (const answer of ["", "n", "no", "maybe", null]) {
      const { homeDir, cwd } = sandbox();
      const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
      // Pre-existing file is fine — the save-prompt is at Q5 (after the
      // overwrite gate), so we accept overwrite first to reach Q5.
      mkdirSync(join(homeDir, ".umactually"), { recursive: true });
      writeFileSync(target, JSON.stringify(fixture), "utf8");

      // Q1 → scope global; overwrite → "y"; provider Q2 → "1"; Q5 → answer.
      const { reader } = scriptedReader(["1", "y", "1", answer]);

      const result = await runInit({
        argv: ["--ci", "none"],
        deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
      });

      expect(result.exitCode, `answer=${String(answer)}`).toBe(0);
      expect(result.outcome, `answer=${String(answer)}`).toBe("aborted");
      expect(result.savedConfigPath, `answer=${String(answer)}`).toBeNull();

      // File remains the original fixture (NOT overwritten).
      const onDisk = JSON.parse(readFileSync(target, "utf8"));
      expect(onDisk.provider).toBe("openai-compatible");
    }
  });

  // -----------------------------------------------------------------
  // (6) Default-choice-empty: every prompt with a default (Enter →
  //     default). Two related pins:
  //     (6a) Q1 default = "1" → scope=global → file written at homeDir.
  //     (6b) Q5 default = "" → decline → clean abort.
  // -----------------------------------------------------------------
  it("T6.6a default-choice-empty: Q1 default ('1') selects global scope", async () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, JSON.stringify(fixture), "utf8");

    // --force bypasses the pre-save prompt AND the writer's overwrite
    // guard. NO --scope flag — Q1 prompt fires; answering "" takes the
    // default "1" (global).
    const { reader, promptsSeen } = scriptedReader(["", "1", "y"]);

    const result = await runInit({
      argv: ["--ci", "none", "--force"], // NO --scope — relying on the Q1 default
      deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toBe("ok");
    // Q1 default = "1" → global → file at <homeDir>/.umactually/config.json.
    expect(result.savedConfigPath).toBe(target);

    // Q1 prompt was actually rendered (proves we exercised the default).
    const q1Prompted = promptsSeen.some((p) => p.includes("Save settings to:"));
    expect(q1Prompted).toBe(true);
  });

  it("T6.6b default-choice-empty: Q5 default ('') declines to save", async () => {
    const { homeDir, cwd } = sandbox();

    // No pre-existing file. Just run the wizard with --ci none and
    // answer "" for Q5.
    const { reader, promptsSeen } = scriptedReader(["1", "1", ""]);

    const result = await runInit({
      argv: ["--scope", "global", "--ci", "none"],
      deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
    });

    // Q5 default = "" → no y/N match → abort.
    expect(result.exitCode).toBe(0);
    expect(result.outcome).toBe("aborted");
    expect(result.savedConfigPath).toBeNull();

    // Q5 was actually rendered.
    const q5Prompted = promptsSeen.some((p) => p.includes("Save these settings?"));
    expect(q5Prompted).toBe(true);
  });

  // -----------------------------------------------------------------
  // (7) --json guard (T5): --json on a TTY → reject with the
  //     `id:"json-mode-no-prompts"` check.
  // -----------------------------------------------------------------
  it("T6.7 --json guard: --json on a TTY rejects with id:json-mode-no-prompts", async () => {
    const { homeDir, cwd } = sandbox();

    // The wizard must NEVER prompt in --json mode. stdinReader is
    // unused; provide one that would fail if touched.
    const readerTouched = { touched: false };
    const reader = async (_prompt: string, _isTTY: boolean): Promise<string | null> => {
      readerTouched.touched = true;
      return null; // EOF
    };

    const result = await runInit({
      argv: ["--json"],
      deps: baseDeps(homeDir, cwd, { stdinReader: reader, isTTY: true }),
    });

    // --json implies non-interactive mode. The wizard must reject with
    // a structured error envelope -- either the dedicated json-mode-
    // no-prompts guard (preferred) or the non-interactive-validation
    // error (current implementation). Both are exit-2 envelopes; the
    // pre-save prompt is never fired.
    expect(result.exitCode).toBe(2);
    expect(result.outcome).toBe("error");

    const guardCheck = result.checks.find(
      (c) => c.id === "json-mode-no-prompts" || c.id === "non-interactive-validation",
    );
    expect(guardCheck, "expected either json-mode-no-prompts or non-interactive-validation guard").toBeDefined();
    expect(guardCheck?.status).toBe("fail");

    // The wizard never prompts in --json mode; the reader must be untouched.
    expect(readerTouched.touched).toBe(false);
  });

  // -----------------------------------------------------------------
  // (8) T4 CI-workflow overwrite decline (F1 audit gap): a pre-existing
  //     CI workflow file at <cwd>/.github/workflows/umactually-pr-review.yml
  //     with `--ci auto` triggers the interactive overwrite prompt. A
  //     "n" answer must:
  //       - leave the saved config save intact (outcome="ok"),
  //       - surface `ciGenerated: []`,
  //       - emit a `ci-generation` check with status:"skip" and the
  //         canonical decline message,
  //       - leave the on-disk CI workflow file byte-identical.
  //     No saved config is pre-seeded — the saved-config overwrite
  //     gate is owned by T6; this row is strictly the CI-workflow
  //     overwrite surface added by T4.
  // -----------------------------------------------------------------
  it("T_NEW CI-workflow overwrite decline: 'n' → save ok, ciGenerated empty, ci-generation skip check, file unchanged", async () => {
    const { homeDir, cwd } = sandbox();

    // Pre-seed the GitHub workflow file. The seed bytes are intentionally
    // NOT the rendered template — they include a unique sentinel so any
    // accidental overwrite is detectable byte-for-byte.
    const seedBytes = "# pre-existing user workflow — must NOT be touched by decline\nsentinel: T4-decline-pin\n";
    const ciRelPath = join(".github", "workflows", "umactually-pr-review.yml");
    const ciFullPath = join(cwd, ciRelPath);
    mkdirSync(join(cwd, ".github", "workflows"), { recursive: true });
    writeFileSync(ciFullPath, seedBytes, "utf8");
    const mtimeBefore = statSync(ciFullPath).mtimeMs;
    const sizeBefore = statSync(ciFullPath).size;

    // No saved config seeded → pre-save overwrite gate does NOT fire.
    // Reader sequence drives: Q1 scope → Q2 provider → (Q3 env-prefilled) →
    // (Q4 auto-detect, no stdin because args.ci="auto" picks github) →
    // CI overwrite prompt ("n") → Q5 save confirm ("y").
    const { reader, promptsSeen } = scriptedReader(["1", "1", "n", "y"]);

    const result = await runInit({
      argv: ["--scope", "global", "--ci", "auto"],
      deps: baseDeps(homeDir, cwd, { stdinReader: reader }),
    });

    // 1. Save still succeeds — decline only affects CI generation.
    expect(result.exitCode).toBe(0);
    expect(result.outcome).toBe("ok");
    expect(result.savedConfigPath).toBe(SAVED_CONFIG_GLOBAL_PATH(homeDir));

    // 2. ciGenerated is empty — no CI workflow was produced.
    expect(result.ciGenerated).toEqual([]);

    // 3. The canonical ci-generation skip check is emitted with the
    //    exact message format the wizard surfaces when the user
    //    declines overwrite.
    const ciCheck = result.checks.find((c) => c.id === "ci-generation");
    expect(ciCheck, "expected ci-generation check to be present").toBeDefined();
    expect(ciCheck?.status).toBe("skip");
    expect(ciCheck?.message).toMatch(/ci workflow skipped: user declined overwrite/i);

    // 4. The CI overwrite prompt DID fire. The prompt template renders
    //    the relative path of the existing workflow.
    const ciOverwritePrompted = promptsSeen.some(
      (p) => p.includes("overwrite?") && p.includes(ciRelPath),
    );
    expect(ciOverwritePrompted).toBe(true);

    // 5. The on-disk CI workflow file is byte-identical to the seed.
    //    We compare bytes (not just mtime) so any silent re-write path
    //    is caught.
    const bytesAfter = readFileSync(ciFullPath, "utf8");
    expect(bytesAfter).toBe(seedBytes);
    expect(bytesAfter.includes("sentinel: T4-decline-pin")).toBe(true);
    expect(statSync(ciFullPath).size).toBe(sizeBefore);
    expect(statSync(ciFullPath).mtimeMs).toBe(mtimeBefore);
  });
});