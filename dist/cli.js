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
  _x: () => (/* reexport */ CliUsageError),
  iW: () => (/* binding */ main),
  hT: () => (/* reexport */ parseCliArgs),
  ak: () => (/* binding */ runCli)
});

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
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(parsed)) {
        throw new CliUsageError(`flag --${flag} requires an integer value`);
    }
    return parsed;
}
function readMinimumSeverity(args, index) {
    const raw = readValue(args, index, "minimum-severity");
    switch (raw) {
        case "low":
        case "medium":
        case "high":
            return raw;
        default:
            throw new CliUsageError(`invalid --minimum-severity value: ${raw}`);
    }
}
function readPlatform(value) {
    switch (value) {
        case "auto":
            return "auto";
        case "github":
            return "github";
        case "azure":
        case "azure-devops":
            return "azure";
        default:
            throw new CliUsageError(`invalid --platform value: ${value}`);
    }
}
function readEffort(args, index) {
    const raw = readValue(args, index, "effort");
    switch (raw) {
        case "low":
        case "medium":
        case "high":
            return raw;
        default:
            throw new CliUsageError(`invalid --effort value: ${raw}`);
    }
}
function readProvider(value) {
    switch (value) {
        case "openai-compatible":
            return "openai-compatible";
        case "copilot":
            return "copilot";
        default:
            throw new CliUsageError(`invalid --provider value: ${value}`);
    }
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

;// CONCATENATED MODULE: external "node:fs/promises"
const promises_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:fs/promises");
;// CONCATENATED MODULE: external "node:path"
const external_node_path_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:path");
;// CONCATENATED MODULE: ./src/security/scan-review-secrets.ts
const HIGH_CONFIDENCE_SECRET_PATTERNS = [
    /\bsk_test_[a-z_]+\b/g,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    /\bghp_[A-Za-z0-9]{36}\b/g,
];
const REDACTED_SECRET = "[REDACTED_SECRET]";
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
        redactedLine = redactedLine.replace(pattern, REDACTED_SECRET);
    }
    return redactedLine;
}

;// CONCATENATED MODULE: ./src/azure/run-azure-review.ts

