// SPDX-License-Identifier: MIT
// RED tests for src/util/fs-atomic.ts (the atomic-write + mode-preservation
// primitive extracted from src/cli/uninstall.ts).
//
// Until the module is extracted, every test in this file fails with
// `expect.fail("fs-atomic module not implemented yet")` so that the
// extract-the-module step in T3 cannot ship without these tests being
// authored first. The T2 task explicitly defines this RED contract: the
// tests assert the *behavioral contract* of the future module, not
// prose around it, so once T3 implements src/util/fs-atomic.ts the
// tests go green without further changes.

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

const modulePath = "../../src/util/fs-atomic.js";
const implementationPath = "src/util/fs-atomic.ts";

const isWindows = process.platform === "win32";

describe("src/util/fs-atomic.ts", () => {
  it("writeFileAtomic(path, content) writes content and leaves no .umactually-tmp-* orphan", async () => {
    // Given: an isolated temp dir, so the test can assert no orphan temp
    // files are left anywhere we might touch.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-"));
    const target = join(dir, "config.json");

    const writeFileAtomic = (await expectNotImplementedExport(
      modulePath,
      implementationPath,
      "writeFileAtomic",
    )) as (path: string, content: string) => void;

    // When: we atomically write a payload to the target.
    const content = '{"key":"value","num":42}\n';
    writeFileAtomic(target, content);

    // Then: the file exists and contains exactly the content we wrote.
    expect(readFileSync(target, "utf8")).toBe(content);

    // And: no `.umactually-tmp-*` orphan is left behind in the same
    // directory — the primitive cleans up on success as well as on
    // failure (the rename moves it; if it didn't, the sibling remains).
    const siblings = readdirSync(dir).filter((name) =>
      name.startsWith(".umactually-tmp-"),
    );
    expect(siblings).toEqual([]);
  });

  it.skipIf(isWindows)(
    "getMode(path) returns 0o644 after writeFileAtomic on POSIX",
    async () => {
      // Given: a fresh file written via the atomic primitive.
      const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-mode-"));
      const target = join(dir, "rc-file");

      const writeFileAtomic = (await expectNotImplementedExport(
        modulePath,
        implementationPath,
        "writeFileAtomic",
      )) as (path: string, content: string) => void;
      const getMode = (await expectNotImplementedExport(
        modulePath,
        implementationPath,
        "getMode",
      )) as (path: string) => number | null;

      // When: we write a single byte to a brand-new file.
      writeFileAtomic(target, "x");

      // Then: the mode is the umask default (0o644 on POSIX). The
      // primitive must NOT widen permissions silently — that is
      // revertPath's job, which preserves the pre-existing mode.
      expect(getMode(target)).toBe(0o644);
    },
  );

  it.skipIf(isWindows)(
    "setMode(path, 0o600) updates the mode bits; getMode reflects 0o600",
    async () => {
      // Given: a fresh file with the umask default mode.
      const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-chmod-"));
      const target = join(dir, "secret");
      writeFileSync(target, "shh", "utf8");

      const setMode = (await expectNotImplementedExport(
        modulePath,
        implementationPath,
        "setMode",
      )) as (path: string, mode: number) => void;
      const getMode = (await expectNotImplementedExport(
        modulePath,
        implementationPath,
        "getMode",
      )) as (path: string) => number | null;

      // When: we tighten the mode to 0o600.
      setMode(target, 0o600);

      // Then: getMode reports the new mode bits.
      expect(getMode(target)).toBe(0o600);
    },
  );
});
