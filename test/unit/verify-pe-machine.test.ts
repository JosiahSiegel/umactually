// SPDX-License-Identifier: MIT
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyPeMachine } from "../../src/util/verify-pe-machine.js";

/**
 * Build a minimal valid PE file with the requested COFF Machine value.
 * Layout: MZ header (64 bytes) → e_lfanew → PE\0\0 → COFF File Header (20 bytes).
 */
function buildPe(machine: number, opts: { mz?: boolean; peSig?: boolean; eLfanew?: number; truncate?: number } = {}): Buffer {
  const size = 0x100;
  const buf = Buffer.alloc(size);
  if (opts.mz !== false) {
    buf[0] = 0x4d;
    buf[1] = 0x5a;
  }
  const eLfanew = opts.eLfanew ?? 0x78;
  buf.writeUInt32LE(eLfanew, 0x3c);
  if (opts.peSig !== false) {
    buf[eLfanew] = 0x50; // P
    buf[eLfanew + 1] = 0x45; // E
    buf[eLfanew + 2] = 0x00;
    buf[eLfanew + 3] = 0x00;
  }
  buf.writeUInt16LE(machine, eLfanew + 4);
  if (opts.truncate !== undefined) {
    return buf.subarray(0, opts.truncate);
  }
  return buf;
}

describe("verifyPeMachine", () => {
  let directory = "";

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "verify-pe-machine-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function writeFixture(name: string, data: Buffer): string {
    const path = join(directory, name);
    writeFileSync(path, data);
    return path;
  }

  it("detects AMD64 (0x8664)", () => {
    const path = writeFixture("amd64.exe", buildPe(0x8664));
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toBe("AMD64");
      expect(result.machine).toBe(0x8664);
    }
  });

  it("detects ARM64 (0xaa64)", () => {
    const path = writeFixture("arm64.exe", buildPe(0xaa64));
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toBe("ARM64");
      expect(result.machine).toBe(0xaa64);
    }
  });

  it("rejects bad MZ signature", () => {
    const path = writeFixture("bad-mz.exe", buildPe(0x8664, { mz: false }));
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad-mz-signature");
    }
  });

  it("rejects truncated file (e_lfanew offset past EOF)", () => {
    const path = writeFixture("truncated.exe", buildPe(0x8664, { truncate: 0x10 }));
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("file-too-short");
    }
  });

  it("rejects bad e_lfanew (negative)", () => {
    // MZ-only, no PE — e_lfanew stays 0
    const path = writeFixture("bad-elfanew.exe", buildPe(0x8664, { eLfanew: 0x10 }));
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad-e_lfanew");
    }
  });

  it("rejects missing PE signature", () => {
    const path = writeFixture("no-pe.exe", buildPe(0x8664, { peSig: false }));
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("pe-signature-missing");
    }
  });

  it("rejects unknown machine code", () => {
    const path = writeFixture("weird.exe", buildPe(0xabcd));
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unknown-machine");
    }
  });

  it("returns file-too-short on non-existent file (treated as unreadable)", () => {
    const result = verifyPeMachine(join(directory, "missing.exe"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("file-too-short");
    }
  });

  it("catches the v0.6.13 release defect: amd64 bytes inside an arm64 wrapper", () => {
    // Real-world case: umactually-windows-arm64.zip contained a binary with
    // PE Machine = 0x8664 (AMD64), not 0xAA64 (ARM64). This is the assertion
    // that, if it had existed, would have prevented the release.
    const arm64WrapperWithAmd64Bytes = buildPe(0x8664);
    const path = writeFixture("arm64-mislabeled.exe", arm64WrapperWithAmd64Bytes);
    const result = verifyPeMachine(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The verifier must surface the AMD64 result so a higher-level gate can
      // detect the mismatch between the declared target (arm64) and the bytes (amd64).
      expect(result.label).toBe("AMD64");
    }
  });
});
