import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const CLI_MODULE_URL = pathToFileURL(join(REPO_ROOT, "src", "cli.ts")).href;
const LOADER_SOURCE = `
  import { readFileSync } from "node:fs";
  import { registerHooks, stripTypeScriptTypes } from "node:module";
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL?.includes("/src/") && specifier.endsWith(".js")) {
        return {
          url: new URL(specifier.replace(/\\.js$/u, ".ts"), context.parentURL).href,
          shortCircuit: true,
        };
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".ts")) {
        return {
          format: "module",
          source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), {
            mode: "transform",
            sourceMap: true,
          }),
          shortCircuit: true,
        };
      }
      return nextLoad(url, context);
    },
  });
`;
const LOADER_URL = `data:text/javascript;base64,${Buffer.from(LOADER_SOURCE).toString("base64")}`;
const CHILD_SOURCE = `
  import { existsSync, watch } from "node:fs";
  import { join } from "node:path";
  import { runCli } from ${JSON.stringify(CLI_MODULE_URL)};

  const markerPath = join(process.cwd(), ".umactually-auto-ctx");
  let observedMarker = existsSync(markerPath);
  const watcher = watch(process.cwd(), () => {
    observedMarker ||= existsSync(markerPath);
  });
  await runCli([], process.cwd());
  await new Promise((resolve) => setImmediate(resolve));
  observedMarker ||= existsSync(markerPath);
  watcher.close();
  process.stdout.write(JSON.stringify({ observedMarker }) + "\\n");
`;

type CiEnvironment = Readonly<Record<"GITHUB_ACTIONS" | "TF_BUILD", string | undefined>>;

function initializeGitRepository(cwd: string): void {
  const commands = [
    ["init", "--quiet", "--initial-branch=main", cwd],
    ["-C", cwd, "config", "user.email", "test@example.com"],
    ["-C", cwd, "config", "user.name", "Test"],
    ["-C", cwd, "commit", "--quiet", "--allow-empty", "-m", "initial"],
  ] as const;
  for (const args of commands) {
    const result = spawnSync("git", args, { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
  }
}

function runCliSubprocess(cwd: string, ciEnvironment: CiEnvironment): boolean {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env["GITHUB_ACTIONS"];
  delete env["TF_BUILD"];
  if (ciEnvironment.GITHUB_ACTIONS !== undefined) {
    env["GITHUB_ACTIONS"] = ciEnvironment.GITHUB_ACTIONS;
  }
  if (ciEnvironment.TF_BUILD !== undefined) {
    env["TF_BUILD"] = ciEnvironment.TF_BUILD;
  }

  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    "--import",
    LOADER_URL,
    "--input-type=module",
    "--eval",
    CHILD_SOURCE,
  ], { cwd, env, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const lastLine = result.stdout.trimEnd().split(/\r?\n/u).at(-1);
  expect(lastLine).toBeDefined();
  const parsed: unknown = JSON.parse(lastLine ?? "null");
  if (typeof parsed !== "object" || parsed === null || !("observedMarker" in parsed)) {
    throw new TypeError("CLI subprocess did not report its auto-context observation");
  }
  const observedMarker = Reflect.get(parsed, "observedMarker");
  if (typeof observedMarker !== "boolean") {
    throw new TypeError("CLI subprocess reported a non-boolean auto-context observation");
  }
  return observedMarker;
}

describe("CLI auto-context mode gate", () => {
  let workspace = "";

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "umactually-cli-auto-context-"));
    initializeGitRepository(workspace);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("does not create auto-context artifacts in GitHub Actions live mode", () => {
    // Given: GitHub Actions live mode with no plumbing flags.
    // When: the CLI reaches pre-dispatch context resolution.
    const observedMarker = runCliSubprocess(workspace, {
      GITHUB_ACTIONS: "true",
      TF_BUILD: undefined,
    });

    // Then: git auto-context is never materialized.
    expect(observedMarker).toBe(false);
  });

  it("does not create auto-context artifacts in Azure Pipelines live mode", () => {
    // Given: Azure's canonical mixed-case CI marker with no plumbing flags.
    // When: the CLI reaches pre-dispatch context resolution.
    const observedMarker = runCliSubprocess(workspace, {
      GITHUB_ACTIONS: undefined,
      TF_BUILD: "True",
    });

    // Then: git auto-context is never materialized.
    expect(observedMarker).toBe(false);
  });

  it("creates auto-context artifacts in standalone local mode", () => {
    // Given: a local git repository with neither live-CI marker set.
    // When: the CLI reaches pre-dispatch context resolution.
    const observedMarker = runCliSubprocess(workspace, {
      GITHUB_ACTIONS: undefined,
      TF_BUILD: undefined,
    });

    // Then: the existing standalone derivation still materializes its temp directory.
    expect(observedMarker).toBe(true);
  });

  it("does not create auto-context artifacts when both CI markers are set", () => {
    // Given: both supported live-CI markers are present.
    // When: the CLI reaches pre-dispatch context resolution.
    const observedMarker = runCliSubprocess(workspace, {
      GITHUB_ACTIONS: "true",
      TF_BUILD: "True",
    });

    // Then: either CI identity is sufficient to bypass git derivation.
    expect(observedMarker).toBe(false);
  });
});
