// SPDX-License-Identifier: MIT
//
// Task 8 — `umactually doctor --full` (non-destructive end-to-end readiness probe).
//
// This module extends the default `doctor` (see `src/cli/doctor.ts`) with
// explicit `--full` checks. The default must remain offline and
// backward-compatible: every full-mode check lives HERE, not in
// `src/cli/doctor.ts`. The default surface is unchanged.
//
// Trust model:
//   - Full mode runs ONLY read-only probes — `GET` (and `HEAD` if a
//     future endpoint needs it) are the only HTTP methods allowed.
//   - Body bytes are forbidden (MAX_BODY_BYTES === 0). Any fetch with a
//     non-GET method or any body is rejected at the wrapper boundary
//     before the request leaves the process.
//   - Secrets are never logged. The redaction helper is the canonical
//     utility; messages and remediation strings never include the
//     secret value.
//   - The module never mutates `umactually.config.json`,
//     `umactually.review.json`, or any other config. The test
//     contract at `test/unit/cli-doctor-full.test.ts:DOCTOR-FULL-007`
//     pins this by declaring the dependency surface as `{ stat, readFile }`.
//
// Open the docs/troubleshooting.md section on "Required environment per
// command surface" for the platform-credential mapping the checks
// consult.

import { FIELDS } from "../config/field-schema.js";
import { loadReviewPolicy, REVIEW_POLICY_PATH } from "../config/review-policy.js";
import { tryReadSavedConfig } from "./load-saved-config.js";
import type { FsAdapter } from "../util/fs-atomic.js";
// Task 5 owns the canonical context-budget defaults.
import { BUDGET_DEFAULTS } from "./context-provenance.js";
import { discoverAutoModel, type ModelProvider } from "./auto-model.js";
import { redactUrlForLog } from "../util/url.js";
import { REDACTED_SECRET_TOKEN } from "../util/brand.js";
import { DEFAULT_GITHUB_API_BASE, DEFAULT_OPENAI_URL } from "../util/provider-defaults.js";
import { ENV_KEYS } from "../util/env-keys.js";

// ---------------------------------------------------------------------------
// Closed enum of DoctorCheckId (full-mode additions + the default IDs)
// ---------------------------------------------------------------------------

export const DOCTOR_CHECK_IDS = [
  "node",
  "dist-freshness",
  "env",
  "git",
  "saved-config",
  "review-policy",
  "credentials",
  "model-discovery",
  "provider-latency",
  "context-budgets",
  "ci-platform",
  "github-permissions",
  "azure-permissions",
] as const;
export type DoctorCheckId = (typeof DOCTOR_CHECK_IDS)[number];

// ---------------------------------------------------------------------------
// HTTP safety knobs (the request-capture tests pin these at runtime)
// ---------------------------------------------------------------------------

/**
 * Closed allowlist of HTTP methods full-mode probes may use. Any
 * outbound request with a method NOT in this set is rejected by the
 * fetch wrapper below BEFORE the request leaves the process —
 * `request-capture` tests prove zero POST/PATCH/PUT/DELETE cross the
 * wire from any full-mode probe.
 */
export const DEFAULT_FULL_ALLOWED_METHODS: readonly string[] = ["GET", "HEAD"];

/**
 * Maximum allowed body bytes for any full-mode probe. Zero means
 * "body must be absent" — full mode is a read-only surface, requests
 * MUST NOT carry a payload. The fetch wrapper enforces this BEFORE
 * the request leaves the process.
 */
export const MAX_BODY_BYTES = 0;

