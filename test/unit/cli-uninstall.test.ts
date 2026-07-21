// SPDX-License-Identifier: MIT
// Tests for src/cli/uninstall.ts (the `umactually uninstall` subcommand).
//
// We test the pure pieces directly (parseUninstallArgs, classifyExecPath,
// findShellRcBlocks, stripShellRcBlocks, runUninstall with injected fs
// adapter, purgeConfig, revertPath) so we never touch the real filesystem
// and never need the user to confirm anything.

import { describe, expect, it } from "vitest";
import { sep } from "node:path";

import {
  classifyExecPath,
  defaultFsAdapter,
  findShellRcBlocks,
  formatUninstallHuman,
  formatUninstallJson,
  parseUninstallArgs,
  purgeConfig,
  revertPath,
  runUninstall,
  stripShellRcBlocks,
  type FsAdapter,
  type UninstallDeps,
} from "../../src/cli/uninstall.js";

const HOME = `/home/tester${sep === "/" ? "" : sep}`.replace(/\/$/, sep);

// Tiny in-memory fs adapter for the runUninstall / purge / revert paths.
type FileEntry = { readonly kind: "file" | "dir" | "symlink"; readonly content?: string };
function makeFs(files: Record<string, FileEntry>): FsAdapter & { readonly files: typeof files } {
  const store: Record<string, FileEntry> = { ...files };
  return {
    files: store,
    exists: (path) => path in store,
    isSymlink: (path) => store[path]?.kind === "symlink",
    isFile: (path) => store[path]?.kind === "file",
    isDirectory: (path) => store[path]?.kind === "dir",
    unlink: (path) => {
      delete store[path];
    },
    removeDir: (path) => {
      for (const key of Object.keys(store)) {
        if (key === path || key.startsWith(`${path}${sep}`)) {
          delete store[key];
        }
      }
    },
    readFile: (path) => {
      const entry = store[path];
      if (entry?.kind !== "file") {
        throw new Error(`ENOENT: ${path}`);
      }
      return entry.content ?? "";
    },
    writeFile: (path, content) => {
      store[path] = { kind: "file", content };
    },
  };
}

function makeDeps(overrides: Partial<UninstallDeps> & { readonly fsAdapter: FsAdapter }): UninstallDeps {
  return {
    isTTY: false,
    env: {},
    stdinReader: () => null,
    execPath: `${HOME}/.local/bin/umactually`,
    platform: "linux",
    homeDir: HOME,
    ...overrides,
  };
}

