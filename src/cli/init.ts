// SPDX-License-Identifier: MIT
// Built-in `umactually init` subcommand.
//
// Writes a `~/.umactually/config.json` describing the provider, API
// URL, API key, and model so subsequent `umactually review`
// invocations can resolve their provider config from disk.
//
// Usage:
//   umactually init [flags]
//
// Flags:
//   --provider <openai|anthropic|copilot>  Required. Selects the provider family.
//   --apply                                Actually write the file (default: dry-run).
//   --api-url <url>                        Override the URL written to the file.
//   --api-key <key>                        Override the API key written to the file.
//   --json                                 Emit machine-readable JSON output.
//   --help, -h                             Show this help.
//
// Defaults:
//   - Dry-run unless --apply is passed or UMACTUALLY_INIT_FORCE=1.
//   - Reads UMACTUALLY_API_URL, UMACTUALLY_API_KEY, UMACTUALLY_MODEL
//     from the environment; CLI flags win over env vars.
//
// Safety:
//   - Never touches the network; init is pure-local.
//   - Refuses unknown provider values (exit 2).
//   - Refuses invocation without --provider (exit 2).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
const { join } = path;

import {
  buildInitConfig,
  INIT_PROVIDERS,
  serializeInitConfig,
  type InitConfig,
  type InitConfigDeps,
  type InitProvider,
} from "../config/init-config.js";

/** Re-exported so tests and other modules can name the config-object
 *  shape without importing from the pure-helper module. */
export type { InitConfig, InitConfigDeps, InitProvider } from "../config/init-config.js";

/** Default config directory: matches the brand used elsewhere
 *  (`~/.umactually/`). Matches uninstall.ts:549. */
export const INIT_CONFIG_DIR_NAME = ".umactually";
export const INIT_CONFIG_FILE_NAME = "config.json";

/** Result of parsing `umactually init` argv. Errors are collected
 *  rather than thrown so the CLI wrapper can format them all at once
 *  with a stable exit code. */
export type InitArgs = {
  readonly provider: string | null;
  readonly apply: boolean;
  readonly json: boolean;
  readonly help: boolean;
  readonly apiUrl: string | null;
  readonly apiKey: string | null;
  readonly errors: readonly string[];
};

/** Minimal filesystem surface that `runInit` needs. Injected so the
 *  unit tests can run without touching the real disk. */
export type InitFsAdapter = {
  readonly exists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly mkdir: (path: string) => void;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
};

/** Minimal sink interface used by runInit. `process.stdout.write`
 *  returns `boolean` (true = buffer flushed, false = buffered),
 *  while our test fakes return the byte count. Accept both via
 *  `unknown` so we don't have to wrap the real stream. */
export type InitSink = {
  write(chunk: string): unknown;
};

/** Dependency bag for `runInit`. Mirrors the dispatch.ts pattern:
 *  everything the CLI needs is injected, so the unit tests can
 *  override env, fs, stdout/stderr, and home directory. */
export type InitDeps = {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fs: InitFsAdapter;
  readonly homeDir: string;
  readonly stdout: InitSink;
  readonly stderr: InitSink;
};

/** Result returned from `runInit`. Mirrors `DispatchResult` shape so
 *  the dispatch layer can adapt this directly. */
export type InitResult = {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
};

/** Parse the argv passed to `umactually init`. Pure. */
export function parseInitArgs(argv: readonly string[]): InitArgs {
  const errors: string[] = [];
  let provider: string | null = null;
  let apply = false;
  let json = false;
  let help = false;
  let apiUrl: string | null = null;
  let apiKey: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    switch (arg) {
      case "--help":
      case "-h":
        help = true;
        break;
      case "--apply":
        apply = true;
        break;
      case "--json":
        json = true;
        break;
      case "--provider": {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("-")) {
          errors.push("--provider requires a value (one of openai|anthropic|copilot)");
        } else {
          provider = next;
          i += 1;
        }
        break;
      }
      case "--api-url": {
        const next = argv[i + 1];
        if (next === undefined) {
          errors.push("--api-url requires a value");
        } else {
          apiUrl = next;
          i += 1;
        }
        break;
      }
      case "--api-key": {
        const next = argv[i + 1];
        if (next === undefined) {
          errors.push("--api-key requires a value");
        } else {
          apiKey = next;
          i += 1;
        }
        break;
      }
      default:
        if (arg.startsWith("-")) {
          errors.push(`unknown flag: ${arg}`);
        } else {
          errors.push(`unexpected positional arg: ${arg}`);
        }
    }
  }

  if (provider === null && !help) {
    errors.push(
      `missing required flag: --provider <openai|anthropic|copilot>`,
    );
  } else if (provider !== null && !INIT_PROVIDERS.includes(provider as InitProvider)) {
    errors.push(
      `invalid --provider value: ${provider} (expected one of ${INIT_PROVIDERS.join("|")})`,
    );
  }

  return { provider, apply, json, help, apiUrl, apiKey, errors };
}

