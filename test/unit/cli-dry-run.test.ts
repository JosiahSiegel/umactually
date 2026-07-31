import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REVIEW_MARKER } from "../../src/util/marker.js";

type RunCli = (args: readonly string[], cwd: string) => Promise<{ readonly exitCode: number }>;

type CliModuleNamespace = {
  readonly runCli?: RunCli;
};

const cliModule = "../../src/cli.js";
const cliPath = "src/cli.ts";

function isCliModuleNamespace(value: unknown): value is CliModuleNamespace {
  return typeof value === "object" && value !== null;
}

const ENV_KEYS_TO_CLEAR = [
  "UMACTUALLY_API_URL",
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_MODEL",
  "UMACTUALLY_PROMPT_FILE",
  "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
  "UMACTUALLY_WALKTHROUGH",
  "UMACTUALLY_DIAGNOSTIC",
  "UMACTUALLY_DRY_RUN",
  "UMACTUALLY_REVIEW_TIMEOUT_SECONDS",
  "UMACTUALLY_STALL_SECONDS",
  "UMACTUALLY_INCLUDE_SONARQUBE",
  "UMACTUALLY_SONAR_HOST_URL",
  "UMACTUALLY_SONAR_TOKEN",
  "UMACTUALLY_SONAR_PROJECT_KEY",
  "UMACTUALLY_DETECT_LEAKS",
  "REVIEW_PROVIDER_URL",
  "REVIEW_PROVIDER_API_KEY",
  "REVIEW_PROVIDER_MODEL",
  "REVIEW_PROMPT_SYSTEM_FILE",
  "REVIEW_PROMPT_USER_FILE",
  "REVIEW_PROMPT_BYTE_CAP",
  "REVIEW_WALKTHROUGH",
  "REVIEW_DIAGNOSTIC",
  "REVIEW_DRY_RUN",
  "REVIEW_DEBUG_RAW_RESPONSE",
  "REVIEW_TIMEOUT_SECONDS",
  "REVIEW_STALL_SECONDS",
  "REVIEW_PER_REQUEST_TIMEOUT_SECONDS",
  "REVIEW_MINIMUM_SEVERITY",
  "REVIEW_MAX_COMMENTS",
  "REVIEW_SONAR_ENABLED",
  "REVIEW_SONAR_HOST",
  "REVIEW_SONAR_TOKEN",
  "REVIEW_SONAR_PROJECT",
  "REVIEW_SONAR_TIMEOUT_SECONDS",
  "REVIEW_LEAK_DETECTION",
  "REVIEW_REDACTOR_ENABLED",
  "REVIEW_PLATFORM",
  "GITHUB_TOKEN",
  "AZURE_DEVOPS_ORG",
  "AZURE_DEVOPS_PROJECT",
  "AZURE_DEVOPS_REPO",
  "AZURE_DEVOPS_PULL_REQUEST_ID",
  "AZURE_DEVOPS_TOKEN",
] as const;

function clearEnvForRun(): void {
  for (const key of ENV_KEYS_TO_CLEAR) {
    delete process.env[key];
  }
}

