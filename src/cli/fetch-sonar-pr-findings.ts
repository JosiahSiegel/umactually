import { type GithubContext } from "../platform/github/context.js";
import { githubHeaders } from "../util/http.js";
import { isRecord, isSafeInteger } from "../util/json-guards.js";
import { writeBrandedAnnotation } from "../util/log.js";
import { DEFAULT_GITHUB_API_BASE } from "../util/provider-defaults.js";
import { ensureHttpOk, readJsonResponse, type FetchImpl, type LiveReviewComment } from "./live-shared.js";

const GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") ?? DEFAULT_GITHUB_API_BASE;

const SONAR_PR_FINDING_MARKER = "<!-- sonarcloud -->";
const MAX_SONAR_PR_FINDINGS = 50;

export type SonarPrFinding = {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: "info" | "minor" | "major" | "critical" | "security" | "leak";
};

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
export async function fetchSonarPrFindings(input: {
  readonly context: GithubContext;
  readonly fetchImpl: FetchImpl;
}): Promise<readonly LiveReviewComment[]> {
  const url = `${GITHUB_API_BASE_URL}/repos/${encodeURIComponent(input.context.repo.owner)}/${encodeURIComponent(input.context.repo.name)}/pulls/${input.context.prNumber}/comments?per_page=${MAX_SONAR_PR_FINDINGS}`;
  let raw: unknown;
  try {
    const response = await input.fetchImpl(url, {
      method: "GET",
      headers: githubHeaders(input.context.token),
    });
    ensureHttpOk(
      response,
      "GITHUB_LIST_PR_COMMENTS_FAILED",
      "GitHub list PR review comments",
      "Verify GITHUB_TOKEN has `pull_requests: read` scope and that the PR number is correct. The fetch is best-effort; SonarCloud's own surface step is authoritative for its findings.",
    );
    raw = await readJsonResponse(response);
  } catch (error) {
    writeBrandedAnnotation(
      "warning",
      `failed to fetch SonarCloud PR inline comments; treating as zero findings (best-effort fetch). ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const findings: LiveReviewComment[] = [];
  for (const entry of raw) {
    const finding = parseSonarPrCommentEntry(entry);
    if (finding === null) continue;
    findings.push({
      path: finding.path,
      line: finding.line,
      body: finding.body,
      severity: finding.severity,
      category: "sonar",
    });
    if (findings.length >= MAX_SONAR_PR_FINDINGS) break;
  }
  return findings;
}

function parseSonarPrCommentEntry(value: unknown): {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: SonarPrFinding["severity"];
} | null {
  if (!isRecord(value)) return null;
  const path = value["path"];
  const line = value["line"];
  const body = value["body"];
  const originalLine = value["original_line"];
  if (typeof path !== "string") return null;
  // GitHub returns `line: null` for comments on lines outside the diff
  // (e.g. file-level comments anchored to the file header). Use
  // `original_line` as a fallback so we still anchor the comment
  // somewhere postable.
  const resolvedLine = isSafeInteger(line) ? line : isSafeInteger(originalLine) ? originalLine : 1;
  if (typeof body !== "string") return null;
  if (!body.includes(SONAR_PR_FINDING_MARKER)) return null;
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
function parseSonarSeverityFromBody(body: string): SonarPrFinding["severity"] {
  // Match the first capitalized severity word inside `**SonarCloud <WORD> — \`...`.
  const match = /\*\*\s*Sonar(?:Cloud|Qube)?\s+(BLOCKER|CRITICAL|MAJOR|MINOR|INFO)\b/u.exec(body);
  if (match === null) return "major";
  const label = match[1];
  if (label === undefined) return "major";
  switch (label.toUpperCase()) {
    case "BLOCKER": return "critical";
    case "CRITICAL": return "critical";
    case "MAJOR": return "major";
    case "MINOR": return "minor";
    case "INFO": return "info";
    default: return "major";
  }
}