// SPDX-License-Identifier: MIT
// Bundle parity test (E2E-9 per plan §T18): spawn `dist/cli.js` and
// `bin/umactually.mjs` for an `--non-interactive --dry-run` invocation
// and verify the JSON envelope output is byte-identical.
//
// Rationale: the bin shim is a thin wrapper that dynamically imports
// `dist/cli.js` (see `bin/umactually.mjs`). Any divergence between the
// shim's `await mod.main(argv)` invocation and the dist bundle's
// auto-invoked `main()` would surface here as a byte diff. The bundle
// output path is the published artifact; if a future refactor causes
// the shim and the bundle to disagree, this test fails before the
// discrepancy ships.
//
// The test is skipped when `dist/cli.js` is absent (the bundle is opt-in:
// `npm run bundle`).

import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { spawnInitCli } from "../helpers/init-cli-envelope.js";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..");
const SHIM = join(REPO_ROOT, "bin", "umactually.mjs");
const DIST = join(REPO_ROOT, "dist", "cli.js");

const SKIP_IF_NO_BUNDLE = !existsSync(DIST) || !existsSync(SHIM);

if (SKIP_IF_NO_BUNDLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `init-bundle-parity e2e skipped: dist/cli.js and/or bin/umactually.mjs ` +
      `not present at ${DIST} / ${SHIM}; run \`npm run bundle\` to enable.`,
  );
}

const HOST_NODE_MAJOR = Number.parseInt(
  process.versions.node.replace(/^v/u, "").split(".")[0] ?? "",
  10,
);
const NODE_24_REQUIRED =
  Number.isFinite(HOST_NODE_MAJOR) &&
  HOST_NODE_MAJOR < 24 &&
  process.env["ALLOW_NODE_22_SMOKE"] !== "1";

if (NODE_24_REQUIRED) {
  // eslint-disable-next-line no-console
  console.warn(
    `init-bundle-parity e2e skipped: host Node ${process.versions.node} < 24.`,
  );
}

const SKIP = SKIP_IF_NO_BUNDLE || NODE_24_REQUIRED;

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

const tmpHomes: string[] = [];
const tmpCwds: string[] = [];

async function freshSandbox(): Promise<{ readonly homeDir: string; readonly cwd: string }> {
  const homeDir = await mkdtemp(join(tmpdir(), "umactually-bundle-parity-home-"));
  const cwd = await mkdtemp(join(tmpdir(), "umactually-bundle-parity-cwd-"));
  tmpHomes.push(homeDir);
  tmpCwds.push(cwd);
  return { homeDir, cwd };
}

function lastJsonLine(stdout: string): string | undefined {
  const lines = stdout.trimEnd().split(/\r?\n/u).filter((line) => line.trim().length > 0);
  return lines.reverse().find((line) => line.trimStart().startsWith("{"));
}

// ---------------------------------------------------------------------------

describe.skipIf(SKIP)("E2E-9 bundle parity: bin/umactually.mjs vs dist/cli.js", () => {
  afterEach(async () => {
    while (tmpHomes.length > 0) {
      const dir = tmpHomes.pop();
      if (dir !== undefined) await rm(dir, { recursive: true, force: true });
    }
    while (tmpCwds.length > 0) {
      const dir = tmpCwds.pop();
      if (dir !== undefined) await rm(dir, { recursive: true, force: true });
    }
  });

  it("emits byte-identical JSON envelopes for a non-interactive success run", async () => {
    // Given: an isolated HOME + CWD per invocation. We run the SAME
    // argv through BOTH entry points in separate sandboxes.
    const argv = [
      "init",
      "--json",
      "--non-interactive",
      "--provider",
      "openai-compatible",
      "--api-url",
      "https://custom.example.com/v1",
      "--api-key",
      "test",
      "--ci",
      "none",
    ] as const;

    const shim = await freshSandbox();
    const dist = await freshSandbox();

    const shimResult = await spawnInitCli({ cliPath: SHIM, argv, homeDir: shim.homeDir, cwd: shim.cwd });
    const distResult = await spawnInitCli({ cliPath: DIST, argv, homeDir: dist.homeDir, cwd: dist.cwd });

    expect(shimResult.status, `shim stderr: ${shimResult.stderr}`).toBe(0);
    expect(distResult.status, `dist stderr: ${distResult.stderr}`).toBe(0);

    // Shim and dist must each run in their OWN HOME sandbox — sharing
    // a HOME makes the second invocation refuse to overwrite the first's
    // config. So we normalize the per-sandbox HOME out of the envelope
    // before comparing.
    const shimEnv = lastJsonLine(shimResult.stdout);
    const distEnv = lastJsonLine(distResult.stdout);
    expect(shimEnv, "shim stdout must end in a JSON envelope").toBeDefined();
    expect(distEnv, "dist stdout must end in a JSON envelope").toBeDefined();

    const normalize = (line: string, homeDir: string): string =>
      line.split(homeDir).join("<HOME>");

    const shimNorm = normalize(shimEnv as string, shim.homeDir);
    const distNorm = normalize(distEnv as string, dist.homeDir);
    expect(shimNorm).toBe(distNorm);
  });

  it("emits byte-identical envelopes for an error case (missing --provider)", async () => {
    // Error envelopes never embed the HOME, so they are byte-equal as-is.
    const argv = ["init", "--json", "--non-interactive"] as const;

    const shim = await freshSandbox();
    const dist = await freshSandbox();

    const shimResult = await spawnInitCli({ cliPath: SHIM, argv, homeDir: shim.homeDir, cwd: shim.cwd });
    const distResult = await spawnInitCli({ cliPath: DIST, argv, homeDir: dist.homeDir, cwd: dist.cwd });

    expect(shimResult.status).toBe(2);
    expect(distResult.status).toBe(2);

    const shimEnv = lastJsonLine(shimResult.stdout);
    const distEnv = lastJsonLine(distResult.stdout);
    expect(shimEnv).toBe(distEnv);
  });
});