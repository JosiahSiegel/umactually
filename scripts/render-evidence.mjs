#!/usr/bin/env node
// Standalone evidence script — invokes `buildReviewBody()` with realistic
// fixture data (GitHub and Azure) and writes the actual rendered markdown
// to artifacts/manual. This is the ground truth for "the layout renders
// correctly in both platforms": the same GFM markdown gets handed to
// GitHub's review API and Azure DevOps' thread API, so what we render
// here is exactly what each platform receives.
//
// Compiles src/cli/live-shared.ts on demand (or re-uses existing build)
// to .layout-viewer-build/, then loads the compiled module.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const buildDir = resolve(packageRoot, ".layout-viewer-build");
const liveSharedSrc = resolve(packageRoot, "src/cli/live-shared.ts");
const liveSharedOut = join(buildDir, "cli", "live-shared.js");

mkdirSync(buildDir, { recursive: true });

// Re-compile if source is newer than output (or output doesn't exist).
function needsRebuild() {
  if (!existsSync(liveSharedOut)) return true;
  return statSync(liveSharedSrc).mtimeMs > statSync(liveSharedOut).mtimeMs;
}

if (needsRebuild()) {
  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  console.log("[evidence] compiling live-shared module...");
  const isWin = process.platform === "win32";
  execFileSync(
    isWin ? "npx.cmd" : "npx",
    [
      "tsc",
      liveSharedSrc,
      "--outDir",
      buildDir,
      "--module",
      "nodenext",
      "--moduleResolution",
      "nodenext",
      "--target",
      "es2024",
      "--strict",
      "--esModuleInterop",
      "--skipLibCheck",
    ],
    { cwd: packageRoot, stdio: "inherit", shell: isWin },
  );
}

const mod = await import(pathToFileURL(liveSharedOut).href);
const { buildReviewBody } = mod;

mkdirSync(resolve(packageRoot, "artifacts/manual"), { recursive: true });

// Sample 1: GitHub — 5 findings, mixed severity, NEEDS_FIX
const githubSample = {
  review: {
    summary: "Reviewed the auth refactor in this PR. Two blockers prevent merge: a hardcoded JWT signing secret and a leaked DB connection in the error path. The remaining three findings are quality improvements.",
    verdict: "NEEDS_FIX",
    comments: [
      { path: "src/auth/jwt.ts", line: 34, body: "Hardcoded signing secret leaks into version control. Move to env var.", severity: "critical", category: "security" },
      { path: "src/db/pool.ts", line: 88, body: "Connection is leaked when the query throws. Wrap in try/finally.", severity: "critical", category: "bug" },
      { path: "src/api/users.ts", line: 201, body: "Unhandled promise rejection on async middleware path.", severity: "high", category: "reliability" },
      { path: "src/util/parse-claims.ts", line: 14, body: "Function cyclomatic complexity is 18 — extract the per-claim switch into a lookup table.", severity: "medium", category: "maintainability" },
      { path: "src/index.ts", line: 5, body: "Missing JSDoc block on the exported `runReview` function.", severity: "low", category: "style" },
    ],
    suppressedComments: [
      { path: "src/legacy/old-auth.ts", line: 22, body: "Legacy — will be removed in v2.", severity: "low", category: "general" },
      { path: "test/fixtures/old.ts", line: 9, body: "Test fixture only.", severity: "low", category: "general" },
    ],
  },
  provider: "github",
  modelId: "claude-opus-4-5",
  validCommentCount: 5,
  suppressedCommentCount: 2,
  offDiffFromComments: [],
  severityCounts: { critical: 2, high: 1, medium: 1, low: 1 },
  secrets: [],
  postedComments: [
    { path: "src/auth/jwt.ts", line: 34, body: "Hardcoded signing secret leaks into version control. Move to env var.", severity: "critical", category: "security" },
    { path: "src/db/pool.ts", line: 88, body: "Connection is leaked when the query throws. Wrap in try/finally.", severity: "critical", category: "bug" },
    { path: "src/api/users.ts", line: 201, body: "Unhandled promise rejection on async middleware path.", severity: "high", category: "reliability" },
    { path: "src/util/parse-claims.ts", line: 14, body: "Function cyclomatic complexity is 18 — extract the per-claim switch into a lookup table.", severity: "medium", category: "maintainability" },
    { path: "src/index.ts", line: 5, body: "Missing JSDoc block on the exported `runReview` function.", severity: "low", category: "style" },
  ],
};

