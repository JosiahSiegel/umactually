type ScanReviewSecretsInput = {
  readonly diffText: string;
  readonly expectedArtifact: "artifacts/manual/s5-redaction-report.json";
};

type ScanReviewSecretsReport = {
  readonly artifactPath: string;
  readonly highConfidenceLeakCount: number;
  readonly redactedDiffIncludesSecret: boolean;
  readonly blockedRawOutput: true;
};

const HIGH_CONFIDENCE_SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk_test_[a-z_]+\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bghp_[A-Za-z0-9]{36}\b/g,
];

const REDACTED_SECRET = "[REDACTED_SECRET]";

export async function scanReviewSecrets(input: ScanReviewSecretsInput): Promise<ScanReviewSecretsReport> {
  const highConfidenceLeakCount = countHighConfidenceLeaks(input.diffText);
  const redactedDiff = redactHighConfidenceSecrets(input.diffText);

  return {
    artifactPath: input.expectedArtifact,
    highConfidenceLeakCount,
    redactedDiffIncludesSecret: countHighConfidenceLeaks(redactedDiff) > 0,
    blockedRawOutput: true,
  };
}

function countHighConfidenceLeaks(diffText: string): number {
  let highConfidenceLeakCount = 0;

  for (const line of diffText.split("\n")) {
    if (isAddedDiffLine(line)) {
      highConfidenceLeakCount += countLineSecrets(line);
    }
  }

  return highConfidenceLeakCount;
}

function redactHighConfidenceSecrets(diffText: string): string {
  return diffText
    .split("\n")
    .map((line) => (isAddedDiffLine(line) ? redactLineSecrets(line) : line))
    .join("\n");
}

function isAddedDiffLine(line: string): boolean {
  return line.startsWith("+") && !line.startsWith("+++");
}

function countLineSecrets(line: string): number {
  let secretCount = 0;

  for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) {
    secretCount += Array.from(line.matchAll(pattern)).length;
  }

  return secretCount;
}

function redactLineSecrets(line: string): string {
  let redactedLine = line;

  for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) {
    redactedLine = redactedLine.replace(pattern, REDACTED_SECRET);
  }

  return redactedLine;
}
