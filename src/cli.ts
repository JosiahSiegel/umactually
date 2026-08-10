import { readFileSync, realpathSync, writeFileSync, writeSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { CliHelpSignal, CliUsageError, parseCliArgs, type ParsedCliArgs } from "./cli/parse-args.js";
import { dispatch as dispatchSubcommand } from "./cli/dispatch.js";
import { resolveHelpText } from "./cli/help.js";
import { CLI_MODES_TEXT } from "./cli/modes-help.js";
import { dispatchLive, runDryRun, type CliRunResult } from "./cli/run.js";
import { runLocalFilesReview, type LocalFilesRunResult } from "./cli/local-files-run.js";
import { isStandaloneMode, runStandalone } from "./cli/standalone-run.js";
import { canPromptInteractively, smartPromptForApiConfig } from "./cli/smart-prompt.js";
import { collectValidationErrors, type ValidationError, resolvePlatform } from "./cli/validate.js";
import { deriveContextFromGit } from "./cli/auto-context.js";
import {
  resolveFromSchema,
  type FieldProvenanceMap,
  type SchemaResolvedCliArgs,
} from "./config/field-resolution.js";
import { tryReadSavedConfig } from "./cli/load-saved-config.js";
import { applySavedConfig } from "./cli/apply-saved-config.js";
import { BRAND_PREFIX } from "./util/brand.js";
import { formatError } from "./util/error.js";
import { pathToFileUrl } from "./util/url.js";

declare global {
  // Cross-module flag set by the action entry to suppress this module's
  // auto-invoke when both modules are concatenated into dist/index.js.
  var __umactually_action_entry__: boolean | undefined;
}

export type { CliRunResult } from "./cli/run.js";
export type { ParsedCliArgs, CliPlatform } from "./cli/parse-args.js";
export { parseCliArgs, CliUsageError };

/**
 * Read the package version.
 *
 * In normal (Node) usage, reads `package.json` via `import.meta.url`.
 * In Bun --compile standalone binaries, `import.meta.url` resolves to
 * Bun's virtual `/$bunfs/` and no real `package.json` exists. The
 * binary is compiled with `--define UMACTUALLY_VERSION='"<version>"'`
 * so the version is embedded at compile time.
 *
 * The v0.6.0 distribution pipeline uses tsdown + Node SEA instead of
 * Bun --compile, but the substitution mechanism is the same: tsdown's
 * `define` config (see tsdown.config.ts) maps `UMACTUALLY_VERSION` to
 * the package version JSON, and rolldown replaces the bare identifier
 * at bundle time. The bare-reference check below is therefore the
 * single source of truth — both the Bun --define path and the
 * tsdown `define` path land at this same typeof check.
 */
function readPackageVersion(): string {
  // Bun --compile injects this via --define. tsdown's `define` config
  // (in tsdown.config.ts) does the same via rolldown. The bare
  // identifier is replaced at compile time — using
  // globalThis["UMACTUALLY_VERSION"] would NOT be replaced because
  // --define / rolldown's define only match bare references.
  if (typeof UMACTUALLY_VERSION === "string" && UMACTUALLY_VERSION.length > 0) {
    return UMACTUALLY_VERSION;
  }
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const raw = readFileSync(packageJsonUrl, "utf8");
  const parsed = JSON.parse(raw) as { readonly version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("package.json is missing a string `version` field");
  }
  return parsed.version;
}

/**
 * Detect `--version` / `-V` anywhere in `argv`. Per GNU conventions, the
 * flag can appear in any position (e.g. `umactually --version`,
 * `umactually --api-url X --version`). The check is intentionally
 * whitespace-only — short flags like `-Vfoo` are not matched.
 */
export function isVersionFlag(argv: readonly string[]): boolean {
  for (const arg of argv) {
    if (arg === "--version" || arg === "-V") {
      return true;
    }
  }
  return false;
}

/**
 * Stage 0: print package version and signal exit 0.
 *
 * Returns BEFORE parse / env-resolution / git-derive / validation /
 * standalone-run / dispatch. This guarantees `--version` works in any
 * context (no `--api-key`, no git repo, no env vars) without touching
 * any artifacts or downstream stage. The output is plain
 * `${version}\n` on stdout — no brand prefix, no banner, no colour —
 * to match the contract pinned by CLI-VERSION-001.
 */
export function runVersion(_argv: readonly string[]): { readonly exitCode: 0; readonly stdout: string } {
  const version = readPackageVersion();
  const stdout = `${version}\n`;
  // Single canonical write path: writeFileSync(process.stdout.fd, stdout).
  //
  // Why synchronous: under a Node SEA binary, `process.stdout.write` is
  // stream-buffered; the auto-invoke resolves the main() promise and
  // sets process.exitCode, but the buffered write may be torn down
  // before the underlying pipe drain completes — and this race is
  // platform-dependent (Linux lands the write before teardown; macOS
  // and Windows occasionally lose it). The synchronous writeFileSync
  // call performs a single blocking write(2) syscall on the supplied
  // fd, which goes to the kernel pipe buffer before runVersion
  // returns. The parent shell's `$(umactually --version)` capture
  // reads from that kernel buffer and is non-empty on every platform.
  //
  // Why a string here, not Buffer.from(stdout): empirically (and
  // verified by the v0.6.0 → v0.6.2 regression cycle) `writeFileSync(
  // fd, string)` works on Windows in a Node SEA binary, but
  // `writeFileSync(fd, Buffer.from(string))` produces an empty
  // captured stdout in the same harness. The Node typings accept both,
  // and on Linux / macOS the Buffer form works fine, so the
  // difference is Windows-specific (likely a text-mode-vs-binary-mode
  // fd handling quirk in Node's writeFileSync polyfill on Windows).
  // The version string is ASCII-only so the theoretical
  // non-ASCII-corruption concern doesn't apply.
  //
  // Fallback: if the fd-based write fails, fall back to
  // process.stdout.write. We swallow the error because the fallback
  // is best-effort (if BOTH paths fail, the user gets an empty
  // --version output, which is no worse than the pre-fix behavior).
  // The fallback path is exercised by cli-version.test.ts's "falls
  // back to process.stdout.write when writeFileSync throws EBADF"
  // case.
  //
  // v0.6.5: tiered fallback. Each path is reliable in some
  // configuration and unreliable in others; we cascade through
  // them until one succeeds.
  //
  //   tier 1 — writeFileSync(process.stdout.fd, stdout) (the v0.6.0
  //   path). Lands the bytes synchronously into the kernel pipe
  //   buffer in the install.ps1 cmd /c harness on Windows AND in
  //   the PowerShell Start-Process harness.
  //
  //   tier 2 — writeSync(1, stdout). Bypasses Node's process.stdout
  //   layer; writes to the raw file descriptor 1. Reliable when
  //   fd 1 is a real pipe (e.g. when the binary is spawned by bash
  //   + child_process.spawn on Windows-latest in the post-release
  //   e2e harness, where process.stdout.fd maps to a CONOUT$
  //   handle rather than the consumer's pipe and tier 1 silently
  //   loses the output).
  //
  //   tier 3 — process.stdout.write(stdout). The high-level Node
  //   stream path. Stream-buffered; can be torn down before drain
  //   in some spawn configurations. Last-resort fallback.
  //
  // We track which tier succeeded (or succeeded first) so we
  // don't duplicate the version string at the consumer. The test
  // suite's "falls back to process.stdout.write when writeFileSync
  // throws EBADF" test pins this contract.
  //
  // Tier 0 (highest priority): if the consumer set
  // UMACTUALLY_VERSION_FILE, write the version to that file
  // BEFORE the stdout tiers. This is the bypass for the Windows
  // + Git Bash + Node 25.6.0 SEA case where the SEA runtime's
  // stdio model doesn't respect the spawn's stdio: "pipe" or
  // stdio: "file" config — fd 1 is mapped to a CONOUT$ handle
  // and every writeFileSync(fd 1, ...)/writeSync(1, ...) silently
  // loses the output. The harness uses this env var to ask the
  // binary to write the version to a known file path, which
  // works on every platform (it's just a regular file write,
  // not stdio).
  const versionFile = process.env["UMACTUALLY_VERSION_FILE"];
  if (versionFile) {
    try {
      writeFileSync(versionFile, stdout);
      // Don't `return early` — still attempt the stdout tiers
      // so consumers that don't use the env var get the same
      // behavior as before. The env-var file is a bypass, not
      // a replacement.
    } catch {
      // Tier 0 is best-effort. If the file write fails, the
      // stdout tiers below still run.
    }
  }
  // Tier 0b (opt-in): if the consumer set
  // UMACTUALLY_VERSION_TO_STDERR, write the version to stderr
  // via process.stderr.write. On Windows + Git Bash + Node
  // 25.6.0 SEA, the SEA runtime's stdio model maps fd 1 (stdout)
  // to a CONOUT$ handle but leaves fd 2 (stderr) connected to
  // the consumer's pipe. This is why the SEA warning (which
  // uses process.stderr.write) reaches the consumer but the
  // version (which uses writeFileSync(process.stdout.fd, ...) in
  // tier 1) does not. Writing the version to stderr via the
  // stream API (not writeFileSync) guarantees the bytes land in
  // the consumer's stderr pipe on Windows + CONOUT$. The write
  // is opt-in via the env var so the `--version` contract
  // (writes nothing to stderr) is preserved for normal
  // consumers. The harness sets the env var explicitly.
  // We use a distinctive marker prefix so consumers can grep
  // for the version pattern (after stripping the marker) without
  // false-matches on the SEA warning or other stderr noise.
  if (process.env["UMACTUALLY_VERSION_TO_STDERR"] === "1") {
    try {
      process.stderr.write(`umactually-version:${stdout}`);
    } catch {
      // stderr write failed; not fatal
    }
  }
  //
  // Caveat: tier 1 and tier 2 can SILENTLY succeed without
  // throwing while still NOT landing the bytes in the consumer's
  // pipe (Windows CONOUT$ handles, for example, accept the write
  // but the consumer reads from a different handle). We can't
  // detect this from inside the binary — the only signal is at the
  // consumer. The "fall forward" design (always try the next tier
  // even if the previous one did NOT throw) would risk
  // duplicating the output; instead we trust the "threw" signal
  // and accept the small risk of a silent no-op in the CONOUT$
  // edge case. The contract test
  // (cli-version.test.ts > "falls back to process.stdout.write
  // when writeFileSync throws EBADF") pins the throw-based
  // cascade.
  let written = false;
  try {
    writeFileSync(process.stdout.fd, stdout);
    written = true;
  } catch {
    // tier 1 unavailable
  }
  if (!written) {
    try {
      writeSync(1, stdout);
      written = true;
    } catch {
      // tier 2 unavailable
    }
  }
  if (!written) {
    // tier 3 — best effort, no error if it fails. Attach a one-shot
    // 'error' listener to the stream so an early-close / broken-pipe
    // error does not propagate as an unhandled 'error' event (which
    // would crash the SEA binary with an uncaughtException). The
    // error case is logged as a `notice` so the operator sees the
    // diagnostic in the GitHub Actions log without it surfacing as
    // a check annotation.
    const stdoutStream = process.stdout as NodeJS.WriteStream & {
      once(event: "error", listener: (err: Error) => void): unknown;
    };
    let tier3Error: Error | null = null;
    stdoutStream.once("error", (err: Error) => {
      tier3Error = err;
    });
    const accepted = process.stdout.write(stdout);
    if (!accepted) {
      // Backpressure. We don't need to drain synchronously here
      // because runVersion returns and the auto-invoke will exit
      // the process, which flushes the stream. The 'error' listener
      // above catches the worst-case early-close case.
      void process.stdout.once?.("drain", () => undefined);
    }
    if (tier3Error === null) {
      written = true;
    }
  }
  return { exitCode: 0, stdout };
}

/**
 * Resolved CLI arguments after the parse → resolve-context stage. The
 * same as `ParsedCliArgs` but the strings and paths that the operator
 * did NOT supply have been filled in from the cwd's git repository
 * (when applicable). Identity fields remain `null` when unparseable.
 */
export type ResolvedCliArgs = SchemaResolvedCliArgs;

export type SanitizedResolvedConfig = {
  readonly platform: ResolvedCliArgs["platform"];
  readonly dryRun: boolean;
  readonly provider: ResolvedCliArgs["provider"];
  readonly model: string | null;
  readonly effort: ResolvedCliArgs["effort"];
  readonly prNumber: string | null;
  readonly repo: string | null;
  readonly githubApiBase: string | null;
  readonly sonarHostUrl: string | null;
  readonly sonarProjectKey: string | null;
  readonly sonarTimeoutSeconds: number | null;
  readonly reviewTimeoutSeconds: number | null;
  readonly stallSeconds: number | null;
  readonly perRequestTimeoutSeconds: number | null;
  readonly maxOutputTokens: number | null;
  readonly maxComments: number | null;
  readonly reviewFileLimit: number | null;
  readonly minimumSeverity: ResolvedCliArgs["minimumSeverity"];
  readonly strictSchema: boolean;
  readonly verifyFindings: boolean;
  readonly walkthrough: boolean;
  readonly diagnostic: boolean;
  readonly debugRawResponse: boolean;
  readonly simulateFindings: boolean;
  readonly detectLeaks: boolean;
  readonly includeSonarqube: boolean;
  readonly instructionFiles: boolean;
  readonly apiUrlPresent: boolean;
  readonly apiKeyPresent: boolean;
  readonly filesPresent: boolean;
  readonly sonarTokenPresent: boolean;
  readonly promptFilePresent: boolean;
  readonly promptFilesPresent: boolean;
  readonly additionalPromptFilePresent: boolean;
  readonly additionalPromptFilesPresent: boolean;
  readonly promptPresent: boolean;
  readonly additionalPromptPresent: boolean;
  readonly sources: FieldProvenanceMap;
};

export function buildSanitizedResolvedConfig(
  resolved: ResolvedCliArgs,
): SanitizedResolvedConfig {
  return {
    platform: resolved.platform,
    dryRun: resolved.dryRun,
    provider: resolved.provider,
    model: resolved.model,
    effort: resolved.effort,
    prNumber: resolved.prNumber,
    repo: resolved.repo,
    githubApiBase: resolved.githubApiBase,
    sonarHostUrl: resolved.sonarHostUrl,
    sonarProjectKey: resolved.sonarProjectKey,
    sonarTimeoutSeconds: resolved.sonarTimeoutSeconds,
    reviewTimeoutSeconds: resolved.reviewTimeoutSeconds,
    stallSeconds: resolved.stallSeconds,
    perRequestTimeoutSeconds: resolved.perRequestTimeoutSeconds,
    maxOutputTokens: resolved.maxOutputTokens,
    maxComments: resolved.maxComments,
    reviewFileLimit: resolved.reviewFileLimit,
    minimumSeverity: resolved.minimumSeverity,
    strictSchema: resolved.strictSchema,
    verifyFindings: resolved.verifyFindings,
    walkthrough: resolved.walkthrough,
    diagnostic: resolved.diagnostic,
    debugRawResponse: resolved.debugRawResponse,
    simulateFindings: resolved.simulateFindings,
    detectLeaks: resolved.detectLeaks,
    includeSonarqube: resolved.includeSonarqube,
    instructionFiles: resolved["instructionFiles"] as boolean,
    apiUrlPresent: resolved.apiUrl !== null && resolved.apiUrl.length > 0,
    apiKeyPresent: resolved.apiKey !== null && resolved.apiKey.length > 0,
    filesPresent: resolved.files !== null && resolved.files.length > 0,
    sonarTokenPresent: resolved.sonarToken !== null && resolved.sonarToken.length > 0,
    promptFilePresent: resolved.promptFile !== null && resolved.promptFile.length > 0,
    promptFilesPresent: resolved.promptFiles !== null && resolved.promptFiles.length > 0,
    additionalPromptFilePresent: resolved.additionalPromptFile !== null && resolved.additionalPromptFile.length > 0,
    additionalPromptFilesPresent: resolved.additionalPromptFiles !== null && resolved.additionalPromptFiles.length > 0,
    promptPresent: resolved.prompt !== null && resolved.prompt.length > 0,
    additionalPromptPresent: resolved.additionalPrompt !== null && resolved.additionalPrompt.length > 0,
    sources: resolved.fieldProvenance,
  };
}

/**
 * Resolve missing CLI flags by consulting the cwd's git repository.
 *
 * Explicit operator-supplied values win over derived values (the GitHub
 * Action and Azure DevOps pipeline pass every flag explicitly; their
 * values must reach the consumers verbatim). For each field, we keep
 * `parsed.X` if non-null; otherwise we consult `deriveContextFromGit`
 * and substitute the derived value.
 *
 * Git auto-context is a standalone-local fallback only. Live GitHub Actions
 * and Azure Pipelines runs already resolve platform context in the
 * orchestration layer, so the presence of either CI marker bypasses this
 * filesystem-writing stage entirely.
 */
function resolveContext(
  parsed: ResolvedCliArgs,
  cwd: string,
  env: NodeJS.ProcessEnv,
): {
  readonly resolved: ResolvedCliArgs;
  readonly generatedArtifacts: readonly string[];
} {
  // If every plumbing field is already supplied, there's nothing to do.
  // This is the wrapper-runtime case (GH Action / ADO pipeline).
  const plumbingFlags = [parsed.eventPath, parsed.diffPath] as const;
  const allPlumbingSupplied = plumbingFlags.every((v) => v !== null);
  const shouldDeriveFromGit =
    env["GITHUB_ACTIONS"] === undefined && env["TF_BUILD"] === undefined;

  let resolved = parsed;
  let generated: string[] = [];

  if (shouldDeriveFromGit && !allPlumbingSupplied && parsed.files === null) {
    // Try to derive. If cwd is not a git repo, deriveContextFromGit
    // returns null and we keep parsed unchanged (the original "missing
    // plumbing field" error path will surface downstream with a clearer
    // message than the current cli.ts).
    const effectiveBase = "";
    try {
      const ctx = deriveContextFromGit({
        cwd,
        base: effectiveBase,
        diffOverride: parsed.diffPath,
        eventOverride: parsed.eventPath,
      });
      if (ctx !== null) {
        // Explicit-value precedence: explicit nulls are NOT overridden.
        // Only fill in when the operator-supplied value is null.
        const merged: ResolvedCliArgs = {
          ...parsed,
          eventPath: parsed.eventPath ?? ctx.eventPath,
          diffPath: parsed.diffPath ?? ctx.diffPath,
        };
        resolved = merged;
        generated = [ctx.diffPath, ctx.eventPath].filter(
          (p) => p !== parsed.diffPath && p !== parsed.eventPath,
        );
      }
    } catch {
      // Auto-derive itself failed (e.g. not a git repo); keep parsed
      // and let the validator surface a clear "missing flags" error.
    }
  }

  return { resolved, generatedArtifacts: generated };
}

async function cleanupGeneratedArtifacts(
  generatedArtifacts: readonly string[],
  cwd: string,
): Promise<void> {
  if (generatedArtifacts.length === 0) {
    return;
  }

  const tempDir = join(cwd, ".umactually-auto-ctx");
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    process.stderr.write(
      `cli: failed to clean generated artifacts at ${tempDir}: ${formatError(error)}\n`,
    );
  }
}

