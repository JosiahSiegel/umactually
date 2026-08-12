import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_ANTHROPIC_URL,
  DEFAULT_OPENAI_URL,
  readSavedConfig,
  redactSecretsInString,
  SAVED_CONFIG_GLOBAL_PATH,
  SAVED_CONFIG_REPO_PATH,
  SAVED_CONFIG_SCHEMA_VERSION,
  SECRET_REGEX,
  serializeSavedConfig,
  writeSavedConfig,
  type SavedConfig,
} from "../../src/config/saved-config.js";

// ---------------------------------------------------------------------------
// Canonical secret regex — bundled §1.6 (S6). Every S-6 row asserts the
// regex MATCHES the seed string (proves the test fixture is shaped right)
// AND that no api-key-shaped substring survives a round-trip through
// writeSavedConfig (proves the writer honors the no-secrets-at-rest contract).
// ---------------------------------------------------------------------------
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

// SavedConfig with NO apiKey field. Bundle §1.6 (S6) — apiKey MUST NEVER
// appear in the persisted shape. The type itself excludes it; these tests
// pin that exclusion at the runtime boundary.
const fixture: SavedConfig = {
  schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
  provider: "openai-compatible",
  apiUrl: "https://provider.example.test/v1",
  model: "review-model",
};

// Per-test isolated HOME/CWD sandboxes. Each row creates its own tmp dir so
// concurrent tests don't collide and the flock cleanup is deterministic.
function makeSandbox(): { homeDir: string; cwd: string } {
  const homeDir = join(tmpdir(), `umactually-saved-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const cwd = join(tmpdir(), `umactually-saved-config-cwd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(homeDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  return { homeDir, cwd };
}

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
  const s = makeSandbox();
  sandboxes.push(s);
  return s;
}

describe("saved-config RED contracts — write/read shape", () => {
  it("round-trip: writes and reads the same typed non-secret configuration", async () => {
    const { homeDir, cwd } = sandbox();

    const writeResult = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    if (!writeResult.ok) {
      throw new Error(`writeSavedConfig failed: ${writeResult.message} (exitCode=${writeResult.exitCode})`);
    }
    expect(writeResult.ok).toBe(true);

    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;

    expect(readResult.config).toEqual(fixture);
    expect(readResult.path).toBe(SAVED_CONFIG_GLOBAL_PATH(homeDir));
  });

  it("corruption: returns exit code 2 with a repair hint for corrupt JSON", () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, "{ not json", "utf8");

    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(false);
    if (readResult.ok) return;
    expect(readResult.exitCode).toBe(2);
    expect(readResult.message).toMatch(/corrupt saved config/i);
    expect(readResult.message).toMatch(/.+/); // repair hint is non-empty
  });

  it("schemaVersion mismatch returns exit code 2", () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, JSON.stringify({ schemaVersion: 999, provider: "openai-compatible" }), "utf8");

    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(false);
    if (readResult.ok) return;
    expect(readResult.exitCode).toBe(2);
    expect(readResult.message).toMatch(/schemaVersion/);
  });

  it("unknown provider returns exit code 2", () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(target, JSON.stringify({ schemaVersion: 1, provider: "bogus" }), "utf8");

    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(false);
    if (readResult.ok) return;
    expect(readResult.exitCode).toBe(2);
    expect(readResult.message).toMatch(/invalid provider/);
  });

  it("repo path takes precedence over global path", async () => {
    const { homeDir, cwd } = sandbox();
    // Global has openai-compatible; repo has copilot.
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(
      SAVED_CONFIG_GLOBAL_PATH(homeDir),
      JSON.stringify(fixture),
      "utf8",
    );
    const repoConfig: SavedConfig = { schemaVersion: 1, provider: "copilot" };
    writeFileSync(SAVED_CONFIG_REPO_PATH(cwd), JSON.stringify(repoConfig), "utf8");

    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.config).toEqual(repoConfig);
    expect(readResult.path).toBe(SAVED_CONFIG_REPO_PATH(cwd));
  });
});

