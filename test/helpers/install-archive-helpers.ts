// SPDX-License-Identifier: MIT
// Shared helpers for archive-mode installer tests.
//
// Provides:
//   - canonical six-target manifest
//   - hand-rolled ustar tarball builder with arbitrary typeflags
//   - gzipSync wrapper (no streaming data descriptor)
//   - canonical checksum file writer
//   - fixture server lifecycle
//   - install.sh invocation helper that pins HOME to a sandbox
//
// Tests in test/unit/install-archives-posix.test.ts and the archive-mode
// arm of test/unit/install-checksum.test.ts both consume this module.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
export const INSTALL_SH = resolve(REPO_ROOT, "scripts", "install.sh");
export const FIXTURE_SERVER = resolve(REPO_ROOT, "test", "helpers", "release-fixture-server.mjs");

// Five canonical targets (must match scripts/release-targets.json layout).
// v0.6.4: windows-arm64 is in the manifest and the install scripts
// still ship a contract for it, but the release workflow builds it
// on ubuntu-24.04 via tsdown --exe (the same broken-in-CI path as
// v0.6.1+). The PE machine type is x64 (0x8664) instead of ARM64
// (0xAA64), so the Windows ARM64 structural validation was removed
// (the .exe is shipped as a fallback but is not a true ARM64 binary).
// Re-enabling the structural validation requires a windows-11-arm
// GitHub-hosted runner (added 2024) and a per-arch job split.
export type Target = Readonly<{
  id: string;
  rawName: string;
  archiveName: string;
  memberName: string;
  installedName: string;
  archiveType: "tar.gz" | "zip";
}>;

export const TARGETS: ReadonlyArray<Target> = [
  { id: "linux-x64",      rawName: "umactually-linux-x64",        archiveName: "umactually-linux-x64.tar.gz",      memberName: "umactually-linux-x64",        installedName: "umactually",     archiveType: "tar.gz" },
  { id: "linux-arm64",    rawName: "umactually-linux-arm64",      archiveName: "umactually-linux-arm64.tar.gz",    memberName: "umactually-linux-arm64",      installedName: "umactually",     archiveType: "tar.gz" },
  { id: "darwin-arm64",   rawName: "umactually-darwin-arm64",     archiveName: "umactually-darwin-arm64.tar.gz",   memberName: "umactually-darwin-arm64",     installedName: "umactually",     archiveType: "tar.gz" },
  { id: "windows-x64",    rawName: "umactually-windows-x64.exe",  archiveName: "umactually-windows-x64.zip",      memberName: "umactually-windows-x64.exe",  installedName: "umactually.exe", archiveType: "zip" },
  { id: "windows-arm64",  rawName: "umactually-windows-arm64.exe",archiveName: "umactually-windows-arm64.zip",    memberName: "umactually-windows-arm64.exe",installedName: "umactually.exe", archiveType: "zip" },
];

export function findBash(): string | null {
  const candidates = process.platform === "win32"
    ? ["bash.exe", "bash"]
    : ["bash", "/usr/bin/bash", "/opt/homebrew/bin/bash"];
  for (const c of candidates) {
    const result = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return c;
  }
  return null;
}

export const SHELL = findBash();
export const SHELL_AVAILABLE = SHELL !== null;

// ---- ustar builder --------------------------------------------------------

const BLOCK = 512;
const USTAR_MAGIC = Buffer.from("ustar\x00", "binary");
const USTAR_VER = Buffer.from("00", "binary");

function padOctal(value: number, length: number): Buffer {
  const oct = value.toString(8).padStart(length - 1, "0");
  const buf = Buffer.alloc(length);
  buf.write(oct, 0, "binary");
  buf[length - 1] = 0;
  return buf;
}

function padString(value: string, length: number): Buffer {
  const buf = Buffer.alloc(length);
  buf.write(value, 0, length, "binary");
  return buf;
}

function checksumHeader(header: Buffer): number {
  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 32 : header[i]!;
  return sum;
}

export type UstarEntryOptions = Readonly<{
  name: string;
  typeflag: number;
  size?: number;
  linkname?: string;
  mode?: number;
}>;