const REVIEW_MARKER = "<!-- umactually-pr-review -->";
async function runAzureReview(contract) {
    parsePullRequest(contract.pullRequestJson);
    const existingThreads = parseAzureThreads(contract.existingThreadsJson);
    const review = parseProviderReview(contract.reviewJson);
    // Always run secret scan before posting — leaks block raw output regardless of flags.
    await scanReviewSecrets({
        diffText: contract.diffText ?? "",
        expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });
    const postedThreadCount = countPostableThreads(review.comments, existingThreads);
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
function countPostableThreads(comments, existingThreads) {
    let count = 0;
    for (const comment of comments) {
        if (hasMatchingReviewThread(comment, existingThreads)) {
            count += 1;
        }
    }
    return count;
}
function hasMatchingReviewThread(comment, existingThreads) {
    const azurePath = `/${comment.path}`;
    for (const thread of existingThreads.value) {
        const firstComment = thread.comments[0];
        if (thread.status === "active" &&
            thread.threadContext.filePath === azurePath &&
            thread.threadContext.rightFileStart.line === comment.line &&
            firstComment?.content.includes(REVIEW_MARKER) === true) {
            return true;
        }
    }
    return false;
}
function mapVerdictToStatus(verdict) {
    switch (verdict) {
        case "NEEDS_FIX":
            return "failed";
        case "APPROVED":
            return "succeeded";
        case "COMMENT":
            return "pending";
        default:
            return assertNever(verdict);
    }
}
function assertNever(value) {
    throw new TypeError(`Unexpected provider verdict: ${value}`);
}
function readRecord(value, label) {
    if (!isRecord(value)) {
        throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
    }
    return value;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function readNumberField(record, key) {
    const value = record[key];
    if (typeof value !== "number") {
        throw new TypeError(`Expected field '${key}' to be a number, received: ${typeof value}`);
    }
    return value;
}
function readStringField(record, key) {
    const value = record[key];
    if (typeof value !== "string") {
        throw new TypeError(`Expected field '${key}' to be a string, received: ${typeof value}`);
    }
    return value;
}
function readVerdict(value) {
    if (value === "NEEDS_FIX" || value === "APPROVED" || value === "COMMENT") {
        return value;
    }
    throw new TypeError(`Expected provider verdict, received: ${typeof value}`);
}
function readCommentArray(value) {
    if (!Array.isArray(value)) {
        throw new TypeError(`Expected review comments array, received: ${typeof value}`);
    }
    const comments = [];
    for (const entry of value) {
        const record = readRecord(entry, "review comment");
        comments.push({ path: readStringField(record, "path"), line: readNumberField(record, "line") });
    }
    return comments;
}
function readThreadArray(value) {
    if (!Array.isArray(value)) {
        throw new TypeError(`Expected Azure threads array, received: ${typeof value}`);
    }
    const threads = [];
    for (const entry of value) {
        const record = readRecord(entry, "Azure thread");
        threads.push({
            status: readStringField(record, "status"),
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
        filePath: readStringField(context, "filePath"),
        rightFileStart: { line: readNumberField(start, "line") },
    };
}
function readThreadComments(value) {
    if (!Array.isArray(value)) {
        throw new TypeError(`Expected Azure thread comments array, received: ${typeof value}`);
    }
    const comments = [];
    for (const entry of value) {
        comments.push({ content: readStringField(readRecord(entry, "Azure thread comment"), "content") });
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
    return Number.isSafeInteger(start) && start > 0 ? start : null;
}
function addLine(linesByPath, path, line) {
    const existingLines = linesByPath.get(path);
    if (existingLines !== undefined) {
        existingLines.add(line);
        return;
    }
    linesByPath.set(path, new Set([line]));
}

;// CONCATENATED MODULE: ./src/review/run-review.ts


const run_review_REVIEW_MARKER = "<!-- umactually-pr-review -->";
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
        marker: run_review_REVIEW_MARKER,
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
    const event = run_review_readRecord(value, "GitHub event");
    const pullRequest = run_review_readRecord(readField(event, "pull_request"), "pull_request");
    run_review_readNumberField(pullRequest, "number");
}
function parseProviderReviewPayload(value) {
    const review = run_review_readRecord(value, "provider review");
    const comments = run_review_readCommentArray(readField(review, "comments"));
    const suppressedComments = run_review_readCommentArray(readField(review, "suppressed_comments"));
    return { comments: comments, suppressed_comments: suppressedComments };
}
function run_review_readRecord(value, label) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
    }
    return value;
}
function readField(record, key) {
    return record[key];
}
function run_review_readNumberField(record, key) {
    const value = readField(record, key);
    if (typeof value !== "number") {
        throw new TypeError(`Expected field '${key}' to be a number, received: ${typeof value}`);
    }
    return value;
}
function run_review_readCommentArray(value) {
    if (!Array.isArray(value)) {
        throw new TypeError(`Expected comment array, received: ${typeof value}`);
    }
    const comments = [];
    for (const entry of value) {
        comments.push(parseComment(entry));
    }
    return comments;
}
function parseComment(value) {
    const record = run_review_readRecord(value, "comment");
    const path = readField(record, "path");
    const line = readField(record, "line");
    if (typeof path !== "string") {
        throw new TypeError(`Expected comment 'path' to be a string, received: ${typeof path}`);
    }
    if (typeof line !== "number") {
        throw new TypeError(`Expected comment 'line' to be a number, received: ${typeof line}`);
    }
    return { path, line };
}

;// CONCATENATED MODULE: ./src/sonar/run-sonar-import.ts
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
    if (!run_sonar_import_isRecord(value)) {
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
    if (!run_sonar_import_isRecord(value)) {
        throw new SonarFixtureParseError("quality-gate-sequence", "poll attempt objects");
    }
    const projectStatus = value["projectStatus"];
    if (!run_sonar_import_isRecord(projectStatus)) {
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
    if (!run_sonar_import_isRecord(value) || !isReadonlyArray(value["issues"])) {
        throw new SonarFixtureParseError("issues", "an issues array");
    }
    return {
        issues: value["issues"],
    };
}
function parseSonarHotspots(json) {
    const value = parseJson(json);
    if (!run_sonar_import_isRecord(value) || !isReadonlyArray(value["hotspots"])) {
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
function run_sonar_import_isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isReadonlyArray(value) {
    return Array.isArray(value);
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
    const baseUrl = config.sonarHostUrl.replace(/\/+$/u, "");
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
            const message = error instanceof Error ? error.message : String(error);
            // Network errors are not fatal — retry until the deadline.
            lastStatus = "IN_PROGRESS";
            process.stderr.write(`::warning::umactually-pr-review: sonar quality-gate poll attempt ${pollAttempts} failed: ${message}\n`);
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
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`::warning::umactually-pr-review: sonar issues fetch failed: ${message}\n`);
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
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`::warning::umactually-pr-review: sonar hotspots fetch failed: ${message}\n`);
    }
    return issueCount + hotspotCount;
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

;// CONCATENATED MODULE: ./src/config/env-sources.ts
// UMACTUALLY_* env vars are the canonical secrets surface for the GitHub Actions
// and Azure DevOps deployments. REVIEW_* keys remain as a backward-compatible
// fallback so the legacy reference tooling still resolves the same fields.
// Both are recorded into EnvSources; callers pick the first defined value.
const ENV_KEYS = [
    ["providerUrl", ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"]],
    ["providerApiKey", ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"]],
    ["providerModel", ["UMACTUALLY_MODEL", "REVIEW_PROVIDER_MODEL"]],
    ["promptSystemFile", ["UMACTUALLY_PROMPT_FILE", "REVIEW_PROMPT_SYSTEM_FILE"]],
    ["promptUserFile", ["UMACTUALLY_ADDITIONAL_PROMPT_FILE", "REVIEW_PROMPT_USER_FILE"]],
    ["promptByteCap", ["REVIEW_PROMPT_BYTE_CAP"]],
    ["walkthrough", ["UMACTUALLY_WALKTHROUGH", "REVIEW_WALKTHROUGH"]],
    ["diagnostic", ["UMACTUALLY_DIAGNOSTIC", "REVIEW_DIAGNOSTIC"]],
    ["dryRun", ["UMACTUALLY_DRY_RUN", "REVIEW_DRY_RUN"]],
    ["debugRawResponse", ["REVIEW_DEBUG_RAW_RESPONSE"]],
    ["simulateFindings", ["UMACTUALLY_SIMULATE_FINDINGS", "REVIEW_SIMULATE_FINDINGS"]],
    ["reviewTimeoutSeconds", ["UMACTUALLY_REVIEW_TIMEOUT_SECONDS", "REVIEW_TIMEOUT_SECONDS"]],
    ["stallTimeoutSeconds", ["UMACTUALLY_STALL_SECONDS", "REVIEW_STALL_SECONDS"]],
    ["perRequestTimeoutSeconds", ["REVIEW_PER_REQUEST_TIMEOUT_SECONDS"]],
    ["ignoreMinor", ["UMACTUALLY_IGNORE_MINOR", "REVIEW_IGNORE_MINOR"]],
    ["minimumSeverity", ["REVIEW_MINIMUM_SEVERITY"]],
    ["maxComments", ["REVIEW_MAX_COMMENTS"]],
    ["sonarEnabled", ["UMACTUALLY_INCLUDE_SONARQUBE", "REVIEW_SONAR_ENABLED"]],
    ["sonarHost", ["UMACTUALLY_SONAR_HOST_URL", "REVIEW_SONAR_HOST"]],
    ["sonarToken", ["UMACTUALLY_SONAR_TOKEN", "REVIEW_SONAR_TOKEN"]],
    ["sonarProject", ["UMACTUALLY_SONAR_PROJECT_KEY", "REVIEW_SONAR_PROJECT"]],
    ["sonarTimeoutSeconds", ["REVIEW_SONAR_TIMEOUT_SECONDS"]],
    ["leakDetection", ["UMACTUALLY_DETECT_LEAKS", "REVIEW_LEAK_DETECTION"]],
    ["redactorEnabled", ["REVIEW_REDACTOR_ENABLED"]],
    ["platform", ["REVIEW_PLATFORM"]],
    ["githubToken", ["GITHUB_TOKEN"]],
    ["azureOrg", ["AZURE_DEVOPS_ORG"]],
    ["azureProject", ["AZURE_DEVOPS_PROJECT"]],
    ["azureRepo", ["AZURE_DEVOPS_REPO"]],
    ["azurePullRequestId", ["AZURE_DEVOPS_PULL_REQUEST_ID"]],
    ["azureToken", ["AZURE_DEVOPS_TOKEN"]],
];
/**
 * Pure: extracts the known env-var keys from `env` into an EnvSources object.
 * UMACTUALLY_* takes precedence over REVIEW_* when both are set.
 * Never logs values. Empty/missing keys are simply omitted.
 */
function readEnvSources(env = process.env) {
    const out = {};
    for (const [field, envNames] of ENV_KEYS) {
        for (const envName of envNames) {
            const v = env[envName];
            if (typeof v === "string" && v.trim().length > 0) {
                out[field] = v;
                break;
            }
        }
    }
    return out;
}

;// CONCATENATED MODULE: ./src/platform/azure/api.ts
class AzureApiError extends Error {
    name = "AzureApiError";
    code;
    status;
    constructor(code, status, message, options) {
        super(message, options);
        this.code = code;
        this.status = status;
    }
}
const AZURE_DEVOPS_BASE_URL = "https://dev.azure.com";
const AZURE_DIFFS_API_VERSION = "7.1";
async function fetchAzurePrDiff(context, fetchImpl = fetch) {
    const url = buildPullRequestDiffUrl(context);
    const response = await fetchImpl(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${context.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "umactually-pr-review",
        },
        body: JSON.stringify({}), // no-diff-request = full diff per Azure DevOps defaults
    });
    if (!response.ok) {
        throw new AzureApiError("AZURE_FETCH_FAILED", response.status, `Azure DevOps PR diff request failed with status ${response.status}.`);
    }
    const diffText = await response.text();
    if (diffText.length === 0) {
        throw new AzureApiError("AZURE_DIFF_EMPTY", response.status, "Azure DevOps PR diff response body was empty.");
    }
    return diffText;
}
function buildPullRequestDiffUrl(context) {
    const projectSegment = encodeURIComponent(context.project);
    return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}/pullRequests/${context.prNumber}/diffs/commits?api-version=${AZURE_DIFFS_API_VERSION}`;
}

;// CONCATENATED MODULE: ./src/platform/azure/context.ts
class AzureContextError extends Error {
    name = "AzureContextError";
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
    }
}
const SYSTEM_ACCESSTOKEN_ALIAS = "SYSTEM_ACCESSTOKEN";
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
    const token = env[SYSTEM_ACCESSTOKEN_ALIAS];
    if (token === undefined || token.length === 0) {
        throw new AzureContextError("AZURE_TOKEN_MISSING", "Azure Pipelines SYSTEM_ACCESSTOKEN must be set.");
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
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
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

;// CONCATENATED MODULE: ./src/platform/github/api.ts
class GithubApiError extends Error {
    name = "GithubApiError";
    code;
    status;
    constructor(code, status, message, options) {
        super(message, options);
        this.code = code;
        this.status = status;
    }
}
const GITHUB_API_BASE_URL = "https://api.github.com";
const PULL_DIFF_MEDIA_TYPE = "application/vnd.github.v3.diff";
async function fetchGithubPrDiff(context, fetchImpl = fetch) {
    const url = buildPullUrl(context);
    const response = await fetchImpl(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${context.token}`,
            Accept: PULL_DIFF_MEDIA_TYPE,
            "User-Agent": "umactually-pr-review",
        },
    });
    if (!response.ok) {
        throw new GithubApiError("GITHUB_FETCH_FAILED", response.status, `GitHub PR diff request failed with status ${response.status}.`);
    }
    const diffText = await response.text();
    if (diffText.length === 0) {
        throw new GithubApiError("GITHUB_DIFF_EMPTY", response.status, "GitHub PR diff response body was empty.");
    }
    return diffText;
}
function buildPullUrl(context) {
    const repositorySegment = `${context.repo.owner}/${context.repo.name}`;
    return `${GITHUB_API_BASE_URL}/repos/${repositorySegment}/pulls/${context.prNumber}`;
}

