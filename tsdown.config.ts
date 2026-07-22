// SPDX-License-Identifier: MIT
//
// tsdown configuration for the Node SEA single-file binary build.
//
// This file is consumed by `scripts/build-sea.mjs` (which loops over the
// 6 platform/arch targets in `scripts/release-targets.json` and invokes
// `tsdown --config tsdown.config.ts` once per target). The `exe.targets`
// here is the *default* set used when `scripts/build-sea.mjs` is invoked
// with no filter; the per-target invocation overrides the targets array
// via the CLI.
//
// Why tsdown + Node SEA (not Bun --compile, yao-pkg, or Deno compile):
// - tsdown is the official library bundler from VoidZero (Vite + Rolldown
//   team) and is the de-facto standard for Node SEA in 2026.
// - Node SEA is now first-class in Node core since v25.5.0 (--build-sea
//   flag, Joyee Cheung). LIEF is statically linked into the Node binary;
//   no external postject step needed.
// - Cross-platform builds: @tsdown/exe downloads the target Node binary
//   from nodejs.org and uses it to build the SEA for that platform.
//   This is the only way to produce a self-contained single-file binary
//   that runs on a system without Node preinstalled.
//
// Requires Node >= 25.7.0 in the build environment. The published binary
// bundles Node 25.7 and runs on any system; the `bin/umactually.mjs` shim
// still gates on `engines.node >= 24` for the npm package path.

import { defineConfig } from "tsdown";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(HERE);

interface RawTarget {
  readonly id: string;
  readonly rawName: string;
  readonly archiveName: string;
  readonly archiveType: "tar.gz" | "zip";
  readonly memberName: string;
  readonly installedName: string;
}

interface SeaTarget {
  readonly id: string;
  readonly platform: "win" | "darwin" | "linux";
  readonly arch: "x64" | "arm64";
  readonly rawName: string;
  readonly nodeVersion: string;
}

const MANIFEST_PATH = join(REPO_ROOT, "scripts", "release-targets.json");
const SEA_NODE_VERSION = "25.7.0";

function loadTargets(): readonly SeaTarget[] {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw) as readonly RawTarget[];
  return parsed.map((t) => {
    // Derive platform + arch from the id (e.g. "darwin-arm64" → darwin/arm64).
    const [platformPrefix, arch] = t.id.split("-");
    if (platformPrefix === undefined || arch === undefined) {
      throw new Error(
        `release-targets.json: target id "${t.id}" must be "<platform>-<arch>"`,
      );
    }
    const platform: "win" | "darwin" | "linux" =
      platformPrefix === "darwin" ? "darwin"
      : platformPrefix === "linux" ? "linux"
      : platformPrefix === "windows" ? "win"
      : (() => { throw new Error(`release-targets.json: unknown platform "${platformPrefix}" in id "${t.id}"`); })();
    if (arch !== "x64" && arch !== "arm64") {
      throw new Error(`release-targets.json: unknown arch "${arch}" in id "${t.id}"`);
    }
    return {
      id: t.id,
      platform,
      arch,
      rawName: t.rawName,
      nodeVersion: SEA_NODE_VERSION,
    };
  });
}

function deriveExeTargets(targets: readonly SeaTarget[]) {
  return targets.map((t) => ({
    platform: t.platform,
    arch: t.arch,
    nodeVersion: t.nodeVersion,
  }));
}

// The CLI override pattern: `tsdown --config tsdown.config.ts --exe.fileName <name>`
// allows scripts/build-sea.mjs to override per-target without re-parsing this
// file. The targets array below is only used when `tsdown` is invoked with
// no per-target filter (i.e. `npm run build:sea:all`).
export default defineConfig({
  entry: ["src/cli.ts"],
  // No `dts` because we only ship JS to the SEA blob.
  // No `format` — tsdown auto-detects from the entry.
  // No `platform` — SEA blobs are platform-agnostic.
  // No `clean` — we manage the release/ directory from the build script.
  exe: {
    // Output directory for SEA binaries. We pin to "release" so build-sea.mjs
    // can verify outputs in a single known location; tsdown's default is
    // "build" which would require an extra move step.
    outDir: "release",
    // When invoked via build-sea.mjs, the --exe.fileName flag overrides this.
    fileName: "umactually",
    // The full set of targets. Per-target invocations pass the same options
    // but only build for the requested platform/arch.
    targets: deriveExeTargets(loadTargets()),
    seaConfig: {
      disableExperimentalSEAWarning: true,
      // useCodeCache speeds up startup by 30-50ms but requires the SEA to
      // be built on the same arch as the target. @tsdown/exe handles this
      // automatically per target. We keep it on because the build matrix
      // in release.yml runs each target on a native-arch runner
      // (ubuntu-latest = x64 for linux-x64, etc.), so the code cache is
      // always produced by a same-arch V8 — no cross-arch hazard.
      useCodeCache: true,
      useSnapshot: false,
    },
  },
});