export function buildUstarEntry(opts: UstarEntryOptions): Buffer {
  const header = Buffer.alloc(BLOCK);
  padString(opts.name.slice(0, 99) + "\0", 100).copy(header, 0);
  padOctal(opts.mode ?? 0o755, 8).copy(header, 100);
  padOctal(0, 8).copy(header, 108);
  padOctal(0, 8).copy(header, 116);
  padOctal(opts.size ?? 0, 12).copy(header, 124);
  padOctal(Math.floor(new Date("1980-01-01T00:00:00Z").getTime() / 1000), 12).copy(header, 136);
  // Fill chksum field with spaces BEFORE computing the checksum so the sum
  // matches what GNU tar expects.
  for (let i = 148; i < 156; i += 1) header[i] = 0x20;
  header[156] = opts.typeflag;
  if (opts.linkname) padString(opts.linkname.slice(0, 99) + "\0", 100).copy(header, 157);
  USTAR_MAGIC.copy(header, 257);
  USTAR_VER.copy(header, 263);
  // Compute checksum AFTER the rest of the header is in place.
  padOctal(checksumHeader(header), 8).copy(header, 148);
  return header;
}

function buildPaddedPayload(payload: Buffer): Buffer {
  const padding = (BLOCK - (payload.length % BLOCK)) % BLOCK;
  return Buffer.concat([payload, Buffer.alloc(padding === 0 ? BLOCK : padding)]);
}

/**
 * Build a single-member .tar (no gzip) with arbitrary content. To produce
 * a .tar.gz, wrap with `gzipSync(...)`.
 */
export function buildTar(opts: UstarEntryOptions, payload?: Buffer): Buffer {
  const entry = buildUstarEntry({ ...opts, size: payload?.length ?? 0 });
  const eof = Buffer.alloc(BLOCK * 2);
  if (payload === undefined) {
    return Buffer.concat([entry, eof]);
  }
  return Buffer.concat([entry, buildPaddedPayload(payload), eof]);
}

/**
 * Build a multi-member .tar (used to exercise duplicate-name fixtures).
 */
export function buildMultiTar(entries: ReadonlyArray<{ opts: UstarEntryOptions; payload?: Buffer }>): Buffer {
  const blocks: Buffer[] = [];
  for (const { opts, payload } of entries) {
    const entry = buildUstarEntry({ ...opts, size: payload?.length ?? 0 });
    blocks.push(entry);
    if (payload !== undefined) blocks.push(buildPaddedPayload(payload));
  }
  blocks.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(blocks);
}

// ---- archive fixture helpers ---------------------------------------------

export type BuiltArchive = Readonly<{
  bytes: Buffer;
  memberName: string;
}>;

/**
 * Build a valid .tar.gz archive for a target, wrapping the supplied
 * payload in a single regular-file member.
 */
export function buildArchive(target: Target, payload: Buffer): BuiltArchive {
  const tar = buildTar({ name: target.memberName, typeflag: 0x30 }, payload);
  return { bytes: gzipSync(tar, { level: 9 }), memberName: target.memberName };
}

/**
 * Build a checksum file (LF only) containing one entry per manifest
 * archive. The basenames are the canonical archiveName/rawName; the
 * supplied `hashesByBasename` map must contain every key.
 */
