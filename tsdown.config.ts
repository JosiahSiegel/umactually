// SPDX-License-Identifier: MIT
//
// tsdown configuration for the Node SEA single-file binary build.
//
// This file is consumed by `scripts/build-sea.mjs`, which invokes
// `tsdown --config tsdown.config.ts` exactly ONCE and lets tsdown's
// `exe.targets` array (derived from `scripts/release-targets.json`)
// drive all 6 platform/arch builds in a single process. The build
// script does NOT loop over targets; tsdown does. Per-target tuning
// (e.g. narrowing to a single platform) is done by editing the
// `exe.targets` array here, not by re-invoking tsdown from the script.
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
import { parseReleaseTargets } from "./scripts/release-targets.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(HERE);

// Read the version from package.json at build time. We pass it to tsdown
// as a compile-time constant so the SEA blob (which can't read
// `../package.json` at runtime) can still report the correct version
// for `umactually --version`. Without this constant, the auto-invoke
// in src/cli.ts has no way to know the version and `--version` prints
// nothing on a freshly installed SEA binary.
const PACKAGE_VERSION: string = (() => {
  const raw = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { readonly version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("package.json is missing a string `version` field");
  }
  return parsed.version;
})();

interface SeaTarget {
  readonly id: string;
  readonly platform: "win" | "darwin" | "linux";
  readonly arch: "x64" | "arm64";
  readonly rawName: string;
  readonly nodeVersion: string;
}

const MANIFEST_PATH = join(REPO_ROOT, "scripts", "release-targets.json");
const SEA_NODE_VERSION = "25.7.0";

// loadTargets() now delegates to the canonical manifest parser in
// scripts/release-targets.ts (the single source of truth for the
// release-targets contract). Previously this function duplicated the
// field-presence, archive-type, platform-prefix, and arch checks, and
// the two implementations had already diverged: release-targets.ts
// accepts any lowercase letter+digits id shape `^[a-z]+-[a-z0-9]+$`
// while the inline check here required the platform-arch split to be
// exactly `darwin|linux|windows` plus `x64|arm64`. A future arch
// like `linux-riscv64` would be accepted by release-targets.ts (it
// matches `[a-z0-9]+`) and rejected here (it only knows x64/arm64).
// Reusing parseReleaseTargets keeps the manifest contract in one
// place and adds the field-by-field, naming-invariant, and uniqueness
// checks that release-targets.ts already enforces — any new
// validation added there lands here automatically.
function loadTargets(): readonly SeaTarget[] {
  const targets = parseReleaseTargets({ manifestPath: MANIFEST_PATH });
  return targets.map((t) => {
    const [platformPrefix, arch] = t.id.split("-");
    if (platformPrefix === undefined || arch === undefined) {
      // Defensive: parseReleaseTargets already enforces
      // `^[a-z]+-[a-z0-9]+$` so this branch is unreachable in
      // practice. The throw remains so a future loosening of the
      // pattern doesn't silently produce a malformed SeaTarget.
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
  // Embed the package version as a compile-time constant. The bare
  // `UMACTUALLY_VERSION` identifier in src/cli.ts is replaced by tsdown
  // (via rolldown's `define`) with this JSON-serialized string so the
  // SEA binary can serve `umactually --version` without needing to
  // read `../package.json` at runtime (which the SEA blob cannot do).
  define: {
    UMACTUALLY_VERSION: JSON.stringify(PACKAGE_VERSION),
  },
  exe: {
    // Output directory for SEA binaries. tsdown's documented default is
    // "build" (see https://tsdown.dev/options/exe). We pin to "release" so
    // build-sea.mjs can verify outputs in a single known location. If
    // tsdown ever drops support for `exe.outDir`, build-sea.mjs falls back
    // to scanning build/ and dist/ — see `collectSeaOutputs()` in
    // scripts/build-sea.mjs.
    outDir: "release",
    // When invoked via build-sea.mjs, the --exe.fileName flag overrides this.
    fileName: "umactually",
    // The full set of targets. Per-target invocations pass the same options
    // but only build for the requested platform/arch.
    targets: deriveExeTargets(loadTargets()),
    seaConfig: {
      disableExperimentalSEAWarning: true,
      // Per https://tsdown.dev/options/exe: "When generating cross-platform
      // executables (e.g., generating an executable for linux-x64 on
      // darwin-arm64), useCodeCache and useSnapshot must be set to false
      // to avoid generating incompatible executables." Our CI builds all
      // 6 targets from a single Linux-x64 runner, so this is a cross-arch
      // scenario even though @tsdown/exe uses the target's Node binary to
      // drive --build-sea — the code cache is still arch-specific and
      // would crash on startup if the target arch doesn't match. We
      // accept the 30-50ms startup penalty to keep the binary portable.
      useCodeCache: false,
      useSnapshot: false,
    },
  },
});
