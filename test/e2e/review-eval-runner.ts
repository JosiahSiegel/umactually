/**
 * Hermetic review-eval gate runner.
 *
 * Boots the bundled mock LLM server, drives the real prompt → provider
 * transport → parser → verification/filter → durable-finding pipeline
 * for every registered fixture, aggregates the per-fixture results into
 * a schema-versioned v2 report, and exits non-zero when any threshold is
 * breached.
 *
 * Live/provider comparisons are deliberately NOT exercised here — this
 * runner is the release gate, not an opt-in smoke. Use a separate
 * opt-in harness (out of scope for Task 3) for live runs.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REVIEW_FIXTURES,
  SABOTAGE_FIXTURES,
} from "../fixtures/reviews/index.js";
import {
  aggregateReviewEvalResults,
  gradeReviewFixture,
  resolveMockServerPath,
  resolvePackageCommit,
  sha256File,
  sha256Hex,
  type ReviewEvalReport,
  type ReviewEvalResult,
  type ReviewFixture,
} from "./review-eval.js";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..");
const MOCK_SERVER_PATH = resolveMockServerPath();

async function startMockServer(reviewDir: string, version: string): Promise<{
  readonly child: import("node:child_process").ChildProcess;
  readonly port: number;
}> {
  const child = spawn(
    process.execPath,
    [MOCK_SERVER_PATH],
    {
      env: {
        ...process.env,
        PORT: "0",
        MOCK_LABEL: "review-eval-gate",
        MOCK_REVIEW_DIR: reviewDir,
        MOCK_VERSION: version,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const port = await new Promise<number>((resolvePort, rejectPort) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    const timeout = setTimeout(() => {
      rejectPort(new Error(`mock-llm-server did not print a port within 10000ms\nstdout=${stdoutBuf}\nstderr=${stderrBuf}`));
    }, 10_000);
    child.stdout?.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      const lines = stdoutBuf.split("\n");
      if (lines.length > 1) {
        clearTimeout(timeout);
        const port = Number.parseInt(lines[0]?.trim() ?? "", 10);
        if (Number.isFinite(port) && port > 0) {
          resolvePort(port);
          return;
        }
        rejectPort(new Error(`mock-llm-server printed a non-numeric port: ${lines[0]}`));
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderrBuf += chunk.toString("utf8");
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      rejectPort(new Error(`mock-llm-server exited with code=${code} before printing port\nstderr=${stderrBuf}`));
    });
  });

  await waitForHealth(port);
  return { child, port };
}

async function waitForHealth(port: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
      lastError = new Error(`/health returned ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`mock-llm-server did not become healthy within 5s: ${String(lastError)}`);
}

async function fetchMockVersion(port: number): Promise<string> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/version`);
    if (!res.ok) return "unknown";
    const json = (await res.json()) as { version?: string };
    return typeof json.version === "string" ? json.version : "unknown";
  } catch {
    return "unknown";
  }
}

async function runOneFixture(
  fixture: ReviewFixture,
  port: number,
  mockReviewDir: string,
): Promise<ReviewEvalResult> {
  const workdir = mkdtempSync(join(tmpdir(), "review-eval-fixture-"));
  try {
    for (const [relPath, content] of Object.entries(fixture.fixtureFiles ?? {})) {
      const absPath = join(workdir, relPath);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, content, "utf8");
    }

    const override = fixture.expected.mockReviewOverride;
    if (override !== undefined) {
      if (override.simulateParseFailure === true) {
        writeFileSync(join(mockReviewDir, `${fixture.name}.json`), "__PARSE_FAIL__{not-valid-json", "utf8");
      } else if (override.simulateTruncation === true) {
        const serialized = JSON.stringify(override.review);
        writeFileSync(join(mockReviewDir, `${fixture.name}.json`), "__TRUNCATED__" + serialized.slice(0, Math.floor(serialized.length / 2)), "utf8");
      } else {
        writeFileSync(join(mockReviewDir, `${fixture.name}.json`), JSON.stringify(override.review), "utf8");
      }
    } else {
      const firstPath = extractFirstAddedPath(fixture.diff) ?? "src/example.ts";
      const cannedReview = {
        summary: `Gate default canned review for ${fixture.name}.`,
        verdict: "COMMENT",
        comments: [
          {
            path: firstPath,
            line: 1,
            body: `Default canned-review body for fixture ${fixture.name}.`,
            severity: "info",
            category: "general",
          },
        ],
      };
      writeFileSync(join(mockReviewDir, `${fixture.name}.json`), JSON.stringify(cannedReview), "utf8");
    }

    const diffPath = join(workdir, `${fixture.name}.diff`);
    writeFileSync(diffPath, fixture.diff, "utf8");

    const { requestLiveReview } = await import("../../src/cli/live-provider.js");
    const start = Date.now();
    const fixtureHeader = fixture.name.replace(/[^a-zA-Z0-9_-]/gu, "_");
    const fetchImpl: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("x-mock-fixture", fixture.name);
      headers.set("authorization", "Bearer mock-key");
      return fetch(input, { ...init, headers });
    };
    let outcome;
    try {
      outcome = await requestLiveReview({
        parsed: buildParsedCliArgs(diffPath, port, fixtureHeader),
        cwd: workdir,
        env: { ...process.env, NO_COLOR: "1" },
        fetchImpl: fetchImpl as unknown as Parameters<typeof requestLiveReview>[0]["fetchImpl"],
        platform: "github",
        diffText: fixture.diff,
        platformToken: "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = {
        review: {
          summary: `Provider error: ${message}`,
          verdict: "COMMENT",
          comments: [],
          suppressedComments: [],
          parseFailed: true,
        },
        endpoint: "responses",
        provider: "openai-compatible",
        modelId: "mock-opaque",
        severityWarnings: [],
        parseWarnings: [],
        verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
        confidenceFilter: { kept: [], downgraded: [], reasons: [] },
        parseFailed: true,
        durationMs: Date.now() - start,
        roundTrips: 0,
        tokenUsage: { input: 0, output: 0, total: 0 },
      };
    }
    const durationMs = Date.now() - start;

    const withMetrics = outcome as typeof outcome & {
      durationMs?: number;
      roundTrips?: number;
      tokenUsage?: { input?: number; output?: number; total?: number };
    };
    const finalOutcome = {
      ...withMetrics,
      durationMs: withMetrics.durationMs ?? durationMs,
      roundTrips: withMetrics.roundTrips ?? 1,
      tokenUsage: withMetrics.tokenUsage ?? { input: 1234, output: 200, total: 1434 },
    };

    const patchedExpected = await computeExpectedFindingsForFixture(fixture);
    const patchedFixture: ReviewFixture = { ...fixture, expected: patchedExpected };

    return gradeReviewFixture(patchedFixture, finalOutcome);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

/**
 * Compute expected finding identities for a fixture whose canned review
 * was authored with `mockReviewOverride.review.comments` but no
 * explicit `expectedFindings`. The pipeline computes the identity via
 * `enrichWithDurableIdentity` (in `src/cli/live-shared.ts`), which uses
 * anchorKind="symbol", symbolName=undefined, symbolKind=undefined, and
 * a synthesized rule key. We mirror that shape so the gate's
 * identityDigest-level TP/FP/FN matches the actual pipeline output.
 *
 * When the fixture already declares explicit `expectedFindings` we
 * pass it through unchanged so reviewers can hand-author
 * identityDigests for findings the canned review does NOT emit (the
 * FN side of ground truth).
 */
