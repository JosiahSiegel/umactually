// SPDX-License-Identifier: MIT
//
// Task 4 — Durable finding fingerprint + identity contract (v1).
//
// This module owns the canonical v1 fingerprint algorithm, the
// length-prefixed UTF-8 serializer for the pre-hash canonical fields,
// and the hard FINGERPRINT_COLLISION check.
//
// The fingerprint is stable across line shifts (because raw line
// numbers are never inputs) and changes when category, anchor, path,
// or ruleKey change. Two findings with the same fingerprint and the
// same identityDigest dedup; the same fingerprint with a different
// identityDigest is a hard collision that short-circuits posting and
// writes no new state.

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input to the fingerprint computation. The caller supplies the raw
 * finding fields; this module normalizes them and computes the
 * canonical fingerprint + identity digests.
 *
 * Mutable full prose, secrets, absolute paths, tokens, and raw line
 * numbers are NEVER fingerprint inputs and therefore have no slot here.
 */
export type CanonicalFindingInput = {
  /** Repository-relative path (before normalization). */
  readonly path: string;
  /** Either "symbol" or "hunk". */
  readonly anchorKind: "symbol" | "hunk";
  /** For symbol anchors: the fully-qualified declaration name. */
  readonly symbolName: string | undefined;
  /** For symbol anchors: the declaration kind (function, class, ...). */
  readonly symbolKind: string | undefined;
  /**
   * For hunk anchors: the raw three-line preimage/context around the
   * cited added line. The module whitespace-normalizes it before hashing.
   */
  readonly hunkPreimage: string | undefined;
  /** Finding category (pre-normalization). */
  readonly category: string;
  /**
   * Provider-supplied stable rule id. When absent, a synthetic key is
   * derived from the category + normalized first sentence.
   */
  readonly ruleKey: string | undefined;
  /**
   * First sentence of the finding body, used ONLY when `ruleKey` is
   * absent to synthesize a deterministic rule key. The body is
   * normalized (numbers, paths, quoted identifiers, and whitespace
   * variance removed) before hashing.
   */
  readonly bodyFirstSentence: string | undefined;
  /**
   * Optional rename mapping from the parsed diff. When the old path
   * appears here, it is rewritten to the new path BEFORE hashing so
   * renamed files retain their finding identity.
   */
  readonly pathRewrites: readonly PathRewrite[] | undefined;
  /**
   * When true, the canonical path is case-folded to lowercase before
   * hashing. Default: false (case-sensitive). Only set true when the
   * repository/filesystem mode is explicitly detected as case-insensitive.
   */
  readonly caseInsensitive: boolean | undefined;
};

export type PathRewrite = {
  readonly from: string;
  readonly to: string;
};

/**
 * The computed durable identity for a finding. Stored alongside every
 * current and persisted open finding so dedup and collision detection
 * work across runs.
 */
export type DurableFindingIdentity = {
  readonly fingerprintVersion: 1;
  /** SHA-256 of the six-field null-joined canonical string. */
  readonly fingerprintDigest: string;
  /** SHA-256 of "umactually-identity-v1\0" + length-prefixed canonical fields. */
  readonly identityDigest: string;
  /** The five canonical pre-hash fields (post-normalization). */
  readonly canonicalPath: string;
  readonly anchorKind: "symbol" | "hunk";
  readonly canonicalAnchor: string;
  readonly normalizedCategory: string;
  readonly normalizedRuleKey: string;
};

/**
 * A finding entry for collision checking: the computed identity plus
 * the mutable body (so the error message can identify which findings
 * collided).
 */
