#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// Generate a filtered copy of scripts/release-targets.json.
//
// Usage:
//   node scripts/write-filtered-manifest.mjs --input <path> --output <path> --include <regex>
//
// Filters the input manifest's `targets` array down to those whose
// `id` matches the include regex. Preserves all other top-level
// fields. Used by the build-package-windows job to give the
// packager / verifier / stage-release-assets a windows-only
// manifest, so they don't try to find non-Windows raw files that
// this job never built.
//
// The output is JSON (not JSON5) for cross-platform compat. The
// input is parsed as JSON too — release-targets.json is already
// strict JSON (no comments, no trailing commas).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { invokedDirectly } from "./lib/cli-shared.mjs";

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (typeof flag !== "string" || !flag.startsWith("--")) {
      throw new Error(`unexpected positional arg: ${flag}`);
    }
    const key = flag.slice(2);
    const value = argv[i + 1];
    if (typeof value !== "string") {
      throw new Error(`flag --${key} requires a value`);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function main() {
  const options = args(process.argv.slice(2));
  const inputPath = resolve(options.input ?? "scripts/release-targets.json");
  const outputPath = resolve(options.output ?? "scripts/release-targets.filtered.json");
  const includeRaw = options.include;
  if (typeof includeRaw !== "string" || includeRaw.length === 0) {
    throw new Error("--include <regex> is required");
  }
  const include = new RegExp(includeRaw);
  const raw = readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw);
  // The canonical scripts/release-targets.json is a top-level
  // array of target objects (NOT an object with a "targets" key).
  // The Windows producer's filtered manifest mirrors that shape so
  // any consumer (packager, verifier, stage-release-assets) sees
  // the same input structure.
  if (!Array.isArray(parsed)) {
    throw new Error(`input ${inputPath} must be a top-level array (got ${typeof parsed})`);
  }
  const filtered = parsed.filter((t) => typeof t?.id === "string" && include.test(t.id));
  if (filtered.length === 0) {
    throw new Error(`--include ${includeRaw} matched no targets in ${inputPath}`);
  }
  writeFileSync(outputPath, JSON.stringify(filtered, null, 2) + "\n", "utf8");
  console.log(`write-filtered-manifest: wrote ${filtered.length}/${parsed.length} targets to ${outputPath}`);
}

if (invokedDirectly(import.meta.url)) {
  try {
    main();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`write-filtered-manifest: ${message}`);
    process.exit(1);
  }
}
