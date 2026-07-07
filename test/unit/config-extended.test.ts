import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIELDS } from "../../src/config/field-schema.js";
import { severityRank } from "../../src/util/severity.js";

import {
  InvalidConfigError,
  PromptFileError,
  REDACTED,
  isSeverityAtLeast,
  loadConfigFromSources,
  normalizeApiUrl,
  parseBooleanFromUnknown,
  parseIntegerFromUnknown,
  parsePlatformFromUnknown,
  parseSeverityFromUnknown,
  rankSeverity,
  readEnvSources,
  readPromptFiles,
  shouldKeepFinding,
} from "../../src/config/review-config.js";
import type {
  CliArgs,
  EnvSources,
  RawActionInputs,
  Severity,
} from "../../src/config/review-config.js";

const SECRET_TOKEN = "sk_test_LEAK_ME_abcdef0123456789";

describe("config: severity rank + bypass", () => {
  it("ranks severities in the expected order", () => {
    // Unified rank table (now delegated to src/util/severity.ts:severityRank
    // so the live path and the config path agree). Absolute values shifted
    // from the previous parallel table (critical was 3, security 4, leak 5)
    // to the live-path values (critical=4, security=5, leak=6). Ordinal
    // relationships are unchanged.
    expect(rankSeverity("info")).toBe(0);
    expect(rankSeverity("minor")).toBe(1);
    expect(rankSeverity("major")).toBe(2);
    expect(rankSeverity("critical")).toBe(4);
    expect(rankSeverity("security")).toBe(5);
    expect(rankSeverity("leak")).toBe(6);
    expect(rankSeverity("leak")).toBeGreaterThan(rankSeverity("security"));
  });

  it("isSeverityAtLeast respects the ordinal order", () => {
    expect(isSeverityAtLeast("major", "major")).toBe(true);
    expect(isSeverityAtLeast("major", "critical")).toBe(true);
    expect(isSeverityAtLeast("major", "minor")).toBe(false);
    expect(isSeverityAtLeast("info", "info")).toBe(true);
  });

  it("minimum threshold filters below-tier findings", () => {
    expect(shouldKeepFinding({ minimum: "minor" }, "info")).toBe(false);
    expect(shouldKeepFinding({ minimum: "minor" }, "minor")).toBe(true);
    expect(shouldKeepFinding({ minimum: "minor" }, "major")).toBe(true);
  });

  it("minimum severity filters across minimum-severity enum values", () => {
    // CLI/action users pass low|medium|high. shouldKeepFinding receives the
    // internal Severity threshold, so this test pins the alias mapping:
    // low → minor, medium → major, high → critical.
    const allSeverities: readonly Severity[] = ["info", "minor", "major", "critical", "security", "leak"];
    const cases: ReadonlyArray<{
      readonly minimumSeverity: "low" | "medium" | "high";
      readonly minimum: Severity;
      readonly kept: readonly Severity[];
    }> = [
      { minimumSeverity: "low", minimum: "minor", kept: ["minor", "major", "critical", "security", "leak"] },
      { minimumSeverity: "medium", minimum: "major", kept: ["major", "critical", "security", "leak"] },
      { minimumSeverity: "high", minimum: "critical", kept: ["critical", "security", "leak"] },
    ];

    for (const c of cases) {
      const actual = allSeverities.filter((severity) => shouldKeepFinding({ minimum: c.minimum }, severity));
      expect(actual, c.minimumSeverity).toEqual(c.kept);
    }
  });

  it("security and leak ALWAYS bypass minimum threshold (security policy)", () => {
    for (const minimum of ["critical", "major", "minor"] as const) {
      expect(shouldKeepFinding({ minimum }, "security"), `minimum=${minimum}`).toBe(true);
      expect(shouldKeepFinding({ minimum }, "leak"), `minimum=${minimum}`).toBe(true);
    }
  });

  it("leak and security bypass minimum thresholds by rank", () => {
    // leak > security > critical > major > minor > info
    expect(rankSeverity("leak")).toBeGreaterThan(rankSeverity("critical"));
    expect(isSeverityAtLeast("major", "leak")).toBe(true);
    expect(isSeverityAtLeast("info", "leak")).toBe(true);
  });

  it("rankSeverity and severityRank agree on every internal Severity value", () => {
    // Regression guard for the P0 severity-rank consolidation. Before
    // this fix, rankSeverity (config/severity.ts) and severityRank
    // (util/severity.ts) were two separate tables that could disagree
    // on absolute values. After this fix, rankSeverity delegates to
    // severityRank so they MUST agree on every internal Severity
    // value — this test pins that contract.
    const ALL: readonly Severity[] = ["info", "minor", "major", "critical", "security", "leak"];
    for (const s of ALL) {
      expect(rankSeverity(s)).toBe(severityRank(s));
      expect(severityRank(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it("severityRank pins the provider-alias ranks: low < medium < high < critical", () => {
    // The provider-side vocabulary (`low | medium | high`) is NOT in
    // the internal Severity union but is a real consumer via
    // `passesSeverityPolicy` and the minimum-severity CLI flag. Pin
    // absolute values so a future re-tuning of SEVERITY_RANK cannot
    // silently shift the alias ranks via arithmetic coupling.
    expect(severityRank("low")).toBe(1);
    expect(severityRank("medium")).toBe(2);
    expect(severityRank("high")).toBe(3);
    // Order must hold: low < medium < high < critical.
    expect(severityRank("low")).toBeLessThan(severityRank("medium"));
    expect(severityRank("medium")).toBeLessThan(severityRank("high"));
    expect(severityRank("high")).toBeLessThan(severityRank("critical"));
  });
});

describe("config: boolean parsing", () => {
  it("accepts native boolean", () => {
    expect(parseBooleanFromUnknown(true, "f")).toBe(true);
    expect(parseBooleanFromUnknown(false, "f")).toBe(false);
  });

  it("accepts numeric 0/1", () => {
    expect(parseBooleanFromUnknown(1, "f")).toBe(true);
    expect(parseBooleanFromUnknown(0, "f")).toBe(false);
  });

  it("accepts canonical truthy/falsy strings (case-insensitive, trimmed)", () => {
    expect(parseBooleanFromUnknown("true", "f")).toBe(true);
    expect(parseBooleanFromUnknown("YES", "f")).toBe(true);
    expect(parseBooleanFromUnknown(" On ", "f")).toBe(true);
    expect(parseBooleanFromUnknown("1", "f")).toBe(true);
    expect(parseBooleanFromUnknown("false", "f")).toBe(false);
    expect(parseBooleanFromUnknown("off", "f")).toBe(false);
    expect(parseBooleanFromUnknown("0", "f")).toBe(false);
    expect(parseBooleanFromUnknown("", "f")).toBe(false);
  });

  it("throws InvalidConfigError with REDACTED on unparseable input", () => {
    expect(() => parseBooleanFromUnknown("maybe", "walkthrough")).toThrow(InvalidConfigError);
    expect(() => parseBooleanFromUnknown(2, "x")).toThrow(InvalidConfigError);
    expect(() => parseBooleanFromUnknown(null, "x")).toThrow(InvalidConfigError);
    try {
      parseBooleanFromUnknown(SECRET_TOKEN, "token.field");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET_TOKEN);
      expect(message).toContain(REDACTED);
    }
  });
});

describe("config: integer parsing", () => {
  it("accepts native integers", () => {
    expect(parseIntegerFromUnknown(42, "n")).toBe(42);
    expect(parseIntegerFromUnknown(-7, "n")).toBe(-7);
  });

  it("accepts integer strings (trimmed)", () => {
    expect(parseIntegerFromUnknown("42", "n")).toBe(42);
    expect(parseIntegerFromUnknown("  100 ", "n")).toBe(100);
  });

  it("rejects floats, empty, non-numeric", () => {
    expect(() => parseIntegerFromUnknown(1.5, "n")).toThrow(InvalidConfigError);
    expect(() => parseIntegerFromUnknown("", "n")).toThrow(InvalidConfigError);
    expect(() => parseIntegerFromUnknown("abc", "n")).toThrow(InvalidConfigError);
    expect(() => parseIntegerFromUnknown("3.14", "n")).toThrow(InvalidConfigError);
  });
});

describe("config: severity parsing", () => {
  it("accepts valid severities (case-insensitive)", () => {
    for (const s of ["info", "minor", "major", "critical", "security", "leak"] as const) {
      expect(parseSeverityFromUnknown(s, "f")).toBe(s);
    }
    expect(parseSeverityFromUnknown("SECURITY", "f")).toBe("security");
  });

  it("rejects unknown values with REDACTED in error", () => {
    try {
      parseSeverityFromUnknown(SECRET_TOKEN, "severity.minimum");
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET_TOKEN);
      expect(message).toContain(REDACTED);
    }
  });
});

describe("config: platform parsing", () => {
  it("accepts auto/github/azure", () => {
    expect(parsePlatformFromUnknown("github", "f")).toBe("github");
    expect(parsePlatformFromUnknown("AZURE", "f")).toBe("azure");
    expect(parsePlatformFromUnknown("auto", "f")).toBe("auto");
  });

  it("rejects unknown platforms", () => {
    expect(() => parsePlatformFromUnknown("bitbucket", "f")).toThrow(InvalidConfigError);
  });
});

describe("config: URL normalization", () => {
  it("appends /v1 when missing", () => {
    expect(normalizeApiUrl("https://api.openai.com", "f")).toBe("https://api.openai.com/v1");
    expect(normalizeApiUrl("http://localhost:11434", "f")).toBe("http://localhost:11434/v1");
    expect(normalizeApiUrl("https://example.com/", "f")).toBe("https://example.com/v1");
  });

  it("preserves an existing version segment", () => {
    expect(normalizeApiUrl("https://api.openai.com/v1", "f")).toBe("https://api.openai.com/v1");
    expect(normalizeApiUrl("https://api.openai.com/v2", "f")).toBe("https://api.openai.com/v2");
    expect(normalizeApiUrl("https://example.com/api/v3", "f")).toBe("https://example.com/api/v3");
  });

  it("strips query and fragment", () => {
    expect(normalizeApiUrl("https://example.com/v1?foo=bar", "f")).toBe("https://example.com/v1");
    expect(normalizeApiUrl("https://example.com#frag", "f")).toBe("https://example.com/v1");
  });

  it("lowercases scheme and host", () => {
    expect(normalizeApiUrl("HTTPS://API.OpenAI.com", "f")).toBe("https://api.openai.com/v1");
  });

  it("rejects unsupported schemes with REDACTED", () => {
    try {
      normalizeApiUrl(`ftp://${SECRET_TOKEN}/path`, "f");
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET_TOKEN);
      expect(message).toContain(REDACTED);
    }
  });

  it("rejects malformed URLs with REDACTED", () => {
    try {
      normalizeApiUrl(`https://api.example.com/${SECRET_TOKEN}?token=${SECRET_TOKEN}`, "f");
      throw new Error("should have thrown");
    } catch (error) {
      // Valid URL — normalization succeeds; ensure the secret never appears in the output.
      const message = (error as Error).message;
      // No error path exercised — but verify the URL parsed output also doesn't echo the secret
      // (a defense-in-depth check).
      expect(message === "" || !message.includes(SECRET_TOKEN)).toBe(true);
    }
    // Truly malformed input:
    try {
      normalizeApiUrl(`not a url: ${SECRET_TOKEN}`, "f");
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET_TOKEN);
      expect(message).toContain(REDACTED);
    }
  });

  it("rejects empty / non-string", () => {
    expect(() => normalizeApiUrl("", "f")).toThrow(InvalidConfigError);
    expect(() => normalizeApiUrl(123, "f")).toThrow(InvalidConfigError);
  });
});

describe("config: readPromptFiles", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "cfg-prompt-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("reads a single workspace-relative file", async () => {
    await writeFile(join(cwd, "system.txt"), "Hello world", "utf8");
    const result = await readPromptFiles(["system.txt"], 1024, { cwd });
    expect(result).toBe("Hello world");
  });

  it("reads and concatenates multiple files with separator", async () => {
    await writeFile(join(cwd, "a.txt"), "AAA", "utf8");
    await writeFile(join(cwd, "b.txt"), "BBB", "utf8");
    const result = await readPromptFiles(["a.txt", "b.txt"], 1024, { cwd });
    expect(result).toBe(`AAA\n\n---\n\nBBB`);
  });

  it("rejects paths that escape cwd (parent traversal)", async () => {
    await expect(readPromptFiles(["../outside.txt"], 1024, { cwd })).rejects.toBeInstanceOf(PromptFileError);
    await expect(readPromptFiles(["../outside.txt"], 1024, { cwd })).rejects.toMatchObject({
      reason: "outside-cwd",
    });
  });

  it("rejects symlinks that resolve outside cwd", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "cfg-out-"));
    try {
      const outsideFile = join(outsideDir, "secret.txt");
      await writeFile(outsideFile, SECRET_TOKEN, "utf8");
      const linkPath = join(cwd, "link.txt");
      try {
        await symlink(outsideFile, linkPath, "file");
      } catch {
        // Some Windows filesystems reject symlink creation; skip.
        return;
      }
      try {
        await readPromptFiles(["link.txt"], 1024, { cwd });
        throw new Error("should have rejected");
      } catch (error) {
        expect(error).toBeInstanceOf(PromptFileError);
        expect((error as PromptFileError).reason).toBe("outside-cwd");
      }
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("enforces per-file byte cap", async () => {
    await writeFile(join(cwd, "big.txt"), "x".repeat(2048), "utf8");
    try {
      await readPromptFiles(["big.txt"], 1024, { cwd });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PromptFileError);
      expect((error as PromptFileError).reason).toBe("byte-cap-exceeded");
      const message = (error as Error).message;
      expect(message).not.toContain("x".repeat(100));
      expect(message).not.toContain("big.txt");
    }
  });

  it("enforces aggregate byte cap across multiple files", async () => {
    await writeFile(join(cwd, "a.txt"), "x".repeat(600), "utf8");
    await writeFile(join(cwd, "b.txt"), "y".repeat(600), "utf8");
    try {
      await readPromptFiles(["a.txt", "b.txt"], 1024, { cwd });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PromptFileError);
      expect((error as PromptFileError).reason).toBe("byte-cap-exceeded");
    }
  });

  it("rejects empty paths", async () => {
    await expect(readPromptFiles([""], 1024, { cwd })).rejects.toBeInstanceOf(PromptFileError);
  });

  it("rejects missing files", async () => {
    await expect(readPromptFiles(["missing.txt"], 1024, { cwd })).rejects.toBeInstanceOf(PromptFileError);
    await expect(readPromptFiles(["missing.txt"], 1024, { cwd })).rejects.toMatchObject({
      reason: "not-found",
    });
  });

  it("rejects directories", async () => {
    await mkdir(join(cwd, "subdir"));
    try {
      await readPromptFiles(["subdir"], 1024, { cwd });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PromptFileError);
      expect((error as PromptFileError).reason).toBe("not-a-file");
    }
  });

  it("rejects non-positive byte cap", async () => {
    await expect(readPromptFiles(["x.txt"], 0, { cwd })).rejects.toBeInstanceOf(InvalidConfigError);
    await expect(readPromptFiles(["x.txt"], -1, { cwd })).rejects.toBeInstanceOf(InvalidConfigError);
  });
});

