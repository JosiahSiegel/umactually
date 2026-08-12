// Evidence gatherer for Task 5 — runs fixture scenarios against the
// collector and dumps the captured provider body + manifest. Used by
// the agent to produce `.omo/evidence/task-5-*.json`.

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BUDGET_DEFAULTS,
  collectContextProvenance,
  renderContextBlock,
} from "../src/cli/context-provenance.js";

const TS_FILE_BODY = `export function greet(name: string): string {
  if (name.length === 0) return "hello";
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
const SECRET_LITERAL = "ghp_ABCDEMPTYSECRETSENTINEL1234";

function makeParsedArgsForTest(): import("../src/cli/parse-args.js").ParsedCliArgs {
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
    promptFile: null,
    promptFiles: null,
    additionalPromptFile: null,
    additionalPromptFiles: null,
    prompt: null,
    additionalPrompt: null,
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0];

  const cwd = await mkdtemp(join(tmpdir(), "uma-evidence-"));
  await mkdir(join(cwd, "src"), { recursive: true });
  await mkdir(join(cwd, ".claude", "rules"), { recursive: true });
  await writeFile(join(cwd, "src", "greet.ts"), TS_FILE_BODY, "utf8");
  await writeFile(join(cwd, "src", "callee.ts"), CALLEE_FILE_BODY, "utf8");
  await writeFile(join(cwd, "src", "greet.test.ts"), TEST_FILE_BODY, "utf8");
  await writeFile(join(cwd, ".claude", "rules", "frontend.md"), "Frontend rule body\n", "utf8");
  await writeFile(join(cwd, ".claude", "rules", "backend.md"), "Backend rule body\n", "utf8");

    if (mode === "happy") {
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
    const rendered = renderContextBlock(result);
    const manifest = renderContextBlock(result, { asManifest: true });
    const { buildProviderPrompts, __resetLastContextProvenanceForTests } = await import("../src/cli/provider-prompts.js");
    const parsed = makeParsedArgsForTest();
    __resetLastContextProvenanceForTests();
    const prompts = await buildProviderPrompts({
      parsed,
      cwd,
      env: {},
      platform: "github",
      diffText: SIMPLE_DIFF,
      contextProvenance: result,
    });
    // eslint-disable-next-line no-console -- evidence script writes its result to stdout.
    console.log(JSON.stringify({
      ok: true,
      rationale: "happy",
      budgets: BUDGET_DEFAULTS,
      semanticContextStatus: result.semanticContextStatus,
      itemCount: result.items.length,
      excludedCount: result.excluded.length,
      items: result.items.map((it) => ({
        sourceKind: it.sourceKind,
        baseRef: it.baseRef,
        headRef: it.headRef,
        path: it.path,
        pathScope: it.pathScope,
        trust: it.trust,
        bytes: it.bytes,
        contentHash: it.contentHash,
      })),
      excluded: result.excluded,
      budgetHash: result.budgetHash,
      bytesUsed: result.bytesUsed,
      renderedBlockKind: rendered.kind,
      renderedBlockIncludesGreetText: rendered.text.includes("export function greet"),
      manifestKind: manifest.kind,
      manifestIsContentFree: !manifest.text.includes("export function greet"),
      manifestHasSha256: /[a-f0-9]{64}/u.test(manifest.text),
      manifestHasPathLabel: manifest.text.includes("src/greet.ts"),
      providerUserContainsRepositoryContext: prompts.user.includes("Repository context"),
      providerUserContainsManifest: prompts.user.includes("Context manifest (content-free):"),
      providerUserContainsDiffHeader: prompts.user.includes("Diff:"),
      providerUserContainsFilesInDiff: prompts.user.includes("Files in diff"),
      capturedUserHead: prompts.user.slice(0, 220),
      capturedUserTail: prompts.user.slice(-220),
    }, null, 2));
  } else if (mode === "failure") {
    const outside = await mkdtemp(join(tmpdir(), "uma-evidence-outside-"));
    try {
      // (1) symlink escape
      await writeFile(join(outside, "secret.ts"), `export const leaked = "${SECRET_LITERAL}";\n`, "utf8");
      await symlink(join(outside, "secret.ts"), join(cwd, "src", "leaked.ts"));
      // (2) oversized file
      const oversized = "x".repeat(20 * 1024);
      await writeFile(join(cwd, "src", "huge.ts"), oversized, "utf8");
      // (3) unrelated path rule — backend rule wants lib/**
      // (4) malicious head-branch instruction text
      const headBranchMap = new Map<string, string>([
        [".claude/rules/frontend.md", "MALICIOUS_HEAD_BRANCH_PAYLOAD_SENTINEL_42"],
      ]);
      const oversizedDiff = [
        "diff --git a/src/huge.ts b/src/huge.ts",
        "--- a/src/huge.ts",
        "+++ b/src/huge.ts",
        "@@ -1,1 +1,2 @@",
        "-x",
        "+x",
        "+x".repeat(10_000),
        "",
      ].join("\n");
      const result = await collectContextProvenance({
        cwd,
        diffText: oversizedDiff,
        baseRef: "main",
        headRef: "feature",
        applicableInstructions: [".claude/rules/frontend.md", ".claude/rules/backend.md"],
        pathScopedInstructionRules: [
          { path: ".claude/rules/frontend.md", scope: "src/**/*" },
          { path: ".claude/rules/backend.md", scope: "lib/**/*" },
        ],
        changedPaths: ["src/huge.ts"],
        headBranchInstructionTexts: headBranchMap,
      });
      const { buildProviderPrompts, __resetLastContextProvenanceForTests } = await import("../src/cli/provider-prompts.js");
      const parsed = makeParsedArgsForTest();
      __resetLastContextProvenanceForTests();
      const prompts = await buildProviderPrompts({
        parsed,
        cwd,
        env: {},
        platform: "github",
        diffText: oversizedDiff,
        contextProvenance: result,
      });
      // eslint-disable-next-line no-console -- evidence script writes its result to stdout.
      console.log(JSON.stringify({
        ok: true,
        rationale: "failure",
        semanticContextStatus: result.semanticContextStatus,
        itemCount: result.items.length,
        excludedCount: result.excluded.length,
        items: result.items.map((it) => ({
          sourceKind: it.sourceKind,
          path: it.path,
          trust: it.trust,
          bytes: it.bytes,
          contentHash: it.contentHash,
        })),
        excluded: result.excluded,
        sentinelLeaked: result.items.some((it) => it.text.includes("MALICIOUS_HEAD_BRANCH_PAYLOAD_SENTINEL_42")),
        renderHasSentinel: renderContextBlock(result).text.includes("MALICIOUS_HEAD_BRANCH_PAYLOAD_SENTINEL_42"),
        providerUserHasSentinel: prompts.user.includes("MALICIOUS_HEAD_BRANCH_PAYLOAD_SENTINEL_42"),
        providerUserHasSecretLiteral: prompts.user.includes(SECRET_LITERAL),
        exclusionReasonsObserved: result.excluded.map((e) => e.reason).filter((v, i, a) => a.indexOf(v) === i),
        outsideCwdExclusionPresent: result.excluded.some((e) => /outside[-_]?cwd/i.test(e.reason)),
        generatedExclusionPresent: result.excluded.some((e) => /generated|build[-_]artifact/i.test(e.reason)),
        outsideScopeExclusionPresent: result.excluded.some((e) => /outside[-_]?path[-_]?scope/i.test(e.reason)),
      }, null, 2));
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  } else {
    throw new Error(`unknown mode: ${mode}`);
  }

  await rm(cwd, { recursive: true, force: true });
}

main().catch((err) => {
  // eslint-disable-next-line no-console -- evidence script writes its error to stderr.
  console.error(err);
  process.exit(1);
});
