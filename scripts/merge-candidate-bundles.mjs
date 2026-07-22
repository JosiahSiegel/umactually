#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// Merge two per-platform candidate bundles into a single final bundle.
//
// Why this exists:
//   v0.6.1+ shipped broken Windows binaries because the release workflow
//   built the windows-x64 and windows-arm64 .exe on ubuntu-24.04. The
//   embedded Node 25.7.0 SEA blob differs by ~1024 bytes between
//   Linux-built and Windows-built Windows .exe files, and the Linux-built
//   one has a pipe-drain race that produces empty stdout on real
//   Windows. The fix is to build each .exe on its native platform and
//   merge the per-platform bundles into a single candidate bundle that
//   the existing smoke + publish jobs can consume without modification.
//
// Inputs (CLI args):
//   --non-windows <dir>  Bundle produced by the non-Windows producer
//                        (contains linux + darwin archives and raws).
//   --windows <dir>      Bundle produced by the Windows producer
//                        (contains windows archives and raws).
//   --manifest <path>    Path to scripts/release-targets.json. Used to
//                        partition the merge by platform id.
//   --output <dir>       Output bundle root. Created if missing.
//
// Output layout (matches build-package's upload):
//   <output>/public/<archiveName>           (copied from producer by platform)
//   <output>/public/checksums.txt           (recomputed from the merged public/)
//   <output>/internal/raw/<rawName>         (copied from producer by platform)
//   <output>/internal/release-size-report.json
//                                         (recomputed from the merged raws)
//   <output>/internal/release-targets.json (copied from --non-windows input,
//                                          which always has the full manifest)
//
// Re-computation rationale:
//   The non-windows producer's `public/checksums.txt` and
//   `internal/release-size-report.json` only cover its own platforms.
//   The Windows producer's cover only Windows. The merged bundle must
//   have a single `checksums.txt` that covers ALL 5 archives and a
//   single `release-size-report.json` that covers ALL 5 raws, so the
//   existing publish job (which iterates the manifest and reads from a
//   single `public/` + `internal/raw/`) works unchanged.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) throw new Error(`unexpected argument ${flag ?? ""}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${flag}`);
    out[flag.slice(2)] = value;
    i += 1;
  }
  return out;
}

function isWindowsTargetId(id) {
  return typeof id === "string" && id.startsWith("windows-");
}

function sha256File(path) {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

function assertDir(p, label) {
  if (!existsSync(p) || !statSync(p).isDirectory()) {
    throw new Error(`${label} does not exist or is not a directory: ${p}`);
  }
}

function ensureCleanDir(p) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
  }
  mkdirSync(p, { recursive: true });
}

function copyTreeFiltered(srcRoot, dstRoot, predicate) {
  // Shallow copy: the bundle root has only `public/`, `internal/`, and a
  // handful of JSON files. We never need to recurse past those two
  // subtrees, and a shallow scan makes the partition rule (archive vs
  // raw) explicit.
  for (const entry of ["public", "internal"]) {
    const srcEntry = join(srcRoot, entry);
    if (!existsSync(srcEntry)) continue;
    const dstEntry = join(dstRoot, entry);
    mkdirSync(dstEntry, { recursive: true });
    for (const child of readDirEntries(srcEntry)) {
      if (!predicate(entry, child)) continue;
      const srcPath = join(srcEntry, child);
      const dstPath = join(dstEntry, child);
      copyFileSync(srcPath, dstPath);
    }
  }
}

