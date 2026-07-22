// SPDX-License-Identifier: MIT
// Typed runtime parser/guard for scripts/release-targets.json.
//
// Single source of truth for the six production release targets (id,
// Bun target triple, raw/archive/member/installed names, archive type).
//
// allow: SIZE_OK — single-purpose manifest validator. Per-row checks,
// platform-specific naming, archive-name derivation, and uniqueness are
// kept together because they all gate one boundary parse; splitting
// would duplicate the targetId thread of context across files.
// Consumed by:
//   - Node build script: scripts/build-binary.mjs
//   - Vitest contract tests: test/unit/release-targets.test.ts
//   - Future packaging tools (Todo 2+)
//
// POSIX installers intentionally do NOT load this file. They read raw
// binary/asset names from the published checksums.txt and GitHub release
// assets; only Node-side tooling should parse this JSON contract.
//
// Node 24+ transparently strips types from .ts files at import time, so
// this module is loadable directly from .mjs scripts without a build step.

import { readFileSync } from "node:fs";

/** Frozen archive-type literal union covering the only formats shipped today. */
export type ArchiveType = "tar.gz" | "zip";

/** A single canonical release target — all fields are required. */
export type ReleaseTarget = {
  readonly id: string;
  readonly rawName: string;
  readonly archiveName: string;
  readonly archiveType: ArchiveType;
  readonly memberName: string;
  readonly installedName: string;
};

/** The manifest must always describe exactly six production targets. */
export const EXPECTED_TARGET_COUNT = 6;

/** Options accepted by the parser. */
export type ParseOptions = {
  /** Absolute or relative path to the manifest JSON file. */
  readonly manifestPath: string;
};

const REQUIRED_FIELDS: ReadonlyArray<keyof ReleaseTarget> = [
  "id",
  "rawName",
  "archiveName",
  "archiveType",
  "memberName",
  "installedName",
];

const VALID_ARCHIVE_TYPES: ReadonlySet<ArchiveType> = new Set(["tar.gz", "zip"]);

const POSIX_PLATFORMS: ReadonlySet<string> = new Set(["linux", "darwin"]);

/**
 * Architectures every release target id must declare. Adding a new
 * arch here is the only way to introduce one — the v0.6.0 manifest
 * already enumerates `linux/darwin/windows × {x64, arm64}`, but a
 * future target like `linux-riscv64` would otherwise slip through
 * unnoticed because the per-row checks only inspect the platform
 * prefix and the derived naming invariant. The id is also the
 * canonical key in the size-report / checksums / installer routing
 * code paths, so a malformed id would silently misroute.
 */
const VALID_ARCHITECTURES: ReadonlySet<string> = new Set(["x64", "arm64"]);

/**
 * Pattern: `<platform>-<arch>` (single dash, both halves required).
 * The strict shape is what every consumer assumes (installer asset
 * routing, archive basename derivation, smoke-test platform mapping).
 */
const ID_FORMAT_PATTERN = /^[a-z]+-[a-z0-9]+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Pattern: any POSIX or Windows path separator or traversal segment. */
const UNSAFE_NAME_PATTERN = /[\\/]/;
const TRAVERSAL_PATTERN = /\.\./;
const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/;

function rejectIfUnsafeName(
  field: keyof ReleaseTarget,
  value: string,
  targetId: string,
): void {
  if (UNSAFE_NAME_PATTERN.test(value)) {
    throw new Error(
      `release-targets: target ${targetId} field ${field} contains path separator: ${JSON.stringify(value)}`,
    );
  }
  if (TRAVERSAL_PATTERN.test(value)) {
    throw new Error(
      `release-targets: target ${targetId} field ${field} contains traversal segment: ${JSON.stringify(value)}`,
    );
  }
  if (CONTROL_CHAR_PATTERN.test(value)) {
    throw new Error(
      `release-targets: target ${targetId} field ${field} contains control or newline character: ${JSON.stringify(value)}`,
    );
  }
}

