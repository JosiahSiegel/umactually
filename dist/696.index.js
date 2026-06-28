export const id = 696;
export const ids = [696];
export const modules = {

/***/ 696:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  runLive: () => (/* binding */ runLive)
});

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
const PULL_FILES_MEDIA_TYPE = "application/vnd.github.v3.diff";
async function fetchGithubPrDiff(context, fetchImpl = fetch) {
    const url = buildPullFilesUrl(context);
    const response = await fetchImpl(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${context.token}`,
            Accept: PULL_FILES_MEDIA_TYPE,
            "User-Agent": "umactually-pr-review",
        },
    });
    if (!response.ok) {
        throw new GithubApiError("GITHUB_FETCH_FAILED", response.status, `GitHub PR files request failed with status ${response.status}.`);
    }
    const diffText = await response.text();
    if (diffText.length === 0) {
        throw new GithubApiError("GITHUB_DIFF_EMPTY", response.status, "GitHub PR files response body was empty.");
    }
    return diffText;
}
function buildPullFilesUrl(context) {
    const repositorySegment = `${context.repo.owner}/${context.repo.name}`;
    return `${GITHUB_API_BASE_URL}/repos/${repositorySegment}/pulls/${context.prNumber}/files`;
}

// EXTERNAL MODULE: external "node:fs/promises"
var promises_ = __webpack_require__(455);
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
    const rawPayload = await (0,promises_.readFile)(eventPath, "utf8");
    const parsed = JSON.parse(rawPayload);
    if (!isObject(parsed)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must parse as a JSON object.");
    }
    const pullRequest = parsed["pull_request"];
    if (!isObject(pullRequest)) {
        throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must contain a 'pull_request' object.");
    }
    const repository = readRecord(parsed, "repository");
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
function readRecord(value, label) {
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

// EXTERNAL MODULE: ./src/diff/parse-positions.ts
var parse_positions = __webpack_require__(713);
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
    const positions = (0,parse_positions/* parseDiffPositions */.V)(diffText);
    const enumerated = positions.enumerate();
    const inlineBlueprints = buildDiverseBlueprints(enumerated, diffText);
    const comments = [];
    for (const blueprint of inlineBlueprints) {
        if (positions.hasPosition(blueprint)) {
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

// EXTERNAL MODULE: ./src/review/run-review.ts
var run_review = __webpack_require__(702);
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
    return {
        model: config.model,
        input: [
            { role: "system", content: config.system },
            { role: "user", content: config.user },
        ],
    };
}
function buildChatBody(config) {
    return {
        model: config.model,
        messages: [
            { role: "system", content: config.system },
            { role: "user", content: config.user },
        ],
    };
}
function extractTextPayload(endpoint, rawText) {
    const parsed = provider_parse_tryParseJson(rawText);
    if (parsed === undefined || !isPlainObject(parsed)) {
        return rawText;
    }
    if (endpoint === "responses") {
        const direct = readStringField(parsed, "output_text");
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
        const content = readStringField(message, "content");
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
        summary: readStringField(candidate, "summary") ?? "",
        verdict: readStringField(candidate, "verdict") ?? "",
        comments: readCommentArray(candidate["comments"]),
        suppressed_comments: readCommentArray(candidate["suppressed_comments"]),
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
function readCommentArray(value) {
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
                body: readStringField(entry, "body") ?? "",
                severity: readStringField(entry, "severity") ?? "medium",
                category: readStringField(entry, "category") ?? "general",
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
function readStringField(record, key) {
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

;// CONCATENATED MODULE: ./src/provider/openai-compatible.ts


const ENDPOINT_RESPONSES = "responses";
const ENDPOINT_CHAT = "chat";

async function runProviderRequest(config) {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const requestId = createRequestId();
    const firstAttempt = await runWithEndpoint(config, fetchImpl, requestId, ENDPOINT_RESPONSES);
    if (firstAttempt.ok) {
        return firstAttempt;
    }
    if (shouldFallback(firstAttempt.error)) {
        return runWithEndpoint(config, fetchImpl, requestId, ENDPOINT_CHAT);
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

// EXTERNAL MODULE: ./src/security/scan-review-secrets.ts
var scan_review_secrets = __webpack_require__(650);
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
const DEFAULT_MODEL = "auto";
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_COMMENTS = 50;
const PROVIDER_NAME = "openai-compatible";
async function requestLiveReview(input) {
    await (0,scan_review_secrets/* scanReviewSecrets */.R)({
        diffText: input.diffText,
        expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });
    const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");
    const providerApiKey = readRequiredConfig(input.parsed.apiKey ?? input.env["UMACTUALLY_API_KEY"], "UMACTUALLY_API_KEY");
    const modelId = readConfiguredModel(input.parsed, input.env);
    const prompts = await buildProviderPrompts(input);
    const result = await runProviderRequest({
        baseUrl: providerUrl,
        apiKey: providerApiKey,
        model: modelId,
        system: prompts.system,
        user: prompts.user,
        requestTimeoutMs: readRequestTimeoutMs(input.parsed),
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
function buildReviewBody(input) {
    const rawBody = [
        run_review/* REVIEW_MARKER */.a,
        sanitizeForPost(input.review.summary, input.secrets),
        "",
        `${sanitizeForPost(input.modelId, input.secrets)} (${sanitizeForPost(input.provider, input.secrets)})`,
        "",
        `Findings: ${input.validCommentCount} inline, ${input.suppressedCommentCount} suppressed.`,
    ].join("\n");
    return sanitizeForPost(rawBody, input.secrets);
}
function selectPostableComments(input) {
    const positions = (0,parse_positions/* parseDiffPositions */.V)(input.diffText);
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
    const positions = (0,parse_positions/* parseDiffPositions */.V)(diffText);
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
    if (!isRecord(value)) {
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
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function buildProviderPrompts(input) {
    const additionalPrompt = await readAdditionalPrompt(input);
    return {
        system: [
            "You are UmActually, a precise pull request reviewer.",
            "Return strict JSON only with this schema:",
            "{\"summary\":string,\"verdict\":\"COMMENT\"|\"APPROVED\"|\"NEEDS_FIX\",\"comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}],\"suppressed_comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}]}",
            "Anchor comments only to changed or context lines present in the diff. Do not include secrets.",
        ].join("\n"),
        user: [
            `Platform: ${input.platform}`,
            additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
            "Diff:",
            input.diffText,
        ].join("\n\n"),
    };
}
async function readAdditionalPrompt(input) {
    const filePath = input.parsed.additionalPromptFile ?? input.env["UMACTUALLY_ADDITIONAL_PROMPT_FILE"];
    if (filePath === undefined || filePath.length === 0) {
        return "";
    }
    return (0,promises_.readFile)(new URL(filePath, `file://${input.cwd.replace(/\\/gu, "/")}/`), "utf8");
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
function sanitizeInlineBody(comment, secrets) {
    const prefix = `**${comment.severity} ${comment.category}**`;
    const body = comment.body.length > 0 ? comment.body : `Finding at ${comment.path}:${comment.line}.`;
    return sanitizeForPost(`${prefix}\n\n${body}`, secrets);
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
    return seconds === null || seconds <= 0 ? DEFAULT_REQUEST_TIMEOUT_MS : seconds * 1_000;
}
function buildMalformedProviderFallback() {
    return {
        summary: "Provider response did not contain a valid JSON review payload.",
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [],
    };
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
    for (const comment of comments) {
        if (hasDuplicateThread(existingThreads, comment)) {
            continue;
        }
        const threadId = await postAzureThread({ context, fetchImpl, comment, body });
        if (threadId !== undefined) {
            postedIds.push(threadId);
        }
    }
    await postAzureStatus({
        context,
        fetchImpl,
        state: mapReviewVerdictToAzureStatus(provider.review.verdict),
        description: provider.review.summary,
    });
    const firstPostedId = postedIds[0];
    return {
        exitCode: 0,
        posted: true,
        reviewId: firstPostedId,
        message: `posted Azure review (${postedIds.length} threads)`,
    };
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
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(parseAzureThread).filter((thread) => thread !== null);
}
function hasDuplicateThread(threads, comment) {
    const azurePath = `/${comment.path}`;
    for (const thread of threads) {
        const firstComment = thread.comments[0];
        if (thread.status === "active" &&
            thread.threadContext.filePath === azurePath &&
            thread.threadContext.rightFileStart.line === comment.line &&
            firstComment?.content.includes(run_review/* REVIEW_MARKER */.a) === true) {
            return true;
        }
    }
    return false;
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
    if (!isRecord(value)) {
        return null;
    }
    const status = value["status"];
    const context = value["threadContext"];
    const comments = value["comments"];
    if (typeof status !== "string" || !isRecord(context) || !Array.isArray(comments)) {
        return null;
    }
    const start = readRightFileStart(context);
    const filePath = context["filePath"];
    if (typeof filePath !== "string" || start === null) {
        return null;
    }
    return {
        status,
        threadContext: { filePath, rightFileStart: start },
        comments: comments.map(parseAzureComment).filter((comment) => comment !== null),
    };
}
function readRightFileStart(context) {
    const start = context["rightFileStart"];
    if (!isRecord(start)) {
        return null;
    }
    const line = start["line"];
    return typeof line === "number" && Number.isSafeInteger(line) ? { line } : null;
}
function parseAzureComment(value) {
    if (!isRecord(value)) {
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
    if (existing !== null && postableComments.length === 0) {
        const reviewId = await updateExistingReview({ context, fetchImpl, review: existing, body });
        return { exitCode: 0, posted: true, reviewId, message: "updated existing GitHub review" };
    }
    if (existing !== null) {
        await deleteExistingReview({ context, fetchImpl, review: existing });
    }
    const reviewId = await createGithubReview({
        context,
        fetchImpl,
        body,
        event: mapReviewVerdictToGithubEvent(provider.review.verdict),
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
        if (review !== null && review.body.includes(run_review/* REVIEW_MARKER */.a)) {
            return review;
        }
    }
    return null;
}
async function updateExistingReview(input) {
    const response = await input.fetchImpl(`${githubReviewsUrl(input.context)}/${input.review.id}`, {
        method: "PUT",
        headers: githubHeaders(input.context.token),
        body: JSON.stringify({ body: input.body }),
    });
    ensureHttpOk(response, "GITHUB_UPDATE_REVIEW_FAILED", "GitHub update review");
    return input.review.id;
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
    if (typeof id === "number" && Number.isSafeInteger(id) && typeof body === "string") {
        return { id, body };
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
    let result;
    try {
        result = await dispatchLivePlatform({
            platform,
            parsed: input.parsed,
            cwd: input.cwd,
            env,
            fetchImpl,
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
 * calls the live provider, and — when `simulateFindings` is true and the
 * provider returned a structurally empty payload — replaces the payload with
 * the deterministic fixture in `src/review/simulated-findings.ts`. The
 * replacement is a no-op when the live provider already returned real findings.
 */
async function dispatchLivePlatform(input) {
    const { platform, parsed, cwd, env, fetchImpl } = input;
    switch (platform) {
        case "github": {
            const context = await readGithubContext(env);
            const diffText = await fetchGithubPrDiff(context, fetchImpl);
            const liveOutcome = await requestLiveReview({
                parsed,
                cwd,
                env,
                fetchImpl,
                platform: "github",
                diffText,
                platformToken: context.token,
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
            const liveOutcome = await requestLiveReview({
                parsed,
                cwd,
                env,
                fetchImpl,
                platform: "azure",
                diffText,
                platformToken: context.token,
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
            return assertNever(platform);
    }
}
/**
 * Replaces the provider outcome's payload with the deterministic fixture when
 * `simulateFindings` is true AND the live provider returned an empty result.
 * Live findings always win: a non-empty result is returned unchanged.
 */
function applySimulateFindings(input) {
    if (!input.simulateFindings) {
        return input.outcome;
    }
    if (!isStructurallyEmptyReview(input.outcome.review)) {
        return input.outcome;
    }
    const fixture = buildSimulatedFindings(input.repo, input.prNumber, input.headSha, input.diffText);
    // Sanitize the fixture through the same sanitizer the live path uses so
    // bodies cannot accidentally carry the API key or auth headers.
    const sanitizedComments = fixture.comments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        body: sanitizeForPost(comment.body, input.secrets),
        severity: sanitizeForPost(comment.severity, input.secrets),
        category: sanitizeForPost(comment.category, input.secrets),
    }));
    const sanitizedSuppressed = fixture.suppressed_comments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        body: sanitizeForPost(comment.body, input.secrets),
        severity: sanitizeForPost(comment.severity, input.secrets),
        category: sanitizeForPost(comment.category, input.secrets),
    }));
    return {
        ...input.outcome,
        review: {
            summary: sanitizeForPost(fixture.summary, input.secrets),
            verdict: fixture.verdict,
            comments: sanitizedComments,
            suppressedComments: sanitizedSuppressed,
        },
    };
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
function assertNever(value) {
    throw new TypeError(`Unhandled live platform: ${value}`);
}


/***/ })

};
