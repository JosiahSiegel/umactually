// SPDX-License-Identifier: MIT
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const SHIM = join(REPO_ROOT, "bin", "umactually.mjs");

// Skip if dist/cli.js hasn't been built.
const SKIP_IF_NO_DIST = !existsSync(join(REPO_ROOT, "dist", "cli.js"));

type ShimResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runShimWithPatchedVersions(
  nodeVersion: string | null,
  bunVersion: string | null,
  argv: readonly string[] = ["doctor"],
): ShimResult {
  // We spawn a child Node that patches process.versions BEFORE loading
  // the shim. The shim reads process.versions at module load time, so
  // a top-level await import(SHIM) inside a child is sufficient.
  const patches: string[] = [];
  if (nodeVersion !== null) {
    patches.push(
      `Object.defineProperty(process.versions, "node", { value: ${JSON.stringify(nodeVersion)}, configurable: true });`,
    );
  }
  if (bunVersion !== null) {
    patches.push(
      `Object.defineProperty(process.versions, "bun", { value: ${JSON.stringify(bunVersion)}, configurable: true });`,
    );
  }
  // Pass argv through to the shim.
  const shimArgv = JSON.stringify([...argv]);
  const loader = `
    ${patches.join("\n    ")}
    process.argv = [process.argv[0], ${JSON.stringify(SHIM)}, ...${shimArgv}];
    try {
      await import(${JSON.stringify(SHIM)});
    } catch (err) {
      // Swallow any import-time error so we can inspect process.exit code.
      const msg = err && err.message ? err.message : String(err);
      process.stderr.write("[test-caught-error] " + msg + "\\n");
    }
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", loader],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe.skipIf(SKIP_IF_NO_DIST)("bin/umactually.mjs version gate", () => {
  it("prints a clear error when neither node nor bun is recent enough", () => {
    const result = runShimWithPatchedVersions("v22.0.0", "v1.0.0");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/requires Node >= 24\.x/);
    expect(result.stderr).toMatch(/detected Node v22\.0\.0/);
  });

  it("accepts the bun runtime when bun is recent enough (the bunx path)", () => {
    // Simulate `bunx umactually` on an old Node but modern Bun.
    // The shim should accept Bun's version and NOT print the
    // version-mismatch error. (Old behavior was Math.max(node, bun),
    // which had the same outcome here but also let through the
    // Node-22 + Bun-25 case where Node itself wouldn't be supported.
    // The new logic explicitly checks Bun when it's the live runtime
    // and modern enough.)
    const result = runShimWithPatchedVersions("v22.0.0", "v25.0.0");
    expect(result.stderr, `stderr: ${result.stderr}`).not.toMatch(/requires Node >= 24/);
    // The CLI may still fail downstream (e.g. "no --api-url"), but
    // that's a different error path. We only care that the gate
    // accepted Bun 25.
  });

  it("falls back to Bun when Node is below threshold but Bun is modern", () => {
    // Host has Node 22 (below the Node 24 threshold) and a modern Bun
    // (1.x with major ≥ MIN_BUN_MAJOR, minor ≥ MIN_BUN_MINOR). The
    // shim's policy is: prefer Node when it meets threshold; only fall
    // through to Bun when Node is below threshold. In this scenario
    // Node is below threshold, so Bun is the live runtime and the
    // gate must accept. (The Bun 1.x APIs are not full Node 24+ parity,
    // but the shim itself only needs the `node:fs` / `node:path` calls
    // it actually makes — see bin/umactually.mjs.)
    //
    // The CLI may still fail downstream (e.g. "no --api-url" or
    // "missing provider config"), but that's a different error path.
    // We only care that the gate accepted Bun 1.2.5 — which the
    // previous "compares runtimeMajor against MIN_RUNTIME_MAJOR=24"
    // code path silently rejected (Bun's major is always 1).
    const result = runShimWithPatchedVersions("v22.0.0", "v1.2.5");
    // Match the runtime-detection suffix (only emitted on rejection)
    // so we don't false-positive on the static gate spec in the
    // error message.
    expect(result.stderr, `stderr: ${result.stderr}`).not.toMatch(/detected (Node|Bun)/);
  });

  it("accepts modern Node even when bun is missing", () => {
    // Real-world case: vanilla Node 24, no Bun installed. The shim
    // should not bail because process.versions.bun is undefined.
    const result = runShimWithPatchedVersions("v24.5.0", null);
    expect(result.stderr).not.toMatch(/requires Node >= 24/);
  });

  it("accepts modern Node", () => {
    // Modern Node 24 (no Bun). Vanilla case.
    const result = runShimWithPatchedVersions("v25.7.0", null);
    expect(result.stderr).not.toMatch(/requires Node >= 24/);
  });
});
