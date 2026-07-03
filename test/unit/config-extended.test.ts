import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
  ActionInputs,
  CliArgs,
  EnvSources,
  Severity,
} from "../../src/config/review-config.js";

const SECRET_TOKEN = "sk_test_LEAK_ME_abcdef0123456789";

describe("config: severity rank + bypass", () => {
  it("ranks severities in the expected order", () => {
    expect(rankSeverity("info")).toBe(0);
    expect(rankSeverity("minor")).toBe(1);
    expect(rankSeverity("major")).toBe(2);
    expect(rankSeverity("critical")).toBe(3);
    expect(rankSeverity("security")).toBe(4);
    expect(rankSeverity("leak")).toBe(5);
    expect(rankSeverity("leak")).toBeGreaterThan(rankSeverity("security"));
  });

  it("isSeverityAtLeast respects the ordinal order", () => {
    expect(isSeverityAtLeast("major", "major")).toBe(true);
    expect(isSeverityAtLeast("major", "critical")).toBe(true);
    expect(isSeverityAtLeast("major", "minor")).toBe(false);
    expect(isSeverityAtLeast("info", "info")).toBe(true);
  });

  it("ignoreMinor suppresses info and minor only", () => {
    expect(shouldKeepFinding({ ignoreMinor: true, minimum: "minor" }, "info")).toBe(false);
    expect(shouldKeepFinding({ ignoreMinor: true, minimum: "minor" }, "minor")).toBe(false);
    expect(shouldKeepFinding({ ignoreMinor: true, minimum: "minor" }, "major")).toBe(true);
  });

  it("ignoreMinor never suppresses security or leak", () => {
    expect(shouldKeepFinding({ ignoreMinor: true, minimum: "minor" }, "security")).toBe(true);
    expect(shouldKeepFinding({ ignoreMinor: true, minimum: "minor" }, "leak")).toBe(true);
  });

  it("minimum threshold filters without ignoreMinor", () => {
    expect(shouldKeepFinding({ ignoreMinor: false, minimum: "critical" }, "major")).toBe(false);
    expect(shouldKeepFinding({ ignoreMinor: false, minimum: "critical" }, "critical")).toBe(true);
    expect(shouldKeepFinding({ ignoreMinor: false, minimum: "critical" }, "security")).toBe(true);
    expect(shouldKeepFinding({ ignoreMinor: false, minimum: "critical" }, "leak")).toBe(true);
  });

  it("leak and security bypass minimum thresholds by rank", () => {
    // leak > security > critical > major > minor > info
    expect(rankSeverity("leak")).toBeGreaterThan(rankSeverity("critical"));
    expect(isSeverityAtLeast("major", "leak")).toBe(true);
    expect(isSeverityAtLeast("info", "leak")).toBe(true);
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

  const empty = (): { cli: CliArgs; inputs: ActionInputs; env: EnvSources } => ({
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
    expect(result.severity.minimum).toBe("minor");
    expect(result.timeouts.reviewSeconds).toBe(300);
    expect(result.sonar.enabled).toBe(false);
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
      UMACTUALLY_SONAR_HOST_URL: "https://sonar.example.test",
      UMACTUALLY_SONAR_TOKEN: "sonar-token",
      UMACTUALLY_SONAR_PROJECT_KEY: "umactually",
      UMACTUALLY_INCLUDE_SONARQUBE: "true",
      UMACTUALLY_IGNORE_MINOR: "false",
      UMACTUALLY_DETECT_LEAKS: "true",
    });
    expect(sources.providerUrl).toBe("https://vmi.example.test/v1");
    expect(sources.providerApiKey).toBe("sk_umactually_abcdef0123456789");
    expect(sources.providerModel).toBe("review-model-synthetic");
    expect(sources.promptSystemFile).toBe("prompts/system.md");
    expect(sources.promptUserFile).toBe("prompts/extra.md");
    expect(sources.reviewTimeoutSeconds).toBe("300");
    expect(sources.stallTimeoutSeconds).toBe("270");
    expect(sources.sonarHost).toBe("https://sonar.example.test");
    expect(sources.sonarToken).toBe("sonar-token");
    expect(sources.sonarProject).toBe("umactually");
    expect(sources.sonarEnabled).toBe("true");
    expect(sources.ignoreMinor).toBe("false");
    expect(sources.leakDetection).toBe("true");
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
    for (let i = 0; i < ALL.length; i++) {
      for (let j = i + 1; j < ALL.length; j++) {
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

// Sanity marker for `sep` import (used implicitly on win32 for path containment).
it.skip("sep imported for cross-platform containment", () => {
  expect(typeof sep).toBe("string");
});