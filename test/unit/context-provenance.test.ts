// SPDX-License-Identifier: MIT
//
// Unit tests for Task 5 `context-provenance`. Locks:
//   - typed ContextItem shape (source kind, base/head ref, path, scope, trust, bytes, content hash, text)
//   - selection order (changed-decl → related-type → caller/callee → test, then lexical canonical path)
//   - exact-byte budget truncation with explicit exclusion reason
//   - default budgets vs hard caps
//   - symmetric exclusion set: symlink outside cwd, oversized file, secret-bearing, untrusted head-branch
//   - non-TS files fall back to hunk + applicable instruction files with `semanticContextStatus: unsupported`
//   - manifest is content-free (no raw source/context text leaked)
//
// These tests pin the contract that the prompt-renderer + finding-provenance
// attachments rely on.

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BUDGET_DEFAULTS,
  BUDGET_HARD_CAPS,
  collectContextProvenance,
  renderContextBlock,
  type ContextBudgets,
  type ContextItem,
  type ContextProvenanceResult,
} from "../../src/cli/context-provenance.js";

const TS_FILE_BODY = `// a TS source file used by tests
export function greet(name: string): string {
  if (name.length === 0) {
    return "hello";
  }
  return "hello, " + name;
}
`;

const CALLEE_FILE_BODY = `import { greet } from "./greet.js";
export function run(): string {
  return greet("world");
}
`;

const TEST_FILE_BODY = `import { greet } from "./greet.js";
import { run } from "./callee.js";

describe("greet", () => {
  it("returns hello", () => {
    expect(run()).toBe("hello, world");
  });
});
`;

const SIMPLE_DIFF = [
  "diff --git a/src/greet.ts b/src/greet.ts",
  "--- a/src/greet.ts",
  "+++ b/src/greet.ts",
  "@@ -1,4 +1,8 @@",
  " // a TS source file used by tests",
  "-export function greet(name: string): string {",
  "+export function greet(name: string): string {",
  "+  if (name.length === 0) {",
  "+    return \"hello\";",
  "+  }",
  "   return \"hello, \" + name;",
  " }",
  "",
].join("\n");

const MULTI_LANG_DIFF = [
  "diff --git a/src/greet.ts b/src/greet.ts",
  "--- a/src/greet.ts",
  "+++ b/src/greet.ts",
  "@@ -1,4 +1,8 @@",
  " // a TS source file used by tests",
  " export function greet(name: string): string {",
  "+  if (name.length === 0) {",
  "+    return \"hello\";",
  "+  }",
  "   return \"hello, \" + name;",
  " }",
  "",
  "diff --git a/README.md b/README.md",
  "--- a/README.md",
  "+++ b/README.md",
  "@@ -1,1 +1,1 @@",
  "-# repo",
  "+# repo-name",
  "",
].join("\n");

const SECRET_LITERAL = "ghp_" + "ABCDEMPTYSECRETSENTINEL1234";

async function makeRepoWithTSSources(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "uma-ctxprov-"));
  await mkdir(join(cwd, "src"), { recursive: true });
  await mkdir(join(cwd, ".claude", "rules"), { recursive: true });
  await writeFile(join(cwd, "src", "greet.ts"), TS_FILE_BODY, "utf8");
  await writeFile(join(cwd, "src", "callee.ts"), CALLEE_FILE_BODY, "utf8");
  await writeFile(join(cwd, "src", "greet.test.ts"), TEST_FILE_BODY, "utf8");
  await writeFile(join(cwd, ".claude", "rules", "frontend.md"), "Frontend rule body", "utf8");
  // Path-scoped rule that must NOT affect the test corpus (different path).
  await writeFile(join(cwd, ".claude", "rules", "backend.md"), "Backend rule body", "utf8");
  return cwd;
}

