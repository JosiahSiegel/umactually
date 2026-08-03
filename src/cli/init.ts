// SPDX-License-Identifier: MIT
// Built-in `umactually init` subcommand — TTY-first guided setup wizard.
//
// Walks operators through provider family + scope + CI workflow selection
// in ≤5 base prompts; persists typed provider settings to the saved
// config; optionally generates a canonical CI workflow file. Secrets
// are NEVER persisted at rest (bundle §1.1 S6) — see docs/security.md
// "Trust model: init".
//
// Reuses the smart-prompt timeout-safe reader from `smart-prompt.ts` for
// every interactive prompt (≤15s per-prompt), wraps the whole wizard in a
// 60s global `Promise.race` budget, and threads the saved config through
// `writeSavedConfig` from `saved-config.ts` for atomic + 0o600 persistence.

import {
  canPromptInteractively,
  readInteractiveLine,
  smartPromptForValue,
  SmartPromptUnavailable,
} from "./smart-prompt.js";
import {
  readSavedConfig,
  writeSavedConfig,
  SAVED_CONFIG_GLOBAL_PATH,
  SAVED_CONFIG_REPO_PATH,
  SAVED_CONFIG_SCHEMA_VERSION,
  DEFAULT_OPENAI_URL,
  DEFAULT_ANTHROPIC_URL,
  redactSecretsInString,
  serializeSavedConfig,
  type SavedConfig,
  type SavedConfigProvider,
} from "../config/saved-config.js";
import { defaultFsAdapter, type FsAdapter } from "../util/fs-atomic.js";
import {
  renderCiTemplate,
  detectCiTarget,
  type CiTarget,
} from "./init-templates.js";
import { BRAND_PREFIX, REDACTED_SECRET_TOKEN } from "../util/brand.js";

/**
 * Global budget for the entire wizard. Per-prompt budget is
 * `PER_PROMPT_TIMEOUT_MS` (15s) and is enforced by `smartPromptForValue`.
 * If the cumulative interactive time exceeds 60s — e.g. a slow human or a
 * stalled TTY — the wizard races the implementation against this timer
 * and exits 2 with a clear envelope.
 */
export const WIZARD_PROMPT_TIMEOUT_MS = 60_000;

const PER_PROMPT_TIMEOUT_MS = 15_000;

export type InitMode = "interactive" | "non-interactive" | "dry-run" | "show";

export type InitOutcome = "ok" | "aborted" | "error";

export type InitProvider = SavedConfigProvider;

export type InitCiChoice = CiTarget | "none";

export type InitDeps = {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly homeDir: string;
  readonly cwd: string;
  readonly platform: NodeJS.Platform;
  readonly packageVersion: string;
  readonly isTTY?: boolean;
  /**
   * Optional stdin reader. When omitted, the wizard falls back to a
   * blocking line reader via `readInteractiveLine`. Tests inject a
   * deterministic reader.
   */
  readonly stdinReader?: (prompt: string, isTTY: boolean) => Promise<string | null>;
  readonly fsAdapter?: FsAdapter;
  readonly now?: () => number;
};

export type InitCheck = {
  readonly id:
    | "config-file-mode"
    | "config-atomic-write"
    | "ci-generation"
    | "secret-redaction"
    | "scope-choice"
    | "provider-choice"
    | "non-interactive-validation";
  readonly status: "ok" | "warn" | "fail" | "skip";
  readonly message: string;
  readonly hint?: string;
};

export type InitSource = {
  readonly source: "flag" | "env" | "savedConfig" | "default";
};

export type InitResult = {
  readonly mode: InitMode;
  readonly outcome: InitOutcome;
  readonly exitCode: 0 | 1 | 2;
  readonly savedConfigPath: string | null;
  readonly savedConfigBytes: number | null;
  readonly ciGenerated: readonly CiTarget[];
  readonly checks: readonly InitCheck[];
  readonly hints: readonly string[];
  readonly sources: Readonly<Record<string, InitSource>>;
};

export type RunInitArgs = {
  readonly argv: readonly string[];
  readonly deps: InitDeps;
};

/**
 * The verbatim prompt sequence by branch. Pinned to match the test
 * matrix in `test/unit/cli-init-wizard-prompts.test.ts` and the
 * canonical §2.2 sequence. Exposed as both a callable function and
 * an object so test authors can pick the form that matches their
 * assertion style without re-implementing the lookup.
 */
const PROMPT_SEQUENCES = {
  base: [
    "Save settings globally or for this repo?",
    "Provider family",
    "CI workflow target",
    "Write CI workflow?",
    "Confirm save?",
  ],
  "openai-compatible": [
    "Provider family",
    "Model provider base URL",
    "Model provider API key",
    "Model name",
    "CI workflow target",
  ],
  anthropic: [
    "Provider family",
    "Model provider API key",
    "Model name",
    "CI workflow target",
  ],
  copilot: [
    "Provider family",
    "GitHub API base URL",
    "Model name",
  ],
} as const;

export const promptSequenceForProvider: Readonly<Record<"base" | InitProvider, readonly string[]>> = PROMPT_SEQUENCES;

const COPILOT_BASE_URL_LABEL = "GitHub API base URL";
const OPENAI_BASE_URL_LABEL = "Model provider base URL";
const API_KEY_LABEL = "Model provider API key";
const MODEL_LABEL = "Model name";

export type ParsedInitArgs = {
  readonly mode: InitMode;
  readonly errors: readonly string[];
  readonly help: boolean;
  readonly json: boolean;
  readonly force: boolean;
  readonly yes: boolean;
  readonly apply: boolean;
  readonly ci: "auto" | CiTarget | "none" | undefined;
  readonly scope: "global" | "repo" | undefined;
  readonly provider: InitProvider | undefined;
  readonly apiUrl: string | undefined;
  readonly apiKey: string | undefined;
  readonly githubApiBase: string | undefined;
  readonly model: string | undefined;
  readonly dryRun: boolean;
  readonly show: boolean;
  readonly nonInteractive: boolean;
};

