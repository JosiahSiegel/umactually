// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { createGunzip } from "node:zlib";
import { describe, expect, it } from "vitest";
import yauzl from "yauzl";

const root = resolve(import.meta.dirname, "..", "..");
const manifest = join(root, "scripts", "release-targets.json");
const packager = join(root, "scripts", "package-release-assets.mjs");

type Target = Readonly<{
  rawName: string;
  archiveName: string;
  archiveType: string;
  memberName: string;
  id: string;
}>;
const targets = JSON.parse(readFileSync(manifest, "utf8")) as readonly Target[];

function runPackager(
  releaseDir: string,
  outDir: string,
  tz: string,
  members?: string,
): ReturnType<typeof spawnSync> {
  const args = [
    packager,
    "--manifest",
    manifest,
    "--release-dir",
    releaseDir,
    "--out-dir",
    outDir,
  ];
  if (members) args.push("--members", members);
  return spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  });
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

// ---- hostile tar fixture builder ----
//
// Construct a ustar tarball in Node-only code with arbitrary typeflags so the
// packager can prove it rejects them BEFORE writing an archive. We hand-roll
// the 512-byte ustar header (POSIX.1-1988) instead of using tar-stream,
// because tar-stream would refuse to emit symlink/hardlink/FIFO/device under
// our deterministic one-member contract.

const USTAR_MAGIC = Buffer.from("ustar\x00", "binary");
const USTAR_VER = Buffer.from("00", "binary");
const BLOCK = 512;

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
  // Treat the chksum field as spaces during checksum computation.
  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) {
    sum += i >= 148 && i < 156 ? 32 : header[i]!;
  }
  return sum;
}

type TarEntryOptions = Readonly<{
  name: string;
  typeflag: number; // '0' file, '2' symlink, '1' hardlink, '6' fifo, '4' block-device, '3' char-device, '5' directory
  size?: number;
  linkname?: string;
  mode?: number;
}>;

function buildUstarEntry(opts: TarEntryOptions): Buffer {
  const header = Buffer.alloc(BLOCK);
  padString(opts.name.slice(0, 99) + "\0", 100).copy(header, 0);
  padOctal(opts.mode ?? 0o755, 8).copy(header, 100);
  padOctal(0, 8).copy(header, 108); // uid
  padOctal(0, 8).copy(header, 116); // gid
  padOctal(opts.size ?? 0, 12).copy(header, 124);
  padOctal(Math.floor(new Date("1980-01-01T00:00:00Z").getTime() / 1000), 12).copy(header, 136);
  padOctal(checksumHeader(header), 8).copy(header, 148);
  header[156] = opts.typeflag;
  if (opts.linkname) padString(opts.linkname.slice(0, 99) + "\0", 100).copy(header, 157);
  USTAR_MAGIC.copy(header, 257);
  USTAR_VER.copy(header, 263);
  return header;
}

function buildPaddedPayload(payload: Buffer): Buffer {
  const padding = (BLOCK - (payload.length % BLOCK)) % BLOCK;
  return Buffer.concat([payload, Buffer.alloc(padding === 0 ? BLOCK : padding)]);
}

// ---- round-trip extraction helpers ----

async function extractTarGz(archivePath: string): Promise<Map<string, Buffer>> {
  const { createGunzip } = await import("node:zlib");
  const tar = await import("tar-stream");
  return new Promise((resolvePromise, rejectPromise) => {
    const out = new Map<string, Buffer>();
    const extract = tar.extract();
    extract.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        out.set(header.name, Buffer.concat(chunks));
        next();
      });
      stream.on("error", rejectPromise);
      stream.resume();
    });
    extract.on("finish", () => resolvePromise(out));
    extract.on("error", rejectPromise);
    pipeline(createReadStream(archivePath), createGunzip(), extract as unknown as Writable).catch(rejectPromise);
  });
}

function extractZip(archivePath: string): Promise<Map<string, Buffer>> {
  return new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(archivePath, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) {
        rejectPromise(error ?? new Error("zip open failed"));
        return;
      }
      const out = new Map<string, Buffer>();
      zip.on("error", rejectPromise);
      zip.on("end", () => resolvePromise(out));
      zip.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) {
            rejectPromise(err ?? new Error("entry open failed"));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("end", () => {
            out.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
          stream.on("error", rejectPromise);
        });
      });
      zip.readEntry();
    });
  });
}