export type CliExecutionResult = CliRunResult & {
  readonly resolvedConfig?: SanitizedResolvedConfig;
};

function renderValidationErrors(errors: readonly ValidationError[]): string {
  return errors
    .map((error) => `cli: ${error.message}\n  hint: ${error.hint}`)
    .join("\n") + "\n";
}

export async function runCli(args: readonly string[], cwd: string): Promise<CliExecutionResult> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    if (error instanceof CliHelpSignal) {
      // Use the command context from the signal (if set) to resolve
      // the appropriate help text, falling back to top-level help.
      const helpArgv = error.command !== null ? [error.command, "--help"] : ["--help"];
      process.stdout.write(resolveHelpText(helpArgv));
      return { exitCode: 0 };
    }
    if (error instanceof CliUsageError && error.hint !== undefined) {
      // Surface the parse-time remediation hint next to the usage
      // error so the operator sees exactly what to try instead of a
      // bare "unknown flag: --foo" or "flag requires a value". The
      // CLI exits with code 2 (UsageError convention) AFTER the hint
      // is printed; machines grep'ing for `cli: <msg>` find the
      // legacy line; humans grep'ing for `hint:` find the remediation.
      process.stderr.write(`cli: ${error.message}\n  hint: ${error.hint}\n`);
      return { exitCode: 2 };
    }
    throw error;
  }

  // Stage 2: schema-driven env fallbacks and type coercion before validation.
  const envResolved = resolveFromSchema(parsed, process.env);

  // Stage 2.5: saved-config defaults. Reads `~/.umactually/config.json`
  // (or `<cwd>/umactually.config.json` when present) and overrides any
  // field whose current source is the schema default. Flag > env > saved
  // > default. The apiKey NEVER participates in saved config (S6
  // contract: credentials are not persisted to disk) — it resolves via
  // --api-key > UMACTUALLY_API_KEY env > the existing `--api-key is
  // required` validation error.
  //
  // A malformed config file is tolerated (the runtime path is
  // fall-through to defaults) but the warning is surfaced to stderr
  // so the operator can `cat` the file and decide whether to re-run
  // `umactually init` or `rm` it.
  const savedRead = tryReadSavedConfig({ cwd });
  if (savedRead.warning !== null) {
    process.stderr.write(`umactually: ${savedRead.warning}\n`);
  }
  const { resolved: savedResolved } = applySavedConfig(
    envResolved,
    savedRead.config,
    savedRead.path,
  );

  // Stage 3: resolve missing flags from cwd (when applicable).
  const { resolved, generatedArtifacts } = resolveContext(
    savedResolved,
    cwd,
    process.env,
  );

  try {
    // Stage 4: validate the resolved (post-derivation) args.
    let errors = collectValidationErrors(resolved);
    // Smart-prompt safety net: when validation fails ONLY because the
    // operator forgot `--api-url` / `--api-key`, and we're attached to
    // a TTY (NOT a CI / piped stdin), offer to ask for the values
    // interactively. This rescues the operator from a frustrating
    // "run command → fail → re-read docs → re-run with secret" loop
    // in local development.
    //
    // The interactive prompt is opt-in: set UMACTUALLY_INTERACTIVE=1.
    // The old default (prompt on any TTY) froze the install smoke-test
    // waiting for stdin that never came.
    if (
      errors.length > 0 &&
      canPromptInteractively() &&
      !resolved.dryRun &&
      everyErrorIsApiConfig(errors) &&
      process.env["UMACTUALLY_NO_INTERACTIVE"] === undefined &&
      process.env["UMACTUALLY_INTERACTIVE"] === "1"
    ) {
      const promptForUrl = errors.some((e) => e.flag === "--api-url");
      const prompted = await smartPromptForApiConfig({ promptForUrl });
      // SchemaResolvedCliArgs extends ParsedCliArgs, so the same
      // applyPromptedConfig helper works on both.
      const augmented = applyPromptedConfig(resolved as unknown as ParsedCliArgs, prompted);
      errors = collectValidationErrors(augmented);
      if (errors.length === 0) {
        // Validation now passes — re-resolve and proceed without
        // printing the bare-invocation modes banner (the operator
        // clearly knows the standalone shape; they just needed
        // credentials).
        process.stdout.write(`${BRAND_PREFIX}received credentials from interactive prompt; continuing.\n`);
        return await runAfterValidation({
          resolved: augmented as unknown as ResolvedCliArgs,
          cwd,
          env: process.env,
          generatedArtifacts,
        });
      }
      // Some required values still missing after the prompt. Re-render
      // the structured errors below so the operator sees what's still
      // outstanding. Falls through to the standard error path.
      process.stderr.write(renderValidationErrors(errors));
      return {
        exitCode: 2,
        resolvedConfig: buildSanitizedResolvedConfig(augmented as unknown as ResolvedCliArgs),
      };
    }
    if (errors.length > 0) {
      process.stderr.write(renderValidationErrors(errors));
      // Bare-invocation banner: when the operator ran the CLI with no
      // provider flags AND validation rejected because of missing
      // --api-url/--api-key, the actionable next step is "pick a mode"
      // rather than reading --help. Print the modes banner so the
      // user can copy-paste the right invocation.
      if (
        args.length === 0 &&
        !envResolved.dryRun &&
        errors.some((e) => e.flag === "--api-url" || e.flag === "--api-key")
      ) {
        process.stderr.write(`\n${BRAND_PREFIX}pick a mode:\n\n${CLI_MODES_TEXT}`);
      }
      return {
        exitCode: 2,
        resolvedConfig: buildSanitizedResolvedConfig(resolved),
      };
    }

    return await runAfterValidation({
      resolved,
      cwd,
      env: process.env,
      generatedArtifacts,
    });
  } finally {
    await cleanupGeneratedArtifacts(generatedArtifacts, cwd);
  }
}