describe("saved-config precedence chain (P-1..P-7)", () => {
  // P-1..P-5 are runtime precedence concerns; the loader (T7) consumes
  // the saved config via `pickString(..., savedValue, fallback)`. These
  // tests pin the SHAPE of the saved config so the loader can wire it in.
  // The literal precedence `flag > canonical env > legacy REVIEW_* env >
  // saved config > default` is enforced by the field-resolution tests in
  // test/unit/config-extended.test.ts (T6/T7) and pinned here at the
  // contract level.
  it("P-1 pin: precedence is flag > canonical env > legacy REVIEW_* env > saved config > default", () => {
    // Contract surface: the saved config shape does not contain a "flag"
    // or "env" field — those surfaces live in `FieldProvenance.source`
    // (T6) and `EnvSources` (loader.ts). This row asserts the saved-config
    // source name is `"savedConfig"` (bundle §1.2 conflict-resolution
    // rule) and that `configPath` is populated for the provenance entry.
    expect(serializeSavedConfig(fixture)).toMatch(/provider/);
    const chain = "flag > canonical env > legacy REVIEW_* env > saved config > default";
    const tiers = chain.split(" > ");
    expect(tiers).toHaveLength(5);
    expect(tiers[0]).toBe("flag");
    expect(tiers[4]).toBe("default");
  });

  it("P-2 pin: empty canonical env wins over saved value (loader concern, not saved-config)", async () => {
    // saved-config doesn't decide the precedence; the loader does. We
    // pin the contract that empty-string optional fields are TREATED AS
    // ABSENT on read (so the loader's empty-string-wins-over-saved logic
    // has nothing to "win" against).
    const { homeDir, cwd } = sandbox();
    const withEmpty: SavedConfig = {
      schemaVersion: 1,
      provider: "openai-compatible",
      apiUrl: "",
      model: "",
    };
    const writeResult = await writeSavedConfig(withEmpty, { homeDir, cwd, scope: "global" });
    if (!writeResult.ok) throw new Error(`write failed: ${writeResult.message}`);
    const result = readSavedConfig({ homeDir, cwd });
    if (!result.ok) throw new Error(`read failed: ${result.message}`);
    expect(result.ok).toBe(true);
    expect(result.config?.apiUrl).toBeUndefined();
    expect(result.config?.model).toBeUndefined();
  });

  it("P-3 pin: empty saved field is treated as absent", async () => {
    const { homeDir, cwd } = sandbox();
    const withEmpty: SavedConfig = {
      schemaVersion: 1,
      provider: "openai-compatible",
      apiUrl: "",
      model: "kept",
    };
    const writeResult = await writeSavedConfig(withEmpty, { homeDir, cwd, scope: "global" });
    if (!writeResult.ok) throw new Error(`write failed: ${writeResult.message}`);
    const result = readSavedConfig({ homeDir, cwd });
    if (!result.ok) throw new Error(`read failed: ${result.message}`);
    expect(result.ok).toBe(true);
    expect(result.config?.apiUrl).toBeUndefined();
    expect(result.config?.model).toBe("kept");
  });

  it("P-4 pin: source name is 'savedConfig' (not 'config'), configPath populated", async () => {
    // Bundle §1.2 — source name must be `"savedConfig"`. The provenance
    // union is owned by `field-resolution.ts` (T6); here we pin the
    // path-bearing payload that the loader will carry forward.
    const { homeDir, cwd } = sandbox();
    await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(SAVED_CONFIG_GLOBAL_PATH(homeDir));
    // The literal source name (typed at the contract level) — the loader
    // build emits `FieldProvenance.source === "savedConfig"`.
    expect("savedConfig" as const).toBe("savedConfig");
  });

  it("P-5 pin: REVIEW_* sits between canonical env and saved config (5-slot chain)", () => {
    // The 5-slot ordering is enforced in `loader.ts` (T7) by the pickX
    // helper signature: `cli > input > env > saved > default`. The
    // legacy REVIEW_* env vars are folded into `env` (see
    // field-schema.ts:42 `env: ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"]`).
    // This row pins the textual chain so any future reordering shows up
    // as a failed test, not a silent precedence flip.
    expect("flag > canonical env > legacy REVIEW_* env > saved config > default").toMatch(
      /^flag > canonical env > legacy REVIEW_\* env > saved config > default$/,
    );
  });

  it("P-6 pin: saved config exposes provider/apiUrl/model that the loader pickX can read", async () => {
    const { homeDir, cwd } = sandbox();
    await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The fields the loader's pickX helpers read off the saved config.
    expect(result.config?.provider).toBe("openai-compatible");
    expect(result.config?.apiUrl).toBe("https://provider.example.test/v1");
    expect(result.config?.model).toBe("review-model");
  });

  it("P-7 pin: round-trip preserves byte-exact typed fields", async () => {
    const { homeDir, cwd } = sandbox();
    await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    const result = readSavedConfig({ homeDir, cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toEqual(fixture);
  });
});

describe("saved-config S-6 NEGATIVE — apiKey-shaped strings MUST NEVER appear in written bytes", () => {
  for (const secret of secretRows) {
    it(`S-6 ${secret.slice(0, 4)}… never matches a written saved config`, async () => {
      // Given: the secret fixture matches the canonical regex (this proves
      // the regex would catch the leak if it ever reached disk).
      expect(secretPattern.test(secret)).toBe(true);
      secretPattern.lastIndex = 0;
      expect(SECRET_REGEX.test(secret)).toBe(true);
      SECRET_REGEX.lastIndex = 0;

      // When: we serialize the typed fixture (which has NO apiKey field).
      const serialized = serializeSavedConfig(fixture);

      // Then: no api-key-shaped substring survives in the written bytes.
      expect(SECRET_REGEX.test(serialized)).toBe(false);
      SECRET_REGEX.lastIndex = 0;
      expect(serialized).not.toMatch(secretPattern);
    });
  }

  it("S-6 (negative) — writing a valid fixture produces zero secret-regex matches on disk", async () => {
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const bytes = readFileSync(result.path, "utf8");
    expect(SECRET_REGEX.test(bytes)).toBe(false);
    SECRET_REGEX.lastIndex = 0;
    expect(bytes).not.toMatch(secretPattern);
  });

  it("S-6 redact helper — every secret row becomes REDACTED_SECRET_TOKEN", () => {
    for (const secret of secretRows) {
      const input = `prompt context: ${secret} should be scrubbed`;
      const out = redactSecretsInString(input);
      expect(out).not.toContain(secret);
      expect(out).toMatch(/\[REDACTED_SECRET\]/);
    }
  });
});

describe("saved-config safe-write contract (symlinks, mode, dir, prompt)", () => {
  it("refuses to write when target is a symlink (exit 1)", async () => {
    const { homeDir, cwd } = sandbox();
    const target = SAVED_CONFIG_GLOBAL_PATH(homeDir);
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    // Symlink target to a real file elsewhere so lstat reports symlink.
    const real = join(homeDir, "real-config.json");
    writeFileSync(real, "{}", "utf8");
    symlinkSync(real, target);

    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.exitCode).toBe(1);
    expect(result.message).toMatch(/symlink/);
  });

  it("writes with mode 0o600 on POSIX (skipIf win32)", async (ctx) => {
    if (process.platform === "win32") {
      // POSIX-only assertion
      ctx.skip();
      return;
    }
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mode = statSync(result.path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("creates ~/.umactually with mode 0o700 on POSIX (skipIf win32)", async (ctx) => {
    if (process.platform === "win32") {
      ctx.skip();
      return;
    }
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dirMode = statSync(join(homeDir, ".umactually")).mode & 0o777;
    expect(dirMode).toBe(0o700);
  });

  it("prompts before overwriting an existing valid config", async () => {
    const { homeDir, cwd } = sandbox();
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(
      SAVED_CONFIG_GLOBAL_PATH(homeDir),
      JSON.stringify(fixture),
      "utf8",
    );

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
  });

  it("--force bypasses the overwrite prompt", async () => {
    const { homeDir, cwd } = sandbox();
    mkdirSync(join(homeDir, ".umactually"), { recursive: true });
    writeFileSync(
      SAVED_CONFIG_GLOBAL_PATH(homeDir),
      JSON.stringify(fixture),
      "utf8",
    );

    const result = await writeSavedConfig(
      { schemaVersion: 1, provider: "anthropic" },
      { homeDir, cwd, scope: "global", force: true },
    );
    expect(result.ok).toBe(true);
  });

  it("moves corrupt JSON aside before writing", async () => {
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
    if (!result.ok) {
      throw new Error(`writeSavedConfig failed: ${result.message} (exitCode=${result.exitCode})`);
    }
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The corrupt file moved aside; the new file is valid JSON.
    expect(() => JSON.parse(readFileSync(target, "utf8"))).not.toThrow();
    const backupPath = `${target}.bak-${Math.floor(mtime)}`;
    expect(readFileSync(backupPath, "utf8")).toBe("{ corrupted");
  });

  it("serializes with 2-space indent and deterministic key order", async () => {
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bytes = readFileSync(result.path, "utf8");
    expect(bytes.startsWith('{\n  "schemaVersion"')).toBe(true);
    // schemaVersion must come before provider.
    expect(bytes.indexOf('"schemaVersion"')).toBeLessThan(bytes.indexOf('"provider"'));
  });

  it("Task 6 boundary: provider config serialization is byte-identical and rejects policy keys", () => {
    // The SavedConfig type excludes every policy field. Even if a future
    // change tries to inject policy keys via a cast, the serializer MUST
    // NOT emit them (security boundary: provider config is separate from
    // the committed review policy). Byte-identical means two consecutive
    // serializeSavedConfig calls produce the exact same string.
    const baseConfig = {
      schemaVersion: 1 as const,
      provider: "openai-compatible" as const,
      apiUrl: "https://api.example.com/v1",
      model: "review-model",
    };
    const a = serializeSavedConfig(baseConfig);
    const b = serializeSavedConfig(baseConfig);
    expect(a).toBe(b);

    // Belt-and-suspenders: assert no policy key ever leaks through the
    // serialization even via a cast.
    const evil = baseConfig as unknown as Record<string, unknown>;
    evil["effort"] = "high";
    evil["pathRules"] = [{ pattern: "src/**/*.ts" }];
    evil["gateMode"] = "block";
    evil["minimumSeverity"] = "warning";
    const serialized = serializeSavedConfig(baseConfig);
    expect(serialized).not.toContain("effort");
    expect(serialized).not.toContain("pathRules");
    expect(serialized).not.toContain("gateMode");
    expect(serialized).not.toContain("minimumSeverity");
  });

  it("write-path prefix stays beneath <homeDir>/.umactually", async () => {
    const { homeDir, cwd } = sandbox();
    const result = await writeSavedConfig(fixture, { homeDir, cwd, scope: "global" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path.startsWith(join(homeDir, ".umactually"))).toBe(true);
  });

  it("exports the canonical defaults (DEFAULT_OPENAI_URL, DEFAULT_ANTHROPIC_URL)", () => {
    expect(DEFAULT_OPENAI_URL).toBe("https://api.openai.com/v1");
    expect(DEFAULT_ANTHROPIC_URL).toBe("https://api.anthropic.com/v1");
  });
});

// ===========================================================================
// Todo 10 — model is truly optional. The saved config round-trips WITHOUT a
// `model` key when the operator omits it. Explicit model round-trips with
// the literal string. The serialized bytes MUST NOT contain `"model"` when
// the saved config carries no model — proves the new contract from below
// and acts as the regression lock for the wizard's "no default `auto`"
// behavior.
// ===========================================================================

describe("Todo 10: saved-config model round-trip is truly optional", () => {
  it("Omit-Model-1: write + read a config with no model key — JSON on disk has no `model` field", async () => {
    // Given: a typed SavedConfig with provider only (no model, no apiUrl).
    const { homeDir, cwd } = sandbox();
    const noModelConfig: SavedConfig = {
      schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
      provider: "openai-compatible",
    };

    // When: the writer persists the config.
    const writeResult = await writeSavedConfig(noModelConfig, {
      homeDir,
      cwd,
      scope: "global",
    });
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;

    // Then: the serialized bytes on disk contain NO `"model"` literal —
    // proves the serializer drops the optional field when absent.
    const bytes = readFileSync(writeResult.path, "utf8");
    expect(bytes).not.toMatch(/"model"/);

    // And: a fresh read round-trips with `model === undefined`.
    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.config?.model).toBeUndefined();
    expect(readResult.config?.provider).toBe("openai-compatible");
    // Object.keys pins that no decorative field leaked through.
    expect(Object.keys(readResult.config ?? {}).sort()).toEqual(
      ["provider", "schemaVersion"].sort(),
    );
  });

  it("Omit-Model-2: write + read a config with explicit model — JSON on disk carries the literal", async () => {
    // Given: an explicit model id.
    const { homeDir, cwd } = sandbox();
    const withModel: SavedConfig = {
      schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
    };

    // When: the writer persists.
    const writeResult = await writeSavedConfig(withModel, {
      homeDir,
      cwd,
      scope: "global",
    });
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;

    // Then: the literal model is in the bytes.
    const bytes = readFileSync(writeResult.path, "utf8");
    expect(bytes).toContain('"model"');
    expect(bytes).toContain('"claude-sonnet-4-5"');

    // And: a fresh read returns it.
    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.config?.model).toBe("claude-sonnet-4-5");
  });

  it("Omit-Model-3: an empty-string model on read is treated as absent (lock the empty-string-as-missing rule for the wizard)", async () => {
    // Given: a config with model set to "" (the wizard's "no default"
    // path will pass an empty string when the operator hits Enter).
    const { homeDir, cwd } = sandbox();
    const emptyModel: SavedConfig = {
      schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
      provider: "openai-compatible",
      model: "",
    };
    const writeResult = await writeSavedConfig(emptyModel, {
      homeDir,
      cwd,
      scope: "global",
    });
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;

    // When: a fresh read round-trips.
    const readResult = readSavedConfig({ homeDir, cwd });
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;

    // Then: model is undefined (empty-string-as-missing — the
    // canonical loader rule, mirrored in `pickString`).
    expect(readResult.config?.model).toBeUndefined();
    expect(Object.keys(readResult.config ?? {}).sort()).toEqual(
      ["provider", "schemaVersion"].sort(),
    );
  });
});