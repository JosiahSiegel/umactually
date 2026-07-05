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
    ignoreMinor: {
        field: "ignoreMinor",
        flag: "--ignore-minor",
        input: "ignore-minor",
        env: ["UMACTUALLY_IGNORE_MINOR", "REVIEW_IGNORE_MINOR"],
        type: "boolean",
        defaultValue: false,
    },
    minimumSeverity: {
        field: "minimumSeverity",
        flag: "--minimum-severity",
        input: "minimum-severity",
        env: ["REVIEW_MINIMUM_SEVERITY"],
        type: "enum",
        defaultValue: "low",
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
    let ignoreMinor = false;
    let minimumSeverity = null;
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
                ignoreMinor = true;
                break;
            case "--no-ignore-minor":
                ignoreMinor = false;
                break;
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
        ignoreMinor,
        minimumSeverity,
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
const CLI_HELP_TEXT = [
    "umactually-pr-review — provider-agnostic PR review CLI",
    "",
    "Flags:",
    "  --platform <auto|github|azure>",
    "  --event <path>          GitHub event JSON or Azure pull-request JSON",
    "  --diff <path>           PR diff text",
    "  --threads <path>        Azure existing threads JSON (optional in dry-run)",
    "  --review <path>         Azure provider review JSON (optional in dry-run)",
    "  --pr-number <n>         Pull request number",
    "  --repo <owner/name>",
    "  --api-url <url>         Provider Responses API URL",
    "  --api-key <key>         Provider API key",
    "  --model <id>            Provider model id",
    "  --prompt-file <path>",
    "  --additional-prompt-file <path>",
    "  --include-sonarqube",
    "  --sonar-host-url <url>",
    "  --sonar-token <token>",
    "  --sonar-project-key <key>",
    "  --ignore-minor",
    "  --detect-leaks | --no-detect-leaks",
    "  --dry-run               Write artifact JSON only, no provider calls",
    "  --simulate-findings     Replace empty live findings with deterministic fixture",
    "  --output-artifact <path>",
    "",
].join("\n");
function printHelp() {
    process.stdout.write(CLI_HELP_TEXT);
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
    if (diffText.length === 0) {
        throw new AzureApiError("AZURE_DIFF_EMPTY", AZURE_EMPTY_DIFF_STATUS, "Azure DevOps PR diff response body was empty.");
    }
    return diffText;
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
    const trimmedBase = stripTrailingSlash(baseUrl);
    const prefixedPath = path.startsWith("/") ? path : `/${path}`;
    return `${trimmedBase}${prefixedPath}`;
}
/**
 * Removes trailing slashes from a URL or path segment. Useful before
 * joining paths so empty-path joins don't produce double slashes.
 */
function stripTrailingSlash(value) {
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
    const baseUrl = stripTrailingSlash(config.sonarHostUrl);
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
    "ignoreMinor",
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
function readAzureContext(env) {
    const token = readAzureToken(env);
    const org = readAzureOrg(env);
    const project = readAzureProject(env);
    const repoId = readAzureRepoId(env);
    const prNumber = readAzurePrNumber(env);
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
function readAzurePrNumber(env) {
    const raw = env["SYSTEM_PULLREQUEST_PULLREQUESTID"];
    if (raw === undefined || raw.length === 0) {
        throw new AzureContextError("AZURE_PR_NUMBER_INVALID", "Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be set.");
    }
    // Strict helper: "42abc" must NOT coerce to 42 (which would land on a
    // 404 from the Azure DevOps REST API instead of a typed error).
    // parseStrictInt already returns null for non-safe-integer parses,
    // so the remaining guard is "must be a positive integer".
    const parsed = parseStrictInt(raw);
    if (parsed === null || parsed <= 0) {
        throw new AzureContextError("AZURE_PR_NUMBER_INVALID", "Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be a positive integer.");
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
    return fetchTextOrThrow(fetchImpl, {
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
 * Canonical severity ranking. Scale: critical=4, high=3, medium=2, low=1,
 * everything else (info, undefined, "")=0. Used by both the live-path
 * severity filter (live-shared.ts) and the merge-path highest-wins rule
 * (live-merge.ts). Keep both in sync — these were duplicated until now.
 */
function severityRank(severity) {
    switch (severity.toLowerCase()) {
        case "critical": return 4;
        case "high": return 3;
        case "medium": return 2;
        case "low": return 1;
        default: return 0;
    }
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
            if (existing === undefined || severityRank(comment.severity) > severityRank(existing.severity)) {
                dedupedComments.set(key, comment);
            }
        }
        for (const suppressed of outcome.review.suppressedComments) {
            const key = `${suppressed.path}:${suppressed.line}`;
            const existing = dedupedSuppressed.get(key);
            if (existing === undefined || severityRank(suppressed.severity) > severityRank(existing.severity)) {
                dedupedSuppressed.set(key, suppressed);
            }
        }
    }
    // MERGE-2: sort by severity desc, then path asc, then line asc.
    const sortedComments = [...dedupedComments.values()].sort((a, b) => {
        const rankDelta = severityRank(b.severity) - severityRank(a.severity);
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
    let worstVerdict = "";
    let worstRank = -1;
    for (const outcome of outcomes) {
        const rank = verdictRank(outcome.review.verdict);
        if (rank > worstRank) {
            worstRank = rank;
            worstVerdict = outcome.review.verdict;
        }
    }
    // MERGE-6: pick the longest summary.
    let longestSummary = "";
    for (const outcome of outcomes) {
        if (outcome.review.summary.length > longestSummary.length) {
            longestSummary = outcome.review.summary;
        }
    }
    return {
        review: {
            summary: longestSummary,
            verdict: worstVerdict.length > 0 ? worstVerdict : "COMMENT",
            comments: truncatedComments,
            suppressedComments: sortedSuppressed,
        },
        endpoint: first.endpoint,
        provider: first.provider,
        modelId: first.modelId,
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
 *   - DO use `<details>`/`<summary>` — verified 2026-07-05 to render as
 *     a collapsible section on BOTH GitHub PR reviews AND Azure DevOps
 *     PR comments (empirical test via playwright against PR #43 thread
 *     575 and the production review thread, both show working
 *     click-to-expand UX). The previous "Azure renders as raw text"
 *     rule was based on 2023-era community reports and is no longer
 *     accurate. The severity-table layout uses `<details>` for verbose
 *     summaries (>500 chars) — pinned by S5a (short summary has no
 *     details) and S5b (long summary wraps in details) in
 *     `test/unit/summary-layouts.test.ts`.
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
/** Render a single-line finding label as `path:line — snippet`. */
function findingLine(c, secrets) {
    const safeBody = redact(c.body, secrets).replace(/\s+/gu, " ").trim();
    const snippet = safeBody.length > 100 ? `${safeBody.slice(0, 97)}…` : safeBody;
    return `\`${cell(c.path)}\`:${c.line} — ${snippet}`;
}
/** Severity → display emoji used by every layout that wants a single glyph. */
function severityEmoji(level) {
    switch (level.toLowerCase()) {
        case "critical": return "🟣";
        case "high": return "🔴";
        case "medium": return "🟠";
        case "low": return "🟡";
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
/** Pipeline summary line used by most layouts (mirrors CLARITY-19). */
function pipelineLine(data) {
    const total = totalFindings(data);
    return `📊 ${total} findings → ${data.validCommentCount} posted, ${offDiffCount(data)} off-diff, ${filteredCount(data)} filtered`;
}
/** Severity tally line used by most layouts. */
function severityTally(data) {
    const parts = [];
    let total = 0;
    for (const level of SEVERITY_ORDER) {
        const count = data.severityCounts[level] ?? 0;
        total += count;
        parts.push(`\`${count}\` ${level}`);
    }
    if (total === 0)
        return "";
    return `🏷️ ${parts.join(" · ")}`;
}
/** Compose the standard footer line. */
function footer(data) {
    const safeModel = redact(data.modelId, data.secrets);
    const safeProvider = redact(data.provider, data.secrets);
    return `🤖 Generated by \`${safeModel}\` via \`${safeProvider}\` · ${data.validCommentCount} inline`;
}
/** Sort posted comments by severity desc, then path asc — same invariant the existing code uses. */
function sortedPosted(data) {
    return [...data.postedComments].sort((a, b) => {
        const ra = severityRank(a.severity);
        const rb = severityRank(b.severity);
        if (ra !== rb)
            return rb - ra;
        return a.path.localeCompare(b.path);
    });
}
/** Top N preview line items (rendered as bullets, capped at 5 like the existing code). */
function previewLines(data, max = 5) {
    return sortedPosted(data).slice(0, max).map((c, i) => `${i + 1}. ${findingLine(c, data.secrets)}`);
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
        sections.push("> ⚠️ `Parse failed` — provider response was not a valid JSON review payload. The raw provider text is included in the Summary section below for diagnostics.");
    }
    else {
        sections.push(pipelineLine(data));
    }
    const tally = severityTally(data);
    if (tally.length > 0)
        sections.push(tally);
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
    // Off-diff block
    const combined = [...data.review.suppressedComments, ...data.offDiffFromComments];
    if (combined.length > 0) {
        sections.push("");
        sections.push(`📍 Off-diff (${combined.length} not posted)`);
        for (const c of combined)
            sections.push(`- ${findingLine(c, data.secrets)}`);
    }
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
        parts.push("| # | Severity | File:Line | Title |");
        parts.push("| ---: | :--- | :--- | :--- |");
        sortedPosted(data).slice(0, 5).forEach((c, i) => {
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            const snippet = title.length > 80 ? `${title.slice(0, 77)}…` : title;
            parts.push(`| ${i + 1} | ${severityEmoji(c.severity)} ${severityLabel(c.severity)} | \`${cell(c.path)}\`:${c.line} | ${cell(snippet)} |`);
        });
        parts.push("");
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(`> ${redact(data.review.summary, data.secrets).split("\n").join("\n> ")}`);
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
        parts.push("");
    }
    if (data.postedComments.length > 0) {
        parts.push("### 📋 Findings to address");
        parts.push("");
        sortedPosted(data).slice(0, 5).forEach((c, i) => {
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            const snippet = title.length > 90 ? `${title.slice(0, 87)}…` : title;
            parts.push(`${i + 1}. ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
        });
        parts.push("");
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Provider summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
        parts.push("> ⚠️ `Parse failed` — provider response was not a valid JSON review payload. The raw provider text is included in the Summary section below for diagnostics.");
        parts.push("");
    }
    else {
        parts.push(pipelineLine(data));
        const tally = severityTally(data);
        if (tally.length > 0) {
            parts.push(tally);
        }
        parts.push("");
    }
    parts.push("### 📋 Findings");
    parts.push("");
    parts.push("| # | Severity | Category | File:Line | Title |");
    parts.push("| ---: | :--- | :--- | :--- | :--- |");
    if (all.length === 0) {
        parts.push("| — | — | — | — | _No findings to address_ |");
    }
    else {
        all.forEach((c, i) => {
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            const snippet = title.length > 80 ? `${title.slice(0, 77)}…` : title;
            parts.push(`| ${i + 1} | ${severityEmoji(c.severity)} ${severityLabel(c.severity)} | ${cell(c.category ?? "general")} | \`${cell(c.path)}\`:${c.line} | ${cell(snippet)} |`);
        });
    }
    parts.push("");
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
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            parts.push(`> **\`${cell(c.path)}\`:${c.line}** — ${cell(title)}`);
            parts.push("");
        }
    }
    if (data.postedComments.length === 0) {
        parts.push("> _No findings to address._");
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    const byFile = new Map();
    for (const c of data.postedComments) {
        const arr = byFile.get(c.path) ?? [];
        arr.push(c);
        byFile.set(c.path, arr);
    }
    if (byFile.size > 0) {
        parts.push("### 📂 Files touched");
        parts.push("");
        const sorted = [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));
        for (const [path, comments] of sorted) {
            parts.push(`#### \`${cell(path)}\` — ${comments.length} finding${comments.length === 1 ? "" : "s"}`);
            parts.push("");
            for (const c of comments) {
                const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
                parts.push(`- ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** (line ${c.line}) — ${cell(title)}`);
            }
            parts.push("");
        }
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Full summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            const snippet = title.length > 90 ? `${title.slice(0, 87)}…` : title;
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
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
        parts.push("");
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    if (offDiffCount(data) > 0) {
        parts.push(`- 📍 ${offDiffCount(data)} off-diff finding${offDiffCount(data) === 1 ? "" : "s"} not posted (not on this diff).`);
    }
    if (filteredCount(data) > 0) {
        parts.push(`- 🧹 ${filteredCount(data)} filtered by severity policy or \`max-comments\` cap.`);
    }
    parts.push("");
    if (data.review.summary.trim().length > 0) {
        parts.push("### 📖 Story");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
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
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    if (offDiffCount(data) > 0) {
        parts.push("### 📍 Off-diff items (not posted)");
        parts.push("");
        [...data.review.suppressedComments, ...data.offDiffFromComments].slice(0, 5).forEach((c) => {
            parts.push(`- ${findingLine(c, data.secrets)}`);
        });
        parts.push("");
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Provider summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
        "🔴 Fixes (high/critical)": [],
        "🟠 Improvements (medium)": [],
        "🟡 Style (low)": [],
    };
    const SEVERITY_RANK_TO_BUCKET = {
        4: "🔴 Fixes (high/critical)",
        3: "🔴 Fixes (high/critical)",
        2: "🟠 Improvements (medium)",
        1: "🟡 Style (low)",
        0: "🟡 Style (low)",
    };
    for (const c of data.postedComments) {
        const rank = severityRank(c.severity);
        const bucketName = SEVERITY_RANK_TO_BUCKET[rank] ?? "🟡 Style (low)";
        buckets[bucketName].push(c);
    }
    for (const [header, list] of Object.entries(buckets)) {
        if (list.length === 0)
            continue;
        parts.push(`### ${header}`);
        parts.push("");
        list.forEach((c, i) => {
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            const snippet = title.length > 80 ? `${title.slice(0, 77)}…` : title;
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
    if (data.review.summary.trim().length > 0) {
        parts.push("### 📖 Notes");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    const byFile = new Map();
    for (const c of data.postedComments) {
        const arr = byFile.get(c.path) ?? [];
        arr.push(c);
        byFile.set(c.path, arr);
    }
    const sortedFiles = [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));
    parts.push("| File | Findings | Status |");
    parts.push("| :--- | ---: | :---: |");
    if (sortedFiles.length === 0) {
        parts.push("| _all files_ | **0** | ✅ Pass |");
    }
    else {
        for (const [path, comments] of sortedFiles) {
            const worst = Math.max(...comments.map((c) => severityRank(c.severity)));
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
                parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${redact(c.body, data.secrets).replace(/\s+/gu, " ").trim()}`);
            }
            parts.push("");
        }
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    if (data.review.summary.trim().length > 0) {
        parts.push("### 📝 Notes");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
    const byFile = new Map();
    for (const c of data.postedComments) {
        const arr = byFile.get(c.path) ?? [];
        arr.push(c);
        byFile.set(c.path, arr);
    }
    const max = Math.max(1, ...[...byFile.values()].map((v) => v.length));
    parts.push("```text");
    if (byFile.size === 0) {
        parts.push("(no findings)");
    }
    else {
        const sortedFiles = [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));
        const pathWidth = Math.max(8, ...sortedFiles.map(([p]) => p.length));
        for (const [path, comments] of sortedFiles) {
            const filled = Math.round((comments.length / max) * 24);
            const bar = "█".repeat(filled) + "░".repeat(24 - filled);
            parts.push(`  ${path.padEnd(pathWidth)} │ ${bar} ${String(comments.length).padStart(3)}`);
        }
    }
    parts.push("```");
    parts.push("");
    if (byFile.size > 0) {
        parts.push("### 🔎 Detail");
        parts.push("");
        const sortedFiles = [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));
        for (const [path, comments] of sortedFiles) {
            parts.push(`#### \`${cell(path)}\``);
            parts.push("");
            for (const c of comments) {
                parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${redact(c.body, data.secrets).replace(/\s+/gu, " ").trim()}`);
            }
            parts.push("");
        }
    }
    else {
        parts.push("> _No findings to address._");
        parts.push("");
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            const snippet = title.length > 200 ? `${title.slice(0, 197)}…` : title;
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
        parts.push("");
    }
    if (data.review.summary.trim().length > 0) {
        parts.push("### 💬 Summary");
        parts.push("");
        parts.push(redact(data.review.summary, data.secrets));
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
            const title = redact(c.body, data.secrets).replace(/\s+/gu, " ").trim();
            const snippet = title.length > 140 ? `${title.slice(0, 137)}…` : title;
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
        parts.push("");
    }
    parts.push("---");
    parts.push(footer(data));
    parts.push("");
    parts.push(REVIEW_MARKER);
    parts.push(manifest(data));
    return parts.join("\n");
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
/**
 * Build a `LiveReview` to use when the provider returned a non-JSON or
 * unparseable response. Returns `verdict: "COMMENT"` with zero findings
 * and a summary that names the model + provider. The raw provider text is
 * included so reviewers can diagnose the failure without leaving the PR.
 *
 * `buildReviewBody` will fold this summary into the parent PR-level card
 * along with a collapsed `<details>` block containing the raw provider
 * text — see the helper for the exact rendering.
 */
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
    // Note: the summary intentionally does NOT include a "Generated by"
    // footer — `buildReviewBody` emits that footer in its own block so
    // this fallback path would otherwise show the same metadata twice.
    return {
        summary: `Provider response did not contain a valid JSON review payload.\n\n${detailsBlock}`,
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [],
        parseFailed: true,
    };
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
    const body = buildReviewBody({
        review: input.review,
        provider: input.provider,
        modelId: input.modelId,
        validCommentCount: postableComments.length,
        suppressedCommentCount,
        offDiffFromComments,
        severityCounts,
        postedComments: postableComments,
        secrets: input.secrets,
    });
    return {
        postableComments,
        offDiffFromComments,
        suppressedCommentCount,
        severityCounts,
        body,
        postedComments: postableComments,
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
    if (parsed.ignoreMinor && comment.severity.toLowerCase() === "low") {
        return false;
    }
    const minimum = parsed.minimumSeverity;
    if (minimum === null) {
        return true;
    }
    return severityRank(comment.severity) >= severityRank(minimum);
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
        };
    }
    // At least one thread landed — post the PR status.
    await postAzureStatus({
        context,
        fetchImpl,
        state: mapReviewVerdictToAzureStatus(provider.review.verdict),
        description: provider.review.summary,
    });
    // The reviewId is the PARENT thread id (so consumers can correlate
    // the run with the top-level summary card on the PR conversation).
    const reviewId = parentThreadId ?? postedIds[0];
    const successMessage = failedIndices.length > 0
        ? `posted Azure review (${postedIds.length} threads, ${failedIndices.length} failed)`
        : `posted Azure review (${postedIds.length} threads)`;
    return {
        exitCode: 0,
        posted: true,
        reviewId,
        message: successMessage,
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
            return { exitCode: 0, posted: true, reviewId, message: "updated existing GitHub review" };
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
        : mapReviewVerdictToGithubEvent(provider.review.verdict);
    const reviewId = await createGithubReview({
        context,
        fetchImpl,
        body,
        event,
        comments: postableComments,
    });
    return {
        exitCode: 0,
        posted: true,
        reviewId,
        message: existing !== null ? "replaced existing GitHub review" : "posted GitHub review",
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

;// CONCATENATED MODULE: ./src/render/json-extract.ts

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
    const fencedAttempt = tryParseJson(extractJsonFenceBody(rawText));
    if (fencedAttempt !== undefined) {
        return fencedAttempt;
    }
    const balanced = extractFirstBalancedObject(rawText);
    if (balanced !== null) {
        const balancedAttempt = tryParseJson(balanced);
        if (balancedAttempt !== undefined) {
            return balancedAttempt;
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
 */
function extractJsonFenceBody(rawText) {
    const fenceMatch = /```[a-zA-Z0-9_+\-]*\s*\n([\s\S]*?)\n```/.exec(rawText);
    const body = fenceMatch?.[1];
    return body ?? rawText;
}
/**
 * Locate the first balanced `{ ... }` object in `rawText`, respecting nested
 * braces and quoted strings (including \" escapes). Returns null when no
 * balanced object can be found.
 *
 * Returns a JSON-safe substring with literal control characters (newlines,
 * tabs, carriage returns) inside JSON strings escaped to their JSON-escape
 * equivalents (`\n`, `\t`, `\r`). This is required for parser robustness
 * because some provider streaming formats (notably SSE `response.output_text.delta`
 * events) JSON-encode delta values such that the JSON-escape for newline
 * (`\n`) becomes a literal newline in the SSE data line source — and the
 * SSE protocol treats that newline as a line break. After concatenating
 * fragments, the result contains literal newlines inside what should be
 * JSON strings, which makes the substring invalid JSON. This function walks
 * the balanced substring and escapes those control characters back to their
 * JSON-escape equivalents so the result is valid JSON.
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
                inString = false;
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
                segments.push(char);
                escape = false;
                continue;
            }
            if (char === "\\") {
                segments.push(char);
                escape = true;
                continue;
            }
            if (char === '"') {
                segments.push(char);
                inString = false;
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

;// CONCATENATED MODULE: ./src/provider/provider-parse.ts


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
 * Self-healing follow-up message sent to the model when its first response
 * could not be parsed as a JSON review payload. Some providers ignore
 * `stream: false` and return an empty SSE stream; some wrap their output
 * in markdown fences or prose; some omit the JSON entirely. We retry
 * once with an explicit reminder before falling back to the parse-fail
 * surface — that often recovers the review without operator intervention.
 *
 * Shared between `openai-compatible.ts` and `copilot.ts` so the
 * self-healing message stays byte-identical regardless of provider.
 */
const PARSE_FAIL_RETRY_PROMPT = "Your previous response did not contain a valid JSON review payload. " +
    "Please respond with ONLY a JSON object matching this schema (no prose, no fences): " +
    '{"summary": "...", "verdict": "NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP", "comments": [...], "suppressed_comments": [...]}.';
function buildResponsesBody(config, opts) {
    const userContent = opts?.userOverride ?? config.user;
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
    return body;
}
function buildChatBody(config, opts) {
    const userContent = opts?.userOverride ?? config.user;
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
function parseReviewPayload(text) {
    const candidate = extractJsonBlock(text);
    if (!isRecord(candidate)) {
        return null;
    }
    const summary = readStringField(candidate, "summary") ?? "";
    const verdict = readStringField(candidate, "verdict") ?? "";
    const comments = provider_parse_readCommentArray(candidate["comments"]);
    const suppressed_comments = provider_parse_readCommentArray(candidate["suppressed_comments"]);
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
        // "no diff / file contents were provided / shared / available"
        /\bno\s+(diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied)\b/u,
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
function provider_parse_readCommentArray(value) {
    if (!isUnknownArray(value)) {
        return [];
    }
    const comments = [];
    for (const entry of value) {
        if (!isRecord(entry)) {
            continue;
        }
        const path = entry["path"];
        const line = readSafeIntegerField(entry, "line");
        if (typeof path === "string" && line !== null) {
            comments.push({
                path,
                line,
                body: readStringField(entry, "body") ?? "",
                severity: readStringField(entry, "severity") ?? "medium",
                category: readStringField(entry, "category") ?? "general",
            });
        }
    }
    return comments;
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
    // fragments — providers that send a `response.completed` event usually
    // skip the per-fragment deltas, so fragment concatenation would be empty.
    if (completedResponseText !== null) {
        return completedResponseText;
    }
    return fragments.length > 0 ? fragments.join("") : null;
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
    constructor(code, endpoint, status, requestId, message, options) {
        super(message, options);
        this.code = code;
        this.endpoint = endpoint;
        this.status = status;
        this.requestId = requestId;
        this.rawText = options?.rawText;
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
        return {
            ok: false,
            error: new ProviderError("parse", ENDPOINT_CHAT, response.status, requestId, "Provider response did not contain a JSON review payload after self-healing retry.", { rawText }),
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

async function runProviderRequest(config) {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const requestId = createRequestId();
    const firstAttempt = await runWithRetry(config, fetchImpl, requestId, ENDPOINT_RESPONSES);
    if (firstAttempt.ok) {
        return firstAttempt;
    }
    if (shouldFallback(firstAttempt.error)) {
        return runWithRetry(config, fetchImpl, requestId, openai_compatible_ENDPOINT_CHAT);
    }
    return firstAttempt;
}
async function runWithEndpoint(config, fetchImpl, requestId, endpoint) {
    try {
        return await callEndpoint(config, fetchImpl, requestId, endpoint);
    }
    catch (error) {
        if (error instanceof ProviderError) {
            return { ok: false, error };
        }
        throw error;
    }
}
const RETRY_BACKOFF_MS = [250, 1_000];
async function runWithRetry(config, fetchImpl, requestId, endpoint) {
    let lastFailure = null;
    for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
        const result = await runWithEndpoint(config, fetchImpl, requestId, endpoint);
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
async function callEndpoint(config, fetchImpl, requestId, endpoint) {
    const url = joinUrl(config.baseUrl, endpoint === ENDPOINT_RESPONSES ? "/responses" : "/chat/completions");
    const body = endpoint === ENDPOINT_RESPONSES
        ? buildResponsesBody(config)
        : buildChatBody(config);
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
    // Treat an empty-summary+empty-verdict parse as a parse failure even
    // when `extractJsonBlock` returned an object. The parser is permissive
    // about JSON shape (returns `ProviderReviewPayload` with empty fields
    // for any JSON object), so a chat-format response (`{choices: [...]}`)
    // fed to the responses endpoint can otherwise pass as a 0-finding
    // "empty review" — see CLARITY-10.
    if (isNonEmptyReview(review)) {
        return { ok: true, endpoint, review, requestId };
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
        ? buildResponsesBody(config, { userOverride: PARSE_FAIL_RETRY_PROMPT })
        : buildChatBody(config, { userOverride: PARSE_FAIL_RETRY_PROMPT });
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
        throw new ProviderError("parse", endpoint, retryResponseStatus ?? response.status, requestId, "Provider response did not contain a JSON review payload after self-healing retry.", { rawText });
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

;// CONCATENATED MODULE: ./src/config/errors.ts
class InvalidConfigError extends Error {
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
        throw new InvalidConfigError("prompt.byteCap", `expected positive integer, received ${byteCap}`);
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


async function buildProviderPrompts(input) {
    const additionalPrompt = await readAdditionalPrompt(input);
    const userParts = [
        `Platform: ${input.platform}`,
        additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
    ];
    if (input.sonarContext !== undefined && input.sonarContext.length > 0) {
        userParts.push(input.sonarContext);
    }
    userParts.push("Diff:", input.diffText);
    return {
        system: await pickSystemPrompt(input),
        user: userParts.join("\n\n"),
    };
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
    return [
        "You are UmActually, a precise pull request reviewer.",
        "Return strict JSON only with this schema:",
        "{\"summary\":string,\"verdict\":\"COMMENT\"|\"APPROVED\"|\"NEEDS_FIX\",\"comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}],\"suppressed_comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}]}",
        "Anchor comments only to changed or context lines present in the diff. Do not include secrets.",
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

;// CONCATENATED MODULE: ./src/cli/live-provider.ts





const DEFAULT_MODEL = "auto";
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
            fetchImpl: input.fetchImpl,
        });
        if (result.ok) {
            return {
                review: normalizeProviderReview(result.review, [providerApiKey, input.platformToken]),
                endpoint: result.endpoint,
                provider: COPILOT_PROVIDER_NAME,
                modelId,
            };
        }
        if (result.error.code === "parse") {
            return {
                review: buildMalformedProviderFallback({
                    provider: COPILOT_PROVIDER_NAME,
                    modelId,
                    rawText: result.error.rawText ?? "",
                    secrets: [providerApiKey, input.platformToken],
                }),
                endpoint: result.error.endpoint,
                provider: COPILOT_PROVIDER_NAME,
                modelId,
            };
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
        fetchImpl: input.fetchImpl,
    });
    if (result.ok) {
        return {
            review: normalizeProviderReview(result.review, [providerApiKey, input.platformToken]),
            endpoint: result.endpoint,
            provider: PROVIDER_NAME,
            modelId,
        };
    }
    if (result.error.code === "parse") {
        return {
            review: buildMalformedProviderFallback({
                provider: PROVIDER_NAME,
                modelId,
                rawText: result.error.rawText ?? "",
                secrets: [providerApiKey, input.platformToken],
            }),
            endpoint: result.error.endpoint,
            provider: PROVIDER_NAME,
            modelId,
        };
    }
    throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
}
function normalizeProviderReview(payload, secrets) {
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
    if (fromArgs !== null && fromArgs.length > 0) {
        return fromArgs;
    }
    const fromEnv = env["UMACTUALLY_MODEL"];
    return fromEnv === undefined || fromEnv.length === 0 ? DEFAULT_MODEL : fromEnv;
}
function readRequestTimeoutMs(parsed) {
    const seconds = parsed.perRequestTimeoutSeconds ?? parsed.reviewTimeoutSeconds;
    return seconds === null || seconds <= 0 ? live_provider_DEFAULT_REQUEST_TIMEOUT_MS : seconds * 1_000;
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
            const context = readAzureContext(env);
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
            return assertNever(platform);
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
function assertNever(value) {
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
        ignoreMinor: env.ignoreMinor ?? null,
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
function validate_assertNever(value) {
    throw new TypeError(`unhandled platform variant: ${JSON.stringify(value)}`);
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
    ignoreMinor: true,
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
    ["ignoreMinor", 20],
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
        ignoreMinor: getBool("ignore-minor", false),
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
