// SPDX-License-Identifier: MIT
// TypeScript interface for scripts/verify-release-assets.mjs output.
//
// The verifier writes `release-size-report.json` with the schema below.
// This declaration is the single source of truth for the JSON shape
// emitted by the verifier and consumed by:
//   - test/unit/release-assets.test.ts (contract assertions)
//   - future consumers: Todo 8 budget computation, Todo 9 release
//     workflow gate, Todo 11 documentation rendering.
//
// Node 24 strips TypeScript types from .ts files at import time, so
// this file is consumed by the test harness's tsconfig include path
// without any build step.

export type SizeReportLimits = {
  /** archiveBytes/rawBytes ceiling — currently 0.5 (50%). */
  readonly maxRatio: 0.5;
  /** Per-archive byte ceiling — currently 50 MiB (52,428,800 bytes). */
  readonly maxArchiveBytes: 52428800;
};

export type SizeReportPackagingVersion = {
  readonly schema: 1;
  readonly node: string;
  readonly zlib: string;
  readonly tarStream: "3.2.0";
  readonly yazl: "3.3.1";
  readonly yauzl: "3.4.0";
};

export type SizeReportTarget = {
  readonly id: string;
  readonly rawName: string;
  readonly archiveName: string;
  readonly rawBytes: number;
  readonly archiveBytes: number;
  /** archiveBytes/rawBytes, rounded to ≤ 2 decimals. */
  readonly ratio: number;
  /** Lowercase hex SHA-256 of the archive file bytes. */
  readonly sha256: string;
};

export type SizeReport = {
  readonly schemaVersion: 1;
  /** Bun version recorded in the runtime env, or empty string. */
  readonly bunVersion: string;
  readonly packagingVersion: SizeReportPackagingVersion;
  readonly targets: ReadonlyArray<SizeReportTarget>;
  readonly limits: SizeReportLimits;
};