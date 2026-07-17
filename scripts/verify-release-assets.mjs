#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// scripts/verify-release-assets.mjs
// =================================
// Single Node generator/checker for the six-archive release contract.
//
// MODES
// -----
//   --measure                Generate checksums.txt (archive-only, manifest
//                            order) and write --report <path>. Exits 0 even
//                            if global or per-target limits are violated.
//                            Use before a budget file exists.
//
//   --enforce --budget <p>   Read the budget JSON at <p>, recompute every
//                            global/per-target limit, and exit 1 with a
//                            target-specific diagnostic on every miss. Use
//                            in the release workflow once the budget file
//                            is committed.
//
//                            Budget file shape (per-target keys must be one
//                            of the manifest six IDs; missing keys fall
//                            back to global.maxArchiveBytes):
//
//                              {
//                                "global": {
//                                  "maxRatio": <0 < n <= 1>,
//                                  "maxArchiveBytes": <positive integer>
//                                },
//                                "perTarget": {
//                                  "<manifest-id>": { "maxArchiveBytes": <positive integer> },
//                                  ...
//                                }
//                              }
//
//                            When `global` or `perTarget` is omitted the
//                            missing branch falls back to the report's
//                            built-in limits; present-but-malformed values
//                            (negative bytes, non-integer bytes, ratios
//                            outside (0,1], unknown target IDs, non-object
//                            global/perTarget) are rejected with a clear
//                            diagnostic. Bun version recorded separately
//                            in `bunVersion`; packaging toolchain
//                            versions in `packagingVersion` (see header).
//
//   --measure --enforce      Enforcement takes precedence: budget is required
//                            and limits are reported, but the report and
//                            checksums.txt are still written.
//
// CANONICAL CHECKSUM GRAMMAR (every parse path)
// ---------------------------------------------
//   ^[0-9A-Fa-f]{64}  <exact manifest archiveName>$
//
//   - Exactly two ASCII spaces between hash and basename.
//   - Basename must be the manifest `archiveName` for one of the six
//     targets, and every manifest archiveName must appear exactly once.
//   - Lines are emitted and validated in MANIFEST order (NOT filesystem
//     order, NOT sorted).
//   - The presence of `*` at column 65 (BSD), one-space separators,
//     trailing whitespace, duplicate entries (case-insensitive), missing
//     manifest basenames, extra unknown basenames, and raw executable
//     basenames (raw binaries are NOT in the archive checksum contract)
//     are all rejected with a target-specific diagnostic.
//
// CRLF NORMALIZATION
// ------------------
// A checksums.txt that GitHub or some CDN serves with CRLF line endings
// is normalized to LF before the grammar regex is applied. The presence
// of CRLF is logged as a warning to stderr so the operator can investigate
// the source.
//
// RAW BYTES
// ---------
// The size report's `rawBytes` is read from `<release-dir>/<manifest.rawName>`
// when present. This mirrors the candidate-bundle layout Todo 9 will produce
// (`public/<archives>` + `internal/raw/<raw binaries>` collapsed into a
// single `--release-dir` root for this verifier). If the raw file is
// missing, `rawBytes` is `0` and the `ratio` is reported as `0`.
//
// SIZE REPORT SCHEMA (release-size-report.json)
// ---------------------------------------------
//   {
//     schemaVersion: 1,
//     bunVersion: string,
//     packagingVersion: {
//       schema: 1,
//       node: process.versions.node,
//       zlib: process.versions.zlib,
//       tarStream: "3.2.0",
//       yazl: "3.3.1",
//       yauzl: "3.4.0"
//     },
//     targets: ReadonlyArray<{
//       id: string,
//       rawName: string,
//       archiveName: string,
//       rawBytes: number,
//       archiveBytes: number,
//       ratio: number,       // archiveBytes/rawBytes, ≤ 2 decimals
//       sha256: string       // lowercase hex of archive file bytes
//     }>,
//     limits: { maxRatio: 0.5, maxArchiveBytes: 52428800 }
//   }
//
// CLI
// ---
//   node scripts/verify-release-assets.mjs \
//     --manifest scripts/release-targets.json \
//     --release-dir <dir> \
//     --measure --report <path>
//
//   node scripts/verify-release-assets.mjs \
//     --manifest scripts/release-targets.json \
//     --release-dir <dir> \
//     --budget scripts/release-size-budget.json \
//     --enforce --report <path>
//
// Pure ESM JavaScript: Node 24 runs this directly. The sibling
// `verify-release-assets.d.ts` carries the size-report interface for
// TypeScript consumers (the test harness, future consumers).
//
// allow: SIZE_OK — single CLI boundary with six tightly-coupled
// concerns (CLI parsing, SHA-256 hashing, grammar validation, report
// emission, budget enforcement, CRLF normalization). Splitting them
// into separate files would force a shared-harness indirection
// (CLI args, manifest, output paths) without reducing the test
// surface. Each helper stays below 30 lines; the orchestrating
// `main()` is a linear sequence that reads top-to-bottom.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseReleaseTargets } from "./release-targets.ts";

