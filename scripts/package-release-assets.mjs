#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import yazl from "yazl";
import { parseReleaseTargets } from "./release-targets.ts";
import tar from "tar-stream";

const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");

const ZIP64_THRESHOLD = process.env.UMACTUALLY_ZIP64_THRESHOLD
  ? Number.parseInt(process.env.UMACTUALLY_ZIP64_THRESHOLD, 10)
  : 0xffffffff;
const ZIP_MAX_MEMBER_NAME = 0xff;

function args(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag?.startsWith("--")) throw new Error(`unexpected argument ${flag ?? ""}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${flag}`);
    options[flag.slice(2)] = value;
    index += 1;
  }
  return options;
}

function assertSafeMember(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(`unsafe archive member name: ${JSON.stringify(name)}`);
  }
  if (name.includes("\n") || name.includes("\r") || name.includes("\\") || name.includes("/")) {
    throw new Error(`unsafe archive member name (path separator or newline): ${JSON.stringify(name)}`);
  }
  if (name === "." || name === "..") {
    throw new Error(`unsafe archive member name (dot segment): ${JSON.stringify(name)}`);
  }
  if (/[\x00-\x1f\x7f]/.test(name)) {
    throw new Error(`unsafe archive member name (control character): ${JSON.stringify(name)}`);
  }
}

function atomicPath(output) {
  if (existsSync(output)) throw new Error(`destination already exists: ${output}`);
  mkdirSync(dirname(output), { recursive: true });
  return `${output}.tmp-${process.pid}`;
}

async function writeTar(output, member, bytes) {
  const temporary = atomicPath(output);
  const pack = tar.pack();
  const gzip = createGzip({ level: 9 });
  const stream = createWriteStream(temporary, { flags: "wx" });
  try {
    // Explicit `pax: null` keeps tar-stream in pure USTAR mode; no atime/ctime/mtime
    // extension headers are emitted, so the deterministic header byte assertion holds.
    pack.entry({
      name: member,
      type: "file",
      mode: 0o755,
      uid: 0,
      gid: 0,
      uname: "",
      gname: "",
      mtime: FIXED_MTIME,
      size: bytes.length,
      pax: null,
    }, bytes);
    pack.finalize();
    await pipeline(Readable.from(pack), gzip, stream);
    renameSync(temporary, output);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function assertZipFits(member, bytes) {
  if (member.length > ZIP_MAX_MEMBER_NAME) {
    throw new Error(`zip member name too long: ${member.length}`);
  }
  if (bytes.length > ZIP64_THRESHOLD) {
    throw new Error(`zip payload requires ZIP64 (size=${bytes.length})`);
  }
}

function writeZip(output, member, bytes) {
  assertZipFits(member, bytes);
  const temporary = atomicPath(output);
  const zip = new yazl.ZipFile();
  // No comment, no extra fields, mode 0100755, fixed DOS timestamp constructed
  // from local date components in every process so a UTC clock on any host
  // produces the same bytes.
  zip.addBuffer(bytes, member, {
    compress: true,
    compressionLevel: 9,
    forceDosTimestamp: true,
    mode: 0o100755,
    mtime: new Date(1980, 0, 1, 0, 0, 0),
  });
  zip.end();
  return new Promise((resolvePromise, reject) => {
    const stream = createWriteStream(temporary, { flags: "wx" });
    zip.outputStream.pipe(stream);
    stream.once("finish", () => {
      try {
        renameSync(temporary, output);
        resolvePromise();
      } catch (error) {
        rmSync(temporary, { force: true });
        reject(error);
      }
    });
    stream.once("error", (error) => {
      rmSync(temporary, { force: true });
      reject(error);
    });
  });
}

async function main() {
  const options = args(process.argv.slice(2));
  const manifestPath = resolve(options.manifest ?? "scripts/release-targets.json");
  const releaseDir = resolve(options["release-dir"] ?? "release");
  const outDir = resolve(options["out-dir"] ?? releaseDir);
  const targets = parseReleaseTargets({ manifestPath });
  const selector = options.members ? new RegExp(options.members) : undefined;
  const selected = selector ? targets.filter((target) => selector.test(target.id)) : targets;
  if (selected.length === 0) throw new Error("member selector matched no release targets");
  mkdirSync(outDir, { recursive: true });
  const checksums = [];
  for (const target of selected) {
    assertSafeMember(target.memberName);
    const input = join(releaseDir, target.rawName);
    if (!existsSync(input)) throw new Error(`missing raw input: ${input}`);
    const inputStat = statSync(input);
    if (!inputStat.isFile() || inputStat.size === 0) {
      throw new Error(`raw input must be a non-empty regular file: ${input}`);
    }
    const bytes = readFileSync(input);
    const output = join(outDir, target.archiveName);
    if (target.archiveType === "tar.gz") {
      await writeTar(output, target.memberName, bytes);
    } else if (target.archiveType === "zip") {
      await writeZip(output, target.memberName, bytes);
    } else {
      throw new Error(`unsupported archive type: ${target.archiveType}`);
    }
    // Compute SHA-256 of the just-written archive and record it in
    // the checksums list. The two-space separator is what
    // `sha256sum -c checksums.txt` expects (POSIX `cksum` format).
    const archiveBytes = readFileSync(output);
    const hash = createHash("sha256").update(archiveBytes).digest("hex");
    checksums.push({ name: target.archiveName, hash });
  }
  // Stable ordering: sort by filename so reruns produce the same
  // checksums.txt bytes regardless of the iteration order in
  // `selected`. This makes the file diffable across CI runs.
  checksums.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const checksumsPath = join(outDir, "checksums.txt");
  const checksumsBody = checksums.map((c) => `${c.hash}  ${c.name}\n`).join("");
  writeFileSync(checksumsPath, checksumsBody);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