describe("parseUninstallArgs", () => {
  it("defaults: removeBinary=true, everything else=false", () => {
    const parsed = parseUninstallArgs([]);
    expect(parsed.mode).toEqual({
      removeBinary: true,
      purgeConfig: false,
      revertPath: false,
      yes: false,
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.help).toBe(false);
    expect(parsed.json).toBe(false);
  });

  it("accepts all flags", () => {
    const parsed = parseUninstallArgs([
      "--purge-config",
      "--revert-path",
      "--yes",
      "--json",
    ]);
    expect(parsed.mode.purgeConfig).toBe(true);
    expect(parsed.mode.revertPath).toBe(true);
    expect(parsed.mode.yes).toBe(true);
    expect(parsed.json).toBe(true);
    expect(parsed.errors).toEqual([]);
  });

  it("accepts -y as alias for --yes", () => {
    const parsed = parseUninstallArgs(["-y"]);
    expect(parsed.mode.yes).toBe(true);
  });

  it("rejects unknown flags", () => {
    const parsed = parseUninstallArgs(["--bogus"]);
    expect(parsed.errors).toEqual(["unknown flag: --bogus"]);
  });

  it("rejects positional args", () => {
    const parsed = parseUninstallArgs(["--yes", "extra"]);
    expect(parsed.errors).toEqual(["unexpected positional arg: extra"]);
  });

  it("--no-remove-binary overrides the default", () => {
    const parsed = parseUninstallArgs(["--no-remove-binary", "--purge-config"]);
    expect(parsed.mode.removeBinary).toBe(false);
    expect(parsed.mode.purgeConfig).toBe(true);
  });
});

describe("classifyExecPath", () => {
  it("accepts ~/.local/bin/umactually", () => {
    const result = classifyExecPath(`${HOME}/.local/bin/umactually`, "linux", HOME);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.installDir).toBe(`${HOME}/.local/bin`);
  });

  it("accepts /usr/local/bin/umactually", () => {
    const result = classifyExecPath("/usr/local/bin/umactually", "linux", HOME);
    expect(result.ok).toBe(true);
  });

  it("rejects a name that is not 'umactually'", () => {
    const result = classifyExecPath(`${HOME}/.local/bin/node`, "linux", HOME);
    expect(result.ok).toBe(false);
  });

  it("requires .exe suffix on Windows", () => {
    const winHome = `C:\\Users\\tester`;
    const ok = classifyExecPath(`C:\\Users\\tester\\.local\\bin\\umactually.exe`, "win32", winHome);
    expect(ok.ok).toBe(true);
    const bad = classifyExecPath(`C:\\Users\\tester\\.local\\bin\\umactually`, "win32", winHome);
    expect(bad.ok).toBe(false);
  });

  it("rejects exec paths in arbitrary directories", () => {
    const result = classifyExecPath("/tmp/umactually", "linux", HOME);
    expect(result.ok).toBe(false);
  });

  it("rejects exec paths in /etc that happen to end in /bin", () => {
    const result = classifyExecPath("/etc/cron.daily/bin/umactually", "linux", HOME);
    expect(result.ok).toBe(false);
  });

  it("rejects nested paths under the home dir that end in /bin (security fix)", () => {
    // Was previously accepted because parent.endsWith('/bin') && parent.startsWith(homeDir).
    const result = classifyExecPath("/home/tester/some/random/bin/umactually", "linux", HOME);
    expect(result.ok).toBe(false);
  });

  it("rejects paths like /home/tester/bin/evil/umactually", () => {
    const result = classifyExecPath("/home/tester/bin/evil/umactually", "linux", HOME);
    expect(result.ok).toBe(false);
  });

  it("accepts homeDir + '/bin' (direct child)", () => {
    const result = classifyExecPath("/home/tester/bin/umactually", "linux", HOME);
    expect(result.ok).toBe(true);
  });

  it("accepts homeDir + '/.bin' (direct child)", () => {
    const result = classifyExecPath("/home/tester/.bin/umactually", "linux", HOME);
    expect(result.ok).toBe(true);
  });

  it("accepts /opt/<single-segment>/bin", () => {
    const result = classifyExecPath("/opt/tools/bin/umactually", "linux", HOME);
    expect(result.ok).toBe(true);
  });

  it("rejects /opt/<multi-segment>/bin (nested)", () => {
    const result = classifyExecPath("/opt/tools/sub/bin/umactually", "linux", HOME);
    expect(result.ok).toBe(false);
  });
});

describe("findShellRcBlocks + stripShellRcBlocks", () => {
  const sample = [
    "# some user comment",
    "export FOO=bar",
    "",
    "# Added by umactually installer",
    `export PATH="${HOME}/.local/bin:$PATH"`,
    "export OTHER=thing",
  ].join("\n");

  it("finds the umactually block", () => {
    const blocks = findShellRcBlocks(sample);
    expect(blocks).toHaveLength(1);
  });

  it("strip removes the umactually block, preserves other lines", () => {
    const stripped = stripShellRcBlocks(sample);
    expect(stripped).not.toContain("Added by umactually installer");
    expect(stripped).not.toContain(".local/bin");
    expect(stripped).toContain("export FOO=bar");
    expect(stripped).toContain("export OTHER=thing");
  });

  it("returns content unchanged when no block is present", () => {
    const content = "export FOO=bar\n";
    expect(stripShellRcBlocks(content)).toBe(content);
  });

  it("handles multiple blocks (unusual but possible)", () => {
    const twoBlocks = sample + "\n# Added by umactually installer\nexport PATH=\"x:$PATH\"\n";
    const blocks = findShellRcBlocks(twoBlocks);
    expect(blocks).toHaveLength(2);
  });
});

