// SPDX-License-Identifier: MIT
// Direct unit tests for the helpers in src/cli.ts's isMainModule() IIFE.
//
// Background: src/cli.ts decomposes isMainModule() into six named
// predicates (isActionEntryPresent, isProcessSeaBinary,
// argv1LooksLikeSeaBinary, argv1IsNpmShimSymlink, argv1MatchesModuleUrl,
// argv1MatchesCliBasename) plus the composed function itself. The
// pre-existing cli-is-main-module-symlink.test.ts and
// bin-shim-auto-invoke.test.ts cover the auto-invoke end-to-end via the
// dist bundle, but they don't exercise every branch — for example, the
// action-entry flag, the process.versions.sea short-circuit, the
// UMACTUALLY_DISABLE_AUTO_INVOKE opt-out, the argv1.length === 0
// fallback, and the cli.js/mjs/cjs basename regex. SonarCloud's
// new_coverage metric counts lines actually executed in the new code;
// without direct unit tests, new_code coverage stays under the 80%
// threshold and the quality gate fails.
//
// Approach: each test sets up a controlled environment
// (process.argv, process.versions.sea, globalThis.__umactually_action_entry__,
// UMACTUALLY_DISABLE_AUTO_INVOKE), re-imports src/cli.js with
// vi.resetModules(), and observes whether main() was auto-invoked by
// checking the captured stdout. The auto-invoke on `--version` writes
// the version string via writeFileSync(process.stdout.fd, ...) which
// we intercept via vi.doMock("node:fs").

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync as realWriteFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { readonly version: unknown };
const packageVersion = String(packageJson.version);
const autoContextDirectory = join(process.cwd(), ".umactually-auto-ctx");

// Per-test buffer for the writeFileSync(process.stdout.fd, ...) call
// that runVersion uses to print the version string. If the auto-invoke
// fires, this buffer holds the version; if it doesn't, the buffer
// stays empty.
let stdoutBuffer = "";

let cliModule: typeof import("../../src/cli.js");

beforeEach(async () => {
  stdoutBuffer = "";
  // Mock node:fs so writeFileSync(process.stdout.fd, ...) captures
  // instead of writing to the real stdout. Every other fs function
  // passes through to the real implementation.
  vi.doMock("node:fs", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    return {
      ...actual,
      writeFileSync: ((
        fd: number | import("node:fs/promises").FileHandle,
        data: string | NodeJS.ArrayBufferView,
        ...rest: unknown[]
      ): void => {
        if (fd === process.stdout.fd) {
          stdoutBuffer += typeof data === "string" ? data : data.toString();
          return;
        }
        return actual.writeFileSync(fd as never, data as never, ...(rest as []));
      }) as typeof actual.writeFileSync,
    };
  });
  vi.resetModules();
  ({ ...cliModule } = await import("../../src/cli.js"));
  // `cliModule` is used only to ensure the import ran; the auto-invoke
  // either fires or doesn't as a side effect of import.
});

afterEach(async () => {
  stdoutBuffer = "";
  vi.doUnmock("node:fs");
  vi.resetModules();
  await rm(autoContextDirectory, { recursive: true, force: true });
});

// Capture the dispatch flag state across all tests. The action entry
// sets globalThis.__umactually_action_entry__ = true before this module
// loads; we need to clear it before each test so the test's controlled
// value is authoritative.
const ACTION_ENTRY_FLAG = "__umactually_action_entry__";

