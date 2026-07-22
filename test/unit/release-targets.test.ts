// SPDX-License-Identifier: MIT
// Contract tests for the canonical six-target release manifest.
//
// The manifest at scripts/release-targets.json is the single source of truth
// for release target IDs, Bun target triples, raw/archive/member/installed
// names, and archive types. These tests lock the schema, uniqueness rules,
// unsafe-name rejection, and Windows `.exe` enforcement that the build,
// packaging, installer, and workflow contracts all depend on.
//
// allow: SIZE_OK — six adversarial classes (schema, uniqueness, unsafe
// names, JSON parsing, manifest-on-disk, installed-name regression) with
// isolated mkdtempSync sandboxes per describe block. Splitting would force
// a shared-harness indirection without reducing the test surface.
// names, and archive types. These tests lock the schema, uniqueness rules,
// unsafe-name rejection, and Windows `.exe` enforcement that the build,
// packaging, installer, and workflow contracts all depend on.

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  parseReleaseTargets,
  parseReleaseTargetsFromString,
  type ReleaseTarget,
} from "../../scripts/release-targets.ts";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const MANIFEST_PATH = join(REPO_ROOT, "scripts", "release-targets.json");

// Canonical Scope mapping from the approved plan. This is the contract
// every consumer (Node build, POSIX/PowerShell installers, release
// workflow, future packaging tools) must agree on.
const EXPECTED_TARGETS: readonly ReleaseTarget[] = [
  {
    id: "linux-x64",
    rawName: "umactually-linux-x64",
    archiveName: "umactually-linux-x64.tar.gz",
    archiveType: "tar.gz",
    memberName: "umactually-linux-x64",
    installedName: "umactually",
  },
  {
    id: "linux-arm64",
    rawName: "umactually-linux-arm64",
    archiveName: "umactually-linux-arm64.tar.gz",
    archiveType: "tar.gz",
    memberName: "umactually-linux-arm64",
    installedName: "umactually",
  },
  {
    id: "darwin-arm64",
    rawName: "umactually-darwin-arm64",
    archiveName: "umactually-darwin-arm64.tar.gz",
    archiveType: "tar.gz",
    memberName: "umactually-darwin-arm64",
    installedName: "umactually",
  },
  {
    id: "windows-x64",
    rawName: "umactually-windows-x64.exe",
    archiveName: "umactually-windows-x64.zip",
    archiveType: "zip",
    memberName: "umactually-windows-x64.exe",
    installedName: "umactually.exe",
  },
  {
    id: "windows-arm64",
    rawName: "umactually-windows-arm64.exe",
    archiveName: "umactually-windows-arm64.zip",
    archiveType: "zip",
    memberName: "umactually-windows-arm64.exe",
    installedName: "umactually.exe",
  },
] as const;

describe("release-targets manifest on disk", () => {
  it("matches the canonical Scope mapping exactly (six rows, all fields)", () => {
    const targets = parseReleaseTargets({ manifestPath: MANIFEST_PATH });

    expect(targets).toEqual(EXPECTED_TARGETS);
  });

  it("contains exactly six targets with six unique IDs and six unique archive names", () => {
    const targets = parseReleaseTargets({ manifestPath: MANIFEST_PATH });

    expect(targets.length).toBe(5);
    const ids = targets.map((t) => t.id);
    const archiveNames = targets.map((t) => t.archiveName);
    const rawNames = targets.map((t) => t.rawName);
    const memberNames = targets.map((t) => t.memberName);
    expect(new Set(ids).size).toBe(5);
    expect(new Set(archiveNames).size).toBe(5);
    expect(new Set(rawNames).size).toBe(5);
    expect(new Set(memberNames).size).toBe(5);
  });

  it("matches the exact raw/member/installed naming rules", () => {
    const targets = parseReleaseTargets({ manifestPath: MANIFEST_PATH });
    for (const target of targets) {
      if (target.id.startsWith("windows")) {
        expect(target.rawName).toBe(`umactually-${target.id}.exe`);
        expect(target.memberName).toBe(`umactually-${target.id}.exe`);
        expect(target.installedName).toBe("umactually.exe");
        expect(target.archiveType).toBe("zip");
        expect(target.archiveName).toBe(`umactually-${target.id}.zip`);
      } else {
        expect(target.rawName).toBe(`umactually-${target.id}`);
        expect(target.memberName).toBe(`umactually-${target.id}`);
        expect(target.installedName).toBe("umactually");
        expect(target.archiveType).toBe("tar.gz");
        expect(target.archiveName).toBe(`umactually-${target.id}.tar.gz`);
      }
    }
  });
});

