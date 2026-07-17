// SPDX-License-Identifier: MIT
// Regression tests for v0.5.0 release.yml hotfixes.
//
// Bug history (see `.omo/notepads/release-binary-download-size/learnings.md`):
//
// Hotfix #2 (commit 8082ef7): .github/workflows/release.yml pinned
// `actions/download-artifact` to the same 40-char SHA as
// `actions/upload-artifact` (`043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`).
// That SHA exists in `actions/upload-artifact` but does NOT exist in
// `actions/download-artifact`. Every smoke job failed at the
// `actions/download-artifact@<SHA>` resolve step with:
//
//   ##[error]Unable to resolve action `actions/download-artifact@<SHA>`,
//     unable to find version `<SHA>`
//
// Root cause: a copy-paste typo from a previous workflow author. The
// earlier v0.4.x workflow used the floating major tag `actions/download-artifact@v4`,
// which works; v0.5.0 swapped in a SHA pin that belonged to the upload
// action.
//
// Hotfix #3 (this commit): seven smoke jobs (`smoke-linux-x64`,
// `smoke-linux-arm64`, `smoke-darwin-x64`, `smoke-darwin-arm64`,
// `smoke-windows-x64`, `smoke-windows-x64-git-bash-delegate`,
// `smoke-bad-checksum`) called `gh api "repos/.../actions/artifacts/.../zip"`
// in their `Download exact candidate artifact` step but did NOT set
// `GH_TOKEN: ${{ github.token }}` in the step's env block. GitHub CLI
// requires `GH_TOKEN` (or `GITHUB_TOKEN`) inside Actions workflows and
// emits a hard error otherwise. All 7 smoke jobs failed at this exact
// line with:
//
//   gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN
//   environment variable.
//
// Root cause: the `publish` job sets `GH_TOKEN` at the job-level `env:`
// block (which step env blocks inherit) and the `canary` job sets it
// at the step-level `env:` block. The smoke jobs did neither.
//
// This file nails the contract that prevents recurrence:
//
//   1. The exact regression (hotfix #2): `actions/download-artifact@043fb46d...`
//      must not appear anywhere under `.github/workflows/`. The literal
//      SHA is a copy-paste from upload-artifact and is invalid in
//      download-artifact.
//
//   2. The general invariant (hotfix #2): no two distinct `actions/<NAME>`
//      references may share the same 40-char SHA. A SHA collision across
//      actions is the structural signature of a copy-paste typo (different
//      repos have independent commit histories; a real SHA exists in
//      exactly one repo).
//
//   3. The exact regression (hotfix #3): every step that calls
//      `gh api` must declare `GH_TOKEN: ${{ github.token }}` in either
//      its own `env:` block or in an enclosing job-level `env:` block
//      (env blocks inherit down through the YAML tree).
//
//   4. The general invariant (hotfix #3): every `gh api` invocation in
//      any workflow file must have `GH_TOKEN` available via env-block
//      inheritance. This catches future regressions of the same class
//      — any new step that calls `gh api` without a `GH_TOKEN` env
//      entry will fail the test with an exact file:line citation.
//
// The tests do NOT hit the network. They are pure static analysis over
// the on-disk workflow YAML text — cheap, deterministic, and runs in CI
// on every PR. The `ci` workflow does not execute `release.yml` (it
// only runs lint/typecheck/unit tests), so these static checks are the
// only pre-merge gate that can catch this class of bug.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const WORKFLOWS_DIR = join(REPO_ROOT, ".github", "workflows");

// The exact buggy SHA that motivated test #1. If you change the value,
// you're not testing the bug anymore.
const BUGGY_DOWNLOAD_SHA = "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";

// Pattern: `uses: actions/<NAME>@<REF>` where REF is either a 40-char
// SHA (`[0-9a-f]{40}`) or a major-version tag (`v\d+`, with optional
// prerelease suffix). Captures NAME and REF.
const USES_LINE_RE = /^\s*uses:\s*actions\/([A-Za-z0-9_.-]+)@(\S+)\s*$/u;
const SHA_RE = /^[0-9a-f]{40}$/u;

// Pattern: matches a `gh api` invocation in a workflow run block.
// Anchored on a leading word boundary so we don't false-positive on
// `gh api-foo` (none exist today, but be defensive).
const GH_API_RE = /\bgh\s+api\b/u;

// Pattern: a YAML `KEY: VALUE` entry inside an env block (VALUE is the
// rest of the line, captured verbatim). KEY must start with a letter
// and contain only alphanumerics + underscore so we don't confuse
// `${{ github.token }}` style nested mappings for top-level keys.
const ENV_ENTRY_RE = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*?)\s*$/u;