describe.skipIf(!existsSync(join(process.cwd(), "src", "cli.ts")))(
  "src/cli.ts isMainModule predicate coverage",
  () => {
    it("isActionEntryPresent: globalThis.__umactually_action_entry__ = true suppresses the auto-invoke", async () => {
      // The action entry sets the global flag before this module
      // loads. When the flag is true, isMainModule() returns false at
      // step 2 and main() is never called.
      const originalActionFlag = (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = true;
      const originalArgv = process.argv;
      process.argv = [process.argv[0] ?? "node", "/some/path/cli.js", "--version"];
      const originalDisable = process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      try {
        vi.resetModules();
        await import("../../src/cli.js");
        // Give the auto-invoke promise one tick to settle. If main()
        // fired, stdoutBuffer would contain the version string. If it
        // didn't, stdoutBuffer stays empty.
        await new Promise((resolve) => setImmediate(resolve));
        expect(stdoutBuffer, "auto-invoke should be suppressed by action-entry flag").toBe("");
      } finally {
        if (originalActionFlag === undefined) {
          delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        } else {
          (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = originalActionFlag;
        }
        process.argv = originalArgv;
        if (originalDisable === undefined) {
          delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        } else {
          process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = originalDisable;
        }
      }
    });

    it("isProcessSeaBinary: process.versions.sea = '1.0.0' auto-invokes regardless of argv1", async () => {
      // Node 25.7.0+ SEA binaries set process.versions.sea to a
      // non-empty string. The short-circuit at step 3 returns true
      // before any argv1 inspection, so even an empty argv1 triggers
      // the auto-invoke.
      const originalActionFlag = (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      const originalSea = (process.versions as Record<string, unknown>)["sea"];
      (process.versions as Record<string, unknown>)["sea"] = "1.0.0";
      const originalArgv = process.argv;
      process.argv = [process.argv[0] ?? "node", "", "--version"]; // empty argv1 — should still auto-invoke
      const originalDisable = process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      try {
        vi.resetModules();
        await import("../../src/cli.js");
        await new Promise((resolve) => setImmediate(resolve));
        expect(
          stdoutBuffer,
          "process.versions.sea short-circuit should auto-invoke even with empty argv1",
        ).toBe(`${packageVersion}\n`);
      } finally {
        if (originalActionFlag === undefined) {
          delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        } else {
          (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = originalActionFlag;
        }
        if (originalSea === undefined) {
          delete (process.versions as Record<string, unknown>)["sea"];
        } else {
          (process.versions as Record<string, unknown>)["sea"] = originalSea;
        }
        process.argv = originalArgv;
        if (originalDisable === undefined) {
          delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        } else {
          process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = originalDisable;
        }
      }
    });

    it("argv1LooksLikeSeaBinary: .exe / .cmd / .bat extension auto-invoke (SEA-binary fallback)", async () => {
      // Node 25.6.0 SEA binaries don't always populate
      // process.versions.sea, so the .exe/.cmd/.bat extension check on
      // argv1 is the fallback. Each extension variant must
      // auto-invoke.
      for (const extension of [".exe", ".cmd", ".bat"]) {
        const originalActionFlag = (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        const originalSea = (process.versions as Record<string, unknown>)["sea"];
        delete (process.versions as Record<string, unknown>)["sea"];
        const originalArgv = process.argv;
        process.argv = [process.argv[0] ?? "node", `/usr/local/bin/umactually${extension}`, "--version"];
        const originalDisable = process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        try {
          vi.resetModules();
          await import("../../src/cli.js");
          await new Promise((resolve) => setImmediate(resolve));
          expect(
            stdoutBuffer,
            `extension ${extension} should trigger the SEA fallback and auto-invoke (got ${JSON.stringify(stdoutBuffer)})`,
          ).toContain(`${packageVersion}\n`);
        } finally {
          if (originalActionFlag === undefined) {
            delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
          } else {
            (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = originalActionFlag;
          }
          if (originalSea === undefined) {
            delete (process.versions as Record<string, unknown>)["sea"];
          } else {
            (process.versions as Record<string, unknown>)["sea"] = originalSea;
          }
          process.argv = originalArgv;
          if (originalDisable === undefined) {
            delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
          } else {
            process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = originalDisable;
          }
        }
      }
    });

    it("argv1MatchesCliBasename: argv1 ending in cli.mjs triggers the ESM-loader fallback", async () => {
      // When argv1 doesn't match import.meta.url (e.g. an ESM loader
      // like tsx or ts-node sets argv1 to the loader entry), the URL
      // match fails. Step 7 falls back to the cli.js/mjs/cjs basename
      // regex. This is the path that fires when a developer runs
      // `node --import tsx dist/cli.js review`.
      const originalActionFlag = (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      const originalSea = (process.versions as Record<string, unknown>)["sea"];
      delete (process.versions as Record<string, unknown>)["sea"];
      const originalArgv = process.argv;
      // Use a path that ends in cli.mjs but does NOT exist on disk —
      // the realpath check in argv1MatchesModuleUrl would fail with
      // ENOENT, but argv1MatchesCliBasename only needs the basename.
      process.argv = [
        process.argv[0] ?? "node",
        "/nonexistent/path/to/dist/cli.mjs",
        "--version",
      ];
      const originalDisable = process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      try {
        vi.resetModules();
        await import("../../src/cli.js");
        await new Promise((resolve) => setImmediate(resolve));
        expect(
          stdoutBuffer,
          "argv1 ending in cli.mjs (with a non-existent parent path) should trigger the basename fallback",
        ).toBe(`${packageVersion}\n`);
      } finally {
        if (originalActionFlag === undefined) {
          delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        } else {
          (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = originalActionFlag;
        }
        if (originalSea === undefined) {
          delete (process.versions as Record<string, unknown>)["sea"];
        } else {
          (process.versions as Record<string, unknown>)["sea"] = originalSea;
        }
        process.argv = originalArgv;
        if (originalDisable === undefined) {
          delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        } else {
          process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = originalDisable;
        }
      }
    });

    it("UMACTUALLY_DISABLE_AUTO_INVOKE=1 suppresses the auto-invoke on the basename path", async () => {
      // Library opt-out: a third-party importer of dist/cli sets the
      // env var to bypass the auto-invoke. The flag is checked at
      // step 5, AFTER the SEA-binary fallback (step 4) — a SEA-binary
      // argv1 short-circuits to true at step 4 and the disable flag
      // doesn't apply. To exercise the disable-flag path, we use a
      // `.js` extension so argv1LooksLikeSeaBinary returns false
      // (only `.exe`/`.cmd`/`.bat` trigger the SEA shape), and
      // then the basename regex matches → step 7 returns true.
      // With the disable flag set, step 5 returns false and main()
      // doesn't fire.
      const originalActionFlag = (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      const originalSea = (process.versions as Record<string, unknown>)["sea"];
      delete (process.versions as Record<string, unknown>)["sea"];
      const originalArgv = process.argv;
      process.argv = [process.argv[0] ?? "node", "/some/path/cli.js", "--version"];
      const originalDisable = process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = "1";
      try {
        vi.resetModules();
        await import("../../src/cli.js");
        await new Promise((resolve) => setImmediate(resolve));
        expect(
          stdoutBuffer,
          "UMACTUALLY_DISABLE_AUTO_INVOKE=1 should suppress the auto-invoke (got " +
            JSON.stringify(stdoutBuffer) +
            ")",
        ).toBe("");
      } finally {
        if (originalActionFlag === undefined) {
          delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        } else {
          (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = originalActionFlag;
        }
        if (originalSea === undefined) {
          delete (process.versions as Record<string, unknown>)["sea"];
        } else {
          (process.versions as Record<string, unknown>)["sea"] = originalSea;
        }
        process.argv = originalArgv;
        if (originalDisable === undefined) {
          delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        } else {
          process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = originalDisable;
        }
      }
    });

    it("argv1.length === 0 fallback returns false (no auto-invoke) when all other gates miss", async () => {
      // With no process.versions.sea, no .exe/.cmd/.bat extension, no
      // action-entry flag, no UMACTUALLY_DISABLE_AUTO_INVOKE, no
      // argv1.length > 0, and no URL/basename match, isMainModule()
      // returns false. This is the third-party-importer path.
      const originalActionFlag = (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
      const originalSea = (process.versions as Record<string, unknown>)["sea"];
      delete (process.versions as Record<string, unknown>)["sea"];
      const originalArgv = process.argv;
      process.argv = [process.argv[0] ?? "node", "", "--version"]; // empty argv1
      const originalDisable = process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
      try {
        vi.resetModules();
        await import("../../src/cli.js");
        await new Promise((resolve) => setImmediate(resolve));
        expect(
          stdoutBuffer,
          "empty argv1 with no SEA-binary / no URL match should not auto-invoke",
        ).toBe("");
      } finally {
        if (originalActionFlag === undefined) {
          delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        } else {
          (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = originalActionFlag;
        }
        if (originalSea === undefined) {
          delete (process.versions as Record<string, unknown>)["sea"];
        } else {
          (process.versions as Record<string, unknown>)["sea"] = originalSea;
        }
        process.argv = originalArgv;
        if (originalDisable === undefined) {
          delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        } else {
          process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = originalDisable;
        }
      }
    });

    it("argv1IsNpmShimSymlink: extensionless argv1 with a JS-extension realpath does NOT auto-invoke", async () => {
      // Regression for the bug fixed in src/cli.ts: an extensionless
      // argv1 (e.g. /tmp/npm-symlink/umactually, a symlink whose target
      // ends in .mjs) must NOT auto-invoke as a SEA binary. The
      // realpath-resolving guard resolves the symlink to
      // bin/umactually.mjs (JS-extension), returns true, and the
      // outer branch falls through. isMainModule() then hits step 5
      // (disable flag — not set) and step 6 (URL match — argv1 has
      // no path to import.meta.url) and step 7 (basename regex —
      // argv1 has no .js/.mjs/.cjs extension), so returns false.
      // We create a real symlink so argv1IsNpmShimSymlink's
      // realpathSync() succeeds; a non-existent path would throw
      // ENOENT and return false (which would incorrectly trigger the
      // SEA fallback and auto-invoke).
      const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
      const SHIM = join(REPO_ROOT, "bin", "umactually.mjs");
      const tmpRoot = join(REPO_ROOT, "node_modules", ".tmp-argv1-isshim-test");
      const symlinkPath = join(tmpRoot, "umactually");
      try {
        try {
          mkdirSync(tmpRoot, { recursive: true });
          symlinkSync(SHIM, symlinkPath);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/symlink|EPERM|ENOTSUP|EACCES/i.test(msg)) {
            // eslint-disable-next-line no-console
            console.warn(`[skip] symlink unsupported on this filesystem: ${msg}`);
            return;
          }
          throw err;
        }
        const originalActionFlag = (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
        const originalSea = (process.versions as Record<string, unknown>)["sea"];
        delete (process.versions as Record<string, unknown>)["sea"];
        const originalArgv = process.argv;
        const originalDisable = process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
        // argv1 is the extensionless symlink path — Node does NOT
        // resolve symlinks in argv1 for shebang-invoked scripts, so
        // argv1 will literally be the symlink path.
        process.argv = [process.argv[0] ?? "node", symlinkPath, "--version"];
        try {
          vi.resetModules();
          await import("../../src/cli.js");
          await new Promise((resolve) => setImmediate(resolve));
          expect(
            stdoutBuffer,
            "extensionless argv1 (npm-shim symlink to .mjs) must not auto-invoke (got " +
              JSON.stringify(stdoutBuffer) +
              ")",
          ).toBe("");
        } finally {
          if (originalActionFlag === undefined) {
            delete (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG];
          } else {
            (globalThis as Record<string, unknown>)[ACTION_ENTRY_FLAG] = originalActionFlag;
          }
          if (originalSea === undefined) {
            delete (process.versions as Record<string, unknown>)["sea"];
          } else {
            (process.versions as Record<string, unknown>)["sea"] = originalSea;
          }
          process.argv = originalArgv;
          if (originalDisable === undefined) {
            delete process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"];
          } else {
            process.env["UMACTUALLY_DISABLE_AUTO_INVOKE"] = originalDisable;
          }
        }
      } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  },
);

// Sanity: ensure the realWriteFileSync import is not flagged as unused
// (it's referenced above only via the type annotation on the
// doMock interceptor). We re-export it through a no-op usage to keep
// the linter happy without dragging in a side effect.
void realWriteFileSync;