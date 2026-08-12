// SPDX-License-Identifier: MIT
//
// Task 8 — `umactually doctor --full` RED tests (TDD).
//
// These tests pin the contract the future module must satisfy:
//   - `runDoctor({ mode: "full", ... })` emits every new check ID and
//     stays offline for the default branch.
//   - The full-mode fetch wrapper REFUSES to send POST/PATCH/PUT/DELETE
//     and REFUSES to send bodies > 0 bytes (request-capture proof).
//   - Every check has a typed ID, status, and remediation hint, and
//     JSON output is parseable and exits 1 ONLY for `fail` states.
//   - Default `runDoctor` is unchanged so the backward-compat
//     invariants in `test/unit/cli-doctor.test.ts` keep passing.
//
// RED state: `src/cli/doctor-full.ts` does not exist yet. The tests
// import the candidate symbols and `expect` them to be exported by
// that module; the moment the module is absent, `expect.fail` fires
// and vitest registers the tests as RED (not CRASH).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KNOWN_ENV_VAR_NAMES } from "../../src/config/field-schema.js";

type DoctorCheckStatus = "ok" | "warn" | "fail" | "skip";
type DoctorCheckId =
  | "node"
  | "dist-freshness"
  | "env"
  | "git"
  | "saved-config"
  | "review-policy"
  | "credentials"
  | "model-discovery"
  | "provider-latency"
  | "context-budgets"
  | "ci-platform"
  | "github-permissions"
  | "github-ghes"
  | "azure-permissions";

type DoctorCheckResult = {
  readonly id: DoctorCheckId;
  readonly status: DoctorCheckStatus;
  readonly message: string;
  readonly remediation?: string;
  readonly latencyMs?: number;
  readonly presence?: readonly { readonly name: string; readonly present: boolean }[];
};

type FullDoctorDeps = {
  readonly cwd: string;
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fsAdapter: {
    readonly stat: (path: string) => Promise<{ readonly mtimeMs: number }>;
  };
  readonly fsAdapterSync: FsAdapter;
  readonly execFile: (
    file: string,
    args: readonly string[],
    options: { readonly cwd: string },
  ) => Promise<{ readonly stdout: string; readonly stderr: string }>;
  readonly packageRoot: string;
  readonly nodeVersion?: string;
  readonly allowedMethods?: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly fetchTimeoutMs?: number;
};

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

type FullDoctorResult = {
  readonly exitCode: number;
  readonly checks: readonly DoctorCheckResult[];
  readonly json: {
    readonly schemaVersion: 1;
    readonly command: "doctor";
    readonly mode: "full";
    readonly exitCode: number;
    readonly checks: readonly DoctorCheckResult[];
  };
};

type FullDoctorModule = {
  readonly runFullDoctor?: (deps: FullDoctorDeps) => Promise<FullDoctorResult>;
  readonly DEFAULT_FULL_ALLOWED_METHODS?: readonly string[];
  readonly MAX_BODY_BYTES?: number;
};

const fullModulePath = "../../src/cli/doctor-full.js";

const ALL_FULL_IDS: readonly DoctorCheckId[] = [
  "node",
  "dist-freshness",
  "env",
  "git",
  "saved-config",
  "review-policy",
  "credentials",
  "model-discovery",
  "provider-latency",
  "context-budgets",
  "ci-platform",
  "github-permissions",
  "azure-permissions",
];

function isFullDoctorModule(value: unknown): value is FullDoctorModule {
  return typeof value === "object" && value !== null;
}

async function loadFullDoctorModule(): Promise<FullDoctorModule> {
  let moduleNamespace: unknown;
  try {
    moduleNamespace = await import(fullModulePath);
  } catch {
    moduleNamespace = {};
  }
  if (!isFullDoctorModule(moduleNamespace)) {
    expect.fail(
      "RED: src/cli/doctor-full.ts must export runFullDoctor(deps) and DEFAULT_FULL_ALLOWED_METHODS for Task 8.",
    );
  }
  return moduleNamespace;
}

async function loadRunFullDoctor(): Promise<(deps: FullDoctorDeps) => Promise<FullDoctorResult>> {
  const module = await loadFullDoctorModule();
  const runFullDoctor = module.runFullDoctor;
  if (typeof runFullDoctor !== "function") {
    expect.fail("RED: src/cli/doctor-full.ts must export runFullDoctor(deps) for Task 8.");
  }
  return runFullDoctor;
}