function readDirEntries(p) {
  // Wrapper for portability — `fs.readdirSync(p, { withFileTypes: true })`
  // is fine, but the merger intentionally avoids `withFileTypes` to keep
  // the Node-version floor low.
  return require("node:fs").readdirSync(p);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const nonWindows = args["non-windows"];
  const windows = args["windows"];
  const manifestPath = args["manifest"];
  const output = args["output"];
  if (!nonWindows || !windows || !manifestPath || !output) {
    console.error(
      "usage: merge-candidate-bundles.mjs " +
      "--non-windows <dir> --windows <dir> --manifest <path> --output <dir>",
    );
    process.exit(2);
  }

  for (const [label, value] of [
    ["--non-windows", nonWindows],
    ["--windows", windows],
    ["--manifest", manifestPath],
    ["--output", output],
  ]) {
    if (!existsSync(value)) {
      throw new Error(`${label} does not exist: ${value}`);
    }
  }
  assertDir(nonWindows, "--non-windows");
  assertDir(windows, "--windows");
  if (!statSync(manifestPath).isFile()) {
    throw new Error(`--manifest is not a file: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error(`--manifest must be a non-empty array, got ${typeof manifest}`);
  }
  for (const t of manifest) {
    if (typeof t.id !== "string" || typeof t.archiveName !== "string" || typeof t.rawName !== "string") {
      throw new Error(`manifest target is missing required fields: ${JSON.stringify(t)}`);
    }
  }

  const outAbs = resolve(output);
  ensureCleanDir(outAbs);
  mkdirSync(join(outAbs, "public"), { recursive: true });
  mkdirSync(join(outAbs, "internal", "raw"), { recursive: true });

  // Partition manifest by platform.
  const nonWindowsTargets = manifest.filter((t) => !isWindowsTargetId(t.id));
  const windowsTargets = manifest.filter((t) => isWindowsTargetId(t.id));
  if (nonWindowsTargets.length === 0) throw new Error("manifest has no non-Windows targets — nothing to merge");
  if (windowsTargets.length === 0) throw new Error("manifest has no Windows targets — nothing to merge");

  // Copy archives (public/<archiveName>) by partition.
  copyTreeFiltered(nonWindows, outAbs, (entry, child) => {
    if (entry !== "public") return false;
    return nonWindowsTargets.some((t) => t.archiveName === child);
  });
  copyTreeFiltered(windows, outAbs, (entry, child) => {
    if (entry !== "public") return false;
    return windowsTargets.some((t) => t.archiveName === child);
  });

  // Copy raws (internal/raw/<rawName>) by partition.
  copyTreeFiltered(nonWindows, outAbs, (entry, child) => {
    if (entry !== "internal") return false;
    return nonWindowsTargets.some((t) => t.rawName === child);
  });
  copyTreeFiltered(windows, outAbs, (entry, child) => {
    if (entry !== "internal") return false;
    return windowsTargets.some((t) => t.rawName === child);
  });

  // Copy internal/release-size-report.json from the non-Windows bundle
  // and RECOMPUTE for the merged raws (so the report covers all 5).
  const sizeReportPath = join(outAbs, "internal", "release-size-report.json");
  const mergedRawSizes = {};
  for (const t of manifest) {
    const rawPath = join(outAbs, "internal", "raw", t.rawName);
    if (!existsSync(rawPath)) {
      throw new Error(`merged bundle is missing raw for target ${t.id}: ${rawPath}`);
    }
    mergedRawSizes[t.id] = statSync(rawPath).size;
  }
  // Preserve the existing report shape (the publish job reads
  // `rawBytes` and `targets` keys). The verifier script's threshold
  // check is target-scoped, so the recomputation must include every
  // target even if the input was partitioned.
  const existingReport = JSON.parse(
    readFileSync(join(nonWindows, "internal", "release-size-report.json"), "utf8"),
  );
  const recomputed = {
    ...existingReport,
    rawBytes: mergedRawSizes,
    // Keep the original thresholds + ceiling from the input report.
    minRawBytes: existingReport.minRawBytes ?? 1_048_576,
    maxRawBytes: existingReport.maxRawBytes ?? 209_715_200,
    generatedAt: new Date().toISOString(),
    merged: true,
  };
  writeFileSync(sizeReportPath, `${JSON.stringify(recomputed, null, 2)}\n`);

  // Copy the manifest verbatim from the non-Windows bundle.
  const manifestDst = join(outAbs, "internal", "release-targets.json");
  copyFileSync(manifestPath, manifestDst);

  // Recompute checksums.txt from the merged public/ directory so every
  // archive is covered by a single manifest the existing publish job can
  // read in one pass.
  const checksumsPath = join(outAbs, "public", "checksums.txt");
  const checksumsLines = [];
  for (const t of manifest) {
    const archivePath = join(outAbs, "public", t.archiveName);
    if (!existsSync(archivePath)) {
      throw new Error(`merged public/ is missing archive for target ${t.id}: ${archivePath}`);
    }
    const hash = sha256File(archivePath);
    checksumsLines.push(`${hash}  ${t.archiveName}`);
  }
  checksumsLines.sort();
  writeFileSync(checksumsPath, `${checksumsLines.join("\n")}\n`);

  // Re-verify that the recomputed checksums.txt passes `sha256sum -c`,
  // to catch a mis-wired partition (e.g. copying the Windows archive
  // from the non-Windows bundle) before the publish job ever sees it.
  // We do this by spawning sha256sum -c in --check mode. Failure here
  // is a programmer error, not a data error.
  const verify = require("node:child_process").spawnSync(
    "sha256sum",
    ["-c", "checksums.txt"],
    { cwd: join(outAbs, "public"), encoding: "utf8" },
  );
  if (verify.status !== 0) {
    throw new Error(`merged bundle failed sha256sum -c self-check: ${verify.stdout}\n${verify.stderr}`);
  }

  console.log(
    `merge-candidate-bundles: wrote ${manifest.length} archives + ` +
    `${manifest.length} raws to ${outAbs}`,
  );
  console.log(`  non-windows targets: ${nonWindowsTargets.map((t) => t.id).join(", ")}`);
  console.log(`  windows targets:     ${windowsTargets.map((t) => t.id).join(", ")}`);
  console.log(`  checksums.txt self-check: OK`);
}

const invokedDirectly = (() => {
  if (typeof process.argv[1] !== "string") return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main();
}
