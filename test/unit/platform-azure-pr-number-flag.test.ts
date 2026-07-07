// Regression tests for the Azure CLI flag fallback in readAzureContext.
//
// PR #18 Azure build #158: queued the root pipeline as a manual branch
// build (`reason: PullRequest` via REST), and the Azure live review
// step blew up with `Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID
// must be set.` The error gave no actionable guidance: the user
// couldn't tell that they could either run as a build validation
// policy or pass `--pr-number` on the command line. The fix has two
// parts:
//
//   1. Wire `--pr-number` (already validated at the CLI boundary)
//      into `readAzureContext` as an override, so manual CLI
//      invocations outside of an Azure Pipelines PR build work
//      without synthesising the env var.
//   2. Make the `AZURE_PR_NUMBER_INVALID` error message actionable:
//      when the env var is missing AND no override is supplied,
//      print a multi-line recovery hint listing both options
//      (build validation policy OR `--pr-number` + remaining env).
//
// These tests pin both parts. They use `loadReadAzureContext` from
// the existing `platform-azure.test.ts` helper (the future-module
// shim keeps tests independent of internal module structure).

import { describe, expect, it } from "vitest";

import { expectFutureModule } from "../helpers/assert-red-module.js";

type AzureContext = {
  readonly token: string;
  readonly org: string;
  readonly project: string;
  readonly repoId: string;
  readonly prNumber: number;
  readonly sourceCommit: string;
  readonly targetBranch: string;
};

type ReadAzureContext = (
  env: NodeJS.ProcessEnv,
  overrides?: { readonly prNumber?: number | undefined },
) => AzureContext;

type AzureContextErrorLike = Error & {
  readonly code?: string;
};

const azureContextModule = "../../src/platform/azure/context.js";
const azureContextPath = "src/platform/azure/context.ts";

function isReadAzureContext(value: unknown): value is ReadAzureContext {
  return typeof value === "function";
}

async function loadReadAzureContext(): Promise<ReadAzureContext> {
  const moduleNamespace = await expectFutureModule(azureContextModule);
  const readAzureContext = moduleNamespace["readAzureContext"];
  if (!isReadAzureContext(readAzureContext)) {
    expect.fail(`RED: ${azureContextPath} must export readAzureContext(env, overrides?)`);
  }
  return readAzureContext;
}

const BASE_ENV: NodeJS.ProcessEnv = {
  SYSTEM_ACCESSTOKEN: "azure-system-token",
  SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
  SYSTEM_TEAMPROJECT: "Example Project",
  BUILD_REPOSITORY_ID: "00000000-0000-0000-0000-000000000042",
  SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
  SYSTEM_PULLREQUEST_SOURCECOMMITID: "1111111111111111111111111111111111111111",
  SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
};

describe("readAzureContext: --pr-number flag override", () => {
  it("uses the override PR number when supplied, ignoring SYSTEM_PULLREQUEST_PULLREQUESTID", async () => {
    // Given: the env has one PR number, but the caller passes an
    // override that disagrees. The override wins — manual CLI
    // invocations can target a PR without synthesising the env var.
    const readAzureContext = await loadReadAzureContext();
    const env: NodeJS.ProcessEnv = { ...BASE_ENV, SYSTEM_PULLREQUEST_PULLREQUESTID: "42" };

    const context = readAzureContext(env, { prNumber: 99 });

    expect(context.prNumber).toBe(99);
  });

  it("uses SYSTEM_PULLREQUEST_PULLREQUESTID when no override is supplied", async () => {
    // Given: the env has the standard Azure Pipelines PR number env
    // var, and no CLI flag override. Behavior must match the
    // pre-existing flow exactly (backward compatibility).
    const readAzureContext = await loadReadAzureContext();
    const context = readAzureContext(BASE_ENV);
    expect(context.prNumber).toBe(42);
  });

  it("uses the override when the env var is absent (manual CLI invocation outside of a PR build)", async () => {
    // Given: no SYSTEM_PULLREQUEST_PULLREQUESTID set — typical for a
    // developer running the CLI manually outside Azure Pipelines.
    // The override makes the CLI callable without synthesising the
    // env var.
    const readAzureContext = await loadReadAzureContext();
    const env: NodeJS.ProcessEnv = { ...BASE_ENV };
    delete env["SYSTEM_PULLREQUEST_PULLREQUESTID"];

    const context = readAzureContext(env, { prNumber: 17 });

    expect(context.prNumber).toBe(17);
  });

  it("refuses a non-positive override with AZURE_PR_NUMBER_INVALID", async () => {
    // Given: a caller smuggles a non-positive override past the CLI
    // boundary (e.g. via a test fixture or a future caller). The
    // re-validation in readAzureContext catches it.
    const readAzureContext = await loadReadAzureContext();

    for (const candidate of [0, -1, -100, Number.NaN, 1.5]) {
      const env: NodeJS.ProcessEnv = { ...BASE_ENV };
      delete env["SYSTEM_PULLREQUEST_PULLREQUESTID"];
      let thrown: unknown = null;
      try {
        readAzureContext(env, { prNumber: candidate });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).not.toBeNull();
      const code = (thrown as AzureContextErrorLike | null)?.code;
      expect(code).toBe("AZURE_PR_NUMBER_INVALID");
    }
  });
});

describe("readAzureContext: AZURE_PR_NUMBER_INVALID error message is actionable", () => {
  it("mentions --pr-number as a recovery path when the env var is missing", async () => {
    // Given: no SYSTEM_PULLREQUEST_PULLREQUESTID and no override.
    // The thrown error must mention `--pr-number` so a developer
    // hitting this in a manual run knows what to do.
    const readAzureContext = await loadReadAzureContext();
    const env: NodeJS.ProcessEnv = { ...BASE_ENV };
    delete env["SYSTEM_PULLREQUEST_PULLREQUESTID"];

    let thrown: unknown = null;
    try {
      readAzureContext(env);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).not.toBeNull();
    const message = (thrown as Error | null)?.message ?? "";
    expect(message).toMatch(/--pr-number/u);
    expect(message).toMatch(/Recovery/u);
    // Confirm at least one of the alternative-recovery phrasing
    // strings is present (build validation policy vs. manual CLI).
    expect(
      message.includes("build validation policy") || message.includes("branch policy"),
    ).toBe(true);
  });

  it("regression: PR #18 BUILD #158 error included --pr-number guidance", async () => {
    // The PR #18 regression was an Azure Pipelines branch build
    // that fired without `SYSTEM_PULLREQUEST_PULLREQUESTID`. The
    // pre-fix error was the bare string "Azure Pipelines
    // SYSTEM_PULLREQUEST_PULLREQUESTID must be set." which gave
    // zero actionable guidance. Pin the new message shape here so a
    // future revert is caught.
    const readAzureContext = await loadReadAzureContext();
    const env: NodeJS.ProcessEnv = { ...BASE_ENV };
    delete env["SYSTEM_PULLREQUEST_PULLREQUESTID"];

    let thrown: unknown = null;
    try {
      readAzureContext(env);
    } catch (error) {
      thrown = error;
    }

    const message = (thrown as Error | null)?.message ?? "";
    // Must not be the bare pre-fix message.
    expect(message).not.toBe("Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be set.");
    // Must reference the recovery options.
    expect(message).toMatch(/Recovery options/u);
  });
});