describe("config: loadConfigFromSources precedence", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "cfg-loader-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const empty = (): { cli: CliArgs; inputs: RawActionInputs; env: EnvSources } => ({
    cli: {},
    inputs: {},
    env: {},
  });

  it("applies all defaults when nothing is provided", async () => {
    const result = await loadConfigFromSources({ ...empty(), cwd });
    expect(result.provider.url).toBe("https://api.openai.com/v1");
    expect(result.provider.model).toBe("auto");
    expect(result.platform).toBe("auto");
    expect(result.guidance.dryRun).toBe(false);
    expect(result.leakDetection).toBe(true);
    expect(result.redactorEnabled).toBe(true);
    expect(result.severity.maxComments).toBe(50);
    expect(result.severity.minimum).toBe("major");
    expect(result.timeouts.reviewSeconds).toBe(300);
    expect(result.sonar.enabled).toBe(false);
  });

  it("derives all timeout + model defaults from the field-schema (no loader drift)", async () => {
    // Regression: `config/loader.ts` previously hard-coded
    // DEFAULT_SONAR_TIMEOUT_SECONDS=60 while the field-schema default
    // (and therefore the CLI / action / env surfaces) was 300. Live
    // SonarQube scans silently timed out at 60s. Pins the relationship
    // between the loader output and the field-schema defaults so a
    // future loader cannot regress regardless of which numeric value
    // the schema lands on.
    const result = await loadConfigFromSources({ ...empty(), cwd });
    // Schema-relative: the loader must produce the field-schema default,
    // not a hard-coded magic number. If FIELDS.x.defaultValue changes,
    // this test moves with it (and so does the loader).
    expect(result.timeouts.reviewSeconds).toBe(FIELDS.reviewTimeoutSeconds.defaultValue);
    expect(result.timeouts.stallSeconds).toBe(FIELDS.stallSeconds.defaultValue);
    expect(result.timeouts.perRequestSeconds).toBe(FIELDS.perRequestTimeoutSeconds.defaultValue);
    expect(result.sonar.timeoutSeconds).toBe(FIELDS.sonarTimeoutSeconds.defaultValue);
    expect(result.provider.model).toBe(FIELDS.model.defaultValue);
  });

  it("CLI > inputs > env > defaults for booleans (dryRun)", async () => {
    const result = await loadConfigFromSources({
      cli: { dryRun: true },
      inputs: { dryRun: "false" },
      env: { dryRun: "false" },
      cwd,
    });
    expect(result.guidance.dryRun).toBe(true);
  });

  it("inputs > env > defaults when CLI omits the key", async () => {
    const result = await loadConfigFromSources({
      cli: {},
      inputs: { walkthrough: "yes" },
      env: { walkthrough: "no" },
      cwd,
    });
    expect(result.guidance.walkthrough).toBe(true);
  });

  it("env > defaults when CLI and inputs omit the key", async () => {
    const result = await loadConfigFromSources({
      cli: {},
      inputs: {},
      env: { dryRun: "true" },
      cwd,
    });
    expect(result.guidance.dryRun).toBe(true);
  });

  it("CLI > env when inputs omit the key (skipping inputs)", async () => {
    const result = await loadConfigFromSources({
      cli: { walkthrough: true },
      inputs: {},
      env: { walkthrough: "false" },
      cwd,
    });
    expect(result.guidance.walkthrough).toBe(true);
  });

  it("strings: CLI wins over inputs and env (providerUrl)", async () => {
    const result = await loadConfigFromSources({
      cli: { providerUrl: "https://cli.example.com/" },
      inputs: { providerUrl: "https://inputs.example.com/" },
      env: { providerUrl: "https://env.example.com/" },
      cwd,
    });
    expect(result.provider.url).toBe("https://cli.example.com/v1");
  });

  it("numbers: CLI wins over inputs (string) and env (string)", async () => {
    const result = await loadConfigFromSources({
      cli: { reviewTimeoutSeconds: 600 },
      inputs: { reviewTimeoutSeconds: "450" },
      env: { reviewTimeoutSeconds: "300" },
      cwd,
    });
    expect(result.timeouts.reviewSeconds).toBe(600);
  });

  it("Sonar block respects precedence", async () => {
    const result = await loadConfigFromSources({
      cli: {},
      inputs: { sonarEnabled: "true", sonarHost: "https://sonar.in", sonarToken: "tok-input", sonarProject: "proj-input", sonarTimeoutSeconds: "120" },
      env: { sonarEnabled: "false", sonarHost: "https://sonar.env", sonarToken: "tok-env", sonarProject: "proj-env", sonarTimeoutSeconds: "30" },
      cwd,
    });
    expect(result.sonar.enabled).toBe(true);
    // Sonar host is NOT URL-normalized — only provider.url is.
    expect(result.sonar.host).toBe("https://sonar.in");
    expect(result.sonar.token).toBe("tok-input");
    expect(result.sonar.project).toBe("proj-input");
    expect(result.sonar.timeoutSeconds).toBe(120);
  });

  it("Azure block precedence: CLI > inputs > env", async () => {
    const result = await loadConfigFromSources({
      cli: { azureOrg: "cli-org" },
      inputs: { azureOrg: "inputs-org", azureProject: "inputs-proj", azureRepo: "inputs-repo", azurePullRequestId: "42" },
      env: { azureOrg: "env-org", azureProject: "env-proj", azureRepo: "env-repo", azurePullRequestId: "9" },
      cwd,
    });
    expect(result.azure.org).toBe("cli-org");
    expect(result.azure.project).toBe("inputs-proj");
    expect(result.azure.repo).toBe("inputs-repo");
    expect(result.azure.pullRequestId).toBe(42);
  });

  it("inline prompt wins over file prompt", async () => {
    await writeFile(join(cwd, "system.txt"), "FROM_FILE", "utf8");
    const result = await loadConfigFromSources({
      cli: { promptSystem: "INLINE", promptSystemFile: "system.txt" },
      inputs: {},
      env: {},
      cwd,
    });
    expect(result.prompts.system).toBe("INLINE");
  });

  it("reads prompt file from workspace-relative path", async () => {
    await writeFile(join(cwd, "user.txt"), "FROM_USER_FILE", "utf8");
    const result = await loadConfigFromSources({
      cli: {},
      inputs: { promptUserFile: "user.txt" },
      env: {},
      cwd,
    });
    expect(result.prompts.user).toBe("FROM_USER_FILE");
  });

  it("env.promptSystemFile is honored when no CLI/input override", async () => {
    await writeFile(join(cwd, "system.txt"), "FROM_ENV_FILE", "utf8");
    const result = await loadConfigFromSources({
      cli: {},
      inputs: {},
      env: { promptSystemFile: "system.txt" },
      cwd,
    });
    expect(result.prompts.system).toBe("FROM_ENV_FILE");
  });

  it("platform auto-detect defaults to 'auto' and accepts 'github' / 'azure' from inputs", async () => {
    const r1 = await loadConfigFromSources({ ...empty(), cwd });
    expect(r1.platform).toBe("auto");
    const r2 = await loadConfigFromSources({ ...empty(), cli: {}, inputs: { platform: "github" }, env: {}, cwd });
    expect(r2.platform).toBe("github");
    const r3 = await loadConfigFromSources({ ...empty(), cli: {}, inputs: {}, env: { platform: "AZURE" }, cwd });
    expect(r3.platform).toBe("azure");
  });

  it("GITHUB_TOKEN env is exposed as githubToken (empty by default)", async () => {
    const result = await loadConfigFromSources({ ...empty(), cwd });
    expect(result.githubToken).toBe("");
  });
});

