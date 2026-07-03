import { runLiveSonarImport, type LiveSonarReport } from "../sonar/run-sonar-import.js";
import type { FetchImpl } from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

export async function readLiveSonarContext(
  parsed: ParsedCliArgs,
  fetchImpl: FetchImpl,
): Promise<string | undefined> {
  const report = await readLiveSonarReport(parsed, fetchImpl);
  return report === undefined ? undefined : formatSonarContext(report);
}

async function readLiveSonarReport(parsed: ParsedCliArgs, fetchImpl: FetchImpl): Promise<LiveSonarReport | undefined> {
  const sonarConfigured =
    parsed.includeSonarqube &&
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
    fetchImpl: fetchImpl as typeof fetch,
  });
  process.stdout.write(
    `umactually-pr-review: sonar quality gate ${sonarReport.qualityGateStatus} (${sonarReport.importedFindingCount} findings, waited=${sonarReport.waitedForTerminalQualityGate})${sonarReport.timeoutHandled ? " [timeout handled]" : ""}\n`,
  );
  if (sonarReport.errorMessage !== undefined) {
    process.stderr.write(`::warning::umactually-pr-review: ${sonarReport.errorMessage}\n`);
  }
  return sonarReport;
}

function formatSonarContext(report: LiveSonarReport): string {
  return [
    "SonarQube report:",
    `Quality gate: ${report.qualityGateStatus}`,
    `Imported findings: ${report.importedFindingCount}`,
    `Waited for terminal quality gate: ${report.waitedForTerminalQualityGate}`,
    `Timeout handled: ${report.timeoutHandled}`,
  ].join("\n");
}