/** Resolve the config directory under `homeDir`. Pure path math —
 *  exported for unit tests. */
export function resolveConfigDir(homeDir: string): string {
  return join(homeDir, INIT_CONFIG_DIR_NAME);
}

/** Resolve the full config file path. */
export function resolveConfigPath(homeDir: string): string {
  return join(resolveConfigDir(homeDir), INIT_CONFIG_FILE_NAME);
}

/** Human-readable serialization for stdout. Stable order:
 *  provider, apiUrl, apiKey, model. */
export function formatInitConfig(config: InitConfig): string {
  return `${serializeInitConfig(config)}\n`;
}

/** Render the dry-run preview: a short banner + the JSON the file
 *  WOULD contain. The banner says "dry-run" so the operator can't
 *  mistake the output for a successful apply. */
function formatDryRunPreview(configPath: string, config: InitConfig): string {
  const banner = `# dry-run: would write ${configPath}\n`;
  return `${banner}${formatInitConfig(config)}`;
}

/** The JSON envelope emitted by `--json`. Falls back to a simple
 *  `{ command, ok, data }` shape until M1's `src/util/envelope.ts`
 *  lands — at which point the dispatch layer can swap to the
 *  canonical EnvelopeV1 producer. */
function buildJsonEnvelope(args: {
  readonly ok: boolean;
  readonly applied: boolean;
  readonly configPath: string;
  readonly config: InitConfig;
  readonly error?: string;
}): string {
  return `${JSON.stringify({
    command: "init",
    ok: args.ok,
    data: {
      applied: args.applied,
      dryRun: !args.applied,
      configPath: args.configPath,
      provider: args.config.provider,
      config: args.config,
      ...(args.error === undefined ? {} : { error: args.error }),
    },
  })}\n`;
}

export const INIT_HELP_TEXT = [
  "umactually init — write ~/.umactually/config.json so `umactually review`",
  "can resolve its provider config from disk.",
  "",
  "Usage:",
  "  umactually init --provider <openai|anthropic|copilot> [flags]",
  "  umactually init --help",
  "",
  "Flags:",
  "  --provider <openai|anthropic|copilot>   Required. Selects the provider family.",
  "  --apply                                 Actually write the config file. Without this flag,",
  "                                          init is a dry-run: it prints what it would write",
  "                                          and exits 0 without touching the filesystem.",
  "                                          UMACTUALLY_INIT_FORCE=1 also enables apply.",
  "  --api-url <url>                         Override UMACTUALLY_API_URL for this file only.",
  "  --api-key <key>                         Override UMACTUALLY_API_KEY for this file only.",
  "  --json                                  Emit machine-readable JSON output.",
  "  --help, -h                              Show this help.",
  "",
  "The config file is a JSON object with the keys `provider`, `apiUrl`,",
  "`apiKey`, and `model` (only the keys with non-empty values are written).",
  "",
  "Examples:",
  "  umactually init --provider openai --dry-run        # preview, no write",
  "  umactually init --provider openai --apply          # actually write the file",
  "  UMACTUALLY_INIT_FORCE=1 umactually init --provider openai",
  "",
  "Exit codes:",
  "  0  Dry-run succeeded (or --apply succeeded)",
  "  2  Usage error (missing --provider, unknown provider, unknown flag)",
].join("\n");

/** Read the existing config (if any) and return it as a parsed object,
 *  or `null` if the file does not exist or cannot be read. Used by
 *  the dry-run preview so the operator can see what would change. */
