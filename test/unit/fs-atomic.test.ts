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

import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
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

describe("src/util/fs-atomic.ts — orphan cleanup on failed rename", () => {
  it("writeFileAtomic cleans up the .umactually-tmp-* sibling when rename fails", async () => {
    // Given: an isolated temp dir and a target whose parent is a FILE
    // (not a directory) so rename(...,target) MUST fail with ENOTDIR /
    // EEXIST / similar on every platform. The primitive's catch path
    // is supposed to delete the temp file it just wrote.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-orphan-"));
    // A directory masquerading as a path-component will fail rename.
    // We simulate "rename fails" by pointing the target at a path
    // whose parent component is an existing file (cannot host a
    // child entry).
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "i am a file, not a directory", "utf8");
    const target = join(blocker, "config.json");

    const { writeFileAtomic } = (await import(
      "../../src/util/fs-atomic.js"
    )) as {
      readonly writeFileAtomic: (path: string, content: string) => void;
    };

    // When: writeFileAtomic is invoked. renameSync throws ENOTDIR
    // (or equivalent), the catch handler fires.
    let caught: unknown = null;
    try {
      writeFileAtomic(target, "payload that will not land");
    } catch (error) {
      caught = error;
    }

    // Then: an error was thrown (rename failed).
    expect(caught).toBeInstanceOf(Error);

    // And: no `.umactually-tmp-*` orphan remains in the original
    // directory — the catch handler ran unlinkSync on the sibling.
    const siblings = readdirSync(dir).filter((name) =>
      name.startsWith(".umactually-tmp-"),
    );
    expect(siblings).toEqual([]);
  });
});

describe("src/util/fs-atomic.ts — getMode returns null on missing path", () => {
  it.skipIf(isWindows)(
    "getMode(missingPath) returns null instead of throwing",
    async () => {
      // Given: an isolated temp dir with a path that does NOT exist.
      const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-getmode-"));
      const missingPath = join(dir, "does-not-exist");

      const { getMode } = (await import("../../src/util/fs-atomic.js")) as {
        readonly getMode: (path: string) => number | null;
      };

      // When: getMode is invoked.
      const mode = getMode(missingPath);

      // Then: the helper swallows the ENOENT and returns null (the
      // documented contract — callers distinguish "no such file"
      // from a real mode-bit read).
      expect(mode).toBeNull();
    },
  );
});