function parseSingleTarget(raw: unknown, index: number): ReleaseTarget {
  if (!isRecord(raw)) {
    throw new Error(
      `release-targets: entry at index ${index} must be an object, got ${typeof raw}`,
    );
  }

  const idValue = raw["id"];
  if (!isPlainString(idValue)) {
    throw new Error(
      `release-targets: entry at index ${index} has missing or non-string id`,
    );
  }
  const targetId = idValue;
  // v0.6.0: validate the id shape (single-dash `<platform>-<arch>`)
  // BEFORE the platform-prefix / arch checks so a malformed id
  // (e.g. `linux_x64`, `LINUX-X64`, `linux-x64-extra`) is rejected
  // with a single actionable diagnostic instead of a downstream
  // error from one of the per-row name derivations. Without this
  // gate, a typo in scripts/release-targets.json would pass the
  // existing platform-prefix check (the string starts with `linux`)
  // and the bug would surface only at install time as a missing
  // asset — far away from the manifest file that needs editing.
  if (!ID_FORMAT_PATTERN.test(targetId)) {
    throw new Error(
      `release-targets: target id ${JSON.stringify(targetId)} must match <platform>-<arch> (lowercase letters, single dash, no spaces)`,
    );
  }
  // Validate the arch half against the known set. The platform
  // half is checked later (via the POSIX / Windows / `else` branches)
  // so its error message can be platform-specific.
  const arch = targetId.split("-")[1] ?? "";
  if (!VALID_ARCHITECTURES.has(arch)) {
    throw new Error(
      `release-targets: target ${targetId} has unknown arch ${JSON.stringify(arch)} (allowed: ${[...VALID_ARCHITECTURES].join(", ")})`,
    );
  }

  const presentFields = new Set(Object.keys(raw));
  for (const required of REQUIRED_FIELDS) {
    if (!presentFields.has(required)) {
      throw new Error(
        `release-targets: target ${targetId} is missing required field "${required}"`,
      );
    }
  }

  for (const key of Object.keys(raw)) {
    if (!REQUIRED_FIELDS.includes(key as keyof ReleaseTarget)) {
      throw new Error(
        `release-targets: target ${targetId} has unknown field "${key}"`,
      );
    }
  }

  const rawName = raw["rawName"];
  if (!isPlainString(rawName)) {
    throw new Error(
      `release-targets: target ${targetId} field rawName must be a non-empty string`,
    );
  }
  rejectIfUnsafeName("rawName", rawName, targetId);

  const archiveName = raw["archiveName"];
  if (!isPlainString(archiveName)) {
    throw new Error(
      `release-targets: target ${targetId} field archiveName must be a non-empty string`,
    );
  }
  rejectIfUnsafeName("archiveName", archiveName, targetId);

  const archiveTypeRaw = raw["archiveType"];
  if (typeof archiveTypeRaw !== "string") {
    throw new Error(
      `release-targets: target ${targetId} field archiveType must be a string`,
    );
  }
  if (!VALID_ARCHIVE_TYPES.has(archiveTypeRaw as ArchiveType)) {
    throw new Error(
      `release-targets: target ${targetId} field archiveType has unknown value ${JSON.stringify(archiveTypeRaw)} (allowed: tar.gz, zip)`,
    );
  }
  const archiveType = archiveTypeRaw as ArchiveType;

  const memberName = raw["memberName"];
  if (!isPlainString(memberName)) {
    throw new Error(
      `release-targets: target ${targetId} field memberName must be a non-empty string`,
    );
  }
  rejectIfUnsafeName("memberName", memberName, targetId);

  const installedName = raw["installedName"];
  if (!isPlainString(installedName)) {
    throw new Error(
      `release-targets: target ${targetId} field installedName must be a non-empty string`,
    );
  }
  rejectIfUnsafeName("installedName", installedName, targetId);

  // v0.6.0: removed the Bun-target invariant (Bun's `bun-<id>` triple
  // names with optional `-baseline` suffix). Node SEA via tsdown
  // derives the platform/arch from the manifest `id` directly. The
  // check below preserves the existing `rawName = umactually-<id>`
  // invariant for POSIX targets and the `rawName = umactually-<id>.exe`
  // for Windows, which is what the installer and archive packager
  // depend on.

  const platform = targetId.split("-")[0] ?? "";
  const isPosix = POSIX_PLATFORMS.has(platform);
  const isWindows = platform === "windows";

  if (isPosix) {
    const expectedRaw = `umactually-${targetId}`;
    const expectedMember = `umactually-${targetId}`;
    if (rawName !== expectedRaw) {
      throw new Error(
        `release-targets: POSIX target ${targetId} rawName must equal ${JSON.stringify(expectedRaw)} (got ${JSON.stringify(rawName)})`,
      );
    }
    if (memberName !== expectedMember) {
      throw new Error(
        `release-targets: POSIX target ${targetId} memberName must equal ${JSON.stringify(expectedMember)} (got ${JSON.stringify(memberName)})`,
      );
    }
    if (rawName.endsWith(".exe")) {
      throw new Error(
        `release-targets: POSIX target ${targetId} rawName must not have .exe suffix (got ${JSON.stringify(rawName)})`,
      );
    }
    if (archiveType !== "tar.gz") {
      throw new Error(
        `release-targets: POSIX target ${targetId} archiveType must be "tar.gz" (got ${JSON.stringify(archiveType)})`,
      );
    }
    if (installedName !== "umactually") {
      throw new Error(
        `release-targets: POSIX target ${targetId} installedName must be "umactually" (got ${JSON.stringify(installedName)})`,
      );
    }
  } else if (isWindows) {
    const expectedRaw = `umactually-${targetId}.exe`;
    const expectedMember = `umactually-${targetId}.exe`;
    if (rawName !== expectedRaw) {
      throw new Error(
        `release-targets: Windows target ${targetId} rawName must equal ${JSON.stringify(expectedRaw)} (got ${JSON.stringify(rawName)})`,
      );
    }
    if (memberName !== expectedMember) {
      throw new Error(
        `release-targets: Windows target ${targetId} memberName must equal ${JSON.stringify(expectedMember)} (got ${JSON.stringify(memberName)})`,
      );
    }
    if (!rawName.endsWith(".exe")) {
      throw new Error(
        `release-targets: Windows target ${targetId} rawName must end with .exe (got ${JSON.stringify(rawName)})`,
      );
    }
    if (!memberName.endsWith(".exe")) {
      throw new Error(
        `release-targets: Windows target ${targetId} memberName must end with .exe (got ${JSON.stringify(memberName)})`,
      );
    }
    if (archiveType !== "zip") {
      throw new Error(
        `release-targets: Windows target ${targetId} archiveType must be "zip" (got ${JSON.stringify(archiveType)})`,
      );
    }
    if (installedName !== "umactually.exe") {
      throw new Error(
        `release-targets: Windows target ${targetId} installedName must be "umactually.exe" (got ${JSON.stringify(installedName)})`,
      );
    }
  } else {
    throw new Error(
      `release-targets: target ${targetId} has unknown platform prefix (expected linux|darwin|windows)`,
    );
  }

  // rawName and memberName must agree (raw is the build output, member is the
  // archive member — same filename, every consumer depends on this invariant).
  if (rawName !== memberName) {
    throw new Error(
      `release-targets: target ${targetId} rawName (${JSON.stringify(rawName)}) and memberName (${JSON.stringify(memberName)}) must match`,
    );
  }

  // archiveName must equal the canonical archive basename: derive it from
  // the platform-prefixed scheme (POSIX: umactually-<id>.<archiveType>,
  // Windows: umactually-<id>.<archiveType>). Windows drops the .exe suffix
  // from the archive basename because the archive itself is the .zip.
  const archiveBase = `umactually-${targetId}`;
  const expectedArchiveName = `${archiveBase}.${archiveType}`;
  if (archiveName !== expectedArchiveName) {
    throw new Error(
      `release-targets: target ${targetId} archiveName must equal ${JSON.stringify(expectedArchiveName)} (got ${JSON.stringify(archiveName)})`,
    );
  }

  return {
    id: targetId,
    rawName,
    archiveName,
    archiveType,
    memberName,
    installedName,
  };
}

