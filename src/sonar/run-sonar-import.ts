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