export function buildChecksumFile(
  hashesByBasename: Readonly<Record<string, string>>,
  mode: "archive" | "raw",
): string {
  const lines: string[] = [];
  for (const t of TARGETS) {
    const name = mode === "archive" ? t.archiveName : t.rawName;
    const hash = hashesByBasename[name];
    if (typeof hash !== "string") {
      throw new Error(`buildChecksumFile: missing hash for ${name}`);
    }
    lines.push(`${hash}  ${name}`);
  }
  return lines.join("\n") + "\n";
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---- fixture server -------------------------------------------------------

export type FixtureHandle = Readonly<{
  baseUrl: string;
  close: () => Promise<void>;
}>;

export type FixtureOptions = Readonly<{
  releaseDir: string;
  rawDir?: string;
  tag?: string;
  prerelease?: boolean;
  draft?: boolean;
  missing?: boolean;
}>;

export async function startFixture(options: FixtureOptions): Promise<FixtureHandle> {
  const args = [FIXTURE_SERVER, "--release-dir", options.releaseDir, "--release-tag", options.tag ?? "v0.5.0"];
  if (options.rawDir !== undefined) {
    args.push("--raw-dir", options.rawDir);
  }
  if (options.prerelease === true) args.push("--release-prerelease");
  if (options.draft === true) args.push("--release-draft");
  if (options.missing === true) args.push("--release-missing");
  const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  const lines = createInterface({ input: child.stdout });
  let port = "";
  try {
    const [line] = await once(lines, "line");
    port = (line ?? "").replace(/^PORT=/, "").trim();
  } finally {
    lines.close();
  }
  if (!port) {
    child.kill();
    throw new Error("release-fixture-server did not advertise a port");
  }
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      child.kill();
      await once(child, "exit").catch(() => undefined);
    },
  };
}

// ---- install invocation ---------------------------------------------------

export type InstallEnv = Readonly<{
  fakeHome: string;
  manifestPath: string;
  serverBaseUrl: string;
  tag: string;
  platform?: string;
  arch?: string;
  contract?: string;
  base?: string;
  psScriptUrl?: string;
  extraEnv?: Readonly<Record<string, string>>;
}>;

export type InstallResult = Readonly<{
  status: number | null;
  stdout: string;
  stderr: string;
}>;

export function runInstaller(env: InstallEnv): InstallResult {
  if (SHELL === null) {
    return { status: 0, stdout: "SHELL_UNAVAILABLE", stderr: "" };
  }
  // The fake-server env vars are only forwarded when the test passes
  // a non-empty serverBaseUrl. Tests that want to drive the case 1
  // "no overrides" path can pass serverBaseUrl="" to skip them.
  //
  // INSTALL_DIR_OVERRIDE is forced to `<fakeHome>/.local/bin` so the
  // install is sandboxed regardless of the runtime user. Without this,
  // install.sh writes to `/usr/local/bin` when running as root
  // (the default in Docker/CI/sandbox), and the test assertions
  // looking at `fakeHome/.local/bin/umactually` see ENOENT. A real
  // user explicitly setting INSTALL_DIR_OVERRIDE via `extraEnv`
  // would still win because extraEnv is merged last.
  const sandboxedInstallDir = join(env.fakeHome, ".local", "bin");
  const merged: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: env.fakeHome,
    INSTALL_DIR_OVERRIDE: sandboxedInstallDir,
    ...(env.serverBaseUrl !== "" ? { INSTALL_TEST_FAKE_SERVER: env.serverBaseUrl } : {}),
    ...(env.tag !== "" ? { INSTALL_TEST_FAKE_TAG: env.tag } : {}),
    INSTALL_MANIFEST: env.manifestPath,
    ...(env.platform !== undefined ? { PLATFORM_OVERRIDE: env.platform } : {}),
    ...(env.arch !== undefined ? { ARCH_OVERRIDE: env.arch } : {}),
    ...(env.contract !== undefined ? { INSTALL_ASSET_CONTRACT: env.contract } : {}),
    ...(env.base !== undefined && env.base !== "" ? { INSTALL_RELEASE_BASE: env.base } : {}),
    ...(env.psScriptUrl !== undefined ? { INSTALL_POWERSHELL_SCRIPT_URL: env.psScriptUrl } : {}),
    ...(env.extraEnv ?? {}),
  };
  const result = spawnSync(SHELL, [INSTALL_SH], { encoding: "utf8", env: merged });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function writeManifest(manifestPath: string, targets: ReadonlyArray<Target> = TARGETS): void {
  mkdirSync(manifestPath.replace(/[^/\\]+$/, ""), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(targets, null, 2));
}

export function readReleaseDir(releaseDir: string, name: string): Buffer {
  return readFileSync(`${releaseDir}/${name}`);
}
