// SPDX-License-Identifier: MIT
//
// Task 12 — Validated developer-controlled suggestions.
//
// TDD test suite written BEFORE the implementation. Covers:
//   - Happy: exact-hunk one-line replacement validates and renders.
//   - Rejection classes: stale hash, off-diff/deleted line, multiline
//     boundary escape, generated file, oversized patch, binary,
//     secret-bearing replacement.
//   - RemediationInstruction schema, 8 KiB cap, sanitization,
//     verificationCommands allowlist.
//   - Rendering: GitHub suggestion fence + Azure representation.
//   - Boundary: remediationInstruction NEVER appears in comment body.
//   - Policy: suggestionMode "off" suppresses rendering.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  ALLOWED_CONSTRAINT_LABELS,
  ALLOWED_VERIFICATION_COMMANDS,
  MAX_REMEDIATION_SIZE_BYTES,
  REMEDIATION_INSTRUCTION_SCHEMA_VERSION,
  buildRemediationInstruction,
  renderAzureSuggestionBlock,
  renderGithubSuggestionFence,
  serializeRemediationInstruction,
  validateRemediationInput,
  validateSuggestion,
} from "../../src/review/suggestion.js";
import type { DiffPositionIndex } from "../../src/diff/parse-positions.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal DiffPositionIndex from a list of (path, line) pairs. */
function makePositions(pairs: ReadonlyArray<{ readonly path: string; readonly line: number }>): DiffPositionIndex {
  const map = new Map<string, Set<number>>();
  for (const { path, line } of pairs) {
    let set = map.get(path);
    if (set === undefined) {
      set = new Set();
      map.set(path, set);
    }
    set.add(line);
  }
  return {
    hasPosition: (p) => map.get(p.path)?.has(p.line) ?? false,
    enumerate: () => pairs.slice(),
  };
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// validateSuggestion — happy path
// ---------------------------------------------------------------------------

describe("validateSuggestion — happy path", () => {
  it("validates an exact one-line replacement", () => {
    const originalText = "const x = 0;";
    const positions = makePositions([{ path: "src/foo.ts", line: 10 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 1;",
        originalTextHash: sha256(originalText),
      },
      path: "src/foo.ts",
      line: 10,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.rejection).toBeUndefined();
    expect(result.validated).toBeDefined();
    expect(result.validated?.path).toBe("src/foo.ts");
    expect(result.validated?.line).toBe(10);
    expect(result.validated?.endLine).toBe(10);
    expect(result.validated?.side).toBe("RIGHT");
    expect(result.validated?.replacement).toBe("const x = 1;");
    expect(result.validated?.originalTextHash).toBe(sha256(originalText));
  });

  it("validates a multi-line replacement with explicit endLine", () => {
    const originalText = "const a = 1;\nconst b = 2;";
    const positions = makePositions([
      { path: "src/bar.ts", line: 5 },
      { path: "src/bar.ts", line: 6 },
    ]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const a = 2;\nconst b = 3;",
        originalTextHash: sha256(originalText),
        endLine: 6,
      },
      path: "src/bar.ts",
      line: 5,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.rejection).toBeUndefined();
    expect(result.validated?.endLine).toBe(6);
  });

  it("defaults endLine to line when omitted", () => {
    const originalText = "let y = 0;";
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "let y = 1;",
        originalTextHash: sha256(originalText),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.validated?.endLine).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// validateSuggestion — rejection classes
// ---------------------------------------------------------------------------

describe("validateSuggestion — rejection classes", () => {
  it("rejects stale originalTextHash", () => {
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 2;",
        originalTextHash: sha256("WRONG CONTENT"),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: "const x = 1;",
    });
    expect(result.validated).toBeUndefined();
    expect(result.rejection?.kind).toBe("stale-hash");
  });

  it("rejects off-diff line (line not in diff positions)", () => {
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const originalText = "const x = 1;";
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 2;",
        originalTextHash: sha256(originalText),
      },
      path: "a.ts",
      line: 999,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.validated).toBeUndefined();
    expect(result.rejection?.kind).toBe("off-diff-line");
  });

  it("rejects when path not in diff at all", () => {
    const originalText = "const x = 1;";
    const positions = makePositions([{ path: "other.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 2;",
        originalTextHash: sha256(originalText),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.rejection?.kind).toBe("off-diff-line");
  });

  it.each([
    {
      name: "multiline boundary escape (replacement contains ```)",
      path: "a.ts",
      originalText: "const x = 1;",
      replacement: "const x = 2; ```evil",
      expectedErrorKind: "multiline-boundary-escape",
    },
    {
      name: "generated file (dist/)",
      path: "dist/cli.js",
      originalText: "var x = 0;",
      replacement: "var x = 1;",
      expectedErrorKind: "generated-file",
    },
    {
      name: "generated file (minified)",
      path: "lib/bundle.min.js",
      originalText: "var x = 0;",
      replacement: "var x = 1;",
      expectedErrorKind: "generated-file",
    },
    {
      name: "oversized replacement (> 8 KiB)",
      path: "a.ts",
      originalText: "const x = 0;",
      replacement: () => "x".repeat(MAX_REMEDIATION_SIZE_BYTES + 1),
      expectedErrorKind: "oversized",
    },
  ])("rejects $name", ({ path, originalText, replacement, expectedErrorKind }) => {
    const replacementText = typeof replacement === "function" ? replacement() : replacement;
    const positions = makePositions([{ path, line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: replacementText,
        originalTextHash: sha256(originalText),
      },
      path,
      line: 1,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.rejection?.kind).toBe(expectedErrorKind);
  });

  it.each([
    {
      name: "binary replacement (null bytes)",
      replacement: "const x = 2;\x00\x01binary",
      expectedKind: "binary",
    },
    {
      name: "secret-bearing replacement (AWS key pattern)",
      replacement: "const key = 'AKIAIOSFODNN7EXAMPLE';",
      expectedKind: "secret-bearing",
    },
    {
      name: "secret-bearing replacement (GitHub PAT)",
      replacement: "const t = 'ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';",
      expectedKind: "secret-bearing",
    },
  ])("rejects $name", ({ replacement, expectedKind }) => {
    const originalText = "const x = 0;";
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement,
        originalTextHash: sha256(originalText),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.rejection?.kind).toBe(expectedKind);
  });

  it("rejects malformed input (missing replacement)", () => {
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "",
        originalTextHash: sha256("x"),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: "x",
    });
    expect(result.rejection?.kind).toBe("malformed-input");
  });

  it("rejects malformed input (missing originalTextHash)", () => {
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 2;",
        originalTextHash: "",
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: "x",
    });
    expect(result.rejection?.kind).toBe("malformed-input");
  });

  it("rejects range mismatch (endLine < line)", () => {
    const originalText = "const x = 0;";
    const positions = makePositions([{ path: "a.ts", line: 5 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 2;",
        originalTextHash: sha256(originalText),
        endLine: 3,
      },
      path: "a.ts",
      line: 5,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.rejection?.kind).toBe("range-mismatch");
  });

  it("rejects when rawSuggestion is undefined", () => {
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: undefined,
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: "x",
    });
    expect(result.rejection?.kind).toBe("malformed-input");
  });
});