;// CONCATENATED MODULE: ./src/platform/github/context.ts

class GithubContextError extends Error {
    name = "GithubContextError";
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
    }
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
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
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
    if (!isObject(parsed)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must parse as a JSON object.");
    }
    const pullRequest = parsed["pull_request"];
    if (!isObject(pullRequest)) {
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
    if (!isObject(slot)) {
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
    if (isObject(owner) && typeof name === "string" && name.length > 0) {
        const ownerLogin = owner["login"];
        if (typeof ownerLogin === "string" && ownerLogin.length > 0) {
            return `${ownerLogin}/${name}`;
        }
    }
    return null;
}
function readOptionalNumber(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function context_readRecord(value, label) {
    if (!isObject(value)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", `GitHub event payload must contain a '${label}' object.`);
    }
    return value;
}
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readBoolean(value) {
    return value === true;
}
function readString(value) {
    return typeof value === "string" ? value : "";
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
const DEFAULT_MAX_COMMENTS = 50;
function buildReviewBody(input) {
    const rawBody = [
        run_review_REVIEW_MARKER,
        sanitizeForPost(input.review.summary, input.secrets),
        "",
        `${sanitizeForPost(input.modelId, input.secrets)} (${sanitizeForPost(input.provider, input.secrets)})`,
        "",
        `Findings: ${input.validCommentCount} inline, ${input.suppressedCommentCount} suppressed.`,
    ].join("\n");
    return sanitizeForPost(rawBody, input.secrets);
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
        comments.push({ ...comment, body: sanitizeInlineBody(comment, input.secrets) });
    }
    return comments;
}
function countSuppressedComments(review, diffText) {
    const positions = parseDiffPositions(diffText);
    let count = review.suppressedComments.length;
    for (const comment of review.comments) {
        if (!positions.hasPosition(comment)) {
            count += 1;
        }
    }
    return count;
}
function mapReviewVerdictToGithubEvent(verdict) {
    return verdict === "NEEDS_FIX" ? "REQUEST_CHANGES" : "COMMENT";
}
function mapReviewVerdictToAzureStatus(verdict) {
    switch (verdict) {
        case "NEEDS_FIX":
            return "failed";
        case "APPROVED":
            return "succeeded";
        case "COMMENT":
        case "DISCUSS":
        case "SHIP":
            return "pending";
        default:
            return "pending";
    }
}
function sanitizeForPost(value, secrets) {
    let sanitized = value
        .replace(/Authorization:\s*[^\r\n]*/giu, "[REDACTED_AUTHORIZATION_HEADER]")
        .replace(/\bBearer\s+\S+/giu, "[REDACTED_BEARER_TOKEN]");
    for (const secret of secrets) {
        if (secret.length > 0) {
            sanitized = sanitized.split(secret).join("[REDACTED_SECRET]");
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
    if (!live_shared_isRecord(value)) {
        return undefined;
    }
    const id = value["id"];
    return typeof id === "number" && Number.isSafeInteger(id) ? id : undefined;
}
function ensureHttpOk(response, code, action) {
    if (!response.ok) {
        throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`);
    }
}
function live_shared_isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sanitizeInlineBody(comment, secrets) {
    const prefix = `**${comment.severity} ${comment.category}**`;
    const body = comment.body.length > 0 ? comment.body : `Finding at ${comment.path}:${comment.line}.`;
    return sanitizeForPost(`${prefix}\n\n${body}`, secrets);
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
function severityRank(severity) {
    switch (severity.toLowerCase()) {
        case "critical":
            return 4;
        case "high":
            return 3;
        case "medium":
            return 2;
        case "low":
            return 1;
        default:
            return 0;
    }
}

;// CONCATENATED MODULE: ./src/cli/live-azure.ts



async function runAzureLive(input) {
    const { context, diffText, provider, parsed, fetchImpl } = input;
    const comments = selectPostableComments({
        review: provider.review,
        diffText,
        parsed,
        secrets: [context.token],
    });
    const body = buildReviewBody({
        review: provider.review,
        provider: provider.provider,
        modelId: provider.modelId,
        validCommentCount: comments.length,
        suppressedCommentCount: countSuppressedComments(provider.review, diffText),
        secrets: [context.token],
    });
    const existingThreads = await listAzureThreads(context, fetchImpl);
    const postedIds = [];
    const failedIndices = [];
    for (let index = 0; index < comments.length; index += 1) {
        const comment = comments[index];
        if (comment === undefined)
            continue;
        if (hasDuplicateThread(existingThreads, comment)) {
            continue;
        }
        try {
            const threadId = await postAzureThread({ context, fetchImpl, comment, body });
            if (threadId !== undefined) {
                postedIds.push(threadId);
            }
        }
        catch (error) {
            failedIndices.push(index);
            const message = error instanceof Error ? error.message : String(error);
            process.stderr.write(`::warning::umactually-pr-review: Azure thread ${index + 1}/${comments.length} failed (${comment.path}:${comment.line}): ${message}; continuing with remaining threads.\n`);
        }
    }
    if (postedIds.length === 0 && failedIndices.length > 0) {
        const failed = failedIndices.length;
        const message = `Azure review failed: 0 threads posted, ${failed} failed`;
        process.stderr.write(`::error::umactually-pr-review: ${message}\n`);
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
    const firstPostedId = postedIds[0];
    const successMessage = failedIndices.length > 0
        ? `posted Azure review (${postedIds.length} threads, ${failedIndices.length} failed)`
        : `posted Azure review (${postedIds.length} threads)`;
    return {
        exitCode: 0,
        posted: true,
        reviewId: firstPostedId,
        message: successMessage,
    };
}
async function listAzureThreads(context, fetchImpl) {
    const response = await fetchImpl(azureThreadsUrl(context), {
        method: "GET",
        headers: azureHeaders(context.token),
    });
    ensureHttpOk(response, "AZURE_LIST_THREADS_FAILED", "Azure list PR threads");
    const json = await readJsonResponse(response);
    if (!live_shared_isRecord(json)) {
        return [];
    }
    const value = json["value"];
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(parseAzureThread).filter((thread) => thread !== null);
}
const AZURE_OPEN_STATUSES = new Set(["active", "pending"]);
const AZURE_RESOLVED_STATUSES = new Set(["closed", "fixed", "wontFix", "byDesign"]);
function hasDuplicateThread(threads, comment) {
    const azurePath = `/${comment.path}`.replace(/\/+/gu, "/");
    const targetLine = comment.line;
    return threads.some((thread) => {
        if (thread.threadContext.filePath !== azurePath)
            return false;
        if (thread.threadContext.rightFileStart.line !== targetLine)
            return false;
        if (AZURE_RESOLVED_STATUSES.has(thread.status))
            return true;
        if (AZURE_OPEN_STATUSES.has(thread.status)) {
            return thread.comments.some((c) => c.content.includes(run_review_REVIEW_MARKER));
        }
        return false;
    });
}
async function postAzureThread(input) {
    const response = await input.fetchImpl(azureThreadsUrl(input.context), {
        method: "POST",
        headers: azureHeaders(input.context.token),
        body: JSON.stringify({
            comments: [
                {
                    parentCommentId: 0,
                    content: `${input.body}\n\n${input.comment.body}`,
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
    return readResponseId(await readJsonResponse(response));
}
async function postAzureStatus(input) {
    const response = await input.fetchImpl(azureStatusesUrl(input.context), {
        method: "POST",
        headers: azureHeaders(input.context.token),
        body: JSON.stringify({
            state: input.state,
            description: input.description,
            context: { name: "UmActually", genre: "pr-review" },
        }),
    });
    ensureHttpOk(response, "AZURE_CREATE_STATUS_FAILED", "Azure create PR status");
}
function parseAzureThread(value) {
    if (!live_shared_isRecord(value)) {
        return null;
    }
    const status = value["status"];
    const comments = value["comments"];
    if (typeof status !== "string" || !Array.isArray(comments)) {
        return null;
    }
    const nestedContext = value["threadContext"];
    const threadContext = live_shared_isRecord(nestedContext)
        ? live_azure_readThreadContext(nestedContext)
        : live_azure_readThreadContext(value);
    if (threadContext === null) {
        return null;
    }
    return {
        status,
        threadContext,
        comments: comments.map(parseAzureComment).filter((comment) => comment !== null),
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
    if (!live_shared_isRecord(start)) {
        return null;
    }
    const line = start["line"];
    return typeof line === "number" && Number.isSafeInteger(line) ? { line } : null;
}
function parseAzureComment(value) {
    if (!live_shared_isRecord(value)) {
        return null;
    }
    const content = value["content"];
    return typeof content === "string" ? { content } : null;
}
function azureThreadsUrl(context) {
    return `${azurePrBaseUrl(context)}/threads?api-version=7.1`;
}
function azureStatusesUrl(context) {
    return `${azurePrBaseUrl(context)}/statuses?api-version=7.1`;
}
function azurePrBaseUrl(context) {
    const project = encodeURIComponent(context.project);
    return `https://dev.azure.com/${context.org}/${project}/_apis/git/repositories/${context.repoId}/pullRequests/${context.prNumber}`;
}
function azureHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "umactually-pr-review",
    };
}

;// CONCATENATED MODULE: ./src/cli/live-github.ts



async function runGithubLive(input) {
    const { context, diffText, provider, parsed, fetchImpl } = input;
    const comments = selectPostableComments({
        review: provider.review,
        diffText,
        parsed,
        secrets: [context.token],
    });
    const postableComments = comments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        side: "RIGHT",
        body: comment.body,
    }));
    const body = buildReviewBody({
        review: provider.review,
        provider: provider.provider,
        modelId: provider.modelId,
        validCommentCount: comments.length,
        suppressedCommentCount: countSuppressedComments(provider.review, diffText),
        secrets: [context.token],
    });
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
        if (review !== null && review.body.includes(run_review_REVIEW_MARKER) && review.state !== "DISMISSED") {
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
            process.stderr.write(`::warning::umactually-pr-review: failed to update existing GitHub review ${input.review.id} (likely already submitted); falling back to DELETE+POST.\n`);
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
    process.stderr.write(`::warning::umactually-pr-review: failed to delete existing review ${input.review.id} (${response.status}); posting new review anyway.\n`);
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
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }
    const record = value;
    const id = record["id"];
    const body = record["body"];
    const state = record["state"];
    if (typeof id === "number" && Number.isSafeInteger(id) &&
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
function githubHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "umactually-pr-review",
    };
}