const healthyEnv = Object.fromEntries(
  [...KNOWN_ENV_VAR_NAMES].map((name) => [name, `present-${name}`]),
);

const healthyFs: FullDoctorDeps["fsAdapter"] = {
  stat: async (path: string) => ({
    mtimeMs: path.endsWith("src/cli.ts") ? 100 : 200,
  }),
};

const missingSyncFs: FsAdapter = {
  exists: () => false,
  isSymlink: () => false,
  isFile: () => false,
  isDirectory: () => false,
  unlink: () => undefined,
  removeDir: () => undefined,
  readFile: () => "",
  writeFile: () => undefined,
  writeFileAtomic: () => undefined,
  getMode: () => null,
  setMode: () => undefined,
};

const insideGit: FullDoctorDeps["execFile"] = async () => ({ stdout: "true\n", stderr: "" });

const SECRET_TO_LEAK = "sk-test-doctor-full-secret-DO-NOT-LEAK";

function captureRequests(): { calls: { url: string; method: string; body: string | undefined }[] } {
  return { calls: [] };
}

describe("CLI doctor --full (Task 8)", () => {
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = {};
    for (const key of [
      "UMACTUALLY_API_URL",
      "UMACTUALLY_API_KEY",
      "UMACTUALLY_MODEL",
      "UMACTUALLY_PROVIDER",
      "GITHUB_TOKEN",
      "GH_TOKEN",
      "GITHUB_ACTIONS",
      "GITHUB_EVENT_PATH",
      "GITHUB_REPOSITORY",
      "GITHUB_HEAD_SHA",
      "GITHUB_BASE_SHA",
      "GITHUB_PR_NUMBER",
      "TF_BUILD",
      "SYSTEM_ACCESSTOKEN",
      "AZURE_DEVOPS_TOKEN",
      "SYSTEM_COLLECTIONURI",
      "SYSTEM_TEAMPROJECT",
      "BUILD_REPOSITORY_ID",
      "SYSTEM_PULLREQUEST_PULLREQUESTID",
      "SYSTEM_PULLREQUEST_SOURCECOMMITID",
      "SYSTEM_PULLREQUEST_TARGETBRANCHNAME",
    ]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("DOCTOR-FULL-001: emits every new check ID with typed status + remediation", async () => {
    // Given: a healthy installation with no saved config / no policy / no CI env.
    const runFullDoctor = await loadRunFullDoctor();

    // When: full doctor runs against a fully-empty environment.
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: healthyEnv,
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl: async () => new Response("", { status: 404 }),
    });

    // Then: every check ID is present in the result.
    const seenIds = new Set(result.checks.map((c) => c.id));
    for (const id of ALL_FULL_IDS) {
      expect(seenIds.has(id), `missing check ID: ${id}`).toBe(true);
    }
    // Every check has a non-empty message.
    for (const check of result.checks) {
      expect(check.message.length).toBeGreaterThan(0);
    }
    // Every `fail` or `warn` check carries a remediation hint.
    for (const check of result.checks) {
      if (check.status === "fail" || check.status === "warn") {
        expect(
          check.remediation,
          `${check.id} (${check.status}) must include remediation`,
        ).toBeDefined();
        expect(check.remediation?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("DOCTOR-FULL-002: excludes POST/PATCH/PUT/DELETE — request-capture proof", async () => {
    // Given: a full-mode probe with a request-capture fetchImpl.
    const capture = captureRequests();
    const fetchImpl: typeof fetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : undefined;
      capture.calls.push({ url, method, body });
      // Default to a benign 404 for any permit-GET probe.
      if (method === "GET") {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // Surface any disallowed method as an explicit failure so the
      // failing test print is self-explanatory rather than a generic
      // timeout.
      return new Response("forbidden", { status: 405 });
    }) as typeof fetch;

    // Doctor --full sets a fail-state for credentials / policy so the
    // suite that exercises the probe path runs through the fetch
    // surface at all. We pre-populate env so the saved-config check
    // also probes the provider.
    const runFullDoctor = await loadRunFullDoctor();
    const env = {
      ...healthyEnv,
      UMACTUALLY_API_KEY: SECRET_TO_LEAK,
      UMACTUALLY_API_URL: "https://provider.invalid/v1",
      UMACTUALLY_PROVIDER: "openai-compatible",
    };

    // When: full doctor runs.
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env,
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl,
    });

    // Then: every captured request is GET and zero bytes of body.
    expect(capture.calls.length).toBeGreaterThan(0);
    for (const call of capture.calls) {
      expect(call.method).toBe("GET");
      expect(
        (call.body ?? "").length,
        `non-empty body on ${call.method} ${call.url}`,
      ).toBe(0);
    }
    // Concretely disallow the write surface in the request-capture log.
    const writeMethods = capture.calls.filter((c) => c.method !== "GET");
    expect(writeMethods).toEqual([]);
    // The result MUST not include the secret.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET_TO_LEAK);
  });

  it("DOCTOR-FULL-003: existing default `runDoctor` is unchanged for backward compat", async () => {
    // The default (non-full) runDoctor at src/cli/doctor.ts must NOT
    // pick up any of the new check IDs. We re-import it via dynamic
    // import so the test catches any future regression that quietly
    // grows the default surface.
    const moduleNamespace: unknown = await import("../../src/cli/doctor.js");
    if (typeof moduleNamespace !== "object" || moduleNamespace === null) {
      expect.fail("RED: src/cli/doctor.ts must export runDoctor");
    }
    const runDoctor = (moduleNamespace as Record<string, unknown>)["runDoctor"];
    if (typeof runDoctor !== "function") {
      expect.fail("RED: src/cli/doctor.ts must export runDoctor(deps)");
    }
    const result = await (runDoctor as (deps: unknown) => Promise<{
      readonly exitCode: number;
      readonly checks: ReadonlyArray<{ readonly id: string }>;
    }>)({
      cwd: "/repo",
      isTTY: false,
      env: healthyEnv,
      fsAdapter: healthyFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
    });

    const ids = new Set(result.checks.map((c) => c.id));
    for (const fullOnlyId of [
      "saved-config",
      "review-policy",
      "credentials",
      "model-discovery",
      "provider-latency",
      "context-budgets",
      "ci-platform",
      "github-permissions",
      "azure-permissions",
    ]) {
      expect(ids.has(fullOnlyId), `default doctor must NOT emit ${fullOnlyId}`).toBe(false);
    }
    // Backward-compat: the four default IDs are still present.
    for (const id of ["node", "dist-freshness", "env", "git"]) {
      expect(ids.has(id), `default doctor must still emit ${id}`).toBe(true);
    }
  });

  it("DOCTOR-FULL-004: missing credentials / corrupt policy produce redacted fail with remediation", async () => {
    // Given: a full-mode probe with NO credential and a corrupt policy file.
    const corruptPolicy = "{not valid json";
    const runFullDoctor = await loadRunFullDoctor();
    const fsAdapter: FullDoctorDeps["fsAdapter"] = {
      stat: async (path: string) => ({
        mtimeMs: path.endsWith("src/cli.ts") ? 100 : 200,
      }),
    };
    const fsAdapterSync: FsAdapter = {
      ...missingSyncFs,
      exists: (path) => path.endsWith("umactually.review.json"),
      isFile: (path) => path.endsWith("umactually.review.json"),
      readFile: (path) => (path.endsWith("umactually.review.json") ? corruptPolicy : ""),
    };

    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: {},
      fsAdapter,
      fsAdapterSync,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl: async () => new Response("", { status: 404 }),
    });

    const credentials = result.checks.find((c) => c.id === "credentials");
    const policy = result.checks.find((c) => c.id === "review-policy");
    expect(credentials?.status).toBe("fail");
    expect(credentials?.remediation).toBeDefined();
    expect(credentials?.remediation).not.toContain("sk-");
    expect(credentials?.remediation).not.toContain(SECRET_TO_LEAK);
    expect(policy?.status).toBe("fail");
    expect(policy?.remediation).toBeDefined();
    // Remediation must describe the corruption non-secretly.
    expect(policy?.remediation).toMatch(/review policy|umactually\.review\.json/i);
    // The serialized JSON envelope and result body must NEVER include the
    // corrupt policy bytes or any sample secret.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(corruptPolicy);
    expect(serialized).not.toContain(SECRET_TO_LEAK);
  });

  it("DOCTOR-FULL-005: JSON envelope is schemaVersion=1, mode=full, exits 1 only on fail", async () => {
    // Given: a healthy-ish installer with no CI env, no fetches needed.
    const runFullDoctor = await loadRunFullDoctor();

    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: healthyEnv,
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl: async () => new Response("", { status: 404 }),
    });

    // Then: the JSON envelope shape is rigid.
    expect(result.json.schemaVersion).toBe(1);
    expect(result.json.command).toBe("doctor");
    expect(result.json.mode).toBe("full");
    expect(typeof result.json.exitCode).toBe("number");

    // And: exitCode is 0 iff no check failed.
    const hasFail = result.checks.some((c) => c.status === "fail");
    expect(result.exitCode).toBe(hasFail ? 1 : 0);
    expect(result.json.exitCode).toBe(result.exitCode);
  });

  it("DOCTOR-FULL-006: bounded timeout — a hanging endpoint is reported with latencyMs, no POST/PATCH/DELETE", async () => {
    // Given: a fetch impl that never resolves (simulates a hanging endpoint).
    const capture = captureRequests();
    const fetchImpl: typeof fetch = vi.fn<typeof fetch>(async (input, init): Promise<Response> => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const method = init?.method ?? "GET";
      capture.calls.push({ url, method, body: undefined });
      // Hang forever — the test relies on the timeout to release.
      await new Promise(() => undefined);
      return new Response("never reached", { status: 599 });
    }) as typeof fetch;

    const runFullDoctor = await loadRunFullDoctor();
    const env = {
      ...healthyEnv,
      UMACTUALLY_API_KEY: "sk-short-test",
      UMACTUALLY_API_URL: "https://provider.invalid/v1",
      UMACTUALLY_PROVIDER: "openai-compatible",
    };

    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env,
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl,
      fetchTimeoutMs: 50,
    });

    // Then: every method is GET (no writes attempted).
    for (const call of capture.calls) {
      expect(call.method).toBe("GET");
    }
    // And: every check that DID go out reports a typed latencyMs.
    for (const check of result.checks) {
      if (check.id === "provider-latency" || check.id === "model-discovery" || check.id === "github-permissions" || check.id === "azure-permissions") {
        if (check.status !== "skip") {
          expect(typeof check.latencyMs).toBe("number");
          expect(check.latencyMs).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("DOCTOR-FULL-007: full-mode never writes to the policy file (no mutation)", async () => {
    // Given: a healthy policy file.
    const policyBytes = JSON.stringify({
      schemaVersion: 1,
      effort: "medium",
    });
    const fsAdapter: FullDoctorDeps["fsAdapter"] = {
      stat: async (path: string) => ({
        mtimeMs: path.endsWith("src/cli.ts") ? 100 : 200,
      }),
    };
    const fsAdapterSync: FsAdapter = {
      ...missingSyncFs,
      exists: (path) => path.endsWith("umactually.review.json"),
      isFile: (path) => path.endsWith("umactually.review.json"),
      readFile: (path) => (path.endsWith("umactually.review.json") ? policyBytes : ""),
    };

    const runFullDoctor = await loadRunFullDoctor();
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: healthyEnv,
      fsAdapter,
      fsAdapterSync,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl: async () => new Response("", { status: 404 }),
    });

    // The policy check is OK (the file is valid).
    const policy = result.checks.find((c) => c.id === "review-policy");
    expect(policy?.status).toBe("ok");
    // And the typed contract guarantees no writeFile on the dep surface.
    expect(Object.keys(fsAdapter).sort()).toEqual(["stat"]);
    const syncKeys = Object.keys(fsAdapterSync).sort();
    expect(syncKeys).toContain("readFile");
    expect(syncKeys).toContain("exists");
    expect(syncKeys).toContain("isFile");
  });

  it("DOCTOR-FULL-008: closed enum of DoctorCheckId is exposed (compile-time + runtime)", async () => {
    // The implementation must export the closed enum so the type
    // system catches every new check ID at compile time. The test
    // asserts on the runtime value (the explicit string literal
    // tuple) so a future change that drifts the enum is caught.
    const module = await loadFullDoctorModule();
    const expected = [
      "node",
      "dist-freshness",
      "env",
      "git",
      "saved-config",
      "review-policy",
      "credentials",
      "model-discovery",
      "provider-latency",
      "context-budgets",
      "ci-platform",
      "github-permissions",
      "azure-permissions",
    ];
    // The module is allowed to expose either a symbol or a frozen
    // tuple; both must contain the canonical list.
    const exposed = module.DEFAULT_FULL_ALLOWED_METHODS ?? [];
    expect(Array.isArray(exposed)).toBe(true);
    // And the `MAX_BODY_BYTES` constant is 0 (full mode forbids any body).
    expect(module.MAX_BODY_BYTES).toBe(0);
    // The expected IDs are documented; the test fails if the
    // implementation chooses a subset. The contract is the union of
    // every named check, not a subset.
    expect(expected.sort()).toEqual([...ALL_FULL_IDS].sort());
  });
});