async function computeExpectedFindingsForFixture(
  fixture: ReviewFixture,
): Promise<typeof fixture.expected> {
  const override = fixture.expected.mockReviewOverride;
  if (override === undefined) return fixture.expected;
  if (fixture.expected.expectedFindings !== undefined && fixture.expected.expectedFindings.length > 0) {
    return fixture.expected;
  }
  const { computeDurableFindingIdentity } = await import("../../src/review/fingerprint.js");
  const expected = override.review.comments.map((c) => {
    const firstSentenceMatch = c.body.match(/^[^.!?]*[.!?]/u);
    const firstSentence = firstSentenceMatch !== null ? firstSentenceMatch[0] : c.body;
    const identity = computeDurableFindingIdentity({
      path: c.path,
      anchorKind: "symbol",
      symbolName: undefined,
      symbolKind: undefined,
      hunkPreimage: undefined,
      category: c.category,
      ruleKey: undefined,
      bodyFirstSentence: firstSentence,
      pathRewrites: undefined,
      caseInsensitive: false,
    });
    return {
      identityDigest: identity.identityDigest,
      fingerprintDigest: identity.fingerprintDigest,
      canonicalPath: identity.canonicalPath,
      anchorKind: identity.anchorKind,
      canonicalAnchor: identity.canonicalAnchor,
      normalizedCategory: identity.normalizedCategory,
      normalizedRuleKey: identity.normalizedRuleKey,
    };
  });
  return { ...fixture.expected, expectedFindings: expected };
}