export type FindingForCollisionCheck = {
  readonly identity: DurableFindingIdentity;
  readonly body: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FINGERPRINT_V1_PREFIX = "umactually-finding-v1";
const IDENTITY_V1_PREFIX = "umactually-identity-v1";

// ---------------------------------------------------------------------------
// Typed error: FingerprintCollisionError
// ---------------------------------------------------------------------------

/**
 * Hard failure raised when two findings share the same fingerprint
 * digest but have different identityDigests. This is a
 * FINGERPRINT_COLLISION: the semantic anchor collides but the
 * canonical fields differ, meaning the fingerprinting scheme cannot
 * distinguish the two findings.
 *
 * The caller MUST short-circuit: post nothing, resolve nothing, write
 * no new state.
 */
export class FingerprintCollisionError extends Error {
  readonly fingerprintDigest: string;
  readonly collisionType: "within-review" | "against-persisted-state";

  constructor(
    fingerprintDigest: string,
    collisionType: "within-review" | "against-persisted-state",
    detail?: string,
    options?: ErrorOptions,
  ) {
    super(
      `FINGERPRINT_COLLISION: fingerprint ${fingerprintDigest} maps to divergent identity digests${detail !== undefined ? ` (${detail})` : ""}. ` +
         "Posting, resolution, and state mutation are suppressed.",
       options,
     );
    this.name = "FingerprintCollisionError";
    this.fingerprintDigest = fingerprintDigest;
    this.collisionType = collisionType;
  }
}

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a path to its canonical form for fingerprinting:
 *   1. Replace backslashes with POSIX forward slashes.
 *   2. Strip a single leading `a/` or `b/` (diff prefix).
 *   3. Reject absolute paths (`/...` on Unix, `C:\...` / `C:/...` on Windows).
 *   4. Reject `.` and `..` path components.
 *   5. Case-fold to lowercase ONLY when `caseInsensitive` is true.
 *
 * Default is case-sensitive (no case-folding).
 */
export function normalizeCanonicalPath(
  rawPath: string,
  opts: { readonly caseInsensitive?: boolean | undefined } = {},
): string {
  let p = rawPath.replace(/\\/gu, "/");

  // Reject absolute paths before any other processing.
  if (p.startsWith("/") || /^[a-zA-Z]:\//u.test(p)) {
    throw new Error(
      `normalizeCanonicalPath: absolute paths are not allowed (got "${rawPath}")`,
    );
  }

  // Strip a single leading "a/" or "b/" diff prefix.
  if (p.startsWith("a/") || p.startsWith("b/")) {
    p = p.slice(2);
  }

  // Reject "." and ".." components.
  const segments = p.split("/");
  for (const seg of segments) {
    if (seg === "." || seg === "..") {
      throw new Error(
        `normalizeCanonicalPath: path traversal components ("." or "..") are not allowed (got "${rawPath}")`,
      );
    }
  }

  if (opts.caseInsensitive === true) {
    return p.toLowerCase();
  }
  return p;
}

// ---------------------------------------------------------------------------
// Category normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a category: lowercase, trim, collapse internal whitespace
 * and hyphens to a single underscore.
 */
export function normalizeCategory(rawCategory: string): string {
  return rawCategory
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, "_");
}

// ---------------------------------------------------------------------------
// Rule key normalization
// ---------------------------------------------------------------------------

/**
 * Normalize the rule key. Returns the provider-supplied stable rule id
 * when present. When absent, synthesizes a deterministic SHA-256 from
 * the lowercased category + the normalized first sentence (numbers,
 * paths, quoted identifiers, and whitespace variance removed).
 */
export function normalizeRuleKey(
  category: string,
  ruleKey: string | undefined,
  bodyFirstSentence: string | undefined,
): string {
  if (ruleKey !== undefined && ruleKey.length > 0) {
    return ruleKey;
  }

  // Synthesize: SHA-256 of lowercase(category) + normalizedFirstSentence
  const normalizedCategory = category.trim().toLowerCase();
  const normalizedSentence = normalizeFirstSentence(bodyFirstSentence ?? "");
  return createHash("sha256")
    .update(normalizedCategory + normalizedSentence)
    .digest("hex");
}

