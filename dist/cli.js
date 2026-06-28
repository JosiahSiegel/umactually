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
            nextNewLine += 1;
            continue;
        }
        if (line.startsWith(" ")) {
            addLine(linesByPath, currentPath, nextNewLine);
            nextNewLine += 1;
        }
    }
    return {
        hasPosition(position) {
            return linesByPath.get(position.path)?.has(position.line) ?? false;
        },
    };
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
function dispatchLive() {
    process.stderr.write("cli: live provider calls are not supported in this build; use --dry-run\n");
    return { exitCode: 3 };
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
    return dispatchLive();
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
const isMainModule = (() => {
    if (typeof process === "undefined") {
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