const ARCHIVE_NAME_PATTERN = /^[0-9A-Fa-f]{64}  ([^ \t\r\n]+)$/;
const GLOBAL_LIMITS = Object.freeze({
  maxRatio: 0.5,
  maxArchiveBytes: 52428800,
});
const PACKAGING_VERSION = Object.freeze({
  schema: 1,
  node: process.versions.node,
  zlib: process.versions.zlib,
  tarStream: "3.2.0",
  yazl: "3.3.1",
  yauzl: "3.4.0",
});
const REPORT_SCHEMA_VERSION = 1;
const CHECKSUMS_FILENAME = "checksums.txt";

// Flags that take no value — they flip a mode on/off.
const FLAG_ONLY_OPTIONS = new Set(["measure", "enforce"]);

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === undefined || !flag.startsWith("--")) {
      throw new Error(`verify-release-assets: unexpected argument ${flag ?? ""}`);
    }
    const key = flag.slice(2);
    if (FLAG_ONLY_OPTIONS.has(key)) {
      options[key] = true;
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`verify-release-assets: missing value for ${flag}`);
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function sha256HexFile(path) {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

function roundRatio(value) {
  return Math.round(value * 100) / 100;
}

function buildChecksumsRows(releaseDir, targets) {
  return targets.map((target) => {
    const archivePath = join(releaseDir, target.archiveName);
    if (!existsSync(archivePath)) {
      throw new Error(
        `verify-release-assets: missing archive for target ${target.id}: ${archivePath}`,
      );
    }
    const stat = statSync(archivePath);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error(
        `verify-release-assets: archive for target ${target.id} is not a non-empty regular file: ${archivePath}`,
      );
    }
    return {
      archiveName: target.archiveName,
      hash: sha256HexFile(archivePath),
      bytes: stat.size,
      archivePath,
    };
  });
}

function normalizeCrlf(text) {
  const hadCrlf = /\r\n/.test(text);
  return { text: hadCrlf ? text.replace(/\r\n/g, "\n") : text, hadCrlf };
}