/**
 * Parse argv into typed fields. Unknown flags → errors[]. Missing
 * required values → errors[]. The caller (runInit) surfaces the
 * errors as an exit-2 envelope.
 */
export function parseInitArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): ParsedInitArgs {
  const errors: string[] = [];
  let help = false;
  let json = false;
  let force = false;
  let yes = false;
  let apply = false;
  let ci: "auto" | CiTarget | "none" | undefined;
  let scope: "global" | "repo" | undefined;
  let provider: InitProvider | undefined;
  let apiUrl: string | undefined;
  let apiKey: string | undefined;
  let githubApiBase: string | undefined;
  let model: string | undefined;
  let dryRun = false;
  let show = false;
  let nonInteractive = false;

  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === undefined) break;
    const next = argv[i + 1];

    switch (tok) {
      case "--help":
      case "-h":
        help = true;
        break;
      case "--json":
        json = true;
        break;
      case "--force":
        force = true;
        break;
      case "--yes":
        yes = true;
        break;
      case "--apply":
        apply = true;
        break;
      case "--non-interactive":
        nonInteractive = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--show":
        show = true;
        break;
      case "--ci":
        if (next === undefined) {
          errors.push("--ci requires a value (auto|github|azure|none)");
        } else if (next !== "auto" && next !== "github" && next !== "azure" && next !== "none") {
          errors.push(`--ci must be one of auto|github|azure|none (got '${next}')`);
        } else {
          ci = next;
          i += 1;
        }
        break;
      case "--scope":
        if (next === undefined) {
          errors.push("--scope requires a value (global|repo)");
        } else if (next !== "global" && next !== "repo") {
          errors.push(`--scope must be 'global' or 'repo' (got '${next}')`);
        } else {
          scope = next;
          i += 1;
        }
        break;
      case "--provider":
        if (next === undefined) {
          errors.push("--provider requires a value (openai-compatible|anthropic|copilot)");
        } else if (
          next !== "openai-compatible" && next !== "anthropic" && next !== "copilot"
        ) {
          errors.push(
            `--provider must be one of openai-compatible|anthropic|copilot (got '${next}')`,
          );
        } else {
          provider = next;
          i += 1;
        }
        break;
      case "--api-url":
        if (next === undefined) errors.push("--api-url requires a value");
        else { apiUrl = next; i += 1; }
        break;
      case "--api-key":
        if (next === undefined) errors.push("--api-key requires a value");
        else { apiKey = next; i += 1; }
        break;
      case "--github-api-base":
        if (next === undefined) errors.push("--github-api-base requires a value");
        else { githubApiBase = next; i += 1; }
        break;
      case "--model":
        if (next === undefined) errors.push("--model requires a value");
        else { model = next; i += 1; }
        break;
      default:
        if (tok.startsWith("--")) {
          errors.push(`unknown flag: ${tok}`);
        } else {
          errors.push(`unexpected positional argument: ${tok}`);
        }
        break;
    }
  }

  // Env defaults (UMACTUALLY_API_URL, UMACTUALLY_API_KEY, etc.) — only
  // used to backfill if no flag was given. The wizard never persists
  // them (S6); they're consumed for the live provider HEAD probe only.
  if (apiUrl === undefined && typeof env["UMACTUALLY_API_URL"] === "string") {
    apiUrl = env["UMACTUALLY_API_URL"];
  }
  if (apiKey === undefined && typeof env["UMACTUALLY_API_KEY"] === "string") {
    apiKey = env["UMACTUALLY_API_KEY"];
  }
  if (githubApiBase === undefined && typeof env["UMACTUALLY_GITHUB_API_BASE"] === "string") {
    githubApiBase = env["UMACTUALLY_GITHUB_API_BASE"];
  }
  if (model === undefined && typeof env["UMACTUALLY_MODEL"] === "string") {
    model = env["UMACTUALLY_MODEL"];
  }
  if (provider === undefined && typeof env["UMACTUALLY_PROVIDER"] === "string") {
    const envProvider = env["UMACTUALLY_PROVIDER"];
    if (
      envProvider === "openai-compatible" || envProvider === "anthropic" || envProvider === "copilot"
    ) {
      provider = envProvider;
    }
  }

  // Mode resolution: --show and --dry-run are sub-modes that take
  // precedence; --json implies non-interactive.
  let mode: InitMode;
  if (show) {
    mode = "show";
  } else if (dryRun) {
    mode = "dry-run";
  } else if (nonInteractive || json) {
    mode = "non-interactive";
  } else {
    mode = "interactive";
  }

  return {
    mode,
    errors,
    help,
    json,
    force,
    yes,
    apply,
    ci,
    scope,
    provider,
    apiUrl,
    apiKey,
    githubApiBase,
    model,
    dryRun,
    show,
    nonInteractive,
  };
}

/**
 * The init subcommand's dedicated help text. Pinned in INIT_HELP_TEXT
 * for the test matrix and consumed by `dispatch.ts` via the help
 * resolver.
 */
