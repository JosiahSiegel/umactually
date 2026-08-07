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
  readonly droppedMalformedCount: number;
  readonly cappedAtIssueCount: number;
};

const MAX_SONAR_ISSUES = 100;
const MAX_PAGES = 10;
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

function parseIssue(value: unknown, projectKey: string, prNumber: number): LiveReviewComment | null {
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
  const url = `https://sonarcloud.io/project/issues?id=${encodeURIComponent(projectKey)}&pullRequest=${encodeURIComponent(String(prNumber))}&open=${encodeURIComponent(rule)}`;
  const body = `**SonarCloud ${typeof severity === "string" ? severity : "MAJOR"} — \`${rule}\`**\n\n${bodyMessage}\n\n[Open in SonarCloud](${url})`;
  return { path, line, body, severity: mapSeverity(severity), category: "sonar" };
}

type FetchSonarIssuesPageInput = {
  readonly baseUrl: string;
  readonly projectKey: string;
  readonly prNumber: number;
  readonly page: number;
  readonly headers: Record<string, string>;
  readonly timeoutMs?: number;
  readonly fetchImpl: FetchImpl;
};

type FetchSonarIssuesPageResult = {
  readonly findings: readonly LiveReviewComment[];
  readonly total: number;
  readonly issues: readonly unknown[];
};

async function fetchSonarIssuesPage(input: FetchSonarIssuesPageInput): Promise<FetchSonarIssuesPageResult | null> {
  const { baseUrl, projectKey, prNumber, page, headers, timeoutMs, fetchImpl } = input;
  const url = new URL(`${baseUrl}/api/issues/search`);
  url.searchParams.set("componentKeys", projectKey);
  url.searchParams.set("pullRequest", String(prNumber));
  url.searchParams.set("inNewCodePeriod", "true");
  url.searchParams.set("resolved", "false");
  url.searchParams.set("ps", String(MAX_SONAR_ISSUES));
  url.searchParams.set("p", String(page));
  let raw: unknown;
  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers,
      ...(timeoutMs !== undefined ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
    ensureHttpOk(response, "SONAR_ISSUES_API_FAILED", "SonarCloud issues API", "Verify SonarCloud configuration and token.");
    raw = await readJsonResponse(response);
  } catch (error) {
    writeBrandedAnnotation("warning", `failed to fetch SonarCloud PR issues; treating as zero findings (best-effort fetch). ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  if (!isRecord(raw)) {
    writeBrandedAnnotation("warning", "SonarCloud issues API returned a non-record JSON body; treating as zero findings.");
    return null;
  }
  const total = isSafeInteger(raw["total"]) ? raw["total"] : 0;
  const issues = raw["issues"];
  if (!isUnknownArray(issues)) {
    writeBrandedAnnotation("warning", "SonarCloud issues API returned a body without an `issues` array; treating as zero findings.");
    return null;
  }
  const findings: LiveReviewComment[] = [];
  for (const entry of issues) {
    const finding = parseIssue(entry, projectKey, prNumber);
    if (finding !== null) findings.push(finding);
  }
  return { findings, total, issues };
}

export async function fetchSonarPrIssues(input: {
  readonly config: FetchSonarPrIssuesConfig;
  readonly fetchImpl: FetchImpl;
}): Promise<FetchSonarPrIssuesResult> {
  const { config, fetchImpl } = input;
  const baseUrl = stripTrailingSlash(config.hostUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/json",
  };
  const findings: LiveReviewComment[] = [];
  let droppedMalformedCount = 0;
  let total = 0;
  let page = 1;

  while (page <= MAX_PAGES) {
    const pageResult = await fetchSonarIssuesPage({
      baseUrl,
      projectKey: config.projectKey,
      prNumber: config.prNumber,
      page,
      headers,
      ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
      fetchImpl,
    });
    if (pageResult === null) break;
    for (const finding of pageResult.findings) findings.push(finding);
    droppedMalformedCount += pageResult.issues.length - pageResult.findings.length;
    total = pageResult.total;
    if (pageResult.issues.length < MAX_SONAR_ISSUES || findings.length + droppedMalformedCount >= total) break;
    page += 1;
  }
  if (page > MAX_PAGES && findings.length + droppedMalformedCount < total) {
    writeBrandedAnnotation("warning", `SonarCloud PR issues pagination guard tripped at ${MAX_PAGES} pages (${findings.length + droppedMalformedCount} of ${total} findings collected); the remainder is not imported.`);
  }
  return { findings, total, droppedMalformedCount, cappedAtIssueCount: Math.max(0, total - findings.length - droppedMalformedCount) };
}
