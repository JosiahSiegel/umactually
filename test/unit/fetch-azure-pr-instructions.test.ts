import { describe, expect, it } from "vitest";

import { fetchAzurePrInstructions } from "../../src/platform/azure/api.js";
import type { AzureContext } from "../../src/platform/azure/context.js";
import type { FetchImpl } from "../../src/util/http.js";

const CONTEXT: AzureContext = {
  token: "test-token",
  org: "example-org",
  project: "example-project",
  repoId: "repo-id",
  prNumber: 42,
  sourceCommit: "source-commit",
  targetBranch: "refs/heads/main",
  baseCommit: "base-commit",
};

function makeResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify({ content: "hello" }),
  } as Response;
}

function makeFetchImpl(statuses: readonly number[]): FetchImpl {
  let index = 0;
  return async () => makeResponse(statuses[index++] ?? 404);
}

describe("fetchAzurePrInstructions", () => {
  it("returns instruction contents for every successful path", async () => {
    const paths = ["/.github/instructions.md", "/AGENTS.md"];
    const fetchImpl = makeFetchImpl([200, 200]);

    const result = await fetchAzurePrInstructions(CONTEXT, paths, fetchImpl);

    expect(result).toEqual(
      new Map([
        ["/.github/instructions.md", "hello"],
        ["/AGENTS.md", "hello"],
      ]),
    );
  });

  it("keeps successful paths when another path is missing", async () => {
    const fetchImpl = makeFetchImpl([200, 404]);

    const result = await fetchAzurePrInstructions(CONTEXT, ["/AGENTS.md", "/missing.md"], fetchImpl);

    expect(result).toEqual(new Map([["/AGENTS.md", "hello"]]));
  });

  it("returns an empty map when every path is missing", async () => {
    const fetchImpl = makeFetchImpl([404, 404]);

    const result = await fetchAzurePrInstructions(CONTEXT, ["/one.md", "/two.md"], fetchImpl);

    expect(result).toEqual(new Map());
  });

  it("returns an empty map without fetching when paths are empty", async () => {
    let calls = 0;
    const fetchImpl: FetchImpl = async () => {
      calls++;
      return makeResponse(200);
    };

    const result = await fetchAzurePrInstructions(CONTEXT, [], fetchImpl);

    expect(result).toEqual(new Map());
    expect(calls).toBe(0);
  });
});