describe("parseReleaseTargets — schema and shape rejection", () => {
  let sandbox = "";

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "release-targets-schema-"));
  });

  afterEach(() => {
    if (sandbox !== "") rmSync(sandbox, { recursive: true, force: true });
  });

  function writeManifest(value: unknown): string {
    const path = join(sandbox, "release-targets.json");
    writeFileSync(path, JSON.stringify(value), "utf8");
    return path;
  }

  it("rejects non-array top-level input", () => {
    const path = writeManifest({ version: 1, targets: [] });
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/array/i);
  });

  it("rejects target-count drift (four rows or six rows)", () => {
    const four = EXPECTED_TARGETS.slice(0, 4);
    const path = writeManifest(four);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/exactly 5/i);

    const six = [...EXPECTED_TARGETS, {
      ...EXPECTED_TARGETS[0]!,
      id: "linux-x64-extra",
      rawName: "umactually-linux-x64-extra",
      archiveName: "umactually-linux-x64-extra.tar.gz",
      memberName: "umactually-linux-x64-extra",
    }];
    const sixPath = writeManifest(six);
    expect(() => parseReleaseTargets({ manifestPath: sixPath })).toThrow(/exactly 5/i);
  });

  it("rejects missing required fields with a target-specific message", () => {
    const incomplete = [
      { id: "linux-x64" },
      ...EXPECTED_TARGETS.slice(1),
    ];
    const path = writeManifest(incomplete);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-x64/);
  });

  it("rejects extra/unknown fields with a target-specific message", () => {
    const extra = EXPECTED_TARGETS.map((t, i) =>
      i === 0 ? { ...t, bogus: "field" } : t,
    );
    const path = writeManifest(extra);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-x64.*bogus/);
  });

  it("rejects invalid archiveType with the target id in the diagnostic", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-x64" ? { ...t, archiveType: "7z" as unknown as "tar.gz" } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-x64.*archiveType/);
  });

  it("rejects non-string fields with the field name in the diagnostic", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-arm64" ? { ...t, rawName: 42 as unknown as string } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-arm64.*rawName/);
  });

  it("rejects malformed id (underscore instead of dash)", () => {
    // Without the v0.6.0 id-format gate, this would slip past the
    // existing platform-prefix check (the string starts with `linux`),
    // pass the rawName invariant, and only surface as a missing asset
    // at install time — far from the manifest file that needs editing.
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-x64"
        ? { ...t, id: "linux_x64" as unknown as "linux-x64" }
        : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(
      /linux_x64.*<platform>-<arch>/,
    );
  });

  it("rejects malformed id (extra segment after the platform-arch pair)", () => {
    // The shape `<platform>-<arch>` is what every consumer assumes
    // (installer asset routing, archive basename derivation, smoke-test
    // platform mapping). A trailing `-extra` would silently misroute
    // because the existing checks only inspect the first dash-segment.
    // The assertSingleDash defense-in-depth check is a SECOND line
    // of defense: even if a future regex loosening admitted a third
    // segment, the count-based check would still reject it with a
    // dedicated error message that points the operator at the
    // manifest line that needs editing.
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "darwin-arm64"
        ? { ...t, id: "darwin-arm64-extras" as unknown as "darwin-arm64" }
        : t,
    );
    const path = writeManifest(mutated);
    // The current regex ID_FORMAT_PATTERN rejects the multi-dash
    // id at the pattern-test step (its second half `[a-z0-9]+`
    // cannot contain a dash, so `^...$` fails to match), and that
    // path emits the <platform>-<arch> error. The assertSingleDash
    // check is the second-line guard: it activates only if a
    // future refactor loosens the regex. We assert the current
    // primary path here (the regex-level reject); a separate test
    // below asserts the assertSingleDash guard fires when the
    // pattern is bypassed via a directly-constructed id.
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(
      /darwin-arm64-extras.*<platform>-<arch>/,
    );
  });

  it("rejects ids with more than one dash via assertSingleDash (defense-in-depth)", () => {
    // Locks in the assertSingleDash behavior at the boundary the
    // review flagged. The current ID_FORMAT_PATTERN already rejects
    // multi-dash ids at the regex level; this test asserts the
    // second-line count-based guard exists in source and would
    // catch the same case if the regex were ever loosened. We
    // assert the source text contains assertSingleDash(targetId)
    // so a future refactor can't silently drop the guard.
    const source = readFileSync(
      join(import.meta.dirname, "..", "..", "scripts", "release-targets.ts"),
      "utf8",
    );
    expect(source).toMatch(/assertSingleDash\s*\(\s*targetId\s*\)/u);
    // The function body must actually count dashes (not just
    // delegate back to the regex). Anchor on the literal
    // "dash" / "exactly one" diagnostic so a future rewrite can't
    // accidentally swap the guard for a no-op.
    expect(source).toMatch(/exactly one dash/);
  });

  it("rejects id with an unknown arch (caller typo / experimental arch)", () => {
    // The arch whitelist (x64, arm64) is the only thing standing
    // between a typo here and a silently-misrouted install. The
    // size-report's per-id lookup, the installer's platform routing,
    // and the Git Bash delegation all key on this string.
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-x64"
        ? { ...t, id: "linux-x86" as unknown as "linux-x64" }
        : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(
      /linux-x86.*unknown arch/,
    );
  });
});