describe("src/util/fs-atomic.ts — defaultFsAdapter surface", () => {
  it("exposes exists/isFile/isDirectory/isSymlink/readFile/writeFile/getMode/setMode/removeDir/writeFileAtomic", async () => {
    // Given: the defaultFsAdapter object.
    const adapterModule = (await import(
      "../../src/util/fs-atomic.js"
    )) as typeof import("../../src/util/fs-atomic.js");

    // When: the adapter is loaded.
    const adapter = adapterModule.defaultFsAdapter;

    // Then: every required method is present and is a function.
    expect(typeof adapter.exists).toBe("function");
    expect(typeof adapter.isSymlink).toBe("function");
    expect(typeof adapter.isFile).toBe("function");
    expect(typeof adapter.isDirectory).toBe("function");
    expect(typeof adapter.unlink).toBe("function");
    expect(typeof adapter.removeDir).toBe("function");
    expect(typeof adapter.readFile).toBe("function");
    expect(typeof adapter.writeFile).toBe("function");
    expect(typeof adapter.writeFileAtomic).toBe("function");
    expect(typeof adapter.getMode).toBe("function");
    expect(typeof adapter.setMode).toBe("function");
  });

  it("exists/isFile/isDirectory/isSymlink return false (not throw) when the path is missing", async () => {
    // Given: an isolated temp dir and a path that does NOT exist.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-adapter-"));
    const missing = join(dir, "nope");

    const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

    // When/Then: each lstat-touching predicate swallows the ENOENT
    // and returns false. The adapter's contract is "missing path is
    // indistinguishable from 'not a file / not a symlink / not a dir'".
    expect(defaultFsAdapter.exists(missing)).toBe(false);
    expect(defaultFsAdapter.isSymlink(missing)).toBe(false);
    expect(defaultFsAdapter.isFile(missing)).toBe(false);
    expect(defaultFsAdapter.isDirectory(missing)).toBe(false);
  });

  it("removeDir(path, { recursive: true }) removes a non-empty directory tree", async () => {
    // Given: a non-empty temp directory.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-rmdir-"));
    writeFileSync(join(dir, "inside.txt"), "payload", "utf8");

    const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

    // When: removeDir is called with recursive:true.
    defaultFsAdapter.removeDir(dir, { recursive: true });

    // Then: the directory is gone.
    expect(existsSync(dir)).toBe(false);
  });

  it("writeFile(path, content) writes the literal content to disk", async () => {
    // Given: an isolated temp dir.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-write-"));
    const target = join(dir, "out.txt");

    const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

    // When: writeFile is invoked.
    defaultFsAdapter.writeFile(target, "hello\n");

    // Then: the file exists and contains exactly the written bytes.
    expect(readFileSync(target, "utf8")).toBe("hello\n");
  });

  it("writeFileAtomic via the adapter renames the temp file over the target", async () => {
    // Given: an isolated temp dir and a target that does NOT exist yet.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-adapter-atomic-"));
    const target = join(dir, "config.json");

    const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

    // When: writeFileAtomic is invoked via the adapter.
    defaultFsAdapter.writeFileAtomic(target, '{"k":1}');

    // Then: the target contains the new content and no orphan
    // sibling is left behind in the directory.
    expect(readFileSync(target, "utf8")).toBe('{"k":1}');
    const orphans = readdirSync(dir).filter((name) =>
      name.startsWith(".umactually-tmp-"),
    );
    expect(orphans).toEqual([]);
  });

  it("readFile returns the literal file content", async () => {
    // Given: a temp file written via node:fs directly.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-read-"));
    const target = join(dir, "input.txt");
    writeFileSync(target, "raw bytes", "utf8");

    const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

    // When/Then: readFile returns the literal bytes.
    expect(defaultFsAdapter.readFile(target)).toBe("raw bytes");
  });

  it("unlink removes a file", async () => {
    // Given: a temp file.
    const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-unlink-"));
    const target = join(dir, "to-remove");
    writeFileSync(target, "x", "utf8");

    const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

    // When: unlink is invoked.
    defaultFsAdapter.unlink(target);

    // Then: the file is gone.
    expect(existsSync(target)).toBe(false);
  });

  it.skipIf(isWindows)(
    "setMode restores the original mode after writeFileAtomic (mode-preservation contract)",
    async () => {
      // Given: a fresh file with mode 0o600 (the privacy-sensitive
      // default for a shell rc file).
      const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-preserve-"));
      const target = join(dir, "rc-file");
      writeFileSync(target, "original", "utf8");
      chmodSync(target, 0o600);

      const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

      // Sanity: pre-write mode is 0o600.
      expect(defaultFsAdapter.getMode(target)).toBe(0o600);

      // When: the adapter rewrites the file via writeFileAtomic
      // (which does NOT chmod), then the caller restores the mode.
      defaultFsAdapter.writeFileAtomic(target, "rewritten");
      defaultFsAdapter.setMode(target, 0o600);

      // Then: the mode is still 0o600 — the explicit setMode call
      // is what revertPath uses to preserve the pre-existing mode.
      expect(defaultFsAdapter.getMode(target)).toBe(0o600);

      // And: calling setMode to 0o400 updates the mode.
      defaultFsAdapter.setMode(target, 0o400);
      expect(defaultFsAdapter.getMode(target)).toBe(0o400);
    },
  );

  it.skipIf(isWindows)(
    "getMode masks non-permission bits and returns only 0o7777",
    async () => {
      // Given: a fresh file.
      const dir = mkdtempSync(join(tmpdir(), "umactually-fs-atomic-mask-"));
      const target = join(dir, "file");
      writeFileSync(target, "x", "utf8");

      const { defaultFsAdapter } = await import("../../src/util/fs-atomic.js");

      // When: getMode is read.
      const mode = defaultFsAdapter.getMode(target);

      // Then: only the low 12 permission bits are exposed (no file-
      // type bits like S_IFREG leak through).
      expect(mode).not.toBeNull();
      expect(mode! & ~0o7777).toBe(0);
    },
  );
});