// Sample 2: Azure DevOps — same fixture, different provider name
const azureSample = {
  ...githubSample,
  provider: "azure-devops",
};

const githubBody = buildReviewBody(githubSample);
const azureBody = buildReviewBody(azureSample);

writeFileSync(
  resolve(packageRoot, "artifacts/manual/severity-table-github-render.md"),
  githubBody,
  "utf8",
);
writeFileSync(
  resolve(packageRoot, "artifacts/manual/severity-table-azure-render.md"),
  azureBody,
  "utf8",
);

// Sample 3: Clean review (SHIPPABLE)
const cleanSample = {
  review: {
    summary: "Reviewed the README copy edits — no blockers, looks good to merge.",
    verdict: "SHIP",
    comments: [],
    suppressedComments: [],
  },
  provider: "github",
  modelId: "claude-opus-4-5",
  validCommentCount: 0,
  suppressedCommentCount: 0,
  offDiffFromComments: [],
  severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
  secrets: [],
  postedComments: [],
};
writeFileSync(
  resolve(packageRoot, "artifacts/manual/severity-table-clean-render.md"),
  buildReviewBody(cleanSample),
  "utf8",
);

// Sample 4: Parse-failed review (fallback path)
const parseFailSample = {
  ...githubSample,
  review: {
    ...githubSample.review,
    summary: "Provider response could not be parsed as a JSON review payload. Raw text captured below.",
    parseFailed: true,
    rawProviderText: "OK here is my analysis:\n\n```\n[unparseable response]\n```\n",
  },
};
writeFileSync(
  resolve(packageRoot, "artifacts/manual/severity-table-parsefail-render.md"),
  buildReviewBody(parseFailSample),
  "utf8",
);

// Sample 5: Leak redacted (secrets list provided)
// Important: must build a fresh comments array — spreading the first
// comment's fields then overriding body, otherwise the body override
// can be lost. (Confirmed redaction works in production code; this
// fixture just needs to actually contain the secret.)
const leakedSecret = "AKIAIOSFODNN7EXAMPLE";
const leakedFinding = {
  path: "src/auth/jwt.ts",
  line: 34,
  body: `Hardcoded signing secret ${leakedSecret} leaks into version control. Move to env var.`,
  severity: "critical",
  category: "security",
};
const redactedSample = {
  ...githubSample,
  review: {
    summary: "Reviewed the auth refactor in this PR. One blocker: a hardcoded JWT signing secret.",
    verdict: "NEEDS_FIX",
    comments: [leakedFinding],
    suppressedComments: [],
  },
  postedComments: [leakedFinding],
  severityCounts: { critical: 1, high: 0, medium: 0, low: 0 },
  validCommentCount: 1,
  secrets: [leakedSecret],
};
writeFileSync(
  resolve(packageRoot, "artifacts/manual/severity-table-redacted-render.md"),
  buildReviewBody(redactedSample),
  "utf8",
);

console.log("Wrote evidence artifacts:");
console.log("  artifacts/manual/severity-table-github-render.md   (NEEDS_FIX, 5 findings, GitHub)");
console.log("  artifacts/manual/severity-table-azure-render.md    (same, routed via Azure DevOps)");
console.log("  artifacts/manual/severity-table-clean-render.md    (SHIP, 0 findings)");
console.log("  artifacts/manual/severity-table-parsefail-render.md (parse-fail fallback banner)");
console.log("  artifacts/manual/severity-table-redacted-render.md  (secret redaction applied)");

console.log("\n--- GitHub render preview (first 1200 chars) ---");
console.log(githubBody.slice(0, 1200));
console.log("...");