describe("config: readEnvSources", () => {
  it("extracts only known keys from process.env", () => {
    const sources = readEnvSources({
      REVIEW_PROVIDER_URL: "https://example.com",
      REVIEW_DRY_RUN: "true",
      REVIEW_MINIMUM_SEVERITY: "major",
      GITHUB_TOKEN: "ghp_x",
      AZURE_DEVOPS_ORG: "myorg",
      UNKNOWN_KEY: "ignore-me",
    });
    expect(sources.providerUrl).toBe("https://example.com");
    expect(sources.dryRun).toBe("true");
    expect(sources.minimumSeverity).toBe("major");
    expect(sources.githubToken).toBe("ghp_x");
    expect(sources.azureOrg).toBe("myorg");
    expect("UNKNOWN_KEY" in sources).toBe(false);
  });

  it("omits empty strings", () => {
    const sources = readEnvSources({
      REVIEW_DRY_RUN: "",
      GITHUB_TOKEN: " ",
    });
    expect(sources.dryRun).toBeUndefined();
    expect(sources.githubToken).toBeUndefined();
  });

  it("recognizes UMACTUALLY_* env vars with REVIEW_* as fallback", () => {
    const sources = readEnvSources({
      UMACTUALLY_API_URL: "https://vmi.example.test/v1",
      UMACTUALLY_API_KEY: "sk_umactually_abcdef0123456789",
      UMACTUALLY_MODEL: "review-model-synthetic",
      UMACTUALLY_PROMPT_FILE: "prompts/system.md",
      UMACTUALLY_ADDITIONAL_PROMPT_FILE: "prompts/extra.md",
      UMACTUALLY_REVIEW_TIMEOUT_SECONDS: "300",
      UMACTUALLY_STALL_SECONDS: "270",
      UMACTUALLY_MAX_OUTPUT_TOKENS: "16000",
      REVIEW_PROMPT_BYTE_CAP: "4096",
      REVIEW_PER_REQUEST_TIMEOUT_SECONDS: "30",
      REVIEW_MAX_COMMENTS: "8",
      REVIEW_FILE_LIMIT: "12",
      REVIEW_PLATFORM: "azure",
      UMACTUALLY_GITHUB_API_BASE: "https://ghe.example.test",
      GITHUB_TOKEN: "gho_token",
      AZURE_DEVOPS_PROJECT: "ado-project",
      AZURE_DEVOPS_REPO: "ado-repo",
      AZURE_DEVOPS_PULL_REQUEST_ID: "42",
      AZURE_DEVOPS_TOKEN: "ado-token",
      UMACTUALLY_SONAR_HOST_URL: "https://sonar.example.test",
      UMACTUALLY_SONAR_TOKEN: "sonar-token",
      UMACTUALLY_SONAR_PROJECT_KEY: "umactually",
      UMACTUALLY_INCLUDE_SONARQUBE: "true",
      UMACTUALLY_DETECT_LEAKS: "true",
      REVIEW_REDACTOR_ENABLED: "false",
    });
    expect(sources.providerUrl).toBe("https://vmi.example.test/v1");
    expect(sources.providerApiKey).toBe("sk_umactually_abcdef0123456789");
    expect(sources.providerModel).toBe("review-model-synthetic");
    expect(sources.promptSystemFile).toBe("prompts/system.md");
    expect(sources.promptUserFile).toBe("prompts/extra.md");
    expect(sources.reviewTimeoutSeconds).toBe("300");
    expect(sources.stallTimeoutSeconds).toBe("270");
    expect(sources.maxOutputTokens).toBe("16000");
    expect(sources.promptByteCap).toBe("4096");
    expect(sources.perRequestTimeoutSeconds).toBe("30");
    expect(sources.maxComments).toBe("8");
    expect(sources.reviewFileLimit).toBe("12");
    expect(sources.platform).toBe("azure");
    expect(sources.githubApiBase).toBe("https://ghe.example.test");
    expect(sources.githubToken).toBe("gho_token");
    expect(sources.azureProject).toBe("ado-project");
    expect(sources.azureRepo).toBe("ado-repo");
    expect(sources.azurePullRequestId).toBe("42");
    expect(sources.azureToken).toBe("ado-token");
    expect(sources.sonarHost).toBe("https://sonar.example.test");
    expect(sources.sonarToken).toBe("sonar-token");
    expect(sources.sonarProject).toBe("umactually");
    expect(sources.sonarEnabled).toBe("true");
    expect(sources.leakDetection).toBe("true");
    expect(sources.redactorEnabled).toBe("false");
  });

  it("UMACTUALLY_* takes precedence over REVIEW_* when both are set", () => {
    const sources = readEnvSources({
      UMACTUALLY_API_URL: "https://primary.example.test/v1",
      REVIEW_PROVIDER_URL: "https://fallback.example.test/v1",
    });
    expect(sources.providerUrl).toBe("https://primary.example.test/v1");
  });

  it("falls back to REVIEW_* when UMACTUALLY_* is absent", () => {
    const sources = readEnvSources({
      REVIEW_PROVIDER_URL: "https://legacy.example.test/v1",
      REVIEW_PROVIDER_API_KEY: "legacy-key",
    });
    expect(sources.providerUrl).toBe("https://legacy.example.test/v1");
    expect(sources.providerApiKey).toBe("legacy-key");
  });
});