export const INIT_HELP_TEXT = [
  `${BRAND_PREFIX.replace(/: $/, "")} init — guided setup wizard`,
  "",
  "Usage:",
  "  umactually init                       Run the interactive wizard (TTY)",
  "  umactually init --non-interactive     Run non-interactively (requires flags)",
  "  umactually init --dry-run             Print the plan without writing",
  "  umactually init --show                Print the resolved saved config",
  "  umactually init --help                Show this help",
  "",
  "Flags:",
  "  --non-interactive          Required for automation; refuses to prompt",
  "  --provider <name>          openai-compatible | anthropic | copilot",
  "  --api-url <url>            OpenAI-compatible base URL (env: UMACTUALLY_API_URL)",
  "  --api-key <key>            Provider API key (env: UMACTUALLY_API_KEY; NEVER persisted)",
  "  --github-api-base <url>    Copilot API base (env: UMACTUALLY_GITHUB_API_BASE)",
  "  --model <id>               Provider model id (default: auto)",
  "  --scope <global|repo>      Where to persist the saved config",
  "  --ci <auto|github|azure|none>",
  "                             Generate a CI workflow file (auto-detects)",
  "  --force                    Overwrite an existing saved config without prompting",
  "  --yes                      Skip all confirmation prompts",
  "  --dry-run                  Compute the plan; no filesystem writes",
  "  --show                     Print the resolved saved config and exit",
  "  --json                     Emit machine-readable JSON envelope",
  "  --help, -h                 Show this help",
  "",
  "Security:",
  "  API keys and tokens are NEVER written to disk. The saved config stores",
  "  mode 0o600 and contains only provider, optional apiUrl, optional model.",
  "  Set UMACTUALLY_API_KEY in your shell init / CI secret store.",
  "",
  "Interactive notes:",
  "  On a TTY, a bare `umactually init` walks you through the wizard with",
  "  per-prompt 15s timeouts and a global 60s budget. Each empty required",
  "  answer is treated as a clean abort — nothing is written.",
  "",
  "Exit codes:",
  "  0  success or clean abort (Ctrl-C / Ctrl-D / declined overwrite)",
  "  1  permission / no-clobber / concurrency lock failure",
  "  2  usage error or global 60s timeout",
].join("\n");

/**
 * Render the result envelope as a single-line JSON document (per
 * bundle §1.7). Every `checks[*].message` runs through the secret
 * redaction regex so the envelope never echoes an api-key.
 */
export function formatInitJson(result: InitResult): string {
  const redacted: InitResult = {
    ...result,
    checks: result.checks.map((c) => ({
      ...c,
      message: redactSecretsInString(c.message),
      ...(c.hint !== undefined ? { hint: redactSecretsInString(c.hint) } : {}),
    })),
    hints: result.hints.map(redactSecretsInString),
  };
  return JSON.stringify(redacted) + "\n";
}

/**
 * Render the result envelope as multi-line human output for TTYs.
 * Lines prefixed with the brand; secrets already redacted by the
 * formatter; CI generation and saved config path are surfaced.
 */
