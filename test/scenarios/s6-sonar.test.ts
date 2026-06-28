import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type SonarContract = {
  readonly qualityGateSequenceJson: string;
  readonly issuesJson: string;
  readonly hotspotsJson: string;
  readonly configured: boolean;
  readonly expectedArtifact: "artifacts/manual/s6-sonar-mocked-run.json";
};

type SonarMockedRun = {
  readonly artifactPath: string;
  readonly waitedForTerminalQualityGate: true;
  readonly importedFindingCount: 2;
  readonly timeoutHandled: true;
  readonly skipWhenUnconfigured: true;
};

type RunSonarImport = (contract: SonarContract) => Promise<SonarMockedRun>;

const sonarModule = "../../src/sonar/run-sonar-import.js";
const sonarPath = "src/sonar/run-sonar-import.ts";

function isRunSonarImport(value: unknown): value is RunSonarImport {
  return typeof value === "function";
}

describe("S6 Sonar wait, import, timeout, and skip RED contract", () => {
  it("SONAR-S6-RED-001 polls quality gate, imports findings, handles timeout, and skips cleanly when unconfigured", async () => {
    // Given: mocked Sonar quality-gate sequence, issues, and hotspots fixtures.
    const qualityGateSequenceJson = await readFile(new URL("../fixtures/sonar/quality-gate-sequence.json", import.meta.url), "utf8");
    const issuesJson = await readFile(new URL("../fixtures/sonar/issues.json", import.meta.url), "utf8");
    const hotspotsJson = await readFile(new URL("../fixtures/sonar/hotspots.json", import.meta.url), "utf8");
    expect(qualityGateSequenceJson).toContain("IN_PROGRESS");
    expect(issuesJson).toContain("typescript:S2068");
    expect(hotspotsJson).toContain("vulnerabilityProbability");

    // When: the future Sonar importer runs against mocked responses only.
    const runSonarImport = await expectNotImplementedExport(sonarModule, sonarPath, "runSonarImport");
    if (!isRunSonarImport(runSonarImport)) {
      expect.fail("RED: src/sonar/run-sonar-import.ts must export runSonarImport(contract)");
    }
    const result = await runSonarImport({
      qualityGateSequenceJson,
      issuesJson,
      hotspotsJson,
      configured: true,
      expectedArtifact: "artifacts/manual/s6-sonar-mocked-run.json",
    });

    // Then: polling, import, timeout handling, and no-token skip are observable contracts.
    expect(result).toEqual({
      artifactPath: "artifacts/manual/s6-sonar-mocked-run.json",
      waitedForTerminalQualityGate: true,
      importedFindingCount: 2,
      timeoutHandled: true,
      skipWhenUnconfigured: true,
    });
  });
});
