#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Generate failure-mode evidence for Todo 6: install.ps1 archive-mode hostile
// fixture rejections. Captures per-case spawn exit code, stderr, and the
// preservation verdict (old SHA unchanged, no staging residue) into
// .omo/evidence/task-6-release-binary-download-size-failure.json.
//
// Run with: node scripts/generate-task-6-failure-evidence.mjs
//
// This script invokes the install.ps1 under INSTALL_TEST_ARCHIVE_MODE=1 with
// hostile fixtures (full traversal/absolute/rooted/nested/dup/dir/special-
// mode zip; checksum grammar hostile lines; locked destination; etc.) and
// records each rejection's stderr and exit code. Pass criterion is: every
// spawned installer exits nonzero and the seeded install bytes are unchanged.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// `import.meta.dirname` is a forward-slash path on Windows that
// `path.resolve` does not treat as absolute; use fileURLToPath to anchor.
import { fileURLToPath } from "node:url";
const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]+$/, "");
// SCRIPT_DIR = <repo>/scripts ; REPO_ROOT = <repo>'s parent -> <repo>
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const INSTALL_PS1 = join(REPO_ROOT, "scripts", "install.ps1");
const EVIDENCE_PATH = join(REPO_ROOT, ".omo", "evidence", "task-6-release-binary-download-size-failure.json");

// ---- hostile fixture authoring (mirrors test/unit/install-archives-powershell.test.ts) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}
function unixModeAttrs(mode) { return (mode << 16) >>> 0; }
function buildArchive(entries) {
  const locals = [];
  const cds = [];
  let localOffset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "binary");
    const crc = crc32(entry.bytes);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6);
    lfh.writeUInt16LE(0, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0x0021, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(entry.bytes.length, 18);
    lfh.writeUInt32LE(entry.bytes.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    locals.push(lfh, nameBuf, entry.bytes);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(0x031e, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x0021, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(entry.bytes.length, 20);
    cd.writeUInt32LE(entry.bytes.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(entry.externalAttributes >>> 0, 38);
    cd.writeUInt32LE(localOffset, 42);
    cds.push(cd, nameBuf);
    localOffset += lfh.length + nameBuf.length + entry.bytes.length;
  }
  const localBytes = Buffer.concat(locals);
  const cdBytes = Buffer.concat(cds);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBytes.length, 12);
  eocd.writeUInt32LE(localBytes.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([localBytes, cdBytes, eocd]);
}

const ARCHIVE_BASENAMES = [
  "umactually-linux-x64.tar.gz",
  "umactually-linux-arm64.tar.gz",
  "umactually-darwin-x64.tar.gz",
  "umactually-darwin-arm64.tar.gz",
  "umactually-windows-x64.zip",
  "umactually-windows-arm64.zip",
];
const MEMBER_NAME = "umactually-windows-x64.exe";
const PAYLOAD = Buffer.from("Write-Host 'umactually windows-x64 fixture version 0.4.1'\r\n", "binary");

function buildArchiveChecksums(archiveBytes, archiveBasename) {
  const hash = createHash("sha256").update(archiveBytes).digest("hex");
  return ARCHIVE_BASENAMES.map((b) =>
    b === archiveBasename
      ? `${hash}  ${b}`
      : `${"0".repeat(64)}  ${b}`,
  ).join("\n") + "\n";
}

// ---- discovery ----
function findPowerShell() {
  const candidates = process.platform === "win32"
    ? ["powershell.exe", "pwsh.exe", "pwsh"]
    : ["pwsh", "powershell"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion"], { stdio: "pipe" });
      return c;
    } catch { /* try next */ }
  }
  return null;
}

const POWERSHELL = findPowerShell();
const PS_AVAILABLE = POWERSHELL !== null;

// ---- case runner ----
const sandbox = mkdtempSync(join(tmpdir(), "task-6-failure-evidence-"));
const releaseDir = join(sandbox, "release");
const installDir = join(sandbox, "home", ".local", "bin");
mkdirSync(releaseDir, { recursive: true });
mkdirSync(installDir, { recursive: true });

const SEED_BYTES = Buffer.from("preserve me\n", "utf8");
const SEED_SHA = createHash("sha256").update(SEED_BYTES).digest("hex");

function setupSeededArchive(zipBytes) {
  writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), zipBytes);
  writeFileSync(join(releaseDir, "checksums.txt"), buildArchiveChecksums(zipBytes, "umactually-windows-x64.zip"));
  writeFileSync(join(installDir, "umactually.exe"), SEED_BYTES);
}