// Pattern: a line that introduces a top-level `env:` block (with only
// optional leading whitespace before `env:`).
const ENV_BLOCK_OPEN_RE = /^(\s*)env:\s*$/u;

type UsesEntry = Readonly<{ action: string; ref: string; file: string; line: number }>;

type EnvBlock = Readonly<{
  indent: number;
  startLine: number;
  entries: ReadonlyMap<string, string>;
}>;

type GhApiCall = Readonly<{
  file: string;
  line: number;
  indent: number;
  enclosingEnvBlocks: readonly EnvBlock[];
  hasGhToken: boolean;
}>;

function collectActionRefs(): readonly UsesEntry[] {
  const files = readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  const entries: UsesEntry[] = [];
  for (const file of files) {
    const text = readFileSync(join(WORKFLOWS_DIR, file), "utf8");
    const lines = text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const match = USES_LINE_RE.exec(lines[index] ?? "");
      if (match === null) continue;
      entries.push({
        action: match[1] ?? "",
        ref: match[2] ?? "",
        file,
        line: index + 1,
      });
    }
  }
  return entries;
}

/**
 * Parse a workflow file's lines and return every `gh api` invocation
 * along with the chain of enclosing env blocks (root → leaf). An env
 * block encloses the gh api call iff its indent is strictly less than
 * the gh api line's indent. Env-block entries are `KEY: VALUE` lines
 * at indent > block.indent and <= next-sibling-block.indent.
 */
function collectGhApiCalls(file: string, lines: readonly string[]): readonly GhApiCall[] {
  // Stack of open env blocks, innermost last. Each entry tracks its
  // own indent + entries added under it.
  type MutableEnvBlock = { indent: number; startLine: number; entries: Map<string, string> };
  const mutStack: MutableEnvBlock[] = [];

  const calls: GhApiCall[] = [];

  // `minEntryIndent(block)` = smallest indent of any entry seen so far.
  // We use it to decide whether a line still belongs to the current
  // block (indent > block.indent and > minEntryIndent) or popped to a
  // sibling/ancestor. To stay simple and correct: any line at indent
  // <= the innermost open block's indent closes that block.
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const lineNumber = i + 1;
    const indentMatch = /^( *)/u.exec(raw);
    const indent = indentMatch?.[1]?.length ?? 0;
    const content = raw.slice(indent);

    // Pop env blocks whose indent is strictly greater than this line's
    // indent (they ended on a previous line at a deeper level). Lines at
    // indent == env.indent are SIBLING keys (`run:`, `uses:`, `- name:`,
    // another `env:`, etc.) — they do NOT close the env block, because
    // the env block remains in scope for any sibling's nested content.
    // Only a line at indent STRICTLY LESS than the env block's indent
    // signals that we have left the env's parent context entirely.
    while (mutStack.length > 0) {
      const top = mutStack[mutStack.length - 1];
      if (top === undefined) break;
      if (top.indent > indent) {
        mutStack.pop();
      } else {
        break;
      }
    }

    // Open a new env block at this line?
    const envOpenMatch = ENV_BLOCK_OPEN_RE.exec(raw);
    if (envOpenMatch !== null) {
      mutStack.push({ indent, startLine: lineNumber, entries: new Map() });
      continue;
    }

    // Try to record an entry under the innermost env block.
    const entryMatch = ENV_ENTRY_RE.exec(raw);
    if (entryMatch !== null && mutStack.length > 0) {
      // Only treat as an env entry if this line is strictly deeper
      // than the innermost open block. A same-indent or shallower
      // `KEY: VALUE` is something else (e.g. `run:` at step level,
      // or a sibling YAML key).
      const innermost = mutStack[mutStack.length - 1];
      if (innermost !== undefined && indent > innermost.indent) {
        const key = entryMatch[1] ?? "";
        const value = entryMatch[2] ?? "";
        innermost.entries.set(key, value);
      }
    }

    // Is this a `gh api` invocation?
    if (GH_API_RE.test(content)) {
      const enclosingEnvBlocks: EnvBlock[] = mutStack.map((m) => ({
        indent: m.indent,
        startLine: m.startLine,
        entries: new Map(m.entries),
      }));
      const hasGhToken = enclosingEnvBlocks.some((b) => {
        const v = b.entries.get("GH_TOKEN");
        return v === "${{ github.token }}" || v === "${{ secrets.GITHUB_TOKEN }}";
      });
      calls.push({ file, line: lineNumber, indent, enclosingEnvBlocks, hasGhToken });
    }
  }

  return calls;
}

function collectAllGhApiCalls(): readonly GhApiCall[] {
  const files = readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  const calls: GhApiCall[] = [];
  for (const file of files) {
    const text = readFileSync(join(WORKFLOWS_DIR, file), "utf8");
    const lines = text.split(/\r?\n/u);
    calls.push(...collectGhApiCalls(file, lines));
  }
  return calls;
}

