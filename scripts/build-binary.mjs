#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Cross-compile standalone binaries using Bun --compile.
//
// Produces 5 binaries from scripts/compile-entry.ts:
//   umactually-linux-x64
//   umactually-linux-arm64
//   umactually-darwin-x64
//   umactually-darwin-arm64
//   umactually-windows-x64.exe
//
// Usage:
//   node scripts/build-binary.mjs              # build all targets
//   node scripts/build-binary.mjs linux-x64    # build one target
//
// Prerequisites:
//   - Bun installed and on PATH (bun --version works)

import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENTRY = fileURLToPath(new URL("../scripts/compile-entry.ts", import.meta.url));
const OUTDIR = fileURLToPath(new URL("../release", import.meta.url));

const TARGETS = [
  { id: "linux-x64",    bunTarget: "bun-linux-x64-baseline",  outfile: "umactually-linux-x64" },
  { id: "linux-arm64",  bunTarget: "bun-linux-arm64",          outfile: "umactually-linux-arm64" },
  { id: "darwin-x64",   bunTarget: "bun-darwin-x64",           outfile: "umactually-darwin-x64" },
  { id: "darwin-arm64", bunTarget: "bun-darwin-arm64",         outfile: "umactually-darwin-arm64" },
  { id: "windows-x64",  bunTarget: "bun-windows-x64-baseline", outfile: "umactually-windows-x64.exe" },
];

const filter = process.argv[2];
const targets = filter ? TARGETS.filter((t) => t.id === filter) : TARGETS;

if (targets.length === 0) {
  console.error(`Unknown target: ${filter}`);
  console.error(`Available: ${TARGETS.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

// Check Bun is installed
try {
  execFileSync("bun", ["--version"], { stdio: "pipe", cwd: REPO_ROOT });
} catch {
  console.error("Error: Bun is not installed. Install from https://bun.sh");
  process.exit(1);
}

mkdirSync(OUTDIR, { recursive: true });

let failed = 0;

for (const target of targets) {
  const outPath = join(OUTDIR, target.outfile);
  console.log(`\nBuilding ${target.id}...`);

  const args = [
    "build",
    ENTRY,
    "--compile",
    "--minify",
    "--sourcemap",
    `--define=UMACTUALLY_VERSION='"${VERSION}"'`,
    `--target=${target.bunTarget}`,
    `--outfile=${outPath}`,
  ];

  const result = spawnSync("bun", args, {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });

  if (result.status !== 0) {
    console.error(`  ✗ ${target.id} failed (exit ${result.status})`);
    failed++;
  } else {
    console.log(`  ✓ ${target.outfile}`);
  }
}

console.log("");
if (failed > 0) {
  console.error(`${failed}/${targets.length} target(s) failed.`);
  process.exit(1);
}
console.log(`All ${targets.length} target(s) built successfully in ${OUTDIR}/`);
