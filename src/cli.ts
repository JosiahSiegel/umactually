import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { CliHelpSignal, CliUsageError, parseCliArgs, type ParsedCliArgs } from "./cli/parse-args.js";
import { dispatch as dispatchSubcommand } from "./cli/dispatch.js";
import { resolveHelpText } from "./cli/help.js";
import { CLI_MODES_TEXT } from "./cli/modes-help.js";
import { dispatchLive, runDryRun, type CliRunResult } from "./cli/run.js";
import { isStandaloneMode, runStandalone } from "./cli/standalone-run.js";
import { canPromptInteractively, smartPromptForApiConfig } from "./cli/smart-prompt.js";
import { collectValidationErrors, type ValidationError, resolvePlatform } from "./cli/validate.js";
import { deriveContextFromGit } from "./cli/auto-context.js";
import {
  resolveFromSchema,
  type FieldProvenanceMap,
  type SchemaResolvedCliArgs,
} from "./config/field-resolution.js";
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
  // Fallback: if the fd-based write fails (e.g. process.stdout.fd is
  // not a valid fd in an unusual stdio wrapper, or the kernel reports
  // EBADF / EIO / EPIPE), fall back to process.stdout.write. We only
  // catch the narrow family of "this fd is not a writable pipe" errors
  // — TypeError and other programmer errors are deliberately not
  // swallowed so they surface during development.
  try {
    writeFileSync(process.stdout.fd, stdout);
  } catch (err) {
    if (!(err instanceof Error) || !isStdIoWriteError(err)) throw err;
    process.stdout.write(stdout);
  }
  return { exitCode: 0, stdout };
}