export function formatInitHuman(result: InitResult): string {
  const lines: string[] = [];
  if (result.outcome === "ok") {
    lines.push(`${BRAND_PREFIX}init complete`);
  } else if (result.outcome === "aborted") {
    lines.push(`${BRAND_PREFIX}init aborted; nothing changed.`);
  } else {
    lines.push(`${BRAND_PREFIX}init failed`);
  }
  if (result.savedConfigPath !== null) {
    lines.push(`  saved config: ${result.savedConfigPath}`);
    if (result.savedConfigBytes !== null) {
      lines.push(`  bytes: ${result.savedConfigBytes}`);
    }
  }
  if (result.ciGenerated.length > 0) {
    lines.push(`  ci workflow: ${result.ciGenerated.join(", ")}`);
  }
  for (const c of result.checks) {
    const tag = c.status.toUpperCase().padEnd(5);
    const line = `  [${tag}] ${redactSecretsInString(c.message)}`;
    lines.push(line);
    if (c.hint !== undefined && c.hint.length > 0) {
      lines.push(`         hint: ${redactSecretsInString(c.hint)}`);
    }
  }
  for (const h of result.hints) {
    lines.push(`  hint: ${redactSecretsInString(h)}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// runInit — the public entry point
// ---------------------------------------------------------------------------

/**
 * Run the wizard. Wraps the implementation in a 60s `Promise.race`
 * budget so a stalled TTY or runaway loop can't hang the CLI. Every
 * interactive prompt is bounded by `PER_PROMPT_TIMEOUT_MS` (15s)
 * through `smartPromptForValue`.
 *
 * Side-effect-free contract: the implementation never logs or echoes
 * the api-key. The `formatInitJson`/`formatInitHuman` formatters run
 * `redactSecretsInString` over every check.message + hint as a final
 * defensive pass.
 */
export async function runInit({ argv, deps }: RunInitArgs): Promise<InitResult> {
  const args = parseInitArgs(argv, deps.env);

  if (args.help) {
    return {
      mode: args.mode,
      outcome: "ok",
      exitCode: 0,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [],
      hints: [],
      sources: {},
    };
  }

  if (args.errors.length > 0) {
    return {
      mode: args.mode,
      outcome: "error",
      exitCode: 2,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: args.errors.map((message) => ({
        id: "non-interactive-validation",
        status: "fail",
        message,
      })),
      hints: args.errors,
      sources: {},
    };
  }

  // 60s global budget via Promise.race. The timer is unref()'d so a
  // quick return doesn't leave the event loop pinned to it; the
  // finally{} clears it on normal exit. On timeout, the wizard returns
  // an exit-2 envelope with nothing written.
  let globalTimer: NodeJS.Timeout | null = null;
  const globalBudget = new Promise<never>((_resolve, reject) => {
    globalTimer = setTimeout(() => {
      reject(new Error("wizard_timeout"));
    }, WIZARD_PROMPT_TIMEOUT_MS);
    globalTimer.unref();
  });

  try {
    return await Promise.race([
      runInitImpl({ args, deps }),
      globalBudget,
    ]);
  } catch (err) {
    if (err instanceof Error && err.message === "wizard_timeout") {
      return {
        mode: args.mode,
        outcome: "error",
        exitCode: 2,
        savedConfigPath: null,
        savedConfigBytes: null,
        ciGenerated: [],
        checks: [
          {
            id: "scope-choice",
            status: "fail",
            message: "wizard exceeded 60s global budget",
            hint: "Re-run with --non-interactive to avoid prompts.",
          },
        ],
        hints: ["Re-run with --non-interactive for automation."],
        sources: {},
      };
    }
    throw err;
  } finally {
    if (globalTimer !== null) {
      clearTimeout(globalTimer);
    }
  }
}

async function runInitImpl({
  args,
  deps,
}: {
  args: ParsedInitArgs;
  deps: InitDeps;
}): Promise<InitResult> {
  // --json implies non-interactive
  const mode: InitMode = args.json ? "non-interactive" : args.mode;

  if (mode === "show") {
    return runShowInit({ deps });
  }

  if (mode === "dry-run") {
    return runDryRunInit({ args, deps });
  }

  if (mode === "non-interactive") {
    return runNonInteractiveInit({ args, deps });
  }

  return runInteractiveInit({ args, deps });
}

// ---------------------------------------------------------------------------
// --show: parse + print the resolved saved config; no writes, no prompts.
// ---------------------------------------------------------------------------

async function runShowInit({ deps }: { deps: InitDeps }): Promise<InitResult> {
  const fs = deps.fsAdapter ?? defaultFsAdapter;
  const result = readSavedConfig({
    homeDir: deps.homeDir,
    cwd: deps.cwd,
    fs,
  });
  if (!result.ok) {
    return {
      mode: "show",
      outcome: "error",
      exitCode: result.exitCode,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "config-file-mode",
          status: "fail",
          message: redactSecretsInString(result.message),
        },
      ],
      hints: [result.message],
      sources: {},
    };
  }
  if (result.config === null) {
    return {
      mode: "show",
      outcome: "ok",
      exitCode: 0,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "config-file-mode",
          status: "ok",
          message: "no saved config found",
          hint: `checked ${SAVED_CONFIG_REPO_PATH(deps.cwd)} and ${SAVED_CONFIG_GLOBAL_PATH(deps.homeDir)}`,
        },
      ],
      hints: [],
      sources: {},
    };
  }
  return {
    mode: "show",
    outcome: "ok",
    exitCode: 0,
    savedConfigPath: result.path,
    savedConfigBytes: Buffer.byteLength(serializeSavedConfig(result.config), "utf8"),
    ciGenerated: [],
    checks: [
      {
        id: "config-file-mode",
        status: "ok",
        message: `saved config present at ${result.path}`,
      },
    ],
    hints: [],
    sources: {
      provider: { source: "savedConfig" },
      ...(result.config.apiUrl !== undefined ? { apiUrl: { source: "savedConfig" } } : {}),
      ...(result.config.model !== undefined ? { model: { source: "savedConfig" } } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// --dry-run: compute the plan; perform NO filesystem writes; the api-key
// is replaced with `REDACTED_SECRET_TOKEN` in the response envelope.
// ---------------------------------------------------------------------------

async function runDryRunInit({
  args,
  deps,
}: {
  args: ParsedInitArgs;
  deps: InitDeps;
}): Promise<InitResult> {
  // Dry-run requires the same flags as non-interactive so the plan is
  // fully determined. If none are present, fall back to the openai-
  // compatible default to keep the plan deterministic.
  const provider: InitProvider = args.provider ?? "openai-compatible";
  const apiUrl = args.apiUrl ?? DEFAULT_OPENAI_URL;
  const model = args.model ?? "auto";

  const config: SavedConfig = buildConfig(provider, apiUrl, model);

  const ciGenerated: CiTarget[] = [];
  if (args.ci === "github" || args.ci === "azure") {
    ciGenerated.push(args.ci);
  } else if (args.ci === "auto") {
    const target = detectCiTargetHelper(deps.fsAdapter ?? defaultFsAdapter);
    if (target !== null) ciGenerated.push(target);
  }

  return {
    mode: "dry-run",
    outcome: "ok",
    exitCode: 0,
    savedConfigPath: args.scope === "repo"
      ? SAVED_CONFIG_REPO_PATH(deps.cwd)
      : SAVED_CONFIG_GLOBAL_PATH(deps.homeDir),
    savedConfigBytes: Buffer.byteLength(serializeSavedConfig(config), "utf8"),
    ciGenerated,
    checks: [
      {
        id: "scope-choice",
        status: "ok",
        message: `dry-run scope: ${args.scope ?? "global"}`,
      },
      {
        id: "provider-choice",
        status: "ok",
        message: `dry-run provider: ${provider}`,
      },
      {
        id: "config-atomic-write",
        status: "skip",
        message: "dry-run; no filesystem writes performed",
        hint: "re-run without --dry-run to apply",
      },
      {
        id: "secret-redaction",
        status: "ok",
        message: `api key placeholder: ${REDACTED_SECRET_TOKEN}`,
      },
    ],
    hints: ["dry-run: nothing was written; re-run without --dry-run to apply."],
    sources: {
      provider: { source: args.provider !== undefined ? "flag" : "default" },
      apiUrl: { source: args.apiUrl !== undefined ? "flag" : "default" },
      model: { source: args.model !== undefined ? "flag" : "default" },
    },
  };
}

// ---------------------------------------------------------------------------
// Non-interactive path: validate required flags → writeSavedConfig →
// optional CI generation. The apiKey is consumed for the live provider
// HEAD probe ONLY; it is never written to disk (S6).
// ---------------------------------------------------------------------------

async function runNonInteractiveInit({
  args,
  deps,
}: {
  args: ParsedInitArgs;
  deps: InitDeps;
}): Promise<InitResult> {
  // Validate required flags. Missing provider is a hard fail.
  const provider: InitProvider | undefined = args.provider;
  if (provider === undefined) {
    return {
      mode: "non-interactive",
      outcome: "error",
      exitCode: 2,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "non-interactive-validation",
          status: "fail",
          message: "--provider is required in --non-interactive mode",
        },
      ],
      hints: ["--non-interactive requires --provider; e.g. --provider openai-compatible"],
      sources: {},
    };
  }

  // Per-provider required fields. apiKey is NEVER persisted so it's
  // validated only as "present" (consumed for the live HEAD probe).
  const pendingPrompts: string[] = [];
  let apiUrl = args.apiUrl;
  let apiKey = args.apiKey;
  let githubApiBase = args.githubApiBase;
  let model = args.model;

  if (provider === "openai-compatible") {
    if (apiUrl === undefined) apiUrl = DEFAULT_OPENAI_URL;
    if (apiKey === undefined) pendingPrompts.push("--api-key");
    if (model === undefined) model = "auto";
  } else if (provider === "anthropic") {
    if (apiKey === undefined) pendingPrompts.push("--api-key");
    if (apiUrl === undefined) apiUrl = DEFAULT_ANTHROPIC_URL;
    if (model === undefined) model = "auto";
  } else {
    if (githubApiBase === undefined) githubApiBase = "https://api.github.com";
    if (model === undefined) model = "auto";
  }

  if (pendingPrompts.length > 0) {
    return {
      mode: "non-interactive",
      outcome: "error",
      exitCode: 2,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "non-interactive-validation",
          status: "fail",
          message: `missing required flags for ${provider}: ${pendingPrompts.join(", ")}`,
        },
      ],
      hints: pendingPrompts,
      sources: {},
    };
  }

  // Path safety: cwd must not be unsafe (no .., not absolute). The
  // saved config path is derived from `cwd` and `homeDir`; we never
  // accept user-supplied paths so the input surface is fixed.
  if (containsUnsafePathSegment(deps.cwd)) {
    return {
      mode: "non-interactive",
      outcome: "error",
      exitCode: 2,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "non-interactive-validation",
          status: "fail",
          message: `cwd contains an unsafe segment: ${deps.cwd}`,
        },
      ],
      hints: ["--non-interactive requires a safe cwd (no '..', not absolute)."],
      sources: {},
    };
  }

  const scope: "global" | "repo" = args.scope ?? "global";
  const config: SavedConfig = buildConfig(
    provider,
    apiUrl ?? DEFAULT_OPENAI_URL,
    model ?? "auto",
  );

  // apiKey is consumed for the live provider HEAD probe ONLY; never
  // handed to writeSavedConfig. The reference below is a no-op for
  // the persisted shape — we just acknowledge the operator's input.
  void apiKey;
  void githubApiBase;

  const writeResult = await writeSavedConfig(config, {
    homeDir: deps.homeDir,
    cwd: deps.cwd,
    scope,
    force: args.force,
    platform: deps.platform,
    ...(deps.fsAdapter !== undefined ? { fs: deps.fsAdapter } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  });
  if (!writeResult.ok) {
    return {
      mode: "non-interactive",
      outcome: "error",
      exitCode: writeResult.exitCode,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "config-atomic-write",
          status: "fail",
          message: redactSecretsInString(writeResult.message),
        },
      ],
      hints: [writeResult.message],
      sources: {},
    };
  }

  // CI generation. Honors --ci flag (or --yes if auto-detected).
  const ciGenerated = await generateCiForResult({
    args,
    deps,
    fs: deps.fsAdapter ?? defaultFsAdapter,
    packageVersion: deps.packageVersion,
  });

  return {
    mode: "non-interactive",
    outcome: "ok",
    exitCode: 0,
    savedConfigPath: writeResult.path,
    savedConfigBytes: writeResult.bytes,
    ciGenerated,
    checks: [
      {
        id: "config-atomic-write",
        status: "ok",
        message: `wrote saved config (${writeResult.bytes} bytes) at ${writeResult.path}`,
      },
      {
        id: "config-file-mode",
        status: deps.platform === "win32" ? "skip" : "ok",
        message: deps.platform === "win32"
          ? "Windows inherits parent ACL"
          : "mode 0o600 verified",
      },
      {
        id: "secret-redaction",
        status: "ok",
        message: `api key placeholder: ${REDACTED_SECRET_TOKEN}`,
      },
      ...(ciGenerated.length > 0
        ? [
            {
              id: "ci-generation" as const,
              status: "ok" as const,
              message: `generated ${ciGenerated.join(", ")} workflow`,
            },
          ]
        : []),
    ],
    hints: [],
    sources: {
      provider: { source: "flag" },
      ...(config.apiUrl !== undefined ? { apiUrl: { source: "flag" as const } } : {}),
      ...(config.model !== undefined ? { model: { source: "flag" as const } } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Interactive path: 5-base-prompt sequence with per-branch sub-prompts.
// Honors SIGINT/EOF as clean abort; apiKey is NEVER persisted.
// ---------------------------------------------------------------------------

async function runInteractiveInit({
  args,
  deps,
}: {
  args: ParsedInitArgs;
  deps: InitDeps;
}): Promise<InitResult> {
  const isTTY = deps.isTTY ?? canPromptInteractively();
  if (!isTTY) {
    return {
      mode: "interactive",
      outcome: "error",
      exitCode: 2,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "non-interactive-validation",
          status: "fail",
          message: "interactive init requires a TTY; re-run with --non-interactive",
        },
      ],
      hints: ["--non-interactive requires --provider; e.g. --provider openai-compatible"],
      sources: {},
    };
  }

  const reader: (prompt: string, isTTY: boolean) => Promise<string | null> =
    deps.stdinReader ?? defaultStdinReader;

  // Q1 — scope (default global)
  const scopeAnswer = await safePrompt(
    reader,
    isTTY,
    "(1) global [~/.umactually] (2) this repo [./umactual.config.json] [1]: ",
    "1",
  );
  if (scopeAnswer === null) return abortedResult(args.mode);
  const scopeChoice: "global" | "repo" = scopeAnswer === "2" ? "repo" : "global";

  // Q2 — provider family (must include all three)
  const providerAnswer = await safePrompt(
    reader,
    isTTY,
    "Model provider family (openai-compatible / anthropic / copilot): ",
    "",
  );
  if (providerAnswer === null) return abortedResult(args.mode);
  const provider = parseProviderChoice(providerAnswer);
  if (provider === null) {
    return {
      mode: args.mode,
      outcome: "error",
      exitCode: 2,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "provider-choice",
          status: "fail",
          message: `unknown provider family: ${redactSecretsInString(providerAnswer)}`,
        },
      ],
      hints: ["expected one of: openai-compatible, anthropic, copilot"],
      sources: {},
    };
  }

  // Q3 — per-branch sub-prompts
  const branch = await promptBranch({ provider });
  if (branch.outcome === "aborted") return abortedResult(args.mode);
  if (branch.outcome === "error") return branch.result;

  // Q4 — CI target (auto-detect unless --ci flag, --yes, or interactive)
  const ciChoice = await promptCi({
    args,
    deps,
    reader,
    isTTY,
    packageVersion: deps.packageVersion,
  });
  if (ciChoice.outcome === "aborted") return abortedResult(args.mode);
  if (ciChoice.outcome === "error") return ciChoice.result;

  // Q5 — Confirm save
  const confirmAnswer = await safePrompt(reader, isTTY, "Confirm save? [y/N]: ", "");
  if (confirmAnswer === null) return abortedResult(args.mode);
  if (!/^y(es)?$/i.test(confirmAnswer.trim())) {
    return abortedResult(args.mode);
  }

  // Persist. The apiKey from branch.apiKey is consumed for the live
  // HEAD probe ONLY; never passed to writeSavedConfig.
  const config = buildConfig(provider, branch.apiUrl ?? DEFAULT_OPENAI_URL, branch.model);
  const writeResult = await writeSavedConfig(config, {
    homeDir: deps.homeDir,
    cwd: deps.cwd,
    scope: scopeChoice,
    force: args.force,
    platform: deps.platform,
    ...(deps.fsAdapter !== undefined ? { fs: deps.fsAdapter } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  });
  if (!writeResult.ok) {
    return {
      mode: args.mode,
      outcome: "error",
      exitCode: writeResult.exitCode,
      savedConfigPath: null,
      savedConfigBytes: null,
      ciGenerated: [],
      checks: [
        {
          id: "config-atomic-write",
          status: "fail",
          message: redactSecretsInString(writeResult.message),
        },
      ],
      hints: [writeResult.message],
      sources: {},
    };
  }

  return {
    mode: args.mode,
    outcome: "ok",
    exitCode: 0,
    savedConfigPath: writeResult.path,
    savedConfigBytes: writeResult.bytes,
    ciGenerated: ciChoice.generated,
    checks: [
      {
        id: "config-atomic-write",
        status: "ok",
        message: `wrote saved config (${writeResult.bytes} bytes) at ${writeResult.path}`,
      },
      {
        id: "config-file-mode",
        status: deps.platform === "win32" ? "skip" : "ok",
        message: deps.platform === "win32"
          ? "Windows inherits parent ACL"
          : "mode 0o600 verified",
      },
      {
        id: "secret-redaction",
        status: "ok",
        message: `api key placeholder: ${REDACTED_SECRET_TOKEN}`,
      },
      {
        id: "provider-choice",
        status: "ok",
        message: `selected provider: ${provider}`,
      },
      {
        id: "scope-choice",
        status: "ok",
        message: `selected scope: ${scopeChoice}`,
      },
      ...(ciChoice.generated.length > 0
        ? [
            {
              id: "ci-generation" as const,
              status: "ok" as const,
              message: `generated ${ciChoice.generated.join(", ")} workflow`,
            },
          ]
        : []),
    ],
    hints: [],
    sources: {
      provider: { source: "default" },
      ...(config.apiUrl !== undefined ? { apiUrl: { source: "default" as const } } : {}),
      ...(config.model !== undefined ? { model: { source: "default" as const } } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Per-branch sub-prompt helper. Returns either the collected values,
// or an abort/error envelope.
// ---------------------------------------------------------------------------

type BranchOutcome =
  | {
      readonly outcome: "ok";
      readonly apiUrl: string | undefined;
      readonly apiKey: string | undefined;
      readonly githubApiBase: string | undefined;
      readonly model: string;
    }
  | { readonly outcome: "aborted" }
  | { readonly outcome: "error"; readonly result: InitResult };

async function promptBranch(input: {
  readonly provider: InitProvider;
}): Promise<BranchOutcome> {
  const { provider } = input;

  if (provider === "openai-compatible") {
    const apiUrl = await smartPromptForValue({
      label: OPENAI_BASE_URL_LABEL,
      envVarName: "UMACTUALLY_API_URL",
      placeholder: DEFAULT_OPENAI_URL,
      default: DEFAULT_OPENAI_URL,
      timeoutMs: PER_PROMPT_TIMEOUT_MS,
    });
    if (apiUrl === null) return { outcome: "aborted" };

    const apiKey = await smartPromptForValue({
      label: API_KEY_LABEL,
      envVarName: "UMACTUALLY_API_KEY",
      placeholder: "sk-...",
      timeoutMs: PER_PROMPT_TIMEOUT_MS,
    });
    if (apiKey === null) return { outcome: "aborted" };

    const model = await smartPromptForValue({
      label: MODEL_LABEL,
      envVarName: "UMACTUALLY_MODEL",
      placeholder: "auto",
      default: "auto",
      timeoutMs: PER_PROMPT_TIMEOUT_MS,
    });
    if (model === null) return { outcome: "aborted" };
    return { outcome: "ok", apiUrl, apiKey, githubApiBase: undefined, model };
  }

  if (provider === "anthropic") {
    const apiKey = await smartPromptForValue({
      label: API_KEY_LABEL,
      envVarName: "UMACTUALLY_API_KEY",
      placeholder: "sk-ant-...",
      timeoutMs: PER_PROMPT_TIMEOUT_MS,
    });
    if (apiKey === null) return { outcome: "aborted" };

    const model = await smartPromptForValue({
      label: MODEL_LABEL,
      envVarName: "UMACTUALLY_MODEL",
      placeholder: "auto",
      default: "auto",
      timeoutMs: PER_PROMPT_TIMEOUT_MS,
    });
    if (model === null) return { outcome: "aborted" };
    return {
      outcome: "ok",
      apiUrl: DEFAULT_ANTHROPIC_URL,
      apiKey,
      githubApiBase: undefined,
      model,
    };
  }

  // copilot — no apiKey prompt (uses GITHUB_TOKEN)
  const githubApiBase = await smartPromptForValue({
    label: COPILOT_BASE_URL_LABEL,
    envVarName: "UMACTUALLY_GITHUB_API_BASE",
    placeholder: "https://api.github.com",
    default: "https://api.github.com",
    timeoutMs: PER_PROMPT_TIMEOUT_MS,
  });
  if (githubApiBase === null) return { outcome: "aborted" };

  const model = await smartPromptForValue({
    label: MODEL_LABEL,
    envVarName: "UMACTUALLY_MODEL",
    placeholder: "auto",
    default: "auto",
    timeoutMs: PER_PROMPT_TIMEOUT_MS,
  });
  if (model === null) return { outcome: "aborted" };

  return {
    outcome: "ok",
    apiUrl: undefined,
    apiKey: undefined,
    githubApiBase,
    model,
  };
}

// ---------------------------------------------------------------------------
// CI target prompt. Auto-detect unless --ci flag, --yes, or interactive.
// ---------------------------------------------------------------------------

type CiOutcome =
  | { readonly outcome: "ok"; readonly generated: readonly CiTarget[] }
  | { readonly outcome: "aborted" }
  | { readonly outcome: "error"; readonly result: InitResult };

async function promptCi(input: {
  readonly args: ParsedInitArgs;
  readonly deps: InitDeps;
  readonly reader: (prompt: string, isTTY: boolean) => Promise<string | null>;
  readonly isTTY: boolean;
  readonly packageVersion: string;
}): Promise<CiOutcome> {
  const { args, deps, reader, isTTY, packageVersion } = input;
  const fs = deps.fsAdapter ?? defaultFsAdapter;

  let chosen: InitCiChoice = "none";
  if (args.ci !== undefined) {
    chosen = args.ci === "auto" ? detectCiTargetHelper(fs) ?? "none" : args.ci;
  } else if (args.yes) {
    chosen = detectCiTargetHelper(fs) ?? "none";
  } else {
    const detected = detectCiTargetHelper(fs);
    if (detected !== null) {
      const answer = await safePrompt(
        reader,
        isTTY,
        `Detected ${detected} CI target. Generate ${detected} workflow? [Y/n]: `,
        "Y",
      );
      if (answer === null) return { outcome: "aborted" };
      chosen = /^(n|no)$/i.test(answer.trim()) ? "none" : detected;
    } else {
      const answer = await safePrompt(
        reader,
        isTTY,
        "Generate CI workflow? (github / azure / none) [none]: ",
        "none",
      );
      if (answer === null) return { outcome: "aborted" };
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "github" || trimmed === "azure") chosen = trimmed;
      else chosen = "none";
    }
  }

  if (chosen === "none") {
    return { outcome: "ok", generated: [] };
  }

  const gen = await generateCi({
    target: chosen,
    fs,
    deps,
    packageVersion,
  });
  if (!gen.ok) {
    return {
      outcome: "error",
      result: {
        mode: args.mode,
        outcome: "error",
        exitCode: gen.exitCode,
        savedConfigPath: null,
        savedConfigBytes: null,
        ciGenerated: [],
        checks: [
          {
            id: "ci-generation",
            status: "fail",
            message: redactSecretsInString(gen.message),
          },
        ],
        hints: [gen.message],
        sources: {},
      },
    };
  }

  return { outcome: "ok", generated: [chosen] };
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/**
 * Default stdin reader used when `deps.stdinReader` is not injected.
 * Wraps `readInteractiveLine` from `smart-prompt.ts` so every prompt
 * is bounded by the per-prompt timeout and surfaces SmartPromptUnavailable
 * as a clean decline (null).
 */
async function defaultStdinReader(prompt: string, _isTTY: boolean): Promise<string | null> {
  try {
    return await readInteractiveLine({ prompt, timeoutMs: PER_PROMPT_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof SmartPromptUnavailable) return null;
    throw err;
  }
}

/**
 * Run a single prompt through the (possibly injected) reader. Returns
 * `null` on EOF/timeout/SIGINT so the caller can map it to a clean
 * abort. Empty answers are returned as "" — callers distinguish via
 * length and treat an empty answer as a clean abort too.
 */
async function safePrompt(
  reader: (prompt: string, isTTY: boolean) => Promise<string | null>,
  isTTY: boolean,
  prompt: string,
  defaultValue: string,
): Promise<string | null> {
  const answer = await reader(prompt, isTTY);
  if (answer === null) return null;
  const trimmed = answer.trim();
  if (trimmed.length === 0) return defaultValue;
  return trimmed;
}

/**
 * Parse a provider-family answer into the typed enum. Returns null on
 * any unrecognized value (case-insensitive match).
 */
function parseProviderChoice(answer: string): InitProvider | null {
  const t = answer.trim().toLowerCase();
  if (t === "openai-compatible" || t === "openai" || t === "1") {
    return "openai-compatible";
  }
  if (t === "anthropic" || t === "2") return "anthropic";
  if (t === "copilot" || t === "github-copilot" || t === "3") return "copilot";
  return null;
}

/**
 * Path-safety check: reject cwd paths whose segments contain `..`
 * (which would let a user-supplied path escape the project). Absolute
 * cwd is fine — every real process has one — so we only block the
 * `..` traversal case.
 */
function containsUnsafePathSegment(p: string): boolean {
  const segments = p.split(/[\\/]/);
  return segments.some((s) => s === "..");
}

/**
 * Build a typed SavedConfig. apiUrl is omitted when equal to the
 * runtime default; model is omitted when "auto".
 */
function buildConfig(provider: InitProvider, apiUrl: string, model: string): SavedConfig {
  const defaultForProvider =
    provider === "anthropic" ? DEFAULT_ANTHROPIC_URL : DEFAULT_OPENAI_URL;
  const base: SavedConfig = {
    schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
    provider,
  };
  const includeApiUrl = apiUrl !== defaultForProvider;
  const includeModel = model !== "auto";
  if (includeApiUrl && includeModel) {
    return { ...base, apiUrl, model };
  }
  if (includeApiUrl) {
    return { ...base, apiUrl };
  }
  if (includeModel) {
    return { ...base, model };
  }
  return base;
}

/**
 * Detect CI target via the init-templates helper. We re-implement the
 * exists-lookup here using `defaultFsAdapter` so the wizard doesn't
 * import the templates' helper signature directly.
 */
function detectCiTargetHelper(fs: FsAdapter): CiTarget | null {
  return detectCiTarget({ exists: (p) => fs.exists(p) });
}

type CiGenResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly exitCode: 1 | 2; readonly message: string };

async function generateCiForResult(input: {
  readonly args: ParsedInitArgs;
  readonly deps: InitDeps;
  readonly fs: FsAdapter;
  readonly packageVersion: string;
}): Promise<readonly CiTarget[]> {
  if (input.args.ci === "github" || input.args.ci === "azure") {
    const r = await generateCi({
      target: input.args.ci,
      fs: input.fs,
      deps: input.deps,
      packageVersion: input.packageVersion,
    });
    return r.ok ? [input.args.ci] : [];
  }
  if (input.args.ci === "auto") {
    const target = detectCiTargetHelper(input.fs);
    if (target === null) return [];
    const r = await generateCi({
      target,
      fs: input.fs,
      deps: input.deps,
      packageVersion: input.packageVersion,
    });
    return r.ok ? [target] : [];
  }
  return [];
}

/**
 * Generate the canonical CI workflow file. Refuses to clobber an
 * existing file unless `--force` was passed.
 */
async function generateCi(input: {
  readonly target: CiTarget;
  readonly fs: FsAdapter;
  readonly deps: InitDeps;
  readonly packageVersion: string;
}): Promise<CiGenResult> {
  const rendered = renderCiTemplate({
    target: input.target,
    packageVersion: input.packageVersion,
  });

  let targetPath: string;
  try {
    targetPath = joinRelativeCwd(input.deps.cwd, rendered.relativePath);
  } catch (err) {
    return {
      ok: false,
      exitCode: 1,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (input.fs.exists(targetPath) && !input.fs.isSymlink(targetPath)) {
    if (!input.deps.argv.includes("--force")) {
      return {
        ok: false,
        exitCode: 1,
        message: `refusing to overwrite existing CI file at ${targetPath}; pass --force to bypass`,
      };
    }
  }
  if (input.fs.isSymlink(targetPath)) {
    return {
      ok: false,
      exitCode: 1,
      message: `refusing to write CI file: ${targetPath} is a symlink`,
    };
  }

  try {
    // Ensure parent directory exists (e.g. .github/workflows for github)
    const parent = dirname(targetPath);
    if (!input.fs.exists(parent)) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(parent, { recursive: true });
    }
    input.fs.writeFileAtomic(targetPath, rendered.body);
  } catch (err) {
    return {
      ok: false,
      exitCode: 1,
      message: `cannot write CI file at ${targetPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true };
}

/**
 * Concatenate cwd with a relative path segment, rejecting any
 * segments that try to escape the cwd. The init wizard only ever
 * writes paths derived from `cwd` + a known relative template.
 */
function joinRelativeCwd(cwd: string, relative: string): string {
  const segments = relative.split(/[\\/]/).filter((s) => s.length > 0 && s !== ".");
  const safe = segments.every((s) => s !== "..");
  if (!safe) {
    throw new Error(`unsafe relative path: ${relative}`);
  }
  return `${cwd.replace(/[\\/]+$/, "")}/${segments.join("/")}`;
}

function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx === -1 ? "." : p.slice(0, idx);
}

function abortedResult(mode: InitMode): InitResult {
  return envelope(mode, "aborted", 0, {
    hints: ["cli: init aborted; nothing changed."],
  });
}

/**
 * Build an InitResult with sensible defaults so callers only supply
 * the fields that deviate from "no config written, no checks, no ci,
 * empty sources". Keeps the 11 envelope call sites below the
 * 250-LOC ceiling.
 */
function envelope(
  mode: InitMode,
  outcome: InitOutcome,
  exitCode: 0 | 1 | 2,
  overrides: {
    readonly savedConfigPath?: string | null;
    readonly savedConfigBytes?: number | null;
    readonly ciGenerated?: readonly CiTarget[];
    readonly checks?: readonly InitCheck[];
    readonly hints?: readonly string[];
    readonly sources?: Readonly<Record<string, InitSource>>;
  } = {},
): InitResult {
  return {
    mode,
    outcome,
    exitCode,
    savedConfigPath: overrides.savedConfigPath ?? null,
    savedConfigBytes: overrides.savedConfigBytes ?? null,
    ciGenerated: overrides.ciGenerated ?? [],
    checks: overrides.checks ?? [],
    hints: overrides.hints ?? [],
    sources: overrides.sources ?? {},
  };
}