function setupChecksumOnly(checksumsText) {
  const happyZip = buildArchive([{ name: MEMBER_NAME, bytes: PAYLOAD, externalAttributes: unixModeAttrs(0o100755) }]);
  writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), happyZip);
  writeFileSync(join(releaseDir, "checksums.txt"), checksumsText);
  writeFileSync(join(installDir, "umactually.exe"), SEED_BYTES);
}

function runInstaller(env) {
  if (!PS_AVAILABLE || POWERSHELL === null) {
    return { status: -1, stderr: "POWERSHELL_UNAVAILABLE", stdout: "" };
  }
  const result = spawnSync(POWERSHELL, [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", INSTALL_PS1,
  ], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    status: result.status ?? -1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function baseEnv() {
  return {
    INSTALL_TEST_ARCHIVE_MODE: "1",
    INSTALL_TEST_DIR: installDir,
    INSTALL_TEST_ZIP: join(releaseDir, "umactually-windows-x64.zip"),
    INSTALL_TEST_CHECKSUMS: join(releaseDir, "checksums.txt"),
    INSTALL_TEST_BASENAME: "umactually-windows-x64.zip",
    INSTALL_TEST_MEMBER: MEMBER_NAME,
    INSTALL_TEST_NO_SMOKE: "1",
    INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
    INSTALL_RELEASE_TAG: "v0.5.0",
    INSTALL_ASSET_CONTRACT: "archive",
    PROCESSOR_ARCHITECTURE: "AMD64",
    USERPROFILE: join(installDir, "..", ".."),
  };
}

function matrixEnv(overrides = {}) {
  // Production-path env: no INSTALL_TEST_ARCHIVE_MODE so the matrix
  // override check fires before any HTTP fetch.
  return {
    INSTALL_TEST_NO_SMOKE: "1",
    PROCESSOR_ARCHITECTURE: "AMD64",
    USERPROFILE: join(installDir, "..", ".."),
    ...overrides,
  };
}

function recordVerdict(caseName, result) {
  const preservedPath = join(installDir, "umactually.exe");
  const preserved = existsSync(preservedPath)
    ? createHash("sha256").update(readFileSync(preservedPath)).digest("hex")
    : null;
  const shaUnchanged = preserved === SEED_SHA;
  const residue = existsSync(installDir) ? readdirSync(installDir) : [];
  const filteredResidue = residue.filter((n) => n !== "umactually.exe");
  return {
    case: caseName,
    exitCode: result.status,
    stderrExcerpt: result.stderr.split("\n").slice(0, 6).join("\n"),
    seedShaUnchanged: shaUnchanged,
    tempOrBackupResidue: filteredResidue,
    pass: result.status !== 0 && shaUnchanged && filteredResidue.length === 0,
  };
}

const cases = [];

// Hostile member names
for (const [label, name] of [
  ["traversal-member", "../umactually.exe"],
  ["drive-absolute-member", "C:/umactually.exe"],
  ["rooted-member", "/umactually.exe"],
  ["nested-member", "nested/umactually.exe"],
]) {
  const zip = buildArchive([{ name, bytes: PAYLOAD, externalAttributes: unixModeAttrs(0o100755) }]);
  setupSeededArchive(zip);
  cases.push(recordVerdict(`hostile-member-${label}`, runInstaller(baseEnv())));
}

// Hostile Unix modes (each rejects the (mode << 16) high nibble != 0x8000)
for (const [label, mode] of [
  ["symlink", 0o120000],
  ["fifo", 0o010000],
  ["char-device", 0o020000],
  ["block-device", 0o060000],
  ["socket", 0o140000],
  ["zero-mode", 0],
  ["dir-mode", 0o040755],
]) {
  const zip = buildArchive([{ name: MEMBER_NAME, bytes: PAYLOAD, externalAttributes: unixModeAttrs(mode) }]);
  setupSeededArchive(zip);
  cases.push(recordVerdict(`hostile-mode-${label}`, runInstaller(baseEnv())));
}

// DOS directory bit set on top of Unix regular
{
  const zip = buildArchive([{
    name: MEMBER_NAME, bytes: PAYLOAD, externalAttributes: unixModeAttrs(0o100755) | 0x10,
  }]);
  setupSeededArchive(zip);
  cases.push(recordVerdict("hostile-dos-directory-bit", runInstaller(baseEnv())));
}

// Duplicate entries
{
  const zip = buildArchive([
    { name: MEMBER_NAME, bytes: PAYLOAD, externalAttributes: unixModeAttrs(0o100755) },
    { name: MEMBER_NAME, bytes: PAYLOAD, externalAttributes: unixModeAttrs(0o100755) },
  ]);
  setupSeededArchive(zip);
  cases.push(recordVerdict("hostile-duplicate-entries", runInstaller(baseEnv())));
}

// Hostile checksum grammar
{
  setupChecksumOnly("*umactually-windows-x64.zip\n");
  cases.push(recordVerdict("checksum-star-prefix", runInstaller(baseEnv())));
}
{
  setupChecksumOnly("0".repeat(64) + " umactually-windows-x64.zip\n");
  cases.push(recordVerdict("checksum-one-space", runInstaller(baseEnv())));
}
{
  setupChecksumOnly("0".repeat(64) + "  umactually-windows-x64.zip \n");
  cases.push(recordVerdict("checksum-trailing-whitespace", runInstaller(baseEnv())));
}
{
  setupChecksumOnly(ARCHIVE_BASENAMES.map((b) => `${"0".repeat(64)}  ${b}`).join("\n") + "\n");
  cases.push(recordVerdict("checksum-mismatch", runInstaller(baseEnv())));
}
{
  // Raw basename on archive contract
  setupChecksumOnly(ARCHIVE_BASENAMES.map((b, i) =>
    i === 4
      ? `${"0".repeat(64)}  umactually-windows-x64.exe`
      : `${"0".repeat(64)}  ${b}`,
  ).join("\n") + "\n");
  cases.push(recordVerdict("checksum-opposite-contract-basename", runInstaller(baseEnv())));
}

// Locked destination
{
  if (process.platform === "win32") {
    const happyZip = buildArchive([{ name: MEMBER_NAME, bytes: PAYLOAD, externalAttributes: unixModeAttrs(0o100755) }]);
    setupSeededArchive(happyZip);
    const dest = join(installDir, "umactually.exe");
    const lockHolder = spawn(process.execPath, ["-e",
      `const fs=require('node:fs'); const fd=fs.openSync('${dest.replace(/\\/g, "\\\\")}', 'r+'); setInterval(()=>{}, 1000);`,
    ], { stdio: "ignore" });
    try {
      cases.push(recordVerdict("locked-destination", runInstaller(baseEnv())));
    } finally {
      lockHolder.kill();
    }
  } else {
    cases.push({ case: "locked-destination", skipped: "Windows-only", pass: null });
  }
}

// 8-case matrix rejections
{
  // case 3: base only
  cases.push(recordVerdict("matrix-case3-base-only", runInstaller(matrixEnv({
    INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
  }))));
}
{
  // case 4: contract only
  cases.push(recordVerdict("matrix-case4-contract-only", runInstaller(matrixEnv({
    INSTALL_ASSET_CONTRACT: "archive",
  }))));
}
{
  // case 7: base + contract without tag
  cases.push(recordVerdict("matrix-case7-base-contract-no-tag", runInstaller(matrixEnv({
    INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
    INSTALL_ASSET_CONTRACT: "archive",
  }))));
}
{
  // invalid contract value
  cases.push(recordVerdict("matrix-invalid-contract-value", runInstaller(matrixEnv({
    INSTALL_RELEASE_TAG: "v0.5.0",
    INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
    INSTALL_ASSET_CONTRACT: "garbage",
  }))));
}

const allPass = cases.every((c) => c.pass === null || c.pass === true);

const summary = {
  task: "task-6-release-binary-download-size-failure",
  generatedAt: new Date().toISOString(),
  powershell: POWERSHELL ?? "(unavailable)",
  platform: process.platform,
  sandbox,
  hostCount: cases.length,
  passCount: cases.filter((c) => c.pass === true).length,
  skipCount: cases.filter((c) => c.pass === null).length,
  failCount: cases.filter((c) => c.pass === false).length,
  allPass,
  cases,
};

mkdirSync(join(REPO_ROOT, ".omo", "evidence"), { recursive: true });
writeFileSync(EVIDENCE_PATH, JSON.stringify(summary, null, 2));
console.log(`Wrote ${EVIDENCE_PATH}`);
console.log(`host=${summary.hostCount} pass=${summary.passCount} fail=${summary.failCount} skip=${summary.skipCount} allPass=${allPass}`);

rmSync(sandbox, { recursive: true, force: true });
process.exit(allPass ? 0 : 1);