describe("CLI dry-run RED contract", () => {
  let workspaceDir = "";
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    clearEnvForRun();
    workspaceDir = await (async (): Promise<string> => {
      const base = await mkTempDir("umactually-cli-dry-run-");
      const fixturesDir = join(base, "test", "fixtures", "azure");
      await mkdir(fixturesDir, { recursive: true });
      const pullRequest = JSON.stringify({
        repositoryId: "00000000-0000-0000-0000-000000000042",
        pullRequestId: 42,
        sourceRefName: "refs/heads/feature/cli",
        targetRefName: "refs/heads/main",
      });
      const threads = JSON.stringify({
        count: 0,
        value: [],
      });
      const review = JSON.stringify({
        verdict: "APPROVED",
        comments: [],
        suppressed_comments: [],
      });
      await writeFile(join(fixturesDir, "pull-request.json"), pullRequest, "utf8");
      await writeFile(join(fixturesDir, "threads.json"), threads, "utf8");
      await writeFile(join(base, "test", "fixtures", "azure", "review.json"), review, "utf8");
      return base;
    })();
  });

  afterEach(async () => {
    clearEnvForRun();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (workspaceDir.length > 0) {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("CLI-RED-002 writes the Azure dry-run artifact and exits zero when --dry-run is set", async () => {
    // Given: an Azure pipeline dry-run invocation targeting a custom artifact path inside an isolated workspace.
    const artifactPath = join(workspaceDir, "artifacts", "azure-cli-dry-run.json");
    const args = [
      "--platform",
      "azure",
      "--event",
      "test/fixtures/azure/pull-request.json",
      "--diff",
      "test/fixtures/azure/pull-request.json",
      "--threads",
      "test/fixtures/azure/threads.json",
      "--review",
      "test/fixtures/azure/review.json",
      "--pr-number",
      "42",
      "--repo",
      "example/project",
      "--dry-run",
      "--output-artifact",
      artifactPath,
    ];

    // When: the future CLI runs the dry-run path inside the workspace.
    let moduleNamespace: unknown;
    try {
      moduleNamespace = await import(cliModule);
    } catch (error) {
      expect.fail(new Error(`RED: ${cliPath} must be implemented`, { cause: error }).message);
    }
    if (!isCliModuleNamespace(moduleNamespace) || typeof moduleNamespace.runCli !== "function") {
      expect.fail("RED: src/cli.ts must export runCli(args, cwd)");
    }
    const result = await moduleNamespace.runCli(args, workspaceDir);

    // Then: the dry-run artifact is the canonical Azure surface and the process exits cleanly.
    expect(result.exitCode).toBe(0);
    const artifactRaw = await readFile(artifactPath, "utf8");
    const artifact = JSON.parse(artifactRaw) as Record<string, unknown>;
    expect(artifact["artifactPath"]).toBe("artifacts/manual/s4-azure-mocked-run.json");
    expect(artifact["postedStatusState"]).toBe("succeeded");
    expect(artifact["marker"]).toBe(REVIEW_MARKER);
  });

  it("CLI-RED-003: --platform azure --dry-run with no plumbing flags → capability-based validation accepts (exit 0, no posting required when --review absent)", async () => {
    // Capability-based validation contract: --review is the posting
    // intent signal. Without it (and without --dry-run being a kill
    // switch), no posting-side identity is required even on --platform
    // azure. The CLI produces an Azure-shaped artifact via the consumer
    // path with empty pullRequestJson/diffText defaults. This replaces
    // the pre-Task-7 expectation that any --platform azure invocation
    // without all plumbing flags should fail loudly with exit != 0.
    const args = [
      "--platform",
      "azure",
      "--dry-run",
    ];

    // When: the future CLI runs the dry-run path inside the workspace.
    let moduleNamespace: unknown;
    try {
      moduleNamespace = await import(cliModule);
    } catch (error) {
      expect.fail(new Error(`RED: ${cliPath} must be implemented`, { cause: error }).message);
    }
    if (!isCliModuleNamespace(moduleNamespace) || typeof moduleNamespace.runCli !== "function") {
      expect.fail("RED: src/cli.ts must export runCli(args, cwd)");
    }
    const result = await moduleNamespace.runCli(args, workspaceDir);

    // Then: the CLI succeeds (no posting identity required).
    expect(result.exitCode).toBe(0);
  });
});

describe("CLI dry-run env-sources wiring (effectiveConfig + secretsDetected)", () => {
  let workspaceDir = "";
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    clearEnvForRun();
    workspaceDir = await mkGithubWorkspace();
  });

  afterEach(async () => {
    clearEnvForRun();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (workspaceDir.length > 0) {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("emits an empty/null effectiveConfig and all-false secretsDetected when no UMACTUALLY_/REVIEW_ env is set", async () => {
    const artifactPath = join(workspaceDir, "artifacts", "s1-no-env.json");
    const args = [
      "--platform",
      "github",
      "--event",
      "test/fixtures/github/pull-request-event.json",
      "--diff",
      "test/fixtures/github/full-pr.diff",
      "--review",
      "test/fixtures/github/provider-review.json",
      "--dry-run",
      "--output-artifact",
      artifactPath,
    ];

    const result = await invokeRunCli(args, workspaceDir);
    expect(result.exitCode).toBe(0);

    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as Record<string, unknown>;
    expect(artifact["effectiveConfig"]).toBeDefined();
    expect(artifact["secretsDetected"]).toBeDefined();

    const effective = artifact["effectiveConfig"] as Record<string, unknown>;
    expect(effective["providerUrl"]).toBeNull();
    expect(effective["providerModel"]).toBeNull();
    expect(effective["walkthrough"]).toBeNull();

    const secrets = artifact["secretsDetected"] as Record<string, boolean>;
    expect(secrets["apiKey"]).toBe(false);
    expect(secrets["sonarToken"]).toBe(false);
    expect(secrets["githubToken"]).toBe(false);
    expect(secrets["azureToken"]).toBe(false);
  });

  it("captures UMACTUALLY_API_URL/KEY/MODEL into effectiveConfig + secretsDetected without echoing values", async () => {
    process.env["UMACTUALLY_API_URL"] = "https://vmi3298966.tailcad1ad.ts.net/v1";
    process.env["UMACTUALLY_API_KEY"] = "sk-test-key";
    process.env["UMACTUALLY_MODEL"] = "review-model-synthetic";

    const artifactPath = join(workspaceDir, "artifacts", "s1-umactually.json");
    const args = [
      "--platform",
      "github",
      "--event",
      "test/fixtures/github/pull-request-event.json",
      "--diff",
      "test/fixtures/github/full-pr.diff",
      "--review",
      "test/fixtures/github/provider-review.json",
      "--dry-run",
      "--output-artifact",
      artifactPath,
    ];

    const result = await invokeRunCli(args, workspaceDir);
    expect(result.exitCode).toBe(0);

    const artifactRaw = await readFile(artifactPath, "utf8");
    // Defense-in-depth: raw file must never contain the raw secret.
    expect(artifactRaw).not.toContain("sk-test-key");

    const artifact = JSON.parse(artifactRaw) as Record<string, unknown>;
    const effective = artifact["effectiveConfig"] as Record<string, unknown>;
    expect(effective["providerUrl"]).toBe("https://vmi3298966.tailcad1ad.ts.net/v1");
    expect(effective["providerModel"]).toBe("review-model-synthetic");

    const secrets = artifact["secretsDetected"] as Record<string, boolean>;
    expect(secrets["apiKey"]).toBe(true);
    expect(secrets["sonarToken"]).toBe(false);
  });

  it("falls back to REVIEW_* when UMACTUALLY_* is empty/absent", async () => {
    // UMACTUALLY_API_KEY is unset; REVIEW_PROVIDER_API_KEY is the fallback.
    process.env["REVIEW_PROVIDER_API_KEY"] = "sk-review-fallback";
    process.env["REVIEW_PROVIDER_URL"] = "https://fallback.example.test/v1";

    const artifactPath = join(workspaceDir, "artifacts", "s1-review-fallback.json");
    const args = [
      "--platform",
      "github",
      "--event",
      "test/fixtures/github/pull-request-event.json",
      "--diff",
      "test/fixtures/github/full-pr.diff",
      "--review",
      "test/fixtures/github/provider-review.json",
      "--dry-run",
      "--output-artifact",
      artifactPath,
    ];

    const result = await invokeRunCli(args, workspaceDir);
    expect(result.exitCode).toBe(0);

    const artifactRaw = await readFile(artifactPath, "utf8");
    expect(artifactRaw).not.toContain("sk-review-fallback");

    const artifact = JSON.parse(artifactRaw) as Record<string, unknown>;
    const effective = artifact["effectiveConfig"] as Record<string, unknown>;
    expect(effective["providerUrl"]).toBe("https://fallback.example.test/v1");
    const secrets = artifact["secretsDetected"] as Record<string, boolean>;
    expect(secrets["apiKey"]).toBe(true);
  });

  it("UMACTUALLY_* wins over REVIEW_* when both are set", async () => {
    process.env["UMACTUALLY_API_URL"] = "https://primary.example.test/v1";
    process.env["REVIEW_PROVIDER_URL"] = "https://legacy.example.test/v1";

    const artifactPath = join(workspaceDir, "artifacts", "s1-primary-wins.json");
    const args = [
      "--platform",
      "github",
      "--event",
      "test/fixtures/github/pull-request-event.json",
      "--diff",
      "test/fixtures/github/full-pr.diff",
      "--review",
      "test/fixtures/github/provider-review.json",
      "--dry-run",
      "--output-artifact",
      artifactPath,
    ];

    const result = await invokeRunCli(args, workspaceDir);
    expect(result.exitCode).toBe(0);

    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as Record<string, unknown>;
    const effective = artifact["effectiveConfig"] as Record<string, unknown>;
    expect(effective["providerUrl"]).toBe("https://primary.example.test/v1");
  });

  it("never logs the API key to stdout/stderr (no leaked secret text in process output)", async () => {
    process.env["UMACTUALLY_API_KEY"] = "sk-very-sensitive-leak-marker-12345";
    const artifactPath = join(workspaceDir, "artifacts", "s1-no-leak.json");
    const args = [
      "--platform",
      "github",
      "--event",
      "test/fixtures/github/pull-request-event.json",
      "--diff",
      "test/fixtures/github/full-pr.diff",
      "--review",
      "test/fixtures/github/provider-review.json",
      "--dry-run",
      "--output-artifact",
      artifactPath,
    ];

    // Capture stdout/stderr the way a CI runner would.
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    let stdoutBuf = "";
    let stderrBuf = "";
    const stdoutSpy = (chunk: string | Uint8Array): boolean => {
      stdoutBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    };
    const stderrSpy = (chunk: string | Uint8Array): boolean => {
      stderrBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    };
    process.stdout.write = stdoutSpy as typeof process.stdout.write;
    process.stderr.write = stderrSpy as typeof process.stderr.write;
    try {
      const result = await invokeRunCli(args, workspaceDir);
      expect(result.exitCode).toBe(0);
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }

    expect(stdoutBuf).not.toContain("sk-very-sensitive-leak-marker-12345");
    expect(stderrBuf).not.toContain("sk-very-sensitive-leak-marker-12345");
  });

  it("--dry-run writes the standalone artifact and announces it on stdout with the brand prefix", async () => {
    // S2 contract: standalone --dry-run writes the artifact AND prints
    // `umactually: dry-run wrote <path>` so a brand-new operator
    // can see the outcome instead of staring at a silent success.
    const artifactPath = join(workspaceDir, "artifacts", "s1-stdout-banner.json");
    const args = [
      "--platform",
      "github",
      "--event",
      "test/fixtures/github/pull-request-event.json",
      "--diff",
      "test/fixtures/github/full-pr.diff",
      "--review",
      "test/fixtures/github/provider-review.json",
      "--dry-run",
      "--output-artifact",
      artifactPath,
    ];

    // Capture stdout/stderr the way a CI runner would.
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    let stdoutBuf = "";
    let stderrBuf = "";
    const stdoutSpy = (chunk: string | Uint8Array): boolean => {
      stdoutBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    };
    const stderrSpy = (chunk: string | Uint8Array): boolean => {
      stderrBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    };
    process.stdout.write = stdoutSpy as typeof process.stdout.write;
    process.stderr.write = stderrSpy as typeof process.stderr.write;

    // Direct import + runCli call (matches the existing RED-contract pattern
    // at the top of this file rather than the invokeRunCli helper).
    let moduleNamespace: unknown;
    try {
      moduleNamespace = await import(cliModule);
    } catch (error) {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      expect.fail(new Error(`RED: ${cliPath} must be implemented`, { cause: error }).message);
    }
    if (!isCliModuleNamespace(moduleNamespace) || typeof moduleNamespace.runCli !== "function") {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      expect.fail("RED: src/cli.ts must export runCli(args, cwd)");
    }

    let exitCode: number;
    try {
      const result = await moduleNamespace.runCli(args, workspaceDir);
      exitCode = result.exitCode;
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }

    expect(exitCode).toBe(0);
    expect(stdoutBuf).toContain("umactually: dry-run wrote");
    expect(stdoutBuf).toContain(artifactPath);
  });
});

describe("CLI prompt-gate: interactive prompts are opt-in (UX regression guard)", () => {
  // After install, running bare `umactually` on a TTY should NOT
  // freeze for stdin — the old always-prompt behavior caused
  // `curl | sh` smoke-tests to hang. The gate requires explicit
  // `UMACTUALLY_INTERACTIVE=1`. These tests lock the contract down.

  /** Override process.stdin.isTTY so canPromptInteractively() returns
   * the requested value, then restore on teardown. */
  let restoreTty: (() => void) | null = null;
  function withFakeTty(enabled: boolean): () => void {
    const stdinObj = process.stdin as unknown as { isTTY: boolean };
    const stdoutObj = process.stdout as unknown as { isTTY: boolean };
    const prevStdin = stdinObj.isTTY;
    const prevStdout = stdoutObj.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: enabled, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: enabled, configurable: true });
    return () => {
      Object.defineProperty(process.stdin, "isTTY", { value: prevStdin, configurable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: prevStdout, configurable: true });
    };
  }
  afterEach(() => { if (restoreTty) restoreTty(); restoreTty = null; });

  it("bare invocation with no env returns exit 2 without ever attempting a stdin read", async () => {
    // Gate is closed by default — even with a real TTY, opt-in
    // via UMACTUALLY_INTERACTIVE=1 is required. Test that the
    // gate stays closed.
    restoreTty = withFakeTty(true);
    const cwd = await mkTempDir("umactually-cli-prompt-gate-bare-");
    const result = await invokeRunCli([], cwd);
    expect(result.exitCode).toBe(2);
  });

  it("UMACTUALLY_INTERACTIVE=1 with a TTY opens the gate (smart-prompt is invoked)", async () => {
    // Distinct from the bare case above: with the gate open, the
    // smart-prompt path runs. Spy on the prompt function so this
    // test fails when the gate is broken (e.g. a future revert
    // turns it back on for TTY by default). The spy returns empty
    // values so the post-prompt re-validation fails and exits 2.
    restoreTty = withFakeTty(true);
    const previous = process.env["UMACTUALLY_INTERACTIVE"];
    process.env["UMACTUALLY_INTERACTIVE"] = "1";
    const smartPromptModule = "../../src/cli/smart-prompt.js";
    const spy = vi.fn().mockResolvedValue({ apiUrl: null, apiKey: null });
    let restoreSpy: (() => void) | null = null;
    try {
      const mod = await import(smartPromptModule);
      vi.spyOn(mod, "smartPromptForApiConfig").mockImplementation(spy);
      restoreSpy = () => {
        // ESM module exports are read-only; vi restores via the spy itself.
        (mod.smartPromptForApiConfig as ReturnType<typeof vi.spyOn>).mockRestore();
      };
      const cwd = await mkTempDir("umactually-cli-prompt-gate-with-flag-");
      const result = await invokeRunCli([], cwd);
      expect(result.exitCode).toBe(2);
      // Spy invoked at least once — proves the gate opened.
      expect(spy).toHaveBeenCalled();
    } finally {
      if (restoreSpy) restoreSpy();
      if (previous === undefined) {
        delete process.env["UMACTUALLY_INTERACTIVE"];
      } else {
        process.env["UMACTUALLY_INTERACTIVE"] = previous;
      }
    }
  });
});

