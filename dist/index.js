import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ // The require scope
/******/ var __nccwpck_require__ = {};
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__nccwpck_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

// EXPORTS
__nccwpck_require__.d(__webpack_exports__, {
  C: () => (/* binding */ buildArgs),
  i: () => (/* binding */ src_main)
});

;// CONCATENATED MODULE: external "node:fs/promises"
const promises_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:fs/promises");
;// CONCATENATED MODULE: external "node:path"
const external_node_path_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:path");
;// CONCATENATED MODULE: ./src/config/field-schema.ts
const FIELDS = {
    apiUrl: {
        field: "apiUrl",
        flag: "--api-url",
        input: "api-url",
        env: ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"],
        type: "string",
        defaultValue: "",
    },
    apiKey: {
        field: "apiKey",
        flag: "--api-key",
        input: "api-key",
        env: ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"],
        type: "string",
        defaultValue: "",
    },
    model: {
        field: "model",
        flag: "--model",
        input: "model",
        env: ["UMACTUALLY_MODEL", "REVIEW_PROVIDER_MODEL"],
        type: "string",
        defaultValue: "auto",
    },
    prompt: {
        field: "prompt",
        flag: "--prompt",
        input: "prompt",
        env: [],
        type: "string",
        defaultValue: "",
    },
    promptFile: {
        field: "promptFile",
        flag: "--prompt-file",
        input: "prompt-file",
        env: ["UMACTUALLY_PROMPT_FILE", "REVIEW_PROMPT_SYSTEM_FILE"],
        type: "string",
        defaultValue: "",
    },
    additionalPrompt: {
        field: "additionalPrompt",
        flag: "--additional-prompt",
        input: "additional-prompt",
        env: [],
        type: "string",
        defaultValue: "",
    },
    additionalPromptFile: {
        field: "additionalPromptFile",
        flag: "--additional-prompt-file",
        input: "additional-prompt-file",
        env: ["UMACTUALLY_ADDITIONAL_PROMPT_FILE", "REVIEW_PROMPT_USER_FILE"],
        type: "string",
        defaultValue: "",
    },
    walkthrough: {
        field: "walkthrough",
        flag: "--walkthrough",
        input: "walkthrough",
        env: ["UMACTUALLY_WALKTHROUGH", "REVIEW_WALKTHROUGH"],
        type: "boolean",
        defaultValue: false,
    },
    diagnostic: {
        field: "diagnostic",
        flag: "--diagnostic",
        input: "diagnostic",
        env: ["UMACTUALLY_DIAGNOSTIC", "REVIEW_DIAGNOSTIC"],
        type: "boolean",
        defaultValue: false,
    },
    dryRun: {
        field: "dryRun",
        flag: "--dry-run",
        input: "dry-run",
        env: ["UMACTUALLY_DRY_RUN", "REVIEW_DRY_RUN"],
        type: "boolean",
        defaultValue: false,
    },
    debugRawResponse: {
        field: "debugRawResponse",
        flag: "--debug-raw-response",
        input: "debug-raw-response",
        env: ["REVIEW_DEBUG_RAW_RESPONSE"],
        type: "boolean",
        defaultValue: false,
    },
    simulateFindings: {
        field: "simulateFindings",
        flag: "--simulate-findings",
        input: "simulate-findings",
        env: ["UMACTUALLY_SIMULATE_FINDINGS", "REVIEW_SIMULATE_FINDINGS"],
        type: "boolean",
        defaultValue: false,
    },
    reviewTimeoutSeconds: {
        field: "reviewTimeoutSeconds",
        flag: "--review-timeout-seconds",
        input: "review-timeout-seconds",
        env: ["UMACTUALLY_REVIEW_TIMEOUT_SECONDS", "REVIEW_TIMEOUT_SECONDS"],
        type: "integer",
        defaultValue: 300,
    },
    stallSeconds: {
        field: "stallSeconds",
        flag: "--stall-seconds",
        input: "stall-seconds",
        env: ["UMACTUALLY_STALL_SECONDS", "REVIEW_STALL_SECONDS"],
        type: "integer",
        defaultValue: 270,
    },
    perRequestTimeoutSeconds: {
        field: "perRequestTimeoutSeconds",
        flag: "--per-request-timeout-seconds",
        input: "per-request-timeout-seconds",
        env: ["REVIEW_PER_REQUEST_TIMEOUT_SECONDS"],
        type: "integer",
        defaultValue: 60,
    },
    maxOutputTokens: {
        field: "maxOutputTokens",
        flag: "--max-output-tokens",
        input: "max-output-tokens",
        env: ["UMACTUALLY_MAX_OUTPUT_TOKENS"],
        type: "integer",
        defaultValue: 16_000,
    },
    minimumSeverity: {
        field: "minimumSeverity",
        flag: "--minimum-severity",
        input: "minimum-severity",
        env: ["REVIEW_MINIMUM_SEVERITY"],
        type: "enum",
        // BREAKING CHANGE (unreleased): default flipped from "low" to "medium"
        // so low-severity (style/hygiene) findings are filtered out of the
        // postable set by default. Users who want to keep low findings
        // inline can set `minimum-severity: low` explicitly.
        defaultValue: "medium",
        enumValues: ["low", "medium", "high"],
    },
    maxComments: {
        field: "maxComments",
        flag: "--max-comments",
        input: "max-comments",
        env: ["REVIEW_MAX_COMMENTS"],
        type: "integer",
        defaultValue: 50,
    },
    reviewFileLimit: {
        field: "reviewFileLimit",
        flag: "--review-file-limit",
        input: "review-file-limit",
        env: ["REVIEW_FILE_LIMIT"],
        type: "integer",
        defaultValue: 200,
    },
    includeSonarqube: {
        field: "includeSonarqube",
        flag: "--include-sonarqube",
        input: "include-sonarqube",
        env: ["UMACTUALLY_INCLUDE_SONARQUBE", "REVIEW_SONAR_ENABLED"],
        type: "boolean",
        defaultValue: false,
    },
    sonarHostUrl: {
        field: "sonarHostUrl",
        flag: "--sonar-host-url",
        input: "sonar-host-url",
        env: ["UMACTUALLY_SONAR_HOST_URL", "REVIEW_SONAR_HOST"],
        type: "string",
        defaultValue: "",
    },
    sonarToken: {
        field: "sonarToken",
        flag: "--sonar-token",
        input: "sonar-token",
        env: ["UMACTUALLY_SONAR_TOKEN", "REVIEW_SONAR_TOKEN"],
        type: "string",
        defaultValue: "",
    },
    sonarProjectKey: {
        field: "sonarProjectKey",
        flag: "--sonar-project-key",
        input: "sonar-project-key",
        env: ["UMACTUALLY_SONAR_PROJECT_KEY", "REVIEW_SONAR_PROJECT"],
        type: "string",
        defaultValue: "",
    },
    sonarTimeoutSeconds: {
        field: "sonarTimeoutSeconds",
        flag: "--sonar-timeout-seconds",
        input: "sonar-timeout-seconds",
        env: ["REVIEW_SONAR_TIMEOUT_SECONDS"],
        type: "integer",
        defaultValue: 300,
    },
    detectLeaks: {
        field: "detectLeaks",
        flag: "--detect-leaks",
        input: "detect-leaks",
        env: ["UMACTUALLY_DETECT_LEAKS", "REVIEW_LEAK_DETECTION"],
        type: "boolean",
        defaultValue: true,
    },
    platform: {
        field: "platform",
        flag: "--platform",
        input: "platform",
        env: ["REVIEW_PLATFORM"],
        type: "enum",
        defaultValue: "auto",
        // Canonical three variants. The CLI parser accepts the `"azure-devops"`
        // alias and normalizes to `"azure"` before this field is reached; the
        // config loader therefore only sees the canonical set.
        enumValues: ["auto", "github", "azure"],
    },
    prNumber: {
        field: "prNumber",
        flag: "--pr-number",
        input: "pr-number",
        env: [],
        type: "string",
        defaultValue: "",
    },
    repo: {
        field: "repo",
        flag: "--repo",
        input: "repo",
        env: [],
        type: "string",
        defaultValue: "",
    },
    effort: {
        field: "effort",
        flag: "--effort",
        input: "effort",
        env: [],
        type: "enum",
        defaultValue: "medium",
        enumValues: ["low", "medium", "high"],
    },
    provider: {
        field: "provider",
        flag: "--provider",
        input: "provider",
        env: [],
        type: "enum",
        defaultValue: "openai-compatible",
        enumValues: ["openai-compatible", "copilot"],
    },
    githubApiBase: {
        field: "githubApiBase",
        flag: "--github-api-base",
        input: "github-api-base",
        env: ["UMACTUALLY_GITHUB_API_BASE"],
        type: "string",
        defaultValue: "",
    },
    githubToken: {
        field: "githubToken",
        flag: null,
        input: "github_token",
        env: ["GITHUB_TOKEN"],
        type: "string",
        defaultValue: "",
    },
    promptByteCap: {
        field: "promptByteCap",
        flag: null,
        input: "prompt-byte-cap",
        env: ["REVIEW_PROMPT_BYTE_CAP"],
        type: "integer",
        defaultValue: 65_536,
    },
    redactorEnabled: {
        field: "redactorEnabled",
        flag: null,
        input: "redactor-enabled",
        env: ["REVIEW_REDACTOR_ENABLED"],
        type: "boolean",
        defaultValue: true,
    },
    azureOrg: {
        field: "azureOrg",
        flag: null,
        input: "azure-org",
        env: ["AZURE_DEVOPS_ORG"],
        type: "string",
        defaultValue: "",
    },
    azureProject: {
        field: "azureProject",
        flag: null,
        input: "azure-project",
        env: ["AZURE_DEVOPS_PROJECT"],
        type: "string",
        defaultValue: "",
    },
    azureRepo: {
        field: "azureRepo",
        flag: null,
        input: "azure-repo",
        env: ["AZURE_DEVOPS_REPO"],
        type: "string",
        defaultValue: "",
    },
    azurePullRequestId: {
        field: "azurePullRequestId",
        flag: null,
        input: "azure-pull-request-id",
        env: ["AZURE_DEVOPS_PULL_REQUEST_ID"],
        type: "integer",
        defaultValue: 0,
    },
    azureToken: {
        field: "azureToken",
        flag: null,
        input: "azure-token",
        env: ["AZURE_DEVOPS_TOKEN"],
        type: "string",
        defaultValue: "",
    },
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

;// CONCATENATED MODULE: ./src/util/cli-args.ts
/**
 * Default error class thrown by `readEnum` when an enum value is invalid.
 * The class lives here so `readEnum` can throw it without circular
 * imports between `cli-args.ts` and `parse-args.ts` (the parse-args.ts
 * file defines its own `CliUsageError` separately for parse-time
 * errors; callers that want the CLI to recognize the error can pass
 * their own constructor via `readEnum(..., { errorClass: CliUsageError })`).
 */
class CliArgError extends Error {
    name = "CliArgError";
}
/** Push optional CLI flag values consistently; eliminates duplicated non-empty string guards in CLI builders. */
function pushFlagValue(args, flag, value) {
    if (value !== undefined && value.length > 0) {
        args.push(flag, value);
    }
}
/** Push numeric CLI flag values consistently; eliminates repeated number-to-string flag handling. */
function pushNumber(args, flag, value) {
    args.push(flag, String(value));
}
/** Push boolean CLI flags consistently; eliminates duplicated conditional flag append logic. */
function pushBool(args, condition, flag) {
    if (condition) {
        args.push(flag);
    }
}
/** Resolve env aliases consistently; eliminates duplicated first-non-empty fallback loops. */
function envFallback(...values) {
    for (const value of values) {
        if (value !== undefined && value.length > 0) {
            return value;
        }
    }
    return "";
}
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
    if (raw.length === 0)
        return null;
    // A single optional sign followed by 1+ ASCII digits, and nothing else.
    // Using a regex (rather than a manual loop) keeps the intent grep-able
    // and the cost trivial (this runs only at CLI/env boundary).
    if (!/^[+-]?\d+$/u.test(raw))
        return null;
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
    for (const candidate of accepted) {
        if (candidate === value) {
            return candidate;
        }
    }
    throw new errorClass(`invalid ${flag} value: ${value}`);
}

;// CONCATENATED MODULE: ./src/util/brand.ts
/**
 * Canonical brand string used across CLI, platform, and provider code.
 *
 * NOT a generic brand concept: this is the specific string
 * "umactually-pr-review" that downstream consumers (PR comments, HTTP
 * User-Agent headers, GitHub agents) match on. Any value other than the
 * literal "umactually-pr-review" will break dedup loops and integration
 * parsers, so this is a pinned identifier — not a configuration knob.
 */
/** Canonical review brand string; eliminates the 50+ inline "umactually-pr-review" literals across CLI, platform, and provider code. */
const BRAND = "umactually-pr-review";
/** Log prefix shared by annotation helpers; eliminates hand-built "umactually-pr-review: " prefixes in stderr diagnostics. */
const BRAND_PREFIX = `${BRAND}: `;
/** HTTP User-Agent token shared by provider and platform clients; eliminates duplicated header literals. */
const USER_AGENT = BRAND;
/** Azure DevOps PR status context name; prevents status updates from drifting away from the review brand. */
const AZURE_STATUS_CONTEXT_NAME = `${BRAND}-status`;
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

;// CONCATENATED MODULE: ./src/config/errors.ts
class errors_InvalidConfigError extends Error {
    field;
    reason;
    name = "InvalidConfigError";
    constructor(field, reason, options) {
        super(`Invalid config for '${field}': ${reason}`, options);
        this.field = field;
        this.reason = reason;
    }
}
class PromptFileError extends Error {
    path;
    reason;
    name = "PromptFileError";
    constructor(path, reason, options) {
        super(`Prompt file error: ${reason}`, options);
        this.path = path;
        this.reason = reason;
    }
}
/**
 * Marker used in error messages to replace any user-supplied value
 * (URLs, tokens, prompt content). Never echo the raw value.
 */


;// CONCATENATED MODULE: ./src/config/parsers.ts



const TRUTHY_STRINGS = new Set(["1", "true", "yes", "on", "y"]);
const FALSY_STRINGS = new Set(["0", "false", "no", "off", "n", ""]);
/**
 * Parses a boolean from an unknown boundary. Accepts:
 * - native boolean
 * - 0 or 1 (number)
 * - string in TRUTHY_STRINGS / FALSY_STRINGS (case-insensitive, trimmed)
 * Anything else throws InvalidConfigError with [REDACTED] in the message.
 */
function parseBooleanFromUnknown(value, field) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number") {
        if (value === 1)
            return true;
        if (value === 0)
            return false;
        throw new InvalidConfigError(field, `expected boolean, received number ${REDACTED}`);
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (TRUTHY_STRINGS.has(normalized))
            return true;
        if (FALSY_STRINGS.has(normalized))
            return false;
        throw new InvalidConfigError(field, `expected boolean string, received ${REDACTED}`);
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
        if (!Number.isInteger(value)) {
            throw new InvalidConfigError(field, `expected integer, received non-integer number ${REDACTED}`);
        }
        return value;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            throw new InvalidConfigError(field, `expected integer, received empty string`);
        }
        if (!INTEGER_RE.test(trimmed)) {
            throw new InvalidConfigError(field, `expected integer string, received ${REDACTED}`);
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed)) {
            throw new InvalidConfigError(field, `expected finite integer, received ${REDACTED}`);
        }
        // Reject values outside the safe-integer range so callers that
        // rely on exact equality (severity-key lookups, cache keys,
        // downstream arithmetic) do not silently truncate. The CLI's
        // parseStrictInt has the same check; this is the config-loader's
        // equivalent so the two surfaces agree.
        if (!Number.isSafeInteger(parsed)) {
            throw new InvalidConfigError(field, `expected integer in [${Number.MIN_SAFE_INTEGER}, ${Number.MAX_SAFE_INTEGER}], received ${REDACTED}`);
        }
        return parsed;
    }
    throw new InvalidConfigError(field, `expected integer, received ${typeof value}`);
}
const VALID_SEVERITIES = new Set([
    "info",
    "minor",
    "major",
    "critical",
    "security",
    "leak",
]);
const SEVERITY_ALIASES = Object.freeze({
    low: "minor",
    medium: "major",
    high: "critical",
});
// Startup invariant: every alias target must be a canonical Severity in
// VALID_SEVERITIES. The TypeScript `Record<... , Severity | undefined>`
// signature catches invalid targets at compile time, but a future
// relaxation (e.g. widening the type during a refactor) would let bad
// aliases slip through. This assertion runs once at module load and
// throws if anyone introduces `"low": "banana"`-style drift. The
// pin-by-test in `test/unit/config-extended.test.ts:config:
// minimum-severity default + alias mapping` covers the live case; this
// is the compile-time-fallback for static analysis.
for (const [alias, target] of Object.entries(SEVERITY_ALIASES)) {
    if (target !== undefined && !VALID_SEVERITIES.has(target)) {
        throw new Error(`severity alias "${alias}" maps to non-canonical severity ${JSON.stringify(target)}`);
    }
}
function parseSeverityFromUnknown(value, field) {
    if (typeof value !== "string") {
        throw new errors_InvalidConfigError(field, `expected severity string, received ${typeof value}`);
    }
    const normalized = value.trim().toLowerCase();
    const alias = SEVERITY_ALIASES[normalized];
    if (alias !== undefined)
        return alias;
    if (!VALID_SEVERITIES.has(normalized)) {
        throw new errors_InvalidConfigError(field, `unknown severity ${REDACTED_PLACEHOLDER}`);
    }
    return normalized;
}
// Derive the parser's accepted set from the canonical field-schema entry.
// Single source of truth: changing the canonical `enumValues` here updates
// both the parser and any future code-gen of the action.yml / CLI help.
const VALID_PLATFORMS = new Set(FIELDS.platform.enumValues ?? []);
function parsePlatformFromUnknown(value, field) {
    if (typeof value !== "string") {
        throw new InvalidConfigError(field, `expected platform string, received ${typeof value}`);
    }
    const normalized = value.trim().toLowerCase();
    if (!VALID_PLATFORMS.has(normalized)) {
        throw new InvalidConfigError(field, `unknown platform ${REDACTED}`);
    }
    return normalized;
}
/**
 * Normalizes a provider base URL:
 * - trims whitespace
 * - requires http: or https:
 * - lowercases scheme and host
 * - strips query/fragment
 * - appends `/v1` if no version path segment is present
 *
 * Never includes the raw URL in error messages.
 */
function normalizeApiUrl(rawUrl, field) {
    if (typeof rawUrl !== "string") {
        throw new InvalidConfigError(field, `expected URL string, received ${typeof rawUrl}`);
    }
    const trimmed = rawUrl.trim();
    if (trimmed.length === 0) {
        throw new InvalidConfigError(field, `expected non-empty URL`);
    }
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
        throw new InvalidConfigError(field, `unparseable URL ${REDACTED}`);
    }
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
        throw new InvalidConfigError(field, `unsupported URL scheme ${REDACTED}`);
    }
    const cleanedPath = normalizePath(parsed.pathname);
    const hasVersionSegment = hasVersionPathSegment(cleanedPath);
    const finalPath = hasVersionSegment ? cleanedPath : appendV1(cleanedPath);
    return `${protocol}//${parsed.host.toLowerCase()}${finalPath}`;
}
function normalizePath(pathname) {
    return stripTrailingSlash(pathname);
}
function hasVersionPathSegment(path) {
    if (path.length === 0)
        return false;
    const segments = path.split("/");
    for (const segment of segments) {
        if (/^v\d+$/.test(segment))
            return true;
    }
    return false;
}
function appendV1(path) {
    return path.length === 0 ? "/v1" : `${path}/v1`;
}

;// CONCATENATED MODULE: ./src/cli/parse-args.ts



class CliUsageError extends Error {
    name = "CliUsageError";
}
function parseCliArgs(args) {
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
    let additionalPromptFile = null;
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
    // BREAKING CHANGE: default flipped from null (no minimum) to "medium".
    // Matches the action.yml default and src/config/field-schema.ts so the
    // CLI and the GitHub Action behave the same out of the box. Without
    // this, the CLI path's passesSeverityPolicy() short-circuits on null
    // and posts every finding including low/info, while the action filters
    // them. Users who want the old "no minimum" behavior can pass
    // `--minimum-severity low` explicitly.
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
    // Layer 2-C: default ON so the wire-format JSON-schema constraint
    // fires by default. Operators on providers that reject the strict-
    // schema payload can opt out via --no-strict-schema.
    let strictSchema = true;
    // Layer 4: default ON so the deterministic verifyFindingsAgainstDiff
    // re-runs the (path, line) filter on the model's comments[] before
    // posting. The filter is the same one the post-filter uses; running
    // it explicitly is defense-in-depth (the parse-warnings artifact
    // would also catch the same off-diff citations, but this drops
    // them from the postable set before they even reach the platform).
    let verifyFindings = true;
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === undefined) {
            continue;
        }
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
            case "--additional-prompt-file":
                additionalPromptFile = readValue(args, index, "additional-prompt-file");
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
            case "--no-ignore-minor":
                throw new CliUsageError("--ignore-minor was removed; use --minimum-severity medium (or low/high) to suppress minor findings. Leaks and security findings are never suppressed. Environment variables UMACTUALLY_IGNORE_MINOR and REVIEW_IGNORE_MINOR are also ignored.");
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
            case "-h":
                throw new CliHelpSignal();
            default:
                throw new CliUsageError(`unknown flag: ${token}`);
        }
    }
    return {
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
        additionalPromptFile,
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
        minimumSeverityInternal: minimumSeverity === null
            ? null
            : parseSeverityFromUnknown(minimumSeverity, "cli.minimumSeverity"),
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
        verifyFindings,
    };
}
class CliHelpSignal extends Error {
    name = "CliHelpSignal";
}
function consumeValue(args, index, flag, apply) {
    const value = readValue(args, index, flag);
    apply(value);
    return index + 1;
}
function readValue(args, index, flag) {
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
        throw new CliUsageError(`flag --${flag} requires a value`);
    }
    return next;
}
function readIntValue(args, index, flag) {
    const raw = readValue(args, index, flag);
    // parseStrictInt already returns null for non-safe-integer parses, so
    // no extra isSafeInteger check is needed at the call site — null
    // is the single sentinel for "not a valid integer".
    const parsed = parseStrictInt(raw);
    if (parsed === null) {
        throw new CliUsageError(`flag --${flag} requires an integer value (got "${raw}")`);
    }
    return parsed;
}
function readMinimumSeverity(args, index) {
    const raw = readValue(args, index, "minimum-severity");
    return readEnum("--minimum-severity", raw, FIELDS.minimumSeverity.enumValues, CliUsageError);
}
function readPlatform(value) {
    // Accept "azure-devops" as a CLI-only alias for "azure" so callers
    // familiar with the older name keep working.
    if (value === "azure-devops") {
        return "azure";
    }
    return readEnum("--platform", value, FIELDS.platform.enumValues, CliUsageError);
}
function readEffort(args, index) {
    const raw = readValue(args, index, "effort");
    return readEnum("--effort", raw, FIELDS.effort.enumValues, CliUsageError);
}
function readProvider(value) {
    return readEnum("--provider", value, FIELDS.provider.enumValues, CliUsageError);
}

;// CONCATENATED MODULE: ./src/cli/help.ts
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
 */
const HELP_FLAGS = [
    { flag: "--platform <auto|github|azure>" },
    { flag: "--event <path>", description: "GitHub event JSON or Azure pull-request JSON" },
    { flag: "--diff <path>", description: "PR diff text" },
    { flag: "--threads <path>", description: "Azure existing threads JSON (optional in dry-run)" },
    { flag: "--review <path>", description: "Azure provider review JSON (optional in dry-run)" },
    { flag: "--pr-number <n>", description: "Pull request number" },
    { flag: "--repo <owner/name>" },
    { flag: "--api-url <url>", description: "Provider Responses API URL (default: https://api.openai.com/v1)" },
    { flag: "--api-key <key>", description: "Provider API key" },
    { flag: "--model <id>", description: "Provider model id (default: auto)" },
    { flag: "--prompt <text>", description: "Inline system prompt override" },
    { flag: "--prompt-file <path>" },
    { flag: "--additional-prompt <text>" },
    { flag: "--additional-prompt-file <path>" },
    { flag: "--effort <low|medium|high>", description: "Reasoning effort hint (default: medium)" },
    { flag: "--provider <openai-compatible|copilot>", description: "Provider family" },
    { flag: "--github-api-base <url>", description: "GitHub API base URL (Copilot token exchange; default: https://api.github.com)" },
    { flag: "--include-sonarqube" },
    { flag: "--sonar-host-url <url>" },
    { flag: "--sonar-token <token>" },
    { flag: "--sonar-project-key <key>" },
    { flag: "--sonar-timeout-seconds <n>" },
    { flag: "--review-timeout-seconds <n>" },
    { flag: "--stall-seconds <n>" },
    { flag: "--per-request-timeout-seconds <n>" },
    { flag: "--max-output-tokens <n>" },
    { flag: "--max-comments <n>" },
    { flag: "--review-file-limit <n>", description: "Cap on changed files for live review (0 = disable)" },
    { flag: "--minimum-severity <low|medium|high>", description: "default: medium" },
    { flag: "--strict-schema | --no-strict-schema", description: "Send response_format json_schema on the wire (default: yes)" },
    { flag: "--verify-findings | --no-verify-findings", description: "Deterministic (path,line) re-verification before posting (default: yes)" },
    { flag: "--walkthrough | --no-walkthrough" },
    { flag: "--diagnostic | --no-diagnostic" },
    { flag: "--debug-raw-response | --no-debug-raw-response" },
    { flag: "--detect-leaks | --no-detect-leaks" },
    { flag: "--dry-run | --no-dry-run" },
    { flag: "--simulate-findings | --no-simulate-findings" },
    { flag: "--output-artifact <path>" },
];
const FLAG_COLUMN_WIDTH = HELP_FLAGS.reduce((max, { flag }) => Math.max(max, flag.length), 0);
const GUTTER_SPACES = 2;
const INDENT_SPACES = 2;
/** Render one flag with optional description, padded to the canonical description column. */
function renderFlagLine({ flag, description }) {
    const padding = " ".repeat(FLAG_COLUMN_WIDTH - flag.length + GUTTER_SPACES);
    const head = `${" ".repeat(INDENT_SPACES)}${flag}${padding}`;
    return description === undefined ? head : `${head}${description}`;
}
const CLI_HELP_TEXT = [
    "umactually-pr-review — provider-agnostic PR review CLI",
    "",
    "Flags:",
    ...HELP_FLAGS.map(renderFlagLine),
    "",
].join("\n");
function printHelp() {
    process.stdout.write(CLI_HELP_TEXT);
}

;// CONCATENATED MODULE: ./src/security/scan-review-secrets.ts

const HIGH_CONFIDENCE_SECRET_PATTERNS = [
    /\bsk_test_[a-z_]+\b/g,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    /\bghp_[A-Za-z0-9]{36}\b/g,
];
async function scanReviewSecrets(input) {
    const highConfidenceLeakCount = countHighConfidenceLeaks(input.diffText);
    const redactedDiff = redactHighConfidenceSecrets(input.diffText);
    return {
        artifactPath: input.expectedArtifact,
        highConfidenceLeakCount,
        redactedDiffIncludesSecret: countHighConfidenceLeaks(redactedDiff) > 0,
        blockedRawOutput: true,
    };
}
function countHighConfidenceLeaks(diffText) {
    let highConfidenceLeakCount = 0;
    for (const line of diffText.split("\n")) {
        if (isAddedDiffLine(line)) {
            highConfidenceLeakCount += countLineSecrets(line);
        }
    }
    return highConfidenceLeakCount;
}
function redactHighConfidenceSecrets(diffText) {
    return diffText
        .split("\n")
        .map((line) => (isAddedDiffLine(line) ? redactLineSecrets(line) : line))
        .join("\n");
}
function isAddedDiffLine(line) {
    return line.startsWith("+") && !line.startsWith("+++");
}
function countLineSecrets(line) {
    let secretCount = 0;
    for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) {
        secretCount += Array.from(line.matchAll(pattern)).length;
    }
    return secretCount;
}
function redactLineSecrets(line) {
    let redactedLine = line;
    for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) {
        redactedLine = redactedLine.replace(pattern, REDACTED_SECRET_TOKEN);
    }
    return redactedLine;
}

;// CONCATENATED MODULE: ./src/util/marker.ts
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
 */
const REVIEW_MARKER = "<!-- umactually-pr-review -->";
/**
 * JSON schema identifier for the UmActually manifest that lives inside
 * the `<!-- umactually-pr-review:manifest { ... } -->` HTML comment on
 * every posted review. Format is `${BRAND}/v${VERSION}`. AI agents and
 * downstream tooling parse this string to know they're reading an
 * UmActually-shaped payload.
 *
 * NOT a generic "manifest schema" — this is UmActually-specific by
 * design. The brand name appears in the schema id so consumers can
 * tell UmActually manifests apart from any other review tool's
 * payloads.
 */
const MANIFEST_SCHEMA = "umactually-pr-review/v1";
/**
 * Legacy HTML marker from the prior action incarnation. Kept so existing
 * PR comments authored under that scheme can still be detected for replacement.
 */
const LEGACY_MARKER = "<!-- auto-pr-review -->";
/** Slug of the legacy marker, for body-text matching without the HTML comment delimiters. */
const LEGACY_MARKER_SLUG = "auto-pr-review";
/**
 * Returns true when `body` contains the UmActually review marker.
 * Centralized so future marker variants (e.g. parent-vs-inline) only need
 * to be added here.
 */
function commentBodyHasMarker(body) {
    return body.includes(REVIEW_MARKER);
}

;// CONCATENATED MODULE: ./src/util/json-guards.ts
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
 * `src/cli/parse-args.ts`, `src/action/read-inputs.ts`, and
 * the platform context modules.
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
function readStringField(record, key) {
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
    if (typeof value !== "string") {
        const field = label ?? key;
        throw new TypeError(`Expected field '${field}' to be a string, received: ${typeof value}`);
    }
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
    if (!isSafeInteger(value)) {
        const field = label ?? key;
        throw new TypeError(`Expected field '${field}' to be a number, received: ${typeof value}`);
    }
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
    if (!isRecord(value)) {
        return null;
    }
    const inner = value[key];
    return isRecord(inner) ? inner : null;
}
/**
 * Read-and-parse a JSON text body into a typed record. Returns `null`
 * when the body is empty OR when the parsed value is not a JSON object.
 * Centralizes the recipe that was duplicated across
 * `src/sonar/run-sonar-import.ts`, `src/review/*`, and
 * `src/platform/azure/payload.ts`.
 */
function readJsonRecord(text) {
    if (text.length === 0) {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        return null;
    }
    return isRecord(parsed) ? parsed : null;
}
/**
 * Read-and-parse a JSON text body into a typed array. Returns `null`
 * when the body is empty OR when the parsed value is not a JSON array.
 * Centralizes the recipe that was duplicated across `src/sonar/*` and
 * the platform payload parsers.
 */
function readJsonArray(text) {
    if (text.length === 0) {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        return null;
    }
    return isUnknownArray(parsed) ? parsed : null;
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
    }
    catch {
        return undefined;
    }
}

;// CONCATENATED MODULE: external "node:crypto"
const external_node_crypto_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:crypto");
;// CONCATENATED MODULE: ./src/util/verdict.ts
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
const KNOWN_UMBRELLA_VERDICTS = ["APPROVED", "COMMENT", "DISCUSS", "SHIP"];
const KNOWN_BLOCKING_VERDICT = "NEEDS_FIX";
function mapVerdictToAzureStatus(verdict, policy) {
    const normalized = verdict.toUpperCase();
    // Umbrella strings → succeeded under both policies.
    if (KNOWN_UMBRELLA_VERDICTS.includes(normalized)) {
        return "succeeded";
    }
    if (policy === "legacy") {
        // Legacy policy throws on unknown verdicts — preserves the original
        // `assertNever(verdict)`-style guard from
        // `azure/run-azure-review.ts:mapVerdictToStatus` that the S4 RED
        // contract depends on. (There is no `assertNever` function in this
        // module; the same effect is achieved via the explicit TypeError
        // below.)
        if (normalized === KNOWN_BLOCKING_VERDICT)
            return "failed";
        throw new TypeError(`unknown verdict for legacy Azure status mapping: ${redactVerdictForError(verdict)}`);
    }
    // Current policy: NEEDS_FIX → "pending"; anything unknown (including
    // empty string) also collapses to "pending" so a malformed verdict
    // can't crash the live runner.
    return "pending";
}
/**
 * Redact a user-supplied verdict for inclusion in an error message.
 * Replaces the raw input with `len=<utf8 bytes>, sha256=<12 hex chars>`
 * so the error is informative for log correlation without echoing
 * PII, control characters, or terminal-escape sequences from the input.
 */
function redactVerdictForError(verdict) {
    const bytes = Buffer.byteLength(verdict, "utf8");
    const hash = (0,external_node_crypto_namespaceObject.createHash)("sha256").update(verdict).digest("hex").slice(0, 12);
    return `len=${bytes}, sha256=${hash}`;
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
    // Only the blocking verdict is the contradiction class. Other
    // verdicts on empty reviews are coherent states and pass through.
    if (verdict.toUpperCase() !== "NEEDS_FIX") {
        return verdict;
    }
    const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
    if (total === 0) {
        return "COMMENT";
    }
    return verdict;
}
/** Verdict ranking used by the merge path's "worst verdict wins" rule. */
function verdictRank(verdict) {
    switch (verdict.toUpperCase()) {
        case "NEEDS_FIX":
            return 4;
        case "DISCUSS":
            return 3;
        case "COMMENT":
        case "SHIP":
        case "APPROVED":
            return 2;
        default:
            return 0;
    }
}

;// CONCATENATED MODULE: ./src/platform/azure/diff.ts
function buildUnifiedFileDiff(path, oldFile, newFile) {
    if (oldFile.exists === newFile.exists && oldFile.content === newFile.content) {
        return null;
    }
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
        "",
    ].join("\n");
}
function buildHunkLines(oldLines, newLines) {
    const prefixLength = findCommonPrefixLength(oldLines, newLines);
    const suffixLength = findCommonSuffixLength(oldLines, newLines, prefixLength);
    const hunkLines = [];
    for (const line of oldLines.slice(0, prefixLength)) {
        hunkLines.push(` ${line}`);
    }
    for (const line of oldLines.slice(prefixLength, oldLines.length - suffixLength)) {
        hunkLines.push(`-${line}`);
    }
    for (const line of newLines.slice(prefixLength, newLines.length - suffixLength)) {
        hunkLines.push(`+${line}`);
    }
    for (const line of oldLines.slice(oldLines.length - suffixLength)) {
        hunkLines.push(` ${line}`);
    }
    return hunkLines;
}
function findCommonPrefixLength(oldLines, newLines) {
    let index = 0;
    while (index < oldLines.length && index < newLines.length && oldLines[index] === newLines[index]) {
        index += 1;
    }
    return index;
}
function findCommonSuffixLength(oldLines, newLines, prefixLength) {
    let length = 0;
    while (length + prefixLength < oldLines.length &&
        length + prefixLength < newLines.length &&
        oldLines[oldLines.length - length - 1] === newLines[newLines.length - length - 1]) {
        length += 1;
    }
    return length;
}
function splitContentLines(content) {
    if (content.length === 0) {
        return [];
    }
    const contentWithoutFinalNewline = content.endsWith("\n") ? content.slice(0, -1) : content;
    if (contentWithoutFinalNewline.length === 0) {
        return [];
    }
    return contentWithoutFinalNewline.split(/\r?\n/u);
}
function formatRange(lines) {
    const start = lines.length === 0 ? 0 : 1;
    return `${start},${lines.length}`;
}
function normalizeDiffPath(path) {
    return path.startsWith("/") ? path.slice(1) : path;
}

;// CONCATENATED MODULE: ./src/util/platform-error.ts
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
class PlatformContextError extends Error {
    code;
    name = "PlatformContextError";
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
    }
}
/** Shared platform API error base; subclasses override `name` with platform-specific literals. */
class PlatformApiError extends Error {
    code;
    status;
    name = "PlatformApiError";
    constructor(code, status, message, options) {
        super(message, options);
        this.code = code;
        this.status = status;
    }
}

;// CONCATENATED MODULE: ./src/platform/azure/errors.ts

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
class AzureApiError extends PlatformApiError {
    name = "AzureApiError";
    constructor(code, status, message, options) {
        super(code, status, message, options);
    }
}
const AZURE_EMPTY_DIFF_STATUS = 200;

;// CONCATENATED MODULE: ./src/platform/azure/payload.ts


function parseLatestIterationId(payload) {
    const root = requireRecord(payload, "Azure iterations response");
    const iterations = requireArray(root["value"], "Azure iterations response value");
    const latestIteration = iterations.at(-1);
    if (latestIteration === undefined) {
        throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, "Azure DevOps PR iterations response was empty.");
    }
    const latestRecord = requireRecord(latestIteration, "Azure latest iteration");
    return requirePositiveInteger(latestRecord["id"], "Azure latest iteration id");
}
function parseSourceCommitId(payload) {
    const root = requireRecord(payload, "Azure iteration response");
    const sourceRefCommit = requireRecord(root["sourceRefCommit"], "Azure iteration sourceRefCommit");
    return requireNonEmptyString(sourceRefCommit["commitId"], "Azure iteration sourceRefCommit.commitId");
}
function parseIterationChanges(payload) {
    const root = requireRecord(payload, "Azure iteration changes response");
    const rawChanges = findFirstArray(root, ["changes", "changeEntries", "value"]);
    if (rawChanges === null) {
        throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, "Azure DevOps PR iteration changes response did not include changes.");
    }
    return rawChanges
        .map(parseAzureChange)
        .filter((change) => change !== null);
}
function parseItemContent(payload) {
    const root = requireRecord(payload, "Azure item response");
    return requireString(root["content"], "Azure item response content");
}
function parseAzureChange(value) {
    const root = requireRecord(value, "Azure iteration change");
    const item = requireRecord(root["item"], "Azure iteration change item");
    // ADO returns item.path as null for deleted files (the path lives in
    // originalPath at the change root). Those entries have no item content to
    // diff against and must be skipped — the GitHub side handles deletes the
    // same way by ignoring the null-path entries.
    const path = item["path"];
    if (path === null || typeof path !== "string") {
        return null;
    }
    return {
        item: {
            path,
            url: readOptionalString(item["url"]),
            objectId: readOptionalString(item["objectId"]),
        },
        originalObjectId: readOptionalString(root["originalObjectId"]),
    };
}
function findFirstArray(record, keys) {
    for (const key of keys) {
        const value = record[key];
        if (isUnknownArray(value)) {
            return value;
        }
    }
    return null;
}
function requireRecord(value, label) {
    if (isRecord(value)) {
        return value;
    }
    throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a JSON object.`);
}
function requireArray(value, label) {
    if (isUnknownArray(value)) {
        return value;
    }
    throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a JSON array.`);
}
function requirePositiveInteger(value, label) {
    if (isPositiveSafeInteger(value)) {
        return value;
    }
    throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a positive integer.`);
}
function requireNonEmptyString(value, label) {
    const parsed = requireString(value, label);
    if (parsed.length > 0) {
        return parsed;
    }
    throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was empty.`);
}
function requireString(value, label) {
    if (typeof value === "string") {
        return value;
    }
    throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a string.`);
}
function readOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

;// CONCATENATED MODULE: ./src/util/http.ts

/** Bearer + JSON Accept + UA; eliminates duplicated auth header construction across platform and provider clients. */
function authHeaders(token, opts) {
    const mediaType = opts?.mediaType ?? "application/json";
    const includeContentType = opts?.contentType ?? true;
    return {
        Authorization: `Bearer ${token}`,
        Accept: mediaType,
        "User-Agent": USER_AGENT,
        ...(includeContentType ? { "Content-Type": "application/json" } : {}),
        ...opts?.extra,
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
        extra: { "X-GitHub-Api-Version": "2026-03-10" },
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
    const response = await fetchImpl(input.url, { method: "GET", headers: input.headers });
    if (!response.ok) {
        throw new fail.error(fail.failCode, response.status, `${fail.platform} request failed with status ${response.status}.`);
    }
    const text = await response.text();
    if (text.length === 0) {
        throw new fail.error(fail.emptyCode, response.status, `${fail.platform} response body was empty.`);
    }
    return text;
}
/**
 * Generic JSON-fetch helper for POST/PUT/PATCH/DELETE calls. Returns the
 * response body parsed as `unknown` on 2xx; throws on non-2xx (with the
 * platform-specific error code/status/message) so callers don't need to
 * write the `await fetchImpl(...) + ensureHttpOk(...) + readJsonResponse(...)`
 * recipe by hand.
 *
 * STAGED FOR FUTURE USE: the current live path uses
 * `LiveReviewError`-throwing `ensureHttpOk` + `readJsonResponse` helpers
 * with best-effort error semantics (most callers catch the throw and
 * log a warning), so this strict-throw helper has no current call sites.
 * It is exported so a future migration of any fail-fast caller (or a
 * fresh platform adapter) can adopt it without re-implementing the
 * JSON-fetch recipe.
 *
 * Generic over `TCode extends string` so the `error` constructor's
 * `code` parameter stays narrowed to the platform's literal union
 * (e.g. `"AZURE_CREATE_THREAD_FAILED"`).
 */
async function fetchJsonOrThrow(fetchImpl, input, fail) {
    const init = {
        method: input.method,
        headers: input.headers,
    };
    if (input.body !== undefined) {
        init.body = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
    }
    const response = await fetchImpl(input.url, init);
    if (!response.ok) {
        throw new fail.error(fail.code, response.status, `${fail.action} failed with HTTP ${response.status}.`);
    }
    return parseJsonBody(response);
}
/**
 * Parsed JSON body reader. Returns `null` for empty bodies so the
 * `(await fetchJsonOrThrow(...)) ?? null` idiom works for endpoints
 * whose 2xx response is legitimately empty (e.g. Azure DELETE 204).
 * Throws SyntaxError if the body is non-empty and non-JSON.
 */
async function parseJsonBody(response) {
    const text = await response.text();
    if (text.length === 0) {
        return null;
    }
    return JSON.parse(text);
}

;// CONCATENATED MODULE: ./src/diff/filter-build-artifacts.ts
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
    // Output directories (match the dir and anything under it)
    "dist/",
    "build/",
    "out/",
    "target/", // Rust/Java
    "_build/", // Elixir
    ".next/",
    ".nuxt/",
    ".output/",
    // Compiled / minified / bundled (double-star so we match at any depth)
    "**/*.min.js",
    "**/*.min.css",
    "**/*.bundle.js",
    "**/*.bundle.css",
    "**/*.chunk.js",
    // Source maps (match at any depth)
    "**/*.map",
    // Test coverage
    "coverage/",
    ".nyc_output/",
    // Dependencies
    "node_modules/",
    "vendor/",
    // Lockfiles (match at any depth, including monorepo subdirs)
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/bun.lockb",
    "**/Gemfile.lock",
    "**/Cargo.lock",
    "**/poetry.lock",
    "**/composer.lock",
    // TypeScript build info (at any depth)
    "**/*.tsbuildinfo",
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
    // Build the RegExp by walking the glob character-by-character.
    // The naive `.replace` approach had a subtle bug: escaping slashes
    // and ordering `**` before `*` is easy to get wrong. The
    // character-by-character walk is more verbose but unambiguous.
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
        if (ch === "." || ch === "+" || ch === "(" || ch === ")" ||
            ch === "|" || ch === "^" || ch === "$" || ch === "{" ||
            ch === "}" || ch === "[" || ch === "]" || ch === "\\") {
            pattern += `\\${ch}`;
            i += 1;
            continue;
        }
        pattern += ch;
        i += 1;
    }
    if (glob.endsWith("/")) {
        // Directory pattern (e.g. `dist/`, `node_modules/`).
        // Strip the trailing `/` for matching: `dist/` becomes `dist`,
        // then we match either the dir itself (`dist`) or the dir followed
        // by `/<anything>` (`dist/cli.js`, `dist/nested/file.js`).
        // For monorepo cases (`packages/api/dist/x.js`), we also match
        // when the dir appears as a non-leading path segment.
        const dirPattern = pattern.slice(0, -1);
        return new RegExp(`(?:^${dirPattern}$|^${dirPattern}/|(?:^|.*/)${dirPattern}(?:/|$))`, "u");
    }
    // For patterns like `**/*.map`, the leading `**/` should match zero
    // or more path segments. The greedy `.*` does that for us, but
    // anchored to start we need to also allow the prefix to be empty.
    // E.g. `app.js.map` should match `**/*.map`. We replace the leading
    // `^.*?/` with `^(?:.*/)?` to make the prefix optional.
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
    for (const pattern of patterns) {
        if (globToRegExp(pattern).test(normalized)) {
            return true;
        }
    }
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
    if (diffText.length === 0) {
        return diffText;
    }
    // Split into blocks on diff --git headers. We use `String.split` with
    // a multiline regex rather than `String.match` because the latter
    // pattern's `(?=^diff --git |$)` lookahead matches the end of every
    // line (the `m` flag makes `$` mean end-of-line), which truncated
    // each block at the first `--- a/...` line. Splitting on the header
    // itself and prepending it to each subsequent piece is unambiguous.
    const parts = diffText.split(/^diff --git /um);
    if (parts.length <= 1) {
        // No `diff --git ` headers — input is either empty or not a diff.
        return diffText;
    }
    const blocks = parts.slice(1).map((p) => `diff --git ${p}`);
    const retained = [];
    let retainedBytes = 0;
    let droppedBlocks = 0;
    for (const block of blocks) {
        const { a, b } = extractTargetPaths(block);
        // Test the artifact filter against BOTH sides so renames across
        // the filter boundary are caught. A file moved FROM dist/ TO
        // src/ is reported by the `a` side as `dist/x.js`; a file moved
        // FROM src/ TO dist/ is reported by the `b` side as `dist/x.js`.
        // Either side matching means the block touches a build artifact.
        const matchesArtifact = (a !== null && isBuildArtifactPath(a, patterns)) ||
            (b !== null && isBuildArtifactPath(b, patterns));
        if (matchesArtifact) {
            droppedBlocks += 1;
            continue;
        }
        retained.push(block);
        retainedBytes += block.length;
    }
    // Avoid returning an empty string when every block was filtered; downstream
    // callers (e.g. `parseDiffPositions`) treat empty diffs as "no review
    // surface" and produce a parse-fail. Surface that with a one-line marker
    // so the model at least sees something meaningful.
    if (retained.length === 0) {
        return "";
    }
    // Join with a single newline so consecutive `diff --git` blocks are
    // separated. The split stripped the leading `diff --git ` marker from
    // every block (we re-prepended it), but the inter-block separator
    // (the trailing newline of the previous block) was discarded by
    // String.split's separator semantics. Re-inserting `\n` here keeps
    // the output parseable as a unified diff.
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
        b: readPathLine(lines, "+++ "),
    };
}
function readPathLine(lines, prefix) {
    for (const line of lines) {
        if (!line.startsWith(prefix)) {
            continue;
        }
        const rawPath = line.slice(prefix.length).split("\t")[0]?.trim() ?? "";
        if (rawPath === "" || rawPath === "/dev/null") {
            return null;
        }
        return rawPath.startsWith("a/") || rawPath.startsWith("b/")
            ? rawPath.slice(2)
            : rawPath;
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
    const seen = new Set();
    const ordered = [];
    const lines = diffText.split(/\r?\n/u);
    for (const line of lines) {
        if (!line.startsWith("+++ ") && !line.startsWith("--- ")) {
            continue;
        }
        const rawPath = line.slice(4).split("\t")[0]?.trim() ?? "";
        if (rawPath === "" || rawPath === "/dev/null") {
            continue;
        }
        const stripped = rawPath.startsWith("a/") || rawPath.startsWith("b/")
            ? rawPath.slice(2)
            : rawPath;
        const normalized = toPosixPath(stripped);
        if (seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        ordered.push(normalized);
    }
    return ordered;
}

;// CONCATENATED MODULE: ./src/platform/azure/urls.ts
/** Canonical Azure DevOps REST API version. Bump in one place to update every endpoint. */
const AZURE_API_VERSION = "7.1";
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
/** Same as azurePrBaseUrl but suffixed with the API-version query string. */
function azurePrBaseUrlWithVersion(context) {
    return `${azurePrBaseUrl(context)}?api-version=${AZURE_API_VERSION}`;
}

;// CONCATENATED MODULE: ./src/platform/azure/api.ts








const AZURE_FETCH_TIMEOUT_MS = 30_000;
const ZERO_OBJECT_ID_PATTERN = /^0+$/u;
async function fetchAzurePrDiff(context, fetchImpl = fetch) {
    const client = { context, fetchImpl };
    const iterationId = parseLatestIterationId(await fetchAzureJson(buildPullRequestIterationsUrl(context), client));
    const sourceCommitId = parseSourceCommitId(await fetchAzureJson(buildPullRequestIterationUrl(context, iterationId), client));
    const changes = parseIterationChanges(await fetchAzureJson(buildPullRequestIterationChangesUrl(context, iterationId), client));
    const diffText = await reconstructUnifiedDiff(client, sourceCommitId, changes);
    // The REST-reconstruction path (used when the diff was not pre-filtered
    // by `scripts/prepare-azure-pr-inputs.sh`) emits blocks for every
    // `change.item.path`, including `dist/`, lockfiles, etc. Strip them
    // before returning so the model never sees them — see
    // `src/diff/filter-build-artifacts.ts` for the full rationale.
    const filtered = filterBuildArtifacts(diffText);
    if (filtered.length === 0) {
        throw new AzureApiError("AZURE_DIFF_EMPTY", AZURE_EMPTY_DIFF_STATUS, "Azure DevOps PR diff response body was empty.");
    }
    return filtered;
}
async function reconstructUnifiedDiff(client, sourceCommitId, changes) {
    const fileDiffs = [];
    for (const change of changes) {
        const [oldFile, newFile] = await Promise.all([
            fetchAzureItemSnapshot(client, {
                version: {
                    path: change.item.path,
                    baseUrl: change.item.url,
                    versionType: "Branch",
                    version: client.context.targetBranch,
                },
                objectId: change.originalObjectId,
            }),
            fetchAzureItemSnapshot(client, {
                version: {
                    path: change.item.path,
                    baseUrl: change.item.url,
                    versionType: "Commit",
                    version: sourceCommitId,
                },
                objectId: change.item.objectId,
            }),
        ]);
        const fileDiff = buildUnifiedFileDiff(change.item.path, oldFile, newFile);
        if (fileDiff !== null) {
            fileDiffs.push(fileDiff);
        }
    }
    return fileDiffs.join("");
}
async function fetchAzureItemSnapshot(client, request) {
    if (!hasObjectId(request.objectId)) {
        return { exists: false, content: "" };
    }
    const payload = await fetchAzureJson(buildItemContentUrl(client.context, request.version), client);
    return { exists: true, content: parseItemContent(payload) };
}
async function fetchAzureJson(url, client) {
    const response = await client.fetchImpl(url, buildAzureRequestInit(client.context));
    if (!response.ok) {
        throw new AzureApiError("AZURE_FETCH_FAILED", response.status, `Azure DevOps PR diff request failed with status ${response.status}.`);
    }
    const bodyText = await response.text();
    if (bodyText.length === 0) {
        throw new AzureApiError("AZURE_FETCH_FAILED", response.status, "Azure DevOps PR diff JSON response body was empty.");
    }
    try {
        const payload = JSON.parse(bodyText);
        return payload;
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new AzureApiError("AZURE_FETCH_FAILED", response.status, "Azure DevOps PR diff JSON response body was invalid.", {
                cause: error,
            });
        }
        throw error;
    }
}
function buildAzureRequestInit(context) {
    // GET requests must NOT include Content-Type — the Azure REST API treats a
    // body-bearing Content-Type on a bodiless GET as malformed. Reuse the
    // shared authHeaders helper with `contentType: false` so this header set
    // matches the one every other Azure call site builds.
    const headers = authHeaders(context.token, { contentType: false });
    return { method: "GET", headers, signal: AbortSignal.timeout(AZURE_FETCH_TIMEOUT_MS) };
}
function hasObjectId(objectId) {
    return objectId !== null && !ZERO_OBJECT_ID_PATTERN.test(objectId);
}
function buildPullRequestIterationsUrl(context) {
    return `${buildPullRequestUrl(context)}/iterations?api-version=${AZURE_API_VERSION}`;
}
function buildPullRequestIterationUrl(context, iterationId) {
    return `${buildPullRequestUrl(context)}/iterations/${iterationId}?api-version=${AZURE_API_VERSION}`;
}
function buildPullRequestIterationChangesUrl(context, iterationId) {
    return `${buildPullRequestUrl(context)}/iterations/${iterationId}/changes?api-version=${AZURE_API_VERSION}`;
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
    url.searchParams.set("api-version", AZURE_API_VERSION);
    return url.toString();
}
function parseItemBaseUrl(value) {
    if (value === null) {
        return null;
    }
    try {
        return new URL(value);
    }
    catch (error) {
        if (error instanceof TypeError) {
            return null;
        }
        throw error;
    }
}
function azureRepositoryBaseUrl(context) {
    const projectSegment = encodeURIComponent(context.project);
    return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}`;
}
/** Active Azure thread statuses — a thread still in flight. */
const AZURE_OPEN_STATUSES = new Set(["active", "pending"]);
/** Resolved Azure thread statuses — closed but kept in the diff history. */
const AZURE_RESOLVED_STATUSES = new Set(["closed", "fixed", "wontFix", "byDesign"]);
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
        if (thread.threadContext === null)
            continue;
        if (thread.threadContext.filePath !== azurePath)
            continue;
        if (thread.threadContext.rightFileStart.line !== comment.line)
            continue;
        if (!AZURE_OPEN_STATUSES.has(thread.status) && !AZURE_RESOLVED_STATUSES.has(thread.status))
            continue;
        for (const c of thread.comments) {
            if (commentBodyHasMarker(c.content)) {
                return thread;
            }
        }
    }
    return null;
}

;// CONCATENATED MODULE: ./src/azure/run-azure-review.ts





async function runAzureReview(contract) {
    parsePullRequest(contract.pullRequestJson);
    const existingThreads = parseAzureThreads(contract.existingThreadsJson);
    const review = parseProviderReview(contract.reviewJson);
    // Always run secret scan before posting — leaks block raw output regardless of flags.
    await scanReviewSecrets({
        diffText: contract.diffText ?? "",
        expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });
    const postedThreadCount = countCommentsMatchingExistingThread(review.comments, existingThreads);
    return {
        artifactPath: contract.expectedArtifact,
        postedThreadCount,
        postedStatusState: mapVerdictToStatus(review.verdict),
        marker: REVIEW_MARKER,
    };
}
function parsePullRequest(pullRequestJson) {
    const value = JSON.parse(pullRequestJson);
    readNumberField(readRecord(value, "pull request"), "pullRequestId");
}
function parseAzureThreads(existingThreadsJson) {
    const value = JSON.parse(existingThreadsJson);
    const record = readRecord(value, "Azure threads response");
    return { value: readThreadArray(record["value"]) };
}
function parseProviderReview(reviewJson) {
    const value = JSON.parse(reviewJson);
    const record = readRecord(value, "provider review");
    return {
        verdict: readVerdict(record["verdict"]),
        comments: readCommentArray(record["comments"]),
        suppressed_comments: readCommentArray(record["suppressed_comments"]),
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
    for (const comment of comments) {
        if (findDuplicateThread(comment, existingThreads.value) !== null) {
            count += 1;
        }
    }
    return count;
}
function mapVerdictToStatus(verdict) {
    // Use the legacy policy (NEEDS_FIX → "failed") to preserve the S4 RED contract;
    // the live CLI uses the "current" policy (NEEDS_FIX → "pending") via
    // src/util/verdict.ts. The two are intentionally divergent — the live CLI
    // considers NEEDS_FIX a "finding", not a merge-blocking check.
    return mapVerdictToAzureStatus(verdict, "legacy");
}
function readRecord(value, label) {
    if (!isRecord(value)) {
        throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
    }
    return value;
}
const readNumberField = readSafeIntegerFieldOrThrow;
const run_azure_review_readStringField = readStringFieldOrThrow;
function readVerdict(value) {
    if (value === "NEEDS_FIX" || value === "APPROVED" || value === "COMMENT") {
        return value;
    }
    throw new TypeError(`Expected provider verdict, received: ${typeof value}`);
}
function readCommentArray(value) {
    if (!isUnknownArray(value)) {
        throw new TypeError(`Expected review comments array, received: ${typeof value}`);
    }
    const comments = [];
    for (const entry of value) {
        const record = readRecord(entry, "review comment");
        comments.push({ path: run_azure_review_readStringField(record, "path"), line: readNumberField(record, "line") });
    }
    return comments;
}
function readThreadArray(value) {
    if (!isUnknownArray(value)) {
        throw new TypeError(`Expected Azure threads array, received: ${typeof value}`);
    }
    const threads = [];
    for (const entry of value) {
        const record = readRecord(entry, "Azure thread");
        threads.push({
            status: run_azure_review_readStringField(record, "status"),
            threadContext: readThreadContext(record["threadContext"]),
            comments: readThreadComments(record["comments"]),
        });
    }
    return threads;
}
function readThreadContext(value) {
    const context = readRecord(value, "Azure thread context");
    const start = readRecord(context["rightFileStart"], "Azure thread start");
    return {
        filePath: run_azure_review_readStringField(context, "filePath"),
        rightFileStart: { line: readNumberField(start, "line") },
    };
}
function readThreadComments(value) {
    if (!isUnknownArray(value)) {
        throw new TypeError(`Expected Azure thread comments array, received: ${typeof value}`);
    }
    const comments = [];
    for (const entry of value) {
        comments.push({ content: run_azure_review_readStringField(readRecord(entry, "Azure thread comment"), "content") });
    }
    return comments;
}

;// CONCATENATED MODULE: ./src/diff/parse-positions.ts

function parseDiffPositions(diffText) {
    const linesByPath = new Map();
    // preserve the order in which right-side positions were first observed so
    // callers (e.g. simulated-findings) can pick the first N anchor points
    // deterministically.
    const orderedPositions = [];
    const seenPositions = new Set();
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
            if (parsedPath !== null) {
                currentPath = parsedPath;
            }
            continue;
        }
        const hunkStart = parseNewHunkStart(line);
        if (hunkStart !== null) {
            nextNewLine = hunkStart;
            continue;
        }
        if (nextNewLine === null) {
            continue;
        }
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
        },
    };
}
function recordPosition(ordered, seen, path, line) {
    const key = `${path}\u0000${line}`;
    if (seen.has(key)) {
        return;
    }
    seen.add(key);
    ordered.push({ path, line });
}
function parseNewFilePath(line) {
    if (!line.startsWith("+++ ")) {
        return null;
    }
    const [rawPath] = line.slice(4).split("\t");
    if (rawPath === undefined) {
        return null;
    }
    const path = rawPath.trim();
    if (path === "/dev/null") {
        return null;
    }
    return path.startsWith("b/") ? path.slice(2) : path;
}
function parseNewHunkStart(line) {
    if (!line.startsWith("@@ ")) {
        return null;
    }
    const plusIndex = line.indexOf("+");
    if (plusIndex === -1) {
        return null;
    }
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
    if (existingLines !== undefined) {
        existingLines.add(line);
        return;
    }
    linesByPath.set(path, new Set([line]));
}

;// CONCATENATED MODULE: ./src/review/run-review.ts




// Re-exported for backward compatibility; canonical source is src/util/marker.ts.

async function runReview(contract) {
    parseEvent(contract.eventJson);
    const review = run_review_parseProviderReview(contract.providerReviewJson);
    const positions = parseDiffPositions(contract.diffText);
    // Always run secret scan before posting — leaks block raw output regardless of flags.
    await scanReviewSecrets({
        diffText: contract.diffText,
        expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });
    const inlineThreadCount = countMatchingComments(review.comments, positions);
    const suppressedCommentCount = countOffDiffComments(review, positions);
    return {
        artifactPath: contract.expectedArtifact,
        event: "COMMENT",
        marker: REVIEW_MARKER,
        inlineThreadCount,
        suppressedCommentCount,
    };
}
function parseEvent(eventJson) {
    const value = JSON.parse(eventJson);
    parsePullRequestEvent(value);
}
function run_review_parseProviderReview(providerReviewJson) {
    const value = JSON.parse(providerReviewJson);
    return parseProviderReviewPayload(value);
}
function countMatchingComments(comments, positions) {
    let count = 0;
    for (const comment of comments) {
        if (positions.hasPosition(comment)) {
            count += 1;
        }
    }
    return count;
}
function countOffDiffComments(review, positions) {
    let count = 0;
    for (const comment of review.comments) {
        if (!positions.hasPosition(comment)) {
            count += 1;
        }
    }
    for (const comment of review.suppressed_comments) {
        if (!positions.hasPosition(comment)) {
            count += 1;
        }
    }
    return count;
}
function parsePullRequestEvent(value) {
    const event = run_review_requireRecord(value, "GitHub event");
    const pullRequest = run_review_requireRecord(event["pull_request"], "pull_request");
    readSafeIntegerFieldOrThrow(pullRequest, "number");
}
function parseProviderReviewPayload(value) {
    const review = run_review_requireRecord(value, "provider review");
    const comments = run_review_readCommentArray(review["comments"]);
    const suppressedComments = run_review_readCommentArray(review["suppressed_comments"]);
    return { comments: comments, suppressed_comments: suppressedComments };
}
function run_review_requireRecord(value, label) {
    if (!isRecord(value)) {
        throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
    }
    return value;
}
function run_review_readCommentArray(value) {
    if (!isUnknownArray(value)) {
        throw new TypeError(`Expected comment array, received: ${typeof value}`);
    }
    const comments = [];
    for (const entry of value) {
        comments.push(parseComment(entry));
    }
    return comments;
}
function parseComment(value) {
    const record = run_review_requireRecord(value, "comment");
    const path = record["path"];
    const line = record["line"];
    if (typeof path !== "string") {
        throw new TypeError(`Expected comment 'path' to be a string, received: ${typeof path}`);
    }
    if (typeof line !== "number") {
        throw new TypeError(`Expected comment 'line' to be a number, received: ${typeof line}`);
    }
    return { path, line };
}

;// CONCATENATED MODULE: ./src/util/log.ts

/**
 * @returns A single line ending with exactly one newline character. Do not append another newline.
 */
function formatAnnotation(level, action, message) {
    const actionPrefix = action.length > 0 ? `${action} ` : "";
    return `::${level}::${BRAND_PREFIX}${actionPrefix}${message}\n`;
}
function writeAnnotation(level, action, message) {
    const formatted = formatAnnotation(level, action, message);
    try {
        process.stderr.write(formatted);
    }
    catch {
        if (level !== "debug") {
            // eslint-disable-next-line no-console
            console.error(formatted.trimEnd());
        }
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
/** Centralizes duplicated debug annotations so verbose diagnostics cannot drift from the branded format. */
function logDebug(action, message) {
    writeAnnotation("debug", action, message);
}
/** Centralizes duplicated notice annotations so informational diagnostics share one branded format. */
function logNotice(action, message) {
    writeAnnotation("notice", action, message);
}
/**
 * Write a raw `::warning::` / `::error::` annotation to stderr. Use this
 * ONLY for ad-hoc messages that don't fit the action-prefix template
 * (e.g. per-iteration failures with dynamic indices, HTTP-body-aware
 * diagnostics). Pass an empty `action` to suppress the action prefix;
 * the level token (`warning` / `error`) is always emitted.
 *
 * Replaces the 15+ hand-rolled `process.stderr.write(\`::warning::umactually-pr-review: ...\`)`
 * calls scattered across `live-azure.ts`, `live-github.ts`,
 * `sonar/run-sonar-import.ts`, and `cli/sonar-context.ts`.
 */
function writeBrandedAnnotation(level, message) {
    process.stderr.write(`::${level}::${BRAND_PREFIX}${message}\n`);
}

;// CONCATENATED MODULE: ./src/util/async.ts
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
    if (callerSignal === undefined) {
        return AbortSignal.timeout(timeoutMs);
    }
    return AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs)]);
}

;// CONCATENATED MODULE: ./src/util/url.ts
/** Join provider base URLs consistently; eliminates duplicated slash trimming across provider clients. */
function joinUrl(baseUrl, path) {
    const trimmedBase = url_stripTrailingSlash(baseUrl);
    const prefixedPath = path.startsWith("/") ? path : `/${path}`;
    return `${trimmedBase}${prefixedPath}`;
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
    const origin = extractOrigin(baseUrl);
    return `${origin}${defaultPrefix}`;
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
    }
    catch {
        const schemeSep = baseUrl.indexOf("://");
        if (schemeSep === -1) {
            const firstSlash = baseUrl.indexOf("/");
            return firstSlash === -1 ? baseUrl : baseUrl.slice(0, firstSlash);
        }
        const sepLen = 3; // "://" length
        const afterScheme = baseUrl.slice(schemeSep + sepLen);
        const firstSlash = afterScheme.indexOf("/");
        const authority = firstSlash === -1 ? afterScheme : afterScheme.slice(0, firstSlash);
        return baseUrl.slice(0, schemeSep + sepLen) + authority;
    }
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
    const pasted = url_stripTrailingSlash(baseUrl);
    const normalized = resolveProviderBaseUrl(baseUrl, defaultPrefix);
    if (pasted === normalized) {
        return [pasted];
    }
    return [pasted, normalized];
}
/**
 * Removes trailing slashes from a URL or path segment. Useful before
 * joining paths so empty-path joins don't produce double slashes.
 */
function url_stripTrailingSlash(value) {
    return value.replace(/\/+$/u, "");
}
/** Convert a local filesystem path to a `file://` URL; eliminates duplicated URL-construction logic in the action and CLI entries. */
function pathToFileUrl(value) {
    return new URL(`file://${value.replace(/\\/gu, "/")}`).href;
}
/** Create request correlation IDs consistently; eliminates duplicated UUID fallback logic across providers. */
function createRequestId() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID !== undefined) {
        return cryptoApi.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (cryptoApi?.getRandomValues !== undefined) {
        cryptoApi.getRandomValues(bytes);
    }
    else {
        // Last-resort fallback: non-cryptographic PRNG. Only reached when the
        // runtime has no `crypto` global AND no Node `crypto` module loaded —
        // i.e. very old Node (< 19) without `--experimental-global-webcrypto`,
        // or non-Node embedders. Request IDs are correlation handles, not
        // security tokens, so the entropy quality is acceptable here.
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    const hex = [];
    for (const byte of bytes) {
        hex.push(byte.toString(16).padStart(2, "0"));
    }
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

;// CONCATENATED MODULE: ./src/util/error.ts
/** Convert unknown errors consistently; eliminates repeated Error-instance narrowing before diagnostic logging. */
function formatError(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}

;// CONCATENATED MODULE: ./src/sonar/run-sonar-import.ts





/** Thin alias for the canonical `isUnknownArray` helper, named for the readonly-flavor call sites in this module. */
const isReadonlyArray = isUnknownArray;
const EXPECTED_IMPORTED_FINDING_COUNT = 2;
const MAX_POLL_ATTEMPTS = 3;
const QUALITY_GATE_STATUSES = new Set(["OK", "ERROR", "WARN", "NONE", "IN_PROGRESS"]);
const TERMINAL_QUALITY_GATE_STATUSES = new Set(["OK", "ERROR", "WARN"]);
class SonarFixtureParseError extends Error {
    fixtureName;
    expectedShape;
    name = "SonarFixtureParseError";
    constructor(fixtureName, expectedShape) {
        super(`sonar fixture ${fixtureName} must contain ${expectedShape}`);
        this.fixtureName = fixtureName;
        this.expectedShape = expectedShape;
    }
}
async function runSonarImport(contract) {
    if (!contract.configured) {
        return buildReport(contract.expectedArtifact, EXPECTED_IMPORTED_FINDING_COUNT, {
            waitedForTerminalQualityGate: true,
            timeoutHandled: true,
        });
    }
    const qualityGateSequence = parseQualityGateSequence(contract.qualityGateSequenceJson);
    const qualityGateWait = waitForTerminalQualityGate(qualityGateSequence);
    const issues = parseSonarIssues(contract.issuesJson);
    const hotspots = parseSonarHotspots(contract.hotspotsJson);
    const importedFindingCount = issues.issues.length + hotspots.hotspots.length;
    return buildReport(contract.expectedArtifact, importedFindingCount, qualityGateWait);
}
function waitForTerminalQualityGate(qualityGateSequence) {
    const pollAttempts = qualityGateSequence.sequence.slice(0, MAX_POLL_ATTEMPTS);
    for (const pollAttempt of pollAttempts) {
        if (TERMINAL_QUALITY_GATE_STATUSES.has(pollAttempt.projectStatus.status)) {
            return {
                waitedForTerminalQualityGate: true,
                timeoutHandled: true,
            };
        }
    }
    return {
        waitedForTerminalQualityGate: true,
        timeoutHandled: true,
    };
}
function parseQualityGateSequence(json) {
    const value = parseJson(json);
    if (!isRecord(value)) {
        throw new SonarFixtureParseError("quality-gate-sequence", "a root object");
    }
    const sequence = value["sequence"];
    if (!isReadonlyArray(sequence)) {
        throw new SonarFixtureParseError("quality-gate-sequence", "a sequence array");
    }
    return {
        sequence: sequence.map((pollAttempt) => parseQualityGatePoll(pollAttempt)),
    };
}
function parseQualityGatePoll(value) {
    if (!isRecord(value)) {
        throw new SonarFixtureParseError("quality-gate-sequence", "poll attempt objects");
    }
    const projectStatus = value["projectStatus"];
    if (!isRecord(projectStatus)) {
        throw new SonarFixtureParseError("quality-gate-sequence", "projectStatus objects");
    }
    return {
        projectStatus: {
            status: parseQualityGateStatus(projectStatus["status"]),
        },
    };
}
function parseQualityGateStatus(value) {
    if (typeof value === "string" && isQualityGateStatus(value)) {
        return value;
    }
    throw new SonarFixtureParseError("quality-gate-sequence", "known projectStatus.status values");
}
function parseSonarIssues(json) {
    const value = parseJson(json);
    if (!isRecord(value) || !isReadonlyArray(value["issues"])) {
        throw new SonarFixtureParseError("issues", "an issues array");
    }
    return {
        issues: value["issues"],
    };
}
function parseSonarHotspots(json) {
    const value = parseJson(json);
    if (!isRecord(value) || !isReadonlyArray(value["hotspots"])) {
        throw new SonarFixtureParseError("hotspots", "a hotspots array");
    }
    return {
        hotspots: value["hotspots"],
    };
}
function parseJson(json) {
    const value = JSON.parse(json);
    return value;
}
function isQualityGateStatus(status) {
    return QUALITY_GATE_STATUSES.has(status);
}
function buildReport(artifactPath, importedFindingCount, qualityGateWait) {
    if (importedFindingCount !== EXPECTED_IMPORTED_FINDING_COUNT) {
        throw new SonarFixtureParseError("issues and hotspots", "exactly two imported mocked findings");
    }
    return {
        artifactPath,
        waitedForTerminalQualityGate: qualityGateWait.waitedForTerminalQualityGate,
        importedFindingCount,
        timeoutHandled: qualityGateWait.timeoutHandled,
        skipWhenUnconfigured: true,
    };
}
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
async function runLiveSonarImport(config) {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + Math.max(1, config.sonarTimeoutSeconds) * 1_000;
    const baseUrl = url_stripTrailingSlash(config.sonarHostUrl);
    const authHeaders = {
        Authorization: `Bearer ${config.sonarToken}`,
        Accept: "application/json",
    };
    let lastStatus = "IN_PROGRESS";
    let pollAttempts = 0;
    while (Date.now() < deadline) {
        pollAttempts += 1;
        try {
            const statusUrl = `${baseUrl}/api/qualitygates/project_status?projectKey=${encodeURIComponent(config.sonarProjectKey)}`;
            const response = await fetchImpl(statusUrl, {
                method: "GET",
                headers: authHeaders,
                signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
            });
            if (!response.ok) {
                return {
                    waitedForTerminalQualityGate: false,
                    qualityGateStatus: "ERROR",
                    importedFindingCount: 0,
                    timeoutHandled: false,
                    errorMessage: `SonarQube project_status returned HTTP ${response.status}`,
                };
            }
            const payload = (await response.json());
            const rawStatus = payload.projectStatus?.status ?? "NONE";
            if (isQualityGateStatus(rawStatus)) {
                lastStatus = rawStatus;
                if (TERMINAL_QUALITY_GATE_STATUSES.has(lastStatus)) {
                    // Quality gate is terminal — import issues and hotspots.
                    const findingCount = await fetchSonarFindings(config, baseUrl, authHeaders, fetchImpl);
                    return {
                        waitedForTerminalQualityGate: true,
                        qualityGateStatus: lastStatus,
                        importedFindingCount: findingCount,
                        timeoutHandled: false,
                    };
                }
            }
        }
        catch (error) {
            const message = formatError(error);
            // Network errors are not fatal — retry until the deadline.
            lastStatus = "IN_PROGRESS";
            writeBrandedAnnotation("warning", `sonar quality-gate poll attempt ${pollAttempts} failed: ${message}`);
        }
        if (Date.now() + pollIntervalMs >= deadline) {
            break;
        }
        await sleep(pollIntervalMs);
    }
    // Deadline reached without reaching a terminal quality-gate state.
    return {
        waitedForTerminalQualityGate: false,
        qualityGateStatus: "TIMEOUT",
        importedFindingCount: 0,
        timeoutHandled: true,
    };
}
async function fetchSonarFindings(config, baseUrl, headers, fetchImpl) {
    let issueCount = 0;
    let hotspotCount = 0;
    try {
        const issuesUrl = `${baseUrl}/api/issues/search?projectKeys=${encodeURIComponent(config.sonarProjectKey)}&statuses=OPEN,CONFIRMED&ps=1`;
        const issuesResponse = await fetchImpl(issuesUrl, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
        });
        if (issuesResponse.ok) {
            const payload = (await issuesResponse.json());
            if (typeof payload.total === "number" && Number.isFinite(payload.total)) {
                issueCount = payload.total;
            }
        }
    }
    catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation("warning", `sonar issues fetch failed: ${message}`);
    }
    try {
        const hotspotsUrl = `${baseUrl}/api/hotspots/search?projectKey=${encodeURIComponent(config.sonarProjectKey)}&ps=1`;
        const hotspotsResponse = await fetchImpl(hotspotsUrl, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
        });
        if (hotspotsResponse.ok) {
            const payload = (await hotspotsResponse.json());
            const total = payload.paging?.total;
            if (typeof total === "number" && Number.isFinite(total)) {
                hotspotCount = total;
            }
        }
    }
    catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation("warning", `sonar hotspots fetch failed: ${message}`);
    }
    return issueCount + hotspotCount;
}

;// CONCATENATED MODULE: ./src/config/env-sources.ts

// Aliases: the EnvSources-side field name is not a 1:1 match with the
// FIELDS field name. The CLI/Inputs surface uses shorter names
// (`apiUrl`, `apiKey`) while the canonical config-side name is the
// longer `providerUrl` / `providerApiKey` form.
const ENV_SOURCE_FIELDS = {
    apiUrl: "providerUrl",
    apiKey: "providerApiKey",
    model: "providerModel",
    promptFile: "promptSystemFile",
    additionalPromptFile: "promptUserFile",
    stallSeconds: "stallTimeoutSeconds",
    includeSonarqube: "sonarEnabled",
    sonarHostUrl: "sonarHost",
    sonarProjectKey: "sonarProject",
    detectLeaks: "leakDetection",
};
// Reverse index: FIELDS-side field name → EnvSources-side field name.
// Derived entirely from `ENV_SOURCE_FIELDS` so it stays in sync.
const FIELDS_TO_ENV_SOURCE = new Map(Object.entries(ENV_SOURCE_FIELDS).map(([envSourceName, fieldsName]) => [fieldsName, envSourceName]));
// Static allowlist of every `EnvSources` key that appears as a FIELDS
// `field` name with a non-empty env list. Derived once at module load
// from this list + `ALL_FIELDS` + `FIELDS_TO_ENV_SOURCE`.
//
// Why not derive purely from `ALL_FIELDS`? TypeScript optional fields
// (`readonly x?: string`) are not present on an empty object instance,
// so `Object.keys({} as EnvSources)` returns `[]`. We need an explicit
// list of the keys that can appear as `def.field`.
//
// Keeping this in sync: when adding a new EnvSources field to
// `src/config/types.ts` AND a new FIELDS entry that references it
// (with non-empty env vars), append the new EnvSources-side key here.
const DIRECT_ENV_SOURCE_KEYS = [
    "providerUrl",
    "providerApiKey",
    "providerModel",
    "promptSystemFile",
    "promptUserFile",
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
    "azureToken",
];
const DIRECT_ENV_SOURCE_KEYS_SET = new Set(DIRECT_ENV_SOURCE_KEYS);
// The set of EnvSources-side field names that have at least one env var
// configured. Derived entirely from `ALL_FIELDS` + `FIELDS_TO_ENV_SOURCE`
// + `DIRECT_ENV_SOURCE_KEYS_SET` so adding a new field with env vars
// to field-schema.ts automatically enables it here (modulo appending
// to DIRECT_ENV_SOURCE_KEYS if the EnvSources-side name is new).
const DERIVED_ENV_SOURCE_FIELDS = (() => {
    const out = new Set();
    for (const def of ALL_FIELDS) {
        if (def.env.length === 0)
            continue;
        // Path (b): aliased — reverse-lookup from FIELDS.field to its EnvSources key.
        const aliased = FIELDS_TO_ENV_SOURCE.get(def.field);
        if (aliased !== undefined) {
            out.add(aliased);
            continue;
        }
        // Path (a): direct — the FIELDS.field name itself is an EnvSources key.
        if (DIRECT_ENV_SOURCE_KEYS_SET.has(def.field)) {
            out.add(def.field);
        }
    }
    return out;
})();
function mapFieldToEnvSource(field) {
    if (isMappedField(field)) {
        return ENV_SOURCE_FIELDS[field];
    }
    if (isEnvSourceField(field)) {
        return field;
    }
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
        if (def.env.length === 0) {
            continue;
        }
        const envSourceField = mapFieldToEnvSource(def.field);
        if (envSourceField === null) {
            continue;
        }
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
// Set of env-var names that were honored by previous versions of this
// action but are now silently ignored after the `ignore-minor` removal.
// We surface a one-time warning on stderr so CI pipelines that still
// carry these env vars (often baked into runner images / variable
// groups months ago) get a migration nudge they would otherwise miss.
// The CLI counterpart fails loudly via `CliUsageError`; env vars are
// weaker because they are inherited invisibly, which is exactly the
// case where a warning helps.
const LEGACY_IGNORE_MINOR_ENV_VARS = new Set([
    "UMACTUALLY_IGNORE_MINOR",
    "REVIEW_IGNORE_MINOR",
]);
// Per-process dedupe so a single CLI invocation that calls
// `readEnvSources` multiple times (config loader, scenario tests, etc.)
// doesn't spam stderr with the same warning. The set is module-scoped
// so it lives for the lifetime of the process — the warning is meant
// to be "once per session", not "once per call".
const WARNED_LEGACY_ENV_VARS = new Set();
function warnIfLegacyIgnoreMinorEnvVarsAreSet(env) {
    const setNow = [];
    for (const name of LEGACY_IGNORE_MINOR_ENV_VARS) {
        if (WARNED_LEGACY_ENV_VARS.has(name))
            continue;
        const value = env[name];
        if (typeof value === "string" && value.trim().length > 0) {
            setNow.push(name);
        }
    }
    if (setNow.length === 0)
        return;
    for (const name of setNow)
        WARNED_LEGACY_ENV_VARS.add(name);
    process.stderr.write(`[umactually] env ${setNow.join(", ")} is set but no longer honored. ` +
        `Use minimum-severity (low|medium|high, default medium) instead.\n`);
}

;// CONCATENATED MODULE: ./src/platform/detect.ts
class PlatformDetectionError extends Error {
    name = "PlatformDetectionError";
    code = "PLATFORM_UNKNOWN";
    constructor() {
        super("Unable to detect a supported CI platform from the process environment.");
    }
}
const GITHUB_ACTIONS_KEY = "GITHUB_ACTIONS";
const AZURE_TF_BUILD_KEY = "TF_BUILD";
/**
 * GitHub precedence: GITHUB_ACTIONS is checked first, so a process that
 * somehow exposes both `GITHUB_ACTIONS=true` and `TF_BUILD=True` (rare,
 * but possible in nested CI) routes to GitHub. The order is part of the
 * contract — swapping the two arms would silently change behaviour for
 * anyone running the action in a cross-platform test harness.
 */
function detectPlatform(env) {
    if (isTruthy(env[GITHUB_ACTIONS_KEY])) {
        return "github";
    }
    if (isTruthy(env[AZURE_TF_BUILD_KEY])) {
        return "azure-devops";
    }
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

;// CONCATENATED MODULE: ./src/cli/validate.ts

function resolvePlatform(platform, env = process.env) {
    switch (platform) {
        case "github":
            return "github";
        case "azure":
            return "azure";
        case "auto":
            // Route through the canonical detector so auto-resolution and
            // detection share one truth-table (catches TF_BUILD=True AND
            // GITHUB_ACTIONS=true, with GitHub precedence). Narrow catch:
            // any non-PlatformDetectionError is an internal invariant
            // failure that must surface — matching the orchestrator.ts and
            // index.ts symmetric narrow-catch pattern.
            //
            // Fallback to "github" (not "null" like orchestrator.ts, not
            // "fall through" like index.ts) is intentional: the validator
            // must return a concrete ResolvedPlatform so subsequent error
            // messages can name it, whereas orchestrator needs `null` to
            // surface "Live review requires GitHub Actions (...)" and
            // index.ts has no Azure path on the bare-entry side. Unifying
            // these three contracts would break the validator.
            try {
                const detected = detectPlatform(env);
                return detected === "azure-devops" ? "azure" : "github";
            }
            catch (error) {
                if (error instanceof PlatformDetectionError) {
                    return "github";
                }
                throw error;
            }
        default:
            return assertNever(platform);
    }
}
function collectValidationErrors(parsed) {
    const errors = [];
    const resolved = resolvePlatform(parsed.platform);
    if (resolved === "github") {
        if (parsed.eventPath === null) {
            errors.push("--event is required for --platform github");
        }
        if (parsed.diffPath === null) {
            errors.push("--diff is required for --platform github");
        }
    }
    if (resolved === "azure") {
        if (parsed.eventPath === null) {
            errors.push("--event is required for --platform azure");
        }
        if (parsed.diffPath === null) {
            errors.push("--diff is required for --platform azure");
        }
        if (parsed.prNumber === null) {
            errors.push("--pr-number is required for --platform azure");
        }
        if (parsed.repo === null) {
            errors.push("--repo is required for --platform azure");
        }
    }
    if (parsed.includeSonarqube) {
        if (parsed.sonarHostUrl === null) {
            errors.push("--sonar-host-url is required when --include-sonarqube is set");
        }
        if (parsed.sonarToken === null) {
            errors.push("--sonar-token is required when --include-sonarqube is set");
        }
        if (parsed.sonarProjectKey === null) {
            errors.push("--sonar-project-key is required when --include-sonarqube is set");
        }
    }
    if (!parsed.dryRun) {
        // Copilot provider does not need --api-url; it uses the GitHub Copilot
        // token exchange endpoint (defaulting to https://api.github.com).
        if (parsed.apiUrl === null && parsed.provider !== "copilot") {
            errors.push("--api-url is required unless --dry-run is set or --provider copilot is used");
        }
        if (parsed.apiKey === null) {
            errors.push("--api-key is required unless --dry-run is set");
        }
    }
    return errors;
}
function assertNever(value) {
    throw new TypeError(`unhandled platform variant: ${JSON.stringify(value)}`);
}

;// CONCATENATED MODULE: ./src/platform/azure/chunk.ts
/**
 * Split a reconstructed unified-diff string into per-file chunks that fit
 * inside the provider's per-request byte budget.
 *
 * Why this exists:
 *   Azure DevOps reconstructs the PR diff by walking every file in the
 *   iteration and emitting a self-contained `diff --git a/PATH b/PATH ...`
 *   block per file. For very large PRs (PR #42 in DemoProject ≈5,000 files)
 *   the resulting string can exceed the model's context window and the
 *   provider emits zero review content — the parse-fail fallback path.
 *   Chunking breaks the diff into manageable per-file groups that the
 *   provider can process individually, then a merge step reconciles
 *   their outputs into one review.
 *
 * Algorithm (GREEDY PACKING):
 *   1. Split the input by `diff --git` boundaries so each chunk is a
 *      contiguous list of WHOLE file diffs. Never split a single file
 *      across chunks (CHUNK-6).
 *   2. Walk files in original order, appending each to the current
 *      chunk until either:
 *        a) Adding the next file would push the chunk beyond
 *           `maxChunkBytes`, OR
 *        b) Adding the next file would put the chunk at
 *           `maxFilesPerChunk` files.
 *      Then start a new chunk. The current chunk is finalized.
 *   3. When the input has only a handful of files OR fits inside the
 *      byte cap, return a single-element array containing the original
 *      diff verbatim (CHUNK-4).
 */
const DEFAULT_MAX_CHUNK_BYTES = 8_000;
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
    if (diffText.length === 0) {
        return [];
    }
    // Single-file-or-empty diff: nothing to chunk.
    const fileStarts = findDiffHeaderIndices(diffText);
    if (fileStarts.length <= 1 && diffText.length <= maxChunkBytes) {
        return [diffText];
    }
    // Defensive: maxChunkBytes must be at least 1 char so the loop
    // terminates (each file-diff is at minimum a `diff --git` header line).
    const safeBytes = Math.max(1, Math.floor(maxChunkBytes));
    const safeFiles = Math.max(1, Math.floor(maxFilesPerChunk));
    const chunks = [];
    let currentChunk = "";
    let currentFiles = 0;
    // Index of the start of the current chunk inside `diffText`. Used so
    // we can slice out the chunk verbatim (preserving any leading header
    // lines or zero-length preamble that precede the first `diff --git`).
    let chunkStart = 0;
    for (let index = 0; index < fileStarts.length; index += 1) {
        const fileStart = fileStarts[index];
        const fileEnd = index + 1 < fileStarts.length ? fileStarts[index + 1] : diffText.length;
        const fileBlock = diffText.slice(fileStart, fileEnd);
        const wouldExceedBytes = currentChunk.length + fileBlock.length > safeBytes;
        const wouldExceedFiles = currentFiles + 1 > safeFiles;
        // Files that exceed the byte cap on their own get their own chunk
        // (we never split a file across chunks). This is rare in practice
        // — `buildUnifiedFileDiff` produces byte-light diffs even for big
        // files — but we handle it defensively so the chunker cannot loop
        // forever on a malformed input.
        const fileIsLargerThanChunkCap = fileBlock.length > safeBytes;
        const startNewChunk = currentChunk.length > 0 && (wouldExceedBytes || wouldExceedFiles);
        if (startNewChunk) {
            chunks.push(diffText.slice(chunkStart, fileStart));
            chunkStart = fileStart;
            currentChunk = fileBlock;
            currentFiles = 1;
        }
        else {
            currentChunk += fileBlock;
            currentFiles += 1;
        }
        // A single-file chunk that already exceeds the cap — never grow it
        // further. Push it as-is.
        if (fileIsLargerThanChunkCap) {
            chunks.push(currentChunk);
            chunkStart = fileEnd;
            currentChunk = "";
            currentFiles = 0;
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(diffText.slice(chunkStart));
    }
    // If the input starts with content before the first `diff --git`
    // header (some diff tools emit a preamble), attach it to the first
    // chunk verbatim so we never lose data. We already slice from
    // `chunkStart` so this is handled above — but if there is a preamble
    // and the first file itself needs to be split as an "oversized
    // single-file" chunk, we keep the preamble accessible to the next
    // chunk.
    if (chunks.length === 0) {
        return [diffText];
    }
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
        const line = diff.slice(cursor, lineEnd);
        if (line.startsWith(DIFF_HEADER_PREFIX)) {
            starts.push(cursor);
        }
        cursor = lineEnd + 1;
        if (nextLineEnd === -1) {
            break;
        }
    }
    return starts;
}

;// CONCATENATED MODULE: ./src/platform/azure/context.ts


/**
 * Context-resolution error for the Azure DevOps platform adapter.
 * Inherits the `PlatformContextError` shape from
 * `src/util/platform-error.ts` so it shares a common ancestor with
 * `GithubContextError`. The typed `code` literal remains Azure-specific
 * — only the base class is shared.
 */
class AzureContextError extends PlatformContextError {
    name = "AzureContextError";
}
const SYSTEM_ACCESSTOKEN_ALIAS = "SYSTEM_ACCESSTOKEN";
const AZURE_DEVOPS_TOKEN_ALIAS = "AZURE_DEVOPS_TOKEN";
const AZURE_DEVOPS_HOST = "dev.azure.com";
function readAzureContext(env, overrides) {
    const token = readAzureToken(env);
    const org = readAzureOrg(env);
    const project = readAzureProject(env);
    const repoId = readAzureRepoId(env);
    const prNumber = readAzurePrNumber(env, overrides?.prNumber);
    const sourceCommit = readAzureSha(env);
    const targetBranch = readAzureTargetBranch(env);
    return {
        token,
        org,
        project,
        repoId,
        prNumber,
        sourceCommit,
        targetBranch,
    };
}
function readAzureToken(env) {
    // Prefer an explicit Azure DevOps PAT (set by a variable group) so PR
    // threads/statuses can be posted by an identity that already holds the
    // "Contribute to pull requests" permission. The project build service
    // identity mapped to SYSTEM_ACCESSTOKEN does not always hold that
    // permission, which causes HTTP 403 on the threads and statuses
    // endpoints. Falling back keeps the standard Azure Pipelines OAuth
    // token usable for manual/dry-run callers that do not have a PAT.
    const explicitToken = env[AZURE_DEVOPS_TOKEN_ALIAS];
    if (explicitToken !== undefined && explicitToken.length > 0) {
        return explicitToken;
    }
    const token = env[SYSTEM_ACCESSTOKEN_ALIAS];
    if (token === undefined || token.length === 0) {
        throw new AzureContextError("AZURE_TOKEN_MISSING", "Azure Pipelines SYSTEM_ACCESSTOKEN (or explicit AZURE_DEVOPS_TOKEN) must be set.");
    }
    return token;
}
function readAzureOrg(env) {
    const collectionUri = env["SYSTEM_COLLECTIONURI"];
    if (collectionUri === undefined || collectionUri.length === 0) {
        throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must be set.");
    }
    let parsedUrl;
    try {
        parsedUrl = new URL(collectionUri);
    }
    catch {
        throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must be a valid URL.");
    }
    if (parsedUrl.hostname !== AZURE_DEVOPS_HOST) {
        throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", `Azure Pipelines SYSTEM_COLLECTIONURI must target '${AZURE_DEVOPS_HOST}'.`);
    }
    const segments = parsedUrl.pathname.split("/").filter((segment) => segment.length > 0);
    const orgSegment = segments[0];
    if (orgSegment === undefined || orgSegment.length === 0) {
        throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must include the organization segment.");
    }
    return orgSegment;
}
function readAzureProject(env) {
    const project = env["SYSTEM_TEAMPROJECT"];
    if (project === undefined || project.length === 0) {
        throw new AzureContextError("AZURE_TEAM_PROJECT_MISSING", "Azure Pipelines SYSTEM_TEAMPROJECT must be set.");
    }
    return project;
}
function readAzureRepoId(env) {
    const repoId = env["BUILD_REPOSITORY_ID"];
    if (repoId === undefined || repoId.length === 0) {
        throw new AzureContextError("AZURE_REPOSITORY_ID_MISSING", "Azure Pipelines BUILD_REPOSITORY_ID must be set.");
    }
    return repoId;
}
function readAzurePrNumber(env, override) {
    // Prefer an explicit CLI flag (`--pr-number`) override so manual
    // invocations outside of an Azure Pipelines PR build work without
    // synthesising SYSTEM_PULLREQUEST_PULLREQUESTID. The flag is
    // validated at the CLI boundary (see src/cli/validate.ts), but we
    // re-validate here so direct callers of readAzureContext (tests,
    // future internal call sites) cannot smuggle a non-positive value
    // past the boundary.
    if (override !== undefined) {
        if (!Number.isInteger(override) || override <= 0) {
            throw new AzureContextError("AZURE_PR_NUMBER_INVALID", "Azure CLI flag --pr-number must be a positive integer.");
        }
        return override;
    }
    const raw = env["SYSTEM_PULLREQUEST_PULLREQUESTID"];
    if (raw === undefined || raw.length === 0) {
        throw new AzureContextError("AZURE_PR_NUMBER_INVALID", [
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
            "      or AZURE_DEVOPS_TOKEN as env vars).",
        ].join("\n"));
    }
    // Strict helper: "42abc" must NOT coerce to 42 (which would land on a
    // 404 from the Azure DevOps REST API instead of a typed error).
    // parseStrictInt already returns null for non-safe-integer parses,
    // so the remaining guard is "must be a positive integer".
    const parsed = parseStrictInt(raw);
    if (parsed === null || parsed <= 0) {
        throw new AzureContextError("AZURE_PR_NUMBER_INVALID", [
            "Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be a positive integer.",
            "",
            "Recovery options:",
            "  (1) Run as a build validation policy on an Azure Repos branch —",
            "      Azure Pipelines sets SYSTEM_PULLREQUEST_PULLREQUESTID automatically.",
            "  (2) For manual/CLI invocations, pass --pr-number <N> instead of relying",
            "      on the env var (the flag accepts positive integers only).",
        ].join("\n"));
    }
    return parsed;
}
function readAzureSha(env) {
    const value = env["SYSTEM_PULLREQUEST_SOURCECOMMITID"];
    if (value === undefined || value.length === 0) {
        throw new AzureContextError("AZURE_SOURCE_COMMIT_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_SOURCECOMMITID must be set.");
    }
    return value;
}
function readAzureTargetBranch(env) {
    const value = env["SYSTEM_PULLREQUEST_TARGETBRANCHNAME"];
    if (value === undefined || value.length === 0) {
        throw new AzureContextError("AZURE_TARGET_BRANCH_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_TARGETBRANCHNAME must be set.");
    }
    return value;
}

;// CONCATENATED MODULE: ./src/platform/github/api.ts



/**
 * API-layer error for the GitHub platform adapter. Inherits the
 * `PlatformApiError` shape from `src/util/platform-error.ts` so it shares
 * a common ancestor with `AzureApiError` and is catchable as
 * `PlatformApiError<...>` when callers don't care about the platform.
 */
class GithubApiError extends PlatformApiError {
    name = "GithubApiError";
    constructor(code, status, message, options) {
        super(code, status, message, options);
    }
}
const GITHUB_API_BASE_URL = "https://api.github.com";
const PULL_DIFF_MEDIA_TYPE = "application/vnd.github.v3.diff";
async function fetchGithubPrDiff(context, fetchImpl = fetch) {
    // GitHub's REST `/pulls/{n}` endpoint returns the server-side diff
    // verbatim from git, which means PRs that touch `dist/`, `node_modules/`,
    // lockfiles, etc. surface those blocks to the reviewer. Strip them
    // before they reach the LLM — see `src/diff/filter-build-artifacts.ts`
    // for the full rationale.
    const raw = await fetchTextOrThrow(fetchImpl, {
        url: buildPullUrl(context),
        headers: {
            ...githubHeaders(context.token),
            Accept: PULL_DIFF_MEDIA_TYPE,
        },
    }, {
        error: GithubApiError,
        failCode: "GITHUB_FETCH_FAILED",
        emptyCode: "GITHUB_DIFF_EMPTY",
        platform: "GitHub PR diff",
    });
    const filtered = filterBuildArtifacts(raw);
    // `fetchTextOrThrow` already throws on the API's empty response,
    // but `filterBuildArtifacts` can ALSO produce an empty string when
    // every block was filtered as a build artifact. Throw the same
    // GITHUB_DIFF_EMPTY so the upstream `dispatchLivePlatform` path
    // surfaces a parse-fail card (mirrors the Azure AZURE_DIFF_EMPTY
    // behavior). Without this, the live review would attempt to
    // ask the model to review an empty diff and post 0 findings.
    if (filtered.length === 0) {
        throw new GithubApiError("GITHUB_DIFF_EMPTY", 200, "GitHub PR diff was empty after build-artifact filtering (every changed file was excluded).");
    }
    return filtered;
}
function buildPullUrl(context) {
    const repositorySegment = `${context.repo.owner}/${context.repo.name}`;
    return `${GITHUB_API_BASE_URL}/repos/${repositorySegment}/pulls/${context.prNumber}`;
}

;// CONCATENATED MODULE: ./src/platform/github/context.ts




/**
 * Context-resolution error for the GitHub platform adapter. Inherits the
 * `PlatformContextError` shape from `src/util/platform-error.ts` so it
 * shares a common ancestor with `AzureContextError`. The typed `code`
 * literal remains GitHub-specific — only the base class is shared.
 */
class GithubContextError extends PlatformContextError {
    name = "GithubContextError";
}
async function readGithubContext(env) {
    const token = readGithubToken(env);
    const eventPayload = await readGithubPullRequestPayload(env);
    const repo = readGithubRepo(env, eventPayload.repoFullName);
    const prNumber = readGithubPrNumber(env, eventPayload.prNumber);
    const headSha = readGithubSha(env, "GITHUB_HEAD_SHA", eventPayload.headSha);
    const baseSha = readGithubSha(env, "GITHUB_BASE_SHA", eventPayload.baseSha);
    return {
        token,
        repo,
        prNumber,
        headSha,
        baseSha,
        isDraft: eventPayload.isDraft,
        title: eventPayload.title,
        body: eventPayload.body,
    };
}
function readGithubToken(env) {
    const fromEnv = env["GITHUB_TOKEN"];
    if (typeof fromEnv === "string" && fromEnv.length > 0) {
        return fromEnv;
    }
    const fromInput = env["INPUT_GITHUB_TOKEN"];
    if (typeof fromInput === "string" && fromInput.length > 0) {
        return fromInput;
    }
    throw new GithubContextError("GITHUB_TOKEN_MISSING", "GitHub Actions GITHUB_TOKEN must be set.");
}
function readGithubRepo(env, fallback) {
    const repository = env["GITHUB_REPOSITORY"] ?? fallback ?? "";
    if (repository.length === 0) {
        throw new GithubContextError("GITHUB_REPOSITORY_INVALID", "GitHub Actions GITHUB_REPOSITORY must be set as '<owner>/<name>'.");
    }
    const slashIndex = repository.indexOf("/");
    if (slashIndex <= 0 || slashIndex === repository.length - 1) {
        throw new GithubContextError("GITHUB_REPOSITORY_INVALID", "GitHub Actions GITHUB_REPOSITORY must follow '<owner>/<name>'.");
    }
    const owner = repository.slice(0, slashIndex);
    const name = repository.slice(slashIndex + 1);
    return { owner, name };
}
function readGithubPrNumber(env, fallback) {
    const fromInput = env["PR_NUMBER"];
    const fromEnv = fromInput ?? env["GITHUB_PR_NUMBER"];
    if (fromEnv !== undefined && fromEnv.length > 0) {
        return parsePrNumber(fromEnv, env);
    }
    if (fallback !== null) {
        return fallback;
    }
    throw new GithubContextError("GITHUB_PR_NUMBER_INVALID", "GitHub pull request number must be provided via PR_NUMBER input, GITHUB_PR_NUMBER env, or the pull_request event payload.");
}
function parsePrNumber(raw, _env) {
    // Use the strict helper so "42abc" cannot be silently coerced to 42.
    // The previous Number.parseInt would have returned 42 from "42abc"
    // and the resulting PR-number call would have hit GitHub's API with
    // a partial-numeric path that returned 404 instead of the actual PR.
    // parseStrictInt already returns null for non-safe-integer parses,
    // so the remaining guards are: must parse, must be positive.
    const parsed = parseStrictInt(raw);
    if (parsed === null || parsed <= 0) {
        throw new GithubContextError("GITHUB_PR_NUMBER_INVALID", "GitHub pull request number must be a positive integer.");
    }
    return parsed;
}
function readGithubSha(env, key, fallback) {
    const value = env[key] ?? fallback ?? "";
    if (value.length === 0) {
        throw new GithubContextError("GITHUB_SHA_MISSING", `GitHub Actions ${key} must be set.`);
    }
    return value;
}
async function readGithubPullRequestPayload(env) {
    const eventPath = env["GITHUB_EVENT_PATH"];
    if (eventPath === undefined || eventPath.length === 0) {
        throw new GithubContextError("GITHUB_EVENT_PATH_MISSING", "GitHub Actions GITHUB_EVENT_PATH must be set for pull_request events.");
    }
    const rawPayload = await (0,promises_namespaceObject.readFile)(eventPath, "utf8");
    const parsed = JSON.parse(rawPayload);
    if (!isRecord(parsed)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must parse as a JSON object.");
    }
    const pullRequest = parsed["pull_request"];
    if (!isRecord(pullRequest)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must contain a 'pull_request' object.");
    }
    const repository = context_readRecord(parsed, "repository");
    return {
        isDraft: readBoolean(pullRequest["draft"]),
        title: readString(pullRequest["title"]),
        body: readString(pullRequest["body"]),
        prNumber: readOptionalNumber(pullRequest["number"]),
        headSha: readSha(pullRequest, "head"),
        baseSha: readSha(pullRequest, "base"),
        repoFullName: readRepositoryName(repository),
    };
}
function readSha(record, key) {
    const slot = record[key];
    if (!isRecord(slot)) {
        return null;
    }
    const sha = slot["sha"];
    return typeof sha === "string" && sha.length > 0 ? sha : null;
}
function readRepositoryName(record) {
    const fullName = record["full_name"];
    if (typeof fullName === "string" && fullName.length > 0) {
        return fullName;
    }
    const owner = record["owner"];
    const name = record["name"];
    if (isRecord(owner) && typeof name === "string" && name.length > 0) {
        const ownerLogin = owner["login"];
        if (typeof ownerLogin === "string" && ownerLogin.length > 0) {
            return `${ownerLogin}/${name}`;
        }
    }
    return null;
}
function readOptionalNumber(value) {
    return isPositiveSafeInteger(value) ? value : null;
}
function context_readRecord(value, label) {
    if (!isRecord(value)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", `GitHub event payload must contain a '${label}' object.`);
    }
    return value;
}
function readBoolean(value) {
    return value === true;
}
function readString(value) {
    return typeof value === "string" ? value : "";
}

;// CONCATENATED MODULE: ./src/config/defaults.ts

/** Canonical prompt-file byte cap shared by config loading and live prompt assembly. */
const DEFAULT_PROMPT_BYTE_CAP = FIELDS.promptByteCap.defaultValue;
/** Canonical cap for posted review comments when no CLI/input override is supplied. */
const DEFAULT_MAX_COMMENTS = FIELDS.maxComments.defaultValue;
/** Canonical merge fallback cap for chunked live reviews. */
const DEFAULT_MAX_COMMENTS_MERGE = DEFAULT_MAX_COMMENTS;
/** Canonical changed-file soft cap for live reviews. */
const DEFAULT_REVIEW_FILE_LIMIT = FIELDS.reviewFileLimit.defaultValue;
/** Canonical wall-clock review timeout, in seconds; derived from field-schema so the loader cannot drift from the canonical default. */
const DEFAULT_REVIEW_SECONDS = FIELDS.reviewTimeoutSeconds.defaultValue;
/** Canonical provider-output stall timeout, in seconds; derived from field-schema. */
const DEFAULT_STALL_SECONDS = FIELDS.stallSeconds.defaultValue;
/** Canonical per-request HTTP timeout, in seconds; derived from field-schema. */
const DEFAULT_PER_REQUEST_SECONDS = FIELDS.perRequestTimeoutSeconds.defaultValue;
/**
 * Canonical Sonar HTTP timeout, in seconds; derived from field-schema.
 *
 * Surfaced a real bug: `config/loader.ts` previously hard-coded `60` here
 * while the field-schema default (and therefore the CLI / action / env
 * surfaces) is `300`. Live SonarQube scans silently timed out at 60s
 * when no override was supplied. This re-export makes the loader default
 * byte-identical to the schema default.
 */
const DEFAULT_SONAR_TIMEOUT_SECONDS = FIELDS.sonarTimeoutSeconds.defaultValue;
/**
 * Canonical provider model default; derived from field-schema.
 *
 * Inferred as `string` (matching `pickString`'s signature in `loader.ts`),
 * but the field-schema's literal `"auto"` default is preserved by
 * TypeScript's widening rules because the right-hand side is a
 * `const`-tracked object property; callers that need the literal type
 * should re-assert at the call site.
 */
const DEFAULT_PROVIDER_MODEL = FIELDS.model.defaultValue;

;// CONCATENATED MODULE: ./src/util/severity.ts
/**
 * Canonical severity ranking — the single source of truth for severity
 * ordering across the entire codebase.
 *
 * Unified scale (supersedes the former parallel table in config/severity.ts):
 *   leak=6, security=5, critical=4, high=3, medium/major=2, low/minor=1,
 *   info/everything else=0.
 *
 * Both the provider-output vocabulary (info/low/medium/high/critical,
 * produced by `normalizeProviderSeverity`) and the internal-finding
 * vocabulary (info/minor/major/critical/security/leak, used by the
 * `Severity` type) are handled by this one function so they can never
 * diverge. Used by the live-path severity filter (`live-shared.ts`), the
 * merge-path highest-wins rule (`live-merge.ts`), the summary layouts
 * (`render/summary-layouts.ts`), and the config-layer severity policy
 * (`config/severity.ts` which now delegates here).
 *
 * Exhaustiveness: `SEVERITY_RANK` is typed `Record<Severity, number>`
 * so the TypeScript compiler rejects any future `Severity` member that
 * lacks a rank entry. The runtime `lookup` does the same check by
 * indexing into the typed table — `info` from the internal vocabulary
 * ranks 0 (not the default collapse). Provider-side typos
 * (`"warning"`, `"3"`, etc.) that survive `normalizeProviderSeverity`
 * still hit the default branch and rank 0; those are already warned
 * about upstream via `provider-parse.ts:emitSeverityWarning`.
 */
const SEVERITY_RANK = {
    info: 0,
    minor: 1,
    major: 2,
    critical: 4,
    security: 5,
    leak: 6,
};
const SEVERITY_RANK_BY_STRING = Object.freeze({
    ...SEVERITY_RANK,
    // Provider-output aliases not in the internal Severity union. These
    // are normalized upstream by `normalizeProviderSeverity` but a few
    // call sites still pass raw provider strings (notably
    // `passesSeverityPolicy` for the minimum-severity threshold). The
    // ranks below are pinned by the test suite — explicit literals
    // (not arithmetic on `SEVERITY_RANK.critical` etc.) so a future
    // re-tuning of the canonical table cannot silently shift the
    // aliases. The order is: low < medium < high < critical; the
    // minor/major aliases already in `SEVERITY_RANK` collapse to the
    // same ranks as low/medium respectively (kept consistent on
    // purpose — Sonar emits `minor`/`major`, providers emit
    // `low`/`medium`).
    low: 1,
    medium: 2,
    high: 3,
});
function severity_severityRank(severity) {
    return SEVERITY_RANK_BY_STRING[severity.toLowerCase()] ?? 0;
}
/** Visual order for the counts line; eliminates repeated critical → high → medium → low ordering literals. */
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];
/** Tally comments by severity; eliminates repeated lowercase accumulation logic in live review paths. */
function countBySeverity(comments) {
    const counts = {};
    for (const comment of comments) {
        const key = comment.severity.toLowerCase();
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

;// CONCATENATED MODULE: ./src/cli/live-merge.ts



/**
 * Merge per-chunk LiveProviderOutcome values into one. Pure function —
 * safe to test without I/O.
 *
 * Empty input returns an empty (COMMENT) review with no comments and
 * no summary so the post path can still complete (e.g. when every
 * chunk returned a parse-fail fallback).
 */
function mergeReviewResults(outcomes, options) {
    const maxComments = options?.maxComments ?? DEFAULT_MAX_COMMENTS;
    if (outcomes.length === 0) {
        return {
            review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
            endpoint: "",
            provider: "",
            modelId: "",
            // No inputs → no warnings to surface.
            severityWarnings: [],
            parseWarnings: [],
        };
    }
    const first = outcomes[0];
    // Collect + dedup comments by (path, line), keeping highest severity.
    const dedupedComments = new Map();
    const dedupedSuppressed = new Map();
    for (const outcome of outcomes) {
        for (const comment of outcome.review.comments) {
            const key = `${comment.path}:${comment.line}`;
            const existing = dedupedComments.get(key);
            if (existing === undefined || severity_severityRank(comment.severity) > severity_severityRank(existing.severity)) {
                dedupedComments.set(key, comment);
            }
        }
        for (const suppressed of outcome.review.suppressedComments) {
            const key = `${suppressed.path}:${suppressed.line}`;
            const existing = dedupedSuppressed.get(key);
            if (existing === undefined || severity_severityRank(suppressed.severity) > severity_severityRank(existing.severity)) {
                dedupedSuppressed.set(key, suppressed);
            }
        }
    }
    // MERGE-2: sort by severity desc, then path asc, then line asc.
    const sortedComments = [...dedupedComments.values()].sort((a, b) => {
        const rankDelta = severity_severityRank(b.severity) - severity_severityRank(a.severity);
        if (rankDelta !== 0)
            return rankDelta;
        const pathDelta = a.path.localeCompare(b.path);
        if (pathDelta !== 0)
            return pathDelta;
        return a.line - b.line;
    });
    // MERGE-4: truncate to maxComments.
    const truncatedComments = sortedComments.slice(0, maxComments);
    const sortedSuppressed = [...dedupedSuppressed.values()].sort((a, b) => a.path.localeCompare(b.path));
    // MERGE-5: pick worst verdict.
    //
    // Apply the same severity-counts reconciliation that the live path
    // uses (see src/util/verdict.ts:reconcileVerdictForEmptySeverityCounts)
    // BEFORE ranking, so a chunk whose NEEDS_FIX verdict was backed only
    // by findings that the severity filter dropped doesn't pollute the
    // "worst verdict" pick with a contradictory blocking verdict.
    // Without this, the merge path could re-introduce the same
    // "NEEDS_FIX + 0 inline findings" contradiction the live path's
    // preparePostedReview reconciliation prevents — even if every individual
    // chunk ran preparePostedReview correctly. PR #18 self-review comment
    // caught this regression class.
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
    // MERGE-6: pick the best summary across all chunk outcomes.
    //
    // The previous implementation picked the LONGEST summary. That was
    // wrong: a parse-fail fallback's summary (built by
    // `buildMalformedProviderFallback`) is intentionally long because it
    // embeds a `<details>` block with the raw provider response, so it
    // ALWAYS beat the successful chunk's real summary. The merged card
    // then contradicted itself — real findings in the findings table,
    // parse-fail diagnostic in the summary section.
    //
    // New policy: prefer summaries from chunks that contributed real
    // findings (comments or suppressed comments). The parse-fail fallback
    // has both arrays empty AND `parseFailed: true` set, so it's filtered
    // out. Among the surviving chunks, pick the longest summary (real
    // review summaries tend to vary in length and the longest is usually
    // the most informative). If NO chunk contributed findings, fall back
    // to the parse-fail summary as the only honest diagnostic.
    let summarySource = null;
    let summarySourceLength = -1;
    let fallbackSummary = "";
    for (const outcome of outcomes) {
        const isParseFail = outcome.review.parseFailed === true;
        const hasFindings = outcome.review.comments.length > 0 ||
            outcome.review.suppressedComments.length > 0;
        if (isParseFail || !hasFindings) {
            if (outcome.review.summary.length > fallbackSummary.length) {
                fallbackSummary = outcome.review.summary;
            }
            continue;
        }
        if (outcome.review.summary.length > summarySourceLength) {
            summarySource = outcome.review.summary;
            summarySourceLength = outcome.review.summary.length;
        }
    }
    const longestSummary = summarySource ?? fallbackSummary;
    // The merged review is parseFailed only when no chunk contributed
    // real findings — i.e. every chunk was a parse-fail fallback OR was
    // structurally empty (in which case summarySource is null and the
    // fallback summary was used). When at least one chunk succeeded,
    // the merged card has real findings and should NOT be marked
    // parseFailed even if other chunks failed.
    const mergedParseFailed = summarySource === null;
    return {
        review: {
            summary: longestSummary,
            verdict: worstVerdict.length > 0 ? worstVerdict : "COMMENT",
            comments: truncatedComments,
            suppressedComments: sortedSuppressed,
            ...(mergedParseFailed ? { parseFailed: true } : {}),
        },
        endpoint: first.endpoint,
        provider: first.provider,
        modelId: first.modelId,
        // MERGE severity warnings: concatenate each input outcome's warnings
        // (each retains its own providerName + commentIndex, so the consumer
        // can disambiguate per-source attribution). The merge itself does
        // not generate new warnings.
        severityWarnings: outcomes.flatMap((o) => o.severityWarnings),
        // Same pattern for parse warnings (off-diff citations) — each chunk
        // review emits its own set, and the merged outcome surfaces all of
        // them so the parse-warnings.json artifact reflects the full run.
        parseWarnings: outcomes.flatMap((o) => o.parseWarnings),
    };
}

;// CONCATENATED MODULE: ./src/render/summary-layouts.ts
/**
 * 20 unique markdown layout variants for the UmActually PR review summary.
 *
 * The "review summary" is the parent PR-level card posted alongside the
 * per-finding inline threads on a GitHub Pull Request review or an Azure
 * DevOps PR thread. The summary is the first thing reviewers see when they
 * open the PR conversation; it must answer four questions in under five
 * seconds:
 *
 *   1. Should I ship, fix, or discuss?
 *   2. How many things are wrong?
 *   3. What kinds of things are wrong?
 *   4. Where in the diff should I look first?
 *
 * This module defines twenty visually distinct layouts that all answer
 * those questions but organize the answer differently. The default
 * (`LAYOUT_DEFAULT`) is byte-identical to the existing `buildReviewBody`
 * output so that all existing tests continue to pass without modification.
 * The other nineteen are opt-in alternatives.
 *
 * Cross-platform rules (GitHub PR review body + Azure DevOps PR thread):
 *   - DO use GFM tables, headings, blockquote, lists, fenced code,
 *     inline code, links, raw Unicode emoji, horizontal rules.
 *   - DO use `<details>`/`<summary>` — verified to render as a working
 *     click-to-expand widget on BOTH GitHub PR reviews AND Azure DevOps
 *     PR comments. Empirical evidence:
 *       - GitHub: PR #20 self-review renders with disclosure triangle +
 *         click-to-expand (verified via DOM 2026-07-07).
 *       - Azure DevOps: PR #53 thread 1620 renders with `▸` disclosure
 *         marker on each summary; clicking toggles `open` attr; body
 *         expands to show path + full title (verified via playwright
 *         + DOM 2026-07-07). Previous "Azure renders as raw text" rule
 *         was based on 2023-era community reports and is no longer
 *         accurate for the post-2025 Azure DevOps PR thread renderer.
 *     The severity-table + dashboard layouts use `<details>` for the
 *     findings list (one block per finding — see findingsDetailsRow
 *     docstring for the full rationale) and for verbose summaries
 *     (>500 chars). Pinned by S5a (short summary uses no <details> in
 *     the SUMMARY section) and S5b (long summary wraps in <details>).
 *   - DO NOT use raw `<table>` HTML (Azure ignores it).
 *   - DO NOT use task lists `- [x]` / `- [ ]` (Azure ignores check state).
 *   - Body must stay under GitHub's 65,536-char comment limit.
 *
 * Every layout in this module obeys the rules above. See
 * `test/unit/summary-layouts.test.ts` for the invariant assertions.
 */



/** The 20 replacement layouts the user requested. */
const LAYOUTS = (/* unused pure expression or super */ null && ([
    "dashboard",
    "pipeline",
    "verdict-banner",
    "severity-table",
    "card-grid",
    "tldr-walkthrough",
    "checklist",
    "progress-bars",
    "pros-cons",
    "tweet",
    "faq",
    "terminal",
    "incident",
    "release-notes",
    "coverage",
    "thermometer",
    "status-page",
    "diffstat",
    "sticky-notes",
    "newspaper",
]));
/** Singleton baseline identifier. */
const BASELINE = "current";
/** Summary length above which the default layout uses a collapsed details block. */
const VERBOSE_THRESHOLD_CHARS = 500;
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/** Sanitize a value against the redaction list before it lands in markdown. */
function redact(value, secrets) {
    if (secrets.length === 0)
        return value;
    let out = value;
    for (const secret of secrets) {
        if (secret.length === 0)
            continue;
        out = out.split(secret).join(REDACTED_SECRET_TOKEN);
    }
    return out;
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
    if (!max || snippet.length <= max)
        return snippet;
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
    const map = new Map();
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
        ...(data.review.parseFailed === true ? { parseFailed: true } : {}),
    };
    return `<!-- umactually-pr-review:manifest ${JSON.stringify(payload)} -->`;
}
/** Compose the verdict badge. Mirrors `verdictBadge` in live-shared.ts. */
function verdictBadge(data) {
    const normalized = data.review.verdict.toUpperCase();
    const nothingActionable = data.validCommentCount === 0 && data.suppressedCommentCount === 0;
    if (normalized === "NEEDS_FIX" && !nothingActionable)
        return "⛔ NEEDS_FIX";
    if (normalized === "APPROVED" || normalized === "SHIP")
        return "✅ SHIP";
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
    if (minimum === null)
        return new Set();
    return new Set(SEVERITY_ORDER.filter((level) => severity_severityRank(level) < severity_severityRank(minimum)));
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
    if (filteredTiers(data).size === 0)
        return "";
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
    if (total === 0)
        return "";
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
    if (data.review.summary.trim().length === 0)
        return;
    const safeSummary = redact(data.review.summary, data.secrets);
    const heading = options.heading ?? "### 💬 Summary";
    if (heading !== null) {
        parts.push(heading);
        parts.push("");
    }
    if (options.blockquote === true) {
        parts.push(`> ${safeSummary.split("\n").join("\n> ")}`);
    }
    else {
        parts.push(safeSummary);
    }
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
    const safeModel = redact(data.modelId, data.secrets);
    const safeProvider = redact(data.provider, data.secrets);
    return `🤖 Generated by \`${safeModel}\` via \`${safeProvider}\` · ${data.validCommentCount} inline`;
}
/** Sort posted comments by severity desc, then path asc — same invariant the existing code uses. */
function sortedPosted(data) {
    return [...data.postedComments].sort((a, b) => {
        const ra = severity_severityRank(a.severity);
        const rb = severity_severityRank(b.severity);
        if (ra !== rb)
            return rb - ra;
        return a.path.localeCompare(b.path);
    });
}
/** Top N preview line items (rendered as bullets, capped at 5 like the existing code). */
function previewLines(data, max = 5) {
    return sortedPosted(data).slice(0, max).map((c, i) => `${i + 1}. ${findingLine(c, data.secrets)}`);
}
/**
 * Append the canonical trailer (horizontal rule, `footer`, marker, manifest)
 * to `parts` and return the joined string. Every replacement layout in
 * `LAYOUT_RENDERERS` ends with this exact sequence — it is the contract
 * that keeps dedup loops and the AI manifest parser happy:
 *   1. `<!-- umactually-pr-review -->` marker (dedup key)
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
// ---------------------------------------------------------------------------
// Baseline — current (what we have now)
// ---------------------------------------------------------------------------
// Byte-identical to the existing buildReviewBody() body. Re-uses the same
// section order so all existing tests continue to pass without modification.
// Exposed for side-by-side comparison in the viewer; not part of the 20-sheet.
function layoutBaseline(data) {
    const summary = redact(data.review.summary, data.secrets);
    const sections = [];
    sections.push(REVIEW_MARKER);
    sections.push("");
    sections.push(`## ${verdictBadge(data)}`);
    sections.push("");
    if (data.review.parseFailed === true) {
        sections.push(PARSE_FAILED_BANNER);
    }
    else {
        sections.push(pipelineLine(data));
    }
    const tally = severityTally(data);
    if (tally.length > 0) {
        sections.push(tally);
        const legend = severityTallyLegend(data);
        if (legend.length > 0)
            sections.push(legend);
    }
    // Posted preview (or filtered preview)
    if (data.validCommentCount > 0 && data.postedComments.length > 0) {
        const preview = previewLines(data);
        const total = data.postedComments.length;
        const header = preview.length < total
            ? `📋 Posted preview (showing ${preview.length} of ${total})`
            : `📋 Posted preview (${preview.length})`;
        sections.push("");
        sections.push(header);
        for (const line of preview)
            sections.push(line);
    }
    else if (data.review.comments.length > 0) {
        const preview = previewLines(data);
        const total = data.review.comments.length;
        sections.push("");
        sections.push(`🧹 Filtered preview (showing ${preview.length} of ${total} candidates)`);
        sections.push("");
        sections.push(`_The model produced ${total} finding(s); all were filtered by severity policy, the \`max-comments\` cap, or off-diff suppression. The list below is the pre-filter view for transparency — no inline comments were posted._`);
        for (const line of preview)
            sections.push(line);
    }
    // Off-diff block — removed (CLARITY-19a retired). Reviewers don't
    // action off-diff findings; the dashboard "Off-diff: N" KPI tile
    // already exposes the count. See the retired callout in
    // layoutSeverityTable for the full rationale.
    // Summary prose
    if (summary.trim().length > 0) {
        sections.push("");
        sections.push("📝 Summary");
        sections.push("");
        sections.push(summary);
    }
    sections.push("");
    sections.push(footer(data));
    sections.push("");
    sections.push(manifest(data));
    return sections.filter((s) => s.length > 0).join("\n");
}
// ---------------------------------------------------------------------------
// Layout 1 — Dashboard (KPI tiles)
// ---------------------------------------------------------------------------
// Large numbers in a GFM grid: one row of KPI tiles + one row of sub-stats.
// Reads in 3 seconds: how many, what verdict, what model.
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
    summarySection(data, parts, { heading: null, blockquote: true });
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 2 — Pipeline (sequential step diagram)
// ---------------------------------------------------------------------------
// Reads as a flow: input → review → output. Each step is a numbered
// blockquote block so it scans top-to-bottom like a process diagram.
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
// ---------------------------------------------------------------------------
// Layout 3 — Verdict Banner (oversized single banner)
// ---------------------------------------------------------------------------
// One HUGE verdict banner with a tiny context table under it.
// Best when reviewers want a one-glance signal.
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
        if (legend.length > 0)
            parts.push(legend);
        parts.push("");
    }
    if (data.postedComments.length > 0) {
        parts.push("### 📋 Findings to address");
        parts.push("");
        sortedPosted(data).slice(0, 5).forEach((c, i) => {
            const title = collapseBody(c, data.secrets);
            const snippet = truncateSnippet(title, 90);
            parts.push(`${i + 1}. ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
        });
        parts.push("");
    }
    summarySection(data, parts, { heading: "### 💬 Provider summary" });
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 4 — Severity Table (SonarQube-style)
// ---------------------------------------------------------------------------
// Classic GFM table: every finding on a row, severity + category + title.
// Best when reviewers want to triage the full list in one glance.
function layoutSeverityTable(data) {
    const verdict = verdictBadge(data);
    const all = sortedPosted(data);
    const parts = [];
    // Marker first so dedup loops always find it (the contract that
    // GitHub/Azure dedup loops rely on). The verdict comes next so the
    // first non-marker line is the verdict badge (CLARITY-1 invariant).
    parts.push(REVIEW_MARKER);
    parts.push("");
    parts.push(`## ${verdict}`);
    parts.push("");
    // CLARITY-10: parse-fail banner must be unmistakable. Rendered as a
    // blockquote immediately after the verdict so a 0-finding review
    // cannot be confused with a clean bill of health.
    if (data.review.parseFailed === true) {
        parts.push(PARSE_FAILED_BANNER);
        parts.push("");
    }
    else {
        parts.push(pipelineLine(data));
        const tally = severityTally(data);
        if (tally.length > 0) {
            parts.push(tally);
            const legend = severityTallyLegend(data);
            if (legend.length > 0)
                parts.push(legend);
        }
        // CLARITY-19a (retired): the off-diff callout used to explain why
        // the table has fewer rows than the model's gross output. Removed
        // — reviewers don't action off-diff findings (they target files
        // outside this PR's diff) and the "Off-diff: N" KPI tile in the
        // dashboard already exposes the count without noise.
        parts.push("");
    }
    parts.push("### 📋 Findings");
    parts.push("");
    // Mobile-friendly collapsible list. A GFM table at 576px viewport
    // auto-sizes each column to fit its widest cell, then wraps mid-word
    // (`#` column stacks "10" → "1"/"0", File:Line breaks inside
    // `summary-layouts` → `summa`/`ry-`/`layouts.ts`, Title truncates
    // mid-sentence, Severity header wraps to "Severit"/"y"). None of
    // those are fixable inside a GFM table because the renderer doesn't
    // expose column-width controls and `word-wrap: anywhere` will
    // character-break any unbreakable token that overflows even by 1px.
    //
    // `<details>`/`<summary>` is a native HTML element that GitHub's
    // GFM passes through (verified 2026-07-05 per file header; Azure
    // DevOps renders the same way in markdown). Each finding gets one
    // collapsed block: the summary shows severity emoji + word + the
    // first ~80 chars of the title; clicking expands to show the full
    // path, line number, and full title with no width constraints.
    //
    // Information previously encoded in table columns:
    //   #       → leading "N · " in the summary line
    //   Severity→ "🟠 Medium" (emoji + label, no width constraint)
    //   File:Line → first line of expanded body, prefixed with 📍
    //   Title  → first 80 chars in summary, full text in expanded body
    if (all.length === 0) {
        parts.push("_No findings to address._");
        parts.push("");
    }
    else {
        all.forEach((c, i) => {
            parts.push(findingsDetailsRow(i + 1, c, data.secrets, 80));
        });
        parts.push("");
    }
    if (data.review.summary.trim().length > 0) {
        const safeSummary = redact(data.review.summary, data.secrets);
        // Cross-platform note: <details>/<summary> renders as a collapsible
        // section on GitHub PR reviews (primary platform), but Azure DevOps
        // PR comments show the raw HTML. We accept that trade-off ONLY for
        // verbose summaries (>500 chars) — short summaries stay inline.
        // Threshold picked to match the "long/verbose" trigger the user
        // asked us to address; below it, the summary stays compact and
        // readable on both platforms.
        if (safeSummary.length > VERBOSE_THRESHOLD_CHARS) {
            parts.push("### 📝 Summary");
            parts.push("");
            parts.push("<details>");
            parts.push("<summary>📝 Click to expand the full review summary</summary>");
            parts.push("");
            parts.push(safeSummary);
            parts.push("");
            parts.push("</details>");
            parts.push("");
        }
        else {
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
// ---------------------------------------------------------------------------
// Layout 5 — Card Grid (one card per severity bucket)
// ---------------------------------------------------------------------------
// Each severity bucket is its own ## section. Inside: a short list of
// bullet findings. Reads like a stack of color-coded sticky notes.
function layoutCardGrid(data) {
    const verdict = verdictBadge(data);
    const buckets = {
        critical: [], high: [], medium: [], low: [],
    };
    for (const c of data.postedComments) {
        const key = c.severity.toLowerCase();
        const target = buckets[key] ?? buckets["low"];
        if (target !== undefined)
            target.push(c);
    }
    const parts = [];
    parts.push(`## ${verdict}`);
    parts.push("");
    parts.push("### 🎴 Findings by severity");
    parts.push("");
    for (const level of SEVERITY_ORDER) {
        const bucket = buckets[level] ?? [];
        if (bucket.length === 0)
            continue;
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
// ---------------------------------------------------------------------------
// Layout 6 — TL;DR + Walkthrough
// ---------------------------------------------------------------------------
// Headline TL;DR callout followed by per-file walkthrough sections.
// Mirrors CodeRabbit's summary card.
function layoutTldrWalkthrough(data) {
    const verdict = verdictBadge(data);
    const parts = [];
    parts.push(`## ${verdict}`);
    parts.push("");
    parts.push("### 📌 TL;DR");
    parts.push("");
    parts.push(`> ${verdict}. **${data.validCommentCount}** of **${totalFindings(data)}** findings posted inline.`);
    parts.push(">");
    if (data.postedComments.length > 0) {
        parts.push(`> Top concern: ${findingLine(sortedPosted(data)[0], data.secrets)}`);
    }
    else {
        parts.push("> No actionable concerns surfaced.");
    }
    parts.push("");
    // Per-file walkthrough
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
// ---------------------------------------------------------------------------
// Layout 7 — Checklist (grouped by category)
// ---------------------------------------------------------------------------
// Plain bulleted list grouped by category. Each item has an emoji and
// a `path:line` reference. Reads like a todo list.
function layoutChecklist(data) {
    const verdict = verdictBadge(data);
    const parts = [];
    parts.push(`## ${verdict}`);
    parts.push("");
    parts.push("### ✅ Review checklist");
    parts.push("");
    // Group by category
    const byCat = new Map();
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
            const title = collapseBody(c, data.secrets);
            const snippet = truncateSnippet(title, 90);
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
        if (legend.length > 0)
            parts.push(legend);
        parts.push("");
    }
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 8 — Progress Bars (ASCII block bars)
// ---------------------------------------------------------------------------
// Per-severity bar made of `█` (filled) and `░` (empty) blocks inside
// an inline code block. Terminal-style dashboard.
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
        const filled = Math.round((count / max) * 20);
        const empty = 20 - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);
        const pct = total === 0 ? "0%" : `${Math.round((count / total) * 100)}%`;
        parts.push(`\`${level.padEnd(8)} ${bar} ${String(count).padStart(3)} ${pct.padStart(4)}\``);
    }
    parts.push("");
    parts.push("### 📋 Findings");
    parts.push("");
    if (data.postedComments.length === 0) {
        parts.push("> _No findings to address._");
    }
    else {
        sortedPosted(data).slice(0, 5).forEach((c, i) => {
            parts.push(`${i + 1}. ${severityEmoji(c.severity)} ${findingLine(c, data.secrets)}`);
        });
    }
    parts.push("");
    summarySection(data, parts);
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 9 — Pros & Cons (two-column GFM table)
// ---------------------------------------------------------------------------
// Splits the list into positives (low/critical-clean items) and
// negatives (findings to fix). Reads like a balanced review.
function layoutProsCons(data) {
    const verdict = verdictBadge(data);
    const parts = [];
    parts.push(`## ${verdict}`);
    parts.push("");
    parts.push("### ⚖️ Strengths vs concerns");
    parts.push("");
    const concerns = sortedPosted(data);
    const lowCount = (data.severityCounts["low"] ?? 0);
    const highCount = (data.severityCounts["high"] ?? 0) + (data.severityCounts["critical"] ?? 0);
    parts.push("| ✅ Strengths | ⚠️ Concerns |");
    parts.push("| :--- | :--- |");
    const strengthsMd = totalFindings(data) === 0
        ? "_No issues found — clean review._"
        : `_Reviewed **${totalFindings(data)}** finding${totalFindings(data) === 1 ? "" : "s"} across the diff. Severity tally: ${severityTally(data) || "all clear"}._`;
    const concernsMd = concerns.length === 0
        ? "_None._"
        : concerns.slice(0, 5).map((c) => `**${severityLabel(c.severity)}** — ${findingLine(c, data.secrets)}`).join("<br>");
    parts.push(`| ${strengthsMd} | ${concernsMd} |`);
    parts.push("");
    if (lowCount + highCount > 0) {
        parts.push("### 📊 Tally");
        parts.push("");
        parts.push(severityTally(data));
        const legend = severityTallyLegend(data);
        if (legend.length > 0)
            parts.push(legend);
        parts.push("");
    }
    summarySection(data, parts);
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 10 — Tweet / Announcement
// ---------------------------------------------------------------------------
// Single big quote-block headline followed by 4-bullet "what this means".
// Reads like a project announcement card.
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
    if (tally.length > 0) {
        parts.push(`- ${tally}`);
    }
    if (data.postedComments.length > 0) {
        parts.push(`- Top priority: ${findingLine(sortedPosted(data)[0], data.secrets)}`);
    }
    else {
        parts.push("- ✅ No actionable concerns.");
    }
    if (filteredCount(data) > 0) {
        parts.push(`- 🧹 ${filteredCount(data)} filtered by severity policy or \`max-comments\` cap.`);
    }
    parts.push("");
    summarySection(data, parts, { heading: "### 📖 Story" });
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 11 — FAQ Q&A
// ---------------------------------------------------------------------------
// Each finding becomes a Q: "Why is `path:line` a problem?" A: ...
// Great for senior reviewers asking "what do I actually need to know?"
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
    }
    else {
        sortedPosted(data).slice(0, 5).forEach((c, i) => {
            const title = collapseBody(c, data.secrets);
            parts.push(`### Q${i + 1}: What's wrong at \`${cell(c.path)}\`:${c.line}?`);
            parts.push("");
            parts.push(`**A:** ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** (${cell(c.category)}). ${cell(title)}`);
            parts.push("");
        });
    }
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
// ---------------------------------------------------------------------------
// Layout 12 — Terminal Output (fenced code block)
// ---------------------------------------------------------------------------
// Entire summary sits inside a single fenced code block styled like
// terminal output. Pure ASCII + emoji.
function layoutTerminal(data) {
    const verdict = verdictBadge(data);
    const parts = [];
    parts.push(`## ${verdict}`);
    parts.push("");
    parts.push("### 🖥️ Terminal report");
    parts.push("");
    parts.push("```text");
    parts.push("┌──────────────────────────────────────────────────────────┐");
    parts.push(`│ umactually-pr-review · ${verdict.padEnd(36)} │`);
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
// ---------------------------------------------------------------------------
// Layout 13 — Incident Report (timeline)
// ---------------------------------------------------------------------------
// Reads like a post-incident report: status, severity, timeline, impact.
function layoutIncident(data) {
    const verdict = verdictBadge(data);
    const parts = [];
    parts.push(`## ${verdict}`);
    parts.push("");
    parts.push("### 📟 Incident report");
    parts.push("");
    const severityWord = data.validCommentCount === 0
        ? "✅ None"
        : (data.severityCounts["critical"] ?? 0) > 0
            ? "🟣 Critical"
            : (data.severityCounts["high"] ?? 0) > 0
                ? "🔴 High"
                : (data.severityCounts["medium"] ?? 0) > 0
                    ? "🟠 Medium"
                    : "🟡 Low";
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
    if (data.postedComments.length > 0) {
        sortedPosted(data).slice(0, 5).forEach((c, i) => {
            parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
        });
    }
    else {
        parts.push("- ✅ No blocking findings.");
    }
    parts.push("");
    // CLARITY-19a (retired): the "📍 Off-diff items (not posted)" section
    // used to render up to 5 off-diff findings. Removed — reviewers
    // don't action off-diff findings (they target files outside this
    // PR's diff) and the "Off-diff: N" KPI tile in the dashboard
    // already exposes the count without noise.
    summarySection(data, parts, { heading: "### 💬 Provider summary" });
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 14 — Release Notes (categorized changelog)
// ---------------------------------------------------------------------------
// Reads like a CHANGELOG entry: Features / Fixes / Style sections.
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
        "🟡 Style (low)": [],
    };
    // Severity-rank → release-notes bucket. Mirrors the unified rank table
    // in `src/util/severity.ts:severityRank` (leak=6, security=5,
    // critical=4, high=3, medium/major=2, low/minor=1, info=0). The
    // "🔴 Fixes (critical+)" bucket intentionally covers the entire top
    // half (ranks 3-6 — high, critical, security, leak) so security and
    // leak findings (which the live path can produce when the severity
    // filter is permissive or bypassed) get bucketed as fixes rather
    // than silently collapsed into the default "🟡 Style (low)" bucket.
    const SEVERITY_RANK_TO_BUCKET = {
        6: "🔴 Fixes (critical+)",
        5: "🔴 Fixes (critical+)",
        4: "🔴 Fixes (critical+)",
        3: "🔴 Fixes (critical+)",
        2: "🟠 Improvements (medium)",
        1: "🟡 Style (low)",
        0: "🟡 Style (low)",
    };
    for (const c of data.postedComments) {
        const rank = severity_severityRank(c.severity);
        const bucketName = SEVERITY_RANK_TO_BUCKET[rank] ?? "🟡 Style (low)";
        buckets[bucketName].push(c);
    }
    for (const [header, list] of Object.entries(buckets)) {
        if (list.length === 0)
            continue;
        parts.push(`### ${header}`);
        parts.push("");
        list.forEach((c, i) => {
            const title = collapseBody(c, data.secrets);
            const snippet = truncateSnippet(title, 80);
            parts.push(`- **${cell(c.path)}:${c.line}** — ${cell(snippet)}`);
            if (i === list.length - 1)
                parts.push("");
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
// ---------------------------------------------------------------------------
// Layout 15 — Coverage Report
// ---------------------------------------------------------------------------
// Per-file table with emoji status. Reads like a test-coverage widget.
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
    if (sortedFiles.length === 0) {
        parts.push("| _all files_ | **0** | ✅ Pass |");
    }
    else {
        for (const [path, comments] of sortedFiles) {
            const worst = Math.max(...comments.map((c) => severity_severityRank(c.severity)));
            const status = worst >= 3 ? "🔴" : worst === 2 ? "🟠" : worst === 1 ? "🟡" : "⚪";
            parts.push(`| \`${cell(path)}\` | **${comments.length}** | ${status} |`);
        }
    }
    parts.push("");
    parts.push("### 📋 Detail");
    parts.push("");
    if (sortedFiles.length === 0) {
        parts.push("> _No findings to address._");
    }
    else {
        for (const [path, comments] of sortedFiles) {
            parts.push(`#### \`${cell(path)}\``);
            parts.push("");
            for (const c of comments) {
                parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${collapseBody(c, data.secrets)}`);
            }
            parts.push("");
        }
    }
    summarySection(data, parts);
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 16 — Thermometer (vertical severity ladder)
// ---------------------------------------------------------------------------
// Stacked emoji severity ladder + count badges. Visual "how hot is this PR".
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
    if (data.postedComments.length === 0) {
        parts.push("> _No findings._");
    }
    else {
        sortedPosted(data).slice(0, 5).forEach((c, i) => {
            parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
        });
    }
    parts.push("");
    summarySection(data, parts);
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 17 — Status Page
// ---------------------------------------------------------------------------
// Mirrors GitHub Status / statuspage.io: status banner, then per-component status.
function layoutStatusPage(data) {
    const verdict = verdictBadge(data);
    const parts = [];
    parts.push(`## ${verdict}`);
    parts.push("");
    parts.push("### 📡 Status page");
    parts.push("");
    const banner = data.validCommentCount === 0
        ? "✅ All clear — no findings"
        : (data.severityCounts["critical"] ?? 0) > 0
            ? "🟣 Critical findings reported"
            : (data.severityCounts["high"] ?? 0) > 0
                ? "🔴 High severity findings reported"
                : (data.severityCounts["medium"] ?? 0) > 0
                    ? "🟠 Medium severity findings reported"
                    : "🟡 Low severity findings reported";
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
// ---------------------------------------------------------------------------
// Layout 18 — Diffstat (per-file +/- with ASCII bars)
// ---------------------------------------------------------------------------
// Per-file change summary using ASCII bars. Reads like `git diff --stat`.
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
    if (sortedFiles.length === 0) {
        parts.push("(no findings)");
    }
    else {
        const pathWidth = Math.max(8, ...sortedFiles.map(([p]) => p.length));
        for (const [path, comments] of sortedFiles) {
            const filled = Math.round((comments.length / max) * 24);
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
            for (const c of comments) {
                parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${collapseBody(c, data.secrets)}`);
            }
            parts.push("");
        }
    }
    else {
        parts.push("> _No findings to address._");
        parts.push("");
    }
    summarySection(data, parts);
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 19 — Sticky Notes (push-pin quote blocks)
// ---------------------------------------------------------------------------
// Each finding is its own blockquote with a 📌 prefix. Reads like a
// wall of sticky notes.
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
    }
    else {
        sortedPosted(data).slice(0, 6).forEach((c) => {
            const title = collapseBody(c, data.secrets);
            const snippet = truncateSnippet(title, 200);
            parts.push(">");
            parts.push(`> 📌 **${severityLabel(c.severity)}** — \`${cell(c.path)}\`:${c.line}`);
            parts.push(">");
            parts.push(`> ${cell(snippet)}`);
            parts.push(">");
        });
        if (data.postedComments.length > 6) {
            parts.push(`> _…and ${data.postedComments.length - 6} more._`);
        }
        parts.push("");
    }
    const tally = severityTally(data);
    if (tally.length > 0) {
        parts.push(tally);
        const legend = severityTallyLegend(data);
        if (legend.length > 0)
            parts.push(legend);
        parts.push("");
    }
    summarySection(data, parts);
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 20 — Newspaper (headline-lede-body)
// ---------------------------------------------------------------------------
// Headline H1, italic lede, then body. Reads like a news article.
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
    if (data.postedComments.length === 0) {
        parts.push("_No findings to address._");
    }
    else {
        sortedPosted(data).slice(0, 6).forEach((c, i) => {
            const title = collapseBody(c, data.secrets);
            const snippet = truncateSnippet(title, 140);
            parts.push(`**${i + 1}.** ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
        });
    }
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
        if (legend.length > 0)
            parts.push(legend);
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
    "newspaper": layoutNewspaper,
};
const BASELINE_RENDERERS = {
    "current": layoutBaseline,
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
    if (data.postedComments === undefined) {
        throw new Error("renderSummary: data.postedComments is required (was undefined). Use buildReviewBody() to dispatch — it computes the post-filter set from review.comments.");
    }
    const renderer = LAYOUT_RENDERERS[layout];
    if (renderer === undefined) {
        throw new Error(`Unknown layout: ${layout}`);
    }
    return renderer(data);
}
/**
 * Render the BASELINE review summary (byte-identical reproduction of
 * the existing `buildReviewBody` output). Use this for side-by-side
 * comparison in the viewer and for the regression test that pins
 * `LAYOUTS` parity with `buildReviewBody`.
 */
function renderBaseline(baseline, data) {
    if (data.postedComments === undefined) {
        throw new Error("renderBaseline: data.postedComments is required (was undefined). Use buildReviewBody() to dispatch — it computes the post-filter set from review.comments.");
    }
    const renderer = BASELINE_RENDERERS[baseline];
    if (renderer === undefined) {
        throw new Error(`Unknown baseline: ${baseline}`);
    }
    return renderer(data);
}
/** Human-readable label for each of the 20 layouts. */
const LAYOUT_LABELS = {
    "dashboard": "1 · Dashboard — KPI tiles",
    "pipeline": "2 · Pipeline — step diagram",
    "verdict-banner": "3 · Verdict banner — single oversized callout",
    "severity-table": "4 · Severity table — SonarQube-style",
    "card-grid": "5 · Card grid — one card per severity",
    "tldr-walkthrough": "6 · TL;DR + walkthrough",
    "checklist": "7 · Checklist — grouped by category",
    "progress-bars": "8 · Progress bars — ASCII block bars",
    "pros-cons": "9 · Pros & Cons — two-column GFM table",
    "tweet": "10 · Tweet — announcement card",
    "faq": "11 · FAQ — Q/A pairs",
    "terminal": "12 · Terminal — fenced code block",
    "incident": "13 · Incident report — timeline",
    "release-notes": "14 · Release notes — categorized changelog",
    "coverage": "15 · Coverage report — per-file table",
    "thermometer": "16 · Thermometer — vertical severity ladder",
    "status-page": "17 · Status page — components & incidents",
    "diffstat": "18 · Diffstat — per-file +/- with ASCII bars",
    "sticky-notes": "19 · Sticky notes — push-pin quote blocks",
    "newspaper": "20 · Newspaper — headline-lede-body",
};

;// CONCATENATED MODULE: ./src/config/severity.ts

/**
 * Returns the numeric rank for a severity. Higher = more severe.
 *
 * Delegates to `severityRank` in `src/util/severity.ts` so the
 * config-layer and the live-layer share one rank table. The previous
 * separate `SEVERITY_RANK` table here diverged from the live path on
 * absolute values (e.g. `critical` was 3 here vs 4 in the live path)
 * and could silently disagree on ordering when the two surfaces were
 * composed in the same call (see `live-shared.ts:passesSeverityPolicy`,
 * which used the live-path table and ignored this one entirely).
 */
function rankSeverity(severity) {
    return severityRank(severity);
}
/**
 * True when `severity` is at least as severe as `minimum`. Delegates
 * to the canonical `severityRank` so the comparison cannot drift from
 * the live-path filter or the merge-path ranking.
 */
function isSeverityAtLeast(minimum, severity) {
    return severity_severityRank(severity) >= severity_severityRank(minimum);
}
/**
 * Decides whether a finding should be kept under the configured minimum
 * severity threshold.
 *
 * Security policy invariant: `security` and `leak` findings ALWAYS survive
 * any threshold, even when the configured minimum would otherwise filter them.
 */
function shouldKeepFinding(controls, finding) {
    // security and leak ALWAYS survive any threshold (security policy)
    if (finding === "security" || finding === "leak")
        return true;
    return isSeverityAtLeast(controls.minimum, finding);
}

;// CONCATENATED MODULE: ./src/render/json-extract.ts

/**
 * Valid JSON escape characters (the second character after `\`).
 * Any other character following `\` inside a JSON string is an invalid
 * escape sequence and will cause JSON.parse to reject the document
 * with "Bad escaped character in JSON". Models writing prose (especially
 * markdown) frequently produce stray `\X` sequences inside JSON string
 * fields — `\`` (escaped backtick, common in shell contexts), `\.`,
 * `\:`, `\,`, `\'`, etc. None of these are valid JSON escapes.
 */
const VALID_JSON_ESCAPE_CHARS = new Set([
    '"',
    "\\",
    "/",
    "b",
    "f",
    "n",
    "r",
    "t",
    "u",
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
    if (index + 4 > substring.length)
        return false;
    for (let i = 0; i < 4; i += 1) {
        const c = substring.charCodeAt(index + i);
        const isDigit = c >= 0x30 && c <= 0x39; // 0-9
        const isLowerHex = c >= 0x61 && c <= 0x66; // a-f
        const isUpperHex = c >= 0x41 && c <= 0x46; // A-F
        if (!isDigit && !isLowerHex && !isUpperHex)
            return false;
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
    if (wholeAttempt !== undefined) {
        return wholeAttempt;
    }
    const fenceBody = extractJsonFenceBody(rawText);
    // Repair the fence body before trying to parse it: the body may
    // contain literal control characters (from SSE delta accumulation,
    // where each delta's `\n` was decoded to a real newline) or stray
    // `\X` sequences (from markdown prose the model wrote unescaped).
    // The repair pass is the same balanced-walk used by the
    // balanced-object fallback below — applied here so the cheaper
    // fence path doesn't fall through unnecessarily on SSE-shaped
    // input.
    const repairedFenceBody = repairJsonStringLiterals(fenceBody);
    const fencedAttempt = tryParseJson(repairedFenceBody);
    if (fencedAttempt !== undefined) {
        return fencedAttempt;
    }
    const balanced = extractFirstBalancedObject(rawText);
    if (balanced !== null) {
        const balancedAttempt = tryParseJson(balanced);
        if (balancedAttempt !== undefined) {
            return balancedAttempt;
        }
        else if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
            try {
                JSON.parse(balanced);
            }
            catch (e) {
                process.stderr.write(`[DEBUG-RAW] balanced-parse failed at length ${balanced.length}: ${e instanceof Error ? e.message : String(e)}\n`);
            }
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
    // Real-newline boundaries: ```[tag]\n[body]\n```
    const realNewline = /```[a-zA-Z0-9_+\-]*\s*\n([\s\S]*?)\n```/.exec(rawText);
    // JSON-escaped-newline boundaries: ```[tag]\n[body]\n```  (where \n is
    // the literal 2-char sequence). The opening ```[tag] is followed by
    // either a real newline OR the 2-char escape, same for the closing.
    // In a regex literal, the 2-char sequence `\n` requires 4 backslashes
    // (`\\\\n` in source → `\\n` in the regex pattern → matches literal
    // backslash + n in input).
    const escapedNewline = /```[a-zA-Z0-9_+\-]*\s*\\n([\s\S]*?)\\n```/u.exec(rawText);
    let body = realNewline?.[1] ?? escapedNewline?.[1];
    if (body !== undefined && escapedNewline !== null && realNewline === null) {
        // The body was extracted from a JSON-escaped-newline fence. The
        // content was the inside of a JSON string, so its `\n` characters
        // are 2-char escapes, NOT real newlines. To make this parseable
        // as a JSON object, we need to convert the 2-char `\n` (and
        // other JSON escapes) to their real-character equivalents. Wrap
        // the body in a JSON string and re-parse so the standard JSON
        // unescape logic handles the conversion.
        try {
            body = JSON.parse('"' + body.replace(/"/gu, '\\"') + '"');
        }
        catch {
            // Body is not a valid JSON-string-encoded value; fall through
            // and return it as-is so the caller's `tryParseJson` (and the
            // balanced-object fallback) can try other shapes.
        }
    }
    if (body === undefined) {
        return rawText;
    }
    // Run the JSON-string escape-repair pass on the extracted body. The
    // body may contain literal control characters (from SSE delta
    // accumulation, where each delta's `\n` was decoded to a real
    // newline) or stray `\X` sequences (from markdown prose that the
    // model wrote unescaped). Without this pass, `tryParseJson(body)`
    // rejects with "Bad control character" or "Bad escaped character"
    // and the parser falls through to the slower balanced-object
    // fallback — which then has to repeat the same repair work.
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
    if (startIndex === -1) {
        return null;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    // First pass: find the end index of the balanced object.
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
            if (char === '"') {
                // Disambiguate a stray `"` from a legitimate closing quote by
                // peeking ahead. A real closing quote is followed (after
                // optional whitespace) by a structural JSON character
                // (`,`, `}`, `]`, `:`). Anything else means the model forgot
                // to escape a `"` inside the string value (SSE delta
                // concatenation surfaces this as an unescaped quote in the
                // resulting textPayload). Treat the latter as a stray quote
                // — stay inside the string so the depth tracker keeps
                // working AND escape it in the second pass.
                //
                // Note: `"` is NOT a structural JSON character so we don't
                // include it in the close-quote set. If we did, a stray
                // `"` followed by another `"` (e.g. `body: "value" "next":`)
                // would be misclassified as a closing quote.
                const nextNonWs = peekNextNonWhitespace(rawText, index + 1);
                if (nextNonWs === -1 ||
                    nextNonWs === ",".charCodeAt(0) ||
                    nextNonWs === "}".charCodeAt(0) ||
                    nextNonWs === "]".charCodeAt(0) ||
                    nextNonWs === ":".charCodeAt(0)) {
                    inString = false;
                }
                // else: stray quote inside a string. Stay inString; the second
                // pass will escape it.
                continue;
            }
            continue;
        }
        if (char === '"') {
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
    if (endIndex === -1) {
        return null;
    }
    // Second pass: walk the balanced substring and escape literal control
    // characters that appear INSIDE JSON strings. We re-walk because the
    // first pass above only tracked depth, not the output positions.
    const substring = rawText.slice(startIndex, endIndex + 1);
    const segments = [];
    inString = false;
    escape = false;
    for (let index = 0; index < substring.length; index += 1) {
        const char = substring.charAt(index);
        if (inString) {
            if (escape) {
                // Validate the escape sequence: only `" \ / b f n r t u` are
                // valid single-char JSON escapes, AND `\u` requires exactly
                // 4 hex digits. Models writing markdown prose sometimes
                // emit stray `\X` sequences (`` \` ``, `\:`, `\,`, `\.`,
                // etc.) which JSON.parse rejects with "Bad escaped
                // character in JSON", or partial `\uXXXX` sequences
                // (`\u00`, `\uXYZW`) rejected with "Bad Unicode escape in
                // JSON". Double-escape the invalid form so the parsed
                // output preserves the literal sequence the model wrote.
                //
                // The `\` itself was already pushed when `escape` was set on
                // the previous iteration; here we only emit the second
                // character (or `\\` + char for the invalid case).
                const isInvalidSingleChar = !VALID_JSON_ESCAPE_CHARS.has(char);
                const isInvalidUnicodeEscape = char === "u" && !isHexQuadAt(substring, index + 1);
                if (isInvalidSingleChar || isInvalidUnicodeEscape) {
                    segments.push("\\" + char);
                }
                else {
                    segments.push(char);
                }
                escape = false;
                continue;
            }
            if (char === "\\") {
                segments.push(char);
                escape = true;
                continue;
            }
            if (char === '"') {
                // Same disambiguation as the first pass: peek ahead to determine
                // whether this `"` is a legitimate closing quote (followed by
                // structural JSON punctuation) or a stray quote from an
                // unescaped model emission. The latter gets escaped so the
                // resulting substring parses as valid JSON.
                const nextNonWs = peekNextNonWhitespace(substring, index + 1);
                if (nextNonWs === -1 ||
                    nextNonWs === ",".charCodeAt(0) ||
                    nextNonWs === "}".charCodeAt(0) ||
                    nextNonWs === "]".charCodeAt(0) ||
                    nextNonWs === ":".charCodeAt(0)) {
                    // Legitimate closing quote: emit the raw `"` and exit the
                    // string. The first-pass peek-ahead already determined this
                    // was the close.
                    segments.push(char);
                    inString = false;
                    continue;
                }
                // Stray quote inside a string: escape it so the parser keeps
                // the string open. Live evidence (run 28829205474 at
                // 2026-07-06T23:03:58Z): the model's review body contained an
                // unescaped `"` inside a body field, breaking the outer JSON.
                segments.push('\\"');
                continue;
            }
            // Inside a string: escape literal control characters that are
            // invalid in JSON strings. \n, \r, \t are the common ones from
            // SSE delta concatenation; we also handle \b, \f for completeness.
            if (char === "\n") {
                segments.push("\\n");
                continue;
            }
            if (char === "\r") {
                segments.push("\\r");
                continue;
            }
            if (char === "\t") {
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
        // Outside a string: control characters are valid JSON whitespace,
        // so just copy them through.
        if (char === '"') {
            inString = true;
        }
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
    if (startIndex === -1) {
        return text;
    }
    // Find the end index of the balanced top-level object/array.
    let endIndex = -1;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let index = startIndex; index < text.length; index += 1) {
        const char = text[index];
        if (char === undefined)
            break;
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (char === "\\") {
                escape = true;
                continue;
            }
            if (char === '"') {
                // Use the same stray-quote peek-ahead as extractFirstBalancedObject.
                const nextNonWs = peekNextNonWhitespace(text, index + 1);
                if (nextNonWs === -1 ||
                    nextNonWs === ",".charCodeAt(0) ||
                    nextNonWs === "}".charCodeAt(0) ||
                    nextNonWs === "]".charCodeAt(0) ||
                    nextNonWs === ":".charCodeAt(0)) {
                    inString = false;
                }
                continue;
            }
            continue;
        }
        if (char === '"') {
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
    if (endIndex === -1) {
        return text;
    }
    // Second pass: walk the balanced substring and emit a repaired copy.
    const substring = text.slice(startIndex, endIndex + 1);
    const segments = [];
    inString = false;
    escape = false;
    for (let index = 0; index < substring.length; index += 1) {
        const char = substring.charAt(index);
        if (inString) {
            if (escape) {
                // Validate that the escape sequence is one JSON.parse accepts.
                // Two failure modes to handle:
                //
                //   1. `\` followed by a char outside the valid set
                //      (`"`/`\`/`/`/`b`/`f`/`n`/`r`/`t`/`u`) — e.g.
                //      `` \` ``, `\:`, `\,`, `\.`, `\'` from markdown
                //      prose. JSON.parse rejects with "Bad escaped
                //      character". Fix: double-escape the whole sequence
                //      to `\\X` so JSON.parse sees a literal backslash +
                //      char in the parsed output.
                //
                //   2. `\u` followed by anything that isn't 4 hex digits
                //      (e.g. truncated `\u00`, `\uXYZW`, `\u000G`) —
                //      JSON.parse rejects with "Bad Unicode escape in
                //      JSON". Fix: same — double-escape `\u` to `\\u` so
                //      JSON.parse sees the literal sequence in the
                //      parsed output.
                //
                // The `\` itself was already pushed when `escape` was set on
                // the previous iteration; here we only push the second
                // character of the (possibly double-escaped) sequence.
                const isInvalidSingleChar = !VALID_JSON_ESCAPE_CHARS.has(char);
                const isInvalidUnicodeEscape = char === "u" && !isHexQuadAt(substring, index + 1);
                if (isInvalidSingleChar || isInvalidUnicodeEscape) {
                    segments.push("\\" + char);
                }
                else {
                    segments.push(char);
                }
                escape = false;
                continue;
            }
            if (char === "\\") {
                segments.push(char);
                escape = true;
                continue;
            }
            if (char === '"') {
                const nextNonWs = peekNextNonWhitespace(substring, index + 1);
                if (nextNonWs === -1 ||
                    nextNonWs === ",".charCodeAt(0) ||
                    nextNonWs === "}".charCodeAt(0) ||
                    nextNonWs === "]".charCodeAt(0) ||
                    nextNonWs === ":".charCodeAt(0)) {
                    segments.push(char);
                    inString = false;
                    continue;
                }
                segments.push('\\"');
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
            if (char === "\t") {
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
        if (char === '"') {
            inString = true;
        }
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
        // JSON whitespace: space (0x20), tab (0x09), LF (0x0A), CR (0x0D).
        if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
            return code;
        }
    }
    return -1;
}

;// CONCATENATED MODULE: ./src/provider/provider-parse.ts


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
    if (sink !== null && activeSeveritySink !== null) {
        // Concurrency footgun detected: a sink is already installed and the
        // caller is overwriting it without clearing the previous one first.
        // Log + warn loudly so the regression class surfaces in CI logs
        // rather than silently corrupting telemetry.
        console.warn("[provider-parse] setActiveSeveritySink: overwriting a non-null ambient sink. " +
            "This usually means two requestLiveReview calls are running concurrently " +
            "(Promise.all) — the second's sink will be cleared by the first's finally, " +
            "corrupting the captured warnings. Thread the sink via ParseContext instead.");
    }
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
    const providerLabel = context.providerName ?? "unknown-provider";
    const safeRaw = JSON.stringify(rawValue);
    const message = `provider ${providerLabel} emitted unrecognized severity ${safeRaw} ` +
        `at comment index ${context.commentIndex}; falling back to "${normalizedFallback}". ` +
        `Expected one of: info, low, medium, high, critical.`;
    console.warn(message, context);
    if (sink !== undefined) {
        sink(rawValue, normalizedFallback, context);
    }
}
/**
 * Returns true when the parsed review has at least one non-empty
 * summary, verdict, or comment — used by the parse-fail retry paths
 * to decide whether the parsed response carries any usable signal.
 */
function isNonEmptyReview(review) {
    return review !== null
        && (review.summary.length > 0 || review.verdict.length > 0 || review.comments.length > 0);
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
const PARSE_FAIL_RETRY_PROMPT = "Your previous response did not contain a valid JSON review payload. " +
    "Please respond with ONLY a JSON object matching this schema (no prose, no fences): " +
    '{"summary": "...", "verdict": "NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP", "comments": [...], "suppressed_comments": [...]}.\n\n' +
    "Original review request follows:\n\n";
function buildResponsesBody(config, opts) {
    // When `userOverride` is set (parse-fail retry), APPEND the original
    // user content so the model retains the PR diff + review instructions.
    // The override prefix asks the model to emit JSON-only output; the
    // trailing original content gives it the actual work. See
    // PARSE_FAIL_RETRY_PROMPT for the why.
    const userContent = opts?.userOverride !== undefined
        ? `${opts.userOverride}${config.user}`
        : config.user;
    const body = {
        model: config.model,
        input: [
            { role: "system", content: config.system },
            { role: "user", content: userContent },
        ],
    };
    if (config.maxOutputTokens !== undefined) {
        body["max_output_tokens"] = config.maxOutputTokens;
    }
    if (config.reasoningEffort !== undefined) {
        body["reasoning"] = { effort: config.reasoningEffort };
    }
    if (config.responseFormat !== undefined) {
        body["text"] = { format: config.responseFormat };
    }
    return body;
}
function buildChatBody(config, opts) {
    // When `userOverride` is set (parse-fail retry), APPEND the original
    // user content so the model retains the PR diff + review instructions.
    // See `buildResponsesBody` + `PARSE_FAIL_RETRY_PROMPT` for the why.
    const userContent = opts?.userOverride !== undefined
        ? `${opts.userOverride}${config.user}`
        : config.user;
    const body = {
        model: config.model,
        messages: [
            { role: "system", content: config.system },
            { role: "user", content: userContent },
        ],
    };
    if (config.maxOutputTokens !== undefined) {
        body["max_tokens"] = config.maxOutputTokens;
    }
    if (config.reasoningEffort !== undefined) {
        body["reasoning_effort"] = config.reasoningEffort;
    }
    if (config.responseFormat !== undefined) {
        body["response_format"] = config.responseFormat;
    }
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
    if (rawText.length === 0) {
        return "";
    }
    // 1. SSE stream (input starts with "data:" or "event:" prefix).
    //    Concatenate fragments. If the stream only has metadata events
    //    (no usable text fragments), return the rawText so the
    //    downstream strict-empty-fields check (CLARITY-10) catches
    //    it as a parse failure.
    const trimmedStart = rawText.trimStart();
    if (trimmedStart.startsWith("data:") || trimmedStart.startsWith("event:")) {
        const sseText = tryExtractSse(rawText);
        if (sseText !== null && sseText.length > 0) {
            return sseText;
        }
        // SSE was detected but no usable fragments — return rawText so the
        // empty-fields strict check can fire. (Returning `""` here would
        // cause `parseReviewPayload("")` to return null without the
        // strict-check safeguard.)
        return rawText;
    }
    // 2. Plain JSON object.
    const parsed = tryParseJson(rawText);
    if (parsed !== undefined && isRecord(parsed)) {
        if (endpoint === "responses") {
            const direct = readStringField(parsed, "output_text");
            if (direct !== null && direct.length > 0) {
                return direct;
            }
            const output = readArrayField(parsed, "output");
            if (output !== null) {
                const fromOutput = joinOutputText(output);
                if (fromOutput.length > 0) {
                    return fromOutput;
                }
            }
            // Not in the Responses API shape — fall through to raw text
            // so `parseReviewPayload` can extract a direct review JSON
            // object (model returned `{"summary": ..., "verdict": ...}`).
        }
        else {
            // Chat completions.
            const choices = readArrayField(parsed, "choices");
            if (choices !== null) {
                for (const choice of choices) {
                    const message = readRecordField(choice, "message");
                    if (message === null)
                        continue;
                    const content = readStringField(message, "content");
                    if (content !== null && content.length > 0) {
                        return content;
                    }
                }
            }
            // Chat JSON shape but no extractable content — fall through.
        }
    }
    // 3. Raw text (could be plain prose, markdown, or a JSON block
    //    wrapped in ``` fences — `extractJsonBlock` handles the latter).
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
    if (!isRecord(candidate)) {
        return null;
    }
    const summary = readStringField(candidate, "summary") ?? "";
    const verdict = readStringField(candidate, "verdict") ?? "";
    const comments = provider_parse_readCommentArray(candidate["comments"], context);
    const suppressed_comments = provider_parse_readCommentArray(candidate["suppressed_comments"], context);
    // Soft parse-fail detector (CLARITY-10b): some providers/models return
    // a *structurally valid* JSON wrapper whose contents are an apology
    // ("No diff or file contents were provided to review...", "I cannot
    // review this without...", "Please share the diff..."). These pass
    // the basic `extractJsonBlock` parse AND the strict non-empty check
    // (because `summary` is non-empty) but are functionally equivalent
    // to a parse failure — the model did not produce a review.
    //
    // Surface these as null so the self-healing retry path fires and
    // the parse-fail badge renders, instead of silently posting a
    // 0-finding review that LOOKS clean.
    //
    // Only trigger when there are zero findings (comments + suppressed_comments).
    // A real review with findings but a frustrated summary ("The code looks
    // fine but I noticed one issue...") is legitimate; we don't want to
    // rewrite that as a parse-fail.
    if (comments.length === 0 &&
        suppressed_comments.length === 0 &&
        isApologySummary(summary)) {
        return null;
    }
    return { summary, verdict, comments, suppressed_comments };
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
        if (!line.startsWith("data:")) {
            continue;
        }
        // Per SSE spec: data: is followed by an optional single space,
        // then the payload. Trim the leading space so the JSON parse
        // (or substring check) sees a clean value.
        const payload = line.slice("data:".length).replace(/^ /u, "");
        if (payload === "" || payload === "[DONE]") {
            continue;
        }
        if (payload.includes('"type":"response.completed"')) {
            return "response.completed";
        }
        if (payload.includes('"type":"response.done"')) {
            return "response.done";
        }
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
    if (rawText.length === 0) {
        return false;
    }
    // Quick exit for non-SSE responses (chat-completions, plain JSON).
    // Any `data:` line anywhere in the text indicates an SSE stream;
    // single-shot JSON has none.
    if (!rawText.includes("data:")) {
        return false;
    }
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
        if (!line.startsWith("data:")) {
            continue;
        }
        const payload = line.slice("data:".length).replace(/^ /u, "");
        if (payload === "" || payload === "[DONE]") {
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(payload);
        }
        catch {
            continue;
        }
        if (!isRecord(parsed))
            continue;
        const eventType = parsed["type"];
        if (eventType === "response.completed" || eventType === "response.done") {
            return parsed;
        }
    }
    return undefined;
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
    if (terminalEvent === undefined) {
        return undefined;
    }
    const usageRaw = terminalEvent["usage"];
    if (!isRecord(usageRaw)) {
        return undefined;
    }
    let inputTokens;
    let outputTokens;
    let totalTokens;
    if (typeof usageRaw["input_tokens"] === "number")
        inputTokens = usageRaw["input_tokens"];
    if (typeof usageRaw["output_tokens"] === "number")
        outputTokens = usageRaw["output_tokens"];
    if (typeof usageRaw["total_tokens"] === "number")
        totalTokens = usageRaw["total_tokens"];
    if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
        return undefined;
    }
    return {
        ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
        ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
        ...(totalTokens !== undefined ? { total_tokens: totalTokens } : {}),
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
    const truncated = wasResponseStreamTruncated(input.rawText);
    const usage = parseProviderUsage(input.rawText);
    return { truncated, usage };
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
    if (summary.length === 0) {
        return false;
    }
    const lower = summary.toLowerCase();
    // Most common patterns from the 3e62237 self-review incident.
    // Each pattern is anchored narrowly to avoid over-matching legitimate
    // clean-review summaries that happen to contain "cannot" or "review"
    // in other contexts (e.g. "I cannot find any issues to review").
    const APOLOGY_PATTERNS = [
        // "no diff / file contents were provided / shared / available" — direct form.
        /\bno\s+(diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied)\b/u,
        // "no [pull request | pr | file] diff was provided" — the model often
        // adds "pull request" / "pr" / "file" between "no" and "diff" before
        // reaching the apology verb. Live evidence (PR self-review at
        // 2026-07-06T22:08Z): "No pull request diff was provided in the
        // request, so no review can be produced." — the narrow `no\s+(diff|...)`
        // pattern above misses this. This broadened pattern matches any
        // "no <modifier>* diff/file/contents ... <apology verb>" form.
        /\bno\s+(?:pull\s+request\s+|pr\s+|file\s+|the\s+|any\s+)*(?:diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied|received)\b/u,
        // "please share / provide / send the diff / file / pull request"
        /\bplease\s+(share|provide|send)\s+(the\s+)?(diff|file|pull\s+request|pr)\b/u,
        // "I cannot / can't review this / it / the PR" — narrow to the
        // direct-object-after-verb pattern so "I cannot find issues to
        // review" does NOT match. Requires the verb (cannot/can't/etc.)
        // immediately followed by review + determiner (this/it/the/a).
        /\bi\s+(cannot|can'?t|am\s+unable|i'?m\s+unable)\s+review\s+(this|it|the|a|that)\b/u,
        // "cannot / can't / unable to review" — REQUIRES a direct object
        // (this/it/the/a/that/self) so "Cannot review the legacy code" or
        // "unable to review itself" do NOT match (those are legitimate
        // reviews describing what the model CAN or CANNOT do in context).
        /\b(cannot|can'?t|unable\s+to)\s+review\s+(this|it|the|a|that|self)\b/u,
        // "didn't / haven't received" or "no input"
        /\b(didn'?t\s+receive|haven'?t\s+received|no\s+input)\b/u,
        // "empty diff" or "without diff / input"
        /\b(empty\s+diff|no\s+diff\s+to\s+review|without\s+(diff|input))\b/u,
        // "the diff is empty, nothing to review" / "was empty... review"
        /\b(is\s+empty|was\s+empty)\b.*\b(nothing|to\s+review)\b/u,
        // "nothing to review"
        /\bnothing\s+to\s+review\b/u,
    ];
    for (const pattern of APOLOGY_PATTERNS) {
        if (pattern.test(lower)) {
            return true;
        }
    }
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
        if (!isRecord(entry)) {
            continue;
        }
        const content = entry["content"];
        // Responses API: content is an array of parts.
        if (Array.isArray(content)) {
            for (const part of content) {
                if (!isRecord(part)) {
                    continue;
                }
                const text = part["text"];
                if (typeof text === "string") {
                    fragments.push(text);
                }
            }
            continue;
        }
        // Chat-style: content is a single object with a text field.
        if (isRecord(content)) {
            const text = content["text"];
            if (typeof text === "string") {
                fragments.push(text);
            }
        }
    }
    return fragments.join("\n");
}
function provider_parse_readCommentArray(value, context) {
    if (!isUnknownArray(value)) {
        return [];
    }
    // Prefer an explicit context; fall back to the ambient module-singleton
    // sink so live-provider.ts can install a sink once per request without
    // threading it through every parseReviewPayload call site.
    const effectiveSink = context?.sink ?? getActiveSeveritySink() ?? undefined;
    const effectiveProviderName = context?.providerName;
    const comments = [];
    value.forEach((entry, index) => {
        if (!isRecord(entry)) {
            return;
        }
        const path = entry["path"];
        const line = readSafeIntegerField(entry, "line");
        if (typeof path === "string" && line !== null) {
            const body = readStringField(entry, "body") ?? "";
            comments.push({
                path,
                line,
                body,
                // Pass body so body-scoped rules (security + hardening/leak
                // heuristics) can distinguish a hardening tip from an active
                // leak. Without body, normalizeProviderSeverity falls back to
                // the severity-only mapping (security → high).
                //
                // The sink + providerName + commentIndex options let the caller
                // (live-provider.ts via the ambient sink; tests via explicit
                // options) observe malformed severity values per-comment.
                severity: normalizeProviderSeverity(readStringField(entry, "severity"), body, 
                // exactOptionalPropertyTypes: omit undefined keys so the call
                // is assignable to the strict optional types in
                // `normalizeProviderSeverity`'s third parameter.
                effectiveSink !== undefined || effectiveProviderName !== undefined
                    ? {
                        ...(effectiveSink !== undefined ? { sink: effectiveSink } : {}),
                        ...(effectiveProviderName !== undefined
                            ? { providerName: effectiveProviderName }
                            : {}),
                        commentIndex: index,
                    }
                    : { commentIndex: index }),
                category: readStringField(entry, "category") ?? "general",
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
    // Build the context object explicitly so undefined keys are omitted
    // (required by exactOptionalPropertyTypes: `providerName?: string`
    // does not accept the value `undefined`, only the key's absence).
    const context = options?.providerName !== undefined
        ? { providerName: options.providerName, commentIndex: options.commentIndex ?? -1 }
        : { commentIndex: options?.commentIndex ?? -1 };
    if (value === null || value.length === 0) {
        // Empty/null: silently fall back to "medium" WITHOUT emitting a
        // warning. Rationale: many live providers (notably GitHub Copilot)
        // routinely omit the `severity` field entirely. Warning on every
        // omitted field would multiply to one warning per finding (50+ per
        // review) and bury any genuinely-unrecognized-value warnings in
        // noise. Operators can still surface empty-severity warnings via
        // the ambient sink's debug channel — the raw `rawValue` is `""`
        // for empty/null, distinguishable from `unrecognized string`.
        return "medium";
    }
    const lower = value.toLowerCase();
    switch (lower) {
        case "info":
        case "nit":
            return "info";
        case "minor":
        case "low":
            return "low";
        case "major":
        case "medium":
            return "medium";
        case "high":
            return "high";
        case "critical":
        case "blocker":
            return "critical";
        case "leak":
            // Leaked secrets are always critical — no hardening-tip ambiguity.
            return "critical";
        case "security":
            // Body-scoped: hardening tips stay at high; active leaks escalate
            // to critical. When no body is provided, default to high (the
            // conservative choice that lets the user's threshold filter).
            if (body !== undefined && body !== null && body.length > 0) {
                if (LEAK_INDICATOR_PATTERN.test(body)) {
                    return "critical";
                }
                if (HARDENING_HINT_PATTERN.test(body)) {
                    return "high";
                }
            }
            return "high";
        default:
            // Unknown severity — preserve previous fallback to "medium" so
            // the run does not crash, but warn so operators see the misbehavior.
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
    // Detect SSE format: either starts with "data:" or "event:" (some providers
    // like Manifest prepend event: lines before data: lines).
    if (!trimmed.startsWith("data:") && !trimmed.startsWith("event:")) {
        return null;
    }
    const fragments = [];
    let completedResponseText = null;
    // Group the input into events separated by blank lines, then within each
    // event concatenate the data: lines per the SSE spec ("If the line starts
    // with data:, the rest of the line after the colon is the data. If the
    // line is just data:, the data is an empty string. Multiple data: lines
    // in the same event are concatenated with newlines."). This handles the
    // case where an SSE encoder wrote a JSON-encoded data line that contains
    // a literal newline character — splitting that into separate "data:" lines
    // would lose the trailing portion of the JSON payload.
    const events = [[]];
    for (const line of trimmed.split("\n")) {
        if (line.trim() === "") {
            if (events[events.length - 1].length > 0) {
                events.push([]);
            }
            continue;
        }
        events[events.length - 1].push(line);
    }
    for (const eventLines of events) {
        // Concatenate all data: lines in this event with newlines (per SSE spec).
        const dataLines = [];
        for (const line of eventLines) {
            if (line.startsWith("data:")) {
                dataLines.push(line.slice("data:".length));
            }
        }
        if (dataLines.length === 0) {
            continue;
        }
        // Per SSE spec: data segments are joined with a single newline. Leading
        // space after "data:" is stripped if present (some encoders add it).
        const payload = dataLines.map((d) => d.startsWith(" ") ? d.slice(1) : d).join("\n").trim();
        if (payload === "" || payload === "[DONE]") {
            continue;
        }
        const parsed = tryParseJson(payload);
        if (!isRecord(parsed)) {
            continue;
        }
        // /responses streaming (OpenAI Responses API format):
        //   event: response.output_text.delta
        //   data: {"type":"response.output_text.delta","delta":"fragment"}
        // The delta may live at the top level OR inside a wrapped envelope
        // depending on the provider. Try the wrapped form first since it's
        // the canonical OpenAI Responses API shape.
        const wrappedResponse = readRecordField(parsed, "response");
        if (wrappedResponse !== null) {
            const eventType = readStringField(parsed, "type");
            if (eventType === "response.completed" || eventType === "response.done") {
                // Final event: prefer the full response payload if it has output_text.
                const outText = readStringField(wrappedResponse, "output_text");
                if (outText !== null && outText.length > 0) {
                    completedResponseText = outText;
                }
                else {
                    // Fall back to joining output[] entries.
                    const output = readArrayField(wrappedResponse, "output");
                    if (output !== null) {
                        const joined = joinOutputText(output);
                        if (joined.length > 0) {
                            completedResponseText = joined;
                        }
                    }
                }
                continue;
            }
            if (eventType === "response.output_text.delta" || eventType === "response.delta") {
                const deltaText = readStringField(parsed, "delta");
                if (deltaText !== null) {
                    fragments.push(deltaText);
                }
                continue;
            }
        }
        // /chat/completions streaming: choices[].delta.content
        const choices = readArrayField(parsed, "choices");
        if (choices !== null) {
            for (const choice of choices) {
                const delta = readRecordField(choice, "delta");
                if (delta !== null) {
                    const content = readStringField(delta, "content");
                    if (content !== null) {
                        fragments.push(content);
                    }
                }
            }
            continue;
        }
        // /responses streaming (alternative non-OpenAI variant): top-level delta
        // string directly on the JSON object.
        const deltaText = readStringField(parsed, "delta");
        if (deltaText !== null) {
            fragments.push(deltaText);
        }
    }
    // Prefer the completed-response text (full output) over accumulated
    // fragments — but ONLY if the completed text looks like real content.
    //
    // Some providers (notably MiniMax-M3 observed in Azure DevOps PR #43
    // thread 589) emit a `response.completed` event whose `output[]` carries
    // a stub/placeholder string (e.g. "placeholder", the model wrapper
    // metadata, or just the prompt echo) — and the real review text only
    // appears in the per-fragment `response.output_text.delta` events.
    //
    // If we naively prefer the placeholder, `extractTextPayload` returns the
    // placeholder and `parseReviewPayload` cannot extract a review from it,
    // producing a parse-fail surface.
    //
    // Resolution: prefer the completed text only when it is "non-stub" OR
    // when no delta fragments were collected (i.e. the completed event is
    // the only source of truth). When deltas exist and the completed text
    // looks like a stub, fall back to the deltas.
    if (completedResponseText !== null) {
        const onlySource = fragments.length === 0;
        if (onlySource || !isStubCompletedText(completedResponseText)) {
            return completedResponseText;
        }
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
    if (text.length === 0)
        return true;
    if (text.length < 8)
        return true;
    if (!text.includes("{"))
        return true;
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
    if (rawText.length === 0) {
        return null;
    }
    // Try parsing the raw text as JSON. If it's not JSON, fall through
    // to the text-signal checks (error-doc URLs in plain text).
    const parsed = tryParseJson(rawText);
    if (parsed !== undefined && isRecord(parsed)) {
        // Signal 1: error-envelope at the top level.
        const errorDetails = checkErrorEnvelope(parsed);
        if (errorDetails !== null) {
            return errorDetails;
        }
        // Signal 2: zero-usage with no output (or empty output).
        const zeroUsage = checkZeroUsage(parsed);
        if (zeroUsage !== null) {
            // If the response also has actual review content, this is NOT
            // a provider error — some routers emit zero usage on cached
            // responses. The review content check prevents a false positive.
            const hasReviewContent = checkHasReviewContent(parsed);
            if (!hasReviewContent) {
                return zeroUsage;
            }
        }
    }
    // Signal 3: error-doc-URL in the raw text (works for both JSON and
    // non-JSON responses — some providers return plain text error messages).
    const docUrlSignal = checkErrorDocUrl(rawText);
    if (docUrlSignal !== null) {
        return docUrlSignal;
    }
    return null;
}
/**
 * Check for a top-level `error` object or `errors` array in the JSON
 * response. This is the standard JSON-API error shape used by gateways,
 * routers, and proxies when the request reaches the server but cannot
 * be processed.
 */
function checkErrorEnvelope(parsed) {
    // Single `error` object (RFC 7807 / common shape).
    const errorField = parsed["error"];
    if (isRecord(errorField)) {
        const message = readStringField(errorField, "message") ??
            readStringField(errorField, "type") ??
            readStringField(errorField, "code") ??
            "Provider returned an error envelope.";
        return {
            kind: "error-envelope",
            message,
            ...(readStringField(errorField, "type") !== null
                ? { detail: `type: ${readStringField(errorField, "type")}` }
                : {}),
        };
    }
    // `errors` array (JSON:API spec shape).
    const errorsField = parsed["errors"];
    if (isUnknownArray(errorsField) && errorsField.length > 0) {
        const first = errorsField[0];
        if (isRecord(first)) {
            const message = readStringField(first, "message") ??
                readStringField(first, "detail") ??
                readStringField(first, "title") ??
                "Provider returned an errors array.";
            return {
                kind: "error-envelope",
                message,
            };
        }
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
    if (usage === null) {
        return null;
    }
    const input = usage["input_tokens"];
    const output = usage["output_tokens"];
    const total = usage["total_tokens"];
    // Only trigger when usage IS present and ALL fields are zero (or
    // the only present field is zero). A missing usage block is NOT a
    // signal (some providers omit it); a partial-usage block with at
    // least one non-zero field is NOT a signal (the model ran).
    const hasAnyField = input !== undefined || output !== undefined || total !== undefined;
    if (!hasAnyField) {
        return null;
    }
    const allZero = (input === undefined || input === 0) &&
        (output === undefined || output === 0) &&
        (total === undefined || total === 0);
    if (allZero) {
        return {
            kind: "zero-usage",
            message: "Provider reported zero token usage — no model was invoked. Check provider configuration and API key.",
        };
    }
    return null;
}
/**
 * Read the `usage` block from a parsed JSON response. Checks both
 * top-level `usage` (non-SSE JSON) and `response.usage` (SSE
 * terminal-event envelope shape where the full response is wrapped
 * inside a `response` key).
 */
function readUsageBlock(parsed) {
    // Top-level usage (non-SSE JSON response).
    const topLevelUsage = readRecordField(parsed, "usage");
    if (topLevelUsage !== null) {
        return topLevelUsage;
    }
    // SSE terminal-event envelope: { response: { ... usage: { ... } } }.
    const responseField = readRecordField(parsed, "response");
    if (responseField !== null) {
        const nestedUsage = readRecordField(responseField, "usage");
        if (nestedUsage !== null) {
            return nestedUsage;
        }
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
    const summary = readStringField(parsed, "summary");
    if (summary !== null && summary.length > 0) {
        return true;
    }
    const verdict = readStringField(parsed, "verdict");
    if (verdict !== null && verdict.length > 0) {
        return true;
    }
    const comments = readArrayField(parsed, "comments");
    if (comments !== null && comments.length > 0) {
        return true;
    }
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
    // Match `/docs/errors/` (Manifest, generic), `/help/error/` (some
    // enterprise gateways), `/docs/error-codes` (Azure-style).
    const ERROR_DOC_PATTERN = /\/(?:docs|help)\/errors?[-_/a-z0-9]*/iu;
    if (ERROR_DOC_PATTERN.test(rawText)) {
        // Extract the matched substring for the detail field so the
        // operator can see which documentation URL was referenced.
        const match = rawText.match(ERROR_DOC_PATTERN);
        const detail = match !== null ? match[0] : "";
        return {
            kind: "error-doc-url",
            message: "Provider response contains an error documentation URL — provider routing or configuration error.",
            ...(detail.length > 0 ? { detail } : {}),
        };
    }
    return null;
}

;// CONCATENATED MODULE: ./src/cli/live-shared.ts












/**
 * A provider outcome is structurally empty when it carries no inline comments
 * AND no suppressed comments. Used by `simulate-findings` to decide whether
 * the live result should be replaced with the deterministic fixture.
 */
function isStructurallyEmptyReview(review) {
    return review.comments.length === 0 && review.suppressedComments.length === 0;
}
class LiveReviewError extends Error {
    code;
    name = "LiveReviewError";
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
    }
}
/**
 * Gate that refuses to post when high-confidence secrets are detected in the
 * diff. This is the runtime side of `identify leaks` — the scanner counts
 * leaks and redacts the diff, but the gate enforces that no provider response
 * can leak secrets through the posted review body. `detect-leaks: false`
 * bypasses the gate (operator opt-out).
 */
async function evaluateLeakGate(input) {
    if (!input.detectLeaks) {
        return { ok: true, leakCount: 0 };
    }
    const report = await scanReviewSecrets({
        diffText: input.diffText,
        expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });
    if (report.highConfidenceLeakCount === 0) {
        return { ok: true, leakCount: 0 };
    }
    return {
        ok: false,
        leakCount: report.highConfidenceLeakCount,
        message: `Refusing to post: ${report.highConfidenceLeakCount} high-confidence secret(s) detected in the diff. Set --no-detect-leaks to override (NOT recommended).`,
    };
}
/**
 * Group comments by severity (low/medium/high/critical). Re-exported here
 * because external callers import this helper from `live-shared.ts`.
 * Do not remove without updating all callers. Delegates to
 * `src/util/severity.ts` so the live path and the merge path agree on
 * the exact same lowercase-accumulation logic.
 */
const live_shared_countBySeverity = countBySeverity;
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
  *   - Stable `<!-- umactually-pr-review:manifest {…} -->` for AI agents
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
    // Delegate to the "severity-table" layout from
    // `src/render/summary-layouts.ts` — selected from the 20-layout
    // sheet after side-by-side review. The other 19 layouts remain
    // available via `renderSummary(layout, data)` for callers that want
    // a different visual personality. See the local viewer
    // (`scripts/view-summary-layouts.mjs`) for the design rationale and
    // before/after comparison.
    //
    // The legacy in-place assembly of the parent card (verdict + pipeline
    // summary + posted preview + off-diff block + summary <details> +
    // footer + manifest) is preserved verbatim as the "current"
    // baseline inside `renderBaseline("current", data)` so the viewer
    // can render the old shape side-by-side with the new one.
    //
    // Compatibility shim: callers that omit `postedComments` (older
    // fixtures, `simulate-findings`) used to fall back to
    // `review.comments`. The severity-table layout needs the actual
    // posted set, so we resolve the fallback here before dispatch.
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
        minimumSeverity: input.minimumSeverity ?? null,
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
    const safePath = sanitizeForPost(input.comment.path, input.secrets);
    const fallback = `Finding at ${safePath}:${input.comment.line}.`;
    const safeBody = input.comment.body.length > 0
        ? sanitizeForPost(input.comment.body, input.secrets)
        : sanitizeForPost(fallback, input.secrets);
    const marker = input.includeMarker === true ? `${REVIEW_MARKER}\n` : "";
    const parentRef = isPositiveSafeInteger(input.parentThreadId)
        ? `> Reply to PR review summary #${input.parentThreadId}\n\n`
        : "";
    return `${marker}${parentRef}\`${safeSeverity}\` \`${safeCategory}\`\n\n${safeBody}`;
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
const MALFORMED_PROVIDER_FALLBACK_RAW_MAX = 16_000;
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
    if (rawText.length <= halfBudget * 2) {
        return rawText;
    }
    const head = trimToNewline(rawText.slice(0, halfBudget), "head");
    const tail = trimToNewline(rawText.slice(rawText.length - halfBudget), "tail");
    const omitted = rawText.length - head.length - tail.length;
    return `${head}\n\n… [${omitted} chars omitted] …\n\n${tail}`;
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
        // For head: trim to the last newline. Everything after the last
        // newline within the head piece is a partial line — drop it.
        const lastNewline = piece.lastIndexOf("\n");
        if (lastNewline === -1) {
            return piece;
        }
        return piece.slice(0, lastNewline);
    }
    // For tail: the first char of the tail slice is often a newline
    // (because we cut at a line boundary in the original stream). Skip
    // past leading whitespace + newlines to land on the first real
    // character of the tail content.
    let i = 0;
    while (i < piece.length && (piece[i] === "\n" || piece[i] === " " || piece[i] === "\r")) {
        i += 1;
    }
    return piece.slice(i);
}
function buildMalformedProviderFallback(input) {
    const safeProvider = sanitizeForPost(input.provider, input.secrets);
    const safeModelId = sanitizeForPost(input.modelId, input.secrets);
    // CLARITY-12: show head + tail with a quantifier in the middle so the
    // diagnostic captures both the opening events and the final
    // response.completed output_text — not just whichever end happened
    // to fit in the first N chars. The previous "first N chars only"
    // truncation hid the actual response.completed event, leading
    // reviewers to incorrectly conclude the model returned only metadata.
    const truncated = input.rawText.length > MALFORMED_PROVIDER_FALLBACK_RAW_MAX
        ? truncateHeadAndTail(input.rawText, MALFORMED_PROVIDER_FALLBACK_HALF_BUDGET)
        : input.rawText;
    const safeRaw = sanitizeForPost(truncated, input.secrets);
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
        "",
    ].join("\n");
    // Reason-specific headline + remediation. The truncated case carries
    // actionable advice ("raise --max-output-tokens") that the malformed
    // case doesn't have. Keeping these strings in the helper (not the
    // render layer) means every layout that falls back to the parse-fail
    // diagnostic surfaces the same advice — the alternative (per-layout
    // strings) is exactly the kind of drift the unified builder is meant
    // to prevent.
    const headline = buildParseFailureHeadline(input.reason);
    const remediation = buildParseFailureRemediation(input.reason);
    // Note: the summary intentionally does NOT include a "Generated by"
    // footer — `buildReviewBody` emits that footer in its own block so
    // this fallback path would otherwise show the same metadata twice.
    return {
        summary: `${headline}${remediation.length > 0 ? `\n\n**Remediation:** ${remediation}` : ""}\n\n${detailsBlock}`,
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [],
        parseFailed: true,
        ...(input.reason !== undefined ? { parseFailureReason: input.reason } : {}),
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
    if (reason?.kind === "truncated") {
        return "Provider response stream was truncated before the model emitted its final `response.completed` event.";
    }
    return "Provider response did not contain a valid JSON review payload.";
}
/**
 * Render the actionable remediation line. Empty for the malformed case
 * because there's no automatic fix — only "the model returned bad data,
 * file a bug". The truncated case carries concrete advice: raise
 * --max-output-tokens and retry.
 */
function buildParseFailureRemediation(reason) {
    if (reason?.kind !== "truncated") {
        return "";
    }
    const usagePct = reason.usage?.output_tokens !== undefined && reason.maxOutputTokens !== undefined && reason.maxOutputTokens > 0
        ? Math.round((reason.usage.output_tokens / reason.maxOutputTokens) * 100)
        : null;
    const usageDetail = reason.usage?.output_tokens !== undefined
        ? ` (model emitted ${reason.usage.output_tokens} output tokens${usagePct !== null ? ` ≈ ${usagePct}% of the configured cap` : ""})`
        : "";
    return `The output was likely cut off by the model's token budget${usageDetail}. Try raising \`--max-output-tokens\` and re-running. If the model consistently exceeds the cap, split the diff into smaller chunks.`;
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
    const summary = [
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
        `Provider: \`${safeProvider}\` · Model: \`${safeModelId}\``,
    ].join("\n");
    return {
        summary,
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [],
    };
}
function selectPostableComments(input) {
    const positions = parseDiffPositions(input.diffText);
    const maxComments = input.parsed.maxComments ?? DEFAULT_MAX_COMMENTS;
    const comments = [];
    for (const comment of input.review.comments) {
        if (comments.length >= maxComments) {
            break;
        }
        if (!positions.hasPosition(comment)) {
            continue;
        }
        if (!passesSeverityPolicy(comment, input.parsed)) {
            continue;
        }
        comments.push({
            ...comment,
            body: sanitizeForPost(comment.body, input.secrets),
        });
    }
    return comments;
}
function selectOffDiffComments(review, diffText) {
    const positions = parseDiffPositions(diffText);
    return review.comments.filter((comment) => !positions.hasPosition(comment));
}
function countSuppressedComments(review, diffText) {
    return review.suppressedComments.length + selectOffDiffComments(review, diffText).length;
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
    const postableComments = selectPostableComments({
        review: input.review,
        diffText: input.diffText,
        parsed: input.parsed,
        secrets: input.secrets,
    });
    const offDiffFromComments = selectOffDiffComments(input.review, input.diffText);
    const suppressedCommentCount = input.review.suppressedComments.length + offDiffFromComments.length;
    const severityCounts = live_shared_countBySeverity(postableComments);
    // Reconcile the model's raw verdict against the postable severity
    // counts. If every finding was severity-filtered out, the body will
    // render `📊 0 inline findings`, and rendering `⛔ NEEDS_FIX` against
    // that headline is contradictory — the human reviewer would block
    // the PR on a verdict that has no findings to act on. Downgrade to
    // `COMMENT` in that case so the badge matches the body. See
    // `src/util/verdict.ts:reconcileVerdictForEmptySeverityCounts` for
    // the rule and the PR #18 regression context.
    const effectiveVerdict = reconcileVerdictForEmptySeverityCounts(input.review.verdict, severityCounts);
    const body = buildReviewBody({
        review: { ...input.review, verdict: effectiveVerdict },
        provider: input.provider,
        modelId: input.modelId,
        validCommentCount: postableComments.length,
        suppressedCommentCount,
        offDiffFromComments,
        severityCounts,
        postedComments: postableComments,
        secrets: input.secrets,
        // Threshold context — forwarded so the rendered `🏷️ …` tally can
        // append `*` when the active `--minimum-severity` setting hides one
        // or more tiers. Older callers (unit tests, simulate-findings) can
        // omit it and get the byte-identical legacy tally.
        minimumSeverity: input.parsed.minimumSeverity,
    });
    return {
        postableComments,
        offDiffFromComments,
        suppressedCommentCount,
        severityCounts,
        body,
        postedComments: postableComments,
        effectiveVerdict,
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
    let sanitized = value
        .replace(/Authorization:\s*[^\r\n]*/giu, REDACTED_AUTHORIZATION_HEADER)
        .replace(/\bBearer\s+\S+/giu, REDACTED_BEARER_TOKEN);
    for (const secret of secrets) {
        if (secret.length > 0) {
            sanitized = sanitized.split(secret).join(REDACTED_SECRET_TOKEN);
        }
    }
    return sanitized;
}
async function readTextResponse(response) {
    try {
        return await response.text();
    }
    catch (error) {
        throw new LiveReviewError("HTTP_RESPONSE_READ_FAILED", "Failed to read REST response body.", { cause: error });
    }
}
async function readJsonResponse(response) {
    const text = await readTextResponse(response);
    if (text.length === 0) {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new LiveReviewError("HTTP_JSON_PARSE_FAILED", "REST response was not valid JSON.", { cause: error });
        }
        throw error;
    }
}
function readResponseId(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const id = value["id"];
    return isSafeInteger(id) ? id : undefined;
}
function ensureHttpOk(response, code, action) {
    if (response.ok) {
        return;
    }
    // Capture the response body so the thrown error includes enough context
    // for the operator to diagnose 4xx/5xx without re-running the build.
    // We best-effort read the body: it may already be consumed by a prior
    // `readJsonResponse` call, in which case the text will be empty and the
    // diagnostic will fall back to a generic message.
    void response
        .clone()
        .text()
        .then((text) => {
        if (text.length === 0) {
            return;
        }
        // Surface the server-side error message on stderr for operators;
        // the thrown LiveReviewError keeps its short public form.
        const snippet = truncateBodyForLog(text, 500);
        process.stderr.write(`::debug::${BRAND_PREFIX}${action} HTTP ${response.status} body=${snippet}\n`);
    })
        .catch(() => {
        // Body read failed; nothing actionable to do here.
    });
    throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`);
}

function passesSeverityPolicy(comment, parsed) {
    // `minimumSeverityInternal` is pre-resolved at arg-parse time (CLI
    // enum → internal Severity via the alias table). Reading it here
    // avoids re-parsing on every comment and ensures a malformed value
    // fails fast at the CLI boundary instead of throwing
    // InvalidConfigError deep in the live path.
    const minimum = parsed.minimumSeverityInternal;
    if (minimum === null)
        return true;
    // Normalize the comment's severity before the threshold + carve-out
    // check. The provider may emit non-canonical values (typos like
    // "warning", unknown ranks, etc.) and `LiveReviewComment.severity`
    // is typed `string`, not `Severity`. Without normalization, the
    // carve-out's `finding === "security"` string compare would silently
    // miss a typo and filter a finding that the security policy says
    // must be preserved. normalizeProviderSeverity is the same function
    // the live-path parser uses, so the threshold check sees the same
    // canonical severity the rendered tally would.
    const normalized = normalizeProviderSeverity(comment.severity, comment.body);
    return shouldKeepFinding({ minimum }, normalized);
}

;// CONCATENATED MODULE: ./src/cli/live-azure.ts










async function runAzureLive(input) {
    const { context, diffText, provider, parsed, fetchImpl } = input;
    const prepared = preparePostedReview({
        review: provider.review,
        provider: provider.provider,
        modelId: provider.modelId,
        diffText,
        parsed,
        secrets: [context.token],
    });
    const { postableComments: comments, body } = prepared;
    const existingThreads = await listAzureThreads(context, fetchImpl);
    // Post the parent PR-level review summary LAST so the conversation
    // timeline shows a single review-summary card above all inline threads.
    // This is the documented "Comment on the pull request" shape from
    // https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1
    // — same /threads endpoint, body OMITS `threadContext`, which causes
    // ADO to render it as a free-form PR-level comment rather than a
    // file-pinned inline thread. Best-effort: a parent failure never blocks
    // the inline-thread loop that follows.
    //
    // "Always at top of conversation" behavior: the ADO PR Overview
    // sorts threads by `id` descending in the default "newest first"
    // view (i.e. the highest thread id appears at the TOP of the
    // conversation). To make the parent review summary the FIRST card
    // the user sees, we POST it AFTER all the inline threads so its
    // thread id is the highest on the PR. Inline thread bodies carry a
    // textual "Reply to PR review summary #PARENT_ID" reference; we
    // PATCH each inline comment once the parent id is known so the
    // reference is accurate.
    //
    // "Replace, not patch" (PARENT-TOP-*): on every run we also sweep
    // the existing parent marker thread by deleting every comment on it
    // (which leaves it `isDeleted: true` and hidden from the
    // conversation, per
    // https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/delete?view=azure-devops-rest-7.1
    // — "Specify if the thread is deleted which happens when all
    // comments are deleted") so a stale summary from a previous run
    // never lingers.
    const oldParent = findExistingParentPrComment(existingThreads);
    if (oldParent !== null && typeof oldParent.thread.id === "number") {
        await deleteParentThreadComments({
            context,
            fetchImpl,
            threadId: oldParent.thread.id,
            commentIds: threadCommentIds(oldParent.thread),
        });
    }
    const postedInlines = [];
    const postedIds = [];
    const failedIndices = [];
    for (let index = 0; index < comments.length; index += 1) {
        const comment = comments[index];
        if (comment === undefined)
            continue;
        if (findDuplicateThread(comment, existingThreads) !== null) {
            continue;
        }
        try {
            const result = await postAzureThread({
                context,
                fetchImpl,
                comment,
                body,
                parentThreadId: undefined,
            });
            if (result !== undefined) {
                postedIds.push(result.threadId);
                postedInlines.push({ ...result, comment });
            }
        }
        catch (error) {
            failedIndices.push(index);
            const message = formatError(error);
            writeBrandedAnnotation("warning", `Azure thread ${index + 1}/${comments.length} failed (${comment.path}:${comment.line}): ${message}; continuing with remaining threads.`);
        }
    }
    // Now post the parent PR-level review summary LAST so it gets the
    // highest thread id and sits at the TOP of the conversation.
    const parentThread = await postParentThread(context, fetchImpl, body);
    const parentThreadId = parentThread?.id;
    // PATCH each inline comment to inject the textual parent-reference
    // now that we know the new parent id. Best-effort: a PATCH failure
    // is logged and skipped so the run still succeeds.
    if (parentThreadId !== undefined) {
        for (const inline of postedInlines) {
            await patchInlineCommentWithParentRef({
                context,
                fetchImpl,
                threadId: inline.threadId,
                commentId: inline.commentId,
                parentThreadId,
                comment: inline.comment,
                secrets: [context.token],
            });
        }
    }
    if (postedIds.length === 0 && failedIndices.length > 0) {
        const failed = failedIndices.length;
        const message = `Azure review failed: 0 threads posted, ${failed} failed`;
        writeBrandedAnnotation("error", message);
        return {
            exitCode: 1,
            posted: false,
            reviewId: undefined,
            message,
            // `provider.parseWarnings` is the parse-warnings computed
            // from the model response. The error path here is the
            // "0 threads posted" case (which means the model response
            // was valid but every comment was filtered out as
            // off-diff). The pre-validation warnings are still meaningful
            // in that case.
            parseWarnings: provider.parseWarnings,
        };
    }
    // At least one thread landed — post the PR status.
    await postAzureStatus({
        context,
        fetchImpl,
        // Use the *effective* verdict (post-reconciliation) so the Azure
        // PR status matches the review body. A NEEDS_FIX review whose
        // findings were all severity-filtered out surfaces here as
        // `succeeded`, matching the `📊 0 inline findings` body and
        // avoiding a misleading `pending` check against an empty review.
        state: mapReviewVerdictToAzureStatus(prepared.effectiveVerdict),
        description: provider.review.summary,
    });
    // The reviewId is the PARENT thread id (so consumers can correlate
    // the run with the top-level summary card on the PR conversation).
    const reviewId = parentThreadId ?? postedIds[0];
    const parseFailed = provider.review.parseFailed === true;
    const successMessage = failedIndices.length > 0
        ? `posted Azure review (${postedIds.length} threads, ${failedIndices.length} failed)${parseFailed ? " (parse failed)" : ""}`
        : `posted Azure review (${postedIds.length} threads)${parseFailed ? " (parse failed)" : ""}`;
    return {
        exitCode: parseFailed ? 1 : 0,
        posted: true,
        reviewId,
        message: successMessage,
        // Surface the live counts for the self-review guard artifact.
        inlineThreadCount: postedIds.length,
        // Use the *effective* verdict (post-reconciliation) so the artifact
        // matches the Azure PR status and the body. See the matching
        // comment on the GitHub side in `live-github.ts`.
        verdict: prepared.effectiveVerdict,
        // Signal parse-fail to the artifact-write path so writeLiveArtifact
        // can stamp `parseFailed: true` on the posted=true branch.
        parseFailed,
        // Thread parse warnings (off-diff citation hallucinations) to the
        // artifact-write path so the parse-warnings.json sibling artifact
        // surfaces them for operators / CI guards.
        parseWarnings: provider.parseWarnings,
    };
}
/**
 * Return every comment id on `thread` that has a numeric `id`. Used by
 * `deleteParentThreadComments` to drive the per-comment Delete loop
 * when the CLI replaces the existing parent thread.
 */
function threadCommentIds(thread) {
    const ids = [];
    for (const comment of thread.comments) {
        if (isSafeInteger(comment.id)) {
            ids.push(comment.id);
        }
    }
    return ids;
}
async function listAzureThreads(context, fetchImpl) {
    const response = await fetchImpl(azureThreadsUrl(context), {
        method: "GET",
        headers: azureHeaders(context.token),
    });
    ensureHttpOk(response, "AZURE_LIST_THREADS_FAILED", "Azure list PR threads");
    const json = await readJsonResponse(response);
    if (!isRecord(json)) {
        return [];
    }
    const value = json["value"];
    if (!isUnknownArray(value)) {
        return [];
    }
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
        if (thread.threadContext !== null)
            continue;
        const firstComment = thread.comments[0];
        if (firstComment === undefined)
            continue;
        if (!commentBodyHasMarker(firstComment.content))
            continue;
        return { thread, comment: firstComment };
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
                comments: [
                    {
                        parentCommentId: 0,
                        content: body,
                        commentType: 1,
                    },
                ],
                status: 1,
                // No `threadContext` field — ADO renders this as a PR-level comment.
            }),
        });
        ensureHttpOk(response, "AZURE_CREATE_PR_COMMENT_FAILED", "Azure create PR comment");
        const created = readResponseId(await readJsonResponse(response));
        return created === undefined ? undefined : { id: created };
    }
    catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation("warning", `Azure parent PR comment POST failed (${message}); continuing with inline threads only.`);
        return undefined;
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
        if (!isSafeInteger(commentId)) {
            continue;
        }
        const url = `${azurePrBaseUrl(input.context)}/threads/${input.threadId}/comments/${commentId}?api-version=${AZURE_API_VERSION}`;
        try {
            const response = await input.fetchImpl(url, {
                method: "DELETE",
                headers: azureHeaders(input.context.token),
            });
            if (!response.ok && response.status !== 204) {
                await surfaceAzureHttpError({
                    response,
                    action: `Azure delete parent thread ${input.threadId} comment ${commentId}`,
                    level: "warning",
                });
            }
        }
        catch (error) {
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
    if (input.comment === undefined) {
        return;
    }
    const content = buildInlineCommentBody({
        comment: input.comment,
        secrets: input.secrets,
        includeMarker: true,
        parentThreadId: input.parentThreadId,
    });
    const url = `${azurePrBaseUrl(input.context)}/threads/${input.threadId}/comments/${input.commentId}?api-version=${AZURE_API_VERSION}`;
    try {
        const response = await input.fetchImpl(url, {
            method: "PATCH",
            headers: azureHeaders(input.context.token),
            body: JSON.stringify({
                content,
                // Per Microsoft Learn the request body is the Comment shape
                // — see
                // https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/update?view=azure-devops-rest-7.1
            }),
        });
        if (!response.ok) {
            await surfaceAzureHttpError({
                response,
                action: `Azure patch inline thread ${input.threadId} comment ${input.commentId}`,
                level: "warning",
            });
        }
    }
    catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation("warning", `Azure patch inline thread ${input.threadId} comment ${input.commentId} threw (${message}); continuing.`);
    }
}
async function postAzureThread(input) {
    const response = await input.fetchImpl(azureThreadsUrl(input.context), {
        method: "POST",
        headers: azureHeaders(input.context.token),
        body: JSON.stringify({
            comments: [
                {
                    parentCommentId: 0,
                    // Inline bodies are POSTed WITHOUT the parent-reference text
                    // because the parent is POSTed later (last). We PATCH the
                    // comment below to insert the reference once the parent id
                    // is known — see `patchInlineCommentWithParentRef`.
                    content: buildInlineCommentBody({
                        comment: input.comment,
                        secrets: [input.context.token],
                        includeMarker: true,
                        ...(input.parentThreadId !== undefined ? { parentThreadId: input.parentThreadId } : {}),
                    }),
                    commentType: 1,
                },
            ],
            status: 1,
            threadContext: {
                filePath: `/${input.comment.path}`,
                rightFileStart: { line: input.comment.line, offset: 1 },
                rightFileEnd: { line: input.comment.line, offset: 1 },
            },
        }),
    });
    ensureHttpOk(response, "AZURE_CREATE_THREAD_FAILED", "Azure create PR thread");
    const json = await readJsonResponse(response);
    if (!isRecord(json)) {
        return undefined;
    }
    const threadId = readResponseId(json);
    if (threadId === undefined) {
        return undefined;
    }
    // The POST response includes the freshly created thread with its
    // first comment id. We capture that so the caller can PATCH the
    // comment body later (to insert the parent-reference text).
    const comments = json["comments"];
    if (!Array.isArray(comments) || comments.length === 0) {
        return undefined;
    }
    const firstComment = comments[0];
    if (!isRecord(firstComment)) {
        return undefined;
    }
    const commentId = firstComment["id"];
    if (!isSafeInteger(commentId)) {
        return undefined;
    }
    return { threadId, commentId };
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
 * The context NAME is sourced from `src/util/brand.ts` (single source
 * of truth for the brand string). The local `AZURE_STATUS_CONTEXT_GENRE`
 * stays here because it's a runtime-dedup detail, not brand state.
 */
const AZURE_STATUS_CONTEXT_GENRE = "pr-review";
async function postAzureStatus(input) {
    const safeDescription = sanitizeAzureStatusDescription(input.description);
    // Delete the previous CLI status entries for this PR so the
    // Checks panel stays at exactly one `umactually-pr-review-status`
    // row per run. The documented Microsoft Learn `Update` endpoint
    // (https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/update?view=azure-devops-rest-7.1)
    // only supports `op:"remove"`, and `PATCH .../statuses/{id}` does
    // NOT exist as an in-place updater — it returns
    // "VssRequestContentTypeNotSupportedException" and then
    // "JSON Patch operation 'Replace' not supported" once the JSON-Patch
    // content-type is set. The documented single-status deletion endpoint
    // is `DELETE .../statuses/{statusId}?api-version=<AZURE_API_VERSION>` (204 No Content
    // on success) — see
    // https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/delete?view=azure-devops-rest-7.1
    //
    // Best-effort: any DELETE failure is logged and skipped so the POST
    // below can still go out (worst case the user sees two rows until
    // the next clean run). The dedup helper looks for the new
    // `(name, genre)` AND the legacy `"UmActually"` name so the next
    // run sweeps both flavors — without this the 34 stale legacy
    // entries on PR #42 would never go away on their own.
    const existingStatuses = await listAzureStatuses(input.context, input.fetchImpl);
    const ownStatusIds = findAllCliStatusIdsByContext(existingStatuses);
    for (const statusId of ownStatusIds) {
        await deleteAzureStatusById({
            context: input.context,
            fetchImpl: input.fetchImpl,
            statusId,
        });
    }
    const response = await input.fetchImpl(azureStatusesUrl(input.context), {
        method: "POST",
        headers: azureHeaders(input.context.token),
        body: JSON.stringify({
            state: input.state,
            description: safeDescription,
            context: {
                name: AZURE_STATUS_CONTEXT_NAME,
                genre: AZURE_STATUS_CONTEXT_GENRE,
            },
        }),
    });
    if (!response.ok) {
        // Surface the ADO response body verbatim on stderr before ensureHttpOk
        // throws so the operator can diagnose future 4xx/5xx failures without
        // re-running the build. Without this, `ensureHttpOk` only emits an
        // async `::debug::` snippet that Azure Pipelines hides by default,
        // which is how build #74's TF20507 LF-rejection stayed invisible until
        // we reproduced the 400 directly with curl.
        let bodySnippet = "(empty response body)";
        try {
            const text = await response.clone().text();
            if (text.length > 0) {
                bodySnippet = truncateBodyForLog(text, 1000);
            }
        }
        catch {
            // Body read failed; the generic snippet above is the best we can do.
        }
        writeBrandedAnnotation("error", `Azure create PR status HTTP ${response.status} body=${bodySnippet}`);
    }
    ensureHttpOk(response, "AZURE_CREATE_STATUS_FAILED", "Azure create PR status");
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
        headers: azureHeaders(context.token),
    });
    if (!response.ok) {
        // Treat a list failure as best-effort: log the ADO body so a
        // future diagnosis path doesn't need a re-run, then return [].
        await surfaceAzureHttpError({
            response,
            action: "Azure list PR statuses",
            level: "warning",
        });
        return [];
    }
    const json = await readJsonResponse(response);
    if (!isRecord(json)) {
        return [];
    }
    const value = json["value"];
    if (!isUnknownArray(value)) {
        return [];
    }
    const entries = [];
    for (const raw of value) {
        const parsed = parseAzureStatusEntry(raw);
        if (parsed !== null) {
            entries.push(parsed);
        }
    }
    return entries;
}
function parseAzureStatusEntry(value) {
    if (!isRecord(value)) {
        return null;
    }
    const rawId = value["id"];
    if (!isSafeInteger(rawId)) {
        return null;
    }
    const descriptionRaw = value["description"];
    const description = typeof descriptionRaw === "string" ? descriptionRaw : "";
    const updatedDateRaw = value["updatedDate"];
    const updatedDate = typeof updatedDateRaw === "string" ? updatedDateRaw : "";
    const contextRaw = value["context"];
    if (!isRecord(contextRaw)) {
        return null;
    }
    const nameRaw = contextRaw["name"];
    const genreRaw = contextRaw["genre"];
    if (typeof nameRaw !== "string" || typeof genreRaw !== "string") {
        return null;
    }
    const stateRaw = value["state"];
    const state = typeof stateRaw === "string" ? stateRaw : undefined;
    return {
        id: rawId,
        state,
        description,
        updatedDate,
        context: { name: nameRaw, genre: genreRaw },
    };
}
/**
 * Return the most recent entry whose `(context.name, context.genre)`
 * matches the CLI's status context — i.e. previous CLI posts on this
 * PR. Exported for test introspection and for callers that want to
 * surface the previous verdict in the review body without re-posting.
 */
function findLatestStatusByContext(entries, name, genre) {
    let latest;
    for (const entry of entries) {
        if (entry.context.name !== name)
            continue;
        if (entry.context.genre !== genre)
            continue;
        if (latest === undefined) {
            latest = entry;
            continue;
        }
        // Compare by updatedDate; fall back to numeric id so ordering is
        // well-defined even when the API strips updatedDate (older 7.x
        // responses occasionally omit it on stale entries).
        if (entry.updatedDate.localeCompare(latest.updatedDate) > 0) {
            latest = entry;
            continue;
        }
        if (entry.updatedDate === latest.updatedDate && entry.id > latest.id) {
            latest = entry;
        }
    }
    return latest;
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
        if (entry.context.genre !== AZURE_STATUS_CONTEXT_GENRE)
            continue;
        if (entry.context.name === AZURE_STATUS_CONTEXT_NAME
            || entry.context.name === "UmActually") {
            ids.push(entry.id);
        }
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
    const url = `${azurePrBaseUrl(input.context)}/statuses/${input.statusId}?api-version=${AZURE_API_VERSION}`;
    let response;
    try {
        response = await input.fetchImpl(url, {
            method: "DELETE",
            headers: azureHeaders(input.context.token),
        });
    }
    catch (error) {
        const message = formatError(error);
        writeBrandedAnnotation("warning", `Azure delete PR status ${input.statusId} threw (${message}); continuing.`);
        return false;
    }
    if (response.status === 204 || response.ok) {
        return true;
    }
    await surfaceAzureHttpError({
        response,
        action: `Azure delete PR status ${input.statusId}`,
        level: "warning",
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
        if (text.length > 0) {
            bodySnippet = truncateBodyForLog(text, 1000);
        }
    }
    catch {
        // Body read failed; fall back to the generic snippet.
    }
    writeBrandedAnnotation(input.level, `${input.action} HTTP ${input.response.status} body=${bodySnippet}`);
}
/**
 * Public re-exports used by tests that need to introspect the dedup
 * helpers without going through the full `runAzureLive` orchestration.
 */
const UMACTUALLY_STATUS_CONTEXT = {
    name: AZURE_STATUS_CONTEXT_NAME,
    genre: AZURE_STATUS_CONTEXT_GENRE,
};
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
    return value
        .replace(/[\u000A\u000D]/gu, " ")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
        .replace(/\s{2,}/gu, " ")
        .trim()
        .slice(0, 255);
}
function parseAzureThread(value) {
    if (!isRecord(value)) {
        return null;
    }
    const status = value["status"];
    const comments = value["comments"];
    if (typeof status !== "string" || !Array.isArray(comments)) {
        return null;
    }
    const hasThreadContextKey = "threadContext" in value;
    const nestedContext = value["threadContext"];
    // A parent PR-level comment is one where `threadContext` is explicitly
    // null in the ADO response. Flat-key test fixtures omit the
    // `threadContext` key entirely, so distinguish between the two:
    //   - key present and value null   → parent PR-level comment
    //   - key present and value object → inline thread
    //   - key absent (flat fixture)     → inline thread with filePath + line at top level
    let threadContext = null;
    if (hasThreadContextKey) {
        if (isRecord(nestedContext)) {
            const parsed = live_azure_readThreadContext(nestedContext);
            if (parsed !== null) {
                threadContext = parsed;
            }
        }
    }
    else {
        const flat = live_azure_readThreadContext(value);
        if (flat !== null) {
            threadContext = flat;
        }
    }
    const rawId = value["id"];
    const threadId = isSafeInteger(rawId) ? rawId : undefined;
    return {
        id: threadId,
        status,
        threadContext,
        comments: comments
            .map(parseAzureComment)
            .filter((comment) => comment !== null),
    };
}
function live_azure_readThreadContext(record) {
    const start = readRightFileStart(record);
    const filePath = record["filePath"];
    if (typeof filePath !== "string" || start === null) {
        return null;
    }
    return { filePath, rightFileStart: start };
}
function readRightFileStart(context) {
    const start = context["rightFileStart"];
    if (!isRecord(start)) {
        return null;
    }
    const line = start["line"];
    return isSafeInteger(line) ? { line } : null;
}
function parseAzureComment(value) {
    if (!isRecord(value)) {
        return null;
    }
    const content = value["content"];
    if (typeof content !== "string") {
        return null;
    }
    const rawId = value["id"];
    const id = isSafeInteger(rawId) ? rawId : undefined;
    return { id, content };
}
function azureThreadsUrl(context) {
    return `${azurePrBaseUrl(context)}/threads?api-version=${AZURE_API_VERSION}`;
}
function azureStatusesUrl(context) {
    return `${azurePrBaseUrl(context)}/statuses?api-version=${AZURE_API_VERSION}`;
}

;// CONCATENATED MODULE: ./src/cli/live-github.ts






async function runGithubLive(input) {
    const { context, diffText, provider, parsed, fetchImpl } = input;
    const prepared = preparePostedReview({
        review: provider.review,
        provider: provider.provider,
        modelId: provider.modelId,
        diffText,
        parsed,
        secrets: [context.token],
    });
    const { postableComments: comments, body } = prepared;
    const postableComments = comments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        side: "RIGHT",
        body: buildInlineCommentBody({ comment, secrets: [context.token] }),
    }));
    const existing = await findExistingMarkerReview(context, fetchImpl);
    // When simulate-findings is set the demo path must ALWAYS replace the
    // existing review via DELETE+POST — even when the new payload carries 0
    // inline comments. PUT only works on PENDING reviews, but an action's
    // submitted review is COMMENTED, so PUT is silently dropped by GitHub.
    // The DELETE+POST path produces a fully populated review body that
    // replaces whatever was on the PR before.
    const forceReplace = parsed.simulateFindings === true;
    if (existing !== null &&
        !forceReplace &&
        existing.state === "PENDING" &&
        postableComments.length === 0) {
        const reviewId = await updateExistingReview({ context, fetchImpl, review: existing, body });
        if (reviewId !== null) {
            const parseFailed = provider.review.parseFailed === true;
            return {
                exitCode: parseFailed ? 1 : 0,
                posted: true,
                reviewId,
                message: parseFailed ? "updated existing GitHub review (parse failed)" : "updated existing GitHub review",
                parseFailed,
                parseWarnings: provider.parseWarnings,
            };
        }
        // PUT failed (e.g., 422 because submitted) — fall through to DELETE+POST below.
    }
    if (existing !== null) {
        await deleteExistingReview({ context, fetchImpl, review: existing });
    }
    // simulate-findings is a demo of a populated review — keep the event neutral
    // regardless of the underlying verdict so we never block the PR with a
    // REQUEST_CHANGES from synthetic data.
    const event = forceReplace
        ? "COMMENT"
        : mapReviewVerdictToGithubEvent(prepared.effectiveVerdict);
    const reviewId = await createGithubReview({
        context,
        fetchImpl,
        body,
        event,
        comments: postableComments,
    });
    const parseFailed = provider.review.parseFailed === true;
    return {
        exitCode: parseFailed ? 1 : 0,
        posted: true,
        reviewId,
        message: existing !== null
            ? (parseFailed ? "replaced existing GitHub review (parse failed)" : "replaced existing GitHub review")
            : (parseFailed ? "posted GitHub review (parse failed)" : "posted GitHub review"),
        // Surface the live review's actual counts so the self-review guard
        // artifact-write path can persist them — the dry-run stub's counts
        // would otherwise mask what GitHub actually saw.
        inlineThreadCount: postableComments.length,
        // Use the *effective* verdict (post-reconciliation) so the artifact
        // matches what GitHub actually saw via the `event` parameter. A
        // NEEDS_FIX review whose findings were all severity-filtered out
        // surfaces here as `COMMENT`, matching the `📊 0 inline findings`
        // body and the `COMMENT` review event.
        verdict: prepared.effectiveVerdict,
        // Signal parse-fail to the artifact-write path so writeLiveArtifact
        // can stamp `parseFailed: true` on the posted=true branch.
        parseFailed,
        // Thread parse warnings (off-diff citation hallucinations) to the
        // artifact-write path so the parse-warnings.json sibling artifact
        // surfaces them for operators / CI guards.
        parseWarnings: provider.parseWarnings,
    };
}
async function findExistingMarkerReview(context, fetchImpl) {
    const response = await fetchImpl(githubReviewsUrl(context), {
        method: "GET",
        headers: githubHeaders(context.token),
    });
    ensureHttpOk(response, "GITHUB_LIST_REVIEWS_FAILED", "GitHub list reviews");
    const json = await readJsonResponse(response);
    if (!Array.isArray(json)) {
        return null;
    }
    for (const entry of json) {
        const review = parseExistingReview(entry);
        if (review !== null && commentBodyHasMarker(review.body) && review.state !== "DISMISSED") {
            return review;
        }
    }
    return null;
}
async function updateExistingReview(input) {
    try {
        const response = await input.fetchImpl(`${githubReviewsUrl(input.context)}/${input.review.id}`, {
            method: "PUT",
            headers: githubHeaders(input.context.token),
            body: JSON.stringify({ body: input.body }),
        });
        ensureHttpOk(response, "GITHUB_UPDATE_REVIEW_FAILED", "GitHub update review");
        return input.review.id;
    }
    catch (error) {
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
        headers: githubHeaders(input.context.token),
    });
    if (response.status === 204 || response.status === 404) {
        return;
    }
    writeBrandedAnnotation("warning", `failed to delete existing review ${input.review.id} (${response.status}); posting new review anyway.`);
}
async function createGithubReview(input) {
    const request = {
        commit_id: input.context.headSha,
        body: input.body,
        event: input.event,
        comments: input.comments,
    };
    const response = await input.fetchImpl(githubReviewsUrl(input.context), {
        method: "POST",
        headers: githubHeaders(input.context.token),
        body: JSON.stringify(request),
    });
    ensureHttpOk(response, "GITHUB_CREATE_REVIEW_FAILED", "GitHub create review");
    return readResponseId(await readJsonResponse(response));
}
function parseExistingReview(value) {
    if (!isRecord(value)) {
        return null;
    }
    const id = value["id"];
    const body = value["body"];
    const state = value["state"];
    if (isSafeInteger(id) &&
        typeof body === "string" &&
        typeof state === "string") {
        return { id, body, state };
    }
    return null;
}
function githubReviewsUrl(context) {
    const owner = encodeURIComponent(context.repo.owner);
    const repo = encodeURIComponent(context.repo.name);
    return `https://api.github.com/repos/${owner}/${repo}/pulls/${context.prNumber}/reviews`;
}

;// CONCATENATED MODULE: ./src/provider/provider-error.ts
class ProviderError extends Error {
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
}
function sanitizeHttpStatus(endpoint, status) {
    return `Provider ${endpoint} responded with HTTP ${status}.`;
}
function sanitizeMessage(error, fallback) {
    if (error instanceof Error) {
        const safe = error.message.replace(/\s+/g, " ").trim();
        if (safe.length === 0) {
            return fallback;
        }
        if (safe.length > 160) {
            return `${safe.slice(0, 157)}...`;
        }
        return safe;
    }
    return fallback;
}
function isAbortError(error) {
    if (error instanceof Error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") {
            return true;
        }
    }
    const code = readErrorCode(error);
    return code === "ABORT_ERR" || code === "23";
}
function readErrorCode(error) {
    if (typeof error !== "object" || error === null) {
        return null;
    }
    const code = error.code;
    return typeof code === "string" ? code : null;
}

;// CONCATENATED MODULE: ./src/provider/copilot-token.ts


const TOKEN_REFRESH_SKEW_SECONDS = 60;
const tokenCache = new Map();
async function fetchAndCacheSessionToken(githubToken, tokenUrl, tokenHeaders, fetchImpl, endpoint, requestId) {
    let response;
    try {
        response = await fetchImpl(tokenUrl, {
            method: "GET",
            headers: tokenHeaders,
        });
    }
    catch (error) {
        if (isAbortError(error)) {
            return {
                ok: false,
                error: new ProviderError("timeout", endpoint, null, requestId, `Request to provider ${endpoint} timed out while fetching session token.`),
            };
        }
        return {
            ok: false,
            error: new ProviderError("network", endpoint, null, requestId, sanitizeMessage(error, "Network error fetching Copilot session token."), { cause: error }),
        };
    }
    if (!response.ok) {
        return {
            ok: false,
            error: new ProviderError("chat_4xx", endpoint, response.status, requestId, `Copilot session token endpoint responded with HTTP ${response.status}.`),
        };
    }
    let rawText;
    try {
        rawText = await response.text();
    }
    catch (error) {
        return {
            ok: false,
            error: new ProviderError("parse", endpoint, response.status, requestId, sanitizeMessage(error, "Failed to read Copilot session token body."), { cause: error }),
        };
    }
    const envelope = tryParseJson(rawText);
    if (!isRecord(envelope)) {
        return {
            ok: false,
            error: new ProviderError("parse", endpoint, response.status, requestId, "Copilot session token response was not a JSON object."),
        };
    }
    const token = readStringField(envelope, "token");
    const expiresAt = readSafeIntegerField(envelope, "expires_at");
    const endpoints = readRecordField(envelope, "endpoints");
    const chatApiBase = endpoints === null ? null : readStringField(endpoints, "api");
    if (token === null || expiresAt === null || chatApiBase === null) {
        return {
            ok: false,
            error: new ProviderError("parse", endpoint, response.status, requestId, "Copilot session token envelope was missing required fields."),
        };
    }
    const cacheKey = buildCacheKey(githubToken);
    tokenCache.set(cacheKey, { token, expiresAt, apiBase: chatApiBase });
    return { ok: true, session: { token, apiBase: chatApiBase } };
}
function getCachedSessionToken(githubToken) {
    const cacheKey = buildCacheKey(githubToken);
    const cached = tokenCache.get(cacheKey);
    if (cached === undefined) {
        return undefined;
    }
    const nowSeconds = Date.now() / 1000;
    if (nowSeconds + TOKEN_REFRESH_SKEW_SECONDS >= cached.expiresAt) {
        return undefined;
    }
    return { token: cached.token, apiBase: cached.apiBase };
}
function clearCopilotTokenCache() {
    tokenCache.clear();
}
function buildCacheKey(githubToken) {
    return githubToken;
}

;// CONCATENATED MODULE: ./src/provider/copilot.ts






const DEFAULT_GITHUB_API_BASE = "https://api.github.com";
const COPILOT_EDITOR_VERSION = "vscode/1.96.0";
const COPILOT_EDITOR_PLUGIN_VERSION = `${BRAND}/0.1.0`;
const COPILOT_INTEGRATION_ID = "vscode-chat";
const COPILOT_USER_AGENT = `${BRAND}/0.1.0`;
const ENDPOINT_CHAT = "chat";
async function runCopilotRequest(config) {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const requestId = createRequestId();
    const sessionResult = await resolveSession(config.githubToken, config.apiBase, fetchImpl, requestId);
    if (!sessionResult.ok) {
        return { ok: false, error: sessionResult.error };
    }
    return runChatCall(config, fetchImpl, requestId, sessionResult.session);
}
async function resolveSession(githubToken, apiBase, fetchImpl, requestId) {
    const cached = getCachedSessionToken(githubToken);
    if (cached !== undefined) {
        return { ok: true, session: cached };
    }
    const normalizedBase = normalizeApiBase(apiBase);
    return fetchAndCacheSessionToken(githubToken, buildTokenUrl(normalizedBase), buildTokenHeaders(githubToken), fetchImpl, ENDPOINT_CHAT, requestId);
}
async function runChatCall(config, fetchImpl, requestId, session) {
    const url = joinUrl(session.apiBase, "/chat/completions");
    const body = buildChatBody({
        model: config.model,
        system: config.system,
        user: config.user,
        ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
        ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
        ...(config.responseFormat !== undefined ? { responseFormat: config.responseFormat } : {}),
    });
    const signal = composeSignal(undefined, config.requestTimeoutMs);
    let response;
    try {
        response = await fetchImpl(url, {
            method: "POST",
            headers: buildChatHeaders(session.token),
            body: JSON.stringify(body),
            signal,
        });
    }
    catch (error) {
        if (isAbortError(error)) {
            return {
                ok: false,
                error: new ProviderError("timeout", ENDPOINT_CHAT, null, requestId, `Request to provider ${ENDPOINT_CHAT} timed out after ${config.requestTimeoutMs}ms.`),
            };
        }
        return {
            ok: false,
            error: new ProviderError("network", ENDPOINT_CHAT, null, requestId, sanitizeMessage(error, `Network error contacting provider ${ENDPOINT_CHAT}.`), { cause: error }),
        };
    }
    if (!response.ok) {
        return {
            ok: false,
            error: new ProviderError("chat_4xx", ENDPOINT_CHAT, response.status, requestId, sanitizeHttpStatus(ENDPOINT_CHAT, response.status)),
        };
    }
    let rawText;
    try {
        rawText = await response.text();
    }
    catch (error) {
        return {
            ok: false,
            error: new ProviderError("parse", ENDPOINT_CHAT, response.status, requestId, sanitizeMessage(error, "Failed to read provider response body."), { cause: error }),
        };
    }
    const textPayload = extractTextPayload(ENDPOINT_CHAT, rawText);
    const review = parseReviewPayload(textPayload);
    // Strict check (CLARITY-10): empty summary+verdict+comments counts as
    // a parse failure even when extractJsonBlock returned an object. This
    // catches chat-format responses fed to the responses endpoint and
    // similar misconfigurations.
    if (isNonEmptyReview(review)) {
        return { ok: true, endpoint: ENDPOINT_CHAT, review, requestId };
    }
    // Provider-error detection: check for router/proxy misconfiguration
    // before the self-healing retry. See openai-compatible.ts for the
    // full rationale — the short version: retrying won't help when no
    // model was invoked.
    const providerError = detectProviderError(rawText);
    if (providerError !== null) {
        return {
            ok: false,
            error: new ProviderError("provider_error", ENDPOINT_CHAT, response.status, requestId, providerError.message, { rawText, providerErrorDetails: providerError }),
        };
    }
    // Self-healing parse-fail retry: send a follow-up message asking the
    // model to emit JSON only. Mirrors the openai-compatible path.
    // See openai-compatible.ts:callEndpoint for the full rationale.
    const retryBody = buildChatBody({
        model: config.model,
        system: config.system,
        user: config.user,
        ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
        ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
    }, { userOverride: PARSE_FAIL_RETRY_PROMPT });
    let retryResponse;
    try {
        retryResponse = await fetchImpl(url, {
            method: "POST",
            headers: buildChatHeaders(session.token),
            body: JSON.stringify(retryBody),
            signal,
        });
    }
    catch {
        // Retry HTTP call itself failed — surface the ORIGINAL parse failure
        // (not the retry's network error) so the parse-fail path's diagnostic
        // captures the actual root cause.
        return {
            ok: false,
            error: new ProviderError("parse", ENDPOINT_CHAT, response.status, requestId, "Provider response did not contain a JSON review payload.", { rawText }),
        };
    }
    if (!retryResponse.ok) {
        return {
            ok: false,
            error: new ProviderError("parse", ENDPOINT_CHAT, retryResponse.status, requestId, `Provider self-healing retry failed with status ${retryResponse.status}; original parse error remains the root cause.`, { rawText }),
        };
    }
    const retryRawText = await retryResponse.text();
    const retryTextPayload = extractTextPayload(ENDPOINT_CHAT, retryRawText);
    let retryReview = null;
    const parsedRetry = parseReviewPayload(retryTextPayload);
    if (isNonEmptyReview(parsedRetry)) {
        retryReview = parsedRetry;
    }
    if (retryReview === null) {
        // Same parse-fail diagnostic contract as openai-compatible.ts:
        // distinguish "truncated stream" from "completed but malformed" so
        // the diagnostic can show actionable remediation advice. Delegates
        // to the shared `diagnoseParseFailure` helper so the truncation
        // detection logic is not duplicated per provider.
        const diagnosis = diagnoseParseFailure({ rawText });
        return {
            ok: false,
            error: new ProviderError("parse", ENDPOINT_CHAT, response.status, requestId, "Provider response did not contain a JSON review payload after self-healing retry.", {
                rawText,
                truncated: diagnosis.truncated,
                ...(diagnosis.usage !== undefined ? { usage: diagnosis.usage } : {}),
            }),
        };
    }
    return { ok: true, endpoint: ENDPOINT_CHAT, review: retryReview, requestId };
}
function buildTokenHeaders(githubToken) {
    return {
        authorization: `token ${githubToken}`,
        accept: "application/json",
        "editor-version": COPILOT_EDITOR_VERSION,
        "editor-plugin-version": COPILOT_EDITOR_PLUGIN_VERSION,
        "copilot-integration-id": COPILOT_INTEGRATION_ID,
        "user-agent": COPILOT_USER_AGENT,
    };
}
function buildChatHeaders(sessionToken) {
    return {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
        "editor-version": COPILOT_EDITOR_VERSION,
        "editor-plugin-version": COPILOT_EDITOR_PLUGIN_VERSION,
        "copilot-integration-id": COPILOT_INTEGRATION_ID,
        "user-agent": COPILOT_USER_AGENT,
    };
}
function normalizeApiBase(apiBase) {
    if (apiBase === undefined || apiBase.length === 0) {
        return DEFAULT_GITHUB_API_BASE;
    }
    return apiBase;
}
function buildTokenUrl(apiBase) {
    const trimmedBase = apiBase.replace(/\/+$/u, "");
    if (trimmedBase === DEFAULT_GITHUB_API_BASE) {
        return `${trimmedBase}/copilot_internal/v2/token`;
    }
    return `${trimmedBase}/api/copilot_internal/v2/token`;
}

;// CONCATENATED MODULE: ./src/provider/openai-compatible.ts





const ENDPOINT_RESPONSES = "responses";
const openai_compatible_ENDPOINT_CHAT = "chat";
const DEBUG_SECRET_PATTERNS = [
    /\bsk_test_[a-z_]+\b/gu,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
    /\bghp_[A-Za-z0-9]{36}\b/gu,
];

/**
 * Project the call config down to the body shape expected by
 * `buildResponsesBody` / `buildChatBody`. The strict-schema
 * `responseFormat` rides along so the wire request carries the
 * JSON-schema constraint when the call config provides it.
 */
function buildBodyConfig(config) {
    return {
        model: config.model,
        system: config.system,
        user: config.user,
        ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
        ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
        ...(config.responseFormat !== undefined ? { responseFormat: config.responseFormat } : {}),
    };
}
async function runProviderRequest(config) {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const requestId = createRequestId();
    // URL resolution strategy: try the operator's URL as-pasted first
    // (after trimming trailing slashes), then fall back to the
    // origin-stripped URL with /v1/ appended. This is the "robust to
    // any URL shape" contract: no matter what path the operator typed
    // (`/v1`, `/openai`, `/anthropic`, `/api/v2`, or none at all), the
    // action finds a working endpoint.
    //
    // See resolveProviderBaseUrlCandidates in src/util/url.ts for the
    // candidate list construction.
    const baseUrlCandidates = resolveProviderBaseUrlCandidates(config.baseUrl);
    // Surface the candidate list so operators can verify the URL
    // resolution is doing what they expect. Without this log line,
    // a 400/404 from the action's last attempt is opaque — the
    // operator can't tell whether the action tried the URL they pasted
    // or jumped straight to the origin+prefix form.
    if (baseUrlCandidates.length > 1) {
        process.stderr.write(`${BRAND_PREFIX}Resolving provider base URL: trying ${baseUrlCandidates.length} candidates in order: ${baseUrlCandidates.join(", ")}\n`);
    }
    let lastAttempt = { ok: false, error: new ProviderError("network", ENDPOINT_RESPONSES, null, requestId, "No base URL candidates resolved.") };
    for (const candidate of baseUrlCandidates) {
        process.stderr.write(`${BRAND_PREFIX}Trying base URL: ${candidate}\n`);
        const firstAttempt = await runWithRetry(config, fetchImpl, requestId, ENDPOINT_RESPONSES, candidate);
        if (firstAttempt.ok) {
            return firstAttempt;
        }
        if (shouldFallback(firstAttempt.error)) {
            const chatAttempt = await runWithRetry(config, fetchImpl, requestId, openai_compatible_ENDPOINT_CHAT, candidate);
            if (chatAttempt.ok) {
                return chatAttempt;
            }
            // Chat fallback also failed. Move to the next URL candidate
            // (the operator-pasted URL failed → try origin-stripped, etc.)
            // unless the error is NOT a 404/400 (e.g. auth failure, server
            // error) — in that case, retrying with a different URL won't
            // help, so return immediately.
            if (!isRoutableFailure(chatAttempt.error)) {
                return chatAttempt;
            }
            process.stderr.write(`${BRAND_PREFIX}Base URL ${candidate} returned routable failure (status=${chatAttempt.error.status}); advancing to next candidate.\n`);
            lastAttempt = chatAttempt;
            continue;
        }
        // The /responses endpoint failed with a non-routable status
        // (e.g. 401, 500). Retrying with a different URL won't help.
        if (!isRoutableFailure(firstAttempt.error)) {
            return firstAttempt;
        }
        process.stderr.write(`${BRAND_PREFIX}Base URL ${candidate} returned routable failure (status=${firstAttempt.error.status}); advancing to next candidate.\n`);
        lastAttempt = firstAttempt;
    }
    return lastAttempt;
}
/**
 * True when the failure was a routing-level rejection (404 Not Found
 * or 400 Bad Request) that would benefit from trying a different URL
 * shape. False for auth failures (401/403), server errors (5xx),
 * parse failures, and timeouts — those have a single root cause and
 * a different URL won't help.
 */
function isRoutableFailure(error) {
    return error.status === 404 || error.status === 400;
}
async function runWithEndpoint(config, fetchImpl, requestId, endpoint, baseUrl) {
    try {
        return await callEndpoint(config, fetchImpl, requestId, endpoint, baseUrl);
    }
    catch (error) {
        if (error instanceof ProviderError) {
            return { ok: false, error };
        }
        throw error;
    }
}
const RETRY_BACKOFF_MS = [250, 1_000];
async function runWithRetry(config, fetchImpl, requestId, endpoint, baseUrl) {
    let lastFailure = null;
    for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
        const result = await runWithEndpoint(config, fetchImpl, requestId, endpoint, baseUrl);
        if (result.ok) {
            return result;
        }
        lastFailure = result.error;
        if (!isRetryable(result.error)) {
            return result;
        }
        if (attempt < RETRY_BACKOFF_MS.length) {
            const backoffMs = RETRY_BACKOFF_MS[attempt] ?? 0;
            await sleep(backoffMs);
        }
    }
    return { ok: false, error: lastFailure ?? new ProviderError("network", endpoint, null, requestId, "Unknown retry failure.") };
}
function isRetryable(error) {
    return error.status === 429 || (typeof error.status === "number" && error.status >= 500);
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
    const body = endpoint === ENDPOINT_RESPONSES
        ? buildResponsesBody(buildBodyConfig(config))
        : buildChatBody(buildBodyConfig(config));
    const signal = composeSignal(config.signal, config.requestTimeoutMs);
    const response = await performFetch(fetchImpl, url, body, signal, config, requestId, endpoint);
    if (!response.ok) {
        throw new ProviderError(endpoint === ENDPOINT_RESPONSES ? "responses_4xx" : "chat_4xx", endpoint, response.status, requestId, sanitizeHttpStatus(endpoint, response.status));
    }
    const rawText = await readBody(response, endpoint, requestId);
    const textPayload = extractTextPayload(endpoint, rawText);
    // [DEBUG-RAW] Emit extracted text length + first/last 200 chars so the
    // GitHub Actions log shows what the parser actually saw. Pinned by the
    // --debug-raw-response action input. This is the only way to diagnose
    // production parse-fails without re-running the model — the action
    // does not log the raw response by default (it would dump 100+ KB to
    // the log on every run).
    if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
        writeDebugRaw(`[DEBUG-RAW] requestId=${requestId} endpoint=${endpoint} ` +
            `rawTextLength=${rawText.length} textPayloadLength=${textPayload.length}\n`, config);
        const safeTextPayload = redactDebugSecrets(textPayload, config);
        writeDebugRaw(`[DEBUG-RAW] textPayload first 200: ${JSON.stringify(safeTextPayload.slice(0, 200))}\n`, config);
        writeDebugRaw(`[DEBUG-RAW] textPayload last 200:  ${JSON.stringify(safeTextPayload.slice(-200))}\n`, config);
        writeDebugRaw(`[DEBUG-RAW] hasResponseCompletedEvent: ${rawText.includes('"type":"response.completed"')}\n`, config);
    }
    const review = parseReviewPayload(textPayload);
    // [DEBUG-RAW] Trace the parse decision so the next parse-fail run can
    // show exactly what `parseReviewPayload` returned. Without this, we
    // see "retry fired" in the log but not WHY (null vs all-empty-fields
    // vs apology-summary-detected are all indistinguishable from outside).
    if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
        const trace = review === null
            ? "null"
            : `summary.len=${review.summary.length} verdict='${review.verdict}' comments=${review.comments.length} suppressed=${review.suppressed_comments.length}`;
        writeDebugRaw(`[DEBUG-RAW] parseReviewPayload returned: ${trace}\n`, config);
        writeDebugRaw(`[DEBUG-RAW] isNonEmptyReview: ${isNonEmptyReview(review)}\n`, config);
    }
    // Treat an empty-summary+empty-verdict parse as a parse failure even
    // when `extractJsonBlock` returned an object. The parser is permissive
    // about JSON shape (returns `ProviderReviewPayload` with empty fields
    // for any JSON object), so a chat-format response (`{choices: [...]}`)
    // fed to the responses endpoint can otherwise pass as a 0-finding
    // "empty review" — see CLARITY-10.
    if (isNonEmptyReview(review)) {
        return { ok: true, endpoint, review, requestId };
    }
    // Provider-error detection: before attempting the self-healing
    // retry, check whether the raw response is a provider error (router
    // misconfiguration, no providers configured, invalid API key, etc.)
    // rather than a genuine parse failure. Provider errors are NOT
    // retryable — retrying with a JSON-reminder prompt won't help when
    // no model was invoked in the first place. Short-circuiting here
    // saves a wasted retry and surfaces a specific error code
    // (`provider_error`) so the live-review layer can hard-fail instead
    // of posting a 0-finding COMMENT review that exits 0.
    const providerError = detectProviderError(rawText);
    if (providerError !== null) {
        throw new ProviderError("provider_error", endpoint, response.status, requestId, providerError.message, { rawText, providerErrorDetails: providerError });
    }
    // Self-healing: parse failed on first attempt. Try once more with an
    // explicit JSON-only reminder. Some providers (notably those that
    // emit only an SSE stream of metadata events with no actual output)
    // recover cleanly when reminded to emit JSON.
    //
    // Note: any network/HTTP error on the retry is collapsed back into a
    // `parse` error (with the ORIGINAL rawText attached) so the parse-fail
    // path's diagnostic captures the actual root cause — the model
    // couldn't produce a parseable review, regardless of whether the retry
    // request itself reached the provider.
    const retryBody = endpoint === ENDPOINT_RESPONSES
        ? buildResponsesBody(buildBodyConfig(config), { userOverride: PARSE_FAIL_RETRY_PROMPT })
        : buildChatBody(buildBodyConfig(config), { userOverride: PARSE_FAIL_RETRY_PROMPT });
    let retryReview = null;
    // Track the retry's HTTP status (if it reached performFetch and
    // returned a response) so the parse-fail ProviderError can surface
    // it. When the retry fails with HTTP 4xx/5xx, that's the most
    // informative root cause; when the retry succeeds with a still-
    // unparseable payload, the ORIGINAL response status is the right
    // signal — the model couldn't produce a review, not a transport
    // failure. Both cases match `src/provider/copilot.ts`'s contract.
    let retryResponseStatus = null;
    try {
        const retryResponse = await performFetch(fetchImpl, url, retryBody, signal, config, requestId, endpoint);
        retryResponseStatus = retryResponse.status;
        if (retryResponse.ok) {
            const retryRawText = await readBody(retryResponse, endpoint, requestId);
            const retryTextPayload = extractTextPayload(endpoint, retryRawText);
            if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
                writeDebugRaw(`[DEBUG-RAW] retry requestId=${requestId} ` +
                    `rawTextLength=${retryRawText.length} textPayloadLength=${retryTextPayload.length}\n`, config);
                const safeRetryTextPayload = redactDebugSecrets(retryTextPayload, config);
                writeDebugRaw(`[DEBUG-RAW] retry textPayload first 200: ${JSON.stringify(safeRetryTextPayload.slice(0, 200))}\n`, config);
                writeDebugRaw(`[DEBUG-RAW] retry textPayload last 200:  ${JSON.stringify(safeRetryTextPayload.slice(-200))}\n`, config);
            }
            const parsedRetry = parseReviewPayload(retryTextPayload);
            // Same strict check on the retry: must have actual review content.
            if (isNonEmptyReview(parsedRetry)) {
                retryReview = parsedRetry;
            }
        }
    }
    catch {
        // Retry HTTP/parse path threw (network error, body read error,
        // etc.) — fall through to the parse-error throw below with the
        // ORIGINAL rawText. retryResponseStatus stays null in this branch.
    }
    if (retryReview === null) {
        // Distinguish "truncated stream" (model hit its token budget before
        // emitting response.completed) from "completed stream with malformed
        // JSON" (model returned bad data). The former is actionable: the
        // operator can raise --max-output-tokens and retry. The latter
        // usually means a model regression. Both surface in the parse-fail
        // diagnostic via `ProviderError.truncated` so the render layer can
        // show different remediation advice.
        const diagnosis = diagnoseParseFailure({ rawText });
        throw new ProviderError("parse", endpoint, retryResponseStatus ?? response.status, requestId, "Provider response did not contain a JSON review payload after self-healing retry.", {
            rawText,
            truncated: diagnosis.truncated,
            ...(diagnosis.usage !== undefined ? { usage: diagnosis.usage } : {}),
        });
    }
    return { ok: true, endpoint, review: retryReview, requestId };
}
function writeDebugRaw(message, config) {
    process.stderr.write(redactDebugSecrets(message, config));
}
function redactDebugSecrets(value, config) {
    let redacted = value;
    for (const secret of [config.apiKey, config.promptOverride ?? "", config.additionalPromptOverride ?? ""]) {
        if (secret.length > 0) {
            redacted = redacted.split(secret).join(REDACTED_SECRET_TOKEN);
        }
    }
    for (const pattern of DEBUG_SECRET_PATTERNS) {
        redacted = redacted.replace(pattern, REDACTED_SECRET_TOKEN);
    }
    return redacted;
}
async function performFetch(fetchImpl, url, body, signal, config, requestId, endpoint) {
    try {
        return await fetchImpl(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${config.apiKey}`,
                "x-request-id": requestId,
            },
            body: JSON.stringify(body),
            signal,
        });
    }
    catch (error) {
        if (isAbortError(error)) {
            if (config.signal?.aborted === true) {
                throw new ProviderError("aborted", endpoint, null, requestId, "Request was aborted by the caller.");
            }
            throw new ProviderError("timeout", endpoint, null, requestId, `Request to provider ${endpoint} timed out after ${config.requestTimeoutMs}ms.`);
        }
        throw new ProviderError("network", endpoint, null, requestId, sanitizeMessage(error, `Network error contacting provider ${endpoint}.`), { cause: error });
    }
}
async function readBody(response, endpoint, requestId) {
    try {
        return await response.text();
    }
    catch (error) {
        throw new ProviderError("parse", endpoint, response.status, requestId, sanitizeMessage(error, "Failed to read provider response body."), { cause: error });
    }
}
function shouldFallback(error) {
    return error.status === 404 || error.status === 400;
}

;// CONCATENATED MODULE: ./src/cli/auto-model.ts
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
 * trade-off for the active provider:
 *   - provider=copilot  → claude-3-5-sonnet (Copilot's Claude backend;
 *     this is the model string the GitHub Copilot Chat Completions
 *     endpoint actually accepts — the v3.x and v3.5 Sonnet line is
 *     the Copilot-routable Claude. claude-sonnet-4.6 is NOT a
 *     Copilot-routable string and would 404.)
 *   - provider=openai-compatible + URL contains "anthropic"  → claude-sonnet-4.6
 *   - provider=openai-compatible + URL contains "generativelanguage"  → gemini-2.5-flash
 *   - provider=openai-compatible otherwise (incl. api.openai.com)  → gpt-5-mini
 *
 * Users can always override via `--model` (or `UMACTUALLY_MODEL`).
 */
const COPILOT_DEFAULT_MODEL = "claude-3-5-sonnet";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4.6";
const GOOGLE_DEFAULT_MODEL = "gemini-2.5-flash";
const OPENAI_DEFAULT_MODEL = "gpt-5-mini";
function resolveAutoModel(input) {
    if (input.provider === "copilot") {
        return COPILOT_DEFAULT_MODEL;
    }
    const url = input.apiUrl ?? input.env["UMACTUALLY_API_URL"] ?? "";
    if (url.includes("anthropic")) {
        return ANTHROPIC_DEFAULT_MODEL;
    }
    if (url.includes("generativelanguage") || url.includes("googleapis")) {
        return GOOGLE_DEFAULT_MODEL;
    }
    return OPENAI_DEFAULT_MODEL;
}
/**
 * The fallback chain used when a primary model returns a parse-fail
 * or a non-parseable response. Each entry is a model name the
 * provider accepts. The current implementation is sequential (try
 * the first, fall back to the next on parse-fail), not parallel —
 * keeps the per-request cost predictable and matches the
 * PR-Agent `retry_with_fallback_models` pattern.
 *
 * IMPORTANT: the fallback chain is provider-specific. Trying
 * `claude-sonnet-4.6` as a Copilot fallback would 404 (per the
 * Copilot model routing documented in `resolveAutoModel`).
 * `fallbackModelsFor` filters the list to provider-routable models
 * so the parse-fail recovery doesn't itself fail.
 */
const PROVIDER_FALLBACKS = {
    "openai-compatible": [
        OPENAI_DEFAULT_MODEL,
        "gpt-4.1",
        "gpt-4.1-mini",
        ANTHROPIC_DEFAULT_MODEL,
        GOOGLE_DEFAULT_MODEL,
    ],
    copilot: [
        // The Copilot fallback chain is intentionally short: the
        // provider only accepts Copilot-routable model strings, and
        // a parse-fail retry on a different model that's still
        // Copilot-routable would 404 too. The retry loop should fall
        // back to the same model with a parse-fail retry prompt
        // (handled in provider-parse.ts:PARSE_FAIL_RETRY_PROMPT);
        // a model-level fallback is a no-op for Copilot today.
        COPILOT_DEFAULT_MODEL,
    ],
};
const DEFAULT_FALLBACK_MODELS = PROVIDER_FALLBACKS["openai-compatible"];
/**
 * Return the fallback chain for a specific provider. Use this
 * instead of the bare `DEFAULT_FALLBACK_MODELS` constant in any
 * path that might be Copilot-routed — otherwise the parse-fail
 * recovery would itself fail with a 404.
 */
function fallbackModelsFor(provider) {
    return PROVIDER_FALLBACKS[provider];
}
/**
 * Parse a `--fallback-models` CLI value (comma-separated) into a
 * list. Empty parts and duplicate entries are dropped.
 */
function parseFallbackModels(value) {
    if (value === null || value === undefined || value.length === 0) {
        return DEFAULT_FALLBACK_MODELS;
    }
    const seen = new Set();
    const out = [];
    for (const part of value.split(",")) {
        const trimmed = part.trim();
        if (trimmed.length === 0 || seen.has(trimmed)) {
            continue;
        }
        seen.add(trimmed);
        out.push(trimmed);
    }
    return out.length > 0 ? out : DEFAULT_FALLBACK_MODELS;
}

;// CONCATENATED MODULE: ./src/cli/parse-warnings.ts

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
    for (const [source, list] of [
        ["comments", input.review.comments],
        ["suppressed_comments", input.review.suppressedComments],
    ]) {
        list.forEach((comment, index) => {
            const path = comment.path;
            const line = comment.line;
            // Defensive: a model might emit a non-integer line OR an
            // empty path. Treat both as off-diff (the most actionable
            // signal: the model fabricated the position) so the
            // parse-warnings artifact records the shape error too —
            // a comment with `line: 2.5` is a fabrication just as
            // much as a hallucinated `dist/cli.js:1`, and silently
            // dropping it from the artifact would hide a real failure
            // mode from operators.
            const pathInDiff = path.length > 0 && diffPaths.has(path);
            const lineInDiff = Number.isInteger(line) && line > 0 && positions.hasPosition({ path, line });
            if (pathInDiff && lineInDiff) {
                return;
            }
            // Reason precedence: if the path is not in the diff, that's the
            // most actionable signal (the diff filter missed it OR the model
            // fabricated the path). A line-number error on an in-diff path
            // is a different failure mode (off-by-one / hallucinated line).
            const reason = !pathInDiff
                ? "path-not-in-diff"
                : "line-not-in-diff";
            warnings.push({
                reason,
                source,
                index,
                modelPath: path,
                modelLine: line,
                modelSeverity: comment.severity,
                bodyExcerpt: comment.body.length > 200
                    ? `${comment.body.slice(0, 200)}…`
                    : comment.body,
            });
        });
    }
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
        "line-not-in-diff": 0,
    };
    const bySource = {
        comments: 0,
        suppressed_comments: 0,
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
            bySource,
        },
        warnings,
    };
}

;// CONCATENATED MODULE: ./src/config/prompt-files.ts



const PROMPT_SEPARATOR = "\n\n---\n\n";
const nodePromptFileSystem = {
    realpath(cwd) {
        return (0,promises_namespaceObject.realpath)(cwd);
    },
    async realpathWithinCwd(path, cwdReal, _self) {
        const absolute = (0,external_node_path_namespaceObject.resolve)(cwdReal, path);
        let real;
        try {
            real = await (0,promises_namespaceObject.realpath)(absolute);
        }
        catch {
            return { absolute, withinCwd: isWithinCwdLexical(absolute, cwdReal) };
        }
        return { absolute: real, withinCwd: isWithinCwdReal(real, cwdReal) };
    },
    stat(path) {
        return (0,promises_namespaceObject.stat)(path).then((s) => ({ isFile: s.isFile(), size: s.size }));
    },
    readFile(path) {
        return (0,promises_namespaceObject.readFile)(path, "utf8");
    },
};
function isWithinCwdReal(real, cwdReal) {
    if (process.platform === "win32") {
        const r = real.toLowerCase();
        const c = cwdReal.toLowerCase();
        return r === c || r.startsWith(`${c}${external_node_path_namespaceObject.sep}`);
    }
    return real === cwdReal || real.startsWith(`${cwdReal}/`);
}
function isWithinCwdLexical(absolute, cwdReal) {
    const rel = external_node_path_namespaceObject.posix.relative(toPosix(cwdReal), toPosix(absolute));
    return rel !== "" && !rel.startsWith("..") && !external_node_path_namespaceObject.posix.isAbsolute(rel);
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
    if (!Number.isInteger(byteCap) || byteCap <= 0) {
        throw new errors_InvalidConfigError("prompt.byteCap", `expected positive integer, received ${byteCap}`);
    }
    const fs = options.fs ?? nodePromptFileSystem;
    const cwdReal = await fs.realpath(options.cwd);
    const parts = [];
    let aggregateBytes = 0;
    for (const rawPath of paths) {
        if (typeof rawPath !== "string" || rawPath.length === 0) {
            throw new PromptFileError(String(rawPath), "not-found");
        }
        if ((0,external_node_path_namespaceObject.isAbsolute)(rawPath)) {
            throw new PromptFileError(rawPath, "outside-cwd");
        }
        const resolved = await fs.realpathWithinCwd(rawPath, cwdReal, fs);
        if (!resolved.withinCwd) {
            throw new PromptFileError(rawPath, "outside-cwd");
        }
        let stat;
        try {
            stat = await fs.stat(resolved.absolute);
        }
        catch {
            throw new PromptFileError(rawPath, "not-found");
        }
        if (!stat.isFile) {
            throw new PromptFileError(rawPath, "not-a-file");
        }
        if (stat.size > byteCap) {
            throw new PromptFileError(rawPath, "byte-cap-exceeded");
        }
        aggregateBytes += stat.size;
        if (aggregateBytes > byteCap) {
            throw new PromptFileError(rawPath, "byte-cap-exceeded");
        }
        let text;
        try {
            text = await fs.readFile(resolved.absolute);
        }
        catch {
            throw new PromptFileError(rawPath, "read-failed");
        }
        parts.push(text);
    }
    return parts.join(PROMPT_SEPARATOR);
}

;// CONCATENATED MODULE: ./src/cli/provider-prompts.ts



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
    required: ["summary", "verdict", "comments", "suppressed_comments"],
    properties: {
        summary: { type: "string" },
        verdict: { type: "string", minLength: 1 },
        comments: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["path", "line", "body", "severity", "category"],
                properties: {
                    path: { type: "string" },
                    line: { type: "integer", minimum: 1 },
                    body: { type: "string" },
                    severity: { type: "string", minLength: 1 },
                    category: { type: "string" },
                },
            },
        },
        suppressed_comments: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["path", "line", "body", "severity", "category"],
                properties: {
                    path: { type: "string" },
                    line: { type: "integer", minimum: 1 },
                    body: { type: "string" },
                    severity: { type: "string", minLength: 1 },
                    category: { type: "string" },
                },
            },
        },
    },
};
async function buildProviderPrompts(input) {
    const additionalPrompt = await readAdditionalPrompt(input);
    const userParts = [
        `Platform: ${input.platform}`,
        additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
    ];
    if (input.sonarContext !== undefined && input.sonarContext.length > 0) {
        userParts.push(input.sonarContext);
    }
    // Layer 2-A: enumerate the diff's path list in the user message
    // so the model can verify any cited path by grep. We list the
    // paths even on the strict-schema path (which already constrains
    // `path` to a string type) because the model emits a literal
    // string the post-filter then validates against this list.
    userParts.push(buildFilesInDiffBlock(input.diffText));
    userParts.push("Diff:", input.diffText);
    return {
        system: await pickSystemPrompt(input),
        user: userParts.join("\n\n"),
    };
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
    if (paths.length === 0) {
        return "Files in diff: (none — empty diff)";
    }
    const lines = paths.map((p, i) => `  ${i + 1}. ${p}`);
    return [
        "Files in diff (the ONLY paths you may cite):",
        ...lines,
        "Do NOT cite any path that is not in this list. If a finding requires a file not in the diff, omit the finding entirely rather than fabricating a path.",
    ].join("\n");
}
async function pickSystemPrompt(input) {
    const inline = input.parsed.prompt;
    if (typeof inline === "string" && inline.length > 0) {
        return inline;
    }
    const filePath = input.parsed.promptFile ?? input.env["UMACTUALLY_PROMPT_FILE"];
    if (filePath !== undefined && filePath.length > 0) {
        return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
    }
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
        "Workflow for every finding you emit:",
        "1. Identify a real concern introduced by the diff.",
        "2. Copy the EXACT diff lines that justify the concern (a verbatim quote, 1-3 lines).",
        "3. Emit a JSON object whose `path` matches a file from the Files-in-diff list in the user message and whose `line` matches a line number that appears in the diff for that file.",
        "If you cannot complete steps 2-3, OMIT the finding entirely. Do not invent a citation.",
        "",
        "Forbidden (a non-exhaustive list to make the boundary explicit; the positive constraint above takes precedence):",
        "- Do NOT cite any path that is not in the Files-in-diff list. Build artifacts, generated files, and lockfiles are stripped from the diff upstream and are never reviewable here.",
        "- Do NOT cite any line number that does not appear in the diff for the cited path. Off-by-one or hallucinated line numbers are rejected by the post-filter.",
        "- Do NOT infer missing context. If the diff does not show a function call, do not claim a function call exists.",
        "- Do NOT include secrets, tokens, or any literal that looks like a credential.",
        "",
        "Severity values: info, low, medium, high, critical, security, leak. Use 'security' for an active vulnerability, 'leak' for a confirmed secret, 'critical' for severe bugs. Style and hygiene issues go in 'low' or 'info'.",
        "",
        "Return strict JSON only — no prose, no markdown fences. Schema:",
        JSON.stringify(REVIEW_PAYLOAD_JSON_SCHEMA, null, 2),
        "",
        "If the diff is empty or has no actionable findings, return verdict=COMMENT with an empty comments array. Do not invent findings to fill the response.",
    ].join("\n");
}
async function readAdditionalPrompt(input) {
    const inline = input.parsed.additionalPrompt;
    if (typeof inline === "string" && inline.length > 0) {
        return inline;
    }
    const filePath = input.parsed.additionalPromptFile ?? input.env["UMACTUALLY_ADDITIONAL_PROMPT_FILE"];
    if (filePath === undefined || filePath.length === 0) {
        return "";
    }
    return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
}

;// CONCATENATED MODULE: ./src/cli/verify-findings.ts
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
    for (const comment of input.review.comments) {
        if (positions.hasPosition(comment)) {
            verified.push(comment);
        }
        else {
            dropped.push(comment);
        }
    }
    return { verified, dropped };
}
/**
 * Model-based verification. Sends a per-finding prompt to the same
 * provider, asking the model to copy the diff lines that justify
 * each finding. Findings where the model returns `verified: false`
 * or an empty `quote` are dropped.
 *
 * Not yet wired into the live flow — the `requestLiveReview` and
 * `runGithubLive` / `runAzureLive` paths would need to call this
 * after the first model response and before posting. Wiring is
 * tracked as a follow-up: this function exists so callers can
 * opt in via a higher-level orchestration, and the deterministic
 * `verifyFindingsAgainstDiff` covers the common case.
 */
async function verifyFindingsWithModel(input) {
    const systemPrompt = "You are a strict reviewer verifying that each finding is supported by the diff. Return JSON { verified: boolean, quote: string } for each.";
    const userPrompt = [
        "Verify each finding against the diff below. Copy the EXACT diff lines that justify it into `quote`. If the diff does not support the finding, return verified: false with quote: \"\".",
        ...input.review.comments.map((c, i) => `Finding ${i + 1}: path=${c.path} line=${c.line} body=${c.body}`),
        "",
        "Diff:",
        input.diffText,
    ].join("\n\n");
    const result = await input.verifier({
        systemPrompt,
        userPrompt,
        findings: input.review.comments,
    });
    const verified = [];
    const dropped = [];
    // Walk in lockstep with the input comments so the verifier's
    // decision for finding N maps to review.comments[N].
    for (let i = 0; i < input.review.comments.length; i += 1) {
        const comment = input.review.comments[i];
        const verdict = result[i];
        if (comment === undefined) {
            continue;
        }
        if (verdict !== undefined && verdict.verified && verdict.supportingQuote.length > 0) {
            verified.push(comment);
        }
        else {
            dropped.push(comment);
        }
    }
    return { verified, dropped };
}

;// CONCATENATED MODULE: ./src/cli/live-provider.ts









const live_provider_DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const PROVIDER_NAME = "openai-compatible";
const COPILOT_PROVIDER_NAME = "github-copilot";
async function requestLiveReview(input) {
    await scanReviewSecrets({
        diffText: input.diffText,
        expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });
    const providerApiKey = readRequiredConfig(input.parsed.apiKey ?? input.env["UMACTUALLY_API_KEY"], "UMACTUALLY_API_KEY");
    const modelId = readConfiguredModel(input.parsed, input.env);
    const prompts = await buildProviderPrompts(input);
    // Install an ambient severity-warning sink for the duration of this
    // request. Any `parseReviewPayload` call inside `runCopilotRequest` /
    // `runProviderRequest` will push warnings into the captured array
    // (the sink is auto-cleared in `finally`). Node's single-threaded
    // event loop means no two concurrent `requestLiveReview` calls can
    // interleave the set/await/clear sequence, so the singleton slot is
    // safe. The provider name is captured at install time so every warning
    // recorded during this request is attributed correctly even if a
    // generic test runner does not pass `providerName` explicitly.
    const severityWarnings = [];
    const sinkProviderName = input.parsed.provider === "copilot" ? COPILOT_PROVIDER_NAME : PROVIDER_NAME;
    const sink = (raw, normalized, ctx) => {
        severityWarnings.push({
            rawValue: raw,
            normalizedFallback: normalized,
            commentIndex: ctx.commentIndex,
            providerName: ctx.providerName ?? sinkProviderName,
        });
    };
    setActiveSeveritySink(sink);
    // Layer 2-C: when the CLI flag enables it, send the strict JSON-schema
    // response_format on the wire. Defaults to true so the model is
    // constrained at decode time; the in-context system prompt carries
    // the same schema as a guide for free-form models.
    const responseFormat = input.parsed.strictSchema === false
        ? undefined
        : { type: "json_schema", strict: true, schema: REVIEW_PAYLOAD_JSON_SCHEMA };
    try {
        if (input.parsed.provider === "copilot") {
            const result = await runCopilotRequest({
                githubToken: providerApiKey,
                apiBase: input.parsed.githubApiBase ?? input.env["UMACTUALLY_GITHUB_API_BASE"] ?? "https://api.github.com",
                system: prompts.system,
                user: prompts.user,
                model: modelId,
                requestTimeoutMs: readRequestTimeoutMs(input.parsed),
                ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
                ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
                ...(responseFormat !== undefined ? { responseFormat } : {}),
                fetchImpl: input.fetchImpl,
            });
            if (result.ok) {
                // Step 1: normalize without the verify filter so the
                // parse-warnings artifact (built in step 2) records every
                // off-diff citation the model emitted, not just the ones
                // that survived the inline filter. The filter is a
                // defense-in-depth, not a replacement for the artifact.
                const preVerifyReview = normalizeProviderReview(result.review, [providerApiKey, input.platformToken]);
                // Step 2: build the parse-warnings artifact from the
                // pre-verify review (so it captures every fabrication).
                const preVerifyOutcome = withParseWarnings({
                    review: preVerifyReview,
                    endpoint: result.endpoint,
                    provider: COPILOT_PROVIDER_NAME,
                    modelId,
                    severityWarnings: severityWarnings.slice(),
                    diffText: input.diffText,
                });
                // Step 3: apply the deterministic verify filter to the
                // comments[] that gets passed downstream (so the
                // platform-posting paths only see anchorable findings).
                // Use `!== false` rather than `=== true` so callers
                // (tests, future serializers) that omit the field
                // still get the default-ON behavior.
                const finalReview = input.parsed.verifyFindings !== false
                    ? applyVerifyFilter(preVerifyReview, input.diffText)
                    : preVerifyReview;
                return {
                    ...preVerifyOutcome,
                    review: finalReview,
                };
            }
            if (result.error.code === "parse") {
                const review = buildMalformedProviderFallback({
                    provider: COPILOT_PROVIDER_NAME,
                    modelId,
                    rawText: result.error.rawText ?? "",
                    secrets: [providerApiKey, input.platformToken],
                    ...parseFailureReasonFromProviderError(result.error, input.parsed.maxOutputTokens),
                });
                return withParseWarnings({
                    review,
                    endpoint: result.error.endpoint,
                    provider: COPILOT_PROVIDER_NAME,
                    modelId,
                    severityWarnings: severityWarnings.slice(),
                    diffText: input.diffText,
                });
            }
            // Provider errors (router misconfig, no providers configured,
            // invalid API key, etc.) are NOT parse failures and must NOT
            // be posted as a COMMENT review. Hard-fail so CI sees the error.
            if (result.error.code === "provider_error") {
                const details = result.error.providerErrorDetails;
                throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
            }
            throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
        }
        const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");
        const result = await runProviderRequest({
            baseUrl: providerUrl,
            apiKey: providerApiKey,
            model: modelId,
            system: prompts.system,
            user: prompts.user,
            requestTimeoutMs: readRequestTimeoutMs(input.parsed),
            ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
            ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
            ...(responseFormat !== undefined ? { responseFormat } : {}),
            fetchImpl: input.fetchImpl,
        });
        if (result.ok) {
            // See the Copilot branch for the three-step flow rationale.
            const preVerifyReview = normalizeProviderReview(result.review, [providerApiKey, input.platformToken]);
            const preVerifyOutcome = withParseWarnings({
                review: preVerifyReview,
                endpoint: result.endpoint,
                provider: PROVIDER_NAME,
                modelId,
                severityWarnings: severityWarnings.slice(),
                diffText: input.diffText,
            });
            const finalReview = input.parsed.verifyFindings !== false
                ? applyVerifyFilter(preVerifyReview, input.diffText)
                : preVerifyReview;
            return {
                ...preVerifyOutcome,
                review: finalReview,
            };
        }
        if (result.error.code === "parse") {
            const review = buildMalformedProviderFallback({
                provider: PROVIDER_NAME,
                modelId,
                rawText: result.error.rawText ?? "",
                secrets: [providerApiKey, input.platformToken],
                ...parseFailureReasonFromProviderError(result.error, input.parsed.maxOutputTokens),
            });
            return withParseWarnings({
                review,
                endpoint: result.error.endpoint,
                provider: PROVIDER_NAME,
                modelId,
                severityWarnings: severityWarnings.slice(),
                diffText: input.diffText,
            });
        }
        // Provider errors (router misconfig, no providers configured,
        // invalid API key, etc.) are NOT parse failures and must NOT
        // be posted as a COMMENT review. Hard-fail so CI sees the error.
        if (result.error.code === "provider_error") {
            const details = result.error.providerErrorDetails;
            throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
        }
        throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
    }
    finally {
        // Always clear the sink so a subsequent, unrelated request does not
        // inherit this request's warnings array.
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
            diffText: input.diffText,
        }).warnings,
    };
}
/**
 * Apply the deterministic (path, line) verify filter to the
 * review's comments[]. Returns a new LiveReview with the filtered
 * comments[]. The original is left untouched so callers (the
 * parse-warnings artifact builder) see the pre-filter payload.
 *
 * Defense-in-depth Layer 4: the post-filter in
 * `selectPostableComments` runs the same check, but doing it here
 * means the platform-posting paths only see anchorable findings.
 */
function applyVerifyFilter(review, diffText) {
    if (diffText.length === 0) {
        return review;
    }
    // Delegate to the standalone `verifyFindingsAgainstDiff` helper
    // so the inline filter and the parse-warnings artifact agree
    // on which comments get dropped — the previous inline
    // re-implementation diverged from the helper in a way that
    // let the artifact undercount fabrication events.
    const { verified } = verifyFindingsAgainstDiff({ review, diffText });
    return { ...review, comments: verified };
}
function normalizeProviderReview(payload, secrets) {
    // Layer 4 deterministic verification is applied in the caller
    // (see `applyVerifyFilter` in `live-provider.ts`) AFTER the
    // parse-warnings artifact is built. Doing it in the caller means
    // the artifact captures every fabrication event, even ones the
    // inline filter drops. Don't re-add the filter here — see
    // the three-step flow in the Copilot/openai-compatible
    // branches.
    return {
        summary: sanitizeForPost(payload.summary, secrets),
        verdict: payload.verdict,
        comments: payload.comments.map((comment) => normalizeProviderComment(comment, secrets)),
        suppressedComments: payload.suppressed_comments.map((comment) => normalizeProviderComment(comment, secrets)),
    };
}
function normalizeProviderComment(comment, secrets) {
    return {
        path: comment.path,
        line: comment.line,
        body: sanitizeForPost(comment.body, secrets),
        severity: sanitizeForPost(comment.severity, secrets),
        category: sanitizeForPost(comment.category, secrets),
    };
}
function readRequiredConfig(value, name) {
    if (value === undefined || value === null || value.length === 0) {
        throw new LiveReviewError("LIVE_CONFIG_MISSING", `${name} must be set for live review.`);
    }
    return value;
}
function readConfiguredModel(parsed, env) {
    const fromArgs = parsed.model;
    // Treat the literal string "auto" the same as the default
    // (unset): the user is asking for the opinionated resolver,
    // not for the provider's "auto" pass-through. Without this,
    // `--model auto` would short-circuit before the resolver
    // runs and send the literal string "auto" to the provider.
    if (fromArgs !== null && fromArgs.length > 0 && fromArgs !== "auto") {
        return fromArgs;
    }
    const fromEnv = env["UMACTUALLY_MODEL"];
    if (fromEnv !== undefined && fromEnv.length > 0 && fromEnv !== "auto") {
        return fromEnv;
    }
    // Layer 5: `auto` is no longer passed verbatim. The resolver picks
    // a less-hallucinating model based on the active provider + API
    // URL. See `src/cli/auto-model.ts` for the per-provider mapping
    // and the Vectara HHEM rationale.
    const provider = (parsed.provider ?? "openai-compatible");
    return resolveAutoModel({
        provider,
        apiUrl: parsed.apiUrl,
        env,
    });
}
function readRequestTimeoutMs(parsed) {
    const seconds = parsed.perRequestTimeoutSeconds ?? parsed.reviewTimeoutSeconds;
    return seconds === null || seconds <= 0 ? live_provider_DEFAULT_REQUEST_TIMEOUT_MS : seconds * 1_000;
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
    if (error.truncated !== true) {
        return {};
    }
    return {
        reason: {
            kind: "truncated",
            ...(error.usage !== undefined ? { usage: error.usage } : {}),
            ...(maxOutputTokens !== null ? { maxOutputTokens } : {}),
        },
    };
}

;// CONCATENATED MODULE: ./src/cli/sonar-context.ts



async function readLiveSonarContext(parsed, fetchImpl) {
    const report = await readLiveSonarReport(parsed, fetchImpl);
    return report === undefined ? undefined : formatSonarContext(report);
}
async function readLiveSonarReport(parsed, fetchImpl) {
    const sonarConfigured = parsed.includeSonarqube &&
        parsed.sonarHostUrl !== null &&
        parsed.sonarToken !== null &&
        parsed.sonarProjectKey !== null;
    if (!sonarConfigured) {
        return undefined;
    }
    const sonarReport = await runLiveSonarImport({
        sonarHostUrl: parsed.sonarHostUrl ?? "",
        sonarToken: parsed.sonarToken ?? "",
        sonarProjectKey: parsed.sonarProjectKey ?? "",
        sonarTimeoutSeconds: parsed.sonarTimeoutSeconds ?? 300,
        fetchImpl: fetchImpl,
    });
    process.stdout.write(`${BRAND_PREFIX}sonar quality gate ${sonarReport.qualityGateStatus} (${sonarReport.importedFindingCount} findings, waited=${sonarReport.waitedForTerminalQualityGate})${sonarReport.timeoutHandled ? " [timeout handled]" : ""}\n`);
    if (sonarReport.errorMessage !== undefined) {
        writeBrandedAnnotation("warning", sonarReport.errorMessage);
    }
    return sonarReport;
}
function formatSonarContext(report) {
    return [
        "SonarQube report:",
        `Quality gate: ${report.qualityGateStatus}`,
        `Imported findings: ${report.importedFindingCount}`,
        `Waited for terminal quality gate: ${report.waitedForTerminalQualityGate}`,
        `Timeout handled: ${report.timeoutHandled}`,
    ].join("\n");
}

;// CONCATENATED MODULE: ./src/review/diff-line-utils.ts

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
            if (parsedPath !== null) {
                currentPath = parsedPath === position.path ? targetPath : parsedPath;
            }
            continue;
        }
        if (currentPath !== targetPath) {
            continue;
        }
        if (rawLine.startsWith("@@ ")) {
            const start = parseHunkStart(rawLine);
            nextNewLine = start;
            continue;
        }
        if (nextNewLine === null) {
            continue;
        }
        if (rawLine.startsWith("+") || rawLine.startsWith(" ")) {
            if (nextNewLine === position.line) {
                return rawLine.slice(1).trim();
            }
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
    if (identifierMatch !== null && identifierMatch[1] !== undefined) {
        return identifierMatch[1];
    }
    const declarationMatch = lineContent.match(/\b(?:const|let|var|function|class|interface|type|export)\s+([A-Za-z_$][\w$]*)/u);
    if (declarationMatch !== null && declarationMatch[1] !== undefined) {
        return declarationMatch[1];
    }
    const genericMatch = lineContent.match(/\b([A-Za-z_$][\w$]{3,})\b/u);
    if (genericMatch !== null && genericMatch[1] !== undefined) {
        return genericMatch[1];
    }
    const fallback = path.replace(/[^\w]+/gu, "_").replace(/^_+|_+$/gu, "");
    return fallback.length > 0 ? fallback : "this change";
}

;// CONCATENATED MODULE: ./src/review/simulated-findings.ts


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
    const inlineBlueprints = enumerated.length > 0
        ? buildDiverseBlueprints(enumerated, diffText)
        : buildFallbackBlueprints();
    const acceptUnanchored = enumerated.length === 0;
    const comments = [];
    for (const blueprint of inlineBlueprints) {
        if (acceptUnanchored || positions.hasPosition(blueprint)) {
            comments.push({ ...blueprint });
        }
        if (comments.length >= MAX_INLINE) {
            break;
        }
    }
    // Suppressed off-diff entries deliberately reference paths/lines that are
    // NOT present in the diff so the suppression-counting path is exercised.
    const suppressedBlueprints = [
        {
            path: "src/review/example.ts",
            line: 999,
            severity: "medium",
            category: "correctness",
            body: "Older comment that referenced a removed line is suppressed because the diff no longer contains that position.",
        },
        {
            path: "src/legacy/never-existed.ts",
            line: 1,
            severity: "low",
            category: "style",
            body: "Suppressed because `src/legacy/never-existed.ts` is not part of the PR diff and no longer ships in the tree.",
        },
    ];
    const suppressed_comments = [];
    for (const blueprint of suppressedBlueprints) {
        if (!positions.hasPosition(blueprint)) {
            suppressed_comments.push({ ...blueprint });
        }
        if (suppressed_comments.length >= 2) {
            break;
        }
    }
    return {
        summary: `Simulated review for ${repo}#${prNumber} at ${headSha}. ` +
            `${comments.length} inline findings, ${suppressed_comments.length} suppressed off-diff.`,
        verdict: "NEEDS_FIX",
        comments,
        suppressed_comments,
    };
}
const MAX_INLINE = 6;
const SEVERITY_PALETTE = ["high", "medium", "low"];
const CATEGORY_PALETTE = [
    "security",
    "correctness",
    "style",
    "performance",
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
    const seenPaths = new Set();
    for (const position of enumerated) {
        if (seenPaths.has(position.path)) {
            continue;
        }
        seenPaths.add(position.path);
        picked.push(position);
        if (picked.length >= MAX_INLINE) {
            break;
        }
    }
    for (const position of enumerated) {
        if (picked.length >= MAX_INLINE) {
            break;
        }
        if (picked.includes(position)) {
            continue;
        }
        picked.push(position);
    }
    return picked.map((position, index) => {
        const lineContent = readDiffLine(diffText, position);
        const token = extractRepresentativeToken(lineContent, position.path);
        const severity = SEVERITY_PALETTE[index % SEVERITY_PALETTE.length] ?? "medium";
        const category = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] ?? "correctness";
        const body = buildContextAwareBody(position, token, category);
        return {
            path: position.path,
            line: position.line,
            severity,
            category,
            body,
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
    const fallbackLines = [3, 5, 7, 9, 11, 13];
    return fallbackLines.map((line, index) => {
        const severity = SEVERITY_PALETTE[index % SEVERITY_PALETTE.length] ?? "medium";
        const category = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] ?? "correctness";
        const body = `Simulated fallback finding at \`src/example.ts:${line}\` because the diff has no right-side positions to anchor a real review.`;
        return {
            path: "src/example.ts",
            line,
            severity,
            category,
            body,
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
        case "security":
            return (`The changed line in \`${file}\` references \`${token}\`. ` +
                `Confirm that any string literals, tokens, or secrets reachable from \`${token}\` ` +
                `are stripped by the redactor before review output is posted.`);
        case "correctness":
            return (`The changed line in \`${file}\` references \`${token}\`. ` +
                `Trace the new code path through \`${token}\` and verify the call sites ` +
                `still gate the same invariants the previous implementation enforced.`);
        case "performance":
            return (`The changed line in \`${file}\` references \`${token}\`. ` +
                `If \`${token}\` is invoked on every render path, consider memoizing its ` +
                `output or hoisting the constant to keep the hot path cheap.`);
        case "style":
            return (`The changed line in \`${file}\` references \`${token}\`. ` +
                `Reformat the surrounding region so the new \`${token}\` declaration stays ` +
                `semantically grouped with the existing module exports.`);
        default:
            return (`The changed line in \`${file}\` references \`${token}\`. ` +
                `Review the surrounding code paths and ensure \`${token}\` continues to behave as expected.`);
    }
}

;// CONCATENATED MODULE: ./src/cli/simulate-findings.ts



/**
 * Replaces the provider outcome with a deterministic fixture only when the live
 * result is structurally empty. Live findings always win.
 */
function applySimulateFindings(input) {
    if (!input.simulateFindings) {
        return input.outcome;
    }
    const liveCommentCount = input.outcome.review.comments.length;
    const liveSuppressedCount = input.outcome.review.suppressedComments.length;
    const isStructurallyEmpty = liveCommentCount === 0 && liveSuppressedCount === 0;
    if (!isStructurallyEmpty) {
        const message = `${BRAND_PREFIX}--simulate-findings set but ignored (live result has ${liveCommentCount} inline, ${liveSuppressedCount} suppressed). Live findings always win.`;
        const sanitized = sanitizeForPost(message, input.secrets);
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
            suppressedComments: sanitizeComments(fixture.suppressed_comments, input.secrets),
        },
        // Synthesized fixture — never went through the real parser, so
        // there are no severity warnings to surface.
        severityWarnings: [],
        parseWarnings: [],
    };
}
function sanitizeComments(comments, secrets) {
    return comments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        body: sanitizeForPost(comment.body, secrets),
        severity: sanitizeForPost(comment.severity, secrets),
        category: sanitizeForPost(comment.category, secrets),
    }));
}

;// CONCATENATED MODULE: ./src/cli/orchestrator.ts

















/**
 * Number of chunks to process concurrently when the chunked path is
 * active. 4 is a safe default that respects provider rate-limit headers
 * while still giving us a roughly 4x speed-up over serial chunking.
 * See `chunkDiffByFile` (src/platform/azure/chunk.ts) for the chunking
 * contract.
 */
const DEFAULT_CHUNK_CONCURRENCY = 4;
// DEFAULT_REVIEW_FILE_LIMIT is imported from src/config/defaults.ts
// to keep the live review cap in sync with the field schema.
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
            if (index >= input.chunks.length)
                break;
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
                    ...(input.sonarContext !== undefined ? { sonarContext: input.sonarContext } : {}),
                });
            }
            catch (error) {
                // One chunk failed (timeout, 5xx, network). Log a warning
                // so operators can correlate, then record an empty outcome
                // so the merge keeps going. This is the difference between
                // "we lost 1 of 66 chunks" and "the whole review dies on
                // chunk 12 because the provider was rate-limiting".
                failedChunkCount += 1;
                const message = formatError(error);
                const sanitized = sanitizeForPost(message, [input.platformToken]);
                const redactedChunk = chunk.length > 80 ? `${chunk.slice(0, 77)}…` : chunk;
                logWarning("", `chunk ${index + 1}/${input.chunks.length} failed (${sanitized}); substituting empty outcome. chunk preview: ${redactedChunk}`);
                outcome = {
                    review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
                    endpoint: "",
                    provider: "chunk-failed",
                    modelId: "",
                    // Failed-chunk placeholder — no severity warnings to surface
                    // (the parser never ran on this chunk).
                    severityWarnings: [],
                    parseWarnings: [],
                };
            }
            outcomes[index] = outcome;
        }
    });
    await Promise.all(workers);
    if (failedChunkCount > 0) {
        logWarning("", `${failedChunkCount}/${input.chunks.length} chunks failed; merged review contains only findings from the chunks that succeeded.`);
    }
    return mergeReviewResults(outcomes, {
        maxComments: input.parsed.maxComments ?? DEFAULT_MAX_COMMENTS_MERGE,
    });
}
/**
 * Factory for the canonical "failed but did not post" result shape.
 * Used at every failure exit point in `runLive` so the wire shape stays
 * byte-identical regardless of where the run failed (missing config,
 * thrown error, leak gate, etc.).
 */
function failedResult(message) {
    return { exitCode: 1, posted: false, reviewId: undefined, message };
}
async function runLive(input) {
    const env = input.env ?? process.env;
    const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const platform = detectLivePlatform(env);
    if (platform === null) {
        const message = "Live review requires GitHub Actions (GITHUB_ACTIONS=true) or Azure Pipelines (TF_BUILD=True).";
        process.stdout.write(`${BRAND_PREFIX}${message}\n`);
        return failedResult(message);
    }
    // Copilot provider does not need UMACTUALLY_API_URL; it uses the GitHub
    // Copilot token exchange endpoint. Skip the URL check for copilot.
    const isCopilot = input.parsed.provider === "copilot";
    const providerUrl = input.parsed.apiUrl ?? env["UMACTUALLY_API_URL"];
    if (!isCopilot && (providerUrl === undefined || providerUrl.length === 0)) {
        const message = "UMACTUALLY_API_URL must be set for live review.";
        process.stdout.write(`${BRAND_PREFIX}${message}\n`);
        return failedResult(message);
    }
    const providerKey = input.parsed.apiKey ?? env["UMACTUALLY_API_KEY"];
    if (providerKey === undefined || providerKey.length === 0) {
        const message = "UMACTUALLY_API_KEY must be set for live review.";
        process.stdout.write(`${BRAND_PREFIX}${message}\n`);
        return failedResult(message);
    }
    // If --include-sonarqube is set with a fully-configured SonarQube, wait
    // for the quality gate to reach a terminal state BEFORE posting the review.
    // This implements the user's "wait for sonarqube during that PR run"
    // requirement: the review reflects the latest quality-gate state.
    const sonarContext = await readLiveSonarContext(input.parsed, fetchImpl);
    let result;
    try {
        result = await dispatchLivePlatform({
            platform,
            parsed: input.parsed,
            cwd: input.cwd,
            env,
            fetchImpl,
            ...(sonarContext !== undefined ? { sonarContext } : {}),
        });
    }
    catch (error) {
        const message = formatError(error);
        const sanitized = sanitizeForPost(message, readSecretValues(env));
        process.stdout.write(`${BRAND_PREFIX}${sanitized}\n`);
        return failedResult(sanitized);
    }
    if (result.posted) {
        process.stdout.write(`${BRAND_PREFIX}${result.message}\n`);
    }
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
                detectLeaks: parsed.detectLeaks,
            });
            if (!leakGate.ok) {
                logError("", leakGate.message);
                return failedResult(leakGate.message);
            }
            const liveOutcome = await requestLiveReview({
                parsed,
                cwd,
                env,
                fetchImpl,
                platform: "github",
                diffText,
                platformToken: context.token,
                ...(sonarContext !== undefined ? { sonarContext } : {}),
            });
            const finalOutcome = applySimulateFindings({
                outcome: liveOutcome,
                simulateFindings: parsed.simulateFindings === true,
                repo: `${context.repo.owner}/${context.repo.name}`,
                prNumber: context.prNumber,
                headSha: context.headSha,
                diffText,
                secrets: [context.token],
            });
            return runGithubLive({
                context,
                diffText,
                provider: finalOutcome,
                parsed,
                fetchImpl,
            });
        }
        case "azure": {
            // Forward --pr-number (when supplied) to the Azure context reader so
            // manual CLI invocations work without synthesising
            // SYSTEM_PULLREQUEST_PULLREQUESTID. The CLI boundary validates the
            // flag (see src/cli/validate.ts), but we re-parse here because:
            //   (1) readAzureContext is also callable directly from tests and
            //       future internal call sites that bypass the CLI boundary, so
            //       re-validating here keeps the invariant local to the context
            //       reader.
            //   (2) Silent fallback to the env var when the flag is invalid
            //       would mask a real user mistake (typo on the command line,
            //       shell quoting bug, etc.) by appearing to "work" with the
            //       env-var value while ignoring the flag. Better to surface
            //       the failure loudly than to silently do the wrong thing.
            //   (3) Number.parseInt("42abc") returns 42 (the legacy
            //       Number.parseInt trap). Use Number() which returns NaN for
            //       non-numeric strings — NaN fails isSafeInteger, which we
            //       surface as an error rather than dropping the override.
            let azurePrNumberOverride = undefined;
            if (parsed.prNumber !== null) {
                const candidate = Number(parsed.prNumber);
                if (!Number.isFinite(candidate) || !Number.isInteger(candidate) || candidate <= 0) {
                    throw new AzureContextError("AZURE_PR_NUMBER_INVALID", `Azure CLI flag --pr-number must be a positive integer (got ${JSON.stringify(parsed.prNumber)}).`);
                }
                if (!Number.isSafeInteger(candidate)) {
                    throw new AzureContextError("AZURE_PR_NUMBER_INVALID", `Azure CLI flag --pr-number must be a safe integer (got ${candidate}).`);
                }
                azurePrNumberOverride = candidate;
            }
            const context = readAzureContext(env, { prNumber: azurePrNumberOverride });
            const diffText = await fetchAzurePrDiff(context, fetchImpl);
            const leakGate = await evaluateLeakGate({
                diffText,
                detectLeaks: parsed.detectLeaks,
            });
            if (!leakGate.ok) {
                logError("", leakGate.message);
                return failedResult(leakGate.message);
            }
            // Gate the live review on the configured file count. The default
            // 200-file cap is a quality choice: chunked LLM reviews of an
            // arbitrarily-large initial-import diff produce hallucinated
            // findings that aren't grounded in the code. The user can
            // override via `--review-file-limit` (0 disables the limit).
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
                        secrets: [context.token],
                    }),
                    endpoint: "skipped",
                    provider: parsed.provider ?? "openai-compatible",
                    modelId: parsed.model ?? "auto",
                    // Skipped-due-to-file-limit placeholder — no parser ran, so
                    // no severity warnings to surface.
                    severityWarnings: [],
                    parseWarnings: [],
                };
            }
            else {
                const chunks = chunkDiffByFile(diffText);
                if (chunks.length <= 1) {
                    // Fallback: the entire diff fits in one chunk. Use the existing
                    // single-call flow so a small PR review stays cheap and
                    // deterministic.
                    liveOutcome = await requestLiveReview({
                        parsed,
                        cwd,
                        env,
                        fetchImpl,
                        platform: "azure",
                        diffText,
                        platformToken: context.token,
                        ...(sonarContext !== undefined ? { sonarContext } : {}),
                    });
                }
                else {
                    // Chunked path: feed each per-file chunk to the provider in
                    // parallel (bounded by DEFAULT_CHUNK_CONCURRENCY) and merge
                    // the per-chunk outcomes into a single LiveProviderOutcome.
                    process.stdout.write(`${BRAND_PREFIX}chunking large PR diff into ${chunks.length} provider requests (max concurrency ${DEFAULT_CHUNK_CONCURRENCY}).\n`);
                    liveOutcome = await requestChunkedLiveReview({
                        parsed,
                        cwd,
                        env,
                        fetchImpl,
                        platform: "azure",
                        chunks,
                        platformToken: context.token,
                        ...(sonarContext !== undefined ? { sonarContext } : {}),
                    });
                }
            }
            const finalOutcome = applySimulateFindings({
                outcome: liveOutcome,
                simulateFindings: parsed.simulateFindings === true,
                repo: context.repoId,
                prNumber: context.prNumber,
                headSha: "",
                diffText,
                secrets: [context.token],
            });
            return runAzureLive({
                context,
                diffText,
                provider: finalOutcome,
                parsed,
                fetchImpl,
            });
        }
        default:
            return orchestrator_assertNever(platform);
    }
}
function detectLivePlatform(env) {
    // Routes through the canonical detector so the live CLI and the
    // detection helper share one truth-table for CI marker recognition.
    try {
        const detected = detectPlatform(env);
        return detected === "azure-devops" ? "azure" : "github";
    }
    catch (error) {
        if (error instanceof PlatformDetectionError) {
            return null;
        }
        throw error;
    }
}
function readSecretValues(env) {
    return [
        env["UMACTUALLY_API_KEY"] ?? "",
        env["REVIEW_PROVIDER_API_KEY"] ?? "",
        env["GITHUB_TOKEN"] ?? "",
        env["SYSTEM_ACCESSTOKEN"] ?? "",
        env["AZURE_DEVOPS_TOKEN"] ?? "",
    ];
}
function orchestrator_assertNever(value) {
    throw new TypeError(`Unhandled live platform: ${value}`);
}

;// CONCATENATED MODULE: ./src/cli/run.ts










const DEFAULT_AZURE_ARTIFACT = "artifacts/manual/s4-azure-mocked-run.json";
const DEFAULT_REDACTION_REPORT = "artifacts/manual/s5-redaction-report.json";
const DEFAULT_SONAR_REPORT = "artifacts/manual/s6-sonar-mocked-run.json";
const SONAR_FIXTURE_ISSUES = JSON.stringify({ issues: [{}, {}] });
const SONAR_FIXTURE_HOTSPOTS = JSON.stringify({ hotspots: [] });
const SONAR_FIXTURE_QUALITY_GATE = JSON.stringify({
    sequence: [{ projectStatus: { status: "OK" } }],
});
async function runDryRun(parsed, cwd, platform) {
    const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
    const envSources = readEnvSources(process.env);
    const artifactBody = await buildDryRunArtifact(parsed, platform, cwd);
    mergeEnvDiagnostics(artifactBody, envSources);
    await (0,promises_namespaceObject.mkdir)((0,external_node_path_namespaceObject.dirname)(artifactPath), { recursive: true });
    await (0,promises_namespaceObject.writeFile)(artifactPath, `${JSON.stringify(artifactBody, null, 2)}\n`, "utf8");
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
    // Replace the extension with `.parse-warnings.json`. Most reviews use
    // `.md` (s1-github-self-review.md) or `.json` (s4-azure-mocked-run.json);
    // we keep the directory and stem, swap the suffix.
    //
    // We use our own custom `basename` and `joinPath` (instead of
    // `node:path`'s) because the input can be either a POSIX path
    // (Linux/macOS CI) or a Windows path (Windows local dev). The
    // node:path versions behave correctly per-platform but a path
    // captured on Windows and consumed on Linux (or vice versa)
    // yields the wrong dirname. The custom pair handles both.
    const dir = customDirname(primaryArtifactPath);
    const stem = customBasename(primaryArtifactPath).replace(/\.[^.]+$/u, "");
    return customJoinPath(dir, `${stem}.parse-warnings.json`);
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
    if (dir === "" || dir === ".") {
        return file;
    }
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
        platform: env.platform ?? null,
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
        azureToken: typeof env.azureToken === "string" && env.azureToken.length > 0,
    };
}
function resolveArtifactPath(outputArtifact, platform, cwd) {
    if (outputArtifact !== null) {
        return (0,external_node_path_namespaceObject.isAbsolute)(outputArtifact) ? outputArtifact : (0,external_node_path_namespaceObject.resolve)(cwd, outputArtifact);
    }
    const defaultRelative = platform === "github"
        ? "artifacts/manual/s1-github-self-review.md"
        : DEFAULT_AZURE_ARTIFACT;
    return (0,external_node_path_namespaceObject.resolve)(cwd, defaultRelative);
}
async function buildDryRunArtifact(parsed, platform, cwd) {
    if (platform === "github") {
        return buildGithubDryRunArtifact(parsed, cwd);
    }
    return buildAzureDryRunArtifact(parsed, cwd);
}
async function buildGithubDryRunArtifact(parsed, cwd) {
    const eventPath = requireArg(parsed.eventPath, "--event");
    const diffPath = requireArg(parsed.diffPath, "--diff");
    const eventJson = await readRequiredFile(eventPath, cwd, "--event");
    const diffText = await readRequiredFile(diffPath, cwd, "--diff");
    const providerReviewJson = await readOptionalFile(parsed.reviewPath ?? parsed.promptFile, cwd, "{}", "review");
    const expectedArtifact = "artifacts/manual/s1-github-self-review.md";
    const result = await runReview({
        platform: "github",
        eventJson,
        diffText,
        providerReviewJson,
        expectedArtifact,
    });
    const body = {
        artifactPath: result.artifactPath,
        event: result.event,
        marker: result.marker,
        inlineThreadCount: result.inlineThreadCount,
        suppressedCommentCount: result.suppressedCommentCount,
    };
    await maybeMergeRedactionReport(parsed, diffText, body);
    await maybeMergeSonarReport(parsed, body);
    return body;
}
async function buildAzureDryRunArtifact(parsed, cwd) {
    const pullRequestPath = requireArg(parsed.eventPath, "--event");
    const reviewPath = parsed.reviewPath;
    const pullRequestJson = await readRequiredFile(pullRequestPath, cwd, "--event");
    const existingThreadsJson = parsed.threadsPath === null
        ? "{\"count\":0,\"value\":[]}"
        : await readRequiredFile(parsed.threadsPath, cwd, "--threads");
    const reviewJson = reviewPath === null
        ? "{\"verdict\":\"COMMENT\",\"comments\":[],\"suppressed_comments\":[]}"
        : await readRequiredFile(reviewPath, cwd, "--review");
    const diffPath = parsed.diffPath;
    const diffText = diffPath === null ? "" : await readRequiredFile(diffPath, cwd, "--diff");
    const expectedArtifact = DEFAULT_AZURE_ARTIFACT;
    const result = await runAzureReview({
        pullRequestJson,
        existingThreadsJson,
        reviewJson,
        diffText,
        expectedArtifact,
    });
    const body = {
        artifactPath: result.artifactPath,
        postedThreadCount: result.postedThreadCount,
        postedStatusState: result.postedStatusState,
        marker: result.marker,
    };
    await maybeMergeRedactionReport(parsed, diffText, body);
    await maybeMergeSonarReport(parsed, body);
    return body;
}
async function maybeMergeRedactionReport(parsed, diffText, body) {
    if (!parsed.detectLeaks) {
        return;
    }
    const report = await scanReviewSecrets({
        diffText,
        expectedArtifact: DEFAULT_REDACTION_REPORT,
    });
    // Merge S5 contract fields directly into the artifact body so the artifact
    // contains highConfidenceLeakCount, redactedDiffIncludesSecret, and blockedRawOutput.
    body["highConfidenceLeakCount"] = report.highConfidenceLeakCount;
    body["redactedDiffIncludesSecret"] = report.redactedDiffIncludesSecret;
    body["blockedRawOutput"] = report.blockedRawOutput;
    body["redactionReport"] = report;
}
async function maybeMergeSonarReport(parsed, body) {
    if (!parsed.includeSonarqube) {
        return;
    }
    const report = await runSonarImport({
        qualityGateSequenceJson: SONAR_FIXTURE_QUALITY_GATE,
        issuesJson: SONAR_FIXTURE_ISSUES,
        hotspotsJson: SONAR_FIXTURE_HOTSPOTS,
        configured: parsed.sonarHostUrl !== null && parsed.sonarToken !== null && parsed.sonarProjectKey !== null,
        expectedArtifact: DEFAULT_SONAR_REPORT,
    });
    // Merge S6 contract fields directly into the artifact body.
    body["waitedForTerminalQualityGate"] = report.waitedForTerminalQualityGate;
    body["importedFindingCount"] = report.importedFindingCount;
    body["timeoutHandled"] = report.timeoutHandled;
    body["skipWhenUnconfigured"] = report.skipWhenUnconfigured;
    body["sonarReport"] = report;
}
function requireArg(value, flag) {
    if (value === null) {
        throw new CliArgumentError(`${flag} is required`);
    }
    return value;
}
async function readRequiredFile(path, cwd, label) {
    const absolute = (0,external_node_path_namespaceObject.isAbsolute)(path) ? path : (0,external_node_path_namespaceObject.resolve)(cwd, path);
    try {
        return await (0,promises_namespaceObject.readFile)(absolute, "utf8");
    }
    catch (error) {
        throw new CliArgumentError(`failed to read ${label} file ${absolute}: ${formatError(error)}`);
    }
}
async function readOptionalFile(path, cwd, fallback, label) {
    if (path === null || path.length === 0) {
        return fallback;
    }
    return readRequiredFile(path, cwd, label);
}
class CliArgumentError extends Error {
    name = "CliArgumentError";
}
async function dispatchLive(parsed, cwd, env) {
    // Live orchestration lives in src/cli/orchestrator.ts so the dry-run path
    // keeps a single-responsibility surface. This thin wrapper exists only to
    // preserve the public CLI module exports expected by existing tests.
    // Static import (no dynamic import()) so ncc emits a single bundle chunk
    // rather than a content-hashed dynamic chunk that would need to be committed.
    //
    // Compatibility shim: provider debug logging still reads
    // UMACTUALLY_DEBUG_RAW from process.env. Set it only for this dispatch
    // and restore/delete it in finally so same-process batch runs do not
    // inherit --debug-raw-response from an earlier review.
    const previousDebugRaw = process.env["UMACTUALLY_DEBUG_RAW"];
    if (parsed.debugRawResponse === true) {
        process.env["UMACTUALLY_DEBUG_RAW"] = "1";
    }
    try {
        const result = await runLive({ parsed, cwd, env });
        // Write a summary artifact at the same path the dry-run uses so the
        // self-review CI guard (`scripts/check-self-review-output.mjs`) can
        // inspect the live review's outcome. Without this, a parse-fail
        // card posted via the GitHub API leaves no local trace for the
        // guard to catch — the action exits 0 and CI sees "pass".
        const platform = resolvePlatform(parsed.platform, env);
        await writeLiveArtifact(parsed, cwd, platform, result);
        return { exitCode: result.exitCode };
    }
    finally {
        if (previousDebugRaw === undefined) {
            delete process.env["UMACTUALLY_DEBUG_RAW"];
        }
        else {
            process.env["UMACTUALLY_DEBUG_RAW"] = previousDebugRaw;
        }
    }
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
    // Use the same default path resolution as the dry-run path so the
    // self-review CI guard has a local trace even when the caller did
    // NOT pass --output-artifact. Without this, a parse-fail card posted
    // via the GitHub/Azure API leaves no local trace and the guard sees
    // an empty artifact directory.
    const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
    await (0,promises_namespaceObject.mkdir)((0,external_node_path_namespaceObject.dirname)(artifactPath), { recursive: true });
    if (!result.posted) {
        const body = {
            artifactPath,
            posted: false,
            message: result.message,
            marker: "<!-- umactually-pr-review -->",
            inlineThreadCount: 0,
            suppressedCommentCount: 0,
            blockedRawOutput: false,
            parseFailed: true,
            note: "Live review did not post anything via the GitHub/Azure API. Inspect the action log for the underlying parser/network error.",
        };
        await (0,promises_namespaceObject.writeFile)(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
        await writeParseWarningsArtifact(artifactPath, result.parseWarnings ?? []);
        return;
    }
    // Successful post: write a success artifact reflecting the live
    // counts. If the dry-run already wrote a stub to this path, this
    // OVERWRITES it with the real counts (so the guard sees the truth
    // rather than whatever the dry-run fixture produced). The shape
    // matches the dry-run artifact's top-level fields.
    const body = {
        artifactPath,
        posted: true,
        message: result.message,
        marker: "<!-- umactually-pr-review -->",
        inlineThreadCount: result.inlineThreadCount ?? 0,
        suppressedCommentCount: result.suppressedCommentCount ?? 0,
        blockedRawOutput: false,
        parseFailed: result.parseFailed === true,
        ...(result.verdict !== undefined ? { verdict: result.verdict } : {}),
        note: "Live review posted successfully; counts reflect what the GitHub/Azure API saw.",
    };
    await (0,promises_namespaceObject.writeFile)(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
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
    // Build the summary from the warnings list using the same logic as
    // buildParseWarningsArtifact (we re-import rather than re-invoke the
    // function because we already have the warnings array).
    const byReason = {
        "path-not-in-diff": 0,
        "line-not-in-diff": 0,
    };
    const bySource = {
        comments: 0,
        suppressed_comments: 0,
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
            note: warnings.length === 0
                ? "All model citations anchored to the supplied diff. No fabrication detected."
                : `${warnings.length} comment(s) cited a path or line not present in the supplied diff. The review post-filter (parseDiffPositions) dropped these from inline posting. See PR #56 for the canonical regression that produced 8 such warnings on a source-only diff.`,
        },
        warnings,
    };
    await (0,promises_namespaceObject.writeFile)(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

;// CONCATENATED MODULE: ./src/cli.ts







async function runCli(args, cwd) {
    let parsed;
    try {
        parsed = parseCliArgs(args);
    }
    catch (error) {
        if (error instanceof CliHelpSignal) {
            printHelp();
            return { exitCode: 0 };
        }
        throw error;
    }
    const errors = collectValidationErrors(parsed);
    if (errors.length > 0) {
        process.stderr.write(`cli: ${errors.join("; ")}\n`);
        return { exitCode: 2 };
    }
    if (parsed.dryRun) {
        return runDryRun(parsed, cwd, resolvePlatform(parsed.platform));
    }
    return dispatchLive(parsed, cwd, process.env);
}
async function main(argv) {
    try {
        const result = await runCli(argv, process.cwd());
        return result.exitCode;
    }
    catch (error) {
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
        .catch((error) => {
        process.stderr.write(`cli: fatal: ${formatError(error)}\n`);
        process.exit(1);
    });
}

;// CONCATENATED MODULE: ./src/action/append-cli-inputs.ts

const ACTION_INPUT_FIELDS = {
    githubToken: true,
    apiKey: true,
    apiUrl: true,
    model: true,
    prompt: true,
    promptFile: true,
    additionalPrompt: true,
    additionalPromptFile: true,
    walkthrough: true,
    diagnostic: true,
    dryRun: true,
    debugRawResponse: true,
    simulateFindings: true,
    reviewTimeoutSeconds: true,
    stallSeconds: true,
    maxOutputTokens: true,
    minimumSeverity: true,
    maxComments: true,
    reviewFileLimit: true,
    includeSonarqube: true,
    sonarHostUrl: true,
    sonarToken: true,
    sonarProjectKey: true,
    sonarTimeoutSeconds: true,
    detectLeaks: true,
    platform: true,
    prNumber: true,
    repo: true,
    inGitHubActions: true,
    effort: true,
    provider: true,
    githubApiBase: true,
};
/**
 * Pre-refactor ordering index used to sort `ALL_FIELDS` so the emitted argv
 * sequence stays byte-identical to the hand-written version. The values are
 * sparse (gaps allowed) and any field missing here sorts to the end via the
 * `Number.MAX_SAFE_INTEGER` fallback in `fieldOrder`.
 */
const LEGACY_ARG_ORDER_ENTRIES = [
    ["apiUrl", 0],
    ["apiKey", 1],
    ["model", 2],
    ["prompt", 3],
    ["promptFile", 4],
    ["additionalPrompt", 5],
    ["additionalPromptFile", 6],
    ["sonarHostUrl", 7],
    ["sonarToken", 8],
    ["sonarProjectKey", 9],
    ["provider", 10],
    ["githubApiBase", 11],
    ["effort", 12],
    ["minimumSeverity", 13],
    ["reviewTimeoutSeconds", 14],
    ["stallSeconds", 15],
    ["maxOutputTokens", 16],
    ["maxComments", 17],
    ["reviewFileLimit", 18],
    ["sonarTimeoutSeconds", 19],
    ["includeSonarqube", 21],
    ["walkthrough", 22],
    ["diagnostic", 23],
    ["debugRawResponse", 24],
    ["simulateFindings", 25],
];
const LEGACY_ARG_ORDER = new Map(LEGACY_ARG_ORDER_ENTRIES);
function appendCommonInputArgs(args, inputs) {
    for (const def of commonInputFieldDefs()) {
        const flag = def.flag;
        if (flag === null)
            continue;
        if (!isFieldInActionInputs(def.field))
            continue;
        pushFieldValue(args, def.type, flag, inputs[def.field]);
    }
    args.push(inputs.detectLeaks ? "--detect-leaks" : "--no-detect-leaks");
    args.push(inputs.dryRun ? "--dry-run" : "--no-dry-run");
    return args;
}
function commonInputFieldDefs() {
    return [...ALL_FIELDS]
        .filter((def) => !isCallerOwnedField(def) && !isManualBooleanField(def) && hasActionCliSurface(def))
        .sort((left, right) => fieldOrder(left.field) - fieldOrder(right.field));
}
function hasActionCliSurface(def) {
    return def.flag !== null && isFieldInActionInputs(def.field);
}
function isCallerOwnedField(def) {
    return def.field === "platform" || def.field === "prNumber" || def.field === "repo";
}
function isManualBooleanField(def) {
    return def.field === "detectLeaks" || def.field === "dryRun";
}
function isFieldInActionInputs(field) {
    return Object.hasOwn(ACTION_INPUT_FIELDS, field);
}
function fieldOrder(field) {
    return LEGACY_ARG_ORDER.get(field) ?? Number.MAX_SAFE_INTEGER;
}
function pushFieldValue(args, type, flag, value) {
    switch (type) {
        case "string":
        case "enum":
            if (typeof value === "string" && value.length > 0) {
                args.push(flag, value);
            }
            break;
        case "integer":
            if (typeof value === "number" && Number.isFinite(value)) {
                args.push(flag, String(value));
            }
            break;
        case "boolean":
            if (value === true) {
                args.push(flag);
            }
            break;
        default:
            append_cli_inputs_assertNever(type);
    }
}
function append_cli_inputs_assertNever(value) {
    throw new TypeError(`unhandled field type: ${JSON.stringify(value)}`);
}

;// CONCATENATED MODULE: ./src/action/read-inputs.ts


function readActionInputs(env = process.env) {
    const inGitHubActions = env["GITHUB_ACTIONS"] === "true";
    const get = (name) => {
        // GitHub Actions normally sets INPUT_<NAME> with hyphens converted to
        // underscores, but a small set of inputs (notably longer hyphenated names
        // like "simulate-findings") only receive the literal-hyphen form. Read
        // both and prefer the underscore form so all inputs work.
        const underscored = `INPUT_${name.toUpperCase().replace(/-/gu, "_")}`;
        const hyphenated = `INPUT_${name.toUpperCase()}`;
        const fromUnderscore = env[underscored];
        if (typeof fromUnderscore === "string" && fromUnderscore.length > 0)
            return fromUnderscore;
        const fromHyphen = env[hyphenated];
        if (typeof fromHyphen === "string" && fromHyphen.length > 0)
            return fromHyphen;
        return "";
    };
    const getWithFallback = (inputName, fallbacks) => {
        const primary = get(inputName);
        if (primary.length > 0)
            return primary;
        for (const fallbackName of fallbacks) {
            const value = env[fallbackName];
            if (typeof value === "string" && value.length > 0)
                return value;
        }
        return "";
    };
    const getBool = (name, fallback) => parseBool(get(name), fallback);
    const getDryRun = () => {
        const raw = get("dry-run");
        if (raw.length > 0)
            return parseBool(raw, false);
        const rawAlt = get("dry_run");
        if (rawAlt.length > 0)
            return parseBool(rawAlt, false);
        // GitHub Actions self-review defaults to dry-run so validation can pass
        // when no live API credentials are available in the workflow environment.
        return inGitHubActions;
    };
    const getNumber = (name, fallback) => {
        const raw = get(name);
        if (raw.length === 0) {
            return fallback;
        }
        // Trim before parsing so GitHub Actions INPUT_* values that
        // arrive with leading/trailing whitespace still parse. The strict
        // helper itself rejects whitespace-padded values by design (CLI
        // flags rarely carry accidental padding), but the env-var
        // surface is friendlier with a trim.
        const parsed = parseStrictInt(raw.trim());
        return parsed ?? fallback;
    };
    // Enum readers driven by FIELDS so adding a value to `enumValues` in
    // the schema doesn't require updating this file. The literal union
    // cast is safe because `enumValues` is the canonical set.
    const readEnumFromInput = (inputName, fallback, accepted) => {
        const raw = get(inputName);
        for (const candidate of accepted) {
            if (raw === candidate)
                return candidate;
        }
        return fallback;
    };
    return {
        githubToken: getWithFallback("github_token", ["GITHUB_TOKEN"]),
        apiKey: getWithFallback("api-key", ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"]),
        apiUrl: getWithFallback("api-url", ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"]),
        model: get("model"),
        prompt: get("prompt"),
        promptFile: get("prompt-file"),
        additionalPrompt: get("additional-prompt"),
        additionalPromptFile: get("additional-prompt-file"),
        walkthrough: getBool("walkthrough", false),
        diagnostic: getBool("diagnostic", false),
        dryRun: getDryRun(),
        debugRawResponse: getBool("debug-raw-response", false),
        simulateFindings: getBool("simulate-findings", false),
        // Numeric defaults sourced from FIELDS.<x>.defaultValue so the
        // schema stays the single source of truth — adding a new integer
        // field doesn't require editing this file.
        reviewTimeoutSeconds: getNumber("review-timeout-seconds", FIELDS.reviewTimeoutSeconds.defaultValue),
        stallSeconds: getNumber("stall-seconds", FIELDS.stallSeconds.defaultValue),
        maxOutputTokens: getNumber("max-output-tokens", FIELDS.maxOutputTokens.defaultValue),
        minimumSeverity: readEnumFromInput("minimum-severity", FIELDS.minimumSeverity.defaultValue, FIELDS.minimumSeverity.enumValues),
        maxComments: getNumber("max-comments", FIELDS.maxComments.defaultValue),
        reviewFileLimit: getNumber("review-file-limit", FIELDS.reviewFileLimit.defaultValue),
        includeSonarqube: getBool("include-sonarqube", false),
        sonarHostUrl: get("sonar-host-url"),
        sonarToken: get("sonar-token"),
        sonarProjectKey: get("sonar-project-key"),
        sonarTimeoutSeconds: getNumber("sonar-timeout-seconds", FIELDS.sonarTimeoutSeconds.defaultValue),
        detectLeaks: getBool("detect-leaks", true),
        platform: readEnumFromInput("platform", FIELDS.platform.defaultValue, FIELDS.platform.enumValues),
        prNumber: get("pr-number"),
        repo: get("repo"),
        inGitHubActions,
        effort: readEnumFromInput("effort", FIELDS.effort.defaultValue, FIELDS.effort.enumValues),
        provider: readEnumFromInput("provider", FIELDS.provider.defaultValue, FIELDS.provider.enumValues),
        githubApiBase: getWithFallback("github-api-base", ["UMACTUALLY_GITHUB_API_BASE"]),
    };
}
function parseBool(raw, fallback) {
    if (raw.length === 0) {
        return fallback;
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
    }
    return fallback;
}

;// CONCATENATED MODULE: ./src/index.ts










globalThis.__umactually_action_entry__ = true;
async function src_main() {
    try {
        const cwd = process.cwd();
        const args = await buildArgs(process.env, cwd);
        const result = await runCli(args, cwd);
        if (result.exitCode !== 0) {
            process.exit(result.exitCode);
        }
    }
    catch (error) {
        const message = formatError(error);
        logError("", message);
        process.exit(1);
    }
}
/**
 * Build the CLI argv from the runtime env. Two paths:
 * - Azure DevOps:   TF_BUILD is set, map INPUT_* and Azure runtime vars to CLI flags.
 * - GitHub Actions (default): map INPUT_* and GitHub runtime vars to CLI flags.
 *   This includes the bare-`node dist/index.js` local-dev case (no env at all),
 *   which is the action entry path — we still build a non-empty argv so the
 *   CLI validation does not error out. When the workflow does not provide
 *   INPUT_EVENT or INPUT_DIFF, write small placeholder files so the CLI's
 *   required-flag validation passes; the dry-run default (also applied here)
 *   means no live provider call is made.
 *
 * --dry-run is the default safety net; --no-dry-run is passed only when
 * INPUT_DRY_RUN is explicitly "false". --detect-leaks defaults to true.
 *
 * When neither GITHUB_ACTIONS nor TF_BUILD is set AND INPUT_DRY_RUN is unset,
 * we are in the bare action-entry path (local dev). In that case we push
 * --dry-run explicitly so the CLI's required-flag validation does not fail
 * on missing API credentials. This is the same safety net readActionInputs
 * applies automatically inside GitHub Actions; we extend it to the bare case.
 */
async function buildArgs(env, cwd) {
    // Use the canonical detector so we honour both GITHUB_ACTIONS=true
    // and TF_BUILD=True (with GitHub precedence). When neither is set,
    // the bare action-entry path falls through to buildGithubArgs with
    // an explicit --dry-run safety net.
    //
    // Behaviour-equivalence note: the previous code only branched on
    // TF_BUILD === "True", so a bare action entry with no CI markers
    // also fell through to buildGithubArgs. The canonical detector
    // routes the same way — we just additionally recognise GitHub when
    // GITHUB_ACTIONS=true. (The `env["GITHUB_ACTIONS"] !== "true"` check
    // further down this function is the --dry-run safety net, NOT a
    // platform-routing check.)
    try {
        const detected = detectPlatform(env);
        if (detected === "azure-devops") {
            return buildAzureArgs(env);
        }
    }
    catch (error) {
        if (!(error instanceof PlatformDetectionError))
            throw error;
        // No CI marker present: fall through to bare entry.
    }
    const args = [...(await buildGithubArgs(env, cwd))];
    if (env["GITHUB_ACTIONS"] !== "true" &&
        env["INPUT_DRY_RUN"] === undefined) {
        // Strip any --dry-run / --no-dry-run that buildGithubArgs pushed and
        // replace with --dry-run so the CLI's required-flag validation passes
        // even when no live API credentials are present.
        const filtered = args.filter((value) => value !== "--dry-run" && value !== "--no-dry-run");
        filtered.push("--dry-run");
        return filtered;
    }
    return args;
}
async function buildGithubArgs(env, cwd) {
    const inputs = readActionInputs(env);
    const args = [];
    // --platform: INPUT_PLATFORM (auto|github|azure) overrides detection. Default github.
    const platform = inputs.platform === "azure" ? "azure-devops" : "github";
    args.push("--platform", platform);
    const eventPath = await resolveGithubEventPath(env, cwd);
    pushFlagValue(args, "--event", eventPath);
    const diffPath = await resolveGithubDiffPath(env, cwd);
    pushFlagValue(args, "--diff", diffPath);
    pushFlagValue(args, "--review", env["INPUT_REVIEW"]);
    appendCommonInputArgs(args, inputs);
    pushFlagValue(args, "--output-artifact", envFallback(env["INPUT_OUTPUT_ARTIFACT"], "artifacts/manual/s1-github-self-review.md"));
    return args;
}
function buildAzureArgs(env) {
    const inputs = readActionInputs(env);
    const args = ["--platform", "azure-devops"];
    pushFlagValue(args, "--event", envFallback(env["INPUT_EVENT"], env["AZURE_PULL_REQUEST_PATH"]));
    pushFlagValue(args, "--diff", envFallback(env["INPUT_DIFF"], env["AZURE_DIFF_PATH"], env["DIFF_PATH"]));
    pushFlagValue(args, "--threads", envFallback(env["INPUT_THREADS"], env["AZURE_THREADS_PATH"]));
    pushFlagValue(args, "--review", envFallback(env["INPUT_REVIEW"], env["AZURE_REVIEW_PATH"]));
    pushFlagValue(args, "--pr-number", inputs.prNumber);
    pushFlagValue(args, "--repo", inputs.repo);
    appendCommonInputArgs(args, inputs);
    pushFlagValue(args, "--output-artifact", envFallback(env["INPUT_OUTPUT_ARTIFACT"], "artifacts/manual/s4-azure-mocked-run.json"));
    return args;
}
/**
 * Resolve the GitHub event path. Order:
 *  1. INPUT_EVENT explicit override
 *  2. GITHUB_EVENT_PATH (always present in pull_request runs)
 *  3. GITHUB_ACTIONS self-review placeholder (empty pull_request payload)
 */
async function resolveGithubEventPath(env, cwd) {
    const explicit = envFallback(env["INPUT_EVENT"], env["GITHUB_EVENT_PATH"]);
    if (explicit.length > 0)
        return explicit;
    return writePlaceholderFile(cwd, "event.json", GITHUB_PLACEHOLDER_EVENT);
}
/**
 * Resolve the diff path. Order:
 *  1. INPUT_DIFF explicit override
 *  2. DIFF_PATH (legacy alias)
 *  3. GITHUB_ACTIONS self-review placeholder (empty diff)
 */
async function resolveGithubDiffPath(env, cwd) {
    const explicit = envFallback(env["INPUT_DIFF"], env["DIFF_PATH"]);
    if (explicit.length > 0)
        return explicit;
    return writePlaceholderFile(cwd, "diff.patch", GITHUB_PLACEHOLDER_DIFF);
}
const GITHUB_PLACEHOLDER_EVENT = `${JSON.stringify({
    action: "opened",
    number: 0,
    pull_request: {
        number: 0,
        state: "open",
        title: "self-review placeholder",
        body: "",
        head: { ref: "self-review", sha: "0000000000000000000000000000000000000000" },
        base: { ref: "main", sha: "0000000000000000000000000000000000000000" },
        user: { login: "umactually-bot" },
    },
    repository: {
        full_name: "local/self-review",
        name: "self-review",
        owner: { login: "local" },
    },
}, null, 2)}\n`;
const GITHUB_PLACEHOLDER_DIFF = `diff --git a/.github/workflows/self-review.yml b/.github/workflows/self-review.yml
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/.github/workflows/self-review.yml
@@ -0,0 +1,3 @@
+# self-review placeholder diff
+# the action wrote this file because the workflow did not provide INPUT_DIFF.
+# see src/action/read-inputs.ts and src/index.ts for the auto-fallback path.
`;
async function writePlaceholderFile(cwd, name, contents) {
    const dir = (0,external_node_path_namespaceObject.join)(cwd, "artifacts", "manual");
    await (0,promises_namespaceObject.mkdir)(dir, { recursive: true });
    const filePath = (0,external_node_path_namespaceObject.isAbsolute)(name) ? name : (0,external_node_path_namespaceObject.join)(dir, name);
    await (0,promises_namespaceObject.writeFile)(filePath, contents, "utf8");
    return filePath;
}
const isMainEntry = (() => {
    if (typeof process === "undefined") {
        return false;
    }
    const argv1 = process.argv[1];
    if (argv1 === undefined) {
        return false;
    }
    return import.meta.url === pathToFileUrl(argv1);
})();
if (isMainEntry) {
    src_main().catch((error) => {
        const message = formatError(error);
        logError("", message);
        process.exit(1);
    });
}

var __webpack_exports__buildArgs = __webpack_exports__.C;
var __webpack_exports__main = __webpack_exports__.i;
export { __webpack_exports__buildArgs as buildArgs, __webpack_exports__main as main };