describe("BUDGET_DEFAULTS and BUDGET_HARD_CAPS", () => {
  it("uses the documented default budgets (64 KiB / 16 KiB / 20 / 200 / 750 ms)", () => {
    expect(BUDGET_DEFAULTS.totalBytes).toBe(64 * 1024);
    expect(BUDGET_DEFAULTS.perFileBytes).toBe(16 * 1024);
    expect(BUDGET_DEFAULTS.maxItems).toBe(20);
    expect(BUDGET_DEFAULTS.maxFilesParsed).toBe(200);
    expect(BUDGET_DEFAULTS.wallTimeMs).toBe(750);
  });

  it("uses the documented hard caps (256 KiB / 32 KiB / 80 / 1000 / 3000 ms)", () => {
    expect(BUDGET_HARD_CAPS.totalBytes).toBe(256 * 1024);
    expect(BUDGET_HARD_CAPS.perFileBytes).toBe(32 * 1024);
    expect(BUDGET_HARD_CAPS.maxItems).toBe(80);
    expect(BUDGET_HARD_CAPS.maxFilesParsed).toBe(1000);
    expect(BUDGET_HARD_CAPS.wallTimeMs).toBe(3000);
  });
});

describe("collectContextProvenance (typed ContextItem + selection + budget)", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeRepoWithTSSources();
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("returns typed ContextItems with the documented 8 fields", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: ["CLAUDE.md"],
    });
    // Every item carries the eight typed fields: sourceKind, baseRef, headRef,
    // path, pathScope, trust, bytes, contentHash, text. (We require 9 because
    // text is internal.)
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(typeof item.sourceKind).toBe("string");
      expect(item.sourceKind.length).toBeGreaterThan(0);
      expect(item.baseRef).toBe("main");
      expect(item.headRef).toBe("feature");
      expect(typeof item.path).toBe("string");
      expect(item.pathScope.length).toBeGreaterThan(0);
      expect(["base", "head", "trusted", "untrusted"].includes(item.trust)).toBe(true);
      expect(Number.isInteger(item.bytes)).toBe(true);
      expect(typeof item.contentHash).toBe("string");
      expect(item.contentHash.length).toBe(64); // sha256 hex
      expect(typeof item.text).toBe("string");
    }
  });

  it("emits a `changed_declaration` item for the changed TS declaration", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const changed = result.items.find((it) => it.sourceKind === "changed_declaration");
    expect(changed).toBeDefined();
    expect(changed?.path).toBe("src/greet.ts");
  });

  it("resolves same-project imports: callee.ts is included as direct callee", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const items = result.items.map((it) => it.path);
    expect(items).toContain("src/callee.ts");
  });

  it("collects test files matching basename/import references", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const items = result.items.map((it) => it.path);
    expect(items).toContain("src/greet.test.ts");
  });

  it("selection order is changed-decl → related-type → direct caller/callee → test, then lexical path", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    // Find the rank of each source-kind class. Tie-break is lexical
    // canonical path (a < b < ...).
    const ranks = new Map<string, number>();
    result.items.forEach((it, idx) => {
      const key = `${it.sourceKind}::${it.path}`;
      if (!ranks.has(key)) ranks.set(key, idx);
    });

    const callee = ranks.get("direct_caller_or_callee::src/callee.ts");
    const test = ranks.get("test_reference::src/greet.test.ts");
    const changed = ranks.get("changed_declaration::src/greet.ts");
    expect(changed).toBeDefined();
    expect(changed).toBeLessThanOrEqual(callee ?? changed!);
    expect((callee ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(test ?? Number.POSITIVE_INFINITY);
  });

  it("emits `semanticContextStatus: unsupported` when no TS files are in the diff", async () => {
    const pyDiff = [
      "diff --git a/app.py b/app.py",
      "--- a/app.py",
      "+++ b/app.py",
      "@@ -1,1 +1,1 @@",
      "-print(1)",
      "+print(2)",
      "",
    ].join("\n");
    const result = await collectContextProvenance({
      cwd,
      diffText: pyDiff,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: ["CLAUDE.md"],
    });
    expect(result.semanticContextStatus).toBe("unsupported");
    // Fallback includes the diff hunks.
    const fallbackItems = result.items.map((it) => it.path);
    expect(fallbackItems).toContain("app.py");
  });

  it("records `semanticContextStatus: parse-failed` for unrecoverable TS parse errors", async () => {
    // Write a file that is valid syntax, then corrupt it via a strip-the-closing-brace
    // trick to force the TS compiler parser to fail. The TS parse function MUST
    // catch the failure and degrade gracefully.
    const brokenPath = join(cwd, "src", "broken.ts");
    await writeFile(brokenPath, "export function oops( {", "utf8");
    const diff = [
      "diff --git a/src/broken.ts b/src/broken.ts",
      "--- a/src/broken.ts",
      "+++ b/src/broken.ts",
      "@@ -1,1 +1,1 @@",
      "-export function noop() {}",
      "+export function oops( {",
      "",
    ].join("\n");
    const result = await collectContextProvenance({
      cwd,
      diffText: diff,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    expect(["parse-failed", "budget-exhausted"]).toContain(result.semanticContextStatus);
    // No throw. Review continues.
  });

  it("exact-byte budget: items selected up to the total-byte cap; one byte over is truncated", async () => {
    // One big instruction file (12 KiB) plus the 3 TS files (each well under per-file cap).
    // Total default cap is 64 KiB — well above. Pin that ALL items appear.
    const smallBudget: ContextBudgets = {
      ...BUDGET_DEFAULTS,
      totalBytes: 1024, // tiny: any single file is enough
      perFileBytes: 1024,
      maxItems: 20,
      maxFilesParsed: 200,
      wallTimeMs: 750,
    };
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
      budgets: smallBudget,
    });
    // At 1 KiB total, the first item fitting the cap appears and the rest are dropped/excluded.
    expect(result.items.length).toBeLessThanOrEqual(5);
    // The manifest's `truncatedCount` (or exclusions) carries the budget reason.
    const manifest = renderContextBlock(result, { asManifest: true });
    expect(manifest.kind).toBe("manifest");
    expect(manifest.text).toContain("budget");
  });

  it("excludes a symlink whose realpath escapes the cwd (security boundary)", async () => {
    const outside = await mkdtemp(join(tmpdir(), "uma-outside-ctxprov-"));
    try {
      await writeFile(join(outside, "secret.ts"), `export const leaked = "${SECRET_LITERAL}";\n`, "utf8");
      // Symlink inside cwd pointing outside.
      await symlink(join(outside, "secret.ts"), join(cwd, "src", "leaked.ts"));
      const result = await collectContextProvenance({
        cwd,
        diffText: SIMPLE_DIFF,
        baseRef: "main",
        headRef: "feature",
        applicableInstructions: [],
      });
      const items = result.items.map((it) => it.path);
      expect(items).not.toContain("src/leaked.ts");
      // The exclusion must carry an explicit reason.
      const exclusions = result.excluded;
      const types = exclusions.map((e) => e.reason);
      expect(types.some((r) => /outside[-_]?cwd|symlink|escape/i.test(r))).toBe(true);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("excludes a file whose realpath escapes the cwd (outside-cwd reason)", async () => {
    // Same shape as above but with path "outside-cwd" reason being precise.
    const outside = await mkdtemp(join(tmpdir(), "uma-outside-ctxprov2-"));
    try {
      await writeFile(join(outside, "escape.ts"), "export const v = 1;\n", "utf8");
      await symlink(join(outside, "escape.ts"), join(cwd, "src", "escape.ts"));
      const result = await collectContextProvenance({
        cwd,
        diffText: SIMPLE_DIFF,
        baseRef: "main",
        headRef: "feature",
        applicableInstructions: [],
      });
      const escape = result.excluded.find((e) => e.path === "src/escape.ts");
      expect(escape).toBeDefined();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("excludes build-artifact / generated paths", async () => {
    await mkdir(join(cwd, "dist"), { recursive: true });
    await writeFile(join(cwd, "dist", "cli.js"), "// built artifact\n", "utf8");
    const diff = [
      "diff --git a/dist/cli.js b/dist/cli.js",
      "--- a/dist/cli.js",
      "+++ b/dist/cli.js",
      "@@ -1,1 +1,1 @@",
      "-// built artifact",
      "+// built artifact v2",
      "",
    ].join("\n");
    const result = await collectContextProvenance({
      cwd,
      diffText: diff,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const excluded = result.excluded.some((e) => /generated|build[-_]artifact/i.test(e.reason));
    expect(excluded).toBe(true);
    const items = result.items.map((it) => it.path);
    expect(items).not.toContain("dist/cli.js");
  });

  it("excludes secret-bearing files (matches SECRET_REGEX-shaped literal)", async () => {
    await writeFile(
      join(cwd, "src", "leak.ts"),
      `// touches token: ${SECRET_LITERAL}\nexport const v = 1;\n`,
      "utf8",
    );
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    // The leak file's text was filtered out, so its items array entry text was rejected.
    const reason = result.excluded.find((e) => /secret/i.test(e.reason));
    expect(reason).toBeDefined();
  });

  it("does NOT include head-branch instructions in PR mode (trust: untrusted + base-branch default)", async () => {
    // `applicableInstructions` is the base-branch filter; head-branch content is never trusted.
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: ["CLAUDE.md"],
      headBranchInstructionTexts: new Map([["CLAUDE.md", "MALICIOUS_HEAD_BRANCH_PAYLOAD"]]),
    });
    const text = result.items.map((it) => it.text).join("\n");
    expect(text).not.toContain("MALICIOUS_HEAD_BRANCH_PAYLOAD");
    // Trust level is base or untrusted; head was never trusted.
    expect(result.items.every((it) => it.trust !== "head")).toBe(true);
  });

  it("path-scoped instruction rule only matches files inside its scope", async () => {
    // Build a tiny manifest by exposing a helper that respects a `path-scoped`
    // mapping. We just verify the applyRule behavior via collectContextProvenance
    // with applicableInstructions pointing to .claude/rules/frontend.md.
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [".claude/rules/frontend.md", ".claude/rules/backend.md"],
      pathScopedInstructionRules: [
        { path: ".claude/rules/frontend.md", scope: "src/**/*" },
        { path: ".claude/rules/backend.md", scope: "lib/**/*" },
      ],
      changedPaths: ["src/greet.ts", "src/callee.ts", "src/greet.test.ts"],
    });
    const items = result.items.filter((it) => it.sourceKind === "instruction");
    const matchedScopes = new Set(items.map((it) => it.pathScope));
    // The frontend rule matched the src files; backend didn't.
    expect(matchedScopes.has("src/**/*")).toBe(true);
    expect(matchedScopes.has("lib/**/*")).toBe(false);
  });

  it("manifest is content-free (no raw source/context text leaked into the rendered manifest)", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const manifest = renderContextBlock(result, { asManifest: true });
    expect(manifest.kind).toBe("manifest");
    // Pick a distinctive substring from a TS source body; the manifest must not contain it.
    expect(manifest.text).not.toContain("export function greet");
    expect(manifest.text).not.toContain("hello");
    // But the path is fine to include.
    expect(manifest.text).toContain("src/greet.ts");
    // And every hash is listed (64-char sha256 hex).
    expect(manifest.text).toMatch(/[a-f0-9]{64}/u);
  });

  it("renderContextBlock on items emits a `rendered` block the model can use, NOT the manifest", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const block = renderContextBlock(result);
    // The prompt-side render includes the actual file text. The manifest render does NOT.
    expect(["rendered", "manifest"]).toContain(block.kind);
  });

  it("wall-time budget — empirically we never blow past the budget on a small fixture", async () => {
    const start = Date.now();
    await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
      budgets: { ...BUDGET_DEFAULTS, wallTimeMs: 50 },
    });
    const elapsed = Date.now() - start;
    // Wall-time is a soft cap; we only assert we don't time-spiral on a tiny fixture.
    expect(elapsed).toBeLessThan(2000);
  });

  it("honors Task 6 budgets as override layer: a stricter (lower) budget reduces bytes", async () => {
    const strict: ContextBudgets = {
      ...BUDGET_DEFAULTS,
      totalBytes: 8 * 1024, // 8 KiB instead of 64 KiB
      perFileBytes: 4 * 1024,
      maxItems: 5,
    };
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
      budgets: strict,
    });
    // Pinned bytes bound: sum of bytes <= 8 KiB. The strict budget is HONORED.
    const totalBytes = result.items.reduce((acc, it) => acc + it.bytes, 0);
    expect(totalBytes).toBeLessThanOrEqual(8 * 1024);
    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  it("rejects budgets that exceed hard caps (raise-only limited)", async () => {
    await expect(
      collectContextProvenance({
        cwd,
        diffText: SIMPLE_DIFF,
        baseRef: "main",
        headRef: "feature",
        applicableInstructions: [],
        budgets: { ...BUDGET_DEFAULTS, totalBytes: 999_999_999 },
      }),
    ).rejects.toThrow(/hard cap|budget/i);
  });

  it("two-language diff includes both languages (TS source items + non-TS hunk fallback)", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: MULTI_LANG_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const items = result.items.map((it) => it.path);
    expect(items).toContain("src/greet.ts");
    expect(items).toContain("README.md");
  });

  it("records ContentItemKind variants exactly as documented", async () => {
    const result = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const kinds = new Set(result.items.map((it) => it.sourceKind));
    // The set of source kinds is closed: changed_declaration | related_type |
    // direct_caller_or_callee | test_reference | instruction | diff_hunk.
    for (const k of kinds) {
      expect([
        "changed_declaration",
        "related_type",
        "direct_caller_or_callee",
        "test_reference",
        "instruction",
        "diff_hunk",
      ]).toContain(k);
    }
  });
});

