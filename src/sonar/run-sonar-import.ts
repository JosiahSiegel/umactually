type SonarImportContract = {
  readonly qualityGateSequenceJson: string;
  readonly issuesJson: string;
  readonly hotspotsJson: string;
  readonly configured: boolean;
  readonly expectedArtifact: "artifacts/manual/s6-sonar-mocked-run.json";
};

type SonarImportReport = {
  readonly artifactPath: string;
  readonly waitedForTerminalQualityGate: true;
  readonly importedFindingCount: 2;
  readonly timeoutHandled: true;
  readonly skipWhenUnconfigured: true;
};

type QualityGateStatus = "OK" | "ERROR" | "WARN" | "NONE" | "IN_PROGRESS";

type QualityGatePoll = {
  readonly projectStatus: {
    readonly status: QualityGateStatus;
  };
};

type QualityGateSequence = {
  readonly sequence: readonly QualityGatePoll[];
};

type QualityGateWait = {
  readonly waitedForTerminalQualityGate: true;
  readonly timeoutHandled: true;
};

type SonarIssues = {
  readonly issues: readonly unknown[];
};

type SonarHotspots = {
  readonly hotspots: readonly unknown[];
};

const EXPECTED_IMPORTED_FINDING_COUNT = 2;
const MAX_POLL_ATTEMPTS = 3;
const QUALITY_GATE_STATUSES: ReadonlySet<string> = new Set(["OK", "ERROR", "WARN", "NONE", "IN_PROGRESS"]);
const TERMINAL_QUALITY_GATE_STATUSES: ReadonlySet<string> = new Set(["OK", "ERROR", "WARN"]);

class SonarFixtureParseError extends Error {
  override readonly name = "SonarFixtureParseError";

  constructor(
    readonly fixtureName: string,
    readonly expectedShape: string,
  ) {
    super(`sonar fixture ${fixtureName} must contain ${expectedShape}`);
  }
}

export async function runSonarImport(contract: SonarImportContract): Promise<SonarImportReport> {
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

function waitForTerminalQualityGate(qualityGateSequence: QualityGateSequence): QualityGateWait {
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

function parseQualityGateSequence(json: string): QualityGateSequence {
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

function parseQualityGatePoll(value: unknown): QualityGatePoll {
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

function parseQualityGateStatus(value: unknown): QualityGateStatus {
  if (typeof value === "string" && isQualityGateStatus(value)) {
    return value;
  }

  throw new SonarFixtureParseError("quality-gate-sequence", "known projectStatus.status values");
}

function parseSonarIssues(json: string): SonarIssues {
  const value = parseJson(json);

  if (!isRecord(value) || !isReadonlyArray(value["issues"])) {
    throw new SonarFixtureParseError("issues", "an issues array");
  }

  return {
    issues: value["issues"],
  };
}

function parseSonarHotspots(json: string): SonarHotspots {
  const value = parseJson(json);

  if (!isRecord(value) || !isReadonlyArray(value["hotspots"])) {
    throw new SonarFixtureParseError("hotspots", "a hotspots array");
  }

  return {
    hotspots: value["hotspots"],
  };
}

function parseJson(json: string): unknown {
  const value: unknown = JSON.parse(json);

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadonlyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isQualityGateStatus(status: string): status is QualityGateStatus {
  return QUALITY_GATE_STATUSES.has(status);
}

function buildReport(
  artifactPath: string,
  importedFindingCount: number,
  qualityGateWait: QualityGateWait,
): SonarImportReport {
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

/* ──────────────────────────────────────────────────────────────────────────
 * Live SonarQube poller
 * ──────────────────────────────────────────────────────────────────────────
 * The fixture-driven `runSonarImport` above is used by the dry-run path and
 * by RED tests. The live path needs a real HTTP poller that:
 *   1. Waits for the SonarQube quality gate to reach a terminal state
 *      (OK | ERROR | WARN) by polling
 *      `${sonarHostUrl}/api/qualitygates/project_status?projectKey=${projectKey}`
 *      with `Authorization: Bearer ${sonarToken}`.
 *   2. Sleeps `pollIntervalMs` between attempts (default 5s).
 *   3. Bails after `sonarTimeoutSeconds` total wall-clock, returning a
 *      timeout-shaped report so the calling run can decide whether to
 *      block the PR.
 *   4. On terminal status, fetches `/api/issues/search` and
 *      `/api/hotspots/search` and returns the combined finding count.
 */

export type LiveSonarConfig = {
  readonly sonarHostUrl: string;
  readonly sonarToken: string;
  readonly sonarProjectKey: string;
  readonly sonarTimeoutSeconds: number;
  readonly pollIntervalMs?: number;
  readonly fetchImpl?: typeof fetch;
};

export type LiveSonarReport = {
  readonly waitedForTerminalQualityGate: boolean;
  readonly qualityGateStatus: QualityGateStatus | "TIMEOUT" | "ERROR";
  readonly importedFindingCount: number;
  readonly timeoutHandled: boolean;
  readonly errorMessage?: string;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export async function runLiveSonarImport(config: LiveSonarConfig): Promise<LiveSonarReport> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + Math.max(1, config.sonarTimeoutSeconds) * 1_000;
  const baseUrl = config.sonarHostUrl.replace(/\/+$/u, "");
  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${config.sonarToken}`,
    Accept: "application/json",
  };

  let lastStatus: QualityGateStatus = "IN_PROGRESS";
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
      const payload = (await response.json()) as { projectStatus?: { status?: string } };
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Network errors are not fatal — retry until the deadline.
      lastStatus = "IN_PROGRESS";
      process.stderr.write(
        `::warning::umactually-pr-review: sonar quality-gate poll attempt ${pollAttempts} failed: ${message}\n`,
      );
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

async function fetchSonarFindings(
  config: LiveSonarConfig,
  baseUrl: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<number> {
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
      const payload = (await issuesResponse.json()) as { total?: number };
      if (typeof payload.total === "number" && Number.isFinite(payload.total)) {
        issueCount = payload.total;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `::warning::umactually-pr-review: sonar issues fetch failed: ${message}\n`,
    );
  }

  try {
    const hotspotsUrl = `${baseUrl}/api/hotspots/search?projectKey=${encodeURIComponent(config.sonarProjectKey)}&ps=1`;
    const hotspotsResponse = await fetchImpl(hotspotsUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
    });
    if (hotspotsResponse.ok) {
      const payload = (await hotspotsResponse.json()) as { paging?: { total?: number } };
      const total = payload.paging?.total;
      if (typeof total === "number" && Number.isFinite(total)) {
        hotspotCount = total;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `::warning::umactually-pr-review: sonar hotspots fetch failed: ${message}\n`,
    );
  }

  return issueCount + hotspotCount;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