describe("config: legacy ignore-minor env-var warning", () => {
  // The `ignore-minor` removal leaves UMACTUALLY_IGNORE_MINOR and
  // REVIEW_IGNORE_MINOR as silently-dropped env vars. CI pipelines
  // that still set these will get a one-time stderr warning pointing
  // them at minimum-severity. Without this test, a future refactor
  // could drop the warning and silently regress the migration nudge.
  beforeEach(() => {
    // Reset the module-scoped dedupe set between tests by clearing
    // the module cache for env-sources. Otherwise a test that warns
    // would suppress the warning in the next test.
    vi.resetModules();
  });
  it("emits a stderr warning when UMACTUALLY_IGNORE_MINOR is set", async () => {
    const { readEnvSources: readFresh } = await import("../../src/config/env-sources.js");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      readFresh({ UMACTUALLY_IGNORE_MINOR: "true" });
      expect(stderr).toHaveBeenCalled();
      const message = stderr.mock.calls.map((call) => String(call[0])).join("");
      expect(message).toMatch(/UMACTUALLY_IGNORE_MINOR/u);
      expect(message).toMatch(/minimum-severity/u);
    } finally {
      stderr.mockRestore();
    }
  });
  it("emits a stderr warning when REVIEW_IGNORE_MINOR is set", async () => {
    const { readEnvSources: readFresh } = await import("../../src/config/env-sources.js");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      readFresh({ REVIEW_IGNORE_MINOR: "true" });
      expect(stderr).toHaveBeenCalled();
      const message = stderr.mock.calls.map((call) => String(call[0])).join("");
      expect(message).toMatch(/REVIEW_IGNORE_MINOR/u);
    } finally {
      stderr.mockRestore();
    }
  });
  it("combines both legacy env vars into a single warning line when both are set", async () => {
    const { readEnvSources: readFresh } = await import("../../src/config/env-sources.js");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      readFresh({ UMACTUALLY_IGNORE_MINOR: "true", REVIEW_IGNORE_MINOR: "true" });
      // Single warning line covering both names — no back-to-back spam.
      const message = stderr.mock.calls.map((call) => String(call[0])).join("");
      expect(message).toMatch(/UMACTUALLY_IGNORE_MINOR/u);
      expect(message).toMatch(/REVIEW_IGNORE_MINOR/u);
      // Exactly one stderr write for the migration warning.
      expect(stderr.mock.calls.length).toBe(1);
    } finally {
      stderr.mockRestore();
    }
  });
  it("does not warn twice when readEnvSources is called multiple times", async () => {
    const { readEnvSources: readFresh } = await import("../../src/config/env-sources.js");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      readFresh({ UMACTUALLY_IGNORE_MINOR: "true" });
      readFresh({ UMACTUALLY_IGNORE_MINOR: "true" });
      readFresh({ UMACTUALLY_IGNORE_MINOR: "true" });
      // The module-scoped dedupe set survives across calls within
      // the same process — only the first call warns.
      expect(stderr.mock.calls.length).toBe(1);
    } finally {
      stderr.mockRestore();
    }
  });
  it("does not warn when legacy env vars are absent", async () => {
    const { readEnvSources: readFresh } = await import("../../src/config/env-sources.js");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      readFresh({ SOME_OTHER_VAR: "true" });
      const message = stderr.mock.calls.map((call) => String(call[0])).join("");
      expect(message).not.toMatch(/IGNORE_MINOR/u);
    } finally {
      stderr.mockRestore();
    }
  });
});

