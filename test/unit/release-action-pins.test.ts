// SPDX-License-Identifier: MIT
// Regression test for v0.5.0 hotfix #2.
//
// Bug history (see `.omo/notepads/release-binary-download-size/learnings.md`):
// .github/workflows/release.yml pinned `actions/download-artifact` to the
// same 40-char SHA as `actions/upload-artifact` (`043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`).
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
// This file nails the contract that prevents recurrence:
//
//   1. The exact regression: `actions/download-artifact@043fb46d...` must
//      not appear anywhere under `.github/workflows/`. The literal SHA is
//      a copy-paste from upload-artifact and is invalid in download-artifact.
//
//   2. The general invariant: no two distinct `actions/<NAME>` references
//      may share the same 40-char SHA. A SHA collision across actions is
//      the structural signature of a copy-paste typo (different repos have
//      independent commit histories; a real SHA exists in exactly one repo).
//      A workflow that violates this would either fail at resolve time
//      (if the SHA happens to be invalid in one of the repos) or silently
//      pin the wrong code (if a future SHA collision occurred).
//
// The test does NOT hit the network. It is pure static analysis over the
// on-disk workflow YAML text — cheap, deterministic, and runs in CI on
// every PR. The `ci` workflow does not execute `release.yml` (it only
// runs lint/typecheck/unit tests), so this static check is the only
// pre-merge gate that can catch this class of bug.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const WORKFLOWS_DIR = join(REPO_ROOT, ".github", "workflows");

// The exact buggy SHA that motivated this test. If you change the value,
// you're not testing the bug anymore.
const BUGGY_DOWNLOAD_SHA = "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";

// Pattern: `uses: actions/<NAME>@<REF>` where REF is either a 40-char
// SHA (`[0-9a-f]{40}`) or a major-version tag (`v\d+`, with optional
// prerelease suffix). Captures NAME and REF.
const USES_LINE_RE = /^\s*uses:\s*actions\/([A-Za-z0-9_.-]+)@(\S+)\s*$/u;
const SHA_RE = /^[0-9a-f]{40}$/u;

type UsesEntry = Readonly<{ action: string; ref: string; file: string; line: number }>;

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
});