;// CONCATENATED MODULE: ./src/render/json-extract.ts
/**
 * Extract the most likely JSON payload from a provider text response.
 *
 * Order of attempts (mirrors the fence-closure guard in src/render/raw-output.ts):
 *   1. The whole text, parsed as JSON.
 *   2. A ```json ... ``` fence body, parsed as JSON.
 *   3. The first balanced { ... } object, parsed as JSON.
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
 * Find the body of a ```json ... ``` fence, or return the original text when none.
 * Exposed so callers can reuse the fence-closure guard from raw-output.ts.
 */
function extractJsonFenceBody(rawText) {
    const fenceMatch = /```json\s*\n([\s\S]*?)\n```/.exec(rawText);
    const body = fenceMatch?.[1];
    return body ?? rawText;
}
/**
 * Locate the first balanced `{ ... }` object in `rawText`, respecting nested
 * braces and quoted strings (including \" escapes). Returns null when no
 * balanced object can be found.
 */
function extractFirstBalancedObject(rawText) {
    const startIndex = rawText.indexOf("{");
    if (startIndex === -1) {
        return null;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
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
                return rawText.slice(startIndex, index + 1);
            }
        }
    }
    return null;
}
function tryParseJson(candidate) {
    try {
        return JSON.parse(candidate);
    }
    catch {
        return undefined;
    }
}