/**
 * Parses and validates the JSON manifest at the given path. Throws with a
 * target-specific, actionable diagnostic on every rejected case.
 *
 * Uniqueness invariants enforced here (after per-row validation):
 *   - exactly six rows
 *   - distinct ids, rawNames, memberNames, archiveNames
 */
export function parseReleaseTargets(options: ParseOptions): readonly ReleaseTarget[] {
  const text = readFileSync(options.manifestPath, "utf8");
  return parseReleaseTargetsFromString(text);
}

/**
 * Same as parseReleaseTargets but accepts the raw JSON text. Used by tests
 * that want to drive the parser with adversarial input without touching disk.
 */
export function parseReleaseTargetsFromString(text: string): readonly ReleaseTarget[] {
  if (text.trim().length === 0) {
    throw new Error("release-targets: manifest text is empty (not valid JSON)");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`release-targets: manifest is not valid JSON: ${reason}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `release-targets: manifest root must be an array of target objects, got ${parsed === null ? "null" : typeof parsed}`,
    );
  }

  if (parsed.length !== EXPECTED_TARGET_COUNT) {
    throw new Error(
      `release-targets: manifest must contain exactly ${EXPECTED_TARGET_COUNT} target entries, got ${parsed.length}`,
    );
  }

  const targets: ReleaseTarget[] = parsed.map((entry, index) =>
    parseSingleTarget(entry, index),
  );

  // Uniqueness: ids, rawNames, memberNames, archiveNames.
  // Duplicates are reported with the offender's id and the existing value so
  // the operator can locate the collision in one read.
  const seen = {
    id: new Map<string, string>(),
    rawName: new Map<string, string>(),
    memberName: new Map<string, string>(),
    archiveName: new Map<string, string>(),
  } as const;

  for (const target of targets) {
    const idExisting = seen.id.get(target.id);
    if (idExisting !== undefined) {
      throw new Error(
        `release-targets: duplicate id for target ${target.id}: ${JSON.stringify(target.id)} already used by target ${idExisting}`,
      );
    }
    seen.id.set(target.id, target.id);

    const rawExisting = seen.rawName.get(target.rawName);
    if (rawExisting !== undefined) {
      throw new Error(
        `release-targets: target ${target.id} rawName ${JSON.stringify(target.rawName)} already used by target ${rawExisting}`,
      );
    }
    seen.rawName.set(target.rawName, target.id);

    const memberExisting = seen.memberName.get(target.memberName);
    if (memberExisting !== undefined) {
      throw new Error(
        `release-targets: target ${target.id} memberName ${JSON.stringify(target.memberName)} already used by target ${memberExisting}`,
      );
    }
    seen.memberName.set(target.memberName, target.id);

    const archiveExisting = seen.archiveName.get(target.archiveName);
    if (archiveExisting !== undefined) {
      throw new Error(
        `release-targets: target ${target.id} archiveName ${JSON.stringify(target.archiveName)} already used by target ${archiveExisting}`,
      );
    }
    seen.archiveName.set(target.archiveName, target.id);
  }

  return targets;
}