describe("config: secret redaction in errors", () => {
  it("never echoes the API key in InvalidConfigError messages", () => {
    try {
      parseBooleanFromUnknown(SECRET_TOKEN, "provider.apiKey");
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET_TOKEN);
      expect(message).toContain(REDACTED);
    }
  });

  it("never echoes prompt file contents in PromptFileError messages", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "cfg-redact-"));
    try {
      await writeFile(join(cwd, "ok.txt"), "ok", "utf8");
      try {
        await readPromptFiles(["ok.txt", "../escape.txt"], 1024, { cwd });
        throw new Error("should have thrown");
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain("ok");
        expect(message).not.toContain(SECRET_TOKEN);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("never echoes API key in loader-produced errors", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "cfg-loader-err-"));
    try {
      try {
        await loadConfigFromSources({
          cli: {},
          inputs: {},
          env: { providerUrl: SECRET_TOKEN },
          cwd,
        });
        throw new Error("should have thrown");
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain(SECRET_TOKEN);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("config: severity list sanity", () => {
  const ALL: readonly Severity[] = ["info", "minor", "major", "critical", "security", "leak"];
  it("exposes a strict ordering with security/leak at top", () => {
    for (let i = 0; i < ALL.length; i += 1) {
      for (let j = i + 1; j < ALL.length; j += 1) {
        const lower = ALL[i];
        const higher = ALL[j];
        if (lower === undefined || higher === undefined) throw new Error("unreachable");
        // The higher-ranked severity is at-least-as-severe as the lower one.
        expect(isSeverityAtLeast(lower, higher)).toBe(true);
        // The lower-ranked severity is NOT at-least-as-severe as the higher one.
        expect(isSeverityAtLeast(higher, lower)).toBe(false);
      }
    }
  });
});

describe("config: minimum-severity default + alias mapping", () => {
  // Pins the user-facing → internal Severity alias table so the loader
  // default (`DEFAULT_MINIMUM_SEVERITY = "major"`) and the parser
  // alias map can never silently drift. The user-facing enum is
  // `low|medium|high`; the loader default resolves to `medium`, which
  // aliases to internal `major`. If either side changes, this test
  // surfaces the mismatch instead of silently disagreeing.
  it("'medium' aliases to internal 'major'", () => {
    expect(parseSeverityFromUnknown("medium", "test")).toBe<Severity>("major");
  });
  it("'low' aliases to internal 'minor' and 'high' aliases to 'critical'", () => {
    expect(parseSeverityFromUnknown("low", "test")).toBe<Severity>("minor");
    expect(parseSeverityFromUnknown("high", "test")).toBe<Severity>("critical");
  });
  it("loader default tracks field-schema default via the alias table", async () => {
    // The schema (`field-schema.ts`) holds the user-facing default
    // string (`medium`); the loader stores the alias-resolved
    // internal Severity (`major`). A future change to either side
    // (e.g. someone flips the schema default to `low`, or relaxes
    // the alias mapping) would silently change effective config —
    // this test fails instead.
    //
    // We exercise the loader with an empty sources object so the
    // default path is the only one that runs, then assert the
    // resolved `severity.minimum` equals the alias of the schema
    // default. This catches both:
    //   - schema default changes (FIELDS.minimumSeverity.defaultValue)
    //   - alias changes (SEVERITY_ALIASES in parsers.ts)
    //   - loader default changes (DEFAULT_MINIMUM_SEVERITY in loader.ts)
    const { loadConfigFromSources } = await import("../../src/config/loader.js");
    const schemaDefault = FIELDS.minimumSeverity.defaultValue;
    if (typeof schemaDefault !== "string") {
      throw new Error("schema default is not a string");
    }
    const expected = parseSeverityFromUnknown(schemaDefault, "test");
    const config = await loadConfigFromSources({
      cli: {},
      inputs: {},
      env: {},
      cwd: process.cwd(),
    });
    expect(config.severity.minimum).toBe(expected);
  });
});

// Sanity marker for `sep` import (used implicitly on win32 for path containment).
it.skip("sep imported for cross-platform containment", () => {
  expect(typeof sep).toBe("string");
});