function parseAndValidateChecksums(text, expectedBasenames, rawBasenames) {
  const seen = new Map();
  const lines = [];
  const allLines = text.split("\n");
  for (let index = 0; index < allLines.length; index += 1) {
    const rawLine = allLines[index];
    const lineNumber = index + 1;
    // The file may or may not end with a newline; both are valid. We
    // only treat a fully-empty last line as benign.
    if (rawLine.length === 0) {
      if (index === allLines.length - 1) continue;
      throw new Error(
        `verify-release-assets: checksums.txt has a blank line at ${lineNumber}`,
      );
    }
    const trimmedLine = rawLine.replace(/[ \t]+$/, "");
    if (trimmedLine !== rawLine) {
      throw new Error(
        `verify-release-assets: checksums.txt has trailing whitespace at line ${lineNumber}: ${JSON.stringify(rawLine)}`,
      );
    }
    const match = ARCHIVE_NAME_PATTERN.exec(rawLine);
    if (!match) {
      if (/\*\S/.test(rawLine)) {
        throw new Error(
          `verify-release-assets: checksums.txt line ${lineNumber} uses BSD \`*\` marker; the canonical grammar requires exactly two ASCII spaces, no \`*\`: ${JSON.stringify(rawLine)}`,
        );
      }
      if (/^[0-9A-Fa-f]{64} [^ ]/.test(rawLine)) {
        throw new Error(
          `verify-release-assets: checksums.txt line ${lineNumber} uses one-space separator; the canonical grammar requires exactly two ASCII spaces: ${JSON.stringify(rawLine)}`,
        );
      }
      throw new Error(
        `verify-release-assets: checksums.txt line ${lineNumber} does not match the canonical grammar \`^[0-9A-Fa-f]{64}  <basename>$\`: ${JSON.stringify(rawLine)}`,
      );
    }
    const basename = match[1];
    if (rawBasenames.has(basename.toLowerCase())) {
      throw new Error(
        `verify-release-assets: checksums.txt line ${lineNumber} lists raw executable basename ${JSON.stringify(basename)}; the archive contract requires archive basenames (raw binaries are not part of the archive checksum contract)`,
      );
    }
    if (!expectedBasenames.has(basename)) {
      throw new Error(
        `verify-release-assets: checksums.txt line ${lineNumber} lists unknown basename ${JSON.stringify(basename)}; only manifest archive basenames are accepted`,
      );
    }
    const lower = basename.toLowerCase();
    const previous = seen.get(lower);
    if (previous !== undefined) {
      throw new Error(
        `verify-release-assets: checksums.txt has duplicate basename ${JSON.stringify(basename)} at lines ${previous} and ${lineNumber} (case-insensitive)`,
      );
    }
    seen.set(lower, lineNumber);
    lines.push({ hash: match[0].slice(0, 64).toLowerCase(), basename, lineNumber });
  }
  // Every expected basename must appear exactly once.
  for (const expected of expectedBasenames) {
    if (!seen.has(expected.toLowerCase())) {
      throw new Error(
        `verify-release-assets: checksums.txt is missing required manifest basename ${JSON.stringify(expected)}`,
      );
    }
  }
  return { lines };
}

function readExistingChecksumsOrNull(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function emitCrlfWarning(text) {
  if (/\r\n/.test(text)) {
    console.error(
      "verify-release-assets: WARNING checksums.txt uses CRLF line endings; normalized to LF for grammar parsing",
    );
  }
}

function buildReport(releaseDir, targets, checksumRows, bunVersion) {
  const reportTargets = targets.map((target) => {
    const row = checksumRows.find((r) => r.archiveName === target.archiveName);
    if (!row) {
      throw new Error(
        `verify-release-assets: internal error — checksum row missing for target ${target.id}; this is a bug`,
      );
    }
    const rawPath = join(releaseDir, target.rawName);
    const rawBytes = existsSync(rawPath) ? statSync(rawPath).size : 0;
    const ratio = rawBytes > 0 ? roundRatio(row.bytes / rawBytes) : 0;
    return {
      id: target.id,
      rawName: target.rawName,
      archiveName: target.archiveName,
      rawBytes,
      archiveBytes: row.bytes,
      ratio,
      sha256: row.hash,
    };
  });
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    bunVersion,
    packagingVersion: PACKAGING_VERSION,
    targets: reportTargets,
    limits: GLOBAL_LIMITS,
  };
}

function writeChecksums(releaseDir, checksumRows) {
  // Use LF line endings; trailing newline included for POSIX tools.
  const content = `${checksumRows.map((r) => `${r.hash}  ${r.archiveName}`).join("\n")}\n`;
  const path = join(releaseDir, CHECKSUMS_FILENAME);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function writeReport(reportPath, report) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

// Validate a positive integer in the inclusive range (0, +Infinity).
// Rejects NaN, Infinity, negative, zero, and non-integer values.
function assertPositiveInteger(field, value, context) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `verify-release-assets: budget ${context} field ${JSON.stringify(field)} must be a positive integer (got ${JSON.stringify(value)})`,
    );
  }
}