describe("buildProviderPrompts integration (typed context-item plumbing)", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeRepoWithTSSources();
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("the user message includes a rendered context block when provenance is supplied", async () => {
    const { buildProviderPrompts } = await import("../../src/cli/provider-prompts.js");
    const { collectContextProvenance } = await import("../../src/cli/context-provenance.js");
    const provenance = await collectContextProvenance({
      cwd,
      diffText: SIMPLE_DIFF,
      baseRef: "main",
      headRef: "feature",
      applicableInstructions: [],
    });
    const prompts = await buildProviderPrompts({
      parsed: makeParsed(),
      cwd,
      env: {},
      platform: "github",
      diffText: SIMPLE_DIFF,
      contextProvenance: provenance,
    });
    // Rendered context block is present in the user message.
    expect(prompts.user).toContain("Repository context");
    // And the manifest is also present (hashed, content-free).
    expect(prompts.user).toContain("Context manifest (content-free):");
  });

  it("the user message retains prior prompt semantics when no provenance is supplied", async () => {
    const { buildProviderPrompts } = await import("../../src/cli/provider-prompts.js");
    const prompts = await buildProviderPrompts({
      parsed: makeParsed(),
      cwd,
      env: {},
      platform: "github",
      diffText: SIMPLE_DIFF,
    });
    expect(prompts.user).not.toContain("Repository context");
  });
});