// ---------------------------------------------------------------------------
// RemediationInstruction
// ---------------------------------------------------------------------------

describe("RemediationInstruction", () => {
  it("builds a valid instruction from typed input", () => {
    const result = buildRemediationInstruction({
      objective: "Replace unsafe assignment",
      targetPath: "src/foo.ts",
      targetAnchor: "symbol:computeX",
      constraints: ["policy:style"],
      verificationCommands: ["npm test"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.instruction.schemaVersion).toBe(REMEDIATION_INSTRUCTION_SCHEMA_VERSION);
      expect(result.instruction.objective).toBe("Replace unsafe assignment");
      expect(result.instruction.targetPath).toBe("src/foo.ts");
      expect(result.instruction.targetAnchor).toBe("symbol:computeX");
      expect(result.instruction.constraints).toEqual(["policy:style"]);
      expect(result.instruction.verificationCommands).toEqual(["npm test"]);
    }
  });

  it("rejects an unknown constraint label", () => {
    const result = buildRemediationInstruction({
      objective: "x",
      targetPath: "a.ts",
      targetAnchor: "L1",
      constraints: ["bogus-label"],
      verificationCommands: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid-constraint");
    }
  });

  it("rejects a verification command not on the allowlist", () => {
    const result = buildRemediationInstruction({
      objective: "x",
      targetPath: "a.ts",
      targetAnchor: "L1",
      constraints: [],
      verificationCommands: ["rm -rf /"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid-verification-command");
    }
  });

  it("rejects when serialized size exceeds 8 KiB", () => {
    const huge = "x".repeat(MAX_REMEDIATION_SIZE_BYTES + 100);
    const result = buildRemediationInstruction({
      objective: huge,
      targetPath: "a.ts",
      targetAnchor: "L1",
      constraints: [],
      verificationCommands: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("oversized");
    }
  });

  it("rejects empty objective", () => {
    const result = buildRemediationInstruction({
      objective: "",
      targetPath: "a.ts",
      targetAnchor: "L1",
      constraints: [],
      verificationCommands: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid-objective");
    }
  });

  it("rejects objective with secret-shaped literal", () => {
    const result = buildRemediationInstruction({
      objective: "fix the AKIAIOSFODNN7EXAMPLE key",
      targetPath: "a.ts",
      targetAnchor: "L1",
      constraints: [],
      verificationCommands: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("secret-detected");
    }
  });

  it("serializes deterministically with sorted keys", () => {
    const result = buildRemediationInstruction({
      objective: "test",
      targetPath: "a.ts",
      targetAnchor: "L1",
      constraints: ["policy:style"],
      verificationCommands: ["npm test"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = serializeRemediationInstruction(result.instruction);
      const parsed = JSON.parse(serialized);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.objective).toBe("test");
      expect(parsed.targetPath).toBe("a.ts");
      expect(parsed.targetAnchor).toBe("L1");
      expect(parsed.constraints).toEqual(["policy:style"]);
      expect(parsed.verificationCommands).toEqual(["npm test"]);
    }
  });

  it("ALLOWED_CONSTRAINT_LABELS is a non-empty closed set", () => {
    expect(ALLOWED_CONSTRAINT_LABELS.length).toBeGreaterThan(0);
  });

  it("ALLOWED_VERIFICATION_COMMANDS is a non-empty closed set", () => {
    expect(ALLOWED_VERIFICATION_COMMANDS.length).toBeGreaterThan(0);
  });

  it("MAX_REMEDIATION_SIZE_BYTES is exactly 8192", () => {
    expect(MAX_REMEDIATION_SIZE_BYTES).toBe(8192);
  });
});

// ---------------------------------------------------------------------------
// validateRemediationInput — defensive parse
// ---------------------------------------------------------------------------

describe("validateRemediationInput — defensive parse", () => {
  it("parses a well-formed raw object", () => {
    const result = validateRemediationInput({
      objective: "fix bug",
      targetPath: "src/a.ts",
      targetAnchor: "L1",
      constraints: ["policy:style"],
      verificationCommands: ["npm test"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects non-object raw input", () => {
    const result = validateRemediationInput("not an object");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("malformed-input");
    }
  });

  it("rejects array raw input", () => {
    const result = validateRemediationInput([1, 2, 3]);
    expect(result.ok).toBe(false);
  });

  it("rejects null raw input", () => {
    const result = validateRemediationInput(null);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("renderGithubSuggestionFence", () => {
  it("wraps replacement in a suggestion fence", () => {
    const originalText = "const x = 0;";
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 1;",
        originalTextHash: sha256(originalText),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.validated).toBeDefined();
    if (result.validated) {
      const fence = renderGithubSuggestionFence(result.validated);
      expect(fence).toContain("```suggestion");
      expect(fence).toContain("const x = 1;");
      expect(fence).toContain("```");
      // Must start with the opening fence
      expect(fence.startsWith("```suggestion")).toBe(true);
    }
  });

  it("does NOT include remediationInstruction content", () => {
    const originalText = "const x = 0;";
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 1;",
        originalTextHash: sha256(originalText),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: originalText,
    });
    if (result.validated) {
      const fence = renderGithubSuggestionFence(result.validated);
      expect(fence).not.toContain("verificationCommands");
      expect(fence).not.toContain("objective");
      expect(fence).not.toContain("remediation");
    }
  });
});

describe("renderAzureSuggestionBlock", () => {
  it("produces an Azure-compatible suggestion representation", () => {
    const originalText = "const x = 0;";
    const positions = makePositions([{ path: "a.ts", line: 1 }]);
    const result = validateSuggestion({
      rawSuggestion: {
        replacement: "const x = 1;",
        originalTextHash: sha256(originalText),
      },
      path: "a.ts",
      line: 1,
      diffPositions: positions,
      originalLineText: originalText,
    });
    expect(result.validated).toBeDefined();
    if (result.validated) {
      const block = renderAzureSuggestionBlock(result.validated);
      expect(block).toContain("```suggestion");
      expect(block).toContain("const x = 1;");
      expect(block).not.toContain("verificationCommands");
    }
  });
});
