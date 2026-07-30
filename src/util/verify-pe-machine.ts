// SPDX-License-Identifier: MIT
// Typed Node verifier for Windows PE binary architecture.
//
// Background: v0.6.0–v0.6.13 (and possibly later) shipped a Windows ARM64
// archive that contained a Windows x86_64 binary mislabeled as ARM64. The
// release workflow's structural check only verified the MZ header, never
// the COFF Machine field, so the mislabeling slipped through.
//
// This module:
//   - reads e_lfanew from offset 0x3c
//   - bounds-checks the offset against file size
//   - verifies the PE signature (PE\0\0)
//   - reads the Machine field after the signature
//   - returns a discriminated union so callers can fail-closed on mismatch

import { readFileSync } from "node:fs";

export type PeMachine =
  | { readonly ok: true; readonly machine: number; readonly label: "AMD64" | "ARM64" }
  | {
      readonly ok: false;
      readonly reason:
        | "cannot-read"
        | "file-too-short"
        | "bad-mz-signature"
        | "bad-e_lfanew"
        | "pe-signature-missing"
        | "pe-header-truncated"
        | "unknown-machine";
      readonly detail: string;
    };

const MACHINE_AMD64 = 0x8664;
const MACHINE_ARM64 = 0xaa64;
const MIN_SIZE = 0x40; // need at least 0x3c bytes for e_lfanew + a little
const PE_SIG_OFFSET = 0x3c;
const PE_SIG = Buffer.from([0x50, 0x45, 0x00, 0x00]); // "PE\0\0"

export function verifyPeMachine(path: string): PeMachine {
  let data: Buffer;
  try {
    data = readFileSync(path);
  } catch (err) {
    return {
      ok: false,
      reason: "cannot-read",
      detail: `cannot read file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (data.length < MIN_SIZE) {
    return {
      ok: false,
      reason: "file-too-short",
      detail: `file is ${data.length} bytes; need at least ${MIN_SIZE}`,
    };
  }

  if (data[0] !== 0x4d || data[1] !== 0x5a) {
    return {
      ok: false,
      reason: "bad-mz-signature",
      detail: `expected MZ at offset 0; got 0x${data[0]?.toString(16) ?? "??"} 0x${data[1]?.toString(16) ?? "??"}`,
    };
  }

  const e_lfanew = data.readUInt32LE(PE_SIG_OFFSET);
  if (e_lfanew < 0x40 || e_lfanew + 24 > data.length) {
    return {
      ok: false,
      reason: "bad-e_lfanew",
      detail: `e_lfanew=0x${e_lfanew.toString(16)} but file is ${data.length} bytes`,
    };
  }

  if (!data.subarray(e_lfanew, e_lfanew + 4).equals(PE_SIG)) {
    return {
      ok: false,
      reason: "pe-signature-missing",
      detail: `expected PE\\0\\0 at offset 0x${e_lfanew.toString(16)}`,
    };
  }

  // The PE signature ("PE\0\0") sits at offset e_lfanew (4 bytes);
  // the COFF File Header immediately follows at e_lfanew + 4. Machine
  // is the FIRST 2-byte field of the COFF File Header.
  const machineOffset = e_lfanew + 4;
  if (machineOffset + 2 > data.length) {
    return {
      ok: false,
      reason: "pe-header-truncated",
      detail: `machine field at 0x${machineOffset.toString(16)} but file is only ${data.length} bytes`,
    };
  }

  const machine = data.readUInt16LE(machineOffset);
  if (machine === MACHINE_AMD64) {
    return { ok: true, machine, label: "AMD64" };
  }
  if (machine === MACHINE_ARM64) {
    return { ok: true, machine, label: "ARM64" };
  }
  return {
    ok: false,
    reason: "unknown-machine",
    detail: `Machine=0x${machine.toString(16)} (not AMD64=0x8664 or ARM64=0xaa64)`,
  };
}