describe("runUninstall (binary removal)", () => {
  it("removes the binary and returns ok", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "file", content: "binary" },
    });
    const result = runUninstall(makeDeps({ fsAdapter: fs, isTTY: false, env: { UMACTUALLY_UNINSTALL_YES: "1" } }));
    expect(result.exitCode).toBe(0);
    const removal = result.checks.find((c) => c.id === "binary-removal");
    expect(removal?.status).toBe("ok");
    expect(fs.files[`${HOME}/.local/bin/umactually`]).toBeUndefined();
  });

  it("rejects symlinks", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "symlink" },
    });
    const result = runUninstall(makeDeps({ fsAdapter: fs, env: { UMACTUALLY_UNINSTALL_YES: "1" } }));
    expect(result.exitCode).toBe(2);
    const removal = result.checks.find((c) => c.id === "binary-removal");
    expect(removal?.status).toBe("fail");
  });

  it("rejects an exec path that is not in a known install dir", () => {
    const fs = makeFs({ "/tmp/umactually": { kind: "file" } });
    const result = runUninstall(
      makeDeps({ fsAdapter: fs, execPath: "/tmp/umactually", env: { UMACTUALLY_UNINSTALL_YES: "1" } }),
    );
    expect(result.exitCode).toBe(2);
    const path = result.checks.find((c) => c.id === "exec-path");
    expect(path?.status).toBe("fail");
  });

  it("skips binary removal when the file is already gone", () => {
    const fs = makeFs({});
    const result = runUninstall(makeDeps({ fsAdapter: fs, env: { UMACTUALLY_UNINSTALL_YES: "1" } }));
    expect(result.exitCode).toBe(0);
    const removal = result.checks.find((c) => c.id === "binary-removal");
    expect(removal?.status).toBe("skip");
  });

  it("declines on non-yes TTY when stdin returns 'n'", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "file", content: "binary" },
    });
    const result = runUninstall(
      makeDeps({ fsAdapter: fs, isTTY: true, stdinReader: () => "n" }),
    );
    expect(result.exitCode).toBe(1);
    const removal = result.checks.find((c) => c.id === "binary-removal");
    expect(removal?.status).toBe("skip");
    expect(fs.files[`${HOME}/.local/bin/umactually`]).toBeDefined();
  });

  it("proceeds on TTY when stdin returns 'y'", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "file", content: "binary" },
    });
    const result = runUninstall(makeDeps({ fsAdapter: fs, isTTY: true, stdinReader: () => "y" }));
    expect(result.exitCode).toBe(0);
    expect(fs.files[`${HOME}/.local/bin/umactually`]).toBeUndefined();
  });

  it("proceeds on non-TTY with --yes env var", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "file", content: "binary" },
    });
    const result = runUninstall(makeDeps({ fsAdapter: fs, env: { UMACTUALLY_YES: "true" } }));
    expect(result.exitCode).toBe(0);
  });

  it("proceeds on TTY when --yes flag is in mode (no env var, no stdin)", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "file", content: "binary" },
    });
    // TTY would normally prompt, but mode.yes should override.
    const result = runUninstall(
      makeDeps({
        fsAdapter: fs,
        isTTY: true,
        stdinReader: () => "n",
        mode: { removeBinary: true, purgeConfig: false, revertPath: false, yes: true },
      }),
    );
    expect(result.exitCode).toBe(0);
    expect(fs.files[`${HOME}/.local/bin/umactually`]).toBeUndefined();
  });

  it("declines on TTY when --yes flag is absent even if env var is '0'", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "file", content: "binary" },
    });
    const result = runUninstall(
      makeDeps({
        fsAdapter: fs,
        isTTY: true,
        stdinReader: () => "n",
        env: { UMACTUALLY_UNINSTALL_YES: "0" },
      }),
    );
    expect(result.exitCode).toBe(1);
    expect(fs.files[`${HOME}/.local/bin/umactually`]).toBeDefined();
  });
});

