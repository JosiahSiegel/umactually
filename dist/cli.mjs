import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { dirname, isAbsolute, join, posix, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile, execFileSync, spawn } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
//#region src/config/field-schema.ts
const FIELDS = {
	apiUrl: {
		field: "apiUrl",
		flag: "--api-url",
		input: "api-url",
		env: ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"],
		type: "string",
		defaultValue: ""
	},
	apiKey: {
		field: "apiKey",
		flag: "--api-key",
		input: "api-key",
		env: ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"],
		type: "string",
		defaultValue: ""
	},
	model: {
		field: "model",
		flag: "--model",
		input: "model",
		env: ["UMACTUALLY_MODEL", "REVIEW_PROVIDER_MODEL"],
		type: "string",
		defaultValue: "auto"
	},
	prompt: {
		field: "prompt",
		flag: "--prompt",
		input: "prompt",
		env: [],
		type: "string",
		defaultValue: ""
	},
	promptFile: {
		field: "promptFile",
		flag: "--prompt-file",
		input: "prompt-file",
		env: ["UMACTUALLY_PROMPT_FILE", "REVIEW_PROMPT_SYSTEM_FILE"],
		type: "string",
		defaultValue: ""
	},
	promptFiles: {
		field: "promptFiles",
		flag: "--prompt-files",
		input: "prompt-files",
		env: ["UMACTUALLY_PROMPT_FILES"],
		type: "string",
		defaultValue: ""
	},
	additionalPrompt: {
		field: "additionalPrompt",
		flag: "--additional-prompt",
		input: "additional-prompt",
		env: [],
		type: "string",
		defaultValue: ""
	},
	additionalPromptFile: {
		field: "additionalPromptFile",
		flag: "--additional-prompt-file",
		input: "additional-prompt-file",
		env: ["UMACTUALLY_ADDITIONAL_PROMPT_FILE", "REVIEW_PROMPT_USER_FILE"],
		type: "string",
		defaultValue: ""
	},
	additionalPromptFiles: {
		field: "additionalPromptFiles",
		flag: "--additional-prompt-files",
		input: "additional-prompt-files",
		env: ["UMACTUALLY_ADDITIONAL_PROMPT_FILES"],
		type: "string",
		defaultValue: ""
	},
	walkthrough: {
		field: "walkthrough",
		flag: "--walkthrough",
		input: "walkthrough",
		env: ["UMACTUALLY_WALKTHROUGH", "REVIEW_WALKTHROUGH"],
		type: "boolean",
		defaultValue: false
	},
	diagnostic: {
		field: "diagnostic",
		flag: "--diagnostic",
		input: "diagnostic",
		env: ["UMACTUALLY_DIAGNOSTIC", "REVIEW_DIAGNOSTIC"],
		type: "boolean",
		defaultValue: false
	},
	dryRun: {
		field: "dryRun",
		flag: "--dry-run",
		input: "dry-run",
		env: ["UMACTUALLY_DRY_RUN", "REVIEW_DRY_RUN"],
		type: "boolean",
		defaultValue: false
	},
	debugRawResponse: {
		field: "debugRawResponse",
		flag: "--debug-raw-response",
		input: "debug-raw-response",
		env: ["REVIEW_DEBUG_RAW_RESPONSE"],
		type: "boolean",
		defaultValue: false
	},
	simulateFindings: {
		field: "simulateFindings",
		flag: "--simulate-findings",
		input: "simulate-findings",
		env: ["UMACTUALLY_SIMULATE_FINDINGS", "REVIEW_SIMULATE_FINDINGS"],
		type: "boolean",
		defaultValue: false
	},
	strictSchema: {
		field: "strictSchema",
		flag: "--strict-schema",
		input: "strict-schema",
		env: ["UMACTUALLY_STRICT_SCHEMA", "REVIEW_STRICT_SCHEMA"],
		type: "boolean",
		defaultValue: true
	},
	verifyFindings: {
		field: "verifyFindings",
		flag: "--verify-findings",
		input: "verify-findings",
		env: ["UMACTUALLY_VERIFY_FINDINGS", "REVIEW_VERIFY_FINDINGS"],
		type: "boolean",
		defaultValue: true
	},
	reviewTimeoutSeconds: {
		field: "reviewTimeoutSeconds",
		flag: "--review-timeout-seconds",
		input: "review-timeout-seconds",
		env: ["UMACTUALLY_REVIEW_TIMEOUT_SECONDS", "REVIEW_TIMEOUT_SECONDS"],
		type: "integer",
		defaultValue: 300
	},
	stallSeconds: {
		field: "stallSeconds",
		flag: "--stall-seconds",
		input: "stall-seconds",
		env: ["UMACTUALLY_STALL_SECONDS", "REVIEW_STALL_SECONDS"],
		type: "integer",
		defaultValue: 270
	},
	perRequestTimeoutSeconds: {
		field: "perRequestTimeoutSeconds",
		flag: "--per-request-timeout-seconds",
		input: "per-request-timeout-seconds",
		env: ["REVIEW_PER_REQUEST_TIMEOUT_SECONDS"],
		type: "integer",
		defaultValue: 60
	},
	maxOutputTokens: {
		field: "maxOutputTokens",
		flag: "--max-output-tokens",
		input: "max-output-tokens",
		env: ["UMACTUALLY_MAX_OUTPUT_TOKENS"],
		type: "integer",
		defaultValue: 16e3
	},
	minimumSeverity: {
		field: "minimumSeverity",
		flag: "--minimum-severity",
		input: "minimum-severity",
		env: ["REVIEW_MINIMUM_SEVERITY"],
		type: "enum",
		defaultValue: "medium",
		enumValues: [
			"low",
			"medium",
			"high"
		]
	},
	maxComments: {
		field: "maxComments",
		flag: "--max-comments",
		input: "max-comments",
		env: ["REVIEW_MAX_COMMENTS"],
		type: "integer",
		defaultValue: 50
	},
	reviewFileLimit: {
		field: "reviewFileLimit",
		flag: "--review-file-limit",
		input: "review-file-limit",
		env: ["REVIEW_FILE_LIMIT"],
		type: "integer",
		defaultValue: 200
	},
	includeSonarqube: {
		field: "includeSonarqube",
		flag: "--include-sonarqube",
		input: "include-sonarqube",
		env: ["UMACTUALLY_INCLUDE_SONARQUBE", "REVIEW_SONAR_ENABLED"],
		type: "boolean",
		defaultValue: false
	},
	sonarHostUrl: {
		field: "sonarHostUrl",
		flag: "--sonar-host-url",
		input: "sonar-host-url",
		env: ["UMACTUALLY_SONAR_HOST_URL", "REVIEW_SONAR_HOST"],
		type: "string",
		defaultValue: ""
	},
	sonarToken: {
		field: "sonarToken",
		flag: "--sonar-token",
		input: "sonar-token",
		env: ["UMACTUALLY_SONAR_TOKEN", "REVIEW_SONAR_TOKEN"],
		type: "string",
		defaultValue: ""
	},
	sonarProjectKey: {
		field: "sonarProjectKey",
		flag: "--sonar-project-key",
		input: "sonar-project-key",
		env: ["UMACTUALLY_SONAR_PROJECT_KEY", "REVIEW_SONAR_PROJECT"],
		type: "string",
		defaultValue: ""
	},
	sonarTimeoutSeconds: {
		field: "sonarTimeoutSeconds",
		flag: "--sonar-timeout-seconds",
		input: "sonar-timeout-seconds",
		env: ["REVIEW_SONAR_TIMEOUT_SECONDS"],
		type: "integer",
		defaultValue: 300
	},
	detectLeaks: {
		field: "detectLeaks",
		flag: "--detect-leaks",
		input: "detect-leaks",
		env: ["UMACTUALLY_DETECT_LEAKS", "REVIEW_LEAK_DETECTION"],
		type: "boolean",
		defaultValue: true
	},
	platform: {
		field: "platform",
		flag: "--platform",
		input: "platform",
		env: ["REVIEW_PLATFORM"],
		type: "enum",
		defaultValue: "auto",
		enumValues: [
			"auto",
			"github",
			"azure"
		]
	},
	prNumber: {
		field: "prNumber",
		flag: "--pr-number",
		input: "pr-number",
		env: [],
		type: "string",
		defaultValue: ""
	},
	repo: {
		field: "repo",
		flag: "--repo",
		input: "repo",
		env: [],
		type: "string",
		defaultValue: ""
	},
	effort: {
		field: "effort",
		flag: "--effort",
		input: "effort",
		env: ["UMACTUALLY_EFFORT"],
		type: "enum",
		defaultValue: "medium",
		enumValues: [
			"low",
			"medium",
			"high"
		]
	},
	provider: {
		field: "provider",
		flag: "--provider",
		input: "provider",
		env: ["UMACTUALLY_PROVIDER"],
		type: "enum",
		defaultValue: "openai-compatible",
		enumValues: [
			"openai-compatible",
			"copilot",
			"anthropic"
		]
	},
	githubApiBase: {
		field: "githubApiBase",
		flag: "--github-api-base",
		input: "github-api-base",
		env: ["UMACTUALLY_GITHUB_API_BASE"],
		type: "string",
		defaultValue: ""
	},
	githubToken: {
		field: "githubToken",
		flag: null,
		input: "github_token",
		env: ["GITHUB_TOKEN"],
		type: "string",
		defaultValue: ""
	},
	promptByteCap: {
		field: "promptByteCap",
		flag: null,
		input: "prompt-byte-cap",
		env: ["REVIEW_PROMPT_BYTE_CAP"],
		type: "integer",
		defaultValue: 65536
	},
	redactorEnabled: {
		field: "redactorEnabled",
		flag: null,
		input: "redactor-enabled",
		env: ["REVIEW_REDACTOR_ENABLED"],
		type: "boolean",
		defaultValue: true
	},
	azureOrg: {
		field: "azureOrg",
		flag: null,
		input: "azure-org",
		env: ["AZURE_DEVOPS_ORG"],
		type: "string",
		defaultValue: ""
	},
	azureProject: {
		field: "azureProject",
		flag: null,
		input: "azure-project",
		env: ["AZURE_DEVOPS_PROJECT"],
		type: "string",
		defaultValue: ""
	},
	azureRepo: {
		field: "azureRepo",
		flag: null,
		input: "azure-repo",
		env: ["AZURE_DEVOPS_REPO"],
		type: "string",
		defaultValue: ""
	},
	azurePullRequestId: {
		field: "azurePullRequestId",
		flag: null,
		input: "azure-pull-request-id",
		env: ["AZURE_DEVOPS_PULL_REQUEST_ID"],
		type: "integer",
		defaultValue: 0
	},
	azureToken: {
		field: "azureToken",
		flag: null,
		input: "azure-token",
		env: ["AZURE_DEVOPS_TOKEN"],
		type: "string",
		defaultValue: ""
	}
};
/** All fields in declaration order. */
const ALL_FIELDS = Object.values(FIELDS);
/**
* Set of every env-var name the runtime reads (across all fields, deduped).
* Useful for sanity checks, smoke tests, and any future "unknown env-var"
* diagnostics. Derived from the field-schema so adding a field's env entries
* here keeps the set in sync without any other code changes.
*/
const KNOWN_ENV_VAR_NAMES = new Set(ALL_FIELDS.flatMap((def) => def.env));
//#endregion
//#region src/util/cli-args.ts
/**
* Default error class thrown by `readEnum` when an enum value is invalid.
* The class lives here so `readEnum` can throw it without circular
* imports between `cli-args.ts` and `parse-args.ts` (the parse-args.ts
* file defines its own `CliUsageError` separately for parse-time
* errors; callers that want the CLI to recognize the error can pass
* their own constructor via `readEnum(..., { errorClass: CliUsageError })`).
*/
var CliArgError = class extends Error {
	name = "CliArgError";
};
/**
* Strict decimal-integer parser that REJECTS partial numeric garbage.
* `Number.parseInt("12abc", 10)` returns 12; this helper returns null for
* the same input so callers can fall back or throw a typed error.
*
* ## Sign tolerance
*
* The helper is **sign-tolerant by design**: it accepts `"+1"`, `"-1"`,
* `"+0"`, `"-0"` etc. The positivity / non-negativity check is the
* CALLER's responsibility (see `parsePrNumber` for `parsed <= 0` and
* `readAzurePrNumber` for the same). This split keeps the helper
* reusable for signed CLI flags (none today, but the schema may grow)
* while every existing caller that wants positive-integer semantics
* already adds its own `parsed <= 0` guard.
*
* ## Accepted shapes
*   - Optional leading `+` or `-` sign
*   - One or more ASCII digits
*   - Any integer that fits in `Number.isSafeInteger` (±(2^53 - 1))
*
* ## Rejected shapes
*   - Empty strings
*   - Whitespace-only or whitespace-padded strings (callers that need
*     to tolerate trim should `.trim()` first — see action/read-inputs.ts)
*   - Any non-digit content anywhere (decimal points, exponent notation,
*     trailing letters, internal whitespace)
*
* ## Caller contract
*   - `parsed === null` means "not a valid strict integer". Caller
*     decides whether to throw, fall back to a default, or branch.
*   - `parsed === 0` is a successful parse. Caller decides whether
*     `0` is in-range.
*   - `parsed < 0` is a successful parse. Caller decides whether
*     negatives are in-range.
*
* This is the canonical helper for any CLI flag / env var / input field
* that represents a strict integer. Replaces the five hand-rolled
* `Number.parseInt + isSafeInteger` sites in `cli/parse-args.ts`,
* `action/read-inputs.ts`, `platform/github/context.ts`, and
* `platform/azure/context.ts` so the parsing semantics cannot drift.
*/
function parseStrictInt(raw) {
	if (raw.length === 0) return null;
	if (!/^[+-]?\d+$/u.test(raw)) return null;
	const parsed = Number.parseInt(raw, 10);
	return Number.isSafeInteger(parsed) ? parsed : null;
}
/**
* Validate a CLI enum value against an accepted set, returning the value
* when it matches and throwing on miss. Replaces the four hand-coded
* enum parsers (`readPlatform`, `readEffort`, `readProvider`,
* `readMinimumSeverity`) in `parse-args.ts` so the CLI accepts the
* exact same set as `FIELDS.<x>.enumValues` in `field-schema.ts`.
* Single source of truth — changing the canonical `enumValues` array
* updates both surfaces.
*
* The error class is injectable via the 4th argument so callers that
* need a typed error (e.g. `CliUsageError` in `parse-args.ts`) can
* preserve their outer-handler contract; without an explicit class,
* `readEnum` falls back to `CliArgError` (also exported from this
* module). The message format matches the original hand-coded parsers
* (`invalid --flag value: X`) so existing tests and user-facing
* diagnostics stay byte-identical.
*
* The accepted set is typed `readonly T[]` so the literal union narrows
* naturally without an explicit cast: `readEnum<CliPlatform>("--platform",
* v, FIELDS.platform.enumValues as readonly CliPlatform[], CliUsageError)`.
*/
function readEnum(flag, value, accepted, errorClass = CliArgError) {
	for (const candidate of accepted) if (candidate === value) return candidate;
	const hint = `Accepted values for ${flag}: ${accepted.length <= 8 ? accepted.join(", ") : `${accepted.slice(0, 8).join(", ")}, ...`}. Run \`umactually --help\` or \`umactually review --help\` for the full list of flags and their accepted shapes.`;
	throw new errorClass(`invalid ${flag} value: ${value}`, hint);
}
/**
* Compute a "did you mean ...?" suggestion for an unknown CLI flag.
*
* Returns the closest known flag by Levenshtein distance, or `null` when
* no known flag is reasonably close. Empty/null input returns null.
*
* The threshold is calibrated so single-character transpositions on
* longer flags ("--minimun-severity" for "--minimum-severity") still
* suggest a match, while completely-different flags
* ("--platformx" vs "--platform") do not. The exact cut-off for the
* returned distance is `Math.max(2, Math.floor(input.length / 4))`
* which scales with flag length: short flags get a tight tolerance, long
* flags get a looser one (intentional — typed-by-eye typos on long
* flags are usually 1-2 characters off).
*
* Pure function — no side effects, no I/O, deterministic. Safe to call
* at parse-time.
*/
function didYouMean(input, candidates) {
	if (input.length === 0) return null;
	let bestDistance = Number.POSITIVE_INFINITY;
	let bestCandidate = null;
	const maxDistance = Math.max(2, Math.floor(input.length / 4));
	for (const candidate of candidates) {
		const distance = levenshtein(input, candidate);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestCandidate = candidate;
		}
	}
	return bestDistance <= maxDistance ? bestCandidate : null;
}
/**
* Classic iterative Levenshtein distance with two rolling rows.
* O(n*m) time, O(min(n,m)) space. Empty-string handling: distance is
* the length of the other string. Use via `didYouMean`; exported for
* unit-test reachability rather than direct consumer use.
*/
function levenshtein(a, b) {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	let previous = new Array(b.length + 1);
	let current = new Array(b.length + 1);
	for (let j = 0; j <= b.length; j += 1) previous[j] = j;
	for (let i = 1; i <= a.length; i += 1) {
		current[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			const deletion = (previous[j] ?? 0) + 1;
			const insertion = (current[j - 1] ?? 0) + 1;
			const substitution = (previous[j - 1] ?? 0) + cost;
			current[j] = Math.min(deletion, insertion, substitution);
		}
		const swap = previous;
		previous = current;
		current = swap;
	}
	return previous[b.length] ?? 0;
}
//#endregion
//#region src/util/brand.ts
/**
* Canonical brand string used across CLI, platform, and provider code.
*
* NOT a generic brand concept: this is the specific string "umactually"
* that downstream consumers (PR comments, HTTP User-Agent headers, GitHub
* agents) match on. Renamed from "umactually" in v0.1.0 because
* the project ships under the bare name `umactually` and never launched
* with the longer string — no installed copies depend on the old value.
*/
/** Canonical review brand string; eliminates the 50+ inline "umactually" literals across CLI, platform, and provider code. */
const BRAND = "umactually";
/** Log prefix shared by annotation helpers; eliminates hand-built "umactually: " prefixes in stderr diagnostics. */
const BRAND_PREFIX = `${BRAND}: `;
/** HTTP User-Agent token shared by provider and platform clients; eliminates duplicated header literals. */
const USER_AGENT = BRAND;
/** Azure DevOps PR status context name; prevents status updates from drifting away from the review brand. */
const AZURE_STATUS_CONTEXT_NAME = `${BRAND}-status`;
/** Azure DevOps PR status context genre; the discriminator that keeps our status updates distinct from any other tool's. */
const AZURE_STATUS_CONTEXT_GENRE = "pr-review";
/**
* Redaction token emitted by secret scanners and runtime sanitizers
* when a high-confidence secret or per-secret value is replaced. The
* runtime sanitizer (`live-shared.ts:sanitizeForPost`) and the
* scanner (`scan-review-secrets.ts`) must emit the SAME token so the
* downstream log-filter and dedup heuristics agree on what counts as
* "already-redacted". Single source of truth — any future rename must
* touch this constant only.
*/
const REDACTED_SECRET_TOKEN = "[REDACTED_SECRET]";
/**
* Placeholder string substituted into config-parse error messages instead of
* leaking values. Re-exported from `src/config/errors.ts` as `REDACTED` to
* preserve the existing import surface in that module (the parser chain in
* `src/config/parsers.ts` already imports `REDACTED` from `errors.ts`).
*/
const REDACTED_PLACEHOLDER = "[REDACTED]";
/** Replaces an entire `Authorization: ...` header value in logged request bodies. */
const REDACTED_AUTHORIZATION_HEADER = "[REDACTED_AUTHORIZATION_HEADER]";
/** Replaces a `Bearer <token>` segment inside a logged request body. */
const REDACTED_BEARER_TOKEN = "[REDACTED_BEARER_TOKEN]";
//#endregion
//#region src/config/errors.ts
var InvalidConfigError = class extends Error {
	field;
	reason;
	name = "InvalidConfigError";
	constructor(field, reason, options) {
		super(`Invalid config for '${field}': ${reason}`, options);
		this.field = field;
		this.reason = reason;
	}
};
var PromptFileError = class extends Error {
	path;
	reason;
	name = "PromptFileError";
	constructor(path, reason, options) {
		super(`Prompt file error: ${reason}`, options);
		this.path = path;
		this.reason = reason;
	}
};
//#endregion
//#region src/util/url.ts
/** Join provider base URLs consistently; eliminates duplicated slash trimming across provider clients. */
function joinUrl(baseUrl, path) {
	return `${stripTrailingSlash(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}
/**
* Resolve a provider's `baseUrl` down to its origin (scheme + host + port),
* then append a default API prefix. This makes the action robust against
* any operator-supplied path: no matter what the user puts after the host
* (`/v1`, `/openai`, `/anthropic`, `/api/v2`, etc.), the action always
* targets the canonical OpenAI-style path on the host root.
*
* Goal: `${result}/responses` and `${result}/chat/completions` must
* reach the provider regardless of what path the operator typed in
* `UMACTUALLY_API_URL`. The provider is responsible for serving those
* routes at the host root + `/v1/...`.
*
* Examples (defaultPrefix = `/v1`):
*   - `https://api.example.com`           → `https://api.example.com/v1`
*   - `https://api.example.com/`          → `https://api.example.com/v1`
*   - `https://api.example.com/v1`        → `https://api.example.com/v1`
*   - `https://api.example.com/openai`    → `https://api.example.com/v1`
*   - `https://api.example.com/anthropic` → `https://api.example.com/v1`
*   - `https://api.example.com/api/v2`    → `https://api.example.com/v1`
*   - `https://api.example.com/v1/openai` → `https://api.example.com/v1`
*
* The path is **always** discarded. This is intentional: the action
* calls OpenAI-style routes (`/responses`, `/chat/completions`),
* and the operator's path is treated as decorative noise rather than
* a routing hint. The fix trades a small amount of flexibility (no
* custom namespace support) for a large amount of robustness — the
* action works the same regardless of what path the operator typed.
*
* If an operator genuinely needs a custom namespace, they can use
* the `--provider copilot` path (which uses GitHub's API directly)
* or the `copilot` provider family which has its own routing.
*
* Detection uses a minimal URL parse. The fallback substring path
* handles unencoded spaces and other URL-parse failures.
*
* @param baseUrl       Operator-supplied base URL.
* @param defaultPrefix Default prefix to append to the origin.
*                      Default `/v1`.
*/
function resolveProviderBaseUrl(baseUrl, defaultPrefix = "/v1") {
	return `${extractOrigin(baseUrl)}${defaultPrefix}`;
}
/**
* Return the origin (scheme + host + port) of a URL, stripping any path,
* query, and fragment. Used by `resolveProviderBaseUrl` to normalize
* operator-supplied URLs to their canonical host root.
*
* Returns the input unchanged if it cannot be parsed as a URL — this
* preserves the original string for callers that want a best-effort
* fallback. Callers that need a strict guarantee should pass a
* well-formed URL.
*/
function extractOrigin(baseUrl) {
	try {
		return new URL(baseUrl).origin;
	} catch {
		const schemeSep = baseUrl.indexOf("://");
		if (schemeSep === -1) {
			const firstSlash = baseUrl.indexOf("/");
			return firstSlash === -1 ? baseUrl : baseUrl.slice(0, firstSlash);
		}
		const sepLen = 3;
		const afterScheme = baseUrl.slice(schemeSep + sepLen);
		const firstSlash = afterScheme.indexOf("/");
		const authority = firstSlash === -1 ? afterScheme : afterScheme.slice(0, firstSlash);
		return baseUrl.slice(0, schemeSep + sepLen) + authority;
	}
}
/**
* Extract the hostname from a URL string. Returns null when the
* input is empty, malformed, or a bare string without a scheme
* separator. The caller is expected to fall back to a sensible
* default when null is returned.
*
* Why hostname-only: substring matching on the full URL is too
* loose. A URL like `https://example.com/minimax-router` would
* falsely match `url.includes("minimax")` and pick a MiniMax
* model. The hostname extract prevents that — `example.com`
* doesn't contain `minimax`, so the model is the default.
*
* The returned hostname is always lowercased so callers can compare
* directly against lowercase host keys. `URL.hostname` is already
* lowercased per the WHATWG URL spec; the manual fallback path
* (for scheme-less URLs) explicitly lowercases to keep the
* case-insensitive match consistent regardless of whether the
* URL had a parseable scheme.
*
* Examples:
*   - `https://api.example.com/v1`        → `api.example.com`
*   - `API.MINIMAX.IO`                    → `api.minimax.io`
*   - `localhost:8080`                    → null (`new URL("localhost:8080")`
*     parses with empty hostname because `localhost` is not a
*     special scheme; the function returns null for empty hosts)
*   - `` (empty string)                   → null
*/
function extractHostname(baseUrl) {
	const trimmed = baseUrl.trim();
	if (trimmed.length === 0) return null;
	let host;
	try {
		host = new URL(trimmed).hostname;
	} catch {
		const schemeSep = trimmed.indexOf("://");
		const afterScheme = schemeSep === -1 ? trimmed : trimmed.slice(schemeSep + 3);
		const firstSlash = afterScheme.indexOf("/");
		const firstColon = afterScheme.indexOf(":");
		const stop = firstSlash === -1 ? afterScheme.length : firstSlash;
		host = firstColon === -1 || firstColon > stop ? afterScheme.slice(0, stop) : afterScheme.slice(0, firstColon);
	}
	return host.length > 0 ? host.toLowerCase() : null;
}
/**
* Return the ORDERED list of base URL candidates to try when calling
* the openai-compatible provider. The first candidate is the
* operator-supplied URL as-pasted (after trimming trailing slashes) —
* we always respect what the operator typed. Subsequent candidates
* are progressively more "normalized" forms: first the origin with
* the default prefix prepended, then the origin alone (rare —
* only useful if the provider serves routes at the root with no
* prefix).
*
* The list is de-duplicated so the caller doesn't try the same URL
* twice. The provider tries each candidate in order; if a candidate
* 404s on both `/responses` and `/chat/completions`, the next
* candidate is tried. The first candidate that returns a non-404
* response wins.
*
* This is the "robust to any URL shape" contract: no matter what
* the operator types, we find a working endpoint. The order is
* important — the operator's URL comes first so the wire path
* matches their intent whenever possible.
*
* Examples (defaultPrefix = `/v1`):
*   - `https://api.example.com` →
*       [`https://api.example.com`,
*        `https://api.example.com/v1`]
*   - `https://api.example.com/v1` →
*       [`https://api.example.com/v1`,
*        `https://api.example.com/v1`]  (de-duplicated)
*   - `https://api.example.com/anthropic` →
*       [`https://api.example.com/anthropic`,
*        `https://api.example.com/v1`]
*   - `https://api.example.com/api/v2` →
*       [`https://api.example.com/api/v2`,
*        `https://api.example.com/v1`]
*
* The fallback candidate (origin + default prefix) is included even
* when the operator's URL is a bare host, so a single candidate is
* tried twice (de-duplicated to one). This keeps the contract
* uniform: callers always iterate a list, no special-casing.
*/
function resolveProviderBaseUrlCandidates(baseUrl, defaultPrefix = "/v1") {
	const pasted = stripTrailingSlash(baseUrl);
	const normalized = resolveProviderBaseUrl(baseUrl, defaultPrefix);
	if (pasted === normalized) return [pasted];
	return [pasted, normalized];
}
/**
* Resolve the Anthropic Messages API URL from the operator-supplied base URL.
*
* Mirrors the OFFICIAL @anthropic-ai/sdk convention (Claude Code's
* `ANTHROPIC_BASE_URL=https://api.anthropic.com` becomes
* `POST https://api.anthropic.com/v1/messages`) and the documented
* fix in https://github.com/xemantic/anthropic-sdk-kotlin/pull/145 —
* which notes that previously "client.post('/v1/messages') replaced
* any path on a configured baseUrl, breaking Anthropic-compatible
* providers whose endpoints live under a path prefix."
*
* Anthropic-compatible gateways commonly mount the protocol under a
* path prefix. The canonical example is MiniMax's Anthropic endpoint:
*
*   `--api-url https://api.minimax.io/anthropic` →
*   `POST https://api.minimax.io/anthropic/v1/messages`
*
* NOT `https://api.minimax.io/v1/messages` (which 404s on MiniMax — see
* https://platform.minimax.io/docs/token-plan/claude-code). The path
* on the operator's URL is real routing, not decorative noise.
*
* Behavior:
*
*   - Parse the input as a URL and split out origin / path / query /
*     fragment via the WHATWG URL parser. Query string and fragment
*     are intentionally dropped — they don't address `/v1/messages`
*     at any known Anthropic-protocol gateway, and passing them
*     through would smuggle the endpoint into the query segment
*     (`.../v1?token=abc/v1/messages`), an invalid URL that fires
*     against a different route.
*   - Trim trailing slashes from the resulting path.
*   - If the path already ends in `/v1/messages`, return as-is
*     (operator pre-appended; idempotent).
*   - If it ends in `/v1`, append `/messages` (don't double-`/v1` —
*     matches the SDK default of `https://api.anthropic.com/v1`).
*   - Otherwise, append `/v1/messages` to the existing path (path
*     prefix is preserved).
*   - On URL-parse failure (operator supplied something that isn't a
*     valid URL), fall back to a trailing-slash strip + naive
*     concatenation — preserves the original string when the WHATWG
*     parser can't decode it but still drops the function rather
*     than throwing.
*
* Examples:
*
*   - `https://api.anthropic.com`                        → `https://api.anthropic.com/v1/messages`
*   - `https://api.anthropic.com/v1`                     → `https://api.anthropic.com/v1/messages`
*   - `https://api.anthropic.com/v1/`                    → `https://api.anthropic.com/v1/messages`
*   - `https://api.minimax.io/anthropic`                 → `https://api.minimax.io/anthropic/v1/messages`
*   - `https://api.minimax.io/anthropic/`                → `https://api.minimax.io/anthropic/v1/messages`
*   - `https://gateway.example.com/llm/anthropic`        → `https://gateway.example.com/llm/anthropic/v1/messages`
*   - `https://api.anthropic.com/v1/messages`            → `https://api.anthropic.com/v1/messages` (idempotent)
*   - `https://api.anthropic.com/v1?token=abc`           → `https://api.anthropic.com/v1/messages` (query dropped)
*   - `https://api.anthropic.com/v1#section`             → `https://api.anthropic.com/v1/messages` (fragment dropped)
*
* Note: this helper REPLACES `resolveProviderBaseUrl` for the
* Anthropic provider only. The OpenAI-compatible provider still uses
* `resolveProviderBaseUrlCandidates` because OpenAI gateways
* (`/openai`, `/api/v2`, etc.) live at the host root + `/v1`, so the
* try-as-pasted-then-origin-with-`/v1` fallback is the right
* contract there. Anthropic's path-prefix gateways (MiniMax's
* `/anthropic`) need the path preserved.
*/
function resolveAnthropicMessagesUrl(baseUrl) {
	let origin;
	let pathPart;
	try {
		const parsed = new URL(baseUrl);
		origin = parsed.origin;
		pathPart = parsed.pathname;
	} catch {
		origin = extractOrigin(baseUrl);
		pathPart = stripTrailingSlash(baseUrl).slice(origin.length);
	}
	const cleanedPath = stripTrailingSlash(pathPart === "/" ? "" : pathPart);
	if (cleanedPath.endsWith("/v1/messages")) return joinUrl(origin, cleanedPath);
	const lastSegment = cleanedPath === "" ? "" : cleanedPath.slice(cleanedPath.lastIndexOf("/") + 1);
	if (cleanedPath === "/v1" || lastSegment === "v1") return joinUrl(origin, `${cleanedPath}/messages`);
	return joinUrl(origin, `${cleanedPath}/v1/messages`);
}
/**
* Heuristic: does the operator's `UMACTUALLY_API_URL` look like it's
* pointing at an Anthropic-protocol gateway?
*
* Used by the live-provider dispatcher to commit to the Anthropic
* Messages API client even when `--provider` defaults to
* `openai-compatible`. Without this, the openai-compatible client's
* URL candidate loop downgrades paths like
* `https://api.minimax.io/anthropic` to the origin+`/v1` fallback
* (which on MiniMax also serves OpenAI-protocol at `/v1/responses`),
* and the action ends up POSTing OpenAI wire-shape requests to an
* Anthropic-protocol gateway — silently breaking operator intent.
*
* Contract: returns `true` when ANY path segment **exactly** equals
* `anthropic` (case-insensitive, byte-for-byte match — no prefix or
* suffix overlap). Anything else (bare host, `/v1`, `/openai`,
* arbitrary custom paths, segments that *contain* `anthropic` but
* don't equal it) returns `false`.
*
* The exact-segment match is intentional: `anthropic-v2` /
* `my-anthropic` / `anthropic-fork` etc. are different segments
* from `anthropic` and don't trigger the heuristic. This is a
* tight, conservative contract — the only paths that commit to
* Anthropic protocol are paths that are LITERALLY `/anthropic`
* (with optional trailing `/v1`, `/llm/anthropic`, `/v1/anthropic`,
* etc. but never `/anthropic-anything`). A false positive here
* would silently POST Anthropic wire shape to a server expecting
* something else, which is worse than the (recoverable) false
* negative of falling through to the cross-protocol fallback chain.
*
* Examples (see `test/unit/looks-like-anthropic-endpoint.test.ts`):
*
*   `https://api.minimax.io/anthropic`                 → true  (segment "anthropic")
*   `https://api.minimax.io/anthropic/v1`              → true  (segment "anthropic")
*   `https://gateway.example.com/llm/anthropic`        → true  (segment "anthropic")
*   `https://gateway.example.com/v1/anthropic`        → true  (segment "anthropic")
*   `https://api.openai.com/v1`                        → false (no "anthropic" segment)
*   `https://api.example.com/`                         → false (no path)
*   `https://api.example.com/anthropic-v2`            → false (segment "anthropic-v2" ≠ "anthropic")
*   `https://api.example.com/my-anthropic`             → false (segment "my-anthropic" ≠ "anthropic")
*   `https://api.example.com/anthropic-team/foo`       → false (segment "anthropic-team" ≠ "anthropic")
*   `https://api.example.com/anthropic?token=…`        → true  (query dropped, path segment "anthropic" matches)
*
* Conservative by design: a `false` result means the dispatcher
* won't auto-commit to Anthropic protocol, falling back to the
* `--provider` choice and the cross-protocol fallback chain.
* An unexpected `false` is recoverable (the fallback still fires
* on a real 404); an unexpected `true` would silently pick the
* Anthropic wire shape on a URL that doesn't speak it.
*/
function looksLikeAnthropicEndpoint(baseUrl) {
	if (baseUrl.length === 0) return false;
	let pathname;
	try {
		pathname = new URL(baseUrl).pathname;
	} catch {
		pathname = stripTrailingSlash(baseUrl).replace(/^[a-z]+:\/\/[^/]*/i, "");
	}
	return pathname.split("/").filter((s) => s.length > 0).some((s) => s.toLowerCase() === "anthropic");
}
/**
* Removes trailing slashes from a URL or path segment. Useful before
* joining paths so empty-path joins don't produce double slashes.
*/
function stripTrailingSlash(value) {
	return value.replace(/\/+$/u, "");
}
/**
* Strip the query string and fragment from a URL for safe inclusion
* in CI logs and operator-facing diagnostics. The URL may carry
* session tokens, tenant identifiers, or other credential-bearing
* parameters in the query slot — leaking those into the action's
* stderr notices (which are persisted as GitHub Actions annotations)
* is a credential-disclosure risk that we explicitly avoid.
*
* Behavior:
*   - Empty input                        → empty output
*   - Bare host                          → unchanged
*   - With query string                  → origin + path (no `?`)
*   - With fragment                      → origin + path (no `#`)
*   - Unparseable input                  → substring-stripped; never throws
*
* Examples:
*   - `https://api.example.com`                   → `https://api.example.com`
*   - `https://api.example.com/v1`                → `https://api.example.com/v1`
*   - `https://api.example.com?token=secret`      → `https://api.example.com`
*   - `https://api.example.com/v1#anchor`         → `https://api.example.com/v1`
*/
function redactUrlForLog(value) {
	if (value.length === 0) return value;
	try {
		const parsed = new URL(value);
		const path = parsed.pathname === "/" ? "" : parsed.pathname;
		return `${parsed.origin}${path}`;
	} catch {
		const noQuery = value.split("?")[0] ?? value;
		return noQuery.split("#")[0] ?? noQuery;
	}
}
/** Create request correlation IDs consistently; eliminates duplicated UUID fallback logic across providers. */
function createRequestId() {
	const cryptoApi = globalThis.crypto;
	if (cryptoApi?.randomUUID !== void 0) return cryptoApi.randomUUID();
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	if (cryptoApi?.getRandomValues !== void 0) cryptoApi.getRandomValues(bytes);
	else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
	const hex = [];
	for (const byte of bytes) hex.push(byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
//#endregion
//#region src/config/parsers.ts
const TRUTHY_STRINGS = /* @__PURE__ */ new Set([
	"1",
	"true",
	"yes",
	"on",
	"y"
]);
const FALSY_STRINGS = /* @__PURE__ */ new Set([
	"0",
	"false",
	"no",
	"off",
	"n",
	""
]);
/**
* Parses a boolean from an unknown boundary. Accepts:
* - native boolean
* - 0 or 1 (number)
* - string in TRUTHY_STRINGS / FALSY_STRINGS (case-insensitive, trimmed)
* Anything else throws InvalidConfigError with [REDACTED] in the message.
*/
function parseBooleanFromUnknown(value, field) {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (value === 1) return true;
		if (value === 0) return false;
		throw new InvalidConfigError(field, `expected boolean, received number ${REDACTED_PLACEHOLDER}`);
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (TRUTHY_STRINGS.has(normalized)) return true;
		if (FALSY_STRINGS.has(normalized)) return false;
		throw new InvalidConfigError(field, `expected boolean string, received ${REDACTED_PLACEHOLDER}`);
	}
	throw new InvalidConfigError(field, `expected boolean, received ${typeof value}`);
}
const INTEGER_RE = /^-?\d+$/;
/**
* Parses an integer from an unknown boundary. Accepts native integers
* and decimal-integer strings. Rejects floats, NaN, Infinity, empty strings.
*/
function parseIntegerFromUnknown(value, field) {
	if (typeof value === "number") {
		if (!Number.isInteger(value)) throw new InvalidConfigError(field, `expected integer, received non-integer number ${REDACTED_PLACEHOLDER}`);
		return value;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.length === 0) throw new InvalidConfigError(field, `expected integer, received empty string`);
		if (!INTEGER_RE.test(trimmed)) throw new InvalidConfigError(field, `expected integer string, received ${REDACTED_PLACEHOLDER}`);
		const parsed = Number.parseInt(trimmed, 10);
		if (!Number.isFinite(parsed)) throw new InvalidConfigError(field, `expected finite integer, received ${REDACTED_PLACEHOLDER}`);
		if (!Number.isSafeInteger(parsed)) throw new InvalidConfigError(field, `expected integer in [${Number.MIN_SAFE_INTEGER}, ${Number.MAX_SAFE_INTEGER}], received ${REDACTED_PLACEHOLDER}`);
		return parsed;
	}
	throw new InvalidConfigError(field, `expected integer, received ${typeof value}`);
}
const VALID_SEVERITIES = /* @__PURE__ */ new Set([
	"info",
	"minor",
	"major",
	"critical",
	"security",
	"leak"
]);
const SEVERITY_ALIASES = Object.freeze({
	low: "minor",
	medium: "major",
	high: "critical"
});
for (const [alias, target] of Object.entries(SEVERITY_ALIASES)) if (target !== void 0 && !VALID_SEVERITIES.has(target)) throw new Error(`severity alias "${alias}" maps to non-canonical severity ${JSON.stringify(target)}`);
function parseSeverityFromUnknown(value, field) {
	if (typeof value !== "string") throw new InvalidConfigError(field, `expected severity string, received ${typeof value}`);
	const normalized = value.trim().toLowerCase();
	const alias = SEVERITY_ALIASES[normalized];
	if (alias !== void 0) return alias;
	if (!VALID_SEVERITIES.has(normalized)) throw new InvalidConfigError(field, `unknown severity ${REDACTED_PLACEHOLDER}`);
	return normalized;
}
const VALID_PLATFORMS = new Set(FIELDS.platform.enumValues ?? []);
function parsePlatformFromUnknown(value, field) {
	if (typeof value !== "string") throw new InvalidConfigError(field, `expected platform string, received ${typeof value}`);
	const normalized = value.trim().toLowerCase();
	if (!VALID_PLATFORMS.has(normalized)) throw new InvalidConfigError(field, `unknown platform ${REDACTED_PLACEHOLDER}`);
	return normalized;
}
//#endregion
//#region src/cli/parse-args.ts
const explicitFieldsByParse = /* @__PURE__ */ new WeakMap();
const FIELD_BY_FLAG = new Map(Object.values(FIELDS).flatMap((field) => field.flag === null ? [] : [[field.flag, field.field]]));
function wasCliFieldExplicitlySet(parsed, field) {
	return explicitFieldsByParse.get(parsed)?.has(field) === true;
}
var CliUsageError = class extends Error {
	hint;
	name = "CliUsageError";
	constructor(message, hint) {
		super(message);
		this.hint = hint;
	}
};
function parseCliArgs(args) {
	const explicitlySet = /* @__PURE__ */ new Set();
	let platform = "auto";
	let eventPath = null;
	let diffPath = null;
	let threadsPath = null;
	let reviewPath = null;
	let prNumber = null;
	let repo = null;
	let apiUrl = null;
	let apiKey = null;
	let model = null;
	let promptFile = null;
	let promptFiles = null;
	let additionalPromptFile = null;
	let additionalPromptFiles = null;
	let prompt = null;
	let additionalPrompt = null;
	let effort = null;
	let provider = null;
	let githubApiBase = null;
	let includeSonarqube = false;
	let sonarHostUrl = null;
	let sonarToken = null;
	let sonarProjectKey = null;
	let sonarTimeoutSeconds = null;
	let minimumSeverity = "medium";
	let maxComments = null;
	let reviewFileLimit = null;
	let detectLeaks = true;
	let walkthrough = false;
	let diagnostic = false;
	let debugRawResponse = false;
	let simulateFindings = false;
	let reviewTimeoutSeconds = null;
	let stallSeconds = null;
	let perRequestTimeoutSeconds = null;
	let maxOutputTokens = null;
	let dryRun = false;
	let outputArtifact = null;
	let strictSchema = true;
	let verifyFindings = true;
	for (let index = 0; index < args.length; index += 1) {
		const token = args[index];
		if (token === void 0) continue;
		const positiveFlag = token.startsWith("--no-") ? `--${token.slice(5)}` : token;
		const explicitField = FIELD_BY_FLAG.get(positiveFlag);
		if (explicitField !== void 0) explicitlySet.add(explicitField);
		switch (token) {
			case "--platform":
				index = consumeValue(args, index, "platform", (value) => {
					platform = readPlatform(value);
				});
				break;
			case "--event":
				eventPath = readValue(args, index, "event");
				index += 1;
				break;
			case "--diff":
				diffPath = readValue(args, index, "diff");
				index += 1;
				break;
			case "--threads":
				threadsPath = readValue(args, index, "threads");
				index += 1;
				break;
			case "--review":
				reviewPath = readValue(args, index, "review");
				index += 1;
				break;
			case "--pr-number":
				prNumber = readValue(args, index, "pr-number");
				index += 1;
				break;
			case "--repo":
				repo = readValue(args, index, "repo");
				index += 1;
				break;
			case "--api-url":
				apiUrl = readValue(args, index, "api-url");
				index += 1;
				break;
			case "--api-key":
				apiKey = readValue(args, index, "api-key");
				index += 1;
				break;
			case "--model":
				model = readValue(args, index, "model");
				index += 1;
				break;
			case "--prompt-file":
				promptFile = readValue(args, index, "prompt-file");
				index += 1;
				break;
			case "--prompt-files":
				promptFiles = readValue(args, index, "prompt-files");
				index += 1;
				break;
			case "--additional-prompt-file":
				additionalPromptFile = readValue(args, index, "additional-prompt-file");
				index += 1;
				break;
			case "--additional-prompt-files":
				additionalPromptFiles = readValue(args, index, "additional-prompt-files");
				index += 1;
				break;
			case "--prompt":
				prompt = readValue(args, index, "prompt");
				index += 1;
				break;
			case "--additional-prompt":
				additionalPrompt = readValue(args, index, "additional-prompt");
				index += 1;
				break;
			case "--effort":
				effort = readEffort(args, index);
				index += 1;
				break;
			case "--provider":
				index = consumeValue(args, index, "provider", (value) => {
					provider = readProvider(value);
				});
				break;
			case "--github-api-base":
				githubApiBase = readValue(args, index, "github-api-base");
				index += 1;
				break;
			case "--include-sonarqube":
				includeSonarqube = true;
				break;
			case "--no-include-sonarqube":
				includeSonarqube = false;
				break;
			case "--sonar-host-url":
				sonarHostUrl = readValue(args, index, "sonar-host-url");
				index += 1;
				break;
			case "--sonar-token":
				sonarToken = readValue(args, index, "sonar-token");
				index += 1;
				break;
			case "--sonar-project-key":
				sonarProjectKey = readValue(args, index, "sonar-project-key");
				index += 1;
				break;
			case "--sonar-timeout-seconds":
				sonarTimeoutSeconds = readIntValue(args, index, "sonar-timeout-seconds");
				index += 1;
				break;
			case "--ignore-minor":
			case "--no-ignore-minor": throw new CliUsageError("--ignore-minor was removed; use --minimum-severity medium (or low/high) to suppress minor findings. Leaks and security findings are never suppressed. Environment variables UMACTUALLY_IGNORE_MINOR and REVIEW_IGNORE_MINOR are also ignored.", "Run `umactually review --minimum-severity low` (or `medium`, `high`) to suppress minor findings instead of `--ignore-minor`. The legacy flag and its env-var aliases (`UMACTUALLY_IGNORE_MINOR`, `REVIEW_IGNORE_MINOR`) are intentionally ignored so CI does not silently change severity.");
			case "--minimum-severity":
				minimumSeverity = readMinimumSeverity(args, index);
				index += 1;
				break;
			case "--max-comments":
				maxComments = readIntValue(args, index, "max-comments");
				index += 1;
				break;
			case "--review-file-limit":
				reviewFileLimit = readIntValue(args, index, "review-file-limit");
				index += 1;
				break;
			case "--detect-leaks":
				detectLeaks = true;
				break;
			case "--no-detect-leaks":
				detectLeaks = false;
				break;
			case "--walkthrough":
				walkthrough = true;
				break;
			case "--no-walkthrough":
				walkthrough = false;
				break;
			case "--diagnostic":
				diagnostic = true;
				break;
			case "--no-diagnostic":
				diagnostic = false;
				break;
			case "--debug-raw-response":
				debugRawResponse = true;
				break;
			case "--no-debug-raw-response":
				debugRawResponse = false;
				break;
			case "--simulate-findings":
				simulateFindings = true;
				break;
			case "--no-simulate-findings":
				simulateFindings = false;
				break;
			case "--review-timeout-seconds":
				reviewTimeoutSeconds = readIntValue(args, index, "review-timeout-seconds");
				index += 1;
				break;
			case "--stall-seconds":
				stallSeconds = readIntValue(args, index, "stall-seconds");
				index += 1;
				break;
			case "--per-request-timeout-seconds":
				perRequestTimeoutSeconds = readIntValue(args, index, "per-request-timeout-seconds");
				index += 1;
				break;
			case "--max-output-tokens":
				maxOutputTokens = readIntValue(args, index, "max-output-tokens");
				index += 1;
				break;
			case "--dry-run":
				dryRun = true;
				break;
			case "--no-dry-run":
				dryRun = false;
				break;
			case "--output-artifact":
				outputArtifact = readValue(args, index, "output-artifact");
				index += 1;
				break;
			case "--strict-schema":
				strictSchema = true;
				break;
			case "--no-strict-schema":
				strictSchema = false;
				break;
			case "--verify-findings":
				verifyFindings = true;
				break;
			case "--no-verify-findings":
				verifyFindings = false;
				break;
			case "--help":
			case "-h": throw new CliHelpSignal(args.slice(0, index).find((t) => !t.startsWith("-")) ?? null);
			default: throw unknownFlagUsageError(token, args);
		}
	}
	const parsed = {
		platform,
		eventPath,
		diffPath,
		threadsPath,
		reviewPath,
		prNumber,
		repo,
		apiUrl,
		apiKey,
		model,
		promptFile,
		promptFiles,
		additionalPromptFile,
		additionalPromptFiles,
		prompt,
		additionalPrompt,
		effort,
		provider,
		githubApiBase,
		includeSonarqube,
		sonarHostUrl,
		sonarToken,
		sonarProjectKey,
		sonarTimeoutSeconds,
		minimumSeverity,
		minimumSeverityInternal: minimumSeverity === null ? null : parseSeverityFromUnknown(minimumSeverity, "cli.minimumSeverity"),
		maxComments,
		reviewFileLimit,
		detectLeaks,
		walkthrough,
		diagnostic,
		debugRawResponse,
		simulateFindings,
		reviewTimeoutSeconds,
		stallSeconds,
		perRequestTimeoutSeconds,
		maxOutputTokens,
		dryRun,
		outputArtifact,
		strictSchema,
		verifyFindings
	};
	explicitFieldsByParse.set(parsed, explicitlySet);
	return parsed;
}
var CliHelpSignal = class extends Error {
	name = "CliHelpSignal";
	/**
	* The subcommand that triggered the help signal, if any.
	* When `--help` appears in a `review` / `doctor` / etc. argv list,
	* this carries the subcommand name so the help printer can render
	* context-specific help text.
	*/
	command;
	constructor(command = null) {
		super();
		this.command = command;
	}
};
function consumeValue(args, index, flag, apply) {
	apply(readValue(args, index, flag));
	return index + 1;
}
function readValue(args, index, flag) {
	const next = args[index + 1];
	if (next === void 0 || next.startsWith("--")) throw new CliUsageError(`flag --${flag} requires a value`, `Supply the value immediately after --${flag}, e.g. \`umactually review --${flag} <value>\`. Run \`umactually review --help\` to see the expected shape for --${flag}.`);
	return next;
}
function readIntValue(args, index, flag) {
	const raw = readValue(args, index, flag);
	const parsed = parseStrictInt(raw);
	if (parsed === null) throw new CliUsageError(`flag --${flag} requires an integer value (got "${raw}")`, `Pass a decimal integer with no sign or whitespace, e.g. \`--${flag} 60\`. Fractions, exponents, and decimal points are not accepted. Use \`umactually review --help\` for the units and bounds.`);
	return parsed;
}
function readMinimumSeverity(args, index) {
	return readEnum("--minimum-severity", readValue(args, index, "minimum-severity"), FIELDS.minimumSeverity.enumValues, CliUsageError);
}
function readPlatform(value) {
	if (value === "azure-devops") return "azure";
	return readEnum("--platform", value, FIELDS.platform.enumValues, CliUsageError);
}
function readEffort(args, index) {
	return readEnum("--effort", readValue(args, index, "effort"), FIELDS.effort.enumValues, CliUsageError);
}
function readProvider(value) {
	return readEnum("--provider", value, FIELDS.provider.enumValues, CliUsageError);
}
/**
* Build a `CliUsageError` for an unknown flag token, including a
* "did you mean ...?" suggestion when one is close enough to be
* plausible. The candidate set is the canonical flag list pulled from
* the field schema; values from any field whose `flag` is non-null.
*
* Always includes a remediation hint pointing the operator at
* `--help` (so they can list every accepted flag) and at the
* modes banner (for the bare-invocation case where the user simply
* forgot to supply the provider flags).
*/
function unknownFlagUsageError(token, argv) {
	const suggestion = didYouMean(token, [...FIELD_BY_FLAG.keys()]);
	let message = `unknown flag: ${token}`;
	if (suggestion !== null && suggestion !== token) message += ` (did you mean \`${suggestion}\`?)`;
	const sawPositionalCommand = argv.slice(0, argv.indexOf(token)).some((t) => !t.startsWith("-"));
	const hint = suggestion !== null && suggestion !== token ? `Try \`${suggestion}\`. To see every flag and what it does, run \`umactually review --help\`. If you meant to provide the review API config, run \`umactually review --api-url <url> --api-key <key>\`.` : sawPositionalCommand ? `Run \`umactually review --help\` for every flag the \`review\` subcommand accepts.` : `Run \`umactually --help\` for a flag list, or \`umactually review --api-url <url> --api-key <key>\` for the standard standalone invocation.`;
	return new CliUsageError(message, hint);
}
//#endregion
//#region src/cli/check-review-artifact.ts
const PARSE_FAIL_MARKERS = [
	"Provider response did not contain a valid JSON review payload",
	"Parse failed — provider response",
	"Parse failed"
];
const CLEAN_VERDICTS = /* @__PURE__ */ new Set(["APPROVED", "SHIP"]);
function classifyReviewArtifact(path) {
	let content;
	try {
		content = readFileSync(path, "utf8");
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return {
			ok: false,
			reason: "file not found"
		};
		return {
			ok: false,
			reason: `cannot read artifact: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	if (PARSE_FAIL_MARKERS.some((marker) => content.includes(marker))) return {
		ok: false,
		reason: "contains parse-fail sentinel"
	};
	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch (error) {
		if (error instanceof SyntaxError) return {
			ok: false,
			reason: "invalid JSON"
		};
		throw error;
	}
	if (!isRecord$1(parsed)) return {
		ok: false,
		reason: "invalid artifact: expected a JSON object"
	};
	const event = stringField(parsed, "event");
	const verdict = stringField(parsed, "verdict");
	const postedStatusState = stringField(parsed, "postedStatusState");
	const inlineThreadCount = numberField(parsed, "inlineThreadCount");
	const postedThreadCount = numberField(parsed, "postedThreadCount");
	const suppressedCommentCount = numberField(parsed, "suppressedCommentCount");
	const totalFindings = inlineThreadCount + postedThreadCount;
	if (parsed["parseFailed"] === true) return {
		ok: false,
		reason: "parse-fail: artifact explicitly flagged parseFailed=true"
	};
	if (!(event.length > 0 || verdict.length > 0 || postedStatusState.length > 0 || totalFindings > 0)) return {
		ok: false,
		reason: "parse-fail: no event, verdict, status, or findings"
	};
	if (verdict.toUpperCase() === "NEEDS_FIX" && totalFindings === 0) return {
		ok: false,
		reason: "contradictory review: verdict=NEEDS_FIX with 0 findings"
	};
	const isCleanVerdict = CLEAN_VERDICTS.has(verdict.toUpperCase()) || CLEAN_VERDICTS.has(postedStatusState.toUpperCase());
	if (totalFindings === 0 && suppressedCommentCount === 0 && !isCleanVerdict) return {
		ok: true,
		summary: "accepted low-signal review"
	};
	return {
		ok: true,
		summary: `real review (${totalFindings} findings, verdict=${verdict || postedStatusState || event})`
	};
}
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNodeError(error) {
	return error instanceof Error && "code" in error;
}
function stringField(value, key) {
	const field = value[key];
	return field === void 0 || field === null ? "" : String(field).trim();
}
function numberField(value, key) {
	return Number(value[key] ?? 0);
}
//#endregion
//#region src/cli/doctor.ts
const MIN_NODE_MAJOR = 24;
async function runDoctor(deps) {
	const checks = [
		checkNode(deps.nodeVersion ?? process.versions.node),
		await checkDistFreshness(deps),
		checkEnv(deps.env),
		await checkGit(deps)
	];
	const exitCode = checks.some((check) => check.status === "fail") ? 1 : 0;
	const json = {
		schemaVersion: 1,
		command: "doctor",
		exitCode,
		checks
	};
	return deps.isTTY ? {
		exitCode,
		checks,
		json,
		stdout: formatDoctorHuman(checks)
	} : {
		exitCode,
		checks,
		json
	};
}
function checkNode(nodeVersion) {
	const nodeMajor = Number.parseInt(nodeVersion.split(".", 1)[0] ?? "", 10);
	if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) return {
		id: "node",
		status: "fail",
		message: `Node ${nodeVersion} detected; ${MIN_NODE_MAJOR}.x or later required`,
		hint: "Install Node 24+ from https://nodejs.org/"
	};
	return {
		id: "node",
		status: "ok",
		message: `Node ${nodeVersion}`
	};
}
async function checkDistFreshness(deps) {
	const root = deps.packageRoot.replace(/[\\/]$/u, "");
	const distPath = `${root}/dist/cli.js`;
	const srcPath = `${root}/src/cli.ts`;
	const distStat = await statOrNull(deps.fsAdapter, distPath);
	const srcStat = await statOrNull(deps.fsAdapter, srcPath);
	if (distStat === null && srcStat === null) return {
		id: "dist-freshness",
		status: "skip",
		message: "standalone binary — dist/ is embedded, not on disk"
	};
	if (distStat === null) return {
		id: "dist-freshness",
		status: "fail",
		message: `${distPath} is missing`,
		hint: "Run `npm run bundle` to produce dist/cli.js"
	};
	if (srcStat === null) return {
		id: "dist-freshness",
		status: "skip",
		message: `${srcPath} not present (npm install); cannot compare freshness`
	};
	if (distStat.mtimeMs < srcStat.mtimeMs) return {
		id: "dist-freshness",
		status: "fail",
		message: `${distPath} is older than ${srcPath}`,
		hint: "Run `npm run bundle` to refresh dist/cli.js"
	};
	return {
		id: "dist-freshness",
		status: "ok",
		message: `${distPath} present and fresh`
	};
}
async function statOrNull(fsAdapter, path) {
	try {
		return await fsAdapter.stat(path);
	} catch {
		return null;
	}
}
function checkEnv(env) {
	const presence = [...KNOWN_ENV_VAR_NAMES].map((name) => ({
		name,
		present: typeof env[name] === "string" && env[name].length > 0
	}));
	return {
		id: "env",
		status: "ok",
		message: `${presence.filter((entry) => entry.present).length}/${KNOWN_ENV_VAR_NAMES.size} known env vars present`,
		presence
	};
}
async function checkGit(deps) {
	try {
		return (await deps.execFile("git", ["rev-parse", "--is-inside-work-tree"], { cwd: deps.cwd })).stdout.trim() === "true" ? {
			id: "git",
			status: "ok",
			message: "cwd is inside a git work tree"
		} : {
			id: "git",
			status: "warn",
			message: "cwd is not inside a git work tree"
		};
	} catch {
		return {
			id: "git",
			status: "warn",
			message: "git is not on PATH or cwd is not inside a work tree"
		};
	}
}
function formatDoctorHuman(checks) {
	return `${checks.map((check) => {
		const hint = check.hint === void 0 ? "" : `\n  hint: ${check.hint}`;
		return `${check.status.toUpperCase().padEnd(4)} ${check.id}: ${check.message}${hint}`;
	}).join("\n")}\n`;
}
function formatDoctorJson(result) {
	const envelope = result.json ?? {
		schemaVersion: 1,
		command: "doctor",
		exitCode: result.exitCode,
		checks: result.checks
	};
	return `${JSON.stringify(envelope)}\n`;
}
//#endregion
//#region src/util/provider-defaults.ts
/** Canonical provider/platform URL defaults. Centralizing prevents drift between the loader, live provider, help text, and platform modules. */
/** OpenAI default base URL. Used by `config/loader.ts` and the OpenAI-compatible client as the default when `--api-url` is unset and no provider-specific override applies. */
const DEFAULT_OPENAI_URL = "https://api.openai.com/v1";
/** Anthropic Messages API default base URL. Used by `cli/live-provider.ts` when `--provider anthropic` is set and `--api-url` is unset. */
const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com/v1";
/** GitHub API default base URL. Used by Copilot token exchange (`provider/copilot.ts`) and Copilot routing in `cli/live-provider.ts`. */
const DEFAULT_GITHUB_API_BASE = "https://api.github.com";
//#endregion
//#region src/cli/modes-help.ts
/** Canonical CLI modes banner shared by help and bare invocation output. */
const CLI_MODES_TEXT = `umactually: Modes:

Standalone mode (any git repo, no CI required)
  umactually --api-url https://api.minimax.io/v1 --api-key "$UMACTUALLY_API_KEY"
  real review, written to ./umactually-review.json, no platform posting

Live CI mode (GitHub Actions, Azure DevOps)
  umactually --platform github
  derive PR context from the runner and post the review through the CLI

Outside a git repo (advanced)
  umactually --api-url https://example.com --api-key "$UMACTUALLY_API_KEY" --event /tmp/event.json --diff /tmp/pr.diff --review /tmp/review.json --pr-number 42 --repo owner/name
  provide event, diff, review, PR number, and repository explicitly

Dry-run smoke test: pass --dry-run to any of the above to skip the provider call.
`;
//#endregion
//#region src/cli/uninstall.ts
const { join: join$1 } = path;
const SHELL_RC_FILES = [
	".zshrc",
	".bashrc",
	".profile"
];
/** Default stdin reader: a single line from /dev/tty via readline, with a
*  30-second safety timeout. Returns null on no-TTY, EOF, timeout, or any
*  other failure. Never blocks indefinitely on a pipe.
*
*  The `isTTY` parameter is REQUIRED. The caller is expected to pass the
*  same TTY signal it used to decide whether to prompt in the first place
*  (typically `deps.isTTY`). This avoids a subtle inconsistency: in JSON
*  mode, `deps.isTTY` is `false` (so the prompt is skipped to keep the
*  JSON envelope clean), but `process.stdin.isTTY` is independent and
*  could still be `true` if the user is running interactively. Reading
*  process.stdin in that case would corrupt the JSON output. The caller
*  is the source of truth for "should we prompt?".
*
*  The prompt text is written to STDERR (not stdout) so it does not
*  interleave with the human output stream. We do NOT pass
*  `output: process.stdout` to readline with `terminal: true` because
*  that path emits `
` to stdout before reading the answer —
*  which would interleave a stray blank line with the check lines
*  emitted later. Instead we use `terminal: false` and write the
*  prompt via stderr.
*
*  `terminal: false` disables TTY-aware prompt handling; on a real TTY
*  the raw line-mode read still works. The 30s timer is the user-facing
*  safety: SIGINT (Ctrl+C) and EOF (Ctrl+D) both settle with `null`,
*  which `shouldPrompt` treats as a decline. */
async function defaultStdinReader(promptText, isTTY) {
	if (isTTY !== true) return null;
	return new Promise((resolve) => {
		let settled = false;
		let timer = null;
		let rl = null;
		const settle = (value) => {
			if (settled) return;
			settled = true;
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
			if (rl !== null) {
				try {
					rl.close();
				} catch {}
				rl = null;
			}
			resolve(value);
		};
		timer = setTimeout(() => settle(null), 3e4);
		process.stderr.write(promptText);
		try {
			rl = createInterface({
				input: process.stdin,
				terminal: false
			});
		} catch {
			settle(null);
			return;
		}
		rl.on("line", (line) => {
			settle(line);
		});
		rl.on("close", () => {
			settle(null);
		});
		rl.on("SIGINT", () => {
			settle(null);
		});
	});
}
const defaultFsAdapter = {
	exists: (path) => existsSync(path),
	isSymlink: (path) => {
		try {
			return lstatSync(path).isSymbolicLink();
		} catch {
			return false;
		}
	},
	isFile: (path) => {
		try {
			return lstatSync(path).isFile();
		} catch {
			return false;
		}
	},
	isDirectory: (path) => {
		try {
			return lstatSync(path).isDirectory();
		} catch {
			return false;
		}
	},
	unlink: (path) => {
		unlinkSync(path);
	},
	getMode: (path) => {
		try {
			return statSync(path).mode & 4095;
		} catch {
			return null;
		}
	},
	setMode: (path, mode) => {
		chmodSync(path, mode);
	},
	removeDir: (path, options) => {
		rmSync(path, {
			recursive: options.recursive,
			force: true
		});
	},
	readFile: (path) => readFileSync(path, "utf8"),
	writeFile: (path, content) => {
		writeFileSync(path, content, "utf8");
	},
	writeFileAtomic: (path, content) => {
		const tmpPath = `${path}.umactually-tmp-${process.pid}-${Date.now()}`;
		try {
			writeFileSync(tmpPath, content, "utf8");
			renameSync(tmpPath, path);
		} catch (err) {
			try {
				unlinkSync(tmpPath);
			} catch {}
			throw err;
		}
	}
};
function parseUninstallArgs(argv) {
	const errors = [];
	let removeBinary = true;
	let purgeConfig = false;
	let revertPath = false;
	let yes = false;
	let help = false;
	let json = false;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === void 0) continue;
		switch (arg) {
			case "--help":
			case "-h":
				help = true;
				break;
			case "--remove-binary":
				removeBinary = true;
				break;
			case "--no-remove-binary":
				removeBinary = false;
				break;
			case "--purge-config":
				purgeConfig = true;
				break;
			case "--revert-path":
				revertPath = true;
				break;
			case "--yes":
			case "-y":
				yes = true;
				break;
			case "--json":
				json = true;
				break;
			default: if (arg.startsWith("-")) errors.push(`unknown flag: ${arg}`);
			else errors.push(`unexpected positional arg: ${arg}`);
		}
	}
	return {
		mode: {
			removeBinary,
			purgeConfig,
			revertPath,
			yes
		},
		errors,
		help,
		json
	};
}
function classifyExecPath(execPath, platform, homeDir) {
	const p = platform === "win32" ? path.win32 : path.posix;
	const name = p.basename(execPath).toLowerCase();
	if (platform === "win32") {
		if (name !== "umactually.exe") return {
			ok: false,
			reason: `process.execPath basename is "${name}", expected "umactually.exe"`
		};
	} else if (name !== "umactually") return {
		ok: false,
		reason: `process.execPath basename is "${name}", expected "umactually"`
	};
	const parent = p.dirname(execPath);
	const homeLocalBin = p.join(homeDir, ".local", "bin");
	if (parent === homeLocalBin) return {
		ok: true,
		installDir: parent
	};
	if (platform !== "win32" && (parent === "/usr/local/bin" || parent === `${p.sep}usr${p.sep}local${p.sep}bin`)) return {
		ok: true,
		installDir: parent
	};
	const homeBin = p.join(homeDir, "bin");
	const homeDotBin = p.join(homeDir, ".bin");
	if (parent === homeBin || parent === homeDotBin) return {
		ok: true,
		installDir: parent
	};
	if (platform !== "win32") {
		const rest = parent.startsWith(`/opt${p.sep}`) ? parent.slice(`/opt${p.sep}`.length) : null;
		if (rest !== null && rest.length > 0 && rest.endsWith(`${p.sep}bin`)) {
			const beforeBin = rest.slice(0, -`${p.sep}bin`.length);
			if (beforeBin.length > 0 && !beforeBin.includes(p.sep)) return {
				ok: true,
				installDir: parent
			};
		}
	}
	return {
		ok: false,
		reason: `process.execPath "${execPath}" is not in a recognised install directory (${homeLocalBin}, /usr/local/bin, ${homeBin}, or /opt/<name>/bin)`
	};
}
function findShellRcBlocks(content) {
	const blocks = [];
	const re = /^[ \t]*# Added by umactually installer[^\n]*\n[ \t]*export PATH="[^"]*"[ \t]*\n?/gm;
	let m;
	while ((m = re.exec(content)) !== null) blocks.push({
		start: m.index,
		end: m.index + m[0].length
	});
	return blocks;
}
function stripShellRcBlocks(content) {
	const blocks = findShellRcBlocks(content);
	if (blocks.length === 0) return content;
	let out = "";
	let cursor = 0;
	for (const block of blocks) {
		out += content.slice(cursor, block.start);
		cursor = block.end;
	}
	out += content.slice(cursor);
	return out;
}
async function runUninstall(deps) {
	const checks = [];
	const classified = classifyExecPath(deps.execPath, deps.platform, deps.homeDir);
	if (!classified.ok) {
		checks.push({
			id: "exec-path",
			status: "fail",
			message: classified.reason,
			hint: "Run uninstall from the installed binary, not from `node` or an npm-installed copy"
		});
		return {
			exitCode: 2,
			checks
		};
	}
	checks.push({
		id: "exec-path",
		status: "ok",
		message: `${deps.execPath} is a recognised umactually install location`
	});
	if (deps.mode?.removeBinary === false) {
		checks.push({
			id: "binary-removal",
			status: "skip",
			message: "--no-remove-binary was set; the running binary is being kept"
		});
		return {
			exitCode: 0,
			checks
		};
	} else if (shouldPrompt(deps)) {
		const confirm = await (deps.stdinReader ?? defaultStdinReader)("Remove the running binary? [y/N] ", deps.isTTY);
		if (confirm === null || !/^y(es)?$/i.test(confirm.trim())) {
			checks.push({
				id: "binary-removal",
				status: "skip",
				message: "user declined the confirmation prompt",
				declined: true
			});
			return {
				exitCode: 1,
				checks
			};
		}
	}
	const isLink = deps.fsAdapter.isSymlink(deps.execPath);
	const isFile = deps.fsAdapter.isFile(deps.execPath);
	if (isLink) {
		checks.push({
			id: "binary-removal",
			status: "fail",
			message: `${deps.execPath} is a symlink — refusing to unlink it directly`,
			hint: "Resolve the link and uninstall the target instead"
		});
		return {
			exitCode: 2,
			checks
		};
	}
	if (!isFile) checks.push({
		id: "binary-removal",
		status: "skip",
		message: `${deps.execPath} is not a regular file (already removed?)`
	});
	else try {
		deps.fsAdapter.unlink(deps.execPath);
		checks.push({
			id: "binary-removal",
			status: "ok",
			message: `removed ${deps.execPath}`
		});
		if (deps.platform === "win32" && deps.fsAdapter.exists(deps.execPath)) checks.push(scheduleWindowsDelayedDelete(deps.execPath));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (deps.platform === "win32") {
			checks.push(scheduleWindowsDelayedDelete(deps.execPath));
			checks.push({
				id: "binary-removal",
				status: "warn",
				message: `could not unlink ${deps.execPath} directly (${message}); a delayed-delete helper was scheduled`
			});
		} else {
			checks.push({
				id: "binary-removal",
				status: "fail",
				message: `could not unlink ${deps.execPath}: ${message}`
			});
			return {
				exitCode: 1,
				checks
			};
		}
	}
	return {
		exitCode: 0,
		checks
	};
}
function purgeConfig(deps) {
	const checks = [];
	const configDir = join$1(deps.homeDir, ".umactually");
	const cacheDir = join$1(deps.homeDir, ".cache", "umactually");
	for (const dir of [configDir, cacheDir]) {
		const dirNormalized = path.normalize(dir);
		if (!(dirNormalized === deps.homeDir || dirNormalized.startsWith(deps.homeDir + path.sep))) {
			checks.push({
				id: dir === cacheDir ? "cache-removal" : "config-removal",
				status: "fail",
				message: `${dir} is not inside ${deps.homeDir}; refusing to remove (safety check)`
			});
			continue;
		}
		if (!deps.fsAdapter.exists(dir)) {
			checks.push({
				id: dir === cacheDir ? "cache-removal" : "config-removal",
				status: "skip",
				message: `${dir} does not exist`
			});
			continue;
		}
		if (!deps.fsAdapter.isDirectory(dir)) {
			checks.push({
				id: dir === cacheDir ? "cache-removal" : "config-removal",
				status: "warn",
				message: `${dir} is not a directory — skipping`
			});
			continue;
		}
		try {
			deps.fsAdapter.removeDir(dir, { recursive: true });
			checks.push({
				id: dir === cacheDir ? "cache-removal" : "config-removal",
				status: "ok",
				message: `removed ${dir}`
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			checks.push({
				id: dir === cacheDir ? "cache-removal" : "config-removal",
				status: "fail",
				message: `could not remove ${dir}: ${message}`
			});
		}
	}
	return checks;
}
function revertPath(deps) {
	const checks = [];
	let anyChanges = false;
	for (const rc of SHELL_RC_FILES) {
		const path = join$1(deps.homeDir, rc);
		if (!deps.fsAdapter.exists(path)) continue;
		if (deps.fsAdapter.isSymlink(path)) {
			checks.push({
				id: "path-revert",
				status: "skip",
				message: `${path} is a symlink — refusing to modify`
			});
			continue;
		}
		let content;
		try {
			content = deps.fsAdapter.readFile(path);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			checks.push({
				id: "path-revert",
				status: "warn",
				message: `could not read ${path}: ${message}`
			});
			continue;
		}
		const blocks = findShellRcBlocks(content);
		if (blocks.length === 0) continue;
		const stripped = stripShellRcBlocks(content);
		if (stripped === content) continue;
		const originalMode = deps.fsAdapter.getMode(path);
		try {
			deps.fsAdapter.writeFileAtomic(path, stripped);
			if (originalMode !== null && originalMode !== void 0) try {
				deps.fsAdapter.setMode(path, originalMode);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				checks.push({
					id: "path-revert",
					status: "warn",
					message: `removed ${blocks.length} umactually block(s) from ${path}, but could not restore mode ${originalMode.toString(8)}: ${message}`,
					hint: `Run: chmod ${originalMode.toString(8)} ${path}`
				});
				anyChanges = true;
				continue;
			}
			anyChanges = true;
			checks.push({
				id: "path-revert",
				status: "ok",
				message: `removed ${blocks.length} umactually block(s) from ${path}`
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			checks.push({
				id: "path-revert",
				status: "fail",
				message: `could not write ${path}: ${message}`
			});
		}
	}
	if (!anyChanges) checks.push({
		id: "path-revert",
		status: "skip",
		message: `no umactually PATH block found in ${SHELL_RC_FILES.join(" / ")}`
	});
	return checks;
}
function shouldPrompt(deps) {
	if (deps.mode?.yes === true) return false;
	if (!deps.isTTY) return false;
	const yesEnv = deps.env["UMACTUALLY_UNINSTALL_YES"] ?? deps.env["UMACTUALLY_YES"];
	return yesEnv !== "1" && yesEnv !== "true";
}
function scheduleWindowsDelayedDelete(targetPath) {
	const tmpDir = process.env["TEMP"] ?? process.env["TMP"] ?? "/tmp";
	const scriptPath = join$1(tmpDir, `umactually-uninstall-${process.pid}-${Date.now()}.cmd`);
	const body = [
		"@echo off",
		"ping -n 4 127.0.0.1 >nul",
		"del /f /q \"%~1\"",
		`del /f /q "${scriptPath.replace(/"/gu, "\"\"")}"`,
		""
	].join("\r\n");
	try {
		writeFileSync(scriptPath, body, "utf8");
		const child = spawn("cmd.exe", [
			"/c",
			scriptPath,
			targetPath
		], {
			detached: true,
			stdio: "ignore",
			windowsHide: true
		});
		child.on("error", () => {});
		child.unref();
		return {
			id: "self-deletion",
			status: "warn",
			message: `Windows held a write lock on the running binary; a delayed-delete helper was scheduled at ${scriptPath}`
		};
	} catch (err) {
		return {
			id: "self-deletion",
			status: "fail",
			message: `could not schedule delayed-delete helper for ${targetPath}: ${err instanceof Error ? err.message : String(err)}. The binary may need to be removed manually.`
		};
	}
}
const UNINSTALL_HELP_TEXT = [
	`umactually uninstall — remove the installed binary, config, and PATH entries`,
	"",
	"Usage:",
	"  umactually uninstall [flags]    Remove the running binary and (optionally) related files",
	"  umactually uninstall --help     Show this help",
	"",
	"Flags:",
	"  --remove-binary     (default) Delete the running binary at process.execPath",
	"  --no-remove-binary  Skip the binary removal (only useful with --purge-config / --revert-path)",
	"  --purge-config      Also delete ~/.umactually/ and ~/.cache/umactually/",
	"  --revert-path       Also remove the installer's PATH line from ~/.zshrc / ~/.bashrc / ~/.profile",
	"  --yes, -y           Skip the interactive confirmation prompt",
	"  --json              Emit machine-readable JSON output",
	"  --help, -h          Show this help",
	"",
	"By default the binary is removed, the config/cache dirs are left alone, and the",
	"PATH entry stays in your shell config. The confirmation prompt only appears on a",
	"TTY. Non-interactive shells (CI, cron) must pass --yes or set UMACTUALLY_UNINSTALL_YES=1.",
	"",
	"Exit codes:",
	"  0  Uninstall completed (with at least the binary removed)",
	"  1  User declined the confirmation prompt",
	"  2  Usage error or unsafe exec path"
].join("\n");
function formatUninstallHuman(result) {
	return `${result.checks.map((c) => {
		const hint = c.hint === void 0 ? "" : `\n  hint: ${c.hint}`;
		return `${c.status.toUpperCase().padEnd(4)} ${c.id}: ${c.message}${hint}`;
	}).join("\n")}\n`;
}
function formatUninstallJson(result, mode, execPath) {
	const envelope = result.json ?? {
		schemaVersion: 1,
		command: "uninstall",
		exitCode: result.exitCode,
		execPath,
		mode,
		checks: result.checks
	};
	return `${JSON.stringify(envelope)}\n`;
}
/**
* True if the runUninstall result indicates the user declined the
* confirmation prompt. Used by runUninstallBranch to gate the
* purge-config and revert-path follow-up actions so a 'n' answer
* to the binary prompt does not silently wipe the user's data.
*
* Detection uses the structured `check.declined === true` flag
* (set by runUninstall when the user types 'n' or EOFs the prompt)
* rather than a substring match on the human-readable message. The
* structured flag is compile-time linked and survives message
* rewordings.
*/
function userDeclinedPrompt(result) {
	return result.exitCode === 1 && result.checks.some((c) => c.id === "binary-removal" && c.status === "skip" && c.declined === true);
}
//#endregion
//#region src/cli/help.ts
/**
* CLI help text. Flag descriptions are column-aligned so `--help` output is
* scannable instead of drifting as flags are added.
*
* `FLAG_COLUMN_WIDTH` is computed at runtime from the longest entry in
* `HELP_FLAGS` (currently `--debug-raw-response | --no-debug-raw-response`
* at 46 chars). With the 2-space indent and 2-space gutter, the description
* column starts at column 51 (1-indexed). Future flag additions are
* trivially correct because adding a longer flag recomputes the width.
*
* The `--github-api-base`, `--review-file-limit`, and `--minimum-severity`
* entries previously sat at unrelated columns (25/27/34); fixing them
* surfaces the previously-unread descriptions and makes future flag
* additions trivial.
*
* Help is contextual: `--help` shows the top-level overview with all
* commands, while `<command> --help` shows only the flags relevant to
* that command. This is achieved by tagging each flag with the commands
* it applies to (`appliesTo`) and filtering at render time.
*/
/** Global flags that appear in every help context. */
const GLOBAL_FLAGS = [{
	flag: "--no-color",
	description: "Disable decorative ANSI color (also: non-empty NO_COLOR)"
}, {
	flag: "--json",
	description: "Emit machine-readable JSON output (doctor, review)"
}];
const REVIEW_FLAGS = [
	{
		flag: "--platform <auto|github|azure>",
		appliesTo: ["review"]
	},
	{
		flag: "--event <path>",
		description: "GitHub event JSON or Azure pull-request JSON",
		appliesTo: ["review"]
	},
	{
		flag: "--diff <path>",
		description: "PR diff text",
		appliesTo: ["review"]
	},
	{
		flag: "--threads <path>",
		description: "Azure existing threads JSON (ADO wrapper mode)",
		appliesTo: ["review"]
	},
	{
		flag: "--review <path>",
		description: "Azure provider review JSON (ADO wrapper mode)",
		appliesTo: ["review"]
	},
	{
		flag: "--pr-number <n>",
		description: "Pull request number",
		appliesTo: ["review"]
	},
	{
		flag: "--repo <owner/name>",
		appliesTo: ["review"]
	},
	{
		flag: "--api-url <url>",
		description: `Provider Responses API URL (default: ${DEFAULT_OPENAI_URL})`,
		appliesTo: ["review"]
	},
	{
		flag: "--api-key <key>",
		description: "Provider API key",
		appliesTo: ["review"]
	},
	{
		flag: "--model <id>",
		description: "Provider model id (default: auto)",
		appliesTo: ["review"]
	},
	{
		flag: "--prompt <text>",
		description: "Inline system prompt override",
		appliesTo: ["review"]
	},
	{
		flag: "--prompt-file <path>",
		appliesTo: ["review"]
	},
	{
		flag: "--prompt-files <paths>",
		description: "Comma/newline-separated system prompt files (overrides defaults)",
		appliesTo: ["review"]
	},
	{
		flag: "--additional-prompt <text>",
		appliesTo: ["review"]
	},
	{
		flag: "--additional-prompt-file <path>",
		appliesTo: ["review"]
	},
	{
		flag: "--additional-prompt-files <paths>",
		description: "Comma/newline-separated additional prompt files (overrides defaults)",
		appliesTo: ["review"]
	},
	{
		flag: "--effort <low|medium|high>",
		description: "Reasoning effort hint (default: medium)",
		appliesTo: ["review"]
	},
	{
		flag: "--provider <openai-compatible|copilot|anthropic>",
		description: "Provider family (anthropic uses native /v1/messages)",
		appliesTo: ["review"]
	},
	{
		flag: "--github-api-base <url>",
		description: `GitHub API base URL (Copilot token exchange; default: ${DEFAULT_GITHUB_API_BASE})`,
		appliesTo: ["review"]
	},
	{
		flag: "--include-sonarqube",
		appliesTo: ["review"]
	},
	{
		flag: "--sonar-host-url <url>",
		appliesTo: ["review"]
	},
	{
		flag: "--sonar-token <token>",
		appliesTo: ["review"]
	},
	{
		flag: "--sonar-project-key <key>",
		appliesTo: ["review"]
	},
	{
		flag: "--sonar-timeout-seconds <n>",
		appliesTo: ["review"]
	},
	{
		flag: "--review-timeout-seconds <n>",
		appliesTo: ["review"]
	},
	{
		flag: "--stall-seconds <n>",
		appliesTo: ["review"]
	},
	{
		flag: "--per-request-timeout-seconds <n>",
		appliesTo: ["review"]
	},
	{
		flag: "--max-output-tokens <n>",
		appliesTo: ["review"]
	},
	{
		flag: "--max-comments <n>",
		appliesTo: ["review"]
	},
	{
		flag: "--review-file-limit <n>",
		description: "Cap on changed files for live review (0 = disable)",
		appliesTo: ["review"]
	},
	{
		flag: "--minimum-severity <low|medium|high>",
		description: "default: medium",
		appliesTo: ["review"]
	},
	{
		flag: "--strict-schema | --no-strict-schema",
		description: "Send response_format json_schema on the wire (default: yes)",
		appliesTo: ["review"]
	},
	{
		flag: "--verify-findings | --no-verify-findings",
		description: "Deterministic (path,line) re-verification before posting (default: yes)",
		appliesTo: ["review"]
	},
	{
		flag: "--walkthrough | --no-walkthrough",
		appliesTo: ["review"]
	},
	{
		flag: "--diagnostic | --no-diagnostic",
		appliesTo: ["review"]
	},
	{
		flag: "--debug-raw-response | --no-debug-raw-response",
		appliesTo: ["review"]
	},
	{
		flag: "--detect-leaks | --no-detect-leaks",
		appliesTo: ["review"]
	},
	{
		flag: "--dry-run | --no-dry-run",
		appliesTo: ["review"]
	},
	{
		flag: "--simulate-findings | --no-simulate-findings",
		appliesTo: ["review"]
	},
	{
		flag: "--output-artifact <path>",
		appliesTo: ["review"]
	}
];
/** All flags, used for the legacy `CLI_HELP_TEXT` export and column-width calc. */
const HELP_FLAGS = [...REVIEW_FLAGS];
/** The full flag set for column-width calculation. */
const ALL_FLAGS_FOR_WIDTH = [...REVIEW_FLAGS, ...GLOBAL_FLAGS];
function flagsForContext(context) {
	if (context === "all") return [...REVIEW_FLAGS, ...GLOBAL_FLAGS];
	return [...REVIEW_FLAGS.filter((f) => f.appliesTo?.includes(context) ?? false), ...GLOBAL_FLAGS];
}
/** Column width is always computed from the full flag set for consistency. */
const FLAG_COLUMN_WIDTH = ALL_FLAGS_FOR_WIDTH.reduce((max, { flag }) => Math.max(max, flag.length), 0);
const GUTTER_SPACES = 2;
const INDENT_SPACES = 2;
/** Render one flag with optional description, padded to the canonical description column. */
function renderFlagLine({ flag, description }) {
	const padding = " ".repeat(FLAG_COLUMN_WIDTH - flag.length + GUTTER_SPACES);
	const head = `${" ".repeat(INDENT_SPACES)}${flag}${padding}`;
	return description === void 0 ? head : `${head}${description}`;
}
function renderFlags(flags) {
	return flags.map(renderFlagLine);
}
const CLI_HELP_TEXT = [
	`${BRAND} — provider-agnostic PR review CLI`,
	"",
	"Commands:",
	...[
		"review                    Run PR review (default)",
		"doctor                    Check environment is ready",
		"uninstall                 Remove the installed binary, config, and PATH entries",
		"check-review-artifact <path>  Validate a review artifact",
		"version                   Print version",
		"--help, -h                Show this help",
		"--version, -V             Print version"
	].map((c) => `  ${c}`),
	"",
	"Review flags (use `umactually review --help` for full details):",
	...HELP_FLAGS.map(renderFlagLine),
	"",
	"Global flags:",
	...GLOBAL_FLAGS.map(renderFlagLine),
	"",
	CLI_MODES_TEXT,
	"See exit codes: docs/exit-codes.md"
].join("\n");
/** Map from command name to its dedicated help text. */
const COMMAND_HELP = {
	review: [
		`${BRAND} review — run an AI-powered PR review`,
		"",
		"Usage:",
		"  umactually review [flags]       Run review (also the default command)",
		"  umactually review --help        Show this help",
		"",
		"Flags:",
		...renderFlags(flagsForContext("review")),
		"",
		CLI_MODES_TEXT,
		"See exit codes: docs/exit-codes.md"
	].join("\n"),
	doctor: [
		`${BRAND} doctor — check that your environment is ready for review`,
		"",
		"Usage:",
		"  umactually doctor                Run all environment checks",
		"  umactually doctor --json         Emit machine-readable JSON",
		"  umactually doctor --help         Show this help",
		"",
		"Checks:",
		"  node          Verifies Node.js >= 24 is on PATH",
		"  git           Verifies git is available and the cwd is a repository",
		"  env           Reports which UMACTUALLY_* / REVIEW_* env vars are set",
		"  dist-freshness Verifies the bundled dist/ is up to date (dev only)",
		"",
		"Global flags:",
		...GLOBAL_FLAGS.map(renderFlagLine),
		"",
		"Exit codes:",
		"  0  All checks passed",
		"  1  One or more checks failed or warned",
		"  2  Usage error"
	].join("\n"),
	uninstall: UNINSTALL_HELP_TEXT,
	"check-review-artifact": [
		`${BRAND} check-review-artifact — validate a review JSON artifact`,
		"",
		"Usage:",
		"  umactually check-review-artifact <path>   Validate the artifact at <path>",
		"  umactually check-review-artifact --help   Show this help",
		"",
		"The artifact is classified as:",
		"  ok       Valid review with a recognized verdict",
		"  fail     Invalid, unparseable, or parse-failed artifact",
		"",
		"Exit codes:",
		"  0  Artifact is valid",
		"  1  Artifact is invalid or unparseable",
		"  2  Usage error (no path given, or too many arguments)"
	].join("\n")
};
/**
* Resolve which help text to print based on the argv context.
*
* If a recognized subcommand appears before `--help` / `-h`, that
* command's dedicated help is shown. Otherwise the top-level help is
* shown (which includes the Commands banner).
*/
function resolveHelpText(argv) {
	const helpIndex = argv.indexOf("--help") !== -1 ? argv.indexOf("--help") : argv.indexOf("-h");
	if (helpIndex === -1) return CLI_HELP_TEXT;
	for (let i = 0; i < helpIndex; i += 1) {
		const token = argv[i];
		if (token === void 0 || token.startsWith("-")) continue;
		if (token in COMMAND_HELP) return COMMAND_HELP[token];
		break;
	}
	return CLI_HELP_TEXT;
}
/**
* Print contextual help text to stdout based on the argv context.
*
* This is the preferred entry point from `dispatch.ts`. It detects whether
* a subcommand preceded `--help` and renders the appropriate section.
*
* @returns The rendered help text that was written to stdout.
*/
function printContextualHelp(argv) {
	const helpText = resolveHelpText(argv);
	process.stdout.write(helpText);
	return helpText;
}
//#endregion
//#region src/cli/no-color.ts
/**
* Resolve whether decorative ANSI color should be enabled.
*
* GitHub annotation prefixes (`::notice::`, `::warning::`, and `::error::`)
* are workflow commands, not decorative color, and are unaffected.
*/
function resolveColorPolicy(opts) {
	if (opts.noColor || opts.json) return false;
	const noColorEnv = opts.env["NO_COLOR"];
	if (typeof noColorEnv === "string" && noColorEnv.length > 0) return false;
	return opts.isTTY;
}
//#endregion
//#region src/cli/dispatch.ts
const GLOBAL_ONLY_FLAGS = /* @__PURE__ */ new Set(["--json", "--no-color"]);
const execFile$1 = promisify(execFile);
function firstPositionalToken(argv) {
	for (const token of argv) {
		if (GLOBAL_ONLY_FLAGS.has(token)) continue;
		return token.startsWith("-") ? null : token;
	}
	return null;
}
function stripLeadingCommand(argv, command) {
	const commandIndex = argv.indexOf(command);
	return commandIndex === -1 ? argv.slice() : [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)];
}
async function dispatch(argv) {
	applyColorPolicy(argv);
	if (argv.includes("--version") || argv.includes("-V")) return runVersion(argv);
	if (argv.includes("--help") || argv.includes("-h")) {
		const stdout = printContextualHelp(argv);
		return argv.includes("--no-color") ? 0 : {
			exitCode: 0,
			stdout
		};
	}
	const command = firstPositionalToken(argv);
	if (command === null) return runReviewBranch(argv);
	switch (command) {
		case "review": return runReviewBranch(stripLeadingCommand(argv, command));
		case "doctor": return runDoctorBranch(stripLeadingCommand(argv, command));
		case "uninstall": return runUninstallBranch(stripLeadingCommand(argv, command));
		case "check-review-artifact": return runCheckReviewArtifactBranch(stripLeadingCommand(argv, command));
		case "version": return runVersion(stripLeadingCommand(argv, command));
		default: {
			const stderr = `unknown command: ${command}\n`;
			process.stderr.write(stderr);
			return {
				exitCode: 2,
				stderr
			};
		}
	}
}
function applyColorPolicy(argv) {
	return resolveColorPolicy({
		noColor: argv.includes("--no-color"),
		json: argv.includes("--json"),
		env: process.env,
		isTTY: process.stdout.isTTY === true
	});
}
async function runReviewBranch(args) {
	const json = args.includes("--json");
	const reviewArgs = args.filter((arg) => arg !== "--json" && arg !== "--no-color");
	if (json) return runJsonReview(reviewArgs);
	return { exitCode: (await runCli(reviewArgs, process.cwd())).exitCode };
}
async function runJsonReview(argv) {
	const reviewArgs = stripLeadingCommand(argv.filter((arg) => arg !== "--json" && arg !== "--no-color"), "review");
	const originalWrite = process.stdout.write;
	process.stdout.write = process.stderr.write.bind(process.stderr);
	try {
		const result = await runCli(reviewArgs, process.cwd());
		const envelope = {
			schemaVersion: 1,
			command: "review",
			exitCode: result.exitCode,
			resolvedConfig: result.resolvedConfig ?? {},
			outcome: {
				ok: result.exitCode === 0,
				...result.jsonOutcome
			}
		};
		const stdout = `${JSON.stringify(envelope)}\n`;
		originalWrite.call(process.stdout, stdout);
		return {
			exitCode: result.exitCode,
			stdout
		};
	} finally {
		process.stdout.write = originalWrite;
	}
}
function runCheckReviewArtifactBranch(args) {
	const artifactArgs = args.filter((arg) => arg !== "--no-color");
	const path = artifactArgs[0];
	if (path === void 0 || artifactArgs.length !== 1) {
		const stderr = "usage: umactually check-review-artifact <path>\n";
		process.stderr.write(stderr);
		return {
			exitCode: 2,
			stderr
		};
	}
	const result = classifyReviewArtifact(path);
	const stderr = `umactually: ${path}: ${(result.ok ? result.summary : result.reason) ?? "invalid artifact"}\n`;
	process.stderr.write(stderr);
	return {
		exitCode: result.ok ? 0 : 1,
		stderr
	};
}
async function runDoctorBranch(args) {
	const json = args.includes("--json");
	const packageRoot = dirname(process.execPath);
	const result = await runDoctor({
		cwd: process.cwd(),
		isTTY: process.stdout.isTTY === true,
		env: process.env,
		fsAdapter: { stat },
		execFile: async (file, fileArgs, options) => {
			const output = await execFile$1(file, fileArgs, options);
			return {
				stdout: output.stdout,
				stderr: output.stderr
			};
		},
		packageRoot
	});
	const stdout = json ? formatDoctorJson(result) : formatDoctorHuman(result.checks);
	process.stdout.write(stdout);
	return {
		exitCode: result.exitCode,
		stdout
	};
}
async function runUninstallBranch(args) {
	const { mode, errors, help, json } = parseUninstallArgs(args);
	if (help) {
		process.stdout.write(UNINSTALL_HELP_TEXT);
		process.stdout.write("\n");
		return {
			exitCode: 0,
			stdout: UNINSTALL_HELP_TEXT
		};
	}
	if (errors.length > 0) {
		const stderr = `umactually uninstall: ${errors.join("; ")}\n`;
		process.stderr.write(stderr);
		return {
			exitCode: 2,
			stderr
		};
	}
	const deps = {
		isTTY: process.stdout.isTTY === true && !json,
		env: process.env,
		fsAdapter: defaultFsAdapter,
		execPath: process.execPath,
		platform: process.platform,
		homeDir: homedir(),
		mode
	};
	const yesEnv = deps.env["UMACTUALLY_UNINSTALL_YES"] ?? deps.env["UMACTUALLY_YES"];
	const envAffirmed = yesEnv === "1" || yesEnv === "true";
	if (!deps.isTTY && mode.yes !== true && !envAffirmed && (mode.purgeConfig === true || mode.revertPath === true)) {
		const stderr = "umactually uninstall: --purge-config and --revert-path require --yes (or UMACTUALLY_UNINSTALL_YES=1) in non-interactive mode. Nothing was changed; re-run with --yes to proceed, or omit the destructive flags.\n";
		process.stderr.write(stderr);
		return {
			exitCode: 2,
			stderr
		};
	}
	const result = await runUninstall(deps);
	let additionalChecks = [];
	if (!userDeclinedPrompt(result) && (mode.purgeConfig === true || mode.revertPath === true)) if (shouldPrompt(deps)) {
		const parts = [];
		if (mode.purgeConfig === true) parts.push("remove ~/.umactually/ and ~/.cache/umactually/");
		if (mode.revertPath === true) parts.push("strip the umactually PATH block from your shell rc files");
		const promptText = `Also ${parts.join(" and ")}? [y/N] `;
		const confirm = await (deps.stdinReader ?? defaultStdinReader)(promptText, deps.isTTY);
		if (confirm !== null && /^y(es)?$/i.test(confirm.trim())) additionalChecks = [...mode.purgeConfig ? purgeConfig(deps) : [], ...mode.revertPath ? revertPath(deps) : []];
		else {
			const declineChecks = [];
			if (mode.purgeConfig === true) declineChecks.push({
				id: "config-removal",
				status: "skip",
				message: "user declined the additional cleanup prompt; ~/.umactually/ kept"
			});
			if (mode.revertPath === true) declineChecks.push({
				id: "path-revert",
				status: "skip",
				message: "user declined the additional cleanup prompt; shell rc files kept"
			});
			additionalChecks = declineChecks;
		}
	} else additionalChecks = [...mode.purgeConfig ? purgeConfig(deps) : [], ...mode.revertPath ? revertPath(deps) : []];
	const checks = [...result.checks, ...additionalChecks];
	const exitCode = checks.some((c) => c.status === "fail") ? 1 : result.exitCode;
	const finalResult = {
		...result,
		exitCode,
		checks
	};
	const stdout = json ? formatUninstallJson(finalResult, mode, deps.execPath) : formatUninstallHuman(finalResult);
	process.stdout.write(stdout);
	return {
		exitCode,
		stdout
	};
}
//#endregion
//#region src/security/scan-review-secrets.ts
const HIGH_CONFIDENCE_SECRET_PATTERNS = [
	/\bsk_test_[a-z_]+\b/g,
	/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
	/\bghp_[A-Za-z0-9]{36}\b/g
];
async function scanReviewSecrets(input) {
	const highConfidenceLeakCount = countHighConfidenceLeaks(input.diffText);
	const redactedDiff = redactHighConfidenceSecrets(input.diffText);
	return {
		artifactPath: input.expectedArtifact,
		highConfidenceLeakCount,
		redactedDiffIncludesSecret: countHighConfidenceLeaks(redactedDiff) > 0,
		blockedRawOutput: true
	};
}
function countHighConfidenceLeaks(diffText) {
	let highConfidenceLeakCount = 0;
	for (const line of diffText.split("\n")) if (isAddedDiffLine(line)) highConfidenceLeakCount += countLineSecrets(line);
	return highConfidenceLeakCount;
}
function redactHighConfidenceSecrets(diffText) {
	return diffText.split("\n").map((line) => isAddedDiffLine(line) ? redactLineSecrets(line) : line).join("\n");
}
function isAddedDiffLine(line) {
	return line.startsWith("+") && !line.startsWith("+++");
}
function countLineSecrets(line) {
	let secretCount = 0;
	for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) secretCount += Array.from(line.matchAll(pattern)).length;
	return secretCount;
}
function redactLineSecrets(line) {
	let redactedLine = line;
	for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) redactedLine = redactedLine.replace(pattern, REDACTED_SECRET_TOKEN);
	return redactedLine;
}
//#endregion
//#region src/util/marker.ts
/**
* Stable HTML markers and the manifest schema identifier emitted by the
* UmActually live review marker. Critical for dedup: the runner searches
* for these strings in existing PR comments, so a silent drift here
* would break every dedup loop and every downstream consumer that
* parses the manifest. Every reference (dry-run artifact, live review,
* fixture parser, raw-output type guard, GitHub agent) sees the same
* values via this module.
*/
/**
* Stable HTML marker the runner greps for in existing PR comments when
* deciding whether to replace a previous UmActually review.
*
* Renamed from `<!-- umactually -->` in v0.1.0 because the
* project ships under the bare `umactually` name and never launched —
* no installed copies depend on the old marker.
*/
const REVIEW_MARKER = "<!-- umactually -->";
/**
* JSON schema identifier for the UmActually manifest that lives inside
* the `<!-- umactually:manifest { ... } -->` HTML comment on every
* posted review. Format is `${BRAND}/v${VERSION}`. AI agents and
* downstream tooling parse this string to know they're reading an
* UmActually-shaped payload.
*
* NOT a generic "manifest schema" — this is UmActually-specific by
* design. The brand name appears in the schema id so consumers can
* tell UmActually manifests apart from any other review tool's
* payloads.
*/
const MANIFEST_SCHEMA = "umactually/v1";
/** Opening HTML-comment prefix of the manifest hidden inside each UmActually review comment. */
const MANIFEST_MARKER_PREFIX = `<!-- ${BRAND}:manifest `;
/** Closing HTML-comment suffix of the manifest hidden inside each UmActually review comment. */
const MANIFEST_MARKER_SUFFIX = " -->";
/**
* Returns true when `body` contains the UmActually review marker.
* Centralized so future marker variants (e.g. parent-vs-inline) only need
* to be added here.
*/
function commentBodyHasMarker(body) {
	return body.includes(REVIEW_MARKER);
}
//#endregion
//#region src/util/json-guards.ts
/**
* Type guard for a JSON object (excludes arrays, null, primitives).
* Replaces the 6+ copies scattered across the codebase, including one
* buggy copy in `src/azure/run-azure-review.ts:142` that does NOT exclude
* arrays — that copy returned `true` for any JSON including arrays.
*/
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Type guard for a JSON array (excludes objects, null, primitives).
* Centralized so duplicated `Array.isArray(value)` checks across
* `src/sonar/run-sonar-import.ts`, `src/azure/run-azure-review.ts`, and
* `src/provider/provider-parse.ts` share one definition.
*/
function isUnknownArray(value) {
	return Array.isArray(value);
}
/** Centralizes positive integer guards so CLI and provider paths stop open-coding safe-number checks. */
function isPositiveSafeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
/**
* Safe-integer guard (zero and negatives allowed). Centralizes the
* predicate that was inlined at 9+ sites across `src/cli/live-azure.ts`,
* `src/cli/live-shared.ts`, `src/cli/live-github.ts`,
* `src/cli/parse-args.ts` and the platform context modules.
*/
function isSafeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value);
}
/**
* Type-narrowed field reader for a string value at the given key.
* Returns `null` for missing keys or non-string values; callers can map
* `null` to a default or surface a parse error.
*
* Replaces the byte-identical local copies in `src/provider/provider-parse.ts`
* and `src/provider/copilot-token.ts` (one definition, many call sites).
*/
function readStringField$1(record, key) {
	const value = record[key];
	return typeof value === "string" ? value : null;
}
/**
* Throwing variant of `readStringField` for fixtures and contract-driven
* paths that require a value to be present (S4 mocked run, RED fixtures).
* Replaces the open-coded `typeof !== "string" throw` blocks previously
* duplicated in `src/azure/run-azure-review.ts:142` and
* `src/review/run-review.ts`.
*/
function readStringFieldOrThrow(record, key, label) {
	const value = record[key];
	if (typeof value !== "string") throw new TypeError(`Expected field '${label ?? key}' to be a string, received: ${typeof value}`);
	return value;
}
/**
* Type-narrowed field reader for a safe-integer number at the given key.
* Returns `null` for missing keys, non-number values, NaN/Infinity, or
* non-integer floats. Callers that want any safe integer (incl. 0/negative)
* use this; callers that want a positive safe integer use
* `isPositiveSafeInteger` directly.
*/
function readSafeIntegerField(record, key) {
	const value = record[key];
	return isSafeInteger(value) ? value : null;
}
/**
* Throwing variant of `readSafeIntegerField` for fixtures and contract-driven
* paths. Replaces the open-coded `typeof !== "number" throw` blocks
* previously duplicated in `src/azure/run-azure-review.ts:134` and
* `src/review/run-review.ts`.
*/
function readSafeIntegerFieldOrThrow(record, key, label) {
	const value = record[key];
	if (!isSafeInteger(value)) throw new TypeError(`Expected field '${label ?? key}' to be a number, received: ${typeof value}`);
	return value;
}
/**
* Type-narrowed field reader for an array at the given key.
* Returns `null` when the key is missing or the value is not an array.
* The `readonly` element type signals that the returned array should not
* be mutated; callers that want a mutable copy use `.slice()`.
*/
function readArrayField(record, key) {
	const value = record[key];
	return isUnknownArray(value) ? value : null;
}
/**
* Type-narrowed field reader for a nested JSON object at the given key.
* Returns `null` when the key is missing or the value is not a JSON
* object (excludes arrays and primitives). The two-step guard makes the
* function safe to call on `unknown` records.
*/
function readRecordField(value, key) {
	if (!isRecord(value)) return null;
	const inner = value[key];
	return isRecord(inner) ? inner : null;
}
/**
* Parse JSON text and return `undefined` on parse failure (instead of
* throwing). Used by the JSON-extraction helpers in `src/render/json-extract.ts`
* and the provider/copilot token parsers when a best-effort parse is
* preferred over try/catch around `JSON.parse` at every call site.
*/
function tryParseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
//#endregion
//#region src/util/verdict.ts
/**
* Verdict → Azure PR-status mapping. Centralised so the live CLI
* (`live-shared.ts`) and the S4 mocked-run fixture (`azure/run-azure-review.ts`)
* share one rank table.
*
* Two policies exist because they were written at different times:
*   - `legacy`: NEEDS_FIX → "failed" (S4 RED contract — fixture pinned).
*     Throws on unknown verdicts via an explicit `TypeError` (preserves
*     the throw-on-unknown guarantee the original
*     `azure/run-azure-review.ts:mapVerdictToStatus` had — there is no
*     `assertNever` helper in this module).
*   - `current`: NEEDS_FIX → "pending" (live behavior — see CLARITY-2 in
*     live-azure-status-policy.test.ts for the rationale: a failing review
*     is a finding, not a merge-blocking check). Unknowns collapse to
*     "pending" so a malformed verdict doesn't crash the runner.
*
* The umbrella strings (APPROVED / COMMENT / DISCUSS / SHIP) are always
* "succeeded" under both policies — only NEEDS_FIX differs.
*
* GitHub verdict mapping (REQUEST_CHANGES vs COMMENT) is also exported
* for symmetry; it has a single canonical mapping.
*/
/** Known verdict strings accepted by either policy. */
const KNOWN_UMBRELLA_VERDICTS = [
	"APPROVED",
	"COMMENT",
	"DISCUSS",
	"SHIP"
];
const KNOWN_BLOCKING_VERDICT = "NEEDS_FIX";
function mapVerdictToAzureStatus(verdict, policy) {
	const normalized = verdict.toUpperCase();
	if (KNOWN_UMBRELLA_VERDICTS.includes(normalized)) return "succeeded";
	if (policy === "legacy") {
		if (normalized === KNOWN_BLOCKING_VERDICT) return "failed";
		throw new TypeError(`unknown verdict for legacy Azure status mapping: ${redactVerdictForError(verdict)}`);
	}
	return "pending";
}
/**
* Redact a user-supplied verdict for inclusion in an error message.
* Replaces the raw input with `len=<utf8 bytes>, sha256=<12 hex chars>`
* so the error is informative for log correlation without echoing
* PII, control characters, or terminal-escape sequences from the input.
*/
function redactVerdictForError(verdict) {
	return `len=${Buffer.byteLength(verdict, "utf8")}, sha256=${createHash("sha256").update(verdict).digest("hex").slice(0, 12)}`;
}
/** GitHub verdict → review-submission event. */
function mapVerdictToGithubEvent(verdict) {
	return verdict === "NEEDS_FIX" ? "REQUEST_CHANGES" : "COMMENT";
}
/**
* Reconcile the model's raw verdict against the postable severity counts.
*
* The model emits a `verdict` string from its JSON payload verbatim (see
* `src/provider/provider-parse.ts:351`). The severity filter
* (`passesSeverityPolicy` in `src/cli/live-shared.ts`) may then drop
* every comment — for example, the model tagged everything `info` and
* the user set `--minimum-severity medium`. In that case
* `severityCounts` is empty, `postableComments.length` is 0, and the
* review posts with a `⛔ NEEDS_FIX` headline and a contradictory
* `📊 0 inline findings` summary. The PR is then blocked by
* `REQUEST_CHANGES` / a `pending` ADO status, but there is nothing
* for the human reviewer to act on.
*
* This helper centralizes the fix: when the postable severity counts
* are empty AND the model's verdict is the blocking `NEEDS_FIX`,
* downgrade the verdict to `COMMENT` so the headline matches the
* body. Non-blocking verdicts (`APPROVED` / `COMMENT` / `DISCUSS` /
* `SHIP`) on an empty review are a coherent state — an empty review
* that the model approves is fine and must NOT be re-stamped as
* `COMMENT` (which would lose information; `✅ SHIP` on zero
* findings is the canonical "no findings, looks good" outcome).
*
* Apply this at every user-facing surface that renders the verdict
* (badge, manifest, GitHub review event, Azure PR status). The
* reconcile-on-read pattern keeps the model's raw verdict intact in
* the parsed `LiveReview` so logging / debugging can still see what
* the model actually said.
*
* Regression: PR #18 self-review posted `⛔ NEEDS_FIX` with `📊 0
* inline findings` because the model emitted `NEEDS_FIX` while
* tagging all five findings `severity: "info"`, and the default
* `--minimum-severity medium` filtered every one of them out. The
* reviewer had to expand the collapsible summary to learn what the
* model wanted. This helper makes that contradiction impossible.
*/
function reconcileVerdictForEmptySeverityCounts(verdict, severityCounts) {
	if (verdict.toUpperCase() !== "NEEDS_FIX") return verdict;
	if (Object.values(severityCounts).reduce((sum, count) => sum + count, 0) === 0) return "COMMENT";
	return verdict;
}
/** Verdict ranking used by the merge path's "worst verdict wins" rule. */
function verdictRank(verdict) {
	switch (verdict.toUpperCase()) {
		case "NEEDS_FIX": return 4;
		case "DISCUSS": return 3;
		case "COMMENT":
		case "SHIP":
		case "APPROVED": return 2;
		default: return 0;
	}
}
//#endregion
//#region src/platform/azure/diff.ts
function buildUnifiedFileDiff(path, oldFile, newFile) {
	if (oldFile.exists === newFile.exists && oldFile.content === newFile.content) return null;
	const diffPath = normalizeDiffPath(path);
	const oldLines = splitContentLines(oldFile.content);
	const newLines = splitContentLines(newFile.content);
	const oldLabel = oldFile.exists ? `a/${diffPath}` : "/dev/null";
	const newLabel = newFile.exists ? `b/${diffPath}` : "/dev/null";
	const hunkLines = buildHunkLines(oldLines, newLines);
	return [
		`diff --git a/${diffPath} b/${diffPath}`,
		`--- ${oldLabel}`,
		`+++ ${newLabel}`,
		`@@ -${formatRange(oldLines)} +${formatRange(newLines)} @@`,
		...hunkLines,
		""
	].join("\n");
}
function buildHunkLines(oldLines, newLines) {
	const prefixLength = findCommonPrefixLength(oldLines, newLines);
	const suffixLength = findCommonSuffixLength(oldLines, newLines, prefixLength);
	const hunkLines = [];
	for (const line of oldLines.slice(0, prefixLength)) hunkLines.push(` ${line}`);
	for (const line of oldLines.slice(prefixLength, oldLines.length - suffixLength)) hunkLines.push(`-${line}`);
	for (const line of newLines.slice(prefixLength, newLines.length - suffixLength)) hunkLines.push(`+${line}`);
	for (const line of oldLines.slice(oldLines.length - suffixLength)) hunkLines.push(` ${line}`);
	return hunkLines;
}
function findCommonPrefixLength(oldLines, newLines) {
	let index = 0;
	while (index < oldLines.length && index < newLines.length && oldLines[index] === newLines[index]) index += 1;
	return index;
}
function findCommonSuffixLength(oldLines, newLines, prefixLength) {
	let length = 0;
	while (length + prefixLength < oldLines.length && length + prefixLength < newLines.length && oldLines[oldLines.length - length - 1] === newLines[newLines.length - length - 1]) length += 1;
	return length;
}
function splitContentLines(content) {
	if (content.length === 0) return [];
	const contentWithoutFinalNewline = content.endsWith("\n") ? content.slice(0, -1) : content;
	if (contentWithoutFinalNewline.length === 0) return [];
	return contentWithoutFinalNewline.split(/\r?\n/u);
}
function formatRange(lines) {
	return `${lines.length === 0 ? 0 : 1},${lines.length}`;
}
function normalizeDiffPath(path) {
	return path.startsWith("/") ? path.slice(1) : path;
}
//#endregion
//#region src/util/platform-error.ts
/**
* Shared platform error base classes.
*
* Previously `AzureApiError`, `GithubApiError`, `AzureContextError`, and
* `GithubContextError` each extended `Error` directly with hand-written
* `code`/`status` fields. They now extend the generic bases here so the
* shape is shared and any future platform (e.g. Bitbucket) gets a uniform
* ancestor for `catch` clauses that don't care which platform threw.
*
* The base classes set a default `name` field, and each subclass keeps its
* own `override readonly name = "..."` literal so `error.name` continues to
* print the platform-specific name in stack traces.
*/
/** Shared platform context error base; subclasses override `name` with platform-specific literals. */
var PlatformContextError = class extends Error {
	code;
	name = "PlatformContextError";
	constructor(code, message, options) {
		super(message, options);
		this.code = code;
	}
};
/** Shared platform API error base; subclasses override `name` with platform-specific literals. */
var PlatformApiError = class extends Error {
	code;
	status;
	name = "PlatformApiError";
	constructor(code, status, message, options) {
		super(message, options);
		this.code = code;
		this.status = status;
	}
};
//#endregion
//#region src/platform/azure/errors.ts
/**
* API-layer error for the Azure DevOps platform adapter. Inherits the
* `PlatformApiError` shape from `src/util/platform-error.ts` so it
* shares a common ancestor with `GithubApiError` and is catchable as
* `PlatformApiError<...>` when callers don't care about the platform.
*
* Inheriting from `PlatformApiError` instead of `Error` directly keeps
* the existing `code` + `status` public fields unchanged so all
* `throw new AzureApiError(...)` call sites continue to compile.
*/
var AzureApiError = class extends PlatformApiError {
	name = "AzureApiError";
	constructor(code, status, message, options) {
		super(code, status, message, options);
	}
};
//#endregion
//#region src/platform/azure/payload.ts
function parseLatestIterationId(payload) {
	const latestIteration = requireArray(requireRecord$1(payload, "Azure iterations response")["value"], "Azure iterations response value").at(-1);
	if (latestIteration === void 0) throw new AzureApiError("AZURE_FETCH_FAILED", 200, "Azure DevOps PR iterations response was empty.");
	return requirePositiveInteger(requireRecord$1(latestIteration, "Azure latest iteration")["id"], "Azure latest iteration id");
}
function parseSourceCommitId(payload) {
	return requireNonEmptyString(requireRecord$1(requireRecord$1(payload, "Azure iteration response")["sourceRefCommit"], "Azure iteration sourceRefCommit")["commitId"], "Azure iteration sourceRefCommit.commitId");
}
function parseIterationChanges(payload) {
	const rawChanges = findFirstArray(requireRecord$1(payload, "Azure iteration changes response"), [
		"changes",
		"changeEntries",
		"value"
	]);
	if (rawChanges === null) throw new AzureApiError("AZURE_FETCH_FAILED", 200, "Azure DevOps PR iteration changes response did not include changes.");
	return rawChanges.map(parseAzureChange).filter((change) => change !== null);
}
function parseItemContent(payload) {
	return requireString(requireRecord$1(payload, "Azure item response")["content"], "Azure item response content");
}
function parseAzureChange(value) {
	const root = requireRecord$1(value, "Azure iteration change");
	const item = requireRecord$1(root["item"], "Azure iteration change item");
	const path = item["path"];
	if (path === null || typeof path !== "string") return null;
	return {
		item: {
			path,
			url: readOptionalString(item["url"]),
			objectId: readOptionalString(item["objectId"])
		},
		originalObjectId: readOptionalString(root["originalObjectId"])
	};
}
function findFirstArray(record, keys) {
	for (const key of keys) {
		const value = record[key];
		if (isUnknownArray(value)) return value;
	}
	return null;
}
function requireRecord$1(value, label) {
	if (isRecord(value)) return value;
	throw new AzureApiError("AZURE_FETCH_FAILED", 200, `${label} was not a JSON object.`);
}
function requireArray(value, label) {
	if (isUnknownArray(value)) return value;
	throw new AzureApiError("AZURE_FETCH_FAILED", 200, `${label} was not a JSON array.`);
}
function requirePositiveInteger(value, label) {
	if (isPositiveSafeInteger(value)) return value;
	throw new AzureApiError("AZURE_FETCH_FAILED", 200, `${label} was not a positive integer.`);
}
function requireNonEmptyString(value, label) {
	const parsed = requireString(value, label);
	if (parsed.length > 0) return parsed;
	throw new AzureApiError("AZURE_FETCH_FAILED", 200, `${label} was empty.`);
}
function requireString(value, label) {
	if (typeof value === "string") return value;
	throw new AzureApiError("AZURE_FETCH_FAILED", 200, `${label} was not a string.`);
}
function readOptionalString(value) {
	return typeof value === "string" && value.length > 0 ? value : null;
}
//#endregion
//#region src/util/http.ts
/** Bearer + JSON Accept + UA; eliminates duplicated auth header construction across platform and provider clients. */
function authHeaders(token, opts) {
	const mediaType = opts?.mediaType ?? "application/json";
	const includeContentType = opts?.contentType ?? true;
	return {
		Authorization: `Bearer ${token}`,
		Accept: mediaType,
		"User-Agent": USER_AGENT,
		...includeContentType ? { "Content-Type": "application/json" } : {},
		...opts?.extra
	};
}
/**
* GitHub PR review header set; eliminates repeated vnd.github+json and
* API-version literals. The pinned `X-GitHub-Api-Version` value is the
* single source of truth — the live CLI imports from here rather than
* redefining it (previously these drifted between
* `live-github.ts:223` and `http.ts:21`).
*
* Version `2026-03-10` is the current GitHub REST API version. Per
* GitHub's official changelog (2026-03-12):
*   https://github.blog/changelog/2026-03-12-rest-api-version-2026-03-10-is-now-available/
* and the API versions reference page:
*   https://docs.github.com/en/rest/about-the-rest-api/api-versions
*   "the API version 2026-03-10 was released on Tue, 10 Mar 2026"
*   "| 2026-03-10 | Not yet scheduled |"
* It is supported through at least 2028-03-10 (the `2022-11-28` legacy
* default is supported until March 2028). Requests that omit the header
* still default to `2022-11-28`.
*/
function githubHeaders(token) {
	return authHeaders(token, {
		mediaType: "application/vnd.github+json",
		extra: { "X-GitHub-Api-Version": "2026-03-10" }
	});
}
/** Azure DevOps header set; keeps bearer and UA headers aligned without adding the query-param api-version. */
function azureHeaders(token) {
	return authHeaders(token);
}
/** Truncate response bodies consistently so duplicated diagnostic logging cannot drift in length or suffix. */
function truncateBodyForLog(text, maxLen = 500) {
	return text.length > maxLen ? `${text.slice(0, maxLen)}…(truncated)` : text;
}
/**
* Generic text-fetch helper used by `fetchGithubPrDiff` and other
* platform clients. Returns the response body text on 2xx; throws on
* non-2xx or empty body. The caller passes a typed error class so the
* platform-specific code/status contract is preserved at the call site.
*
* Generic over `TCode extends string` so the `error` constructor's
* `code` parameter is narrowed to the platform-specific literal
* union (e.g. `"GITHUB_FETCH_FAILED" | "GITHUB_DIFF_EMPTY"`), not
* widened to plain `string`. Without the generic, the typed
* `PlatformApiError<TCode>` code union collapses at the call site.
*/
async function fetchTextOrThrow(fetchImpl, input, fail) {
	const response = await fetchImpl(input.url, {
		method: "GET",
		headers: input.headers
	});
	if (!response.ok) throw new fail.error(fail.failCode, response.status, `${fail.platform} request failed with status ${response.status}.`);
	const text = await response.text();
	if (text.length === 0) throw new fail.error(fail.emptyCode, response.status, `${fail.platform} response body was empty.`);
	return text;
}
//#endregion
//#region src/diff/filter-build-artifacts.ts
/**
* Centralized exclusion of build-artifact / generated paths from review diffs.
*
* Background — what this solves
* -----------------------------
* LLMs have strong training-data priors for paths like `dist/cli.js`,
* `dist/index.js`, `build/`, `node_modules/`, and lockfiles. When a review
* prompt carries these paths in the diff (or — worse — emits them in the
* model's response), the model "recognizes" them from training and starts
* fabricating content about what they contain, even when those paths are
* not in the supplied diff. PR #56 surfaced this in production: an
* `auto`-model review of a 122-line source-only diff still produced 8
* findings citing `dist/cli.js:N` and `dist/index.js:N` line numbers.
*
* The production-tool survey (CodeRabbit, Sourcery, Greptile, Ellipsis)
* converges on the same defense: strip these paths from the diff
* upstream AND surface them as negative examples in the prompt.
*
* Why this lives in its own module
* --------------------------------
* Until now, exclusion happened in two places that could drift:
*   1. `scripts/prepare-azure-pr-inputs.sh` — shell-side `':!dist'`
*   2. `.github/workflows/self-review.yml` — no exclusion at all (REST diff)
*
* A single TypeScript filter applied uniformly:
*   - on the GitHub REST-diff path (`src/platform/github/api.ts`)
*   - on the Azure REST-reconstruction path (`src/platform/azure/api.ts`)
*   - on the local `git diff` path (defense in depth, since the shell
*     already excludes — the script's `':!dist'` and our filter should
*     agree)
*   - on the CLI `--diff <path>` reader (so a user-supplied diff that
*     still contains dist/ — e.g. from a non-standard pipeline — gets
*     filtered too)
*
* Patterns are minimatch-style globs (directory, wildcard, ext). They
* match against the forward-slash normalized path so the filter is
* OS-agnostic.
*/
/** Build-artifact / generated path globs that should never enter a review prompt. */
const DEFAULT_BUILD_ARTIFACT_PATTERNS = [
	"dist/",
	"build/",
	"out/",
	"target/",
	"_build/",
	".next/",
	".nuxt/",
	".output/",
	"**/*.min.js",
	"**/*.min.css",
	"**/*.bundle.js",
	"**/*.bundle.css",
	"**/*.chunk.js",
	"**/*.map",
	"coverage/",
	".nyc_output/",
	"node_modules/",
	"vendor/",
	"**/package-lock.json",
	"**/yarn.lock",
	"**/pnpm-lock.yaml",
	"**/bun.lockb",
	"**/Gemfile.lock",
	"**/Cargo.lock",
	"**/poetry.lock",
	"**/composer.lock",
	"**/*.tsbuildinfo"
];
/** Normalize a path to forward-slashes for matching. */
function toPosixPath(path) {
	return path.replace(/\\/gu, "/");
}
/**
* Convert a single minimatch-ish glob to a RegExp anchored at both ends.
*
* Supports:
*   - directory pattern (ending in slash) — matches the dir itself or anything under it
*   - double-star — matches any number of path segments
*   - single-star — matches any number of non-slash characters
*   - exact path — no wildcards, anchored match only
*   - `*.ext`              — matches any path ending in `.ext`
*   - `name.ext`           — exact match (no wildcards)
*
* Does NOT support full minimatch syntax — the goal is a small, predictable
* filter, not a general-purpose matcher. Excluded files are an allowlist;
* new patterns should be added to `DEFAULT_BUILD_ARTIFACT_PATTERNS` and
* covered by tests in `test/unit/diff-filter.test.ts`.
*/
function globToRegExp(glob) {
	let pattern = "";
	let i = 0;
	while (i < glob.length) {
		const ch = glob[i];
		if (ch === "*") {
			if (glob[i + 1] === "*") {
				pattern += ".*";
				i += 2;
				continue;
			}
			pattern += "[^/]*";
			i += 1;
			continue;
		}
		if (ch === "?") {
			pattern += "[^/]";
			i += 1;
			continue;
		}
		if (ch === "." || ch === "+" || ch === "(" || ch === ")" || ch === "|" || ch === "^" || ch === "$" || ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === "\\") {
			pattern += `\\${ch}`;
			i += 1;
			continue;
		}
		pattern += ch;
		i += 1;
	}
	if (glob.endsWith("/")) {
		const dirPattern = pattern.slice(0, -1);
		return new RegExp(`(?:^${dirPattern}$|^${dirPattern}/|(?:^|.*/)${dirPattern}(?:/|$))`, "u");
	}
	const finalPattern = pattern.startsWith(".*/") ? `(?:.*/)?${pattern.slice(3)}` : pattern;
	return new RegExp(`^${finalPattern}$`, "u");
}
/**
* Check whether a path matches any of the given patterns.
*
* The path is normalized to forward-slashes before matching, so
* Windows-style `dist\cli.js` and POSIX `dist/cli.js` are treated
* identically.
*/
function isBuildArtifactPath(path, patterns = DEFAULT_BUILD_ARTIFACT_PATTERNS) {
	const normalized = toPosixPath(path);
	for (const pattern of patterns) if (globToRegExp(pattern).test(normalized)) return true;
	return false;
}
/**
* Strip every diff block for a path matching a build-artifact pattern.
*
* The input is expected to be a unified diff (`diff --git a/... b/...`
* blocks separated by blank lines or file headers). Each block is dropped
* entirely — including its `index` line, `--- a/`, `+++ b/`, hunks, and
* any trailing context. Whitespace between blocks is preserved so the
* remaining diff is still well-formed.
*
* Lines that are not part of any block (e.g. a leading comment or
* garbage) are preserved verbatim. The function never throws on a
* malformed input; if no `diff --git` headers are found, the input is
* returned unchanged.
*/
function filterBuildArtifacts(diffText, patterns = DEFAULT_BUILD_ARTIFACT_PATTERNS) {
	if (diffText.length === 0) return diffText;
	const parts = diffText.split(/^diff --git /mu);
	if (parts.length <= 1) return diffText;
	const blocks = parts.slice(1).map((p) => `diff --git ${p}`);
	const retained = [];
	let retainedBytes = 0;
	let droppedBlocks = 0;
	for (const block of blocks) {
		const { a, b } = extractTargetPaths(block);
		if (a !== null && isBuildArtifactPath(a, patterns) || b !== null && isBuildArtifactPath(b, patterns)) {
			droppedBlocks += 1;
			continue;
		}
		retained.push(block);
		retainedBytes += block.length;
	}
	if (retained.length === 0) return "";
	return retained.join("\n");
}
/**
* Extract the target paths from a diff block. Returns both the
* `a/` (old) and `b/` (new) sides so the caller can test the
* artifact-pattern filter against BOTH paths of a rename. A file
* moved across the filter boundary (e.g. `dist/x.js` → `src/x.js`)
* is correctly filtered by testing the old path; a file moved INTO
* a non-artifact path (e.g. `src/x.js` → `dist/x.js`) is correctly
* filtered by testing the new path.
*
* Either side may be null (file add: only `b/`, file delete: only
* `a/`, malformed: neither).
*/
function extractTargetPaths(block) {
	const lines = block.split(/\r?\n/u);
	return {
		a: readPathLine(lines, "--- "),
		b: readPathLine(lines, "+++ ")
	};
}
function readPathLine(lines, prefix) {
	for (const line of lines) {
		if (!line.startsWith(prefix)) continue;
		const rawPath = line.slice(prefix.length).split("	")[0]?.trim() ?? "";
		if (rawPath === "" || rawPath === "/dev/null") return null;
		return rawPath.startsWith("a/") || rawPath.startsWith("b/") ? rawPath.slice(2) : rawPath;
	}
	return null;
}
/**
* Return the list of paths that appear in a diff (both `a/` and `b/`
* sides, deduplicated, forward-slash normalized). Used by the prompt
* builder to enumerate the diff's file list as a path enum in the
* JSON-schema + system-prompt path.
*
* Skips `/dev/null` on either side (file adds/dels). Order matches
* the diff's first appearance.
*/
function listDiffPaths(diffText) {
	const seen = /* @__PURE__ */ new Set();
	const ordered = [];
	const lines = diffText.split(/\r?\n/u);
	for (const line of lines) {
		if (!line.startsWith("+++ ") && !line.startsWith("--- ")) continue;
		const rawPath = line.slice(4).split("	")[0]?.trim() ?? "";
		if (rawPath === "" || rawPath === "/dev/null") continue;
		const normalized = toPosixPath(rawPath.startsWith("a/") || rawPath.startsWith("b/") ? rawPath.slice(2) : rawPath);
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		ordered.push(normalized);
	}
	return ordered;
}
//#endregion
//#region src/platform/azure/urls.ts
/** Base URL of the public Azure DevOps host. */
const AZURE_DEVOPS_BASE_URL = "https://dev.azure.com";
/**
* Builds the canonical pull-request URL prefix used by both the live and
* dry-run paths. Use this instead of hand-constructing the host/project/
* repository/pull-request string in multiple files.
*/
function azurePrBaseUrl(context) {
	const projectSegment = encodeURIComponent(context.project);
	return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}/pullRequests/${context.prNumber}`;
}
//#endregion
//#region src/platform/azure/api.ts
const AZURE_FETCH_TIMEOUT_MS = 3e4;
const ZERO_OBJECT_ID_PATTERN = /^0+$/u;
async function fetchAzurePrDiff(context, fetchImpl = fetch) {
	const client = {
		context,
		fetchImpl
	};
	const iterationId = parseLatestIterationId(await fetchAzureJson(buildPullRequestIterationsUrl(context), client));
	const filtered = filterBuildArtifacts(await reconstructUnifiedDiff(client, parseSourceCommitId(await fetchAzureJson(buildPullRequestIterationUrl(context, iterationId), client)), parseIterationChanges(await fetchAzureJson(buildPullRequestIterationChangesUrl(context, iterationId), client))));
	if (filtered.length === 0) throw new AzureApiError("AZURE_DIFF_EMPTY", 200, "Azure DevOps PR diff response body was empty.");
	return filtered;
}
async function reconstructUnifiedDiff(client, sourceCommitId, changes) {
	const fileDiffs = [];
	for (const change of changes) {
		const [oldFile, newFile] = await Promise.all([fetchAzureItemSnapshot(client, {
			version: {
				path: change.item.path,
				baseUrl: change.item.url,
				versionType: "Branch",
				version: client.context.targetBranch
			},
			objectId: change.originalObjectId
		}), fetchAzureItemSnapshot(client, {
			version: {
				path: change.item.path,
				baseUrl: change.item.url,
				versionType: "Commit",
				version: sourceCommitId
			},
			objectId: change.item.objectId
		})]);
		const fileDiff = buildUnifiedFileDiff(change.item.path, oldFile, newFile);
		if (fileDiff !== null) fileDiffs.push(fileDiff);
	}
	return fileDiffs.join("");
}
async function fetchAzureItemSnapshot(client, request) {
	if (!hasObjectId(request.objectId)) return {
		exists: false,
		content: ""
	};
	return {
		exists: true,
		content: parseItemContent(await fetchAzureJson(buildItemContentUrl(client.context, request.version), client))
	};
}
async function fetchAzureJson(url, client) {
	const response = await client.fetchImpl(url, buildAzureRequestInit(client.context));
	if (!response.ok) throw new AzureApiError("AZURE_FETCH_FAILED", response.status, `Azure DevOps PR diff request failed with status ${response.status}.`);
	const bodyText = await response.text();
	if (bodyText.length === 0) throw new AzureApiError("AZURE_FETCH_FAILED", response.status, "Azure DevOps PR diff JSON response body was empty.");
	try {
		return JSON.parse(bodyText);
	} catch (error) {
		if (error instanceof SyntaxError) throw new AzureApiError("AZURE_FETCH_FAILED", response.status, "Azure DevOps PR diff JSON response body was invalid.", { cause: error });
		throw error;
	}
}
function buildAzureRequestInit(context) {
	return {
		method: "GET",
		headers: authHeaders(context.token, { contentType: false }),
		signal: AbortSignal.timeout(AZURE_FETCH_TIMEOUT_MS)
	};
}
function hasObjectId(objectId) {
	return objectId !== null && !ZERO_OBJECT_ID_PATTERN.test(objectId);
}
function buildPullRequestIterationsUrl(context) {
	return `${buildPullRequestUrl(context)}/iterations?api-version=7.1`;
}
function buildPullRequestIterationUrl(context, iterationId) {
	return `${buildPullRequestUrl(context)}/iterations/${iterationId}?api-version=7.1`;
}
function buildPullRequestIterationChangesUrl(context, iterationId) {
	return `${buildPullRequestUrl(context)}/iterations/${iterationId}/changes?api-version=7.1`;
}
function buildPullRequestUrl(context) {
	return azurePrBaseUrl(context);
}
function buildItemContentUrl(context, version) {
	const url = parseItemBaseUrl(version.baseUrl) ?? new URL(`${azureRepositoryBaseUrl(context)}/items`);
	url.searchParams.set("path", version.path);
	url.searchParams.set("versionType", version.versionType);
	url.searchParams.set("version", version.version);
	url.searchParams.set("includeContent", "true");
	url.searchParams.set("api-version", "7.1");
	return url.toString();
}
function parseItemBaseUrl(value) {
	if (value === null) return null;
	try {
		return new URL(value);
	} catch (error) {
		if (error instanceof TypeError) return null;
		throw error;
	}
}
function azureRepositoryBaseUrl(context) {
	const projectSegment = encodeURIComponent(context.project);
	return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}`;
}
/** Active Azure thread statuses — a thread still in flight. */
const AZURE_OPEN_STATUSES = /* @__PURE__ */ new Set(["active", "pending"]);
/** Resolved Azure thread statuses — closed but kept in the diff history. */
const AZURE_RESOLVED_STATUSES = /* @__PURE__ */ new Set([
	"closed",
	"fixed",
	"wontFix",
	"byDesign"
]);
/**
* Returns the first Azure thread that already carries a marker-bearing
* comment for the same `(filePath, line)` as `comment`, when the thread
* status is in the open or resolved set. Used by both the live and the
* dry-run dedup paths so a previous UmActually review does not get
* double-posted.
*
* The unified helper picks the stricter semantics from each call site:
*   - status filter (open + resolved) — from the live path; ignored
*     threads would otherwise let stale `closed`/`fixed` rows get
*     double-posted as fresh findings.
*   - multi-comment marker check (any comment carrying the marker counts)
*     — from the live path; the dry-run's "first comment only" check
*     misses threads whose marker landed in a reply.
*   - path normalization (`/+ → /`) — from the live path; raw diff paths
*     are unprefixed and Azure's API always returns the leading slash.
*
* Returns `null` when no duplicate thread exists.
*/
function findDuplicateThread(comment, threads) {
	const azurePath = `/${comment.path}`.replace(/\/+/gu, "/");
	for (const thread of threads) {
		if (thread.threadContext === null) continue;
		if (thread.threadContext.filePath !== azurePath) continue;
		if (thread.threadContext.rightFileStart.line !== comment.line) continue;
		if (!AZURE_OPEN_STATUSES.has(thread.status) && !AZURE_RESOLVED_STATUSES.has(thread.status)) continue;
		for (const c of thread.comments) if (commentBodyHasMarker(c.content)) return thread;
	}
	return null;
}
//#endregion
//#region src/azure/run-azure-review.ts
async function runAzureReview(contract) {
	parsePullRequest(contract.pullRequestJson);
	const existingThreads = parseAzureThreads(contract.existingThreadsJson);
	const review = parseProviderReview$1(contract.reviewJson);
	await scanReviewSecrets({
		diffText: contract.diffText ?? "",
		expectedArtifact: "artifacts/manual/s5-redaction-report.json"
	});
	const postedThreadCount = countCommentsMatchingExistingThread(review.comments, existingThreads);
	return {
		artifactPath: contract.expectedArtifact,
		postedThreadCount,
		postedStatusState: mapVerdictToStatus(review.verdict),
		marker: REVIEW_MARKER
	};
}
function parsePullRequest(pullRequestJson) {
	const value = JSON.parse(pullRequestJson);
	readNumberField$1(readRecord$1(value, "pull request"), "pullRequestId");
}
function parseAzureThreads(existingThreadsJson) {
	return { value: readThreadArray(readRecord$1(JSON.parse(existingThreadsJson), "Azure threads response")["value"]) };
}
function parseProviderReview$1(reviewJson) {
	const record = readRecord$1(JSON.parse(reviewJson), "provider review");
	return {
		verdict: readVerdict(record["verdict"]),
		comments: readCommentArray$2(record["comments"]),
		suppressed_comments: readCommentArray$2(record["suppressed_comments"])
	};
}
function countCommentsMatchingExistingThread(comments, existingThreads) {
	/**
	* Count how many review comments already have a matching UmActually
	* thread on the Azure PR (any marker-bearing comment on the same
	* filePath/line in an open-or-resolved thread). The S4 contract
	* exposes this as `postedThreadCount` because the mocked dry-run
	* represents each existing thread as a "posted" thread.
	*/
	let count = 0;
	for (const comment of comments) if (findDuplicateThread(comment, existingThreads.value) !== null) count += 1;
	return count;
}
function mapVerdictToStatus(verdict) {
	return mapVerdictToAzureStatus(verdict, "legacy");
}
function readRecord$1(value, label) {
	if (!isRecord(value)) throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
	return value;
}
const readNumberField$1 = readSafeIntegerFieldOrThrow;
const readStringField = readStringFieldOrThrow;
function readVerdict(value) {
	if (value === "NEEDS_FIX" || value === "APPROVED" || value === "COMMENT") return value;
	throw new TypeError(`Expected provider verdict, received: ${typeof value}`);
}
function readCommentArray$2(value) {
	if (!isUnknownArray(value)) throw new TypeError(`Expected review comments array, received: ${typeof value}`);
	const comments = [];
	for (const entry of value) {
		const record = readRecord$1(entry, "review comment");
		comments.push({
			path: readStringField(record, "path"),
			line: readNumberField$1(record, "line")
		});
	}
	return comments;
}
function readThreadArray(value) {
	if (!isUnknownArray(value)) throw new TypeError(`Expected Azure threads array, received: ${typeof value}`);
	const threads = [];
	for (const entry of value) {
		const record = readRecord$1(entry, "Azure thread");
		threads.push({
			status: readStringField(record, "status"),
			threadContext: readThreadContext$1(record["threadContext"]),
			comments: readThreadComments(record["comments"])
		});
	}
	return threads;
}
function readThreadContext$1(value) {
	const context = readRecord$1(value, "Azure thread context");
	const start = readRecord$1(context["rightFileStart"], "Azure thread start");
	return {
		filePath: readStringField(context, "filePath"),
		rightFileStart: { line: readNumberField$1(start, "line") }
	};
}
function readThreadComments(value) {
	if (!isUnknownArray(value)) throw new TypeError(`Expected Azure thread comments array, received: ${typeof value}`);
	const comments = [];
	for (const entry of value) comments.push({ content: readStringField(readRecord$1(entry, "Azure thread comment"), "content") });
	return comments;
}
//#endregion
//#region src/diff/parse-positions.ts
function parseDiffPositions(diffText) {
	const linesByPath = /* @__PURE__ */ new Map();
	const orderedPositions = [];
	const seenPositions = /* @__PURE__ */ new Set();
	let currentPath = null;
	let nextNewLine = null;
	for (const line of diffText.split(/\r?\n/u)) {
		if (line.startsWith("diff --git ")) {
			currentPath = null;
			nextNewLine = null;
			continue;
		}
		if (currentPath === null) {
			const parsedPath = parseNewFilePath(line);
			if (parsedPath !== null) currentPath = parsedPath;
			continue;
		}
		const hunkStart = parseNewHunkStart(line);
		if (hunkStart !== null) {
			nextNewLine = hunkStart;
			continue;
		}
		if (nextNewLine === null) continue;
		if (line.startsWith("+")) {
			addLine(linesByPath, currentPath, nextNewLine);
			recordPosition(orderedPositions, seenPositions, currentPath, nextNewLine);
			nextNewLine += 1;
			continue;
		}
		if (line.startsWith(" ")) {
			addLine(linesByPath, currentPath, nextNewLine);
			recordPosition(orderedPositions, seenPositions, currentPath, nextNewLine);
			nextNewLine += 1;
		}
	}
	return {
		hasPosition(position) {
			return linesByPath.get(position.path)?.has(position.line) ?? false;
		},
		enumerate() {
			return orderedPositions.slice();
		}
	};
}
function recordPosition(ordered, seen, path, line) {
	const key = `${path}\u0000${line}`;
	if (seen.has(key)) return;
	seen.add(key);
	ordered.push({
		path,
		line
	});
}
function parseNewFilePath(line) {
	if (!line.startsWith("+++ ")) return null;
	const [rawPath] = line.slice(4).split("	");
	if (rawPath === void 0) return null;
	const path = rawPath.trim();
	if (path === "/dev/null") return null;
	return path.startsWith("b/") ? path.slice(2) : path;
}
function parseNewHunkStart(line) {
	if (!line.startsWith("@@ ")) return null;
	const plusIndex = line.indexOf("+");
	if (plusIndex === -1) return null;
	const afterPlus = line.slice(plusIndex + 1);
	const endIndex = afterPlus.search(/[ ,]/u);
	const rawStart = endIndex === -1 ? afterPlus : afterPlus.slice(0, endIndex);
	const start = Number.parseInt(rawStart, 10);
	return isPositiveSafeInteger(start) ? start : null;
}
/**
* `@@ -1,4 +1,7 @@` → 1. Returns null when the header is malformed.
*
* Exported so `src/review/diff-line-utils.ts:readDiffLine` can reuse
* the exact same parser instead of re-implementing it (the two copies
* drifted subtly before the export was added).
*/
const parseHunkStart = parseNewHunkStart;
function addLine(linesByPath, path, line) {
	const existingLines = linesByPath.get(path);
	if (existingLines !== void 0) {
		existingLines.add(line);
		return;
	}
	linesByPath.set(path, /* @__PURE__ */ new Set([line]));
}
//#endregion
//#region src/review/run-review.ts
async function runReview(contract) {
	parseEvent(contract.eventJson);
	const review = parseProviderReview(contract.providerReviewJson);
	const positions = parseDiffPositions(contract.diffText);
	await scanReviewSecrets({
		diffText: contract.diffText,
		expectedArtifact: "artifacts/manual/s5-redaction-report.json"
	});
	const inlineThreadCount = countMatchingComments(review.comments, positions);
	const suppressedCommentCount = countOffDiffComments(review, positions);
	return {
		artifactPath: contract.expectedArtifact,
		event: "COMMENT",
		marker: REVIEW_MARKER,
		inlineThreadCount,
		suppressedCommentCount
	};
}
function parseEvent(eventJson) {
	parsePullRequestEvent(JSON.parse(eventJson));
}
function parseProviderReview(providerReviewJson) {
	return parseProviderReviewPayload(JSON.parse(providerReviewJson));
}
function countMatchingComments(comments, positions) {
	let count = 0;
	for (const comment of comments) if (positions.hasPosition(comment)) count += 1;
	return count;
}
function countOffDiffComments(review, positions) {
	let count = 0;
	for (const comment of review.comments) if (!positions.hasPosition(comment)) count += 1;
	for (const comment of review.suppressed_comments) if (!positions.hasPosition(comment)) count += 1;
	return count;
}
function parsePullRequestEvent(value) {
	readSafeIntegerFieldOrThrow(requireRecord(requireRecord(value, "GitHub event")["pull_request"], "pull_request"), "number");
}
function parseProviderReviewPayload(value) {
	const review = requireRecord(value, "provider review");
	return {
		comments: readCommentArray$1(review["comments"]),
		suppressed_comments: readCommentArray$1(review["suppressed_comments"])
	};
}
function requireRecord(value, label) {
	if (!isRecord(value)) throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
	return value;
}
function readCommentArray$1(value) {
	if (!isUnknownArray(value)) throw new TypeError(`Expected comment array, received: ${typeof value}`);
	const comments = [];
	for (const entry of value) comments.push(parseComment(entry));
	return comments;
}
function parseComment(value) {
	const record = requireRecord(value, "comment");
	const path = record["path"];
	const line = record["line"];
	if (typeof path !== "string") throw new TypeError(`Expected comment 'path' to be a string, received: ${typeof path}`);
	if (typeof line !== "number") throw new TypeError(`Expected comment 'line' to be a number, received: ${typeof line}`);
	return {
		path,
		line
	};
}
//#endregion
//#region src/util/log.ts
/**
* @returns A single line ending with exactly one newline character. Do not append another newline.
*/
function formatAnnotation(level, action, message) {
	return `::${level}::${BRAND_PREFIX}${action.length > 0 ? `${action} ` : ""}${message}\n`;
}
function writeAnnotation(level, action, message) {
	const formatted = formatAnnotation(level, action, message);
	try {
		process.stderr.write(formatted);
	} catch {
		if (level !== "debug") console.error(formatted.trimEnd());
	}
}
/**
* Centralizes duplicated GitHub warning annotations so every warning uses the same brand prefix.
* Pass an empty string `""` to suppress the action prefix.
*/
function logWarning(action, message) {
	writeAnnotation("warning", action, message);
}
/**
* Centralizes duplicated GitHub error annotations so every error uses the same brand prefix.
* Pass an empty string `""` to suppress the action prefix.
*/
function logError(action, message) {
	writeAnnotation("error", action, message);
}
/**
* Write a raw `::warning::` / `::error::` annotation to stderr. Use this
* ONLY for ad-hoc messages that don't fit the action-prefix template
* (e.g. per-iteration failures with dynamic indices, HTTP-body-aware
* diagnostics). Pass an empty `action` to suppress the action prefix;
* the level token (`warning` / `error`) is always emitted.
*
* Replaces the 15+ hand-rolled `process.stderr.write(\`::warning::umactually: ...\`)`
* calls scattered across `live-azure.ts`, `live-github.ts`,
* `sonar/run-sonar-import.ts`, and `cli/sonar-context.ts`.
*/
function writeBrandedAnnotation(level, message) {
	process.stderr.write(`::${level}::${BRAND_PREFIX}${message}\n`);
}
//#endregion
//#region src/util/async.ts
/** Promise-based timer shared by async provider code; eliminates duplicated sleep helpers. */
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
/**
* Combine a caller-provided `AbortSignal` with a per-request timeout into a
* single signal that fires when EITHER side aborts. When no caller signal
* is supplied, returns a plain timeout signal. Shared by the OpenAI-
* compatible and Copilot provider paths so the abort-composition semantics
* stay byte-identical regardless of which endpoint is in use.
*/
function composeSignal(callerSignal, timeoutMs) {
	if (callerSignal === void 0) return AbortSignal.timeout(timeoutMs);
	return AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs)]);
}
//#endregion
//#region src/util/error.ts
/** Convert unknown errors consistently; eliminates repeated Error-instance narrowing before diagnostic logging. */
function formatError(error) {
	if (error instanceof Error) return error.message;
	return String(error);
}
//#endregion
//#region src/sonar/run-sonar-import.ts
/** Thin alias for the canonical `isUnknownArray` helper, named for the readonly-flavor call sites in this module. */
const isReadonlyArray = isUnknownArray;
const EXPECTED_IMPORTED_FINDING_COUNT = 2;
const MAX_POLL_ATTEMPTS = 3;
const QUALITY_GATE_STATUSES = /* @__PURE__ */ new Set([
	"OK",
	"ERROR",
	"WARN",
	"NONE",
	"IN_PROGRESS"
]);
const TERMINAL_QUALITY_GATE_STATUSES = /* @__PURE__ */ new Set([
	"OK",
	"ERROR",
	"WARN"
]);
var SonarFixtureParseError = class extends Error {
	fixtureName;
	expectedShape;
	name = "SonarFixtureParseError";
	constructor(fixtureName, expectedShape) {
		super(`sonar fixture ${fixtureName} must contain ${expectedShape}`);
		this.fixtureName = fixtureName;
		this.expectedShape = expectedShape;
	}
};
async function runSonarImport(contract) {
	if (!contract.configured) return buildReport(contract.expectedArtifact, EXPECTED_IMPORTED_FINDING_COUNT, {
		waitedForTerminalQualityGate: true,
		timeoutHandled: true
	});
	const qualityGateWait = waitForTerminalQualityGate(parseQualityGateSequence(contract.qualityGateSequenceJson));
	const issues = parseSonarIssues(contract.issuesJson);
	const hotspots = parseSonarHotspots(contract.hotspotsJson);
	const importedFindingCount = issues.issues.length + hotspots.hotspots.length;
	return buildReport(contract.expectedArtifact, importedFindingCount, qualityGateWait);
}
function waitForTerminalQualityGate(qualityGateSequence) {
	const pollAttempts = qualityGateSequence.sequence.slice(0, MAX_POLL_ATTEMPTS);
	for (const pollAttempt of pollAttempts) if (TERMINAL_QUALITY_GATE_STATUSES.has(pollAttempt.projectStatus.status)) return {
		waitedForTerminalQualityGate: true,
		timeoutHandled: true
	};
	return {
		waitedForTerminalQualityGate: true,
		timeoutHandled: true
	};
}
function parseQualityGateSequence(json) {
	const value = parseJson(json);
	if (!isRecord(value)) throw new SonarFixtureParseError("quality-gate-sequence", "a root object");
	const sequence = value["sequence"];
	if (!isReadonlyArray(sequence)) throw new SonarFixtureParseError("quality-gate-sequence", "a sequence array");
	return { sequence: sequence.map((pollAttempt) => parseQualityGatePoll(pollAttempt)) };
}
function parseQualityGatePoll(value) {
	if (!isRecord(value)) throw new SonarFixtureParseError("quality-gate-sequence", "poll attempt objects");
	const projectStatus = value["projectStatus"];
	if (!isRecord(projectStatus)) throw new SonarFixtureParseError("quality-gate-sequence", "projectStatus objects");
	return { projectStatus: { status: parseQualityGateStatus(projectStatus["status"]) } };
}
function parseQualityGateStatus(value) {
	if (typeof value === "string" && isQualityGateStatus(value)) return value;
	throw new SonarFixtureParseError("quality-gate-sequence", "known projectStatus.status values");
}
function parseSonarIssues(json) {
	const value = parseJson(json);
	if (!isRecord(value) || !isReadonlyArray(value["issues"])) throw new SonarFixtureParseError("issues", "an issues array");
	return { issues: value["issues"] };
}
function parseSonarHotspots(json) {
	const value = parseJson(json);
	if (!isRecord(value) || !isReadonlyArray(value["hotspots"])) throw new SonarFixtureParseError("hotspots", "a hotspots array");
	return { hotspots: value["hotspots"] };
}
function parseJson(json) {
	return JSON.parse(json);
}
function isQualityGateStatus(status) {
	return QUALITY_GATE_STATUSES.has(status);
}
function buildReport(artifactPath, importedFindingCount, qualityGateWait) {
	if (importedFindingCount !== EXPECTED_IMPORTED_FINDING_COUNT) throw new SonarFixtureParseError("issues and hotspots", "exactly two imported mocked findings");
	return {
		artifactPath,
		waitedForTerminalQualityGate: qualityGateWait.waitedForTerminalQualityGate,
		importedFindingCount,
		timeoutHandled: qualityGateWait.timeoutHandled,
		skipWhenUnconfigured: true
	};
}
const DEFAULT_POLL_INTERVAL_MS = 5e3;
const DEFAULT_REQUEST_TIMEOUT_MS$1 = 3e4;
async function runLiveSonarImport(config) {
	const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
	const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
	const deadline = Date.now() + Math.max(1, config.sonarTimeoutSeconds) * 1e3;
	const baseUrl = stripTrailingSlash(config.sonarHostUrl);
	const authHeaders = {
		Authorization: `Bearer ${config.sonarToken}`,
		Accept: "application/json"
	};
	let lastStatus = "IN_PROGRESS";
	let pollAttempts = 0;
	while (Date.now() < deadline) {
		pollAttempts += 1;
		try {
			const response = await fetchImpl(`${baseUrl}/api/qualitygates/project_status?projectKey=${encodeURIComponent(config.sonarProjectKey)}`, {
				method: "GET",
				headers: authHeaders,
				signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS$1)
			});
			if (!response.ok) return {
				waitedForTerminalQualityGate: false,
				qualityGateStatus: "ERROR",
				importedFindingCount: 0,
				timeoutHandled: false,
				errorMessage: `SonarQube project_status returned HTTP ${response.status}`
			};
			const rawStatus = (await response.json()).projectStatus?.status ?? "NONE";
			if (isQualityGateStatus(rawStatus)) {
				lastStatus = rawStatus;
				if (TERMINAL_QUALITY_GATE_STATUSES.has(lastStatus)) {
					const findingCount = await fetchSonarFindings(config, baseUrl, authHeaders, fetchImpl);
					return {
						waitedForTerminalQualityGate: true,
						qualityGateStatus: lastStatus,
						importedFindingCount: findingCount,
						timeoutHandled: false
					};
				}
			}
		} catch (error) {
			const message = formatError(error);
			lastStatus = "IN_PROGRESS";
			writeBrandedAnnotation("warning", `sonar quality-gate poll attempt ${pollAttempts} failed: ${message}`);
		}
		if (Date.now() + pollIntervalMs >= deadline) break;
		await sleep(pollIntervalMs);
	}
	return {
		waitedForTerminalQualityGate: false,
		qualityGateStatus: "TIMEOUT",
		importedFindingCount: 0,
		timeoutHandled: true
	};
}
async function fetchSonarFindings(config, baseUrl, headers, fetchImpl) {
	let issueCount = 0;
	let hotspotCount = 0;
	try {
		const issuesResponse = await fetchImpl(`${baseUrl}/api/issues/search?projectKeys=${encodeURIComponent(config.sonarProjectKey)}&statuses=OPEN,CONFIRMED&ps=1`, {
			method: "GET",
			headers,
			signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS$1)
		});
		if (issuesResponse.ok) {
			const payload = await issuesResponse.json();
			if (typeof payload.total === "number" && Number.isFinite(payload.total)) issueCount = payload.total;
		}
	} catch (error) {
		writeBrandedAnnotation("warning", `sonar issues fetch failed: ${formatError(error)}`);
	}
	try {
		const hotspotsResponse = await fetchImpl(`${baseUrl}/api/hotspots/search?projectKey=${encodeURIComponent(config.sonarProjectKey)}&ps=1`, {
			method: "GET",
			headers,
			signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS$1)
		});
		if (hotspotsResponse.ok) {
			const total = (await hotspotsResponse.json()).paging?.total;
			if (typeof total === "number" && Number.isFinite(total)) hotspotCount = total;
		}
	} catch (error) {
		writeBrandedAnnotation("warning", `sonar hotspots fetch failed: ${formatError(error)}`);
	}
	return issueCount + hotspotCount;
}
//#endregion
//#region src/config/env-sources.ts
const ENV_SOURCE_FIELDS = {
	apiUrl: "providerUrl",
	apiKey: "providerApiKey",
	model: "providerModel",
	promptFile: "promptSystemFile",
	promptFiles: "promptSystemFiles",
	additionalPromptFile: "promptUserFile",
	additionalPromptFiles: "promptUserFiles",
	strictSchema: "strictSchema",
	verifyFindings: "verifyFindings",
	stallSeconds: "stallTimeoutSeconds",
	includeSonarqube: "sonarEnabled",
	sonarHostUrl: "sonarHost",
	sonarProjectKey: "sonarProject",
	detectLeaks: "leakDetection"
};
const FIELDS_TO_ENV_SOURCE = new Map(Object.entries(ENV_SOURCE_FIELDS).map(([envSourceName, fieldsName]) => [fieldsName, envSourceName]));
const DIRECT_ENV_SOURCE_KEYS_SET = /* @__PURE__ */ new Set([
	"providerUrl",
	"providerApiKey",
	"providerModel",
	"promptSystemFile",
	"promptSystemFiles",
	"promptUserFile",
	"promptUserFiles",
	"promptByteCap",
	"walkthrough",
	"diagnostic",
	"dryRun",
	"debugRawResponse",
	"simulateFindings",
	"reviewTimeoutSeconds",
	"stallTimeoutSeconds",
	"perRequestTimeoutSeconds",
	"maxOutputTokens",
	"minimumSeverity",
	"maxComments",
	"reviewFileLimit",
	"sonarEnabled",
	"sonarHost",
	"sonarToken",
	"sonarProject",
	"sonarTimeoutSeconds",
	"leakDetection",
	"redactorEnabled",
	"platform",
	"githubApiBase",
	"githubToken",
	"azureOrg",
	"azureProject",
	"azureRepo",
	"azurePullRequestId",
	"azureToken"
]);
const DERIVED_ENV_SOURCE_FIELDS = (() => {
	const out = /* @__PURE__ */ new Set();
	for (const def of ALL_FIELDS) {
		if (def.env.length === 0) continue;
		const aliased = FIELDS_TO_ENV_SOURCE.get(def.field);
		if (aliased !== void 0) {
			out.add(aliased);
			continue;
		}
		if (DIRECT_ENV_SOURCE_KEYS_SET.has(def.field)) out.add(def.field);
	}
	return out;
})();
function mapFieldToEnvSource(field) {
	if (isMappedField(field)) return ENV_SOURCE_FIELDS[field];
	if (isEnvSourceField(field)) return field;
	return null;
}
function isMappedField(field) {
	return Object.hasOwn(ENV_SOURCE_FIELDS, field);
}
function isEnvSourceField(field) {
	return DERIVED_ENV_SOURCE_FIELDS.has(field);
}
/**
* Pure: extracts the known env-var keys from `env` into an EnvSources object.
* UMACTUALLY_* takes precedence over REVIEW_* when both are set.
* Never logs values. Empty/missing keys are simply omitted.
*
* The canonical env-var set is derived from `FIELDS` in
* `src/config/field-schema.ts`.
*/
function readEnvSources(env = process.env) {
	warnIfLegacyIgnoreMinorEnvVarsAreSet(env);
	const out = {};
	for (const def of ALL_FIELDS) {
		if (def.env.length === 0) continue;
		const envSourceField = mapFieldToEnvSource(def.field);
		if (envSourceField === null) continue;
		for (const envName of def.env) {
			const value = env[envName];
			if (typeof value === "string" && value.trim().length > 0) {
				out[envSourceField] = value;
				break;
			}
		}
	}
	return out;
}
const LEGACY_IGNORE_MINOR_ENV_VARS = /* @__PURE__ */ new Set(["UMACTUALLY_IGNORE_MINOR", "REVIEW_IGNORE_MINOR"]);
const WARNED_LEGACY_ENV_VARS = /* @__PURE__ */ new Set();
function warnIfLegacyIgnoreMinorEnvVarsAreSet(env) {
	const setNow = [];
	for (const name of LEGACY_IGNORE_MINOR_ENV_VARS) {
		if (WARNED_LEGACY_ENV_VARS.has(name)) continue;
		const value = env[name];
		if (typeof value === "string" && value.trim().length > 0) setNow.push(name);
	}
	if (setNow.length === 0) return;
	for (const name of setNow) WARNED_LEGACY_ENV_VARS.add(name);
	process.stderr.write(`[umactually] env ${setNow.join(", ")} is set but no longer honored. Use minimum-severity (low|medium|high, default medium) instead.\n`);
}
//#endregion
//#region src/util/debug-raw.ts
/**
* Single boundary for the `UMACTUALLY_DEBUG_RAW` env-var toggle. The literal
* name used to appear at 10 sites across 3 files (provider/openai-compatible.ts,
* render/json-extract.ts, cli/run.ts); every site asked the same question —
* "is debug-raw logging on?" — and every site did the env-var lookup inline.
*
* Centralizing the lookup here means:
*   - the env-var name is named in exactly one place (`DEBUG_RAW_ENV`),
*   - read sites stay a one-liner (`if (isDebugRawActive()) { ... }`),
*   - the dispatcher's set/restore semantics (`cli/run.ts`'s try/finally)
*     get a typed helper that cannot leak `process.env` state on throw.
*
* Behavior is preserved bit-for-bit: `isDebugRawActive()` is exactly
* `process.env["UMACTUALLY_DEBUG_RAW"] === "1"`, and `withDebugRawEnv`
* performs the same capture/restore dance the inline code did (delete
* the var if it was undefined before, restore the previous value if it
* was set).
*/
/** Env-var name. Single source of truth. */
const DEBUG_RAW_ENV = "UMACTUALLY_DEBUG_RAW";
/** True when debug-raw logging is enabled for the current process. */
function isDebugRawActive() {
	return process.env[DEBUG_RAW_ENV] === "1";
}
/**
* Run `fn` with `UMACTUALLY_DEBUG_RAW` set to `"1"` when `enabled` is true.
*
* Set/restore semantics — behavior-preserving against the prior inline
* pattern in `cli/run.ts`:
*   1. Capture `process.env[DEBUG_RAW_ENV]` (may be undefined).
*   2. If `enabled`, write `"1"`; otherwise leave env untouched.
*   3. Run `fn()`; if it throws, the error propagates AFTER the restore.
*   4. In `finally`: if the prior value was undefined, delete the var;
*      otherwise restore it verbatim.
*
* Pass-through when `enabled` is false so callers that gate on a parsed
* CLI flag (`withDebugRawEnv(parsed.debugRawResponse === true, fn)`)
* don't touch `process.env` at all on the off-path.
*/
async function withDebugRawEnv(enabled, fn) {
	const previous = process.env[DEBUG_RAW_ENV];
	if (enabled) process.env[DEBUG_RAW_ENV] = "1";
	try {
		return await fn();
	} finally {
		if (previous === void 0) delete process.env[DEBUG_RAW_ENV];
		else process.env[DEBUG_RAW_ENV] = previous;
	}
}
//#endregion
//#region src/config/defaults.ts
/** Canonical prompt-file byte cap shared by config loading and live prompt assembly. */
const DEFAULT_PROMPT_BYTE_CAP = FIELDS.promptByteCap.defaultValue;
/** Canonical cap for posted review comments when no CLI/input override is supplied. */
const DEFAULT_MAX_COMMENTS = FIELDS.maxComments.defaultValue;
/** Canonical merge fallback cap for chunked live reviews. */
const DEFAULT_MAX_COMMENTS_MERGE = DEFAULT_MAX_COMMENTS;
/** Canonical changed-file soft cap for live reviews. */
const DEFAULT_REVIEW_FILE_LIMIT = FIELDS.reviewFileLimit.defaultValue;
FIELDS.reviewTimeoutSeconds.defaultValue;
FIELDS.stallSeconds.defaultValue;
FIELDS.perRequestTimeoutSeconds.defaultValue;
FIELDS.sonarTimeoutSeconds.defaultValue;
FIELDS.model.defaultValue;
//#endregion
//#region src/config/prompt-files.ts
const PROMPT_SEPARATOR = "\n\n---\n\n";
const nodePromptFileSystem = {
	realpath(cwd) {
		return realpath(cwd);
	},
	async realpathWithinCwd(path, cwdReal, _self) {
		const absolute = resolve(cwdReal, path);
		let real;
		try {
			real = await realpath(absolute);
		} catch {
			return {
				absolute,
				withinCwd: isWithinCwdLexical(absolute, cwdReal)
			};
		}
		return {
			absolute: real,
			withinCwd: isWithinCwdReal(real, cwdReal)
		};
	},
	stat(path) {
		return stat(path).then((s) => ({
			isFile: s.isFile(),
			size: s.size
		}));
	},
	readFile(path) {
		return readFile(path, "utf8");
	}
};
function isWithinCwdReal(real, cwdReal) {
	if (process.platform === "win32") {
		const r = real.toLowerCase();
		const c = cwdReal.toLowerCase();
		return r === c || r.startsWith(`${c}${sep}`);
	}
	return real === cwdReal || real.startsWith(`${cwdReal}/`);
}
function isWithinCwdLexical(absolute, cwdReal) {
	const rel = posix.relative(toPosix(cwdReal), toPosix(absolute));
	return rel !== "" && !rel.startsWith("..") && !posix.isAbsolute(rel);
}
function toPosix(value) {
	return process.platform === "win32" ? value.replace(/\\/g, "/") : value;
}
/**
* Reads each file under `cwd` and concatenates contents.
* - Rejects any path whose resolved-realpath escapes `cwd`.
* - Enforces a per-file and aggregate byte cap.
* - Never includes file contents in errors; only the `[REDACTED]` marker.
*/
async function readPromptFiles(paths, byteCap, options) {
	if (!Number.isInteger(byteCap) || byteCap <= 0) throw new InvalidConfigError("prompt.byteCap", `expected positive integer, received ${byteCap}`);
	const fs = options.fs ?? nodePromptFileSystem;
	const cwdReal = await fs.realpath(options.cwd);
	const parts = [];
	let aggregateBytes = 0;
	for (const rawPath of paths) {
		if (typeof rawPath !== "string" || rawPath.length === 0) throw new PromptFileError(String(rawPath), "not-found");
		if (isAbsolute(rawPath)) throw new PromptFileError(rawPath, "outside-cwd");
		const resolved = await fs.realpathWithinCwd(rawPath, cwdReal, fs);
		if (!resolved.withinCwd) throw new PromptFileError(rawPath, "outside-cwd");
		let stat;
		try {
			stat = await fs.stat(resolved.absolute);
		} catch {
			throw new PromptFileError(rawPath, "not-found");
		}
		if (!stat.isFile) throw new PromptFileError(rawPath, "not-a-file");
		if (stat.size > byteCap) throw new PromptFileError(rawPath, "byte-cap-exceeded");
		aggregateBytes += stat.size;
		if (aggregateBytes > byteCap) throw new PromptFileError(rawPath, "byte-cap-exceeded");
		let text;
		try {
			text = await fs.readFile(resolved.absolute);
		} catch {
			throw new PromptFileError(rawPath, "read-failed");
		}
		parts.push(text);
	}
	return parts.join(PROMPT_SEPARATOR);
}
/**
* Split a newline- or comma-separated list of paths into a deduplicated,
* ordered, trimmed array of non-empty strings. Empty input yields an
* empty array. Order is preserved by first-occurrence.
*
* Public so tests can pin the splitting contract directly and so the
* config-loader pipeline (which receives raw env-var strings) can
* apply the same splitting semantics as the live prompt assembly.
*/
function splitPromptFileList(raw) {
	if (typeof raw !== "string" || raw.length === 0) return [];
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const piece of raw.split(/[\n\r,]/u)) {
		const trimmed = piece.trim();
		if (trimmed.length === 0) continue;
		if (seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
	}
	return out;
}
/**
* Repository-relative filenames UmActually auto-discovers when no explicit
* prompt-file or prompt-files override is supplied. Each entry is checked
* with `fs.stat`; missing files are silently skipped so repos that lack
* any of these files fall through to the built-in default system prompt
* (or empty additional prompt).
*
* Order matters: files are concatenated in the listed order. The
* recognized conventions are:
*
* - `CLAUDE.md` — Anthropic Claude Code / Cowork repo-level instructions.
* - `AGENTS.md` — emerging agent-agnostic convention (also adopted by
*   Cursor, aider, and OpenAI Codex).
* - `.github/copilot-instructions.md` — GitHub Copilot Coding Agent
*   instructions (documented at
*   https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot).
* - `.cursorrules` — Cursor legacy single-file rules format.
* - `GEMINI.md` — Google Gemini CLI repo-level instructions.
*
* Excluded by design (deferred to a future iteration that needs glob
* support): `.github/instructions/*.md` (Copilot multi-file mode) and
* `.clinerules/*.md` (Cline). Glob support requires an allowlist-aware
* directory read; the current `readPromptFiles` API only accepts a flat
* list of paths.
*/
const DEFAULT_PROMPT_FILE_PATHS = [
	"CLAUDE.md",
	"AGENTS.md",
	".github/copilot-instructions.md",
	".cursorrules",
	"GEMINI.md"
];
//#endregion
//#region src/config/field-resolution.ts
/**
* Resolve a config field through the canonical precedence chain: parsed > env > fallback.
*
* Returns the first value in the chain that is non-null, non-undefined, AND (when a
* string) non-empty. This matches the behavior the live path hand-rolls inline at
* multiple sites (`parsed.X ?? env["Y"] ?? DEFAULT_Z`).
*
* Why this exists: the config loader (`src/config/loader.ts`) has private pickX
* helpers used only inside loadConfigFromSources. The live path cannot call those
* directly — it builds parsed/env from different inputs (CLI argv + action inputs +
* env) and needs the same chain. Centralizing eliminates the 7+ hand-rolled
* `parsed.X ?? env["Y"]` occurrences scattered across cli/ that future maintainers
* could "fix" by adding a default to one site but not the others.
*
* Treats the empty string as "missing" for string-typed fields. This matches the
* CLI's existing behavior (`parseStringFromUnknown` raises on empty input, and the
* shell typically passes empty strings for unset flags).
*
* @param parsedValue  CLI/inputs value (already parsed).
* @param envValue     Env-var value (read via ENV_KEYS.X).
* @param fallback     The schema default (from FIELDS.<x>.defaultValue or a derived constant).
* @returns            The first non-null/non-empty value, or `fallback`.
*/
function resolveField(parsedValue, envValue, fallback) {
	if (parsedValue !== void 0 && parsedValue !== null) if (typeof parsedValue === "string" && parsedValue.length === 0) {} else return parsedValue;
	if (envValue !== void 0 && envValue !== null) if (typeof envValue === "string" && envValue.length === 0) {} else return envValue;
	return fallback;
}
function resolveFromSchema(parsed, env) {
	const resolved = { ...parsed };
	const fieldProvenance = {};
	for (const field of Object.values(FIELDS)) {
		const parsedValue = parsedValueForField(parsed, field);
		const envValue = firstNonBlankEnv(field.env, env);
		const raw = parsedValue ?? envValue?.value ?? field.defaultValue;
		resolved[field.field] = coerceField(field, raw);
		fieldProvenance[field.field] = parsedValue !== void 0 ? { source: "flag" } : envValue !== void 0 ? {
			source: "env",
			envName: envValue.envName
		} : { source: "default" };
	}
	resolved["minimumSeverityInternal"] = parseSeverityFromUnknown(resolved["minimumSeverity"], FIELDS.minimumSeverity.field);
	return Object.assign({}, parsed, resolved, { fieldProvenance });
}
function parsedValueForField(parsed, field) {
	if (!(field.field in parsed)) return;
	if (field.flag !== null && !wasCliFieldExplicitlySet(parsed, field.field)) return;
	const value = Reflect.get(parsed, field.field);
	return value === null ? void 0 : value;
}
function firstNonBlankEnv(aliases, env) {
	for (const alias of aliases) {
		const value = env[alias];
		if (typeof value === "string" && value.trim().length > 0) return {
			envName: alias,
			value
		};
	}
}
function coerceField(field, raw) {
	switch (field.type) {
		case "string":
			if (typeof raw !== "string") throw new InvalidConfigError(field.field, `expected string, received ${typeof raw}`);
			return raw;
		case "boolean": return parseBooleanFromUnknown(raw, field.field);
		case "integer": return parseIntegerFromUnknown(raw, field.field);
		case "enum": return parseEnumField(field, raw);
		default: return assertNever$2(field.type);
	}
}
function parseEnumField(field, raw) {
	if (field.field === "platform") return parsePlatformFromUnknown(raw, field.field);
	if (field.field === "minimumSeverity") parseSeverityFromUnknown(raw, field.field);
	if (typeof raw !== "string") throw new InvalidConfigError(field.field, `expected enum string, received ${typeof raw}`);
	const normalized = raw.trim().toLowerCase();
	if (!(field.enumValues ?? []).includes(normalized)) throw new InvalidConfigError(field.field, `unknown enum value ${REDACTED_PLACEHOLDER}`);
	return normalized;
}
function assertNever$2(value) {
	throw new InvalidConfigError("field.type", `unknown field type ${String(value)}`);
}
//#endregion
//#region src/review/verified-facts.ts
/**
* Verified facts layer — pre-computed repo-state assertions that the
* model receives in the prompt and that the post-filter uses to
* downgrade findings that contradict the diff.
*
* Why this exists
* ---------------
* On PR #41 the model emitted a Critical finding claiming "dist/ is not
* listed in files so the npm-published action will fail at runtime",
* even though the diff for package.json showed `dist` present both
* before and after the change (`npm pack --dry-run` confirmed dist/
* ships). The model was making a verifiable repo-state claim without
* grounding it in the diff.
*
* The fix has two halves:
*   1. Before sending to the model, scan the post-change state of a
*      handful of known structured fields (package.json#files,
*      action.yml#outputs, etc.) and produce a "Verified facts" block
*      the model sees BEFORE the diff. The model can then read the
*      facts and avoid asserting facts the action can already prove.
*   2. After the model responds, scan each finding's body for
*      contradiction patterns (e.g. "X is missing from Y" when the
*      verified facts say X is in Y). Downgrade such findings to
*      `info` rather than posting them at their claimed severity.
*
* This module only does the extraction (step 1). The post-filter is in
* `src/cli/verify-findings.ts`.
*
* Design constraints
* ------------------
* - Source of truth: the diff. The action runs in a consumer's
*   checkout where cwd/package.json is NOT UmActually's package.json
*   — we cannot read the worktree. We reconstruct each file's
*   post-change content from the diff hunks (context lines + added
*   lines, ignoring removed lines).
* - Conservative: if a fact cannot be extracted with high
*   confidence, it is OMITTED. The model should not see a half-baked
*   fact and assume it's authoritative.
* - Cheap: O(diff length) parse. One JSON.parse call per structured
*   field. No external commands, no network.
*/
/**
* Derive verified facts from the supplied PR diff text.
*
* Reconstructs the post-change content of `package.json` and
* `action.yml` from the diff hunks (the action cannot read the
* consumer's worktree safely — cwd is the consumer's repo, not ours).
*/
function collectVerifiedFacts(diffText) {
	return {
		filesInDiff: listDiffPaths(diffText),
		packageJsonFiles: readPackageJsonFiles(diffText),
		packageJsonBin: readPackageJsonBin(diffText),
		packageJsonMain: readPackageJsonMain(diffText),
		actionOutputs: readActionOutputs(diffText)
	};
}
/**
* Render the verified facts as a prompt block. Empty blocks are
* omitted (the prompt should not signal "facts collected" when none
* were). The block is rendered as plain text the model can read line
* by line.
*/
function renderVerifiedFactsBlock(facts) {
	const lines = [];
	if (facts.packageJsonFiles !== null) lines.push(`package.json#files (post-change): ${JSON.stringify(facts.packageJsonFiles.files)}`);
	if (facts.packageJsonBin !== null) lines.push(`package.json#bin (post-change): ${JSON.stringify(facts.packageJsonBin.binEntries)}`);
	if (facts.packageJsonMain !== null) lines.push(`package.json#main (post-change): ${JSON.stringify(facts.packageJsonMain.main)}`);
	if (facts.actionOutputs !== null) lines.push(`action.yml#outputs (post-change): ${JSON.stringify(facts.actionOutputs.outputKeys)}`);
	if (lines.length === 0) return "";
	return [
		"Verified facts (reconstructed from the diff below; do NOT contradict these — they are authoritative for this PR):",
		...lines,
		"If a finding would contradict any of the above, the finding is wrong; omit it or rephrase without the contradiction."
	].join("\n");
}
/**
* Reconstruct a file's post-change content from the diff. Returns
* null if the file does not appear in the diff. The reconstructed
* content is the file content as it would appear in the post-PR
* worktree — context lines preserved verbatim, added lines included,
* removed lines excluded.
*
* Implementation note: we walk the diff linearly, tracking which file
* we're in, and for the target file we collect (context lines, added
* lines). We ignore hunk headers (`@@ -X,Y +A,B @@`) and file-path
* headers (`+++ b/...`, `--- a/...`).
*/
function reconstructFileFromDiff(diffText, filePath) {
	const files = /* @__PURE__ */ new Map();
	let currentPath = null;
	let buffer = null;
	const flush = () => {
		if (currentPath !== null && buffer !== null) files.set(currentPath, buffer);
	};
	for (const line of diffText.split(/\r?\n/u)) {
		if (line.startsWith("diff --git ")) {
			flush();
			const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
			currentPath = match === null ? null : match[2] ?? null;
			buffer = [];
			continue;
		}
		if (currentPath === null || buffer === null) continue;
		if (line.startsWith("+++") || line.startsWith("---")) continue;
		if (line.startsWith("@@")) continue;
		if (line.startsWith("+")) buffer.push(line.slice(1));
		else if (line.startsWith("-")) {} else if (line.startsWith(" ")) buffer.push(line.slice(1));
	}
	flush();
	const reconstructed = files.get(filePath);
	return reconstructed === void 0 ? null : reconstructed.join("\n");
}
function readPackageJsonFiles(diffText) {
	const content = reconstructFileFromDiff(diffText, "package.json");
	if (content === null) return null;
	const fullParse = tryParsePackageJson(content);
	if (fullParse !== null) return extractFilesFromParsed(fullParse);
	return extractFilesByScanning(content);
}
function readPackageJsonBin(diffText) {
	const content = reconstructFileFromDiff(diffText, "package.json");
	if (content === null) return null;
	const fullParse = tryParsePackageJson(content);
	if (fullParse !== null) return extractBinFromParsed(fullParse);
	return extractBinByScanning(content);
}
function readPackageJsonMain(diffText) {
	const content = reconstructFileFromDiff(diffText, "package.json");
	if (content === null) return null;
	const fullParse = tryParsePackageJson(content);
	if (fullParse !== null) return extractMainFromParsed(fullParse);
	return extractMainByScanning(content);
}
function tryParsePackageJson(content) {
	try {
		const parsed = JSON.parse(content);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}
function extractFilesFromParsed(pkg) {
	const files = pkg["files"];
	if (files === void 0) return null;
	if (!Array.isArray(files)) return null;
	const out = [];
	for (const entry of files) {
		if (typeof entry !== "string") return null;
		out.push(entry);
	}
	return {
		kind: "package-json-files",
		files: out
	};
}
function extractBinFromParsed(pkg) {
	const bin = pkg["bin"];
	if (bin === void 0) return {
		kind: "package-json-bin",
		binEntries: []
	};
	if (typeof bin === "string") return {
		kind: "package-json-bin",
		binEntries: [`(binary) -> ${bin}`]
	};
	if (typeof bin !== "object" || bin === null || Array.isArray(bin)) return null;
	const out = [];
	for (const [name, value] of Object.entries(bin)) {
		if (typeof value !== "string") return null;
		out.push(`${name} -> ${value}`);
	}
	return {
		kind: "package-json-bin",
		binEntries: out
	};
}
function extractMainFromParsed(pkg) {
	const main = pkg["main"];
	if (main === void 0) return null;
	if (typeof main !== "string") return null;
	return {
		kind: "package-json-main",
		main
	};
}
/**
* Find `"files": [ ... ]` and read every string element. Returns null
* if the key isn't present or the array isn't a clean JSON string
* array. Tolerates multiline arrays.
*/
function extractFilesByScanning(content) {
	const start = findKeyIndex(content, "\"files\"");
	if (start === -1) return null;
	let i = content.indexOf(":", start) + 1;
	while (i < content.length && /\s/u.test(content[i] ?? "")) i++;
	if (content[i] !== "[") return null;
	i++;
	const out = [];
	while (i < content.length) {
		const ch = content[i];
		if (ch === void 0) return null;
		if (ch === "]") return {
			kind: "package-json-files",
			files: out
		};
		if (ch === "\"") {
			const end = readStringLiteral(content, i);
			if (end === -1) return null;
			out.push(decodeStringLiteral(content.slice(i + 1, end)));
			i = end + 1;
			while (i < content.length && (content[i] === " " || content[i] === "	" || content[i] === "\n" || content[i] === "\r" || content[i] === ",")) i++;
			continue;
		}
		i++;
	}
	return null;
}
/**
* Find `"bin": { ... }` and read every `"name": "value"` entry.
*/
function extractBinByScanning(content) {
	const start = findKeyIndex(content, "\"bin\"");
	if (start === -1) return null;
	let i = content.indexOf(":", start) + 1;
	while (i < content.length && /\s/u.test(content[i] ?? "")) i++;
	if (content[i] === "\"") {
		const end = readStringLiteral(content, i);
		if (end === -1) return null;
		return {
			kind: "package-json-bin",
			binEntries: [`(binary) -> ${decodeStringLiteral(content.slice(i + 1, end))}`]
		};
	}
	if (content[i] !== "{") return null;
	i++;
	const out = [];
	while (i < content.length) {
		const ch = content[i];
		if (ch === void 0) return null;
		if (ch === "}") return {
			kind: "package-json-bin",
			binEntries: out
		};
		if (ch === "\"") {
			const keyEnd = readStringLiteral(content, i);
			if (keyEnd === -1) return null;
			const name = decodeStringLiteral(content.slice(i + 1, keyEnd));
			let j = keyEnd + 1;
			while (j < content.length && (content[j] === " " || content[j] === "	" || content[j] === "\n" || content[j] === "\r")) j++;
			if (content[j] !== ":") return null;
			j++;
			while (j < content.length && (content[j] === " " || content[j] === "	" || content[j] === "\n" || content[j] === "\r")) j++;
			if (content[j] !== "\"") return null;
			const valEnd = readStringLiteral(content, j);
			if (valEnd === -1) return null;
			const value = decodeStringLiteral(content.slice(j + 1, valEnd));
			out.push(`${name} -> ${value}`);
			i = valEnd + 1;
			while (i < content.length && (content[i] === " " || content[i] === "	" || content[i] === "\n" || content[i] === "\r" || content[i] === ",")) i++;
			continue;
		}
		i++;
	}
	return null;
}
/**
* Find `"main": "value"` and return the string.
*/
function extractMainByScanning(content) {
	const start = findKeyIndex(content, "\"main\"");
	if (start === -1) return null;
	let i = content.indexOf(":", start) + 1;
	while (i < content.length && /\s/u.test(content[i] ?? "")) i++;
	if (content[i] !== "\"") return null;
	const end = readStringLiteral(content, i);
	if (end === -1) return null;
	return {
		kind: "package-json-main",
		main: decodeStringLiteral(content.slice(i + 1, end))
	};
}
/**
* Locate the start index of a JSON key. Returns -1 if not present.
* Skips past any key-like substring that is followed by something
* other than `:` (after optional tabs/spaces).
*/
function findKeyIndex(content, quotedKey) {
	let i = 0;
	while (i < content.length) {
		const idx = content.indexOf(quotedKey, i);
		if (idx === -1) return -1;
		let j = idx + quotedKey.length;
		while (j < content.length && (content[j] === " " || content[j] === "	")) j++;
		if (content[j] === ":") return idx;
		i = idx + 1;
	}
	return -1;
}
/**
* Return the closing-`"` index for a string literal that starts at
* `openIndex` (which must point at the opening `"`). Returns -1 on
* unterminated literal. Handles `\"` escapes.
*/
function readStringLiteral(content, openIndex) {
	for (let i = openIndex + 1; i < content.length; i++) {
		const ch = content[i];
		if (ch === void 0) return -1;
		if (ch === "\\") {
			i++;
			continue;
		}
		if (ch === "\"") return i;
	}
	return -1;
}
/**
* Decode a JSON string-literal body (without surrounding quotes) into
* a JS string. Handles the common escapes \\, \", \n, \r, \t.
*/
function decodeStringLiteral(body) {
	let out = "";
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch === "\\") {
			const next = body[i + 1];
			if (next === void 0) {
				out += "\\";
				continue;
			}
			switch (next) {
				case "\"":
					out += "\"";
					i++;
					break;
				case "\\":
					out += "\\";
					i++;
					break;
				case "n":
					out += "\n";
					i++;
					break;
				case "r":
					out += "\r";
					i++;
					break;
				case "t":
					out += "	";
					i++;
					break;
				default:
					out += next;
					i++;
					break;
			}
			continue;
		}
		out += ch ?? "";
	}
	return out;
}
function readActionOutputs(diffText) {
	const content = reconstructFileFromDiff(diffText, "action.yml");
	if (content === null) return null;
	return parseActionOutputsYaml(content, diffText);
}
/**
* Minimal YAML reader for the action.yml `outputs:` block. We do not
* need a full YAML parser — outputs is always a flat map of
* key: description pairs at 2-space indentation under the
* `outputs:` line. We collect keys only.
*
* Returns null when the reconstructed action.yml does NOT contain an
* `outputs:` line AND the diff did not explicitly remove one. This
* is important: returning an empty `outputKeys` array for an
* action.yml that never had outputs would cause the post-filter to
* interpret the empty list as "outputs were removed" and
* potentially flag findings that legitimately mention outputs in
* natural language.
*
* When the diff DOES contain `-outputs:` (or an entire outputs
* block removal), we return `{ outputKeys: [] }` because the diff
* itself is the signal that outputs was removed; the absence of
* `outputs:` in the reconstructed file is the post-change state.
*/
function parseActionOutputsYaml(text, diffText) {
	const lines = text.split(/\r?\n/u);
	const outputKeys = [];
	let inOutputsBlock = false;
	let sawOutputsMarker = false;
	for (const line of lines) {
		if (/^outputs\s*:\s*$/u.test(line)) {
			inOutputsBlock = true;
			sawOutputsMarker = true;
			continue;
		}
		if (!inOutputsBlock) continue;
		if (line.length > 0 && line[0] !== " " && line[0] !== "	") {
			inOutputsBlock = false;
			continue;
		}
		const keyMatch = /^  (\w[\w-]*)\s*:/u.exec(line);
		if (keyMatch !== null) outputKeys.push(keyMatch[1] ?? "");
	}
	if (sawOutputsMarker) return {
		kind: "action-outputs",
		outputKeys
	};
	if (/^-\s*outputs\s*:\s*$/mu.test(diffText)) return {
		kind: "action-outputs",
		outputKeys: []
	};
	if (/^-\s*outputs\b/mu.test(diffText)) return {
		kind: "action-outputs",
		outputKeys: []
	};
	return null;
}
//#endregion
//#region src/util/env-keys.ts
/** Centralised env-var name registry; eliminates inline `env["..."]` strings and keeps legacy aliases visible. */
const ENV_KEYS = {
	UMACTUALLY_API_URL: "UMACTUALLY_API_URL",
	UMACTUALLY_API_KEY: "UMACTUALLY_API_KEY",
	UMACTUALLY_MODEL: "UMACTUALLY_MODEL",
	UMACTUALLY_GITHUB_API_BASE: "UMACTUALLY_GITHUB_API_BASE",
	UMACTUALLY_INCLUDE_SONARQUBE: "UMACTUALLY_INCLUDE_SONARQUBE",
	UMACTUALLY_SONAR_HOST_URL: "UMACTUALLY_SONAR_HOST_URL",
	UMACTUALLY_SONAR_TOKEN: "UMACTUALLY_SONAR_TOKEN",
	UMACTUALLY_SONAR_PROJECT_KEY: "UMACTUALLY_SONAR_PROJECT_KEY",
	UMACTUALLY_PROMPT_FILE: "UMACTUALLY_PROMPT_FILE",
	UMACTUALLY_PROMPT_FILES: "UMACTUALLY_PROMPT_FILES",
	UMACTUALLY_ADDITIONAL_PROMPT_FILE: "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
	UMACTUALLY_ADDITIONAL_PROMPT_FILES: "UMACTUALLY_ADDITIONAL_PROMPT_FILES",
	UMACTUALLY_STRICT_SCHEMA: "UMACTUALLY_STRICT_SCHEMA",
	UMACTUALLY_VERIFY_FINDINGS: "UMACTUALLY_VERIFY_FINDINGS",
	REVIEW_STRICT_SCHEMA: "REVIEW_STRICT_SCHEMA",
	REVIEW_VERIFY_FINDINGS: "REVIEW_VERIFY_FINDINGS",
	REVIEW_PROVIDER_URL: "REVIEW_PROVIDER_URL",
	REVIEW_PROVIDER_API_KEY: "REVIEW_PROVIDER_API_KEY",
	REVIEW_PROVIDER_MODEL: "REVIEW_PROVIDER_MODEL",
	REVIEW_TIMEOUT_SECONDS: "REVIEW_TIMEOUT_SECONDS",
	REVIEW_FILE_LIMIT: "REVIEW_FILE_LIMIT",
	REVIEW_LEAK_DETECTION: "REVIEW_LEAK_DETECTION",
	GITHUB_ACTIONS: "GITHUB_ACTIONS",
	GITHUB_EVENT_PATH: "GITHUB_EVENT_PATH",
	GITHUB_TOKEN: "GITHUB_TOKEN",
	GITHUB_REPOSITORY: "GITHUB_REPOSITORY",
	GITHUB_REF: "GITHUB_REF",
	GITHUB_SHA: "GITHUB_SHA",
	TF_BUILD: "TF_BUILD",
	SYSTEM_ACCESSTOKEN: "SYSTEM_ACCESSTOKEN",
	SYSTEM_TEAMPROJECT: "SYSTEM_TEAMPROJECT",
	SYSTEM_COLLECTIONURI: "SYSTEM_COLLECTIONURI",
	BUILD_REPOSITORY_ID: "BUILD_REPOSITORY_ID",
	SYSTEM_PULLREQUEST_PULLREQUESTID: "SYSTEM_PULLREQUEST_PULLREQUESTID",
	SYSTEM_PULLREQUEST_SOURCECOMMITID: "SYSTEM_PULLREQUEST_SOURCECOMMITID",
	SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "SYSTEM_PULLREQUEST_TARGETBRANCHNAME",
	INPUT_DRY_RUN: "INPUT_DRY_RUN",
	INPUT_EVENT: "INPUT_EVENT",
	INPUT_DIFF: "INPUT_DIFF",
	INPUT_REVIEW: "INPUT_REVIEW",
	INPUT_THREADS: "INPUT_THREADS",
	INPUT_OUTPUT_ARTIFACT: "INPUT_OUTPUT_ARTIFACT",
	INPUT_PLATFORM: "INPUT_PLATFORM"
};
//#endregion
//#region src/cli/provider-prompts.ts
/**
* The strict JSON schema the model must emit. We send this on the
* wire as `response_format: { type: "json_schema", strict: true }`
* for the OpenAI Responses/Chat APIs that support it (see
* `src/provider/provider-parse.ts:buildResponsesBody`). The schema
* is a duplicate of the prose in the system prompt — the prose is
* the in-context guide, the wire schema is the API enforcement.
*
* The model can still emit the *wrong* path or line — strict schema
* enforces shape, not truth. The post-filter in
* `parseDiffPositions` + the `parse-warnings.json` artifact are
* the layer that enforces truth.
*
* Compatibility note: the LIVE parser (in `provider-parse.ts`) is
* permissive about `verdict` and `severity` strings (it accepts any
* non-empty string and the `normalizeProviderSeverity` fallback
* maps unrecognized values). The wire schema is therefore
* permissive on those fields too — `string` with a `minLength: 1`
* constraint rather than a strict enum. A strict enum here would
* cause valid responses to be rejected by providers that enforce
* the schema (and per the model-comparison survey, the `severity`
* and `verdict` strings are exactly where providers diverge).
*
* The wire schema intentionally has NO `description` fields. Strict
* JSON-schema providers (e.g. OpenAI strict-mode) treat `description`
* as machine-checked, and a description with prose like "A path
* from the Files-in-diff list below" can be interpreted as a
* constraint that breaks valid responses. The in-context system
* prompt carries the full description text; the wire schema is
* pure shape.
*/
const REVIEW_PAYLOAD_JSON_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: [
		"summary",
		"verdict",
		"comments",
		"suppressed_comments"
	],
	properties: {
		summary: { type: "string" },
		verdict: {
			type: "string",
			minLength: 1
		},
		comments: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"path",
					"line",
					"body",
					"severity",
					"category"
				],
				properties: {
					path: { type: "string" },
					line: {
						type: "integer",
						minimum: 1
					},
					body: { type: "string" },
					severity: {
						type: "string",
						minLength: 1
					},
					category: { type: "string" }
				}
			}
		},
		suppressed_comments: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"path",
					"line",
					"body",
					"severity",
					"category"
				],
				properties: {
					path: { type: "string" },
					line: {
						type: "integer",
						minimum: 1
					},
					body: { type: "string" },
					severity: {
						type: "string",
						minLength: 1
					},
					category: { type: "string" }
				}
			}
		}
	}
};
async function buildProviderPrompts(input) {
	const defaultPaths = resolveDefaultPromptFilesOnce(input.cwd);
	const additionalPrompt = await readAdditionalPrompt(input, defaultPaths);
	const userParts = [`Platform: ${input.platform}`, additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none"];
	if (input.sonarContext !== void 0 && input.sonarContext.length > 0) userParts.push(input.sonarContext);
	const verifiedBlock = renderVerifiedFactsBlock(collectVerifiedFacts(input.diffText));
	if (verifiedBlock.length > 0) userParts.push(verifiedBlock);
	userParts.push(buildFilesInDiffBlock(input.diffText));
	userParts.push("Diff:", input.diffText);
	return {
		system: await pickSystemPrompt(input, defaultPaths),
		user: userParts.join("\n\n")
	};
}
/**
* Per-cwd memoized wrapper around `resolveDefaultPromptFiles`. The
* chunked live path invokes `buildProviderPrompts` per chunk, so a
* per-call resolve would multiply the fs.stat calls and (more
* importantly) introduce an extra `await` boundary that breaks the
* single-threaded event-loop assumption `setActiveSeveritySink`
* relies on (see `src/provider/provider-parse.ts:86-88`).
*
* Implementation note: uses synchronous fs.stat to avoid any `await`
* boundary in `buildProviderPrompts`. Each stat is sub-millisecond
* and the result is cached per cwd, so the total cost is at most 5
* sync stats on the FIRST `buildProviderPrompts` call per process.
*
* ## Cache lifetime contract
*
* The cache is **process-scoped and lives for the lifetime of the
* Node process**. It is intentionally NOT invalidated by anything
* other than `__resetDefaultPromptFilesCacheForTests` (which is a
* test-only hook). This is acceptable for the action's documented
* deployment model — each `umactually` invocation
* (GitHub Actions, Azure DevOps, CLI) runs as a FRESH Node
* process, so the cache effectively lives for one review run.
*
* What this means for callers:
*
* - **Standard usage (one process per review run):** The cache is
*   populated on the first `buildProviderPrompts` call (with up to
*   five sync `fs.stat` calls for `DEFAULT_PROMPT_FILE_PATHS`); every
*   subsequent call within the same run reuses the cached path list.
*   Per-chunk reads re-stat the disk (cheap; cache is path-list, not
*   file-content).
*
* - **Long-lived processes (rare):** If you reuse the bundled CLI
*   inside a daemon or composite step that runs the action multiple
*   times against the same cwd, the cache entry will persist across
*   runs — a `CLAUDE.md` added AFTER the first run will not be
*   auto-loaded by the second run. This is acceptable because the
*   documented deployment model is one process per review; the
*   alternative (cache-busting) would either add a new `await`
*   boundary (race) or require a per-run `reset()` call that the
*   caller is responsible for invoking. Documented here so the
*   contract is explicit; if a long-lived-process use case emerges,
*   revisit this design.
*
* - **Tests:** Use `__resetDefaultPromptFilesCacheForTests()` to
*   clear the cache between scenarios that mutate the workspace.
*/
const DEFAULT_PROMPT_FILES_CACHE = /* @__PURE__ */ new Map();
function resolveDefaultPromptFilesOnce(cwd) {
	const cached = DEFAULT_PROMPT_FILES_CACHE.get(cwd);
	if (cached !== void 0) return cached;
	const out = [];
	for (const candidate of DEFAULT_PROMPT_FILE_PATHS) {
		if (!isSafeRelativeCandidate(candidate)) throw new Error(`DEFAULT_PROMPT_FILE_PATHS contains an unsafe entry: ${JSON.stringify(candidate)}. Entries must be relative paths with no '..' segments and no leading '/' or drive letter.`);
		try {
			if (statSync(join(cwd, candidate)).isFile()) out.push(candidate);
		} catch {}
	}
	const frozen = Object.freeze(out);
	DEFAULT_PROMPT_FILES_CACHE.set(cwd, frozen);
	return frozen;
}
/**
* Returns true iff the candidate is a safe relative path: no leading
* `/`, no leading drive letter (Windows `C:` etc.), no `..` segments,
* and at least one non-separator character.
*
* This is defense in depth — DEFAULT_PROMPT_FILE_PATHS is hardcoded
* with safe entries today. The check exists so a future maintainer
* who adds an entry with `..` (e.g. `../sibling/CLAUDE.md`) sees a
* loud failure rather than silently allowing the action to read a
* path outside cwd.
*/
function isSafeRelativeCandidate(candidate) {
	if (typeof candidate !== "string" || candidate.length === 0) return false;
	if (candidate.startsWith("/") || candidate.startsWith("\\")) return false;
	if (/^[a-zA-Z]:[\\/]?/u.test(candidate)) return false;
	if (candidate.split(/[\\/]/u).some((seg) => seg === "..")) return false;
	return true;
}
/**
* Reset hook called by the CLI entry points (`runCli`, `runDryRun`,
* `runLive`) at the start of each invocation. Under the documented
* deployment model — one Node process per review run — this is
* effectively a no-op (the cache is fresh on the first build call).
*
* Why it exists:
* 1. **Tests that exercise the chunked orchestrator's per-call
*    buildProviderPrompts path need to invalidate the cache between
*    independent runLive invocations in the same process.** The
*    test-only hook above exists for that — but production callers
*    never need it.
* 2. **A long-lived-process deployment (out of scope; not the
*    action's model) would call this between reviews to force a
*    fresh stat of the cwd's default-lookup files.** Documented
*    but not used by the bundled CLI today.
*
* The function name intentionally preserves the "ForTests" pattern in
* the dedicated test hook above; this entry-point reset is a
* separate surface and is the one production callers could call if
* they ever needed to.
*/
function resetDefaultPromptFilesCache() {
	DEFAULT_PROMPT_FILES_CACHE.clear();
}
/**
* Format the diff's file list as an explicit, copy-pastable block the
* model can match against. Pinned by the citation-grounding plan
* (Layer 2-A): the prompt now lists every path the model is
* permitted to cite, which makes hallucinated paths obvious to
* both the model and the post-filter.
*/
function buildFilesInDiffBlock(diffText) {
	const paths = listDiffPaths(diffText);
	if (paths.length === 0) return "Files in diff: (none — empty diff)";
	return [
		"Files in diff (the ONLY paths you may cite):",
		...paths.map((p, i) => `  ${i + 1}. ${p}`),
		"Do NOT cite any path that is not in this list. If a finding requires a file not in the diff, omit the finding entirely rather than fabricating a path."
	].join("\n");
}
async function pickSystemPrompt(input, defaultPaths) {
	const inline = input.parsed.prompt;
	if (typeof inline === "string" && inline.length > 0) return inline;
	const promptFilesList = splitPromptFileList(resolveField(input.parsed.promptFiles, input.env[ENV_KEYS.UMACTUALLY_PROMPT_FILES], ""));
	if (promptFilesList.length > 0) return readPromptFiles(promptFilesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
	const filePath = resolveField(input.parsed.promptFile, input.env[ENV_KEYS.UMACTUALLY_PROMPT_FILE], "");
	if (filePath.length > 0) return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
	if (defaultPaths.length > 0) return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
	return buildDefaultSystemPrompt();
}
/**
* The built-in default system prompt. Rewritten in PR #26 (the
* "LLM citation grounding" fix) to:
*
* 1. Quote the source lines BEFORE emitting a finding (Anthropic
*    pattern: "if it can't find a quote, state that no relevant
*    quote was found"). This forces the model to anchor each
*    finding to a real diff line and makes fabrication obvious.
* 2. Foreground the diff path enum (the user message carries the
*    same list — see `buildFilesInDiffBlock`) so the model knows
*    the EXACT set of valid paths.
* 3. Include the strict JSON schema so a free-form model that
*    ignores the wire `response_format` still gets a clear
*    shape guide. (Prose schema + wire schema is the standard
*    pattern; see the Ellipsis "27 months of LLM agents" post.)
* 4. Pre-empt the "DO NOT cite dist/" failure mode (PR #56) by
*    telling the model that build artifacts are excluded upstream
*    AND the post-filter will reject any off-path citation. The
*    "Negative Constraints Backfire" finding from the
*    hallucination-survey (Rana, 2026) shows that bare "DO NOT
*    cite X" instructions can paradoxically prime X — so we
*    include the prohibition paired with the positive constraint
*    (cite only what's in the list) and the consequence (filtered
*    out, surfaces in the warning artifact).
*/
function buildDefaultSystemPrompt() {
	return [
		"You are UmActually, a precise pull request reviewer.",
		"",
		"Output contract:",
		"- Your entire response is parsed as a single JSON object matching the schema below. No prose before or after the JSON. No markdown code fences around the JSON (the parser strips them, but emitting them wastes output tokens).",
		"- If you would normally think before answering, the thinking must happen INSIDE the JSON (e.g. as a `reasoning` field) — not as separate prose. The parser discards any text before the first `{` and after the last `}`, so thinking prose only burns your output budget and the answer gets truncated.",
		"- The JSON must contain every required field (`summary`, `verdict`, `comments`, `suppressed_comments`). Missing fields cause a parse failure and the operator sees a parse-fail card instead of your review.",
		"",
		"Workflow for every finding you emit:",
		"1. Identify a real concern introduced by the diff.",
		"2. Copy the EXACT diff lines that justify the concern (a verbatim quote, 1-3 lines).",
		"3. Emit a JSON object whose `path` matches a file from the Files-in-diff list in the user message and whose `line` matches a line number that appears in the diff for that file.",
		"If you cannot complete steps 2-3, OMIT the finding entirely. Do not invent a citation.",
		"",
		"Verified-facts grounding:",
		"- When the user message includes a 'Verified facts' block, those facts are authoritative for this PR. They were reconstructed from the diff by a deterministic parser. Do NOT emit a finding whose `body` contradicts any fact in the block — omit the finding entirely or rephrase it without the contradiction.",
		"- Common contradiction patterns to avoid: claiming X is missing from a whitelist/list when X is in the verified list, claiming Y was removed when Y is in the verified list, claiming an output/input was deleted when the verified facts show it still exists.",
		"- If you would have made such a claim and the verified facts contradict it, the verified facts are correct; your reading of the diff was wrong. Omit the finding.",
		"",
		"False-positive prevention (Layer 5 — calibration):",
		"- Do NOT emit generic best-practice advice without quoting the exact diff line that demonstrates the issue. Advice like 'you should use parameterized queries', 'consider adding an index', 'this could be vulnerable to X' is only a finding if the diff shows the absence AND you can quote the relevant code. The post-filter explicitly downgrades bodies that use these phrasings without a diff anchor.",
		"- Do NOT emit findings whose severity is medium or higher if the body uses hedging language ('could', 'might', 'potentially', 'in some cases', 'in theory'). Reserve medium+ for confirmed violations. The post-filter calibrates hedged-at-high-severity findings down to info.",
		"- Do NOT flag code as missing error handling, validation, sanitization, or authentication if the diff's context lines already show it present. Read the surrounding lines of the cited file before claiming absence — the construct may be in the unchanged context the diff preserves. The post-filter downgrades findings whose body names a construct that the hunk actually contains.",
		"- Do NOT flag a code pattern as a bug if the diff includes an inline comment documenting it as intentional ('// intentional:', '// by design', '// note:', '// hack:', '// workaround', '// rationale:', '// see <link>'). The model often misses the documenting comment when the pattern LOOKS problematic in isolation. The post-filter downgrades these findings so the operator can see them with softer severity.",
		"- When a finding would be speculative ('in some edge case', 'if X were to happen', 'could theoretically lead to'), drop the severity to 'info' or 'low' AT EMISSION TIME rather than emitting at medium/high and relying on the post-filter.",
		"",
		"Forbidden (a non-exhaustive list to make the boundary explicit; the positive constraint above takes precedence):",
		"- Do NOT cite any path that is not in the Files-in-diff list. Build artifacts, generated files, and lockfiles are stripped from the diff upstream and are never reviewable here.",
		"- Do NOT cite any line number that does not appear in the diff for the cited path. Off-by-one or hallucinated line numbers are rejected by the post-filter.",
		"- Do NOT infer missing context. If the diff does not show a function call, do not claim a function call exists.",
		"- Do NOT include secrets, tokens, or any literal that looks like a credential.",
		"- Do NOT emit prose before or after the JSON. The parser will reject your response as a parse-fail.",
		"- Do NOT emit reasoning that is longer than the answer itself. If you have analyzed for a while and the answer is still ahead, you are about to run out of output budget — emit the JSON now with whatever findings you have, even if you would have found more.",
		"",
		"Severity values: info, low, medium, high, critical, security, leak. Use 'security' for an active vulnerability, 'leak' for a confirmed secret, 'critical' for severe bugs. Style and hygiene issues go in 'low' or 'info'.",
		"",
		"Schema:",
		JSON.stringify(REVIEW_PAYLOAD_JSON_SCHEMA, null, 2),
		"",
		"If the diff is empty or has no actionable findings, return verdict=COMMENT with an empty comments array. Do not invent findings to fill the response."
	].join("\n");
}
async function readAdditionalPrompt(input, defaultPaths) {
	const inline = input.parsed.additionalPrompt;
	if (typeof inline === "string" && inline.length > 0) return inline;
	const filesList = splitPromptFileList(resolveField(input.parsed.additionalPromptFiles, input.env[ENV_KEYS.UMACTUALLY_ADDITIONAL_PROMPT_FILES], ""));
	if (filesList.length > 0) return readPromptFiles(filesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
	const filePath = resolveField(input.parsed.additionalPromptFile, input.env[ENV_KEYS.UMACTUALLY_ADDITIONAL_PROMPT_FILE], "");
	if (filePath.length > 0) return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
	if (defaultPaths.length === 0) return "";
	return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
}
//#endregion
//#region src/platform/detect.ts
var PlatformDetectionError = class extends Error {
	name = "PlatformDetectionError";
	code = "PLATFORM_UNKNOWN";
	constructor() {
		super("Unable to detect a supported CI platform from the process environment.");
	}
};
const GITHUB_ACTIONS_KEY = ENV_KEYS.GITHUB_ACTIONS;
const AZURE_TF_BUILD_KEY = ENV_KEYS.TF_BUILD;
/**
* GitHub precedence: GITHUB_ACTIONS is checked first, so a process that
* somehow exposes both `GITHUB_ACTIONS=true` and `TF_BUILD=True` (rare,
* but possible in nested CI) routes to GitHub. The order is part of the
* contract — swapping the two arms would silently change behaviour for
* anyone running the action in a cross-platform test harness.
*/
function detectPlatform(env) {
	if (isTruthy(env[GITHUB_ACTIONS_KEY])) return "github";
	if (isTruthy(env[AZURE_TF_BUILD_KEY])) return "azure-devops";
	throw new PlatformDetectionError();
}
/**
* Recognise CI-platform "marker present" values.
*
* Azure Pipelines emits `TF_BUILD=True` (capital T) — the canonical
* runner value. The helper also accepts `"true"` (lowercase) so local
* mocked pipelines and `pipeline-init.sh` shell scripts that
* `export TF_BUILD=true` continue to work, and `"TRUE"` (all uppercase)
* so a PowerShell `Set-Item env:TF_BUILD=TRUE` mistake does not
* silently land in `PLATFORM_UNKNOWN` for the operator. Everything else
* (including `"1"`, `"yes"`, whitespace-padded) is intentionally
* rejected: the goal is to recognise the three real-world casings, not
* to be a general truthy-string helper.
*/
function isTruthy(value) {
	return value === "true" || value === "True" || value === "TRUE";
}
//#endregion
//#region src/cli/validate.ts
function resolvePlatform(platform, env = process.env) {
	switch (platform) {
		case "github": return "github";
		case "azure": return "azure";
		case "auto": try {
			return detectPlatform(env) === "azure-devops" ? "azure" : "github";
		} catch (error) {
			if (error instanceof PlatformDetectionError) return "github";
			throw error;
		}
		default: return assertNever$1(platform);
	}
}
/**
* Did the operator ask the CLI to actually post? Posting identity must
* be present iff true.
*
* Posting intent is signaled by `--review`: that's the only artifact path
* the operator must explicitly opt into. ADO requires it for thread
* posting; GH Actions derives it from `$GITHUB_EVENT_PATH` automatically,
* which the wrapper runtime fills in (`src/index.ts:resolveGithubEventPath`)
* before the CLI parser runs. Operator-supplied --dry-run is a hard kill
* switch — even with --review, dry-run never posts.
*/
function isPostingRequested(parsed) {
	if (parsed.dryRun) return false;
	return parsed.reviewPath !== null;
}
/**
* Errors that ALWAYS apply regardless of whether the run is posting.
* These are invariants the operator must satisfy in every mode.
*
* Returns {@link ValidationError} objects so the runner can render the
* `message` (legacy contract) AND the structured `hint` so the operator
* knows exactly what to set. The `message` field on each entry is the
* byte-identical legacy string the old flat-join consumer printed, so
* grep-friendly CI logs and any test that does `.includes("--api-url")`
* keep working.
*/
function collectAlwaysValidationErrors(parsed) {
	const errors = [];
	if (parsed.includeSonarqube) {
		if (parsed.sonarHostUrl === null) errors.push({
			flag: "--sonar-host-url",
			message: "--sonar-host-url is required when --include-sonarqube is set",
			hint: "Pass the SonarQube base URL (e.g. `https://sonar.example.com`) via `--sonar-host-url <url>` or `UMACTUALLY_SONAR_HOST_URL=<url>`. Run `umactually doctor` to see which env vars are present."
		});
		if (parsed.sonarToken === null) errors.push({
			flag: "--sonar-token",
			message: "--sonar-token is required when --include-sonarqube is set",
			hint: "Provide a SonarQube user token via `--sonar-token <token>` or `UMACTUALLY_SONAR_TOKEN=<token>`. Store it as a CI secret — never in source."
		});
		if (parsed.sonarProjectKey === null) errors.push({
			flag: "--sonar-project-key",
			message: "--sonar-project-key is required when --include-sonarqube is set",
			hint: "Pass the SonarQube project key (e.g. `myorg_myrepo`) via `--sonar-project-key <key>` or `UMACTUALLY_SONAR_PROJECT_KEY=<key>`. The key is usually `<organization>_<repository>` and is shown in the SonarQube UI under Project Settings."
		});
	}
	if (!parsed.dryRun) {
		if ((parsed.apiUrl === null || parsed.apiUrl.length === 0) && parsed.provider !== "copilot" && parsed.provider !== "anthropic") errors.push({
			flag: "--api-url",
			message: "--api-url is required unless --dry-run is set, --provider copilot is used, or --provider anthropic is used",
			hint: "Pass `--api-url <url>` (e.g. `https://api.openai.com/v1`) or `UMACTUALLY_API_URL=<url>`. For Anthropic-native, pass `--provider anthropic` (default URL is https://api.anthropic.com/v1). For GitHub Copilot, pass `--provider copilot`. Run `umactually doctor` to confirm env vars are loaded."
		});
		if (parsed.apiKey === null || parsed.apiKey.length === 0) errors.push({
			flag: "--api-key",
			message: "--api-key is required unless --dry-run is set",
			hint: "Pass `--api-key <key>` (or `UMACTUALLY_API_KEY=<key>`). Store it as a CI secret — never in source. Run `umactually doctor` to confirm env vars are loaded. Add `--dry-run` to skip the provider call for a smoke test."
		});
	}
	return errors;
}
/**
* Errors that apply ONLY when posting is requested.
*
* Posting-target identity (--event, --diff, --pr-number, --repo) is
* genuinely required to post somewhere. If the operator did not request
* posting (dry-run, or no --review), these errors do NOT apply —
* because the CLI never reaches the posting step.
*
* ADO additionally requires prNumber + repo because the PR-event shape
* demands them; GitHub Actions can derive these from GITHUB_EVENT_PATH.
*
* Returns {@link ValidationError} objects with hints so the runner can
* render remediation text alongside the failure (see
* `renderValidationErrors` in cli.ts).
*/
function collectPostingValidationErrors(parsed) {
	if (!isPostingRequested(parsed)) return [];
	const errors = [];
	const resolved = resolvePlatform(parsed.platform);
	if (parsed.eventPath === null) errors.push({
		flag: "--event",
		message: "--review requires --event",
		hint: "Pass the path to the GitHub `event.json` payload (or the Azure equivalent) via `--event <path>`. The CLI uses this file to identify which PR to post the review on. See https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request for the GitHub event payload shape."
	});
	if (parsed.diffPath === null) errors.push({
		flag: "--diff",
		message: "--review requires --diff",
		hint: "Pass the path to the unified PR diff (or a synthetic diff for local runs) via `--diff <path>`. Generate one with `git diff <base>...HEAD` or use the API-supplied diff in CI. The CLI reviews this diff and posts inline comments against it."
	});
	if (resolved === "azure") {
		if (parsed.prNumber === null) errors.push({
			flag: "--pr-number",
			message: "--review requires --pr-number for --platform azure",
			hint: "Pass `--pr-number <N>` (a positive integer) — Azure DevOps does not advertise the PR number through SYSTEM_PULLREQUEST_PULLREQUESTID in every pipeline configuration. See docs/azure-devops.md for the supported forms."
		});
		if (parsed.repo === null) errors.push({
			flag: "--repo",
			message: "--review requires --repo for --platform azure",
			hint: "Pass `--repo <organization>/<project>/<repository>` (Azure-format repo id) or set `SYSTEM_TEAMPROJECT` and `BUILD_REPOSITORY_NAME` in the pipeline. The CLI uses these to build the threads API URL."
		});
	}
	return errors;
}
/**
* Composed validator. Always-errors ALWAYS apply; posting-errors apply
* only when posting is requested. Backwards-compatible at the level of
* the `message` field (each entry carries the legacy flat string), and
* forwards-compatible via `flag`+`hint` so structured renderers can
* surface remediation.
*
* Returns {@link ValidationError} records; legacy flat-string callers
* can map `errors.map((e) => e.message)` to recover the old shape.
*/
function collectValidationErrors(parsed) {
	return [...collectAlwaysValidationErrors(parsed), ...collectPostingValidationErrors(parsed)];
}
function assertNever$1(value) {
	throw new TypeError(`unhandled platform variant: ${JSON.stringify(value)}`);
}
//#endregion
//#region src/platform/azure/chunk.ts
const DEFAULT_MAX_CHUNK_BYTES = 8e3;
const DEFAULT_MAX_FILES_PER_CHUNK = 50;
const DIFF_HEADER_PREFIX = "diff --git ";
/**
* Count the number of distinct files in a unified diff by tallying
* `diff --git ` headers. The `findDiffHeaderIndices` helper does the
* strict line-start anchor matching, so this function correctly ignores
* literal `diff --git` substrings that happen to appear inside a hunk.
*
* Used by the orchestrator to gate the chunked review path on
* `review-file-limit` (default 200) — once a PR crosses that threshold
* we stop calling the provider because per-chunk reviews of an
* arbitrarily-large initial-import diff produce hallucinated findings
* that look substantive but aren't grounded in the code.
*/
function countDiffFiles(diffText) {
	return findDiffHeaderIndices(diffText).length;
}
function chunkDiffByFile(diffText, options) {
	const maxChunkBytes = options?.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
	const maxFilesPerChunk = options?.maxFilesPerChunk ?? DEFAULT_MAX_FILES_PER_CHUNK;
	if (diffText.length === 0) return [];
	const fileStarts = findDiffHeaderIndices(diffText);
	if (fileStarts.length <= 1 && diffText.length <= maxChunkBytes) return [diffText];
	const safeBytes = Math.max(1, Math.floor(maxChunkBytes));
	const safeFiles = Math.max(1, Math.floor(maxFilesPerChunk));
	const chunks = [];
	let currentChunk = "";
	let currentFiles = 0;
	let chunkStart = 0;
	for (let index = 0; index < fileStarts.length; index += 1) {
		const fileStart = fileStarts[index];
		const fileEnd = index + 1 < fileStarts.length ? fileStarts[index + 1] : diffText.length;
		const fileBlock = diffText.slice(fileStart, fileEnd);
		const wouldExceedBytes = currentChunk.length + fileBlock.length > safeBytes;
		const wouldExceedFiles = currentFiles + 1 > safeFiles;
		const fileIsLargerThanChunkCap = fileBlock.length > safeBytes;
		if (currentChunk.length > 0 && (wouldExceedBytes || wouldExceedFiles)) {
			chunks.push(diffText.slice(chunkStart, fileStart));
			chunkStart = fileStart;
			currentChunk = fileBlock;
			currentFiles = 1;
		} else {
			currentChunk += fileBlock;
			currentFiles += 1;
		}
		if (fileIsLargerThanChunkCap) {
			chunks.push(currentChunk);
			chunkStart = fileEnd;
			currentChunk = "";
			currentFiles = 0;
		}
	}
	if (currentChunk.length > 0) chunks.push(diffText.slice(chunkStart));
	if (chunks.length === 0) return [diffText];
	return chunks;
}
/**
* Indices in `diff` of every `diff --git ` header. Boundary detection
* uses a strict line-start anchor so `diff --git` substrings inside a
* hunk body (rare, but possible if a code change happens to contain
* the literal string) are not mistaken for file boundaries.
*/
function findDiffHeaderIndices(diff) {
	const starts = [];
	let cursor = 0;
	while (cursor < diff.length) {
		const nextLineEnd = diff.indexOf("\n", cursor);
		const lineEnd = nextLineEnd === -1 ? diff.length : nextLineEnd;
		if (diff.slice(cursor, lineEnd).startsWith(DIFF_HEADER_PREFIX)) starts.push(cursor);
		cursor = lineEnd + 1;
		if (nextLineEnd === -1) break;
	}
	return starts;
}
//#endregion
//#region src/platform/azure/context.ts
/**
* Context-resolution error for the Azure DevOps platform adapter.
* Inherits the `PlatformContextError` shape from
* `src/util/platform-error.ts` so it shares a common ancestor with
* `GithubContextError`. The typed `code` literal remains Azure-specific
* — only the base class is shared.
*/
var AzureContextError = class extends PlatformContextError {
	name = "AzureContextError";
};
const SYSTEM_ACCESSTOKEN_ALIAS = "SYSTEM_ACCESSTOKEN";
const AZURE_DEVOPS_TOKEN_ALIAS = "AZURE_DEVOPS_TOKEN";
const AZURE_DEVOPS_HOST = "dev.azure.com";
function readAzureContext(env, overrides) {
	return {
		token: readAzureToken(env),
		org: readAzureOrg(env),
		project: readAzureProject(env),
		repoId: readAzureRepoId(env),
		prNumber: readAzurePrNumber(env, overrides?.prNumber),
		sourceCommit: readAzureSha(env),
		targetBranch: readAzureTargetBranch(env)
	};
}
function readAzureToken(env) {
	const explicitToken = env[AZURE_DEVOPS_TOKEN_ALIAS];
	if (explicitToken !== void 0 && explicitToken.length > 0) return explicitToken;
	const token = env[SYSTEM_ACCESSTOKEN_ALIAS];
	if (token === void 0 || token.length === 0) throw new AzureContextError("AZURE_TOKEN_MISSING", "Azure Pipelines SYSTEM_ACCESSTOKEN (or explicit AZURE_DEVOPS_TOKEN) must be set.");
	return token;
}
function readAzureOrg(env) {
	const collectionUri = env[ENV_KEYS.SYSTEM_COLLECTIONURI];
	if (collectionUri === void 0 || collectionUri.length === 0) throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must be set.");
	let parsedUrl;
	try {
		parsedUrl = new URL(collectionUri);
	} catch {
		throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must be a valid URL.");
	}
	if (parsedUrl.hostname !== AZURE_DEVOPS_HOST) throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", `Azure Pipelines SYSTEM_COLLECTIONURI must target '${AZURE_DEVOPS_HOST}'.`);
	const orgSegment = parsedUrl.pathname.split("/").filter((segment) => segment.length > 0)[0];
	if (orgSegment === void 0 || orgSegment.length === 0) throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must include the organization segment.");
	return orgSegment;
}
function readAzureProject(env) {
	const project = env[ENV_KEYS.SYSTEM_TEAMPROJECT];
	if (project === void 0 || project.length === 0) throw new AzureContextError("AZURE_TEAM_PROJECT_MISSING", "Azure Pipelines SYSTEM_TEAMPROJECT must be set.");
	return project;
}
function readAzureRepoId(env) {
	const repoId = env[ENV_KEYS.BUILD_REPOSITORY_ID];
	if (repoId === void 0 || repoId.length === 0) throw new AzureContextError("AZURE_REPOSITORY_ID_MISSING", "Azure Pipelines BUILD_REPOSITORY_ID must be set.");
	return repoId;
}
function readAzurePrNumber(env, override) {
	if (override !== void 0) {
		if (!Number.isInteger(override) || override <= 0) throw new AzureContextError("AZURE_PR_NUMBER_INVALID", "Azure CLI flag --pr-number must be a positive integer.");
		return override;
	}
	const raw = env[ENV_KEYS.SYSTEM_PULLREQUEST_PULLREQUESTID];
	if (raw === void 0 || raw.length === 0) throw new AzureContextError("AZURE_PR_NUMBER_INVALID", [
		"Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be set.",
		"",
		"Recovery options:",
		"  (1) Run as a build validation policy on an Azure Repos branch —",
		"      Azure Pipelines sets SYSTEM_PULLREQUEST_PULLREQUESTID automatically.",
		"      See docs/azure-devops.md.",
		"  (2) For manual/CLI invocations, pass --pr-number <N> on the command line",
		"      (in addition to supplying BUILD_REPOSITORY_ID, SYSTEM_COLLECTIONURI,",
		"      SYSTEM_TEAMPROJECT, SYSTEM_PULLREQUEST_SOURCECOMMITID,",
		"      SYSTEM_PULLREQUEST_TARGETBRANCHNAME, and either SYSTEM_ACCESSTOKEN",
		"      or AZURE_DEVOPS_TOKEN as env vars)."
	].join("\n"));
	const parsed = parseStrictInt(raw);
	if (parsed === null || parsed <= 0) throw new AzureContextError("AZURE_PR_NUMBER_INVALID", [
		"Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be a positive integer.",
		"",
		"Recovery options:",
		"  (1) Run as a build validation policy on an Azure Repos branch —",
		"      Azure Pipelines sets SYSTEM_PULLREQUEST_PULLREQUESTID automatically.",
		"  (2) For manual/CLI invocations, pass --pr-number <N> instead of relying",
		"      on the env var (the flag accepts positive integers only)."
	].join("\n"));
	return parsed;
}
function readAzureSha(env) {
	const value = env[ENV_KEYS.SYSTEM_PULLREQUEST_SOURCECOMMITID];
	if (value === void 0 || value.length === 0) throw new AzureContextError("AZURE_SOURCE_COMMIT_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_SOURCECOMMITID must be set.");
	return value;
}
function readAzureTargetBranch(env) {
	const value = env[ENV_KEYS.SYSTEM_PULLREQUEST_TARGETBRANCHNAME];
	if (value === void 0 || value.length === 0) throw new AzureContextError("AZURE_TARGET_BRANCH_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_TARGETBRANCHNAME must be set.");
	return value;
}
//#endregion
//#region src/platform/github/context.ts
/**
* Context-resolution error for the GitHub platform adapter. Inherits the
* `PlatformContextError` shape from `src/util/platform-error.ts` so it
* shares a common ancestor with `AzureContextError`. The typed `code`
* literal remains GitHub-specific — only the base class is shared.
*/
var GithubContextError = class extends PlatformContextError {
	name = "GithubContextError";
};
async function readGithubContext(env) {
	const token = readGithubToken(env);
	const eventPayload = await readGithubPullRequestPayload(env);
	return {
		token,
		repo: readGithubRepo(env, eventPayload.repoFullName),
		prNumber: readGithubPrNumber(env, eventPayload.prNumber),
		headSha: readGithubSha(env, "GITHUB_HEAD_SHA", eventPayload.headSha),
		baseSha: readGithubSha(env, "GITHUB_BASE_SHA", eventPayload.baseSha),
		isDraft: eventPayload.isDraft,
		title: eventPayload.title,
		body: eventPayload.body
	};
}
function readGithubToken(env) {
	const fromEnv = env[ENV_KEYS.GITHUB_TOKEN];
	if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
	const fromInput = env["INPUT_GITHUB_TOKEN"];
	if (typeof fromInput === "string" && fromInput.length > 0) return fromInput;
	throw new GithubContextError("GITHUB_TOKEN_MISSING", "GitHub Actions GITHUB_TOKEN must be set.");
}
function readGithubRepo(env, fallback) {
	const repository = env[ENV_KEYS.GITHUB_REPOSITORY] ?? fallback ?? "";
	if (repository.length === 0) throw new GithubContextError("GITHUB_REPOSITORY_INVALID", "GitHub Actions GITHUB_REPOSITORY must be set as '<owner>/<name>'.");
	const slashIndex = repository.indexOf("/");
	if (slashIndex <= 0 || slashIndex === repository.length - 1) throw new GithubContextError("GITHUB_REPOSITORY_INVALID", "GitHub Actions GITHUB_REPOSITORY must follow '<owner>/<name>'.");
	return {
		owner: repository.slice(0, slashIndex),
		name: repository.slice(slashIndex + 1)
	};
}
function readGithubPrNumber(env, fallback) {
	const fromEnv = env["PR_NUMBER"] ?? env["GITHUB_PR_NUMBER"];
	if (fromEnv !== void 0 && fromEnv.length > 0) return parsePrNumber(fromEnv, env);
	if (fallback !== null) return fallback;
	throw new GithubContextError("GITHUB_PR_NUMBER_INVALID", "GitHub pull request number must be provided via PR_NUMBER input, GITHUB_PR_NUMBER env, or the pull_request event payload.");
}
function parsePrNumber(raw, _env) {
	const parsed = parseStrictInt(raw);
	if (parsed === null || parsed <= 0) throw new GithubContextError("GITHUB_PR_NUMBER_INVALID", "GitHub pull request number must be a positive integer.");
	return parsed;
}
function readGithubSha(env, key, fallback) {
	const value = env[key] ?? fallback ?? "";
	if (value.length === 0) throw new GithubContextError("GITHUB_SHA_MISSING", `GitHub Actions ${key} must be set.`);
	return value;
}
async function readGithubPullRequestPayload(env) {
	const eventPath = env[ENV_KEYS.GITHUB_EVENT_PATH];
	if (eventPath === void 0 || eventPath.length === 0) throw new GithubContextError("GITHUB_EVENT_PATH_MISSING", "GitHub Actions GITHUB_EVENT_PATH must be set for pull_request events.");
	const rawPayload = await readFile(eventPath, "utf8");
	const parsed = JSON.parse(rawPayload);
	if (!isRecord(parsed)) throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must parse as a JSON object.");
	const pullRequest = parsed["pull_request"];
	if (!isRecord(pullRequest)) throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must contain a 'pull_request' object.");
	const repository = readRecord(parsed, "repository");
	return {
		isDraft: readBoolean(pullRequest["draft"]),
		title: readString(pullRequest["title"]),
		body: readString(pullRequest["body"]),
		prNumber: readOptionalNumber(pullRequest["number"]),
		headSha: readSha(pullRequest, "head"),
		baseSha: readSha(pullRequest, "base"),
		repoFullName: readRepositoryName(repository)
	};
}
function readSha(record, key) {
	const slot = record[key];
	if (!isRecord(slot)) return null;
	const sha = slot["sha"];
	return typeof sha === "string" && sha.length > 0 ? sha : null;
}
function readRepositoryName(record) {
	const fullName = record["full_name"];
	if (typeof fullName === "string" && fullName.length > 0) return fullName;
	const owner = record["owner"];
	const name = record["name"];
	if (isRecord(owner) && typeof name === "string" && name.length > 0) {
		const ownerLogin = owner["login"];
		if (typeof ownerLogin === "string" && ownerLogin.length > 0) return `${ownerLogin}/${name}`;
	}
	return null;
}
function readOptionalNumber(value) {
	return isPositiveSafeInteger(value) ? value : null;
}
function readRecord(value, label) {
	if (!isRecord(value)) throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", `GitHub event payload must contain a '${label}' object.`);
	return value;
}
function readBoolean(value) {
	return value === true;
}
function readString(value) {
	return typeof value === "string" ? value : "";
}
//#endregion
//#region src/platform/github/api.ts
/**
* API-layer error for the GitHub platform adapter. Inherits the
* `PlatformApiError` shape from `src/util/platform-error.ts` so it shares
* a common ancestor with `AzureApiError` and is catchable as
* `PlatformApiError<...>` when callers don't care about the platform.
*/
var GithubApiError = class extends PlatformApiError {
	name = "GithubApiError";
	constructor(code, status, message, options) {
		super(code, status, message, options);
	}
};
const GITHUB_API_BASE_URL$1 = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") || "https://api.github.com";
const PULL_DIFF_MEDIA_TYPE = "application/vnd.github.v3.diff";
async function fetchGithubPrDiff(context, fetchImpl = fetch) {
	const filtered = filterBuildArtifacts(await fetchTextOrThrow(fetchImpl, {
		url: buildPullUrl(context),
		headers: {
			...githubHeaders(context.token),
			Accept: PULL_DIFF_MEDIA_TYPE
		}
	}, {
		error: GithubApiError,
		failCode: "GITHUB_FETCH_FAILED",
		emptyCode: "GITHUB_DIFF_EMPTY",
		platform: "GitHub PR diff"
	}));
	if (filtered.length === 0) throw new GithubApiError("GITHUB_DIFF_EMPTY", 200, "GitHub PR diff was empty after build-artifact filtering (every changed file was excluded).");
	return filtered;
}
function buildPullUrl(context) {
	const repositorySegment = `${context.repo.owner}/${context.repo.name}`;
	return `${GITHUB_API_BASE_URL$1}/repos/${repositorySegment}/pulls/${context.prNumber}`;
}
//#endregion
//#region src/util/required-config.ts
/**
* Mapping of env-var names known to `requireLiveConfig` to the canonical
* CLI flag (without leading `--`) the operator can supply instead.
*
* Centralized so every call site surfaces the same remediation hint and
* so adding a new env var only requires updating this table. When a key
* is missing, the fallback message just names the env var (no flag hint).
*/
const ENV_VAR_CLI_FLAG = {
	UMACTUALLY_API_URL: "api-url",
	UMACTUALLY_API_KEY: "api-key",
	UMACTUALLY_MODEL: "model",
	UMACTUALLY_PROVIDER: "provider",
	UMACTUALLY_GITHUB_API_BASE: "github-api-base",
	UMACTUALLY_SONAR_HOST_URL: "sonar-host-url",
	UMACTUALLY_SONAR_TOKEN: "sonar-token",
	UMACTUALLY_SONAR_PROJECT_KEY: "sonar-project-key"
};
/**
* Thrown by requireLiveConfig when a required live-review config value is missing.
* Carries the same code/message shape as LiveReviewError so callers that
* pattern-match on `code === "LIVE_CONFIG_MISSING"` keep working without
* importing from cli/live-shared.ts.
*
* Carries a separate `hint` field with actionable remediation text the
* CLI surfaces alongside the message so the operator knows exactly how
* to fix the missing configuration. The hint is intentionally separate
* from `message` so machine consumers (CI guards, JSON envelopes) can
* ignore it without losing the message contract.
*/
var RequiredConfigError = class extends Error {
	code;
	userMessage;
	hint;
	name = "RequiredConfigError";
	constructor(code, userMessage, hint) {
		super(userMessage);
		this.code = code;
		this.userMessage = userMessage;
		this.hint = hint;
	}
};
/**
* Build the canonical user-facing message + remediation hint for a
* missing live-review config value.
*
* Message shape: `${envVarName} must be set for live review.`
* Hint shape, when the env var has a known CLI flag:
*   "Set it via --<flag> <value> on the command line,
*    ${envVarName}=<value> in the environment,
*    or a CI secret if running in GitHub Actions / Azure Pipelines."
* Hint shape, when the env var has no known flag (e.g. GITHUB_TOKEN,
* which the CI runner provides):
*   "Set it via ${envVarName}=<value> in the environment
*    (or a CI secret if running in GitHub Actions / Azure Pipelines)."
*
* Centralized so the canonical env-var/flag naming cannot drift
* between the helper and any future caller that wants to surface the
* same shape (e.g. CLI parse-time, JSON envelope).
*/
function buildRequiredConfigMessage(envVarName) {
	const message = `${envVarName} must be set for live review.`;
	const flag = ENV_VAR_CLI_FLAG[envVarName];
	return {
		message,
		hint: flag !== void 0 ? `Set it via \`--${flag} <value>\` on the command line, \`${envVarName}=<value>\` in the environment, or a CI secret if running in GitHub Actions / Azure Pipelines. Use \`--dry-run\` to skip the provider call entirely for smoke tests.` : envVarName === "GITHUB_TOKEN" || envVarName === "SYSTEM_ACCESSTOKEN" ? `Set it via \`${envVarName}=<value>\` in the environment (the CI runner should provide this automatically). Use \`--dry-run\` to skip the provider call entirely for smoke tests.` : `Set \`${envVarName}=<value>\` in the environment. Use \`--dry-run\` to skip the provider call entirely for smoke tests.`
	};
}
/**
* Validate that a required config value is set; throw LIVE_CONFIG_MISSING if not.
*
* Both the live-provider dispatcher (cli/live-provider.ts) and the orchestrator
* (cli/orchestrator.ts) previously hand-rolled this check with byte-identical
* user-facing messages. This helper is the single source of truth for the
* message AND the remediation hint.
*
* @param value The config value (CLI, env, or default).
* @param envVarName The env-var NAME used in the user-facing error message.
* @returns The same value for ergonomic chaining.
* @throws RequiredConfigError when value is missing or empty. The thrown
*   error's `message` is the byte-compatible legacy string so existing
*   tests and any external consumer pattern-matching on the message
*   keep working; the structured `hint` field carries the remediation.
*/
function requireLiveConfig(value, envVarName) {
	if (value === void 0 || value === null || value.length === 0) {
		const { message, hint } = buildRequiredConfigMessage(envVarName);
		throw new RequiredConfigError("LIVE_CONFIG_MISSING", message, hint);
	}
	return value;
}
//#endregion
//#region src/util/redact.ts
/**
* Replace each literal secret in `value` with the canonical REDACTED_SECRET_TOKEN.
* Uses split().join() (not regex) so secrets containing regex metacharacters
* (.+*?()[]{}\|^$) replace literally without surprises. Empty secrets are
* skipped to avoid "replace every empty string" which would clobber the value.
* Returns `value` unchanged when `secrets` is empty (cheap fast path).
*
* Behavior contract pinned by test/unit/redact-secrets.test.ts:
*   - Empty secrets → returns value unchanged (identity).
*   - Single secret: every occurrence of the literal string is replaced.
*   - Multiple secrets: replaced in array order (earlier wins on overlap).
*   - Secrets containing regex metacharacters are treated literally.
*   - Empty string in secrets array is skipped (no clobber).
*/
function replaceSecretsLiterally(value, secrets) {
	if (secrets.length === 0) return value;
	let out = value;
	for (const secret of secrets) {
		if (secret.length === 0) continue;
		out = out.split(secret).join(REDACTED_SECRET_TOKEN);
	}
	return out;
}
//#endregion
//#region src/util/severity.ts
const SEVERITY_RANK_BY_STRING = Object.freeze({
	info: 0,
	minor: 1,
	major: 2,
	critical: 4,
	security: 5,
	leak: 6,
	low: 1,
	medium: 2,
	high: 3
});
function severityRank(severity) {
	return SEVERITY_RANK_BY_STRING[severity.toLowerCase()] ?? 0;
}
/** Visual order for the counts line; eliminates repeated critical → high → medium → low ordering literals. */
const SEVERITY_ORDER = [
	"critical",
	"high",
	"medium",
	"low"
];
/** Tally comments by severity; eliminates repeated lowercase accumulation logic in live review paths. */
function countBySeverity(comments) {
	const counts = {};
	for (const comment of comments) {
		const key = comment.severity.toLowerCase();
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return counts;
}
/** Sanitize a value against the redaction list before it lands in markdown. */
function redact(value, secrets) {
	return replaceSecretsLiterally(value, secrets);
}
/** Total findings the model produced (posted + off-diff + filtered). */
function totalFindings(data) {
	return data.review.comments.length + data.review.suppressedComments.length;
}
/** Off-diff count: model-suppressed + off-diff-from-comments. */
function offDiffCount(data) {
	return data.review.suppressedComments.length + data.offDiffFromComments.length;
}
/** Filtered = model comments that survived parsing but were not posted. */
function filteredCount(data) {
	return Math.max(0, totalFindings(data) - data.validCommentCount - offDiffCount(data));
}
/** Escape pipes in a value so it can sit inside a GFM table cell. */
function cell(value) {
	return value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ").trim();
}
/**
* Redact a comment body and collapse runs of whitespace to a single space.
*
* Most layouts want a one-line "snippet" — never the raw multi-paragraph
* provider body, never unredacted secrets. The collapsed form is the
* canonical snippet shape used in tables, bullets, sticky notes, and
* the inline preview. Returns an empty string if the body is empty
* after redaction (so callers can `parts.push(snippet)` without
* rendering an empty bullet).
*
* Replaces 13 inline copies of
* `redact(c.body, secrets).replace(/\s+/gu, " ").trim()`.
*/
function collapseBody(c, secrets) {
	return redact(c.body, secrets).replace(/\s+/gu, " ").trim();
}
/**
* Truncate a snippet to `max` chars with a horizontal-ellipsis suffix.
*
* Layouts use different truncation budgets depending on column width
* (table cells vs. blockquote stickies vs. newspaper lede), so this
* helper is parameterised rather than hardcoded. The threshold check
* (`> max`) preserves a string at exactly `max` chars — i.e. we only
* truncate when there is something to cut. The cut leaves room for the
* single-char `…` suffix (i.e. `slice(0, max - 3)`, then append `…`),
* which matches the byte-for-byte truncation budget the layouts have
* always used (e.g. `length > 80 ? slice(0, 77) + '…' : title` → 78
* visible chars). Two chars of headroom are dropped so future suffixes
* wider than `…` (e.g. two-char '..') can swap in without re-tuning
* every call site.
*
* Pass `max = 0` (or any falsy) to disable truncation and return the
* input unchanged — useful when a layout has unlimited horizontal room.
*/
function truncateSnippet(snippet, max) {
	if (!max || snippet.length <= max) return snippet;
	return `${snippet.slice(0, max - 3)}…`;
}
/**
* Group posted comments by file path and return the entries sorted
* alphabetically by path. Used by every layout that renders a
* per-file section (`tldr-walkthrough`, `coverage`, `diffstat`).
* Replaces 3 inline copies of
* `new Map → for-loop → [...entries].sort([a],[b] localeCompare)`.
*/
function groupByFile(comments) {
	const map = /* @__PURE__ */ new Map();
	for (const c of comments) {
		const list = map.get(c.path) ?? [];
		list.push(c);
		map.set(c.path, list);
	}
	return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
/** Render a single-line finding label as `path:line — snippet`. */
function findingLine(c, secrets) {
	const snippet = truncateSnippet(collapseBody(c, secrets), 100);
	return `\`${cell(c.path)}\`:${c.line} — ${snippet}`;
}
/**
* Render a single finding as a `<details>` collapsible block.
*
* Mobile-friendly replacement for a GFM table row. GFM tables at
* 576px viewport auto-size columns to their widest cell, then wrap
* mid-word (`#` column stacks "10" vertically, File:Line breaks
* mid-identifier, Title truncates with `…`, Severity header wraps
* to "Severit"/"y"). The `<details>` element has no column-width
* constraints, so:
*   - severity emoji + word always render on one line
*   - the summary line never truncates inside a code path
*   - the full body, path, and line number render at any width
*     once the user expands the row
*
* Summary line shape: `1 · 🟠 Medium — Indentation regression: line 831 …`
* Expanded body shape: blank line, then `📍 \`path\`:line`, then
* `> ` blockquoted body (blockquotes survive inside `<details>`
* on both GitHub and Azure DevOps).
*
* `summaryCap` is the budget for the summary-line truncation. The
* full title always renders in the expanded body.
*/
function findingsDetailsRow(index, c, secrets, summaryCap) {
	const title = collapseBody(c, secrets);
	const snippet = truncateSnippet(title, summaryCap);
	const lines = [];
	lines.push("<details>");
	lines.push(`<summary>${index} · ${severityEmoji(c.severity)} ${severityLabel(c.severity)} — ${cell(snippet)}</summary>`);
	lines.push("");
	lines.push(`📍 \`${cell(c.path)}\`:${c.line}`);
	lines.push("");
	lines.push(`> ${cell(title)}`);
	lines.push("");
	lines.push("</details>");
	return lines.join("\n");
}
/**
* Severity → display emoji used by every layout that wants a single glyph.
*
* Uses the Unicode colored-circle emoji (🟣 🔴 🟠 🟡 ⚪) because they
* render with their own color on GitHub (which ships a colored emoji
* font) without any inline HTML or `style` attribute. An earlier revision
* tried inline `<span style="color:…">…</span>` to work around Azure
* DevOps not rendering colored emoji — but GitHub's sanitizer strips
* the `style` attribute from `<span>` tags (verified via the GitHub
* `/markdown` API), so the colors vanished on GitHub and the approach
* failed on both platforms.
*
* CROSS-PLATFORM STATUS:
*   - GitHub: renders with color (ships a colored emoji font).
*   - Azure DevOps: renders as outline `⚪` for all severities (no
*     colored emoji font installed). Reviewers on Azure lose the
*     color signal but the glyph shape (`🟣`/`🔴`/`🟠`/`🟡`) is
*     still distinct. This is a known cross-platform limitation,
*     not a regression.
*
* The fallback (unknown severity) is the same outline `⚪` so
* "I don't know what this is" doesn't visually claim to be a real severity.
*/
function severityEmoji(level) {
	switch (level.toLowerCase()) {
		case "critical": return "🟣";
		case "high": return "🔴";
		case "medium": return "🟠";
		case "low": return "🟡";
		case "info": return "🟡";
		default: return "⚪";
	}
}
/** Severity → short label used in compact rows. */
function severityLabel(level) {
	switch (level.toLowerCase()) {
		case "critical": return "Critical";
		case "high": return "High";
		case "medium": return "Medium";
		case "low": return "Low";
		default: return level || "Info";
	}
}
/** Compose the stable hidden manifest that AI agents parse. */
function manifest(data) {
	const payload = {
		schema: MANIFEST_SCHEMA,
		verdict: data.review.verdict,
		provider: data.provider,
		modelId: data.modelId,
		inlineCount: data.validCommentCount,
		suppressedCount: data.suppressedCommentCount,
		severityCounts: { ...data.severityCounts },
		...data.review.parseFailed === true ? { parseFailed: true } : {}
	};
	return `${MANIFEST_MARKER_PREFIX}${JSON.stringify(payload)}${MANIFEST_MARKER_SUFFIX}`;
}
/** Compose the verdict badge. Mirrors `verdictBadge` in live-shared.ts. */
function verdictBadge(data) {
	const normalized = data.review.verdict.toUpperCase();
	const nothingActionable = data.validCommentCount === 0 && data.suppressedCommentCount === 0;
	if (normalized === "NEEDS_FIX" && !nothingActionable) return "⛔ NEEDS_FIX";
	if (normalized === "APPROVED" || normalized === "SHIP") return "✅ SHIP";
	return "💬 DISCUSS";
}
/**
* Pipeline summary line used by most layouts.
*
* Leads with the number of comments that will appear inline on the diff
* (i.e. `postedComments.length`). The reader's question is "how many
* findings will I see on this PR?" — not "how many did the model
* produce?" The model's gross output is the wrong primary signal
* because it includes findings the runtime filtered (severity policy,
* off-diff suppression) before posting. Off-diff findings are surfaced
* separately as a callout in `layoutSeverityTable` (see
* `severity-table off-diff callout` block below), not jammed into the
* headline number.
*/
function pipelineLine(data) {
	const n = data.postedComments.length;
	return `📊 ${n} inline finding${n === 1 ? "" : "s"}`;
}
/**
* Returns the set of severity tiers that are intentionally hidden by
* the active `--minimum-severity` threshold. Empty when no threshold is
* configured or the threshold keeps every displayed tier visible — callers
* use this to (a) mark each filtered tier with a trailing `*` in the tally
* line, and (b) emit the legend line below.
*
* Examples:
*   - minimumSeverity=null     → ∅ (no marker anywhere)
*   - minimumSeverity="low"    → ∅ (everything visible)
*   - minimumSeverity="medium" → { low }
*   - minimumSeverity="high"   → { medium, low }
*/
function filteredTiers(data) {
	const minimum = data.minimumSeverity != null ? data.minimumSeverity.toLowerCase() : null;
	if (minimum === null) return /* @__PURE__ */ new Set();
	return new Set(SEVERITY_ORDER.filter((level) => severityRank(level) < severityRank(minimum)));
}
/**
* Legend line that follows the severity tally when any tier is
* filtered. Returns `""` when nothing is filtered — callers MUST treat
* it as opt-in: only push this line in layouts that have room for a
* second markdown line below the tally. Returns the code-fenced
* single-line legend `` `* = filtered by threshold` `` — code-fenced
* (not italic) so the `*` doesn't need a backslash escape on either
* GitHub or Azure DevOps, and short enough to fit below the tally
* without breaking table-cell / bullet contexts.
*/
function severityTallyLegend(data) {
	if (filteredTiers(data).size === 0) return "";
	return "`* = filtered by threshold`";
}
/** Severity tally line used by most layouts. */
function severityTally(data) {
	const filtered = filteredTiers(data);
	const parts = [];
	let total = 0;
	for (const level of SEVERITY_ORDER) {
		const count = data.severityCounts[level] ?? 0;
		total += count;
		const mark = filtered.has(level) ? "*" : "";
		parts.push(`\`${count}\` ${level}${mark}`);
	}
	if (total === 0) return "";
	return `🏷️ ${parts.join(" · ")}`;
}
/**
* Append the canonical "provider summary" section to `parts` when the
* review has a non-empty summary. Every layout wants this section —
* the variation is purely cosmetic (heading emoji + label, and whether
* to wrap in blockquote or render inline). When `heading` is `null`,
* no `###` line is emitted (callers like `dashboard` render the summary
* inside their own wrapper). When `blockquote` is true, every line of
* the summary is prefixed with `> ` so it renders as a single blockquote
* — used by `dashboard` to keep the summary visually separated from the
* KPI tiles above it.
*
* Output is byte-identical to the previous inline form
*   if (data.review.summary.trim().length > 0) {
*     parts.push(`### ${heading}`); parts.push("");
*     parts.push(redact(data.review.summary, data.secrets));
*     parts.push("");
*   }
* for the 14 layouts that use this shape (8 default + 5 custom-heading
* variants + 1 blockquote variant). Two layouts have unique rendering
* needs that the helper doesn't fit and stay inline:
*   - `severity-table` wraps verbose summaries in a `<details>` block.
*   - `faq` renders the summary as `### Q: ...?` + `**A:** ...`.
*/
function summarySection(data, parts, options = {}) {
	if (data.review.summary.trim().length === 0) return;
	const safeSummary = redact(data.review.summary, data.secrets);
	const heading = options.heading ?? "### 💬 Summary";
	if (heading !== null) {
		parts.push(heading);
		parts.push("");
	}
	if (options.blockquote === true) parts.push(`> ${safeSummary.split("\n").join("\n> ")}`);
	else parts.push(safeSummary);
	parts.push("");
}
/**
* Canonical parse-fail banner string — the blockquote that a layout
* emits immediately after the verdict badge when the provider returned
* a non-JSON / unparseable response. CLARITY-10 invariant: the banner
* must be unmistakable so a 0-finding review cannot be confused with
* a clean bill of health. Used by `layoutBaseline` and
* `layoutSeverityTable` (the only two layouts that render this banner;
* the other 18 layouts rely on `pipelineLine` + `severityTally` being
* empty when parse-failed and skip the banner entirely).
*/
const PARSE_FAILED_BANNER = "> ⚠️ `Parse failed` — provider response was not a valid JSON review payload. The raw provider text is included in the Summary section below for diagnostics.";
/** Compose the standard footer line. */
function footer(data) {
	return `🤖 Generated by \`${redact(data.modelId, data.secrets)}\` via \`${redact(data.provider, data.secrets)}\` · ${data.validCommentCount} inline`;
}
/** Sort posted comments by severity desc, then path asc — same invariant the existing code uses. */
function sortedPosted(data) {
	return [...data.postedComments].sort((a, b) => {
		const ra = severityRank(a.severity);
		const rb = severityRank(b.severity);
		if (ra !== rb) return rb - ra;
		return a.path.localeCompare(b.path);
	});
}
/**
* Append the canonical trailer (horizontal rule, `footer`, marker, manifest)
* to `parts` and return the joined string. Every replacement layout in
* `LAYOUT_RENDERERS` ends with this exact sequence — it is the contract
* that keeps dedup loops and the AI manifest parser happy:
*   1. `<!-- umactually -->` marker (dedup key)
*   2. Stable hidden manifest with verdict + severity tally
*   3. `🤖 Generated by ...` footer at the bottom for human readers
*
* NOT used by `layoutBaseline` — the baseline reproduces the legacy
* `buildReviewBody` byte-for-byte, which puts the marker at the TOP
* and uses no horizontal rule.
*
* Output is byte-identical to the previous hand-rolled trailer.
*/
function closeReviewBlock(data, parts) {
	parts.push("---");
	parts.push(footer(data));
	parts.push("");
	parts.push(REVIEW_MARKER);
	parts.push(manifest(data));
	return parts.join("\n");
}
function layoutDashboard(data) {
	const verdict = verdictBadge(data);
	const tally = severityTally(data);
	const total = totalFindings(data);
	const posted = data.validCommentCount;
	const offDiff = offDiffCount(data);
	const filtered = filteredCount(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📊 Review dashboard");
	parts.push("");
	parts.push("| Verdict | Findings | Posted | Off-diff | Filtered |");
	parts.push("| :--- | ---: | ---: | ---: | ---: |");
	parts.push(`| **${verdict}** | **${total}** | **${posted}** | **${offDiff}** | **${filtered}** |`);
	parts.push("");
	if (tally.length > 0) {
		parts.push("### 🏷️ Severity breakdown");
		parts.push("");
		parts.push("| Critical | High | Medium | Low |");
		parts.push("| ---: | ---: | ---: | ---: |");
		const c = data.severityCounts["critical"] ?? 0;
		const h = data.severityCounts["high"] ?? 0;
		const m = data.severityCounts["medium"] ?? 0;
		const l = data.severityCounts["low"] ?? 0;
		parts.push(`| **${c}** | **${h}** | **${m}** | **${l}** |`);
		parts.push("");
	}
	if (data.postedComments.length > 0) {
		parts.push("### 🔝 Top findings");
		parts.push("");
		sortedPosted(data).slice(0, 5).forEach((c, i) => {
			parts.push(findingsDetailsRow(i + 1, c, data.secrets, 80));
		});
		parts.push("");
	}
	summarySection(data, parts, {
		heading: null,
		blockquote: true
	});
	return closeReviewBlock(data, parts);
}
function layoutPipeline(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 🔄 Review pipeline");
	parts.push("");
	parts.push("```text");
	parts.push("┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐");
	parts.push("│  Provider    │──▶│  Redaction   │──▶│   Review     │──▶│  Filter &    │");
	parts.push(`│  ${(redact(data.provider, data.secrets) || "?").padEnd(10)} │   │  scan: diff  │   │  model: ok   │   │  post: ${data.validCommentCount}    │`);
	parts.push("└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘");
	parts.push("```");
	parts.push("");
	parts.push("### 🪜 Steps in this run");
	parts.push("");
	parts.push(`> **①  Provider request** — sent to \`${redact(data.provider, data.secrets)}\`.`);
	parts.push(">");
	parts.push(`> **②  Secret scan** — redaction pass on the diff before it reached the model.`);
	parts.push(">");
	parts.push(`> **③  Model review** — \`${redact(data.modelId, data.secrets)}\` returned \`${data.review.verdict}\`.`);
	parts.push(">");
	parts.push(`> **④  Filter** — severity policy + \`max-comments\` cap + off-diff suppression.`);
	parts.push(">");
	parts.push(`> **⑤  Post** — ${data.validCommentCount} of ${totalFindings(data)} findings posted as inline threads.`);
	parts.push("");
	if (data.validCommentCount > 0) {
		parts.push("### 🎯 Highest-priority items");
		parts.push("");
		sortedPosted(data).slice(0, 5).forEach((c, i) => {
			parts.push(`${i + 1}. ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** — ${findingLine(c, data.secrets)}`);
		});
		parts.push("");
	}
	return closeReviewBlock(data, parts);
}
function layoutVerdictBanner(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`# ${verdict}`);
	parts.push("");
	parts.push(`> ## ${verdict}`);
	parts.push(`>`);
	parts.push(`> **${data.validCommentCount}** findings to address · ${totalFindings(data)} total considered`);
	parts.push(`>`);
	parts.push(`> Model: \`${redact(data.modelId, data.secrets)}\` · Provider: \`${redact(data.provider, data.secrets)}\``);
	parts.push("");
	parts.push("### 📌 At a glance");
	parts.push("");
	parts.push("| Total | Posted | Off-diff | Filtered |");
	parts.push("| ---: | ---: | ---: | ---: |");
	parts.push(`| **${totalFindings(data)}** | **${data.validCommentCount}** | **${offDiffCount(data)}** | **${filteredCount(data)}** |`);
	parts.push("");
	const tally = severityTally(data);
	if (tally.length > 0) {
		parts.push(tally);
		const legend = severityTallyLegend(data);
		if (legend.length > 0) parts.push(legend);
		parts.push("");
	}
	if (data.postedComments.length > 0) {
		parts.push("### 📋 Findings to address");
		parts.push("");
		sortedPosted(data).slice(0, 5).forEach((c, i) => {
			const snippet = truncateSnippet(collapseBody(c, data.secrets), 90);
			parts.push(`${i + 1}. ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
		});
		parts.push("");
	}
	summarySection(data, parts, { heading: "### 💬 Provider summary" });
	return closeReviewBlock(data, parts);
}
function layoutSeverityTable(data) {
	const verdict = verdictBadge(data);
	const all = sortedPosted(data);
	const parts = [];
	parts.push(REVIEW_MARKER);
	parts.push("");
	parts.push(`## ${verdict}`);
	parts.push("");
	if (data.review.parseFailed === true) {
		parts.push(PARSE_FAILED_BANNER);
		parts.push("");
	} else {
		parts.push(pipelineLine(data));
		const tally = severityTally(data);
		if (tally.length > 0) {
			parts.push(tally);
			const legend = severityTallyLegend(data);
			if (legend.length > 0) parts.push(legend);
		}
		parts.push("");
	}
	parts.push("### 📋 Findings");
	parts.push("");
	if (all.length === 0) {
		parts.push("_No findings to address._");
		parts.push("");
	} else {
		all.forEach((c, i) => {
			parts.push(findingsDetailsRow(i + 1, c, data.secrets, 80));
		});
		parts.push("");
	}
	if (data.review.summary.trim().length > 0) {
		const safeSummary = redact(data.review.summary, data.secrets);
		if (safeSummary.length > 500) {
			parts.push("### 📝 Summary");
			parts.push("");
			parts.push("<details>");
			parts.push("<summary>📝 Click to expand the full review summary</summary>");
			parts.push("");
			parts.push(safeSummary);
			parts.push("");
			parts.push("</details>");
			parts.push("");
		} else {
			parts.push("### 📝 Summary");
			parts.push("");
			parts.push(safeSummary);
			parts.push("");
		}
	}
	parts.push("---");
	parts.push(footer(data));
	parts.push("");
	parts.push(manifest(data));
	return parts.join("\n");
}
function layoutCardGrid(data) {
	const verdict = verdictBadge(data);
	const buckets = {
		critical: [],
		high: [],
		medium: [],
		low: []
	};
	for (const c of data.postedComments) {
		const target = buckets[c.severity.toLowerCase()] ?? buckets["low"];
		if (target !== void 0) target.push(c);
	}
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 🎴 Findings by severity");
	parts.push("");
	for (const level of SEVERITY_ORDER) {
		const bucket = buckets[level] ?? [];
		if (bucket.length === 0) continue;
		parts.push(`#### ${severityEmoji(level)} ${severityLabel(level)} — ${bucket.length} finding${bucket.length === 1 ? "" : "s"}`);
		parts.push("");
		for (const c of bucket) {
			const title = collapseBody(c, data.secrets);
			parts.push(`> **\`${cell(c.path)}\`:${c.line}** — ${cell(title)}`);
			parts.push("");
		}
	}
	if (data.postedComments.length === 0) {
		parts.push("> _No findings to address._");
		parts.push("");
	}
	return closeReviewBlock(data, parts);
}
function layoutTldrWalkthrough(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📌 TL;DR");
	parts.push("");
	parts.push(`> ${verdict}. **${data.validCommentCount}** of **${totalFindings(data)}** findings posted inline.`);
	parts.push(">");
	if (data.postedComments.length > 0) parts.push(`> Top concern: ${findingLine(sortedPosted(data)[0], data.secrets)}`);
	else parts.push("> No actionable concerns surfaced.");
	parts.push("");
	const sortedFiles = groupByFile(data.postedComments);
	if (sortedFiles.length > 0) {
		parts.push("### 📂 Files touched");
		parts.push("");
		for (const [path, comments] of sortedFiles) {
			parts.push(`#### \`${cell(path)}\` — ${comments.length} finding${comments.length === 1 ? "" : "s"}`);
			parts.push("");
			for (const c of comments) {
				const title = collapseBody(c, data.secrets);
				parts.push(`- ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** (line ${c.line}) — ${cell(title)}`);
			}
			parts.push("");
		}
	}
	summarySection(data, parts, { heading: "### 💬 Full summary" });
	return closeReviewBlock(data, parts);
}
function layoutChecklist(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### ✅ Review checklist");
	parts.push("");
	const byCat = /* @__PURE__ */ new Map();
	for (const c of data.postedComments) {
		const key = c.category || "general";
		const arr = byCat.get(key) ?? [];
		arr.push(c);
		byCat.set(key, arr);
	}
	const sortedCats = [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b));
	for (const [cat, comments] of sortedCats) {
		parts.push(`#### 📦 ${cat} (${comments.length})`);
		parts.push("");
		for (const c of comments) {
			const snippet = truncateSnippet(collapseBody(c, data.secrets), 90);
			parts.push(`- ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
		}
		parts.push("");
	}
	if (sortedCats.length === 0) {
		parts.push("> _No findings to address._");
		parts.push("");
	}
	const tally = severityTally(data);
	if (tally.length > 0) {
		parts.push(tally);
		const legend = severityTallyLegend(data);
		if (legend.length > 0) parts.push(legend);
		parts.push("");
	}
	return closeReviewBlock(data, parts);
}
function layoutProgressBars(data) {
	const verdict = verdictBadge(data);
	const total = data.validCommentCount;
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📊 Severity distribution");
	parts.push("");
	const max = Math.max(1, ...SEVERITY_ORDER.map((l) => data.severityCounts[l] ?? 0));
	for (const level of SEVERITY_ORDER) {
		const count = data.severityCounts[level] ?? 0;
		const filled = Math.round(count / max * 20);
		const empty = 20 - filled;
		const bar = "█".repeat(filled) + "░".repeat(empty);
		const pct = total === 0 ? "0%" : `${Math.round(count / total * 100)}%`;
		parts.push(`\`${level.padEnd(8)} ${bar} ${String(count).padStart(3)} ${pct.padStart(4)}\``);
	}
	parts.push("");
	parts.push("### 📋 Findings");
	parts.push("");
	if (data.postedComments.length === 0) parts.push("> _No findings to address._");
	else sortedPosted(data).slice(0, 5).forEach((c, i) => {
		parts.push(`${i + 1}. ${severityEmoji(c.severity)} ${findingLine(c, data.secrets)}`);
	});
	parts.push("");
	summarySection(data, parts);
	return closeReviewBlock(data, parts);
}
function layoutProsCons(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### ⚖️ Strengths vs concerns");
	parts.push("");
	const concerns = sortedPosted(data);
	const lowCount = data.severityCounts["low"] ?? 0;
	const highCount = (data.severityCounts["high"] ?? 0) + (data.severityCounts["critical"] ?? 0);
	parts.push("| ✅ Strengths | ⚠️ Concerns |");
	parts.push("| :--- | :--- |");
	const strengthsMd = totalFindings(data) === 0 ? "_No issues found — clean review._" : `_Reviewed **${totalFindings(data)}** finding${totalFindings(data) === 1 ? "" : "s"} across the diff. Severity tally: ${severityTally(data) || "all clear"}._`;
	const concernsMd = concerns.length === 0 ? "_None._" : concerns.slice(0, 5).map((c) => `**${severityLabel(c.severity)}** — ${findingLine(c, data.secrets)}`).join("<br>");
	parts.push(`| ${strengthsMd} | ${concernsMd} |`);
	parts.push("");
	if (lowCount + highCount > 0) {
		parts.push("### 📊 Tally");
		parts.push("");
		parts.push(severityTally(data));
		const legend = severityTallyLegend(data);
		if (legend.length > 0) parts.push(legend);
		parts.push("");
	}
	summarySection(data, parts);
	return closeReviewBlock(data, parts);
}
function layoutTweet(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push(`> ## ${verdict}`);
	parts.push(">");
	parts.push(`> **${data.validCommentCount}** finding${data.validCommentCount === 1 ? "" : "s"} posted inline out of **${totalFindings(data)}** total.`);
	parts.push(">");
	parts.push(`> Powered by \`${redact(data.modelId, data.secrets)}\` via \`${redact(data.provider, data.secrets)}\`.`);
	parts.push("");
	parts.push("### 💡 What this means");
	parts.push("");
	const tally = severityTally(data);
	if (tally.length > 0) parts.push(`- ${tally}`);
	if (data.postedComments.length > 0) parts.push(`- Top priority: ${findingLine(sortedPosted(data)[0], data.secrets)}`);
	else parts.push("- ✅ No actionable concerns.");
	if (filteredCount(data) > 0) parts.push(`- 🧹 ${filteredCount(data)} filtered by severity policy or \`max-comments\` cap.`);
	parts.push("");
	summarySection(data, parts, { heading: "### 📖 Story" });
	return closeReviewBlock(data, parts);
}
function layoutFaq(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### ❓ Reviewer Q&A");
	parts.push("");
	if (data.postedComments.length === 0) {
		parts.push("> _No findings to address — review passed clean._");
		parts.push("");
	} else sortedPosted(data).slice(0, 5).forEach((c, i) => {
		const title = collapseBody(c, data.secrets);
		parts.push(`### Q${i + 1}: What's wrong at \`${cell(c.path)}\`:${c.line}?`);
		parts.push("");
		parts.push(`**A:** ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** (${cell(c.category)}). ${cell(title)}`);
		parts.push("");
	});
	parts.push("### Q: What's the overall verdict?");
	parts.push("");
	parts.push(`**A:** ${verdict}. ${data.validCommentCount} posted of ${totalFindings(data)} total.`);
	parts.push("");
	if (data.review.summary.trim().length > 0) {
		parts.push("### Q: Anything else worth noting?");
		parts.push("");
		parts.push(`**A:** ${redact(data.review.summary, data.secrets)}`);
		parts.push("");
	}
	return closeReviewBlock(data, parts);
}
function layoutTerminal(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 🖥️ Terminal report");
	parts.push("");
	parts.push("```text");
	parts.push("┌──────────────────────────────────────────────────────────┐");
	parts.push(`│ ${BRAND} · ${verdict.padEnd(36)} │`);
	parts.push("├──────────────────────────────────────────────────────────┤");
	parts.push(`│ Provider : ${(redact(data.provider, data.secrets) || "?").padEnd(45)} │`);
	parts.push(`│ Model    : ${(redact(data.modelId, data.secrets) || "?").padEnd(45)} │`);
	parts.push(`│ Total    : ${String(totalFindings(data)).padEnd(45)} │`);
	parts.push(`│ Posted   : ${String(data.validCommentCount).padEnd(45)} │`);
	parts.push(`│ Off-diff : ${String(offDiffCount(data)).padEnd(45)} │`);
	parts.push(`│ Filtered : ${String(filteredCount(data)).padEnd(45)} │`);
	parts.push("└──────────────────────────────────────────────────────────┘");
	parts.push("");
	parts.push("[Findings by severity]");
	for (const level of SEVERITY_ORDER) {
		const count = data.severityCounts[level] ?? 0;
		const bar = "■".repeat(count) + "□".repeat(Math.max(0, 10 - count));
		parts.push(`  ${level.padEnd(8)} ${bar} (${String(count).padStart(3)})`);
	}
	if (data.postedComments.length > 0) {
		parts.push("");
		parts.push("[Top 5 posted]");
		sortedPosted(data).slice(0, 5).forEach((c, i) => {
			parts.push(`  ${String(i + 1).padStart(2)}. ${c.severity.padEnd(8)} ${cell(c.path)}:${c.line}`);
		});
	}
	parts.push("```");
	parts.push("");
	summarySection(data, parts);
	return closeReviewBlock(data, parts);
}
function layoutIncident(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📟 Incident report");
	parts.push("");
	const severityWord = data.validCommentCount === 0 ? "✅ None" : (data.severityCounts["critical"] ?? 0) > 0 ? "🟣 Critical" : (data.severityCounts["high"] ?? 0) > 0 ? "🔴 High" : (data.severityCounts["medium"] ?? 0) > 0 ? "🟠 Medium" : "🟡 Low";
	parts.push(`**Status:** ${verdict}  &nbsp;&nbsp;  **Severity:** ${severityWord}  &nbsp;&nbsp;  **Findings:** ${data.validCommentCount} of ${totalFindings(data)}`);
	parts.push("");
	parts.push("### ⏱️ Timeline of this review run");
	parts.push("");
	parts.push("| Step | Event |");
	parts.push("| :--- | :--- |");
	parts.push(`| ① | 🟢 Diff fetched from \`${redact(data.provider, data.secrets)}\` PR source. |`);
	parts.push(`| ② | 🔒 Secret scan ran — ${data.validCommentCount > 0 ? "diff redacted before model submission" : "no high-confidence secrets detected"}. |`);
	parts.push(`| ③ | 🤖 Model \`${redact(data.modelId, data.secrets)}\` returned \`${data.review.verdict}\`. |`);
	parts.push(`| ④ | 🧹 Filter pass: severity policy + \`max-comments\` cap. |`);
	parts.push(`| ⑤ | 📤 ${data.validCommentCount} inline thread${data.validCommentCount === 1 ? "" : "s"} posted. |`);
	parts.push("");
	parts.push("### 🎯 Impact");
	parts.push("");
	if (data.postedComments.length > 0) sortedPosted(data).slice(0, 5).forEach((c, i) => {
		parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
	});
	else parts.push("- ✅ No blocking findings.");
	parts.push("");
	summarySection(data, parts, { heading: "### 💬 Provider summary" });
	return closeReviewBlock(data, parts);
}
function layoutReleaseNotes(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📝 Review changelog");
	parts.push("");
	const buckets = {
		"🔴 Fixes (critical+)": [],
		"🟠 Improvements (medium)": [],
		"🟡 Style (low)": []
	};
	const SEVERITY_RANK_TO_BUCKET = {
		6: "🔴 Fixes (critical+)",
		5: "🔴 Fixes (critical+)",
		4: "🔴 Fixes (critical+)",
		3: "🔴 Fixes (critical+)",
		2: "🟠 Improvements (medium)",
		1: "🟡 Style (low)",
		0: "🟡 Style (low)"
	};
	for (const c of data.postedComments) buckets[SEVERITY_RANK_TO_BUCKET[severityRank(c.severity)] ?? "🟡 Style (low)"].push(c);
	for (const [header, list] of Object.entries(buckets)) {
		if (list.length === 0) continue;
		parts.push(`### ${header}`);
		parts.push("");
		list.forEach((c, i) => {
			const snippet = truncateSnippet(collapseBody(c, data.secrets), 80);
			parts.push(`- **${cell(c.path)}:${c.line}** — ${cell(snippet)}`);
			if (i === list.length - 1) parts.push("");
		});
	}
	if (data.postedComments.length === 0) {
		parts.push("### ✅ No changes required");
		parts.push("");
		parts.push("- Review passed clean — ship it.");
		parts.push("");
	}
	summarySection(data, parts, { heading: "### 📖 Notes" });
	return closeReviewBlock(data, parts);
}
function layoutCoverage(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 🧪 File-by-file review");
	parts.push("");
	const sortedFiles = groupByFile(data.postedComments);
	parts.push("| File | Findings | Status |");
	parts.push("| :--- | ---: | :---: |");
	if (sortedFiles.length === 0) parts.push("| _all files_ | **0** | ✅ Pass |");
	else for (const [path, comments] of sortedFiles) {
		const worst = Math.max(...comments.map((c) => severityRank(c.severity)));
		const status = worst >= 3 ? "🔴" : worst === 2 ? "🟠" : worst === 1 ? "🟡" : "⚪";
		parts.push(`| \`${cell(path)}\` | **${comments.length}** | ${status} |`);
	}
	parts.push("");
	parts.push("### 📋 Detail");
	parts.push("");
	if (sortedFiles.length === 0) parts.push("> _No findings to address._");
	else for (const [path, comments] of sortedFiles) {
		parts.push(`#### \`${cell(path)}\``);
		parts.push("");
		for (const c of comments) parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${collapseBody(c, data.secrets)}`);
		parts.push("");
	}
	summarySection(data, parts);
	return closeReviewBlock(data, parts);
}
function layoutThermometer(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 🌡️ Risk thermometer");
	parts.push("");
	const total = data.validCommentCount;
	const c = data.severityCounts["critical"] ?? 0;
	const h = data.severityCounts["high"] ?? 0;
	const m = data.severityCounts["medium"] ?? 0;
	const l = data.severityCounts["low"] ?? 0;
	const ratio = total === 0 ? 0 : Math.min(1, (c * 4 + h * 3 + m * 2 + l * 1) / Math.max(1, total * 4));
	parts.push("```text");
	parts.push("       🟣 Critical  ┌──┐");
	parts.push("                    │" + "█".repeat(Math.round(c * 2)).padEnd(10, " ") + "│ " + String(c).padStart(3));
	parts.push("       🔴 High      │  │");
	parts.push("                    │" + "█".repeat(Math.round(h * 2)).padEnd(10, " ") + "│ " + String(h).padStart(3));
	parts.push("       🟠 Medium    │  │");
	parts.push("                    │" + "█".repeat(Math.round(m * 2)).padEnd(10, " ") + "│ " + String(m).padStart(3));
	parts.push("       🟡 Low       │  │");
	parts.push("                    │" + "█".repeat(Math.round(l * 2)).padEnd(10, " ") + "│ " + String(l).padStart(3));
	parts.push("                    └──┘");
	parts.push("                     0  " + Math.round(ratio * 100) + "%");
	parts.push("```");
	parts.push("");
	parts.push("### 📋 Findings");
	parts.push("");
	if (data.postedComments.length === 0) parts.push("> _No findings._");
	else sortedPosted(data).slice(0, 5).forEach((c, i) => {
		parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
	});
	parts.push("");
	summarySection(data, parts);
	return closeReviewBlock(data, parts);
}
function layoutStatusPage(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📡 Status page");
	parts.push("");
	const banner = data.validCommentCount === 0 ? "✅ All clear — no findings" : (data.severityCounts["critical"] ?? 0) > 0 ? "🟣 Critical findings reported" : (data.severityCounts["high"] ?? 0) > 0 ? "🔴 High severity findings reported" : (data.severityCounts["medium"] ?? 0) > 0 ? "🟠 Medium severity findings reported" : "🟡 Low severity findings reported";
	parts.push(`> ## ${banner}`);
	parts.push(">");
	parts.push(`> Last updated by \`${redact(data.modelId, data.secrets)}\` via \`${redact(data.provider, data.secrets)}\``);
	parts.push("");
	parts.push("### 🧩 Components");
	parts.push("");
	parts.push("| Component | Status | Details |");
	parts.push("| :--- | :---: | :--- |");
	parts.push(`| Diff fetch | ✅ Operational | Provider \`${cell(redact(data.provider, data.secrets))}\` responded. |`);
	parts.push(`| Secret scan | ✅ Operational | Redaction pass complete. |`);
	parts.push(`| Model review | ${data.review.parseFailed === true ? "🔴 Degraded" : "✅ Operational"} | \`${cell(redact(data.modelId, data.secrets))}\` verdict: \`${data.review.verdict}\`. |`);
	parts.push(`| Filter & post | ${data.validCommentCount === 0 ? "🟡 No-op" : "✅ Operational"} | ${data.validCommentCount} of ${totalFindings(data)} posted. |`);
	parts.push("");
	if (data.postedComments.length > 0) {
		parts.push("### ⚠️ Active incidents");
		parts.push("");
		sortedPosted(data).slice(0, 5).forEach((c, i) => {
			parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
		});
		parts.push("");
	}
	summarySection(data, parts, { heading: "### 📝 Notes" });
	return closeReviewBlock(data, parts);
}
function layoutDiffstat(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📊 Review diffstat");
	parts.push("");
	const sortedFiles = groupByFile(data.postedComments);
	const max = Math.max(1, ...sortedFiles.map(([, v]) => v.length));
	parts.push("```text");
	if (sortedFiles.length === 0) parts.push("(no findings)");
	else {
		const pathWidth = Math.max(8, ...sortedFiles.map(([p]) => p.length));
		for (const [path, comments] of sortedFiles) {
			const filled = Math.round(comments.length / max * 24);
			const bar = "█".repeat(filled) + "░".repeat(24 - filled);
			parts.push(`  ${path.padEnd(pathWidth)} │ ${bar} ${String(comments.length).padStart(3)}`);
		}
	}
	parts.push("```");
	parts.push("");
	if (sortedFiles.length > 0) {
		parts.push("### 🔎 Detail");
		parts.push("");
		for (const [path, comments] of sortedFiles) {
			parts.push(`#### \`${cell(path)}\``);
			parts.push("");
			for (const c of comments) parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${collapseBody(c, data.secrets)}`);
			parts.push("");
		}
	} else {
		parts.push("> _No findings to address._");
		parts.push("");
	}
	summarySection(data, parts);
	return closeReviewBlock(data, parts);
}
function layoutStickyNotes(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`## ${verdict}`);
	parts.push("");
	parts.push("### 📌 Sticky notes");
	parts.push("");
	if (data.postedComments.length === 0) {
		parts.push("> 📌 _No sticky notes — review passed clean._");
		parts.push("");
	} else {
		sortedPosted(data).slice(0, 6).forEach((c) => {
			const snippet = truncateSnippet(collapseBody(c, data.secrets), 200);
			parts.push(">");
			parts.push(`> 📌 **${severityLabel(c.severity)}** — \`${cell(c.path)}\`:${c.line}`);
			parts.push(">");
			parts.push(`> ${cell(snippet)}`);
			parts.push(">");
		});
		if (data.postedComments.length > 6) parts.push(`> _…and ${data.postedComments.length - 6} more._`);
		parts.push("");
	}
	const tally = severityTally(data);
	if (tally.length > 0) {
		parts.push(tally);
		const legend = severityTallyLegend(data);
		if (legend.length > 0) parts.push(legend);
		parts.push("");
	}
	summarySection(data, parts);
	return closeReviewBlock(data, parts);
}
function layoutNewspaper(data) {
	const verdict = verdictBadge(data);
	const parts = [];
	parts.push(`# ${verdict}`);
	parts.push("");
	parts.push(`### *${data.validCommentCount} of ${totalFindings(data)} findings posted; review model: \`${redact(data.modelId, data.secrets)}\`*`);
	parts.push("");
	if (data.postedComments.length > 0) {
		parts.push("> ## Top story");
		parts.push(">");
		const top = sortedPosted(data)[0];
		const topTitle = redact(top.body, data.secrets).replace(/\s+/gu, " ").trim();
		parts.push(`> **${severityLabel(top.severity)}** at \`${cell(top.path)}\`:${top.line}.`);
		parts.push(">");
		parts.push(`> ${cell(topTitle)}`);
		parts.push("");
	}
	parts.push("### The rundown");
	parts.push("");
	if (data.postedComments.length === 0) parts.push("_No findings to address._");
	else sortedPosted(data).slice(0, 6).forEach((c, i) => {
		const snippet = truncateSnippet(collapseBody(c, data.secrets), 140);
		parts.push(`**${i + 1}.** ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
	});
	parts.push("");
	if (data.review.summary.trim().length > 0) {
		parts.push("### Editor's note");
		parts.push("");
		parts.push(redact(data.review.summary, data.secrets));
		parts.push("");
	}
	const tally = severityTally(data);
	if (tally.length > 0) {
		parts.push("### By the numbers");
		parts.push("");
		parts.push(tally);
		const legend = severityTallyLegend(data);
		if (legend.length > 0) parts.push(legend);
		parts.push("");
	}
	return closeReviewBlock(data, parts);
}
const LAYOUT_RENDERERS = {
	"dashboard": layoutDashboard,
	"pipeline": layoutPipeline,
	"verdict-banner": layoutVerdictBanner,
	"severity-table": layoutSeverityTable,
	"card-grid": layoutCardGrid,
	"tldr-walkthrough": layoutTldrWalkthrough,
	"checklist": layoutChecklist,
	"progress-bars": layoutProgressBars,
	"pros-cons": layoutProsCons,
	"tweet": layoutTweet,
	"faq": layoutFaq,
	"terminal": layoutTerminal,
	"incident": layoutIncident,
	"release-notes": layoutReleaseNotes,
	"coverage": layoutCoverage,
	"thermometer": layoutThermometer,
	"status-page": layoutStatusPage,
	"diffstat": layoutDiffstat,
	"sticky-notes": layoutStickyNotes,
	"newspaper": layoutNewspaper
};
/**
* Render a review summary using one of the 20 replacement layouts.
*
* @param layout  Layout identifier (see {@link LayoutId}).
* @param data    Review data shape; same inputs as the existing
*                `buildReviewBody` in `src/cli/live-shared.ts`.
* @returns Markdown body string safe to post to GitHub PR reviews
*          and Azure DevOps PR threads.
*/
function renderSummary(layout, data) {
	if (data.postedComments === void 0) throw new Error("renderSummary: data.postedComments is required (was undefined). Use buildReviewBody() to dispatch — it computes the post-filter set from review.comments.");
	const renderer = LAYOUT_RENDERERS[layout];
	if (renderer === void 0) throw new Error(`Unknown layout: ${layout}`);
	return renderer(data);
}
//#endregion
//#region src/config/severity.ts
/**
* True when `severity` is at least as severe as `minimum`. Delegates
* to the canonical `severityRank` so the comparison cannot drift from
* the live-path filter or the merge-path ranking.
*/
function isSeverityAtLeast(minimum, severity) {
	return severityRank(severity) >= severityRank(minimum);
}
/**
* Decides whether a finding should be kept under the configured minimum
* severity threshold.
*
* Security policy invariant: `security` and `leak` findings ALWAYS survive
* any threshold, even when the configured minimum would otherwise filter them.
*/
function shouldKeepFinding(controls, finding) {
	if (finding === "security" || finding === "leak") return true;
	return isSeverityAtLeast(controls.minimum, finding);
}
//#endregion
//#region src/render/json-extract.ts
/**
* Valid JSON escape characters (the second character after `\`).
* Any other character following `\` inside a JSON string is an invalid
* escape sequence and will cause JSON.parse to reject the document
* with "Bad escaped character in JSON". Models writing prose (especially
* markdown) frequently produce stray `\X` sequences inside JSON string
* fields — `\`` (escaped backtick, common in shell contexts), `\.`,
* `\:`, `\,`, `\'`, etc. None of these are valid JSON escapes.
*/
const VALID_JSON_ESCAPE_CHARS = /* @__PURE__ */ new Set([
	"\"",
	"\\",
	"/",
	"b",
	"f",
	"n",
	"r",
	"t",
	"u"
]);
/**
* True when `substring[index..index+4]` is exactly 4 ASCII hex digits
* (0-9, a-f, A-F). Used to validate `\uXXXX` unicode escapes — JSON.parse
* requires exactly 4 hex digits and rejects `\u` followed by anything
* else with "Bad Unicode escape in JSON".
*
* Returns false if the substring ends before index+4 (truncated input
* is also a parse failure).
*/
function isHexQuadAt(substring, index) {
	if (index + 4 > substring.length) return false;
	for (let i = 0; i < 4; i += 1) {
		const c = substring.charCodeAt(index + i);
		if (!(c >= 48 && c <= 57) && !(c >= 97 && c <= 102) && !(c >= 65 && c <= 70)) return false;
	}
	return true;
}
/**
* Extract the most likely JSON payload from a provider text response.
*
* Order of attempts (mirrors the fence-closure guard in src/render/raw-output.ts):
*   1. The whole text, parsed as JSON.
*   2. A ```json ... ``` fence body, parsed as JSON.
*   3. The first balanced { ... } object, parsed as JSON — with control
*      characters inside JSON strings escaped to make the substring
*      valid JSON (see `extractFirstBalancedObject`).
*
* Returns the parsed value when one of the attempts succeeds, otherwise null.
* The whole text is always returned to the caller via `extractJsonBlock` so they
* can decide what to do with raw context on failure (see renderRawReviewFallback).
*/
function extractJsonBlock(rawText) {
	const wholeAttempt = tryParseJson(rawText);
	if (wholeAttempt !== void 0) return wholeAttempt;
	const fencedAttempt = tryParseJson(repairJsonStringLiterals(extractJsonFenceBody(rawText)));
	if (fencedAttempt !== void 0) return fencedAttempt;
	const balanced = extractFirstBalancedObject(rawText);
	if (balanced !== null) {
		const balancedAttempt = tryParseJson(balanced);
		if (balancedAttempt !== void 0) return balancedAttempt;
		else if (isDebugRawActive()) try {
			JSON.parse(balanced);
		} catch (e) {
			process.stderr.write(`[DEBUG-RAW] balanced-parse failed at length ${balanced.length}: ${e instanceof Error ? e.message : String(e)}\n`);
		}
	}
	return null;
}
/**
* Find the body of a ```...``` fence (with or without a language tag),
* or return the original text when none. Exposed so callers can reuse
* the fence-closure guard from raw-output.ts.
*
* Accepts any opening fence (```` ```json ````, ```` ```json5 ````, or just
* ```` ``` ````) because the model sometimes drops the language tag from
* markdown code blocks wrapping a JSON payload. The matching closing
* fence is found lazily after the first newline, so the body's content
* is captured verbatim including internal whitespace and newlines.
*
* Two newline shapes are accepted at the fence boundaries:
*   1. Real newlines (0x0A) — the response arrived as a raw markdown
*      block outside any JSON envelope.
*   2. JSON-escaped `\n` (the 2-char sequence backslash + n) — the
*      response arrived as a string value inside a JSON envelope (e.g.
*      an SSE `response.output_text.delta` event). The model wrote the
*      fence boundaries using JSON-escaped newlines because the entire
*      response was itself a JSON string. The first regex (real newlines)
*      does NOT match this shape; without the second regex, the fence
*      body would not be extracted and the parser would fall through to
*      the balanced-object fallback, which can return null on long
*      payloads (regression observed 2026-07-05T23:59:46Z, requestId
*      771a64b3). The two alternations are tried in order; the first
*      match wins.
*/
function extractJsonFenceBody(rawText) {
	const realNewline = /```[a-zA-Z0-9_+\-]*\s*\n([\s\S]*?)\n```/.exec(rawText);
	const escapedNewline = /```[a-zA-Z0-9_+\-]*\s*\\n([\s\S]*?)\\n```/u.exec(rawText);
	let body = realNewline?.[1] ?? escapedNewline?.[1];
	if (body !== void 0 && escapedNewline !== null && realNewline === null) try {
		body = JSON.parse("\"" + body.replace(/"/gu, "\\\"") + "\"");
	} catch {}
	if (body === void 0) return rawText;
	return repairJsonStringLiterals(body);
}
/**
* Locate the first balanced `{ ... }` object in `rawText`, respecting nested
* braces and quoted strings (including \" escapes). Returns null when no
* balanced object can be found.
*
* Returns a JSON-safe substring with two repairs applied:
*   1. Literal control characters inside JSON strings (`\n \r \t \b \f`)
*      are escaped to their 2-char JSON-escape equivalents. This handles
*      SSE delta concatenation, where each delta's `\n` was decoded
*      to a real newline when the SSE payload was JSON-parsed.
*   2. Stray `\X` sequences inside JSON strings where X is NOT a valid
*      JSON escape char (`"`/`\`/`/`/`b`/`f`/`n`/`r`/`t`/`u`) are
*      double-escaped so JSON.parse sees `\\X` → `\X` in the parsed
*      output. Models writing markdown prose sometimes produce
*      `` \` ``, `\:`, `\,`, `\.`, `\'` inside JSON body fields;
*      these would otherwise reject with "Bad escaped character in
*      JSON" (live evidence: PR #24 self-review run 28898948220,
*      body 20,691 chars, fail at position 13115).
*
* Newlines/tabs OUTSIDE strings (structural whitespace between fields) are
* preserved — they're already valid JSON whitespace.
*/
function extractFirstBalancedObject(rawText) {
	const startIndex = rawText.indexOf("{");
	if (startIndex === -1) return null;
	let depth = 0;
	let inString = false;
	let escape = false;
	let endIndex = -1;
	for (let index = startIndex; index < rawText.length; index += 1) {
		const char = rawText[index];
		if (inString) {
			if (escape) {
				escape = false;
				continue;
			}
			if (char === "\\") {
				escape = true;
				continue;
			}
			if (char === "\"") {
				const nextNonWs = peekNextNonWhitespace(rawText, index + 1);
				if (nextNonWs === -1 || nextNonWs === ",".charCodeAt(0) || nextNonWs === "}".charCodeAt(0) || nextNonWs === "]".charCodeAt(0) || nextNonWs === ":".charCodeAt(0)) inString = false;
				continue;
			}
			continue;
		}
		if (char === "\"") {
			inString = true;
			continue;
		}
		if (char === "{") {
			depth += 1;
			continue;
		}
		if (char === "}") {
			depth -= 1;
			if (depth === 0) {
				endIndex = index;
				break;
			}
		}
	}
	if (endIndex === -1) return null;
	const substring = rawText.slice(startIndex, endIndex + 1);
	const segments = [];
	inString = false;
	escape = false;
	for (let index = 0; index < substring.length; index += 1) {
		const char = substring.charAt(index);
		if (inString) {
			if (escape) {
				const isInvalidSingleChar = !VALID_JSON_ESCAPE_CHARS.has(char);
				const isInvalidUnicodeEscape = char === "u" && !isHexQuadAt(substring, index + 1);
				if (isInvalidSingleChar || isInvalidUnicodeEscape) segments.push("\\" + char);
				else segments.push(char);
				escape = false;
				continue;
			}
			if (char === "\\") {
				segments.push(char);
				escape = true;
				continue;
			}
			if (char === "\"") {
				const nextNonWs = peekNextNonWhitespace(substring, index + 1);
				if (nextNonWs === -1 || nextNonWs === ",".charCodeAt(0) || nextNonWs === "}".charCodeAt(0) || nextNonWs === "]".charCodeAt(0) || nextNonWs === ":".charCodeAt(0)) {
					segments.push(char);
					inString = false;
					continue;
				}
				segments.push("\\\"");
				continue;
			}
			if (char === "\n") {
				segments.push("\\n");
				continue;
			}
			if (char === "\r") {
				segments.push("\\r");
				continue;
			}
			if (char === "	") {
				segments.push("\\t");
				continue;
			}
			if (char === "\b") {
				segments.push("\\b");
				continue;
			}
			if (char === "\f") {
				segments.push("\\f");
				continue;
			}
			segments.push(char);
			continue;
		}
		if (char === "\"") inString = true;
		segments.push(char);
	}
	return segments.join("");
}
/**
* Walk `text` (a balanced JSON document — object or array) and return
* a JSON-safe copy where:
*   - literal control characters inside JSON strings (`\n \r \t \b \f`)
*     are escaped to their 2-char JSON-escape equivalents
*   - stray `\X` sequences inside JSON strings (where X is NOT a valid
*     JSON escape char: `"`, `\`, `/`, `b`, `f`, `n`, `r`, `t`, `u`)
*     are double-escaped so JSON.parse sees `\\X` → `\X` in the
*     parsed output. Without this, models writing markdown prose
*     that contains `\.`, `\:`, `\,`, `\'`, `` \` ``, etc. produce
*     valid JSON to a human reader but invalid JSON to JSON.parse,
*     which fails with "Bad escaped character in JSON" and triggers
*     the parse-fail fallback.
*   - stray `"` inside a string (model forgot to escape a quote) is
*     escaped to `\"` so JSON.parse keeps the string open and can
*     parse the outer object.
*
* Structural whitespace OUTSIDE strings (newlines/tabs between fields)
* is preserved unchanged — that's already valid JSON whitespace.
*
* Uses the same peek-ahead logic for stray-quote disambiguation as
* `extractFirstBalancedObject`'s second pass; in fact this helper is
* the same code, factored out so the fence-body path doesn't have to
* duplicate it.
*
* Returns `text` unchanged when it doesn't contain a balanced object
* or array — the caller can fall through to the balanced-object
* fallback.
*/
function repairJsonStringLiterals(text) {
	const startIndex = text.indexOf("{") === -1 ? text.indexOf("[") : text.indexOf("{");
	if (startIndex === -1) return text;
	let endIndex = -1;
	let depth = 0;
	let inString = false;
	let escape = false;
	for (let index = startIndex; index < text.length; index += 1) {
		const char = text[index];
		if (char === void 0) break;
		if (inString) {
			if (escape) {
				escape = false;
				continue;
			}
			if (char === "\\") {
				escape = true;
				continue;
			}
			if (char === "\"") {
				const nextNonWs = peekNextNonWhitespace(text, index + 1);
				if (nextNonWs === -1 || nextNonWs === ",".charCodeAt(0) || nextNonWs === "}".charCodeAt(0) || nextNonWs === "]".charCodeAt(0) || nextNonWs === ":".charCodeAt(0)) inString = false;
				continue;
			}
			continue;
		}
		if (char === "\"") {
			inString = true;
			continue;
		}
		if (char === "{" || char === "[") {
			depth += 1;
			continue;
		}
		if (char === "}" || char === "]") {
			depth -= 1;
			if (depth === 0) {
				endIndex = index;
				break;
			}
		}
	}
	if (endIndex === -1) return text;
	const substring = text.slice(startIndex, endIndex + 1);
	const segments = [];
	inString = false;
	escape = false;
	for (let index = 0; index < substring.length; index += 1) {
		const char = substring.charAt(index);
		if (inString) {
			if (escape) {
				const isInvalidSingleChar = !VALID_JSON_ESCAPE_CHARS.has(char);
				const isInvalidUnicodeEscape = char === "u" && !isHexQuadAt(substring, index + 1);
				if (isInvalidSingleChar || isInvalidUnicodeEscape) segments.push("\\" + char);
				else segments.push(char);
				escape = false;
				continue;
			}
			if (char === "\\") {
				segments.push(char);
				escape = true;
				continue;
			}
			if (char === "\"") {
				const nextNonWs = peekNextNonWhitespace(substring, index + 1);
				if (nextNonWs === -1 || nextNonWs === ",".charCodeAt(0) || nextNonWs === "}".charCodeAt(0) || nextNonWs === "]".charCodeAt(0) || nextNonWs === ":".charCodeAt(0)) {
					segments.push(char);
					inString = false;
					continue;
				}
				segments.push("\\\"");
				continue;
			}
			if (char === "\n") {
				segments.push("\\n");
				continue;
			}
			if (char === "\r") {
				segments.push("\\r");
				continue;
			}
			if (char === "	") {
				segments.push("\\t");
				continue;
			}
			if (char === "\b") {
				segments.push("\\b");
				continue;
			}
			if (char === "\f") {
				segments.push("\\f");
				continue;
			}
			segments.push(char);
			continue;
		}
		if (char === "\"") inString = true;
		segments.push(char);
	}
	return text.slice(0, startIndex) + segments.join("") + text.slice(endIndex + 1);
}
/**
* Peek the character code of the next non-whitespace character in
* `text` starting at `fromIndex`. Returns `-1` when `fromIndex` is past
* the end of `text`. Used by the balanced-object extractor to
* disambiguate a stray unescaped `"` inside a JSON string from a
* legitimate closing quote: the latter is always followed (after
* optional whitespace) by a structural JSON character (`,`, `}`, `]`,
* `:`); anything else means the model forgot to JSON-encode the
* quote.
*/
function peekNextNonWhitespace(text, fromIndex) {
	for (let i = fromIndex; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		if (code !== 32 && code !== 9 && code !== 10 && code !== 13) return code;
	}
	return -1;
}
//#endregion
//#region src/provider/provider-parse.ts
/**
* Ambient (module-singleton) sink slot. `live-provider.ts`
* `requestLiveReview` installs a sink here before invoking the provider
* and clears it in `finally`, so any `parseReviewPayload` call reachable
* from `runCopilotRequest` / `runProviderRequest` will pick it up
* without needing to thread it through every call site.
*
* Default value is `null` (no sink installed → no warnings surfaced),
* preserving the previous silent-coercion behavior for any caller that
* has not opted in.
*
* Concurrency note: a module-level singleton is only safe when callers
* install → await → clear atomically (Node's single-threaded event loop
* guarantees no `await` boundary interleaves another `setActiveSeveritySink`
* call). Any future caller that runs two `requestLiveReview` requests
* concurrently via `Promise.all` will have the second `setActiveSeveritySink`
* overwrite the first's slot, and the first's `finally` will clear the
* second's sink mid-flight — silently corrupting the telemetry array.
* The guard below surfaces this condition loudly so the regression is
* caught at install time, not silently after the fact.
*/
let activeSeveritySink = null;
function setActiveSeveritySink(sink) {
	if (sink !== null && activeSeveritySink !== null) console.warn("[provider-parse] setActiveSeveritySink: overwriting a non-null ambient sink. This usually means two requestLiveReview calls are running concurrently (Promise.all) — the second's sink will be cleared by the first's finally, corrupting the captured warnings. Thread the sink via ParseContext instead.");
	activeSeveritySink = sink;
}
function getActiveSeveritySink() {
	return activeSeveritySink;
}
/**
* Emit a structured warning when the parser encounters a severity value
* it cannot classify. Always also writes a single `console.warn` line so
* operators can see the mismatch in CI logs without needing to inspect
* the structured sink channel.
*/
function emitSeverityWarning(rawValue, normalizedFallback, context, sink) {
	const message = `provider ${context.providerName ?? "unknown-provider"} emitted unrecognized severity ${JSON.stringify(rawValue)} at comment index ${context.commentIndex}; falling back to "${normalizedFallback}". Expected one of: info, low, medium, high, critical.`;
	console.warn(message, context);
	if (sink !== void 0) sink(rawValue, normalizedFallback, context);
}
/**
* Returns true when the parsed review has at least one non-empty
* summary, verdict, or comment — used by the parse-fail retry paths
* to decide whether the parsed response carries any usable signal.
*/
function isNonEmptyReview(review) {
	return review !== null && (review.summary.length > 0 || review.verdict.length > 0 || review.comments.length > 0);
}
/**
* Self-healing follow-up prefix prepended to the original user
* message when the first response could not be parsed as a JSON
* review payload. The prefix explicitly asks the model to emit
* JSON-only output (no prose, no fences); the original user
* content is APPENDED after the prefix so the model still has
* the PR diff + review instructions to work from.
*
* Prepending (rather than replacing) is critical: a prior version
* replaced `config.user` with just the reminder, which caused the
* model to fall back to "Reviewer not yet engaged — no code
* context was provided" because it no longer had the diff to
* review. That fallback then passed `isNonEmptyReview` (its
* `summary` field is non-empty), got posted as the actual review
* with 0 findings, and masked the underlying parse-fail — the
* operator saw an empty findings table instead of the
* "raise --max-output-tokens and retry" / "model regression"
* parse-fail diagnostic. Pinned by PR #20 review screenshot.
*
* Some providers ignore `stream: false` and return an empty SSE
* stream; some wrap their output in markdown fences or prose;
* some omit the JSON entirely. We retry once with the prefix
* appended before falling back to the parse-fail surface — that
* often recovers the review without operator intervention.
*
* Shared between `openai-compatible.ts` and `copilot.ts` so the
* self-healing message stays byte-identical regardless of provider.
*/
const PARSE_FAIL_RETRY_PROMPT = "Your previous response did not contain a valid JSON review payload. Please respond with ONLY a JSON object matching this schema (no prose, no fences): {\"summary\": \"...\", \"verdict\": \"NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP\", \"comments\": [...], \"suppressed_comments\": [...]}.\n\nOriginal review request follows:\n\n";
function buildResponsesBody(config, opts) {
	const userContent = opts?.userOverride !== void 0 ? `${opts.userOverride}${config.user}` : config.user;
	const body = {
		model: config.model,
		input: [{
			role: "system",
			content: config.system
		}, {
			role: "user",
			content: userContent
		}]
	};
	if (config.maxOutputTokens !== void 0) body["max_output_tokens"] = config.maxOutputTokens;
	if (config.reasoningEffort !== void 0) body["reasoning"] = { effort: config.reasoningEffort };
	if (config.responseFormat !== void 0) body["text"] = { format: config.responseFormat };
	return body;
}
function buildChatBody(config, opts) {
	const userContent = opts?.userOverride !== void 0 ? `${opts.userOverride}${config.user}` : config.user;
	const body = {
		model: config.model,
		messages: [{
			role: "system",
			content: config.system
		}, {
			role: "user",
			content: userContent
		}]
	};
	if (config.maxOutputTokens !== void 0) body["max_tokens"] = config.maxOutputTokens;
	if (config.reasoningEffort !== void 0) body["reasoning_effort"] = config.reasoningEffort;
	if (config.responseFormat !== void 0) body["response_format"] = config.responseFormat;
	return body;
}
/**
* Extract the text payload from a provider response. Handles four shapes:
*   1. SSE stream (responses API output_text.delta / chat completions delta /
*      generic top-level delta) — concatenates fragments into one string.
*   2. Plain JSON object (Responses API or Chat Completions) — returns
*      `output_text` (responses), joins `output[].content[].text`
*      (responses), or `choices[].message.content` (chat).
*   3. Raw text — returned verbatim (caller tries to extract a JSON
*      block from it via `extractJsonBlock`).
*   4. Empty input — returns `""`.
*
* The function does NOT report "unusable" — it always returns SOMETHING
* (possibly empty) and lets the downstream `parseReviewPayload` plus
* the CLARITY-10 strict empty-fields check decide whether the result
* is a valid review. This keeps the public signature stable
* (`string`, not `string | null`) so existing callers don't need to
* change their null-handling.
*
* History note: an earlier revision returned `string | null` to signal
* "unusable SSE stream with no text fragments" (CLARITY-10). That
* approach was reverted in favor of returning the raw SSE text in
* that case so `parseReviewPayload`'s strict empty-fields check (and
* the CLARITY-10b soft parse-fail detector) catches the failure as a
* null return rather than relying on a separate null-handling path
* in callers.
*/
function extractTextPayload(endpoint, rawText) {
	if (rawText.length === 0) return "";
	const trimmedStart = rawText.trimStart();
	if (trimmedStart.startsWith("data:") || trimmedStart.startsWith("event:")) {
		const sseText = tryExtractSse(rawText);
		if (sseText !== null && sseText.length > 0) return sseText;
		return rawText;
	}
	const parsed = tryParseJson(rawText);
	if (parsed !== void 0 && isRecord(parsed)) if (endpoint === "responses") {
		const direct = readStringField$1(parsed, "output_text");
		if (direct !== null && direct.length > 0) return direct;
		const output = readArrayField(parsed, "output");
		if (output !== null) {
			const fromOutput = joinOutputText(output);
			if (fromOutput.length > 0) return fromOutput;
			if (output.length > 0) {
				const recovered = extractLastReviewDraftFromReasoning(output);
				if (recovered !== null) return recovered;
				return "";
			}
		}
	} else {
		const choices = readArrayField(parsed, "choices");
		if (choices !== null) for (const choice of choices) {
			const message = readRecordField(choice, "message");
			if (message === null) continue;
			const content = readStringField$1(message, "content");
			if (content !== null && content.length > 0) return content;
		}
	}
	return rawText;
}
/**
* Parse a provider text response into a structured review payload.
*
* Returns `null` in three distinct cases:
*   1. No JSON object found in `text` (plain prose, markdown, or non-JSON
*      SSE tail — i.e. `extractJsonBlock` yielded nothing parseable).
*   2. `extractJsonBlock` returned a value that isn't a JSON object
*      (e.g. a string or array).
*   3. (CLARITY-10b) The parsed object is structurally valid but its
*      `summary` matches an apology pattern AND it has zero findings
*      (no `comments`, no `suppressed_comments`). The model returned a
*      legitimate-looking JSON wrapper around an apology message; we
*      treat it as a parse failure so the self-healing retry fires.
*
* Callers that need to distinguish the cases (e.g. for different error
* messages) can use the returned `ProviderReviewPayload` shape to
* differentiate "structured empty review" (returned, all fields empty)
* from "no parseable content" (returns null).
*/
function parseReviewPayload(text, context) {
	const candidate = extractJsonBlock(text);
	if (!isRecord(candidate)) return null;
	const summary = readStringField$1(candidate, "summary") ?? "";
	const verdict = readStringField$1(candidate, "verdict") ?? "";
	const comments = readCommentArray(candidate["comments"], context);
	const suppressed_comments = readCommentArray(candidate["suppressed_comments"], context);
	if (comments.length === 0 && suppressed_comments.length === 0 && isApologySummary(summary)) return null;
	return {
		summary,
		verdict,
		comments,
		suppressed_comments
	};
}
/**
* True when the raw SSE stream ended before the model emitted the
* final `response.completed` (or `response.done`) event. Distinguishes
* "the stream was truncated" from "the stream completed but the JSON
* inside was malformed". Used by the parse-fail diagnostic so reviewers
* see "raise --max-output-tokens and retry" instead of a generic
* "provider response was not valid JSON".
*
* Detection walks `data:` lines only (not the raw text), so a review
* whose comment body happens to contain the literal string
* `"type":"response.completed"` cannot trick the detector into
* thinking the stream completed cleanly. Mirrors `tryExtractSse`'s
* SSE-spec parsing: blank lines separate events, comment lines
* (`:` prefix) are ignored, and the payload is the substring after
* `data:` with optional leading space stripped.
*
* Edge cases that intentionally return `false`:
*   - Non-SSE responses (chat-completions, plain JSON): there's no
*     stream-completion concept for a single-shot response, so
*     truncation only applies to streaming endpoints. Detected by
*     absence of any `data:` line.
*   - Empty rawText: trivially not a truncated stream.
*   - A response.completed event whose output_text was empty: still
*     a completed stream, just one whose model output was nothing.
*     `tryExtractSse` falls back to the delta accumulation in this
*     case but the stream itself terminated cleanly.
*/
/**
* Scan SSE `data:` lines for the terminal event-type marker.
*
* Walks `rawText` line-by-line and looks only at the JSON payloads
* inside `data:` lines (not at `event:` header lines or arbitrary
* text content like review-comment bodies). This is essential because
* a model reviewing a diff that contains the literal string
* `"type":"response.completed"` would otherwise match the
* substring check and trick the parser into thinking the stream
* completed cleanly. Mirrors the structure-walk pattern used by
* `tryExtractSse` (above) so the SSE contract is enforced the same
* way everywhere.
*/
function findSseEventTypeMarker(rawText) {
	for (const line of rawText.split("\n")) {
		if (!line.startsWith("data:")) continue;
		const payload = line.slice(5).replace(/^ /u, "");
		if (payload === "" || payload === "[DONE]") continue;
		if (payload.includes("\"type\":\"response.completed\"")) return "response.completed";
		if (payload.includes("\"type\":\"response.done\"")) return "response.done";
	}
	return null;
}
/**
* True when the raw SSE stream ended before the model emitted the
* final `response.completed` (or `response.done`) event. Distinguishes
* "the stream was truncated" from "the stream completed but the JSON
* inside was malformed". Used by the parse-fail diagnostic so reviewers
* see "raise --max-output-tokens and retry" instead of a generic
* "provider response was not valid JSON".
*
* Detection walks `data:` lines only (not the raw text), so a review
* whose comment body happens to contain the literal string
* `"type":"response.completed"` cannot trick the detector into
* thinking the stream completed cleanly. Mirrors `tryExtractSse`'s
* SSE-spec parsing: blank lines separate events, comment lines
* (`:` prefix) are ignored, and the payload is the substring after
* `data:` with optional leading space stripped.
*
* Edge cases that intentionally return `false`:
*   - Non-SSE responses (chat-completions, plain JSON): there's no
*     stream-completion concept for a single-shot response, so
*     truncation only applies to streaming endpoints. Detected by
*     absence of any `data:` line.
*   - Empty rawText: trivially not a truncated stream.
*   - A response.completed event whose output_text was empty: still
*     a completed stream, just one whose model output was nothing.
*     `tryExtractSse` falls back to the delta accumulation in this
*     case but the stream itself terminated cleanly.
*/
function wasResponseStreamTruncated(rawText) {
	if (rawText.length === 0) return false;
	if (!rawText.includes("data:")) return false;
	return findSseEventTypeMarker(rawText) === null;
}
/**
* Extract the terminal-event payload from an SSE stream. Walks
* `data:` lines, parses each as JSON, and returns the FIRST parsed
* payload whose `type` field is `response.completed` or
* `response.done`. Returns `undefined` if no terminal event was
* emitted or if every data: line fails to parse.
*
* Scoping the search to the SSE event stream (rather than searching
* the raw text) is essential: a model reviewing a diff that contains
* a `"usage":` literal would otherwise pick up the wrong value.
*/
function extractTerminalEventPayload(rawText) {
	for (const line of rawText.split("\n")) {
		if (!line.startsWith("data:")) continue;
		const payload = line.slice(5).replace(/^ /u, "");
		if (payload === "" || payload === "[DONE]") continue;
		let parsed;
		try {
			parsed = JSON.parse(payload);
		} catch {
			continue;
		}
		if (!isRecord(parsed)) continue;
		const eventType = parsed["type"];
		if (eventType === "response.completed" || eventType === "response.done") return parsed;
	}
}
/**
* Extract a `ProviderUsage` subset from the raw SSE stream's terminal
* `response.completed` event's `usage` block. Returns `undefined` when
* the stream was truncated (no completed event) or when the provider
* didn't emit a usage block. Used by the token-headroom warning so
* operators can see whether the model filled its `max_output_tokens`
* budget when a parse-fail occurs.
*
* Scoping: the usage block is read from the terminal event's PARSED
* JSON payload — not from a raw `indexOf('"usage":')` substring scan
* over the whole rawText. This avoids picking up usage-like JSON
* from intermediate events, model review-content bodies that happen
* to contain `"usage":`, or any other unrelated occurrence.
*/
function parseProviderUsage(rawText) {
	const terminalEvent = extractTerminalEventPayload(rawText);
	if (terminalEvent === void 0) return;
	const usageRaw = terminalEvent["usage"];
	if (!isRecord(usageRaw)) return;
	let inputTokens;
	let outputTokens;
	let totalTokens;
	if (typeof usageRaw["input_tokens"] === "number") inputTokens = usageRaw["input_tokens"];
	if (typeof usageRaw["output_tokens"] === "number") outputTokens = usageRaw["output_tokens"];
	if (typeof usageRaw["total_tokens"] === "number") totalTokens = usageRaw["total_tokens"];
	if (inputTokens === void 0 && outputTokens === void 0 && totalTokens === void 0) return;
	return {
		...inputTokens !== void 0 ? { input_tokens: inputTokens } : {},
		...outputTokens !== void 0 ? { output_tokens: outputTokens } : {},
		...totalTokens !== void 0 ? { total_tokens: totalTokens } : {}
	};
}
/**
* Combined truncation-detection + usage-extraction helper. Returns
* the diagnosis that callers attach to the ProviderError so the
* parse-fail diagnostic can render a reason-specific headline.
*
* Both `openai-compatible.ts` and `copilot.ts` use this helper
* instead of duplicating the inline `wasResponseStreamTruncated` +
* `parseProviderUsage` block. Keeping the logic in one place means
* the "what counts as truncated" contract is enforced uniformly
* across providers. (See the self-review finding on
* `src/provider/openai-compatible.ts:263` for the duplication
* rationale.)
*
* Note: this helper does NOT emit the headroom `::warning::` line
* that was in the prior inline duplicate. That warning required
* BOTH `truncated === true` AND a populated `usage.output_tokens`,
* but `parseProviderUsage` only reads usage from the terminal event
* — and a stream with the terminal event is by definition NOT
* truncated. The combination is unreachable in practice; the
* warning was dead code. If a future provider emits usage on
* intermediate events, the warning should be re-introduced via a
* dedicated `parseIntermediateUsage` helper.
*/
function diagnoseParseFailure(input) {
	return {
		truncated: wasResponseStreamTruncated(input.rawText),
		usage: parseProviderUsage(input.rawText)
	};
}
/**
* Pattern match for "the model couldn't actually review the input" apology
* summaries. These are NOT real reviews even when wrapped in valid JSON.
*
* Matched phrases (case-insensitive, whole-word where reasonable):
*   - "no diff" / "no file contents" / "no contents were provided"
*   - "please share" / "please provide" / "please send"
*   - "i cannot" / "i'm unable" / "i am unable" / "i can not"
*   - "cannot review" / "unable to review" / "can't review"
*   - "did not receive" / "haven't received" / "no input"
*
* The match is intentionally narrow — it must look like the model is
* telling us *it* failed to receive input, not commenting on the code.
* Phrases like "no issues found" or "nothing to flag" are deliberately
* excluded — those are legitimate clean-review signals.
*/
function isApologySummary(summary) {
	if (summary.length === 0) return false;
	const lower = summary.toLowerCase();
	for (const pattern of [
		/\bno\s+(diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied)\b/u,
		/\bno\s+(?:pull\s+request\s+|pr\s+|file\s+|the\s+|any\s+)*(?:diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied|received)\b/u,
		/\bplease\s+(share|provide|send)\s+(the\s+)?(diff|file|pull\s+request|pr)\b/u,
		/\bi\s+(cannot|can'?t|am\s+unable|i'?m\s+unable)\s+review\s+(this|it|the|a|that)\b/u,
		/\b(cannot|can'?t|unable\s+to)\s+review\s+(this|it|the|a|that|self)\b/u,
		/\b(didn'?t\s+receive|haven'?t\s+received|no\s+input)\b/u,
		/\b(empty\s+diff|no\s+diff\s+to\s+review|without\s+(diff|input))\b/u,
		/\b(is\s+empty|was\s+empty)\b.*\b(nothing|to\s+review)\b/u,
		/\bnothing\s+to\s+review\b/u
	]) if (pattern.test(lower)) return true;
	return false;
}
/**
* Walks the OpenAI Responses API `output[]` array and concatenates all
* text fragments it finds. The Responses API puts output items under
* `content[]` as an array of parts (each part is `{type, text}` or
* `{type, image_url}` etc) — so this function recurses into content
* arrays and pulls out any `text` strings, in order.
*
* Accepts both the Responses API shape (`content: [{type, text}]`)
* and a simpler chat-style shape (`content: {text: "..."}`) for
* providers that return the latter.
*/
function joinOutputText(output) {
	const fragments = [];
	for (const entry of output) {
		if (!isRecord(entry)) continue;
		const content = entry["content"];
		if (Array.isArray(content)) {
			for (const part of content) {
				if (!isRecord(part)) continue;
				const partType = part["type"];
				if (typeof partType === "string" && partType.includes("reasoning")) continue;
				const text = part["text"];
				if (typeof text === "string") fragments.push(text);
			}
			continue;
		}
		if (isRecord(content)) {
			const contentType = content["type"];
			if (typeof contentType === "string" && contentType.includes("reasoning")) continue;
			const text = content["text"];
			if (typeof text === "string") fragments.push(text);
		}
	}
	return fragments.join("\n");
}
/**
* Some providers (notably MiniMax-M3) write a draft of the final
* review JSON inside their reasoning block — the model narrates
* "let me write the JSON: ```json\n{...}\n```" as part of its
* chain-of-thought — then runs out of the output budget before the
* formal `output_text` field gets emitted. The response.completed
* envelope then has `output[]` containing only reasoning entries,
* and the actual review is recoverable only from inside the
* reasoning text.
*
* The reasoning can contain MULTIPLE drafts (the model revises its
* own answer as it reasons). We want the LAST valid review-shaped
* JSON object — that's the most refined version, closest to what
* the model would have emitted.
*
* Returns the JSON string (the contents of the last ```json fenced
* block that parses as a review) or `null` if no valid draft is
* found. The returned string is the raw JSON, which downstream
* `parseReviewPayload` will re-parse and validate.
*/
function extractLastReviewDraftFromReasoning(output) {
	let lastDraft = null;
	for (const entry of output) {
		if (!isRecord(entry)) continue;
		const content = entry["content"];
		if (!Array.isArray(content)) continue;
		for (const part of content) {
			if (!isRecord(part)) continue;
			const partType = part["type"];
			if (typeof partType === "string" && !partType.includes("reasoning")) continue;
			const text = part["text"];
			if (typeof text !== "string") continue;
			const fenceRe = /```[a-zA-Z0-9_+\-]*\s*\n([\s\S]*?)\n```/gu;
			let m;
			while ((m = fenceRe.exec(text)) !== null) {
				const body = m[1]?.trim() ?? "";
				if (!body.startsWith("{")) continue;
				try {
					const parsed = JSON.parse(body);
					if (!isRecord(parsed)) continue;
					if ("summary" in parsed || "verdict" in parsed || "comments" in parsed) lastDraft = body;
				} catch {}
			}
		}
	}
	return lastDraft;
}
function readCommentArray(value, context) {
	if (!isUnknownArray(value)) return [];
	const effectiveSink = context?.sink ?? getActiveSeveritySink() ?? void 0;
	const effectiveProviderName = context?.providerName;
	const comments = [];
	value.forEach((entry, index) => {
		if (!isRecord(entry)) return;
		const path = entry["path"];
		const line = readSafeIntegerField(entry, "line");
		if (typeof path === "string" && line !== null) {
			const body = readStringField$1(entry, "body") ?? "";
			comments.push({
				path,
				line,
				body,
				severity: normalizeProviderSeverity(readStringField$1(entry, "severity"), body, effectiveSink !== void 0 || effectiveProviderName !== void 0 ? {
					...effectiveSink !== void 0 ? { sink: effectiveSink } : {},
					...effectiveProviderName !== void 0 ? { providerName: effectiveProviderName } : {},
					commentIndex: index
				} : { commentIndex: index }),
				category: readStringField$1(entry, "category") ?? "general"
			});
		}
	});
	return comments;
}
/**
* Normalize a provider-emitted severity string to one of our canonical
* scale values (`low | medium | high | critical | info`).
*
* Different providers use different scales — OpenAI-style models tend to
* emit `low | medium | high`, Sonar-style models emit `info | minor |
* major | critical | blocker`, Copilot-style emits similar. Without
* normalization, an unknown severity falls through to the catch-all
* `"medium"` default in `readCommentArray` — which bypasses the
* `minimum-severity` threshold (default `medium`) and posts the finding
* inline even when the user has configured a stricter filter.
*
* Mapping (severity-only, no body):
*   - `info`     → `info`
*   - `nit`      → `info`     (style nit, below `low`)
*   - `minor`    → `low`      (Sonar minor ≈ our low)
*   - `low`      → `low`
*   - `major`    → `medium`   (Sonar major ≈ our medium)
*   - `medium`   → `medium`
*   - `high`     → `high`
*   - `critical` → `critical`
*   - `blocker`  → `critical` (Sonar blocker ≈ our critical)
*   - `security` → see body-scoped rules below
*   - `leak`     → `critical` (leaked secrets are always the highest
*                              severity class — no hardening-tip
*                              ambiguity here)
*   - anything else → `medium` (preserves prior default behavior)
*
* Body-scoped rules for `security` (when a body is provided):
*   - body matches HARDENING_HINT_PATTERN ("consider adding a CSP",
*     "rate limiting", etc.) → `high` (it's a hardening tip, not a
*     current vulnerability — let the user's threshold filter it if
*     they want)
*   - body matches LEAK_INDICATOR_PATTERN ("secret", "credential",
*     "token", "API key", "password") → `critical` (active leak, must
*     survive any threshold)
*   - anything else → `high` (default for `security` severity when body
*     doesn't indicate either hardening or active leak)
*
* Rationale for body-scoped rules: a provider that emits severity:
* "security" for a low-severity hardening tip ("consider adding a CSP
* header") would bypass the user's minimum-severity: critical filter
* and post a non-critical finding inline. Body-scoped scoping lets the
* mapping distinguish "this is a hardening tip" from "this is an active
* leak" using the comment's textual content.
*
* Unknown-but-non-empty values now get a sensible rank instead of the
* catch-all `medium`. The `minimum-severity` threshold then does its job
* correctly: a `nit` becomes `info` (rank 0) and is filtered out under
* `minimum-severity: medium` (rank 2).
*/
/** Patterns that indicate a low-severity hardening tip, not an active vulnerability. */
const HARDENING_HINT_PATTERN = /\b(consider\s+add(?:ing)?|suggest(?:ed|s)?\s+(?:adding|using)|you\s+(?:may|might|should)\s+want\s+to|harden(?:ing)?|best\s+practice)\b/iu;
/** Patterns that indicate an active secret leak or credential exposure. */
const LEAK_INDICATOR_PATTERN = /\b(secret|credential|token|api[\s_-]?key|password|private[\s_-]?key|exposed|leaked|disclosed|committed\s+by\s+accident)\b/iu;
function normalizeProviderSeverity(value, body, options) {
	const sink = options?.sink;
	const context = options?.providerName !== void 0 ? {
		providerName: options.providerName,
		commentIndex: options.commentIndex ?? -1
	} : { commentIndex: options?.commentIndex ?? -1 };
	if (value === null || value.length === 0) return "medium";
	switch (value.toLowerCase()) {
		case "info":
		case "nit": return "info";
		case "minor":
		case "low": return "low";
		case "major":
		case "medium": return "medium";
		case "high": return "high";
		case "critical":
		case "blocker": return "critical";
		case "leak": return "critical";
		case "security":
			if (body !== void 0 && body !== null && body.length > 0) {
				if (LEAK_INDICATOR_PATTERN.test(body)) return "critical";
				if (HARDENING_HINT_PATTERN.test(body)) return "high";
			}
			return "high";
		default:
			emitSeverityWarning(value, "medium", context, sink);
			return "medium";
	}
}
/**
* Some providers (e.g. Manifest, MiniMax) ignore `stream: false` and always
* return Server-Sent Events. Detect the SSE format and concatenate text
* fragments from all chunks into a single string.
*
* Handles the SSE formats we've observed in the wild:
*   1. /chat/completions streaming: `choices[].delta.content`
*   2. /responses streaming with top-level `delta` string (some non-OpenAI
*      providers use this variant)
*   3. OpenAI /responses streaming with nested events:
*        event: response.output_text.delta
*        data: {"type":"response.output_text.delta","delta":"fragment"}
*      We extract the inner `delta` field regardless of the wrapping key.
*   4. /responses streaming where the final `response.completed` event
*      contains the full `output[]` array (some providers only send the
*      done-event with output and skip the per-fragment deltas). When we
*      see a `response.completed` event, we extract `output_text` from
*      the inner `response` and prefer it over fragment accumulation.
*
* Returns the concatenated text if any fragment was found, or null if
* the input wasn't SSE or no text fragments were extractable. The caller
* (`extractTextPayload`) then falls back to plain-JSON parsing.
*/
function tryExtractSse(rawText) {
	const trimmed = rawText.trim();
	if (!trimmed.startsWith("data:") && !trimmed.startsWith("event:")) return null;
	const fragments = [];
	let completedResponseText = null;
	const events = [[]];
	for (const line of trimmed.split("\n")) {
		if (line.trim() === "") {
			if (events[events.length - 1].length > 0) events.push([]);
			continue;
		}
		events[events.length - 1].push(line);
	}
	for (const eventLines of events) {
		const dataLines = [];
		for (const line of eventLines) if (line.startsWith("data:")) dataLines.push(line.slice(5));
		if (dataLines.length === 0) continue;
		const payload = dataLines.map((d) => d.startsWith(" ") ? d.slice(1) : d).join("\n").trim();
		if (payload === "" || payload === "[DONE]") continue;
		const parsed = tryParseJson(payload);
		if (!isRecord(parsed)) continue;
		const wrappedResponse = readRecordField(parsed, "response");
		if (wrappedResponse !== null) {
			const eventType = readStringField$1(parsed, "type");
			if (typeof eventType === "string" && eventType.includes("reasoning")) continue;
			if (eventType === "response.completed" || eventType === "response.done") {
				const outText = readStringField$1(wrappedResponse, "output_text");
				if (outText !== null && outText.length > 0) completedResponseText = outText;
				else {
					const output = readArrayField(wrappedResponse, "output");
					if (output !== null) {
						const joined = joinOutputText(output);
						if (joined.length > 0) completedResponseText = joined;
					}
				}
				continue;
			}
			if (eventType === "response.output_text.delta" || eventType === "response.delta") {
				const deltaText = readStringField$1(parsed, "delta");
				if (deltaText !== null) fragments.push(deltaText);
				continue;
			}
		}
		const choices = readArrayField(parsed, "choices");
		if (choices !== null) {
			for (const choice of choices) {
				const delta = readRecordField(choice, "delta");
				if (delta !== null) {
					const content = readStringField$1(delta, "content");
					if (content !== null) fragments.push(content);
				}
			}
			continue;
		}
		const topLevelType = readStringField$1(parsed, "type");
		if (typeof topLevelType === "string" && topLevelType.includes("reasoning")) continue;
		const deltaText = readStringField$1(parsed, "delta");
		if (deltaText !== null) fragments.push(deltaText);
	}
	if (completedResponseText !== null) {
		if (fragments.length === 0 || !isStubCompletedText(completedResponseText)) return completedResponseText;
	}
	return fragments.length > 0 ? fragments.join("") : null;
}
/**
* Heuristic: detect a `response.completed` `output_text` value that is
* a stub/placeholder rather than the real review text.
*
* Triggers (returns true → caller falls back to delta concatenation):
*   - Empty string
*   - String shorter than 8 characters (real reviews are at minimum
*     `{"summary":"x"}` ≈ 16 chars; provider stubs are usually < 8)
*   - String that doesn't contain a `{` (the opening of a JSON object —
*     a stub like "placeholder" or the model wrapper's prompt echo
*     rarely contains a `{`)
*
* This is intentionally permissive: false positives (treating a real
* short review as a stub) are rare because real reviews always contain
* `{`. The test suite in `test/unit/azure-thread-589-repro.test.ts`
* pins the behavior end-to-end with the production failure mode
* (MiniMax-M3 `response.completed` stub "placeholder").
*/
function isStubCompletedText(text) {
	if (text.length === 0) return true;
	if (text.length < 8) return true;
	if (!text.includes("{")) return true;
	return false;
}
/**
* Dynamically detect provider-error responses that arrive as HTTP 200
* with a structurally valid JSON body but carry NO actual model output.
* These are the most dangerous failure class because the existing
* "parse failed" path treats them as genuine parse failures — posting
* a COMMENT review with zero findings and exiting 0, so CI sees green
* even though the model never ran.
*
* Provider-agnostic detection signals (any ONE suffices):
*
*   1. **Zero-usage signal**: The response JSON has a `usage` block
*      where `input_tokens === 0` AND `output_tokens === 0` (and
*      `total_tokens === 0` when present). A real model invocation
*      always consumes at least 1 input token. This is the strongest
*      signal because it comes directly from the provider's billing
*      layer — routers, proxies, and gateways that fail to route the
*      request still report zero usage because no model was called.
*
*      IMPORTANT: `usage` must be READ FROM the response JSON
*      (top-level or inside the SSE terminal event), not from the
*      `ProviderError.usage` field, which only carries usage from
*      the terminal SSE event. A non-SSE provider error (plain JSON
*      HTTP 200) would have usage on the top-level JSON object and
*      nowhere else.
*
*   2. **Error-doc-URL signal**: The response text contains a
*      documentation URL with an error-code path
*      (`/docs/errors/M101`, `/docs/errors/`, `/help/error/`). This
*      is universal across LLM routers (Manifest, LiteLLM, OpenRouter,
*      custom gateways) — they all link to their error documentation.
*
*   3. **Error-envelope signal**: The response JSON has an `error`
*      object or `errors` array at the top level with `type`/`message`/
*      `code` fields. This is the standard shape for JSON-API errors
*      (RFC 7807, JSON:API spec) and is used by every major API
*      gateway when the request reaches the server but cannot be
*      processed (bad model name, no route configured, quota exceeded).
*
*   4. **Zero-output + zero-usage fallback**: Response has
*      `output_text: ""` or `output: []` (empty output) AND
*      zero-usage. This catches providers that return a valid response
*      envelope but with no actual model output — the "connected but
*      no providers" case.
*
* IMPORTANT: The function intentionally does NOT match on substrings
* like "Manifest M101" or "model not supported" — those are
* provider-specific and would miss new providers. The four signals
* above are structural and work for any provider.
*
* Non-triggers (intentionally):
*   - A response with `output_tokens > 0` is never a provider error
*     (the model ran and produced output, even if the output is
*     garbage — that's a parse failure, not a provider error).
*   - A response with no `usage` block at all is ambiguous (some
*     providers omit usage on streaming responses) — we only trigger
*     when usage IS present and IS all-zeros.
*   - A response with a valid review JSON (summary + comments) is
*     never a provider error regardless of usage.
*/
function detectProviderError(rawText) {
	if (rawText.length === 0) return null;
	const parsed = tryParseJson(rawText);
	if (parsed !== void 0 && isRecord(parsed)) {
		const errorDetails = checkErrorEnvelope(parsed);
		if (errorDetails !== null) return errorDetails;
		const zeroUsage = checkZeroUsage(parsed);
		if (zeroUsage !== null) {
			if (!checkHasReviewContent(parsed)) return zeroUsage;
		}
	}
	const docUrlSignal = checkErrorDocUrl(rawText);
	if (docUrlSignal !== null) return docUrlSignal;
	return null;
}
/**
* Check for a top-level `error` object or `errors` array in the JSON
* response. This is the standard JSON-API error shape used by gateways,
* routers, and proxies when the request reaches the server but cannot
* be processed.
*/
function checkErrorEnvelope(parsed) {
	const errorField = parsed["error"];
	if (isRecord(errorField)) return {
		kind: "error-envelope",
		message: readStringField$1(errorField, "message") ?? readStringField$1(errorField, "type") ?? readStringField$1(errorField, "code") ?? "Provider returned an error envelope.",
		...readStringField$1(errorField, "type") !== null ? { detail: `type: ${readStringField$1(errorField, "type")}` } : {}
	};
	const errorsField = parsed["errors"];
	if (isUnknownArray(errorsField) && errorsField.length > 0) {
		const first = errorsField[0];
		if (isRecord(first)) return {
			kind: "error-envelope",
			message: readStringField$1(first, "message") ?? readStringField$1(first, "detail") ?? readStringField$1(first, "title") ?? "Provider returned an errors array."
		};
	}
	return null;
}
/**
* Check for a `usage` block where all token counts are zero. This
* means no model was invoked — a dead giveaway for router/proxy
* misconfiguration.
*
* Checks both top-level `usage` (non-SSE JSON responses) and
* `response.usage` (SSE terminal event envelope). Does NOT use the
* `ProviderError.usage` field because that only carries usage from
* the terminal SSE event and would miss non-SSE responses.
*/
function checkZeroUsage(parsed) {
	const usage = readUsageBlock(parsed);
	if (usage === null) return null;
	const input = usage["input_tokens"];
	const output = usage["output_tokens"];
	const total = usage["total_tokens"];
	if (!(input !== void 0 || output !== void 0 || total !== void 0)) return null;
	if ((input === void 0 || input === 0) && (output === void 0 || output === 0) && (total === void 0 || total === 0)) return {
		kind: "zero-usage",
		message: "Provider reported zero token usage — no model was invoked. Check provider configuration and API key."
	};
	return null;
}
/**
* Read the `usage` block from a parsed JSON response. Checks both
* top-level `usage` (non-SSE JSON) and `response.usage` (SSE
* terminal-event envelope shape where the full response is wrapped
* inside a `response` key).
*/
function readUsageBlock(parsed) {
	const topLevelUsage = readRecordField(parsed, "usage");
	if (topLevelUsage !== null) return topLevelUsage;
	const responseField = readRecordField(parsed, "response");
	if (responseField !== null) {
		const nestedUsage = readRecordField(responseField, "usage");
		if (nestedUsage !== null) return nestedUsage;
	}
	return null;
}
/**
* Check whether the parsed JSON response contains actual review content
* (summary, verdict, or comments). Used to prevent false positives
* when zero-usage is detected — some routers emit zero usage on cached
* responses that DO contain a valid review.
*/
function checkHasReviewContent(parsed) {
	const summary = readStringField$1(parsed, "summary");
	if (summary !== null && summary.length > 0) return true;
	const verdict = readStringField$1(parsed, "verdict");
	if (verdict !== null && verdict.length > 0) return true;
	const comments = readArrayField(parsed, "comments");
	if (comments !== null && comments.length > 0) return true;
	return false;
}
/**
* Check the raw text for error-documentation URLs. This is universal
* across LLM routers and gateways — they all link to their error docs.
*
* Matches patterns like:
*   - `/docs/errors/M101`
*   - `/docs/errors/`
*   - `/help/error/`
*   - `/docs/error-codes#`
*
* Works on both JSON (extracted from string fields) and plain-text
* responses.
*/
function checkErrorDocUrl(rawText) {
	const ERROR_DOC_PATTERN = /\/(?:docs|help)\/errors?[-_/a-z0-9]*/iu;
	if (ERROR_DOC_PATTERN.test(rawText)) {
		const match = rawText.match(ERROR_DOC_PATTERN);
		const detail = match !== null ? match[0] : "";
		return {
			kind: "error-doc-url",
			message: "Provider response contains an error documentation URL — provider routing or configuration error.",
			...detail.length > 0 ? { detail } : {}
		};
	}
	return null;
}
//#endregion
//#region src/cli/live-shared.ts
var LiveReviewError = class extends Error {
	code;
	name = "LiveReviewError";
	constructor(code, message, options) {
		super(message, options);
		this.code = code;
		if (options !== void 0 && typeof options.hint === "string") this.hint = options.hint;
	}
};
/**
* Type-safe reader for the optional `hint` field on a `LiveReviewError`.
* Returns `undefined` when the error is not a `LiveReviewError` or when
* no hint was attached at construction. Use this instead of casting to
* keep the call site narrow.
*/
function getLiveReviewHint(error) {
	if (error instanceof LiveReviewError === false) return;
	const hint = error.hint;
	return typeof hint === "string" ? hint : void 0;
}
/**
* Gate that refuses to post when high-confidence secrets are detected in the
* diff. This is the runtime side of `identify leaks` — the scanner counts
* leaks and redacts the diff, but the gate enforces that no provider response
* can leak secrets through the posted review body. `detect-leaks: false`
* bypasses the gate (operator opt-out).
*/
async function evaluateLeakGate(input) {
	if (!input.detectLeaks) return {
		ok: true,
		leakCount: 0
	};
	const report = await scanReviewSecrets({
		diffText: input.diffText,
		expectedArtifact: "artifacts/manual/s5-redaction-report.json"
	});
	if (report.highConfidenceLeakCount === 0) return {
		ok: true,
		leakCount: 0
	};
	return {
		ok: false,
		leakCount: report.highConfidenceLeakCount,
		message: `Refusing to post: ${report.highConfidenceLeakCount} high-confidence secret(s) detected in the diff. Set --no-detect-leaks to override (NOT recommended).`
	};
}
/**
* Build the body of the overall review (GitHub review body or Azure thread
* starter comment). Both platforms must produce an equivalent contract so AI
* agents and humans see the same information regardless of platform.
*
* Implementation: delegates to the `severity-table` layout defined in
* `src/render/summary-layouts.ts` (one of the 20 alternatives surfaced
* during the layout review — see the local viewer at
* `scripts/view-summary-layouts.mjs` for the full design sheet and
* baseline comparison). The other 19 layouts are still reachable via
* `renderSummary(layout, data)` for callers that want a different
* visual personality; this function is the single wired default.
*
* Contract invariants preserved across the cutover:
*   - Stable HTML marker (used for dedup) — first line of body
*   - Verdict badge — second line, large H2
*   - 🏷️ Severity tally — `critical → high → medium → low` distribution
*     of the POSTED set, hidden when all zeros
*   - Stable `<!-- umactually:manifest {…} -->` for AI agents
*   - Same byte-for-byte output on GitHub and Azure (parity invariant)
*   - Secret redaction applied to every rendered string
*
* Changes vs the legacy builder:
*   - No more `📋 Posted preview` / `🧹 Filtered preview` / `📍 Off-diff`
*     `<details>` blocks — the severity-table layout shows the full
*     findings list inline so reviewers don't need to click to expand
*     to see what the review actually said. Off-diff + filtered are
*     summarized in the manifest (still machine-readable) rather than
*     rendered as separate hidden blocks.
*   - No more `<details>` for the summary prose — the new layout
*     surfaces the summary inline (small paragraph), since the
*     findings table is already collapsed-style.
*   - Body stays under GitHub's 65,536-char limit (enforced by
*     `test/unit/summary-layouts.test.ts`).
*
* CLARITY-* contract notes:
*   - CLARITY-1 (verdict first): preserved.
*   - CLARITY-2 (severity within 200 chars): preserved via the tally.
*   - CLARITY-3 (no raw `**word**`): preserved — the severity-table
*     layout uses emoji + backtick labels instead of `**medium**`.
*   - CLARITY-4 (summary inside `<details>`): NO LONGER APPLIES — the
*     severity-table layout surfaces the summary inline. Test
*     assertions that pinned this contract have been updated.
*   - CLARITY-5 (identical shape across empty/clean/busy): preserved —
*     the layout always emits the same section structure.
*   - CLARITY-6/7 (marker + manifest): preserved.
*   - CLARITY-8 (GitHub == Azure): preserved — both paths call this
*     same function.
*   - CLARITY-13/19 (off-diff / pipeline reconciliation): now surfaced
*     through the manifest + the rendered table instead of separate
*     `<details>` blocks.
*/
function buildReviewBody(input) {
	const postedComments = input.postedComments ?? input.review.comments;
	const reviewData = {
		review: input.review,
		provider: input.provider,
		modelId: input.modelId,
		validCommentCount: input.validCommentCount,
		suppressedCommentCount: input.suppressedCommentCount,
		severityCounts: input.severityCounts,
		offDiffFromComments: input.offDiffFromComments,
		postedComments,
		secrets: input.secrets,
		minimumSeverity: input.minimumSeverity ?? null
	};
	return renderSummary(input.layout ?? "severity-table", reviewData);
}
/**
* Build a single inline-comment body. Both GitHub review comments and Azure
* DevOps thread comments use the same shape:
*   1. [optional] Stable marker
*   2. Severity + category badges
*   3. Body text (or fallback placeholder when empty)
*   4. [optional] A parent-review reference line so humans reading the PR
*      can correlate the inline finding with the parent summary card.
*/
function buildInlineCommentBody(input) {
	const safeSeverity = sanitizeForPost(input.comment.severity.toLowerCase(), input.secrets);
	const safeCategory = sanitizeForPost(input.comment.category, input.secrets);
	const fallback = `Finding at ${sanitizeForPost(input.comment.path, input.secrets)}:${input.comment.line}.`;
	const safeBody = input.comment.body.length > 0 ? sanitizeForPost(input.comment.body, input.secrets) : sanitizeForPost(fallback, input.secrets);
	return `${input.includeMarker === true ? `${REVIEW_MARKER}\n` : ""}${isPositiveSafeInteger(input.parentThreadId) ? `> Reply to PR review summary #${input.parentThreadId}\n\n` : ""}\`${safeSeverity}\` \`${safeCategory}\`\n\n${safeBody}`;
}
/**
* Hard upper bound on the raw provider text we include in a parse-fail
* fallback body. Keeps the parent PR-level summary card from being filled
* with an unbounded provider response if the model misbehaves.
*/
/**
* Total character budget for the parse-fail diagnostic block. The block
* shows BOTH the head (provider's opening metadata events) and the tail
* (the final `response.completed` event with `output_text`) so reviewers
* can see what the model began with AND where it ended up — not just
* whichever end happened to land first. CLARITY-12.
*
* 16 000 chars is enough to capture metadata (~500 chars) plus a typical
* modern review (~2-12 KB of JSON output_text) without truncation; SSE
* streams that exceed this get head+tail with a quantifier in the middle.
* Pinned by `test/unit/parse-fail-diagnostic.test.ts` so the budget cannot
* silently regress to a value that hides the final `response.completed`
* payload from reviewers. MUST stay well under GitHub's 65 536-char
* comment body limit once wrapped in `<details>` + summary + manifest.
*/
const MALFORMED_PROVIDER_FALLBACK_RAW_MAX = 16e3;
/** Size of each end-piece (head / tail) when the raw text exceeds the budget. */
const MALFORMED_PROVIDER_FALLBACK_HALF_BUDGET = Math.floor(MALFORMED_PROVIDER_FALLBACK_RAW_MAX / 2);
/**
* Build a head + tail diagnostic snippet from a long rawText, with a
* quantifier showing exactly how many chars were omitted in the middle.
* Used by the parse-fail body so reviewers can see both ends of the
* stream — typically the opening `response.created`/`response.in_progress`
* metadata events AND the final `response.completed` with `output_text`.
*
* Truncates on a newline boundary where possible so the head/tail pieces
* end cleanly. If no newline exists within the last 80 chars of the head
* budget, falls back to a hard cut (better than dropping content silently).
*
* @param rawText  Full raw provider response body
* @param halfBudget  Number of chars to take from each end
* @returns  Head + quantifier + tail string suitable for the diagnostic block
*/
function truncateHeadAndTail(rawText, halfBudget) {
	if (rawText.length <= halfBudget * 2) return rawText;
	const head = trimToNewline(rawText.slice(0, halfBudget), "head");
	const tail = trimToNewline(rawText.slice(rawText.length - halfBudget), "tail");
	return `${head}\n\n… [${rawText.length - head.length - tail.length} chars omitted] …\n\n${tail}`;
}
/**
* Trim a head/tail piece to the nearest clean line so the snippet
* doesn't end mid-string. For the head, finds the LAST newline in the
* piece (so we cut cleanly before the next event). For the tail, finds
* the FIRST newline that starts a "real" line (skipping the leading
* newline that sits at the start of the tail slice).
*/
function trimToNewline(piece, end) {
	if (end === "head") {
		const lastNewline = piece.lastIndexOf("\n");
		if (lastNewline === -1) return piece;
		return piece.slice(0, lastNewline);
	}
	let i = 0;
	while (i < piece.length && (piece[i] === "\n" || piece[i] === " " || piece[i] === "\r")) i += 1;
	return piece.slice(i);
}
function buildMalformedProviderFallback(input) {
	const safeProvider = sanitizeForPost(input.provider, input.secrets);
	const safeModelId = sanitizeForPost(input.modelId, input.secrets);
	const safeRaw = sanitizeForPost(input.rawText.length > MALFORMED_PROVIDER_FALLBACK_RAW_MAX ? truncateHeadAndTail(input.rawText, MALFORMED_PROVIDER_FALLBACK_HALF_BUDGET) : input.rawText, input.secrets);
	const detailsBlock = [
		"<details>",
		"<summary>📨 Raw provider response (truncated)</summary>",
		"",
		"```text",
		safeRaw.length > 0 ? safeRaw : "(empty)",
		"```",
		"",
		`Provider: \`${safeProvider}\` · Model: \`${safeModelId}\``,
		"</details>",
		""
	].join("\n");
	const headline = buildParseFailureHeadline(input.reason);
	const remediation = buildParseFailureRemediation(input.reason);
	return {
		summary: `${headline}${remediation.length > 0 ? `\n\n**Remediation:** ${remediation}` : ""}\n\n${detailsBlock}`,
		verdict: "COMMENT",
		comments: [],
		suppressedComments: [],
		parseFailed: true,
		...input.reason !== void 0 ? { parseFailureReason: input.reason } : {}
	};
}
/**
* Render the parse-failure headline. Lives in `live-shared.ts` so every
* layout that consumes the fallback review (severity-table, verdict-
* banner, release-notes, etc.) gets the same wording without each
* layout having to know about ParseFailureReason. The headline is the
* single sentence that says "what happened" in the parse-fail banner.
*/
function buildParseFailureHeadline(reason) {
	if (reason?.kind === "truncated") return "Provider response stream was truncated before the model emitted its final `response.completed` event.";
	return "Provider response did not contain a valid JSON review payload.";
}
/**
* Render the actionable remediation line. Empty for the malformed case
* because there's no automatic fix — only "the model returned bad data,
* file a bug". The truncated case carries concrete advice: raise
* --max-output-tokens and retry.
*/
function buildParseFailureRemediation(reason) {
	if (reason?.kind !== "truncated") return "";
	const usagePct = reason.usage?.output_tokens !== void 0 && reason.maxOutputTokens !== void 0 && reason.maxOutputTokens > 0 ? Math.round(reason.usage.output_tokens / reason.maxOutputTokens * 100) : null;
	return `The output was likely cut off by the model's token budget${reason.usage?.output_tokens !== void 0 ? ` (model emitted ${reason.usage.output_tokens} output tokens${usagePct !== null ? ` ≈ ${usagePct}% of the configured cap` : ""})` : ""}. Try raising \`--max-output-tokens\` and re-running. If the model consistently exceeds the cap, split the diff into smaller chunks.`;
}
/**
* Fallback review when the PR's diff touches more than
* `reviewFileLimit` files. We skip the chunked review path entirely
* and surface a clear "diff too large to review" verdict rather than
* feeding the LLM arbitrarily-large per-file chunks (which produces
* hallucinated findings that look substantive but aren't grounded in
* the code).
*
* The user can override the cap via `--review-file-limit N` (or
* `REVIEW_FILE_LIMIT=N`) — set to 0 to disable the limit and accept
* whatever the model produces.
*/
function buildTooLargeFallback(input) {
	const safeProvider = sanitizeForPost(input.provider, input.secrets);
	const safeModelId = sanitizeForPost(input.modelId, input.secrets);
	return {
		summary: [
			`This PR changes \`${input.fileCount}\` files, which is more than the configured \`--review-file-limit\` of \`${input.reviewFileLimit}\`.`,
			"",
			"Live review is intentionally skipped on very large diffs because the per-chunk LLM reviews produce hallucinated findings that aren't grounded in the code.",
			"",
			"**To enable review on this PR:**",
			"",
			`- Raise the limit: \`--review-file-limit ${input.fileCount}\` (or set \`REVIEW_FILE_LIMIT=${input.fileCount}\`).`,
			"- Or split this PR into smaller PRs.",
			"",
			"The merge gate is unaffected — this is a review-quality choice, not a policy decision.",
			"",
			`Provider: \`${safeProvider}\` · Model: \`${safeModelId}\``
		].join("\n"),
		verdict: "COMMENT",
		comments: [],
		suppressedComments: []
	};
}
/**
* Internal variant of `selectPostableComments` that accepts a
* pre-computed `DiffPositionIndex`. Use this when the caller has
* already parsed the diff (e.g. `preparePostedReview` calls
* `selectPostableComments`, `selectOffDiffComments`, and
* `countSuppressedComments` in sequence, and each was previously
* re-parsing the same diff). Eliminating the duplicate parse is a
* meaningful win for large PRs — a 5000-line diff parses in
* single-digit ms, but `preparePostedReview` was doing it 3x
* per review.
*/
function selectPostableCommentsWithPositions(input) {
	const maxComments = input.parsed.maxComments ?? DEFAULT_MAX_COMMENTS;
	const comments = [];
	for (const comment of input.review.comments) {
		if (comments.length >= maxComments) break;
		if (!input.positions.hasPosition(comment)) continue;
		if (!passesSeverityPolicy(comment, input.parsed)) continue;
		comments.push({
			...comment,
			body: sanitizeForPost(comment.body, input.secrets)
		});
	}
	return comments;
}
/**
* Internal variant of `selectOffDiffComments` that accepts a
* pre-computed `DiffPositionIndex`. See
* `selectPostableCommentsWithPositions` for the rationale.
*/
function selectOffDiffCommentsWithPositions(review, positions) {
	return review.comments.filter((comment) => !positions.hasPosition(comment));
}
/**
* The shared GitHub/Azure live-post preparation recipe. Computes the
* postable comments, off-diff comments, suppressed comment count, severity
* counts, and the review body in one place so both `runGithubLive` and
* `runAzureLive` produce identical postable lists and identical review
* bodies for identical inputs.
*
* Callers should use this helper rather than re-running `selectPostableComments`,
* `selectOffDiffComments`, `countBySeverity`, and `buildReviewBody` inline,
* which was the previous source of drift between the two platforms.
*/
function preparePostedReview(input) {
	const positions = parseDiffPositions(input.diffText);
	const postableComments = selectPostableCommentsWithPositions({
		review: input.review,
		positions,
		parsed: input.parsed,
		secrets: input.secrets
	});
	const offDiffFromComments = selectOffDiffCommentsWithPositions(input.review, positions);
	const suppressedCommentCount = input.review.suppressedComments.length + offDiffFromComments.length;
	const severityCounts = countBySeverity(postableComments);
	const effectiveVerdict = reconcileVerdictForEmptySeverityCounts(input.review.verdict, severityCounts);
	return {
		postableComments,
		offDiffFromComments,
		suppressedCommentCount,
		severityCounts,
		body: buildReviewBody({
			review: {
				...input.review,
				verdict: effectiveVerdict
			},
			provider: input.provider,
			modelId: input.modelId,
			validCommentCount: postableComments.length,
			suppressedCommentCount,
			offDiffFromComments,
			severityCounts,
			postedComments: postableComments,
			secrets: input.secrets,
			minimumSeverity: input.parsed.minimumSeverity
		}),
		postedComments: postableComments,
		effectiveVerdict
	};
}
/**
* Map a review verdict to a GitHub review-submission event. Delegates to
* `src/util/verdict.ts` so the merge-path verdict-rank table and the
* live-path event mapping share the same canonical definitions.
*/
const mapReviewVerdictToGithubEvent = mapVerdictToGithubEvent;
/**
* Map a review verdict to an Azure DevOps PR-status `state` value.
*
* State values per Microsoft Learn:
*   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/create?view=azure-devops-rest-7.1
*   "State of the status."  (notSet | pending | succeeded | failed | error | notApplicable)
*
* Policy (current — same as the live CLI):
*   - A failing UmActually review is a **finding**, not a merge-blocking
*     check. The merge gate is owned by the ADO branch-policy build
*     validation check (which runs the actual CI pipeline and is
*     independent of verdict semantics). Mapping `NEEDS_FIX` to
*     `"failed"` used to make the Checks panel light up red even when
*     the underlying build succeeded — that is the visual problem this
*     function fixes.
*   - `pending` means "the check ran; here is something the human
*     should look at". APPROVED / COMMENT / DISCUSS / SHIP all
*     indicate the CLI ran cleanly, so we collapse those to
*     `"succeeded"` and reserve `"pending"` for "ran and found things
*     to look at" (`NEEDS_FIX`) plus the safe-default fallthrough.
*
* Delegates to `src/util/verdict.ts` with the `"current"` policy so the
* legacy S4 RED-contract mapping (NEEDS_FIX → "failed") stays in one
* place and is selectable per call site.
*/
const mapReviewVerdictToAzureStatus = (verdict) => mapVerdictToAzureStatus(verdict, "current");
function sanitizeForPost(value, secrets) {
	return replaceSecretsLiterally(value.replace(/Authorization:\s*[^\r\n]*/giu, REDACTED_AUTHORIZATION_HEADER).replace(/\bBearer\s+\S+/giu, REDACTED_BEARER_TOKEN), secrets);
}
async function readTextResponse(response) {
	try {
		return await response.text();
	} catch (error) {
		throw new LiveReviewError("HTTP_RESPONSE_READ_FAILED", "Failed to read REST response body.", { cause: error });
	}
}
async function readJsonResponse(response) {
	const text = await readTextResponse(response);
	if (text.length === 0) return null;
	try {
		return JSON.parse(text);
	} catch (error) {
		if (error instanceof SyntaxError) throw new LiveReviewError("HTTP_JSON_PARSE_FAILED", "REST response was not valid JSON.", { cause: error });
		throw error;
	}
}
function readResponseId(value) {
	if (!isRecord(value)) return;
	const id = value["id"];
	return isSafeInteger(id) ? id : void 0;
}
function ensureHttpOk(response, code, action, hint) {
	if (response.ok) return;
	response.clone().text().then((text) => {
		if (text.length === 0) return;
		const snippet = truncateBodyForLog(text, 500);
		process.stderr.write(`::debug::${BRAND_PREFIX}${action} HTTP ${response.status} body=${snippet}\n`);
	}).catch(() => {});
	const errorOptions = hint === void 0 ? void 0 : { hint };
	throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`, errorOptions);
}
function passesSeverityPolicy(comment, parsed) {
	const minimum = parsed.minimumSeverityInternal;
	if (minimum === null) return true;
	const normalized = normalizeProviderSeverity(comment.severity, comment.body);
	return shouldKeepFinding({ minimum }, normalized);
}
//#endregion
//#region src/cli/live-azure.ts
async function runAzureLive(input) {
	const { context, diffText, provider, parsed, fetchImpl } = input;
	const prepared = preparePostedReview({
		review: provider.review,
		provider: provider.provider,
		modelId: provider.modelId,
		diffText,
		parsed,
		secrets: [context.token]
	});
	const { postableComments: comments, body } = prepared;
	const existingThreads = await listAzureThreads(context, fetchImpl);
	const oldParent = findExistingParentPrComment(existingThreads);
	if (oldParent !== null && typeof oldParent.thread.id === "number") await deleteParentThreadComments({
		context,
		fetchImpl,
		threadId: oldParent.thread.id,
		commentIds: threadCommentIds(oldParent.thread)
	});
	const postedInlines = [];
	const postedIds = [];
	const failedIndices = [];
	for (let index = 0; index < comments.length; index += 1) {
		const comment = comments[index];
		if (comment === void 0) continue;
		if (findDuplicateThread(comment, existingThreads) !== null) continue;
		try {
			const result = await postAzureThread({
				context,
				fetchImpl,
				comment,
				body,
				parentThreadId: void 0
			});
			if (result !== void 0) {
				postedIds.push(result.threadId);
				postedInlines.push({
					...result,
					comment
				});
			}
		} catch (error) {
			failedIndices.push(index);
			const message = formatError(error);
			writeBrandedAnnotation("warning", `Azure thread ${index + 1}/${comments.length} failed (${comment.path}:${comment.line}): ${message}; continuing with remaining threads.`);
		}
	}
	const parentThreadId = (await postParentThread(context, fetchImpl, body))?.id;
	if (parentThreadId !== void 0) for (const inline of postedInlines) await patchInlineCommentWithParentRef({
		context,
		fetchImpl,
		threadId: inline.threadId,
		commentId: inline.commentId,
		parentThreadId,
		comment: inline.comment,
		secrets: [context.token]
	});
	if (postedIds.length === 0 && failedIndices.length > 0) {
		const message = `Azure review failed: 0 threads posted, ${failedIndices.length} failed`;
		writeBrandedAnnotation("error", message);
		return {
			exitCode: 1,
			posted: false,
			reviewId: void 0,
			message,
			parseWarnings: provider.parseWarnings
		};
	}
	await postAzureStatus({
		context,
		fetchImpl,
		state: mapReviewVerdictToAzureStatus(prepared.effectiveVerdict),
		description: provider.review.summary
	});
	const reviewId = parentThreadId ?? postedIds[0];
	const parseFailed = provider.review.parseFailed === true;
	const successMessage = failedIndices.length > 0 ? `posted Azure review (${postedIds.length} threads, ${failedIndices.length} failed)${parseFailed ? " (parse failed)" : ""}` : `posted Azure review (${postedIds.length} threads)${parseFailed ? " (parse failed)" : ""}`;
	return {
		exitCode: parseFailed ? 1 : 0,
		posted: true,
		reviewId,
		message: successMessage,
		inlineThreadCount: postedIds.length,
		verdict: prepared.effectiveVerdict,
		parseFailed,
		parseWarnings: provider.parseWarnings
	};
}
/**
* Return every comment id on `thread` that has a numeric `id`. Used by
* `deleteParentThreadComments` to drive the per-comment Delete loop
* when the CLI replaces the existing parent thread.
*/
function threadCommentIds(thread) {
	const ids = [];
	for (const comment of thread.comments) if (isSafeInteger(comment.id)) ids.push(comment.id);
	return ids;
}
async function listAzureThreads(context, fetchImpl) {
	const response = await fetchImpl(azureThreadsUrl(context), {
		method: "GET",
		headers: azureHeaders(context.token)
	});
	ensureHttpOk(response, "AZURE_LIST_THREADS_FAILED", "Azure list PR threads", "Verify SYSTEM_ACCESSTOKEN is set and that 'Allow scripts to access the OAuth token' is enabled in pipeline settings. The token must have `Pull Request Contribute` permission on the repository.");
	const json = await readJsonResponse(response);
	if (!isRecord(json)) return [];
	const value = json["value"];
	if (!isUnknownArray(value)) return [];
	return value.map(parseAzureThread).filter((thread) => thread !== null);
}
/**
* Locate the existing parent PR-level marker thread (one whose
* `threadContext` is null and whose first comment carries our stable
* marker) so we can sweep its comments and replace it with a fresh
* thread whose id sits at the top of the conversation timeline.
*
* Returns the thread + its first comment for diagnostic logging;
* `threadCommentIds(thread)` enumerates every comment for the
* per-comment Delete loop. See
* https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/delete?view=azure-devops-rest-7.1
*/
function findExistingParentPrComment(threads) {
	for (const thread of threads) {
		if (thread.threadContext !== null) continue;
		const firstComment = thread.comments[0];
		if (firstComment === void 0) continue;
		if (!commentBodyHasMarker(firstComment.content)) continue;
		return {
			thread,
			comment: firstComment
		};
	}
	return null;
}
/**
* Post a free-form, PR-level (issue-style) review summary as the
* TOPMOST card in the ADO PR conversation. Uses the documented
* "Comment on the pull request" pattern from the Pull Request
* Threads - Create endpoint: same `/threads` URL, but the body
* OMITS `threadContext`. ADO renders that shape as a top-level
* conversation card rather than a file-pinned inline thread.
*
* The parent is POSTed LAST in the run (after every inline thread),
* so its thread id is the highest on the PR. The ADO PR Overview
* sorts threads by `id` descending in the default view, so the
* parent review summary sits at the top of the conversation. See
* the docstring in `runAzureLive` for the full ordering rationale.
*
* Best-effort: a parent POST failure is logged and the run still
* succeeds as long as at least one inline thread landed.
*/
async function postParentThread(context, fetchImpl, body) {
	try {
		const response = await fetchImpl(azureThreadsUrl(context), {
			method: "POST",
			headers: azureHeaders(context.token),
			body: JSON.stringify({
				comments: [{
					parentCommentId: 0,
					content: body,
					commentType: 1
				}],
				status: 1
			})
		});
		ensureHttpOk(response, "AZURE_CREATE_PR_COMMENT_FAILED", "Azure create PR comment", "Verify SYSTEM_ACCESSTOKEN is set and the pipeline job has access to the OAuth token. The token needs `Pull Request Contribute` on the target repository.");
		const created = readResponseId(await readJsonResponse(response));
		return created === void 0 ? void 0 : { id: created };
	} catch (error) {
		writeBrandedAnnotation("warning", `Azure parent PR comment POST failed (${formatError(error)}); continuing with inline threads only.`);
		return;
	}
}
/**
* Delete every comment on the existing parent thread so ADO flips
* the thread itself to `isDeleted: true` (per
* https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/delete?view=azure-devops-rest-7.1
* — "Specify if the thread is deleted which happens when all
* comments are deleted"). The conversation UI hides `isDeleted: true`
* threads, so a stale parent from a previous run never lingers in
* the user's view.
*
* Best-effort: a per-comment DELETE failure is logged as a warning
* and skipped so the inline-thread loop below can still go out.
*/
async function deleteParentThreadComments(input) {
	for (const commentId of input.commentIds) {
		if (!isSafeInteger(commentId)) continue;
		const url = `${azurePrBaseUrl(input.context)}/threads/${input.threadId}/comments/${commentId}?api-version=7.1`;
		try {
			const response = await input.fetchImpl(url, {
				method: "DELETE",
				headers: azureHeaders(input.context.token)
			});
			if (!response.ok && response.status !== 204) await surfaceAzureHttpError({
				response,
				action: `Azure delete parent thread ${input.threadId} comment ${commentId}`,
				level: "warning"
			});
		} catch (error) {
			const message = formatError(error);
			writeBrandedAnnotation("warning", `Azure delete parent thread ${input.threadId} comment ${commentId} threw (${message}); continuing.`);
		}
	}
}
/**
* PATCH an inline thread's first comment to inject the textual
* "Reply to PR review summary #PARENT_ID" reference. The inline
* thread was POSTed without that text (so the parent could be
* POSTed last and the inline body could reference the new id).
*
* The PATCH uses the documented Pull Request Thread Comments -
* Update endpoint:
*   PATCH .../threads/{threadId}/comments/{commentId}?api-version=<AZURE_API_VERSION>
* with `content` (and the existing `id` to keep the comment).
* See https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/update?view=azure-devops-rest-7.1
*
* Best-effort: a PATCH failure is logged and the run still succeeds.
*/
async function patchInlineCommentWithParentRef(input) {
	if (input.comment === void 0) return;
	const content = buildInlineCommentBody({
		comment: input.comment,
		secrets: input.secrets,
		includeMarker: true,
		parentThreadId: input.parentThreadId
	});
	const url = `${azurePrBaseUrl(input.context)}/threads/${input.threadId}/comments/${input.commentId}?api-version=7.1`;
	try {
		const response = await input.fetchImpl(url, {
			method: "PATCH",
			headers: azureHeaders(input.context.token),
			body: JSON.stringify({ content })
		});
		if (!response.ok) await surfaceAzureHttpError({
			response,
			action: `Azure patch inline thread ${input.threadId} comment ${input.commentId}`,
			level: "warning"
		});
	} catch (error) {
		const message = formatError(error);
		writeBrandedAnnotation("warning", `Azure patch inline thread ${input.threadId} comment ${input.commentId} threw (${message}); continuing.`);
	}
}
async function postAzureThread(input) {
	const response = await input.fetchImpl(azureThreadsUrl(input.context), {
		method: "POST",
		headers: azureHeaders(input.context.token),
		body: JSON.stringify({
			comments: [{
				parentCommentId: 0,
				content: buildInlineCommentBody({
					comment: input.comment,
					secrets: [input.context.token],
					includeMarker: true,
					...input.parentThreadId !== void 0 ? { parentThreadId: input.parentThreadId } : {}
				}),
				commentType: 1
			}],
			status: 1,
			threadContext: {
				filePath: `/${input.comment.path}`,
				rightFileStart: {
					line: input.comment.line,
					offset: 1
				},
				rightFileEnd: {
					line: input.comment.line,
					offset: 1
				}
			}
		})
	});
	ensureHttpOk(response, "AZURE_CREATE_THREAD_FAILED", "Azure create PR thread", "Check (1) SYSTEM_ACCESSTOKEN has `Pull Request Contribute`, (2) the file path matches an actual changed file in the PR diff, and (3) the line number exists in the right-side of that file. A 400 here often means the line is outside the diff hunk; rerun after fetching a fresh diff.");
	const json = await readJsonResponse(response);
	if (!isRecord(json)) return;
	const threadId = readResponseId(json);
	if (threadId === void 0) return;
	const comments = json["comments"];
	if (!Array.isArray(comments) || comments.length === 0) return;
	const firstComment = comments[0];
	if (!isRecord(firstComment)) return;
	const commentId = firstComment["id"];
	if (!isSafeInteger(commentId)) return;
	return {
		threadId,
		commentId
	};
}
/**
* Context name + genre uniquely identify a status entry on the
* Pull Request Statuses collection, per Microsoft Learn:
*   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/create?view=azure-devops-rest-7.1
*
* Renamed from the legacy `"UmActually"` so that:
*   - The CLI's status entries are unambiguous (this is the CLI's
*     status, not the ADO branch-policy check).
*   - The Checks flyout groups by `(context.name, context.genre)`, so a
*     fresh entry per run groups into one cell at most.
*
* The genre stays `"pr-review"` for parity with the existing entries
* already on PR #42 (which all carry genre `"pr-review"`), so the
* dedup helper below can locate legacy entries on the very next run.
*
* The context NAME and GENRE are both sourced from `src/util/brand.ts`
* (single source of truth for the brand string and Azure-specific
* identifiers).
*/
async function postAzureStatus(input) {
	const safeDescription = sanitizeAzureStatusDescription(input.description);
	const ownStatusIds = findAllCliStatusIdsByContext(await listAzureStatuses(input.context, input.fetchImpl));
	for (const statusId of ownStatusIds) await deleteAzureStatusById({
		context: input.context,
		fetchImpl: input.fetchImpl,
		statusId
	});
	const response = await input.fetchImpl(azureStatusesUrl(input.context), {
		method: "POST",
		headers: azureHeaders(input.context.token),
		body: JSON.stringify({
			state: input.state,
			description: safeDescription,
			context: {
				name: AZURE_STATUS_CONTEXT_NAME,
				genre: AZURE_STATUS_CONTEXT_GENRE
			}
		})
	});
	if (!response.ok) {
		let bodySnippet = "(empty response body)";
		try {
			const text = await response.clone().text();
			if (text.length > 0) bodySnippet = truncateBodyForLog(text, 1e3);
		} catch {}
		writeBrandedAnnotation("error", `Azure create PR status HTTP ${response.status} body=${bodySnippet}`);
	}
	ensureHttpOk(response, "AZURE_CREATE_STATUS_FAILED", "Azure create PR status", "Verify (1) SYSTEM_ACCESSTOKEN has `Pull Request Contribute` and `Build: read` scopes, (2) 'Allow scripts to access the OAuth token' is enabled on the pipeline, and (3) the response body above (emitted as ::error::) for the exact ADO error code (e.g. TF20507 = unparseable body, 401 = token invalid).");
}
/**
* List the existing Pull Request Statuses for the configured PR.
*
* Per Microsoft Learn the response body is `{ count: number, value: Array<GitPullRequestStatus> }`.
* Each `value[i]` carries its own `context.name` + `context.genre`,
* which the CLI uses to dedup its own entries away from policy-check
* entries written by the ADO branch-policy build validation.
*
* Returns an empty array when the response body is not a JSON object,
* is missing a `value` array, or when individual entries fail to parse
* — none of which is a hard failure for the caller (a missing list
* simply means no dedup).
*/
async function listAzureStatuses(context, fetchImpl) {
	const response = await fetchImpl(azureStatusesUrl(context), {
		method: "GET",
		headers: azureHeaders(context.token)
	});
	if (!response.ok) {
		await surfaceAzureHttpError({
			response,
			action: "Azure list PR statuses",
			level: "warning"
		});
		return [];
	}
	const json = await readJsonResponse(response);
	if (!isRecord(json)) return [];
	const value = json["value"];
	if (!isUnknownArray(value)) return [];
	const entries = [];
	for (const raw of value) {
		const parsed = parseAzureStatusEntry(raw);
		if (parsed !== null) entries.push(parsed);
	}
	return entries;
}
function parseAzureStatusEntry(value) {
	if (!isRecord(value)) return null;
	const rawId = value["id"];
	if (!isSafeInteger(rawId)) return null;
	const descriptionRaw = value["description"];
	const description = typeof descriptionRaw === "string" ? descriptionRaw : "";
	const updatedDateRaw = value["updatedDate"];
	const updatedDate = typeof updatedDateRaw === "string" ? updatedDateRaw : "";
	const contextRaw = value["context"];
	if (!isRecord(contextRaw)) return null;
	const nameRaw = contextRaw["name"];
	const genreRaw = contextRaw["genre"];
	if (typeof nameRaw !== "string" || typeof genreRaw !== "string") return null;
	const stateRaw = value["state"];
	return {
		id: rawId,
		state: typeof stateRaw === "string" ? stateRaw : void 0,
		description,
		updatedDate,
		context: {
			name: nameRaw,
			genre: genreRaw
		}
	};
}
/**
* Return ALL existing entries that the CLI owns (its current context
* name + genre AND the legacy `"UmActually"` entries that pre-dated
* the rename). The legacy entries are included so a single run
* sweeps them away — without this, the 34 stale `UmActually` rows
* already on PR #42 would never collapse on their own.
*
* Unrelated statuses (e.g. the branch-policy build validation check,
* `codecoverage` quality gates, etc.) are left alone.
*/
function findAllCliStatusIdsByContext(entries) {
	const ids = [];
	for (const entry of entries) {
		if (entry.context.genre !== "pr-review") continue;
		if (entry.context.name === AZURE_STATUS_CONTEXT_NAME || entry.context.name === "UmActually") ids.push(entry.id);
	}
	return ids;
}
/**
* Delete a single Pull Request Status entry. Returns `true` when the
* delete succeeded (204 No Content), `false` on any non-2xx. Per
* Microsoft Learn the response body is empty on success:
*   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/delete?view=azure-devops-rest-7.1
*
* Best-effort: a delete failure is logged and surfaced as a warning
* on stderr, then discarded by the caller — the goal is that the new
* POST below always goes out (worst case the user sees two rows until
* the next clean run).
*/
async function deleteAzureStatusById(input) {
	const url = `${azurePrBaseUrl(input.context)}/statuses/${input.statusId}?api-version=7.1`;
	let response;
	try {
		response = await input.fetchImpl(url, {
			method: "DELETE",
			headers: azureHeaders(input.context.token)
		});
	} catch (error) {
		const message = formatError(error);
		writeBrandedAnnotation("warning", `Azure delete PR status ${input.statusId} threw (${message}); continuing.`);
		return false;
	}
	if (response.status === 204 || response.ok) return true;
	await surfaceAzureHttpError({
		response,
		action: `Azure delete PR status ${input.statusId}`,
		level: "warning"
	});
	return false;
}
/**
* Best-effort helper that mirrors the body-snippet pattern used by
* `ensureHttpOk` and `postAzureStatus`, but routes through the chosen
* log level prefix (`::warning::` for non-fatal cleanup calls,
* `::error::` for the POST itself). Future 4xx/5xx failures are
* diagnosable from CI logs without re-running the build.
*/
async function surfaceAzureHttpError(input) {
	let bodySnippet = "(empty response body)";
	try {
		const text = await input.response.clone().text();
		if (text.length > 0) bodySnippet = truncateBodyForLog(text, 1e3);
	} catch {}
	writeBrandedAnnotation(input.level, `${input.action} HTTP ${input.response.status} body=${bodySnippet}`);
}
/**
* Make a string safe to send as the `description` field on the ADO Pull
* Request Status POST endpoint
* (https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/create?view=azure-devops-rest-7.1).
*
* The live API rejects strings that contain LF (\u000A), CR (\u000D), or
* other ASCII control characters with HTTP 400:
*
*   TF20507: The string argument contains a character that is not valid:'u000A'.
*   Correct the argument, and then try the operation again.
*   Parameter name: Description
*
* Build #74 of PR #42 hit this when `buildMalformedProviderFallback`
* produced a multi-line `summary` (it embeds a `<details>` block with
* newline-separated lines) and the orchestrator forwarded that string
* verbatim as the status `description`. `description.slice(0, 255)` does
* not strip control characters, so the LF character reached the live API.
*
* Strategy:
*   1. Replace LF (\u000A) and CR (\u000D) with a single space so the
*      description stays a clean single-line string.
*   2. Strip other ASCII control characters (NUL, BEL, VT, FF, etc.) —
*      TAB (\u0009) is preserved because it is not flagged by the API
*      (status fields tolerate it; if the API ever rejects TAB too we
*      can extend this without touching callers).
*   3. Collapse runs of whitespace introduced by the replacements, then
*      trim leading/trailing whitespace.
*   4. Bound the result to 255 characters to match the documented
*      constraint from the existing `description.slice(0, 255)` line.
*/
function sanitizeAzureStatusDescription(value) {
	return value.replace(/[\u000A\u000D]/gu, " ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "").replace(/\s{2,}/gu, " ").trim().slice(0, 255);
}
function parseAzureThread(value) {
	if (!isRecord(value)) return null;
	const status = value["status"];
	const comments = value["comments"];
	if (typeof status !== "string" || !Array.isArray(comments)) return null;
	const hasThreadContextKey = "threadContext" in value;
	const nestedContext = value["threadContext"];
	let threadContext = null;
	if (hasThreadContextKey) {
		if (isRecord(nestedContext)) {
			const parsed = readThreadContext(nestedContext);
			if (parsed !== null) threadContext = parsed;
		}
	} else {
		const flat = readThreadContext(value);
		if (flat !== null) threadContext = flat;
	}
	const rawId = value["id"];
	return {
		id: isSafeInteger(rawId) ? rawId : void 0,
		status,
		threadContext,
		comments: comments.map(parseAzureComment).filter((comment) => comment !== null)
	};
}
function readThreadContext(record) {
	const start = readRightFileStart(record);
	const filePath = record["filePath"];
	if (typeof filePath !== "string" || start === null) return null;
	return {
		filePath,
		rightFileStart: start
	};
}
function readRightFileStart(context) {
	const start = context["rightFileStart"];
	if (!isRecord(start)) return null;
	const line = start["line"];
	return isSafeInteger(line) ? { line } : null;
}
function parseAzureComment(value) {
	if (!isRecord(value)) return null;
	const content = value["content"];
	if (typeof content !== "string") return null;
	const rawId = value["id"];
	return {
		id: isSafeInteger(rawId) ? rawId : void 0,
		content
	};
}
function azureThreadsUrl(context) {
	return `${azurePrBaseUrl(context)}/threads?api-version=7.1`;
}
function azureStatusesUrl(context) {
	return `${azurePrBaseUrl(context)}/statuses?api-version=7.1`;
}
//#endregion
//#region src/cli/live-github.ts
const GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") || "https://api.github.com";
async function runGithubLive(input) {
	const { context, diffText, provider, parsed, fetchImpl } = input;
	const prepared = preparePostedReview({
		review: provider.review,
		provider: provider.provider,
		modelId: provider.modelId,
		diffText,
		parsed,
		secrets: [context.token]
	});
	const { postableComments: comments, body } = prepared;
	const postableComments = comments.map((comment) => ({
		path: comment.path,
		line: comment.line,
		side: "RIGHT",
		body: buildInlineCommentBody({
			comment,
			secrets: [context.token]
		})
	}));
	const existing = await findExistingMarkerReview(context, fetchImpl);
	const forceReplace = parsed.simulateFindings === true;
	if (existing !== null && !forceReplace && existing.state === "PENDING" && postableComments.length === 0) {
		const reviewId = await updateExistingReview({
			context,
			fetchImpl,
			review: existing,
			body
		});
		if (reviewId !== null) {
			const parseFailed = provider.review.parseFailed === true;
			return {
				exitCode: parseFailed ? 1 : 0,
				posted: true,
				reviewId,
				message: parseFailed ? "updated existing GitHub review (parse failed)" : "updated existing GitHub review",
				parseFailed,
				parseWarnings: provider.parseWarnings
			};
		}
	}
	if (existing !== null) await deleteExistingReview({
		context,
		fetchImpl,
		review: existing
	});
	const reviewId = await createGithubReview({
		context,
		fetchImpl,
		body,
		event: forceReplace ? "COMMENT" : mapReviewVerdictToGithubEvent(prepared.effectiveVerdict),
		comments: postableComments
	});
	const parseFailed = provider.review.parseFailed === true;
	return {
		exitCode: parseFailed ? 1 : 0,
		posted: true,
		reviewId,
		message: existing !== null ? parseFailed ? "replaced existing GitHub review (parse failed)" : "replaced existing GitHub review" : parseFailed ? "posted GitHub review (parse failed)" : "posted GitHub review",
		inlineThreadCount: postableComments.length,
		verdict: prepared.effectiveVerdict,
		parseFailed,
		parseWarnings: provider.parseWarnings
	};
}
async function findExistingMarkerReview(context, fetchImpl) {
	const response = await fetchImpl(githubReviewsUrl(context), {
		method: "GET",
		headers: githubHeaders(context.token)
	});
	ensureHttpOk(response, "GITHUB_LIST_REVIEWS_FAILED", "GitHub list reviews", "Verify GITHUB_TOKEN has `pull_requests: read` scope (or the equivalent on GitHub Enterprise), and that the PR number is correct. See https://docs.github.com/en/rest/pulls/reviews for the API contract.");
	const json = await readJsonResponse(response);
	if (!Array.isArray(json)) return null;
	for (const entry of json) {
		const review = parseExistingReview(entry);
		if (review !== null && commentBodyHasMarker(review.body) && review.state !== "DISMISSED") return review;
	}
	return null;
}
async function updateExistingReview(input) {
	try {
		ensureHttpOk(await input.fetchImpl(`${githubReviewsUrl(input.context)}/${input.review.id}`, {
			method: "PUT",
			headers: githubHeaders(input.context.token),
			body: JSON.stringify({ body: input.body })
		}), "GITHUB_UPDATE_REVIEW_FAILED", "GitHub update review", "Updates only succeed on PENDING reviews. The expected fallback is DELETE+POST (handled by the caller). If you see this on a fresh run, check that the bot token has `pull_requests: write`.");
		return input.review.id;
	} catch (error) {
		if (error instanceof LiveReviewError && error.code === "GITHUB_UPDATE_REVIEW_FAILED") {
			writeBrandedAnnotation("warning", `failed to update existing GitHub review ${input.review.id} (likely already submitted); falling back to DELETE+POST.`);
			return null;
		}
		throw error;
	}
}
async function deleteExistingReview(input) {
	const response = await input.fetchImpl(`${githubReviewsUrl(input.context)}/${input.review.id}`, {
		method: "DELETE",
		headers: githubHeaders(input.context.token)
	});
	if (response.status === 204 || response.status === 404) return;
	writeBrandedAnnotation("warning", `failed to delete existing review ${input.review.id} (${response.status}); posting new review anyway.`);
}
async function createGithubReview(input) {
	const request = {
		commit_id: input.context.headSha,
		body: input.body,
		event: input.event,
		comments: input.comments
	};
	const response = await input.fetchImpl(githubReviewsUrl(input.context), {
		method: "POST",
		headers: githubHeaders(input.context.token),
		body: JSON.stringify(request)
	});
	ensureHttpOk(response, "GITHUB_CREATE_REVIEW_FAILED", "GitHub create review", "Check (1) GITHUB_TOKEN has `pull_requests: write` scope, (2) the commit SHA matches the head of the PR, and (3) every comment path+line exists in the diff. The most common cause is a stale SHA; rerun on a fresh `pull_request` event.");
	return readResponseId(await readJsonResponse(response));
}
function parseExistingReview(value) {
	if (!isRecord(value)) return null;
	const id = value["id"];
	const body = value["body"];
	const state = value["state"];
	if (isSafeInteger(id) && typeof body === "string" && typeof state === "string") return {
		id,
		body,
		state
	};
	return null;
}
function githubReviewsUrl(context) {
	const owner = encodeURIComponent(context.repo.owner);
	const repo = encodeURIComponent(context.repo.name);
	return `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/pulls/${context.prNumber}/reviews`;
}
//#endregion
//#region src/cli/live-merge.ts
/**
* Merge per-chunk LiveProviderOutcome values into one. Pure function —
* safe to test without I/O.
*
* Empty input returns an empty (COMMENT) review with no comments and
* no summary so the post path can still complete (e.g. when every
* chunk returned a parse-fail fallback).
*/
/**
* Aggregate the per-chunk verified-facts filter results into a single
* result for the merged outcome. Concatenates kept/downgraded lists
* across chunks and emits global indices.
*
* **Index semantics**: the `index` on each `downgradeReasons` entry
* points into the AGGREGATED kept+downgraded arrays (in that
* concatenation order), NOT into the post-dedup/post-sort/
* post-truncate `review.comments` array that the operator sees in
* the final review body. The dedup + sort + truncate step in
* `mergeReviewResults` does not remap the indices. Callers that
* want to correlate a downgrade reason back to a specific finding
* MUST use `(path, line)` — the index is an internal aid for the
* audit artifact's order, not a stable handle into the visible
* review. Pinned by `test/unit/live-merge.test.ts` (the
* MERGE-CONFIDENCE / MERGE-FACTSAGG test cases).
*/
function aggregateVerifiedFactsFilter(outcomes) {
	const kept = [];
	const downgraded = [];
	const downgradeReasons = [];
	let globalIndex = 0;
	for (const o of outcomes) {
		for (const c of o.verifiedFactsFilter.kept) {
			kept.push(c);
			globalIndex += 1;
		}
		for (let i = 0; i < o.verifiedFactsFilter.downgraded.length; i += 1) {
			const c = o.verifiedFactsFilter.downgraded[i];
			const reason = o.verifiedFactsFilter.downgradeReasons[i]?.reason ?? "";
			if (c === void 0) continue;
			downgraded.push(c);
			downgradeReasons.push({
				index: globalIndex,
				reason
			});
			globalIndex += 1;
		}
	}
	return {
		kept,
		downgraded,
		downgradeReasons
	};
}
/**
* Aggregate the per-chunk confidence-filter results. Mirrors the
* verified-facts aggregation above so the merged outcome's
* confidenceFilter field has the same shape as any single-chunk
* outcome's confidenceFilter.
*
* **Index semantics** (same as `aggregateVerifiedFactsFilter`):
* `reasons[].index` points into the aggregated kept+downgraded
* arrays in concatenation order, NOT into the post-dedup/
* post-sort/post-truncate `review.comments` array. Callers
* correlating a reason to a finding must use `(path, line)`.
*/
function aggregateConfidenceFilter(outcomes) {
	const kept = [];
	const downgraded = [];
	const reasons = [];
	let globalIndex = 0;
	for (const o of outcomes) {
		if (o.confidenceFilter === void 0) {
			for (const c of o.review.comments) {
				kept.push(c);
				globalIndex += 1;
			}
			continue;
		}
		for (const c of o.confidenceFilter.kept) {
			kept.push(c);
			globalIndex += 1;
		}
		for (let i = 0; i < o.confidenceFilter.downgraded.length; i += 1) {
			const c = o.confidenceFilter.downgraded[i];
			const reasonRecord = o.confidenceFilter.reasons[i];
			if (c === void 0 || reasonRecord === void 0) continue;
			downgraded.push(c);
			reasons.push({
				index: globalIndex,
				reason: reasonRecord.reason,
				explanation: reasonRecord.explanation
			});
			globalIndex += 1;
		}
	}
	return {
		kept,
		downgraded,
		reasons
	};
}
function mergeReviewResults(outcomes, options) {
	const maxComments = options?.maxComments ?? DEFAULT_MAX_COMMENTS;
	if (outcomes.length === 0) return {
		review: {
			summary: "",
			verdict: "COMMENT",
			comments: [],
			suppressedComments: []
		},
		endpoint: "",
		provider: "",
		modelId: "",
		severityWarnings: [],
		parseWarnings: [],
		verifiedFactsFilter: {
			kept: [],
			downgraded: [],
			downgradeReasons: []
		},
		confidenceFilter: {
			kept: [],
			downgraded: [],
			reasons: []
		}
	};
	const first = outcomes[0];
	const dedupedComments = /* @__PURE__ */ new Map();
	const dedupedSuppressed = /* @__PURE__ */ new Map();
	for (const outcome of outcomes) {
		for (const comment of outcome.review.comments) {
			const key = `${comment.path}:${comment.line}`;
			const existing = dedupedComments.get(key);
			if (existing === void 0 || severityRank(comment.severity) > severityRank(existing.severity)) dedupedComments.set(key, comment);
		}
		for (const suppressed of outcome.review.suppressedComments) {
			const key = `${suppressed.path}:${suppressed.line}`;
			const existing = dedupedSuppressed.get(key);
			if (existing === void 0 || severityRank(suppressed.severity) > severityRank(existing.severity)) dedupedSuppressed.set(key, suppressed);
		}
	}
	const truncatedComments = [...dedupedComments.values()].sort((a, b) => {
		const rankDelta = severityRank(b.severity) - severityRank(a.severity);
		if (rankDelta !== 0) return rankDelta;
		const pathDelta = a.path.localeCompare(b.path);
		if (pathDelta !== 0) return pathDelta;
		return a.line - b.line;
	}).slice(0, maxComments);
	const sortedSuppressed = [...dedupedSuppressed.values()].sort((a, b) => a.path.localeCompare(b.path));
	let worstVerdict = "";
	let worstRank = -1;
	for (const outcome of outcomes) {
		const reconciledVerdict = reconcileVerdictForEmptySeverityCounts(outcome.review.verdict, countBySeverity(outcome.review.comments));
		const rank = verdictRank(reconciledVerdict);
		if (rank > worstRank) {
			worstRank = rank;
			worstVerdict = reconciledVerdict;
		}
	}
	let summarySource = null;
	let summarySourceLength = -1;
	let fallbackSummary = "";
	for (const outcome of outcomes) {
		const isParseFail = outcome.review.parseFailed === true;
		const hasFindings = outcome.review.comments.length > 0 || outcome.review.suppressedComments.length > 0;
		if (isParseFail || !hasFindings) {
			if (outcome.review.summary.length > fallbackSummary.length) fallbackSummary = outcome.review.summary;
			continue;
		}
		if (outcome.review.summary.length > summarySourceLength) {
			summarySource = outcome.review.summary;
			summarySourceLength = outcome.review.summary.length;
		}
	}
	const longestSummary = summarySource ?? fallbackSummary;
	const mergedParseFailed = summarySource === null;
	return {
		review: {
			summary: longestSummary,
			verdict: worstVerdict.length > 0 ? worstVerdict : "COMMENT",
			comments: truncatedComments,
			suppressedComments: sortedSuppressed,
			...mergedParseFailed ? { parseFailed: true } : {}
		},
		endpoint: first.endpoint,
		provider: first.provider,
		modelId: first.modelId,
		severityWarnings: outcomes.flatMap((o) => o.severityWarnings),
		parseWarnings: outcomes.flatMap((o) => o.parseWarnings),
		verifiedFactsFilter: aggregateVerifiedFactsFilter(outcomes),
		confidenceFilter: aggregateConfidenceFilter(outcomes)
	};
}
//#endregion
//#region src/provider/provider-error.ts
var ProviderError = class extends Error {
	code;
	endpoint;
	status;
	requestId;
	name = "ProviderError";
	/**
	* Raw provider response body for diagnostic errors (currently only
	* `code === "parse"` carries it). Surfaced to the PR-level summary card
	* so reviewers can see exactly what the model returned. `undefined` for
	* non-parse errors so the constructor signature stays compatible.
	*/
	rawText;
	/**
	* True when the parse error was caused by a truncated SSE stream —
	* the provider's response ended before the model emitted a
	* `response.completed` (or equivalent) event. Distinct from a
	* completed-but-malformed response (where the stream ended cleanly
	* but the JSON itself was structurally wrong). Surfaced in the
	* parse-fail diagnostic so reviewers can tell "raise
	* --max-output-tokens and retry" apart from "model returned bad JSON".
	* `undefined` for non-parse errors.
	*/
	truncated;
	/**
	* Token usage reported by the provider in the `response.completed`
	* event's `usage` block. Surfaced by the headroom-warning check so
	* operators can see whether the model filled its token budget
	* (explains the truncated-stream case). `undefined` when the
	* provider didn't emit usage data or the stream was truncated
	* before the completed event.
	*/
	usage;
	/**
	* Structured details when `code === "provider_error"`. Carries the
	* detection signal kind (zero-usage, error-envelope, error-doc-url)
	* and a human-readable message so downstream layers can surface
	* actionable remediation advice. `undefined` for all other error
	* codes.
	*/
	providerErrorDetails;
	constructor(code, endpoint, status, requestId, message, options) {
		super(message, options);
		this.code = code;
		this.endpoint = endpoint;
		this.status = status;
		this.requestId = requestId;
		this.rawText = options?.rawText;
		this.truncated = options?.truncated;
		this.usage = options?.usage;
		this.providerErrorDetails = options?.providerErrorDetails;
	}
};
/**
* Routing-level failure predicates intentionally diverge by boundary:
*
* - URL-candidate fallback stays inside one OpenAI-compatible provider
*   client. HTTP 404 and 400 can both mean the operator's base URL shape
*   missed the provider's route, so the client may advance to the next
*   resolved candidate without changing wire protocol.
* - Cross-protocol fallback crosses from one provider protocol family to
*   another. It fires on 404 only because the wire shape genuinely does
*   not have a route for this URL at this provider. We intentionally
*   exclude HTTP 400 even though URL-candidate fallback accepts it.
*
* 400 typically signals a payload-level error (malformed body, missing
* required field, unsupported `max_tokens` value, content-policy
* rejection). Firing cross-protocol fallback on a payload-400 would silently mask wire-shape bugs:
* an Anthropic call that 400s on an
* unsupported parameter would retry against OpenAI's wire shape (different
* body layout) and possibly succeed, with the operator seeing a successful
* review attributed to the OTHER protocol without ever knowing their
* original call was malformed.
*/
function isRoutableFailureForUrlCandidate(error) {
	return error.status === 404 || error.status === 400;
}
function isRoutableFailureForCrossProtocol(error) {
	return error.status === 404;
}
function sanitizeHttpStatus(endpoint, status) {
	return `Provider ${endpoint} responded with HTTP ${status}.`;
}
function sanitizeMessage(error, fallback) {
	if (error instanceof Error) {
		const safe = error.message.replace(/\s+/g, " ").trim();
		if (safe.length === 0) return fallback;
		if (safe.length > 160) return `${safe.slice(0, 157)}...`;
		return safe;
	}
	return fallback;
}
function isAbortError(error) {
	if (error instanceof Error) {
		if (error.name === "AbortError" || error.name === "TimeoutError") return true;
	}
	const code = readErrorCode(error);
	return code === "ABORT_ERR" || code === "23";
}
function readErrorCode(error) {
	if (typeof error !== "object" || error === null) return null;
	const code = error.code;
	return typeof code === "string" ? code : null;
}
//#endregion
//#region src/provider/copilot-token.ts
const TOKEN_REFRESH_SKEW_SECONDS = 60;
const tokenCache = /* @__PURE__ */ new Map();
async function fetchAndCacheSessionToken(githubToken, tokenUrl, tokenHeaders, fetchImpl, endpoint, requestId) {
	let response;
	try {
		response = await fetchImpl(tokenUrl, {
			method: "GET",
			headers: tokenHeaders
		});
	} catch (error) {
		if (isAbortError(error)) return {
			ok: false,
			error: new ProviderError("timeout", endpoint, null, requestId, `Request to provider ${endpoint} timed out while fetching session token.`)
		};
		return {
			ok: false,
			error: new ProviderError("network", endpoint, null, requestId, sanitizeMessage(error, "Network error fetching Copilot session token."), { cause: error })
		};
	}
	if (!response.ok) return {
		ok: false,
		error: new ProviderError("chat_4xx", endpoint, response.status, requestId, `Copilot session token endpoint responded with HTTP ${response.status}.`)
	};
	let rawText;
	try {
		rawText = await response.text();
	} catch (error) {
		return {
			ok: false,
			error: new ProviderError("parse", endpoint, response.status, requestId, sanitizeMessage(error, "Failed to read Copilot session token body."), { cause: error })
		};
	}
	const envelope = tryParseJson(rawText);
	if (!isRecord(envelope)) return {
		ok: false,
		error: new ProviderError("parse", endpoint, response.status, requestId, "Copilot session token response was not a JSON object.")
	};
	const token = readStringField$1(envelope, "token");
	const expiresAt = readSafeIntegerField(envelope, "expires_at");
	const endpoints = readRecordField(envelope, "endpoints");
	const chatApiBase = endpoints === null ? null : readStringField$1(endpoints, "api");
	if (token === null || expiresAt === null || chatApiBase === null) return {
		ok: false,
		error: new ProviderError("parse", endpoint, response.status, requestId, "Copilot session token envelope was missing required fields.")
	};
	const cacheKey = buildCacheKey(githubToken);
	tokenCache.set(cacheKey, {
		token,
		expiresAt,
		apiBase: chatApiBase
	});
	return {
		ok: true,
		session: {
			token,
			apiBase: chatApiBase
		}
	};
}
function getCachedSessionToken(githubToken) {
	const cacheKey = buildCacheKey(githubToken);
	const cached = tokenCache.get(cacheKey);
	if (cached === void 0) return;
	if (Date.now() / 1e3 + TOKEN_REFRESH_SKEW_SECONDS >= cached.expiresAt) return;
	return {
		token: cached.token,
		apiBase: cached.apiBase
	};
}
function buildCacheKey(githubToken) {
	return githubToken;
}
//#endregion
//#region src/provider/copilot.ts
const COPILOT_EDITOR_VERSION = "vscode/1.96.0";
const COPILOT_EDITOR_PLUGIN_VERSION = `${BRAND}/0.1.0`;
const COPILOT_INTEGRATION_ID = "vscode-chat";
const COPILOT_USER_AGENT = `${BRAND}/0.1.0`;
const ENDPOINT_CHAT$1 = "chat";
async function runCopilotRequest(config) {
	const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
	const requestId = createRequestId();
	const sessionResult = await resolveSession(config.githubToken, config.apiBase, fetchImpl, requestId);
	if (!sessionResult.ok) return {
		ok: false,
		error: sessionResult.error
	};
	return runChatCall(config, fetchImpl, requestId, sessionResult.session);
}
async function resolveSession(githubToken, apiBase, fetchImpl, requestId) {
	const cached = getCachedSessionToken(githubToken);
	if (cached !== void 0) return {
		ok: true,
		session: cached
	};
	return fetchAndCacheSessionToken(githubToken, buildTokenUrl(normalizeApiBase(apiBase)), buildTokenHeaders(githubToken), fetchImpl, ENDPOINT_CHAT$1, requestId);
}
async function runChatCall(config, fetchImpl, requestId, session) {
	const url = joinUrl(session.apiBase, "/chat/completions");
	const body = buildChatBody({
		model: config.model,
		system: config.system,
		user: config.user,
		...config.maxOutputTokens !== void 0 ? { maxOutputTokens: config.maxOutputTokens } : {},
		...config.reasoningEffort !== void 0 ? { reasoningEffort: config.reasoningEffort } : {},
		...config.responseFormat !== void 0 ? { responseFormat: config.responseFormat } : {}
	});
	const signal = composeSignal(void 0, config.requestTimeoutMs);
	let response;
	try {
		response = await fetchImpl(url, {
			method: "POST",
			headers: buildChatHeaders(session.token),
			body: JSON.stringify(body),
			signal
		});
	} catch (error) {
		if (isAbortError(error)) return {
			ok: false,
			error: new ProviderError("timeout", ENDPOINT_CHAT$1, null, requestId, `Request to provider ${ENDPOINT_CHAT$1} timed out after ${config.requestTimeoutMs}ms.`)
		};
		return {
			ok: false,
			error: new ProviderError("network", ENDPOINT_CHAT$1, null, requestId, sanitizeMessage(error, `Network error contacting provider ${ENDPOINT_CHAT$1}.`), { cause: error })
		};
	}
	if (!response.ok) return {
		ok: false,
		error: new ProviderError("chat_4xx", ENDPOINT_CHAT$1, response.status, requestId, sanitizeHttpStatus(ENDPOINT_CHAT$1, response.status))
	};
	let rawText;
	try {
		rawText = await response.text();
	} catch (error) {
		return {
			ok: false,
			error: new ProviderError("parse", ENDPOINT_CHAT$1, response.status, requestId, sanitizeMessage(error, "Failed to read provider response body."), { cause: error })
		};
	}
	const review = parseReviewPayload(extractTextPayload(ENDPOINT_CHAT$1, rawText));
	if (isNonEmptyReview(review)) return {
		ok: true,
		endpoint: ENDPOINT_CHAT$1,
		review,
		requestId
	};
	const providerError = detectProviderError(rawText);
	if (providerError !== null) return {
		ok: false,
		error: new ProviderError("provider_error", ENDPOINT_CHAT$1, response.status, requestId, providerError.message, {
			rawText,
			providerErrorDetails: providerError
		})
	};
	const retryBody = buildChatBody({
		model: config.model,
		system: config.system,
		user: config.user,
		...config.maxOutputTokens !== void 0 ? { maxOutputTokens: config.maxOutputTokens } : {},
		...config.reasoningEffort !== void 0 ? { reasoningEffort: config.reasoningEffort } : {}
	}, { userOverride: PARSE_FAIL_RETRY_PROMPT });
	let retryResponse;
	try {
		retryResponse = await fetchImpl(url, {
			method: "POST",
			headers: buildChatHeaders(session.token),
			body: JSON.stringify(retryBody),
			signal
		});
	} catch {
		return {
			ok: false,
			error: new ProviderError("parse", ENDPOINT_CHAT$1, response.status, requestId, "Provider response did not contain a JSON review payload.", { rawText })
		};
	}
	if (!retryResponse.ok) return {
		ok: false,
		error: new ProviderError("parse", ENDPOINT_CHAT$1, retryResponse.status, requestId, `Provider self-healing retry failed with status ${retryResponse.status}; original parse error remains the root cause.`, { rawText })
	};
	const retryRawText = await retryResponse.text();
	const retryTextPayload = extractTextPayload(ENDPOINT_CHAT$1, retryRawText);
	let retryReview = null;
	const parsedRetry = parseReviewPayload(retryTextPayload);
	if (isNonEmptyReview(parsedRetry)) retryReview = parsedRetry;
	if (retryReview === null) {
		const diagnosis = diagnoseParseFailure({ rawText });
		return {
			ok: false,
			error: new ProviderError("parse", ENDPOINT_CHAT$1, response.status, requestId, "Provider response did not contain a JSON review payload after self-healing retry.", {
				rawText,
				truncated: diagnosis.truncated,
				...diagnosis.usage !== void 0 ? { usage: diagnosis.usage } : {}
			})
		};
	}
	return {
		ok: true,
		endpoint: ENDPOINT_CHAT$1,
		review: retryReview,
		requestId
	};
}
function buildTokenHeaders(githubToken) {
	return {
		authorization: `token ${githubToken}`,
		accept: "application/json",
		"editor-version": COPILOT_EDITOR_VERSION,
		"editor-plugin-version": COPILOT_EDITOR_PLUGIN_VERSION,
		"copilot-integration-id": COPILOT_INTEGRATION_ID,
		"user-agent": COPILOT_USER_AGENT
	};
}
function buildChatHeaders(sessionToken) {
	return {
		authorization: `Bearer ${sessionToken}`,
		"content-type": "application/json",
		"editor-version": COPILOT_EDITOR_VERSION,
		"editor-plugin-version": COPILOT_EDITOR_PLUGIN_VERSION,
		"copilot-integration-id": COPILOT_INTEGRATION_ID,
		"user-agent": COPILOT_USER_AGENT
	};
}
function normalizeApiBase(apiBase) {
	if (apiBase === void 0 || apiBase.length === 0) return DEFAULT_GITHUB_API_BASE;
	return apiBase;
}
function buildTokenUrl(apiBase) {
	const trimmedBase = apiBase.replace(/\/+$/u, "");
	if (trimmedBase === "https://api.github.com") return `${trimmedBase}/copilot_internal/v2/token`;
	return `${trimmedBase}/api/copilot_internal/v2/token`;
}
//#endregion
//#region src/provider/openai-compatible.ts
const ENDPOINT_RESPONSES = "responses";
const ENDPOINT_CHAT = "chat";
const DEBUG_SECRET_PATTERNS = [
	/\bsk_test_[a-z_]+\b/gu,
	/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
	/\bghp_[A-Za-z0-9]{36}\b/gu
];
/**
* Project the call config down to the body shape expected by
* `buildResponsesBody` / `buildChatBody`. The strict-schema
* `responseFormat` rides along so the wire request carries the
* JSON-schema constraint when the call config provides it.
*/
function buildBodyConfig$1(config) {
	return {
		model: config.model,
		system: config.system,
		user: config.user,
		...config.maxOutputTokens !== void 0 ? { maxOutputTokens: config.maxOutputTokens } : {},
		...config.reasoningEffort !== void 0 ? { reasoningEffort: config.reasoningEffort } : {},
		...config.responseFormat !== void 0 ? { responseFormat: config.responseFormat } : {}
	};
}
/**
* Return a copy of the body config with `responseFormat` stripped.
* Used by the parse-fail self-healing retry: the first attempt
* sends the wire schema, and if the model returns prose instead of
* JSON (because the provider silently rejected the schema), the
* retry drops the schema and relies on the system prompt's prose
* "Return strict JSON only" instruction.
*/
function stripResponseFormat(config) {
	const { responseFormat: _drop, ...rest } = config;
	return rest;
}
async function runProviderRequest(config) {
	const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
	const requestId = createRequestId();
	const baseUrlCandidates = resolveProviderBaseUrlCandidates(config.baseUrl);
	if (baseUrlCandidates.length > 1) process.stderr.write(`::notice::${BRAND_PREFIX}Resolving provider base URL: trying ${baseUrlCandidates.length} candidates in order: ${baseUrlCandidates.map(redactUrlForLog).join(", ")}\n`);
	let lastAttempt = {
		ok: false,
		error: new ProviderError("network", ENDPOINT_RESPONSES, null, requestId, "No base URL candidates resolved.")
	};
	for (const candidate of baseUrlCandidates) {
		process.stderr.write(`::notice::${BRAND_PREFIX}Trying base URL: ${redactUrlForLog(candidate)}\n`);
		const firstAttempt = await runWithRetry$1(config, fetchImpl, requestId, ENDPOINT_RESPONSES, candidate);
		if (firstAttempt.ok) return firstAttempt;
		if (shouldFallback(firstAttempt.error)) {
			const chatAttempt = await runWithRetry$1(config, fetchImpl, requestId, ENDPOINT_CHAT, candidate);
			if (chatAttempt.ok) return chatAttempt;
			if (!isRoutableFailureForUrlCandidate(chatAttempt.error)) return chatAttempt;
			process.stderr.write(`::notice::${BRAND_PREFIX}Base URL ${redactUrlForLog(candidate)} returned routable failure (status=${chatAttempt.error.status}); advancing to next candidate.\n`);
			lastAttempt = chatAttempt;
			continue;
		}
		if (!isRoutableFailureForUrlCandidate(firstAttempt.error)) return firstAttempt;
		process.stderr.write(`::notice::${BRAND_PREFIX}Base URL ${redactUrlForLog(candidate)} returned routable failure (status=${firstAttempt.error.status}); advancing to next candidate.\n`);
		lastAttempt = firstAttempt;
	}
	return lastAttempt;
}
async function runWithEndpoint(config, fetchImpl, requestId, endpoint, baseUrl) {
	try {
		return await callEndpoint(config, fetchImpl, requestId, endpoint, baseUrl);
	} catch (error) {
		if (error instanceof ProviderError) return {
			ok: false,
			error
		};
		throw error;
	}
}
const RETRY_BACKOFF_MS$1 = [250, 1e3];
async function runWithRetry$1(config, fetchImpl, requestId, endpoint, baseUrl) {
	let lastFailure = null;
	for (let attempt = 0; attempt <= RETRY_BACKOFF_MS$1.length; attempt += 1) {
		if (config.signal?.aborted === true) return {
			ok: false,
			error: new ProviderError("aborted", endpoint, null, requestId, "Caller aborted the request before retry.")
		};
		const result = await runWithEndpoint(config, fetchImpl, requestId, endpoint, baseUrl);
		if (result.ok) return result;
		lastFailure = result.error;
		if (!isRetryable$1(result.error)) return result;
		if (attempt < RETRY_BACKOFF_MS$1.length) await sleep(RETRY_BACKOFF_MS$1[attempt] ?? 0);
	}
	return {
		ok: false,
		error: lastFailure ?? new ProviderError("network", endpoint, null, requestId, "Unknown retry failure.")
	};
}
function isRetryable$1(error) {
	if (error.code === "network") return true;
	if (error.code === "timeout") return true;
	return error.status === 429 || typeof error.status === "number" && error.status >= 500;
}
/**
* Self-healing follow-up message sent to the model when its first response
* could not be parsed as a JSON review payload. Some providers ignore
* `stream: false` and return an empty SSE stream; some wrap their output
* in markdown fences or prose; some omit the JSON entirely. We retry
* once with an explicit reminder before falling back to the parse-fail
* surface — that often recovers the review without operator intervention.
*
* The shared prompt constant lives in `provider-parse.ts` so the Copilot
* path can reuse it byte-for-byte (DRY-12).
*/
async function callEndpoint(config, fetchImpl, requestId, endpoint, baseUrl) {
	const url = joinUrl(baseUrl, endpoint === ENDPOINT_RESPONSES ? "/responses" : "/chat/completions");
	const response = await performFetch$1(fetchImpl, url, endpoint === ENDPOINT_RESPONSES ? buildResponsesBody(buildBodyConfig$1(config)) : buildChatBody(buildBodyConfig$1(config)), composeSignal(config.signal, config.requestTimeoutMs), config, requestId, endpoint);
	if (!response.ok) throw new ProviderError(endpoint === ENDPOINT_RESPONSES ? "responses_4xx" : "chat_4xx", endpoint, response.status, requestId, sanitizeHttpStatus(endpoint, response.status));
	const rawText = await readBody(response, endpoint, requestId);
	const textPayload = extractTextPayload(endpoint, rawText);
	if (isDebugRawActive()) {
		writeDebugRaw(`[DEBUG-RAW] requestId=${requestId} endpoint=${endpoint} rawTextLength=${rawText.length} textPayloadLength=${textPayload.length}\n`, config);
		const safeTextPayload = redactDebugSecrets(textPayload, config);
		writeDebugRaw(`[DEBUG-RAW] textPayload first 200: ${JSON.stringify(safeTextPayload.slice(0, 200))}\n`, config);
		writeDebugRaw(`[DEBUG-RAW] textPayload last 200:  ${JSON.stringify(safeTextPayload.slice(-200))}\n`, config);
		writeDebugRaw(`[DEBUG-RAW] hasResponseCompletedEvent: ${rawText.includes("\"type\":\"response.completed\"")}\n`, config);
	}
	const review = parseReviewPayload(textPayload);
	if (isDebugRawActive()) {
		writeDebugRaw(`[DEBUG-RAW] parseReviewPayload returned: ${review === null ? "null" : `summary.len=${review.summary.length} verdict='${review.verdict}' comments=${review.comments.length} suppressed=${review.suppressed_comments.length}`}\n`, config);
		writeDebugRaw(`[DEBUG-RAW] isNonEmptyReview: ${isNonEmptyReview(review)}\n`, config);
	}
	if (isNonEmptyReview(review)) return {
		ok: true,
		endpoint,
		review,
		requestId
	};
	const providerError = detectProviderError(rawText);
	if (providerError !== null) throw new ProviderError("provider_error", endpoint, response.status, requestId, providerError.message, {
		rawText,
		providerErrorDetails: providerError
	});
	const firstAttemptBodyConfig = stripResponseFormat(buildBodyConfig$1(config));
	const needsMoreBudget = rawText.length > 16e3 && textPayload.length < 200;
	const bumpedMaxOutput = needsMoreBudget && config.maxOutputTokens !== void 0 ? Math.min(config.maxOutputTokens * 2, 128e3) : config.maxOutputTokens;
	if (isDebugRawActive() && needsMoreBudget) writeDebugRaw(`[DEBUG-RAW] bumped-budget retry: rawText.length=${rawText.length} textPayload.length=${textPayload.length} bumpedMaxOutput=${bumpedMaxOutput}\n`, config);
	const retryBodyConfig = {
		...firstAttemptBodyConfig,
		...bumpedMaxOutput !== void 0 ? { maxOutputTokens: bumpedMaxOutput } : {}
	};
	const retryBody = endpoint === ENDPOINT_RESPONSES ? buildResponsesBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT }) : buildChatBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT });
	let retryReview = null;
	let retryResponseStatus = null;
	try {
		const retryResponse = await performFetch$1(fetchImpl, url, retryBody, composeSignal(config.signal, config.requestTimeoutMs), config, requestId, endpoint);
		retryResponseStatus = retryResponse.status;
		if (retryResponse.ok) {
			const retryRawText = await readBody(retryResponse, endpoint, requestId);
			const retryTextPayload = extractTextPayload(endpoint, retryRawText);
			if (isDebugRawActive()) {
				writeDebugRaw(`[DEBUG-RAW] retry requestId=${requestId} rawTextLength=${retryRawText.length} textPayloadLength=${retryTextPayload.length}\n`, config);
				const safeRetryTextPayload = redactDebugSecrets(retryTextPayload, config);
				writeDebugRaw(`[DEBUG-RAW] retry textPayload first 200: ${JSON.stringify(safeRetryTextPayload.slice(0, 200))}\n`, config);
				writeDebugRaw(`[DEBUG-RAW] retry textPayload last 200:  ${JSON.stringify(safeRetryTextPayload.slice(-200))}\n`, config);
			}
			const parsedRetry = parseReviewPayload(retryTextPayload);
			if (isNonEmptyReview(parsedRetry)) retryReview = parsedRetry;
		}
	} catch {}
	if (retryReview === null) {
		const diagnosis = diagnoseParseFailure({ rawText });
		throw new ProviderError("parse", endpoint, retryResponseStatus ?? response.status, requestId, "Provider response did not contain a JSON review payload after self-healing retry.", {
			rawText,
			truncated: diagnosis.truncated,
			...diagnosis.usage !== void 0 ? { usage: diagnosis.usage } : {}
		});
	}
	return {
		ok: true,
		endpoint,
		review: retryReview,
		requestId
	};
}
function writeDebugRaw(message, config) {
	process.stderr.write(redactDebugSecrets(message, config));
}
function redactDebugSecrets(value, config) {
	let redacted = replaceSecretsLiterally(value, [
		config.apiKey,
		config.promptOverride ?? "",
		config.additionalPromptOverride ?? ""
	]);
	for (const pattern of DEBUG_SECRET_PATTERNS) redacted = redacted.replace(pattern, REDACTED_SECRET_TOKEN);
	return redacted;
}
async function performFetch$1(fetchImpl, url, body, signal, config, requestId, endpoint) {
	try {
		return await fetchImpl(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${config.apiKey}`,
				"x-request-id": requestId
			},
			body: JSON.stringify(body),
			signal
		});
	} catch (error) {
		if (isAbortError(error)) {
			if (config.signal?.aborted === true) throw new ProviderError("aborted", endpoint, null, requestId, "Request was aborted by the caller.");
			throw new ProviderError("timeout", endpoint, null, requestId, `Request to provider ${endpoint} timed out after ${config.requestTimeoutMs}ms.`);
		}
		throw new ProviderError("network", endpoint, null, requestId, sanitizeMessage(error, `Network error contacting provider ${endpoint}.`), { cause: error });
	}
}
async function readBody(response, endpoint, requestId) {
	try {
		return await response.text();
	} catch (error) {
		throw new ProviderError("parse", endpoint, response.status, requestId, sanitizeMessage(error, "Failed to read provider response body."), { cause: error });
	}
}
function shouldFallback(error) {
	return error.status === 404 || error.status === 400;
}
//#endregion
//#region src/provider/anthropic-messages.ts
/**
* Native Anthropic Messages API client.
*
* Implements `POST {baseUrl}/v1/messages` against Anthropic's
* `/v1/messages` protocol — but with the path-prefix convention of the
* official @anthropic-ai/sdk: the operator's `baseUrl` is treated as a
* path-prefix and `/v1/messages` is appended to it (with a guard for
* the `/v1` and `/v1/messages` already-appended cases). This is the
* same convention Claude Code uses for `ANTHROPIC_BASE_URL` and the
* same fix as anthropic-sdk-kotlin's
* https://github.com/xemantic/anthropic-sdk-kotlin/pull/145.
*
* Path-preserving matters because Anthropic-compatible gateways
* commonly mount the protocol under a path prefix — the documented
* case is MiniMax's Anthropic endpoint at
* `https://api.minimax.io/anthropic`, which resolves to
* `https://api.minimax.io/anthropic/v1/messages` per
* https://platform.minimax.io/docs/token-plan/claude-code (and similar
* for the openai-compatible `/v1` endpoint at
* https://platform.minimax.io/docs/token-plan/codex). The previous
* "always strip the path" version of this helper silently 404'd that
* gateway.
*
* The wire shape differs from the OpenAI Chat Completions / Responses
* API in three meaningful ways:
*
*  1. **Auth header**: `x-api-key: <key>` (not `Authorization: Bearer ...`)
*     plus the required `anthropic-version: 2023-06-01` version pin.
*  2. **Body layout**: `system` is a top-level field, NOT a system-role
*     message inside `messages[]`. `messages[]` only carries user/assistant
*     turns.
*  3. **Response body**: success returns `content: [{type:"text", text:"..."}]`
*     and `stop_reason: "end_turn" | "max_tokens" | "tool_use" | ...`;
*     errors are nested as `{type:"error", error:{type, message}}`.
*
* Anthropic does NOT support OpenAI's `response_format: { type: "json_schema", ...}`
* constraint. The strict-JSON contract is enforced entirely by the in-context
* system prompt and the parser — same fallback the OpenAI client uses AFTER
* its `response_format`-stripped self-healing retry. So we never send
* `response_format` and never strip it.
*
* The retry / parse-fail / bumped-budget / network-retry / provider-error
* flows are shared byte-for-byte with `openai-compatible.ts` so the
* end-to-end behavior (recover from parse-fail, surface truncated-stream
* diagnostic, hard-fail on router errors) is identical regardless of which
* provider family the operator picks.
*/
const ENDPOINT = "anthropic";
const ANTHROPIC_VERSION = "2023-06-01";
const RETRY_BACKOFF_MS = [250, 1e3];
/**
* Project the call config down to the body shape expected by
* `buildAnthropicBody`. Anthropic accepts a top-level `system` field,
* not a system-role message — this projection is intentionally minimal.
*/
function buildBodyConfig(config) {
	return {
		model: config.model,
		system: config.system,
		user: config.user,
		...config.maxOutputTokens !== void 0 ? { maxOutputTokens: config.maxOutputTokens } : {},
		...config.reasoningEffort !== void 0 ? { reasoningEffort: config.reasoningEffort } : {}
	};
}
/**
* Anthropic Messages API body.
*
* Sample wire shape (curl):
*   curl https://api.anthropic.com/v1/messages \
*     -H 'x-api-key: $ANTHROPIC_API_KEY' \
*     -H 'anthropic-version: 2023-06-01' \
*     -H 'content-type: application/json' \
*     -d '{
*       "model": "claude-sonnet-4.6",
*       "max_tokens": 1024,
*       "system": "You are a code review assistant...",
*       "messages": [{"role": "user", "content": "..."}]
*     }'
*
* Notably absent (compared to the OpenAI Chat Completions body):
*   - `response_format` — Anthropic has no equivalent JSON-schema
*     constraint. The system prompt enforces strict JSON, and the parser
*     is permissive about prose-wrapped shapes.
*   - `temperature` — Anthropic does not require it; default 1.0 (was the
*     Anthropic-only behavior until `temperature` was added in 2024).
*     Including it is optional and we don't.
*   - `stream` — non-streaming JSON response; Anthropic default.
*/
function buildAnthropicBody(config, opts) {
	const userContent = opts?.userOverride !== void 0 ? `${opts.userOverride}${config.user}` : config.user;
	const body = {
		model: config.model,
		system: config.system,
		messages: [{
			role: "user",
			content: userContent
		}]
	};
	body["max_tokens"] = config.maxOutputTokens ?? 4096;
	if (config.reasoningEffort !== void 0) body["reasoning_effort"] = config.reasoningEffort;
	return body;
}
/**
* Extract the user's text payload from an Anthropic Messages response.
*
* Anthropic returns `content: [{type:"text", text:"..."}]` for
* non-streaming success responses, plus `usage` and `stop_reason`
* fields. We concatenate ALL `text` blocks (multi-block responses can
* happen when a tool_use block precedes or follows a text block) and
* ignore non-text blocks (Anthropic's tool_use is a separate content
* type we don't support).
*
* Returns the empty string when the response has no text blocks; the
* downstream `parseReviewPayload` will classify that as a parse-fail
* (per `isNonEmptyReview`), which trips the self-healing retry path.
*/
function extractAnthropicTextPayload(rawText) {
	let parsed;
	try {
		parsed = JSON.parse(rawText);
	} catch {
		return rawText;
	}
	if (!isRecord(parsed)) return rawText;
	const content = readArrayField(parsed, "content");
	if (content === null) return rawText;
	const fragments = [];
	for (const block of content) {
		if (!isRecord(block)) continue;
		if (readStringField$1(block, "type") !== "text") continue;
		const text = readStringField$1(block, "text");
		if (text !== null && text.length > 0) fragments.push(text);
	}
	return fragments.length > 0 ? fragments.join("") : rawText;
}
/**
* Read the `stop_reason` from a parsed Anthropic response. Returns
* `"max_tokens"` when the model hit its output budget, `null` otherwise
* or when the field is absent. Used by `diagnoseParseFailure` to
* distinguish "truncated stream" from "bad JSON".
*/
function readStopReason(parsed) {
	if (!isRecord(parsed)) return null;
	const stopReason = readStringField$1(parsed, "stop_reason");
	if (stopReason === null || stopReason.length === 0) return null;
	return stopReason;
}
/**
* Read the `usage` block from a parsed Anthropic response. Returns
* undefined when absent or malformed — the parse-fail diagnostic only
* surfaces usage when the provider actually reported it.
*/
function readUsage(parsed) {
	if (!isRecord(parsed)) return void 0;
	const usage = readRecordField(parsed, "usage");
	if (usage === null || !isRecord(usage)) return void 0;
	const inputTokens = readNumberField(usage, "input_tokens");
	const outputTokens = readNumberField(usage, "output_tokens");
	const totalTokens = readNumberField(usage, "total_tokens");
	if (inputTokens === void 0 && outputTokens === void 0 && totalTokens === void 0) return;
	const mutable = {};
	if (inputTokens !== void 0) mutable.input_tokens = inputTokens;
	if (outputTokens !== void 0) mutable.output_tokens = outputTokens;
	if (totalTokens !== void 0) mutable.total_tokens = totalTokens;
	return mutable;
}
function readNumberField(record, key) {
	const raw = record[key];
	if (typeof raw !== "number") return void 0;
	return raw;
}
async function runAnthropicRequest(config) {
	return runWithRetry(config, config.fetchImpl ?? globalThis.fetch.bind(globalThis), createRequestId(), resolveAnthropicMessagesUrl(config.baseUrl));
}
async function runWithRetry(config, fetchImpl, requestId, url) {
	let lastFailure = null;
	for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
		if (config.signal?.aborted === true) return {
			ok: false,
			error: new ProviderError("aborted", ENDPOINT, null, requestId, "Caller aborted the request before retry.")
		};
		const result = await runOnce(config, fetchImpl, requestId, url);
		if (result.ok) return result;
		lastFailure = result.error;
		if (!isRetryable(result.error)) return result;
		if (attempt < RETRY_BACKOFF_MS.length) await sleep(RETRY_BACKOFF_MS[attempt] ?? 0);
	}
	return {
		ok: false,
		error: lastFailure ?? new ProviderError("network", ENDPOINT, null, requestId, "Unknown Anthropic retry failure.")
	};
}
function isRetryable(error) {
	if (error.code === "network") return true;
	if (error.code === "timeout") return true;
	return error.status === 429 || typeof error.status === "number" && error.status >= 500;
}
async function runOnce(config, fetchImpl, requestId, url) {
	const body = buildAnthropicBody(buildBodyConfig(config));
	const signal = composeSignal(config.signal, config.requestTimeoutMs);
	let response;
	try {
		response = await performFetch(fetchImpl, url, body, signal, config.apiKey, requestId);
	} catch (error) {
		if (error instanceof ProviderError) return {
			ok: false,
			error
		};
		throw error;
	}
	if (!response.ok) {
		let errorBodyText = "";
		try {
			errorBodyText = await response.text();
		} catch {}
		return {
			ok: false,
			error: new ProviderError("anthropic_4xx", ENDPOINT, response.status, requestId, `Anthropic Messages API responded with HTTP ${response.status}.`, { ...errorBodyText.length > 0 ? { rawText: errorBodyText } : {} })
		};
	}
	let rawText;
	try {
		rawText = await response.text();
	} catch (error) {
		return {
			ok: false,
			error: new ProviderError("parse", ENDPOINT, response.status, requestId, sanitizeMessage(error, "Failed to read Anthropic response body."), { cause: error })
		};
	}
	const textPayload = extractAnthropicTextPayload(rawText);
	const providerError = detectProviderError(rawText);
	if (providerError !== null) return {
		ok: false,
		error: new ProviderError("provider_error", ENDPOINT, response.status, requestId, providerError.message, {
			rawText,
			providerErrorDetails: providerError
		})
	};
	const review = parseReviewPayload(textPayload);
	if (isNonEmptyReview(review)) return {
		ok: true,
		endpoint: ENDPOINT,
		review,
		requestId
	};
	let parsedStopReason = null;
	let parsedUsage;
	try {
		const parsedRaw = JSON.parse(rawText);
		parsedStopReason = readStopReason(parsedRaw);
		parsedUsage = readUsage(parsedRaw);
	} catch {}
	const truncatedByStopReason = parsedStopReason === "max_tokens";
	const bumpedMaxOutput = rawText.length > 16e3 && textPayload.length < 200 && config.maxOutputTokens !== void 0 ? Math.min(config.maxOutputTokens * 2, 128e3) : config.maxOutputTokens;
	const retryBody = buildAnthropicBody({
		...buildBodyConfig(config),
		...bumpedMaxOutput !== void 0 ? { maxOutputTokens: bumpedMaxOutput } : {}
	}, { userOverride: PARSE_FAIL_RETRY_PROMPT });
	let retryReview = null;
	let retryResponseStatus = null;
	try {
		const retryResponse = await performFetch(fetchImpl, url, retryBody, composeSignal(config.signal, config.requestTimeoutMs), config.apiKey, requestId);
		retryResponseStatus = retryResponse.status;
		if (retryResponse.ok) {
			const parsedRetry = parseReviewPayload(extractAnthropicTextPayload(await retryResponse.text()));
			if (isNonEmptyReview(parsedRetry)) retryReview = parsedRetry;
		}
	} catch {}
	if (retryReview !== null) return {
		ok: true,
		endpoint: ENDPOINT,
		review: retryReview,
		requestId
	};
	const diagnosis = diagnoseParseFailure({ rawText });
	const effectiveTruncated = truncatedByStopReason || diagnosis.truncated;
	const usage = parsedUsage ?? diagnosis.usage;
	const errorOptions = {
		rawText,
		truncated: effectiveTruncated,
		...usage !== void 0 ? { usage } : {}
	};
	return {
		ok: false,
		error: new ProviderError("parse", ENDPOINT, retryResponseStatus ?? response.status, requestId, "Anthropic response did not contain a JSON review payload after self-healing retry.", errorOptions)
	};
}
async function performFetch(fetchImpl, url, body, signal, apiKey, requestId) {
	try {
		return await fetchImpl(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
				"x-request-id": requestId
			},
			body: JSON.stringify(body),
			signal
		});
	} catch (error) {
		if (isAbortError(error)) throw new ProviderError("timeout", ENDPOINT, null, requestId, "Anthropic request timed out.");
		throw new ProviderError("network", ENDPOINT, null, requestId, sanitizeMessage(error, "Network error contacting Anthropic."), { cause: error });
	}
}
//#endregion
//#region src/cli/auto-model.ts
/**
* Layer 5: opinionated `model: "auto"` resolution.
*
* The default `auto` was previously passed verbatim to the provider,
* which on most OpenAI-compatible endpoints resolves to whatever the
* provider's "auto" picks (often gpt-4o or gpt-4-turbo). Per the
* Vectara HHEM 2026-05-11 leaderboard, those models have a 9-12%
* hallucination rate on grounded summarization tasks, vs 3-5% for
* gpt-5-mini / gemini-2.5-flash-lite / claude-haiku-4.5.
*
* PR-Agent (qodo-ai) made the same switch in 2025: their default
* went from gpt-4o to gpt-5 explicitly to reduce path fabrication.
*
* The resolver here picks a model with the best cost-vs-hallucination
* trade-off for the active provider. Hostname match (not full-URL
* match) — a URL like `https://api.minimax.io/anthropic` correctly
* routes to MiniMax-M3 because the hostname is `api.minimax.io`,
* even though the path contains "anthropic":
*   - provider=copilot  → claude-3-5-sonnet (Copilot's Claude backend;
*     this is the model string the GitHub Copilot Chat Completions
*     endpoint actually accepts — the v3.x and v3.5 Sonnet line is
*     the Copilot-routable Claude. claude-sonnet-4.6 is NOT a
*     Copilot-routable string and would 404.)
*   - provider=openai-compatible + URL hostname contains "minimax"  → MiniMax-M3
*   - provider=openai-compatible + URL hostname contains "anthropic"  → claude-sonnet-4.6
*   - provider=openai-compatible + URL hostname contains "generativelanguage" or "googleapis"  → gemini-2.5-flash
*   - provider=openai-compatible otherwise (incl. api.openai.com)  → gpt-5-mini
*
* The MiniMax branch was added when PR #28's self-review hit HTTP
* 400 on every OpenAI/Anthropic model name — the MiniMax provider
* only serves `MiniMax-M3` and `MiniMax-Text-01` (plus `abab*`
* aliases). Default is `MiniMax-M3`; `MiniMax-Text-01` is the
* fallback if M3 has a bad day. Detected by the URL hostname
* containing `minimax`.
*
* Users can always override via `--model` (or `UMACTUALLY_MODEL`).
*/
const COPILOT_DEFAULT_MODEL = "claude-3-5-sonnet";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4.6";
const GOOGLE_DEFAULT_MODEL = "gemini-2.5-flash";
const MINIMAX_DEFAULT_MODEL = "MiniMax-M3";
const OPENAI_DEFAULT_MODEL = "gpt-5-mini";
const HOST_ROUTES = [
	{
		hostSubstring: "minimax",
		model: MINIMAX_DEFAULT_MODEL
	},
	{
		hostSubstring: "anthropic",
		model: ANTHROPIC_DEFAULT_MODEL
	},
	{
		hostSubstring: "generativelanguage",
		model: GOOGLE_DEFAULT_MODEL
	},
	{
		hostSubstring: "googleapis",
		model: GOOGLE_DEFAULT_MODEL
	}
];
function resolveAutoModel(input) {
	if (input.provider === "copilot") return COPILOT_DEFAULT_MODEL;
	if (input.provider === "anthropic") return ANTHROPIC_DEFAULT_MODEL;
	const hostname = extractHostname(resolveField(input.apiUrl, input.env[ENV_KEYS.UMACTUALLY_API_URL], ""));
	if (hostname !== null) {
		const lowerHost = hostname.toLowerCase();
		for (const route of HOST_ROUTES) if (lowerHost.includes(route.hostSubstring)) return route.model;
	}
	return OPENAI_DEFAULT_MODEL;
}
({
	"openai-compatible": [
		OPENAI_DEFAULT_MODEL,
		"gpt-4.1",
		"gpt-4.1-mini",
		ANTHROPIC_DEFAULT_MODEL,
		GOOGLE_DEFAULT_MODEL
	],
	copilot: [COPILOT_DEFAULT_MODEL],
	anthropic: [
		ANTHROPIC_DEFAULT_MODEL,
		"claude-haiku-4.5",
		"claude-opus-4.6"
	]
})["openai-compatible"];
//#endregion
//#region src/cli/parse-warnings.ts
/**
* Classify and return the list of `comments` and `suppressed_comments`
* whose (path, line) pair does not anchor to the supplied diff.
*
* The diff filter (Layer 1) and the prompt grounding (Layer 2) aim to
* prevent these in the first place, but every production LLM
* review tool still encounters them at the long tail. Surfacing
* them in a structured artifact is the difference between "model
* fabricated dist/cli.js:1 and we have no idea" and "the manifest
* records exactly what the model emitted, what we filtered, and why".
*
* Reasons:
*   - `path-not-in-diff` — the model cited a path that does not appear
*     anywhere in the diff (e.g. `dist/cli.js` when dist/ was excluded
*     by the diff filter)
*   - `line-not-in-diff` — the path appears in the diff but the
*     specific line does not (off-by-one or hallucinated line number)
*   - `path-and-line-not-in-diff` — neither the path nor the line
*     matches anything in the diff
*/
function collectParseWarnings(input) {
	const positions = parseDiffPositions(input.diffText);
	const diffPaths = new Set(positions.enumerate().map((p) => p.path));
	const warnings = [];
	for (const [source, list] of [["comments", input.review.comments], ["suppressed_comments", input.review.suppressedComments]]) list.forEach((comment, index) => {
		const path = comment.path;
		const line = comment.line;
		const pathInDiff = path.length > 0 && diffPaths.has(path);
		const lineInDiff = Number.isInteger(line) && line > 0 && positions.hasPosition({
			path,
			line
		});
		if (pathInDiff && lineInDiff) return;
		const reason = !pathInDiff ? "path-not-in-diff" : "line-not-in-diff";
		warnings.push({
			reason,
			source,
			index,
			modelPath: path,
			modelLine: line,
			modelSeverity: comment.severity,
			bodyExcerpt: comment.body.length > 200 ? `${comment.body.slice(0, 200)}…` : comment.body
		});
	});
	return warnings;
}
/**
* Build the parse-warnings JSON payload. Always includes the
* `summary` counts so operators can scan the artifact for
* regressions without parsing the full array.
*/
function buildParseWarningsArtifact(input) {
	const warnings = collectParseWarnings(input);
	const byReason = {
		"path-not-in-diff": 0,
		"line-not-in-diff": 0
	};
	const bySource = {
		comments: 0,
		suppressed_comments: 0
	};
	for (const w of warnings) {
		byReason[w.reason] += 1;
		bySource[w.source] += 1;
	}
	return {
		summary: {
			totalComments: input.review.comments.length,
			totalSuppressed: input.review.suppressedComments.length,
			invalidCount: warnings.length,
			byReason,
			bySource
		},
		warnings
	};
}
//#endregion
//#region src/cli/verify-findings.ts
/**
* Layer 4: two-pass verification (opt-in via `--verify-findings`).
*
* After the first model call returns a review, run a small per-finding
* verification pass that asks the model to copy the diff lines that
* justify each finding. Findings where the model cannot produce a
* supporting quote are dropped before posting.
*
* Per the citation-grounding research:
*   - SWR-Bench (1000 PRs): multi-pass aggregation gives +43.7% F1
*   - HalluJudge (Atlassian production): Tree-of-Thoughts verifier
*     F1 = 0.85, $0.009/comment
*   - CodeRabbit: explicit "verification agent" before posting
*   - Ellipsis: Generate-then-Filter architecture; filter rejects
*     findings the generator cannot ground in evidence
*
* This implementation is intentionally narrow: a single cheap
* verification call per finding, with a strict JSON schema that
* only permits `verified: true|false` + the supporting quote (or
* empty quote for unverified). The findings list is processed in
* order; a verified=true flag is kept, anything else is dropped.
*
* Off by default. The cost is roughly 2x the per-PR review cost
* (a small per-finding call). For high-stakes repos that need the
* extra accuracy, opt in via `--verify-findings`.
*/
/**
* Pure post-filter that drops findings whose (path, line) doesn't anchor
* to the supplied diff. This is the deterministic verification — the
* cheap path that runs WITHOUT a second model call. The `--verify-findings`
* flag adds an additional model-based check on top.
*
* Useful as a standalone entry point for callers that want the
* deterministic filter without the model overhead (e.g. tests,
* dry-run, smoke tests).
*/
function verifyFindingsAgainstDiff(input) {
	const positions = parseDiffPositions(input.diffText);
	const verified = [];
	const dropped = [];
	for (const comment of input.review.comments) if (positions.hasPosition(comment)) verified.push(comment);
	else dropped.push(comment);
	return {
		verified,
		dropped
	};
}
/**
* Downgrade findings whose body contradicts a verified fact.
*
* "Contradicts" means the body asserts something is missing/absent/
* removed when the verified facts show it is present. The most common
* pattern observed in self-review (PR #41): the model claimed "dist/ is
* not in package.json#files" while the verified facts showed dist/ in
* the list.
*
* We do NOT drop these findings — we downgrade them to `info` and
* surface the reason. The operator gets full visibility into what the
* model claimed, and the downgraded severity prevents the false
* positive from blocking a PR or producing noise.
*
* Conservative: only flag clear contradiction patterns (asserting
* something is missing from a verified list). Subjective language
* like "looks unusual" is not flagged.
*/
function applyVerifiedFactsFilter(input) {
	const facts = collectVerifiedFacts(input.diffText);
	const downgradeReasons = [];
	const kept = [];
	const downgraded = [];
	for (let i = 0; i < input.review.comments.length; i += 1) {
		const comment = input.review.comments[i];
		if (comment === void 0) continue;
		const contradiction = detectVerifiedFactsContradiction(comment.body, facts);
		if (contradiction === null) kept.push(comment);
		else {
			downgradeReasons.push({
				index: i,
				reason: contradiction
			});
			downgraded.push({
				...comment,
				severity: "info"
			});
		}
	}
	return {
		kept,
		downgraded,
		downgradeReasons
	};
}
const MISSING_PHRASES = [
	"is missing",
	"is not in",
	"is not listed",
	"is not included",
	"are missing",
	"are not in",
	"are not listed",
	"are not included",
	"won't be",
	"will not be",
	"doesn't include",
	"does not include",
	"lacks",
	"absent from",
	"not present in",
	"fails to include",
	"fails to ship",
	"will not ship",
	"won't ship",
	"was removed",
	"is removed",
	"were removed",
	"are removed",
	"orphan"
];
/**
* Tokens that frequently appear in natural-language text and
* SHOULD NOT be treated as candidate identifiers for contradiction
* detection. Without this list, a sentence like "the output is
* missing" would match the bareword "output" against
* action.yml#outputs (where "output" might coincidentally be a
* key) and trigger a false-positive downgrade. We seed this with
* every common English word plus every review-action vocabulary
* word we observed in PR-#41's false positives.
*/
const STOPWORD_TOKENS = /* @__PURE__ */ new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"but",
	"if",
	"then",
	"else",
	"when",
	"while",
	"for",
	"of",
	"to",
	"in",
	"on",
	"at",
	"by",
	"from",
	"as",
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"being",
	"have",
	"has",
	"had",
	"do",
	"does",
	"did",
	"will",
	"would",
	"should",
	"could",
	"may",
	"might",
	"can",
	"must",
	"shall",
	"this",
	"that",
	"these",
	"those",
	"with",
	"into",
	"about",
	"between",
	"through",
	"during",
	"before",
	"after",
	"above",
	"below",
	"out",
	"off",
	"over",
	"under",
	"again",
	"further",
	"once",
	"here",
	"there",
	"where",
	"why",
	"how",
	"all",
	"any",
	"both",
	"each",
	"few",
	"more",
	"most",
	"other",
	"some",
	"such",
	"no",
	"nor",
	"not",
	"only",
	"own",
	"same",
	"so",
	"than",
	"too",
	"very",
	"just",
	"still",
	"now",
	"it",
	"its",
	"they",
	"them",
	"their",
	"we",
	"our",
	"us",
	"you",
	"your",
	"i",
	"me",
	"my",
	"he",
	"she",
	"his",
	"her",
	"what",
	"which",
	"who",
	"whom",
	"missing",
	"removed",
	"output",
	"outputs",
	"input",
	"inputs",
	"block",
	"list",
	"lists",
	"array",
	"field",
	"entry",
	"entries",
	"key",
	"keys",
	"value",
	"values",
	"file",
	"files",
	"directory",
	"directories",
	"include",
	"includes",
	"including",
	"exclude",
	"excludes",
	"see",
	"see-also",
	"per",
	"via",
	"downstream",
	"upstream",
	"consumers",
	"consumer",
	"consume",
	"depends",
	"depend",
	"callers",
	"caller",
	"post",
	"posted",
	"posting",
	"postable",
	"find",
	"finds",
	"found",
	"want",
	"wants",
	"wanted",
	"need",
	"needs",
	"needed",
	"use",
	"uses",
	"used",
	"using",
	"claim",
	"claims",
	"assert",
	"asserts",
	"asserted",
	"appears",
	"appear",
	"show",
	"shows",
	"showed",
	"verify",
	"verifies",
	"verified",
	"render",
	"renders",
	"rendered",
	"check",
	"checks",
	"checked",
	"action",
	"actions",
	"comment",
	"comments",
	"review",
	"reviews",
	"operator",
	"operators",
	"test",
	"tests",
	"change",
	"changes",
	"changed",
	"add",
	"adds",
	"added",
	"remove",
	"removes",
	"delete",
	"deletes",
	"deleted",
	"merge",
	"merges",
	"merged",
	"keep",
	"keeps",
	"kept",
	"fail",
	"fails",
	"failed",
	"pass",
	"passes",
	"passed",
	"make",
	"makes",
	"made",
	"ensure",
	"ensures",
	"ensured",
	"consider",
	"considers",
	"considered",
	"likely",
	"potentially",
	"probably",
	"perhaps",
	"may-be",
	"might-be",
	"seems",
	"appears-to",
	"looks",
	"looks-like",
	"is-likely"
]);
/**
* Detect a verified-facts contradiction in a finding body.
*
* Conservative: only flag when a token that appears in a verified
* list is mentioned in close proximity to a "missing / removed"
* phrase in the same sentence. A finding body that just casually
* mentions a verified-list word ("dist/ is referenced in the
* README") does NOT trigger a downgrade.
*
* The proximity check is the critical safety property: a body must
* have BOTH a missing-phrase AND a verified-list token within ~80
* characters of each other. This drastically reduces false-positive
* downgrades compared to the naive "any token matches" approach.
*/
function detectVerifiedFactsContradiction(body, facts) {
	const lower = body.toLowerCase();
	if (!MISSING_PHRASES.some((p) => lower.includes(p))) return null;
	const verifiedCandidates = /* @__PURE__ */ new Set();
	if (facts.packageJsonFiles !== null) for (const f of facts.packageJsonFiles.files) verifiedCandidates.add(f);
	if (facts.actionOutputs !== null && facts.actionOutputs.outputKeys.length > 0) for (const k of facts.actionOutputs.outputKeys) verifiedCandidates.add(k);
	if (verifiedCandidates.size === 0) return null;
	for (const candidate of verifiedCandidates) {
		const candidateLower = candidate.toLowerCase();
		if (candidateLower.length === 0) continue;
		if (STOPWORD_TOKENS.has(candidateLower)) continue;
		const sentences = lower.split(/[.!?\n]+/u).map((s) => s.trim()).filter((s) => s.length > 0);
		for (const sentence of sentences) {
			if (!sentence.includes(candidateLower)) continue;
			if (!MISSING_PHRASES.some((p) => sentence.includes(p))) continue;
			if (facts.packageJsonFiles !== null && facts.packageJsonFiles.files.includes(candidate)) return `body claims "${candidate}" is missing from package.json#files, but the verified list includes "${candidate}"`;
			if (facts.actionOutputs !== null && facts.actionOutputs.outputKeys.includes(candidate)) return `body claims "${candidate}" output was removed, but the verified list of action.yml#outputs includes "${candidate}"`;
		}
	}
	return null;
}
//#endregion
//#region src/review/filter-confidence.ts
/**
* Filter-confidence layer — orthogonal post-filters that catch the
* false-positive patterns the verified-facts layer cannot detect.
*
* Why this exists
* ---------------
* PR #41 added the verified-facts layer to catch the most common FP
* pattern: "X is missing from Y" claims where the verified list shows
* X is present. That layer is necessary but not sufficient. Analysis
* of subsequent self-review rounds (ADO PR #68 triage: 24 findings =
* 13 legitimate / 7 false positive / 4 mixed) plus the production-tool
* survey (CodeRabbit, Sourcery, Greptile, HalluJudge, SGCR, BitsAI-CR,
* AdaTaint, QASecClaw) surfaces a small number of predictable,
* recurring FP root causes that don't depend on any structured
* repo-state fact:
*
*   1. **Pattern-matched advice** (training-data echo):
*      "you should use parameterized queries", "consider adding an
*      index", "this could be vulnerable to X" — generic best-practice
*      boilerplate the model emits regardless of the diff's actual
*      content. Brandom Wie (brandonwie.dev, 2026) catalogs six
*      patterns of invalid AI feedback; the dominant one is "pattern-
*      matched advice" — the model has memorized "reviewer advice for
*      PHP+SQL = use parameterized queries" and emits it on sight
*      without checking whether parameterized queries are already in
*      place. (Ann R., Level Up Coding, 2026.)
*
*   2. **Hypothetical concerns / over-correction**:
*      "in some edge case this could fail", "if X were to happen…",
*      "in theory…". The arXiv 2603.00539 study (Jin & Chen, 2026)
*      shows 87% of false-rejection rationales are Logic Error
*      (48.2%), Added Requirement (14.1%), Boundary Error (13.2%),
*      or Misread Spec (11.7%) — all variants of unverified claims.
*      The study explicitly recommends: "motivating prompts that
*      separate 'possible risk' from 'confirmed violation.'"
*
*   3. **Intentional-design blindness**:
*      The diff adds a code pattern that LOOKS problematic in
*      isolation but is documented inline (e.g. a comment explaining
*      "this is intentional because Y"). The model misses the
*      documenting comment and flags the pattern as a bug.
*      Brandon Wie: "Add comments explaining WHY the approach is
*      correct, not just WHAT it does."
*
*   4. **Severity inflation**:
*      Findings that should be `info` or `low` are emitted as
*      `medium` or `high`. The research on prompt-induced
*      overcorrection (Jin & Chen, 2026) shows elaborate prompts
*      dramatically amplify this; the recommended mitigation is
*      separate "possible risk" from "confirmed violation" and let
*      severity match certainty.
*
* The three filters below target each of these patterns
* deterministically. None of them require a second model call —
* they use diff reconstruction + body-text analysis + a small
* fixed vocabulary.
*
* Design constraints (same as verified-facts.ts):
*
* - Source of truth: the diff. The action runs in a consumer's
*   checkout where cwd/package.json is NOT UmActually's package.json
*   — we cannot read the worktree.
* - Conservative: every filter is a DOWNGRADE (severity reduction),
*   not a drop. The operator gets full visibility into what the
*   model claimed; the platform-posting path can choose to render
*   downgraded findings as `info` instead of `medium`/`high`.
* - Cheap: O(diff length + body length) per finding. No external
*   commands, no network, no model call.
* - Composable with verified-facts.ts: this layer runs AFTER the
*   verified-facts layer in `applyVerifyFilter`. The disjointness
*   contract holds — review.comments carries only the kept set; all
*   downgraded findings live in `confidenceFilter.downgraded`.
*/
/**
* Apply the three post-filters (hedging calibration, pattern-matched
* advice, contradicted-by-quote, intentional-design) to a review.
*
* Runs AFTER the deterministic (path,line) verification filter
* (`verifyFindingsAgainstDiff`) and the verified-facts contradiction
* filter (`applyVerifiedFactsFilter`). The caller passes the
* already-filtered review; we further downgrade or drop any
* remaining FP patterns.
*
* The result's `downgraded` list is disjoint from `kept` — callers
* that want to surface the downgraded set as `info`-severity
* informational findings read `downgraded` directly; callers that
* want only the high-confidence findings read `kept`.
*/
function applyConfidenceFilter(input) {
	if (input.review.comments.length === 0) return {
		kept: [],
		downgraded: [],
		reasons: []
	};
	const hunkContentByPath = collectHunkContentByPath(input.diffText);
	const kept = [];
	const downgraded = [];
	const reasons = [];
	for (let i = 0; i < input.review.comments.length; i += 1) {
		const comment = input.review.comments[i];
		if (comment === void 0) continue;
		const verdict = classifyFinding({
			comment,
			hunkContent: hunkContentByPath.get(comment.path) ?? null
		});
		if (verdict === null) {
			kept.push(comment);
			continue;
		}
		downgraded.push(applyDowngrade(comment, verdict.reason));
		reasons.push({
			index: i,
			reason: verdict.reason,
			explanation: verdict.explanation
		});
	}
	return {
		kept,
		downgraded,
		reasons
	};
}
/**
* The verdict of running the three filters against a single finding.
* `null` means no filter fired; keep the finding at its original
* severity. A non-null verdict carries the matched reason + a
* short human-readable explanation for the audit artifact.
*/
function classifyFinding(input) {
	const body = input.comment.body;
	const bodyLower = body.toLowerCase();
	if (containsHedgingLanguage(bodyLower)) {
		const severity = input.comment.severity.toLowerCase();
		if (severity === "medium" || severity === "high" || severity === "critical") return {
			reason: "hedging-language",
			explanation: `Body uses hedging language ("could", "might", "potentially", "in some cases") at severity "${input.comment.severity}"; calibrating to info because the claim is not asserted as a confirmed violation.`
		};
	}
	if (looksLikePatternMatchedAdvice(bodyLower) && input.hunkContent !== null) {
		if (!bodyContainsAnyHunkLine(body, input.hunkContent)) return {
			reason: "pattern-matched-advice",
			explanation: "Body uses generic best-practice phrasing without quoting any diff line as evidence; this is the model emitting pattern-matched advice rather than a finding anchored to the change."
		};
	}
	if (input.hunkContent !== null) {
		const constructMatch = contradictsDiffPresence(bodyLower, input.hunkContent);
		if (constructMatch !== null) return {
			reason: "contradicted-by-quote",
			explanation: `Body claims absence of "${constructMatch}" but the diff hunk around the cited line already contains it.`
		};
	}
	if (input.hunkContent !== null) {
		const intentional = looksLikeIntentionalDesign(bodyLower, input.hunkContent);
		if (intentional !== null) return {
			reason: "intentional-design",
			explanation: `Body flags "${intentional.flag}" but the diff hunk documents the pattern as intentional ("${intentional.doc}"); the model missed the documenting comment.`
		};
	}
	return null;
}
/**
* Lowercase hedging-language words/phrases that signal "the model
* is not asserting a confirmed violation." The set is intentionally
* narrow — only phrases that almost always appear in speculative
* rather than confirmed claims. "Should" alone is too generic
* ("this function should return X" is a confirmed behavioral
* claim); we look for the specific speculative constructions
* below.
*/
const HEDGING_PHRASES = [
	"could potentially",
	"could lead to",
	"could cause",
	"could result in",
	"could be vulnerable",
	"could fail",
	"could break",
	"could trigger",
	"might lead to",
	"might cause",
	"might result in",
	"might fail",
	"might break",
	"might be vulnerable",
	"may lead to",
	"may cause",
	"may result in",
	"may fail",
	"may break",
	"may be vulnerable",
	"in some cases",
	"in certain cases",
	"in edge cases",
	"in theory",
	"theoretically",
	"potentially vulnerable",
	"potentially leads to",
	"potentially causes",
	"potentially results in",
	"potentially a",
	"potentially an",
	"if this were to",
	"if x were to",
	"could theoretically",
	"could in theory",
	"may have unintended",
	"could have unintended",
	"risk of",
	"possible risk",
	"potentially"
];
function containsHedgingLanguage(bodyLower) {
	for (const phrase of HEDGING_PHRASES) if (bodyLower.includes(phrase)) return true;
	return false;
}
/**
* Phrases that mark a body as generic best-practice advice rather
* than a diff-anchored finding. The match requires the phrase to
* appear as the LEAD of a clause (preceded by whitespace or
* beginning of string) — "you should also note" mid-sentence is
* NOT a trigger because it modifies a prior claim.
*/
const PATTERN_MATCHED_ADVICE_LEADS = [
	"you should",
	"you may want to",
	"consider adding",
	"consider using",
	"consider implementing",
	"consider refactoring",
	"consider extracting",
	"consider introducing",
	"it might be worth",
	"it may be worth",
	"it would be better to",
	"it would be good to",
	"it would be helpful to",
	"it would be nice to",
	"we should",
	"we may want to",
	"we could",
	"let's add",
	"let's use",
	"best practice is to",
	"best practice would be to",
	"a common approach is to",
	"a common pattern is to"
];
function looksLikePatternMatchedAdvice(bodyLower) {
	for (const lead of PATTERN_MATCHED_ADVICE_LEADS) if (bodyLower.startsWith(lead) || bodyLower.includes(` ${lead}`) || bodyLower.includes(`\n${lead}`)) return true;
	return false;
}
/**
* Code constructs the model might claim are "missing" while they
* are in fact present in the diff. The list covers the common
* security/correctness constructs the LLM training data
* associates with "you should add this" advice. When a finding
* body asserts the absence of one of these AND the diff hunk
* already contains the construct, that's a contradiction.
*
* Each entry is a pair of (regex-literal-substring, label). The
* substring is matched case-insensitively in both the body
* (claiming absence) and the hunk (asserting presence). The label
* is what we surface in the explanation.
*
* The list is intentionally NARROW — we only include constructs
* where false absence claims are common (security advisories the
* model emits from training data) and the absence phrasing is
* SPECIFIC enough that an accidental match is unlikely. Generic
* constructs like `return `, `throw `, `await ` were tried and
* removed because they produce too many false positives — a body
* that mentions `return null;` AND a generic absence phrase
* (e.g. "no error handling") gets flagged even though `return`
* has nothing to do with error handling.
*/
const PRESENCE_CONSTRUCTS = [
	{
		presence: [
			"parameterized query",
			"parameterized queries",
			"parameterised query"
		],
		label: "parameterized queries"
	},
	{
		presence: ["prepared statement", "prepared statements"],
		label: "prepared statements"
	},
	{
		presence: [
			"bound parameter",
			"bound parameters",
			"parameter binding"
		],
		label: "bound parameters"
	},
	{
		presence: [
			"escape(",
			"escapehtml",
			"escapeHtml"
		],
		label: "input escaping"
	},
	{
		presence: ["sanitize(", "sanitise("],
		label: "input sanitization"
	},
	{
		presence: ["validate(", "validation"],
		label: "input validation"
	},
	{
		presence: [
			"authoriz",
			"authorisation",
			"authorization check"
		],
		label: "authorization"
	},
	{
		presence: ["authenticat"],
		label: "authentication"
	},
	{
		presence: ["csrf"],
		label: "CSRF protection"
	},
	{
		presence: ["xss"],
		label: "XSS protection"
	},
	{
		presence: [
			"rate limit",
			"rate-limit",
			"throttle"
		],
		label: "rate limiting"
	}
];
function contradictsDiffPresence(bodyLower, hunkLower) {
	for (const construct of PRESENCE_CONSTRUCTS) {
		if (!construct.presence.some((p) => bodyLower.includes(p))) continue;
		if (!construct.presence.some((p) => hunkLower.includes(p))) continue;
		const absencePhrases = ABSENCE_PHRASES_BY_CONSTRUCT.get(construct.label);
		if (absencePhrases === void 0) continue;
		if (!absencePhrases.some((p) => bodyLower.includes(p))) continue;
		return construct.label;
	}
	return null;
}
/**
* Phrases that signal the body is asserting the absence of
* something. These are the same missing/removed phrases the
* verified-facts layer uses — duplicated here so this layer is
* self-contained and can be tested without importing the
* verified-facts module. We deliberately keep the list narrow
* (no "no " alone, no "never " alone) because those would
* over-trigger on factual negative claims ("there is no need to
* add tests here").
*
* Each entry pairs a "tight" absence phrase (specific to the
* construct) with the construct label it maps to. The
* contradicted-by-quote check requires the body's absence phrase
* AND the construct being checked to agree — a body that says
* "no error handling" with "return null;" nearby would NOT
* trigger because "return null;" is not in the construct set
* tagged with error handling. This binding prevents the false
* positive where a body mentions a generic construct (`return `)
* AND a generic absence phrase (`no error handling`) without
* those two being logically connected.
*/
const ABSENCE_PHRASES_BY_CONSTRUCT = /* @__PURE__ */ new Map([
	["parameterized queries", [
		"is missing",
		"are missing",
		"isn't included",
		"doesn't include",
		"does not include",
		"no parameterized",
		"no prepared statement",
		"no prepared statements",
		"fails to use",
		"fails to include",
		"not present",
		"lacks"
	]],
	["prepared statements", [
		"is missing",
		"are missing",
		"isn't included",
		"doesn't include",
		"does not include",
		"no prepared",
		"fails to use"
	]],
	["bound parameters", [
		"is missing",
		"are missing",
		"doesn't bind",
		"no bound"
	]],
	["input escaping", [
		"is missing",
		"are missing",
		"isn't escaping",
		"no escape(",
		"fails to escape",
		"unescaped"
	]],
	["input sanitization", [
		"is missing",
		"are missing",
		"no sanitize(",
		"no sanitise(",
		"unsanitized",
		"unsanitised"
	]],
	["input validation", [
		"is missing",
		"are missing",
		"no validate(",
		"no validation",
		"unvalidated"
	]],
	["authorization", [
		"is missing",
		"are missing",
		"no authoriz",
		"unauthorized",
		"no authorization check"
	]],
	["authentication", [
		"is missing",
		"are missing",
		"no authenticat",
		"unauthenticated"
	]],
	["CSRF protection", [
		"is missing",
		"no csrf",
		"no csrf protection"
	]],
	["XSS protection", [
		"is missing",
		"no xss",
		"no xss protection"
	]],
	["rate limiting", [
		"is missing",
		"no rate limit",
		"no rate-limit",
		"no throttling"
	]]
]);
/**
* Detect the intentional-design pattern: the body expresses
* disapproval AND the hunk contains a documenting comment that
* explains the flagged construct. Returns the body-flag phrase
* and the documentation phrase for the explanation.
*/
const BODY_DISAPPROVAL_PHRASES = [
	"this is wrong",
	"this looks wrong",
	"this seems wrong",
	"this is incorrect",
	"this looks incorrect",
	"this seems incorrect",
	"this is a bug",
	"this looks like a bug",
	"this seems like a bug",
	"this is broken",
	"this is unsafe",
	"this is risky",
	"this is dangerous",
	"this will fail",
	"this will break",
	"this could fail",
	"this could break",
	"should not be",
	"shouldn't be",
	"must not be",
	"this is a problem",
	"this is an issue",
	"this is concerning",
	"this is suspect",
	"looks suspicious",
	"seems suspicious",
	"anti-pattern",
	"code smell",
	"wrong way",
	"incorrect way"
];
const INTENTIONAL_DOC_MARKERS = [
	{
		marker: "// intentional",
		description: "intentional"
	},
	{
		marker: "// by design",
		description: "by design"
	},
	{
		marker: "// note:",
		description: "note"
	},
	{
		marker: "// note ",
		description: "note"
	},
	{
		marker: "// hack:",
		description: "hack"
	},
	{
		marker: "// workaround",
		description: "workaround"
	},
	{
		marker: "// documented:",
		description: "documented"
	},
	{
		marker: "// see ",
		description: "see-comment"
	},
	{
		marker: "// see-also",
		description: "see-also"
	},
	{
		marker: "// explanation:",
		description: "explanation"
	},
	{
		marker: "// rationale:",
		description: "rationale"
	},
	{
		marker: "// reason:",
		description: "reason"
	},
	{
		marker: "// why:",
		description: "why"
	},
	{
		marker: "// context:",
		description: "context"
	},
	{
		marker: "// todo:",
		description: "todo"
	},
	{
		marker: "// fixme:",
		description: "fixme"
	},
	{
		marker: "// note that",
		description: "note-that"
	},
	{
		marker: "/* intentional",
		description: "intentional"
	},
	{
		marker: "/* by design",
		description: "by design"
	},
	{
		marker: "/* note:",
		description: "note"
	}
];
function looksLikeIntentionalDesign(bodyLower, hunkLower) {
	let matchedFlag = null;
	for (const phrase of BODY_DISAPPROVAL_PHRASES) if (bodyLower.includes(phrase)) {
		matchedFlag = phrase;
		break;
	}
	if (matchedFlag === null) return null;
	for (const marker of INTENTIONAL_DOC_MARKERS) if (hunkLower.includes(marker.marker)) return {
		flag: matchedFlag,
		doc: marker.description
	};
	return null;
}
/**
* Per-pattern severity mapping. The deterministic policy:
*
* - hedging-language: reduce by 2 tiers (`high` → `low`,
*   `medium` → `info`). The claim is speculative; we surface it
*   but not at blocking severity.
* - pattern-matched-advice: reduce to `info` — the model emitted
*   memorized advice with no diff anchor; it's not a finding.
* - contradicted-by-quote: reduce to `info` — the diff contradicts
*   the claim; the operator should still see what was said but
*   not at the model's claimed severity.
* - intentional-design: reduce by 1 tier (`high` → `medium`,
*   `medium` → `low`, `low` → `info`) — the model may have a
*   point but missed the documenting comment; we soften without
*   silencing.
*/
function applyDowngrade(comment, reason) {
	const severityLower = comment.severity.toLowerCase();
	let nextSeverity;
	switch (reason) {
		case "hedging-language":
			nextSeverity = downgradeTwoTiers(severityLower);
			break;
		case "pattern-matched-advice":
		case "contradicted-by-quote":
			nextSeverity = "info";
			break;
		case "intentional-design":
			nextSeverity = downgradeOneTier(severityLower);
			break;
	}
	return {
		...comment,
		severity: nextSeverity
	};
}
const SEVERITY_TIERS = [
	"info",
	"low",
	"medium",
	"high",
	"critical"
];
function downgradeOneTier(severity) {
	const idx = SEVERITY_TIERS.indexOf(severity);
	if (idx === -1 || idx === 0) return "info";
	return SEVERITY_TIERS[idx - 1] ?? "info";
}
function downgradeTwoTiers(severity) {
	const idx = SEVERITY_TIERS.indexOf(severity);
	if (idx === -1 || idx <= 1) return "info";
	return SEVERITY_TIERS[idx - 2] ?? "info";
}
/**
* Build a Map<path, joined-hunk-content> from the diff. Walks the
* diff once and groups all (context + added) lines per file.
* Reused across all findings to avoid repeated diff walks.
*
* Returns an empty map for an empty diff. Reconstructs content
* via the same logic as `verified-facts.ts:reconstructFileFromDiff`
* but joins all files in one pass (the verified-facts module
* reconstructs one file at a time).
*/
function collectHunkContentByPath(diffText) {
	const result = /* @__PURE__ */ new Map();
	if (diffText.length === 0) return result;
	const seenPaths = /* @__PURE__ */ new Set();
	for (const line of diffText.split(/\r?\n/u)) {
		const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
		if (match === null) continue;
		const path = match[2];
		if (path === void 0) continue;
		if (seenPaths.has(path)) continue;
		seenPaths.add(path);
		const content = reconstructFileFromDiff(diffText, path);
		if (content !== null) result.set(path, content.toLowerCase());
	}
	return result;
}
/**
* Check whether the body contains any verbatim substring of a
* hunk line. Used to detect "pattern-matched advice" — a body
* that quotes no observable diff line is unlikely to be a
* diff-anchored finding.
*
* Trims each hunk line to avoid matching the leading space of
* every context line. Minimum 10-char match window to avoid
* spurious overlaps on short common words.
*/
function bodyContainsAnyHunkLine(body, hunkContent) {
	const MIN_MATCH = 10;
	for (const line of hunkContent.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (trimmed.length < MIN_MATCH) continue;
		if (body.includes(trimmed)) return true;
	}
	return false;
}
//#endregion
//#region src/cli/live-provider.ts
const DEFAULT_REQUEST_TIMEOUT_MS = 6e4;
const PROVIDER_NAME = "openai-compatible";
const COPILOT_PROVIDER_NAME = "github-copilot";
const ANTHROPIC_PROVIDER_NAME = "anthropic-messages";
/**
* Map a `ProviderEndpoint` (the wire-shape discriminator returned by
* the provider client on success) to its operator-facing display name
* used in the review outcome, the parse-warnings artifact, and the
* surface-level attribution. When cross-protocol fallback fires, the
* named provider fails but the OTHER protocol succeeds; this helper
* recovers the actual-protocol name so the outcome attribute is
* correct (e.g. "anthropic-messages" not "openai-compatible").
*/
function providerNameForEndpoint(endpoint) {
	switch (endpoint) {
		case "anthropic": return ANTHROPIC_PROVIDER_NAME;
		case "responses":
		case "chat": return PROVIDER_NAME;
	}
}
async function requestLiveReview(input) {
	await scanReviewSecrets({
		diffText: input.diffText,
		expectedArtifact: "artifacts/manual/s5-redaction-report.json"
	});
	const providerApiKey = requireLiveConfig(resolveField(input.parsed.apiKey, input.env[ENV_KEYS.UMACTUALLY_API_KEY], ""), ENV_KEYS.UMACTUALLY_API_KEY);
	const modelId = readConfiguredModel(input.parsed, input.env);
	const prompts = await buildProviderPrompts(input);
	const severityWarnings = [];
	const sinkProviderName = input.parsed.provider === "copilot" ? COPILOT_PROVIDER_NAME : input.parsed.provider === "anthropic" ? ANTHROPIC_PROVIDER_NAME : PROVIDER_NAME;
	const sink = (raw, normalized, ctx) => {
		severityWarnings.push({
			rawValue: raw,
			normalizedFallback: normalized,
			commentIndex: ctx.commentIndex,
			providerName: ctx.providerName ?? sinkProviderName
		});
	};
	setActiveSeveritySink(sink);
	const responseFormat = input.parsed.strictSchema === false ? void 0 : {
		type: "json_schema",
		strict: true,
		schema: REVIEW_PAYLOAD_JSON_SCHEMA
	};
	/**
	* Success path shared by all three provider families
	* (`openai-compatible` / `copilot` / `anthropic`). Mirrors the
	* 3-step flow that previously lived inline in each branch:
	* normalize (secrets scrubbed) → parse-warnings artifact → verify
	* filter for downstream platform-posting. Behavior is BYTE-IDENTICAL
	* regardless of provider.
	*/
	function handleSuccess(result, providerName) {
		const preVerifyReview = normalizeProviderReview(result.review, [providerApiKey, input.platformToken]);
		const verifyFilterResult = input.parsed.verifyFindings !== false ? applyVerifyFilter(preVerifyReview, input.diffText) : {
			review: preVerifyReview,
			verifiedFactsFilter: {
				kept: preVerifyReview.comments,
				downgraded: [],
				downgradeReasons: []
			},
			confidenceFilter: {
				kept: preVerifyReview.comments,
				downgraded: [],
				reasons: []
			}
		};
		return {
			...withParseWarnings({
				review: preVerifyReview,
				endpoint: result.endpoint,
				provider: providerName,
				modelId,
				severityWarnings: severityWarnings.slice(),
				diffText: input.diffText,
				verifiedFactsFilter: verifyFilterResult.verifiedFactsFilter,
				confidenceFilter: verifyFilterResult.confidenceFilter
			}),
			review: verifyFilterResult.review
		};
	}
	/**
	* Parse-failure path shared by all three provider families.
	* Builds the malformed-provider fallback review and attaches the
	* parse-warnings artifact so operators see what was wrong with the
	* model's response (off-diff citations, missed severity classification,
	* truncated-stream marker, etc.) before the action exits non-zero.
	*/
	function handleParse(result, providerName, rawText) {
		return withParseWarnings({
			review: buildMalformedProviderFallback({
				provider: providerName,
				modelId,
				rawText,
				secrets: [providerApiKey, input.platformToken],
				...parseFailureReasonFromProviderError(result.error, input.parsed.maxOutputTokens)
			}),
			endpoint: result.error.endpoint,
			provider: providerName,
			modelId,
			severityWarnings: severityWarnings.slice(),
			diffText: input.diffText
		});
	}
	try {
		if (input.parsed.provider === "copilot") {
			const result = await runCopilotRequest({
				githubToken: providerApiKey,
				apiBase: resolveField(input.parsed.githubApiBase, input.env[ENV_KEYS.UMACTUALLY_GITHUB_API_BASE], DEFAULT_GITHUB_API_BASE),
				system: prompts.system,
				user: prompts.user,
				model: modelId,
				requestTimeoutMs: readRequestTimeoutMs(input.parsed),
				...input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {},
				...input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {},
				...responseFormat !== void 0 ? { responseFormat } : {},
				fetchImpl: input.fetchImpl
			});
			if (result.ok) return handleSuccess(result, COPILOT_PROVIDER_NAME);
			if (result.error.code === "parse") return handleParse(result, COPILOT_PROVIDER_NAME, result.error.rawText ?? "");
			if (result.error.code === "provider_error") {
				const details = result.error.providerErrorDetails;
				throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
			}
			throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
		}
		if (input.parsed.provider === "anthropic") {
			const providerUrl = resolveField(input.parsed.apiUrl, input.env[ENV_KEYS.UMACTUALLY_API_URL], DEFAULT_ANTHROPIC_URL);
			let result = await runAnthropicRequest({
				baseUrl: providerUrl,
				apiKey: providerApiKey,
				model: modelId,
				system: prompts.system,
				user: prompts.user,
				requestTimeoutMs: readRequestTimeoutMs(input.parsed),
				...input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {},
				...input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {},
				fetchImpl: input.fetchImpl
			});
			if (!result.ok) {
				const fallback = await runWithCrossProtocolFallback({
					namedProvider: "anthropic",
					namedResult: result,
					fallbackProvider: "openai-compatible",
					baseUrl: providerUrl,
					providerApiKey,
					modelId,
					prompts,
					readRequestTimeoutMs: () => readRequestTimeoutMs(input.parsed),
					fetchImpl: input.fetchImpl,
					parsed: input.parsed,
					responseFormat
				});
				if (fallback.ok) result = fallback;
			}
			if (result.ok) {
				const providerName = providerNameForEndpoint(result.endpoint);
				return handleSuccess(result, providerName);
			}
			if (result.error.code === "parse") {
				const providerName = providerNameForEndpoint(result.error.endpoint);
				return handleParse(result, providerName, result.error.rawText ?? "");
			}
			if (result.error.code === "provider_error") {
				const details = result.error.providerErrorDetails;
				throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
			}
			throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
		}
		const providerUrl = requireLiveConfig(resolveField(input.parsed.apiUrl, input.env[ENV_KEYS.UMACTUALLY_API_URL], ""), ENV_KEYS.UMACTUALLY_API_URL);
		const useAnthropicProtocol = looksLikeAnthropicEndpoint(providerUrl);
		if (useAnthropicProtocol) process.stderr.write(`::notice::${BRAND_PREFIX}Operator URL contains an /anthropic path segment; using the Anthropic Messages API client (regardless of --provider).\n`);
		let result;
		if (useAnthropicProtocol) result = await runAnthropicRequest({
			baseUrl: providerUrl,
			apiKey: providerApiKey,
			model: modelId,
			system: prompts.system,
			user: prompts.user,
			requestTimeoutMs: readRequestTimeoutMs(input.parsed),
			...input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {},
			...input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {},
			fetchImpl: input.fetchImpl
		});
		else result = await runProviderRequest({
			baseUrl: providerUrl,
			apiKey: providerApiKey,
			model: modelId,
			system: prompts.system,
			user: prompts.user,
			requestTimeoutMs: readRequestTimeoutMs(input.parsed),
			...input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {},
			...input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {},
			...responseFormat !== void 0 ? { responseFormat } : {},
			fetchImpl: input.fetchImpl
		});
		if (!result.ok) {
			const fallback = await runWithCrossProtocolFallback({
				namedProvider: "openai-compatible",
				namedResult: result,
				fallbackProvider: "anthropic",
				baseUrl: providerUrl,
				providerApiKey,
				modelId,
				prompts,
				readRequestTimeoutMs: () => readRequestTimeoutMs(input.parsed),
				fetchImpl: input.fetchImpl,
				parsed: input.parsed,
				responseFormat
			});
			if (fallback.ok) result = fallback;
		}
		if (result.ok) {
			const providerName = providerNameForEndpoint(result.endpoint);
			return handleSuccess(result, providerName);
		}
		if (result.error.code === "parse") {
			const providerName = providerNameForEndpoint(result.error.endpoint);
			return handleParse(result, providerName, result.error.rawText ?? "");
		}
		if (result.error.code === "provider_error") {
			const details = result.error.providerErrorDetails;
			throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
		}
		throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
	} finally {
		setActiveSeveritySink(null);
	}
}
/**
* Compute parse warnings for the review (off-diff citations the
* model fabricated) and attach them to the outcome. Layer 3 of the
* citation-grounding fix — makes the fabrication visible in the
* parse-warnings.json artifact instead of silently suppressing it.
*/
function withParseWarnings(input) {
	return {
		review: input.review,
		endpoint: input.endpoint,
		provider: input.provider,
		modelId: input.modelId,
		severityWarnings: input.severityWarnings,
		parseWarnings: buildParseWarningsArtifact({
			review: input.review,
			diffText: input.diffText
		}).warnings,
		verifiedFactsFilter: input.verifiedFactsFilter ?? {
			kept: input.review.comments,
			downgraded: [],
			downgradeReasons: []
		},
		confidenceFilter: input.confidenceFilter ?? {
			kept: input.review.comments,
			downgraded: [],
			reasons: []
		}
	};
}
/**
* Apply the deterministic (path, line) verify filter to the
* review's comments[]. Returns a new LiveReview with the filtered
* comments[] PLUS a verified-facts filter result describing
* findings that were downgraded because they contradicted a verified
* fact.
*
* The returned `review.comments` contains ONLY the KEPT findings
* (at their original severity). Downgraded findings live in
* `verifiedFactsFilter.downgraded` as a separate list — callers that
* want to surface downgraded findings read that list directly. This
* avoids double-counting: downstream code iterating
* `review.comments` for posting sees the kept set; downstream code
* reading `verifiedFactsFilter.downgraded` for audit sees the
* downgraded set. The two are disjoint.
*
* The original is left untouched so callers (the parse-warnings
* artifact builder) see the pre-filter payload.
*
* Defense-in-depth Layer 4: the post-filter in
* `selectPostableComments` runs the same check, but doing it here
* means the platform-posting paths only see anchorable findings.
*
* Layer 4.5: after the (path, line) filter, run the verified-facts
* contradiction filter. Findings whose body asserts something is
* missing from a verified list (e.g. "dist/ is missing from
* package.json#files" when dist/ is in fact in files) are
* downgraded to info severity in the downgraded list so the
* operator can see what the model claimed and why it was
* downgraded, but they do not enter `review.comments` (which is
* what gets posted).
*/
function applyVerifyFilter(review, diffText) {
	if (diffText.length === 0) return {
		review,
		verifiedFactsFilter: {
			kept: review.comments,
			downgraded: [],
			downgradeReasons: []
		},
		confidenceFilter: {
			kept: review.comments,
			downgraded: [],
			reasons: []
		}
	};
	const { verified } = verifyFindingsAgainstDiff({
		review,
		diffText
	});
	const filteredReview = {
		...review,
		comments: verified
	};
	const verifiedFactsFilter = applyVerifiedFactsFilter({
		review: filteredReview,
		diffText
	});
	const confidenceFilter = applyConfidenceFilter({
		review: {
			...filteredReview,
			comments: verifiedFactsFilter.kept
		},
		diffText
	});
	return {
		review: {
			...filteredReview,
			comments: confidenceFilter.kept
		},
		verifiedFactsFilter,
		confidenceFilter
	};
}
function normalizeProviderReview(payload, secrets) {
	return {
		summary: sanitizeForPost(payload.summary, secrets),
		verdict: payload.verdict,
		comments: payload.comments.map((comment) => normalizeProviderComment(comment, secrets)),
		suppressedComments: payload.suppressed_comments.map((comment) => normalizeProviderComment(comment, secrets))
	};
}
function normalizeProviderComment(comment, secrets) {
	return {
		path: comment.path,
		line: comment.line,
		body: sanitizeForPost(comment.body, secrets),
		severity: sanitizeForPost(comment.severity, secrets),
		category: sanitizeForPost(comment.category, secrets)
	};
}
function readConfiguredModel(parsed, env) {
	const fromArgs = parsed.model;
	if (fromArgs !== null && fromArgs.length > 0 && fromArgs !== "auto") return fromArgs;
	return resolveAutoModel({
		provider: parsed.provider ?? "openai-compatible",
		apiUrl: parsed.apiUrl,
		env
	});
}
function readRequestTimeoutMs(parsed) {
	const seconds = parsed.perRequestTimeoutSeconds ?? parsed.reviewTimeoutSeconds;
	return seconds === null || seconds <= 0 ? DEFAULT_REQUEST_TIMEOUT_MS : seconds * 1e3;
}
/**
* Translate a ProviderError's parse-failure fields into the reason
* shape that `buildMalformedProviderFallback` consumes. Returns an
* empty spread when the error has no truncation signal (the caller
* then omits the `reason` field and the fallback renders the generic
* "Provider response did not contain a valid JSON review payload"
* headline).
*/
function parseFailureReasonFromProviderError(error, maxOutputTokens) {
	if (error.truncated !== true) return {};
	return { reason: {
		kind: "truncated",
		...error.usage !== void 0 ? { usage: error.usage } : {},
		...maxOutputTokens !== null ? { maxOutputTokens } : {}
	} };
}
async function runWithCrossProtocolFallback(args) {
	if (!isRoutableFailureForCrossProtocol(args.namedResult.error)) return args.namedResult;
	process.stderr.write(`::notice::${BRAND_PREFIX}Named provider "${args.namedProvider}" returned status=${args.namedResult.error.status} at ${redactUrlForLog(args.baseUrl)} — retrying with cross-protocol fallback "${args.fallbackProvider}".\n`);
	let fallbackResult;
	if (args.fallbackProvider === "anthropic") fallbackResult = await runAnthropicRequest({
		baseUrl: args.baseUrl,
		apiKey: args.providerApiKey,
		model: args.modelId,
		system: args.prompts.system,
		user: args.prompts.user,
		requestTimeoutMs: args.readRequestTimeoutMs(),
		...args.parsed.maxOutputTokens !== null ? { maxOutputTokens: args.parsed.maxOutputTokens } : {},
		...args.parsed.effort !== null ? { reasoningEffort: args.parsed.effort } : {},
		fetchImpl: args.fetchImpl
	});
	else fallbackResult = await runProviderRequest({
		baseUrl: args.baseUrl,
		apiKey: args.providerApiKey,
		model: args.modelId,
		system: args.prompts.system,
		user: args.prompts.user,
		requestTimeoutMs: args.readRequestTimeoutMs(),
		...args.parsed.maxOutputTokens !== null ? { maxOutputTokens: args.parsed.maxOutputTokens } : {},
		...args.parsed.effort !== null ? { reasoningEffort: args.parsed.effort } : {},
		...args.responseFormat !== void 0 ? { responseFormat: args.responseFormat } : {},
		fetchImpl: args.fetchImpl
	});
	if (!fallbackResult.ok) process.stderr.write(`::notice::${BRAND_PREFIX}Cross-protocol fallback "${args.fallbackProvider}" returned status=${fallbackResult.error.status} at ${redactUrlForLog(args.baseUrl)} — surfacing named protocol's error.\n`);
	return fallbackResult;
}
//#endregion
//#region src/cli/sonar-context.ts
async function readLiveSonarContext(parsed, fetchImpl) {
	const report = await readLiveSonarReport(parsed, fetchImpl);
	return report === void 0 ? void 0 : formatSonarContext(report);
}
async function readLiveSonarReport(parsed, fetchImpl) {
	if (!(parsed.includeSonarqube && parsed.sonarHostUrl !== null && parsed.sonarToken !== null && parsed.sonarProjectKey !== null)) return;
	const sonarReport = await runLiveSonarImport({
		sonarHostUrl: parsed.sonarHostUrl ?? "",
		sonarToken: parsed.sonarToken ?? "",
		sonarProjectKey: parsed.sonarProjectKey ?? "",
		sonarTimeoutSeconds: parsed.sonarTimeoutSeconds ?? 300,
		fetchImpl
	});
	process.stdout.write(`${BRAND_PREFIX}sonar quality gate ${sonarReport.qualityGateStatus} (${sonarReport.importedFindingCount} findings, waited=${sonarReport.waitedForTerminalQualityGate})${sonarReport.timeoutHandled ? " [timeout handled]" : ""}\n`);
	if (sonarReport.errorMessage !== void 0) writeBrandedAnnotation("warning", sonarReport.errorMessage);
	return sonarReport;
}
function formatSonarContext(report) {
	return [
		"SonarQube report:",
		`Quality gate: ${report.qualityGateStatus}`,
		`Imported findings: ${report.importedFindingCount}`,
		`Waited for terminal quality gate: ${report.waitedForTerminalQualityGate}`,
		`Timeout handled: ${report.timeoutHandled}`
	].join("\n");
}
//#endregion
//#region src/review/diff-line-utils.ts
/**
* Walk the diff text and return the raw line content for the first
* `+` or ` ` row at the given right-side position. Falls back to an empty
* string when the diff has no hunk header reachable for the file path.
*
* Exposed so the simulated-findings fixture can build context-aware bodies
* that reference a representative token from the actual diff line.
*/
function readDiffLine(diffText, position) {
	const targetPath = `b/${position.path}`;
	const diffLines = diffText.split(/\r?\n/u);
	let currentPath = null;
	let nextNewLine = null;
	for (const rawLine of diffLines) {
		if (rawLine.startsWith("diff --git ")) {
			currentPath = null;
			nextNewLine = null;
			continue;
		}
		if (currentPath === null) {
			const parsedPath = parseNewFilePath(rawLine);
			if (parsedPath !== null) currentPath = parsedPath === position.path ? targetPath : parsedPath;
			continue;
		}
		if (currentPath !== targetPath) continue;
		if (rawLine.startsWith("@@ ")) {
			nextNewLine = parseHunkStart(rawLine);
			continue;
		}
		if (nextNewLine === null) continue;
		if (rawLine.startsWith("+") || rawLine.startsWith(" ")) {
			if (nextNewLine === position.line) return rawLine.slice(1).trim();
			nextNewLine += 1;
		}
	}
	return "";
}
/**
* Pull a meaningful token out of the diff line for context-aware bodies.
* Falls back to a path-derived identifier when the line is blank.
*/
function extractRepresentativeToken(lineContent, path) {
	const identifierMatch = lineContent.match(/\b([A-Za-z_$][\w$]*)\s*\(/u);
	if (identifierMatch !== null && identifierMatch[1] !== void 0) return identifierMatch[1];
	const declarationMatch = lineContent.match(/\b(?:const|let|var|function|class|interface|type|export)\s+([A-Za-z_$][\w$]*)/u);
	if (declarationMatch !== null && declarationMatch[1] !== void 0) return declarationMatch[1];
	const genericMatch = lineContent.match(/\b([A-Za-z_$][\w$]{3,})\b/u);
	if (genericMatch !== null && genericMatch[1] !== void 0) return genericMatch[1];
	const fallback = path.replace(/[^\w]+/gu, "_").replace(/^_+|_+$/gu, "");
	return fallback.length > 0 ? fallback : "this change";
}
//#endregion
//#region src/review/simulated-findings.ts
/**
* Deterministic fixture used by `simulate-findings` to exercise the full
* render + post path when the live provider returns structurally empty output.
*
* The fixture:
* - parses the real PR diff with `parseDiffPositions` and enumerates the
*   right-side positions to anchor every inline comment on a real diff line,
* - mixes severities (high/medium/low) and categories (security, style,
*   correctness, performance) across at least two files,
* - extracts a representative token from the diff line (or path) so each
*   finding body references real code rather than a hard-coded example,
* - ships 1-2 suppressed_comments entries that deliberately reference lines
*   NOT in the diff so the suppression path is exercised,
* - never embeds the review marker, raw provider JSON, fenced details blocks,
*   or API keys — the marker is appended by the GitHub posting layer.
*/
function buildSimulatedFindings(repo, prNumber, headSha, diffText) {
	const positions = parseDiffPositions(diffText);
	const enumerated = positions.enumerate();
	const inlineBlueprints = enumerated.length > 0 ? buildDiverseBlueprints(enumerated, diffText) : buildFallbackBlueprints();
	const acceptUnanchored = enumerated.length === 0;
	const comments = [];
	for (const blueprint of inlineBlueprints) {
		if (acceptUnanchored || positions.hasPosition(blueprint)) comments.push({ ...blueprint });
		if (comments.length >= MAX_INLINE) break;
	}
	const suppressedBlueprints = [{
		path: "src/review/example.ts",
		line: 999,
		severity: "medium",
		category: "correctness",
		body: "Older comment that referenced a removed line is suppressed because the diff no longer contains that position."
	}, {
		path: "src/legacy/never-existed.ts",
		line: 1,
		severity: "low",
		category: "style",
		body: "Suppressed because `src/legacy/never-existed.ts` is not part of the PR diff and no longer ships in the tree."
	}];
	const suppressed_comments = [];
	for (const blueprint of suppressedBlueprints) {
		if (!positions.hasPosition(blueprint)) suppressed_comments.push({ ...blueprint });
		if (suppressed_comments.length >= 2) break;
	}
	return {
		summary: `Simulated review for ${repo}#${prNumber} at ${headSha}. ${comments.length} inline findings, ${suppressed_comments.length} suppressed off-diff.`,
		verdict: "NEEDS_FIX",
		comments,
		suppressed_comments
	};
}
const MAX_INLINE = 6;
const SEVERITY_PALETTE = [
	"high",
	"medium",
	"low"
];
const CATEGORY_PALETTE = [
	"security",
	"correctness",
	"style",
	"performance"
];
/**
* Pick up to `MAX_INLINE` positions from the enumerated diff, ensuring at
* least one anchor per distinct file so findings span multiple paths and
* severities/categories cycle through their palettes.
*
* Strategy: take the first position from each unique file (in diff order)
* to guarantee path diversity, then top up with additional positions from
* earlier paths until the cap is reached.
*/
function buildDiverseBlueprints(enumerated, diffText) {
	const picked = [];
	const seenPaths = /* @__PURE__ */ new Set();
	for (const position of enumerated) {
		if (seenPaths.has(position.path)) continue;
		seenPaths.add(position.path);
		picked.push(position);
		if (picked.length >= MAX_INLINE) break;
	}
	for (const position of enumerated) {
		if (picked.length >= MAX_INLINE) break;
		if (picked.includes(position)) continue;
		picked.push(position);
	}
	return picked.map((position, index) => {
		const token = extractRepresentativeToken(readDiffLine(diffText, position), position.path);
		const severity = SEVERITY_PALETTE[index % SEVERITY_PALETTE.length] ?? "medium";
		const category = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] ?? "correctness";
		const body = buildContextAwareBody(position, token, category);
		return {
			path: position.path,
			line: position.line,
			severity,
			category,
			body
		};
	});
}
/**
* Static fallback fixture used when the diff has zero right-side positions
* (e.g., a placeholder diff, typo-only PR, or empty PR). Anchors inline
* comments to synthetic positions on `src/example.ts` so the demo path always
* shows the full render + post pipeline.
*/
function buildFallbackBlueprints() {
	return [
		3,
		5,
		7,
		9,
		11,
		13
	].map((line, index) => {
		return {
			path: "src/example.ts",
			line,
			severity: SEVERITY_PALETTE[index % SEVERITY_PALETTE.length] ?? "medium",
			category: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] ?? "correctness",
			body: `Simulated fallback finding at \`src/example.ts:${line}\` because the diff has no right-side positions to anchor a real review.`
		};
	});
}
/**
* Build a body that references the file path and a representative token,
* tuned by category. Bodies stay generic enough that the fixture remains
* useful even when the extracted token is awkward.
*/
function buildContextAwareBody(position, token, category) {
	const file = position.path;
	switch (category) {
		case "security": return `The changed line in \`${file}\` references \`${token}\`. Confirm that any string literals, tokens, or secrets reachable from \`${token}\` are stripped by the redactor before review output is posted.`;
		case "correctness": return `The changed line in \`${file}\` references \`${token}\`. Trace the new code path through \`${token}\` and verify the call sites still gate the same invariants the previous implementation enforced.`;
		case "performance": return `The changed line in \`${file}\` references \`${token}\`. If \`${token}\` is invoked on every render path, consider memoizing its output or hoisting the constant to keep the hot path cheap.`;
		case "style": return `The changed line in \`${file}\` references \`${token}\`. Reformat the surrounding region so the new \`${token}\` declaration stays semantically grouped with the existing module exports.`;
		default: return `The changed line in \`${file}\` references \`${token}\`. Review the surrounding code paths and ensure \`${token}\` continues to behave as expected.`;
	}
}
//#endregion
//#region src/cli/simulate-findings.ts
/**
* Replaces the provider outcome with a deterministic fixture only when the live
* result is structurally empty. Live findings always win.
*/
function applySimulateFindings(input) {
	if (!input.simulateFindings) return input.outcome;
	const liveCommentCount = input.outcome.review.comments.length;
	const liveSuppressedCount = input.outcome.review.suppressedComments.length;
	if (!(liveCommentCount === 0 && liveSuppressedCount === 0)) {
		const sanitized = sanitizeForPost(`${BRAND_PREFIX}--simulate-findings set but ignored (live result has ${liveCommentCount} inline, ${liveSuppressedCount} suppressed). Live findings always win.`, input.secrets);
		process.stderr.write(`::notice::${sanitized}\n`);
		return input.outcome;
	}
	const fixture = buildSimulatedFindings(input.repo, input.prNumber, input.headSha, input.diffText);
	return {
		endpoint: input.outcome.endpoint,
		provider: input.outcome.provider,
		modelId: input.outcome.modelId,
		review: {
			summary: sanitizeForPost(fixture.summary, input.secrets),
			verdict: fixture.verdict,
			comments: sanitizeComments(fixture.comments, input.secrets),
			suppressedComments: sanitizeComments(fixture.suppressed_comments, input.secrets)
		},
		severityWarnings: [],
		parseWarnings: [],
		verifiedFactsFilter: {
			kept: [],
			downgraded: [],
			downgradeReasons: []
		}
	};
}
function sanitizeComments(comments, secrets) {
	return comments.map((comment) => ({
		path: comment.path,
		line: comment.line,
		body: sanitizeForPost(comment.body, secrets),
		severity: sanitizeForPost(comment.severity, secrets),
		category: sanitizeForPost(comment.category, secrets)
	}));
}
//#endregion
//#region src/cli/orchestrator.ts
/**
* Number of chunks to process concurrently when the chunked path is
* active. 4 is a safe default that respects provider rate-limit headers
* while still giving us a roughly 4x speed-up over serial chunking.
* See `chunkDiffByFile` (src/platform/azure/chunk.ts) for the chunking
* contract.
*/
const DEFAULT_CHUNK_CONCURRENCY = 4;
/**
* Helper used by the Azure live path. Each chunk is fed through
* `requestLiveReview` independently and the per-chunk outcomes are
* reconciled through `mergeReviewResults`.
*
* Concurrency is bounded with a small worker pool (default 4) so we
* never stampede the provider with rate-limited parallel calls while
* still finishing ~100 chunks in ~25 seconds.
*
* Resilience contract: if any individual chunk FAILS (timeout,
* network error, 5xx), we log the failure and substitute a
* structurally-empty outcome for that chunk. The merged review
* continues with the successes — a single rate-limit hiccup does
* NOT cost us the whole review.
*/
async function requestChunkedLiveReview(input) {
	const concurrency = Math.max(1, input.concurrency ?? DEFAULT_CHUNK_CONCURRENCY);
	const outcomes = [];
	let cursor = 0;
	let failedChunkCount = 0;
	const workers = Array.from({ length: Math.min(concurrency, input.chunks.length) }, async () => {
		while (true) {
			const index = cursor;
			cursor += 1;
			if (index >= input.chunks.length) break;
			const chunk = input.chunks[index];
			let outcome = null;
			try {
				outcome = await requestLiveReview({
					parsed: input.parsed,
					cwd: input.cwd,
					env: input.env,
					fetchImpl: input.fetchImpl,
					platform: input.platform,
					diffText: chunk,
					platformToken: input.platformToken,
					...input.sonarContext !== void 0 ? { sonarContext: input.sonarContext } : {}
				});
			} catch (error) {
				failedChunkCount += 1;
				const sanitized = sanitizeForPost(formatError(error), readSecretValues(input.env));
				const sanitizedPreview = sanitizeForPost(chunk.length > 80 ? `${chunk.slice(0, 77)}…` : chunk, readSecretValues(input.env));
				logWarning("", `chunk ${index + 1}/${input.chunks.length} failed (${sanitized}); substituting empty outcome. chunk preview: ${sanitizedPreview}`);
				outcome = {
					review: {
						summary: "",
						verdict: "COMMENT",
						comments: [],
						suppressedComments: []
					},
					endpoint: "",
					provider: "chunk-failed",
					modelId: "",
					severityWarnings: [],
					parseWarnings: [],
					verifiedFactsFilter: {
						kept: [],
						downgraded: [],
						downgradeReasons: []
					},
					confidenceFilter: {
						kept: [],
						downgraded: [],
						reasons: []
					}
				};
			}
			outcomes[index] = outcome;
		}
	});
	await Promise.all(workers);
	if (failedChunkCount > 0) logWarning("", `${failedChunkCount}/${input.chunks.length} chunks failed; merged review contains only findings from the chunks that succeeded.`);
	return mergeReviewResults(outcomes, { maxComments: input.parsed.maxComments ?? DEFAULT_MAX_COMMENTS_MERGE });
}
/**
* Factory for the canonical "failed but did not post" result shape.
* Used at every failure exit point in `runLive` so the wire shape stays
* byte-identical regardless of where the run failed (missing config,
* thrown error, leak gate, etc.).
*/
function failedResult(message) {
	return {
		exitCode: 1,
		posted: false,
		reviewId: void 0,
		message
	};
}
async function runLive(input) {
	resetDefaultPromptFilesCache();
	const env = input.env ?? process.env;
	const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
	const platform = detectLivePlatform(env);
	if (platform === null) {
		const message = "Live review requires GitHub Actions (GITHUB_ACTIONS=true) or Azure Pipelines (TF_BUILD=True).";
		process.stdout.write(`${BRAND_PREFIX}${message}\n`);
		return failedResult(message);
	}
	const isCopilot = input.parsed.provider === "copilot";
	const isAnthropic = input.parsed.provider === "anthropic";
	try {
		if (!isCopilot && !isAnthropic) requireLiveConfig(resolveField(input.parsed.apiUrl, env[ENV_KEYS.UMACTUALLY_API_URL], ""), ENV_KEYS.UMACTUALLY_API_URL);
		requireLiveConfig(resolveField(input.parsed.apiKey, env[ENV_KEYS.UMACTUALLY_API_KEY], ""), ENV_KEYS.UMACTUALLY_API_KEY);
	} catch (error) {
		if (error instanceof RequiredConfigError) {
			const message = error.userMessage;
			const hintLine = error.hint === void 0 ? "" : `\n${BRAND_PREFIX}hint: ${error.hint}`;
			process.stdout.write(`${BRAND_PREFIX}${message}${hintLine}\n`);
			return failedResult(message);
		}
		throw error;
	}
	const sonarContext = await readLiveSonarContext(input.parsed, fetchImpl);
	let result;
	try {
		result = await dispatchLivePlatform({
			platform,
			parsed: input.parsed,
			cwd: input.cwd,
			env,
			fetchImpl,
			...sonarContext !== void 0 ? { sonarContext } : {}
		});
	} catch (error) {
		const sanitized = sanitizeForPost(formatError(error), readSecretValues(env));
		let hint;
		if (error instanceof LiveReviewError) hint = getLiveReviewHint(error);
		else if (error instanceof RequiredConfigError) hint = error.hint;
		else if (error instanceof AzureContextError || error instanceof GithubContextError) hint = buildPlatformContextHint(error);
		const hintLine = hint === void 0 ? "" : `\n${BRAND_PREFIX}hint: ${hint}`;
		process.stdout.write(`${BRAND_PREFIX}${sanitized}${hintLine}\n`);
		return failedResult(sanitized);
	}
	if (result.posted) process.stdout.write(`${BRAND_PREFIX}${result.message}\n`);
	return result;
}
/**
* Reads the action input (via the parsed CLI argv), fetches the platform diff,
* calls the live provider, and — when `simulateFindings` is true — replaces the
* provider outcome with the deterministic fixture in
* `src/review/simulated-findings.ts`. The flag is authoritative: even when the
* live provider returns a non-empty review, the fixture fully drives the
* posted payload so the demo always shows 4-6 inline threads + suppressed
* off-diff count regardless of what the live API actually returned.
*/
async function dispatchLivePlatform(input) {
	const { platform, parsed, cwd, env, fetchImpl, sonarContext } = input;
	switch (platform) {
		case "github": {
			const context = await readGithubContext(env);
			const diffText = await fetchGithubPrDiff(context, fetchImpl);
			const leakGate = await evaluateLeakGate({
				diffText,
				detectLeaks: parsed.detectLeaks
			});
			if (!leakGate.ok) {
				logError("", leakGate.message);
				return failedResult(leakGate.message);
			}
			return runGithubLive({
				context,
				diffText,
				provider: applySimulateFindings({
					outcome: await requestLiveReview({
						parsed,
						cwd,
						env,
						fetchImpl,
						platform: "github",
						diffText,
						platformToken: context.token,
						...sonarContext !== void 0 ? { sonarContext } : {}
					}),
					simulateFindings: parsed.simulateFindings === true,
					repo: `${context.repo.owner}/${context.repo.name}`,
					prNumber: context.prNumber,
					headSha: context.headSha,
					diffText,
					secrets: [context.token]
				}),
				parsed,
				fetchImpl
			});
		}
		case "azure": {
			let azurePrNumberOverride = void 0;
			if (parsed.prNumber !== null) {
				const candidate = Number(parsed.prNumber);
				if (!Number.isFinite(candidate) || !Number.isInteger(candidate) || candidate <= 0) throw new AzureContextError("AZURE_PR_NUMBER_INVALID", `Azure CLI flag --pr-number must be a positive integer (got ${JSON.stringify(parsed.prNumber)}).`);
				if (!Number.isSafeInteger(candidate)) throw new AzureContextError("AZURE_PR_NUMBER_INVALID", `Azure CLI flag --pr-number must be a safe integer (got ${candidate}).`);
				azurePrNumberOverride = candidate;
			}
			const context = readAzureContext(env, { prNumber: azurePrNumberOverride });
			const diffText = await fetchAzurePrDiff(context, fetchImpl);
			const leakGate = await evaluateLeakGate({
				diffText,
				detectLeaks: parsed.detectLeaks
			});
			if (!leakGate.ok) {
				logError("", leakGate.message);
				return failedResult(leakGate.message);
			}
			const reviewFileLimit = parsed.reviewFileLimit ?? DEFAULT_REVIEW_FILE_LIMIT;
			const fileCount = countDiffFiles(diffText);
			let liveOutcome;
			if (reviewFileLimit > 0 && fileCount > reviewFileLimit) {
				process.stdout.write(`${BRAND_PREFIX}skipping live review — PR changes ${fileCount} files, exceeds --review-file-limit=${reviewFileLimit}. Use --review-file-limit 0 to disable.\n`);
				liveOutcome = {
					review: buildTooLargeFallback({
						fileCount,
						reviewFileLimit,
						provider: parsed.provider ?? "openai-compatible",
						modelId: parsed.model ?? "auto",
						secrets: [context.token]
					}),
					endpoint: "skipped",
					provider: parsed.provider ?? "openai-compatible",
					modelId: parsed.model ?? "auto",
					severityWarnings: [],
					parseWarnings: [],
					verifiedFactsFilter: {
						kept: [],
						downgraded: [],
						downgradeReasons: []
					},
					confidenceFilter: {
						kept: [],
						downgraded: [],
						reasons: []
					}
				};
			} else {
				const chunks = chunkDiffByFile(diffText);
				if (chunks.length <= 1) liveOutcome = await requestLiveReview({
					parsed,
					cwd,
					env,
					fetchImpl,
					platform: "azure",
					diffText,
					platformToken: context.token,
					...sonarContext !== void 0 ? { sonarContext } : {}
				});
				else {
					process.stdout.write(`${BRAND_PREFIX}chunking large PR diff into ${chunks.length} provider requests (max concurrency ${DEFAULT_CHUNK_CONCURRENCY}).\n`);
					liveOutcome = await requestChunkedLiveReview({
						parsed,
						cwd,
						env,
						fetchImpl,
						platform: "azure",
						chunks,
						platformToken: context.token,
						...sonarContext !== void 0 ? { sonarContext } : {}
					});
				}
			}
			return runAzureLive({
				context,
				diffText,
				provider: applySimulateFindings({
					outcome: liveOutcome,
					simulateFindings: parsed.simulateFindings === true,
					repo: context.repoId,
					prNumber: context.prNumber,
					headSha: "",
					diffText,
					secrets: [context.token]
				}),
				parsed,
				fetchImpl
			});
		}
		default: return assertNever(platform);
	}
}
function detectLivePlatform(env) {
	try {
		return detectPlatform(env) === "azure-devops" ? "azure" : "github";
	} catch (error) {
		if (error instanceof PlatformDetectionError) return null;
		throw error;
	}
}
function readSecretValues(env) {
	return [
		env[ENV_KEYS.UMACTUALLY_API_KEY] ?? "",
		env[ENV_KEYS.REVIEW_PROVIDER_API_KEY] ?? "",
		env[ENV_KEYS.GITHUB_TOKEN] ?? "",
		env[ENV_KEYS.SYSTEM_ACCESSTOKEN] ?? "",
		env["AZURE_DEVOPS_TOKEN"] ?? ""
	];
}
function assertNever(value) {
	throw new TypeError(`Unhandled live platform: ${value}`);
}
/**
* Build a remediation hint for a {@link AzureContextError} or
* {@link GithubContextError} thrown by the platform context readers.
*
* The context error classes carry a structured `code` (e.g.
* `AZURE_TOKEN_MISSING`, `GITHUB_EVENT_PATH_MISSING`) but the
* upstream `message` strings stay byte-compatible with the legacy
* "must be set" wording. Matching on `code` lets the CLI surface a
* much more actionable hint than a re-rendering of the message, while
* still letting the message ride through unchanged for grep-
* compatibility.
*
* Returns `undefined` for codes that don't yet have a curated hint
* (we surface the bare message instead of guessing).
*/
function buildPlatformContextHint(error) {
	const AZURE_HINTS = {
		AZURE_TOKEN_MISSING: "Set SYSTEM_ACCESSTOKEN as a pipeline variable and enable 'Allow scripts to access the OAuth token' on the Agent job. The token must have `Pull Request Contribute` permission on the target repository.",
		AZURE_COLLECTION_URI_INVALID: "Set SYSTEM_COLLECTIONURI to the org URL (e.g. https://dev.azure.com/your-org) — pipelines usually fill this in automatically; reset the job or re-queue the build if the value is `undefined`.",
		AZURE_TEAM_PROJECT_MISSING: "Set SYSTEM_TEAMPROJECT in the pipeline (or run inside a `microsoft/azure-pipelines` agent). The team project is the second segment of the repo path after `dev.azure.com/{org}/`.",
		AZURE_REPOSITORY_ID_MISSING: "Set BUILD_REPOSITORY_NAME on the pipeline, or pass --repo '<org>/<project>/<repo>' on the command line. See docs/azure-devops.md for the supported forms.",
		AZURE_PR_NUMBER_INVALID: "Set SYSTEM_PULLREQUEST_PULLREQUESTID in the pipeline (under PR trigger variables), or pass --pr-number <N> on the command line.",
		AZURE_SOURCE_COMMIT_MISSING: "Set SYSTEM_PULLREQUEST_SOURCECOMMITID in the pipeline (under PR trigger variables), or run on a pull_request-triggered build (the legacy PR_REVIEW_AUTHORING mode is not yet supported).",
		AZURE_TARGET_BRANCH_MISSING: "Set SYSTEM_PULLREQUEST_TARGETBRANCHNAME or BUILD_SOURCEBRANCHNAME in the pipeline environment. The target branch is what the review comments will be anchored against."
	};
	const GITHUB_HINTS = {
		GITHUB_TOKEN_MISSING: "Set GITHUB_TOKEN (the default GITHUB_TOKEN provided to the runner is fine; re-check `permissions:` in the workflow file or pass `permissions: pull-requests: write`).",
		GITHUB_REPOSITORY_INVALID: "Set GITHUB_REPOSITORY to '<owner>/<name>'. On fork PRs from forks you also need GITHUB_REPOSITORY-relative paths; use `pull_request_target` workflows only with care.",
		GITHUB_PR_NUMBER_INVALID: "Pass PR_NUMBER (a positive integer) as an action input, set GITHUB_PR_NUMBER in the workflow env, or rely on the supplied `pull_request` event payload's `number` field.",
		GITHUB_SHA_MISSING: "Set GITHUB_SHA in the workflow env. For pull_request events GitHub Actions sets this automatically; for workflow_dispatch / schedule jobs you may need to pass it explicitly.",
		GITHUB_EVENT_PATH_MISSING: "Set GITHUB_EVENT_PATH to the absolute path of the `event.json` payload (GitHub Actions sets this for `pull_request` events). The CLI reads PR number, base/head SHA, and draft state from it.",
		GITHUB_EVENT_PAYLOAD_INVALID: "Re-queue the workflow: the event.json payload is malformed JSON or missing the `pull_request` object. This usually means a non-`pull_request` event type was supplied."
	};
	if (error instanceof AzureContextError) return AZURE_HINTS[error.code];
	if (error instanceof GithubContextError) return GITHUB_HINTS[error.code];
}
//#endregion
//#region src/cli/run.ts
const DEFAULT_AZURE_ARTIFACT = "artifacts/manual/s4-azure-mocked-run.json";
const DEFAULT_REDACTION_REPORT = "artifacts/manual/s5-redaction-report.json";
const DEFAULT_SONAR_REPORT = "artifacts/manual/s6-sonar-mocked-run.json";
const SONAR_FIXTURE_ISSUES = JSON.stringify({ issues: [{}, {}] });
const SONAR_FIXTURE_HOTSPOTS = JSON.stringify({ hotspots: [] });
const SONAR_FIXTURE_QUALITY_GATE = JSON.stringify({ sequence: [{ projectStatus: { status: "OK" } }] });
async function runDryRun(parsed, cwd, platform) {
	resetDefaultPromptFilesCache();
	const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
	const envSources = readEnvSources(process.env);
	const artifactBody = await buildDryRunArtifact(parsed, platform, cwd);
	mergeEnvDiagnostics(artifactBody, envSources);
	await mkdir(dirname(artifactPath), { recursive: true });
	await writeFile(artifactPath, `${JSON.stringify(artifactBody, null, 2)}\n`, "utf8");
	process.stdout.write(`${BRAND_PREFIX}dry-run wrote ${artifactPath}\n`);
	return { exitCode: 0 };
}
/**
* Sibling artifact path for the parse-warnings record. The parse-warnings
* JSON sits next to the main review artifact so a CI guard or operator
* can `cat artifacts/manual/s1-github-parse-warnings.json` alongside
* the s1 review. Filename is fixed (not user-configurable) so the
* downstream check tools have a stable path.
*/
function resolveParseWarningsArtifactPath(primaryArtifactPath) {
	return customJoinPath(customDirname(primaryArtifactPath), `${customBasename(primaryArtifactPath).replace(/\.[^.]+$/u, "")}.parse-warnings.json`);
}
function customBasename(path) {
	const idx = path.lastIndexOf("/");
	const winIdx = path.lastIndexOf("\\");
	const cut = Math.max(idx, winIdx);
	return cut === -1 ? path : path.slice(cut + 1);
}
function customDirname(path) {
	const idx = path.lastIndexOf("/");
	const winIdx = path.lastIndexOf("\\");
	const cut = Math.max(idx, winIdx);
	return cut === -1 ? "" : path.slice(0, cut);
}
function customJoinPath(dir, file) {
	if (dir === "" || dir === ".") return file;
	const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
	return dir.endsWith("/") || dir.endsWith("\\") ? `${dir}${file}` : `${dir}${sep}${file}`;
}
/**
* Merge sanitized env diagnostics into the dry-run artifact body.
* Never includes raw secret values: only booleans (presence) and non-secret
* scalars (providerUrl, providerModel, env-sourced guidance flag strings).
* Called once per dry-run invocation so callers can inspect what the runtime
* actually resolved from the process environment without leaking credentials.
*/
function mergeEnvDiagnostics(body, env) {
	body["effectiveConfig"] = buildEffectiveConfig(env);
	body["secretsDetected"] = buildSecretsDetected(env);
}
/**
* Returns the non-secret env-sourced fields the dry-run artifact should expose.
* Every secret-bearing key (apiKey, sonarToken, githubToken, azureToken) is
* excluded; only their presence is reported via `secretsDetected`.
*/
function buildEffectiveConfig(env) {
	return {
		providerUrl: env.providerUrl ?? null,
		providerModel: env.providerModel ?? null,
		walkthrough: env.walkthrough ?? null,
		diagnostic: env.diagnostic ?? null,
		dryRun: env.dryRun ?? null,
		debugRawResponse: env.debugRawResponse ?? null,
		reviewTimeoutSeconds: env.reviewTimeoutSeconds ?? null,
		stallTimeoutSeconds: env.stallTimeoutSeconds ?? null,
		perRequestTimeoutSeconds: env.perRequestTimeoutSeconds ?? null,
		minimumSeverity: env.minimumSeverity ?? null,
		maxComments: env.maxComments ?? null,
		sonarEnabled: env.sonarEnabled ?? null,
		sonarHost: env.sonarHost ?? null,
		sonarProject: env.sonarProject ?? null,
		sonarTimeoutSeconds: env.sonarTimeoutSeconds ?? null,
		leakDetection: env.leakDetection ?? null,
		redactorEnabled: env.redactorEnabled ?? null,
		platform: env.platform ?? null
	};
}
/**
* Returns a boolean-only map describing which secret-bearing env vars were
* present in the process environment. Values are NEVER included.
*/
function buildSecretsDetected(env) {
	return {
		apiKey: typeof env.providerApiKey === "string" && env.providerApiKey.length > 0,
		sonarToken: typeof env.sonarToken === "string" && env.sonarToken.length > 0,
		githubToken: typeof env.githubToken === "string" && env.githubToken.length > 0,
		azureToken: typeof env.azureToken === "string" && env.azureToken.length > 0
	};
}
function resolveArtifactPath(outputArtifact, platform, cwd) {
	if (outputArtifact !== null) return isAbsolute(outputArtifact) ? outputArtifact : resolve(cwd, outputArtifact);
	return resolve(cwd, platform === "github" ? "artifacts/manual/s1-github-self-review.md" : DEFAULT_AZURE_ARTIFACT);
}
async function buildDryRunArtifact(parsed, platform, cwd) {
	if (platform === "github") return buildGithubDryRunArtifact(parsed, cwd);
	return buildAzureDryRunArtifact(parsed, cwd);
}
async function buildGithubDryRunArtifact(parsed, cwd) {
	if (parsed.dryRun && parsed.reviewPath === null) return {
		artifactPath: "artifacts/manual/s1-github-self-review.md",
		posted: false,
		marker: REVIEW_MARKER,
		inlineThreadCount: 0,
		suppressedCommentCount: 0,
		note: "no --review supplied; this was a dry-run smoke test, no posting path executed"
	};
	const eventJson = parsed.eventPath === null ? "" : await readRequiredFile(parsed.eventPath, cwd, "--event");
	const diffText = parsed.diffPath === null ? "" : await readRequiredFile(parsed.diffPath, cwd, "--diff");
	const result = await runReview({
		platform: "github",
		eventJson,
		diffText,
		providerReviewJson: await readOptionalFile(parsed.reviewPath ?? parsed.promptFile, cwd, "{}", "review"),
		expectedArtifact: "artifacts/manual/s1-github-self-review.md"
	});
	const body = {
		artifactPath: result.artifactPath,
		event: result.event,
		marker: result.marker,
		inlineThreadCount: result.inlineThreadCount,
		suppressedCommentCount: result.suppressedCommentCount
	};
	await maybeMergeRedactionReport(parsed, diffText, body);
	await maybeMergeSonarReport(parsed, body);
	return body;
}
async function buildAzureDryRunArtifact(parsed, cwd) {
	const reviewPath = parsed.reviewPath;
	if (parsed.dryRun || reviewPath === null) return {
		artifactPath: DEFAULT_AZURE_ARTIFACT,
		postedThreadCount: 0,
		postedStatusState: "succeeded",
		marker: REVIEW_MARKER,
		postingRequested: false,
		note: "no --review supplied; this was a capability-detection smoke run, no posting path executed"
	};
	if (parsed.eventPath === null || parsed.diffPath === null) throw new CliArgumentError("--review requires --event and --diff to be supplied");
	const pullRequestJson = await readRequiredFile(parsed.eventPath, cwd, "--event");
	const existingThreadsJson = parsed.threadsPath === null ? "{\"count\":0,\"value\":[]}" : await readRequiredFile(parsed.threadsPath, cwd, "--threads");
	const reviewJson = reviewPath === null ? "{\"verdict\":\"COMMENT\",\"comments\":[],\"suppressed_comments\":[]}" : await readRequiredFile(reviewPath, cwd, "--review");
	const diffPath = parsed.diffPath;
	const diffText = diffPath === null ? "" : await readRequiredFile(diffPath, cwd, "--diff");
	const result = await runAzureReview({
		pullRequestJson,
		existingThreadsJson,
		reviewJson,
		diffText,
		expectedArtifact: DEFAULT_AZURE_ARTIFACT
	});
	const body = {
		artifactPath: result.artifactPath,
		postedThreadCount: result.postedThreadCount,
		postedStatusState: result.postedStatusState,
		marker: result.marker
	};
	await maybeMergeRedactionReport(parsed, diffText, body);
	await maybeMergeSonarReport(parsed, body);
	return body;
}
async function maybeMergeRedactionReport(parsed, diffText, body) {
	if (!parsed.detectLeaks) return;
	const report = await scanReviewSecrets({
		diffText,
		expectedArtifact: DEFAULT_REDACTION_REPORT
	});
	body["highConfidenceLeakCount"] = report.highConfidenceLeakCount;
	body["redactedDiffIncludesSecret"] = report.redactedDiffIncludesSecret;
	body["blockedRawOutput"] = report.blockedRawOutput;
	body["redactionReport"] = report;
}
async function maybeMergeSonarReport(parsed, body) {
	if (!parsed.includeSonarqube) return;
	const report = await runSonarImport({
		qualityGateSequenceJson: SONAR_FIXTURE_QUALITY_GATE,
		issuesJson: SONAR_FIXTURE_ISSUES,
		hotspotsJson: SONAR_FIXTURE_HOTSPOTS,
		configured: parsed.sonarHostUrl !== null && parsed.sonarToken !== null && parsed.sonarProjectKey !== null,
		expectedArtifact: DEFAULT_SONAR_REPORT
	});
	body["waitedForTerminalQualityGate"] = report.waitedForTerminalQualityGate;
	body["importedFindingCount"] = report.importedFindingCount;
	body["timeoutHandled"] = report.timeoutHandled;
	body["skipWhenUnconfigured"] = report.skipWhenUnconfigured;
	body["sonarReport"] = report;
}
async function readRequiredFile(path, cwd, label) {
	const absolute = isAbsolute(path) ? path : resolve(cwd, path);
	try {
		return await readFile(absolute, "utf8");
	} catch (error) {
		throw new CliArgumentError(`failed to read ${label} file ${absolute}: ${formatError(error)}`);
	}
}
async function readOptionalFile(path, cwd, fallback, label) {
	if (path === null || path.length === 0) return fallback;
	return readRequiredFile(path, cwd, label);
}
var CliArgumentError = class extends Error {
	name = "CliArgumentError";
};
async function dispatchLive(parsed, cwd, env) {
	return withDebugRawEnv(parsed.debugRawResponse === true, async () => {
		const result = await runLive({
			parsed,
			cwd,
			env
		});
		const platform = resolvePlatform(parsed.platform, env);
		await writeLiveArtifact(parsed, cwd, platform, result);
		return { exitCode: validateLiveArtifact(resolveArtifactPath(parsed.outputArtifact, platform, cwd), result.exitCode) };
	});
}
function validateLiveArtifact(artifactPath, reviewExitCode) {
	const classification = classifyReviewArtifact(artifactPath);
	if (classification.ok) return reviewExitCode;
	process.stderr.write(`${BRAND_PREFIX}${artifactPath}: ${classification.reason ?? "invalid review artifact"}\n`);
	return 1;
}
/**
* Persist the live review outcome to the same artifact path the dry-run
* uses. The shape matches the dry-run artifact's top-level fields so
* `scripts/check-self-review-output.mjs` can inspect either path with
* the same classifier.
*
* Critical for the self-review guard: when the action posts a parse-fail
* card via the GitHub API, this artifact is the only local signal that
* the review produced zero findings. Without it, the guard has nothing
* to inspect and CI passes despite garbage on the PR.
*
* Two cases:
*   1. `result.posted === false`: write a parse-fail sentinel so the
*      guard catches it.
*   2. `result.posted === true`: write a success marker that reflects
*      the live review's actual counts. The dry-run path may have
*      already written a stub to this artifact, but the live path's
*      counts (which match what GitHub/Azure actually saw) are more
*      accurate. The guard inspects `inlineThreadCount`/`postedThreadCount`
*      + `parseFailed` to classify, so writing the live counts keeps
*      the guard honest about what really happened.
*
* Concurrency: also surfaced via the severity-warning concurrency guard
* in `setActiveSeveritySink`. This function runs once per `dispatchLive`
* invocation, in `finally` — so a panic mid-review still writes the
* sentinel.
*/
async function writeLiveArtifact(parsed, cwd, platform, result) {
	const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
	await mkdir(dirname(artifactPath), { recursive: true });
	if (!result.posted) {
		const body = {
			artifactPath,
			posted: false,
			message: result.message,
			marker: REVIEW_MARKER,
			inlineThreadCount: 0,
			suppressedCommentCount: 0,
			blockedRawOutput: false,
			parseFailed: true,
			note: "Live review did not post anything via the GitHub/Azure API. Inspect the action log for the underlying parser/network error."
		};
		await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
		await writeParseWarningsArtifact(artifactPath, result.parseWarnings ?? []);
		return;
	}
	const body = {
		artifactPath,
		posted: true,
		message: result.message,
		marker: REVIEW_MARKER,
		inlineThreadCount: result.inlineThreadCount ?? 0,
		suppressedCommentCount: result.suppressedCommentCount ?? 0,
		blockedRawOutput: false,
		parseFailed: result.parseFailed === true,
		...result.verdict !== void 0 ? { verdict: result.verdict } : {},
		note: "Live review posted successfully; counts reflect what the GitHub/Azure API saw."
	};
	await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
	await writeParseWarningsArtifact(artifactPath, result.parseWarnings ?? []);
}
/**
* Write the parse-warnings sibling artifact at a path derived from the
* main artifact path. Empty warnings list → still write the file
* (with summary counts) so downstream tooling has a stable contract;
* the file's `summary.invalidCount` is the field operators should
* watch for non-zero regressions.
*/
async function writeParseWarningsArtifact(primaryArtifactPath, warnings) {
	const path = resolveParseWarningsArtifactPath(primaryArtifactPath);
	const byReason = {
		"path-not-in-diff": 0,
		"line-not-in-diff": 0
	};
	const bySource = {
		comments: 0,
		suppressed_comments: 0
	};
	for (const w of warnings) {
		byReason[w.reason] += 1;
		bySource[w.source] += 1;
	}
	const body = {
		summary: {
			invalidCount: warnings.length,
			byReason,
			bySource,
			note: warnings.length === 0 ? "All model citations anchored to the supplied diff. No fabrication detected." : `${warnings.length} comment(s) cited a path or line not present in the supplied diff. The review post-filter (parseDiffPositions) dropped these from inline posting. See PR #56 for the canonical regression that produced 8 such warnings on a source-only diff.`
		},
		warnings
	};
	await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}
//#endregion
//#region src/cli/standalone-run.ts
/**
* Runs provider-only reviews for local repositories without CI platform markers.
* This module writes a standalone artifact and intentionally does not post to
* GitHub, Azure DevOps, or any other platform.
*/
/**
* Detect whether `env` represents standalone mode (no CI markers).
* True when BOTH GITHUB_ACTIONS and TF_BUILD are missing or not
* the canonical truthy values.
*/
function isStandaloneMode(env) {
	const isTruthy = (value) => value === "true" || value === "True" || value === "TRUE";
	return !isTruthy(env["GITHUB_ACTIONS"]) && !isTruthy(env["TF_BUILD"]);
}
/**
* Run a standalone review: provider call only, no platform posting.
* Writes ./umactually-review.json (or `overrideArtifactPath` if set)
* to `cwd`. Exits via the result shape — provider failures are returned.
*/
async function runStandalone(input) {
	if (input.parsed.diffPath === null) {
		const artifactPath = resolve(input.cwd, input.overrideArtifactPath ?? "./umactually-review.json");
		const note = "No diff content was found; provider review was skipped.";
		const body = {
			mode: "standalone",
			artifactPath,
			posted: false,
			note,
			provider: {
				name: input.parsed.provider ?? "openai-compatible",
				modelId: input.parsed.model ?? "auto",
				endpoint: input.parsed.apiUrl ?? ""
			},
			review: {
				summary: note,
				verdict: "COMMENT",
				comments: []
			},
			parseWarnings: 0,
			severityWarnings: 0,
			inlineThreadCount: 0,
			suppressedCommentCount: 0,
			marker: REVIEW_MARKER,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
		process.stdout.write(`${BRAND_PREFIX}standalone review (no diff) wrote ${artifactPath}\n${BRAND_PREFIX}no diff was supplied or none could be auto-derived (e.g. cwd is not a git repo with uncommitted changes or no diff was supplied). The CLI wrote a no-posting artifact instead of failing; supply --event and --diff, or run inside a git repo with uncommitted changes, or commit your changes first.\n`);
		return {
			kind: "ok",
			artifactPath,
			review: body.review
		};
	}
	const artifactPath = resolve(input.cwd, input.overrideArtifactPath ?? "./umactually-review.json");
	const diffText = await readFile(input.parsed.diffPath, "utf8");
	const providerApiKey = input.parsed.apiKey ?? "";
	if (diffText.length === 0) {
		const note = "No diff content was found; provider review was skipped.";
		const body = {
			mode: "standalone",
			artifactPath,
			posted: false,
			note,
			provider: {
				name: input.parsed.provider ?? "openai-compatible",
				modelId: input.parsed.model ?? "auto",
				endpoint: input.parsed.apiUrl ?? ""
			},
			review: {
				summary: note,
				verdict: "COMMENT",
				comments: []
			},
			parseWarnings: 0,
			severityWarnings: 0,
			inlineThreadCount: 0,
			suppressedCommentCount: 0,
			marker: REVIEW_MARKER,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
		process.stdout.write(`${BRAND_PREFIX}standalone review (no diff) wrote ${artifactPath}\n${BRAND_PREFIX}the supplied diff was empty; provider review was skipped. The CLI wrote a no-posting artifact instead of failing; check that --diff points to a non-empty unified diff, or run with --api-url / --api-key / --dry-run for a smoke test against the provider.\n`);
		return {
			kind: "ok-no-diff",
			artifactPath,
			note
		};
	}
	let outcome;
	try {
		const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
		outcome = await requestLiveReview({
			parsed: input.parsed,
			cwd: input.cwd,
			env: input.env,
			fetchImpl,
			platform: "github",
			diffText,
			platformToken: ""
		});
	} catch (error) {
		const message = error instanceof LiveReviewError || error instanceof Error ? error.message : String(error);
		const hint = error instanceof RequiredConfigError && error.hint !== void 0 ? error.hint : void 0;
		return {
			kind: "provider-error",
			exitCode: 1,
			message,
			sanitizedForLog: sanitizeForPost(message, [providerApiKey]),
			...hint !== void 0 ? { hint } : {}
		};
	}
	const note = "Standalone review completed; no platform posting was attempted.";
	const review = {
		summary: outcome.review.summary,
		verdict: outcome.review.verdict,
		comments: outcome.review.comments
	};
	const body = {
		mode: "standalone",
		artifactPath,
		posted: false,
		note,
		provider: {
			name: outcome.provider,
			modelId: outcome.modelId,
			endpoint: outcome.endpoint
		},
		review,
		parseWarnings: outcome.parseWarnings.length,
		severityWarnings: outcome.severityWarnings.length,
		inlineThreadCount: outcome.review.comments.length,
		suppressedCommentCount: outcome.review.suppressedComments.length,
		marker: REVIEW_MARKER,
		generatedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
	process.stdout.write(`${BRAND_PREFIX}standalone review wrote ${artifactPath}\n`);
	return {
		kind: "ok",
		artifactPath,
		review
	};
}
//#endregion
//#region src/cli/smart-prompt.ts
/**
* Smart interactive prompts for the CLI.
*
* The CLI's job is to be useful in BOTH a terminal (where the operator
* can answer questions) AND a CI pipeline (where stdin is closed and
* non-zero answers must mean "fail fast, don't try"). This module is
* the single boundary between those two modes.
*
* Rule of engagement:
*   - ALL prompts MUST be guarded by `canPromptInteractively(...)` so
*     we never write to a piped/CI stdin. If the environment cannot
*     answer, we throw a typed `SmartPromptUnavailable` error that the
*     caller (orchestrator / validate glue) maps to a structured
*     validation error + remediation hint.
*   - Each prompt supports a `timeoutMs` so an interactive CI with no
*     operator on the seat doesn't hang forever. A timeout is treated
*     as "user chose not to answer" — the caller surfaces the
*     remediation hint and exits.
*   - Inputs are NOT echoed to stderr (else secrets like API keys
*     would leak into CI logs).
*
* The prompts here are intentionally minimal — no chalk, no TTY
* detection libraries. The CLI already uses a single brand prefix on
* its stdout writes; the prompts print that same prefix and let
* downstream formatting (color, no-color) follow the same path.
*/
/**
* Throw when the operator's environment cannot answer an interactive
* prompt (no TTY, no stdin, or timeout). Caught by the validate glue
* so the operator gets a structured remediation hint instead of a
* raw stdin EOF / hang.
*/
var SmartPromptUnavailable = class extends Error {
	code;
	name = "SmartPromptUnavailable";
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
/**
* Returns true when the process is attached to a real TTY and stdin
* is readable. The Node-side test (`process.stdin.isTTY === true`)
* is the canonical heuristic — Bun treats it the same.
*
* NOTE: deliberately NOT wrapping in try/catch. Read-only checks on
* `process.stdin.isTTY` never throw, so a try/catch here would mask
* a legitimate internal invariant failure.
*/
function canPromptInteractively() {
	return process.stdin.isTTY === true && process.stdout.isTTY === true;
}
/**
* Render the standard prompt on stdout, read a single line from
* stdin, trim trailing newlines/spaces, return the trimmed result.
*
* No echoing of input — secrets typed into a terminal echo in the
* terminal control layer, not in our stdout/stderr, so they don't
* land in CI logs even when stdout is captured.
*
* Throws {@link SmartPromptUnavailable} when:
*   - the prompt cannot be shown (no TTY),
*   - stdin closes before a line arrives (e.g. on CI),
*   - the read times out (operator didn't answer),
*   - the underlying stream errors.
*/
async function readInteractiveLine(input) {
	if (!canPromptInteractively()) throw new SmartPromptUnavailable("NO_TTY", "Cannot read interactive input: stdin is not a TTY. Set --api-url / --api-key on the command line or via UMACTUALLY_API_URL / UMACTUALLY_API_KEY env vars.");
	process.stdout.write(`${BRAND_PREFIX}${input.prompt}\n`);
	const stdin = process.stdin;
	let timeoutHandle = null;
	const timeoutPromise = new Promise((_resolve, reject) => {
		timeoutHandle = setTimeout(() => {
			reject(new SmartPromptUnavailable("TIMEOUT", `Prompt timed out after ${input.timeoutMs}ms with no input. Set --api-url / --api-key on the command line or via env vars to skip the interactive prompt.`));
		}, input.timeoutMs);
		timeoutHandle.unref();
	});
	try {
		return await Promise.race([readOneLine(stdin), timeoutPromise]);
	} finally {
		if (timeoutHandle !== null) clearTimeout(timeoutHandle);
	}
}
/**
* Read a single line from a readable stream, resolving with the
* trimmed value. Resolves to "" on EOF (caller distinguishes empty
* vs. typed-empty via the input.length === 0 check + clarifying hint).
*
* Pure Node — no external deps. Uses the standard "data" + "end"
* events rather than readline so the import stays free of a
* third-party dep at CLI boot time (ncc bundling is happier this
* way too).
*
* Implementation note: all three event listeners (`data`, `end`,
* `error`) MUST be attached BEFORE `stream.resume()` is called.
* On a fast EOF (e.g. CI with a closed pipe), the synchronous
* `end` event fires from inside `resume()` itself; if listeners
* aren't attached by then, the Promise hangs forever. The same
* race applies to a synchronous `error` event on a destroyed stream.
* The order below is load-bearing — don't reorder.
*/
async function readOneLine(stream) {
	return await new Promise((resolve, reject) => {
		let buffer = "";
		const onData = (chunk) => {
			buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
			const newline = buffer.indexOf("\n");
			if (newline !== -1) {
				stream.pause();
				stream.removeListener("data", onData);
				stream.removeListener("end", onEnd);
				stream.removeListener("error", onError);
				resolve(buffer.slice(0, newline).trimEnd());
			}
		};
		const onEnd = () => {
			stream.removeListener("data", onData);
			stream.removeListener("error", onError);
			resolve(buffer.trimEnd());
		};
		const onError = (err) => {
			stream.removeListener("data", onData);
			stream.removeListener("end", onEnd);
			reject(new SmartPromptUnavailable("READ_ERROR", `Failed to read stdin: ${err.message}. Set --api-url / --api-key on the command line or via env vars.`));
		};
		stream.on("data", onData);
		stream.once("end", onEnd);
		stream.once("error", onError);
		stream.resume();
	});
}
/**
* Conditionally prompt for a single value. Skips the prompt when:
*   - the env var name is already populated (caller should re-check),
*   - the env var cannot be prompted (no TTY / piped stdin / timeout),
*   - the prompt times out without an answer.
*
* Returns `null` when no answer was collected — the caller should fall
* back to throwing the typed validation error.
*
* The optional `default` is offered as an empty-input fallback so the
* operator can press <Enter> to take the previously-saved value.
*/
async function smartPromptForValue(input) {
	const existingFromEnv = process.env[input.envVarName];
	if (typeof existingFromEnv === "string" && existingFromEnv.length > 0) return existingFromEnv;
	if (!canPromptInteractively()) return null;
	const defaultHint = input.default !== void 0 && input.default.length > 0 ? ` [default: ${input.default}]` : "";
	const promptText = `${input.label} (${input.envVarName})${defaultHint}: `;
	try {
		const answer = await readInteractiveLine({
			prompt: promptText,
			timeoutMs: input.timeoutMs ?? 15e3
		});
		if (answer.length > 0) return answer;
		if (input.default !== void 0 && input.default.length > 0) return input.default;
		return null;
	} catch (error) {
		if (error instanceof SmartPromptUnavailable) return null;
		throw error;
	}
}
/**
* Convenience: prompt for the two API-config values operators most
* commonly forget (`--api-url`, `--api-key`). Returns null when
* neither could be collected (caller should then throw the typed
* validation error).
*
* Both prompts share a 15-second timeout (configurable). When
* `promptForUrl` is false, only the API key is asked for — useful for
* Anthropic-native invocations where the URL is implicit.
*/
async function smartPromptForApiConfig(input) {
	let apiUrl = null;
	if (input.promptForUrl) apiUrl = await smartPromptForValue({
		label: "Model provider base URL",
		envVarName: "UMACTUALLY_API_URL",
		placeholder: "https://api.openai.com/v1",
		...input.timeoutMs !== void 0 ? { timeoutMs: input.timeoutMs } : {}
	});
	const apiKey = await smartPromptForValue({
		label: "Model provider API key",
		envVarName: "UMACTUALLY_API_KEY",
		placeholder: "sk-…",
		...input.timeoutMs !== void 0 ? { timeoutMs: input.timeoutMs } : {}
	});
	return {
		apiUrl,
		apiKey
	};
}
//#endregion
//#region src/cli/auto-context.ts
/**
* Auto-derive CLI platform context from a local git repository.
*
* SCOPE: this module owns ONLY git-cwd derivation. It does NOT
*   - Synthesize event JSON (lives at the call site, structured to avoid
*     cross-platform shape coupling — see plan D4).
*   - Synthesize fake posting identity (`prNumber="0"` was architectural rot
*     leaking local-smoke-test semantics into the posting path).
*   - Speculate on remote URL review modes (deferred — see plan D5).
*
* BEHAVIOR:
*   - If cwd is not inside a git working tree, returns `null` (caller
*     surfaces a "not in a git repo, pass --diff and --event manually"
*     guidance).
*   - Otherwise: derive (a) a diff path via `git diff <base>...HEAD`,
*     (b) the synthetic event JSON metadata (branch + base — all
*     posting-identity fields are written as `null`), and
*     (c) the canonical owner/name from `git remote get-url origin`
*     (or `null` when no canonical owner/name is parseable — caller
*     must supply `--repo` explicitly if posting is requested).
*   - Caller-supplied `diffOverride` / `eventOverride` skip generation
*     for those fields; other fields are still derived.
*
* CALLER RESPONSIBILITY: callers MUST resolve the base branch BEFORE
* invoking this function. Default-branch detection lives at the call
* site (src/cli.ts step 5 per plan D5) so the same resolveContext layer
* can serve future URL-mode inputs that don't have a cwd concept.
*
* SECURITY: `child_process.execFileSync` is used with argv as an array
* (NOT shell), so user-supplied `base` cannot escape into a shell command.
*/
/**
* Run `git <args>` in `cwd` and return trimmed stdout. Throws with the
* failing argv + stderr so the operator gets a clear root cause.
*/
function gitOrThrow(cwd, args) {
	try {
		const out = execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		return String(out).trim();
	} catch (error) {
		const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr ?? "") : "";
		throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${stderr.trim() || error.message}`);
	}
}
/**
* Parse `owner/name` out of a git remote URL. Supports SSH
* (`git@github.com:owner/name.git`) and HTTPS
* (`https://github.com/owner/name.git`) forms. Returns `null` when no
* canonical owner/name is parseable — callers MUST NOT fall back to a
* slashless dirname because that leaks the local-tempdir basename as
* a fake identity.
*/
function parseRemoteSlug(remoteUrl) {
	const ssh = /^[\w.-]+@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/u.exec(remoteUrl);
	if (ssh !== null) return `${ssh[1]}/${ssh[2]}`;
	const https = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/u.exec(remoteUrl);
	if (https !== null) return `${https[1]}/${https[2]}`;
	return null;
}
/**
* Write the synthetic GitHub-shaped event JSON metadata to a sibling of
* the diff path. Identity fields are `null` — they identify a posting
* target; the synthetic event JSON deliberately does NOT carry fake
* posting identity. The downstream consumer (`src/cli/run.ts` per Task 8)
* is responsible for accepting `null` posting identity in non-posting mode.
*/
function writeSyntheticEventJson(filePath, args) {
	const event = {
		pull_request: {
			number: null,
			head: {
				ref: args.branch,
				sha: null
			},
			base: {
				ref: args.base,
				sha: null
			}
		},
		repository: {
			full_name: args.repo,
			name: args.repo === null ? null : args.repo.split("/")[1] ?? null,
			owner: { login: args.repo === null ? null : args.repo.split("/")[0] ?? null }
		},
		action: "synthetic",
		sender: { login: "local-smoke-test" }
	};
	writeFileSync(filePath, `${JSON.stringify(event, null, 2)}\n`, "utf8");
	return filePath;
}
/**
* Returns the directory used for auto-derived temp files (diff + event).
* Lives under `cwd/.umactually-auto-ctx/` so cleanup is a single
* recursive remove. The directory is created lazily on first write.
*/
function tempDirPath(cwd) {
	return join(cwd, ".umactually-auto-ctx");
}
/** True when the named local branch ref resolves. */
function localBranchExists(cwd, branch) {
	try {
		gitOrThrow(cwd, [
			"rev-parse",
			"--verify",
			"--quiet",
			`refs/heads/${branch}`
		]);
		return true;
	} catch {
		return false;
	}
}
/**
* Top-level entry point. See module docstring for the full contract.
*
* Returns null when:
*   - cwd is not inside a git working tree.
*
* Throws when:
*   - the resolved `base` branch does not exist locally — message includes
*     `git fetch origin <base>` remediation (per plan D5).
*   - any git command fails for an unrelated reason (e.g. corrupt repo).
*
* `base` parameter is OPTIONAL — when empty/null, this module falls back
* to default-branch detection via `git symbolic-ref refs/remotes/origin/HEAD`
* and a `main`/`master` fallback. Callers that already resolve the base
* (e.g. src/cli.ts after parsing `--base`) can pass the explicit value
* to skip the probe.
*/
function deriveContextFromGit(input) {
	const { cwd, eventOverride, diffOverride } = input;
	const requestedBase = input.base;
	try {
		gitOrThrow(cwd, ["rev-parse", "--is-inside-work-tree"]);
	} catch {
		return null;
	}
	let base;
	if (typeof requestedBase === "string" && requestedBase.length > 0) base = requestedBase;
	else {
		const detected = resolveDefaultBranch(cwd);
		if (detected === null) throw new Error(`unable to detect default branch in ${cwd}: origin/HEAD is not set and neither 'main' nor 'master' exists locally. Pass --base <branch> explicitly or fetch the default branch.`);
		base = detected;
	}
	if (!localBranchExists(cwd, base)) throw new Error(`base branch '${base}' not found locally in ${cwd}. Run 'git fetch origin ${base}' or pass --base <existing-branch>.`);
	let currentBranch = "HEAD";
	try {
		currentBranch = gitOrThrow(cwd, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"HEAD"
		]);
	} catch {}
	let repo = null;
	try {
		repo = parseRemoteSlug(gitOrThrow(cwd, [
			"remote",
			"get-url",
			"origin"
		]));
	} catch {}
	const tempDir = tempDirPath(cwd);
	const diffPath = diffOverride !== void 0 && diffOverride !== null ? diffOverride : join(tempDir, "diff.patch");
	const eventPath = eventOverride !== void 0 && eventOverride !== null ? eventOverride : join(tempDir, "event.json");
	if (diffOverride === void 0 || diffOverride === null) {
		const diffOutput = gitOrThrow(cwd, ["diff", `${base}...HEAD`]);
		mkdirSync(tempDir, { recursive: true });
		writeFileSync(diffPath, diffOutput, "utf8");
	}
	if (eventOverride === void 0 || eventOverride === null) {
		mkdirSync(tempDir, { recursive: true });
		writeSyntheticEventJson(eventPath, {
			branch: currentBranch,
			base,
			repo
		});
	}
	return {
		eventPath,
		diffPath,
		repo,
		prNumber: null
	};
}
/**
* Default-branch detection helper. Returns null when origin/HEAD is not
* configured and no fallback branch exists locally. Throws only on
* unexpected git errors (corrupt repo, exec failure, etc.).
*/
function resolveDefaultBranch(cwd) {
	try {
		return gitOrThrow(cwd, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"refs/remotes/origin/HEAD"
		]).replace(/^origin\//u, "");
	} catch {
		for (const candidate of ["main", "master"]) if (localBranchExists(cwd, candidate)) return candidate;
		return null;
	}
}
//#endregion
//#region src/cli.ts
/**
* Read the package version.
*
* In normal (Node) usage, reads `package.json` via `import.meta.url`.
* In Bun --compile standalone binaries, `import.meta.url` resolves to
* Bun's virtual `/$bunfs/` and no real `package.json` exists. The
* binary is compiled with `--define UMACTUALLY_VERSION='"<version>"'`
* so the version is embedded at compile time.
*/
function readPackageVersion() {
	return "0.6.0";
}
/**
* Detect `--version` / `-V` anywhere in `argv`. Per GNU conventions, the
* flag can appear in any position (e.g. `umactually --version`,
* `umactually --api-url X --version`). The check is intentionally
* whitespace-only — short flags like `-Vfoo` are not matched.
*/
function isVersionFlag(argv) {
	for (const arg of argv) if (arg === "--version" || arg === "-V") return true;
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
function runVersion(_argv) {
	const stdout = `${readPackageVersion()}\n`;
	try {
		writeFileSync(process.stdout.fd, stdout);
	} catch {
		process.stdout.write(stdout);
	}
	return {
		exitCode: 0,
		stdout
	};
}
function buildSanitizedResolvedConfig(resolved) {
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
		sources: resolved.fieldProvenance
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
function resolveContext(parsed, cwd, env) {
	const allPlumbingSupplied = [parsed.eventPath, parsed.diffPath].every((v) => v !== null);
	const shouldDeriveFromGit = env["GITHUB_ACTIONS"] === void 0 && env["TF_BUILD"] === void 0;
	let resolved = parsed;
	let generated = [];
	if (shouldDeriveFromGit && !allPlumbingSupplied) {
		const effectiveBase = "";
		try {
			const ctx = deriveContextFromGit({
				cwd,
				base: effectiveBase,
				diffOverride: parsed.diffPath,
				eventOverride: parsed.eventPath
			});
			if (ctx !== null) {
				resolved = {
					...parsed,
					eventPath: parsed.eventPath ?? ctx.eventPath,
					diffPath: parsed.diffPath ?? ctx.diffPath
				};
				generated = [ctx.diffPath, ctx.eventPath].filter((p) => p !== parsed.diffPath && p !== parsed.eventPath);
			}
		} catch {}
	}
	return {
		resolved,
		generatedArtifacts: generated
	};
}
async function cleanupGeneratedArtifacts(generatedArtifacts, cwd) {
	if (generatedArtifacts.length === 0) return;
	const tempDir = join(cwd, ".umactually-auto-ctx");
	try {
		await rm(tempDir, {
			recursive: true,
			force: true
		});
	} catch (error) {
		process.stderr.write(`cli: failed to clean generated artifacts at ${tempDir}: ${formatError(error)}\n`);
	}
}
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
function renderValidationErrors(errors) {
	return `${`cli: ${errors.map((e) => e.message).join("; ")}\n`}${errors.map((e) => `  hint: ${e.hint}`).join("\n")}\n`;
}
async function runCli(args, cwd) {
	let parsed;
	try {
		parsed = parseCliArgs(args);
	} catch (error) {
		if (error instanceof CliHelpSignal) {
			const helpArgv = error.command !== null ? [error.command, "--help"] : ["--help"];
			process.stdout.write(resolveHelpText(helpArgv));
			return { exitCode: 0 };
		}
		if (error instanceof CliUsageError && error.hint !== void 0) {
			process.stderr.write(`cli: ${error.message}\n  hint: ${error.hint}\n`);
			return { exitCode: 2 };
		}
		throw error;
	}
	const envResolved = resolveFromSchema(parsed, process.env);
	const { resolved, generatedArtifacts } = resolveContext(envResolved, cwd, process.env);
	try {
		let errors = collectValidationErrors(resolved);
		if (errors.length > 0 && canPromptInteractively() && !resolved.dryRun && everyErrorIsApiConfig(errors) && process.env["UMACTUALLY_NO_INTERACTIVE"] === void 0) {
			const augmented = applyPromptedConfig(resolved, await smartPromptForApiConfig({ promptForUrl: errors.some((e) => e.flag === "--api-url") }));
			errors = collectValidationErrors(augmented);
			if (errors.length === 0) {
				process.stdout.write(`${BRAND_PREFIX}received credentials from interactive prompt; continuing.\n`);
				return await runAfterValidation({
					resolved: augmented,
					cwd,
					env: process.env,
					generatedArtifacts
				});
			}
			process.stderr.write(renderValidationErrors(errors));
			return {
				exitCode: 2,
				resolvedConfig: buildSanitizedResolvedConfig(augmented)
			};
		}
		if (errors.length > 0) {
			process.stderr.write(renderValidationErrors(errors));
			if (args.length === 0 && !envResolved.dryRun && errors.some((e) => e.flag === "--api-url" || e.flag === "--api-key")) process.stderr.write(`\n${BRAND_PREFIX}pick a mode:\n\n${CLI_MODES_TEXT}`);
			return {
				exitCode: 2,
				resolvedConfig: buildSanitizedResolvedConfig(resolved)
			};
		}
		return await runAfterValidation({
			resolved,
			cwd,
			env: process.env,
			generatedArtifacts
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
async function runAfterValidation(input) {
	const { resolved, cwd, env } = input;
	if (!resolved.dryRun && isStandaloneMode(env)) {
		const result = await runStandalone({
			parsed: resolved,
			cwd,
			env
		});
		if (result.kind === "provider-error") {
			const hintLine = "hint" in result && typeof result.hint === "string" ? `\n${BRAND_PREFIX}hint: ${result.hint}` : "";
			process.stdout.write(`${result.sanitizedForLog}${hintLine}\n`);
			return {
				exitCode: 1,
				resolvedConfig: buildSanitizedResolvedConfig(resolved)
			};
		}
		return {
			exitCode: 0,
			resolvedConfig: buildSanitizedResolvedConfig(resolved)
		};
	}
	return {
		...resolved.dryRun ? await runDryRun(resolved, cwd, resolvePlatform(resolved.platform)) : await dispatchLive(resolved, cwd, env),
		resolvedConfig: buildSanitizedResolvedConfig(resolved)
	};
}
/**
* Returns true when every validation error in the list refers to one of
* the API-config flags (`--api-url`, `--api-key`). Used to gate the
* smart-prompt branch so we only offer an interactive credential prompt
* when the operator's actual failure is "you forgot to provide the
* model provider config".
*/
function everyErrorIsApiConfig(errors) {
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
function applyPromptedConfig(resolved, prompted) {
	const nextApiUrl = prompted.apiUrl !== null && (resolved.apiUrl === null || resolved.apiUrl.length === 0) ? prompted.apiUrl : resolved.apiUrl;
	const nextApiKey = prompted.apiKey !== null && (resolved.apiKey === null || resolved.apiKey.length === 0) ? prompted.apiKey : resolved.apiKey;
	return {
		...resolved,
		apiUrl: nextApiUrl,
		apiKey: nextApiKey
	};
}
async function main(argv) {
	try {
		return (await dispatch(argv)).exitCode;
	} catch (error) {
		if (error instanceof CliUsageError) {
			const hintLine = error.hint === void 0 ? "" : `\n  hint: ${error.hint}`;
			process.stderr.write(`cli: ${error.message}${hintLine}\n`);
			return 2;
		}
		process.stderr.write(`cli: unexpected error: ${formatError(error)}\n`);
		return 1;
	}
}
if ((() => {
	if (typeof process === "undefined") return false;
	if (globalThis.__umactually_action_entry__ === true) return false;
	const argv1 = process.argv[1];
	if (argv1 === void 0) return false;
	return import.meta.url === pathToFileURL(argv1).href;
})()) main(process.argv.slice(2)).then((exitCode) => {
	process.exitCode = exitCode;
}).catch((error) => {
	process.stderr.write(`cli: fatal: ${formatError(error)}\n`);
	process.exitCode = 1;
});
//#endregion
export { CliUsageError, buildSanitizedResolvedConfig, isVersionFlag, main, parseCliArgs, runCli, runVersion };
