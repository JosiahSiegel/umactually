import { describe, expect, it } from "vitest";

import { KNOWN_ENV_VAR_NAMES } from "../../src/config/field-schema.js";

type DoctorCheck = {
  readonly id: string;
  readonly status: "ok" | "warn" | "fail" | "skip";
  readonly message: string;
  readonly hint?: string;
};

type DoctorResult = {
  readonly exitCode: number;
  readonly checks: readonly DoctorCheck[];
};

type FsAdapter = {
  readonly stat: (path: string) => Promise<{ readonly mtimeMs: number }>;
};

type ExecFile = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string },
) => Promise<{ readonly stdout: string; readonly stderr: string }>;

type RunDoctorOptions = {
  readonly cwd: string;
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fsAdapter: FsAdapter;
  readonly execFile: ExecFile;
  readonly packageRoot: string;
  readonly nodeVersion: string;
};

type RunDoctor = (options: RunDoctorOptions) => Promise<DoctorResult>;

type DoctorModule = {
  readonly runDoctor?: RunDoctor;
};

const doctorModulePath = "../../src/cli/doctor.js";
const packageRoot = "/repo";
const healthyEnv = Object.fromEntries(
  [...KNOWN_ENV_VAR_NAMES].map((name) => [name, `present-${name}`]),
);

const healthyFs: FsAdapter = {
  stat: async (path) => ({
    mtimeMs: path.endsWith("src/cli.ts") ? 100 : 200,
  }),
};

const missingDistFs: FsAdapter = {
  stat: async (path) => {
    if (path.endsWith("dist/cli.js")) {
      return Promise.reject(new Error("ENOENT: dist/cli.js"));
    }
    return { mtimeMs: 100 };
  },
};

const installedPackageFs: FsAdapter = {
  stat: async (path) => {
    if (path.endsWith("src/cli.ts")) {
      return Promise.reject(new Error("ENOENT: src/cli.ts"));
    }
    return { mtimeMs: 200 };
  },
};

const standaloneBinaryFs: FsAdapter = {
  stat: async () => Promise.reject(new Error("ENOENT: standalone binary")),
};

const insideGit: ExecFile = async () => ({ stdout: "true\n", stderr: "" });
const outsideGit: ExecFile = async () => Promise.reject(new Error("not a git repository"));

function isDoctorModule(value: unknown): value is DoctorModule {
  return typeof value === "object" && value !== null;
}

async function loadRunDoctor(): Promise<RunDoctor> {
  let moduleNamespace: unknown;
  try {
    moduleNamespace = await import(doctorModulePath);
  } catch {
    moduleNamespace = {};
  }
  const runDoctor = isDoctorModule(moduleNamespace) ? moduleNamespace.runDoctor : undefined;
  expect(runDoctor).toBeDefined();
  if (typeof runDoctor !== "function") {
    throw new TypeError("RED: src/cli/doctor.ts must export runDoctor(options)");
  }
  return runDoctor;
}

function options(overrides: Partial<RunDoctorOptions> = {}): RunDoctorOptions {
  return {
    cwd: packageRoot,
    isTTY: true,
    env: healthyEnv,
    fsAdapter: healthyFs,
    execFile: insideGit,
    packageRoot,
    nodeVersion: "24.0.0",
    ...overrides,
  };
}

describe("CLI doctor (M5)", () => {
  it("CLI-DOCTOR-001: reports healthy Node, dist, env, and git checks", async () => {
    // Given: Node 24, a fresh bundle, every known env var, and a git worktree.
    const runDoctor = await loadRunDoctor();

    // When: doctor evaluates the healthy installation.
    const result = await runDoctor(options());

    // Then: every diagnostic family is healthy and the command succeeds.
    expect(result.exitCode).toBe(0);
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "node", status: "ok" }));
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "dist-freshness", status: "ok" }),
    );
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "env", status: "ok" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "git", status: "ok" }));
  });

  it("CLI-DOCTOR-002: fails with a Node 24 hint on Node 22", async () => {
    // Given: an otherwise healthy installation running Node 22.
    const runDoctor = await loadRunDoctor();

    // When: doctor evaluates the unsupported runtime.
    const result = await runDoctor(options({ nodeVersion: "22.18.0" }));

    // Then: Node is a fatal diagnostic with actionable upgrade guidance.
    expect(result.exitCode).toBe(1);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "node", status: "fail", hint: expect.stringMatching(/Node 24/u) }),
    );
  });

  it("CLI-DOCTOR-003: fails with bundle guidance when dist is missing", async () => {
    // Given: source exists but the bundled CLI does not.
    const runDoctor = await loadRunDoctor();

    // When: doctor checks bundle freshness.
    const result = await runDoctor(options({ fsAdapter: missingDistFs }));

    // Then: dist freshness fails and tells the operator how to rebuild.
    expect(result.exitCode).toBe(1);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: "dist-freshness",
        status: "fail",
        hint: expect.stringContaining("npm run bundle"),
      }),
    );
  });

  it("CLI-DOCTOR-004: skips source freshness for an installed package", async () => {
    // Given: npm-installed contents have dist but omit src/cli.ts.
    const runDoctor = await loadRunDoctor();

    // When: doctor evaluates the installed package from a git worktree.
    const result = await runDoctor(options({ fsAdapter: installedPackageFs }));

    // Then: unavailable source freshness is skipped and is not fatal.
    expect(result.exitCode).toBe(0);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "dist-freshness", status: "skip" }),
    );
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "node", status: "ok" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "env", status: "ok" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "git", status: "ok" }));
  });

  it("CLI-DOCTOR-005: warns without failing outside a git repository", async () => {
    // Given: healthy runtime, bundle, and env checks outside a git worktree.
    const runDoctor = await loadRunDoctor();

    // When: doctor probes git repository membership.
    const result = await runDoctor(options({ cwd: "/outside", execFile: outsideGit }));

    // Then: the git warning alone preserves a successful exit.
    expect(result.exitCode).toBe(0);
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "git", status: "warn" }));
  });

  it("CLI-DOCTOR-006: never serializes secret env values", async () => {
    // Given: a recognizable API key is present alongside every known env var.
    const runDoctor = await loadRunDoctor();
    const secret = "sk-test-fixture-secret-DOCTOR-006";
    const env = { ...healthyEnv, UMACTUALLY_API_KEY: secret };

    // When: doctor returns its checks.
    const result = await runDoctor(options({ env }));

    // Then: diagnostics disclose presence only, never the secret value.
    expect(JSON.stringify(result.checks)).not.toContain(secret);
  });

  it("CLI-DOCTOR-007: skips dist-freshness for standalone binary (both dist and src absent)", async () => {
    // Given: a Bun --compile standalone binary where neither dist/ nor src/
    // exists on disk (the codebase is embedded in the executable).
    const runDoctor = await loadRunDoctor();

    // When: doctor checks bundle freshness.
    const result = await runDoctor(options({ fsAdapter: standaloneBinaryFs }));

    // Then: dist freshness is skipped (not failed) and the command succeeds.
    expect(result.exitCode).toBe(0);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "dist-freshness", status: "skip" }),
    );
  });
});
