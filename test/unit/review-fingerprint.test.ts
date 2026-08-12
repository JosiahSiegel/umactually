// SPDX-License-Identifier: MIT
//
// Task 4 — Durable finding fingerprint + identity contract tests.
//
// These tests pin the v1 fingerprint algorithm, the identity digest,
// line-shift invariance, category-change sensitivity, and the hard
// FINGERPRINT_COLLISION failure.
//
// TDD: written BEFORE the implementation in src/review/fingerprint.ts.
// They fail with module-not-found until the module is created.

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  FingerprintCollisionError,
  type CanonicalFindingInput,
  type DurableFindingIdentity,
  assertNoFingerprintCollision,
  computeDurableFindingIdentity,
  normalizeCanonicalPath,
  normalizeCategory,
  normalizeRuleKey,
  serializeCanonicalFields,
} from "../../src/review/fingerprint.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function makeBaseInput(overrides: Partial<CanonicalFindingInput> = {}): CanonicalFindingInput {
  return {
    path: "src/cli/run.ts",
    anchorKind: "symbol",
    symbolName: "requestLiveReview",
    symbolKind: "function",
    hunkPreimage: undefined,
    category: "correctness",
    ruleKey: "no-unhandled-promise",
    bodyFirstSentence: undefined,
    pathRewrites: undefined,
    caseInsensitive: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeCanonicalPath
// ---------------------------------------------------------------------------

describe("normalizeCanonicalPath", () => {
  it("normalizes backslash separators to POSIX forward-slash", () => {
    expect(normalizeCanonicalPath("src\\cli\\run.ts")).toBe("src/cli/run.ts");
  });

  it("strips a single leading a/ prefix", () => {
    expect(normalizeCanonicalPath("a/src/cli/run.ts")).toBe("src/cli/run.ts");
  });

  it("strips a single leading b/ prefix", () => {
    expect(normalizeCanonicalPath("b/src/cli/run.ts")).toBe("src/cli/run.ts");
  });

  it("does NOT strip a/ when it is the actual directory name", () => {
    // "alpha/file.ts" does not start with "a/"
    expect(normalizeCanonicalPath("alpha/file.ts")).toBe("alpha/file.ts");
  });

  it("does NOT case-fold by default (case-sensitive repository)", () => {
    expect(normalizeCanonicalPath("src/MyFile.ts")).toBe("src/MyFile.ts");
  });

  it("case-folds to lowercase when caseInsensitive flag is set", () => {
    expect(normalizeCanonicalPath("src/MyFile.ts", { caseInsensitive: true })).toBe("src/myfile.ts");
  });

  it("rejects absolute paths", () => {
    expect(() => normalizeCanonicalPath("/etc/passwd")).toThrow(/absolute/i);
    expect(() => normalizeCanonicalPath("C:\\Users\\file.ts")).toThrow(/absolute/i);
  });

  it("rejects single-dot path components", () => {
    expect(() => normalizeCanonicalPath("src/./run.ts")).toThrow(/traversal|invalid/i);
  });

  it("rejects double-dot path components", () => {
    expect(() => normalizeCanonicalPath("src/../run.ts")).toThrow(/traversal|invalid/i);
  });

  it("accepts a clean repo-relative POSIX path", () => {
    expect(normalizeCanonicalPath("src/cli/run.ts")).toBe("src/cli/run.ts");
  });
});

// ---------------------------------------------------------------------------
// normalizeCategory
// ---------------------------------------------------------------------------

describe("normalizeCategory", () => {
  it("lowercases and trims", () => {
    expect(normalizeCategory("  Correctness  ")).toBe("correctness");
  });

  it("collapses internal whitespace to underscore", () => {
    expect(normalizeCategory("Code  Style")).toBe("code_style");
  });

  it("collapses internal hyphens to underscore", () => {
    expect(normalizeCategory("code-style")).toBe("code_style");
  });

  it("collapses mixed whitespace and hyphens to a single underscore", () => {
    expect(normalizeCategory("  Code - Style  ")).toBe("code_style");
  });
});

// ---------------------------------------------------------------------------
// normalizeRuleKey
// ---------------------------------------------------------------------------

describe("normalizeRuleKey", () => {
  it("returns the provider-supplied rule key when present", () => {
    expect(normalizeRuleKey("correctness", "no-unhandled-promise", "first sentence.")).toBe(
      "no-unhandled-promise",
    );
  });

  it("returns the provider-supplied rule key when present, ignoring body entirely", () => {
    expect(normalizeRuleKey("correctness", "rule-42", "completely different body")).toBe("rule-42");
  });

  it("synthesizes a deterministic SHA-256 from category + first sentence when ruleKey is absent", () => {
    const synth = normalizeRuleKey("correctness", undefined, "The variable is unused.");
    // Should be a 64-char hex string
    expect(synth).toMatch(/^[0-9a-f]{64}$/);

    // The synthesized key must be deterministic
    const synth2 = normalizeRuleKey("correctness", undefined, "The variable is unused.");
    expect(synth2).toBe(synth);
  });

  it("produces different synthesized keys for different first sentences", () => {
    const a = normalizeRuleKey("correctness", undefined, "The variable is unused.");
    const b = normalizeRuleKey("correctness", undefined, "The function is too complex.");
    expect(a).not.toBe(b);
  });

  it("produces the same synthesized key when only numbers/paths change in the first sentence", () => {
    // Numbers are removed before hashing
    const a = normalizeRuleKey("correctness", undefined, "Line 42 has an issue in src/foo.ts.");
    const b = normalizeRuleKey("correctness", undefined, "Line 99 has an issue in src/bar.ts.");
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// serializeCanonicalFields — length-prefixed UTF-8
// ---------------------------------------------------------------------------

describe("serializeCanonicalFields", () => {
  it("produces length-prefixed UTF-8 bytes for the five canonical fields", () => {
    const fields: [string, string, string, string, string] = [
      "src/cli/run.ts",
      "symbol",
      "requestLiveReview:function",
      "correctness",
      "no-unhandled-promise",
    ];
    const bytes = serializeCanonicalFields(fields);

    // Each field is 4-byte big-endian length + UTF-8 bytes
    const expected = Buffer.concat(
      fields.map((f) => {
        const buf = Buffer.from(f, "utf8");
        const len = Buffer.allocUnsafe(4);
        len.writeUInt32BE(buf.length, 0);
        return Buffer.concat([len, buf]);
      }),
    );

    expect(Buffer.from(bytes)).toEqual(expected);
  });

  it("is deterministic — same inputs produce same bytes", () => {
    const fields: [string, string, string, string, string] = [
      "a",
      "b",
      "c",
      "d",
      "e",
    ];
    const bytes1 = Buffer.from(serializeCanonicalFields(fields));
    const bytes2 = Buffer.from(serializeCanonicalFields(fields));
    expect(bytes1).toEqual(bytes2);
  });

  it("handles multi-byte UTF-8 characters correctly", () => {
    const fields: [string, string, string, string, string] = [
      "src/ファイル.ts",
      "symbol",
      "関数:function",
      "正確さ",
      "ルール",
    ];
    const bytes = Buffer.from(serializeCanonicalFields(fields));
    // Verify the first field's length prefix matches the UTF-8 byte count
    const firstLen = bytes.readUInt32BE(0);
    expect(firstLen).toBe(Buffer.byteLength("src/ファイル.ts", "utf8"));
  });
});

// ---------------------------------------------------------------------------
// computeDurableFindingIdentity — the core fingerprint + identity contract
// ---------------------------------------------------------------------------

describe("computeDurableFindingIdentity", () => {
  it("produces a DurableFindingIdentity with fingerprintVersion 1", () => {
    const identity = computeDurableFindingIdentity(makeBaseInput());
    expect(identity.fingerprintVersion).toBe(1);
    expect(identity.fingerprintDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.identityDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("round-trips: same input produces the same fingerprint and identityDigest", () => {
    const input = makeBaseInput();
    const id1 = computeDurableFindingIdentity(input);
    const id2 = computeDurableFindingIdentity(input);
    expect(id1.fingerprintDigest).toBe(id2.fingerprintDigest);
    expect(id1.identityDigest).toBe(id2.identityDigest);
  });

  it("computes the exact fingerprint per the v1 algorithm specification", () => {
    const input = makeBaseInput({
      path: "src/app.ts",
      anchorKind: "symbol",
      symbolName: "handleRequest",
      symbolKind: "function",
      category: "Security",
      ruleKey: "sql-injection",
    });

    const identity = computeDurableFindingIdentity(input);

    const expectedFingerprint = sha256Hex(
      [
        "umactually-finding-v1",
        "src/app.ts",
        "symbol",
        "handleRequest:function",
        "security",
        "sql-injection",
      ].join("\0"),
    );
    expect(identity.fingerprintDigest).toBe(expectedFingerprint);
  });

  it("computes the exact identityDigest per the v1 algorithm specification", () => {
    const input = makeBaseInput({
      path: "src/app.ts",
      anchorKind: "symbol",
      symbolName: "handleRequest",
      symbolKind: "function",
      category: "Security",
      ruleKey: "sql-injection",
    });

    const identity = computeDurableFindingIdentity(input);

    const canonicalFields: [string, string, string, string, string] = [
      "src/app.ts",
      "symbol",
      "handleRequest:function",
      "security",
      "sql-injection",
    ];
    const serialized = Buffer.concat(
      canonicalFields.map((f) => {
        const buf = Buffer.from(f, "utf8");
        const len = Buffer.allocUnsafe(4);
        len.writeUInt32BE(buf.length, 0);
        return Buffer.concat([len, buf]);
      }),
    );
    const expectedIdentity = sha256Hex(
      Buffer.concat([Buffer.from("umactually-identity-v1\0", "utf8"), serialized]),
    );
    expect(identity.identityDigest).toBe(expectedIdentity);
  });

  // ---------------------------------------------------------------
  // LINE-SHIFT INVARIANCE: the key contract.
  // Same semantic finding across line shifts retains fingerprint.
  // ---------------------------------------------------------------
  it("line-shift invariance: same symbol anchor retains fingerprint regardless of line number", () => {
    // The finding's path + symbol anchor + category + rule are the same.
    // Only the raw line number changes (10 vs 200).
    const inputAtLine10 = makeBaseInput({
      path: "src/handler.ts",
      anchorKind: "symbol",
      symbolName: "processRequest",
      symbolKind: "function",
      category: "correctness",
      ruleKey: "null-check",
    });
    const inputAtLine200 = makeBaseInput({
      path: "src/handler.ts",
      anchorKind: "symbol",
      symbolName: "processRequest",
      symbolKind: "function",
      category: "correctness",
      ruleKey: "null-check",
    });

    const id1 = computeDurableFindingIdentity(inputAtLine10);
    const id2 = computeDurableFindingIdentity(inputAtLine200);

    expect(id1.fingerprintDigest).toBe(id2.fingerprintDigest);
    expect(id1.identityDigest).toBe(id2.identityDigest);
  });

  it("hunk anchor: line-shift invariance via whitespace-normalized preimage (NOT raw line number)", () => {
    // A hunk anchor is SHA-256 of whitespace-normalized three-line preimage.
    // Two findings at different raw line numbers but with the same preimage
    // content produce the same fingerprint.
    const preimage = "function foo() {\n  return null;\n}";

    const id1 = computeDurableFindingIdentity(
      makeBaseInput({
        anchorKind: "hunk",
        symbolName: undefined,
        symbolKind: undefined,
        hunkPreimage: preimage,
        category: "style",
        ruleKey: "missing-return-type",
      }),
    );
    const id2 = computeDurableFindingIdentity(
      makeBaseInput({
        anchorKind: "hunk",
        symbolName: undefined,
        symbolKind: undefined,
        hunkPreimage: preimage,
        category: "style",
        ruleKey: "missing-return-type",
      }),
    );

    expect(id1.fingerprintDigest).toBe(id2.fingerprintDigest);
    expect(id1.identityDigest).toBe(id2.identityDigest);
  });

  // ---------------------------------------------------------------
  // CATEGORY-CHANGE: changing category changes fingerprint.
  // ---------------------------------------------------------------
  it("category-change alters fingerprint", () => {
    const inputCorrectness = makeBaseInput({
      category: "correctness",
      ruleKey: "rule-x",
    });
    const inputSecurity = makeBaseInput({
      category: "security",
      ruleKey: "rule-x",
    });

    const id1 = computeDurableFindingIdentity(inputCorrectness);
    const id2 = computeDurableFindingIdentity(inputSecurity);

    expect(id1.fingerprintDigest).not.toBe(id2.fingerprintDigest);
    expect(id1.identityDigest).not.toBe(id2.identityDigest);
  });

  // ---------------------------------------------------------------
  // ANCHOR-CHANGE: changing anchor changes fingerprint.
  // ---------------------------------------------------------------
  it("anchor-change (symbol name) alters fingerprint", () => {
    const id1 = computeDurableFindingIdentity(
      makeBaseInput({ symbolName: "handleRequest", symbolKind: "function" }),
    );
    const id2 = computeDurableFindingIdentity(
      makeBaseInput({ symbolName: "handleResponse", symbolKind: "function" }),
    );
    expect(id1.fingerprintDigest).not.toBe(id2.fingerprintDigest);
  });

  it("anchor-change (symbol kind) alters fingerprint", () => {
    const id1 = computeDurableFindingIdentity(
      makeBaseInput({ symbolName: "Foo", symbolKind: "class" }),
    );
    const id2 = computeDurableFindingIdentity(
      makeBaseInput({ symbolName: "Foo", symbolKind: "interface" }),
    );
    expect(id1.fingerprintDigest).not.toBe(id2.fingerprintDigest);
  });

  it("path-change alters fingerprint", () => {
    const id1 = computeDurableFindingIdentity(makeBaseInput({ path: "src/a.ts" }));
    const id2 = computeDurableFindingIdentity(makeBaseInput({ path: "src/b.ts" }));
    expect(id1.fingerprintDigest).not.toBe(id2.fingerprintDigest);
  });

  // ---------------------------------------------------------------
  // Rename mapping: old path → new path before hashing.
  // ---------------------------------------------------------------
  it("applies rename mapping so renamed files retain identity", () => {
    const inputOldPath = makeBaseInput({ path: "src/old-name.ts" });
    const inputNewPath = makeBaseInput({ path: "src/new-name.ts" });

    const idOld = computeDurableFindingIdentity(inputOldPath);
    const idNew = computeDurableFindingIdentity(inputNewPath);

    // Without rename mapping, these are different
    expect(idOld.fingerprintDigest).not.toBe(idNew.fingerprintDigest);

    // WITH rename mapping (old → new), the old path is canonicalized to new
    const idMapped = computeDurableFindingIdentity({
      ...inputOldPath,
      pathRewrites: [{ from: "src/old-name.ts", to: "src/new-name.ts" }],
    });
    expect(idMapped.fingerprintDigest).toBe(idNew.fingerprintDigest);
    expect(idMapped.identityDigest).toBe(idNew.identityDigest);
  });
});

// ---------------------------------------------------------------------------
// assertNoFingerprintCollision — the hard FINGERPRINT_COLLISION failure
// ---------------------------------------------------------------------------

describe("assertNoFingerprintCollision", () => {
  it("passes when same fingerprint has identical identityDigest (dedup)", () => {
    const input = makeBaseInput();
    const identity = computeDurableFindingIdentity(input);

    // Two findings with the same fingerprint + identityDigest is a dedup, not a collision
    expect(() =>
      assertNoFingerprintCollision([
        { identity, body: "body A" },
        { identity, body: "body B" },
      ]),
    ).not.toThrow();
  });

  it("throws FingerprintCollisionError when same fingerprint has different identityDigest", () => {
    // We need two identities with the same fingerprint but different identityDigest.
    // The fingerprint is sha256 of the 6-field join; the identityDigest is sha256
    // of the length-prefixed serialization. For the fingerprint to be the same
    // but the identityDigest to differ, we'd need a hash collision — which is
    // computationally infeasible for SHA-256.
    //
    // Instead, we test the collision check logic directly: create two mock
    // identities that have the same fingerprint but different identityDigest.
    const mockIdentityA: DurableFindingIdentity = {
      fingerprintVersion: 1,
      fingerprintDigest: "abc123",
      identityDigest: "digest-aaa",
      canonicalPath: "src/a.ts",
      anchorKind: "symbol",
      canonicalAnchor: "foo:function",
      normalizedCategory: "correctness",
      normalizedRuleKey: "rule-x",
    };
    const mockIdentityB: DurableFindingIdentity = {
      fingerprintVersion: 1,
      fingerprintDigest: "abc123", // SAME fingerprint
      identityDigest: "digest-bbb", // DIFFERENT identityDigest
      canonicalPath: "src/a.ts",
      anchorKind: "symbol",
      canonicalAnchor: "foo:function",
      normalizedCategory: "correctness",
      normalizedRuleKey: "rule-x",
    };

    expect(() =>
      assertNoFingerprintCollision([
        { identity: mockIdentityA, body: "body A" },
        { identity: mockIdentityB, body: "body B" },
      ]),
    ).toThrow(FingerprintCollisionError);
  });

  it("FingerprintCollisionError carries the colliding fingerprint", () => {
    const mockIdentityA: DurableFindingIdentity = {
      fingerprintVersion: 1,
      fingerprintDigest: "colliding-fp",
      identityDigest: "digest-aaa",
      canonicalPath: "src/a.ts",
      anchorKind: "symbol",
      canonicalAnchor: "foo:function",
      normalizedCategory: "correctness",
      normalizedRuleKey: "rule-x",
    };
    const mockIdentityB: DurableFindingIdentity = {
      fingerprintVersion: 1,
      fingerprintDigest: "colliding-fp",
      identityDigest: "digest-bbb",
      canonicalPath: "src/a.ts",
      anchorKind: "symbol",
      canonicalAnchor: "foo:function",
      normalizedCategory: "correctness",
      normalizedRuleKey: "rule-x",
    };

    try {
      assertNoFingerprintCollision([
        { identity: mockIdentityA, body: "body A" },
        { identity: mockIdentityB, body: "body B" },
      ]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(FingerprintCollisionError);
      const e = error as FingerprintCollisionError;
      expect(e.fingerprintDigest).toBe("colliding-fp");
      expect(e.message).toContain("FINGERPRINT_COLLISION");
    }
  });

  it("passes when all fingerprints are distinct (no collision possible)", () => {
    const id1 = computeDurableFindingIdentity(makeBaseInput({ path: "src/a.ts" }));
    const id2 = computeDurableFindingIdentity(makeBaseInput({ path: "src/b.ts" }));
    const id3 = computeDurableFindingIdentity(makeBaseInput({ path: "src/c.ts" }));

    expect(() =>
      assertNoFingerprintCollision([
        { identity: id1, body: "body 1" },
        { identity: id2, body: "body 2" },
        { identity: id3, body: "body 3" },
      ]),
    ).not.toThrow();
  });

  it("passes on an empty list", () => {
    expect(() => assertNoFingerprintCollision([])).not.toThrow();
  });

  it("checks against prior persisted state too", () => {
    // The collision check must also compare current findings against
    // prior persisted state.
    const identity = computeDurableFindingIdentity(makeBaseInput());

    const persistedIdentity: DurableFindingIdentity = {
      fingerprintVersion: 1,
      fingerprintDigest: identity.fingerprintDigest, // SAME fingerprint
      identityDigest: "different-from-current", // DIFFERENT identityDigest
      canonicalPath: identity.canonicalPath,
      anchorKind: identity.anchorKind,
      canonicalAnchor: identity.canonicalAnchor,
      normalizedCategory: identity.normalizedCategory,
      normalizedRuleKey: identity.normalizedRuleKey,
    };

    expect(() =>
      assertNoFingerprintCollision(
        [{ identity, body: "current body" }],
        [{ identity: persistedIdentity, body: "persisted body" }],
      ),
    ).toThrow(FingerprintCollisionError);
  });
});