async function invokeRunCli(args: readonly string[], cwd: string): Promise<{ readonly exitCode: number }> {
  let moduleNamespace: unknown;
  try {
    moduleNamespace = await import(cliModule);
  } catch (error) {
    expect.fail(new Error(`${cliPath} must be implemented`, { cause: error }).message);
  }
  if (!isCliModuleNamespace(moduleNamespace) || typeof moduleNamespace.runCli !== "function") {
    expect.fail(`${cliPath} must export runCli(args, cwd)`);
  }
  return moduleNamespace.runCli(args, cwd);
}

async function mkGithubWorkspace(): Promise<string> {
  const base = await mkTempDir("umactually-cli-env-");
  const fixturesDir = join(base, "test", "fixtures", "github");
  await mkdir(fixturesDir, { recursive: true });
  // Minimal valid pull-request event payload.
  const event = JSON.stringify({
    number: 42,
    repository: { full_name: "example/umactually-fixture" },
    pull_request: {
      number: 42,
      title: "Improve review rendering",
      draft: false,
      base: { sha: "0000000000000000000000000000000000000001", ref: "main" },
      head: { sha: "0000000000000000000000000000000000000002", ref: "feature/red-contracts" },
    },
    action: "opened",
  });
  // Minimal valid provider review JSON.
  const review = JSON.stringify({
    summary: "fixture",
    verdict: "NEEDS_FIX",
    comments: [
      {
        path: "src/review/example.ts",
        line: 3,
        side: "RIGHT",
        severity: "high",
        category: "security",
        status: "post",
        body: "fixture comment",
      },
    ],
    suppressed_comments: [],
  });
  // Minimal valid diff containing the path/line referenced above.
  const diff = [
    "diff --git a/src/review/example.ts b/src/review/example.ts",
    "index 1111111..2222222 100644",
    "--- a/src/review/example.ts",
    "+++ b/src/review/example.ts",
    "@@ -1,4 +1,7 @@",
    " export function renderReview(): string {",
    "-  return \"old\";",
    "+  const syntheticSecret = \"sk_test_synthetic_fixture_value_do_not_use\";",
    "+  return `new ${syntheticSecret}`;",
    " }",
    "+",
    "+export const changedLine = true;",
    "",
  ].join("\n");
  await writeFile(join(fixturesDir, "pull-request-event.json"), event, "utf8");
  await writeFile(join(fixturesDir, "provider-review.json"), review, "utf8");
  await writeFile(join(fixturesDir, "full-pr.diff"), diff, "utf8");
  return base;
}

async function mkTempDir(prefix: string): Promise<string> {
  const dir = join(
    tmpdir(),
    `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(dir, { recursive: true });
  return dir;
}