/**
 * Dispatch the post-validation run path. Extracted so the smart-prompt
 * branch can call into the same code without duplicating the standalone
 * vs. live vs. dry-run routing logic. Pure orchestration: returns a
 * `CliExecutionResult` with `exitCode` and the sanitized resolved
 * config so callers can inspect what the operator actually provided.
 */
async function runAfterValidation(input: {
  readonly resolved: ResolvedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly generatedArtifacts: readonly string[];
}): Promise<CliExecutionResult> {
  const { resolved, cwd, env } = input;
  if (resolved.files !== null) {
    const result: LocalFilesRunResult = await runLocalFilesReview({
      parsed: resolved,
      cwd,
      env,
      ...(resolved.outputArtifact !== null ? { overrideArtifactPath: resolved.outputArtifact } : {}),
    });
    switch (result.kind) {
      case "ok":
        return {
          exitCode: 0,
          resolvedConfig: buildSanitizedResolvedConfig(resolved),
        };
      case "ok-no-files":
        process.stdout.write(`${BRAND_PREFIX}${result.note}\n`);
        return {
          exitCode: 0,
          resolvedConfig: buildSanitizedResolvedConfig(resolved),
        };
      case "provider-error": {
        const hintLine = result.hint === undefined ? "" : `\n${BRAND_PREFIX}hint: ${result.hint}`;
        process.stdout.write(`${result.sanitizedForLog}${hintLine}\n`);
        return {
          exitCode: 1,
          resolvedConfig: buildSanitizedResolvedConfig(resolved),
        };
      }
      default: {
        // Exhaustiveness guard: if runLocalFilesReview adds a new
        // LocalFilesRunResult variant, this assignment fails to
        // compile, forcing the dispatcher to handle it explicitly.
        const _exhaustive: never = result;
        throw new Error(`unhandled local-files run result: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  if (!resolved.dryRun && isStandaloneMode(env)) {
    const result = await runStandalone({ parsed: resolved, cwd, env });
    if (result.kind === "provider-error") {
      const hintLine =
        "hint" in result && typeof result.hint === "string"
          ? `\n${BRAND_PREFIX}hint: ${result.hint}`
          : "";
      process.stdout.write(`${result.sanitizedForLog}${hintLine}\n`);
      return {
        exitCode: 1,
        resolvedConfig: buildSanitizedResolvedConfig(resolved),
      };
    }
    return {
      exitCode: 0,
      resolvedConfig: buildSanitizedResolvedConfig(resolved),
    };
  }

  const result = resolved.dryRun
    ? await runDryRun(resolved, cwd, resolvePlatform(resolved.platform))
    : await dispatchLive(resolved, cwd, env);
  return {
    ...result,
    resolvedConfig: buildSanitizedResolvedConfig(resolved),
  };
}

/**
 * Returns true when every validation error in the list refers to one of
 * the API-config flags (`--api-url`, `--api-key`). Used to gate the
 * smart-prompt branch so we only offer an interactive credential prompt
 * when the operator's actual failure is "you forgot to provide the
 * model provider config".
 */
function everyErrorIsApiConfig(errors: readonly ValidationError[]): boolean {
  return errors.every((e) => e.flag === "--api-url" || e.flag === "--api-key");
}

/**
 * Apply the prompted values to the resolved parsed CLI args. Returns a
 * new {@link ParsedCliArgs} with `apiUrl` / `apiKey` replaced when the
 * smart prompt returned a non-null value. The replacement is additive
 * only — already-populated fields are NOT overwritten, so a CLI flag
 * that was set before the prompt takes precedence over the prompt's
 * answer. Missing values (null) keep their null state.
 */
function applyPromptedConfig(
  resolved: ParsedCliArgs,
  prompted: { readonly apiUrl: string | null; readonly apiKey: string | null },
): ParsedCliArgs {
  const nextApiUrl = prompted.apiUrl !== null && (resolved.apiUrl === null || resolved.apiUrl.length === 0)
    ? prompted.apiUrl
    : resolved.apiUrl;
  const nextApiKey = prompted.apiKey !== null && (resolved.apiKey === null || resolved.apiKey.length === 0)
    ? prompted.apiKey
    : resolved.apiKey;
  return {
    ...resolved,
    apiUrl: nextApiUrl,
    apiKey: nextApiKey,
  };
}

export async function main(argv: readonly string[]): Promise<number> {
  try {
    const result = await dispatchSubcommand(argv);
    return result.exitCode;
  } catch (error) {
    if (error instanceof CliUsageError) {
      // Surface the hint (when present) on a separate `hint:` line so
      // the operator sees actionable remediation alongside the bare
      // usage error. Print message first to preserve the legacy
      // `cli: <msg>` byte shape that tests + log scrapers grep for.
      const hintLine = error.hint === undefined ? "" : `\n  hint: ${error.hint}`;
      process.stderr.write(`cli: ${error.message}${hintLine}\n`);
      return 2;
    }
    process.stderr.write(`cli: unexpected error: ${formatError(error)}\n`);
    return 1;
  }
}

// Only auto-invoke `main` when this module is the canonical CLI entry
// (`dist/cli.js`). The action entry (`dist/index.js`) bundles this module too,
// so `process.argv[1]` will equal `import.meta.url` for both bundles. We
// differentiate by the script basename: `cli.js` vs anything else.
//
// The action entry sets `globalThis.__umactually_action_entry__` to `true`
// before reaching this module; that flag short-circuits the auto-invoke so the
// action entry's own `src_main()` is the sole runtime, even though both
// modules are concatenated into the same bundle.

/**
 * True when the action entry (`dist/index.js`) is the runtime. The flag
 * is set by the action entry's bundle before this module loads; returning
 * true here short-circuits the auto-invoke so the action entry's own
 * `src_main()` is the sole main() caller.
 */
function isActionEntryPresent(): boolean {
  return globalThis.__umactually_action_entry__ === true;
}

/**
 * True when the bundle is running as a Node Single Executable Application
 * (post `node --build-sea`). `process.versions.sea` is the embedded Node
 * version on a SEA binary (a string like "1.0.0") and undefined elsewhere.
 * Without this short-circuit, the post-release e2e harness on Windows sees
 * the binary exit 0 with no stdout, because the URL match below silently
 * misses the Windows 8.3 short path argv1 takes in that harness.
 */
function isProcessSeaBinary(): boolean {
  return typeof process.versions?.["sea"] === "string"
    && process.versions["sea"].length > 0;
}

/**
 * Fallback for Node 25.6.0 SEA binaries where `process.versions.sea` may
 * not be populated. The argv1 signal: a Windows PE binary ends in `.exe`,
 * `.cmd`, or `.bat`; a Linux/macOS SEA binary has been stripped of its
 * extension entirely. The npm-install path sets argv1 to .../dist/cli.js
 * (never ends in .exe, never extensionless), so it is unaffected — only
 * the SEA-binary path triggers this branch.
 */
function argv1LooksLikeSeaBinary(argv1: string): boolean {
  const lower = argv1.toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".cmd") || lower.endsWith(".bat")) {
    return true;
  }
  const lastSegment = argv1.split(/[\\/]/u).pop() ?? "";
  return lastSegment.length > 0 && !lastSegment.includes(".");
}

/**
 * Differentiates the npm-shim symlink from a real SEA binary. `npm install -g
 * umactually` creates `prefix/bin/umactually` (no `.mjs` suffix) as a symlink
 * to `prefix/lib/node_modules/umactually/bin/umactually.mjs`. Node does NOT
 * resolve the symlink in `process.argv[1]` for shebang-invoked scripts, so
 * argv1 is the extensionless symlink path — the same shape the SEA heuristic
 * looks for. A real SEA binary has no symlink layer, so its realpath equals
 * argv1. The npm shim's realpath resolves to the `.mjs` target.
 *
 * Returns true ONLY when argv1 IS the npm-shim symlink (a false return
 * from the SEA detector; the caller treats `!argv1IsNpmShimSymlink(argv1)`
 * as "safe to auto-invoke as SEA").
 */
function argv1IsNpmShimSymlink(argv1: string): boolean {
  let argv1Realpath: string;
  try {
    argv1Realpath = realpathSync(argv1);
  } catch {
    return false;
  }
  if (argv1Realpath === argv1) {
    return false;
  }
  return /\.(?:mjs|cjs|js)$/u.test(argv1Realpath);
}

/**
 * Primary entry-detection check: `import.meta.url` matches
 * `pathToFileUrl(argv1)`. True for both the canonical CLI entry and the
 * SEA-binary case (where argv1 IS the binary path).
 *
 * Symlink caveat: when the user invokes through a PATH symlink (Homebrew,
 * many Linux package managers, the npm-installed bin link), argv1 is the
 * SYMLINK path and import.meta.url is the REALPATH's URL. We normalize
 * argv1 through `realpathSync` before the comparison and fall back to the
 * literal argv1 if realpath throws (Node resolved the path lazily).
 */
function argv1MatchesModuleUrl(argv1: string): boolean {
  const argv1Real = (() => {
    try {
      return realpathSync(argv1);
    } catch {
      return argv1;
    }
  })();
  return (
    import.meta.url === pathToFileUrl(argv1) ||
    import.meta.url === pathToFileUrl(argv1Real)
  );
}

/**
 * Secondary entry-detection check: argv1 ends in `cli.js`, `cli.mjs`, or
 * `cli.cjs`. Covers two cases the URL match misses:
 *
 *  - ESM loaders (tsx, ts-node, vite-node) — argv1 is the loader's entry,
 *    not the source file, and the URL match fails.
 *  - Pre-2-arg invocations like `node dist/cli.js --version` where argv1
 *    is the source file but the URL match can still race symlink
 *    resolution on some filesystems.
 *
 * The regex accepts the three CommonJS/ESM variants we ship in `dist/` so a
 * developer running `node --import tsx dist/cli.js review` sees main() fire.
 */
function argv1MatchesCliBasename(argv1: string): boolean {
  return /(?:^|[\\/])cli\.(?:js|mjs|cjs)$/u.test(argv1);
}

/**
 * Composed entry-detection predicate. Each step short-circuits on its
 * first match — the order matters. Decision tree:
 *
 *   1. No `process` global (rare; non-Node ESM host) → false.
 *   2. `globalThis.__umactually_action_entry__` → false (the action entry
 *      is already running its own main; suppress the auto-invoke).
 *   3. `process.versions.sea` is a non-empty string → true (Node 25.7.0+
 *      SEA binary; the bundle is unambiguously the entry).
 *   4. argv1 has the SEA-binary shape AND argv1 is NOT the npm-shim
 *      symlink → true (Node 25.6.0 SEA fallback).
 *   5. `UMACTUALLY_DISABLE_AUTO_INVOKE=1` → false (library opt-out).
 *   6. `import.meta.url` matches argv1 (literal or realpath) → true
 *      (canonical CLI entry; covers `node dist/cli.js ...` and the
 *      symlink-resolved path for `npm install -g`).
 *   7. argv1 ends in `cli.js`/`cli.mjs`/`cli.cjs` → true (ESM-loader
 *      fallback).
 *   8. Otherwise → false (this module was imported by a third party; the
 *      caller must invoke `main()` explicitly).
 */
function isMainModule(): boolean {
  if (typeof process === "undefined") {
    return false;
  }
  if (isActionEntryPresent()) {
    return false;
  }
  if (isProcessSeaBinary()) {
    return true;
  }
  const argv1 = process.argv[1] ?? "";
  if (argv1.length > 0 && argv1LooksLikeSeaBinary(argv1)) {
    if (!argv1IsNpmShimSymlink(argv1)) {
      return true;
    }
  }
  if (process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] === "1") {
    return false;
  }
  if (argv1.length === 0) {
    return false;
  }
  if (argv1MatchesModuleUrl(argv1)) {
    return true;
  }
  return argv1MatchesCliBasename(argv1);
}

const isMainModuleResult = isMainModule();

if (isMainModuleResult) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      // Set exitCode and let Node exit naturally so stdout/stderr are
      // fully flushed. `process.exit()` can close the stdout pipe
      // before an in-flight `process.stdout.write()` from a synchronous
      // command like `--version` completes its async drain to the
      // captured-output pipe (`$(...)` in install.sh / the dry-run).
      // The symptom is "exit 0 but empty stdout" — the smoke test in
      // install.sh passes (exit code only, output redirected to
      // /dev/null) but the dry-run's `INSTALLED_VERSION=$(...)`
      // capture is empty. Setting `process.exitCode` and returning
      // lets Node's normal exit path drain the pipe first.
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(`cli: fatal: ${formatError(error)}\n`);
      process.exitCode = 1;
    });
}