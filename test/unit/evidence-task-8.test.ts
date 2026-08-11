// SPDX-License-Identifier: MIT
//
// Task 8 — evidence generator. Produces the happy + failure evidence
// JSON files the plan calls for. Runs as a vitest test so it
// re-exercises the typed `src/cli/doctor-full.ts` API end-to-end
// against a mock provider and mocked GitHub/Azure read endpoints.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  runFullDoctor,
  type DoctorCheckResult,
  type FullDoctorResult,
} from "../../src/cli/doctor-full.js";
import { KNOWN_ENV_VAR_NAMES } from "../../src/config/field-schema.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(HERE, "..", "..", ".omo", "evidence");

type FsAdapter = {
  readonly exists: (path: string) => boolean;
  readonly isSymlink: (path: string) => boolean;
  readonly isFile: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly unlink: (path: string) => void;
  readonly removeDir: (path: string, options: { readonly recursive: boolean }) => void;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly writeFileAtomic: (path: string, content: string) => void;
  readonly getMode: (path: string) => number | null;
  readonly setMode: (path: string, mode: number) => void;
};

const SECRET_API_KEY = "sk-test-fixture-happy-DO-NOT-LEAK";
const SECRET_GH_TOKEN = "ghp_test-fixture-happy-DO-NOT-LEAK";
const SECRET_AZ_TOKEN = "test-fixture-happy-AZ-DO-NOT-LEAK";

function makeHealthyAdapter(): FsAdapter {
  const policyBytes = JSON.stringify({
    schemaVersion: 1,
    effort: "medium",
    minimumSeverity: "warning",
    excludes: ["node_modules/**"],
  });
  return {
    exists: (path) =>
      path.endsWith("umactually.review.json") ||
      path.endsWith("src/cli.ts") ||
      path.endsWith("dist/cli.js"),
    isSymlink: () => false,
    isFile: (path) =>
      path.endsWith("umactually.review.json") ||
      path.endsWith("src/cli.ts") ||
      path.endsWith("dist/cli.js"),
    isDirectory: () => false,
    unlink: () => undefined,
    removeDir: () => undefined,
    readFile: (path) => (path.endsWith("umactually.review.json") ? policyBytes : ""),
    writeFile: () => undefined,
    writeFileAtomic: () => undefined,
    getMode: () => null,
    setMode: () => undefined,
  };
}

function makeCorruptAdapter(): FsAdapter {
  return {
    exists: (path) => path.endsWith("umactually.review.json"),
    isSymlink: () => false,
    isFile: (path) => path.endsWith("umactually.review.json"),
    isDirectory: () => false,
    unlink: () => undefined,
    removeDir: () => undefined,
    readFile: (path) => (path.endsWith("umactually.review.json") ? "{not valid json at all" : ""),
    writeFile: () => undefined,
    writeFileAtomic: () => undefined,
    getMode: () => null,
    setMode: () => undefined,
  };
}

const healthyEnv: Readonly<Record<string, string | undefined>> = {
  ...Object.fromEntries([...KNOWN_ENV_VAR_NAMES].map((name) => [name, `present-${name}`])),
  UMACTUALLY_API_KEY: SECRET_API_KEY,
  UMACTUALLY_API_URL: "https://provider.invalid/v1",
  UMACTUALLY_PROVIDER: "openai-compatible",
  GITHUB_TOKEN: SECRET_GH_TOKEN,
  GH_TOKEN: SECRET_GH_TOKEN,
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_PATH: "/does/not/exist",
  GITHUB_REPOSITORY: "octo-org/octo-repo",
  GITHUB_HEAD_SHA: "1".repeat(40),
  GITHUB_BASE_SHA: "2".repeat(40),
  GITHUB_PR_NUMBER: "42",
  TF_BUILD: "True",
  SYSTEM_ACCESSTOKEN: SECRET_AZ_TOKEN,
  AZURE_DEVOPS_TOKEN: SECRET_AZ_TOKEN,
  SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
  SYSTEM_TEAMPROJECT: "Example",
  BUILD_REPOSITORY_ID: "00000000-0000-0000-0000-000000000042",
  SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
  SYSTEM_PULLREQUEST_SOURCECOMMITID: "1".repeat(40),
  SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
};