// Validate a `maxRatio` value: number in the inclusive interval (0, 1].
// Rejects NaN, Infinity, non-numbers, zero, and values greater than 1.
function assertMaxRatio(value, context) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1
  ) {
    throw new Error(
      `verify-release-assets: budget ${context} field "maxRatio" must be a number in (0, 1] (got ${JSON.stringify(value)})`,
    );
  }
}

// Strict budget loader. Tolerates a missing `global` or `perTarget` (the
// existing report limits fill in), but when present, every field is
// type-checked and range-checked. Per-target IDs must be drawn from the
// six manifest IDs (caller passes the manifest IDs to validate against).
function readBudget(path, manifestIds) {
  const text = readFileSync(path, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`verify-release-assets: budget file is not valid JSON: ${reason}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "verify-release-assets: budget file must be a JSON object with `global` and `perTarget` keys",
    );
  }

  if (parsed["bunVersion"] !== undefined && (typeof parsed["bunVersion"] !== "string" || parsed["bunVersion"].length === 0)) {
    throw new Error('verify-release-assets: budget field "bunVersion" must be a non-empty string when present');
  }

  if (parsed["global"] !== undefined) {
    if (
      parsed["global"] === null ||
      typeof parsed["global"] !== "object" ||
      Array.isArray(parsed["global"])
    ) {
      throw new Error(
        'verify-release-assets: budget field "global" must be an object when present',
      );
    }
    if (parsed["global"]["maxRatio"] !== undefined) {
      assertMaxRatio(parsed["global"]["maxRatio"], "global");
    }
    if (parsed["global"]["maxArchiveBytes"] !== undefined) {
      assertPositiveInteger(
        "maxArchiveBytes",
        parsed["global"]["maxArchiveBytes"],
        "global",
      );
    }
  }

  if (parsed["perTarget"] !== undefined) {
    if (
      parsed["perTarget"] === null ||
      typeof parsed["perTarget"] !== "object" ||
      Array.isArray(parsed["perTarget"])
    ) {
      throw new Error(
        'verify-release-assets: budget field "perTarget" must be an object when present',
      );
    }
    const manifestIdSet = new Set(manifestIds);
    for (const [targetId, entry] of Object.entries(parsed["perTarget"])) {
      if (!manifestIdSet.has(targetId)) {
        throw new Error(
          `verify-release-assets: budget perTarget key ${JSON.stringify(targetId)} is not a manifest target id (allowed: ${[...manifestIdSet].join(", ")})`,
        );
      }
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(
          `verify-release-assets: budget perTarget.${targetId} must be an object`,
        );
      }
      if (entry["maxArchiveBytes"] === undefined) {
        throw new Error(
          `verify-release-assets: budget perTarget.${targetId} must declare a numeric "maxArchiveBytes" field`,
        );
      }
      assertPositiveInteger(
        "maxArchiveBytes",
        entry["maxArchiveBytes"],
        `perTarget.${targetId}`,
      );
    }
  }

  return parsed;
}

function evaluateLimits(report, budget) {
  const failures = [];
  const globalMaxRatio = budget.global?.maxRatio ?? report.limits.maxRatio;
  const globalMaxBytes = budget.global?.maxArchiveBytes ?? report.limits.maxArchiveBytes;
  for (const target of report.targets) {
    const perTarget = budget.perTarget?.[target.id];
    const ceiling = perTarget?.maxArchiveBytes ?? globalMaxBytes;
    if (target.archiveBytes > ceiling) {
      failures.push({
        targetId: target.id,
        rule: "maxArchiveBytes",
        actual: target.archiveBytes,
        ceiling,
      });
    }
    if (target.ratio > globalMaxRatio) {
      failures.push({
        targetId: target.id,
        rule: "maxRatio",
        actual: target.ratio,
        ceiling: globalMaxRatio,
      });
    }
  }
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const measure = "measure" in args;
  const enforce = "enforce" in args;
  if (!measure && !enforce) {
    throw new Error(
      "verify-release-assets: at least one of --measure or --enforce must be specified",
    );
  }
  // Budget validation runs first so --enforce without --budget fails
  // with a clear, immediate diagnostic before any other check executes.
  if (enforce && args["budget"] === undefined) {
    console.error(
      "verify-release-assets: --enforce requires --budget <path>; no budget file was provided",
    );
    process.exitCode = 1;
    return;
  }
  const manifestPath = resolve(args["manifest"] ?? "scripts/release-targets.json");
  const releaseDir = resolve(args["release-dir"] ?? "release");
  const reportPathRaw = args["report"];
  const budgetPathRaw = args["budget"];

  const targets = parseReleaseTargets({ manifestPath });
  const checksumRows = buildChecksumsRows(releaseDir, targets);

  // Validate any existing checksums.txt against the canonical grammar.
  const expectedBasenames = new Set(targets.map((t) => t.archiveName));
  const rawBasenames = new Set(targets.map((t) => t.rawName.toLowerCase()));
  const existingChecksumsPath = join(releaseDir, CHECKSUMS_FILENAME);
  const existing = readExistingChecksumsOrNull(existingChecksumsPath);
  if (existing !== null) {
    emitCrlfWarning(existing);
    const { text: normalized } = normalizeCrlf(existing);
    const parsed = parseAndValidateChecksums(normalized, expectedBasenames, rawBasenames);
    // Compare hashes against freshly computed archive hashes. A mismatch
    // is reported as a target-specific failure (a tampered archive or a
    // checksums.txt that drifted from the archive bytes).
    for (const target of targets) {
      const expectedHash = checksumRows.find((r) => r.archiveName === target.archiveName).hash;
      const line = parsed.lines.find((l) => l.basename === target.archiveName);
      if (!line) {
        throw new Error(
          `verify-release-assets: internal error — manifest target ${target.id} not parsed despite grammar validation; this is a bug`,
        );
      }
      if (line.hash !== expectedHash) {
        throw new Error(
          `verify-release-assets: target ${JSON.stringify(target.id)} archive SHA-256 mismatch — checksums.txt line ${line.lineNumber} says ${line.hash} but archive file ${target.archiveName} has ${expectedHash}`,
        );
      }
    }
  } else {
    // No existing checksums.txt — generate one in measurement mode.
    if (measure) {
      writeChecksums(releaseDir, checksumRows);
    } else {
      // --enforce without --measure and without an existing checksums.txt
      // is a configuration error: there is nothing to verify against.
      throw new Error(
        "verify-release-assets: --enforce requires either an existing checksums.txt in --release-dir or --measure to generate one",
      );
    }
  }

  const bunVersion = args["bun-version"] ?? process.env["BUN_VERSION"] ?? "";
  const report = buildReport(releaseDir, targets, checksumRows, bunVersion);
  if (reportPathRaw !== undefined) {
    writeReport(resolve(reportPathRaw), report);
  }

  if (enforce) {
    // budgetPathRaw is guaranteed non-undefined by the upfront check above.
    const budget = readBudget(resolve(budgetPathRaw), targets.map((t) => t.id));
    if (report.bunVersion !== "" && budget.bunVersion !== undefined && report.bunVersion !== budget.bunVersion) {
      console.error(`verify-release-assets: report bunVersion ${JSON.stringify(report.bunVersion)} disagrees with budget bunVersion ${JSON.stringify(budget.bunVersion)}`);
      process.exitCode = 1;
      return;
    }
    const failures = evaluateLimits(report, budget);
    if (failures.length > 0) {
      for (const failure of failures) {
        console.error(
          `target ${JSON.stringify(failure.targetId)} exceeds ${JSON.stringify(failure.rule)} (got ${failure.actual}, ceiling ${failure.ceiling})`,
        );
      }
      process.exitCode = 1;
      return;
    }
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}