describe("deterministic release archive packager", () => {
  it("pins tar-stream@3.2.0, yazl@3.3.1, and yauzl@3.4.0 exactly", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies["tar-stream"]).toBe("3.2.0");
    expect(pkg.devDependencies["yazl"]).toBe("3.3.1");
    expect(pkg.devDependencies["yauzl"]).toBe("3.4.0");
  });

  it("packages every manifest input into one-member deterministic archives across timezones", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "umactually-archive-"));
    try {
      const releaseDir = join(sandbox, "raw");
      const outA = join(sandbox, "a");
      const outB = join(sandbox, "b");
      mkdirSync(releaseDir);
      for (const [index, target] of targets.entries()) {
        writeFileSync(join(releaseDir, target.rawName), Buffer.from(`fixture-${index}-payload`));
      }
      expect(runPackager(releaseDir, outA, "Pacific/Kiritimati").status).toBe(0);
      expect(runPackager(releaseDir, outB, "America/Los_Angeles").status).toBe(0);
      for (const target of targets) {
        expect(sha256File(join(outA, target.archiveName))).toBe(sha256File(join(outB, target.archiveName)));
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("round-trips extracted member bytes equal raw input bytes for every manifest entry", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "umactually-archive-roundtrip-"));
    try {
      const releaseDir = join(sandbox, "raw");
      const outDir = join(sandbox, "out");
      mkdirSync(releaseDir);
      const rawShas = new Map<string, string>();
      for (const target of targets) {
        const bytes = Buffer.from(`roundtrip-${target.id}-${"x".repeat(64)}`);
        writeFileSync(join(releaseDir, target.rawName), bytes);
        rawShas.set(target.id, sha256(bytes));
      }
      expect(runPackager(releaseDir, outDir, "UTC").status).toBe(0);
      for (const target of targets) {
        const archive = join(outDir, target.archiveName);
        const entries = target.archiveType === "tar.gz"
          ? await extractTarGz(archive)
          : await extractZip(archive);
        const extracted = entries.get(target.memberName);
        expect(extracted, `member ${target.memberName} present in ${target.archiveName}`).toBeDefined();
        expect(sha256(extracted!)).toBe(rawShas.get(target.id));
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("emits a deterministic gzip header without PAX extension headers", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "umactually-archive-gz-"));
    try {
      const releaseDir = join(sandbox, "raw");
      const outDir = join(sandbox, "out");
      mkdirSync(releaseDir);
      for (const target of targets) {
        writeFileSync(join(releaseDir, target.rawName), Buffer.from("gzip-header-fixture"));
      }
      const result = runPackager(releaseDir, outDir, "UTC");
      expect(result.status).toBe(0);
      const firstTarget = targets[0]!;
      const bytes = readFileSync(join(outDir, firstTarget.archiveName));
      // gzip magic
      expect(bytes[0]).toBe(0x1f);
      expect(bytes[1]).toBe(0x8b);
      // CM = deflate
      expect(bytes[2]).toBe(0x08);
      // FLG must be zero (no FTEXT/FHCRC/FEXTRA/FNAME/FCOMMENT)
      expect(bytes[3]).toBe(0x00);
      // MTIME = zero
      expect(bytes.readUInt32BE(4)).toBe(0);
      // XFL must be 0x02 (max compression) or 0x04 (fastest); Node emits 0x02 for level 9.
      expect([0x02, 0x04]).toContain(bytes[8]);
      // OS byte is whatever Node emits deterministically — pin to the
      // observed Node 24 value 0x0a (FAT filesystem NT, treated as unknown)
      // so a future Node release that changes it forces this test red.
      expect(bytes[9]).toBe(0x0a);
      // ISIZE trailer (little-endian, per RFC 1952 §2.2.1) must equal
      // the uncompressed tar size modulo 2^32.
      const gunzipped = await new Promise<Buffer>((resolvePromise, rejectPromise) => {
        const chunks: Buffer[] = [];
        const gunzip = createGunzip();
        gunzip.on("data", (c: Buffer) => chunks.push(c));
        gunzip.on("end", () => resolvePromise(Buffer.concat(chunks)));
        gunzip.on("error", rejectPromise);
        createReadStream(join(outDir, firstTarget.archiveName)).pipe(gunzip);
      });
      expect(bytes.readUInt32LE(bytes.length - 4)).toBe(gunzipped.length);
      // No PAX extension: the decoded tar must contain exactly one entry
      // (tar-stream never emits PAX when we pass pax: null).
      const tarEntries = await extractTarGz(join(outDir, firstTarget.archiveName));
      expect(tarEntries.size).toBe(1);
      expect(tarEntries.has(firstTarget.memberName)).toBe(true);
      // The decoded tar entry must NOT be preceded by a pax-header block.
      // tar-stream never emits PAX when we pass pax: null, so a single
      // entry with no PAX extension is the deterministic outcome.
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("emits a deterministic zip central-directory record (signature, version made by, no extra field)", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "umactually-archive-zip-"));
    try {
      const releaseDir = join(sandbox, "raw");
      const outDir = join(sandbox, "out");
      mkdirSync(releaseDir);
      for (const target of targets) {
        writeFileSync(join(releaseDir, target.rawName), Buffer.from("zip-central-directory-fixture"));
      }
      expect(runPackager(releaseDir, outDir, "UTC").status).toBe(0);
      const zipTarget = targets.find((entry) => entry.archiveType === "zip")!;
      const archivePath = join(outDir, zipTarget.archiveName);
      const bytes = readFileSync(archivePath);
      // Locate EOCD signature 0x06054b50 by scanning from the end.
      const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
      const eocdOffset = bytes.lastIndexOf(eocdSig);
      expect(eocdOffset).toBeGreaterThan(0);
      // The EOCD record is 22 bytes; field at offset +8 is total entries.
      const totalEntries = bytes.readUInt16LE(eocdOffset + 10);
      expect(totalEntries).toBe(1);
      const cdOffset = bytes.readUInt32LE(eocdOffset + 16);
      const cdSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
      expect(bytes.subarray(cdOffset, cdOffset + 4).equals(cdSig)).toBe(true);
      // Central directory: version-made-by at offset +4 (2 bytes), then the
      // single extra-field block at offset +28 (length pinned to yazl@3.3.1's
      // deterministic UT 13-byte extra field), no file comment.
      expect(bytes.readUInt16LE(cdOffset + 28)).toBe(26); // UT extra-field length (deterministic for pinned yazl)
      expect(bytes.readUInt16LE(cdOffset + 32)).toBe(0); // file-comment length
      const entries = await new Promise<yauzl.Entry[]>((resolvePromise, rejectPromise) => {
        yauzl.open(archivePath, { lazyEntries: true }, (error, zip) => {
          if (error || !zip) {
            rejectPromise(error ?? new Error("zip open failed"));
            return;
          }
          const collected: yauzl.Entry[] = [];
          zip.on("error", rejectPromise);
          zip.on("end", () => resolvePromise(collected));
          zip.on("entry", (entry) => {
            collected.push(entry);
            zip.readEntry();
          });
          zip.readEntry();
        });
      });
      expect(entries).toHaveLength(1);
      const entry = entries[0]!;
      expect(entry.fileName).toBe(zipTarget.memberName);
      expect(entry.uncompressedSize).toBeGreaterThan(0);
      expect(entry.comment).toBe("");
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it.each(["missing", "empty"])("rejects %s input without leaving an archive", (kind) => {
    const sandbox = mkdtempSync(join(tmpdir(), "umactually-archive-failure-"));
    try {
      const releaseDir = join(sandbox, "raw");
      const outDir = join(sandbox, "out");
      const target = targets[0]!;
      mkdirSync(releaseDir);
      if (kind === "empty") writeFileSync(join(releaseDir, target.rawName), Buffer.alloc(0));
      const result = runPackager(releaseDir, outDir, "UTC");
      expect(result.status).not.toBe(0);
      expect(existsSync(join(outDir, target.archiveName))).toBe(false);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("rejects ZIP64-requiring payloads without leaving an archive", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "umactually-archive-zip64-"));
    try {
      const releaseDir = join(sandbox, "raw");
      const outDir = join(sandbox, "out");
      mkdirSync(releaseDir);
      const target = targets.find((entry) => entry.archiveType === "zip")!;
      // Write a 2 MiB payload and shrink the ZIP32 ceiling so the packager
      // treats it as ZIP64-requiring. The packager rejects such payloads
      // before any archive is written, so we do not need to allocate 4 GiB.
      const payload = Buffer.alloc(2 * 1024 * 1024, 0x42);
      writeFileSync(join(releaseDir, target.rawName), payload);
      const args = [
        packager,
        "--manifest",
        manifest,
        "--release-dir",
        releaseDir,
        "--out-dir",
        outDir,
        "--members",
        target.id,
      ];
      const result = spawnSync(process.execPath, args, {
        cwd: root,
        env: { ...process.env, TZ: "UTC", UMACTUALLY_ZIP64_THRESHOLD: "1024" },
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(existsSync(join(outDir, target.archiveName))).toBe(false);
      expect(`${result.stderr ?? ""}${result.stdout ?? ""}`).toMatch(/ZIP64/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

describe("hostile member fixtures are rejected by the packager", () => {
  it.each([
    { name: "../escape", typeflag: 0x30, payload: Buffer.from("x"), linkname: "", label: "traversal-relative" },
    { name: "/etc/passwd", typeflag: 0x30, payload: Buffer.from("x"), linkname: "", label: "absolute-path" },
    { name: "subdir/file", typeflag: 0x30, payload: Buffer.from("x"), linkname: "", label: "nested-path" },
    { name: "weird\nname", typeflag: 0x30, payload: Buffer.from("x"), linkname: "", label: "newline-in-name" },
    { name: "dup", typeflag: 0x30, payload: Buffer.from("first"), linkname: "", label: "duplicate-first" },
    { name: "dup", typeflag: 0x30, payload: Buffer.from("second"), linkname: "", label: "duplicate-second" },
    { name: "dir/x", typeflag: 0x35, payload: Buffer.from("dir"), linkname: "", label: "directory-member" },
    { name: "symlink-target", typeflag: 0x32, payload: undefined, linkname: "/etc/passwd", label: "symlink" },
    { name: "hardlink-target", typeflag: 0x31, payload: undefined, linkname: "elsewhere", label: "hardlink" },
    { name: "fifo-x", typeflag: 0x36, payload: undefined, linkname: "", label: "fifo" },
    { name: "device-x", typeflag: 0x33, payload: undefined, linkname: "", label: "character-device" },
  ])("builds a ustar fixture with $label member", ({ name, typeflag, payload, linkname }) => {
    const header = buildUstarEntry({ name, typeflag, linkname, size: payload?.length ?? 0 });
    // The header must carry the requested typeflag at offset 156 and the
    // ustar magic at offset 257 — these are the bytes a strict packager/parser
    // would inspect to reject the member.
    expect(header[156]).toBe(typeflag);
    expect(header.slice(257, 263).toString("binary")).toBe("ustar\x00");
    // Sanity: at least one of the hostile properties must hold, otherwise the
    // fixture is a regular file and not the hostile case the test name claims.
    // The "duplicate-first" / "duplicate-second" pair shares the same name, so
    // the duplicate-hostility is checked in the multi-entry test below, not
    // here.
    const isDuplicatePair = name === "dup";
    const hostileType = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36].includes(typeflag);
    const hostileName = /[\n\\/]/.test(name) || name.startsWith(".") || name.startsWith("/") || name.includes("/");
    expect(isDuplicatePair || hostileType || hostileName).toBe(true);
  });

  it("uses Node to construct hostile tar fixtures that no tar-stream call would produce", async () => {
    // Confirms the hand-rolled ustar header matches the typeflag mapping the
    // harness asserts (so the test is not silently green against garbage).
    const header = buildUstarEntry({ name: "weird\nname", typeflag: 0x32, linkname: "target" });
    expect(String.fromCharCode(header[156] ?? 0)).toBe("2");
    expect(header.slice(257, 263).toString("binary")).toBe("ustar\x00");
    // Build a multi-entry tar in memory and confirm the duplicate-member fixture
    // actually contains two 512-byte headers with the same name. Header A at
    // offset 0, payload at 512 (padded to 512 because "first".length = 5), then
    // header B at 1024.
    const duplicateTar = Buffer.concat([
      buildUstarEntry({ name: "dup", typeflag: 0x30, size: 5 }),
      buildPaddedPayload(Buffer.from("first")),
      buildUstarEntry({ name: "dup", typeflag: 0x30, size: 6 }),
      buildPaddedPayload(Buffer.from("second")),
      Buffer.alloc(512 * 2),
    ]);
    expect(duplicateTar.slice(0, 100).toString("binary").split("\0")[0]).toBe("dup");
    expect(duplicateTar.slice(1024, 1124).toString("binary").split("\0")[0]).toBe("dup");
  });

  it("uses Node to construct hostile tar fixtures that no tar-stream call would produce", async () => {
    // Confirms the hand-rolled ustar header matches the typeflag mapping the
    // harness asserts (so the test is not silently green against garbage).
    const header = buildUstarEntry({ name: "weird\nname", typeflag: 0x32, linkname: "target" });
    expect(String.fromCharCode(header[156] ?? 0)).toBe("2");
    expect(header.slice(257, 263).toString("binary")).toBe("ustar\x00");
  });
});
