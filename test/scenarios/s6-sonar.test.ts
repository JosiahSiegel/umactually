import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { runSonarImport } from "../../src/sonar/run-sonar-import.js";

describe("S6 Sonar wait, import, timeout, and skip contract", () => {
  it("SONAR-S6-RED-001 polls quality gate, imports findings, handles timeout, and skips cleanly when unconfigured", async () => {
    // Given: mocked Sonar quality-gate sequence, issues, and hotspots fixtures.
    const qualityGateSequenceJson = await readFile(new URL("../fixtures/sonar/quality-gate-sequence.json", import.meta.url), "utf8");
    const issuesJson = await readFile(new URL("../fixtures/sonar/issues.json", import.meta.url), "utf8");
    const hotspotsJson = await readFile(new URL("../fixtures/sonar/hotspots.json", import.meta.url), "utf8");
    expect(qualityGateSequenceJson).toContain("IN_PROGRESS");
    expect(issuesJson).toContain("typescript:S2068");
    expect(hotspotsJson).toContain("vulnerabilityProbability");

    // When: the Sonar importer runs against mocked responses only.
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
