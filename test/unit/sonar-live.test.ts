import { describe, expect, it } from "vitest";

import { runLiveSonarImport } from "../../src/sonar/run-sonar-import.js";

type FetchResponseInit = {
  readonly status: number;
  readonly body: string;
  readonly contentType?: string;
};

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string | null;
};

type FetchStub = {
  readonly calls: readonly RecordedRequest[];
  fetch: typeof fetch;
};

function makeFetchStub(responses: readonly FetchResponseInit[]): FetchStub {
  const calls: RecordedRequest[] = [];
  let index = 0;

  const stubbed: typeof fetch = async (input, init) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const requestInit = init ?? {};
    const method = requestInit.method ?? "GET";
    const headers = new Headers(requestInit.headers);
    const authorization = headers.has("authorization") ? headers.get("authorization") : null;
    calls.push({ url: requestUrl, method, authorization });

    const slot = responses[index];
    if (slot === undefined) {
      throw new Error(`fetch stub exhausted at call #${index + 1}`);
    }
    index += 1;

    return new Response(slot.body, {
      status: slot.status,
      headers: { "content-type": slot.contentType ?? "application/json" },
    });
  };

  return { calls, fetch: stubbed };
}

const BASE_CONFIG = {
  sonarHostUrl: "https://sonar.example.test",
  sonarToken: "sqa_synthetic_token_for_tests",
  sonarProjectKey: "example-project",
  sonarTimeoutSeconds: 60,
  pollIntervalMs: 1,
} as const;

describe("runLiveSonarImport — real SonarQube HTTP polling", () => {
  it("SONAR-LIVE-001 returns OK + finding count when the quality gate is terminal on the first poll", async () => {
    // Given: SonarQube returns OK on the first poll, plus an issues payload and empty hotspots.
    const stub = makeFetchStub([
      {
        status: 200,
        body: JSON.stringify({ projectStatus: { status: "OK" } }),
      },
      {
        status: 200,
        body: JSON.stringify({ total: 7 }),
      },
      {
        status: 200,
        body: JSON.stringify({ paging: { total: 0 } }),
      },
    ]);

    // When: the live poller runs against the stubbed SonarQube.
    const result = await runLiveSonarImport({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it reports the terminal status and the combined finding count.
    expect(result.waitedForTerminalQualityGate).toBe(true);
    expect(result.qualityGateStatus).toBe("OK");
    expect(result.importedFindingCount).toBe(7);
    expect(result.timeoutHandled).toBe(false);

    // Then: the quality-gate poll sends a Bearer token, the issues search
    // passes projectKey, and the hotspots search follows.
    expect(stub.calls[0]?.authorization).toBe(`Bearer ${BASE_CONFIG.sonarToken}`);
    expect(stub.calls[0]?.url).toContain("/api/qualitygates/project_status");
    expect(stub.calls[0]?.url).toContain(`projectKey=${BASE_CONFIG.sonarProjectKey}`);
    expect(stub.calls[1]?.url).toContain("/api/issues/search");
    expect(stub.calls[2]?.url).toContain("/api/hotspots/search");
  });

  it("SONAR-LIVE-002 polls multiple times until the quality gate reaches a terminal state", async () => {
    // Given: SonarQube returns IN_PROGRESS twice, then OK.
    const stub = makeFetchStub([
      {
        status: 200,
        body: JSON.stringify({ projectStatus: { status: "IN_PROGRESS" } }),
      },
      {
        status: 200,
        body: JSON.stringify({ projectStatus: { status: "IN_PROGRESS" } }),
      },
      {
        status: 200,
        body: JSON.stringify({ projectStatus: { status: "OK" } }),
      },
      {
        status: 200,
        body: JSON.stringify({ total: 3 }),
      },
      {
        status: 200,
        body: JSON.stringify({ paging: { total: 1 } }),
      },
    ]);

    // When: the live poller runs.
    const result = await runLiveSonarImport({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it polled three times for the quality gate (2 IN_PROGRESS + 1 OK),
    // then fetched issues + hotspots once each. Finding count = 3 + 1 = 4.
    const gatePolls = stub.calls.filter((call) =>
      call.url.includes("/api/qualitygates/project_status"),
    );
    expect(gatePolls).toHaveLength(3);
    expect(result.waitedForTerminalQualityGate).toBe(true);
    expect(result.qualityGateStatus).toBe("OK");
    expect(result.importedFindingCount).toBe(4);
  });

  it("SONAR-LIVE-003 returns TIMEOUT + timeoutHandled=true when the quality gate never reaches a terminal state", async () => {
    // Given: SonarQube returns IN_PROGRESS for every poll within the budget.
    // We use sonarTimeoutSeconds=1 with pollIntervalMs=1 to keep the test fast;
    // the poller will spin until the deadline elapses.
    const stub = makeFetchStub(
      Array.from({ length: 50 }, () => ({
        status: 200,
        body: JSON.stringify({ projectStatus: { status: "IN_PROGRESS" } }),
      })),
    );

    // When: the live poller runs against a SonarQube that never reaches
    // a terminal state within the budget.
    const result = await runLiveSonarImport({
      ...BASE_CONFIG,
      sonarTimeoutSeconds: 1,
      pollIntervalMs: 1,
      fetchImpl: stub.fetch,
    });

    // Then: it reports TIMEOUT and timeoutHandled=true with zero findings.
    expect(result.waitedForTerminalQualityGate).toBe(false);
    expect(result.qualityGateStatus).toBe("TIMEOUT");
    expect(result.timeoutHandled).toBe(true);
    expect(result.importedFindingCount).toBe(0);
  });

  it("SONAR-LIVE-004 reports ERROR when the quality-gate endpoint returns a non-2xx HTTP status", async () => {
    // Given: SonarQube returns 401 Unauthorized.
    const stub = makeFetchStub([
      { status: 401, body: '{"message":"Unauthorized"}' },
    ]);

    // When: the live poller runs.
    const result = await runLiveSonarImport({
      ...BASE_CONFIG,
      sonarTimeoutSeconds: 1,
      pollIntervalMs: 1,
      fetchImpl: stub.fetch,
    });

    // Then: it reports ERROR with an error message naming the HTTP status.
    expect(result.qualityGateStatus).toBe("ERROR");
    expect(result.timeoutHandled).toBe(false);
    expect(result.errorMessage).toContain("401");
  });
});
