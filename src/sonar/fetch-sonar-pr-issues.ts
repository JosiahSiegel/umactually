import { isRecord, isSafeInteger, isUnknownArray } from "../util/json-guards.js";
import { writeBrandedAnnotation } from "../util/log.js";
import { stripTrailingSlash } from "../util/url.js";
import { ensureHttpOk, readJsonResponse, type FetchImpl, type LiveReviewComment } from "../cli/live-shared.js";

export type FetchSonarPrIssuesConfig = {
  readonly hostUrl: string;
  readonly token: string;
  readonly projectKey: string;
  readonly prNumber: number;
  readonly timeoutMs?: number;
};

export type FetchSonarPrIssuesResult = {
  readonly findings: readonly LiveReviewComment[];
  readonly total: number;
  readonly truncated: boolean;
};

const DEFAULT_PAGE_SIZE = 100;
const SEVERITY_MAP: Readonly<Record<string, LiveReviewComment["severity"]>> = {
  BLOCKER: "critical",
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
  INFO: "info",
};

function mapSeverity(raw: unknown): LiveReviewComment["severity"] {
  if (typeof raw !== "string") return "major";
  return SEVERITY_MAP[raw.toUpperCase()] ?? "major";
}

function stripProjectKeyPrefix(component: string, projectKey: string): string | null {
  const prefix = `${projectKey}:`;
  if (!component.startsWith(prefix)) return null;
  const stripped = component.slice(prefix.length);
  return stripped.length === 0 ? null : stripped;
}

function parseIssue(value: unknown, projectKey: string): LiveReviewComment | null {
  if (!isRecord(value)) return null;
  const component = value["component"];
  const rule = value["rule"];
  const line = value["line"];
  const severity = value["severity"];
  const message = value["message"];
  if (typeof component !== "string") return null;
  if (typeof rule !== "string" || rule.length === 0) return null;
  if (!isSafeInteger(line) || line <= 0) return null;
  const path = stripProjectKeyPrefix(component, projectKey);
  if (path === null) return null;
  const bodyMessage = typeof message === "string" ? message : "";
  const url = `https://sonarcloud.io/project/issues?id=${encodeURIComponent(projectKey)}&pullRequest=${encodeURIComponent(String(component))}&open=${encodeURIComponent(rule)}`;
  const body = `**SonarCloud ${typeof severity === "string" ? severity : "MAJOR"} — \`${rule}\`**\n\n${bodyMessage}\n\n[Open in SonarCloud](${url})`;
  return {
    path,
    line,
    body,
    severity: mapSeverity(severity),
    category: "sonar",
  };
}

/**
 * Fetch SonarCloud issues for the given PR directly from the SonarCloud Web
 * API and convert each one to a `LiveReviewComment`. This is the new
 * api-direct path that replaces the prior PR-comment-fetch loop — it
 * queries `/api/issues/search` with the `pullRequest` filter, so every
 * reported issue is for THIS PR (no comment-fetch dedup needed) and the
 * component is `projectKey:filePath` (strip the prefix before posting).
 *
 * Each finding carries `category: "sonar"` so the downstream
 * `preparePostedReview` → `selectPostableComments` → position-validation
 * pipeline can detect them and the severity-policy + verdict-reconciliation
 * rules treat them like model findings. The author of the inline comment
 * in the bot's review (see `buildInlineCommentBody`) prefixes with
 * `` `severity` `sonar` `` so a reviewer can tell the thread came from
 * SonarCloud without the legacy `<!-- sonarcloud -->` marker.
 *
 * Failure modes:
 *   - Any non-OK HTTP response → emit `::warning::`, return empty result.
 *   - Malformed JSON / non-record response → emit `::warning::`, return empty result.
 *   - Missing fields on an individual issue (no rule, no component, no
 *     positive integer line, no projectKey prefix) → drop the issue
 *     silently and continue. File-level issues (`line === 0` / null /
 *     absent) are dropped because GitHub's inline-comment API rejects
 *     `line: 0` with 422 — surfacing them would require a separate
 *     conversation comment, which the bot review body already covers via
 *     the `Findings (N sonar)` block.
 */
export async function fetchSonarPrIssues(input: {
  readonly config: FetchSonarPrIssuesConfig;
  readonly fetchImpl: FetchImpl;
}): Promise<FetchSonarPrIssuesResult> {
  const { config, fetchImpl } = input;
  const baseUrl = stripTrailingSlash(config.hostUrl);
  const url = `${baseUrl}/api/issues/search?componentKeys=${encodeURIComponent(config.projectKey)}&pullRequest=${encodeURIComponent(String(config.prNumber))}&inNewCodePeriod=true&resolved=false&ps=${DEFAULT_PAGE_SIZE}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/json",
  };

  let raw: unknown;
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      ...(config.timeoutMs !== undefined ? { signal: AbortSignal.timeout(config.timeoutMs) } : {}),
    });
    ensureHttpOk(
      response,
      "SONAR_ISSUES_API_FAILED",
      "SonarCloud issues API",
      "Verify SONAR_TOKEN, SONAR_HOST_URL, and SONAR_PROJECT_KEY are set; the SonarCloud API responds with 401 when the token is invalid and 403 when the project is not visible to the token's account. The SonarCloud Code Analysis check is still the authoritative merge gate.",
    );
    raw = await readJsonResponse(response);
  } catch (error) {
    writeBrandedAnnotation(
      "warning",
      `failed to fetch SonarCloud PR issues; treating as zero findings (best-effort fetch). ${error instanceof Error ? error.message : String(error)}`,
    );
    return { findings: [], total: 0, truncated: false };
  }
  if (!isRecord(raw)) {
    writeBrandedAnnotation(
      "warning",
      "SonarCloud issues API returned a non-record JSON body; treating as zero findings.",
    );
    return { findings: [], total: 0, truncated: false };
  }
  const total = isSafeInteger(raw["total"]) ? raw["total"] : 0;
  const issues = raw["issues"];
  if (!isUnknownArray(issues)) {
    writeBrandedAnnotation(
      "warning",
      "SonarCloud issues API returned a body without an `issues` array; treating as zero findings.",
    );
    return { findings: [], total, truncated: false };
  }
  const findings: LiveReviewComment[] = [];
  for (const entry of issues) {
    const finding = parseIssue(entry, config.projectKey);
    if (finding !== null) {
      findings.push(finding);
    }
  }
  const truncated = findings.length < issues.length || total > findings.length;
  return { findings, total, truncated };
}