function readExistingConfig(fs: InitFsAdapter, configPath: string): Record<string, unknown> | null {
  if (!fs.exists(configPath)) {
    return null;
  }
  try {
    const raw = fs.readFile(configPath);
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** The main entry point. Reads the deps, parses args, builds the
 *  config, and either writes the file (when --apply or
 *  UMACTUALLY_INIT_FORCE=1) or just prints the dry-run preview. */
export async function runInit(deps: InitDeps): Promise<InitResult> {
  const args = parseInitArgs(deps.argv);

  if (args.help) {
    deps.stdout.write(`${INIT_HELP_TEXT}\n`);
    return { exitCode: 0, stdout: `${INIT_HELP_TEXT}\n` };
  }

  if (args.errors.length > 0) {
    const message = `umactually init: ${args.errors.join("; ")}\n`;
    deps.stderr.write(message);
    return { exitCode: 2, stderr: message };
  }

  const envForce = deps.env["UMACTUALLY_INIT_FORCE"] === "1"
    || deps.env["UMACTUALLY_INIT_FORCE"] === "true";
  const apply = args.apply || envForce;

  const configDeps: InitConfigDeps = {
    args: {
      provider: args.provider,
      apply,
      json: args.json,
      help: false,
      apiUrl: args.apiUrl,
      apiKey: args.apiKey,
    },
    env: deps.env,
  };
  const config = buildInitConfig(configDeps);
  const configPath = resolveConfigPath(deps.homeDir);

  if (!apply) {
    const existing = readExistingConfig(deps.fs, configPath);
    const existingNote = existing === null
      ? "(no existing file)"
      : `(existing file: ${JSON.stringify(existing)})`;
    const preview = formatDryRunPreview(configPath, config);
    if (args.json) {
      const envelope = buildJsonEnvelope({
        ok: true,
        applied: false,
        configPath,
        config,
      });
      deps.stdout.write(envelope);
      return { exitCode: 0, stdout: envelope, stderr: existingNote };
    }
    deps.stdout.write(`${preview}# ${existingNote}\n`);
    return { exitCode: 0, stdout: preview };
  }

  // Apply path: ensure the config directory exists, then write the
  // file. We deliberately use a single writeFile (not atomic
  // temp+rename) because the on-disk config is not concurrency-sensitive
  // — the file is only ever touched by the operator running `init`,
  // and a crash mid-write leaves a JSON.parse-able file (the OS
  // guarantees writeFileSync is all-or-nothing for files smaller than
  // PIPE_BUF, and our config is always tiny).
  const configDir = resolveConfigDir(deps.homeDir);
  if (!deps.fs.exists(configDir) && !deps.fs.isDirectory(configDir)) {
    deps.fs.mkdir(configDir);
  }
  const payload = `${formatInitConfig(config)}`;
  deps.fs.writeFile(configPath, payload);

  if (args.json) {
    const envelope = buildJsonEnvelope({
      ok: true,
      applied: true,
      configPath,
      config,
    });
    deps.stdout.write(envelope);
    return { exitCode: 0, stdout: envelope };
  }
  const message = `wrote ${configPath}\n${payload}`;
  deps.stdout.write(message);
  return { exitCode: 0, stdout: message };
}

/** Production-mode entry: builds the deps from the live process and
 *  delegates to `runInit`. The dispatch layer calls this so the
 *  CLI is wired up exactly the same way as `uninstall`. */
export async function runInitFromArgv(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  stdout: InitSink = process.stdout,
  stderr: InitSink = process.stderr,
  homeDir: string = homedir(),
  fs: InitFsAdapter = defaultInitFsAdapter,
): Promise<InitResult> {
  return runInit({ argv, env, fs, homeDir, stdout, stderr });
}

/** Default fs adapter for the production entry. Kept tiny — the
 *  production CLI doesn't need atomic rename semantics for the
 *  config file. */
export const defaultInitFsAdapter: InitFsAdapter = {
  exists: (target) => {
    try {
      return existsSync(target);
    } catch {
      return false;
    }
  },
  isDirectory: (target) => {
    try {
      return statSync(target).isDirectory();
    } catch {
      return false;
    }
  },
  mkdir: (target) => {
    mkdirSync(target, { recursive: true });
  },
  readFile: (target) => {
    return readFileSync(target, "utf8");
  },
  writeFile: (target, content) => {
    writeFileSync(target, content, "utf8");
  },
};