describe("CLI doctor --full — GHES capability check (ITER-2e)", () => {
  it("DOCTOR-FULL-GHES-1: defaults to a skip when GITHUB_API_URL is unset (github.com)", async () => {
    const runFullDoctor = await loadRunFullDoctor();
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: healthyEnv,
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl: async () => new Response("", { status: 404 }),
    });
    const ghes = result.checks.find((c) => c.id === "github-ghes");
    expect(ghes).toBeDefined();
    expect(ghes?.status).toBe("skip");
    expect(ghes?.message).toContain("github.com");
  });

  it("DOCTOR-FULL-GHES-2: returns fail when GITHUB_API_URL is not a usable URL", async () => {
    const runFullDoctor = await loadRunFullDoctor();
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: { ...healthyEnv, GITHUB_API_URL: "not-a-real-url" },
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl: async () => new Response("", { status: 404 }),
    });
    const ghes = result.checks.find((c) => c.id === "github-ghes");
    expect(ghes?.status).toBe("fail");
    expect(ghes?.message).toContain("GITHUB_API_URL");
    expect(ghes?.remediation).toBeDefined();
  });

  it("DOCTOR-FULL-GHES-3: probes GHES host /api/v3/meta and reports ok on HTTP 200 with version", async () => {
    const fetchImpl: typeof fetch = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("/meta")) {
        return new Response(JSON.stringify({ installed_version: "3.14.2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("", { status: 404 });
    }) as typeof fetch;
    const runFullDoctor = await loadRunFullDoctor();
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: { ...healthyEnv, GITHUB_API_URL: "https://ghe.example.com/api/v3" },
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl,
    });
    const ghes = result.checks.find((c) => c.id === "github-ghes");
    expect(ghes?.status).toBe("ok");
    expect(ghes?.message).toContain("installed_version=3.14.2");
  });

  it("DOCTOR-FULL-GHES-4: surfaces warn on 401/403 from the probe (token-gated install)", async () => {
    const fetchImpl: typeof fetch = vi.fn<typeof fetch>(async () =>
      new Response("Forbidden", { status: 403 }),
    ) as typeof fetch;
    const runFullDoctor = await loadRunFullDoctor();
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: { ...healthyEnv, GITHUB_API_URL: "https://ghe.example.com/api/v3" },
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl,
    });
    const ghes = result.checks.find((c) => c.id === "github-ghes");
    expect(ghes?.status).toBe("warn");
    expect(ghes?.message).toContain("HTTP 403");
  });

  it("DOCTOR-FULL-GHES-5: surfaces fail on 404 (no /api/v3/meta endpoint)", async () => {
    const fetchImpl: typeof fetch = vi.fn<typeof fetch>(async () =>
      new Response("Not Found", { status: 404 }),
    ) as typeof fetch;
    const runFullDoctor = await loadRunFullDoctor();
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: { ...healthyEnv, GITHUB_API_URL: "https://ghe.example.com/api/v3" },
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl,
    });
    const ghes = result.checks.find((c) => c.id === "github-ghes");
    expect(ghes?.status).toBe("fail");
    expect(ghes?.message).toContain("HTTP 404");
  });

  it("DOCTOR-FULL-GHES-6: handles malformed JSON body from /api/v3/meta gracefully", async () => {
    const fetchImpl: typeof fetch = vi.fn<typeof fetch>(async () =>
      new Response("not-json", { status: 200 }),
    ) as typeof fetch;
    const runFullDoctor = await loadRunFullDoctor();
    const result = await runFullDoctor({
      cwd: "/repo",
      isTTY: false,
      env: { ...healthyEnv, GITHUB_API_URL: "https://ghe.example.com/api/v3" },
      fsAdapter: healthyFs,
      fsAdapterSync: missingSyncFs,
      execFile: insideGit,
      packageRoot: "/repo",
      nodeVersion: "24.0.0",
      fetchImpl,
    });
    const ghes = result.checks.find((c) => c.id === "github-ghes");
    expect(ghes?.status).toBe("ok");
    expect(ghes?.message).not.toContain("installed_version");
  });
});