function isStdIoWriteError(err: Error): boolean {
  // EBADF (fd invalid) and EIO / EPIPE (pipe closed mid-write) are the
  // errors that mean "this write path can't reach the parent's
  // captured stdout". Everything else (TypeError, EACCES, EMFILE,
  // ENOSPC, etc.) is a real problem we want to surface, not swallow.
  const code = (err as NodeJS.ErrnoException).code;
  return code === "EBADF" || code === "EIO" || code === "EPIPE";
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
  readonly apiUrlPresent: boolean;
  readonly apiKeyPresent: boolean;
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
    apiUrlPresent: resolved.apiUrl !== null && resolved.apiUrl.length > 0,
    apiKeyPresent: resolved.apiKey !== null && resolved.apiKey.length > 0,
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

  if (shouldDeriveFromGit && !allPlumbingSupplied) {
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

/**
 * Render a list of structured validation errors to stderr.
 *
 * Shape:
 *   cli: <message-1>; <message-2>; ...
 *     hint: <hint-1>
 *     hint: <hint-2>
 *     ...
 *
 * The first line is the byte-compatible legacy join (semicolon-
 * separated messages) so any CI log scraper or external consumer
 * matching on `cli: --api-url is required` or
 * `cli: --review requires --diff` keeps working. Each entry's
 * remediation hint is rendered as a separate `hint:` line. Piping
 * the output through `grep "cli:"` still surfaces the legacy first
 * line; piping through `grep "hint:"` surfaces every remediation.
 */
function renderValidationErrors(errors: readonly ValidationError[]): string {
  const header = `cli: ${errors.map((e) => e.message).join("; ")}\n`;
  const hintLines = errors
    .map((e) => `  hint: ${e.hint}`)
    .join("\n");
  return `${header}${hintLines}\n`;
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

  // Stage 3: resolve missing flags from cwd (when applicable).
  const { resolved, generatedArtifacts } = resolveContext(
    envResolved,
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
    // The interactive path is strictly opt-in: we only prompt when
    // (a) we can detect an interactive terminal, (b) the only failing
    // fields are the standard API-config pair, and (c) we haven't
    // already been given the value via env var (the prompt would
    // otherwise feel like a leak). ALL other validation failures
    // bypass this branch — we don't try to be clever around
    // required-sonar config, --platform azure identity, etc., because
    // those have CI / globs-of-context implications.
    if (
      errors.length > 0 &&
      canPromptInteractively() &&
      !resolved.dryRun &&
      everyErrorIsApiConfig(errors) &&
      process.env["UMACTUALLY_NO_INTERACTIVE"] === undefined
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
      // Render the structured errors with `flag` + `message` + `hint`
      // so the operator sees a remediation next to each failure rather
      // than a flat semicolon-joined string. The first line stays
      // byte-compatible with the legacy `cli: <msg>;<msg>` shape so
      // any consumer grep'ing for `cli: --api-url is required` keeps
      // working.
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
const isMainModule = (() => {
  if (typeof process === "undefined") {
    return false;
  }
  if (globalThis.__umactually_action_entry__ === true) {
    return false;
  }
  // The "this module is the entry" check is: import.meta.url matches
  // pathToFileUrl(process.argv[1]). This is true for both the canonical
  // CLI entry (argv1 = the cli.js path, import.meta.url = the file://
  // URL of that path) and the SEA-binary case (argv1 = the binary
  // path, import.meta.url = the file:// URL of the same path).
  //
  // The previous logic also required argv1 to end in `cli.js`. That
  // was true for the npm-install path (argv1 = .../bin/umactually.mjs
  // → shim → .../node_modules/umactually/dist/cli.js) but FALSE for
  // a Node SEA binary where argv1 = the binary itself, e.g.
  // `/usr/local/bin/umactually`. The `cli.js` regex test was the
  // actual failure mode that made the previous auto-invoke silently
  // no-op on every SEA install: argv1 was the binary path, the regex
  // didn't match, isMainModule returned false, main() never ran,
  // runVersion never wrote, and the binary exited 0 with empty
  // stdout. The release-pipeline-dry-run CI's
  // `INSTALLED_VERSION=$(umactually --version)` capture was therefore
  // always empty. Note: process.versions.sea is a STRING (e.g.
  // "1.0.0") on a SEA binary, not a boolean, but the previous code
  // didn't check it — the cli.js regex was the failing branch. The
  // action entry's globalThis flag still gates the action path (its
  // bundle sets the flag before reaching this module), so dropping
  // the regex is safe.
  //
  // ESM-loader fallback: when the file is invoked through an ESM
  // loader (tsx, ts-node, vite-node, etc.), process.argv[1] is the
  // loader's resolved entry, not the source file. The URL match
  // fails in that case. We keep a regex on argv1 as a secondary
  // guard so the ESM-loader case is still covered without
  // re-introducing the SEA-binary regression. The regex accepts
  // `cli.js`, `cli.mjs`, and `cli.cjs` (the three CommonJS/ESM
  // variants we ship in dist/) so a developer running
  // `node --import tsx dist/cli.js review` sees main() fire.
  //
  // Opt-out: setting `UMACTUALLY_DISABLE_AUTO_INVOKE=1` forces
  // isMainModule to return false, which means a third-party importer
  // that does `import('umactually/dist/cli')` from a non-standard
  // path (so the URL match would otherwise succeed) can call
  // `await main(argv)` explicitly without the auto-invoke firing.
  // This is the supported way to consume `dist/cli` as a library.
  // The bin/umactually.mjs shim does NOT need this env var (it
  // already explicitly invokes `await mod.main(argv)` after the
  // dynamic import), and the standalone SEA binary never sets it
  // (the auto-invoke is the whole point of the binary).
  //
  // Regression surface to be aware of: any third-party importer that
  // does `require('umactually/dist/cli')` from a path that does NOT
  // end in `cli.js` (e.g. a re-exported entry under a different
  // filename like `require('umactually/dist/cli/index')`) will now
  // ALSO auto-invoke main() because the URL match succeeds, UNLESS
  // the importer sets `UMACTUALLY_DISABLE_AUTO_INVOKE=1` in the
  // process env before importing. If we ever need to support that
  // pattern by default, restore the `cli.js` regex AND add a
  // per-runtime entry probe (e.g. a `process.versions.sea` boolean
  // in the SEA build that the auto-invoke can check). For v0.6.0,
  // the supported consumers are the canonical CLI (npm path and SEA
  // binary) plus the action entry plus library consumers who set
  // `UMACTUALLY_DISABLE_AUTO_INVOKE=1`, all of which are covered.
  //
  // npm-install path note: when installed via `npm install -g
  // umactually`, process.argv[1] is the path to bin/umactually.mjs
  // (the shim), NOT to dist/cli.js. The shim's auto-invoke path
  // (see bin/umactually.mjs) does NOT depend on this isMainModule
  // gate — it does a dynamic `import(pathToFileURL(bundledCli))` of
  // dist/cli.js and then explicitly calls `await mod.main(argv)`.
  // So the npm path is correct regardless of whether isMainModule
  // returns true or false for the dynamic-imported module. The
  // isMainModule gate is the entry-point check for the standalone
  // SEA binary (argv1 = the binary path itself) and the canonical
  // `node dist/cli.js ...` invocation.
  if (process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] === "1") {
    return false;
  }
  const argv1 = process.argv[1];
  if (argv1 === undefined) {
    return false;
  }
  // Primary: URL match (canonical CLI entry + SEA binary).
  //
  // Symlink caveat: when the user invokes the CLI through a PATH
  // symlink (e.g. `/usr/local/bin/umactually` is a symlink to
  // `/opt/umactually/bin/umactually`, the default `umactually`
  // install on macOS Homebrew and many Linux package managers),
  // `pathToFileUrl(argv1)` produces the SYMLINK's URL, but
  // `import.meta.url` for the loaded module is the REALPATH's
  // URL. The two URL strings differ
  // (`file:///usr/local/bin/umactually` vs.
  // `file:///opt/umactually/bin/umactually`) and the strict
  // equality check would silently return false → main() does not
  // auto-invoke → the SEA binary silently exits 0 with no
  // output. We normalize argv1 through fs.realpathSync (which
  // resolves the symlink) before the URL comparison, and fall
  // back to the literal argv1 if realpath throws (e.g. argv1
  // does not exist yet because Node resolved it lazily — the
  // original `===` comparison handles that case).
  const argv1Real = (() => {
    try {
      return realpathSync(argv1);
    } catch {
      return argv1;
    }
  })();
  if (
    import.meta.url === pathToFileUrl(argv1) ||
    import.meta.url === pathToFileUrl(argv1Real)
  ) {
    return true;
  }
  // Secondary: argv1 ends in cli.js/mjs/cjs. Covers the ESM-loader
  // case (tsx, ts-node) where argv1 is the loader's entry, not the
  // source file, and the URL match silently fails. Also covers
  // pre-2-arg invocations like `node dist/cli.js --version` where
  // argv1 is the source file but the URL match can still race
  // symlink resolution on some filesystems.
  return /(?:^|[\\/])cli\.(?:js|mjs|cjs)$/u.test(argv1);
})();

if (isMainModule) {
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