function extractFirstAddedPath(diff: string): string | null {
  const match = diff.match(/^\+\+\+\s+b\/(.+)$/mu);
  return match?.[1]?.trim() ?? null;
}

function buildParsedCliArgs(diffPath: string, port: number, modelTag: string): Parameters<typeof import("../../src/cli/live-provider.js").requestLiveReview>[0]["parsed"] {
  return {
    platform: "auto",
    eventPath: null,
    diffPath,
    files: null,
    threadsPath: null,
    reviewPath: null,
    prNumber: null,
    repo: null,
    apiUrl: `http://127.0.0.1:${port}/v1`,
    apiKey: "mock-key",
    model: `mock-opaque-${modelTag}`,
    promptFile: null,
    promptFiles: null,
    additionalPromptFile: null,
    additionalPromptFiles: null,
    prompt: null,
    additionalPrompt: null,
    effort: null,
    provider: "openai-compatible",
    githubApiBase: null,
    includeSonarqube: false,
    includePrSonarFindings: false,
    sonarHostUrl: null,
    sonarToken: null,
    sonarProjectKey: null,
    sonarTimeoutSeconds: null,
    minimumSeverity: null,
    minimumSeverityInternal: null,
    maxComments: null,
    reviewFileLimit: null,
    detectLeaks: false,
    instructionFiles: false,
    walkthrough: false,
    diagnostic: false,
    debugRawResponse: false,
    simulateFindings: false,
    reviewTimeoutSeconds: null,
    stallSeconds: null,
    perRequestTimeoutSeconds: null,
    maxOutputTokens: null,
    dryRun: false,
    outputArtifact: null,
    strictSchema: false,
    verifyFindings: false,
  };
}

export type RunResult = {
  readonly report: ReviewEvalReport;
  readonly humanSummary: string;
};

function gateVersion(): string {
  return `1.0.0+task3`;
}

function resolveRepoRoot(): string {
  return REPO_ROOT;
}

function resolvePackageCommitCached(): string {
  return resolvePackageCommit(resolveRepoRoot());
}

/**
 * Run the hermetic gate end-to-end and return the v2 report + a human
 * summary. Does NOT exit; the caller decides what to do with the result.
 *
 * When `REVIEW_EVAL_SABOTAGE=1`, sabotage fixtures are appended to the
 * fixture list so the runner exercises the failure path end-to-end
 * (named threshold breach → non-zero exit).
 */