describe("purgeConfig", () => {
  it("removes ~/.umactually/ and ~/.cache/umactually/ and reports both", () => {
    const fs = makeFs({
      [`${HOME}/.umactually${sep}config.json`]: { kind: "file", content: "{}" },
      [`${HOME}/.cache${sep}umactually${sep}cache.json`]: { kind: "file", content: "{}" },
      [`${HOME}/.umactually`]: { kind: "dir" },
      [`${HOME}/.cache${sep}umactually`]: { kind: "dir" },
    });
    const checks = purgeConfig(makeDeps({ fsAdapter: fs }));
    expect(checks.find((c) => c.id === "config-removal")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "cache-removal")?.status).toBe("ok");
  });

  it("skips directories that don't exist", () => {
    const fs = makeFs({});
    const checks = purgeConfig(makeDeps({ fsAdapter: fs }));
    expect(checks.find((c) => c.id === "config-removal")?.status).toBe("skip");
    expect(checks.find((c) => c.id === "cache-removal")?.status).toBe("skip");
  });

  it("warns when the path exists but is not a directory", () => {
    const fs = makeFs({
      [`${HOME}/.umactually`]: { kind: "file", content: "stray" },
    });
    const checks = purgeConfig(makeDeps({ fsAdapter: fs }));
    expect(checks.find((c) => c.id === "config-removal")?.status).toBe("warn");
  });
});

describe("revertPath", () => {
  const rcContent = [
    "# existing",
    "export FOO=bar",
    "",
    "# Added by umactually installer",
    `export PATH="${HOME}/.local/bin:$PATH"`,
    "",
    "# tail comment",
  ].join("\n");

  it("strips the umactually block from .zshrc", () => {
    const fs = makeFs({
      [`${HOME}/.zshrc`]: { kind: "file", content: rcContent },
    });
    const checks = revertPath(makeDeps({ fsAdapter: fs }));
    expect(checks.some((c) => c.status === "ok")).toBe(true);
    const stripped = fs.files[`${HOME}/.zshrc`]?.content ?? "";
    expect(stripped).not.toContain("Added by umactually installer");
    expect(stripped).toContain("export FOO=bar");
    expect(stripped).toContain("# tail comment");
  });

  it("skips when no block is found in any rc file", () => {
    const fs = makeFs({
      [`${HOME}/.bashrc`]: { kind: "file", content: "export FOO=bar\n" },
    });
    const checks = revertPath(makeDeps({ fsAdapter: fs }));
    expect(checks.find((c) => c.id === "path-revert")?.status).toBe("skip");
  });

  it("refuses to modify a symlink rc file", () => {
    const fs = makeFs({
      [`${HOME}/.zshrc`]: { kind: "symlink" },
    });
    const checks = revertPath(makeDeps({ fsAdapter: fs }));
    expect(checks.find((c) => c.id === "path-revert")?.status).toBe("skip");
  });
});

describe("formatUninstallJson + formatUninstallHuman", () => {
  it("json envelope includes schemaVersion, command, mode, checks", () => {
    const fs = makeFs({
      [`${HOME}/.local/bin/umactually`]: { kind: "file", content: "x" },
    });
    const result = runUninstall(makeDeps({ fsAdapter: fs, env: { UMACTUALLY_UNINSTALL_YES: "1" } }));
    const json = formatUninstallJson(result, { removeBinary: true, purgeConfig: false, revertPath: false, yes: true }, `${HOME}/.local/bin/umactually`);
    const parsed = JSON.parse(json) as {
      schemaVersion: number;
      command: string;
      mode: { removeBinary: boolean };
      checks: unknown[];
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.command).toBe("uninstall");
    expect(parsed.mode.removeBinary).toBe(true);
    expect(Array.isArray(parsed.checks)).toBe(true);
  });

  it("human output lists each check on its own line", () => {
    const fs = makeFs({});
    const result = runUninstall(makeDeps({ fsAdapter: fs, env: { UMACTUALLY_UNINSTALL_YES: "1" } }));
    const text = formatUninstallHuman(result);
    const lines = text.split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThan(0);
    expect(text).toContain("exec-path");
  });
});

describe("defaultFsAdapter", () => {
  it("exists / isFile / isDirectory read the real filesystem", () => {
    expect(defaultFsAdapter.exists("/tmp")).toBe(true);
    expect(defaultFsAdapter.isDirectory("/tmp")).toBe(true);
    expect(defaultFsAdapter.isFile("/tmp")).toBe(false);
  });
});