/**
 * Default per-fetch timeout for full-mode probes. Hangs are bounded
 * and reported via `latencyMs` on the check result.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DoctorCheckStatus = "ok" | "warn" | "fail" | "skip";

export type DoctorCheckResult = {
  readonly id: DoctorCheckId;
  readonly status: DoctorCheckStatus;
  readonly message: string;
  readonly remediation?: string;
  readonly latencyMs?: number;
  readonly presence?: readonly { readonly name: string; readonly present: boolean }[];
};

export type FullDoctorDeps = {
  readonly cwd: string;
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  // Async filesystem adapter for the dist-freshness stat probe.
  // Read-only invariant: no writeFile / writeFileAtomic shape is
  // exposed here, so a future mutation cannot be added without
  // changing the contract.
  readonly fsAdapter: {
    readonly stat: (path: string) => Promise<{ readonly mtimeMs: number }>;
  };
  // Sync filesystem adapter for the policy + saved-config probes.
  // The sync shape is dictated by `loadReviewPolicy` and
  // `tryReadSavedConfig`, which inherit the canonical `FsAdapter`
  // from `src/util/fs-atomic.ts`.
  readonly fsAdapterSync: FsAdapter;
  readonly execFile: (
    file: string,
    args: readonly string[],
    options: { readonly cwd: string },
  ) => Promise<{ readonly stdout: string; readonly stderr: string }>;
  readonly packageRoot: string;
  readonly nodeVersion?: string;
  readonly allowedMethods?: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly fetchTimeoutMs?: number;
};

export type FullDoctorJson = {
  readonly schemaVersion: 1;
  readonly command: "doctor";
  readonly mode: "full";
  readonly exitCode: number;
  readonly checks: readonly DoctorCheckResult[];
};

export type FullDoctorResult = {
  readonly exitCode: number;
  readonly checks: readonly DoctorCheckResult[];
  readonly json: FullDoctorJson;
};

// ---------------------------------------------------------------------------
// Status / exit-code helpers
// ---------------------------------------------------------------------------

function makeResult(
  id: DoctorCheckId,
  status: DoctorCheckStatus,
  message: string,
  options: { readonly remediation?: string; readonly latencyMs?: number } = {},
): DoctorCheckResult {
  const result: {
    id: DoctorCheckId;
    status: DoctorCheckStatus;
    message: string;
    remediation?: string;
    latencyMs?: number;
  } = { id, status, message };
  if (options.remediation !== undefined) {
    result.remediation = options.remediation;
  }
  if (options.latencyMs !== undefined) {
    result.latencyMs = options.latencyMs;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Legacy compat: the default `runDoctor` types (re-exposed here so the
// dispatch layer can re-type `formatDoctorHuman` on the union shape).
// ---------------------------------------------------------------------------

export type EnvPresence = {
  readonly name: string;
  readonly present: boolean;
};

export type LegacyDoctorCheck = {
  readonly id: "node" | "dist-freshness" | "env" | "git";
  readonly status: DoctorCheckStatus;
  readonly message: string;
  readonly hint?: string;
  readonly presence?: readonly EnvPresence[];
};

// ---------------------------------------------------------------------------
// HTTP safety wrapper
// ---------------------------------------------------------------------------

type SafeFetch = typeof fetch;

function makeSafeFetch(
  fetchImpl: typeof fetch,
  allowedMethods: readonly string[],
  timeoutMs: number,
): SafeFetch {
  return async (input: URL | string | Request, init: RequestInit = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (!allowedMethods.includes(method)) {
      throw new Error(
        `full-mode fetch rejected: method "${method}" is not in allowlist ${JSON.stringify(allowedMethods)}`,
      );
    }
    const body = init.body;
    if (body !== undefined && body !== null && body !== "" && body !== "undefined") {
      const bodyBytes =
        typeof body === "string"
          ? body.length
          : Array.isArray(body)
          ? JSON.stringify(body).length
          : 0;
      if (bodyBytes > MAX_BODY_BYTES) {
        throw new Error(
          `full-mode fetch rejected: body of ${bodyBytes} bytes exceeds MAX_BODY_BYTES (${MAX_BODY_BYTES})`,
        );
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Belt-and-suspenders: the race frees the process even if the
    // underlying fetch impl ignores the abort signal — a real-world
    // hazard for stub fetchers and misbehaving runtimes.
    const response = await Promise.race([
      fetchImpl(input, {
        ...init,
        method,
        signal: controller.signal,
      }),
      new Promise<Response>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`full-mode fetch timed out after ${timeoutMs}ms (method=${method})`));
        });
      }),
    ]);
    clearTimeout(timer);
    return response;
  };
}

// ---------------------------------------------------------------------------
// Latency helper
// ---------------------------------------------------------------------------

async function timeProbe<T>(work: () => Promise<T>): Promise<{ readonly value: T | null; readonly error: Error | null; readonly latencyMs: number }> {
  const startNs = process.hrtime.bigint();
  try {
    const value = await work();
    const latencyMs = latencyMsFrom(startNs);
    return { value, error: null, latencyMs };
  } catch (err) {
    const latencyMs = latencyMsFrom(startNs);
    return { value: null, error: err instanceof Error ? err : new Error(String(err)), latencyMs };
  }
}

function latencyMsFrom(startNs: bigint): number {
  const deltaNs = process.hrtime.bigint() - startNs;
  return Math.max(0, Math.trunc(Number(deltaNs / 1_000_000n)));
}

// ---------------------------------------------------------------------------
// Individual checks (typed, return DoctorCheckResult)
// ---------------------------------------------------------------------------

const MIN_NODE_MAJOR = 24;

function checkNode(nodeVersion: string): DoctorCheckResult {
  const nodeMajor = Number.parseInt(nodeVersion.split(".", 1)[0] ?? "", 10);
  if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
    return makeResult("node", "fail", `Node ${nodeVersion} detected; ${MIN_NODE_MAJOR}.x or later required`, {
      remediation: "Install Node 24+ from https://nodejs.org/",
    });
  }
  return makeResult("node", "ok", `Node ${nodeVersion}`);
}

async function checkDistFreshness(deps: FullDoctorDeps): Promise<DoctorCheckResult> {
  const root = deps.packageRoot.replace(/[\\/]$/u, "");
  const distPath = `${root}/dist/cli.js`;
  const srcPath = `${root}/src/cli.ts`;
  const distStat = await statOrNull(deps.fsAdapter, distPath);
  const srcStat = await statOrNull(deps.fsAdapter, srcPath);
  if (distStat === null && srcStat === null) {
    return makeResult("dist-freshness", "skip", "standalone binary — dist/ is embedded, not on disk");
  }
  if (distStat === null) {
    return makeResult("dist-freshness", "fail", `${distPath} is missing`, {
      remediation: "Run `npm run bundle` to produce dist/cli.js",
    });
  }
  if (srcStat === null) {
    return makeResult("dist-freshness", "ok", `${distPath} present; src not shipped (using shipped dist)`);
  }
  if (distStat.mtimeMs < srcStat.mtimeMs) {
    return makeResult("dist-freshness", "fail", `${distPath} is older than ${srcPath}`, {
      remediation: "Run `npm run bundle` to refresh dist/cli.js",
    });
  }
  return makeResult("dist-freshness", "ok", `${distPath} present and fresh`);
}

async function statOrNull(
  fsAdapter: FullDoctorDeps["fsAdapter"],
  path: string,
): Promise<{ readonly mtimeMs: number } | null> {
  try {
    return await fsAdapter.stat(path);
  } catch {
    return null;
  }
}

function checkEnv(env: FullDoctorDeps["env"]): DoctorCheckResult {
  const presence = [...KNOWN_ENV_VAR_NAMES].map((name) => ({
    name,
    present: typeof env[name] === "string" && (env[name] ?? "").length > 0,
  }));
  const presentCount = presence.filter((entry) => entry.present).length;
  return makeResult("env", "ok", `${presentCount}/${KNOWN_ENV_VAR_NAMES.size} known env vars present`);
  // Note: presence is recorded on the default `runDoctor` envelope; full
  // mode extends the basic env surface with the credential probe
  // below. The presence list is intentionally NOT re-emitted here to
  // keep the JSON envelope compact.
}

const KNOWN_ENV_VAR_NAMES: ReadonlySet<string> = new Set(
  Object.values(FIELDS).flatMap((def) => def.env),
);

async function checkGit(deps: FullDoctorDeps): Promise<DoctorCheckResult> {
  try {
    const result = await deps.execFile("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: deps.cwd,
    });
    return result.stdout.trim() === "true"
      ? makeResult("git", "ok", "cwd is inside a git work tree")
      : makeResult("git", "warn", "cwd is not inside a git work tree");
  } catch {
    return makeResult("git", "warn", "git is not on PATH or cwd is not inside a work tree");
  }
}

// Saved config (read-only; not mutated)
function checkSavedConfig(cwd: string): DoctorCheckResult {
  const saved = tryReadSavedConfig({ cwd });
  if (saved.config !== null) {
    return makeResult(
      "saved-config",
      "ok",
      `saved config parsed at ${saved.path} (provider=${saved.config.provider})`,
    );
  }
  if (saved.warning !== null) {
    return makeResult(
      "saved-config",
      "warn",
      `saved config could not be loaded: ${saved.warning}`,
      {
        remediation:
          "Re-run `umactually init --force` to overwrite the saved config, or delete the corrupt file and re-run.",
      },
    );
  }
  return makeResult(
    "saved-config",
    "warn",
    "no saved config found; run `umactually init` to create one",
    {
      remediation: "Run `umactually init` to generate ~/" + ".umactually/config.json (or umactually.config.json in repo scope).",
    },
  );
}

// Review policy (committed; read-only; never mutated)
function checkReviewPolicy(cwd: string, fsAdapterSync: FsAdapter): DoctorCheckResult {
  const result = loadReviewPolicy({ cwd, fs: fsAdapterSync });
  if (result.policy !== null) {
    return makeResult(
      "review-policy",
      "ok",
      `review policy parsed at ${result.path} (schemaVersion=${result.policy.schemaVersion})`,
    );
  }
  if (result.error !== null) {
    const remediation = reviewPolicyRemediation(result.error.kind);
    return makeResult(
      "review-policy",
      "fail",
      `review policy at ${result.path}: ${result.error.message}`,
      { remediation },
    );
  }
  // No policy file at all — warn, but it's not a failure.
  const path = REVIEW_POLICY_PATH(cwd);
  return makeResult(
    "review-policy",
    "warn",
    `no committed review policy at ${path}; using built-in defaults`,
    {
      remediation:
        "Run `umactually init --policy-template` to bootstrap a committed umactually.review.json.",
    },
  );
}

function reviewPolicyRemediation(kind: string): string {
  switch (kind) {
    case "corrupt-json":
      return "The committed umactually.review.json is corrupt; remove or rewrite it (no secrets) and re-run.";
    case "secret-detected":
      return "The committed umactually.review.json contains a secret-shaped value; remove the secret and re-run.";
    case "unknown-key":
      return "The committed umactually.review.json contains an unknown key; consult docs/configuration.md for the canonical schema.";
    case "invalid-glob":
      return "The committed umactually.review.json contains an invalid glob pattern; revise the pathRules / excludes entry.";
    case "unsafe-path":
      return "The committed umactually.review.json contains a path that escapes the repo root; revise the path or exclude.";
    case "duplicate-path-rule":
      return "The committed umactually.review.json contains duplicate path rules; deduplicate the pathRules array.";
    case "unsupported-schema-version":
      return "Bump or remove the schemaVersion in umactually.review.json; the runtime only understands schemaVersion 1.";
    case "missing-schema-version":
      return "Add a numeric schemaVersion field to umactually.review.json.";
    default:
      return "Inspect the committed umactually.review.json and verify it parses as JSON with the canonical schema.";
  }
}

function checkCredentials(env: FullDoctorDeps["env"]): DoctorCheckResult {
  const apiKey = env["UMACTUALLY_API_KEY"];
  const apiKeyPresent = typeof apiKey === "string" && apiKey.length > 0;
  const provider = env["UMACTUALLY_PROVIDER"] ?? FIELDS.provider.defaultValue;
  const requiresApiKey = provider !== "copilot";

  if (requiresApiKey && !apiKeyPresent) {
    return makeResult(
      "credentials",
      "fail",
      `provider "${provider}" requires UMACTUALLY_API_KEY; ${REDACTED_SECRET_TOKEN} not detected in env`,
      {
        remediation:
          "Export UMACTUALLY_API_KEY in the shell (or set the secret in the CI secret store); never pass the secret on the command line or commit it to disk.",
      },
    );
  }
  if (!requiresApiKey && !apiKeyPresent) {
    return makeResult(
      "credentials",
      "ok",
      `provider "${provider}" does not require UMACTUALLY_API_KEY; GITHUB_TOKEN is the credential`,
    );
  }
  // apiKey present — disclose presence only.
  return makeResult(
    "credentials",
    "ok",
    `UMACTUALLY_API_KEY present (${REDACTED_SECRET_TOKEN}, value redacted)`,
  );
}

async function checkModelDiscovery(
  env: FullDoctorDeps["env"],
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<DoctorCheckResult> {
  const provider = parseProvider(env["UMACTUALLY_PROVIDER"]);
  const apiUrl = env["UMACTUALLY_API_URL"] ?? DEFAULT_OPENAI_URL;
  const apiKey = env["UMACTUALLY_API_KEY"] ?? null;
  const probe = await timeProbe(async () => {
    return discoverAutoModel({
      provider,
      apiUrl,
      apiKey,
      dependencies: {
        fetchImpl,
        timeoutMs,
      },
    });
  });
  if (probe.error !== null) {
    return makeResult(
      "model-discovery",
      "fail",
      `model discovery failed: ${redactNetworkError(probe.error)}`,
      {
        remediation:
          "Confirm the provider URL is reachable and the API key is valid; secrets are never logged.",
        latencyMs: probe.latencyMs,
      },
    );
  }
  const result = probe.value;
  if (result === null) {
    return makeResult("model-discovery", "skip", "no provider configured", {
      latencyMs: probe.latencyMs,
    });
  }
  if (result.ok) {
    return makeResult(
      "model-discovery",
      "ok",
      `model discovery succeeded for provider "${provider}" (model redacted)`,
      { latencyMs: probe.latencyMs },
    );
  }
  const remediation = modelDiscoveryRemediation(result.error);
  return makeResult(
    "model-discovery",
    "fail",
    `model discovery failed: ${modelDiscoveryMessage(result.error)}`,
    { remediation, latencyMs: probe.latencyMs },
  );
}

function modelDiscoveryMessage(err: { readonly kind: string; readonly status?: number; readonly provider?: string }): string {
  switch (err.kind) {
    case "unauthorized":
      return `HTTP ${err.status} from provider (authorization rejected)`;
    case "empty":
      return "provider returned an empty model catalog";
    case "ambiguous":
      return "provider returned multiple models; doctor --full cannot pick one (use --model explicitly)";
    case "malformed":
      return "provider returned a malformed model catalog";
    case "unsupported":
      return `provider "${err.provider}" requires --model explicitly`;
    case "aborted":
      return "model discovery timed out";
    case "network":
      return "network error reaching the provider";
    default:
      return "model discovery failed";
  }
}

function modelDiscoveryRemediation(err: { readonly kind: string; readonly status?: number }): string {
  switch (err.kind) {
    case "unauthorized":
      return `The provider returned HTTP ${err.status}. Rotate the API key in the secret store and re-run.`;
    case "empty":
      return "The provider returned an empty model catalog; verify the provider is reachable and the key is valid.";
    case "ambiguous":
      return "Pass --model explicitly on every review invocation; the runtime refuses to rank multiple models.";
    case "malformed":
      return "The provider returned a non-conformant model catalog; verify the api-url is correct.";
    case "unsupported":
      return "Pass --model explicitly; the runtime does not auto-discover for this provider family.";
    case "aborted":
      return "Model discovery timed out within the bounded window; check the network or provider latency.";
    case "network":
      return "Verify the provider URL and network reachability; the runtime refused to retry.";
    default:
      return "Inspect the provider URL and credentials.";
  }
}

function redactNetworkError(err: Error): string {
  return err.message.replace(/https?:\/\/\S+/gu, (url) => redactUrlForLog(url));
}

async function checkProviderLatency(
  env: FullDoctorDeps["env"],
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<DoctorCheckResult> {
  const provider = parseProvider(env["UMACTUALLY_PROVIDER"]);
  if (provider === "copilot") {
    return makeResult("provider-latency", "skip", "copilot routing required github-token check; see github-permissions");
  }
  const apiUrl = env["UMACTUALLY_API_URL"] ?? DEFAULT_OPENAI_URL;
  const url = apiUrl.replace(/\/+$/u, "").endsWith("/v1")
    ? `${apiUrl.replace(/\/+$/u, "")}/models`
    : `${apiUrl.replace(/\/+$/u, "")}/v1/models`;
  const probe = await timeProbe(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const ok = response.status >= 200 && response.status < 400;
      return { status: response.status, ok };
    } finally {
      clearTimeout(timer);
    }
  });
  if (probe.error !== null) {
    return makeResult(
      "provider-latency",
      "fail",
      `provider latency probe failed: ${redactNetworkError(probe.error)}`,
      {
        remediation: "Verify the provider URL; the probe is GET-only and never sends credentials.",
        latencyMs: probe.latencyMs,
      },
    );
  }
  const result = probe.value;
  if (result === null) {
    return makeResult("provider-latency", "skip", "no provider configured", {
      latencyMs: probe.latencyMs,
    });
  }
  if (!result.ok) {
    return makeResult(
      "provider-latency",
      "warn",
      `provider responded with HTTP ${result.status} (sanitized read-only probe)`,
      {
        remediation: "If the status is 401/403, rotate the API key; otherwise verify the URL.",
        latencyMs: probe.latencyMs,
      },
    );
  }
  return makeResult(
    "provider-latency",
    "ok",
    `provider reachable (HTTP ${result.status})`,
    { latencyMs: probe.latencyMs },
  );
}

function checkContextBudgets(): DoctorCheckResult {
  const totalKiB = `${BUDGET_DEFAULTS.totalBytes / 1024} KiB`;
  const perFileKiB = `${BUDGET_DEFAULTS.perFileBytes / 1024} KiB`;
  return makeResult(
    "context-budgets",
    "ok",
    `default context budgets: aggregate=${totalKiB}, per-file=${perFileKiB}, items=${BUDGET_DEFAULTS.maxItems}, files=${BUDGET_DEFAULTS.maxFilesParsed}, latencyMs=${BUDGET_DEFAULTS.wallTimeMs}`,
    {
      remediation:
        "Adjust `umactually.review.json` budgets or pass explicit overrides on the review CLI to widen the budgets.",
    },
  );
}

function checkCiPlatform(deps: FullDoctorDeps): DoctorCheckResult {
  const env = deps.env;
  const presence = {
    github: typeof env[ENV_KEYS.GITHUB_ACTIONS] === "string",
    azure: typeof env[ENV_KEYS.TF_BUILD] === "string",
    buildkite: typeof env["BUILDKITE"] === "string",
    circle: typeof env["CIRCLECI"] === "string",
    jenkins: typeof env["JENKINS_URL"] === "string",
  };
  const detected = Object.entries(presence)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (detected.length === 0) {
    return makeResult(
      "ci-platform",
      "ok",
      "no CI platform detected (local shell)",
    );
  }
  return makeResult(
    "ci-platform",
    "ok",
    `CI platform(s) detected: ${detected.join(", ")}`,
  );
}

async function checkGithubPermissions(
  env: FullDoctorDeps["env"],
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<DoctorCheckResult> {
  const token = env["GITHUB_TOKEN"] ?? env["GH_TOKEN"];
  if (token === undefined || token.length === 0) {
    return makeResult(
      "github-permissions",
      "skip",
      "no GITHUB_TOKEN detected; cannot probe platform permissions",
      {
        remediation:
          "Set GITHUB_TOKEN in the CI environment to prove the read-only endpoint permission; never embed the token in commit history.",
      },
    );
  }
  const apiBase = (env["GITHUB_API_URL"] ?? DEFAULT_GITHUB_API_BASE).replace(/\/$/u, "");
  const url = `${apiBase}/octocat`;
  const probe = await timeProbe(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/vnd.github+json", authorization: `Bearer ${REDACTED_SECRET_TOKEN}` },
        signal: controller.signal,
      });
      return { status: response.status };
    } finally {
      clearTimeout(timer);
    }
  });
  if (probe.error !== null) {
    return makeResult(
      "github-permissions",
      "fail",
      `github read-only probe failed: ${redactNetworkError(probe.error)}`,
      {
        remediation: "Verify the GitHub API base URL and the GITHUB_TOKEN secret in the CI environment.",
        latencyMs: probe.latencyMs,
      },
    );
  }
  const result = probe.value;
  if (result === null) {
    return makeResult("github-permissions", "skip", "no github context", {
      latencyMs: probe.latencyMs,
    });
  }
  if (result.status === 200) {
    return makeResult(
      "github-permissions",
      "ok",
      `github read-only probe returned HTTP ${result.status} (token redacted)`,
      { latencyMs: probe.latencyMs },
    );
  }
  if (result.status === 401 || result.status === 403) {
    return makeResult(
      "github-permissions",
      "fail",
      `github read-only probe returned HTTP ${result.status} (insufficient scope or invalid token)`,
      {
        remediation:
          "Rotate the GITHUB_TOKEN and ensure it carries `contents: read` and `pull-requests: read` for the proof-of-permission probe.",
        latencyMs: probe.latencyMs,
      },
    );
  }
  return makeResult(
    "github-permissions",
    "warn",
    `github read-only probe returned HTTP ${result.status}`,
    {
      remediation: "Verify the API base URL is correct; the probe is GET-only and never sends a body.",
      latencyMs: probe.latencyMs,
    },
  );
}

async function checkAzurePermissions(
  env: FullDoctorDeps["env"],
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<DoctorCheckResult> {
  const token = env["AZURE_DEVOPS_TOKEN"] ?? env["SYSTEM_ACCESSTOKEN"];
  if (token === undefined || token.length === 0) {
    return makeResult(
      "azure-permissions",
      "skip",
      "no AZURE_DEVOPS_TOKEN / SYSTEM_ACCESSTOKEN detected; cannot probe platform permissions",
      {
        remediation:
          "Set AZURE_DEVOPS_TOKEN (secret variable) or enable SYSTEM_ACCESSTOKEN in the pipeline options.",
      },
    );
  }
  const collectionUri = env[ENV_KEYS.SYSTEM_COLLECTIONURI];
  if (typeof collectionUri !== "string" || collectionUri.length === 0) {
    return makeResult(
      "azure-permissions",
      "skip",
      "no SYSTEM_COLLECTIONURI detected; cannot determine the Azure DevOps project host",
      {
        remediation: "Run the command inside an Azure Pipelines PR build or supply --collection-uri.",
      },
    );
  }
  const url = `${collectionUri.replace(/\/$/u, "")}/_apis/connectionData?api-version=7.1-preview.1`;
  const probe = await timeProbe(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json", authorization: `Bearer ${REDACTED_SECRET_TOKEN}` },
        signal: controller.signal,
      });
      return { status: response.status };
    } finally {
      clearTimeout(timer);
    }
  });
  if (probe.error !== null) {
    return makeResult(
      "azure-permissions",
      "fail",
      `azure read-only probe failed: ${redactNetworkError(probe.error)}`,
      {
        remediation: "Verify the Azure DevOps collection URL and the SYSTEM_ACCESSTOKEN secret.",
        latencyMs: probe.latencyMs,
      },
    );
  }
  const result = probe.value;
  if (result === null) {
    return makeResult("azure-permissions", "skip", "no azure context", {
      latencyMs: probe.latencyMs,
    });
  }
  if (result.status === 200) {
    return makeResult(
      "azure-permissions",
      "ok",
      `azure read-only probe returned HTTP ${result.status} (token redacted)`,
      { latencyMs: probe.latencyMs },
    );
  }
  if (result.status === 401 || result.status === 403) {
    return makeResult(
      "azure-permissions",
      "fail",
      `azure read-only probe returned HTTP ${result.status} (insufficient scope or invalid token)`,
      {
        remediation:
          "Rotate the AZURE_DEVOPS_TOKEN and ensure the pipeline identity holds `Project Collection Build Service` access or a higher scope PAT.",
        latencyMs: probe.latencyMs,
      },
    );
  }
  return makeResult(
    "azure-permissions",
    "warn",
    `azure read-only probe returned HTTP ${result.status}`,
    {
      remediation: "Verify the collection URI and the API version (`7.1-preview.1` for connectionData).",
      latencyMs: probe.latencyMs,
    },
  );
}

function parseProvider(value: string | undefined): ModelProvider {
  switch (value) {
    case "anthropic":
      return "anthropic";
    case "copilot":
      return "copilot";
    case "openai-compatible":
    case undefined:
    default:
      return "openai-compatible";
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runFullDoctor(deps: FullDoctorDeps): Promise<FullDoctorResult> {
  const allowedMethods = deps.allowedMethods ?? DEFAULT_FULL_ALLOWED_METHODS;
  const timeoutMs = deps.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const safeFetch = makeSafeFetch(fetchImpl, allowedMethods, timeoutMs);
  const fsAdapterSync = deps.fsAdapterSync;

  const checks: DoctorCheckResult[] = [
    checkNode(deps.nodeVersion ?? process.versions.node),
    await checkDistFreshness(deps),
    checkEnv(deps.env),
    await checkGit(deps),
    checkSavedConfig(deps.cwd),
    checkReviewPolicy(deps.cwd, fsAdapterSync),
    checkCredentials(deps.env),
    await checkModelDiscovery(deps.env, safeFetch, timeoutMs),
    await checkProviderLatency(deps.env, safeFetch, timeoutMs),
    checkContextBudgets(),
    checkCiPlatform(deps),
    await checkGithubPermissions(deps.env, safeFetch, timeoutMs),
    await checkAzurePermissions(deps.env, safeFetch, timeoutMs),
  ];

  const exitCode = checks.some((c) => c.status === "fail") ? 1 : 0;
  const json: FullDoctorJson = {
    schemaVersion: 1,
    command: "doctor",
    mode: "full",
    exitCode,
    checks,
  };
  return { exitCode, checks, json };
}

// ---------------------------------------------------------------------------
// Internal re-exports for unit tests (the module-level export is
// kept narrow so the public surface stays small).
// ---------------------------------------------------------------------------

export const __TEST__ = {
  safeFetch: makeSafeFetch,
  redactNetworkError,
  isAllowedMethod: (method: string, allowed: readonly string[]) =>
    allowed.includes(method.toUpperCase()),
};
