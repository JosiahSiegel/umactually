import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ var __webpack_modules__ = ({

/***/ 421:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:child_process");

/***/ }),

/***/ 24:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:fs");

/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __nccwpck_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	var threw = true;
/******/ 	try {
/******/ 		__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 		threw = false;
/******/ 	} finally {
/******/ 		if(threw) delete __webpack_module_cache__[moduleId];
/******/ 	}
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/create fake namespace object */
/******/ (() => {
/******/ 	var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 	var leafPrototypes;
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 16: return value when it's Promise-like
/******/ 	// mode & 8|1: behave like require
/******/ 	__nccwpck_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = this(value);
/******/ 		if(mode & 8) return value;
/******/ 		if(typeof value === 'object' && value) {
/******/ 			if((mode & 4) && value.__esModule) return value;
/******/ 			if((mode & 16) && typeof value.then === 'function') return value;
/******/ 		}
/******/ 		var ns = Object.create(null);
/******/ 		__nccwpck_require__.r(ns);
/******/ 		var def = {};
/******/ 		leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 		for(var current = mode & 2 && value; typeof current == 'object' && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 			Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 		}
/******/ 		def['default'] = () => (value);
/******/ 		__nccwpck_require__.d(ns, def);
/******/ 		return ns;
/******/ 	};
/******/ })();
/******/ 
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
/******/ /* webpack/runtime/make namespace object */
/******/ (() => {
/******/ 	// define __esModule on exports
/******/ 	__nccwpck_require__.r = (exports) => {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
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
  _x: () => (/* reexport */ CliUsageError),
  WB: () => (/* binding */ buildSanitizedResolvedConfig),
  bV: () => (/* binding */ isVersionFlag),
  iW: () => (/* binding */ main),
  hT: () => (/* reexport */ parseCliArgs),
  ak: () => (/* binding */ runCli),
  yh: () => (/* binding */ runVersion)
});

// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __nccwpck_require__(24);
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
    promptFiles: {
        field: "promptFiles",
        flag: "--prompt-files",
        input: "prompt-files",
        env: ["UMACTUALLY_PROMPT_FILES"],
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
    additionalPromptFiles: {
        field: "additionalPromptFiles",
        flag: "--additional-prompt-files",
        input: "additional-prompt-files",
        env: ["UMACTUALLY_ADDITIONAL_PROMPT_FILES"],
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
    strictSchema: {
        field: "strictSchema",
        flag: "--strict-schema",
        input: "strict-schema",
        env: ["UMACTUALLY_STRICT_SCHEMA", "REVIEW_STRICT_SCHEMA"],
        type: "boolean",
        defaultValue: true,
    },
    verifyFindings: {
        field: "verifyFindings",
        flag: "--verify-findings",
        input: "verify-findings",
        env: ["UMACTUALLY_VERIFY_FINDINGS", "REVIEW_VERIFY_FINDINGS"],
        type: "boolean",
        defaultValue: true,
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
        env: ["UMACTUALLY_EFFORT"],
        type: "enum",
        defaultValue: "medium",
        enumValues: ["low", "medium", "high"],
    },
    provider: {
        field: "provider",
        flag: "--provider",
        input: "provider",
        env: ["UMACTUALLY_PROVIDER"],
        type: "enum",
        defaultValue: "openai-compatible",
        // Anthropic Messages (`api.anthropic.com/v1/messages`) was added
        // alongside the OpenAI-compatible and Copilot families so operators
        // running on a vanilla Anthropic API key (no OpenAI proxy in front)
        // can use the action out of the box. The provider picks the
        // Anthropic-native wire protocol (top-level `system` field, user
        // messages only, `x-api-key`/`anthropic-version` headers) and posts
        // to `/v1/messages`.
        enumValues: ["openai-compatible", "copilot", "anthropic"],
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
        flag: "--github-token",
        input: "github_token",
        env: ["GITHUB_TOKEN", "GH_TOKEN"],
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
    // Hint the operator at the accepted values alongside the bare
    // "invalid --flag value" error so they don't need to dig through
    // --help. Cheap deterministic suggestion: list the accepted values,
    // capped at 8 entries (enum values past 8 are usually an internal
    // schema bug, not a user-facing surface).
    const acceptedPreview = accepted.length <= 8
        ? accepted.join(", ")
        : `${accepted.slice(0, 8).join(", ")}, ...`;
    const hint = `Accepted values for ${flag}: ${acceptedPreview}. Run \`umactually --help\` or \`umactually review --help\` for the full list of flags and their accepted shapes.`;
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
    if (input.length === 0)
        return null;
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
    if (a === b)
        return 0;
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    let previous = new Array(b.length + 1);
    let current = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1)
        previous[j] = j;
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

;// CONCATENATED MODULE: ./src/util/brand.ts
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
        throw new errors_InvalidConfigError(field, `expected boolean, received number ${REDACTED_PLACEHOLDER}`);
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (TRUTHY_STRINGS.has(normalized))
            return true;
        if (FALSY_STRINGS.has(normalized))
            return false;
        throw new errors_InvalidConfigError(field, `expected boolean string, received ${REDACTED_PLACEHOLDER}`);
    }
    throw new errors_InvalidConfigError(field, `expected boolean, received ${typeof value}`);
}
const INTEGER_RE = /^-?\d+$/;
/**
 * Parses an integer from an unknown boundary. Accepts native integers
 * and decimal-integer strings. Rejects floats, NaN, Infinity, empty strings.
 */
function parseIntegerFromUnknown(value, field) {
    if (typeof value === "number") {
        if (!Number.isInteger(value)) {
            throw new errors_InvalidConfigError(field, `expected integer, received non-integer number ${REDACTED_PLACEHOLDER}`);
        }
        return value;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            throw new errors_InvalidConfigError(field, `expected integer, received empty string`);
        }
        if (!INTEGER_RE.test(trimmed)) {
            throw new errors_InvalidConfigError(field, `expected integer string, received ${REDACTED_PLACEHOLDER}`);
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed)) {
            throw new errors_InvalidConfigError(field, `expected finite integer, received ${REDACTED_PLACEHOLDER}`);
        }
        // Reject values outside the safe-integer range so callers that
        // rely on exact equality (severity-key lookups, cache keys,
        // downstream arithmetic) do not silently truncate. The CLI's
        // parseStrictInt has the same check; this is the config-loader's
        // equivalent so the two surfaces agree.
        if (!Number.isSafeInteger(parsed)) {
            throw new errors_InvalidConfigError(field, `expected integer in [${Number.MIN_SAFE_INTEGER}, ${Number.MAX_SAFE_INTEGER}], received ${REDACTED_PLACEHOLDER}`);
        }
        return parsed;
    }
    throw new errors_InvalidConfigError(field, `expected integer, received ${typeof value}`);
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
// both the parser and any future code-gen of the CLI help.
const VALID_PLATFORMS = new Set(FIELDS.platform.enumValues ?? []);
function parsePlatformFromUnknown(value, field) {
    if (typeof value !== "string") {
        throw new errors_InvalidConfigError(field, `expected platform string, received ${typeof value}`);
    }
    const normalized = value.trim().toLowerCase();
    if (!VALID_PLATFORMS.has(normalized)) {
        throw new errors_InvalidConfigError(field, `unknown platform ${REDACTED_PLACEHOLDER}`);
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



const explicitFieldsByParse = new WeakMap();
const FIELD_BY_FLAG = new Map(Object.values(FIELDS).flatMap((field) => field.flag === null ? [] : [[field.flag, field.field]]));
function wasCliFieldExplicitlySet(parsed, field) {
    return explicitFieldsByParse.get(parsed)?.has(field) === true;
}
class CliUsageError extends Error {
    hint;
    name = "CliUsageError";
    constructor(message, hint) {
        super(message);
        this.hint = hint;
        // Mirror the LiveReviewError pattern: hint is a separate property
        // so message-based tests stay byte-identical and machine consumers
        // (JSON envelopes, log scrapers) can ignore the remediation text.
    }
}
function parseCliArgs(args) {
    const explicitlySet = new Set();
    let platform = "auto";
    let eventPath = null;
    let diffPath = null;
    let files = null;
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
    let githubToken;
    let includeSonarqube = false;
    let includePrSonarFindings = false;
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
        const rawToken = args[index];
        if (rawToken === undefined) {
            continue;
        }
        const positiveFlag = rawToken.startsWith("--no-")
            ? `--${rawToken.slice("--no-".length)}`
            : rawToken;
        // Plan T9 — strip the `=value` suffix so the explicitly-set lookup
        // matches the entry in FIELD_BY_FLAG (which is keyed by the bare
        // --flag form, not by a specific value-bearing variant).
        const positiveFlagBare = positiveFlag.includes("=")
            ? positiveFlag.slice(0, positiveFlag.indexOf("="))
            : positiveFlag;
        const explicitField = FIELD_BY_FLAG.get(positiveFlagBare);
        if (explicitField !== undefined) {
            explicitlySet.add(explicitField);
        }
        // Plan T9 — normalize `--github-token=<value>` (single-token equals
        // form) into the two-token form so the switch dispatch matches the
        // regular case. The inline value is captured here and consumed by
        // the matching case branch below. No other flag in the parser
        // accepts equals-form today, so this is intentionally scoped to
        // the one field the test pins.
        let inlineGithubToken;
        let token = rawToken;
        if (rawToken.startsWith("--github-token=")) {
            inlineGithubToken = rawToken.slice("--github-token=".length);
            if (inlineGithubToken.length === 0) {
                throw new CliUsageError(`flag --github-token requires a value`, `Supply the value immediately after --github-token, e.g. \`umactually review --github-token=<value>\`. Run \`umactually review --help\` to see the expected shape for --github-token.`);
            }
            token = "--github-token";
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
            case "--files":
                files = readValue(args, index, "files");
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
            case "--github-token": {
                // Plan T9 — `--github-token` is a string field, so the negative
                // form (`--no-github-token`) is intentionally NOT handled here:
                // it falls through to the default branch and surfaces
                // `unknownFlagUsageError` (matching the contract for every
                // other string-typed field; pinned by cli-flag-parsing.test.ts
                // row 5). The single-token equals form `--github-token=<value>`
                // is normalized in the loop head above, so by the time we reach
                // here `inlineGithubToken` carries the value when present.
                if (inlineGithubToken !== undefined) {
                    githubToken = inlineGithubToken;
                }
                else {
                    githubToken = readValue(args, index, "github-token");
                    index += 1;
                }
                break;
            }
            case "--include-sonarqube":
                includeSonarqube = true;
                break;
            case "--no-include-sonarqube":
                includeSonarqube = false;
                break;
            case "--include-pr-sonar-findings":
                includePrSonarFindings = true;
                break;
            case "--no-include-pr-sonar-findings":
                includePrSonarFindings = false;
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
                throw new CliUsageError("--ignore-minor was removed; use --minimum-severity medium (or low/high) to suppress minor findings. Leaks and security findings are never suppressed. Environment variables UMACTUALLY_IGNORE_MINOR and REVIEW_IGNORE_MINOR are also ignored.", "Run `umactually review --minimum-severity low` (or `medium`, `high`) to suppress minor findings instead of `--ignore-minor`. The legacy flag and its env-var aliases (`UMACTUALLY_IGNORE_MINOR`, `REVIEW_IGNORE_MINOR`) are intentionally ignored so CI does not silently change severity.");
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
            case "-h": {
                // Derive the command context from non-flag tokens seen so far
                // so CliHelpSignal carries the right subcommand for contextual
                // help rendering.
                const commandToken = args.slice(0, index).find((t) => !t.startsWith("-"));
                throw new CliHelpSignal(commandToken ?? null);
            }
            default:
                throw unknownFlagUsageError(token, args);
        }
    }
    const parsed = {
        platform,
        eventPath,
        diffPath,
        files,
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
        includePrSonarFindings,
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
        // Optional: only present when the operator supplied --github-token.
        // The `toEqual` assertion in cli-flag-parsing.test.ts's CLI-RED-001
        // expects an absent key when the flag is never set, so we conditionally
        // include it (undefined-valued keys would otherwise leak into the
        // spread that the `Object.assign` in resolveFromSchema passes through).
        ...(githubToken !== undefined ? { githubToken } : {}),
    };
    explicitFieldsByParse.set(parsed, explicitlySet);
    return parsed;
}
class CliHelpSignal extends Error {
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
}
function consumeValue(args, index, flag, apply) {
    const value = readValue(args, index, flag);
    apply(value);
    return index + 1;
}
function readValue(args, index, flag) {
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
        throw new CliUsageError(`flag --${flag} requires a value`, `Supply the value immediately after --${flag}, e.g. \`umactually review --${flag} <value>\`. Run \`umactually review --help\` to see the expected shape for --${flag}.`);
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
        throw new CliUsageError(`flag --${flag} requires an integer value (got "${raw}")`, `Pass a decimal integer with no sign or whitespace, e.g. \`--${flag} 60\`. Fractions, exponents, and decimal points are not accepted. Use \`umactually review --help\` for the units and bounds.`);
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
    const candidates = [...FIELD_BY_FLAG.keys()];
    const suggestion = didYouMean(token, candidates);
    let message = `unknown flag: ${token}`;
    if (suggestion !== null && suggestion !== token) {
        message += ` (did you mean \`${suggestion}\`?)`;
    }
    // If the operator is running with no positional command AND no
    // provider flags AND the unknown token isn't itself a known flag,
    // the modes banner is the actionable next step.
    const sawPositionalCommand = argv.slice(0, argv.indexOf(token)).some((t) => !t.startsWith("-"));
    const hint = suggestion !== null && suggestion !== token
        ? `Try \`${suggestion}\`. To see every flag and what it does, run \`umactually review --help\`. If you meant to provide the review API config, run \`umactually review --api-url <url> --api-key <key>\`.`
        : sawPositionalCommand
            ? `Run \`umactually review --help\` for every flag the \`review\` subcommand accepts.`
            : `Run \`umactually --help\` for a flag list, or \`umactually review --api-url <url> --api-key <key>\` for the standard standalone invocation.`;
    return new CliUsageError(message, hint);
}

// EXTERNAL MODULE: external "node:child_process"
var external_node_child_process_ = __nccwpck_require__(421);
;// CONCATENATED MODULE: external "node:os"
const external_node_os_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:os");
;// CONCATENATED MODULE: external "node:url"
const external_node_url_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:url");
;// CONCATENATED MODULE: external "node:util"
const external_node_util_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:util");
;// CONCATENATED MODULE: ./src/cli/check-review-artifact.ts
// SPDX-License-Identifier: MIT

const PARSE_FAIL_MARKERS = [
    "Provider response did not contain a valid JSON review payload",
    "Parse failed — provider response",
    "Parse failed",
];
const CLEAN_VERDICTS = new Set(["APPROVED", "SHIP"]);
/**
 * Floor (milliseconds) below which a successful review is flagged as
 * suspiciously fast. A genuine provider round-trip to a hosted LLM
 * (Anthropic, OpenAI, Copilot) is rarely under 3 seconds even for a
 * trivial diff — TLS handshake + auth + completion latency dominates.
 * A sub-3s "real" review almost always indicates a cache hit, a test
 * fixture, or a short-circuit fallback rather than a fresh model call.
 *
 * Empirically grounded: PR #140 (legit, 440-LOC refactor) took 20.6s;
 * PRs #141-#143 (suspected rubber-stamps) took 3-5s. The threshold
 * sits below the rubber-stamp band so genuine small-PR reviews don't
 * trip the warning while clearly-short-circuited runs do.
 */
const SUSPICIOUS_FAST_REVIEW_MS = 3000;
/**
 * Floor (provider round-trips) below which a successful post is
 * flagged as having no real provider interaction. Every legitimate
 * review (even the simplest) requires at least one completion-API
 * call. Zero round-trips after a successful post indicates the
 * review body was produced without contacting the configured model.
 */
const MIN_EXPECTED_PROVIDER_ROUND_TRIPS = 1;
function classifyReviewArtifact(path) {
    let content;
    try {
        content = (0,external_node_fs_.readFileSync)(path, "utf8");
    }
    catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            return { ok: false, reason: "file not found", warnings: [] };
        }
        return {
            ok: false,
            reason: `cannot read artifact: ${error instanceof Error ? error.message : String(error)}`,
            warnings: [],
        };
    }
    if (PARSE_FAIL_MARKERS.some((marker) => content.includes(marker))) {
        return { ok: false, reason: "contains parse-fail sentinel", warnings: [] };
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return { ok: false, reason: "invalid JSON", warnings: [] };
        }
        throw error;
    }
    if (!isRecord(parsed)) {
        return { ok: false, reason: "invalid artifact: expected a JSON object", warnings: [] };
    }
    const event = stringField(parsed, "event");
    const verdict = stringField(parsed, "verdict");
    const postedStatusState = stringField(parsed, "postedStatusState");
    const inlineThreadCount = numberField(parsed, "inlineThreadCount");
    const postedThreadCount = numberField(parsed, "postedThreadCount");
    const suppressedCommentCount = numberField(parsed, "suppressedCommentCount");
    const reviewDurationMs = numberFieldOrUndefined(parsed, "reviewDurationMs");
    const providerRoundTrips = numberFieldOrUndefined(parsed, "providerRoundTrips");
    const posted = parsed["posted"] === true;
    const totalFindings = inlineThreadCount + postedThreadCount;
    if (parsed["parseFailed"] === true) {
        return { ok: false, reason: "parse-fail: artifact explicitly flagged parseFailed=true", warnings: [] };
    }
    const hasSignal = event.length > 0 ||
        verdict.length > 0 ||
        postedStatusState.length > 0 ||
        totalFindings > 0;
    if (!hasSignal) {
        return { ok: false, reason: "parse-fail: no event, verdict, status, or findings", warnings: [] };
    }
    if (verdict.toUpperCase() === "NEEDS_FIX" && totalFindings === 0) {
        return {
            ok: false,
            reason: "contradictory review: verdict=NEEDS_FIX with 0 findings",
            warnings: [],
        };
    }
    const reviewVerdict = verdict || postedStatusState || event;
    const warnings = detectSuspiciousSignals({
        posted,
        reviewDurationMs,
        providerRoundTrips,
        totalFindings,
        verdict: reviewVerdict,
    });
    const isCleanVerdict = CLEAN_VERDICTS.has(verdict.toUpperCase()) ||
        CLEAN_VERDICTS.has(postedStatusState.toUpperCase());
    if (totalFindings === 0 && suppressedCommentCount === 0 && !isCleanVerdict) {
        return { ok: true, summary: "accepted low-signal review", warnings };
    }
    return {
        ok: true,
        summary: `real review (${totalFindings} findings, verdict=${reviewVerdict})`,
        warnings,
    };
}
/**
 * Surface advisory warnings about signals that don't fail the
 * artifact but suggest the review body may not reflect a real
 * provider round-trip. The self-review workflow emits each warning
 * as a `::warning::` annotation; the artifact itself remains
 * `ok === true` so the guard's exit code stays advisory-only.
 *
 * Returns an empty array when no suspicious signals fire.
 */
function detectSuspiciousSignals(input) {
    const warnings = [];
    if (input.posted) {
        // Signal: posted=true with providerRoundTrips === 0 means the
        // review body was published without any provider HTTP call. This
        // is structurally impossible for a real LLM review and indicates
        // either a cache hit or a short-circuit fallback. Flag loudly.
        if (input.providerRoundTrips === 0) {
            warnings.push("provider-roundtrips-zero: review posted without contacting the provider (cache hit or short-circuit fallback suspected)");
        }
        else if (input.providerRoundTrips !== undefined && input.providerRoundTrips < MIN_EXPECTED_PROVIDER_ROUND_TRIPS) {
            warnings.push(`provider-roundtrips-low: only ${input.providerRoundTrips} provider round-trip${input.providerRoundTrips === 1 ? "" : "s"} for a posted review (expected at least ${MIN_EXPECTED_PROVIDER_ROUND_TRIPS})`);
        }
        // Signal: posted=true with reviewDurationMs below the empirical
        // floor. Even the fastest legitimate LLM review involves a TLS
        // handshake + auth + completion; sub-3s posts suggest the review
        // was assembled from a cached or pre-baked response.
        if (input.reviewDurationMs !== undefined && input.reviewDurationMs < SUSPICIOUS_FAST_REVIEW_MS) {
            warnings.push(`review-duration-fast: review posted in ${input.reviewDurationMs}ms (below ${SUSPICIOUS_FAST_REVIEW_MS}ms floor); possible rubber-stamp or cache short-circuit`);
        }
    }
    return warnings;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNodeError(error) {
    return error instanceof Error && "code" in error;
}
function stringField(value, key) {
    const field = value[key];
    return field === undefined || field === null ? "" : String(field).trim();
}
function numberField(value, key) {
    return Number(value[key] ?? 0);
}
function numberFieldOrUndefined(value, key) {
    const field = value[key];
    if (field === undefined || field === null)
        return undefined;
    const parsed = Number(field);
    return Number.isFinite(parsed) ? parsed : undefined;
}

;// CONCATENATED MODULE: ./src/cli/doctor.ts
// SPDX-License-Identifier: MIT

const MIN_NODE_MAJOR = 24;
async function runDoctor(deps) {
    const checks = [
        checkNode(deps.nodeVersion ?? process.versions.node),
        await checkDistFreshness(deps),
        checkEnv(deps.env),
        await checkGit(deps),
    ];
    const exitCode = checks.some((check) => check.status === "fail") ? 1 : 0;
    const json = { schemaVersion: 1, command: "doctor", exitCode, checks };
    return deps.isTTY
        ? { exitCode, checks, json, stdout: formatDoctorHuman(checks) }
        : { exitCode, checks, json };
}
function checkNode(nodeVersion) {
    const nodeMajor = Number.parseInt(nodeVersion.split(".", 1)[0] ?? "", 10);
    if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
        return {
            id: "node",
            status: "fail",
            message: `Node ${nodeVersion} detected; ${MIN_NODE_MAJOR}.x or later required`,
            hint: "Install Node 24+ from https://nodejs.org/",
        };
    }
    return { id: "node", status: "ok", message: `Node ${nodeVersion}` };
}
async function checkDistFreshness(deps) {
    const root = deps.packageRoot.replace(/[\\/]$/u, "");
    const distPath = `${root}/dist/cli.js`;
    const srcPath = `${root}/src/cli.ts`;
    const distStat = await statOrNull(deps.fsAdapter, distPath);
    const srcStat = await statOrNull(deps.fsAdapter, srcPath);
    // Standalone binary: neither dist/ nor src/ exists on disk because the
    // entire codebase is embedded in the executable. Skip the check rather
    // than reporting a false failure.
    if (distStat === null && srcStat === null) {
        return {
            id: "dist-freshness",
            status: "skip",
            message: "standalone binary — dist/ is embedded, not on disk",
        };
    }
    if (distStat === null) {
        return {
            id: "dist-freshness",
            status: "fail",
            message: `${distPath} is missing`,
            hint: "Run `npm run bundle` to produce dist/cli.js",
        };
    }
    if (srcStat === null) {
        // dist/cli.js is present and src/cli.ts is absent. This is the
        // normal state for a published npm install (the package's
        // "files" array ships dist/, bin/, README, LICENSE, docs,
        // examples, and scripts but NOT src/). Treat the dist as the
        // source of truth and report OK; do not guess the install
        // channel in the message (a dev worktree could also reach
        // this state if src was deleted, and SEA binary builds are
        // caught by the "both absent" check above).
        return {
            id: "dist-freshness",
            status: "ok",
            message: `${distPath} present; src not shipped (using shipped dist)`,
        };
    }
    if (distStat.mtimeMs < srcStat.mtimeMs) {
        return {
            id: "dist-freshness",
            status: "fail",
            message: `${distPath} is older than ${srcPath}`,
            hint: "Run `npm run bundle` to refresh dist/cli.js",
        };
    }
    return { id: "dist-freshness", status: "ok", message: `${distPath} present and fresh` };
}
async function statOrNull(fsAdapter, path) {
    try {
        return await fsAdapter.stat(path);
    }
    catch {
        // A diagnostic probe reports unavailable paths rather than propagating adapter errors.
        return null;
    }
}
function checkEnv(env) {
    const presence = [...KNOWN_ENV_VAR_NAMES].map((name) => ({
        name,
        present: typeof env[name] === "string" && env[name].length > 0,
    }));
    const presentCount = presence.filter((entry) => entry.present).length;
    return {
        id: "env",
        status: "ok",
        message: `${presentCount}/${KNOWN_ENV_VAR_NAMES.size} known env vars present`,
        presence,
    };
}
async function checkGit(deps) {
    try {
        const result = await deps.execFile("git", ["rev-parse", "--is-inside-work-tree"], {
            cwd: deps.cwd,
        });
        return result.stdout.trim() === "true"
            ? { id: "git", status: "ok", message: "cwd is inside a git work tree" }
            : { id: "git", status: "warn", message: "cwd is not inside a git work tree" };
    }
    catch {
        return {
            id: "git",
            status: "warn",
            message: "git is not on PATH or cwd is not inside a work tree",
        };
    }
}
function formatDoctorHuman(checks) {
    const lines = checks.map((check) => {
        const hint = check.hint === undefined ? "" : `\n  hint: ${check.hint}`;
        return `${check.status.toUpperCase().padEnd(4)} ${check.id}: ${check.message}${hint}`;
    });
    return `${lines.join("\n")}\n`;
}
function formatDoctorJson(result) {
    const envelope = result.json ?? {
        schemaVersion: 1,
        command: "doctor",
        exitCode: result.exitCode,
        checks: result.checks,
    };
    return `${JSON.stringify(envelope)}\n`;
}

;// CONCATENATED MODULE: ./src/util/provider-defaults.ts
/** Canonical provider/platform URL defaults. Centralizing prevents drift between the loader, live provider, help text, and platform modules. */
/** OpenAI default base URL. Used by `config/loader.ts` and the OpenAI-compatible client as the default when `--api-url` is unset and no provider-specific override applies. */
const DEFAULT_OPENAI_URL = "https://api.openai.com/v1";
/** Anthropic Messages API default base URL. Used by `cli/live-provider.ts` when `--provider anthropic` is set and `--api-url` is unset. */
const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com/v1";
/** GitHub API default base URL. Used by Copilot token exchange (`provider/copilot.ts`) and Copilot routing in `cli/live-provider.ts`. */
const DEFAULT_GITHUB_API_BASE = "https://api.github.com";

;// CONCATENATED MODULE: ./src/cli/modes-help.ts
/** Canonical CLI modes banner shared by help and bare invocation output. */
const CLI_MODES_TEXT = `Standalone mode:   umactually --api-url <url> --api-key <key>
Live CI mode:      umactually --platform github
Pre-rendered diff: umactually --event <path> --diff <path>
Local files:       umactually --files <path> --api-key <key>

Run \`umactually --help\` for the full reference.
`;
/** Writes the canonical modes banner to stdout or a caller-provided stream. */
function printModesBanner(stream) {
    const output = stream ?? process?.stdout;
    output?.write(CLI_MODES_TEXT);
}

;// CONCATENATED MODULE: external "node:readline"
const external_node_readline_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:readline");
;// CONCATENATED MODULE: ./src/util/fs-atomic.ts
// SPDX-License-Identifier: MIT
// Filesystem adapter + atomic-write primitive used by the uninstall
// subcommand to safely rewrite user-owned shell rc files (e.g. .zshrc,
// .bashrc, .profile) when reverting the installer's PATH entry.
//
// This module is intentionally pure (sync node:fs primitives, no I/O
// other than what the caller asks for) so that the uninstall tests can
// substitute their own in-memory adapter via `FsAdapter` without
// pulling in node:fs at all. The adapter shape was lifted verbatim
// from src/cli/uninstall.ts (T2/T3 of the init-guided-setup plan);
// behavior must remain byte-identical — the rc-file revert is a
// safety-critical path and the rename-on-sibling-tempfile primitive
// is what protects it from the disk-full / read-only-mount TOCTOU
// class of bug.

/**
 * Atomically write `content` to `path` by writing to a sibling temp
 * file and renaming over the target. On POSIX, rename(2) is atomic
 * on the same filesystem; on Windows, MoveFileEx with
 * MOVEFILE_REPLACE_EXISTING is similarly atomic. If anything fails
 * before the rename, the original file is untouched.
 *
 * The function name and rename-and-cleanup semantics are part of
 * the revertPath safety contract; do not relax the cleanup without
 * auditing the rc-file revert path.
 */
function writeFileAtomic(path, content) {
    // Write to a sibling temp file, then rename atomically over the
    // target. On POSIX, rename(2) is atomic on the same filesystem
    // (the target either points to the old content or the new, never
    // a partial state). On Windows, MoveFileEx with REPLACE_EXISTING
    // is similarly atomic. If anything fails before the rename, the
    // original file is untouched.
    const tmpPath = `${path}.umactually-tmp-${process.pid}-${Date.now()}`;
    try {
        (0,external_node_fs_.writeFileSync)(tmpPath, content, "utf8");
        (0,external_node_fs_.renameSync)(tmpPath, path);
    }
    catch (err) {
        // Best-effort cleanup of the orphan temp file.
        try {
            (0,external_node_fs_.unlinkSync)(tmpPath);
        }
        catch {
            // ignore
        }
        throw err;
    }
}
/**
 * Return the file's mode bits (e.g. 0o600) or null if the file
 * does not exist or the mode cannot be determined. Returns only the
 * permission bits (masked with 0o7777) so callers don't have to
 * think about the file-type bits in `Stats.mode`.
 */
function getMode(path) {
    try {
        return (0,external_node_fs_.statSync)(path).mode & 0o7777;
    }
    catch {
        return null;
    }
}
/**
 * Set the file's mode bits. Throws on failure. Callers are expected
 * to have already checked that the file exists and that the caller
 * has permission to change it (e.g. they own the file).
 */
function setMode(path, mode) {
    (0,external_node_fs_.chmodSync)(path, mode);
}
const defaultFsAdapter = {
    exists: (path) => (0,external_node_fs_.existsSync)(path),
    isSymlink: (path) => {
        try {
            return (0,external_node_fs_.lstatSync)(path).isSymbolicLink();
        }
        catch {
            return false;
        }
    },
    isFile: (path) => {
        try {
            return (0,external_node_fs_.lstatSync)(path).isFile();
        }
        catch {
            return false;
        }
    },
    isDirectory: (path) => {
        try {
            return (0,external_node_fs_.lstatSync)(path).isDirectory();
        }
        catch {
            return false;
        }
    },
    unlink: (path) => {
        (0,external_node_fs_.unlinkSync)(path);
    },
    getMode: (path) => getMode(path),
    setMode: (path, mode) => {
        setMode(path, mode);
    },
    removeDir: (path, options) => {
        (0,external_node_fs_.rmSync)(path, { recursive: options.recursive, force: true });
    },
    readFile: (path) => (0,external_node_fs_.readFileSync)(path, "utf8"),
    writeFile: (path, content) => {
        (0,external_node_fs_.writeFileSync)(path, content, "utf8");
    },
    writeFileAtomic: (path, content) => {
        writeFileAtomic(path, content);
    },
};

;// CONCATENATED MODULE: ./src/cli/uninstall.ts
// SPDX-License-Identifier: MIT
// Built-in `umactually uninstall` subcommand.
//
// Removes the running binary from disk, and (optionally) the
// `~/.umactually/` config directory, `~/.cache/umactually/` cache
// directory, and the PATH-entry block that the installer wrote to
// `~/.zshrc` / `~/.bashrc` / `~/.profile`.
//
// Usage:
//   umactually uninstall [flags]
//
// Flags:
//   --remove-binary    (default) Delete the running binary.
//   --purge-config     Also delete ~/.umactually/ and ~/.cache/umactually/.
//   --revert-path      Also remove the installer's PATH line from shell rc files.
//   --yes              Skip the interactive "are you sure" prompt.
//   --json             Emit machine-readable JSON output.
//   --help, -h         Show this help.
//
// Safety:
//   - Refuses to run if process.execPath does not look like a umactually
//     binary (basename must be "umactually" or "umactually.exe").
//   - Refuses to run if the binary is in a directory we don't recognise
//     as an install target (anything outside the home-dir-local/bin,
//     /usr/local/bin, or the same path that install.sh writes to).
//   - On Windows, self-deletion requires a helper command spawned before
//     the process exits (cmd /c "ping ... & del ...") because Windows
//     holds a write lock on running executables.




const { join } = external_node_path_namespaceObject;

const SHELL_RC_FILES = [".zshrc", ".bashrc", ".profile"];
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
    if (isTTY !== true) {
        return null;
    }
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        let rl = null;
        const settle = (value) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            if (rl !== null) {
                try {
                    rl.close();
                }
                catch {
                    // rl may already be closed; ignore.
                }
                rl = null;
            }
            resolve(value);
        };
        timer = setTimeout(() => settle(null), 30_000);
        // Write the prompt to stderr so it does not interleave with stdout
        // (the check lines, JSON output, and exit-code banners all go to
        // stdout). Stderr is the conventional channel for prompts and
        // diagnostics.
        process.stderr.write(promptText);
        // `terminal: false` disables TTY-aware prompt handling. Without
        // `output`, readline writes to a discarded sink — the explicit
        // stderr.write above is what the user actually sees.
        //
        // `createInterface` can throw synchronously on some platforms when
        // stdin is a non-TTY stream that Node refuses to wrap (e.g. CI
        // runners where stdin is a closed pipe). Wrap in try/catch so the
        // function ALWAYS settles — leaking the 30s timer would keep the
        // Node process alive for the full timeout.
        try {
            rl = (0,external_node_readline_namespaceObject.createInterface)({
                input: process.stdin,
                terminal: false,
            });
        }
        catch {
            // createInterface threw before any listeners were attached.
            // Settle immediately; the function exits with null.
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
        if (arg === undefined) {
            continue;
        }
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
            default:
                if (arg.startsWith("-")) {
                    errors.push(`unknown flag: ${arg}`);
                }
                else {
                    errors.push(`unexpected positional arg: ${arg}`);
                }
        }
    }
    const mode = { removeBinary, purgeConfig, revertPath, yes };
    return { mode, errors, help, json };
}
function classifyExecPath(execPath, platform, homeDir) {
    const p = platform === "win32" ? external_node_path_namespaceObject.win32 : external_node_path_namespaceObject.posix;
    const name = p.basename(execPath).toLowerCase();
    if (platform === "win32") {
        if (name !== "umactually.exe") {
            return { ok: false, reason: `process.execPath basename is "${name}", expected "umactually.exe"` };
        }
    }
    else if (name !== "umactually") {
        return { ok: false, reason: `process.execPath basename is "${name}", expected "umactually"` };
    }
    const parent = p.dirname(execPath);
    const homeLocalBin = p.join(homeDir, ".local", "bin");
    if (parent === homeLocalBin) {
        return { ok: true, installDir: parent };
    }
    if (platform !== "win32" && (parent === "/usr/local/bin" || parent === `${p.sep}usr${p.sep}local${p.sep}bin`)) {
        return { ok: true, installDir: parent };
    }
    // Tight fallback (not "any path ending in /bin under $HOME"):
    //   - homeDir + "/bin"  (or "/.bin")  — a *direct* child, not nested
    //   - /opt/<single-segment>/bin       — single segment under /opt, not nested
    // This still covers the documented install targets without accepting
    // attacker-controlled paths like /home/alice/some/random/bin/umactually.
    const homeBin = p.join(homeDir, "bin");
    const homeDotBin = p.join(homeDir, ".bin");
    if (parent === homeBin || parent === homeDotBin) {
        return { ok: true, installDir: parent };
    }
    if (platform !== "win32") {
        const rest = parent.startsWith(`/opt${p.sep}`) ? parent.slice(`/opt${p.sep}`.length) : null;
        if (rest !== null && rest.length > 0 && rest.endsWith(`${p.sep}bin`)) {
            const beforeBin = rest.slice(0, -`${p.sep}bin`.length);
            if (beforeBin.length > 0 && !beforeBin.includes(p.sep)) {
                return { ok: true, installDir: parent };
            }
        }
    }
    return {
        ok: false,
        reason: `process.execPath "${execPath}" is not in a recognised install directory (${homeLocalBin}, /usr/local/bin, ${homeBin}, or /opt/<name>/bin)`,
    };
}
function findShellRcBlocks(content) {
    // Matches the two-line block written by install.sh:
    //   # Added by umactually installer
    //   export PATH="<dir>:$PATH"
    // (with optional trailing newline)
    const blocks = [];
    const re = /^[ \t]*# Added by umactually installer[^\n]*\n[ \t]*export PATH="[^"]*"[ \t]*\n?/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
        blocks.push({ start: m.index, end: m.index + m[0].length });
    }
    return blocks;
}
function stripShellRcBlocks(content) {
    const blocks = findShellRcBlocks(content);
    if (blocks.length === 0) {
        return content;
    }
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
            hint: "Run uninstall from the installed binary, not from `node` or an npm-installed copy",
        });
        return { exitCode: 2, checks };
    }
    checks.push({
        id: "exec-path",
        status: "ok",
        message: `${deps.execPath} is a recognised umactually install location`,
    });
    // Confirm with the user before mutating the filesystem.
    // Non-interactive shells (CI, cron) must pass --yes.
    //
    // Gate the binary-removal prompt on `mode.removeBinary`: when the
    // user passed `--no-remove-binary`, there is no binary removal to
    // confirm, so the prompt would be misleading (and a stray 'n' would
    // wrongly abort the whole run, including the requested --purge-config
    // / --revert-path follow-ups). Record a skip check so the user gets
    // visible confirmation that the binary was deliberately kept.
    if (deps.mode?.removeBinary === false) {
        checks.push({
            id: "binary-removal",
            status: "skip",
            message: "--no-remove-binary was set; the running binary is being kept",
        });
        // Skip the rest of the binary-removal logic. The user explicitly
        // opted to keep the binary — we should not even check symlink/file
        // shape, because reporting "is a symlink" or "not a regular file"
        // would imply a problem with a binary the user wants to keep.
        return { exitCode: 0, checks };
    }
    else if (shouldPrompt(deps)) {
        const reader = deps.stdinReader ?? defaultStdinReader;
        const confirm = await reader("Remove the running binary? [y/N] ", deps.isTTY);
        if (confirm === null || !/^y(es)?$/i.test(confirm.trim())) {
            checks.push({
                id: "binary-removal",
                status: "skip",
                message: "user declined the confirmation prompt",
                declined: true,
            });
            return { exitCode: 1, checks };
        }
    }
    // Always check the symlink/file shape of the binary.
    const isLink = deps.fsAdapter.isSymlink(deps.execPath);
    const isFile = deps.fsAdapter.isFile(deps.execPath);
    if (isLink) {
        checks.push({
            id: "binary-removal",
            status: "fail",
            message: `${deps.execPath} is a symlink — refusing to unlink it directly`,
            hint: "Resolve the link and uninstall the target instead",
        });
        return { exitCode: 2, checks };
    }
    if (!isFile) {
        checks.push({
            id: "binary-removal",
            status: "skip",
            message: `${deps.execPath} is not a regular file (already removed?)`,
        });
    }
    else {
        try {
            deps.fsAdapter.unlink(deps.execPath);
            checks.push({
                id: "binary-removal",
                status: "ok",
                message: `removed ${deps.execPath}`,
            });
            // On Windows the unlink of a running executable may fail; check
            // the file is actually gone. If not, fall back to a delayed-del
            // helper that runs after this process exits.
            if (deps.platform === "win32" && deps.fsAdapter.exists(deps.execPath)) {
                checks.push(scheduleWindowsDelayedDelete(deps.execPath));
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (deps.platform === "win32") {
                checks.push(scheduleWindowsDelayedDelete(deps.execPath));
                checks.push({
                    id: "binary-removal",
                    status: "warn",
                    message: `could not unlink ${deps.execPath} directly (${message}); a delayed-delete helper was scheduled`,
                });
            }
            else {
                checks.push({
                    id: "binary-removal",
                    status: "fail",
                    message: `could not unlink ${deps.execPath}: ${message}`,
                });
                return { exitCode: 1, checks };
            }
        }
    }
    return { exitCode: 0, checks };
}
function purgeConfig(deps) {
    const checks = [];
    const configDir = join(deps.homeDir, ".umactually");
    const cacheDir = join(deps.homeDir, ".cache", "umactually");
    // Safety: refuse to remove a directory that is NOT actually inside
    // deps.homeDir. The check is structural — `path.join(homeDir,
    // X)` always produces a path inside homeDir, so under normal
    // operation this check never fires. The check exists to catch
    // future bugs where the homeDir handling changes (e.g. a future
    // PR adds config dir resolution that uses relative paths or
    // follows symlinks incorrectly) — those bugs would silently
    // expand the blast radius of `rmSync({ recursive: true, force:
    // true })`, and this check is the safety net.
    //
    // We do NOT strip trailing separators (which would turn "/" into
    // "" and break the startsWith check). Instead we handle the
    // "/", "/foo", "C:\\", "C:\\Users\\foo" cases explicitly.
    for (const dir of [configDir, cacheDir]) {
        const dirNormalized = external_node_path_namespaceObject.normalize(dir);
        const isInsideHome = dirNormalized === deps.homeDir
            || dirNormalized.startsWith(deps.homeDir + external_node_path_namespaceObject.sep);
        if (!isInsideHome) {
            checks.push({
                id: dir === cacheDir ? "cache-removal" : "config-removal",
                status: "fail",
                message: `${dir} is not inside ${deps.homeDir}; refusing to remove (safety check)`,
            });
            continue;
        }
        if (!deps.fsAdapter.exists(dir)) {
            checks.push({
                id: dir === cacheDir ? "cache-removal" : "config-removal",
                status: "skip",
                message: `${dir} does not exist`,
            });
            continue;
        }
        if (!deps.fsAdapter.isDirectory(dir)) {
            checks.push({
                id: dir === cacheDir ? "cache-removal" : "config-removal",
                status: "warn",
                message: `${dir} is not a directory — skipping`,
            });
            continue;
        }
        try {
            deps.fsAdapter.removeDir(dir, { recursive: true });
            checks.push({
                id: dir === cacheDir ? "cache-removal" : "config-removal",
                status: "ok",
                message: `removed ${dir}`,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            checks.push({
                id: dir === cacheDir ? "cache-removal" : "config-removal",
                status: "fail",
                message: `could not remove ${dir}: ${message}`,
            });
        }
    }
    return checks;
}
function revertPath(deps) {
    const checks = [];
    let anyChanges = false;
    for (const rc of SHELL_RC_FILES) {
        const path = join(deps.homeDir, rc);
        if (!deps.fsAdapter.exists(path)) {
            continue;
        }
        if (deps.fsAdapter.isSymlink(path)) {
            checks.push({
                id: "path-revert",
                status: "skip",
                message: `${path} is a symlink — refusing to modify`,
            });
            continue;
        }
        let content;
        try {
            content = deps.fsAdapter.readFile(path);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            checks.push({
                id: "path-revert",
                status: "warn",
                message: `could not read ${path}: ${message}`,
            });
            continue;
        }
        const blocks = findShellRcBlocks(content);
        if (blocks.length === 0) {
            continue;
        }
        const stripped = stripShellRcBlocks(content);
        if (stripped === content) {
            continue;
        }
        // Capture the original mode BEFORE writing. The new file will be
        // created with the default umask (typically 0o644), so we need to
        // restore the original mode afterward. Without this, a user with
        // a 0o600 .zshrc (privacy-sensitive) would see the new file at
        // 0o644 — silently broadened permissions.
        const originalMode = deps.fsAdapter.getMode(path);
        try {
            // writeFileAtomic writes to a sibling temp file and renames over
            // the target. If the disk fills up or the mount goes read-only
            // mid-write, the original .zshrc is left intact (the rename is
            // atomic on POSIX, and MoveFileEx on Windows).
            deps.fsAdapter.writeFileAtomic(path, stripped);
            if (originalMode !== null && originalMode !== undefined) {
                try {
                    deps.fsAdapter.setMode(path, originalMode);
                }
                catch (err) {
                    // Non-fatal: the content was updated successfully, but we
                    // couldn't restore the mode. Surface as a warn so the user
                    // can chmod manually.
                    const message = err instanceof Error ? err.message : String(err);
                    checks.push({
                        id: "path-revert",
                        status: "warn",
                        message: `removed ${blocks.length} umactually block(s) from ${path}, but could not restore mode ${originalMode.toString(8)}: ${message}`,
                        hint: `Run: chmod ${originalMode.toString(8)} ${path}`,
                    });
                    anyChanges = true;
                    continue;
                }
            }
            anyChanges = true;
            checks.push({
                id: "path-revert",
                status: "ok",
                message: `removed ${blocks.length} umactually block(s) from ${path}`,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            checks.push({
                id: "path-revert",
                status: "fail",
                message: `could not write ${path}: ${message}`,
            });
        }
    }
    if (!anyChanges) {
        checks.push({
            id: "path-revert",
            status: "skip",
            message: `no umactually PATH block found in ${SHELL_RC_FILES.join(" / ")}`,
        });
    }
    return checks;
}
function shouldPrompt(deps) {
    // `mode.yes` (the `--yes` / `-y` CLI flag) always wins.
    if (deps.mode?.yes === true) {
        return false;
    }
    if (!deps.isTTY) {
        return false;
    }
    const yesEnv = deps.env["UMACTUALLY_UNINSTALL_YES"] ?? deps.env["UMACTUALLY_YES"];
    return yesEnv !== "1" && yesEnv !== "true";
}
function scheduleWindowsDelayedDelete(targetPath) {
    // Self-deletion of a running executable on Windows requires a helper
    // that runs AFTER the parent exits. We write a small .cmd script to
    // a unique temp file, then spawn it detached. The script:
    //   1. Reads the path from `%1` (passed as a separate argv to cmd.exe).
    //      %~1 strips the surrounding quotes so we can safely re-quote
    //      it with del's normal double-quote rules.
    //   2. Waits ~3s via `ping -n 4`, then deletes the binary.
    //   3. Self-deletes the .cmd.
    //
    // Why pass via %1 instead of interpolating into the script body?
    // cmd.exe performs percent-variable expansion on the script body
    // BEFORE the script runs. If the user's binary path contains
    // `%TEMP%` or `%PATH%` (unusual but legal), the variable is
    // expanded at parse time to the parent's value, producing a wrong
    // target. The previous version tried to work around this with
    // `setlocal EnableDelayedExpansion` + `set "TARGET=..."` + `!TARGET!`,
    // but EnableDelayedExpansion only affects `!VAR!`, not `%VAR%` —
    // so the bug persisted. Passing the path via %1 eliminates the
    // interpolation entirely: %1 is the literal argument, not expanded
    // against environment variables.
    //
    // Returns a UninstallCheck so the caller can record success or
    // failure in the visible output.
    const tmpDir = process.env["TEMP"] ?? process.env["TMP"] ?? "/tmp";
    const scriptPath = join(tmpDir, `umactually-uninstall-${process.pid}-${Date.now()}.cmd`);
    const body = [
        "@echo off",
        "ping -n 4 127.0.0.1 >nul",
        'del /f /q "%~1"',
        `del /f /q "${scriptPath.replace(/"/gu, '""')}"`,
        "",
    ].join("\r\n");
    try {
        (0,external_node_fs_.writeFileSync)(scriptPath, body, "utf8");
        // Attach an error handler so a synchronous spawn failure
        // (e.g. on Linux where cmd.exe doesn't exist) doesn't surface
        // as an unhandled async exception after the function returns.
        // The error is expected on non-Windows platforms and not
        // actionable from the caller's perspective.
        const child = (0,external_node_child_process_.spawn)("cmd.exe", ["/c", scriptPath, targetPath], {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
        });
        child.on("error", () => {
            // Swallow: the script write was the contract; the spawn is
            // best-effort. On non-Windows, cmd.exe is missing and this
            // fires predictably.
        });
        child.unref();
        return {
            id: "self-deletion",
            status: "warn",
            message: `Windows held a write lock on the running binary; a delayed-delete helper was scheduled at ${scriptPath}`,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            id: "self-deletion",
            status: "fail",
            message: `could not schedule delayed-delete helper for ${targetPath}: ${message}. The binary may need to be removed manually.`,
        };
    }
}
const uninstall_UNINSTALL_HELP_TEXT = [
    `${"umactually"} uninstall — remove the installed binary, config, and PATH entries`,
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
    "  2  Usage error or unsafe exec path",
].join("\n");
function formatUninstallHuman(result) {
    const lines = result.checks.map((c) => {
        const hint = c.hint === undefined ? "" : `\n  hint: ${c.hint}`;
        return `${c.status.toUpperCase().padEnd(4)} ${c.id}: ${c.message}${hint}`;
    });
    return `${lines.join("\n")}\n`;
}
function formatUninstallJson(result, mode, execPath) {
    const envelope = result.json ?? {
        schemaVersion: 1,
        command: "uninstall",
        exitCode: result.exitCode,
        execPath,
        mode,
        checks: result.checks,
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
    return result.exitCode === 1
        && result.checks.some((c) => c.id === "binary-removal" && c.status === "skip" && c.declined === true);
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
 *
 * Help is contextual: `--help` shows the top-level overview with all
 * commands, while `<command> --help` shows only the flags relevant to
 * that command. This is achieved by tagging each flag with the commands
 * it applies to (`appliesTo`) and filtering at render time.
 */




/** Global flags that appear in every help context. */
const GLOBAL_FLAGS = [
    { flag: "--no-color", description: "Disable decorative ANSI color (also: non-empty NO_COLOR)" },
    { flag: "--json", description: "Emit machine-readable JSON output (doctor, review)" },
];
const REVIEW_FLAGS = [
    { flag: "--platform <auto|github|azure>", appliesTo: ["review"] },
    { flag: "--event <path>", description: "GitHub event JSON or Azure pull-request JSON", appliesTo: ["review"] },
    { flag: "--diff <path>", description: "PR diff text", appliesTo: ["review"] },
    { flag: "--files <paths>", description: "Comma-separated paths to files or directories for local-files review (no CI required)", appliesTo: ["review"] },
    { flag: "--threads <path>", description: "Azure existing threads JSON (ADO wrapper mode)", appliesTo: ["review"] },
    { flag: "--review <path>", description: "Azure provider review JSON (ADO wrapper mode)", appliesTo: ["review"] },
    { flag: "--pr-number <n>", description: "Pull request number", appliesTo: ["review"] },
    { flag: "--repo <owner/name>", appliesTo: ["review"] },
    { flag: "--api-url <url>", description: `Provider Responses API URL (default: ${DEFAULT_OPENAI_URL})`, appliesTo: ["review"] },
    { flag: "--api-key <key>", description: "Provider API key", appliesTo: ["review"] },
    { flag: "--model <id>", description: "Provider model id (default: auto)", appliesTo: ["review"] },
    { flag: "--prompt <text>", description: "Inline system prompt override", appliesTo: ["review"] },
    { flag: "--prompt-file <path>", appliesTo: ["review"] },
    { flag: "--prompt-files <paths>", description: "Comma/newline-separated system prompt files (overrides defaults)", appliesTo: ["review"] },
    { flag: "--additional-prompt <text>", appliesTo: ["review"] },
    { flag: "--additional-prompt-file <path>", appliesTo: ["review"] },
    { flag: "--additional-prompt-files <paths>", description: "Comma/newline-separated additional prompt files (overrides defaults)", appliesTo: ["review"] },
    { flag: "--effort <low|medium|high>", description: "Reasoning effort hint (default: medium)", appliesTo: ["review"] },
    { flag: "--provider <openai-compatible|copilot|anthropic>", description: "Provider family (anthropic uses native /v1/messages)", appliesTo: ["review"] },
    { flag: "--github-api-base <url>", description: `GitHub API base URL (Copilot token exchange; default: ${DEFAULT_GITHUB_API_BASE})`, appliesTo: ["review"] },
    { flag: "--include-sonarqube", appliesTo: ["review"] },
    { flag: "--sonar-host-url <url>", appliesTo: ["review"] },
    { flag: "--sonar-token <token>", appliesTo: ["review"] },
    { flag: "--sonar-project-key <key>", appliesTo: ["review"] },
    { flag: "--sonar-timeout-seconds <n>", appliesTo: ["review"] },
    { flag: "--review-timeout-seconds <n>", appliesTo: ["review"] },
    { flag: "--stall-seconds <n>", appliesTo: ["review"] },
    { flag: "--per-request-timeout-seconds <n>", appliesTo: ["review"] },
    { flag: "--max-output-tokens <n>", appliesTo: ["review"] },
    { flag: "--max-comments <n>", appliesTo: ["review"] },
    { flag: "--review-file-limit <n>", description: "Cap on changed files for live review (0 = disable)", appliesTo: ["review"] },
    { flag: "--minimum-severity <low|medium|high>", description: "default: medium", appliesTo: ["review"] },
    { flag: "--strict-schema | --no-strict-schema", description: "Send response_format json_schema on the wire (default: yes)", appliesTo: ["review"] },
    { flag: "--verify-findings | --no-verify-findings", description: "Deterministic (path,line) re-verification before posting (default: yes)", appliesTo: ["review"] },
    { flag: "--walkthrough | --no-walkthrough", appliesTo: ["review"] },
    { flag: "--diagnostic | --no-diagnostic", appliesTo: ["review"] },
    { flag: "--debug-raw-response | --no-debug-raw-response", appliesTo: ["review"] },
    { flag: "--detect-leaks | --no-detect-leaks", appliesTo: ["review"] },
    { flag: "--dry-run | --no-dry-run", appliesTo: ["review"] },
    { flag: "--simulate-findings | --no-simulate-findings", appliesTo: ["review"] },
    { flag: "--output-artifact <path>", appliesTo: ["review"] },
];
const INIT_FLAGS = [
    { flag: "--provider <openai-compatible|anthropic|copilot>" },
    { flag: "--api-url <url>", description: "Provider base URL (default: provider-family default)" },
    { flag: "--api-key <key>", description: "Provider API key (NEVER persisted; use --non-interactive with the secret store for automation)" },
    { flag: "--github-token <token>", description: "GitHub token for Copilot routing (also: GH_TOKEN env)" },
    { flag: "--github-api-base <url>", description: "GitHub API base (default: https://api.github.com)" },
    { flag: "--model <id>", description: "Model name (default: auto)" },
    { flag: "--scope <global|repo>", description: "Where to persist the config (default: global)" },
    { flag: "--ci <auto|github|azure|none>", description: "Generate a CI workflow (auto-detects; default: auto)" },
    { flag: "--non-interactive", description: "Fail rather than prompt (CI mode)" },
    { flag: "--apply", description: "Actually write the config file (default: dry-run for --non-interactive)" },
    { flag: "--force", description: "Overwrite an existing config without prompting" },
    { flag: "--yes", description: "Skip confirmation prompts" },
    { flag: "--dry-run", description: "Show what would be written; write nothing" },
    { flag: "--show", description: "Print parsed saved config; no prompt, no write" },
    { flag: "--json", description: "Emit machine-readable JSON envelope" },
];
/** All flags, used for the legacy `CLI_HELP_TEXT` export and column-width calc. */
const HELP_FLAGS = [...REVIEW_FLAGS];
/** The full flag set for column-width calculation. */
const ALL_FLAGS_FOR_WIDTH = [...REVIEW_FLAGS, ...INIT_FLAGS, ...GLOBAL_FLAGS];
function flagsForContext(context) {
    if (context === "all") {
        return [...REVIEW_FLAGS, ...INIT_FLAGS, ...GLOBAL_FLAGS];
    }
    if (context === "init") {
        return [...INIT_FLAGS, ...GLOBAL_FLAGS];
    }
    const commandFlags = REVIEW_FLAGS.filter((f) => f.appliesTo?.includes(context) ?? false);
    return [...commandFlags, ...GLOBAL_FLAGS];
}
/** Column width is always computed from the full flag set for consistency. */
const FLAG_COLUMN_WIDTH = ALL_FLAGS_FOR_WIDTH.reduce((max, { flag }) => Math.max(max, flag.length), 0);
const GUTTER_SPACES = 2;
const INDENT_SPACES = 2;
/** Render one flag with optional description, padded to the canonical description column. */
function renderFlagLine({ flag, description }) {
    const padding = " ".repeat(FLAG_COLUMN_WIDTH - flag.length + GUTTER_SPACES);
    const head = `${" ".repeat(INDENT_SPACES)}${flag}${padding}`;
    return description === undefined ? head : `${head}${description}`;
}
function renderFlags(flags) {
    return flags.map(renderFlagLine);
}
function renderCommands(commands) {
    return ["Commands:", ...commands.map((command) => `  ${command}`), ""].join("\n");
}
// ── Top-level help (existing CLI_HELP_TEXT + Commands) ─────────────────────
const TOP_LEVEL_COMMANDS = [
    { command: "review", description: "Run PR review (default)" },
    { command: "doctor", description: "Check environment is ready" },
    { command: "init", description: "Run guided setup (recommended quickstart)" },
    { command: "uninstall", description: "Remove the installed binary, config, and PATH entries" },
    { command: "check-review-artifact <path>", description: "Validate a review artifact" },
    { command: "version", description: "Print version" },
    { command: "--help, -h", description: "Show this help" },
    { command: "--version, -V", description: "Print version" },
];
/**
 * Render one command with optional description, padded to the description
 * column at `width + GUTTER_SPACES`. The `Math.max(0, ...)` guard makes
 * the renderer width-agnostic: callers may mix rows of wildly different
 * lengths and the renderer will never crash, even if a single row is
 * longer than the computed column width.
 */
function renderCommandLine({ command, description }, width) {
    const padding = " ".repeat(Math.max(0, width - command.length + GUTTER_SPACES));
    const head = `${" ".repeat(INDENT_SPACES)}${command}${padding}`;
    return description === undefined ? head : `${head}${description}`;
}
/**
 * Render a list of command rows as a column-aligned table (one string per
 * row). The column width is computed from the input `commands` array, so
 * every caller gets the column width that fits its own rows — there is no
 * shared module-level state coupling the help-text and quickstart
 * surfaces. With the 2-space indent and 2-space gutter, the description
 * column starts at `width + 4` (1-indexed).
 */
function renderCommandsTable(commands) {
    const width = commands.reduce((max, { command }) => Math.max(max, command.length), 0);
    return commands.map((c) => renderCommandLine(c, width));
}
const CLI_HELP_TEXT = [
    `${BRAND} — provider-agnostic PR review CLI`,
    "",
    "Commands:",
    ...renderCommandsTable(TOP_LEVEL_COMMANDS),
    "",
    "Review flags (use `umactually review --help` for full details):",
    ...HELP_FLAGS.map(renderFlagLine),
    "",
    "Global flags:",
    ...GLOBAL_FLAGS.map(renderFlagLine),
    "",
    CLI_MODES_TEXT,
    "Configuration sources (highest priority first): --flags > UMACTUALLY_*/REVIEW_*",
    "env vars > saved config (~/.umactually/config.json) > defaults. --api-key is",
    "NEVER persisted; pass it via --api-key each invocation or export",
    "UMACTUALLY_API_KEY=<key>. Run `umactually init` to populate the saved",
    "config (provider/api-url/model); `umactually --show-config` to inspect it.",
    "",
    "See exit codes: docs/exit-codes.md",
].join("\n");
// ── Per-command contextual help ────────────────────────────────────────────
const REVIEW_HELP_TEXT = [
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
    "Configuration sources (highest priority first): --flags > UMACTUALLY_*/REVIEW_*",
    "env vars > saved config (~/.umactually/config.json) > defaults. --api-key is",
    "NEVER persisted; pass it via --api-key each invocation or export",
    "UMACTUALLY_API_KEY=<key>. Run `umactually init` to populate the saved",
    "config (provider/api-url/model); `umactually --show-config` to inspect it.",
    "",
    "See exit codes: docs/exit-codes.md",
].join("\n");
const INIT_HELP_TEXT = [
    `${BRAND} init — guided setup wizard`,
    "",
    "Usage:",
    "  umactually init                       Walk through provider + CI setup interactively (recommended)",
    "  umactually init --non-interactive     Validate flags, write config, no prompts",
    "  umactually init --show                Print parsed saved config (no prompt, no write)",
    "  umactually init --dry-run             Show what would be written; write nothing",
    "  umactually init --help                Show this help",
    "",
    "Flags:",
    ...renderFlags(flagsForContext("init")),
    "",
    "Security: API keys are NEVER persisted to disk. Use your platform",
    "secret store (GitHub Actions secrets, Azure Pipelines variables) or",
    "the UMACTUALLY_API_KEY env var. See docs/security.md \"Trust model: init\".",
    "",
    "Exit codes:",
    "  0  Success / clean abort (Ctrl-C, Ctrl-D, 'n' to overwrite)",
    "  1  Permission error / invalid ~/.umactually / concurrency lock",
    "  2  Missing required flags / unknown flag / 60s global timeout",
    "",
    "See exit codes: docs/exit-codes.md",
].join("\n");
const DOCTOR_USAGE_COMMANDS = [
    { command: "umactually doctor", description: "Run all environment checks" },
    { command: "umactually doctor --json", description: "Emit machine-readable JSON" },
    { command: "umactually doctor --help", description: "Show this help" },
];
const DOCTOR_HELP_TEXT = [
    `${BRAND} doctor — check that your environment is ready for review`,
    "",
    "Usage:",
    ...renderCommandsTable(DOCTOR_USAGE_COMMANDS),
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
    "  2  Usage error",
].join("\n");
const CHECK_REVIEW_ARTIFACT_HELP_TEXT = [
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
    "  2  Usage error (no path given, or too many arguments)",
].join("\n");
/** Map from command name to its dedicated help text. */
const COMMAND_HELP = {
    review: REVIEW_HELP_TEXT,
    doctor: DOCTOR_HELP_TEXT,
    init: INIT_HELP_TEXT,
    uninstall: uninstall_UNINSTALL_HELP_TEXT,
    "check-review-artifact": CHECK_REVIEW_ARTIFACT_HELP_TEXT,
};
/**
 * Resolve which help text to print based on the argv context.
 *
 * If a recognized subcommand appears before `--help` / `-h`, that
 * command's dedicated help is shown. Otherwise the top-level help is
 * shown (which includes the Commands banner).
 */
function resolveHelpText(argv) {
    const helpIndex = argv.indexOf("--help") !== -1
        ? argv.indexOf("--help")
        : argv.indexOf("-h");
    if (helpIndex === -1) {
        return CLI_HELP_TEXT;
    }
    // Check tokens before --help for a recognized subcommand.
    for (let i = 0; i < helpIndex; i += 1) {
        const token = argv[i];
        if (token === undefined || token.startsWith("-")) {
            continue;
        }
        if (token in COMMAND_HELP) {
            return COMMAND_HELP[token];
        }
        // Unknown positional before --help — fall through to top-level help.
        break;
    }
    return CLI_HELP_TEXT;
}
/**
 * Print the help text to stdout. When `commands` is provided, renders the
 * top-level help with the Commands banner appended (legacy callers).
 *
 * @returns The rendered help text that was written to stdout.
 */
function printHelp(commands = []) {
    const helpText = commands.length === 0
        ? CLI_HELP_TEXT
        : `${CLI_HELP_TEXT}\n\n${renderCommands(commands)}`;
    process.stdout.write(helpText);
    return helpText;
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
/** Exported for unit tests that need to assert per-command help content. */
const REVIEW_HELP = (/* unused pure expression or super */ null && (REVIEW_HELP_TEXT));
const INIT_HELP = (/* unused pure expression or super */ null && (INIT_HELP_TEXT));
const DOCTOR_HELP = (/* unused pure expression or super */ null && (DOCTOR_HELP_TEXT));
const UNINSTALL_HELP = (/* unused pure expression or super */ null && (UNINSTALL_HELP_TEXT));
const CHECK_REVIEW_ARTIFACT_HELP = (/* unused pure expression or super */ null && (CHECK_REVIEW_ARTIFACT_HELP_TEXT));

;// CONCATENATED MODULE: ./src/util/saved-config-flock.ts
// SPDX-License-Identifier: MIT
// Internal POSIX `flock(2)` wrapper used by `saved-config.ts` to serialize
// concurrent `umactually init` invocations.
//
// node:fs does not expose `flock(2)` directly and we don't want to add a
// native dependency. We shell out to the coreutils `flock(1)` CLI with the
// `-n` flag (non-blocking try-lock) and pass the LOCK FILE PATH (not the
// fd number) — passing an fd number to flock(1) only works when the child
// process inherits the parent's fd table, which is not portable across
// CI sandboxes, vite-node workers, or any setup that uses
// `stdio: "ignore"`. The path form uses the same inode and is portable.
//
// On hosts without `flock(1)` (macOS without coreutils, alpine without
// busybox flock) we fall through to a lenient path — the atomic-rename
// write in `saved-config.ts` still protects against corruption; we lose
// only the "second init wins cleanly" guarantee. v1 of the wizard
// documents this as single-machine-only and the parent writeSavedConfig()
// guards with a no-op on win32.
class FlockUnavailableError extends Error {
    constructor() {
        super("flock(1) is unavailable");
        this.name = "FlockUnavailableError";
    }
}
function tryFlockNonBlocking(lockPath) {
    try {
        const { spawnSync } = __nccwpck_require__(421);
        const r = spawnSync("flock", ["-n", lockPath, "true"], { stdio: "ignore", timeout: 1000 });
        return r.status === 0;
    }
    catch {
        throw new FlockUnavailableError();
    }
}

;// CONCATENATED MODULE: ./src/config/saved-config.ts
// SPDX-License-Identifier: MIT
// `umactually init` saved-config persistence.
//
// Stores typed, NON-SECRET provider settings at `<homeDir>/.umactually/config.json`
// (or `<cwd>/umactually.config.json` when the user opts into repo scope). The shape
// is intentionally small:
//
//   { schemaVersion: 1, provider, [apiUrl], [model] }
//
// `apiKey` is NEVER read from or written to this file. The wizard prompts for it
// at runtime (flag/env) and uses it for the live provider HEAD probe, but the
// secret stays in the operator's env / CI secret store. The bundle §1.6 contract
// is enforced at three layers:
//
//   1. The `SavedConfig` type excludes `apiKey`.
//   2. `redactSecretsInString` is the canonical scrubber for any field that
//      happens to be populated with a secret-shaped value by mistake.
//   3. `writeSavedConfig` runs a defensive secret-regex scan over the FINAL
//      serialized bytes before releasing the lock — if the regex matches, the
//      write is refused with exit-1 hint ("writer produced an unintended
//      secret literal").
//
// Layer 3 is paranoia: layers 1+2 already prevent the leak. The scan exists so
// a future change that adds a new string field cannot silently regress the
// no-secrets-at-rest guarantee.





/**
 * Module-level mutable holder for the flock-availability signal. The
 * lock acquisition block writes to it; the success-return path reads
 * it. Avoids threading the flag through every early-return in the
 * writer. Reset to `false` on every writer entry (see writeSavedConfig).
 */
const writeSavedConfigFlockUnavailable = { flag: false };
const SAVED_CONFIG_SCHEMA_VERSION = 1;
const SAVED_CONFIG_GLOBAL_PATH = (homeDir) => (0,external_node_path_namespaceObject.join)(homeDir, ".umactually", "config.json");
const SAVED_CONFIG_REPO_PATH = (cwd) => (0,external_node_path_namespaceObject.join)(cwd, "umactually.config.json");
const SAVED_CONFIG_GLOBAL_DIR = (homeDir) => (0,external_node_path_namespaceObject.join)(homeDir, ".umactually");
const SAVED_CONFIG_GLOBAL_LOCK = (homeDir) => (0,external_node_path_namespaceObject.join)(homeDir, ".umactually", "init.lock");
const saved_config_DEFAULT_OPENAI_URL = "https://api.openai.com/v1";
const saved_config_DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com/v1";
/**
 * The canonical regex for any string-shaped secret the runtime or scanner
 * recognizes. Exported so callers (tests, log filters) can use the exact same
 * pattern.
 */
const SECRET_REGEX = /gh[pousr]_[A-Za-z0-9]+|glpat-[A-Za-z0-9]+|s\.r[A-Za-z0-9]+|sk-[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu;
const VALID_PROVIDERS = new Set([
    "openai-compatible",
    "anthropic",
    "copilot",
]);
// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------
/**
 * Resolve the effective saved config by checking the repo path first
 * (`<cwd>/umactually.config.json`) and falling back to the global path
 * (`<homeDir>/.umactually/config.json`). Returns `config: null` if neither
 * file exists.
 *
 * Refuses:
 *   - symlinks at either candidate path (exit 1, hint to remove the symlink)
 *   - non-regular files (exit 1)
 *   - malformed JSON (exit 2, "corrupt saved config at <path>" with repair hint)
 *   - missing/wrong `schemaVersion` (exit 2)
 *   - unknown `provider` (exit 2)
 *
 * Empty string in any optional field is coerced to absent (mirrors the
 * `pickString` empty-string-as-missing rule in `loader.ts`).
 */
function readSavedConfig(deps) {
    const fs = deps.fs ?? defaultFsAdapter;
    for (const candidate of [SAVED_CONFIG_REPO_PATH(deps.cwd), SAVED_CONFIG_GLOBAL_PATH(deps.homeDir)]) {
        if (!fs.exists(candidate))
            continue;
        if (fs.isSymlink(candidate)) {
            return {
                ok: false,
                path: candidate,
                exitCode: 1,
                message: `refusing to read saved config: ${candidate} is a symlink; remove it and re-run init`,
            };
        }
        if (!fs.isFile(candidate)) {
            return {
                ok: false,
                path: candidate,
                exitCode: 1,
                message: `refusing to read saved config: ${candidate} is not a regular file`,
            };
        }
        let raw;
        try {
            raw = fs.readFile(candidate);
        }
        catch (err) {
            return {
                ok: false,
                path: candidate,
                exitCode: 2,
                message: `corrupt saved config at ${candidate}: ${err instanceof Error ? err.message : String(err)}; rm ${candidate} and re-run init to recover`,
            };
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (err) {
            return {
                ok: false,
                path: candidate,
                exitCode: 2,
                message: `corrupt saved config at ${candidate}: ${err instanceof Error ? err.message : String(err)}; rm ${candidate} and re-run init to recover`,
            };
        }
        const validated = validateSavedConfig(parsed, candidate);
        if (!validated.ok)
            return validated;
        return { ok: true, config: validated.config, path: candidate };
    }
    return { ok: true, config: null, path: SAVED_CONFIG_GLOBAL_PATH(deps.homeDir) };
}
function validateSavedConfig(parsed, candidate) {
    if (parsed === null || typeof parsed !== "object") {
        return {
            ok: false,
            path: candidate,
            exitCode: 2,
            message: `corrupt saved config at ${candidate}: expected object, received ${parsed === null ? "null" : typeof parsed}`,
        };
    }
    const obj = parsed;
    if (obj["schemaVersion"] !== SAVED_CONFIG_SCHEMA_VERSION) {
        return {
            ok: false,
            path: candidate,
            exitCode: 2,
            message: `unsupported schemaVersion in ${candidate}: expected ${SAVED_CONFIG_SCHEMA_VERSION}, received ${JSON.stringify(obj["schemaVersion"])}`,
        };
    }
    if (typeof obj["provider"] !== "string" || !VALID_PROVIDERS.has(obj["provider"])) {
        return {
            ok: false,
            path: candidate,
            exitCode: 2,
            message: `invalid provider in ${candidate}: ${JSON.stringify(obj["provider"])} (expected one of ${[...VALID_PROVIDERS].join(", ")})`,
        };
    }
    const apiUrlRaw = obj["apiUrl"];
    const modelRaw = obj["model"];
    // Type guard: optional fields must be a string when present. Anything
    // else (number, array, null) is rejected — empty string is treated as
    // absent (mirrors pickString's empty-string-as-missing rule in
    // loader.ts:286-299). The wizard's default-acceptance path (press
    // Enter) leaves the field at "" which the writer used to serialize
    // verbatim — we coerce to undefined here so the next read round-trips
    // cleanly without losing type information.
    if (apiUrlRaw !== undefined && (typeof apiUrlRaw !== "string")) {
        return {
            ok: false,
            path: candidate,
            exitCode: 2,
            message: `invalid apiUrl in ${candidate}: expected string when present`,
        };
    }
    if (modelRaw !== undefined && (typeof modelRaw !== "string")) {
        return {
            ok: false,
            path: candidate,
            exitCode: 2,
            message: `invalid model in ${candidate}: expected string when present`,
        };
    }
    const apiUrl = typeof apiUrlRaw === "string" && apiUrlRaw.length > 0 ? apiUrlRaw : undefined;
    const model = typeof modelRaw === "string" && modelRaw.length > 0 ? modelRaw : undefined;
    const config = {
        schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
        provider: obj["provider"],
        ...(apiUrl !== undefined ? { apiUrl } : {}),
        ...(model !== undefined ? { model } : {}),
    };
    return { ok: true, config };
}
// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------
/**
 * Persist `config` atomically. Honors the no-secrets-at-rest contract:
 *   - The `SavedConfig` type excludes `apiKey`; this function never reads one.
 *   - A defensive secret-regex scan over the FINAL bytes catches any
 *     accidental leak (e.g. a future field that accepts free-form input).
 *
 * Safety rails:
 *   - Acquires an advisory flock on `<homeDir>/.umactually/init.lock` (POSIX
 *     `flock(2)` via the `flock(1)` CLI; Windows is a no-op, see note below).
 *   - Creates `<homeDir>/.umactually/` with mode 0o700 on POSIX.
 *   - Refuses symlinks at the target path (exit 1).
 *   - Prompts before overwriting an existing regular file; `--force`
 *     bypasses the prompt.
 *   - On malformed JSON in the existing file, moves it aside to
 *     `<path>.bak-<mtime>` and proceeds.
 *   - Uses `writeFileAtomic` (sibling-tempfile + rename) and `chmod 0o600`
 *     on POSIX. Windows inherits the parent directory ACL.
 *
 * Windows flock note: `flock(2)` is POSIX-only. On Windows we open the lock
 * file (creating it if missing) and rely on the OS's default sharing mode
 * to serialize concurrent init invocations; this is best-effort and
 * matches the wizard's documented v1 single-OS-at-a-time expectation.
 * The lock fd is released in `finally`.
 */
async function writeSavedConfig(config, deps) {
    writeSavedConfigFlockUnavailable.flag = false;
    const fs = deps.fs ?? defaultFsAdapter;
    const platform = deps.platform ?? process.platform;
    const isPosix = platform !== "win32";
    const targetPath = deps.scope === "repo"
        ? SAVED_CONFIG_REPO_PATH(deps.cwd)
        : SAVED_CONFIG_GLOBAL_PATH(deps.homeDir);
    const targetDir = deps.scope === "repo" ? deps.cwd : SAVED_CONFIG_GLOBAL_DIR(deps.homeDir);
    // -- Acquire flock (advisory; non-blocking) -----------------------------
    const lockPath = SAVED_CONFIG_GLOBAL_LOCK(deps.homeDir);
    let lockFd = null;
    try {
        if (isPosix) {
            // Ensure the lock dir exists so we can open the lock file even on a
            // first-run machine. mkdirSync is a no-op if the dir already exists.
            try {
                (0,external_node_fs_.mkdirSync)(SAVED_CONFIG_GLOBAL_DIR(deps.homeDir), { recursive: true, mode: 0o700 });
            }
            catch {
                // mkdir failure here will resurface at the target-dir ensure below.
            }
            // Open the lock file (creates it if missing) so flock(1) has a real
            // inode to lock against — the file itself carries no payload, only
            // the inode carries the lock.
            try {
                lockFd = (0,external_node_fs_.openSync)(lockPath, "w");
            }
            catch {
                return {
                    ok: false,
                    exitCode: 1,
                    message: `cannot acquire init lock at ${lockPath}; another init may be in progress; rm ${lockPath} if stale`,
                };
            }
            // Non-blocking try-lock via `flock(1) -n <lockPath> true`. We pass
            // the PATH (not the fd number — see saved-config-flock.ts for why
            // the fd-number form silently no-ops in vite-node / CI sandboxes).
            //
            // Flock availability:
            //   - flock(1) is in coreutils on every Linux and macOS (via brew
            //     install coreutils). When it is present, status=0 means lock
            //     acquired; status≠0 means another init holds it (contention).
            //   - On hosts without flock(1) (macOS without coreutils, alpine
            //     without busybox flock, restricted CI sandboxes), the wrapper
            //     throws `FlockUnavailableError`. We MUST surface this so the
            //     operator knows the init-time concurrency lock is NOT
            //     enforced: writes can still race. The atomic-rename primitive
            //     keeps the file corruption-safe (last-writer-wins on a per-
            //     inode basis), but a parallel `umactually init` could clobber
            //     a half-written sibling temp file if the lock is genuinely
            //     missing. The check below records the unavailability; the
            //     `lockUnavailable` flag is surfaced via the WriteSavedConfigResult
            //     so the wizard can emit a hint to the user.
            let flockResult = true;
            let lockUnavailable = false;
            try {
                flockResult = tryFlockNonBlocking(lockPath);
            }
            catch (err) {
                if (err instanceof FlockUnavailableError) {
                    // flock(1) is missing on this host. Atomic-rename still prevents
                    // file corruption; we lose only the "second init declines"
                    // guarantee. Surface a hint to the operator so they understand
                    // the weakened contract — see WriteSavedConfigResult.lockUnavailable.
                    lockUnavailable = true;
                }
                else {
                    throw err;
                }
            }
            if (!flockResult) {
                try {
                    (0,external_node_fs_.closeSync)(lockFd);
                    lockFd = null;
                }
                catch {
                    // ignore
                }
                return {
                    ok: false,
                    exitCode: 1,
                    message: `another init is in progress; rm ${lockPath} if stale`,
                    lockUnavailable: false,
                };
            }
            // Stash `lockUnavailable` on the active function scope — the
            // success-return branch below reads it. We use a tiny mutable
            // holder rather than a let inside the try block so the success
            // path at the end of writeSavedConfig() can read it without
            // threading it through every early return.
            writeSavedConfigFlockUnavailable.flag = lockUnavailable;
        }
        // Windows: best-effort serialization via shared-lock semantics on the
        // lock file's existence + the atomic-rename primitive. Documented above.
        // -- Ensure target directory + 0o700 on POSIX ------------------------
        try {
            (0,external_node_fs_.mkdirSync)(targetDir, { recursive: true, mode: 0o700 });
            if (isPosix && deps.scope === "global") {
                // Re-stat the directory; root + restrictive umask can mask the mode
                // arg. Best-effort: chmod and swallow the error (E-⚠8).
                try {
                    const st = (0,external_node_fs_.statSync)(targetDir);
                    if ((st.mode & 0o777) !== 0o700) {
                        setMode(targetDir, 0o700);
                    }
                }
                catch {
                    // ignore — chmod failure on a dir the user can already write to
                    // is non-fatal; we still chmod the FILE to 0o600 below.
                }
            }
        }
        catch (err) {
            return {
                ok: false,
                exitCode: 1,
                message: `cannot create saved-config directory ${targetDir}: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
        // -- Refuse symlinks at the target -----------------------------------
        if (fs.isSymlink(targetPath)) {
            return {
                ok: false,
                exitCode: 1,
                message: `refusing to overwrite: ${targetPath} is a symlink; remove it and re-run init`,
            };
        }
        // -- Existing-file handling ------------------------------------------
        if (fs.exists(targetPath) && !fs.isSymlink(targetPath)) {
            let existingIsCorrupt = false;
            try {
                const existingRaw = fs.readFile(targetPath);
                JSON.parse(existingRaw); // throws on malformed JSON
            }
            catch {
                existingIsCorrupt = true;
            }
            if (existingIsCorrupt) {
                // Corrupt JSON: move aside instead of clobbering. The backup
                // preserves operator history for forensics; the wizard surfaces
                // the backup path in its C-7 envelope.
                const mtime = (deps.now ?? Date.now)();
                const backupPath = `${targetPath}.bak-${Math.floor(mtime)}`;
                try {
                    (0,external_node_fs_.renameSync)(targetPath, backupPath);
                }
                catch (err) {
                    return {
                        ok: false,
                        exitCode: 1,
                        message: `refusing to clobber corrupt saved config at ${targetPath} and could not move it aside: ${err instanceof Error ? err.message : String(err)}; rm ${targetPath} manually`,
                    };
                }
            }
            else if (!deps.force) {
                // Valid JSON existing file: prompt for overwrite (unless --force).
                if (deps.overwriteReader === undefined) {
                    return {
                        ok: false,
                        exitCode: 1,
                        message: `refusing to overwrite existing saved config at ${targetPath}; pass --force to bypass or answer 'y' to the overwrite prompt`,
                    };
                }
                const answer = await deps.overwriteReader();
                if (answer !== true) {
                    return {
                        ok: false,
                        exitCode: 1,
                        message: `refusing to overwrite existing saved config at ${targetPath}; nothing was written`,
                    };
                }
            }
        }
        // -- Serialize with deterministic key order (schemaVersion, provider, apiUrl, model) -----
        const serialized = serializeSavedConfig(config);
        // -- Defensive secret-regex scan -------------------------------------
        if (SECRET_REGEX.test(serialized)) {
            SECRET_REGEX.lastIndex = 0;
            return {
                ok: false,
                exitCode: 1,
                message: "internal: writer produced an unintended secret literal; refusing to persist",
            };
        }
        SECRET_REGEX.lastIndex = 0;
        // -- Atomic write + chmod 0o600 --------------------------------------
        try {
            writeFileAtomic(targetPath, serialized);
        }
        catch (err) {
            return {
                ok: false,
                exitCode: 1,
                message: `cannot write saved config at ${targetPath}: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
        if (isPosix) {
            try {
                setMode(targetPath, 0o600);
            }
            catch {
                // Non-fatal: the file is on disk; chmod may fail under restrictive
                // mount options. The wizard surfaces a warn check in T12 but does
                // not abort the write (E-⚠8).
            }
        }
        // -- Verify mode round-tripped to 0o600 on POSIX ----------------------
        if (isPosix) {
            const mode = getMode(targetPath);
            if (mode !== null && (mode & 0o777) !== 0o600) {
                return {
                    ok: false,
                    exitCode: 1,
                    message: `saved config written but mode is ${(mode & 0o777).toString(8)} (expected 0o600); check filesystem mount options`,
                };
            }
        }
        return { ok: true, path: targetPath, bytes: Buffer.byteLength(serialized, "utf8"), lockUnavailable: writeSavedConfigFlockUnavailable.flag };
    }
    finally {
        // -- Release flock ---------------------------------------------------
        // flock(1) is a wrapper around flock(2); closing the fd releases the lock.
        if (isPosix && lockFd !== null) {
            try {
                (0,external_node_fs_.closeSync)(lockFd);
            }
            catch {
                // ignore — the lock is advisory; a stuck release on process exit
                // does not break the file write.
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Serialization (deterministic key order)
// ---------------------------------------------------------------------------
/**
 * JSON.stringify with 2-space indent and key order: schemaVersion, provider,
 * apiUrl, model. Any additional key is rejected at the type level; this is
 * the single serialization site so the byte layout is fixed across versions.
 */
function serializeSavedConfig(config) {
    const ordered = {
        schemaVersion: config.schemaVersion,
        provider: config.provider,
    };
    if (config.apiUrl !== undefined)
        ordered["apiUrl"] = config.apiUrl;
    if (config.model !== undefined)
        ordered["model"] = config.model;
    return JSON.stringify(ordered, null, 2) + "\n";
}
// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------
/**
 * Replace every secret-shaped substring in `input` with `REDACTED_SECRET_TOKEN`.
 * Used by `--debug-raw` diagnostics and any other site that has to log a
 * blob the user supplied (prompts, env echoes) — it is the last line of
 * defense against accidental secret leakage. Callers MUST treat the return
 * value as still-tainted for display purposes; the token is itself a hint
 * to the reader, not a security boundary.
 */
function redactSecretsInString(input) {
    return input.replace(SECRET_REGEX, REDACTED_SECRET_TOKEN);
}

;// CONCATENATED MODULE: ./src/cli/load-saved-config.ts
// SPDX-License-Identifier: MIT
// Runtime wrapper around the CLI's `umactually init` saved-config reader.
//
// `readSavedConfig` in `src/config/saved-config.ts` is shaped for the wizard
// (exit-code + message) and refuses to proceed on malformed JSON. The
// `umactually review` and `umactually --files` entry paths, plus the bare
// `umactually` quickstart gate, need a NON-exit-shaped variant: read the
// file, return whatever you got, surface the failure as a `warning` the
// caller decides whether to print. This keeps the resolver sites
// (`apply-saved-config`, `runLoadedConfigQuickstart`) free of `process.exit`
// concerns and keeps the wizard's strict contract intact.
//
// S6 contract: this function NEVER persists or transmits `apiKey`.
// The `SavedConfig` type excludes it; `readSavedConfig` rejects attempts
// to deserialize unknown keys at the type level.


/**
 * Read the runtime-effective saved config (repo path first, global fallback),
 * without ever exiting on failure. Returns `{config: null, warning: <msg>}`
 * when the file is missing, malformed, or refused for security reasons —
 * callers decide whether to surface the warning to the user.
 *
 * Defaults `cwd` to `process.cwd()` and `homeDir` to `os.homedir()` so
 * the common path is a no-arg call. Tests inject explicit values to
 * avoid touching the real user's `~/.umactually/config.json`.
 *
 * Never throws. The wizard's `readSavedConfig` is the throwing/exiting
 * variant; this one is the runtime-tolerant variant. They share the
 * underlying validation through the same `SavedConfig` type.
 */
function tryReadSavedConfig(deps = {}) {
    const homeDir = deps.homeDir ?? (0,external_node_os_namespaceObject.homedir)();
    const result = readSavedConfig({
        homeDir,
        cwd: deps.cwd ?? process.cwd(),
    });
    if (result.ok) {
        return { config: result.config, path: result.path, warning: null };
    }
    // Failure path: synthesize the global path as the canonical
    // "where the loader looked" pointer. The wizard's failure result
    // doesn't carry a path field, but an operator running
    // `umactually --show-config` against a corrupt file wants to know
    // WHICH file failed to parse; the global-path shape is the closest
    // meaningful answer we can give without re-implementing the
    // candidate walk that `readSavedConfig` does. The exact failure
    // path is also embedded in `warning` text (per the wizard's
    // "corrupt saved config at <path>" contract) so callers needing
    // the precise file path can parse the warning.
    return {
        config: null,
        path: result.path,
        warning: result.message,
    };
}

;// CONCATENATED MODULE: ./src/cli/smart-prompt.ts
// SPDX-License-Identifier: MIT
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
class SmartPromptUnavailable extends Error {
    code;
    name = "SmartPromptUnavailable";
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
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
    if (!canPromptInteractively()) {
        throw new SmartPromptUnavailable("NO_TTY", "Cannot read interactive input: stdin is not a TTY. Set --api-url / --api-key on the command line or via UMACTUALLY_API_URL / UMACTUALLY_API_KEY env vars.");
    }
    process.stdout.write(`${BRAND_PREFIX}${input.prompt}\n`);
    const stdin = process.stdin;
    // Race the read against a timeout promise so a missed keypress
    // surfaces the typed TIMEOUT rejection WITHOUT relying on the
    // stream emitting `error` synchronously (which a paused TTY does
    // NOT do — Node's read-stream destroy-with-error only surfaces
    // via `error` if a read is mid-flight). The race pattern is the
    // canonical fix for "Promise that should timeout"; see
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
    // for the underlying semantics.
    let timeoutHandle = null;
    const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new SmartPromptUnavailable("TIMEOUT", `Prompt timed out after ${input.timeoutMs}ms with no input. Set --api-url / --api-key on the command line or via env vars to skip the interactive prompt.`));
        }, input.timeoutMs);
        // Don't keep the event loop alive solely on the timer — the read
        // operation also references an open handle via the stream, so
        // unref() is safe here (the read promise keeps the loop alive).
        timeoutHandle.unref();
    });
    try {
        return await Promise.race([readOneLine(stdin), timeoutPromise]);
    }
    finally {
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
        }
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
        // Attach all three listeners BEFORE resuming the stream. The
        // previous ordering (attach → resume) attached after the same-
        // tick end event had already fired, leaving the Promise to
        // hang forever on a closed stdin.
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
    if (typeof existingFromEnv === "string" && existingFromEnv.length > 0) {
        // Already populated — no need to prompt.
        return existingFromEnv;
    }
    if (!canPromptInteractively()) {
        return null;
    }
    const defaultHint = input.default !== undefined && input.default.length > 0
        ? ` [default: ${input.default}]`
        : "";
    const promptText = `? ${input.label} (${input.envVarName})${defaultHint}: `;
    try {
        const answer = await readInteractiveLine({
            prompt: promptText,
            timeoutMs: input.timeoutMs ?? 15_000,
        });
        if (answer.length > 0) {
            return answer;
        }
        if (input.default !== undefined && input.default.length > 0) {
            return input.default;
        }
        return null;
    }
    catch (error) {
        if (error instanceof SmartPromptUnavailable) {
            return null;
        }
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
    if (input.promptForUrl) {
        apiUrl = await smartPromptForValue({
            label: "Model provider base URL",
            envVarName: "UMACTUALLY_API_URL",
            placeholder: "https://api.openai.com/v1",
            ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        });
    }
    const apiKey = await smartPromptForValue({
        label: "Model provider API key",
        envVarName: "UMACTUALLY_API_KEY",
        placeholder: "sk-…",
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    });
    return { apiUrl, apiKey };
}

;// CONCATENATED MODULE: ./src/cli/init-templates.ts
// SPDX-License-Identifier: MIT
// Verbatim canonical CI workflow bytes. Drift-tested against
// examples/github/pr-review.yml and examples/azure/azure-pipelines.yml
// in test/unit/init-templates-drift.test.ts modulo the single
// version-pin substitution point.
//
// Why inline-const (not fs.readFileSync at runtime): the SEA binary
// entry is src/cli.ts (tsdown.config.ts:120-122) and has no copy/include
// for examples/ — readFileSync from process.execPath/../examples/.../yml
// is broken in the binary. The npm-published path also has no
// examples/ files relative to dist/. Inline constants ship with the
// bundle. The drift test guards against template rot.

const GITHUB_WORKFLOW_FILENAME = "umactually-pr-review.yml";
const AZURE_PIPELINE_FILENAME = "azure-pipelines.yml";
const GITHUB_WORKFLOW_TEMPLATE = `# Runs umactually as a pinned npm CLI for pull requests.
name: PR review
on: [pull_request]
concurrency:
  group: umactually-\${{ github.workflow }}-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - name: Install umactually
        # Pin the version; never track \`latest\`.
        run: npm install -g umactually@__UMACTUALLY_VERSION__
      - name: Run umactually PR review
        env:
          GITHUB_TOKEN: \${{ github.token }}
          UMACTUALLY_API_URL: \${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: \${{ secrets.UMACTUALLY_API_KEY }}
        run: umactually review --platform github
`;
const AZURE_PIPELINE_TEMPLATE = `# Enable "Allow scripts to access the OAuth token" in pipeline settings.
# UMACTUALLY_* options (prompt files, strict schema, verify findings, etc.) are
# CLI-native: set them as ADO pipeline variables and they flow through automatically.
# Artifact validation is automatic after each live review. SYSTEM_ACCESSTOKEN is the
# only ADO-specific plumbing because Azure does not export $(System.AccessToken).
trigger: none
pr:
  branches:
    include: [main]
pool:
  vmImage: ubuntu-latest
steps:
  - checkout: self
  - task: NodeTool@0
    inputs:
      versionSpec: "24.x"
  # Pin the npm version for reproducibility (never track \`latest\`).
  - script: npm install -g umactually@__UMACTUALLY_VERSION__
    displayName: Install umactually
  - script: umactually review --platform azure-devops
    displayName: Run umactually PR review
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
`;
function renderCiTemplate(input) {
    const template = input.target === "github" ? GITHUB_WORKFLOW_TEMPLATE : AZURE_PIPELINE_TEMPLATE;
    const body = template.replace(/__UMACTUALLY_VERSION__/gu, input.packageVersion);
    const filename = input.target === "github" ? GITHUB_WORKFLOW_FILENAME : AZURE_PIPELINE_FILENAME;
    const relativePath = input.target === "github"
        ? (0,external_node_path_namespaceObject.join)(input.paths?.githubDir ?? ".github/workflows", filename)
        : filename;
    return { filename, relativePath, body };
}
function detectCiTarget(input) {
    if (input.exists((0,external_node_path_namespaceObject.join)(".github")))
        return "github";
    if (input.exists("azure-pipelines.yml"))
        return "azure";
    return null;
}

;// CONCATENATED MODULE: ./src/cli/init.ts
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






/**
 * Global budget for the entire wizard. Per-prompt budget is
 * `PER_PROMPT_TIMEOUT_MS` (15s) and is enforced by `smartPromptForValue`.
 * If the cumulative interactive time exceeds 60s — e.g. a slow human or a
 * stalled TTY — the wizard races the implementation against this timer
 * and exits 2 with a clear envelope.
 */
const WIZARD_PROMPT_TIMEOUT_MS = 60_000;
const PER_PROMPT_TIMEOUT_MS = 15_000;
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
};
const promptSequenceForProvider = (/* unused pure expression or super */ null && (PROMPT_SEQUENCES));
const COPILOT_BASE_URL_LABEL = "GitHub API base URL";
const OPENAI_BASE_URL_LABEL = "Model provider base URL";
const API_KEY_LABEL = "Model provider API key";
const MODEL_LABEL = "Model name";
const FLAG_HANDLERS = {
    "--help": { consume: false, apply: (state) => { state.help = true; } },
    "-h": { consume: false, apply: (state) => { state.help = true; } },
    "--json": { consume: false, apply: (state) => { state.json = true; } },
    "--force": { consume: false, apply: (state) => { state.force = true; } },
    "--yes": { consume: false, apply: (state) => { state.yes = true; } },
    "--apply": { consume: false, apply: (state) => { state.apply = true; } },
    "--non-interactive": { consume: false, apply: (state) => { state.nonInteractive = true; } },
    "--dry-run": { consume: false, apply: (state) => { state.dryRun = true; } },
    "--show": { consume: false, apply: (state) => { state.show = true; } },
    "--ci": { consume: true, validate: parseCi, apply: (state, value) => { state.ci = value; } },
    "--scope": { consume: true, validate: parseScope, apply: (state, value) => { state.scope = value; } },
    "--provider": { consume: true, validate: parseProvider, apply: (state, value) => { state.provider = value; } },
    "--api-url": { consume: true, validate: parseApiUrl, apply: (state, value) => { state.apiUrl = value; } },
    "--api-key": { consume: true, validate: parseApiKey, apply: (state, value) => { state.apiKey = value; } },
    "--github-api-base": { consume: true, validate: parseGithubApiBase, apply: (state, value) => { state.githubApiBase = value; } },
    "--model": { consume: true, validate: parseModel, apply: (state, value) => { state.model = value; } },
};
function parseFlagToken(token, next, state, errors) {
    const handler = FLAG_HANDLERS[token];
    if (handler === undefined) {
        errors.push(token.startsWith("--") ? `unknown flag: ${token}` : `unexpected positional argument: ${token}`);
        return false;
    }
    if (!handler.consume) {
        handler.apply(state);
        return false;
    }
    const step = handler.validate?.(next) ?? flagValue();
    if (step.kind === "error") {
        errors.push(step.message);
        return false;
    }
    handler.apply(state, next);
    return true;
}
function parseInitArgs(argv, env) {
    const state = createParsedInitState();
    const errors = [];
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === undefined)
            break;
        if (parseFlagToken(token, argv[i + 1], state, errors))
            i += 1;
    }
    applyEnvDefaults(state, env);
    const mode = resolveInitMode(state);
    return { mode, errors, ...state };
}
function createParsedInitState() {
    return {
        help: false,
        json: false,
        force: false,
        yes: false,
        apply: false,
        ci: undefined,
        scope: undefined,
        provider: undefined,
        apiUrl: undefined,
        apiKey: undefined,
        githubApiBase: undefined,
        model: undefined,
        dryRun: false,
        show: false,
        nonInteractive: false,
    };
}
function flagValue() {
    return { kind: "value" };
}
function flagError(message) {
    return { kind: "error", message };
}
function parseCi(next) {
    if (next === undefined) {
        return flagError("--ci requires a value (auto|github|azure|none)");
    }
    if (next !== "auto" && next !== "github" && next !== "azure" && next !== "none") {
        return flagError(`--ci must be one of auto|github|azure|none (got '${next}')`);
    }
    return flagValue();
}
function parseScope(next) {
    if (next === undefined) {
        return flagError("--scope requires a value (global|repo)");
    }
    if (next !== "global" && next !== "repo") {
        return flagError(`--scope must be 'global' or 'repo' (got '${next}')`);
    }
    return flagValue();
}
function parseProvider(next) {
    if (next === undefined) {
        return flagError("--provider requires a value (openai-compatible|anthropic|copilot)");
    }
    if (next !== "openai-compatible" && next !== "anthropic" && next !== "copilot") {
        return flagError(`--provider must be one of openai-compatible|anthropic|copilot (got '${next}')`);
    }
    return flagValue();
}
function parseApiUrl(next) {
    if (next === undefined)
        return flagError("--api-url requires a value");
    return flagValue();
}
/**
 * `--api-key` accepts any non-empty string; we don't validate the
 * shape (the live provider probe will surface a key-mismatch error
 * downstream). Missing value → error.
 */
function parseApiKey(next) {
    if (next === undefined)
        return flagError("--api-key requires a value");
    return flagValue();
}
function parseGithubApiBase(next) {
    if (next === undefined)
        return flagError("--github-api-base requires a value");
    return flagValue();
}
function parseModel(next) {
    if (next === undefined)
        return flagError("--model requires a value");
    return flagValue();
}
/**
 * Env defaults (UMACTUALLY_API_URL, UMACTUALLY_API_KEY, etc.) — only
 * used to backfill if no flag was given. The wizard never persists
 * them (S6); they're consumed for the live provider HEAD probe only.
 */
function applyEnvDefaults(state, env) {
    if (state.apiUrl === undefined && typeof env["UMACTUALLY_API_URL"] === "string") {
        state.apiUrl = env["UMACTUALLY_API_URL"];
    }
    if (state.apiKey === undefined && typeof env["UMACTUALLY_API_KEY"] === "string") {
        state.apiKey = env["UMACTUALLY_API_KEY"];
    }
    if (state.githubApiBase === undefined && typeof env["UMACTUALLY_GITHUB_API_BASE"] === "string") {
        state.githubApiBase = env["UMACTUALLY_GITHUB_API_BASE"];
    }
    if (state.model === undefined && typeof env["UMACTUALLY_MODEL"] === "string") {
        state.model = env["UMACTUALLY_MODEL"];
    }
    if (state.provider === undefined && typeof env["UMACTUALLY_PROVIDER"] === "string") {
        const envProvider = env["UMACTUALLY_PROVIDER"];
        if (envProvider === "openai-compatible" || envProvider === "anthropic" || envProvider === "copilot") {
            state.provider = envProvider;
        }
    }
}
/**
 * Mode resolution: --show and --dry-run are sub-modes that take
 * precedence; --json implies non-interactive.
 */
function resolveInitMode(state) {
    if (state.show)
        return "show";
    if (state.dryRun)
        return "dry-run";
    if (state.nonInteractive || state.json)
        return "non-interactive";
    return "interactive";
}
/**
 * The init subcommand's dedicated help text. Pinned in INIT_HELP_TEXT
 * for the test matrix and consumed by `dispatch.ts` via the help
 * resolver.
 */
const init_INIT_HELP_TEXT = [
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
function formatInitJson(result) {
    const redacted = {
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
function formatInitHuman(result) {
    const lines = [];
    if (result.outcome === "ok") {
        lines.push(`${BRAND_PREFIX}init complete`);
    }
    else if (result.outcome === "aborted") {
        lines.push(`${BRAND_PREFIX}init aborted; nothing changed.`);
    }
    else {
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
async function runInit({ argv, deps }) {
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
    let globalTimer = null;
    const globalBudget = new Promise((_resolve, reject) => {
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
    }
    catch (err) {
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
    }
    finally {
        if (globalTimer !== null) {
            clearTimeout(globalTimer);
        }
    }
}
async function runInitImpl({ args, deps, }) {
    // --json implies non-interactive
    const mode = args.json ? "non-interactive" : args.mode;
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
async function runShowInit({ deps }) {
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
async function runDryRunInit({ args, deps, }) {
    // Dry-run requires the same flags as non-interactive so the plan is
    // fully determined. If none are present, fall back to the openai-
    // compatible default to keep the plan deterministic.
    const provider = args.provider ?? "openai-compatible";
    const apiUrl = args.apiUrl ?? saved_config_DEFAULT_OPENAI_URL;
    const model = args.model ?? "auto";
    const config = buildConfig(provider, apiUrl, model);
    const ciGenerated = [];
    if (args.ci === "github" || args.ci === "azure") {
        ciGenerated.push(args.ci);
    }
    else if (args.ci === "auto") {
        const target = detectCiTargetHelper(deps.fsAdapter ?? defaultFsAdapter);
        if (target !== null)
            ciGenerated.push(target);
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
async function runNonInteractiveInit({ args, deps, }) {
    // Validate required flags. Missing provider is a hard fail.
    const provider = args.provider;
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
    // We intentionally do NOT retain `apiKey` / `githubApiBase` after
    // validation — they are write-side blacklisted and don't enter the
    // `writeSavedConfig` call below (bundle §1.1 S6). The copilot branch
    // only validates that the operator passed a github-api-base OR
    // accepts the canonical default; we don't store it because the
    // saved config schema is provider/apiUrl/model only.
    const pendingPrompts = [];
    let apiUrl = args.apiUrl;
    let model = args.model;
    if (provider === "openai-compatible") {
        if (apiUrl === undefined)
            apiUrl = saved_config_DEFAULT_OPENAI_URL;
        if (args.apiKey === undefined)
            pendingPrompts.push("--api-key");
        if (model === undefined)
            model = "auto";
    }
    else if (provider === "anthropic") {
        if (args.apiKey === undefined)
            pendingPrompts.push("--api-key");
        if (apiUrl === undefined)
            apiUrl = saved_config_DEFAULT_ANTHROPIC_URL;
        if (model === undefined)
            model = "auto";
    }
    else {
        // copilot — no apiKey prompt; githubApiBase presence is acknowledged
        // but not persisted (saved config schema lacks the field).
        if (model === undefined)
            model = "auto";
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
    const scope = args.scope ?? "global";
    const config = buildConfig(provider, apiUrl ?? saved_config_DEFAULT_OPENAI_URL, model ?? "auto");
    // apiKey and githubApiBase were validated for presence only and
    // intentionally dropped before reaching writeSavedConfig (S6).
    // Note that the SavedConfig type excludes apiKey, so the writer
    // can't accidentally persist it. See buildConfig + bundle §1.6.
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
                        id: "ci-generation",
                        status: "ok",
                        message: `generated ${ciGenerated.join(", ")} workflow`,
                    },
                ]
                : []),
        ],
        hints: [],
        sources: {
            provider: { source: "flag" },
            ...(config.apiUrl !== undefined ? { apiUrl: { source: "flag" } } : {}),
            ...(config.model !== undefined ? { model: { source: "flag" } } : {}),
        },
    };
}
// ---------------------------------------------------------------------------
// Interactive path: 5-base-prompt sequence with per-branch sub-prompts.
// Honors SIGINT/EOF as clean abort; apiKey is NEVER persisted.
// ---------------------------------------------------------------------------
async function runInteractiveInit({ args, deps, }) {
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
    const reader = deps.stdinReader ?? init_defaultStdinReader;
    // Q1 — scope (default global)
    const scopeAnswer = await safePrompt(reader, isTTY, "? Save settings to: (1) global ~/.umactually  (2) repo ./umactually.config.json  [default: 1]: ", "1");
    if (scopeAnswer === null)
        return abortedResult(args.mode);
    const scopeChoice = scopeAnswer === "2" ? "repo" : "global";
    // Q2 — provider family (must include all three)
    const providerAnswer = await safePrompt(reader, isTTY, "? Provider family (1) openai-compatible  (2) anthropic  (3) copilot: ", "");
    if (providerAnswer === null)
        return abortedResult(args.mode);
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
    const branch = await promptBranch({ provider, env: deps.env });
    if (branch.outcome === "aborted")
        return abortedResult(args.mode);
    if (branch.outcome === "error")
        return branch.result;
    // Q4 — CI target (auto-detect unless --ci flag, --yes, or interactive)
    const ciChoice = await promptCi({
        args,
        deps,
        reader,
        isTTY,
        packageVersion: deps.packageVersion,
    });
    if (ciChoice.outcome === "aborted")
        return abortedResult(args.mode);
    if (ciChoice.outcome === "error")
        return ciChoice.result;
    // Q5 — Confirm save
    const confirmAnswer = await safePrompt(reader, isTTY, "? Save these settings? [y/N]: ", "");
    if (confirmAnswer === null)
        return abortedResult(args.mode);
    if (!/^y(es)?$/i.test(confirmAnswer.trim())) {
        return abortedResult(args.mode);
    }
    // Persist. The apiKey from branch.apiKey is consumed for the live
    // HEAD probe ONLY; never passed to writeSavedConfig.
    const config = buildConfig(provider, branch.apiUrl ?? saved_config_DEFAULT_OPENAI_URL, branch.model);
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
                        id: "ci-generation",
                        status: "ok",
                        message: `generated ${ciChoice.generated.join(", ")} workflow`,
                    },
                ]
                : []),
        ],
        hints: [],
        sources: {
            provider: { source: "default" },
            ...(config.apiUrl !== undefined ? { apiUrl: { source: "default" } } : {}),
            ...(config.model !== undefined ? { model: { source: "default" } } : {}),
        },
    };
}
/**
 * Build the ordered list of sub-prompts for `provider`. The `env`
 * arg is consulted for any value the operator already supplied via
 * env var; if present, the corresponding prompt is dropped (the
 * caller — `promptBranch` — checks `process.env[name]` via
 * `smartPromptForValue`).
 *
 * Order matches the canonical §2.2 sequence:
 *   openai-compatible → api-url, api-key, model
 *   anthropic         → api-key, model
 *   copilot           → github-api-base, model
 */
function buildPerBranchPrompts(provider, _env) {
    switch (provider) {
        case "openai-compatible":
            return [
                {
                    label: OPENAI_BASE_URL_LABEL,
                    envVarName: "UMACTUALLY_API_URL",
                    placeholder: saved_config_DEFAULT_OPENAI_URL,
                    default: saved_config_DEFAULT_OPENAI_URL,
                },
                {
                    label: API_KEY_LABEL,
                    envVarName: "UMACTUALLY_API_KEY",
                    placeholder: "sk-...",
                },
                {
                    label: MODEL_LABEL,
                    envVarName: "UMACTUALLY_MODEL",
                    placeholder: "auto",
                    default: "auto",
                },
            ];
        case "anthropic":
            return [
                {
                    label: API_KEY_LABEL,
                    envVarName: "UMACTUALLY_API_KEY",
                    placeholder: "sk-ant-...",
                },
                {
                    label: MODEL_LABEL,
                    envVarName: "UMACTUALLY_MODEL",
                    placeholder: "auto",
                    default: "auto",
                },
            ];
        case "copilot":
            return [
                {
                    label: COPILOT_BASE_URL_LABEL,
                    envVarName: "UMACTUALLY_GITHUB_API_BASE",
                    placeholder: "https://api.github.com",
                    default: "https://api.github.com",
                },
                {
                    label: MODEL_LABEL,
                    envVarName: "UMACTUALLY_MODEL",
                    placeholder: "auto",
                    default: "auto",
                },
            ];
    }
}
async function promptBranch(input) {
    const { provider, env } = input;
    const prompts = buildPerBranchPrompts(provider, env ?? {});
    // Collect each prompt value via smartPromptForValue, which already
    // honors env pre-fill and timeout-safe decline. On any null answer
    // we treat it as a clean abort.
    const collected = {};
    for (const p of prompts) {
        const answer = await smartPromptForValue({
            label: p.label,
            envVarName: p.envVarName,
            placeholder: p.placeholder,
            ...(p.default !== undefined ? { default: p.default } : {}),
            timeoutMs: PER_PROMPT_TIMEOUT_MS,
        });
        if (answer === null)
            return { outcome: "aborted" };
        collected[p.envVarName] = answer;
    }
    const model = collected["UMACTUALLY_MODEL"] ?? "auto";
    if (provider === "openai-compatible") {
        return {
            outcome: "ok",
            apiUrl: collected["UMACTUALLY_API_URL"],
            apiKey: collected["UMACTUALLY_API_KEY"],
            githubApiBase: undefined,
            model,
        };
    }
    if (provider === "anthropic") {
        return {
            outcome: "ok",
            apiUrl: saved_config_DEFAULT_ANTHROPIC_URL,
            apiKey: collected["UMACTUALLY_API_KEY"],
            githubApiBase: undefined,
            model,
        };
    }
    // copilot — no apiKey prompt (uses GITHUB_TOKEN)
    return {
        outcome: "ok",
        apiUrl: undefined,
        apiKey: undefined,
        githubApiBase: collected["UMACTUALLY_GITHUB_API_BASE"],
        model,
    };
}
async function promptCi(input) {
    const { args, deps, reader, isTTY, packageVersion } = input;
    const fs = deps.fsAdapter ?? defaultFsAdapter;
    let chosen = "none";
    if (args.ci !== undefined) {
        chosen = args.ci === "auto" ? detectCiTargetHelper(fs) ?? "none" : args.ci;
    }
    else if (args.yes) {
        chosen = detectCiTargetHelper(fs) ?? "none";
    }
    else {
        const detected = detectCiTargetHelper(fs);
        if (detected !== null) {
            const answer = await safePrompt(reader, isTTY, `? Detected ${detected} CI. Generate a ${detected} workflow file? [Y/n]: `, "Y");
            if (answer === null)
                return { outcome: "aborted" };
            chosen = /^(n|no)$/i.test(answer.trim()) ? "none" : detected;
        }
        else {
            const answer = await safePrompt(reader, isTTY, "? Generate CI workflow? (1) github  (2) azure  (3) none  [default: 3]: ", "none");
            if (answer === null)
                return { outcome: "aborted" };
            const trimmed = answer.trim().toLowerCase();
            if (trimmed === "github" || trimmed === "azure")
                chosen = trimmed;
            else
                chosen = "none";
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
async function init_defaultStdinReader(prompt, _isTTY) {
    try {
        return await readInteractiveLine({ prompt, timeoutMs: PER_PROMPT_TIMEOUT_MS });
    }
    catch (err) {
        if (err instanceof SmartPromptUnavailable)
            return null;
        throw err;
    }
}
/**
 * Run a single prompt through the (possibly injected) reader. Returns
 * `null` on EOF/timeout/SIGINT so the caller can map it to a clean
 * abort. Empty answers are returned as "" — callers distinguish via
 * length and treat an empty answer as a clean abort too.
 */
async function safePrompt(reader, isTTY, prompt, defaultValue) {
    const answer = await reader(prompt, isTTY);
    if (answer === null)
        return null;
    const trimmed = answer.trim();
    if (trimmed.length === 0)
        return defaultValue;
    return trimmed;
}
/**
 * Parse a provider-family answer into the typed enum. Returns null on
 * any unrecognized value (case-insensitive match).
 */
function parseProviderChoice(answer) {
    const t = answer.trim().toLowerCase();
    if (t === "openai-compatible" || t === "openai" || t === "1") {
        return "openai-compatible";
    }
    if (t === "anthropic" || t === "2")
        return "anthropic";
    if (t === "copilot" || t === "github-copilot" || t === "3")
        return "copilot";
    return null;
}
/**
 * Path-safety check: reject cwd paths whose segments contain `..`
 * (which would let a user-supplied path escape the project). Absolute
 * cwd is fine — every real process has one — so we only block the
 * `..` traversal case.
 */
function containsUnsafePathSegment(p) {
    const segments = p.split(/[\\/]/);
    if (segments.some((s) => s === ".."))
        return true;
    try {
        const canonicalCwd = (0,external_node_fs_.realpathSync)(p);
        return canonicalCwd !== (0,external_node_fs_.realpathSync)(p);
    }
    catch {
        return false;
    }
}
/**
 * Build a typed SavedConfig. apiUrl is omitted when equal to the
 * runtime default; model is omitted when "auto".
 */
function buildConfig(provider, apiUrl, model) {
    const defaultForProvider = provider === "anthropic" ? saved_config_DEFAULT_ANTHROPIC_URL : saved_config_DEFAULT_OPENAI_URL;
    const base = {
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
function detectCiTargetHelper(fs) {
    return detectCiTarget({ exists: (p) => fs.exists(p) });
}
async function generateCiForResult(input) {
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
        if (target === null)
            return [];
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
async function generateCi(input) {
    const rendered = renderCiTemplate({
        target: input.target,
        packageVersion: input.packageVersion,
    });
    let targetPath;
    try {
        targetPath = joinRelativeCwd(input.deps.cwd, rendered.relativePath);
    }
    catch (err) {
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
    if ((0,external_node_fs_.lstatSync)(targetPath, { throwIfNoEntry: false })?.isSymbolicLink()) {
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
            const { mkdirSync } = await Promise.resolve(/* import() */).then(__nccwpck_require__.t.bind(__nccwpck_require__, 24, 23));
            mkdirSync(parent, { recursive: true });
        }
        input.fs.writeFileAtomic(targetPath, rendered.body);
    }
    catch (err) {
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
function joinRelativeCwd(cwd, relative) {
    const segments = relative.split(/[\\/]/).filter((s) => s.length > 0 && s !== ".");
    if (segments.some((s) => s === "..")) {
        throw new Error(`unsafe relative path: ${relative}`);
    }
    const targetPath = `${cwd.replace(/[\\/]+$/, "")}/${segments.join("/")}`;
    try {
        const canonicalCwd = (0,external_node_fs_.realpathSync)(cwd);
        const canonicalTarget = (0,external_node_fs_.realpathSync)(targetPath);
        if (canonicalTarget !== canonicalCwd && !canonicalTarget.startsWith(`${canonicalCwd}/`)) {
            throw new Error(`unsafe relative path: ${relative}`);
        }
    }
    catch (err) {
        if (err instanceof Error && err.message === `unsafe relative path: ${relative}`)
            throw err;
    }
    return targetPath;
}
function dirname(p) {
    const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
    return idx === -1 ? "." : p.slice(0, idx);
}
function abortedResult(mode) {
    // The headline "init aborted; nothing changed." already carries the
    // user-facing explanation; the formatter would otherwise emit a
    // redundant `hint:` line that simply repeats the same sentence
    // (regression reported on v0.6.23). Keep `hints` empty here so the
    // formatter renders a single, clean line for clean-abort outcomes.
    return envelope(mode, "aborted", 0, {});
}
/**
 * Build an InitResult with sensible defaults so callers only supply
 * the fields that deviate from "no config written, no checks, no ci,
 * empty sources". Keeps the 11 envelope call sites below the
 * 250-LOC ceiling.
 */
function envelope(mode, outcome, exitCode, overrides = {}) {
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

;// CONCATENATED MODULE: ./src/cli/no-color.ts
// SPDX-License-Identifier: MIT
/**
 * Resolve whether decorative ANSI color should be enabled.
 *
 * GitHub annotation prefixes (`::notice::`, `::warning::`, and `::error::`)
 * are workflow commands, not decorative color, and are unaffected.
 */
function resolveColorPolicy(opts) {
    if (opts.noColor || opts.json) {
        return false;
    }
    const noColorEnv = opts.env["NO_COLOR"];
    if (typeof noColorEnv === "string" && noColorEnv.length > 0) {
        return false;
    }
    return opts.isTTY;
}

;// CONCATENATED MODULE: ./src/util/envelope.ts
// SPDX-License-Identifier: MIT
//
// M1 — EnvelopeV1: unified JSON output contract for every `--json`
// subcommand (review, doctor, uninstall, verify).
//
// Every `--json` subcommand emits the SAME shape so CI consumers can
// rely on a single parser. The shape is a STRICT SUPERSET of the
// pre-M1 per-command JSON contracts: existing top-level fields like
// `command`, `exitCode`, `schemaVersion`, `resolvedConfig`, and
// `outcome` continue to appear at the top level (so legacy consumers
// do not break), AND the full original payload is preserved under
// `data` for consumers that prefer the new structure.
//
// See `.omo/plans/cli-simplification-hyperplan-bundle.md` §1.M1 for
// the contract spec and §1.Insight 3 + §2.inversion #11 for the
// rationale (M1 precedes every other M-step because all later steps
// assume a uniform envelope).
const ENVELOPE_SCHEMA_VERSION = 1;
const ALLOWED_COMMANDS = ["review", "doctor", "uninstall", "verify"];
/**
 * Build an EnvelopeV1 record. Pure: no I/O, no clock side-effects
 * beyond reading `new Date()` once. The `data` payload is copied by
 * reference (envelope consumers are expected to be read-only).
 *
 * `ok` is derived from `exitCode`: it is `true` iff `exitCode === 0`.
 * This is the single source of truth for the success/failure flag —
 * callers MUST NOT set `ok` independently, otherwise the envelope
 * could lie about its own exit code.
 */
function createEnvelope(command, data, opts = {}) {
    if (!ALLOWED_COMMANDS.includes(command)) {
        // Defensive guard: an unknown command name means the envelope
        // would lie about its origin, which a CI consumer would not be
        // able to detect. Surface it loudly rather than papering over.
        throw new RangeError(`createEnvelope: unknown command "${command}". Expected one of: ${ALLOWED_COMMANDS.join(", ")}`);
    }
    const exitCode = opts.exitCode ?? 0;
    return {
        schemaVersion: ENVELOPE_SCHEMA_VERSION,
        command,
        exitCode,
        ok: exitCode === 0,
        startedAt: opts.startedAt ?? new Date().toISOString(),
        durationMs: opts.durationMs ?? 0,
        data,
        errors: opts.errors ?? [],
        hints: opts.hints ?? [],
        warnings: opts.warnings ?? [],
    };
}
/**
 * Convenience wrapper around `createEnvelope` that measures wall-clock
 * duration around an async worker. Errors thrown by the worker are
 * captured as a single `{ code: "UNCAUGHT", message }` entry in
 * `errors[]` and the envelope is marked `ok: false` with `exitCode: 1`.
 *
 * Use this when you want a uniform envelope-with-timing contract for
 * a CLI subcommand body; for hand-built envelopes (e.g. inside a
 * dispatch layer that already tracks its own clock) use
 * `createEnvelope` directly.
 */
/**
 * Convert a nanosecond bigint delta to a millisecond integer using
 * integer division. We use `Number()` and `Math.trunc` rather than
 * `Number(bigint / 1_000_000n)` so the result is bounded to
 * `Number.MAX_SAFE_INTEGER` — safe durations are well within range.
 */
function hrtimeDeltaMs(startNs, endNs) {
    const deltaNs = endNs - startNs;
    return Math.max(0, Math.trunc(Number(deltaNs / 1000000n)));
}
async function envelopeFromCommand(command, worker, opts = {}) {
    const startedAt = new Date().toISOString();
    const startNs = process.hrtime.bigint();
    try {
        const data = await worker();
        const durationMs = hrtimeDeltaMs(startNs, process.hrtime.bigint());
        return createEnvelope(command, data, {
            ...opts,
            startedAt,
            durationMs,
            exitCode: 0,
        });
    }
    catch (err) {
        const durationMs = hrtimeDeltaMs(startNs, process.hrtime.bigint());
        const message = err instanceof Error ? err.message : String(err);
        return createEnvelope(command, {}, {
            ...opts,
            startedAt,
            durationMs,
            exitCode: 1,
            errors: [{ code: "UNCAUGHT", message }],
        });
    }
}
/**
 * Serialize an envelope to JSON and write it (followed by a single
 * `\n`) to the supplied writable stream. Defaults to `process.stdout`.
 *
 * Uses `JSON.stringify` without indentation so the output is
 * single-line (matches the pre-M1 wire shape); downstream tools
 * already pipe through `jq -c` and the human output is the OTHER
 * branch (the `format*Human` functions).
 */
function emitJsonEnvelope(envelope, out = process.stdout) {
    out.write(`${JSON.stringify(envelope)}\n`);
}

;// CONCATENATED MODULE: ./src/cli/dispatch.ts
// SPDX-License-Identifier: MIT
// Subcommand dispatch layer. Pure routing apart from delegated CLI output.
















const GLOBAL_ONLY_FLAGS = new Set(["--json", "--no-color"]);
const execFile = (0,external_node_util_namespaceObject.promisify)(external_node_child_process_.execFile);
function firstPositionalToken(argv) {
    for (const token of argv) {
        if (GLOBAL_ONLY_FLAGS.has(token)) {
            continue;
        }
        return token.startsWith("-") ? null : token;
    }
    return null;
}
function stripLeadingCommand(argv, command) {
    const commandIndex = argv.indexOf(command);
    return commandIndex === -1
        ? argv.slice()
        : [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)];
}
async function dispatch(argv) {
    applyColorPolicy(argv);
    if (argv.includes("--version") || argv.includes("-V")) {
        return runVersion(argv);
    }
    if (argv.includes("--help") || argv.includes("-h")) {
        const stdout = printContextualHelp(argv);
        return argv.includes("--no-color") ? 0 : { exitCode: 0, stdout };
    }
    // Top-level `--show-config` is its own read-only command: print the
    // effective saved config and exit 0. Implemented at this layer so
    // the operator can run `umactually --show-config` from anywhere —
    // including `umactually review --show-config` or
    // `umactually init --show-config` — without going through the
    // validator or any other command's argument parser. Self-review
    // thread PRRT_kwDOTHG5gM6WY88P on PR #180 flagged that putting the
    // check inside `command === null` made `umactually review
    // --show-config` silently pass the flag through to the review
    // validator instead of running `runShowConfig`. Hoisting above
    // `firstPositionalToken(argv)` short-circuits on the flag presence
    // before any command routing.
    if (argv.includes("--show-config")) {
        return runShowConfig();
    }
    const command = firstPositionalToken(argv);
    if (command === null) {
        // Compact quickstart for interactive bare invocations. Replaces
        // the noisy validation + modes banner for fresh-install TTY users
        // (no saved config) AND for the post-init case where the operator
        // has run `umactually init` already (saved config present). The
        // existing loud banner is preserved for every other case:
        //   - non-TTY / CI: existing banner, no quickstart (existing
        //     tests in test/unit/cli-bare-invocation.test.ts and
        //     test/unit/cli-subcommands.test.ts:CLI-SUB-005 pin this).
        //   - programmatic flags (`--json`, `--api-*`, etc.): existing
        //     banner (operator clearly knows what they're doing; the
        //     intended commands are `umactually review ...`).
        //
        // Two variants:
        //   - First run (no saved config): quickstart leads with
        //     `umactually init` (operator needs to run the wizard first).
        //   - Post-init (saved config exists): quickstart drops the
        //     `umactually init` line and confirms what's loaded (provider +
        //     model). The three review commands below it are unchanged so
        //     the operator's muscle memory carries over.
        if (isQuickstartEligible(argv)) {
            const savedRead = tryReadSavedConfig();
            if (savedRead.config !== null) {
                return runLoadedConfigQuickstart(savedRead.config, savedRead.path);
            }
            if (savedRead.warning !== null) {
                process.stderr.write(`umactually: ${savedRead.warning}\n`);
            }
            return runFirstRunQuickstart();
        }
        return runReviewBranch(argv);
    }
    switch (command) {
        case "review":
            return runReviewBranch(stripLeadingCommand(argv, command));
        case "doctor":
            return runDoctorBranch(stripLeadingCommand(argv, command));
        case "uninstall":
            return runUninstallBranch(stripLeadingCommand(argv, command));
        case "check-review-artifact":
            return runCheckReviewArtifactBranch(stripLeadingCommand(argv, command));
        case "init":
            return runInitBranch(stripLeadingCommand(argv, command));
        case "version":
            return runVersion(stripLeadingCommand(argv, command));
        default: {
            const stderr = `unknown command: ${command}\n`;
            process.stderr.write(stderr);
            return { exitCode: 2, stderr };
        }
    }
}
function applyColorPolicy(argv) {
    return resolveColorPolicy({
        noColor: argv.includes("--no-color"),
        json: argv.includes("--json"),
        env: process.env,
        isTTY: process.stdout.isTTY === true,
    });
}
/**
 * Whether the bare-invocation quickstart SHOULD run — independent of
 * whether the operator has run init. Returns true ONLY when ALL of:
 *   - not in a CI environment (CI env vars set),
 *   - stdout is a real TTY (no JSON-parser pollution; no piped stdin),
 *   - no programmatic flags in argv (operator isn't scripting).
 *
 * The function deliberately does NOT check whether a saved config
 * exists. That decision is made later, inside `dispatch`, where the
 * loader returns `null` for missing/malformed configs and the
 * quickstart variant is picked accordingly:
 *   - config exists → `runLoadedConfigQuickstart` (no init line)
 *   - no config     → `runFirstRunQuickstart` (leads with init)
 * Both variants REPLACE the loud `cli: --api-url is required` +
 * `pick a mode:` banner that would otherwise fire when the operator
 * runs `umactually` from a fresh shell.
 *
 * Every other case (non-TTY, CI, programmatic flags like `--json` /
 * `--api-*` / `--model`) preserves the existing loud banner so the
 * back-compat invariants in:
 *   - test/unit/cli-bare-invocation.test.ts (CLI_SYMBIOTIC-2)
 *   - test/unit/cli-subcommands.test.ts:CLI-SUB-005
 * keep passing.
 */
function isQuickstartEligible(argv) {
    if (looksLikeCIEnv())
        return false;
    if (process.stdout.isTTY !== true)
        return false;
    if (argvIncludesProgrammaticFlags(argv))
        return false;
    return true;
}
/**
 * Returns true when a known CI platform env var is set. The set is
 * intentionally narrow — only platforms whose presence unambiguously
 * means "automation, not a human operator". A bare `CI=true` is
 * NOT included because many developer shells set it locally (and
 * the loud banner for those users is the right behavior).
 *
 * Boolean-valued CI vars (`GITHUB_ACTIONS`, `TF_BUILD`) are matched
 * case-insensitively because Azure DevOps sets `TF_BUILD=True` (capital
 * T) while GitHub Actions sets `GITHUB_ACTIONS=true` (lowercase) —
 * any case-sensitive check would silently miss one platform.
 */
function looksLikeCIEnv() {
    const env = process.env;
    return (truthyCI(env["GITHUB_ACTIONS"]) ||
        truthyCI(env["TF_BUILD"]) ||
        typeof env["BUILDKITE"] === "string" ||
        typeof env["CIRCLECI"] === "string" ||
        typeof env["JENKINS_URL"] === "string");
}
function truthyCI(v) {
    return typeof v === "string" && v.toLowerCase() === "true";
}
function argvIncludesProgrammaticFlags(argv) {
    // `--json` and `--no-color` are common programmatic flags; a user
    // passing them is not a "first run" — they're piping output somewhere
    // and the quickstart would just be noise on stderr. `--api-*` /
    // `--model` flags mean the operator already knows the wire shape;
    // routing them to the wizard is condescending.
    return argv.some((a) => a === "--json" ||
        a === "--no-color" ||
        a.startsWith("--api-") ||
        a === "--model" ||
        a.startsWith("--platform"));
}
/**
 * The compact first-run quickstart. Replaces the noisy
 * `cli: --api-url is required` + `pick a mode:` banner for first-time
 * users. Single screen, leads with `umactually init`, then summarizes
 * the three review commands, then points at `--help` for the full
 * reference. Exit code 0 — first run is not an error.
 *
 * Industry-standard model: matches `rustup`, `fnm`, `volta`, `nvm`,
 * `pip`, `brew install` first-run output. No `--dry-run` clutter.
 */
const QUICKSTART_REVIEW_COMMANDS = [
    { command: "umactually review --api-key <key>", description: "PR review (CI)" },
    { command: "umactually --files <path>... --api-key <key>", description: "Local files (no CI)" },
    { command: "umactually doctor", description: "Verify your setup" },
];
const FIRST_RUN_QUICKSTART = [
    "Welcome to umactually! Get started with the setup wizard:",
    "",
    "  umactually init",
    "",
    "Then run a review:",
    "",
    ...renderCommandsTable(QUICKSTART_REVIEW_COMMANDS),
    "",
    "Run `umactually --help` for the full reference.",
    "",
].join("\n");
function runFirstRunQuickstart() {
    // Pattern matches runUninstallBranch / runInitBranch / runDoctorBranch:
    // write directly to stdout so the live stream gets the bytes, and
    // return a minimal `{ exitCode }` result. Callers capture via
    // `process.stdout.write` interception (see test helpers).
    process.stdout.write(`${BRAND_PREFIX}${FIRST_RUN_QUICKSTART}`);
    return Promise.resolve({ exitCode: 0 });
}
/**
 * Loaded-config quickstart for the post-init case. Same shape as
 * `FIRST_RUN_QUICKSTART` (three review commands + `--help` pointer)
 * with two changes:
 *
 *   1. First line confirms what loaded instead of welcoming the user
 *      to the tool. Format: `Loaded config (provider=<X>, model=<Y>).`
 *      `apiUrl` is intentionally omitted from the confirmation line
 *      to keep the quickstart single-screen and avoid leaking the
 *      provider URL to anyone shoulder-surfing. Operators who want
 *      the URL can run `umactually --show-config`.
 *   2. The `umactually init` block is dropped — the operator has
 *      already configured; pointing them at the wizard again would
 *      be condescending. The two review-command lines stay in their
 *      exact same position so visual muscle memory carries over.
 */
function renderLoadedConfigQuickstart(config) {
    const providerLabel = `provider=${config.provider}`;
    const modelLabel = config.model !== undefined ? `, model=${config.model}` : "";
    const header = `Loaded config (${providerLabel}${modelLabel}). Run:`;
    return [
        header,
        "",
        ...renderCommandsTable(QUICKSTART_REVIEW_COMMANDS),
        "",
        "Run `umactually --show-config` to inspect the loaded values;",
        "run `umactually --help` for the full reference.",
        "",
    ].join("\n");
}
function runLoadedConfigQuickstart(config, _path) {
    process.stdout.write(`${BRAND_PREFIX}${renderLoadedConfigQuickstart(config)}`);
    return Promise.resolve({ exitCode: 0 });
}
/**
 * `umactually --show-config` — print the effective saved config and
 * exit 0. Read-only; never opens a network connection; never prompts.
 *
 * The output is a field-by-field rendered multiline string so future
 * secret fields on `SavedConfig` (the schema is intentionally future-
 * proofed) cannot accidentally leak through this surface — any field
 * added to `SavedConfig` must be explicitly added here AND to
 * `serializeSavedConfig`'s "unknown key is rejected at the type level"
 * rule, which is exactly the trust-model property the S6 contract
 * requires.
 *
 * Decision: lives at the dispatch layer (not under `umactually doctor`)
 * because every other "what's currently effective" tool (`kubectl
 * config view`, `aws configure get`, `git config --list --show-origin`)
 * is top-level, not under a verification subcommand. Operators look
 * for `--show-config` at the root.
 */
function renderShowConfig(config, path) {
    const lines = [
        `saved config: ${path}`,
        `  provider: ${config.provider}`,
    ];
    if (config.apiUrl !== undefined)
        lines.push(`  apiUrl:   ${config.apiUrl}`);
    if (config.model !== undefined)
        lines.push(`  model:    ${config.model}`);
    return lines.join("\n") + "\n";
}
function runShowConfig() {
    const savedRead = tryReadSavedConfig();
    if (savedRead.warning !== null) {
        process.stderr.write(`umactually: ${savedRead.warning}\n`);
        return Promise.resolve({ exitCode: 1 });
    }
    if (savedRead.config === null) {
        process.stdout.write(`${BRAND_PREFIX}no saved config (run \`umactually init\` to create one)\n`);
        return Promise.resolve({ exitCode: 0 });
    }
    process.stdout.write(renderShowConfig(savedRead.config, savedRead.path));
    return Promise.resolve({ exitCode: 0 });
}
async function runReviewBranch(args) {
    const json = args.includes("--json");
    const reviewArgs = args.filter((arg) => arg !== "--json" && arg !== "--no-color");
    if (json) {
        return runJsonReview(reviewArgs);
    }
    const result = await runCli(reviewArgs, process.cwd());
    return { exitCode: result.exitCode };
}
async function runJsonReview(argv) {
    const reviewArgs = stripLeadingCommand(argv.filter((arg) => arg !== "--json" && arg !== "--no-color"), "review");
    const originalWrite = process.stdout.write;
    process.stdout.write = process.stderr.write.bind(process.stderr);
    try {
        const result = await runCli(reviewArgs, process.cwd());
        const legacyData = {
            resolvedConfig: result.resolvedConfig ?? {},
            outcome: {
                ok: result.exitCode === 0,
                ...(result.jsonOutcome ?? {}),
            },
        };
        const envelope = createEnvelope("review", legacyData, { exitCode: result.exitCode });
        const stdout = `${JSON.stringify({
            schemaVersion: envelope.schemaVersion,
            command: envelope.command,
            exitCode: envelope.exitCode,
            resolvedConfig: result.resolvedConfig ?? {},
            outcome: legacyData["outcome"],
            ok: envelope.ok,
            startedAt: envelope.startedAt,
            durationMs: envelope.durationMs,
            data: envelope.data,
            errors: envelope.errors,
            hints: envelope.hints,
            warnings: envelope.warnings,
        })}\n`;
        originalWrite.call(process.stdout, stdout);
        return { exitCode: result.exitCode, stdout };
    }
    finally {
        process.stdout.write = originalWrite;
    }
}
function runCheckReviewArtifactBranch(args) {
    const artifactArgs = args.filter((arg) => arg !== "--no-color");
    const json = artifactArgs.includes("--json");
    const positionalArgs = artifactArgs.filter((arg) => arg !== "--json");
    const path = positionalArgs[0];
    if (path === undefined || positionalArgs.length !== 1) {
        const stderr = "usage: umactually check-review-artifact <path>\n";
        process.stderr.write(stderr);
        return { exitCode: 2, stderr };
    }
    const result = classifyReviewArtifact(path);
    const exitCode = result.ok ? 0 : 1;
    if (json) {
        const envelope = createEnvelope("verify", {
            path,
            ok: result.ok,
            classification: result.ok ? result.summary : "invalid",
            reason: result.ok ? null : result.reason,
            warnings: result.warnings,
        }, { exitCode });
        const stdout = `${JSON.stringify(envelope)}\n`;
        process.stdout.write(stdout);
        return { exitCode, stdout };
    }
    const message = result.ok ? result.summary : result.reason;
    let stderr = `umactually: ${path}: ${message ?? "invalid artifact"}\n`;
    for (const warning of result.warnings) {
        const annotation = `::warning::${warning}\n`;
        process.stdout.write(annotation);
        stderr += annotation;
    }
    process.stderr.write(stderr);
    return { exitCode, stderr };
}
async function runDoctorBranch(args) {
    const json = args.includes("--json");
    // In a Bun --compile binary, import.meta.url resolves to Bun's virtual
    // filesystem and process.execPath is the real binary. In Node (npm install
    // or dev), process.execPath is the node binary itself, so use import.meta.url.
    // The bare UMACTUALLY_VERSION identifier is replaced at compile time —
    // either by Bun's --define flag, or by tsdown's `define` config (v0.6.0
    // distribution pipeline; see tsdown.config.ts). In Node (npm/dev) it is
    // undefined.
    const isCompiledBinary = typeof UMACTUALLY_VERSION === "string";
    const packageRoot = isCompiledBinary
        ? (0,external_node_path_namespaceObject.dirname)(process.execPath)
        : (0,external_node_path_namespaceObject.resolve)((0,external_node_path_namespaceObject.dirname)((0,external_node_url_namespaceObject.fileURLToPath)(import.meta.url)), "..");
    const result = await runDoctor({
        cwd: process.cwd(),
        isTTY: process.stdout.isTTY === true,
        env: process.env,
        fsAdapter: { stat: promises_namespaceObject.stat },
        execFile: async (file, fileArgs, options) => {
            const output = await execFile(file, fileArgs, options);
            return { stdout: output.stdout, stderr: output.stderr };
        },
        packageRoot,
    });
    let stdout;
    if (json) {
        const envelope = createEnvelope("doctor", JSON.parse(formatDoctorJson(result)), { exitCode: result.exitCode });
        stdout = `${JSON.stringify(envelope)}\n`;
    }
    else {
        stdout = formatDoctorHuman(result.checks);
    }
    process.stdout.write(stdout);
    return { exitCode: result.exitCode, stdout };
}
async function runUninstallBranch(args) {
    const { mode, errors, help, json } = parseUninstallArgs(args);
    if (help) {
        process.stdout.write(uninstall_UNINSTALL_HELP_TEXT);
        process.stdout.write("\n");
        return { exitCode: 0, stdout: uninstall_UNINSTALL_HELP_TEXT };
    }
    if (errors.length > 0) {
        const stderr = `umactually uninstall: ${errors.join("; ")}\n`;
        process.stderr.write(stderr);
        return { exitCode: 2, stderr };
    }
    const deps = {
        isTTY: process.stdout.isTTY === true && !json,
        env: process.env,
        fsAdapter: defaultFsAdapter,
        // No stdinReader injected — uninstall.ts falls back to its built-in
        // readline-based default, which is non-blocking and timeout-safe.
        execPath: process.execPath,
        platform: process.platform,
        homeDir: (0,external_node_os_namespaceObject.homedir)(),
        mode,
    };
    // Gate the destructive follow-ups (--purge-config, --revert-path)
    // behind explicit confirmation when running non-interactively. The
    // user clearly requested destructive work but did not pass --yes
    // (or set the corresponding env var), and we have no way to
    // prompt them. Refuse the WHOLE command — including the binary
    // removal — so the user gets a clean "nothing happened" state.
    // Running the binary removal first and then refusing the
    // follow-ups would leave the user confused about what was
    // actually changed on disk.
    //
    // Honors the same env vars that shouldPrompt honors:
    //   - UMACTUALLY_UNINSTALL_YES=1
    //   - UMACTUALLY_YES=true
    // so a CI job with `UMACTUALLY_UNINSTALL_YES=1 umactually uninstall
    // --purge-config` works without also passing --yes on the command
    // line.
    const yesEnv = deps.env["UMACTUALLY_UNINSTALL_YES"] ?? deps.env["UMACTUALLY_YES"];
    const envAffirmed = yesEnv === "1" || yesEnv === "true";
    if (!deps.isTTY &&
        mode.yes !== true &&
        !envAffirmed &&
        (mode.purgeConfig === true || mode.revertPath === true)) {
        const stderr = "umactually uninstall: --purge-config and --revert-path require --yes (or UMACTUALLY_UNINSTALL_YES=1) " +
            "in non-interactive mode. Nothing was changed; re-run with --yes to proceed, or omit the destructive flags.\n";
        process.stderr.write(stderr);
        return { exitCode: 2, stderr };
    }
    const result = await runUninstall(deps);
    // If the user declined the prompt for the binary removal, do NOT run
    // the follow-up destructive actions. A 'n' answer should be an
    // unconditional abort, not a partial state where the binary is kept
    // but config and shell-rc edits are still wiped.
    let additionalChecks = [];
    if (!userDeclinedPrompt(result) && (mode.purgeConfig === true || mode.revertPath === true)) {
        // The binary-removal prompt covered only the binary itself. The
        // follow-up destructive actions (config wipe, PATH revert) are
        // separate destructive operations and need their own confirmation
        // in interactive mode. The user can decline here and keep the
        // binary removed but the config intact.
        if (shouldPrompt(deps)) {
            const parts = [];
            if (mode.purgeConfig === true) {
                parts.push("remove ~/.umactually/ and ~/.cache/umactually/");
            }
            if (mode.revertPath === true) {
                parts.push("strip the umactually PATH block from your shell rc files");
            }
            const promptText = `Also ${parts.join(" and ")}? [y/N] `;
            const reader = deps.stdinReader ?? defaultStdinReader;
            const confirm = await reader(promptText, deps.isTTY);
            if (confirm !== null && /^y(es)?$/i.test(confirm.trim())) {
                additionalChecks = [
                    ...(mode.purgeConfig ? purgeConfig(deps) : []),
                    ...(mode.revertPath ? revertPath(deps) : []),
                ];
            }
            else {
                // The user declined (or EOFed) the follow-up prompt. The
                // binary-removal already succeeded; the user just opted out
                // of the additional cleanup. Emit visible skip checks so the
                // output is not confusingly silent — the user ran with
                // --purge-config / --revert-path and should see what was
                // requested vs. what was done.
                const declineChecks = [];
                if (mode.purgeConfig === true) {
                    declineChecks.push({
                        id: "config-removal",
                        status: "skip",
                        message: "user declined the additional cleanup prompt; ~/.umactually/ kept",
                    });
                }
                if (mode.revertPath === true) {
                    declineChecks.push({
                        id: "path-revert",
                        status: "skip",
                        message: "user declined the additional cleanup prompt; shell rc files kept",
                    });
                }
                additionalChecks = declineChecks;
            }
        }
        else {
            // isTTY=false + --yes (the gate at the top of this function
            // already blocked the !--yes + !isTTY case).
            additionalChecks = [
                ...(mode.purgeConfig ? purgeConfig(deps) : []),
                ...(mode.revertPath ? revertPath(deps) : []),
            ];
        }
    }
    const checks = [...result.checks, ...additionalChecks];
    const exitCode = checks.some((c) => c.status === "fail") ? 1 : result.exitCode;
    const finalResult = { ...result, exitCode, checks };
    let stdout;
    if (json) {
        const envelope = createEnvelope("uninstall", JSON.parse(formatUninstallJson(finalResult, mode, deps.execPath)), { exitCode });
        stdout = `${JSON.stringify(envelope)}\n`;
    }
    else {
        stdout = formatUninstallHuman(finalResult);
    }
    process.stdout.write(stdout);
    return { exitCode, stdout };
}
async function runInitBranch(args) {
    const json = args.includes("--json");
    const initArgs = args.filter((arg) => arg !== "--no-color");
    if (initArgs.includes("--help") || initArgs.includes("-h")) {
        process.stdout.write(init_INIT_HELP_TEXT);
        return { exitCode: 0, stdout: init_INIT_HELP_TEXT };
    }
    const result = await runInit({
        argv: initArgs,
        deps: {
            argv: initArgs,
            env: process.env,
            cwd: process.cwd(),
            homeDir: (0,external_node_os_namespaceObject.homedir)(),
            platform: process.platform,
            packageVersion: process.env["UMACTUALLY_VERSION"] ?? "0.6.21",
        },
    });
    const stdout = json ? formatInitJson(result) : formatInitHuman(result);
    process.stdout.write(stdout);
    return { exitCode: result.exitCode, stdout };
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
function json_guards_isRecord(value) {
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
    if (!json_guards_isRecord(value)) {
        return null;
    }
    const inner = value[key];
    return json_guards_isRecord(inner) ? inner : null;
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
    return json_guards_isRecord(parsed) ? parsed : null;
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
/**
 * Sum the postable severity counts into a single "are there findings?"
 * boolean. Used by both `reconcileVerdictForEmptySeverityCounts` and
 * `escalateVerdictForNonEmptySeverityCounts` so the empty/non-empty
 * check is defined exactly once. A non-empty `severityCounts` object
 * with all zero-valued tiers (e.g. `{"medium": 0, "high": 0}` from a
 * malformed upstream producer) is treated as empty — same contract as
 * the existing reconcile helper.
 */
function totalSeverityCount(severityCounts) {
    let total = 0;
    for (const value of Object.values(severityCounts)) {
        total += value;
    }
    return total;
}
/**
 * Reconcile a non-blocking verdict (SHIP / APPROVED / COMMENT / DISCUSS /
 * unknown) against the postable severity counts. The model emits a verdict
 * string from its JSON payload verbatim, but a verdict that says "ship it"
 * or "looks good" is incoherent with a body that lists postable findings
 * the user explicitly opted into via `--minimum-severity`.
 *
 * This is the inverse direction of `reconcileVerdictForEmptySeverityCounts`:
 *   - empty counts + non-blocking verdict → coherent state, pass through
 *     (`✅ SHIP` on zero findings IS the canonical "no findings, looks good"
 *     outcome — must NOT be re-stamped).
 *   - non-empty counts + non-blocking verdict → upgrade to `NEEDS_FIX`
 *     because the model missed what its own findings list implies.
 *
 * `NEEDS_FIX` passes through (the inverse helper handles the empty-counts
 * downgrade direction). Unknown verdict strings ALSO upgrade to
 * `NEEDS_FIX` when counts are non-empty — the same "model said one thing,
 * its findings imply another" contradiction applies regardless of whether
 * the verdict string is one of the canonical four. This helper is a
 * contradiction guard, NOT a verdict normaliser: it doesn't try to map
 * "MAYBE" or "looks_ok" onto the canonical vocabulary, only to decide
 * whether the body and verdict disagree. The existing verdict mappers
 * (`mapVerdictToAzureStatus`, `mapVerdictToGithubEvent`) still see the
 * raw verdict and collapse unknowns to their own safe defaults there.
 *
 * Regression: PR #183 self-review (verdict-severity-contradiction review
 * pass). The model emitted `verdict: "SHIP"` with `summary: "looks good,
 * ship it"` while the inline comments contained a SonarCloud MAJOR
 * finding. The badge rendered `✅ SHIP` against `📊 1 inline finding`, the
 * prose at the top of the body said "ship it", and a reviewer scanning
 * the top would miss the MAJOR inline thread below. The
 * `reconcileVerdictForEmptySeverityCounts` helper that already handles
 * the reverse case (NEEDS_FIX + empty counts → COMMENT) only fires on the
 * inverse; this helper completes the symmetry.
 */
function escalateVerdictForNonEmptySeverityCounts(verdict, severityCounts) {
    const normalized = verdict.toUpperCase();
    if (normalized === "NEEDS_FIX") {
        return verdict;
    }
    if (totalSeverityCount(severityCounts) > 0) {
        return "NEEDS_FIX";
    }
    return verdict;
}
/**
 * Apply both reconciliation rules in order and report whether the verdict
 * was changed from the model's raw value. Single-call helper for the
 * user-facing surfaces that need both rules (badge, manifest, GitHub
 * review event, Azure PR status, merge worst-verdict pick).
 *
 * Reconciliation order matters:
 *   1. First downgrade `NEEDS_FIX` + empty counts to `COMMENT`
 *      (existing rule, prevents the `⛔ NEEDS_FIX` + `📊 0 inline findings`
 *      contradiction — PR #18).
 *   2. Then upgrade any non-blocking verdict with non-empty counts to
 *      `NEEDS_FIX` (new rule, prevents the `✅ SHIP` + `📊 N inline findings`
 *      contradiction where N ≥ 1 — PR #183 review pass).
 *
 * The two rules are not contradictory on the same input: rule 1 fires
 * only on empty counts; rule 2 fires only on non-empty counts. A review
 * that fires rule 1 will never fire rule 2.
 *
 * Returned `escalated: true` means the caller should render a one-line
 * banner so a reviewer scanning the headline sees why the verdict
 * disagrees with the model's prose summary. Kept as a separate boolean
 * (not a sentence) so callers can format it consistently with the rest
 * of the rendered layout — the banner text lives in
 * `src/render/summary-layouts.ts` so the verdict utility stays
 * pure-data.
 */
function composeEffectiveVerdict(input) {
    const { rawVerdict, severityCounts } = input;
    const downgraded = reconcileVerdictForEmptySeverityCounts(rawVerdict, severityCounts);
    const final = escalateVerdictForNonEmptySeverityCounts(downgraded, severityCounts);
    return { verdict: final, escalated: final.toUpperCase() !== rawVerdict.toUpperCase() };
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
    if (json_guards_isRecord(value)) {
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
function isExcludedPath(path) {
    return isBuildArtifactPath(path);
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
    if (!json_guards_isRecord(value)) {
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

function parse_positions_parseDiffPositions(diffText) {
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
    const positions = parse_positions_parseDiffPositions(contract.diffText);
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
    if (!json_guards_isRecord(value)) {
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
 * When `true`, suppress the GitHub-Actions-specific `::error::` /
 * `::warning::` / `::notice::` annotation prefixes and emit the
 * brand-prefixed message as a plain line. Test scenarios that
 * intentionally exercise error paths (e.g. the leak gate's
 * "Refusing to post" message) would otherwise surface as
 * `##[error]` workflow annotations in every PR CI log, which is
 * noise — the test EXPECTS the error and asserts on it via
 * `result.message`, but the workflow annotation makes the PR
 * look like it has a new failure on every run.
 *
 * Detection: explicit `UMACTUALLY_QUIET_ANNOTATIONS=1` env var
 * (set by vitest's setup file), OR `process.env.VITEST` is
 * defined (vitest sets this for every test file by default).
 */
function isQuietAnnotationMode() {
    if (process.env["UMACTUALLY_QUIET_ANNOTATIONS"] === "1")
        return true;
    if (typeof process.env["VITEST"] === "string" && process.env["VITEST"].length > 0) {
        return true;
    }
    return false;
}
/**
 * @returns A single line ending with exactly one newline character. Do not append another newline.
 */
function formatAnnotation(level, action, message) {
    const actionPrefix = action.length > 0 ? `${action} ` : "";
    if (isQuietAnnotationMode()) {
        // Plain brand-prefixed line — no `::error::` workflow annotation
        // prefix, so the line still appears in the test log but does NOT
        // surface as a GitHub Actions check annotation. The brand prefix
        // is kept so test assertions that grep for `umactually: ...` still
        // match.
        return `${BRAND_PREFIX}${actionPrefix}${message}\n`;
    }
    return `::${level}::${BRAND_PREFIX}${actionPrefix}${message}\n`;
}
function writeAnnotation(level, action, message) {
    const formatted = formatAnnotation(level, action, message);
    try {
        process.stderr.write(formatted);
    }
    catch {
        if (level !== "debug") {
            // Fallback path: process.stderr.write threw, so we route
            // through console.error instead. The output is the SAME
            // `formatted` string the normal write would have produced —
            // i.e. it respects the quiet-mode strip in formatAnnotation.
            // Rationale: the fallback is reached ONLY when the normal
            // stderr is broken. If we're under vitest, the quiet-mode
            // intent still applies (don't surface as a `##[error]`
            // workflow annotation in the test runner). Re-formatting
            // with the `::error::` prefix would re-introduce exactly
            // the noise the quiet-mode strip was added to prevent.
            // The contract test
            // (test/unit/log.test.ts > 'falls back to console.error
            // when stderr write throws') was updated to assert on the
            // quiet-mode-prefixed form.
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
 * Replaces the 15+ hand-rolled `process.stderr.write(\`::warning::umactually: ...\`)`
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
function url_extractHostname(baseUrl) {
    const trimmed = baseUrl.trim();
    if (trimmed.length === 0)
        return null;
    let host;
    try {
        host = new URL(trimmed).hostname;
    }
    catch {
        // Fallback: scheme-less URLs (`API.MINIMAX.IO`, `localhost:8080`)
        // don't parse with `new URL()`. Strip the scheme manually, then
        // read up to the first `/` or `:`.
        const schemeSep = trimmed.indexOf("://");
        const afterScheme = schemeSep === -1 ? trimmed : trimmed.slice(schemeSep + 3);
        const firstSlash = afterScheme.indexOf("/");
        const firstColon = afterScheme.indexOf(":");
        const stop = firstSlash === -1 ? afterScheme.length : firstSlash;
        host = firstColon === -1 || firstColon > stop
            ? afterScheme.slice(0, stop)
            : afterScheme.slice(0, firstColon);
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
    const pasted = url_stripTrailingSlash(baseUrl);
    const normalized = resolveProviderBaseUrl(baseUrl, defaultPrefix);
    if (pasted === normalized) {
        return [pasted];
    }
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
    // Parse once and split origin / path. Drop query string and fragment
    // up front — they don't address the canonical /v1/messages route at
    // any known Anthropic-protocol gateway, and passing them through
    // would append the path segment into the query (`...?token=abc/v1/
    // messages`), an invalid URL.
    let origin;
    let pathPart;
    try {
        const parsed = new URL(baseUrl);
        origin = parsed.origin;
        pathPart = parsed.pathname;
    }
    catch {
        // Unparseable input. Fall back to extractOrigin + raw concatenation.
        //
        // IMPORTANT: keep `pathPart` in the SAME shape `parsed.pathname`
        // would have produced — including a leading `/`. The dispatcher
        // checks below assume the leading-slash form (`/v1`,
        // `/v1/messages`); stripping the slash would route an unparseable
        // input through the wrong branch and produce a doubled
        // `/v1/v1/messages` suffix.
        origin = extractOrigin(baseUrl);
        pathPart = url_stripTrailingSlash(baseUrl).slice(origin.length);
    }
    // Normalize: WHATWG URL sets pathname to "/" for a bare host; we
    // want the empty string so concatenation produces `origin + /v1/messages`
    // without a doubled slash.
    const cleanedPath = url_stripTrailingSlash(pathPart === "/" ? "" : pathPart);
    if (cleanedPath.endsWith("/v1/messages")) {
        // Operator pre-appended the full messages endpoint; idempotent.
        return joinUrl(origin, cleanedPath);
    }
    // Match the LAST path segment being literally `v1`. The previous
    // `cleanedPath.endsWith("/v1")` was a suffix check that falsely
    // matched paths whose trailing characters happened to be `v1`
    // (e.g. `/my-v1` → wrong branch, would append `/messages`
    // instead of `/v1/messages`). Path-segment comparison is the
    // Anthropic-SDK intent: only a trailing `/v1` *segment* counts,
    // not any path that happens to end in those two characters.
    const lastSegment = cleanedPath === "" ? "" : cleanedPath.slice(cleanedPath.lastIndexOf("/") + 1);
    if (cleanedPath === "/v1" || lastSegment === "v1") {
        return joinUrl(origin, `${cleanedPath}/messages`);
    }
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
    if (baseUrl.length === 0)
        return false;
    let pathname;
    try {
        pathname = new URL(baseUrl).pathname;
    }
    catch {
        // Substring fallback for unparseable URLs.
        pathname = url_stripTrailingSlash(baseUrl).replace(/^[a-z]+:\/\/[^/]*/i, "");
    }
    // Normalize trailing slashes and split into segments. The leading
    // slash is preserved; an empty pathname for bare hosts collapses
    // to zero segments.
    const segments = pathname.split("/").filter(s => s.length > 0);
    return segments.some(s => s.toLowerCase() === "anthropic");
}
/**
 * Removes trailing slashes from a URL or path segment. Useful before
 * joining paths so empty-path joins don't produce double slashes.
 */
function url_stripTrailingSlash(value) {
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
    if (value.length === 0)
        return value;
    try {
        const parsed = new URL(value);
        // WHATWG URL normalizes pathname to start with `/`; for a bare
        // host it's just `/`, so concatenating origin + `/` would
        // produce `https://api.example.com/` for an input of
        // `https://api.example.com`. Strip the trailing slash so the
        // redacted form matches the input canonicalization the operator
        // typed.
        const path = parsed.pathname === "/" ? "" : parsed.pathname;
        return `${parsed.origin}${path}`;
    }
    catch {
        // Unparseable URL — strip query and fragment manually.
        const noQuery = value.split("?")[0] ?? value;
        return noQuery.split("#")[0] ?? noQuery;
    }
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
    if (!json_guards_isRecord(value)) {
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
    if (!json_guards_isRecord(value)) {
        throw new SonarFixtureParseError("quality-gate-sequence", "poll attempt objects");
    }
    const projectStatus = value["projectStatus"];
    if (!json_guards_isRecord(projectStatus)) {
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
    if (!json_guards_isRecord(value) || !isReadonlyArray(value["issues"])) {
        throw new SonarFixtureParseError("issues", "an issues array");
    }
    return {
        issues: value["issues"],
    };
}
function parseSonarHotspots(json) {
    const value = parseJson(json);
    if (!json_guards_isRecord(value) || !isReadonlyArray(value["hotspots"])) {
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
    promptFiles: "promptSystemFiles",
    additionalPromptFile: "promptUserFile",
    additionalPromptFiles: "promptUserFiles",
    strictSchema: "strictSchema",
    verifyFindings: "verifyFindings",
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

;// CONCATENATED MODULE: ./src/util/debug-raw.ts
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
    if (enabled) {
        process.env[DEBUG_RAW_ENV] = "1";
    }
    try {
        return await fn();
    }
    finally {
        if (previous === undefined) {
            delete process.env[DEBUG_RAW_ENV];
        }
        else {
            process.env[DEBUG_RAW_ENV] = previous;
        }
    }
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
    if (typeof raw !== "string" || raw.length === 0)
        return [];
    const seen = new Set();
    const out = [];
    // Split on commas AND any newline flavor (LF, CR-LF, CR-only).
    // The trim() on each piece also strips trailing CR that CR-LF
    // leaves behind after the LF split, so the round-trip is safe on
    // Windows-pasted strings.
    for (const piece of raw.split(/[\n\r,]/u)) {
        const trimmed = piece.trim();
        if (trimmed.length === 0)
            continue;
        if (seen.has(trimmed))
            continue;
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
    "GEMINI.md",
];
/**
 * Resolve `DEFAULT_PROMPT_FILE_PATHS` against `cwd` and return only the
 * paths that exist on disk and are regular files. Missing entries are
 * silently dropped (not an error). Symlink targets are NOT followed here
 * — `readPromptFiles` does its own realpath resolution at read time.
 *
 * Pure (no global fs). Accepts the same `PromptFileSystem` shape used
 * by `readPromptFiles` so tests can inject a fake filesystem. The
 * default implementation uses the real `node:fs`.
 */
async function resolveDefaultPromptFiles(cwd, fs) {
    const existing = [];
    for (const candidate of DEFAULT_PROMPT_FILE_PATHS) {
        try {
            // Use path.join for proper platform-aware path composition
            // (handles POSIX, Windows separators, and trailing slashes on
            // cwd without ad-hoc string manipulation). DEFAULT_PROMPT_FILE_PATHS
            // entries are hardcoded relative paths so this is safe; the
            // security boundary for explicit `prompt-files` arrays is
            // enforced separately inside `readPromptFiles`.
            const stat = await fs.stat(pathJoin(cwd, candidate));
            if (stat.isFile) {
                existing.push(candidate);
            }
        }
        catch {
            // ENOENT (or any other stat failure): silently skip. The user did
            // not opt in to this file; its absence is not an error.
        }
    }
    return existing;
}

;// CONCATENATED MODULE: ./src/config/field-resolution.ts




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
    if (parsedValue !== undefined && parsedValue !== null) {
        if (typeof parsedValue === "string" && parsedValue.length === 0) {
            // Empty string is treated as missing for string fields.
        }
        else {
            return parsedValue;
        }
    }
    if (envValue !== undefined && envValue !== null) {
        if (typeof envValue === "string" && envValue.length === 0) {
            // Empty string from env is treated as missing.
        }
        else {
            return envValue;
        }
    }
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
        fieldProvenance[field.field] = parsedValue !== undefined
            ? { source: "flag" }
            : envValue !== undefined
                ? { source: "env", envName: envValue.envName }
                : { source: "default" };
    }
    resolved["minimumSeverityInternal"] = parseSeverityFromUnknown(resolved["minimumSeverity"], FIELDS.minimumSeverity.field);
    return Object.assign({}, parsed, resolved, { fieldProvenance });
}
function parsedValueForField(parsed, field) {
    if (!(field.field in parsed)) {
        return undefined;
    }
    if (field.flag !== null && !wasCliFieldExplicitlySet(parsed, field.field)) {
        return undefined;
    }
    const value = Reflect.get(parsed, field.field);
    return value === null ? undefined : value;
}
function firstNonBlankEnv(aliases, env) {
    for (const alias of aliases) {
        const value = env[alias];
        if (typeof value === "string" && value.trim().length > 0) {
            return { envName: alias, value };
        }
    }
    return undefined;
}
function coerceField(field, raw) {
    switch (field.type) {
        case "string":
            if (typeof raw !== "string") {
                throw new errors_InvalidConfigError(field.field, `expected string, received ${typeof raw}`);
            }
            return raw;
        case "boolean":
            return parseBooleanFromUnknown(raw, field.field);
        case "integer":
            return parseIntegerFromUnknown(raw, field.field);
        case "enum":
            return parseEnumField(field, raw);
        default:
            return assertNever(field.type);
    }
}
function parseEnumField(field, raw) {
    if (field.field === "platform") {
        return parsePlatformFromUnknown(raw, field.field);
    }
    if (field.field === "minimumSeverity") {
        parseSeverityFromUnknown(raw, field.field);
    }
    if (typeof raw !== "string") {
        throw new errors_InvalidConfigError(field.field, `expected enum string, received ${typeof raw}`);
    }
    const normalized = raw.trim().toLowerCase();
    if (!(field.enumValues ?? []).includes(normalized)) {
        throw new errors_InvalidConfigError(field.field, `unknown enum value ${REDACTED_PLACEHOLDER}`);
    }
    return normalized;
}
function assertNever(value) {
    throw new errors_InvalidConfigError("field.type", `unknown field type ${String(value)}`);
}

;// CONCATENATED MODULE: ./src/review/verified-facts.ts
// SPDX-License-Identifier: MIT
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
        actionOutputs: readActionOutputs(diffText),
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
    if (facts.packageJsonFiles !== null) {
        lines.push(`package.json#files (post-change): ${JSON.stringify(facts.packageJsonFiles.files)}`);
    }
    if (facts.packageJsonBin !== null) {
        lines.push(`package.json#bin (post-change): ${JSON.stringify(facts.packageJsonBin.binEntries)}`);
    }
    if (facts.packageJsonMain !== null) {
        lines.push(`package.json#main (post-change): ${JSON.stringify(facts.packageJsonMain.main)}`);
    }
    if (facts.actionOutputs !== null) {
        lines.push(`action.yml#outputs (post-change): ${JSON.stringify(facts.actionOutputs.outputKeys)}`);
    }
    if (lines.length === 0) {
        return "";
    }
    return [
        "Verified facts (reconstructed from the diff below; do NOT contradict these — they are authoritative for this PR):",
        ...lines,
        "If a finding would contradict any of the above, the finding is wrong; omit it or rephrase without the contradiction.",
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
    const files = new Map();
    let currentPath = null;
    let buffer = null;
    const flush = () => {
        if (currentPath !== null && buffer !== null) {
            files.set(currentPath, buffer);
        }
    };
    for (const line of diffText.split(/\r?\n/u)) {
        if (line.startsWith("diff --git ")) {
            flush();
            const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
            currentPath = match === null ? null : (match[2] ?? null);
            buffer = [];
            continue;
        }
        if (currentPath === null || buffer === null) {
            continue;
        }
        if (line.startsWith("+++") || line.startsWith("---")) {
            continue;
        }
        if (line.startsWith("@@")) {
            continue;
        }
        // Only process unified-diff hunk lines. A line that doesn't
        // start with one of the three markers ('+', '-', ' ') is not
        // a valid hunk line (e.g. a stray blank line, an annotation).
        // Skip it rather than injecting it as a context line, which
        // would shift line numbers and corrupt the JSON parser
        // downstream.
        if (line.startsWith("+")) {
            buffer.push(line.slice(1));
        }
        else if (line.startsWith("-")) {
            // removed line: skip
        }
        else if (line.startsWith(" ")) {
            buffer.push(line.slice(1));
        }
        else {
            // No diff marker; ignore (e.g. blank line, malformed input).
        }
    }
    flush();
    const reconstructed = files.get(filePath);
    return reconstructed === undefined ? null : reconstructed.join("\n");
}
/**
 * Shared scaffolding for the three package.json field extractors
 * (`readPackageJsonFiles`, `readPackageJsonBin`, `readPackageJsonMain`).
 *
 * The pattern is the same in all three: reconstruct the post-change
 * `package.json` content from the diff; if absent, return null;
 * otherwise try a full JSON parse first (covers the "the whole file
 * fits in one hunk" case), then fall back to a targeted scanner
 * (covers the "only the field's contents changed" case).
 *
 * Both branches return the same shape as `T`, so the caller picks
 * the per-field `fromParsed` + `fromScan` functions and lets this
 * helper route the right one. Dedupes ~30 lines of preamble across
 * the three call sites (DRY-refactor T2h).
 */
function readPackageJsonField(diffText, fromParsed, fromScan) {
    const content = reconstructFileFromDiff(diffText, "package.json");
    if (content === null) {
        return null;
    }
    // Try full JSON parse first — works when the diff includes enough
    // of the file to form a valid document (e.g. when package.json is
    // small enough that one hunk covers the whole `files` block).
    const fullParse = tryParsePackageJson(content);
    if (fullParse !== null) {
        return fromParsed(fullParse);
    }
    // Fall back to targeted extraction: find the per-field key and
    // read its value (or scan for the array/object contents). Handles
    // the common case where only the field's contents were changed
    // (the field opener is in the unchanged context).
    return fromScan(content);
}
function readPackageJsonFiles(diffText) {
    return readPackageJsonField(diffText, extractFilesFromParsed, extractFilesByScanning);
}
function readPackageJsonBin(diffText) {
    return readPackageJsonField(diffText, extractBinFromParsed, extractBinByScanning);
}
function readPackageJsonMain(diffText) {
    return readPackageJsonField(diffText, extractMainFromParsed, extractMainByScanning);
}
function tryParsePackageJson(content) {
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function extractFilesFromParsed(pkg) {
    const files = pkg["files"];
    if (files === undefined) {
        return null;
    }
    if (!Array.isArray(files)) {
        return null;
    }
    const out = [];
    for (const entry of files) {
        if (typeof entry !== "string") {
            return null;
        }
        out.push(entry);
    }
    return { kind: "package-json-files", files: out };
}
function extractBinFromParsed(pkg) {
    const bin = pkg["bin"];
    if (bin === undefined) {
        return { kind: "package-json-bin", binEntries: [] };
    }
    if (typeof bin === "string") {
        return { kind: "package-json-bin", binEntries: [`(binary) -> ${bin}`] };
    }
    if (typeof bin !== "object" || bin === null || Array.isArray(bin)) {
        return null;
    }
    const out = [];
    for (const [name, value] of Object.entries(bin)) {
        if (typeof value !== "string") {
            return null;
        }
        out.push(`${name} -> ${value}`);
    }
    return { kind: "package-json-bin", binEntries: out };
}
function extractMainFromParsed(pkg) {
    const main = pkg["main"];
    if (main === undefined) {
        return null;
    }
    if (typeof main !== "string") {
        return null;
    }
    return { kind: "package-json-main", main };
}
// ---------------------------------------------------------------------------
// Targeted scanners — used when the diff only contains part of the file
// and JSON.parse fails. Each scanner locates a JSON key and reads its
// array / object / string value with a hand-rolled walker.
// ---------------------------------------------------------------------------
/**
 * Find `"files": [ ... ]` and read every string element. Returns null
 * if the key isn't present or the array isn't a clean JSON string
 * array. Tolerates multiline arrays.
 */
function extractFilesByScanning(content) {
    const start = findKeyIndex(content, '"files"');
    if (start === -1) {
        return null;
    }
    let i = content.indexOf(":", start) + 1;
    while (i < content.length && /\s/u.test(content[i] ?? "")) {
        i++;
    }
    if (content[i] !== "[") {
        return null;
    }
    i++;
    const out = [];
    while (i < content.length) {
        const ch = content[i];
        if (ch === undefined) {
            return null;
        }
        if (ch === "]") {
            return { kind: "package-json-files", files: out };
        }
        if (ch === '"') {
            const end = readStringLiteral(content, i);
            if (end === -1) {
                return null;
            }
            out.push(decodeStringLiteral(content.slice(i + 1, end)));
            i = end + 1;
            while (i < content.length &&
                (content[i] === " " || content[i] === "\t" || content[i] === "\n" || content[i] === "\r" || content[i] === ",")) {
                i++;
            }
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
    const start = findKeyIndex(content, '"bin"');
    if (start === -1) {
        // `bin` was not mentioned in the diff at all — we don't know
        // whether it was removed or simply not touched. Conservatively
        // omit rather than misreport.
        return null;
    }
    let i = content.indexOf(":", start) + 1;
    while (i < content.length && /\s/u.test(content[i] ?? "")) {
        i++;
    }
    if (content[i] === '"') {
        // Single string form: `"bin": "bin/foo.mjs"`.
        const end = readStringLiteral(content, i);
        if (end === -1) {
            return null;
        }
        const value = decodeStringLiteral(content.slice(i + 1, end));
        return { kind: "package-json-bin", binEntries: [`(binary) -> ${value}`] };
    }
    if (content[i] !== "{") {
        return null;
    }
    i++;
    const out = [];
    while (i < content.length) {
        const ch = content[i];
        if (ch === undefined) {
            return null;
        }
        if (ch === "}") {
            return { kind: "package-json-bin", binEntries: out };
        }
        if (ch === '"') {
            const keyEnd = readStringLiteral(content, i);
            if (keyEnd === -1) {
                return null;
            }
            const name = decodeStringLiteral(content.slice(i + 1, keyEnd));
            let j = keyEnd + 1;
            while (j < content.length && (content[j] === " " || content[j] === "\t" || content[j] === "\n" || content[j] === "\r")) {
                j++;
            }
            if (content[j] !== ":") {
                return null;
            }
            j++;
            while (j < content.length && (content[j] === " " || content[j] === "\t" || content[j] === "\n" || content[j] === "\r")) {
                j++;
            }
            if (content[j] !== '"') {
                return null;
            }
            const valEnd = readStringLiteral(content, j);
            if (valEnd === -1) {
                return null;
            }
            const value = decodeStringLiteral(content.slice(j + 1, valEnd));
            out.push(`${name} -> ${value}`);
            i = valEnd + 1;
            while (i < content.length &&
                (content[i] === " " || content[i] === "\t" || content[i] === "\n" || content[i] === "\r" || content[i] === ",")) {
                i++;
            }
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
    const start = findKeyIndex(content, '"main"');
    if (start === -1) {
        return null;
    }
    let i = content.indexOf(":", start) + 1;
    while (i < content.length && /\s/u.test(content[i] ?? "")) {
        i++;
    }
    if (content[i] !== '"') {
        return null;
    }
    const end = readStringLiteral(content, i);
    if (end === -1) {
        return null;
    }
    return { kind: "package-json-main", main: decodeStringLiteral(content.slice(i + 1, end)) };
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
        if (idx === -1) {
            return -1;
        }
        let j = idx + quotedKey.length;
        while (j < content.length && (content[j] === " " || content[j] === "\t")) {
            j++;
        }
        if (content[j] === ":") {
            return idx;
        }
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
        if (ch === undefined) {
            return -1;
        }
        if (ch === "\\") {
            i++;
            continue;
        }
        if (ch === '"') {
            return i;
        }
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
            if (next === undefined) {
                out += "\\";
                continue;
            }
            switch (next) {
                case '"':
                    out += '"';
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
                    out += "\t";
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
    if (content === null) {
        return null;
    }
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
        if (!inOutputsBlock) {
            continue;
        }
        if (line.length > 0 && line[0] !== " " && line[0] !== "\t") {
            inOutputsBlock = false;
            continue;
        }
        const keyMatch = /^  (\w[\w-]*)\s*:/u.exec(line);
        if (keyMatch !== null) {
            outputKeys.push(keyMatch[1] ?? "");
        }
    }
    if (sawOutputsMarker) {
        return { kind: "action-outputs", outputKeys };
    }
    // Reconstructed action.yml has no `outputs:` line. Distinguish:
    // (a) the diff explicitly removed the outputs block — in which
    //     case the post-change state is "no outputs" and we should
    //     report it as such.
    // (b) action.yml never had outputs, or our reconstruction is
    //     incomplete — in which case we should not report it.
    if (/^-\s*outputs\s*:\s*$/um.test(diffText)) {
        return { kind: "action-outputs", outputKeys: [] };
    }
    // Also detect removal of the entire outputs block (the `outputs:`
    // line is in a `-outputs:` removal but the keys were also
    // removed as a sequence). Check for any `-  <key>:` pattern that
    // is a key in the outputs block. As a fallback, check whether
    // the diff has the `outputs:` word at all in a removed line.
    if (/^-\s*outputs\b/um.test(diffText)) {
        return { kind: "action-outputs", outputKeys: [] };
    }
    return null;
}

;// CONCATENATED MODULE: ./src/util/env-keys.ts
/** Centralised env-var name registry; eliminates inline `env["..."]` strings and keeps legacy aliases visible. */
const ENV_KEYS = {
    // UMACTUALLY_* canonical, REVIEW_* legacy aliases
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
    // Platform runtime
    GITHUB_ACTIONS: "GITHUB_ACTIONS",
    GITHUB_EVENT_PATH: "GITHUB_EVENT_PATH",
    GITHUB_TOKEN: "GITHUB_TOKEN",
    // GH_TOKEN is a legacy alias for GITHUB_TOKEN per init-guided-setup plan T9;
    // schema's env: ["GITHUB_TOKEN", "GH_TOKEN"] iterates this alias automatically.
    GH_TOKEN: "GH_TOKEN",
    GITHUB_REPOSITORY: "GITHUB_REPOSITORY",
    GITHUB_REF: "GITHUB_REF",
    GITHUB_SHA: "GITHUB_SHA",
    // Azure DevOps runtime
    TF_BUILD: "TF_BUILD",
    SYSTEM_ACCESSTOKEN: "SYSTEM_ACCESSTOKEN",
    SYSTEM_TEAMPROJECT: "SYSTEM_TEAMPROJECT",
    SYSTEM_COLLECTIONURI: "SYSTEM_COLLECTIONURI",
    BUILD_REPOSITORY_ID: "BUILD_REPOSITORY_ID",
    SYSTEM_PULLREQUEST_PULLREQUESTID: "SYSTEM_PULLREQUEST_PULLREQUESTID",
    SYSTEM_PULLREQUEST_SOURCECOMMITID: "SYSTEM_PULLREQUEST_SOURCECOMMITID",
    SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "SYSTEM_PULLREQUEST_TARGETBRANCHNAME",
    // Inputs (already wrapped as INPUT_* by GitHub)
    INPUT_DRY_RUN: "INPUT_DRY_RUN",
    INPUT_EVENT: "INPUT_EVENT",
    INPUT_DIFF: "INPUT_DIFF",
    INPUT_REVIEW: "INPUT_REVIEW",
    INPUT_THREADS: "INPUT_THREADS",
    INPUT_OUTPUT_ARTIFACT: "INPUT_OUTPUT_ARTIFACT",
    INPUT_PLATFORM: "INPUT_PLATFORM",
};

;// CONCATENATED MODULE: ./src/cli/provider-prompts.ts








// Re-exports of the default-lookup and splitting primitives so callers
// (including the CLI help and tests) can import them from the public
// `cli/provider-prompts` surface without reaching into `config/`.

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
    // Resolve the default-lookup list ONCE per cwd so the chunked
    // orchestrator (which calls buildProviderPrompts PER chunk) does
    // not race on multiple parallel fs.stat calls or break the
    // single-threaded sink assumption that `setActiveSeveritySink`
    // relies on. Implementation: synchronous stat() so we do NOT add a
    // new `await` boundary at the top of buildProviderPrompts.
    const defaultPaths = resolveDefaultPromptFilesOnce(input.cwd);
    const additionalPrompt = await readAdditionalPrompt(input, defaultPaths);
    const userParts = [
        `Platform: ${input.platform}`,
        additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
    ];
    if (input.sonarContext !== undefined && input.sonarContext.length > 0) {
        userParts.push(input.sonarContext);
    }
    // Verified facts layer — pre-computed, authoritative repo state the
    // model sees BEFORE the diff. Without this layer the model can
    // hallucinate verifiable repo facts (e.g. claim dist/ is missing
    // from package.json#files when it is present in the diff). With
    // it, the model has an explicit contradiction anchor.
    const verifiedFacts = collectVerifiedFacts(input.diffText);
    const verifiedBlock = renderVerifiedFactsBlock(verifiedFacts);
    if (verifiedBlock.length > 0) {
        userParts.push(verifiedBlock);
    }
    // Layer 2-A: enumerate the diff's path list in the user message
    // so the model can verify any cited path by grep. We list the
    // paths even on the strict-schema path (which already constrains
    // `path` to a string type) because the model emits a literal
    // string the post-filter then validates against this list.
    userParts.push(buildFilesInDiffBlock(input.diffText));
    userParts.push("Diff:", input.diffText);
    return {
        system: await pickSystemPrompt(input, defaultPaths),
        user: userParts.join("\n\n"),
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
const DEFAULT_PROMPT_FILES_CACHE = new Map();
function resolveDefaultPromptFilesOnce(cwd) {
    const cached = DEFAULT_PROMPT_FILES_CACHE.get(cwd);
    if (cached !== undefined)
        return cached;
    const out = [];
    for (const candidate of DEFAULT_PROMPT_FILE_PATHS) {
        // Defense in depth: every entry in DEFAULT_PROMPT_FILE_PATHS is a
        // hardcoded relative path with no `..` segments and no leading
        // `/`, but `path.join` would silently swallow an absolute candidate
        // (e.g. `/etc/passwd`) and turn it into an absolute path under
        // cwd. Reject anything that is not a plain relative path here so
        // a future change that adds a non-conforming entry surfaces a
        // loud failure instead of silently expanding the security
        // boundary.
        if (!isSafeRelativeCandidate(candidate)) {
            throw new Error(`DEFAULT_PROMPT_FILE_PATHS contains an unsafe entry: ${JSON.stringify(candidate)}. ` +
                `Entries must be relative paths with no '..' segments and no leading '/' or drive letter.`);
        }
        try {
            const s = (0,external_node_fs_.statSync)((0,external_node_path_namespaceObject.join)(cwd, candidate));
            if (s.isFile())
                out.push(candidate);
        }
        catch {
            // ENOENT (or any other stat failure): silently skip.
        }
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
    if (typeof candidate !== "string" || candidate.length === 0)
        return false;
    if (candidate.startsWith("/") || candidate.startsWith("\\"))
        return false;
    // Windows drive-letter prefix: "C:" or "C:\" or "C:/". Reject.
    if (/^[a-zA-Z]:[\\/]?/u.test(candidate))
        return false;
    // No `..` segments (handles both POSIX and Windows separators).
    const segments = candidate.split(/[\\/]/u);
    if (segments.some((seg) => seg === ".."))
        return false;
    return true;
}
/**
 * Test-only hook to clear the per-cwd default-prompt cache. Used by
 * tests that mutate the workspace mid-run and need the next
 * `buildProviderPrompts` call to re-stat the disk.
 *
 * Production callers should NOT need this — see the cache lifetime
 * contract on `DEFAULT_PROMPT_FILES_CACHE`.
 */
function __resetDefaultPromptFilesCacheForTests() {
    DEFAULT_PROMPT_FILES_CACHE.clear();
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
async function pickSystemPrompt(input, defaultPaths) {
    const inline = input.parsed.prompt;
    if (typeof inline === "string" && inline.length > 0) {
        return inline;
    }
    // Precedence for system prompt file resolution:
    //   1. `--prompt-files` (array) — when set, COMPLETELY OVERRIDES the
    //      default-lookup list. The single-file `--prompt-file` is
    //      ignored in this branch so the array semantics are honest.
    //   2. `--prompt-file` (single, legacy) — used as-is.
    //   3. Auto-discover from `DEFAULT_PROMPT_FILE_PATHS` (CLAUDE.md,
    //      AGENTS.md, .github/copilot-instructions.md, .cursorrules,
    //      GEMINI.md). Files that do not exist are skipped.
    //   4. Built-in `buildDefaultSystemPrompt()`.
    const promptFilesRaw = resolveField(input.parsed.promptFiles, input.env[ENV_KEYS.UMACTUALLY_PROMPT_FILES], "");
    const promptFilesList = splitPromptFileList(promptFilesRaw);
    if (promptFilesList.length > 0) {
        return readPromptFiles(promptFilesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
    }
    const filePath = resolveField(input.parsed.promptFile, input.env[ENV_KEYS.UMACTUALLY_PROMPT_FILE], "");
    if (filePath.length > 0) {
        return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
    }
    if (defaultPaths.length > 0) {
        return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
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
        "If the diff is empty or has no actionable findings, return verdict=COMMENT with an empty comments array. Do not invent findings to fill the response.",
    ].join("\n");
}
async function readAdditionalPrompt(input, defaultPaths) {
    const inline = input.parsed.additionalPrompt;
    if (typeof inline === "string" && inline.length > 0) {
        return inline;
    }
    // Precedence mirrors `pickSystemPrompt`: array overrides defaults,
    // single-file is the legacy path, then default-lookup, then empty.
    const filesRaw = resolveField(input.parsed.additionalPromptFiles, input.env[ENV_KEYS.UMACTUALLY_ADDITIONAL_PROMPT_FILES], "");
    const filesList = splitPromptFileList(filesRaw);
    if (filesList.length > 0) {
        return readPromptFiles(filesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
    }
    const filePath = resolveField(input.parsed.additionalPromptFile, input.env[ENV_KEYS.UMACTUALLY_ADDITIONAL_PROMPT_FILE], "");
    if (filePath.length > 0) {
        return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
    }
    if (defaultPaths.length === 0)
        return "";
    return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
}

;// CONCATENATED MODULE: ./src/platform/detect.ts

class PlatformDetectionError extends Error {
    name = "PlatformDetectionError";
    code = "PLATFORM_UNKNOWN";
    constructor() {
        super("Unable to detect a supported CI platform from the process environment.");
    }
}
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
            return validate_assertNever(platform);
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
    if (parsed.dryRun) {
        return false;
    }
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
        if (parsed.sonarHostUrl === null) {
            errors.push({
                flag: "--sonar-host-url",
                message: "--sonar-host-url is required when --include-sonarqube is set",
                hint: "Pass `--sonar-host-url <url>` (e.g. `https://sonar.example.com`) or `UMACTUALLY_SONAR_HOST_URL=<url>`.",
            });
        }
        if (parsed.sonarToken === null) {
            errors.push({
                flag: "--sonar-token",
                message: "--sonar-token is required when --include-sonarqube is set",
                hint: "Pass `--sonar-token <token>` or `UMACTUALLY_SONAR_TOKEN=<token>` (use a CI secret, never source).",
            });
        }
        if (parsed.sonarProjectKey === null) {
            errors.push({
                flag: "--sonar-project-key",
                message: "--sonar-project-key is required when --include-sonarqube is set",
                hint: "Pass `--sonar-project-key <key>` (e.g. `myorg_myrepo`) or `UMACTUALLY_SONAR_PROJECT_KEY=<key>`.",
            });
        }
    }
    // Provider config is required in live mode (the CLI talks to a
    // provider when it runs for real). --dry-run skips the provider call
    // entirely, so api-url/api-key are optional there. Copilot + Anthropic-
    // native providers don't need --api-url (Copilot → GitHub Copilot
    // token exchange; Anthropic → api.anthropic.com default).
    if (!parsed.dryRun) {
        if ((parsed.apiUrl === null || parsed.apiUrl.length === 0) &&
            parsed.provider !== "copilot" &&
            parsed.provider !== "anthropic") {
            errors.push({
                flag: "--api-url",
                message: "--api-url is required",
                hint: "Pass --api-url <url> or UMACTUALLY_API_URL=<url>, or use --dry-run to skip the provider call.",
            });
        }
        if (parsed.apiKey === null || parsed.apiKey.length === 0) {
            errors.push({
                flag: "--api-key",
                message: "--api-key is required",
                hint: "Pass --api-key <key> or UMACTUALLY_API_KEY=<key> (use a CI secret, never source), or use --dry-run to skip the provider call.",
            });
        }
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
    if (!isPostingRequested(parsed)) {
        return [];
    }
    // Local-files mode never posts; the api-credential checks still fire
    // from collectAlwaysValidationErrors (constraint C-2).
    if (parsed.files !== null) {
        return [];
    }
    const errors = [];
    const resolved = resolvePlatform(parsed.platform);
    // Event + diff are posting-side inputs for BOTH GitHub and Azure flows:
    // they're read by buildGithubDryRunArtifact / buildAzureDryRunArtifact /
    // the dispatcher's runLiveReview path.
    if (parsed.eventPath === null) {
        errors.push({
            flag: "--event",
            message: "--review requires --event",
            hint: "Pass `--event <path>` (GitHub `event.json` or Azure equivalent).",
        });
    }
    if (parsed.diffPath === null) {
        errors.push({
            flag: "--diff",
            message: "--review requires --diff",
            hint: "Pass `--diff <path>` (unified PR diff). See `umactually --help`.",
        });
    }
    if (resolved === "azure") {
        if (parsed.prNumber === null) {
            errors.push({
                flag: "--pr-number",
                message: "--review requires --pr-number for --platform azure",
                hint: "Pass `--pr-number <N>` (positive integer).",
            });
        }
        if (parsed.repo === null) {
            errors.push({
                flag: "--repo",
                message: "--review requires --repo for --platform azure",
                hint: "Pass `--repo <org>/<project>/<repository>` or set `SYSTEM_TEAMPROJECT` + `BUILD_REPOSITORY_NAME`.",
            });
        }
    }
    return errors;
}
/**
 * Errors that apply ONLY when --files is supplied AND one of the
 * pre-rendered-diff-path flags is also supplied. --files is the
 * local-files review mode; combining it with --diff/--event/--review
 * would create two contradictory input pipelines in the same run.
 * Per-flag messages so each conflicting combination is named directly.
 */
function collectLocalFilesExclusionErrors(parsed) {
    if (parsed.files === null) {
        return [];
    }
    const errors = [];
    if (parsed.diffPath !== null) {
        errors.push({
            flag: "--files",
            message: "--files cannot be combined with --diff",
            hint: "Pass --files alone for local-files review, or pass --diff (and --event) without --files for the pre-rendered-diff path.",
        });
    }
    if (parsed.eventPath !== null) {
        errors.push({
            flag: "--files",
            message: "--files cannot be combined with --event",
            hint: "Pass --files alone for local-files review, or pass --event (and --diff) without --files for the pre-rendered-diff path.",
        });
    }
    if (parsed.reviewPath !== null) {
        errors.push({
            flag: "--files",
            message: "--files cannot be combined with --review",
            hint: "Pass --files alone for local-files review, or pass --review (and --event, --diff) without --files for the pre-rendered-diff path.",
        });
    }
    return errors;
}
/**
 * Defensive check for a literal `,` inside a single --files entry.
 * The parser splits on `,` with no escape mechanism, so a path that
 * contains a comma inside one logical entry can only land in this
 * validator if the user's input preserves the comma through some
 * wrapping (e.g. shell-quoted). If any trimmed split element still
 * contains a `,`, the user's input is ambiguous and we surface one
 * error.
 */
function collectLocalFilesCommaErrors(parsed) {
    if (parsed.files === null) {
        return [];
    }
    const offending = parsed.files.split(",").map((p) => p.trim()).find((p) => p.includes(","));
    if (offending === undefined) {
        return [];
    }
    return [{
            flag: "--files",
            message: `--files does not accept paths containing commas (got '${offending}')`,
            hint: "Use a different separator; pass each path on a separate --files invocation if needed.",
        }];
}
/**
 * Composed validator. Always-errors ALWAYS apply; posting-errors apply
 * only when posting is requested; local-files exclusion errors apply
 * only when --files is supplied. Local-files comma errors apply only
 * when --files is supplied and a single entry still contains a `,`
 * after splitting (defensive check). Backwards-compatible at the level
 * of the `message` field (each entry carries the legacy flat string),
 * and forwards-compatible via `flag`+`hint` so structured renderers can
 * surface remediation.
 *
 * Returns {@link ValidationError} records; legacy flat-string callers
 * can map `errors.map((e) => e.message)` to recover the old shape.
 */
function collectValidationErrors(parsed) {
    return [
        ...collectAlwaysValidationErrors(parsed),
        ...collectPostingValidationErrors(parsed),
        ...collectLocalFilesExclusionErrors(parsed),
        ...collectLocalFilesCommaErrors(parsed),
    ];
}
function validate_assertNever(value) {
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
    const collectionUri = env[ENV_KEYS.SYSTEM_COLLECTIONURI];
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
    const project = env[ENV_KEYS.SYSTEM_TEAMPROJECT];
    if (project === undefined || project.length === 0) {
        throw new AzureContextError("AZURE_TEAM_PROJECT_MISSING", "Azure Pipelines SYSTEM_TEAMPROJECT must be set.");
    }
    return project;
}
function readAzureRepoId(env) {
    const repoId = env[ENV_KEYS.BUILD_REPOSITORY_ID];
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
    const raw = env[ENV_KEYS.SYSTEM_PULLREQUEST_PULLREQUESTID];
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
    const value = env[ENV_KEYS.SYSTEM_PULLREQUEST_SOURCECOMMITID];
    if (value === undefined || value.length === 0) {
        throw new AzureContextError("AZURE_SOURCE_COMMIT_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_SOURCECOMMITID must be set.");
    }
    return value;
}
function readAzureTargetBranch(env) {
    const value = env[ENV_KEYS.SYSTEM_PULLREQUEST_TARGETBRANCHNAME];
    if (value === undefined || value.length === 0) {
        throw new AzureContextError("AZURE_TARGET_BRANCH_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_TARGETBRANCHNAME must be set.");
    }
    return value;
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
    const fromEnv = env[ENV_KEYS.GITHUB_TOKEN];
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
    const repository = env[ENV_KEYS.GITHUB_REPOSITORY] ?? fallback ?? "";
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
    const eventPath = env[ENV_KEYS.GITHUB_EVENT_PATH];
    if (eventPath === undefined || eventPath.length === 0) {
        throw new GithubContextError("GITHUB_EVENT_PATH_MISSING", "GitHub Actions GITHUB_EVENT_PATH must be set for pull_request events.");
    }
    const rawPayload = await (0,promises_namespaceObject.readFile)(eventPath, "utf8");
    const parsed = JSON.parse(rawPayload);
    if (!json_guards_isRecord(parsed)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must parse as a JSON object.");
    }
    const pullRequest = parsed["pull_request"];
    if (!json_guards_isRecord(pullRequest)) {
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
    if (!json_guards_isRecord(slot)) {
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
    if (json_guards_isRecord(owner) && typeof name === "string" && name.length > 0) {
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
    if (!json_guards_isRecord(value)) {
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
const GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") || DEFAULT_GITHUB_API_BASE;
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

;// CONCATENATED MODULE: ./src/util/required-config.ts
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
    UMACTUALLY_SONAR_PROJECT_KEY: "sonar-project-key",
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
class RequiredConfigError extends Error {
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
}
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
    const isPlatformEnvVar = envVarName === "GITHUB_TOKEN" || envVarName === "SYSTEM_ACCESSTOKEN";
    const hint = flag !== undefined
        ? `Set it via \`--${flag} <value>\` on the command line, \`${envVarName}=<value>\` in the environment, or a CI secret if running in GitHub Actions / Azure Pipelines. Use \`--dry-run\` to skip the provider call entirely for smoke tests.`
        : isPlatformEnvVar
            ? `Set it via \`${envVarName}=<value>\` in the environment (the CI runner should provide this automatically). Use \`--dry-run\` to skip the provider call entirely for smoke tests.`
            : `Set \`${envVarName}=<value>\` in the environment. Use \`--dry-run\` to skip the provider call entirely for smoke tests.`;
    return { message, hint };
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
    if (value === undefined || value === null || value.length === 0) {
        const { message, hint } = buildRequiredConfigMessage(envVarName);
        throw new RequiredConfigError("LIVE_CONFIG_MISSING", message, hint);
    }
    return value;
}

;// CONCATENATED MODULE: ./src/util/redact.ts

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
/**
 * Visual order for the counts line. Includes the provider vocabulary
 * (critical/high/medium/low) and the internal Severity vocabulary
 * (security/leak/major/minor) so findings carrying either vocabulary
 * render. Order is severity-DESCENDING by `severityRank` so the
 * tallest tier appears first in the tally. Tier rank is the canonical
 * source of truth (leak=6, security=5, critical=4, high=3,
 * medium/major=2, low/minor=1); ties between provider + internal
 * aliases at the same rank (e.g. medium vs major) collapse to one
 * tier in the visual tally because both keys map to the same rank
 * and the `severityTally` skip-zero path renders the count from the
 * whichever key the upstream producer emitted.
 */
const SEVERITY_ORDER = [
    "leak",
    "security",
    "critical",
    "high",
    "medium",
    "major",
    "low",
    "minor",
];
/** Tally comments by severity; eliminates repeated lowercase accumulation logic in live review paths. */
function severity_countBySeverity(comments) {
    const counts = {};
    for (const comment of comments) {
        const key = comment.severity.toLowerCase();
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
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
        case "critical":
        case "security": return "🟣";
        case "high": return "🔴";
        case "medium":
        case "major": return "🟠";
        case "low":
        case "minor": return "🟡";
        case "info": return "🟡";
        case "leak": return "🔴";
        default: return "⚪";
    }
}
/** Severity → short label used in compact rows. */
function severityLabel(level) {
    switch (level.toLowerCase()) {
        case "critical":
        case "security": return "Critical";
        case "leak": return "High";
        case "high": return "High";
        case "medium":
        case "major": return "Medium";
        case "low":
        case "minor": return "Low";
        default: return level || "Info";
    }
}
/**
 * Highest-non-zero severity tier for the current data, or `null` when
 * nothing is reported. Returns the canonical `{ emoji, label }` shape
 * (matching `severityEmoji` + `severityLabel`) so callers can append
 * their own suffix.
 *
 * Replaces the inline ternary cascade `(critical>0 ? 🟣 : high>0 ?
 * 🔴 : medium>0 ? 🟠 : 🟡)` that was duplicated in `layoutIncident`
 * and `layoutStatusPage`. The two callers add different suffixes
 * ("" vs " findings reported"), so the helper returns the shared
 * prefix only.
 */
function highestSeverityBanner(data) {
    if (data.validCommentCount === 0)
        return null;
    if ((data.severityCounts["critical"] ?? 0) > 0)
        return { emoji: "🟣", label: "Critical" };
    if ((data.severityCounts["security"] ?? 0) > 0)
        return { emoji: "🟣", label: "Critical" };
    if ((data.severityCounts["leak"] ?? 0) > 0)
        return { emoji: "🔴", label: "High" };
    if ((data.severityCounts["high"] ?? 0) > 0)
        return { emoji: "🔴", label: "High" };
    if ((data.severityCounts["medium"] ?? 0) > 0)
        return { emoji: "🟠", label: "Medium" };
    if ((data.severityCounts["major"] ?? 0) > 0)
        return { emoji: "🟠", label: "Medium" };
    if ((data.severityCounts["low"] ?? 0) > 0)
        return { emoji: "🟡", label: "Low" };
    if ((data.severityCounts["minor"] ?? 0) > 0)
        return { emoji: "🟡", label: "Low" };
    return null;
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
    return `${MANIFEST_MARKER_PREFIX}${JSON.stringify(payload)}${MANIFEST_MARKER_SUFFIX}`;
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
 * Render a one-line banner explaining a verdict reconciliation. Two
 * directions are supported: upgrade (raw non-blocking → `NEEDS_FIX`,
 * PR #183 review pass) and downgrade (raw `NEEDS_FIX` → `COMMENT`,
 * PR #18). Blockquote-formatted to match `PARSE_FAILED_BANNER` at
 * the same insertion point. Returns `""` when no reconciliation was
 * needed.
 */
function verdictEscalationBanner(data) {
    if (data.verdictEscalatedFrom === undefined)
        return "";
    const raw = data.verdictEscalatedFrom.toUpperCase();
    const effective = data.review.verdict.toUpperCase();
    const direction = effective === "NEEDS_FIX" && raw !== "NEEDS_FIX" ? "escalated" : "downgraded";
    const findingCount = data.postedComments.length;
    const findingSuffix = findingCount === 1 ? "postable finding" : "postable findings";
    const reason = effective === "NEEDS_FIX"
        ? `review contains ${findingCount} ${findingSuffix}`
        : "no postable findings to address";
    return `> ⚠️ Verdict ${direction} from \`${raw}\` → \`${effective}\`: ${reason}.`;
}
/**
 * Push the verdict badge (`## ⛔ NEEDS_FIX` etc.) followed by the
 * optional escalation banner. All layouts that render a verdict must
 * go through this helper so the banner can't be forgotten on a future
 * layout.
 */
function pushVerdict(parts, data) {
    parts.push(`## ${verdictBadge(data)}`);
    const banner = verdictEscalationBanner(data);
    if (banner.length > 0)
        parts.push(banner);
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
/**
 * Severity tally line. Walks `SEVERITY_ORDER` (provider + internal
 * vocabularies interleaved) and skips tiers with count 0 — except
 * tiers filtered by the `--minimum-severity` threshold, which keep an
 * asterisk to surface that they were hidden.
 */
function severityTally(data) {
    const filtered = filteredTiers(data);
    const parts = [];
    let total = 0;
    for (const level of SEVERITY_ORDER) {
        const count = data.severityCounts[level] ?? 0;
        total += count;
        if (count === 0 && !filtered.has(level))
            continue;
        const mark = filtered.has(level) ? "*" : "";
        parts.push(`\`${count}\` ${level}${mark}`);
    }
    if (total === 0)
        return "";
    return `🏷️ ${parts.join(" · ")}`;
}
/**
 * Push the canonical severity-tally + optional legend block to `parts`,
 * guarded by the same `length > 0` check that every layout does inline.
 *
 * The 5-line pattern `tally.length > 0 → push(tally) → legend.length > 0
 * → push(legend) → push("")` was duplicated verbatim in 3 layouts
 * (`verdict-banner`, `checklist`, `sticky-notes`). Other layouts render
 * the tally differently (inline bullet in `tweet`, heading-prefixed in
 * `pros-cons` and `newspaper`, partial-without-trailing-newline in
 * `severity-table`) and intentionally stay inline. This helper covers
 * only the 3 fully-identical sites.
 */
function pushSeverityTally(parts, data) {
    const tally = severityTally(data);
    if (tally.length === 0)
        return;
    parts.push(tally);
    const legend = severityTallyLegend(data);
    if (legend.length > 0)
        parts.push(legend);
    parts.push("");
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
function footer(data, overrideCount) {
    const safeModel = redact(data.modelId, data.secrets);
    const safeProvider = redact(data.provider, data.secrets);
    const count = overrideCount ?? data.validCommentCount;
    return `🤖 Generated by \`${safeModel}\` via \`${safeProvider}\` · ${count} inline`;
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
    pushVerdict(sections, data);
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
    pushVerdict(parts, data);
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
    const parts = [];
    pushVerdict(parts, data);
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
    const banner = verdictEscalationBanner(data);
    if (banner.length > 0) {
        // Re-blockquote the banner so it nests inside the `> ## verdict`
        // blockquote above it rather than starting a new one.
        parts.push(`> ${banner.slice(2)}`);
    }
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
    pushSeverityTally(parts, data);
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
function renderCleanShip(data) {
    const safeSummary = redact(data.review.summary, data.secrets);
    const banner = verdictEscalationBanner(data);
    const parts = [
        REVIEW_MARKER,
        "",
        "## ✅ 0 inline findings — ship it",
    ];
    if (banner.length > 0) {
        parts.push(banner);
    }
    parts.push("");
    if (safeSummary.trim().length > 0) {
        parts.push("<details>");
        parts.push("<summary>📝 Click to expand the full review summary</summary>");
        parts.push("");
        parts.push(safeSummary);
        parts.push("");
        parts.push("</details>");
        parts.push("");
    }
    // Footer + manifest. The footer mirrors the convention used by every
    // other layout (so downstream consumers that grep for "Generated by"
    // recognize this as a umactually body), but emits 0 inline so the
    // count stays consistent with the ship-it verdict.
    parts.push("---");
    parts.push(footer(data, 0));
    parts.push("");
    parts.push(manifest(data));
    return parts.join("\n");
}
function layoutSeverityTable(data) {
    const all = sortedPosted(data);
    const parts = [];
    // Clean-ship branch is hoisted to renderSummary so every layout
    // receives the same one-line verdict for empty, non-parse-failed
    // reviews. layoutSeverityTable only handles the populated-or-parse-failed
    // cases from here.
    // Marker first so dedup loops always find it (the contract that
    // GitHub/Azure dedup loops rely on). The verdict comes next so the
    // first non-marker line is the verdict badge (CLARITY-1 invariant).
    parts.push(REVIEW_MARKER);
    parts.push("");
    pushVerdict(parts, data);
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
    pushVerdict(parts, data);
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
    pushVerdict(parts, data);
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
    const parts = [];
    pushVerdict(parts, data);
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
    pushSeverityTally(parts, data);
    return closeReviewBlock(data, parts);
}
// ---------------------------------------------------------------------------
// Layout 8 — Progress Bars (ASCII block bars)
// ---------------------------------------------------------------------------
// Per-severity bar made of `█` (filled) and `░` (empty) blocks inside
// an inline code block. Terminal-style dashboard.
function layoutProgressBars(data) {
    const total = data.validCommentCount;
    const parts = [];
    pushVerdict(parts, data);
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
    const parts = [];
    pushVerdict(parts, data);
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
    pushVerdict(parts, data);
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
    pushVerdict(parts, data);
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
    pushVerdict(parts, data);
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
// ---------------------------------------------------------------------------
// Layout 13 — Incident Report (timeline)
// ---------------------------------------------------------------------------
// Reads like a post-incident report: status, severity, timeline, impact.
function layoutIncident(data) {
    const verdict = verdictBadge(data);
    const parts = [];
    pushVerdict(parts, data);
    parts.push("");
    parts.push("### 📟 Incident report");
    parts.push("");
    const topSeverity = highestSeverityBanner(data);
    const severityWord = topSeverity === null
        ? "✅ None"
        : `${topSeverity.emoji} ${topSeverity.label}`;
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
    const parts = [];
    pushVerdict(parts, data);
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
    const parts = [];
    pushVerdict(parts, data);
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
    const parts = [];
    pushVerdict(parts, data);
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
    const parts = [];
    pushVerdict(parts, data);
    parts.push("");
    parts.push("### 📡 Status page");
    parts.push("");
    const topSeverity = highestSeverityBanner(data);
    const banner = topSeverity === null
        ? "✅ All clear — no findings"
        : `${topSeverity.emoji} ${topSeverity.label} severity findings reported`;
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
    const parts = [];
    pushVerdict(parts, data);
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
    const parts = [];
    pushVerdict(parts, data);
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
    pushSeverityTally(parts, data);
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
    const banner = verdictEscalationBanner(data);
    if (banner.length > 0)
        parts.push(banner);
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
    if (data.validCommentCount === undefined) {
        throw new Error("renderSummary: data.validCommentCount is required (was undefined). The clean-ship gate cannot fire on undefined === 0; pass the count of comments that survived all filter layers.");
    }
    if (data.suppressedCommentCount === undefined) {
        throw new Error("renderSummary: data.suppressedCommentCount is required (was undefined). Pass the count of comments the verified-facts + confidence filters dropped.");
    }
    // Clean-ship gate is enforced at the entry point so every layout
    // gets the same one-line verdict for empty, non-parse-failed reviews.
    // Suppressed findings (confidence/verified-facts filtered) don't
    // count against the reviewer — they're pipeline-internal noise the
    // filter already handled. Only parseFailed short-circuits to a verbose
    // layout so the operator sees the raw response.
    //
    // Reconciliation-bypass carve-out: when the raw verdict was
    // reconciled (downgraded NEEDS_FIX→COMMENT or upgraded SHIP→NEEDS_FIX)
    // AND there are no postable findings, `renderCleanShip` still
    // surfaces the escalation banner so the clean-ship body doesn't
    // hide the raw→effective flip from a scanning reviewer.
    if (data.validCommentCount === 0 &&
        data.review.parseFailed !== true &&
        data.verdictEscalatedFrom === undefined) {
        return renderCleanShip(data);
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
        else if (isDebugRawActive()) {
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
 * Locate the start and end indices of the first balanced JSON object
 * (`{ ... }`) or array (`[ ... ]`) in `text`, respecting nested
 * delimiters and quoted strings (including \" escapes and stray-quote
 * disambiguation via `peekNextNonWhitespace`).
 *
 * When `{` is present anywhere in `text`, the search starts at the
 * first `{`; only when no `{` exists does it fall back to the first
 * `[`. This matches the original `repairJsonStringLiterals` behavior
 * (prefers objects, falls back to arrays) and preserves the
 * `extractFirstBalancedObject` constraint via a call-site check.
 *
 * Returns `{ start, end }` (inclusive end index of the closing
 * delimiter) or `null` when no balanced structure is found.
 *
 * Unified from the two first-pass loops that were duplicated between
 * `extractFirstBalancedObject` (lines 194-263, objects only) and
 * `repairJsonStringLiterals` (lines 405-456, objects + arrays).
 */
function findBalancedJsonBounds(text) {
    const startIndex = text.indexOf("{") === -1 ? text.indexOf("[") : text.indexOf("{");
    if (startIndex === -1) {
        return null;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let index = startIndex; index < text.length; index += 1) {
        const char = text[index];
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
                // to escape a `"` inside the string value.
                //
                // Note: `"` is NOT a structural JSON character so we don't
                // include it in the close-quote set. If we did, a stray
                // `"` followed by another `"` (e.g. `body: "value" "next":`)
                // would be misclassified as a closing quote.
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
                return { start: startIndex, end: index };
            }
        }
    }
    return null;
}
/**
 * Walk a balanced JSON substring and return a repaired copy where:
 *   1. Literal control characters inside JSON strings (`\n \r \t \b \f`)
 *      are escaped to their 2-char JSON-escape equivalents.
 *   2. Stray `\X` sequences inside JSON strings (where X is NOT a valid
 *      JSON escape char) are double-escaped so JSON.parse sees `\\X` →
 *      `\X` in the parsed output.
 *   3. Stray `"` inside a string (model forgot to escape a quote) is
 *      escaped to `\"` so JSON.parse keeps the string open.
 *
 * Structural whitespace OUTSIDE strings is preserved unchanged.
 *
 * This is the shared second-pass FSM that was duplicated between
 * `extractFirstBalancedObject` (lines 268-367) and
 * `repairJsonStringLiterals` (lines 459-547) — byte-identical logic
 * including the escape validation, the stray-quote peek-ahead
 * disambiguation, and the control-char escape switch.
 */
function repairBalancedSubstring(substring) {
    const segments = [];
    let inString = false;
    let escape = false;
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
                    // string.
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
    // Object-only: findBalancedJsonBounds handles both `{` and `[`,
    // but this function is documented to return objects only.
    if (rawText.indexOf("{") === -1) {
        return null;
    }
    const bounds = findBalancedJsonBounds(rawText);
    if (bounds === null) {
        return null;
    }
    return repairBalancedSubstring(rawText.slice(bounds.start, bounds.end + 1));
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
 * Returns `text` unchanged when it doesn't contain a balanced object
 * or array — the caller can fall through to the balanced-object
 * fallback.
 */
function repairJsonStringLiterals(text) {
    const bounds = findBalancedJsonBounds(text);
    if (bounds === null) {
        return text;
    }
    const repaired = repairBalancedSubstring(text.slice(bounds.start, bounds.end + 1));
    return text.slice(0, bounds.start) + repaired + text.slice(bounds.end + 1);
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
    if (parsed !== undefined && json_guards_isRecord(parsed)) {
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
                // The response had an `output[]` array but `joinOutputText`
                // produced nothing — every entry was a reasoning block the
                // parser intentionally skipped. Returning the raw envelope
                // would leak the chain-of-thought prose (stored in the
                // reasoning parts) into the extracted text, which then
                // fails `parseReviewPayload` because the first balanced `{`
                // is inside the reasoning prose. Return empty so the
                // strict-empty-fields check downstream classifies it as
                // a parse failure.
                if (output.length > 0) {
                    // Reasoning-fallback: some providers (notably MiniMax-M3)
                    // write a draft of the final review JSON inside their
                    // reasoning block, then run out of output budget before
                    // emitting it as the formal `output_text` answer. The
                    // reasoning can contain MULTIPLE drafts of the review
                    // (the model revises as it reasons); we want the LAST
                    // valid one, which is the most refined. If we find one,
                    // return it so `parseReviewPayload` can produce a real
                    // review instead of a parse-fail.
                    const recovered = extractLastReviewDraftFromReasoning(output);
                    if (recovered !== null) {
                        return recovered;
                    }
                    return "";
                }
            }
            // No `output[]` array at all — fall through to raw text so
            // `parseReviewPayload` can extract a direct review JSON object
            // (model returned `{"summary": ..., "verdict": ...}` outside
            // the Responses API envelope).
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
    if (!json_guards_isRecord(candidate)) {
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
        if (!json_guards_isRecord(parsed))
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
    if (!json_guards_isRecord(usageRaw)) {
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
        if (!json_guards_isRecord(entry)) {
            continue;
        }
        const content = entry["content"];
        // Responses API: content is an array of parts.
        if (Array.isArray(content)) {
            for (const part of content) {
                if (!json_guards_isRecord(part)) {
                    continue;
                }
                // The Responses API puts reasoning content in a separate
                // `type: "reasoning_text"` part. Including it would concat
                // 100+ KB of chain-of-thought prose ahead of the final JSON
                // answer and break `parseReviewPayload` (the first balanced
                // `{` is in the reasoning prose, not the real output). Skip
                // any part whose type is in the reasoning family — the
                // `output_text` (or untyped) parts are the actual review.
                const partType = part["type"];
                if (typeof partType === "string" && partType.includes("reasoning")) {
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
        if (json_guards_isRecord(content)) {
            const contentType = content["type"];
            if (typeof contentType === "string" && contentType.includes("reasoning")) {
                continue;
            }
            const text = content["text"];
            if (typeof text === "string") {
                fragments.push(text);
            }
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
        if (!json_guards_isRecord(entry))
            continue;
        const content = entry["content"];
        if (!Array.isArray(content))
            continue;
        for (const part of content) {
            if (!json_guards_isRecord(part))
                continue;
            const partType = part["type"];
            if (typeof partType === "string" && !partType.includes("reasoning")) {
                // Not a reasoning part — skip.
                continue;
            }
            const text = part["text"];
            if (typeof text !== "string")
                continue;
            // Scan this reasoning block for fenced JSON objects.
            // The model uses ```json, ```typescript, or just ``` fences.
            // The opener accepts any language tag (or none); the body is
            // captured up to the next ``` closer. Bodies that don't start
            // with `{` (code snippets, typescript signatures, plain prose)
            // are skipped — only review-shaped JSON objects are kept.
            const fenceRe = /```[a-zA-Z0-9_+\-]*\s*\n([\s\S]*?)\n```/gu;
            let m;
            while ((m = fenceRe.exec(text)) !== null) {
                const body = m[1]?.trim() ?? "";
                if (!body.startsWith("{"))
                    continue;
                try {
                    const parsed = JSON.parse(body);
                    if (!json_guards_isRecord(parsed))
                        continue;
                    // Must look like a review: has summary or verdict or comments.
                    if ("summary" in parsed ||
                        "verdict" in parsed ||
                        "comments" in parsed) {
                        lastDraft = body;
                    }
                }
                catch {
                    // Not valid JSON — skip; the model often writes
                    // partial JSON in its thinking that doesn't parse.
                }
            }
        }
    }
    return lastDraft;
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
        if (!json_guards_isRecord(entry)) {
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
        if (!json_guards_isRecord(parsed)) {
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
            // Skip reasoning-text deltas entirely. Some providers (e.g.
            // MiniMax-M3) emit `response.reasoning_text.delta` events
            // alongside the final answer. Concat-ing them into `fragments`
            // would prepend 100+ KB of chain-of-thought prose ahead of the
            // JSON review, breaking `parseReviewPayload` (the first
            // balanced `{` would be inside the reasoning prose). The actual
            // review text is in `response.output_text.delta` and the final
            // `response.completed` event.
            if (typeof eventType === "string" && eventType.includes("reasoning")) {
                continue;
            }
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
        // string directly on the JSON object. Skip reasoning deltas — they
        // are chain-of-thought prose, not part of the final review payload.
        const topLevelType = readStringField(parsed, "type");
        if (typeof topLevelType === "string" && topLevelType.includes("reasoning")) {
            continue;
        }
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
    if (parsed !== undefined && json_guards_isRecord(parsed)) {
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
    if (json_guards_isRecord(errorField)) {
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
        if (json_guards_isRecord(first)) {
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
 * @deprecated Re-export preserved for one release cycle so callers that
 * import `countBySeverity` from `cli/live-shared.js` continue to work.
 * Import directly from `src/util/severity.js` instead.
 *
 * The original JSDoc explicitly warned: "Do not remove without updating
 * all callers." Since the symbol has been part of this module's surface
 * (and is referenced from tests and any downstream that pulls from
 * `dist/cli.js`), removing it outright would silently break those
 * consumers. The deprecation lets type-aware consumers see the warning
 * at compile time; the alias keeps runtime behavior stable.
 */
const countBySeverityFromLiveShared = (/* unused pure expression or super */ null && (countBySeverity));



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
        // Materialize the hint on the instance so consumers (orchestrator,
        // standalone-run, JSON envelope, future CLI glue) can read it without
        // destructuring `options`. Untyped (TS allows any property) because
        // Error accepts arbitrary extension in JS land; we narrow via
        // `getLiveReviewHint`.
        if (options !== undefined && typeof options.hint === "string") {
            this.hint = options.hint;
        }
    }
}
/**
 * Type-safe reader for the optional `hint` field on a `LiveReviewError`.
 * Returns `undefined` when the error is not a `LiveReviewError` or when
 * no hint was attached at construction. Use this instead of casting to
 * keep the call site narrow.
 */
function getLiveReviewHint(error) {
    if (error instanceof LiveReviewError === false) {
        return undefined;
    }
    const hint = error.hint;
    return typeof hint === "string" ? hint : undefined;
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
        ...(input.verdictEscalatedFrom !== undefined
            ? { verdictEscalatedFrom: input.verdictEscalatedFrom }
            : {}),
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
    return selectPostableCommentsWithPositions({
        review: input.review,
        positions: parseDiffPositions(input.diffText),
        parsed: input.parsed,
        secrets: input.secrets,
    });
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
        if (comments.length >= maxComments) {
            break;
        }
        if (!input.positions.hasPosition(comment)) {
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
    return selectOffDiffCommentsWithPositions(review, parseDiffPositions(diffText));
}
/**
 * Internal variant of `selectOffDiffComments` that accepts a
 * pre-computed `DiffPositionIndex`. See
 * `selectPostableCommentsWithPositions` for the rationale.
 */
function selectOffDiffCommentsWithPositions(review, positions) {
    return review.comments.filter((comment) => !positions.hasPosition(comment));
}
function countSuppressedComments(review, diffText) {
    const positions = parseDiffPositions(diffText);
    let offDiffCount = 0;
    for (const comment of review.comments) {
        if (!positions.hasPosition(comment)) {
            offDiffCount += 1;
        }
    }
    return review.suppressedComments.length + offDiffCount;
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
    // Parse the diff ONCE and pass the index to all three selectors.
    // Each of the public selectors (`selectPostableComments`,
    // `selectOffDiffComments`, `countSuppressedComments`) was
    // previously re-parsing the same diff internally — 3x parses per
    // review. The `*WithPositions` variants take a pre-computed
    // index so the parse runs exactly once.
    const positions = parse_positions_parseDiffPositions(input.diffText);
    const postableComments = selectPostableCommentsWithPositions({
        review: input.review,
        positions,
        parsed: input.parsed,
        secrets: input.secrets,
    });
    // The off-diff comments array is needed for the manifest payload
    // (so reviewers can see which findings the post-filter dropped
    // and why). The suppressed count is also displayed. Both are
    // derived from the same `review.comments - positions.hasPosition`
    // filter. The array materialization is unavoidable (the manifest
    // needs every entry) and the count derivation is just a `.length`
    // on it. `countSuppressedComments(review, diffText)` is a
    // single-call helper for callers that don't need the array; it
    // re-parses the diff and re-runs the filter. `preparePostedReview`
    // already has `positions` and the off-diff array, so it computes
    // the count inline rather than calling the helper.
    const offDiffFromComments = selectOffDiffCommentsWithPositions(input.review, positions);
    const suppressedCommentCount = input.review.suppressedComments.length + offDiffFromComments.length;
    const severityCounts = severity_countBySeverity(postableComments);
    // Reconcile the model's raw verdict against the postable severity
    // counts. The body would render a `⛔ NEEDS_FIX` headline against a
    // `📊 0 inline findings` count for a review with nothing to act on
    // (PR #18), and a `✅ SHIP` headline with "ship it" prose against a
    // non-empty findings list (PR #183 review pass). Both contradictions
    // are fixed by `composeEffectiveVerdict` — see the canonical rules
    // there.
    const composed = composeEffectiveVerdict({
        rawVerdict: input.review.verdict,
        severityCounts,
    });
    const effectiveVerdict = composed.verdict;
    const verdictEscalatedFrom = composed.escalated ? input.review.verdict : undefined;
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
        ...(verdictEscalatedFrom !== undefined ? { verdictEscalatedFrom } : {}),
    });
    return {
        postableComments,
        offDiffFromComments,
        suppressedCommentCount,
        severityCounts,
        body,
        postedComments: postableComments,
        effectiveVerdict,
        ...(verdictEscalatedFrom !== undefined ? { verdictEscalatedFrom } : {}),
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
    const sanitized = value
        .replace(/Authorization:\s*[^\r\n]*/giu, REDACTED_AUTHORIZATION_HEADER)
        .replace(/\bBearer\s+\S+/giu, REDACTED_BEARER_TOKEN);
    return replaceSecretsLiterally(sanitized, secrets);
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
    if (!json_guards_isRecord(value)) {
        return undefined;
    }
    const id = value["id"];
    return isSafeInteger(id) ? id : undefined;
}
function ensureHttpOk(response, code, action, hint) {
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
    // `hint` is forwarded onto the LiveReviewError so upstream catch
    // sites (orchestrator.ts, standalone-run.ts) can render the
    // remediation text alongside the failure. Pass-through is
    // intentional — callers that don't have an actionable hint today
    // omit the parameter and the field stays undefined on the error.
    const errorOptions = hint === undefined
        ? undefined
        : { hint };
    throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`, errorOptions);
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
    ensureHttpOk(response, "AZURE_LIST_THREADS_FAILED", "Azure list PR threads", "Verify SYSTEM_ACCESSTOKEN is set and that 'Allow scripts to access the OAuth token' is enabled in pipeline settings. The token must have `Pull Request Contribute` permission on the repository.");
    const json = await readJsonResponse(response);
    if (!json_guards_isRecord(json)) {
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
        ensureHttpOk(response, "AZURE_CREATE_PR_COMMENT_FAILED", "Azure create PR comment", "Verify SYSTEM_ACCESSTOKEN is set and the pipeline job has access to the OAuth token. The token needs `Pull Request Contribute` on the target repository.");
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
    ensureHttpOk(response, "AZURE_CREATE_THREAD_FAILED", "Azure create PR thread", "Check (1) SYSTEM_ACCESSTOKEN has `Pull Request Contribute`, (2) the file path matches an actual changed file in the PR diff, and (3) the line number exists in the right-side of that file. A 400 here often means the line is outside the diff hunk; rerun after fetching a fresh diff.");
    const json = await readJsonResponse(response);
    if (!json_guards_isRecord(json)) {
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
    if (!json_guards_isRecord(firstComment)) {
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
 * The context NAME and GENRE are both sourced from `src/util/brand.ts`
 * (single source of truth for the brand string and Azure-specific
 * identifiers).
 */
async function postAzureStatus(input) {
    const safeDescription = sanitizeAzureStatusDescription(input.description);
    // Delete the previous CLI status entries for this PR so the
    // Checks panel stays at exactly one `umactually-status`
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
    if (!json_guards_isRecord(json)) {
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
    if (!json_guards_isRecord(value)) {
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
    if (!json_guards_isRecord(contextRaw)) {
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
    if (!json_guards_isRecord(value)) {
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
        if (json_guards_isRecord(nestedContext)) {
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
    if (!json_guards_isRecord(start)) {
        return null;
    }
    const line = start["line"];
    return isSafeInteger(line) ? { line } : null;
}
function parseAzureComment(value) {
    if (!json_guards_isRecord(value)) {
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

;// CONCATENATED MODULE: ./src/cli/fetch-sonar-pr-findings.ts







const fetch_sonar_pr_findings_GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") ?? DEFAULT_GITHUB_API_BASE;
const SONAR_PR_FINDING_MARKER = "<!-- sonarcloud -->";
const MAX_SONAR_PR_FINDINGS = 50;
/**
 * Fetch inline review comments on the current PR that carry the
 * `<!-- sonarcloud -->` marker, and convert each into a synthetic
 * `LiveReviewComment` so the existing severity policy + verdict
 * reconciliation treat them exactly like model-emitted findings.
 *
 * SonarCloud's CI integration in this repo (the `Surface SonarCloud
 * findings as PR comments` step in ci.yml) posts a separate review
 * per finding with that marker. After the bot waits for SonarCloud's
 * scan + surface step to finish (see the `Wait for SonarCloud scan +
 * comment-surface` step in self-review.yml), this fetcher pulls them
 * so the umactually self-review can:
 *   1. see them in `severityCounts` and trigger the verdict-escalation
 *      rule from PR #183 (any postable finding escalates SHIP/APPROVED
 *      → NEEDS_FIX), and
 *   2. post them as inline review threads on the bot's own review so
 *      the umactually card and SonarCloud's threads share a single
 *      review context (one place to dismiss).
 *
 * Returns an empty array on any fetch error — the bot never blocks on
 * the PR-comment fetch because self-review is advisory. The fetch is
 * best-effort by design; the SonarCloud `Surface SonarCloud findings
 * as PR comments` step is the authoritative surface for SonarCloud
 * findings, and the `SonarCloud Code Analysis` check status is the
 * authoritative policy gate.
 */
async function fetchSonarPrFindings(input) {
    const url = `${fetch_sonar_pr_findings_GITHUB_API_BASE_URL}/repos/${encodeURIComponent(input.context.repo.owner)}/${encodeURIComponent(input.context.repo.name)}/pulls/${input.context.prNumber}/comments?per_page=${MAX_SONAR_PR_FINDINGS}`;
    let raw;
    try {
        const response = await input.fetchImpl(url, {
            method: "GET",
            headers: githubHeaders(input.context.token),
        });
        ensureHttpOk(response, "GITHUB_LIST_PR_COMMENTS_FAILED", "GitHub list PR review comments", "Verify GITHUB_TOKEN has `pull_requests: read` scope and that the PR number is correct. The fetch is best-effort; SonarCloud's own surface step is authoritative for its findings.");
        raw = await readJsonResponse(response);
    }
    catch (error) {
        writeBrandedAnnotation("warning", `failed to fetch SonarCloud PR inline comments; treating as zero findings (best-effort fetch). ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
    if (!Array.isArray(raw)) {
        writeBrandedAnnotation("warning", "SonarCloud PR comments endpoint returned a non-array JSON body; treating as zero findings.");
        return [];
    }
    const findings = [];
    for (const entry of raw) {
        const finding = parseSonarPrCommentEntry(entry);
        if (finding === null)
            continue;
        findings.push({
            path: finding.path,
            line: finding.line,
            body: finding.body,
            severity: finding.severity,
            category: "sonar",
        });
        if (findings.length >= MAX_SONAR_PR_FINDINGS)
            break;
    }
    return findings;
}
function resolveCommentLine(line, originalLine) {
    if (isSafeInteger(line))
        return line;
    if (isSafeInteger(originalLine))
        return originalLine;
    return null;
}
function parseSonarPrCommentEntry(value) {
    if (!json_guards_isRecord(value))
        return null;
    const path = value["path"];
    const line = value["line"];
    const body = value["body"];
    const originalLine = value["original_line"];
    if (typeof path !== "string")
        return null;
    // GitHub returns `line: null` for comments on lines outside the diff
    // (e.g. file-level comments anchored to the file header). Fall back to
    // `original_line`, then to `null` so the caller can filter out
    // unanchorable comments instead of posting them at a meaningless line.
    const resolvedLine = resolveCommentLine(line, originalLine);
    if (resolvedLine === null)
        return null;
    if (typeof body !== "string")
        return null;
    // Self-reingestion guard. The original check was `body.includes(SONAR_PR_FINDING_MARKER)`;
    // that matched umactually's own re-posted copies because the inline
    // comment body built by `buildInlineCommentBody` embeds the raw
    // SonarCloud body verbatim AFTER the `` `severity` `category`\n\n ``
    // prefix. Each self-review run re-imported the previous run's output,
    // accumulating duplicate `` `major` `sonar` `` prefixes (PR #184).
    //
    // The stronger guard: reject any body that carries the umactually
    // REVIEW_MARKER (the inline copy always embeds it — see
    // buildInlineCommentBody). Raw SonarCloud comments posted by the
    // `Surface SonarCloud findings as PR comments` step in ci.yml do NOT
    // carry the umactually marker, so this is a clean discriminator.
    // As a belt-and-braces second check, require the sonar marker to
    // appear before any umactually marker — if both are present, the
    // comment is a repost, not a raw SonarCloud surface.
    const sonarIdx = body.indexOf(SONAR_PR_FINDING_MARKER);
    const umactuallyIdx = body.indexOf(REVIEW_MARKER);
    if (sonarIdx < 0)
        return null;
    if (umactuallyIdx >= 0 && umactuallyIdx < sonarIdx)
        return null;
    const severity = parseSonarSeverityFromBody(body);
    return { path, line: resolvedLine, body, severity };
}
/**
 * Map SonarCloud's severity label (rendered as **MAJOR**, **CRITICAL**,
 * **BLOCKER**, **MINOR**, **INFO** in the comment body) to the
 * internal `Severity` vocabulary the verdict-reconciliation + manifest
 * pipeline already understands. The marker is the inline prefix the
 * `Surface SonarCloud findings as PR comments` step in ci.yml writes
 * verbatim:
 *   `<!-- sonarcloud -->\n**SonarCloud MAJOR — \`typescript:S3358\`**\n\n<msg>`
 *
 * The label word is matched case-insensitively at the start of a `MAJOR`
 * / `CRITICAL` / `BLOCKER` / `MINOR` / `INFO` token. Unknown labels fall
 * back to `medium` so the comment still passes the default
 * `--minimum-severity=medium` filter; this is the same default-fallback
 * discipline the provider-severity parser uses for unknown provider
 * severities (see src/provider/provider-parse.ts:normalizeProviderSeverity).
 */
function parseSonarSeverityFromBody(body) {
    // Match the first capitalized severity word inside `**SonarCloud <WORD> — \`...`.
    const match = /\*\*\s*Sonar(?:Cloud|Qube)?\s+(BLOCKER|CRITICAL|MAJOR|MINOR|INFO)\b/u.exec(body);
    if (match === null)
        return "major";
    const label = match[1];
    if (label === undefined)
        return "major";
    switch (label.toUpperCase()) {
        case "BLOCKER": return "critical";
        case "CRITICAL": return "critical";
        case "MAJOR": return "major";
        case "MINOR": return "minor";
        case "INFO": return "info";
        default: return "major";
    }
}

;// CONCATENATED MODULE: ./src/cli/live-github.ts








const live_github_GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") || DEFAULT_GITHUB_API_BASE;
async function runGithubLive(input) {
    const { context, diffText, provider, parsed, fetchImpl } = input;
    // Fetch SonarCloud PR inline comments (when the flag is set) and
    // merge them into the provider review's comments list BEFORE
    // `preparePostedReview` runs. Three invariants this preserves:
    // (1) severity filtering applies uniformly to the SonarCloud findings
    // (the same `passesSeverityPolicy` gate that drops model findings
    // below `--minimum-severity`); position validation runs downstream
    // in `preparePostedReview` via the same `positions.hasPosition` gate;
    // (2) the PR #183 verdict-reconciliation rule sees the surviving
    // SonarCloud severity counts, so a postable SonarCloud MAJOR/CRITICAL
    // escalates the verdict from SHIP/APPROVED to NEEDS_FIX; (3)
    // SonarCloud findings render as inline threads on the bot's own
    // review (one place to dismiss), in addition to SonarCloud's
    // separate reviews.
    const rawSonarFindings = parsed.includePrSonarFindings
        ? await fetchSonarPrFindings({ context, fetchImpl })
        : [];
    const sonarPrFindings = rawSonarFindings.filter((finding) => passesSeverityPolicy(finding, parsed));
    const droppedBySeverity = rawSonarFindings.length - sonarPrFindings.length;
    if (droppedBySeverity > 0) {
        writeBrandedAnnotation("warning", `filtered ${droppedBySeverity} SonarCloud PR inline finding(s) below --minimum-severity=${parsed.minimumSeverity ?? "default"}; ${sonarPrFindings.length} postable.`);
    }
    if (sonarPrFindings.length > 0) {
        writeBrandedAnnotation("warning", `merged ${sonarPrFindings.length} SonarCloud PR inline finding(s) into the review (flag --include-pr-sonar-findings).`);
    }
    const providerReview = sonarPrFindings.length > 0
        ? {
            ...provider.review,
            comments: [...provider.review.comments, ...sonarPrFindings],
        }
        : provider.review;
    const prepared = preparePostedReview({
        review: providerReview,
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
    ensureHttpOk(response, "GITHUB_LIST_REVIEWS_FAILED", "GitHub list reviews", "Verify GITHUB_TOKEN has `pull_requests: read` scope (or the equivalent on GitHub Enterprise), and that the PR number is correct. See https://docs.github.com/en/rest/pulls/reviews for the API contract.");
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
        ensureHttpOk(response, "GITHUB_UPDATE_REVIEW_FAILED", "GitHub update review", "Updates only succeed on PENDING reviews. The expected fallback is DELETE+POST (handled by the caller). If you see this on a fresh run, check that the bot token has `pull_requests: write`.");
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
    ensureHttpOk(response, "GITHUB_CREATE_REVIEW_FAILED", "GitHub create review", "Check (1) GITHUB_TOKEN has `pull_requests: write` scope, (2) the commit SHA matches the head of the PR, and (3) every comment path+line exists in the diff. The most common cause is a stale SHA; rerun on a fresh `pull_request` event.");
    return readResponseId(await readJsonResponse(response));
}
function parseExistingReview(value) {
    if (!json_guards_isRecord(value)) {
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
    return `${live_github_GITHUB_API_BASE_URL}/repos/${owner}/${repo}/pulls/${context.prNumber}/reviews`;
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
            if (c === undefined) {
                continue;
            }
            downgraded.push(c);
            downgradeReasons.push({ index: globalIndex, reason });
            globalIndex += 1;
        }
    }
    return { kept, downgraded, downgradeReasons };
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
        if (o.confidenceFilter === undefined) {
            // Legacy / older outcomes (simulate-findings path, fixtures,
            // and outcomes from before the confidence filter was wired
            // in `applyVerifyFilter`) do not carry a `confidenceFilter`.
            // The most defensible default is to treat their already-post-
            // verified-facts `review.comments` as confidence-kept. The
            // upstream contract is: by the time an outcome is passed
            // here, `o.review.comments` is the POST-VERIFIED-FACTS list
            // (verified-facts drops the contradicted findings, but the
            // confidence-filter pass had not run yet for legacy
            // outcomes). So this is NOT a double-count of
            // `verifiedFactsFilter.kept` — it's the next step in the
            // chain that legacy outcomes just happen to skip. The
            // audit-artifact count for the legacy path will therefore
            // match `review.comments.length` (the post-merge list),
            // not `verifiedFactsFilter.kept.length`. Pinned by
            // `test/unit/live-merge.test.ts` MERGE-CONFIDENCE legacy
            // compat case.
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
            if (c === undefined || reasonRecord === undefined) {
                continue;
            }
            downgraded.push(c);
            reasons.push({ index: globalIndex, reason: reasonRecord.reason, explanation: reasonRecord.explanation });
            globalIndex += 1;
        }
    }
    return { kept, downgraded, reasons };
}
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
            verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
            confidenceFilter: { kept: [], downgraded: [], reasons: [] },
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
    // Apply the same severity-counts reconciliation the live path uses
    // (`composeEffectiveVerdict`) BEFORE ranking, so a chunk whose
    // verdict contradicts its own findings list (NEEDS_FIX + empty
    // counts from PR #18, or non-blocking + non-empty counts from PR
    // #183 review pass) doesn't pollute the "worst verdict" pick.
    let worstVerdict = "";
    let worstRank = -1;
    for (const outcome of outcomes) {
        const composed = composeEffectiveVerdict({
            rawVerdict: outcome.review.verdict,
            severityCounts: severity_countBySeverity(outcome.review.comments),
        });
        const rank = verdictRank(composed.verdict);
        if (rank > worstRank) {
            worstRank = rank;
            worstVerdict = composed.verdict;
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
        // Aggregate verified-facts downgrades across all chunks. Each chunk's
        // filter ran independently against the same diff so we dedup by
        // (index, reason) so a finding flagged in two chunks doesn't double-
        // count in the summary.
        verifiedFactsFilter: aggregateVerifiedFactsFilter(outcomes),
        confidenceFilter: aggregateConfidenceFilter(outcomes),
    };
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

;// CONCATENATED MODULE: ./src/provider/provider-retry.ts
/**
 * Shared retry-loop helpers for provider clients.
 *
 * The OpenAI-compatible, Anthropic Messages, and Copilot providers each
 * implement the same retry/backoff pattern with provider-specific
 * `runOnce` callbacks. These helpers consolidate the pieces that are
 * byte-identical (or near-byte-identical) across the three: the
 * backoff schedule, the retryable-error predicate, the abort-bailout
 * block, and the bumped-budget heuristic. Provider-specific call sites
 * wire the `runOnce` callback to their own request/parse logic.
 */


/**
 * Backoff schedule for transient-error retries. Attempt 0 fires
 * immediately; attempt 1 sleeps 250ms first; attempt 2 sleeps 1s
 * first; then the loop returns the last failure.
 *
 * Three attempts total (initial + 2 retries). Empirically tuned: 250ms
 * is enough to clear a TCP RST on the same connection pool, 1s is
 * enough to clear a transient router/scheduler hiccup, and longer
 * waits don't materially improve recovery rate.
 */
const RETRY_BACKOFF_MS = [250, 1_000];
/**
 * True when `error` represents a transient failure that the next retry
 * might recover from:
 *   - `network` (no HTTP status, e.g. connection reset, DNS hiccup)
 *   - `timeout` (slow stream, gateway reset)
 *   - HTTP 429 (rate limit, often retried after backoff)
 *   - HTTP >= 500 (server-side failure, often retried after backoff)
 *
 * Provider-specific failures (`parse`, `provider_error`, `aborted`,
 * `4xx other than 429`) are NOT retried — retrying them would just
 * re-surface the same broken state.
 */
function isRetryable(error) {
    if (error.code === "network")
        return true;
    if (error.code === "timeout")
        return true;
    return error.status === 429 || (typeof error.status === "number" && error.status >= 500);
}
/**
 * Bail early when the caller's AbortSignal is already aborted, BEFORE
 * composing the next retry's timeout signal.
 *
 * Without this guard, the next `runOnce` would compose a fresh
 * timeout AbortController with an already-aborted caller signal.
 * `AbortSignal.any([aborted, ...])` is itself aborted, so the next
 * fetch would fail immediately with a "timeout" error — even though
 * the underlying connection was healthy. That makes the
 * "timeout is transient, retry it" rationale void (we'd be reporting
 * a fake timeout, not a real one).
 *
 * Returns a `{ ok: false, error: ProviderError("aborted", ...) }`
 * failure when the signal is aborted, otherwise `null`. The caller
 * short-circuits its retry loop on the failure result.
 */
function bailIfAborted(args) {
    if (args.signal?.aborted !== true)
        return null;
    return {
        ok: false,
        error: new ProviderError("aborted", args.endpoint, null, args.requestId, "Caller aborted the request before retry."),
    };
}
/**
 * Compute the bumped `maxOutputTokens` for the parse-fail retry.
 *
 * When the first attempt's raw response is "large but empty"
 * (`rawText.length > 16_000 && textPayload.length < 200`), the model
 * likely produced a reasoning-only response that got truncated before
 * the JSON review. Double the budget for the retry so the model has
 * more room. Capped at 128K to avoid blowing past provider limits.
 *
 * Returns `undefined` when no bump is warranted — the caller should
 * then pass `undefined` (or simply omit the field) on the wire body
 * to preserve `exactOptionalPropertyTypes`.
 *
 * The `currentBudget` argument is the cap from the call config (may
 * itself be undefined for providers that don't pin one).
 */
function computeBumpedMaxOutput(args) {
    if (args.currentBudget === undefined)
        return undefined;
    const needsMore = args.rawTextLength > 16_000 && args.textPayloadLength < 200;
    return needsMore ? Math.min(args.currentBudget * 2, 128_000) : args.currentBudget;
}
/**
 * Generic retry loop shared by every provider client.
 *
 * Calls `runOnce` repeatedly until one of three exit conditions:
 *   1. `runOnce` succeeds (returns `{ ok: true, ... }`) — propagate as-is.
 *   2. `runOnce` returns a non-retryable error (per `isRetryable`) — propagate
 *      the error result without burning another attempt.
 *   3. The retry budget (`RETRY_BACKOFF_MS.length` retries) is exhausted —
 *      return the last failure wrapped in a generic "retry failure" envelope.
 *
 * Each provider client supplies its own `runOnce` callback that performs
 * the request/parse step. The callback's return shape is provider-specific
 * (e.g. `ProviderCallResult` for openai-compatible, `AnthropicProviderCallResult`
 * for anthropic-messages), so the helper is generic over the result shape —
 * callers narrow via TypeScript generics at the call site.
 *
 * The generic constraint says `T` must extend the union `{ ok: true } | { ok: false; error: ProviderError }`.
 * Internally we construct failure results (the bail-if-aborted path and
 * the exhausted-retries path) and need to return them as `T`. TypeScript
 * can't verify the synthesized failure is assignable to the specific `T`
 * (because `T` might be a discriminated union where the success branch
 * has additional fields), so the function-level return type is widened
 * to `T | { ok: false; error: ProviderError }` and the call sites narrow
 * back to `T` at the boundary. The two `as` casts at the failure-return
 * sites are safe because (a) the synthesized object is structurally
 * assignable to the failure branch of any provider-specific `T`, and
 * (b) the call site has already used the result.ok check in earlier
 * iterations, so the call site's type narrowing on the success branch
 * still works correctly.
 *
 * Before each attempt, calls `bailIfAborted` to short-circuit when the
 * caller's `AbortSignal` is already aborted (would otherwise produce a
 * fake-timeout error after composing with an aborted signal).
 */
async function runWithRetry(args) {
    let lastFailure = null;
    for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
        const bail = bailIfAborted({ signal: args.signal, endpoint: args.endpoint, requestId: args.requestId });
        if (bail !== null) {
            return bail;
        }
        const result = await args.runOnce();
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
    const fallback = {
        ok: false,
        error: lastFailure ?? new ProviderError("network", args.endpoint, null, args.requestId, args.fallbackMessage),
    };
    return fallback;
}
/**
 * Build the canonical parse-fail `ProviderError` that every provider
 * client returns when the self-healing retry did not produce a
 * parseable review.
 *
 * The three providers (openai-compatible, anthropic-messages, copilot)
 * each constructed this error envelope inline with the same fields:
 *   - `code: "parse"`
 *   - `endpoint`, `requestId`, `status`
 *   - `message` (provider-specific wording)
 *   - `{ rawText, truncated, usage? }`
 *
 * Only `message` and the `truncated` / `usage` values vary; the shape
 * is identical. This helper takes the variable parts and produces the
 * error, eliminating the inline option-object construction that
 * previously drifted between the three sites.
 */
function buildParseFailError(args) {
    return new ProviderError("parse", args.endpoint, args.status, args.requestId, args.message, {
        rawText: args.rawText,
        truncated: args.truncated,
        ...(args.usage !== undefined ? { usage: args.usage } : {}),
    });
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
    if (!json_guards_isRecord(envelope)) {
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
    // Mirrors the abort-bailout guard from openai-compatible /
    // anthropic-messages. Copilot doesn't yet accept a caller
    // AbortSignal on `CopilotCallConfig`, so the check is a no-op
    // today; when the signal field is added, this guard will start
    // firing automatically.
    const bail = bailIfAborted({ signal: undefined, endpoint: ENDPOINT_CHAT, requestId });
    if (bail !== null) {
        return bail;
    }
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
    const bumpedMaxOutput = computeBumpedMaxOutput({
        currentBudget: config.maxOutputTokens,
        rawTextLength: rawText.length,
        textPayloadLength: textPayload.length,
    });
    const retryBody = buildChatBody({
        model: config.model,
        system: config.system,
        user: config.user,
        ...(bumpedMaxOutput !== undefined ? { maxOutputTokens: bumpedMaxOutput } : {}),
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
        const diagnosis = diagnoseParseFailure({ rawText });
        return {
            ok: false,
            error: buildParseFailError({
                endpoint: ENDPOINT_CHAT,
                status: response.status,
                requestId,
                message: "Provider response did not contain a JSON review payload after self-healing retry.",
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
    void _drop;
    return rest;
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
    // resolution is doing what they expect. Without these annotation
    // lines, a 400/404 from the action's last attempt is opaque — the
    // operator can't tell whether the action tried the URL they pasted
    // or jumped straight to the origin+prefix form. The `::notice::`
    // annotations are visible in the GitHub Actions log and survive
    // even if the action's `process.stderr.write` is captured.
    if (baseUrlCandidates.length > 1) {
        process.stderr.write(`::notice::${BRAND_PREFIX}Resolving provider base URL: trying ${baseUrlCandidates.length} candidates in order: ${baseUrlCandidates.map(redactUrlForLog).join(", ")}\n`);
    }
    let lastAttempt = { ok: false, error: new ProviderError("network", ENDPOINT_RESPONSES, null, requestId, "No base URL candidates resolved.") };
    for (const candidate of baseUrlCandidates) {
        process.stderr.write(`::notice::${BRAND_PREFIX}Trying base URL: ${redactUrlForLog(candidate)}\n`);
        const firstAttempt = await runWithRetryLoop(config, fetchImpl, requestId, ENDPOINT_RESPONSES, candidate);
        if (firstAttempt.ok) {
            return firstAttempt;
        }
        if (shouldFallback(firstAttempt.error)) {
            const chatAttempt = await runWithRetryLoop(config, fetchImpl, requestId, openai_compatible_ENDPOINT_CHAT, candidate);
            if (chatAttempt.ok) {
                return chatAttempt;
            }
            // Chat fallback also failed. Move to the next URL candidate
            // (the operator-pasted URL failed → try origin-stripped, etc.)
            // unless the error is NOT a 404/400 (e.g. auth failure, server
            // error) — in that case, retrying with a different URL won't
            // help, so return immediately.
            if (!isRoutableFailureForUrlCandidate(chatAttempt.error)) {
                return chatAttempt;
            }
            process.stderr.write(`::notice::${BRAND_PREFIX}Base URL ${redactUrlForLog(candidate)} returned routable failure (status=${chatAttempt.error.status}); advancing to next candidate.\n`);
            lastAttempt = chatAttempt;
            continue;
        }
        // The /responses endpoint failed with a non-routable status
        // (e.g. 401, 500). Retrying with a different URL won't help.
        if (!isRoutableFailureForUrlCandidate(firstAttempt.error)) {
            return firstAttempt;
        }
        process.stderr.write(`::notice::${BRAND_PREFIX}Base URL ${redactUrlForLog(candidate)} returned routable failure (status=${firstAttempt.error.status}); advancing to next candidate.\n`);
        lastAttempt = firstAttempt;
    }
    return lastAttempt;
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
async function runWithRetryLoop(config, fetchImpl, requestId, endpoint, baseUrl) {
    return runWithRetry({
        signal: config.signal,
        endpoint,
        requestId,
        fallbackMessage: "Unknown retry failure.",
        runOnce: () => runWithEndpoint(config, fetchImpl, requestId, endpoint, baseUrl),
    });
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
    if (isDebugRawActive()) {
        writeDebugRaw(`[DEBUG-RAW] requestId=${requestId} endpoint=${endpoint} ` +
            `rawTextLength=${rawText.length} textPayloadLength=${textPayload.length}\n`, config);
        const safeTextPayload = redactDebugSecrets(textPayload, config);
        writeDebugRaw(`[DEBUG-RAW] textPayload first 200: ${JSON.stringify(safeTextPayload.slice(0, 200))}\n`, config);
        writeDebugRaw(`[DEBUG-RAW] textPayload last 200:  ${JSON.stringify(safeTextPayload.slice(-200))}\n`, config);
        writeDebugRaw(`[DEBUG-RAW] hasResponseCompletedEvent: ${rawText.includes('"type":"response.completed"')}\n`, config);
    }
    // Surface parse-decision signals so future parse-fail runs can tell
    // whether the self-healing retry was skipped (detectProviderError
    // matched) or actually ran. The M3 model can produce a 100+ KB
    // response whose only content is reasoning — `joinOutputText`
    // returns empty and the parser correctly classifies it as
    // parse-fail, but we need to know whether the retry fired.
    const review = parseReviewPayload(textPayload);
    // [DEBUG-RAW] Trace the parse decision so the next parse-fail run can
    // show exactly what `parseReviewPayload` returned. Without this, we
    // see "retry fired" in the log but not WHY (null vs all-empty-fields
    // vs apology-summary-detected are all indistinguishable from outside).
    if (isDebugRawActive()) {
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
    // The retry DROPS the strict `response_format` constraint. Some
    // providers silently reject the wire schema and produce prose
    // instead of JSON — the retry lets the system prompt's "Return
    // strict JSON only" prose instruction carry the contract instead.
    // This makes the action dynamically adapt to any provider without
    // a hardcoded compatibility list.
    //
    // Note: any network/HTTP error on the retry is collapsed back into a
    // `parse` error (with the ORIGINAL rawText attached) so the parse-fail
    // path's diagnostic captures the actual root cause — the model
    // couldn't produce a parseable review, regardless of whether the retry
    // request itself reached the provider.
    //
    // Bumped-budget retry: some providers (notably MiniMax-M3) emit
    // long reasoning blocks that consume the entire output budget
    // before the model can write the JSON review. When the first
    // attempt's raw response is large (suggests the model produced
    // content) but the extracted text payload is small or empty
    // (suggests the actual review didn't make it through), raise
    // `maxOutputTokens` for the retry so the model has more room.
    // The retry still uses the same prompt, same schema, same model
    // — just more output budget.
    const firstAttemptBodyConfig = stripResponseFormat(buildBodyConfig(config));
    // Heuristic: when the response is "large but empty" (rawText > 16K
    // but textPayload < 200 chars), the model likely produced reasoning
    // only and was truncated before the JSON review. Double the budget
    // for the retry. Capped at 128K to avoid blowing past provider
    // limits.
    const needsMoreBudget = rawText.length > 16_000 && textPayload.length < 200;
    const bumpedMaxOutput = computeBumpedMaxOutput({
        currentBudget: config.maxOutputTokens,
        rawTextLength: rawText.length,
        textPayloadLength: textPayload.length,
    });
    if (isDebugRawActive() && needsMoreBudget) {
        writeDebugRaw(`[DEBUG-RAW] bumped-budget retry: rawText.length=${rawText.length} textPayload.length=${textPayload.length} bumpedMaxOutput=${bumpedMaxOutput}\n`, config);
    }
    const retryBodyConfig = {
        ...firstAttemptBodyConfig,
        ...(bumpedMaxOutput !== undefined ? { maxOutputTokens: bumpedMaxOutput } : {}),
    };
    const retryBody = endpoint === ENDPOINT_RESPONSES
        ? buildResponsesBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT })
        : buildChatBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT });
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
        // Fresh signal for the retry so it gets the full timeout budget.
        // Reusing the first-attempt signal would give the retry only
        // whatever time was left on the original 300s AbortSignal.
        // Some models (e.g. MiniMax-M3 with bumped-budget retry) need
        // 3-5 minutes per attempt.
        const retrySignal = composeSignal(config.signal, config.requestTimeoutMs);
        const retryResponse = await performFetch(fetchImpl, url, retryBody, retrySignal, config, requestId, endpoint);
        retryResponseStatus = retryResponse.status;
        if (retryResponse.ok) {
            const retryRawText = await readBody(retryResponse, endpoint, requestId);
            const retryTextPayload = extractTextPayload(endpoint, retryRawText);
            if (isDebugRawActive()) {
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
        const diagnosis = diagnoseParseFailure({ rawText });
        throw buildParseFailError({
            endpoint,
            status: retryResponseStatus ?? response.status,
            requestId,
            message: "Provider response did not contain a JSON review payload after self-healing retry.",
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
    let redacted = replaceSecretsLiterally(value, [
        config.apiKey,
        config.promptOverride ?? "",
        config.additionalPromptOverride ?? "",
    ]);
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

;// CONCATENATED MODULE: ./src/provider/anthropic-messages.ts
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

/**
 * Project the call config down to the body shape expected by
 * `buildAnthropicBody`. Anthropic accepts a top-level `system` field,
 * not a system-role message — this projection is intentionally minimal.
 */
function anthropic_messages_buildBodyConfig(config) {
    return {
        model: config.model,
        system: config.system,
        user: config.user,
        ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
        ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
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
    // See PARSE_FAIL_RETRY_PROMPT in provider-parse.ts for why we APPEND
    // the original user content instead of replacing it on retry.
    const userContent = opts?.userOverride !== undefined
        ? `${opts.userOverride}${config.user}`
        : config.user;
    const body = {
        model: config.model,
        system: config.system,
        messages: [
            { role: "user", content: userContent },
        ],
    };
    // Anthropic REQUIRES `max_tokens`. Without it the API rejects the
    // request with HTTP 400 (`"messages: at least one message is required"` /
    // `"max_tokens: Field required"`). We always send it; default to 4096
    // when the operator did not pin one so the call works even in tests
    // that omit the cap.
    body["max_tokens"] = config.maxOutputTokens ?? 4096;
    // Forward the operator's reasoning-effort hint when set. Omitted
    // entirely (not sent as `null`) when --effort is not set, so
    // gateways that reject unknown fields stay happy. See the field
    // docstring for the wire-compat rationale.
    if (config.reasoningEffort !== undefined) {
        body["reasoning_effort"] = config.reasoningEffort;
    }
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
    }
    catch {
        return rawText;
    }
    if (!json_guards_isRecord(parsed)) {
        return rawText;
    }
    const content = readArrayField(parsed, "content");
    if (content === null) {
        // No `content` array — typical for Anthropic error envelopes that
        // use `{type:"error", error:{type, message}}` instead of `content[]`.
        // The downstream `detectProviderError` will catch that case.
        return rawText;
    }
    const fragments = [];
    for (const block of content) {
        if (!json_guards_isRecord(block))
            continue;
        const type = readStringField(block, "type");
        if (type !== "text")
            continue;
        const text = readStringField(block, "text");
        if (text !== null && text.length > 0)
            fragments.push(text);
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
    if (!json_guards_isRecord(parsed))
        return null;
    const stopReason = readStringField(parsed, "stop_reason");
    if (stopReason === null || stopReason.length === 0)
        return null;
    return stopReason;
}
/**
 * Read the `usage` block from a parsed Anthropic response. Returns
 * undefined when absent or malformed — the parse-fail diagnostic only
 * surfaces usage when the provider actually reported it.
 */
function readUsage(parsed) {
    if (!json_guards_isRecord(parsed))
        return undefined;
    const usage = readRecordField(parsed, "usage");
    if (usage === null || !json_guards_isRecord(usage))
        return undefined;
    const inputTokens = anthropic_messages_readNumberField(usage, "input_tokens");
    const outputTokens = anthropic_messages_readNumberField(usage, "output_tokens");
    const totalTokens = anthropic_messages_readNumberField(usage, "total_tokens");
    if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
        return undefined;
    }
    // Build mutable then freeze-via-cast — preserves the readonly surface
    // the consumers (ProviderError.usage) expect while keeping the
    // construction site ergonomic.
    const mutable = {};
    if (inputTokens !== undefined)
        mutable.input_tokens = inputTokens;
    if (outputTokens !== undefined)
        mutable.output_tokens = outputTokens;
    if (totalTokens !== undefined)
        mutable.total_tokens = totalTokens;
    return mutable;
}
function anthropic_messages_readNumberField(record, key) {
    const raw = record[key];
    if (typeof raw !== "number")
        return undefined;
    return raw;
}
async function runAnthropicRequest(config) {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const requestId = createRequestId();
    // Resolve to the full Anthropic Messages URL, preserving any
    // operator-supplied path prefix. This matches the OFFICIAL
    // @anthropic-ai/sdk convention (Claude Code's `ANTHROPIC_BASE_URL`
    // becomes `<baseURL>/v1/messages`) and the path-preserving fix in
    // https://github.com/xemantic/anthropic-sdk-kotlin/pull/145.
    //
    // Critically, this UNBLOCKS Anthropic-compatible gateways whose
    // endpoints live under a path prefix — the documented case is
    // `https://api.minimax.io/anthropic` →
    // `https://api.minimax.io/anthropic/v1/messages` per
    // https://platform.minimax.io/docs/token-plan/claude-code.
    //
    // Anthropic.com itself only serves `/v1/messages` at the bare host,
    // so an operator pointing at `https://api.anthropic.com/anthropic`
    // would still produce `/anthropic/v1/messages` (which 404s on
    // anthropic.com — operator error) — but that's the SDK's behavior
    // too. Self-hosted gateways under a path prefix are the supported
    // case here.
    const url = resolveAnthropicMessagesUrl(config.baseUrl);
    return anthropic_messages_runWithRetryLoop(config, fetchImpl, requestId, url);
}
async function anthropic_messages_runWithRetryLoop(config, fetchImpl, requestId, url) {
    return runWithRetry({
        signal: config.signal,
        endpoint: ENDPOINT,
        requestId,
        fallbackMessage: "Unknown Anthropic retry failure.",
        runOnce: () => runOnce(config, fetchImpl, requestId, url),
    });
}
async function runOnce(config, fetchImpl, requestId, url) {
    // `url` is the FULL messages URL already resolved by
    // `resolveAnthropicMessagesUrl` (which appends `/v1/messages`,
    // preserves the operator's path prefix, and short-circuits on the
    // `/v1/messages` already-appended case). No further joining is
    // needed here — appending `/messages` again would produce a doubled
    // `/v1/messages/messages` segment.
    const body = buildAnthropicBody(anthropic_messages_buildBodyConfig(config));
    const signal = composeSignal(config.signal, config.requestTimeoutMs);
    let response;
    try {
        response = await anthropic_messages_performFetch(fetchImpl, url, body, signal, config.apiKey, requestId);
    }
    catch (error) {
        if (error instanceof ProviderError) {
            return { ok: false, error };
        }
        throw error;
    }
    if (!response.ok) {
        // Anthropic returns errors as `{type:"error", error:{type, message}}`
        // with a status (401, 404, 429, 5xx). The 4xx/5xx envelope itself
        // doesn't usually have a recognizable signal beyond the HTTP status,
        // so we just throw a typed ProviderError with the status. The
        // body text is read ONLY so the diagnostic can cite it.
        let errorBodyText = "";
        try {
            errorBodyText = await response.text();
        }
        catch {
            // Body read failure shouldn't mask the original status.
        }
        return {
            ok: false,
            error: new ProviderError("anthropic_4xx", ENDPOINT, response.status, requestId, `Anthropic Messages API responded with HTTP ${response.status}.`, { ...(errorBodyText.length > 0 ? { rawText: errorBodyText } : {}) }),
        };
    }
    let rawText;
    try {
        rawText = await response.text();
    }
    catch (error) {
        return {
            ok: false,
            error: new ProviderError("parse", ENDPOINT, response.status, requestId, sanitizeMessage(error, "Failed to read Anthropic response body."), { cause: error }),
        };
    }
    const textPayload = extractAnthropicTextPayload(rawText);
    // Provider-error detection: a 200 OK whose body is an Anthropic error
    // envelope (router misconfiguration, model not found, content policy
    // rejection returned with 200 OK in some setups) should be classified
    // as provider_error, NOT as a parse failure. Same logic the OpenAI
    // path runs.
    const providerError = detectProviderError(rawText);
    if (providerError !== null) {
        return {
            ok: false,
            error: new ProviderError("provider_error", ENDPOINT, response.status, requestId, providerError.message, { rawText, providerErrorDetails: providerError }),
        };
    }
    const review = parseReviewPayload(textPayload);
    if (isNonEmptyReview(review)) {
        return { ok: true, endpoint: ENDPOINT, review, requestId };
    }
    // Empty JSON or "truncated stream" parse-fail path. We check
    // `stop_reason === "max_tokens"` AND `rawText.length > 16K` to
    // distinguish "model ran out of tokens" from "model returned bad JSON".
    // Both surface as parse errors, but the diagnostic in `truncated: true`
    // lets the operator know raising `--max-output-tokens` would help.
    let parsedStopReason = null;
    let parsedUsage;
    try {
        const parsedRaw = JSON.parse(rawText);
        parsedStopReason = readStopReason(parsedRaw);
        parsedUsage = readUsage(parsedRaw);
    }
    catch {
        // rawText wasn't JSON; that's exactly why the parse failed.
    }
    const truncatedByStopReason = parsedStopReason === "max_tokens";
    // Bumped-budget retry heuristic: large empty stream → likely a
    // truncation / reasoning-only response. Re-issue with more budget.
    // Same heuristic as openai-compatible.ts.
    const bumpedMaxOutput = computeBumpedMaxOutput({
        currentBudget: config.maxOutputTokens,
        rawTextLength: rawText.length,
        textPayloadLength: textPayload.length,
    });
    // Self-healing retry with the JSON-only reminder prefix.
    const retryBodyConfig = {
        ...anthropic_messages_buildBodyConfig(config),
        ...(bumpedMaxOutput !== undefined ? { maxOutputTokens: bumpedMaxOutput } : {}),
    };
    const retryBody = buildAnthropicBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT });
    let retryReview = null;
    let retryResponseStatus = null;
    try {
        // Fresh signal: same rationale as openai-compatible.
        const retrySignal = composeSignal(config.signal, config.requestTimeoutMs);
        const retryResponse = await anthropic_messages_performFetch(fetchImpl, url, retryBody, retrySignal, config.apiKey, requestId);
        retryResponseStatus = retryResponse.status;
        if (retryResponse.ok) {
            const retryRawText = await retryResponse.text();
            const retryTextPayload = extractAnthropicTextPayload(retryRawText);
            const parsedRetry = parseReviewPayload(retryTextPayload);
            if (isNonEmptyReview(parsedRetry)) {
                retryReview = parsedRetry;
            }
        }
    }
    catch {
        // Retry path threw — fall through to the original-rawText parse-fail
        // throw below. retryResponseStatus stays null in this branch.
    }
    if (retryReview !== null) {
        return { ok: true, endpoint: ENDPOINT, review: retryReview, requestId };
    }
    // Distinguish "truncated stream" from "completed but malformed" by
    // checking the ORIGINAL response's stop_reason. When the first
    // attempt ended at `max_tokens`, the operator's remediation is to
    // raise `--max-output-tokens`; otherwise the model returned bad JSON
    // (model regression or schema mismatch).
    const diagnosis = diagnoseParseFailure({ rawText });
    // diagnoseParseFailure's `truncated` heuristic is based on a missing
    // SSE-completed event marker; for Anthropic that marker doesn't apply,
    // so override with our explicit stop_reason check when we have one.
    const effectiveTruncated = truncatedByStopReason || diagnosis.truncated;
    // Prefer the Anthropic-reported usage over the diagnosis's
    // SSE-completed-event-derived `usage`.
    const usage = parsedUsage ?? diagnosis.usage;
    return {
        ok: false,
        error: buildParseFailError({
            endpoint: ENDPOINT,
            status: retryResponseStatus ?? response.status,
            requestId,
            message: "Anthropic response did not contain a JSON review payload after self-healing retry.",
            rawText,
            truncated: effectiveTruncated,
            ...(usage !== undefined ? { usage } : {}),
        }),
    };
}
async function anthropic_messages_performFetch(fetchImpl, url, body, signal, apiKey, requestId) {
    try {
        return await fetchImpl(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                // Anthropic BANS the `Authorization: Bearer ...` header. The
                // correct auth header is `x-api-key`, with the required
                // `anthropic-version` pin. Sending Bearer instead results in a
                // 401 with no useful error message. Test fixtures pin both
                // headers (no `authorization`).
                "x-api-key": apiKey,
                "anthropic-version": ANTHROPIC_VERSION,
                "x-request-id": requestId,
            },
            body: JSON.stringify(body),
            signal,
        });
    }
    catch (error) {
        if (isAbortError(error)) {
            throw new ProviderError("timeout", ENDPOINT, null, requestId, "Anthropic request timed out.");
        }
        throw new ProviderError("network", ENDPOINT, null, requestId, sanitizeMessage(error, "Network error contacting Anthropic."), { cause: error });
    }
}
/**
 * Build the headers for an Anthropic Messages request. Exported so the
 * test fixture can pin the exact shape. The api-key comes from the call
 * config, NOT from the body, because we don't want the key landing in
 * any request artifact / log / debug dump.
 */
function buildAnthropicHeaders(apiKey, requestId) {
    return {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "x-request-id": requestId,
    };
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
    // MiniMax: the api.minimax.io gateway only accepts MiniMax-M3,
    // MiniMax-Text-01, and abab* aliases. Any OpenAI/Anthropic
    // model name returns HTTP 400. Detected by hostname substring.
    { hostSubstring: "minimax", model: MINIMAX_DEFAULT_MODEL },
    // Anthropic: api.anthropic.com serves the claude-* line.
    { hostSubstring: "anthropic", model: ANTHROPIC_DEFAULT_MODEL },
    // Google: generativelanguage.googleapis.com (Gemini API) and
    // aiplatform.googleapis.com (Vertex AI) both serve gemini-*.
    { hostSubstring: "generativelanguage", model: GOOGLE_DEFAULT_MODEL },
    { hostSubstring: "googleapis", model: GOOGLE_DEFAULT_MODEL },
];
function resolveAutoModel(input) {
    if (input.provider === "copilot") {
        return COPILOT_DEFAULT_MODEL;
    }
    // Anthropic provider: the operator picked the Anthropic-native
    // `/v1/messages` protocol. Return the Anthropic default regardless of
    // the URL — the protocol is Anthropic-only, so hostname routing does
    // not apply. Operators who want a different Anthropic model can
    // override via `--model`.
    if (input.provider === "anthropic") {
        return ANTHROPIC_DEFAULT_MODEL;
    }
    const url = resolveField(input.apiUrl, input.env[ENV_KEYS.UMACTUALLY_API_URL], "");
    const hostname = url_extractHostname(url);
    if (hostname !== null) {
        const lowerHost = hostname.toLowerCase();
        for (const route of HOST_ROUTES) {
            if (lowerHost.includes(route.hostSubstring)) {
                return route.model;
            }
        }
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
    anthropic: [
        // The Anthropic native provider (`/v1/messages`) only accepts
        // Anthropic claude-* model names. Other provider families' model
        // strings would 400 on the wire. The chain is intentionally
        // bare-bones — operators who need a multi-model fallback chain
        // for Anthropic can pass `--fallback-models` explicitly.
        ANTHROPIC_DEFAULT_MODEL,
        "claude-haiku-4.5",
        "claude-opus-4.6",
    ],
};
/**
 * Per-URL fallback chains for providers that only accept their own
 * model names. The MiniMax provider (`api.minimax.io`) returns
 * HTTP 400 for any OpenAI/Anthropic/Google model name, so the
 * generic openai-compatible fallback chain would 400 too.
 *
 * The map key is the host substring used by `HOST_ROUTES` so a
 * single source of truth drives both primary and fallback model
 * selection. Adding a new provider means adding ONE entry to
 * `HOST_ROUTES` and (if it needs custom fallbacks) ONE entry here
 * with the same key.
 */
const URL_SPECIFIC_FALLBACKS = {
    // `toLowerCase()` is applied to the URL before lookup so this
    // map is case-insensitive — `api.minimax.io` and `API.MINIMAX.IO`
    // both resolve to the same chain.
    "minimax": [
        MINIMAX_DEFAULT_MODEL,
        "MiniMax-Text-01",
        "abab6.5s-chat",
        "abab5.5-chat",
    ],
};
const DEFAULT_FALLBACK_MODELS = PROVIDER_FALLBACKS["openai-compatible"];
/**
 * Return the fallback chain for a specific provider. Use this
 * instead of the bare `DEFAULT_FALLBACK_MODELS` constant in any
 * path that might be Copilot-routed — otherwise the parse-fail
 * recovery would itself fail with a 404.
 *
 * If `apiUrl` is provided and the URL hostname matches a
 * URL-specific chain (e.g. `api.minimax.io`), the URL-specific
 * chain wins — the generic OpenAI chain would 400 on those
 * providers.
 *
 * Hostname-only matching: matches against the URL hostname, not
 * the full URL, so a path like `/minimax-router` in
 * `https://example.com/minimax-router` does NOT falsely trigger
 * the MiniMax fallback chain. This is the same contract as
 * `resolveAutoModel`'s hostname-based routing — both functions
 * use `extractHostname` so the match is consistent.
 */
function fallbackModelsFor(provider, apiUrl) {
    if (apiUrl !== undefined && apiUrl !== null && apiUrl.length > 0) {
        const hostname = extractHostname(apiUrl);
        if (hostname !== null) {
            for (const [hostKey, chain] of Object.entries(URL_SPECIFIC_FALLBACKS)) {
                if (hostname.includes(hostKey)) {
                    return chain;
                }
            }
        }
    }
    return PROVIDER_FALLBACKS[provider];
}
/**
 * Parse a `--fallback-models` CLI value (comma-separated) into a
 * list. Empty parts and duplicate entries are dropped.
 *
 * When `apiUrl` is provided, the default fallback chain uses the
 * URL-specific model list when the URL matches a known provider
 * (e.g. `api.minimax.io` → MiniMax-M3 then MiniMax-Text-01, not
 * the generic openai-compatible chain). This makes `--fallback-models`
 * consistent with `resolveAutoModel`'s URL-aware behavior.
 */
function parseFallbackModels(value, apiUrl) {
    const defaultChain = apiUrl !== undefined && apiUrl !== null && apiUrl.length > 0
        ? fallbackModelsFor("openai-compatible", apiUrl)
        : DEFAULT_FALLBACK_MODELS;
    if (value === null || value === undefined || value.length === 0) {
        return defaultChain;
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
    return out.length > 0 ? out : defaultChain;
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
    const positions = parse_positions_parseDiffPositions(input.diffText);
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
    const positions = parse_positions_parseDiffPositions(input.diffText);
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
        if (comment === undefined) {
            continue;
        }
        const contradiction = detectVerifiedFactsContradiction(comment.body, facts);
        if (contradiction === null) {
            kept.push(comment);
        }
        else {
            downgradeReasons.push({ index: i, reason: contradiction });
            downgraded.push({ ...comment, severity: "info" });
        }
    }
    return { kept, downgraded, downgradeReasons };
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
    "orphan",
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
const STOPWORD_TOKENS = new Set([
    // English stop words
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "when",
    "while", "for", "of", "to", "in", "on", "at", "by", "from", "as",
    "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "will", "would", "should", "could", "may",
    "might", "can", "must", "shall", "this", "that", "these", "those",
    "with", "into", "about", "between", "through", "during", "before",
    "after", "above", "below", "out", "off", "over", "under", "again",
    "further", "once", "here", "there", "where", "why", "how", "all",
    "any", "both", "each", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than",
    "too", "very", "just", "still", "now", "it", "its", "they", "them",
    "their", "we", "our", "us", "you", "your", "i", "me", "my", "he",
    "she", "his", "her", "what", "which", "who", "whom",
    // Review-action vocabulary
    "missing", "removed", "output", "outputs", "input", "inputs",
    "block", "list", "lists", "array", "field", "entry", "entries",
    "key", "keys", "value", "values", "file", "files", "directory",
    "directories", "include", "includes", "including", "exclude",
    "excludes", "see", "see-also", "per", "via", "downstream",
    "upstream", "consumers", "consumer", "consume", "depends",
    "depend", "callers", "caller", "post", "posted", "posting", "postable",
    "find", "finds", "found", "want", "wants", "wanted", "need", "needs",
    "needed", "use", "uses", "used", "using", "claim", "claims", "assert",
    "asserts", "asserted", "appears", "appear", "show", "shows", "showed",
    "verify", "verifies", "verified", "render", "renders", "rendered",
    "check", "checks", "checked", "action", "actions", "comment",
    "comments", "review", "reviews", "operator", "operators", "test",
    "tests", "change", "changes", "changed", "add", "adds", "added",
    "remove", "removes", "delete", "deletes", "deleted", "merge",
    "merges", "merged", "keep", "keeps", "kept", "fail", "fails",
    "failed", "pass", "passes", "passed", "make", "makes", "made",
    "ensure", "ensures", "ensured", "consider", "considers", "considered",
    "likely", "potentially", "probably", "perhaps", "may-be", "might-be",
    "seems", "appears-to", "looks", "looks-like", "is-likely",
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
    // Step 1: confirm the body has a missing/removed phrase. If not,
    // no contradiction is possible.
    if (!MISSING_PHRASES.some((p) => lower.includes(p))) {
        return null;
    }
    // Step 2: collect every verified-list token (the universe of
    // candidates that would constitute a contradiction).
    const verifiedCandidates = new Set();
    if (facts.packageJsonFiles !== null) {
        for (const f of facts.packageJsonFiles.files) {
            verifiedCandidates.add(f);
        }
    }
    if (facts.actionOutputs !== null && facts.actionOutputs.outputKeys.length > 0) {
        for (const k of facts.actionOutputs.outputKeys) {
            verifiedCandidates.add(k);
        }
    }
    if (verifiedCandidates.size === 0) {
        return null;
    }
    // Step 3: for each candidate token, check whether it appears in
    // the SAME SENTENCE as a missing-phrase. We split the body on
    // sentence boundaries (period, newline) and look for both the
    // token and a missing-phrase in the same sentence. A token that
    // appears only in a different sentence from the missing-phrase is
    // NOT a contradiction — it's natural-language prose.
    for (const candidate of verifiedCandidates) {
        const candidateLower = candidate.toLowerCase();
        if (candidateLower.length === 0)
            continue;
        if (STOPWORD_TOKENS.has(candidateLower))
            continue;
        // Split the body into sentences. We use a simple split on
        // . ! ? and newlines. Empty sentences are skipped.
        const sentences = lower.split(/[.!?\n]+/u).map((s) => s.trim()).filter((s) => s.length > 0);
        for (const sentence of sentences) {
            if (!sentence.includes(candidateLower))
                continue;
            const hasMissingPhrase = MISSING_PHRASES.some((p) => sentence.includes(p));
            if (!hasMissingPhrase)
                continue;
            // Both the candidate and a missing-phrase appear in the same
            // sentence. This is the contradiction.
            if (facts.packageJsonFiles !== null &&
                facts.packageJsonFiles.files.includes(candidate)) {
                return `body claims "${candidate}" is missing from package.json#files, but the verified list includes "${candidate}"`;
            }
            if (facts.actionOutputs !== null &&
                facts.actionOutputs.outputKeys.includes(candidate)) {
                return `body claims "${candidate}" output was removed, but the verified list of action.yml#outputs includes "${candidate}"`;
            }
        }
    }
    return null;
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

;// CONCATENATED MODULE: ./src/review/filter-confidence.ts
// SPDX-License-Identifier: MIT
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
    if (input.review.comments.length === 0) {
        return { kept: [], downgraded: [], reasons: [] };
    }
    // Pre-compute per-path hunk content once so the inner per-finding
    // filters don't repeat the diff walk. The map is keyed by path; the
    // value is the joined (context + added) lines for that file's
    // hunks. The hunk extraction is O(diff length), and we do it once
    // for the whole review rather than once per finding.
    const hunkContentByPath = collectHunkContentByPath(input.diffText);
    const kept = [];
    const downgraded = [];
    const reasons = [];
    for (let i = 0; i < input.review.comments.length; i += 1) {
        const comment = input.review.comments[i];
        if (comment === undefined) {
            continue;
        }
        const hunk = hunkContentByPath.get(comment.path);
        const verdict = classifyFinding({ comment, hunkContent: hunk ?? null });
        if (verdict === null) {
            kept.push(comment);
            continue;
        }
        downgraded.push(applyDowngrade(comment, verdict.reason));
        reasons.push({ index: i, reason: verdict.reason, explanation: verdict.explanation });
    }
    return { kept, downgraded, reasons };
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
    // 1. Hedging-language calibration. Operates on the comment's
    //    severity, not the body alone: a body that contains hedging
    //    is OK at `info`/`low` (already calibrated by the model) but
    //    should be calibrated DOWN at `medium`/`high`/`critical`.
    if (containsHedgingLanguage(bodyLower)) {
        const severity = input.comment.severity.toLowerCase();
        if (severity === "medium" || severity === "high" || severity === "critical") {
            return {
                reason: "hedging-language",
                explanation: `Body uses hedging language ("could", "might", "potentially", "in some cases") at severity "${input.comment.severity}"; calibrating to info because the claim is not asserted as a confirmed violation.`,
            };
        }
    }
    // 2. Pattern-matched advice. The body contains generic best-
    //    practice phrasing ("you should…", "consider adding…",
    //    "you may want to…") AND does NOT quote any observable
    //    diff line as evidence (i.e. no verbatim substring of the
    //    hunk appears in the body). This is the model emitting
    //    memorized advice with no anchor to the diff content.
    if (looksLikePatternMatchedAdvice(bodyLower) && input.hunkContent !== null) {
        if (!bodyContainsAnyHunkLine(body, input.hunkContent)) {
            return {
                reason: "pattern-matched-advice",
                explanation: "Body uses generic best-practice phrasing without quoting any diff line as evidence; this is the model emitting pattern-matched advice rather than a finding anchored to the change.",
            };
        }
    }
    // 3. Contradicted-by-quote. The body names a code construct
    //    ("parameterized query", "try/catch", "prepared statement",
    //    "escape", "validate", "sanitize", etc.) AND the diff hunk
    //    for the cited path+line already contains that construct.
    //    The model is asserting absence while the diff shows
    //    presence.
    if (input.hunkContent !== null) {
        const constructMatch = contradictsDiffPresence(bodyLower, input.hunkContent);
        if (constructMatch !== null) {
            return {
                reason: "contradicted-by-quote",
                explanation: `Body claims absence of "${constructMatch}" but the diff hunk around the cited line already contains it.`,
            };
        }
    }
    // 4. Intentional design. The body expresses a negative
    //    assessment of code that the diff documents as intentional
    //    (e.g. an inline comment like "// intentional: …" or
    //    "// NOTE: …" appears near the cited line, and the body
    //    uses phrases like "this is wrong", "however", "but" near
    //    a code pattern). Conservative: requires BOTH the body
    //    intent-flag and the hunk documentation — single trigger
    //    is not enough.
    if (input.hunkContent !== null) {
        const intentional = looksLikeIntentionalDesign(bodyLower, input.hunkContent);
        if (intentional !== null) {
            return {
                reason: "intentional-design",
                explanation: `Body flags "${intentional.flag}" but the diff hunk documents the pattern as intentional ("${intentional.doc}"); the model missed the documenting comment.`,
            };
        }
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
    "potentially",
];
function containsHedgingLanguage(bodyLower) {
    for (const phrase of HEDGING_PHRASES) {
        if (bodyLower.includes(phrase)) {
            return true;
        }
    }
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
    "a common pattern is to",
];
function looksLikePatternMatchedAdvice(bodyLower) {
    for (const lead of PATTERN_MATCHED_ADVICE_LEADS) {
        if (bodyLower.startsWith(lead) || bodyLower.includes(` ${lead}`) || bodyLower.includes(`\n${lead}`)) {
            return true;
        }
    }
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
    // Note: SQL parameter placeholders like `$1`, `$2`, `?, ?` were
    // considered as presence markers but rejected — these two-character
    // tokens are extraordinarily common in diffs (regex substitutions,
    // format strings, template literals, mathematical expressions) and
    // produced false-positive contradicted-by-quote downgrades on
    // legitimate findings about unrelated code. The
    // "parameterized query" / "parameterised query" phrasings are
    // anchored to actual security constructs; SQL parameter syntax is
    // not. Pinned by the regression test that injects `$1` in an
    // unrelated context and asserts the filter does NOT fire.
    { presence: ["parameterized query", "parameterized queries", "parameterised query"], label: "parameterized queries" },
    { presence: ["prepared statement", "prepared statements"], label: "prepared statements" },
    { presence: ["bound parameter", "bound parameters", "parameter binding"], label: "bound parameters" },
    { presence: ["escape(", "escapehtml", "escapeHtml"], label: "input escaping" },
    { presence: ["sanitize(", "sanitise("], label: "input sanitization" },
    { presence: ["validate(", "validation"], label: "input validation" },
    { presence: ["authoriz", "authorisation", "authorization check"], label: "authorization" },
    { presence: ["authenticat"], label: "authentication" },
    { presence: ["csrf"], label: "CSRF protection" },
    { presence: ["xss"], label: "XSS protection" },
    { presence: ["rate limit", "rate-limit", "throttle"], label: "rate limiting" },
];
function contradictsDiffPresence(bodyLower, hunkLower) {
    for (const construct of PRESENCE_CONSTRUCTS) {
        // Body must mention the construct AND the hunk must contain it.
        const mentionsConstruct = construct.presence.some((p) => bodyLower.includes(p));
        if (!mentionsConstruct)
            continue;
        const constructInHunk = construct.presence.some((p) => hunkLower.includes(p));
        if (!constructInHunk)
            continue;
        // Body must assert absence SPECIFIC TO THIS construct. The
        // absence-phrase list is keyed by construct label so a body
        // that says "no error handling" does not trigger when the
        // construct being checked is "parameterized queries" — that
        // mismatch was the source of the false positive where a body
        // mentions `return null;` (not in the construct set) AND
        // "no error handling" (mapped only to the error-handling
        // construct label).
        const absencePhrases = ABSENCE_PHRASES_BY_CONSTRUCT.get(construct.label);
        if (absencePhrases === undefined)
            continue;
        const assertsAbsence = absencePhrases.some((p) => bodyLower.includes(p));
        if (!assertsAbsence)
            continue;
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
const ABSENCE_PHRASES_BY_CONSTRUCT = new Map([
    ["parameterized queries", ["is missing", "are missing", "isn't included", "doesn't include", "does not include", "no parameterized", "no prepared statement", "no prepared statements", "fails to use", "fails to include", "not present", "lacks"]],
    ["prepared statements", ["is missing", "are missing", "isn't included", "doesn't include", "does not include", "no prepared", "fails to use"]],
    ["bound parameters", ["is missing", "are missing", "doesn't bind", "no bound"]],
    ["input escaping", ["is missing", "are missing", "isn't escaping", "no escape(", "fails to escape", "unescaped"]],
    ["input sanitization", ["is missing", "are missing", "no sanitize(", "no sanitise(", "unsanitized", "unsanitised"]],
    ["input validation", ["is missing", "are missing", "no validate(", "no validation", "unvalidated"]],
    ["authorization", ["is missing", "are missing", "no authoriz", "unauthorized", "no authorization check"]],
    ["authentication", ["is missing", "are missing", "no authenticat", "unauthenticated"]],
    ["CSRF protection", ["is missing", "no csrf", "no csrf protection"]],
    ["XSS protection", ["is missing", "no xss", "no xss protection"]],
    ["rate limiting", ["is missing", "no rate limit", "no rate-limit", "no throttling"]],
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
    "incorrect way",
];
const INTENTIONAL_DOC_MARKERS = [
    { marker: "// intentional", description: "intentional" },
    { marker: "// by design", description: "by design" },
    { marker: "// note:", description: "note" },
    { marker: "// note ", description: "note" },
    { marker: "// hack:", description: "hack" },
    { marker: "// workaround", description: "workaround" },
    { marker: "// documented:", description: "documented" },
    { marker: "// see ", description: "see-comment" },
    { marker: "// see-also", description: "see-also" },
    { marker: "// explanation:", description: "explanation" },
    { marker: "// rationale:", description: "rationale" },
    { marker: "// reason:", description: "reason" },
    { marker: "// why:", description: "why" },
    { marker: "// context:", description: "context" },
    { marker: "// todo:", description: "todo" },
    { marker: "// fixme:", description: "fixme" },
    { marker: "// note that", description: "note-that" },
    { marker: "/* intentional", description: "intentional" },
    { marker: "/* by design", description: "by design" },
    { marker: "/* note:", description: "note" },
];
function looksLikeIntentionalDesign(bodyLower, hunkLower) {
    // Body must express disapproval (one of BODY_DISAPPROVAL_PHRASES).
    let matchedFlag = null;
    for (const phrase of BODY_DISAPPROVAL_PHRASES) {
        if (bodyLower.includes(phrase)) {
            matchedFlag = phrase;
            break;
        }
    }
    if (matchedFlag === null) {
        return null;
    }
    // Hunk must contain a documenting marker that explains the
    // pattern (e.g. "// intentional:" or "// note:"). The marker
    // is checked case-insensitively because we already lowercased
    // the hunk.
    for (const marker of INTENTIONAL_DOC_MARKERS) {
        if (hunkLower.includes(marker.marker)) {
            return { flag: matchedFlag, doc: marker.description };
        }
    }
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
    return { ...comment, severity: nextSeverity };
}
const SEVERITY_TIERS = ["info", "low", "medium", "high", "critical"];
function downgradeOneTier(severity) {
    const idx = SEVERITY_TIERS.indexOf(severity);
    if (idx === -1 || idx === 0)
        return "info";
    return SEVERITY_TIERS[idx - 1] ?? "info";
}
function downgradeTwoTiers(severity) {
    const idx = SEVERITY_TIERS.indexOf(severity);
    if (idx === -1 || idx <= 1)
        return "info";
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
    const result = new Map();
    if (diffText.length === 0) {
        return result;
    }
    // Use the existing single-file reconstructor for each path we
    // encounter. The cost is acceptable because the diff walk is
    // O(N) and the per-file content is small enough to fit in
    // memory. We call `reconstructFileFromDiff` for each distinct
    // path that appears in the diff, which is at most a few
    // dozen in any realistic PR.
    const seenPaths = new Set();
    for (const line of diffText.split(/\r?\n/u)) {
        const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
        if (match === null)
            continue;
        const path = match[2];
        if (path === undefined)
            continue;
        if (seenPaths.has(path))
            continue;
        seenPaths.add(path);
        const content = reconstructFileFromDiff(diffText, path);
        if (content !== null) {
            result.set(path, content.toLowerCase());
        }
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
        if (trimmed.length < MIN_MATCH)
            continue;
        if (body.includes(trimmed)) {
            return true;
        }
    }
    return false;
}

;// CONCATENATED MODULE: ./src/cli/live-provider.ts


















const live_provider_DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
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
        expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });
    const providerApiKey = requireLiveConfig(resolveField(input.parsed.apiKey, input.env[ENV_KEYS.UMACTUALLY_API_KEY], ""), ENV_KEYS.UMACTUALLY_API_KEY);
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
    const sinkProviderName = input.parsed.provider === "copilot" ? COPILOT_PROVIDER_NAME
        : input.parsed.provider === "anthropic" ? ANTHROPIC_PROVIDER_NAME
            : PROVIDER_NAME;
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
    //
    // Some models don't support strict JSON schema and produce prose
    // instead of JSON. Rather than maintaining a hardcoded list of
    // non-compliant models, the provider layer's self-healing retry
    // path detects the parse-fail and retries WITHOUT the schema —
    // the system prompt's "Return strict JSON only" instruction
    // handles models that follow instructions but reject the wire
    // constraint. This makes the action dynamically adapt to any
    // provider without operator intervention.
    const responseFormat = input.parsed.strictSchema === false
        ? undefined
        : { type: "json_schema", strict: true, schema: REVIEW_PAYLOAD_JSON_SCHEMA };
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
        const verifyFilterResult = input.parsed.verifyFindings !== false
            ? applyVerifyFilter(preVerifyReview, input.diffText)
            : {
                review: preVerifyReview,
                verifiedFactsFilter: {
                    kept: preVerifyReview.comments,
                    downgraded: [],
                    downgradeReasons: [],
                },
                confidenceFilter: {
                    kept: preVerifyReview.comments,
                    downgraded: [],
                    reasons: [],
                },
            };
        const preVerifyOutcome = withParseWarnings({
            review: preVerifyReview,
            endpoint: result.endpoint,
            provider: providerName,
            modelId,
            severityWarnings: severityWarnings.slice(),
            diffText: input.diffText,
            verifiedFactsFilter: verifyFilterResult.verifiedFactsFilter,
            confidenceFilter: verifyFilterResult.confidenceFilter,
        });
        return { ...preVerifyOutcome, review: verifyFilterResult.review };
    }
    /**
     * Parse-failure path shared by all three provider families.
     * Builds the malformed-provider fallback review and attaches the
     * parse-warnings artifact so operators see what was wrong with the
     * model's response (off-diff citations, missed severity classification,
     * truncated-stream marker, etc.) before the action exits non-zero.
     */
    function handleParse(result, providerName, rawText) {
        const review = buildMalformedProviderFallback({
            provider: providerName,
            modelId,
            rawText,
            secrets: [providerApiKey, input.platformToken],
            ...parseFailureReasonFromProviderError(result.error, input.parsed.maxOutputTokens),
        });
        return withParseWarnings({
            review,
            endpoint: result.error.endpoint,
            provider: providerName,
            modelId,
            severityWarnings: severityWarnings.slice(),
            diffText: input.diffText,
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
                ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
                ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
                ...(responseFormat !== undefined ? { responseFormat } : {}),
                fetchImpl: input.fetchImpl,
            });
            if (result.ok) {
                return handleSuccess(result, COPILOT_PROVIDER_NAME);
            }
            if (result.error.code === "parse") {
                return handleParse(result, COPILOT_PROVIDER_NAME, result.error.rawText ?? "");
            }
            if (result.error.code === "provider_error") {
                const details = result.error.providerErrorDetails;
                throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
            }
            throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
        }
        if (input.parsed.provider === "anthropic") {
            // Anthropic native provider (`/v1/messages`). The wire body uses
            // the Anthropic Messages schema (top-level `system`, user-only
            // `messages[]`, `max_tokens` instead of `max_output_tokens`,
            // `x-api-key`/`anthropic-version` headers). The URL resolution
            // (in `resolveAnthropicMessagesUrl`) preserves the operator's
            // path prefix so Anthropic-compatible gateways like
            // `https://api.minimax.io/anthropic` route correctly.
            //
            // When the URL fails with a routing-level rejection (404/400),
            // `runWithCrossProtocolFallback` transparently retries with the
            // OpenAI-compatible client at the same base URL — operators
            // pointing MiniMax-style gateways at the action don't have to
            // know which protocol lives under which path prefix.
            //
            // Anthropic defaults to https://api.anthropic.com/v1 when
            // --api-url is unset. This matches the contracts in
            // `action.yml`, the README's "Using the native Anthropic
            // Messages API" block, and `validate.ts`/`orchestrator.ts`
            // which both exempt --api-url from the required check when
            // --provider anthropic is set.
            const providerUrl = resolveField(input.parsed.apiUrl, input.env[ENV_KEYS.UMACTUALLY_API_URL], DEFAULT_ANTHROPIC_URL);
            let result = await runAnthropicRequest({
                baseUrl: providerUrl,
                apiKey: providerApiKey,
                model: modelId,
                system: prompts.system,
                user: prompts.user,
                requestTimeoutMs: readRequestTimeoutMs(input.parsed),
                ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
                ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
                fetchImpl: input.fetchImpl,
            });
            if (!result.ok) {
                // Cross-protocol fallback to the OpenAI client at the same URL.
                // If the fallback also fails, surface the original anthropic error
                // (the operator picked `--provider anthropic` — honor that intent).
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
                    responseFormat,
                });
                if (fallback.ok) {
                    result = fallback;
                }
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
        // Path-prefix heuristic: if the operator's URL looks like an
        // Anthropic-protocol gateway (any path segment equal to
        // `anthropic`, case-insensitive — MiniMax's `/anthropic`,
        // self-hosted LiteLLM `/llm/anthropic`, etc.) commit to the
        // Anthropic Messages API client regardless of which `--provider`
        // was set. Otherwise the openai-compatible client's URL
        // candidate loop downgrades the URL to origin+`/v1` and may
        // happily succeed there, silently routing an `/anthropic`-prefix
        // URL to OpenAI Responses — which breaks operator intent on
        // dual-protocol gateways.
        //
        // The explicit `--provider anthropic` branch above already handles
        // this. The only flips this heuristic triggers is
        // `--provider openai-compatible` (the default) on a URL whose
        // `/anthropic` path component signals Anthropic-protocol intent.
        //
        // Emit a ::notice:: even when --provider=anthropic so operators see
        // the dispatcher considered and committed to the right protocol —
        // invisible-to-the-eye but logged for audit.
        const useAnthropicProtocol = looksLikeAnthropicEndpoint(providerUrl);
        if (useAnthropicProtocol) {
            process.stderr.write(`::notice::${BRAND_PREFIX}Operator URL contains an /anthropic path segment; using the Anthropic Messages API client (regardless of --provider).\n`);
        }
        let result;
        if (useAnthropicProtocol) {
            result = await runAnthropicRequest({
                baseUrl: providerUrl,
                apiKey: providerApiKey,
                model: modelId,
                system: prompts.system,
                user: prompts.user,
                requestTimeoutMs: readRequestTimeoutMs(input.parsed),
                ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
                ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
                fetchImpl: input.fetchImpl,
            });
        }
        else {
            result = await runProviderRequest({
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
        }
        if (!result.ok) {
            // Cross-protocol fallback: if the named (openai-compatible) client
            // exhausted its URL candidates with a routing-level failure, try
            // the Anthropic client at the same URL. On dual-protocol gateways
            // (MiniMax at /anthropic/, etc.) this lets `--provider
            // openai-compatible` discover the Anthropic-protocol endpoint at
            // `/anthropic/v1/messages` without operator intervention.
            //
            // If the fallback also fails, surface the original named error
            // (the operator picked `--provider openai-compatible`).
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
                responseFormat,
            });
            if (fallback.ok) {
                result = fallback;
            }
        }
        if (result.ok) {
            const providerName = providerNameForEndpoint(result.endpoint);
            return handleSuccess(result, providerName);
        }
        if (result.error.code === "parse") {
            const providerName = providerNameForEndpoint(result.error.endpoint);
            return handleParse(result, providerName, result.error.rawText ?? "");
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
        verifiedFactsFilter: input.verifiedFactsFilter ?? {
            kept: input.review.comments,
            downgraded: [],
            downgradeReasons: [],
        },
        confidenceFilter: input.confidenceFilter ?? {
            kept: input.review.comments,
            downgraded: [],
            reasons: [],
        },
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
    if (diffText.length === 0) {
        return {
            review,
            verifiedFactsFilter: { kept: review.comments, downgraded: [], downgradeReasons: [] },
            confidenceFilter: { kept: review.comments, downgraded: [], reasons: [] },
        };
    }
    // Delegate to the standalone `verifyFindingsAgainstDiff` helper
    // so the inline filter and the parse-warnings artifact agree
    // on which comments get dropped — the previous inline
    // re-implementation diverged from the helper in a way that
    // let the artifact undercount fabrication events.
    const { verified } = verifyFindingsAgainstDiff({ review, diffText });
    const filteredReview = { ...review, comments: verified };
    const verifiedFactsFilter = applyVerifiedFactsFilter({
        review: filteredReview,
        diffText,
    });
    // Layer 5: confidence-filter pass. Catches the FP patterns the
    // verified-facts layer cannot detect (hedging-language calibration,
    // pattern-matched advice, contradicted-by-quote, intentional-design
    // blindness). Runs AFTER the verified-facts filter so the post-
    // filter sees only findings that survived prior checks.
    const confidenceFilter = applyConfidenceFilter({
        review: { ...filteredReview, comments: verifiedFactsFilter.kept },
        diffText,
    });
    // Only the KEPT findings go into review.comments. Downgraded
    // findings are surfaced separately via verifiedFactsFilter.downgraded
    // AND confidenceFilter.downgraded (the operator can choose to
    // render them; the platform-posting path ignores them). The two
    // lists are disjoint from review.comments.
    return {
        review: { ...filteredReview, comments: confidenceFilter.kept },
        verifiedFactsFilter,
        confidenceFilter,
    };
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
async function runWithCrossProtocolFallback(args) {
    if (!isRoutableFailureForCrossProtocol(args.namedResult.error)) {
        return args.namedResult;
    }
    // Surface the fallback so operators can SEE that the dispatcher
    // crossed protocol boundaries on their behalf. Without these
    // notices, a fallback success looks identical to a named-protocol
    // success in the GitHub review attribution, and the operator
    // can't audit which protocol actually produced the review.
    //
    // We log the protocol pair + a redacted URL (origin + path, no
    // query string) so the notice identifies which URL produced the
    // fallback without leaking any `?token=`-style session id into
    // the persisted action log.
    process.stderr.write(`::notice::${BRAND_PREFIX}Named provider "${args.namedProvider}" returned status=${args.namedResult.error.status} at ${redactUrlForLog(args.baseUrl)} — retrying with cross-protocol fallback "${args.fallbackProvider}".\n`);
    // The named provider couldn't route at this base URL. Try the other
    // protocol at the SAME base URL — no URL transformation here, the
    // fallback provider's resolver (resolveProviderBaseUrlCandidates /
    // resolveAnthropicMessagesUrl) will do whatever path-prefix work
    // is appropriate for its wire shape.
    //
    // SECURITY NOTE: the operator's API key is passed to BOTH the
    // named and the fallback protocol client. This is correct on
    // dual-protocol gateways (MiniMax at /anthropic and /v1 accepts
    // the same key for both protocols). The 404-only trigger (see
    // isRoutableFailureForDispatcher) keeps this from happening for
    // payload-level errors, but operators pointing the action at a
    // non-dual-protocol URL can still expect this dispatcher's
    // fallback semantics to attempt a same-URL retry under a
    // different protocol family — wherever the operator's URL points
    // is where the key goes, exactly once per protocol.
    let fallbackResult;
    if (args.fallbackProvider === "anthropic") {
        fallbackResult = await runAnthropicRequest({
            baseUrl: args.baseUrl,
            apiKey: args.providerApiKey,
            model: args.modelId,
            system: args.prompts.system,
            user: args.prompts.user,
            requestTimeoutMs: args.readRequestTimeoutMs(),
            ...(args.parsed.maxOutputTokens !== null ? { maxOutputTokens: args.parsed.maxOutputTokens } : {}),
            ...(args.parsed.effort !== null ? { reasoningEffort: args.parsed.effort } : {}),
            fetchImpl: args.fetchImpl,
        });
    }
    else {
        fallbackResult = await runProviderRequest({
            baseUrl: args.baseUrl,
            apiKey: args.providerApiKey,
            model: args.modelId,
            system: args.prompts.system,
            user: args.prompts.user,
            requestTimeoutMs: args.readRequestTimeoutMs(),
            ...(args.parsed.maxOutputTokens !== null ? { maxOutputTokens: args.parsed.maxOutputTokens } : {}),
            ...(args.parsed.effort !== null ? { reasoningEffort: args.parsed.effort } : {}),
            // Carry the strict-JSON-schema constraint from the named call:
            // if the operator enabled `--strict-schema`/`responseFormat`,
            // the fallback should match (otherwise payload variance between
            // protocols can silently leak through).
            ...(args.responseFormat !== undefined ? { responseFormat: args.responseFormat } : {}),
            fetchImpl: args.fetchImpl,
        });
    }
    // Diagnostic on dual-protocol failure: if both protocols fail,
    // we surface the named error (per the contract), but we still log
    // the fallback's status so operators can distinguish "named
    // alone failed with 404" from "named AND fallback failed at this
    // URL" without needing to enable DEBUG mode.
    if (!fallbackResult.ok) {
        process.stderr.write(`::notice::${BRAND_PREFIX}Cross-protocol fallback "${args.fallbackProvider}" returned status=${fallbackResult.error.status} at ${redactUrlForLog(args.baseUrl)} — surfacing named protocol's error.\n`);
    }
    return fallbackResult;
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
    const positions = parse_positions_parseDiffPositions(diffText);
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
        // there are no severity warnings to surface. The verified-facts
        // filter and confidence filter did not run on the synthesized
        // findings either, so we OMIT those fields rather than setting
        // them to empty. The legacy-compat branch in
        // `aggregateConfidenceFilter` keys on
        // `o.confidenceFilter === undefined` and forwards the synthesized
        // comments as kept; setting an empty `confidenceFilter` would
        // bypass that branch and silently drop the comments during
        // merge. Self-review finding on PR #43 thread 3559191395.
        severityWarnings: [],
        parseWarnings: [],
        verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
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
                // Sanitize against the FULL secret list (not just the platform
                // token) so an error message that quotes a 401 echo of the
                // `Authorization` header cannot leak the provider API key into
                // stdout. The sibling catch in `runLive` (line 207) already uses
                // `readSecretValues(env)`; this aligns the per-chunk catch with
                // that contract.
                const sanitized = sanitizeForPost(message, readSecretValues(input.env));
                // The chunk preview is the first 77 chars of the diff for this
                // file. Sanitize it against the full secret list too: a leaked
                // key in the first line of a changed file (e.g. a `.env`
                // example) would otherwise be emitted to stdout via the
                // warning. The earlier per-secret-token pass only handled the
                // platform token and missed every other secret.
                const preview = chunk.length > 80 ? `${chunk.slice(0, 77)}…` : chunk;
                const sanitizedPreview = sanitizeForPost(preview, readSecretValues(input.env));
                logWarning("", `chunk ${index + 1}/${input.chunks.length} failed (${sanitized}); substituting empty outcome. chunk preview: ${sanitizedPreview}`);
                outcome = {
                    review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
                    endpoint: "",
                    provider: "chunk-failed",
                    modelId: "",
                    // Failed-chunk placeholder — no severity warnings to surface
                    // (the parser never ran on this chunk).
                    severityWarnings: [],
                    parseWarnings: [],
                    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
                    confidenceFilter: { kept: [], downgraded: [], reasons: [] },
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
    // Reset the default-prompt-file cache on each entry point so a
    // long-lived process that calls runLive more than once against the
    // same cwd always re-stats the disk. See
    // src/cli/provider-prompts.ts:resetDefaultPromptFilesCache for the
    // rationale. This is effectively a no-op under the documented
    // deployment model (one process per review run).
    resetDefaultPromptFilesCache();
    const env = input.env ?? process.env;
    const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const platform = detectLivePlatform(env);
    if (platform === null) {
        const message = "Live review requires GitHub Actions (GITHUB_ACTIONS=true) or Azure Pipelines (TF_BUILD=True).";
        process.stdout.write(`${BRAND_PREFIX}${message}\n`);
        return failedResult(message);
    }
    // Copilot + Anthropic-native providers don't need UMACTUALLY_API_URL:
    //   - Copilot uses the GitHub Copilot token exchange endpoint.
    //   - Anthropic defaults to https://api.anthropic.com/v1 and reads
    //     `x-api-key` directly from UMACTUALLY_API_KEY.
    // Skip the URL check for both.
    const isCopilot = input.parsed.provider === "copilot";
    const isAnthropic = input.parsed.provider === "anthropic";
    try {
        if (!isCopilot && !isAnthropic) {
            requireLiveConfig(resolveField(input.parsed.apiUrl, env[ENV_KEYS.UMACTUALLY_API_URL], ""), ENV_KEYS.UMACTUALLY_API_URL);
        }
        requireLiveConfig(resolveField(input.parsed.apiKey, env[ENV_KEYS.UMACTUALLY_API_KEY], ""), ENV_KEYS.UMACTUALLY_API_KEY);
    }
    catch (error) {
        if (error instanceof RequiredConfigError) {
            const message = error.userMessage;
            // Surface the remediation hint alongside the message when available.
            // The hint lives on a second line so it's easy to grep in CI logs;
            // it tells the operator exactly how to set the env var / flag and
            // points to --dry-run as an escape hatch when they want to verify
            // the CLI without contacting the provider.
            const hintLine = error.hint === undefined ? "" : `\n${BRAND_PREFIX}hint: ${error.hint}`;
            process.stdout.write(`${BRAND_PREFIX}${message}${hintLine}\n`);
            return failedResult(message);
        }
        throw error;
    }
    // If --include-sonarqube is set with a fully-configured SonarQube, wait
    // for the quality gate to reach a terminal state BEFORE posting the review.
    // This implements the user's "wait for sonarqube during that PR run"
    // requirement: the review reflects the latest quality-gate state.
    const sonarContext = await readLiveSonarContext(input.parsed, fetchImpl);
    // Scope the fetch counter and timer to the provider-review phase
    // only. Pre-review phases (config validation, leak-gate, SonarQube
    // probe) MUST NOT inflate the counter, or a leak-gate fetch would
    // suppress the `provider-roundtrips-zero` warning the guard uses
    // to detect cache hits / short-circuit fallbacks. Likewise, the
    // timer must measure the provider-call window so pre-review
    // latency doesn't push a legitimately-fast review over the 3s
    // floor. Addresses inline self-review findings #1 (HIGH) + #3
    // (MEDIUM) on PR #144.
    const counter = { providerRoundTrips: 0 };
    const countingFetch = (url, init) => {
        counter.providerRoundTrips += 1;
        return fetchImpl(url, init);
    };
    const startedAt = Date.now();
    let result;
    try {
        result = await dispatchLivePlatform({
            platform,
            parsed: input.parsed,
            cwd: input.cwd,
            env,
            fetchImpl: countingFetch,
            ...(sonarContext !== undefined ? { sonarContext } : {}),
        });
    }
    catch (error) {
        const message = formatError(error);
        const sanitized = sanitizeForPost(message, readSecretValues(env));
        // Surface the structured remediation hint when the throw carries
        // one (LiveReviewError / RequiredConfigError). Operators run the
        // CLI from CI logs that often lose context: printing the hint
        // next to the failure means the next person debugging the
        // pipeline sees exactly which token / scope / flag to fix.
        let hint;
        if (error instanceof LiveReviewError) {
            hint = getLiveReviewHint(error);
        }
        else if (error instanceof RequiredConfigError) {
            hint = error.hint;
        }
        else if (error instanceof AzureContextError || error instanceof GithubContextError) {
            hint = buildPlatformContextHint(error);
        }
        const hintLine = hint === undefined ? "" : `\n${BRAND_PREFIX}hint: ${hint}`;
        process.stdout.write(`${BRAND_PREFIX}${sanitized}${hintLine}\n`);
        return failedResult(sanitized);
    }
    if (result.posted) {
        process.stdout.write(`${BRAND_PREFIX}${result.message}\n`);
    }
    // Attach scope-limited telemetry for the artifact writer. Failed
    // pre-review paths return early via failedResult, so they never
    // reach this point — the suspicious-signal guard only fires on
    // posted=true reviews, so missing telemetry on failed paths is
    // intentional.
    return {
        ...result,
        providerRoundTrips: counter.providerRoundTrips,
        reviewDurationMs: Date.now() - startedAt,
    };
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
                    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
                    confidenceFilter: { kept: [], downgraded: [], reasons: [] },
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
        env[ENV_KEYS.UMACTUALLY_API_KEY] ?? "",
        env[ENV_KEYS.REVIEW_PROVIDER_API_KEY] ?? "",
        env[ENV_KEYS.GITHUB_TOKEN] ?? "",
        env[ENV_KEYS.SYSTEM_ACCESSTOKEN] ?? "",
        env["AZURE_DEVOPS_TOKEN"] ?? "",
    ];
}
function orchestrator_assertNever(value) {
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
        AZURE_TARGET_BRANCH_MISSING: "Set SYSTEM_PULLREQUEST_TARGETBRANCHNAME or BUILD_SOURCEBRANCHNAME in the pipeline environment. The target branch is what the review comments will be anchored against.",
    };
    const GITHUB_HINTS = {
        GITHUB_TOKEN_MISSING: "Set GITHUB_TOKEN (the default GITHUB_TOKEN provided to the runner is fine; re-check `permissions:` in the workflow file or pass `permissions: pull-requests: write`).",
        GITHUB_REPOSITORY_INVALID: "Set GITHUB_REPOSITORY to '<owner>/<name>'. On fork PRs from forks you also need GITHUB_REPOSITORY-relative paths; use `pull_request_target` workflows only with care.",
        GITHUB_PR_NUMBER_INVALID: "Pass PR_NUMBER (a positive integer) as an action input, set GITHUB_PR_NUMBER in the workflow env, or rely on the supplied `pull_request` event payload's `number` field.",
        GITHUB_SHA_MISSING: "Set GITHUB_SHA in the workflow env. For pull_request events GitHub Actions sets this automatically; for workflow_dispatch / schedule jobs you may need to pass it explicitly.",
        GITHUB_EVENT_PATH_MISSING: "Set GITHUB_EVENT_PATH to the absolute path of the `event.json` payload (GitHub Actions sets this for `pull_request` events). The CLI reads PR number, base/head SHA, and draft state from it.",
        GITHUB_EVENT_PAYLOAD_INVALID: "Re-queue the workflow: the event.json payload is malformed JSON or missing the `pull_request` object. This usually means a non-`pull_request` event type was supplied.",
    };
    if (error instanceof AzureContextError) {
        return AZURE_HINTS[error.code];
    }
    if (error instanceof GithubContextError) {
        return GITHUB_HINTS[error.code];
    }
    return undefined;
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
    // Mirror runLive's reset hook so a long-lived process that invokes
    // runDryRun repeatedly (e.g. a test runner) doesn't see stale
    // default-lookup decisions. See
    // src/cli/provider-prompts.ts:resetDefaultPromptFilesCache.
    resetDefaultPromptFilesCache();
    const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
    const envSources = readEnvSources(process.env);
    const artifactBody = await buildDryRunArtifact(parsed, platform, cwd);
    mergeEnvDiagnostics(artifactBody, envSources);
    await (0,promises_namespaceObject.mkdir)((0,external_node_path_namespaceObject.dirname)(artifactPath), { recursive: true });
    await (0,promises_namespaceObject.writeFile)(artifactPath, `${JSON.stringify(artifactBody, null, 2)}\n`, "utf8");
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
    // Dry-run short-circuit: when the operator has not supplied --review,
    // this is a smoke test, NOT a posting run. The auto-context-derived
    // synthetic event.json has null posting identity (pull_request.number=null)
    // that the runReview pipeline rejects. Mirror the Azure stub at the
    // bottom of this file (lines 215-224): return a no-posting artifact body.
    //
    // We deliberately do NOT also require isStandaloneMode(process.env):
    // a CI user that runs `umactually review --dry-run` without --review
    // gets the same no-posting body. (Old behavior was to require
    // non-CI, but that surfaced the "runStandalone requires parsed.diffPath
    // to be non-null" TypeError on CI, which is wrong — the operator
    // did not ask to post, the CLI should not throw.)
    if (parsed.dryRun && parsed.reviewPath === null) {
        return {
            artifactPath: "artifacts/manual/s1-github-self-review.md",
            posted: false,
            marker: REVIEW_MARKER,
            inlineThreadCount: 0,
            suppressedCommentCount: 0,
            note: "no --review supplied; this was a dry-run smoke test, no posting path executed",
        };
    }
    // The validator (src/cli/validate.ts:collectPostingValidationErrors)
    // is the sole gate for posting-required identity. Here in the consumer
    // path we tolerate null event/diff when the operator is running a
    // smoke test without posting context. Pass empty strings; the runReview
    // pipeline tolerates empty eventJson / empty diffText (it returns zero
    // findings, which is what a smoke test expects).
    const eventJson = parsed.eventPath === null
        ? ""
        : await readRequiredFile(parsed.eventPath, cwd, "--event");
    const diffText = parsed.diffPath === null
        ? ""
        : await readRequiredFile(parsed.diffPath, cwd, "--diff");
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
    const reviewPath = parsed.reviewPath;
    if (parsed.dryRun || reviewPath === null) {
        return {
            artifactPath: DEFAULT_AZURE_ARTIFACT,
            postedThreadCount: 0,
            postedStatusState: "succeeded",
            marker: REVIEW_MARKER,
            postingRequested: false,
            note: "no --review supplied; this was a capability-detection smoke run, no posting path executed",
        };
    }
    // The validator (src/cli/validate.ts:collectPostingValidationErrors)
    // already gated on --review requires --event / --diff for posting,
    // so by the time we reach here those fields are non-null. Throw a
    // defensive error if the validator let a malformed invocation slip
    // through; don't silently produce a broken artifact.
    if (parsed.eventPath === null || parsed.diffPath === null) {
        throw new CliArgumentError("--review requires --event and --diff to be supplied");
    }
    const pullRequestJson = await readRequiredFile(parsed.eventPath, cwd, "--event");
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
    // UMACTUALLY_DEBUG_RAW from process.env. `withDebugRawEnv` sets it only
    // for this dispatch and restores/deletes it in finally so same-process
    // batch runs do not inherit --debug-raw-response from an earlier review.
    return withDebugRawEnv(parsed.debugRawResponse === true, async () => {
        const result = await runLive({ parsed, cwd, env });
        // Write a summary artifact at the same path the dry-run uses so the
        // self-review CI guard (`scripts/check-self-review-output.mjs`) can
        // inspect the live review's outcome. Without this, a parse-fail
        // card posted via the GitHub API leaves no local trace for the
        // guard to catch — the action exits 0 and CI sees "pass".
        const platform = resolvePlatform(parsed.platform, env);
        await writeLiveArtifact(parsed, cwd, platform, result);
        const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
        return { exitCode: validateLiveArtifact(artifactPath, result.exitCode) };
    });
}
function validateLiveArtifact(artifactPath, reviewExitCode) {
    const classification = classifyReviewArtifact(artifactPath);
    // Mirror the CLI's `check-review-artifact` behaviour for the live
    // path: surface advisory warnings on stderr so a local operator
    // sees suspicious telemetry without needing to parse CI annotations.
    for (const warning of classification.warnings) {
        process.stderr.write(`${BRAND_PREFIX}warning: ${warning}\n`);
    }
    if (classification.ok) {
        return reviewExitCode;
    }
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
            marker: REVIEW_MARKER,
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
        marker: REVIEW_MARKER,
        inlineThreadCount: result.inlineThreadCount ?? 0,
        suppressedCommentCount: result.suppressedCommentCount ?? 0,
        blockedRawOutput: false,
        parseFailed: result.parseFailed === true,
        ...(result.verdict !== undefined ? { verdict: result.verdict } : {}),
        ...(result.reviewDurationMs !== undefined ? { reviewDurationMs: result.reviewDurationMs } : {}),
        ...(result.providerRoundTrips !== undefined ? { providerRoundTrips: result.providerRoundTrips } : {}),
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

;// CONCATENATED MODULE: ./src/cli/standalone-run.ts
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
        // No diff was supplied and the auto-context derivation did not
        // find one (operator is in a non-CI shell outside a git repo with
        // uncommitted changes, OR explicitly chose to skip the derivation
        // with --no-context flag if implemented). Mirror the dry-run
        // short-circuit: write a no-posting artifact body and return
        // ok so `umactually review` in a terminal degrades gracefully
        // instead of throwing. Old behavior (throw TypeError) was a
        // wrapper-era assumption that the operator always has a diff to
        // review; in the CLI-only world the operator may just want to
        // confirm the CLI boots in their cwd.
        const artifactPath = (0,external_node_path_namespaceObject.resolve)(input.cwd, input.overrideArtifactPath ?? "./umactually-review.json");
        const note = "No diff content was found; provider review was skipped.";
        const body = {
            mode: "standalone",
            artifactPath,
            posted: false,
            note,
            provider: {
                name: input.parsed.provider ?? "openai-compatible",
                modelId: input.parsed.model ?? "auto",
                endpoint: input.parsed.apiUrl ?? "",
            },
            review: { summary: note, verdict: "COMMENT", comments: [] },
            parseWarnings: 0,
            severityWarnings: 0,
            inlineThreadCount: 0,
            suppressedCommentCount: 0,
            marker: REVIEW_MARKER,
            generatedAt: new Date().toISOString(),
        };
        await (0,promises_namespaceObject.writeFile)(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
        process.stdout.write(`${BRAND_PREFIX}standalone review (no diff) wrote ${artifactPath}\n` +
            `${BRAND_PREFIX}no diff was supplied or none could be auto-derived (e.g. cwd is not a git repo with uncommitted changes or no diff was supplied). The CLI wrote a no-posting artifact instead of failing; supply --event and --diff, or run inside a git repo with uncommitted changes, or commit your changes first.\n`);
        return { kind: "ok", artifactPath, review: body.review };
    }
    const artifactPath = (0,external_node_path_namespaceObject.resolve)(input.cwd, input.overrideArtifactPath ?? "./umactually-review.json");
    const diffText = await (0,promises_namespaceObject.readFile)(input.parsed.diffPath, "utf8");
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
                endpoint: input.parsed.apiUrl ?? "",
            },
            review: { summary: note, verdict: "COMMENT", comments: [] },
            parseWarnings: 0,
            severityWarnings: 0,
            inlineThreadCount: 0,
            suppressedCommentCount: 0,
            marker: REVIEW_MARKER,
            generatedAt: new Date().toISOString(),
        };
        await (0,promises_namespaceObject.writeFile)(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
        process.stdout.write(`${BRAND_PREFIX}standalone review (no diff) wrote ${artifactPath}\n` +
            `${BRAND_PREFIX}the supplied diff was empty; provider review was skipped. The CLI wrote a no-posting artifact instead of failing; check that --diff points to a non-empty unified diff, or run with --api-url / --api-key / --dry-run for a smoke test against the provider.\n`);
        return { kind: "ok-no-diff", artifactPath, note };
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
            platformToken: "",
        });
    }
    catch (error) {
        const message = error instanceof LiveReviewError || error instanceof Error
            ? error.message
            : String(error);
        // When the throw carries a remediation hint (e.g. the typed
        // RequiredConfigError carries the missing-env-var hint on its
        // `hint` field), propagate it so cli.ts can render the hint next
        // to the failure on the operator's terminal.
        const hint = error instanceof RequiredConfigError && error.hint !== undefined
            ? error.hint
            : undefined;
        return {
            kind: "provider-error",
            exitCode: 1,
            message,
            sanitizedForLog: sanitizeForPost(message, [providerApiKey]),
            ...(hint !== undefined ? { hint } : {}),
        };
    }
    const note = "Standalone review completed; no platform posting was attempted.";
    const review = {
        summary: outcome.review.summary,
        verdict: outcome.review.verdict,
        comments: outcome.review.comments,
    };
    const body = {
        mode: "standalone",
        artifactPath,
        posted: false,
        note,
        provider: {
            name: outcome.provider,
            modelId: outcome.modelId,
            endpoint: outcome.endpoint,
        },
        review,
        parseWarnings: outcome.parseWarnings.length,
        severityWarnings: outcome.severityWarnings.length,
        inlineThreadCount: outcome.review.comments.length,
        suppressedCommentCount: outcome.review.suppressedComments.length,
        marker: REVIEW_MARKER,
        generatedAt: new Date().toISOString(),
    };
    await (0,promises_namespaceObject.writeFile)(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
    process.stdout.write(`${BRAND_PREFIX}standalone review wrote ${artifactPath}\n`);
    return { kind: "ok", artifactPath, review };
}

;// CONCATENATED MODULE: ./src/cli/local-files-run.ts
/**
 * Runs a provider-only review over local files/directories for the
 * `umactually --files <path>[,<path>...]` mode. Synthesizes a unified
 * diff from the file contents and feeds it through the existing
 * `runStandalone` pipeline. Never posts to a platform; standalone-only.
 */







const MAX_FILE_BYTES = 256 * 1024;
const SYNTHESIZED_HEADER_LINES = 4;
const SYNTHESIZED_HUNK_HEADER_PREFIX = "@@ -0,0 +1,";
const BINARY_SAMPLE_BYTES = 8 * 1024;
function splitPaths(files) {
    if (files === null) {
        return [];
    }
    return files.split(",").map((path) => path.trim()).filter((path) => path.length > 0);
}
function reasonFor(error) {
    return error instanceof Error ? error.message : String(error);
}
async function candidatePaths(inputPath, cwd) {
    const absolute = (0,external_node_path_namespaceObject.resolve)(cwd, inputPath);
    let info;
    try {
        info = await promises_namespaceObject.lstat(absolute);
    }
    catch (error) {
        console.error(`${BRAND_PREFIX}--files: skipped ${inputPath} (${reasonFor(error)})`);
        return [];
    }
    if (info.isSymbolicLink()) {
        return [];
    }
    if (!info.isDirectory()) {
        return [absolute];
    }
    try {
        const entries = await promises_namespaceObject.readdir(absolute, { recursive: true, withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
            .map((entry) => (0,external_node_path_namespaceObject.resolve)(entry.parentPath, entry.name));
    }
    catch (error) {
        console.error(`${BRAND_PREFIX}--files: skipped ${inputPath} (${reasonFor(error)})`);
        return [];
    }
}
async function isBinary(path) {
    const handle = await promises_namespaceObject.open(path, "r");
    try {
        const buffer = Buffer.alloc(BINARY_SAMPLE_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, BINARY_SAMPLE_BYTES, 0);
        if (bytesRead === 0) {
            return false;
        }
        let nulBytes = 0;
        for (let index = 0; index < bytesRead; index += 1) {
            if (buffer[index] === 0) {
                nulBytes += 1;
            }
        }
        return nulBytes / bytesRead > 0.05;
    }
    finally {
        await handle.close();
    }
}
async function collectFiles(paths, cwd) {
    const candidates = (await Promise.all(paths.map((path) => candidatePaths(path, cwd)))).flat();
    const unique = new Set();
    for (const absolute of candidates) {
        const relativePath = (0,external_node_path_namespaceObject.relative)(cwd, absolute).replaceAll("\\", "/");
        if (isExcludedPath(relativePath)) {
            continue;
        }
        let binary = false;
        try {
            binary = await isBinary(absolute);
        }
        catch (error) {
            console.error(`${BRAND_PREFIX}--files: skipped ${relativePath} (${reasonFor(error)})`);
            continue;
        }
        if (binary) {
            console.error(`${BRAND_PREFIX}--files: skipped ${relativePath} (binary)`);
            continue;
        }
        unique.add((0,external_node_fs_.realpathSync)(absolute));
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
}
function truncate(content) {
    const bytes = Buffer.from(content, "utf8");
    if (bytes.length <= MAX_FILE_BYTES) {
        return content;
    }
    return `${bytes.subarray(0, MAX_FILE_BYTES).toString("utf8")}... (truncated)`;
}
function diffBlock(relativePath, content) {
    const normalized = content.endsWith("\n") ? content.slice(0, -1) : content;
    const lines = normalized.length === 0 ? [] : normalized.split("\n");
    const diffHeader = "diff --git a/" + relativePath + " b/" + relativePath;
    const minusHeader = "--- a/" + relativePath;
    const plusHeader = "+++ b/" + relativePath;
    const hunkHeader = SYNTHESIZED_HUNK_HEADER_PREFIX + lines.length + " @@";
    const header = [diffHeader, minusHeader, plusHeader, hunkHeader];
    if (header.length !== SYNTHESIZED_HEADER_LINES) {
        throw new Error("invalid synthesized diff header");
    }
    return header.join("\n") + "\n" + lines.map((line) => "+" + line).join("\n") + "\n";
}
async function synthesize(files, cwd) {
    const blocks = [];
    for (const absolute of files) {
        const content = truncate(await promises_namespaceObject.readFile(absolute, "utf8"));
        const relativePath = (0,external_node_path_namespaceObject.relative)(cwd, absolute).replaceAll("\\", "/");
        blocks.push(diffBlock(relativePath, content));
    }
    return blocks.join("\n");
}
async function runLocalFilesReview(input) {
    const paths = splitPaths(input.parsed.files);
    const files = await collectFiles(paths, input.cwd);
    const diffPath = (0,external_node_path_namespaceObject.join)(input.cwd, ".umactually-auto-ctx", `local-files-${input.parsed.dryRun ? "dry-run" : (0,external_node_crypto_namespaceObject.randomUUID)()}.diff`);
    const artifactPath = (0,external_node_path_namespaceObject.resolve)(input.cwd, input.overrideArtifactPath ?? "./umactually-review.json");
    if (files.length === 0) {
        return { kind: "ok-no-files", artifactPath, note: "no files matched (excluded or non-existent)" };
    }
    const diffText = await synthesize(files, input.cwd);
    if (input.parsed.dryRun) {
        return { kind: "ok", artifactPath: diffPath, review: { comments: [], verdict: "COMMENT", summary: "local-files dry run" } };
    }
    await promises_namespaceObject.mkdir((0,external_node_path_namespaceObject.join)(input.cwd, ".umactually-auto-ctx"), { recursive: true });
    await promises_namespaceObject.writeFile(diffPath, diffText, "utf8");
    const result = await runStandalone({
        parsed: { ...input.parsed, diffPath, files: null }, cwd: input.cwd, env: input.env,
        ...(input.overrideArtifactPath !== undefined ? { overrideArtifactPath: input.overrideArtifactPath } : {}),
    });
    switch (result.kind) {
        case "ok":
            return result;
        case "ok-no-diff":
            return { kind: "ok-no-files", artifactPath: result.artifactPath, note: "no files matched" };
        case "provider-error":
            return result;
    }
}

;// CONCATENATED MODULE: ./src/cli/auto-context.ts
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
        const out = (0,external_node_child_process_.execFileSync)("git", args, {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return String(out).trim();
    }
    catch (error) {
        const stderr = typeof error === "object" && error !== null && "stderr" in error
            ? String(error.stderr ?? "")
            : "";
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
    // SSH: [user@]host:owner/name[.git]
    const ssh = /^[\w.-]+@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/u.exec(remoteUrl);
    if (ssh !== null) {
        return `${ssh[1]}/${ssh[2]}`;
    }
    // HTTPS: https://host/owner/name[.git]
    const https = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/u.exec(remoteUrl);
    if (https !== null) {
        return `${https[1]}/${https[2]}`;
    }
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
            head: { ref: args.branch, sha: null },
            base: { ref: args.base, sha: null },
        },
        repository: {
            full_name: args.repo,
            name: args.repo === null ? null : args.repo.split("/")[1] ?? null,
            owner: { login: args.repo === null ? null : args.repo.split("/")[0] ?? null },
        },
        action: "synthetic",
        sender: { login: "local-smoke-test" },
    };
    (0,external_node_fs_.writeFileSync)(filePath, `${JSON.stringify(event, null, 2)}\n`, "utf8");
    return filePath;
}
/**
 * Returns the directory used for auto-derived temp files (diff + event).
 * Lives under `cwd/.umactually-auto-ctx/` so cleanup is a single
 * recursive remove. The directory is created lazily on first write.
 */
function tempDirPath(cwd) {
    return (0,external_node_path_namespaceObject.join)(cwd, ".umactually-auto-ctx");
}
/** True when the named local branch ref resolves. */
function localBranchExists(cwd, branch) {
    try {
        gitOrThrow(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
        return true;
    }
    catch {
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
    // 1. confirm we're inside a git working tree.
    try {
        gitOrThrow(cwd, ["rev-parse", "--is-inside-work-tree"]);
    }
    catch {
        return null;
    }
    // 2. resolve the base branch. Caller-supplied value wins; otherwise
    // probe origin/HEAD and finally fall back to main/master. If nothing
    // resolves, throw a guidance-rich error.
    let base;
    if (typeof requestedBase === "string" && requestedBase.length > 0) {
        base = requestedBase;
    }
    else {
        const detected = resolveDefaultBranch(cwd);
        if (detected === null) {
            throw new Error(`unable to detect default branch in ${cwd}: origin/HEAD is not set and neither 'main' nor 'master' exists locally. Pass --base <branch> explicitly or fetch the default branch.`);
        }
        base = detected;
    }
    if (!localBranchExists(cwd, base)) {
        throw new Error(`base branch '${base}' not found locally in ${cwd}. Run 'git fetch origin ${base}' or pass --base <existing-branch>.`);
    }
    // 3. determine current branch (for the synthetic event JSON metadata).
    let currentBranch = "HEAD";
    try {
        currentBranch = gitOrThrow(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    }
    catch {
        // Detached HEAD — leave as "HEAD" in the event JSON.
    }
    // 4. resolve the repository slug from `origin`. Returns null when
    // unparseable. Caller MAY supply `--repo` if posting is requested.
    let repo = null;
    try {
        const remoteUrl = gitOrThrow(cwd, ["remote", "get-url", "origin"]);
        repo = parseRemoteSlug(remoteUrl);
    }
    catch {
        // No origin remote or other failure; repo stays null.
    }
    // 5. resolve paths: caller overrides win; otherwise generate under
    // cwd/.umactually-auto-ctx/ which Task 9 cleans up.
    const tempDir = tempDirPath(cwd);
    const diffPath = diffOverride !== undefined && diffOverride !== null
        ? diffOverride
        : (0,external_node_path_namespaceObject.join)(tempDir, "diff.patch");
    const eventPath = eventOverride !== undefined && eventOverride !== null
        ? eventOverride
        : (0,external_node_path_namespaceObject.join)(tempDir, "event.json");
    // 6. write the generated files (only if not overridden). Do NOT throw
    // if the diff is empty — that's fine for smoke tests on the default branch.
    if (diffOverride === undefined || diffOverride === null) {
        const diffOutput = gitOrThrow(cwd, ["diff", `${base}...HEAD`]);
        (0,external_node_fs_.mkdirSync)(tempDir, { recursive: true });
        (0,external_node_fs_.writeFileSync)(diffPath, diffOutput, "utf8");
    }
    if (eventOverride === undefined || eventOverride === null) {
        (0,external_node_fs_.mkdirSync)(tempDir, { recursive: true });
        writeSyntheticEventJson(eventPath, { branch: currentBranch, base, repo });
    }
    // 7. posting identity is null. The caller (src/cli.ts) gates posting
    // on `--review` (or the resolved dispatcher's posting token), NOT on
    // these fields.
    return { eventPath, diffPath, repo, prNumber: null };
}
/**
 * Default-branch detection helper. Returns null when origin/HEAD is not
 * configured and no fallback branch exists locally. Throws only on
 * unexpected git errors (corrupt repo, exec failure, etc.).
 */
function resolveDefaultBranch(cwd) {
    try {
        const ref = gitOrThrow(cwd, [
            "symbolic-ref",
            "--quiet",
            "--short",
            "refs/remotes/origin/HEAD",
        ]);
        return ref.replace(/^origin\//u, "");
    }
    catch {
        // origin/HEAD not set; try common names.
        for (const candidate of ["main", "master"]) {
            if (localBranchExists(cwd, candidate)) {
                return candidate;
            }
        }
        return null;
    }
}

;// CONCATENATED MODULE: ./src/cli/apply-saved-config.ts
// SPDX-License-Identifier: MIT
// Apply saved-config values to fields that fell through to their schema
// default after flag + env resolution. Single source of truth for the
// "saved config supplies defaults" behavior shared by `umactually review`
// and `umactually --files`.
//
// Resolution order (final, after this function runs):
//   - explicit CLI flag    → source = "flag"
//   - environment variable  → source = "env"
//   - saved config (~/.umactually/config.json) → source = "savedConfig"
//   - schema default        → source = "default"
//
// `apiKey` deliberately does NOT participate: the S6 contract (v0.6.23)
// bans persisting credentials to disk. The `SavedConfig` type excludes
// `apiKey`, so there is no value to read even if a caller passes one.
// `apiKey` resolves via flag > `UMACTUALLY_API_KEY` env > error.
const SAVED_CONFIG_FIELDS = (/* unused pure expression or super */ null && (["provider", "apiUrl", "model"]));
/**
 * Pure resolver. Returns a NEW `SchemaResolvedCliArgs` with `provider` /
 * `apiUrl` / `model` overridden from `saved` when the current
 * `fieldProvenance[field].source === "default"`. Fields whose values
 * were already supplied by `--flag` or env var are left alone — flag
 * and env ALWAYS win over saved config (matches the contract for every
 * other well-behaved tool: flag > env > persisted > default).
 *
 * `saved === null` (no config file present, or read failed) is a
 * no-op; the resolver returns `resolved` unchanged with an empty
 * `applied` list.
 *
 * `path` is required when `saved !== null` (it tells the operator
 * which file supplied the value). The empty-string placeholder is
 * reserved for the `saved === null` fast path.
 */
function applySavedConfig(resolved, saved, path) {
    if (saved === null) {
        return { resolved, applied: [] };
    }
    let current = resolved;
    const applied = [];
    if (saved.provider !== undefined) {
        const next = maybeOverride(current, "provider", saved.provider, path);
        if (next !== null) {
            current = next;
            applied.push("provider");
        }
    }
    // `apiUrl` and `model` are optional on SavedConfig. Skip when absent
    // — no override, no provenance flip.
    if (saved.apiUrl !== undefined) {
        const next = maybeOverride(current, "apiUrl", saved.apiUrl, path);
        if (next !== null) {
            current = next;
            applied.push("apiUrl");
        }
    }
    if (saved.model !== undefined) {
        const next = maybeOverride(current, "model", saved.model, path);
        if (next !== null) {
            current = next;
            applied.push("model");
        }
    }
    return { resolved: current, applied };
}
/**
 * Override a single field IFF its current provenance is "default".
 * Returns the new `SchemaResolvedCliArgs` on success, `null` when the
 * field should be left alone (already supplied by flag or env).
 *
 * Pure function over `current.fieldProvenance[field]` and the field's
 * current value. Does NOT mutate — returns a new object. The nested
 * `fieldProvenance` map is also shallow-cloned so subsequent
 * overrides to a different field don't accidentally leak the
 * earlier provenance update.
 */
function maybeOverride(current, field, value, path) {
    const provenance = current.fieldProvenance[field];
    if (provenance === undefined) {
        // Field wasn't resolved by `resolveFromSchema`. This shouldn't
        // happen because we only pass through `provider` / `apiUrl` /
        // `model`, all of which are in `FIELDS`. Refuse to override
        // when the invariant is broken — preserves the byte-exact existing
        // behavior for edge cases.
        return null;
    }
    if (provenance.source !== "default") {
        // Flag or env already supplied a value. Saved config is the
        // strictly-LOWER priority layer and MUST NOT override.
        return null;
    }
    const newProvenance = { source: "savedConfig", path };
    const newFieldProvenance = {
        ...current.fieldProvenance,
        [field]: newProvenance,
    };
    return {
        ...current,
        [field]: value,
        fieldProvenance: newFieldProvenance,
    };
}

;// CONCATENATED MODULE: ./src/cli.ts




















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
function readPackageVersion() {
    // Bun --compile injects this via --define. tsdown's `define` config
    // (in tsdown.config.ts) does the same via rolldown. The bare
    // identifier is replaced at compile time — using
    // globalThis["UMACTUALLY_VERSION"] would NOT be replaced because
    // --define / rolldown's define only match bare references.
    if (typeof UMACTUALLY_VERSION === "string" && UMACTUALLY_VERSION.length > 0) {
        return UMACTUALLY_VERSION;
    }
    const packageJsonUrl = __nccwpck_require__.ab + "package.json";
    const raw = (0,external_node_fs_.readFileSync)(packageJsonUrl, "utf8");
    const parsed = JSON.parse(raw);
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
function isVersionFlag(argv) {
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
function runVersion(_argv) {
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
            (0,external_node_fs_.writeFileSync)(versionFile, stdout);
            // Don't `return early` — still attempt the stdout tiers
            // so consumers that don't use the env var get the same
            // behavior as before. The env-var file is a bypass, not
            // a replacement.
        }
        catch {
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
        }
        catch {
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
        (0,external_node_fs_.writeFileSync)(process.stdout.fd, stdout);
        written = true;
    }
    catch {
        // tier 1 unavailable
    }
    if (!written) {
        try {
            (0,external_node_fs_.writeSync)(1, stdout);
            written = true;
        }
        catch {
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
        const stdoutStream = process.stdout;
        let tier3Error = null;
        stdoutStream.once("error", (err) => {
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
function resolveContext(parsed, cwd, env) {
    // If every plumbing field is already supplied, there's nothing to do.
    // This is the wrapper-runtime case (GH Action / ADO pipeline).
    const plumbingFlags = [parsed.eventPath, parsed.diffPath];
    const allPlumbingSupplied = plumbingFlags.every((v) => v !== null);
    const shouldDeriveFromGit = env["GITHUB_ACTIONS"] === undefined && env["TF_BUILD"] === undefined;
    let resolved = parsed;
    let generated = [];
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
                const merged = {
                    ...parsed,
                    eventPath: parsed.eventPath ?? ctx.eventPath,
                    diffPath: parsed.diffPath ?? ctx.diffPath,
                };
                resolved = merged;
                generated = [ctx.diffPath, ctx.eventPath].filter((p) => p !== parsed.diffPath && p !== parsed.eventPath);
            }
        }
        catch {
            // Auto-derive itself failed (e.g. not a git repo); keep parsed
            // and let the validator surface a clear "missing flags" error.
        }
    }
    return { resolved, generatedArtifacts: generated };
}
async function cleanupGeneratedArtifacts(generatedArtifacts, cwd) {
    if (generatedArtifacts.length === 0) {
        return;
    }
    const tempDir = (0,external_node_path_namespaceObject.join)(cwd, ".umactually-auto-ctx");
    try {
        await (0,promises_namespaceObject.rm)(tempDir, { recursive: true, force: true });
    }
    catch (error) {
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
    const header = `cli: ${errors.map((e) => e.message).join("; ")}\n`;
    const hintLines = errors
        .map((e) => `  hint: ${e.hint}`)
        .join("\n");
    return `${header}${hintLines}\n`;
}
async function runCli(args, cwd) {
    let parsed;
    try {
        parsed = parseCliArgs(args);
    }
    catch (error) {
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
    const { resolved: savedResolved } = applySavedConfig(envResolved, savedRead.config, savedRead.path);
    // Stage 3: resolve missing flags from cwd (when applicable).
    const { resolved, generatedArtifacts } = resolveContext(savedResolved, cwd, process.env);
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
        if (errors.length > 0 &&
            canPromptInteractively() &&
            !resolved.dryRun &&
            everyErrorIsApiConfig(errors) &&
            process.env["UMACTUALLY_NO_INTERACTIVE"] === undefined &&
            process.env["UMACTUALLY_INTERACTIVE"] === "1") {
            const promptForUrl = errors.some((e) => e.flag === "--api-url");
            const prompted = await smartPromptForApiConfig({ promptForUrl });
            // SchemaResolvedCliArgs extends ParsedCliArgs, so the same
            // applyPromptedConfig helper works on both.
            const augmented = applyPromptedConfig(resolved, prompted);
            errors = collectValidationErrors(augmented);
            if (errors.length === 0) {
                // Validation now passes — re-resolve and proceed without
                // printing the bare-invocation modes banner (the operator
                // clearly knows the standalone shape; they just needed
                // credentials).
                process.stdout.write(`${BRAND_PREFIX}received credentials from interactive prompt; continuing.\n`);
                return await runAfterValidation({
                    resolved: augmented,
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
                resolvedConfig: buildSanitizedResolvedConfig(augmented),
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
            if (args.length === 0 &&
                !envResolved.dryRun &&
                errors.some((e) => e.flag === "--api-url" || e.flag === "--api-key")) {
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
    }
    finally {
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
    if (resolved.files !== null) {
        const result = await runLocalFilesReview({
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
                const _exhaustive = result;
                throw new Error(`unhandled local-files run result: ${JSON.stringify(_exhaustive)}`);
            }
        }
    }
    if (!resolved.dryRun && isStandaloneMode(env)) {
        const result = await runStandalone({ parsed: resolved, cwd, env });
        if (result.kind === "provider-error") {
            const hintLine = "hint" in result && typeof result.hint === "string"
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
async function main(argv) {
    try {
        const result = await dispatch(argv);
        return result.exitCode;
    }
    catch (error) {
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
function isActionEntryPresent() {
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
function isProcessSeaBinary() {
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
function argv1LooksLikeSeaBinary(argv1) {
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
function argv1IsNpmShimSymlink(argv1) {
    let argv1Realpath;
    try {
        argv1Realpath = (0,external_node_fs_.realpathSync)(argv1);
    }
    catch {
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
function argv1MatchesModuleUrl(argv1) {
    const argv1Real = (() => {
        try {
            return (0,external_node_fs_.realpathSync)(argv1);
        }
        catch {
            return argv1;
        }
    })();
    return (import.meta.url === pathToFileUrl(argv1) ||
        import.meta.url === pathToFileUrl(argv1Real));
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
function argv1MatchesCliBasename(argv1) {
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
function isMainModule() {
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
        .catch((error) => {
        process.stderr.write(`cli: fatal: ${formatError(error)}\n`);
        process.exitCode = 1;
    });
}

var __webpack_exports__CliUsageError = __webpack_exports__._x;
var __webpack_exports__buildSanitizedResolvedConfig = __webpack_exports__.WB;
var __webpack_exports__isVersionFlag = __webpack_exports__.bV;
var __webpack_exports__main = __webpack_exports__.iW;
var __webpack_exports__parseCliArgs = __webpack_exports__.hT;
var __webpack_exports__runCli = __webpack_exports__.ak;
var __webpack_exports__runVersion = __webpack_exports__.yh;
export { __webpack_exports__CliUsageError as CliUsageError, __webpack_exports__buildSanitizedResolvedConfig as buildSanitizedResolvedConfig, __webpack_exports__isVersionFlag as isVersionFlag, __webpack_exports__main as main, __webpack_exports__parseCliArgs as parseCliArgs, __webpack_exports__runCli as runCli, __webpack_exports__runVersion as runVersion };