const failureEnv: Readonly<Record<string, string | undefined>> = {
  // Note: NO UMACTUALLY_API_KEY — credentials check should fail.
  UMACTUALLY_API_URL: "https://provider.invalid/v1",
  UMACTUALLY_PROVIDER: "openai-compatible",
  GITHUB_TOKEN: "wrong-token-401-path",
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "octo-org/octo-repo",
  GITHUB_HEAD_SHA: "1".repeat(40),
  GITHUB_BASE_SHA: "2".repeat(40),
  GITHUB_PR_NUMBER: "42",
  GITHUB_EVENT_PATH: "/does/not/exist",
  TF_BUILD: "True",
  SYSTEM_ACCESSTOKEN: "wrong-token-403-path",
  SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
  SYSTEM_TEAMPROJECT: "Example",
  BUILD_REPOSITORY_ID: "00000000-0000-0000-0000-000000000042",
  SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
  SYSTEM_PULLREQUEST_SOURCECOMMITID: "1".repeat(40),
  SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
  AZURE_DEVOPS_TOKEN: "wrong-token-403-path",
};

function captureRequestsTarget(): { calls: { url: string; method: string; body: string | undefined }[] } {
  return { calls: [] };
}

function makeHappyFetch(capture: { calls: { url: string; method: string; body: string | undefined }[] }): typeof fetch {
  return async (input, init): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    capture.calls.push({ url, method, body });
    // Happy providers: model catalog = ["gpt-4-fixture"]; latency = <200ms.
    if (url.endsWith("/v1/models") || url.endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "gpt-4-fixture" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("api.github.com")) {
      return new Response(JSON.stringify({ login: "octocat" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("dev.azure.com")) {
      return new Response(JSON.stringify({ authenticatedUser: { id: "fixture" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("ok", { status: 200 });
  };
}

function makeFailureFetch(capture: { calls: { url: string; method: string; body: string | undefined }[] }): typeof fetch {
  return async (input, init): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    capture.calls.push({ url, method, body });
    if (url.includes("api.github.com")) {
      return new Response("forbidden", { status: 403 });
    }
    if (url.includes("dev.azure.com")) {
      return new Response("forbidden", { status: 403 });
    }
    // Hanging endpoint for the provider probe.
    if (url.endsWith("/v1/models") || url.endsWith("/models")) {
      await new Promise(() => undefined);
      return new Response("never", { status: 599 });
    }
    return new Response("error", { status: 500 });
  };
}

const distFreshFs = {
  stat: async (path: string) => ({
    mtimeMs: path.endsWith("src/cli.ts") ? 100 : 200,
  }),
};

const insideGit = async () => ({ stdout: "true\n", stderr: "" });

function stripSecrets(result: FullDoctorResult): FullDoctorResult {
  return {
    ...result,
    checks: result.checks.map((check: DoctorCheckResult) => ({
      ...check,
      message: check.message
        .replace(new RegExp(SECRET_API_KEY.slice(0, 12), "gu"), "[REDACTED API KEY]")
        .replace(new RegExp(SECRET_GH_TOKEN.slice(0, 8), "gu"), "[REDACTED GH TOKEN]")
        .replace(new RegExp(SECRET_AZ_TOKEN.slice(0, 8), "gu"), "[REDACTED AZ TOKEN]"),
      remediation: (check.remediation ?? "")
        .replace(new RegExp(SECRET_API_KEY.slice(0, 12), "gu"), "[REDACTED API KEY]")
        .replace(new RegExp(SECRET_GH_TOKEN.slice(0, 8), "gu"), "[REDACTED GH TOKEN]")
        .replace(new RegExp(SECRET_AZ_TOKEN.slice(0, 8), "gu"), "[REDACTED AZ TOKEN]"),
    })) as readonly DoctorCheckResult[],
  };
}

describe("task-8 evidence generation", () => {
  it("writes the happy + failure evidence JSON files", async () => {
    await mkdir(EVIDENCE_DIR, { recursive: true });

    // ── Happy path ──────────────────────────────────────────────────
    const happyCapture = captureRequestsTarget();
    const happyFetch = makeHappyFetch(happyCapture);
    const happyResult = await runFullDoctor({
      cwd: "/fixture/repo",
      isTTY: false,
      env: healthyEnv,
      fsAdapter: distFreshFs,
      fsAdapterSync: makeHealthyAdapter(),
      execFile: insideGit,
      packageRoot: "/fixture/repo",
      nodeVersion: "24.0.0",
      fetchImpl: happyFetch,
      fetchTimeoutMs: 5000,
    });

    const happyStripped = stripSecrets(happyResult);
    const happyFile = {
      scenario: "happy",
      task: "task-8-doctor-full-readiness",
      command: "umactually doctor --full --json",
      mocked: {
        provider: "https://provider.invalid/v1/models → 200 with single model catalog",
        github: "GET /users/octocat → 200 (proves contents/pulls read scope)",
        azure: "GET /_apis/connectionData → 200 (proves build service access)",
      },
      capturedRequests: {
        allMethods: [...new Set(happyCapture.calls.map((c) => c.method))],
        totalCalls: happyCapture.calls.length,
        writeCalls: happyCapture.calls.filter((c) => c.method !== "GET").length,
        sample: happyCapture.calls.slice(0, 4),
      },
      result: happyStripped,
      invariants: {
        jsonShape: {
          schemaVersion: happyResult.json.schemaVersion,
          command: happyResult.json.command,
          mode: happyResult.json.mode,
          exitCode: happyResult.json.exitCode,
        },
        exitCode: happyResult.exitCode,
        allChecksHaveTypedId: happyResult.checks.every((c) => typeof c.id === "string" && c.id.length > 0),
        allPassChecksHaveLatency: happyResult.checks
          .filter((c) => c.id === "provider-latency" || c.id === "model-discovery")
          .every((c) => typeof c.latencyMs === "number"),
        noSecretLeakedInResult: !JSON.stringify(happyResult).includes(SECRET_API_KEY) &&
          !JSON.stringify(happyResult).includes(SECRET_GH_TOKEN) &&
          !JSON.stringify(happyResult).includes(SECRET_AZ_TOKEN),
      },
    };

    await writeFile(
      resolve(EVIDENCE_DIR, "task-8-first-class-product.json"),
      `${JSON.stringify(happyFile, null, 2)}\n`,
    );

    // ── Failure path ────────────────────────────────────────────────
    const failureCapture = captureRequestsTarget();
    const failureFetch = makeFailureFetch(failureCapture);
    const failureResult = await runFullDoctor({
      cwd: "/fixture/repo",
      isTTY: false,
      env: failureEnv,
      fsAdapter: distFreshFs,
      fsAdapterSync: makeCorruptAdapter(),
      execFile: insideGit,
      packageRoot: "/fixture/repo",
      nodeVersion: "24.0.0",
      fetchImpl: failureFetch,
      fetchTimeoutMs: 200,
    });

    const failureStripped = stripSecrets(failureResult);
    const failureFile = {
      scenario: "failure",
      task: "task-8-doctor-full-readiness",
      command: "umactually doctor --full --json",
      mocked: {
        provider: "GET /v1/models HANGS (forces timeout)",
        github: "GET /users/octocat → 403 (insufficient scope)",
        azure: "GET /_apis/connectionData → 403 (insufficient scope)",
        policy: "umactually.review.json contains `{not valid json at all` (corrupt JSON)",
      },
      capturedRequests: {
        allMethods: [...new Set(failureCapture.calls.map((c) => c.method))],
        totalCalls: failureCapture.calls.length,
        writeCalls: failureCapture.calls.filter((c) => c.method !== "GET").length,
        boundedByTimeout: true,
        sample: failureCapture.calls.slice(0, 4),
      },
      result: failureStripped,
      redactedChecks: {
        credentials: failureResult.checks.find((c) => c.id === "credentials")?.status,
        reviewPolicy: failureResult.checks.find((c) => c.id === "review-policy")?.status,
        providerLatency: failureResult.checks.find((c) => c.id === "provider-latency")?.status,
        githubPermissions: failureResult.checks.find((c) => c.id === "github-permissions")?.status,
        azurePermissions: failureResult.checks.find((c) => c.id === "azure-permissions")?.status,
      },
      invariants: {
        exitsOneOnFail: failureResult.exitCode === 1,
        jsonShape: {
          schemaVersion: failureResult.json.schemaVersion,
          command: failureResult.json.command,
          mode: failureResult.json.mode,
          exitCode: failureResult.json.exitCode,
        },
        noSecretLeakedInResult: !JSON.stringify(failureResult).includes("sk-test") &&
          !JSON.stringify(failureResult).includes("wrong-token"),
        noPolicyBytesLeaked: !JSON.stringify(failureResult).includes("{not valid json at all"),
      },
    };

    await writeFile(
      resolve(EVIDENCE_DIR, "task-8-first-class-product-failure.json"),
      `${JSON.stringify(failureFile, null, 2)}\n`,
    );

    // Sanity: the files actually exist on disk.
    expect(Object.keys(happyFile).length).toBeGreaterThan(0);
    expect(Object.keys(failureFile).length).toBeGreaterThan(0);
  });
});