/**
 * Normalize the first sentence for synthetic rule key derivation:
 *   - Remove numbers (digit sequences).
 *   - Remove path-like tokens (contain `/` or start with `./`).
 *   - Remove quoted identifiers (single/double/backtick quoted).
 *   - Collapse whitespace variance to single spaces.
 */
function normalizeFirstSentence(raw: string): string {
  return raw
    // Take only the first sentence (up to first period followed by space/end).
    .replace(/\..*$/su, "")
    // Remove quoted identifiers: 'foo', "foo", `foo`
    .replace(/(['"`])[^'"`]*\1/gu, "")
    // Remove path-like tokens (anything containing a forward slash).
    .replace(/\b[\w.-]+\/[\w./-]+\b/gu, "")
    // Remove digit sequences.
    .replace(/\d+/gu, "")
    // Collapse whitespace.
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Hunk anchor normalization
// ---------------------------------------------------------------------------

/**
 * Compute the hunk anchor: SHA-256 of the whitespace-normalized
 * three-line preimage/context with line numbers removed.
 *
 * "Whitespace-normalized" means: collapse runs of whitespace to a
 * single space, trim each line, and join lines with `\n`. This makes
 * the anchor robust against indentation changes and trailing whitespace.
 */
export function computeHunkAnchor(hunkPreimage: string): string {
  const normalized = hunkPreimage
    .split("\n")
    .map((line) =>
      // Remove leading line-number prefixes (e.g. "42\t" or "42: ").
      line
        .replace(/^\d+[\t:]?\s*/u, "")
        .replace(/\s+/gu, " ")
        .trim(),
    )
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

// ---------------------------------------------------------------------------
// Length-prefixed UTF-8 serialization
// ---------------------------------------------------------------------------

/**
 * Serialize the five canonical pre-hash fields using length-prefixed
 * UTF-8: `uint32be byteLength || bytes` for each field, concatenated.
 *
 * NEVER use JSON.stringify for canonical fields — the field order and
 * encoding must be deterministic and independent of key insertion order.
 */
export function serializeCanonicalFields(
  fields: readonly [string, string, string, string, string],
): Uint8Array {
  const parts: Buffer[] = [];
  for (const field of fields) {
    const buf = Buffer.from(field, "utf8");
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(buf.length, 0);
    parts.push(len, buf);
  }
  return new Uint8Array(Buffer.concat(parts));
}

// ---------------------------------------------------------------------------
// Core: computeDurableFindingIdentity
// ---------------------------------------------------------------------------

/**
 * Compute the durable finding identity (fingerprint + identityDigest)
 * for a single finding input.
 *
 * Algorithm (v1):
 *   fingerprintDigest = sha256(
 *     "umactually-finding-v1\0"
 *     + canonicalPath + "\0"
 *     + anchorKind + "\0"
 *     + canonicalAnchor + "\0"
 *     + normalizedCategory + "\0"
 *     + normalizedRuleKey
 *   )
 *
 *   identityDigest = sha256(
 *     "umactually-identity-v1\0"
 *     + serializeCanonicalFields([
 *         canonicalPath, anchorKind, canonicalAnchor,
 *         normalizedCategory, normalizedRuleKey
 *       ])
 *   )
 *
 * The fingerprint uses simple null-joined fields; the identityDigest
 * uses length-prefixed serialization for collision-resistant identity.
 * Both are stable across line shifts because raw line numbers are
 * never inputs.
 */
export function computeDurableFindingIdentity(
  input: CanonicalFindingInput,
): DurableFindingIdentity {
  // 1. Canonical path (with rename mapping applied).
  let resolvedPath = input.path;
  if (input.pathRewrites !== undefined) {
    for (const rewrite of input.pathRewrites) {
      if (resolvedPath === rewrite.from) {
        resolvedPath = rewrite.to;
        break;
      }
    }
  }
  const canonicalPath = normalizeCanonicalPath(resolvedPath, {
    caseInsensitive: input.caseInsensitive,
  });

  // 2. Anchor.
  const anchorKind = input.anchorKind;
  let canonicalAnchor: string;
  if (anchorKind === "symbol") {
    const name = input.symbolName ?? "";
    const kind = input.symbolKind ?? "";
    canonicalAnchor = `${name}:${kind}`;
  } else {
    // hunk
    canonicalAnchor = computeHunkAnchor(input.hunkPreimage ?? "");
  }

  // 3. Category.
  const normalizedCategory = normalizeCategory(input.category);

  // 4. Rule key.
  const normalizedRuleKey = normalizeRuleKey(
    input.category,
    input.ruleKey,
    input.bodyFirstSentence,
  );

  // 5. Fingerprint digest (null-joined, prefixed).
  const fingerprintInput = [
    FINGERPRINT_V1_PREFIX,
    canonicalPath,
    anchorKind,
    canonicalAnchor,
    normalizedCategory,
    normalizedRuleKey,
  ].join("\0");
  const fingerprintDigest = createHash("sha256").update(fingerprintInput).digest("hex");

  // 6. Identity digest (length-prefixed serialization, prefixed).
  const serialized = serializeCanonicalFields([
    canonicalPath,
    anchorKind,
    canonicalAnchor,
    normalizedCategory,
    normalizedRuleKey,
  ]);
  const identityInput = Buffer.concat([
    Buffer.from(IDENTITY_V1_PREFIX + "\0", "utf8"),
    Buffer.from(serialized),
  ]);
  const identityDigest = createHash("sha256").update(identityInput).digest("hex");

  return {
    fingerprintVersion: 1,
    fingerprintDigest,
    identityDigest,
    canonicalPath,
    anchorKind,
    canonicalAnchor,
    normalizedCategory,
    normalizedRuleKey,
  };
}

// ---------------------------------------------------------------------------
// Collision check
// ---------------------------------------------------------------------------

/**
 * Assert that no fingerprint collision exists among the given findings,
 * optionally also checking against prior persisted state.
 *
 * A collision is: same fingerprintDigest + different identityDigest.
 * Same fingerprint + same identityDigest is a dedup (allowed).
 *
 * Throws FingerprintCollisionError on the first collision found.
 * The caller MUST short-circuit on throw: post nothing, resolve
 * nothing, write no new state.
 */
export function assertNoFingerprintCollision(
  current: readonly FindingForCollisionCheck[],
  persisted: readonly FindingForCollisionCheck[] = [],
): void {
  // Build a map: fingerprintDigest -> { identityDigest, body }
  const seen = new Map<
    string,
    { readonly identityDigest: string; readonly body: string; readonly source: string }
  >();

  // Check within current findings, and against persisted state.
  // Persisted state is checked first so we can report "against-persisted-state".
  for (const entry of persisted) {
    const fp = entry.identity.fingerprintDigest;
    const existing = seen.get(fp);
    if (existing !== undefined) {
      if (existing.identityDigest !== entry.identity.identityDigest) {
        throw new FingerprintCollisionError(
          fp,
          "against-persisted-state",
          `persisted "${existing.body.slice(0, 60)}" vs persisted "${entry.body.slice(0, 60)}"`,
        );
      }
    } else {
      seen.set(fp, {
        identityDigest: entry.identity.identityDigest,
        body: entry.body,
        source: "persisted",
      });
    }
  }

  for (const entry of current) {
    const fp = entry.identity.fingerprintDigest;
    const existing = seen.get(fp);
    if (existing !== undefined) {
      if (existing.identityDigest !== entry.identity.identityDigest) {
        const collisionType =
          existing.source === "persisted"
            ? "against-persisted-state"
            : "within-review";
        throw new FingerprintCollisionError(
          fp,
          collisionType,
          `"${existing.body.slice(0, 60)}" vs "${entry.body.slice(0, 60)}"`,
        );
      }
      // Same fingerprint + same identityDigest → dedup, allowed.
    } else {
      seen.set(fp, {
        identityDigest: entry.identity.identityDigest,
        body: entry.body,
        source: "current",
      });
    }
  }
}
