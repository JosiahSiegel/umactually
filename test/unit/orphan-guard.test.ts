// SPDX-License-Identifier: MIT
// Structural test: scripts/compile-entry.ts is the legacy Bun --compile entrypoint.
// After v0.6.0 migrated to Node SEA via tsdown --exe, this file should have no
// importers, no package references, and no workflow references. The release
// pipeline must produce its binary from src/cli.ts via tsdown, not via this file.
//
// This test enforces "no live reference" as a guardrail: any future code that
// tries to re-introduce the Bun path will fail this test before merge.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

type Reference = { path: string; line: number };

function findCompileEntryReferences(): Reference[] {
  const refs: Reference[] = [];
  const skipDirs = new Set(["node_modules", ".git", "dist", ".omo", "release", "artifacts"]);

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let st;
      try {
        st = statSync(fullPath);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (skipDirs.has(entry)) continue;
        walk(fullPath);
        continue;
      }
      if (!st.isFile()) continue;
      // Only check files that could plausibly reference scripts/compile-entry.ts
      if (!/\.(ts|mjs|cjs|js|json|yml|yaml|sh|ps1|toml)$/i.test(entry)) continue;
      // Skip the test file itself
      if (fullPath === __filename) continue;
      let content: string;
      try {
        content = readFileSync(fullPath, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (line.includes("scripts/compile-entry") || line.includes("compile-entry.ts")) {
          refs.push({ path: relative(REPO_ROOT, fullPath), line: i + 1 });
        }
      }
    }
  }

  walk(REPO_ROOT);
  return refs;
}

describe("scripts/compile-entry.ts orphan guard", () => {
  it("has zero live references in source, scripts, workflows, or build configs", () => {
    const refs = findCompileEntryReferences();
    // Path-segment-aware check: a path under "docs/" matches if its first
    // segment is exactly "docs" (so "docs-old/file" would NOT be skipped).
    // This avoids substring false-positives like "docs/" matching
    // "docs-old/..." or `.omo/` matching `something.omo/...`.
    const isAllowedDocPath = (path: string): boolean => {
      const firstSegment = path.split(sep)[0] ?? "";
      return firstSegment === ".omo" || firstSegment === "docs";
    };
    const blocking = refs.filter((r) => !isAllowedDocPath(r.path));
    expect(
      blocking,
      `compile-entry.ts must be orphaned in source/scripts/workflows/build-configs.\n` +
        `Found blocking references: ${JSON.stringify(blocking, null, 2)}`,
    ).toEqual([]);
  });
});