;// CONCATENATED MODULE: ./src/provider/provider-parse.ts

function buildResponsesBody(config) {
    const body = {
        model: config.model,
        input: [
            { role: "system", content: config.system },
            { role: "user", content: config.user },
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
function buildChatBody(config) {
    const body = {
        model: config.model,
        messages: [
            { role: "system", content: config.system },
            { role: "user", content: config.user },
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
function extractTextPayload(endpoint, rawText) {
    const parsed = provider_parse_tryParseJson(rawText);
    if (parsed === undefined || !isPlainObject(parsed)) {
        return rawText;
    }
    if (endpoint === "responses") {
        const direct = provider_parse_readStringField(parsed, "output_text");
        if (direct !== null) {
            return direct;
        }
        const output = readArrayField(parsed, "output");
        if (output !== null) {
            const fromOutput = joinOutputText(output);
            if (fromOutput.length > 0) {
                return fromOutput;
            }
        }
        return rawText;
    }
    const choices = readArrayField(parsed, "choices");
    if (choices === null) {
        return rawText;
    }
    for (const choice of choices) {
        const message = readRecordField(choice, "message");
        if (message === null) {
            continue;
        }
        const content = provider_parse_readStringField(message, "content");
        if (content !== null) {
            return content;
        }
    }
    return rawText;
}
function parseReviewPayload(text) {
    const candidate = extractJsonBlock(text);
    if (!isPlainObject(candidate)) {
        return null;
    }
    return {
        summary: provider_parse_readStringField(candidate, "summary") ?? "",
        verdict: provider_parse_readStringField(candidate, "verdict") ?? "",
        comments: provider_parse_readCommentArray(candidate["comments"]),
        suppressed_comments: provider_parse_readCommentArray(candidate["suppressed_comments"]),
    };
}
function joinOutputText(output) {
    const fragments = [];
    for (const entry of output) {
        if (!isPlainObject(entry)) {
            continue;
        }
        const content = entry["content"];
        if (!isPlainObject(content)) {
            continue;
        }
        const text = content["text"];
        if (typeof text === "string") {
            fragments.push(text);
        }
    }
    return fragments.join("\n");
}
function provider_parse_readCommentArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const comments = [];
    for (const entry of value) {
        if (!isPlainObject(entry)) {
            continue;
        }
        const path = entry["path"];
        const line = entry["line"];
        if (typeof path === "string" && typeof line === "number" && Number.isFinite(line)) {
            comments.push({
                path,
                line,
                body: provider_parse_readStringField(entry, "body") ?? "",
                severity: provider_parse_readStringField(entry, "severity") ?? "medium",
                category: provider_parse_readStringField(entry, "category") ?? "general",
            });
        }
    }
    return comments;
}
function provider_parse_tryParseJson(rawText) {
    try {
        return JSON.parse(rawText);
    }
    catch {
        return undefined;
    }
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function provider_parse_readStringField(record, key) {
    const value = record[key];
    return typeof value === "string" ? value : null;
}
function readArrayField(record, key) {
    const value = record[key];
    return Array.isArray(value) ? value : null;
}
function readRecordField(value, key) {
    if (!isPlainObject(value)) {
        return null;
    }
    const inner = value[key];
    return isPlainObject(inner) ? inner : null;
}

;// CONCATENATED MODULE: ./src/provider/provider-error.ts
class ProviderError extends Error {
    code;
    endpoint;
    status;
    requestId;
    name = "ProviderError";
    constructor(code, endpoint, status, requestId, message, options) {
        super(message, options);
        this.code = code;
        this.endpoint = endpoint;
        this.status = status;
        this.requestId = requestId;
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
    const envelope = safeParseJson(rawText);
    if (!copilot_token_isRecord(envelope)) {
        return {
            ok: false,
            error: new ProviderError("parse", endpoint, response.status, requestId, "Copilot session token response was not a JSON object."),
        };
    }
    const token = copilot_token_readStringField(envelope, "token");
    const expiresAt = copilot_token_readNumberField(envelope, "expires_at");
    const endpoints = copilot_token_readRecordField(envelope, "endpoints");
    const chatApiBase = endpoints === null ? null : copilot_token_readStringField(endpoints, "api");
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
function safeParseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function copilot_token_isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function copilot_token_readStringField(record, key) {
    const value = record[key];
    return typeof value === "string" ? value : null;
}
function copilot_token_readNumberField(record, key) {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function copilot_token_readRecordField(value, key) {
    if (!copilot_token_isRecord(value)) {
        return null;
    }
    const inner = value[key];
    return copilot_token_isRecord(inner) ? inner : null;
}

;// CONCATENATED MODULE: ./src/provider/copilot.ts



const DEFAULT_GITHUB_API_BASE = "https://api.github.com";
const COPILOT_EDITOR_VERSION = "vscode/1.96.0";
const COPILOT_EDITOR_PLUGIN_VERSION = "umactually-pr-review/0.1.0";
const COPILOT_INTEGRATION_ID = "vscode-chat";
const COPILOT_USER_AGENT = "umactually-pr-review/0.1.0";
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
    const signal = AbortSignal.timeout(config.requestTimeoutMs);
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
    if (review === null) {
        return {
            ok: false,
            error: new ProviderError("parse", ENDPOINT_CHAT, response.status, requestId, "Provider response did not contain a JSON review payload."),
        };
    }
    return { ok: true, endpoint: "chat", review, requestId };
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
function joinUrl(baseUrl, path) {
    const trimmedBase = baseUrl.replace(/\/+$/u, "");
    const prefixedPath = path.startsWith("/") ? path : `/${path}`;
    return `${trimmedBase}${prefixedPath}`;
}
function createRequestId() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof cryptoApi.getRandomValues === "function") {
        cryptoApi.getRandomValues(bytes);
    }
    else {
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

;// CONCATENATED MODULE: ./src/provider/openai-compatible.ts


const ENDPOINT_RESPONSES = "responses";
const openai_compatible_ENDPOINT_CHAT = "chat";

async function runProviderRequest(config) {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const requestId = openai_compatible_createRequestId();
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
            await openai_compatible_sleep(backoffMs);
        }
    }
    return { ok: false, error: lastFailure ?? new ProviderError("network", endpoint, null, requestId, "Unknown retry failure.") };
}
function isRetryable(error) {
    return error.status === 429 || (typeof error.status === "number" && error.status >= 500);
}
function openai_compatible_sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
async function callEndpoint(config, fetchImpl, requestId, endpoint) {
    const url = openai_compatible_joinUrl(config.baseUrl, endpoint === ENDPOINT_RESPONSES ? "/responses" : "/chat/completions");
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
    const review = parseReviewPayload(textPayload);
    if (review === null) {
        throw new ProviderError("parse", endpoint, response.status, requestId, "Provider response did not contain a JSON review payload.");
    }
    return { ok: true, endpoint, review, requestId };
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
function composeSignal(signal, timeoutMs) {
    if (signal === undefined) {
        return AbortSignal.timeout(timeoutMs);
    }
    return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}
function openai_compatible_joinUrl(baseUrl, path) {
    const trimmedBase = baseUrl.replace(/\/+$/u, "");
    const prefixedPath = path.startsWith("/") ? path : `/${path}`;
    return `${trimmedBase}${prefixedPath}`;
}
function openai_compatible_createRequestId() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof cryptoApi.getRandomValues === "function") {
        cryptoApi.getRandomValues(bytes);
    }
    else {
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
const REDACTED = "[REDACTED]";

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

const DEFAULT_PROMPT_BYTE_CAP = 64 * 1024;
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
    const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");
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
                review: buildMalformedProviderFallback(),
                endpoint: result.error.endpoint,
                provider: COPILOT_PROVIDER_NAME,
                modelId,
            };
        }
        throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
    }
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
            review: buildMalformedProviderFallback(),
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
function buildMalformedProviderFallback() {
    return {
        summary: "Provider response did not contain a valid JSON review payload.",
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [],
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
    process.stdout.write(`umactually-pr-review: sonar quality gate ${sonarReport.qualityGateStatus} (${sonarReport.importedFindingCount} findings, waited=${sonarReport.waitedForTerminalQualityGate})${sonarReport.timeoutHandled ? " [timeout handled]" : ""}\n`);
    if (sonarReport.errorMessage !== undefined) {
        process.stderr.write(`::warning::umactually-pr-review: ${sonarReport.errorMessage}\n`);
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
            if (rawLine.startsWith("+++ ")) {
                const [rawPath] = rawLine.slice(4).split("\t");
                if (rawPath !== undefined) {
                    const path = rawPath.trim();
                    if (path !== "/dev/null") {
                        const normalized = path.startsWith("b/") ? path.slice(2) : path;
                        if (normalized === position.path) {
                            currentPath = targetPath;
                        }
                        else {
                            currentPath = normalized;
                        }
                    }
                }
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
 * `@@ -1,4 +1,7 @@` → 1. Returns null when the header is malformed.
 */
function parseHunkStart(line) {
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
    return Number.isSafeInteger(start) && start > 0 ? start : null;
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
        const message = `umactually-pr-review: --simulate-findings set but ignored (live result has ${liveCommentCount} inline, ${liveSuppressedCount} suppressed). Live findings always win.`;
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










async function runLive(input) {
    const env = input.env ?? process.env;
    const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const platform = detectLivePlatform(env);
    if (platform === null) {
        const message = "Live review requires GitHub Actions (GITHUB_ACTIONS=true) or Azure Pipelines (TF_BUILD=True).";
        process.stdout.write(`umactually-pr-review: ${message}\n`);
        return {
            exitCode: 1,
            posted: false,
            reviewId: undefined,
            message,
        };
    }
    const providerUrl = input.parsed.apiUrl ?? env["UMACTUALLY_API_URL"];
    if (providerUrl === undefined || providerUrl.length === 0) {
        const message = "UMACTUALLY_API_URL must be set for live review.";
        process.stdout.write(`umactually-pr-review: ${message}\n`);
        return {
            exitCode: 1,
            posted: false,
            reviewId: undefined,
            message,
        };
    }
    const providerKey = input.parsed.apiKey ?? env["UMACTUALLY_API_KEY"];
    if (providerKey === undefined || providerKey.length === 0) {
        const message = "UMACTUALLY_API_KEY must be set for live review.";
        process.stdout.write(`umactually-pr-review: ${message}\n`);
        return {
            exitCode: 1,
            posted: false,
            reviewId: undefined,
            message,
        };
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
        const message = error instanceof Error ? error.message : String(error);
        const sanitized = sanitizeForPost(message, readSecretValues(env));
        process.stdout.write(`umactually-pr-review: ${sanitized}\n`);
        return {
            exitCode: 1,
            posted: false,
            reviewId: undefined,
            message: sanitized,
        };
    }
    if (result.posted) {
        process.stdout.write(`umactually-pr-review: ${result.message}\n`);
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
                process.stderr.write(`::error::umactually-pr-review: ${leakGate.message}\n`);
                return {
                    exitCode: 1,
                    posted: false,
                    reviewId: undefined,
                    message: leakGate.message,
                };
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
                process.stderr.write(`::error::umactually-pr-review: ${leakGate.message}\n`);
                return {
                    exitCode: 1,
                    posted: false,
                    reviewId: undefined,
                    message: leakGate.message,
                };
            }
            const liveOutcome = await requestLiveReview({
                parsed,
                cwd,
                env,
                fetchImpl,
                platform: "azure",
                diffText,
                platformToken: context.token,
                ...(sonarContext !== undefined ? { sonarContext } : {}),
            });
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
    if (env["GITHUB_ACTIONS"] === "true") {
        return "github";
    }
    if (env["TF_BUILD"] === "True") {
        return "azure";
    }
    return null;
}
function readSecretValues(env) {
    return [
        env["UMACTUALLY_API_KEY"] ?? "",
        env["REVIEW_PROVIDER_API_KEY"] ?? "",
        env["GITHUB_TOKEN"] ?? "",
        env["SYSTEM_ACCESSTOKEN"] ?? "",
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
        throw new CliArgumentError(`failed to read ${label} file ${absolute}: ${stringifyError(error)}`);
    }
}
async function readOptionalFile(path, cwd, fallback, label) {
    if (path === null || path.length === 0) {
        return fallback;
    }
    return readRequiredFile(path, cwd, label);
}
function stringifyError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
class CliArgumentError extends Error {
    name = "CliArgumentError";
}
function dispatchLive(parsed, cwd, env) {
    // Live orchestration lives in src/cli/orchestrator.ts so the dry-run path
    // keeps a single-responsibility surface. This thin wrapper exists only to
    // preserve the public CLI module exports expected by existing tests.
    // Static import (no dynamic import()) so ncc emits a single bundle chunk
    // rather than a content-hashed dynamic chunk that would need to be committed.
    return runLive({ parsed, cwd, env }).then((result) => ({
        exitCode: result.exitCode,
    }));
}

;// CONCATENATED MODULE: ./src/cli/validate.ts
function resolvePlatform(platform, env = process.env) {
    switch (platform) {
        case "github":
            return "github";
        case "azure":
            return "azure";
        case "auto":
            return env["TF_BUILD"] === "True" ? "azure" : "github";
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
        if (parsed.apiUrl === null) {
            errors.push("--api-url is required unless --dry-run is set");
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
        if (error instanceof Error) {
            process.stderr.write(`cli: unexpected error: ${error.message}\n`);
        }
        else {
            process.stderr.write(`cli: unexpected error: ${String(error)}\n`);
        }
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
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`cli: fatal: ${message}\n`);
        process.exit(1);
    });
}
function pathToFileUrl(value) {
    return new URL(`file://${value.replace(/\\/gu, "/")}`).href;
}

var __webpack_exports__CliUsageError = __webpack_exports__._x;
var __webpack_exports__main = __webpack_exports__.iW;
var __webpack_exports__parseCliArgs = __webpack_exports__.hT;
var __webpack_exports__runCli = __webpack_exports__.ak;
export { __webpack_exports__CliUsageError as CliUsageError, __webpack_exports__main as main, __webpack_exports__parseCliArgs as parseCliArgs, __webpack_exports__runCli as runCli };