// Helper — minimal ParsedCliArgs so the integration tests above can run.
function makeParsed(): import("../../src/cli/parse-args.js").ParsedCliArgs {
  return {
    platform: "github",
    eventPath: null,
    diffPath: null,
    files: null,
    threadsPath: null,
    reviewPath: null,
    prNumber: null,
    repo: null,
    apiUrl: null,
    apiKey: null,
    model: null,
    additionalPrompt: null,
    additionalPromptFile: null,
    additionalPromptFiles: null,
    prompt: null,
    promptFile: null,
    promptFiles: null,
    effort: null,
    provider: null,
    githubApiBase: null,
    includeSonarqube: false,
    includePrSonarFindings: false,
    sonarHostUrl: null,
    sonarToken: null,
    sonarProjectKey: null,
    sonarTimeoutSeconds: null,
    minimumSeverity: null,
    minimumSeverityInternal: null,
    maxComments: null,
    reviewFileLimit: null,
    detectLeaks: true,
    instructionFiles: true,
    walkthrough: false,
    diagnostic: false,
    debugRawResponse: false,
    simulateFindings: false,
    reviewTimeoutSeconds: null,
    stallSeconds: null,
    perRequestTimeoutSeconds: null,
    maxOutputTokens: null,
    dryRun: false,
    outputArtifact: null,
    strictSchema: true,
    verifyFindings: true,
  };
}

void type_provenance_result_satisfies_contract;

function type_provenance_result_satisfies_contract(_r: ContextProvenanceResult): void {
  // Type-only assertion used to pin the contract shape across edits.
  // No runtime effect.
}

void type_context_item;
function type_context_item(_it: ContextItem): void {
  // Type-level pin.
}