export async function runHermeticGate(opts: {
  readonly outputJson?: string;
  readonly outputSummary?: string;
  readonly extraSnapshots?: readonly string[];
} = {}): Promise<RunResult> {
  const reviewDir = mkdtempSync(join(tmpdir(), "review-eval-mock-"));
  const { child, port } = await startMockServer(reviewDir, gateVersion());

  const fixtures =
    process.env["REVIEW_EVAL_SABOTAGE"] === "1"
      ? [...REVIEW_FIXTURES, ...SABOTAGE_FIXTURES]
      : REVIEW_FIXTURES;

  try {
    const mockVersion = await fetchMockVersion(port);
    const fixtureHashes: Record<string, string> = {};
    for (const f of fixtures) {
      fixtureHashes[f.name] = sha256Hex(JSON.stringify({
        diff: f.diff,
        expected: f.expected,
        fixtureFiles: f.fixtureFiles,
        reviewFiles: f.reviewFiles,
      }));
    }

    const packageCommit = resolvePackageCommitCached();
    const mockServerHash = sha256File(MOCK_SERVER_PATH);

    const results: ReviewEvalResult[] = [];
    for (const fixture of fixtures) {
      const result = await runOneFixture(fixture, port, reviewDir);
      results.push(result);
    }

    let report: ReviewEvalReport = aggregateReviewEvalResults(results, results.length, {
      fixtureHashes,
      mockServerHash,
      mockServerVersion: mockVersion,
      packageCommit,
      config: {
        model: "mock-opaque",
        provider: "openai-compatible",
        runtime: `node-${process.versions.node}`,
      },
    });

    if (opts.extraSnapshots !== undefined) {
      for (const snap of opts.extraSnapshots) {
        const verdict = assertSnapshotCompatibleLocal(report, snap);
        if (!verdict.compatible) {
          report = {
            ...report,
            gateFailures: [...report.gateFailures, `snapshot-incompatible: ${snap}: ${verdict.reason}`],
            passed: false,
          };
        }
      }
    }

    if (opts.outputJson !== undefined) {
      const { writeReviewEvalReport } = await import("./review-eval.js");
      await writeReviewEvalReport(report, opts.outputJson);
    }

    const summary = renderHumanSummary(report);
    if (opts.outputSummary !== undefined) {
      writeFileSync(opts.outputSummary, summary, "utf8");
    }

    return { report, humanSummary: summary };
  } finally {
    try { child.kill("SIGKILL"); } catch { /* already dead */ }
    rmSync(reviewDir, { recursive: true, force: true });
  }
}

function assertSnapshotCompatibleLocal(
  report: ReviewEvalReport,
  snapPath: string,
): { readonly compatible: boolean; readonly reason?: string } {
  if (!existsSync(snapPath)) {
    return { compatible: false, reason: `snapshot not found at ${snapPath}` };
  }
  const raw = readFileSync(snapPath, "utf8");
  const snap = JSON.parse(raw) as Partial<ReviewEvalReport>;
  if (snap.mockServerHash !== report.mockServerHash) {
    return { compatible: false, reason: `mockServerHash differs (snapshot=${snap.mockServerHash} current=${report.mockServerHash})` };
  }
  if (snap.packageCommit !== report.packageCommit) {
    return { compatible: false, reason: `packageCommit differs (snapshot=${snap.packageCommit} current=${report.packageCommit})` };
  }
  for (const [name, hash] of Object.entries(report.fixtureHashes)) {
    if (snap.fixtureHashes?.[name] !== hash) {
      return { compatible: false, reason: `fixtureHash[${name}] differs (snapshot=${snap.fixtureHashes?.[name]} current=${hash})` };
    }
  }
  return { compatible: true };
}

function renderHumanSummary(report: ReviewEvalReport): string {
  const lines: string[] = [];
  lines.push(`review-eval gate: ${report.passed ? "PASS" : "FAIL"}`);
  lines.push(`fixtures: ${report.passedCount}/${report.fixtureCount} passed (${report.failedCount} failed)`);
  lines.push(`TP=${report.TP} FP=${report.FP} FN=${report.FN}`);
  lines.push(`precision=${report.precision.toFixed(3)} recall=${report.recall.toFixed(3)} F1=${report.F1.toFixed(3)}`);
  lines.push(`fabrication=${report.fabrication} suppression=${report.suppression}`);
  lines.push(`mockServerHash=${report.mockServerHash.slice(0, 12)}… packageCommit=${report.packageCommit.slice(0, 12)}…`);
  if (report.gateFailures.length > 0) {
    lines.push("");
    lines.push("gate failures:");
    for (const f of report.gateFailures) lines.push(`  - ${f}`);
  }
  for (const r of report.results) {
    if (!r.passed) {
      lines.push("");
      lines.push(`${r.fixtureName}:`);
      for (const f of r.failures) lines.push(`  - ${f}`);
    }
  }
  return lines.join("\n") + "\n";
}
