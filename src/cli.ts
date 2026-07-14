import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { CliHelpSignal, CliUsageError, parseCliArgs, type ParsedCliArgs } from "./cli/parse-args.js";
import { dispatch as dispatchSubcommand } from "./cli/dispatch.js";
import { printHelp } from "./cli/help.js";
import { CLI_MODES_TEXT } from "./cli/modes-help.js";
import { dispatchLive, runDryRun, type CliRunResult } from "./cli/run.js";
import { isStandaloneMode, runStandalone } from "./cli/standalone-run.js";
import { collectValidationErrors, resolvePlatform } from "./cli/validate.js";
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
 */
function readPackageVersion(): string {
  // Bun --compile injects this via --define. Check the global first.
  const declared = (globalThis as Record<string, unknown>)["UMACTUALLY_VERSION"];
  if (typeof declared === "string" && declared.length > 0) {
    return declared;
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
  process.stdout.write(stdout);
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

export async function runCli(args: readonly string[], cwd: string): Promise<CliExecutionResult> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    if (error instanceof CliHelpSignal) {
      printHelp();
      return { exitCode: 0 };
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
    const errors = collectValidationErrors(resolved);
    if (errors.length > 0) {
      process.stderr.write(`cli: ${errors.join("; ")}\n`);
      // Bare-invocation banner: when the operator ran the CLI with no
      // provider flags AND validation rejected because of missing
      // --api-url/--api-key, the actionable next step is "pick a mode"
      // rather than reading --help. Print the modes banner so the
      // user can copy-paste the right invocation.
      if (
        args.length === 0 &&
        !envResolved.dryRun &&
        errors.some((e) => e.includes("--api-url") || e.includes("--api-key"))
      ) {
        process.stderr.write(`\n${BRAND_PREFIX}pick a mode:\n\n${CLI_MODES_TEXT}`);
      }
      return {
        exitCode: 2,
        resolvedConfig: buildSanitizedResolvedConfig(resolved),
      };
    }

    if (!resolved.dryRun && isStandaloneMode(process.env)) {
      const result = await runStandalone({ parsed: resolved, cwd, env: process.env });
      if (result.kind === "provider-error") {
        process.stdout.write(`${result.sanitizedForLog}\n`);
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
      : await dispatchLive(resolved, cwd, process.env);
    return {
      ...result,
      resolvedConfig: buildSanitizedResolvedConfig(resolved),
    };
  } finally {
    await cleanupGeneratedArtifacts(generatedArtifacts, cwd);
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  try {
    const result = await dispatchSubcommand(argv);
    return result.exitCode;
  } catch (error) {
    if (error instanceof CliUsageError) {
      process.stderr.write(`cli: ${error.message}\n`);
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
  const argv1 = process.argv[1];
  if (argv1 === undefined) {
    return false;
  }
  if (import.meta.url !== pathToFileUrl(argv1)) {
    return false;
  }
  return /(^|[\\/])cli\.js$/u.test(argv1);
})();

if (isMainModule) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      process.stderr.write(`cli: fatal: ${formatError(error)}\n`);
      process.exit(1);
    });
}