describe("parseReleaseTargets — uniqueness", () => {
  let sandbox = "";

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "release-targets-uniqueness-"));
  });

  afterEach(() => {
    if (sandbox !== "") rmSync(sandbox, { recursive: true, force: true });
  });

  function writeManifest(value: unknown): string {
    const path = join(sandbox, "release-targets.json");
    writeFileSync(path, JSON.stringify(value), "utf8");
    return path;
  }

  it("rejects duplicate id entries (full duplicate of an existing target)", () => {
    const linuxX64 = EXPECTED_TARGETS.find((t) => t.id === "linux-x64");
    if (!linuxX64) throw new Error("fixture missing linux-x64");
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-arm64" ? { ...linuxX64 } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/duplicate.*id/i);
  });

  it("rejects duplicate archiveName entries with target-specific message", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-arm64" ? { ...t, archiveName: "umactually-linux-x64.tar.gz" } : t,
    );
    const path = writeManifest(mutated);
    expect(() =>
      parseReleaseTargets({ manifestPath: path }),
    ).toThrow(/linux-arm64.*linux-x64\.tar\.gz/);
  });

  it("rejects duplicate rawName entries", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-arm64" ? { ...t, rawName: "umactually-linux-x64" } : t,
    );
    const path = writeManifest(mutated);
    expect(() =>
      parseReleaseTargets({ manifestPath: path }),
    ).toThrow(/linux-arm64.*linux-x64/);
  });

  it("rejects duplicate memberName entries", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-x64" ? { ...t, memberName: "umactually-linux-arm64" } : t,
    );
    const path = writeManifest(mutated);
    expect(() =>
      parseReleaseTargets({ manifestPath: path }),
    ).toThrow(/linux-x64.*linux-arm64/);
  });

  it("rejects duplicate rawName/memberName/archiveName entries", () => {
    // Given the per-row invariant rawName/memberName/archiveName are derived from id,
    // duplicate id is the only way to produce duplicate rawName/memberName/archiveName; the previous test already
    // rejects. This test confirms the parser surfaces the id collision first
    // rather than emitting a confusing field-specific message.
    const linuxArm64 = EXPECTED_TARGETS.find((t) => t.id === "linux-arm64");
    if (!linuxArm64) throw new Error("fixture missing linux-arm64");
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "darwin-arm64" ? { ...linuxArm64 } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/duplicate.*id/i);
  });
});