describe("release workflow action pins", () => {
  it("RELEASE-ACTION-PINS-NO-BUGGY-DOWNLOAD-ARTIFACT-SHA: no workflow pins download-artifact to a SHA that only exists in upload-artifact", () => {
    // Given: every `uses: actions/<NAME>@<REF>` line across all
    // `.github/workflows/*.yml` files.
    const entries = collectActionRefs();

    // When: any entry pins `actions/download-artifact` to the exact buggy
    // SHA from the v0.5.0 incident.
    const offenders = entries.filter((entry) => entry.action === "download-artifact" && entry.ref === BUGGY_DOWNLOAD_SHA);

    // Then: none exist. Listing them inline lets a future regression fail
    // with a diagnostic that points at the offending file + line.
    expect(
      offenders,
      `actions/download-artifact@${BUGGY_DOWNLOAD_SHA} appeared in ${offenders.length} place(s): ${offenders.map((o) => `${o.file}:${o.line}`).join(", ")}. ` +
        `That SHA exists in actions/upload-artifact (a commit dated 2026-04-10) but does NOT exist in actions/download-artifact. ` +
        `Use actions/download-artifact@v4 (the floating major tag) or a SHA that actually exists in the download-artifact repo.`,
    ).toEqual([]);
  });

  it("RELEASE-ACTION-PINS-NO-CROSS-ACTION-SHA-COLLISION: no two distinct actions share the same SHA pin", () => {
    // Given: every `actions/<NAME>@<SHA>` pin across all workflow files.
    const entries = collectActionRefs();
    const shaPins = entries.filter((entry) => SHA_RE.test(entry.ref));

    // When: we group by SHA. A real 40-char SHA is a unique content
    // address; two distinct actions cannot legitimately share it because
    // each `actions/<NAME>` repo has its own git history.
    const shaToActions = new Map<string, string[]>();
    for (const entry of shaPins) {
      const list = shaToActions.get(entry.ref) ?? [];
      list.push(entry.action);
      shaToActions.set(entry.ref, list);
    }
    const collisions = [...shaToActions.entries()]
      .map(([sha, actions]) => ({ sha, actions: [...new Set(actions)] }))
      .filter(({ actions }) => actions.length > 1);

    // Then: no SHA is pinned to two different actions. Listing the
    // collision(s) in the failure message gives the maintainer the exact
    // pair to disambiguate.
    expect(
      collisions,
      `the same SHA was pinned to multiple distinct actions (copy-paste indicator): ${collisions.map((c) => `${c.sha} -> [${c.actions.join(", ")}]`).join("; ")}. ` +
        `Each actions/<NAME> repo has an independent git history; a real SHA exists in exactly one repo. Sharing a SHA across repos is always a typo.`,
    ).toEqual([]);
  });

  it("RELEASE-WORKFLOW-GH-API-NEEDS-GH-TOKEN: every `gh api` invocation runs in a step whose env-block chain declares GH_TOKEN", () => {
    // Given: every `gh api` invocation in every workflow file, paired
    // with the chain of enclosing env blocks (YAML env-block
    // inheritance: a step-level env inherits from job-level env).
    const calls = collectAllGhApiCalls();

    // Sanity: if there are no `gh api` calls at all, the workflow
    // surface has shrunk — that's also worth flagging, because the
    // test would silently pass on an empty corpus.
    expect(
      calls.length,
      "expected at least one `gh api` invocation across .github/workflows/*.yml; the regression test would silently pass on an empty corpus.",
    ).toBeGreaterThan(0);

    // When: we filter for calls whose env-block chain does NOT include
    // `GH_TOKEN: ${{ github.token }}` (or the equivalent secrets form).
    const offenders = calls.filter((c) => !c.hasGhToken);

    // Then: none. The failure message enumerates every offending call
    // with its file:line so a future regression points at the exact
    // site to fix.
    const detail = offenders
      .map((o) => {
        const envSummary = o.enclosingEnvBlocks
          .map((b) => `env@indent=${b.indent}(${b.startLine}): [${[...b.entries.keys()].join(", ")}]`)
          .join(" | ") || "(no env block above this line)";
        return `${o.file}:${o.line} -> ${envSummary}`;
      })
      .join("; ");
    expect(
      offenders,
      `the following ${offenders.length} gh api call(s) ran without GH_TOKEN in any enclosing env block. ` +
        `GitHub CLI requires GH_TOKEN (or GITHUB_TOKEN) inside Actions workflows and aborts with ` +
        `"gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable." otherwise. ` +
        `Add \`GH_TOKEN: \${{ github.token }}\` to the step's env block (or a job-level env block above it): ${detail}`,
    ).toEqual([]);
  });
});