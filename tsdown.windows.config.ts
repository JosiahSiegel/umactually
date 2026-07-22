// SPDX-License-Identifier: MIT
//
// Windows-only tsdown configuration.
//
// This file is consumed by `scripts/build-sea-windows.mjs`. It is
// the SAME shape as `tsdown.config.ts` but with the `exe:` block
// removed, because tsdown auto-enables `--exe` mode whenever the
// config declares an `exe:` block — and the @tsdown/exe postBuild
// step (which downloads a Node binary and runs tar) is broken on
// Windows.
//
// The Windows build path uses `node --build-sea` directly (see
// scripts/build-sea-windows.mjs) to inject the SEA blob, so tsdown
// only needs to do the platform-agnostic JS bundling here. The
// `exe:` block is unnecessary; bundling produces dist/cli.mjs and
// the build-sea-windows.mjs script then runs `node --build-sea` to
// wrap that bundle in a Windows .exe.

import { defineConfig } from "tsdown";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(HERE);

const PACKAGE_VERSION: string = (() => {
  const raw = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { readonly version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("package.json is missing a string `version` field");
  }
  return parsed.version;
})();

export default defineConfig({
  entry: ["src/cli.ts"],
  // The `exe:` block is intentionally ABSENT. See the file header.
  //
  // No `dts` because we only ship JS to the SEA blob.
  // No `format` — tsdown auto-detects from the entry.
  // No `platform` — SEA blobs are platform-agnostic.
  // No `clean` — we manage the release/ directory from the build script.
  // Embed the package version as a compile-time constant (same as
  // tsdown.config.ts). The bare `UMACTUALLY_VERSION` identifier in
  // src/cli.ts is replaced by tsdown (via rolldown's `define`) with
  // this JSON-serialized string so the SEA binary can serve
  // `umactually --version` without needing to read `../package.json`
  // at runtime (which the SEA blob cannot do).
  define: {
    UMACTUALLY_VERSION: JSON.stringify(PACKAGE_VERSION),
  },
});