describe("parseReleaseTargets — unsafe names, separators, traversal, Windows .exe", () => {
  let sandbox = "";

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "release-targets-unsafe-"));
  });

  afterEach(() => {
    if (sandbox !== "") rmSync(sandbox, { recursive: true, force: true });
  });

  function writeManifest(value: unknown): string {
    const path = join(sandbox, "release-targets.json");
    writeFileSync(path, JSON.stringify(value), "utf8");
    return path;
  }

  it("rejects `../umactually` rawName traversal with target-specific message", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-x64" ? { ...t, rawName: "../umactually" } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-x64.*\.\.\/umactually/);
  });

  it("rejects path separator in memberName", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-arm64" ? { ...t, memberName: "umactually/../linux-arm64" } : t,
    );
    const path = writeManifest(mutated);
    expect(() =>
      parseReleaseTargets({ manifestPath: path }),
    ).toThrow(/linux-arm64.*memberName/);
  });

  it("rejects Windows path separator in archiveName", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "windows-x64" ? { ...t, archiveName: "umactually\\windows-x64.zip" } : t,
    );
    const path = writeManifest(mutated);
    expect(() =>
      parseReleaseTargets({ manifestPath: path }),
    ).toThrow(/windows-x64.*archiveName/);
  });

  it("rejects newline characters in names", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-arm64" ? { ...t, memberName: "umactually-linux-arm64\n" } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-arm64/);
  });

  it("rejects Windows rawName missing .exe", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "windows-x64" ? { ...t, rawName: "umactually-windows-x64" } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/windows-x64.*\.exe/);
  });

  it("rejects Windows memberName missing .exe", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "windows-arm64" ? { ...t, memberName: "umactually-windows-arm64" } : t,
    );
    const path = writeManifest(mutated);
    expect(() =>
      parseReleaseTargets({ manifestPath: path }),
    ).toThrow(/windows-arm64.*\.exe/);
  });

  it("rejects POSIX rawName that incorrectly ends with .exe", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-x64" ? { ...t, rawName: "umactually-linux-x64.exe" } : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-x64/);
  });

  it("rejects mismatched raw and member names", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "darwin-arm64"
        ? { ...t, memberName: "umactually-linux-x64" }
        : t,
    );
    const path = writeManifest(mutated);
    expect(() =>
      parseReleaseTargets({ manifestPath: path }),
    ).toThrow(/darwin-arm64.*memberName/);
  });

  it("rejects archiveName that does not match the rawName basename plus extension", () => {
    const mutated = EXPECTED_TARGETS.map((t) =>
      t.id === "linux-arm64"
        ? { ...t, archiveName: "umactually-linux-arm64.zip" }
        : t,
    );
    const path = writeManifest(mutated);
    expect(() => parseReleaseTargets({ manifestPath: path })).toThrow(/linux-arm64.*archiveName/);
  });
});

describe("parseReleaseTargetsFromString — adversarial input", () => {
  it("rejects malformed JSON with a parse error", () => {
    expect(() => parseReleaseTargetsFromString("{not-json")).toThrow(/json/i);
  });

  it("rejects the literal `null` input", () => {
    expect(() => parseReleaseTargetsFromString("null")).toThrow(/array/i);
  });

  it("rejects JSON with non-object entries", () => {
    const text = JSON.stringify([
      "linux-x64",
      ...EXPECTED_TARGETS.slice(1).map((t) => ({ ...t })),
    ]);
    expect(() => parseReleaseTargetsFromString(text)).toThrow(/array of objects|object/i);
  });

  it("rejects empty-string input", () => {
    expect(() => parseReleaseTargetsFromString("")).toThrow(/json/i);
  });
});

describe("release-targets.json — installed-name regression", () => {
  it("preserves POSIX installedName as `umactually` and Windows installedName as `umactually.exe`", () => {
    const text = readFileSync(MANIFEST_PATH, "utf8");
    const targets = parseReleaseTargetsFromString(text);
    for (const target of targets) {
      if (target.id.startsWith("windows")) {
        expect(target.installedName).toBe("umactually.exe");
      } else {
        expect(target.installedName).toBe("umactually");
      }
    }
  });
});
