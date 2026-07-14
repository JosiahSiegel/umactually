// SPDX-License-Identifier: MIT
// One-shot script: rename all "umactually" literals to "umactually".
// Idempotent (re-runs are no-ops once the rename is complete).
// Already executed; kept for reference. Not in any test or build path.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const repo = process.cwd();
const SURFACES = [
  "src", "test", "docs", "examples", "ado-extension", "scripts",
  ".github", "README.md", "CHANGELOG.md", "CONTRIBUTING.md",
  "package.json", "package-lock.json", "action.yml", "azure-pipelines.yml",
];

const EXTS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs",
  ".md", ".yml", ".yaml",
  ".json", ".jsonc",
  ".txt", ".html",
]);

const TOKEN = "umactually";
const REPLACEMENT = "umactually";
const TOKEN_REGEX = /umactually/g;

const SKIP_DIRS = new Set([
  "node_modules", "dist", "dist-tmp", ".git", "coverage",
  ".omo", ".layout-viewer-build", ".playwright-mcp", "artifacts",
]);

let totalFiles = 0;
let totalReplacements = 0;

function walk(path) {
  let s;
  try { s = statSync(path); } catch { return; }
  if (s.isDirectory()) {
    const tail = path.split(/[\\/]/).pop() || "";
    if (SKIP_DIRS.has(tail)) return;
    let names;
    try { names = readdirSync(path); } catch { return; }
    for (const n of names) {
      if (SKIP_DIRS.has(n)) continue;
      walk(join(path, n));
    }
    return;
  }
  if (s.isFile()) {
    const base = path.split(/[\\/]/).pop() || "";
    const dotIdx = base.lastIndexOf(".");
    const ext = dotIdx >= 0 ? base.slice(dotIdx) : "";
    if (!EXTS.has(ext)) return;
    let original;
    try { original = readFileSync(path, "utf8"); } catch { return; }
    if (!original.includes(TOKEN)) return;
    const updated = original.split(TOKEN).join(REPLACEMENT);
    const count = (original.match(TOKEN_REGEX) || []).length;
    writeFileSync(path, updated, "utf8");
    totalFiles += 1;
    totalReplacements += count;
    console.log(`  ${relative(repo, path)}  (${count})`);
  }
}

console.log(`Walking surfaces under ${repo}`);
for (const surface of SURFACES) walk(join(repo, surface));

// Skip root-level artifact file (regenerated on every CLI run).
try {
  const rootArtifact = join(repo, "umactually-review.json");
  if (statSync(rootArtifact).isFile()) {
    const t = readFileSync(rootArtifact, "utf8");
    if (t.includes(TOKEN)) {
      const updated = t.split(TOKEN).join(REPLACEMENT);
      const count = (t.match(TOKEN_REGEX) || []).length;
      writeFileSync(rootArtifact, updated, "utf8");
      console.log(`  umactually-review.json  (${count})`);
      totalFiles += 1; totalReplacements += count;
    }
  }
} catch {}
console.log("");
console.log(`Done. ${totalFiles} file(s) updated; ${totalReplacements} total replacement(s).`);
