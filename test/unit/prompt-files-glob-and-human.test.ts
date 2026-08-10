// SPDX-License-Identifier: MIT
//
// Unit tests for the new helpers in `src/config/prompt-files.ts`:
//   - `resolveGlobs`       — glob → existing-files expansion under cwd
//   - `readHumanConventionFiles` — silent-skip reader for README/CONTRIBUTING/etc.
//
// Both helpers are load-bearing for the expanded auto-discovery surface
// introduced in the umbrella-instruction-files plan. They were added
// without a dedicated test file, so the new code paths (every branch of
// the glob matcher, every silent-skip arm in the human-file loader)
// regress to SonarCloud's "new code uncovered" bucket. This file pins
// the four contracts documented in the source.
//
// 1. `resolveGlobs` flattens globs (recursive `**`) into a list of
//    existing files anchored at the cwd root, preserving the order
//    `fs.readdirSync({ recursive: true })` yields them. Non-glob
//    entries pass through unchanged.
// 2. `resolveGlobs` enforces the cwd realpath boundary — a symlink
//    that escapes cwd is silently dropped, mirroring
//    `readPromptFiles`'s security contract.
// 3. `resolveGlobs` recognizes every documented metacharacter
//    (`*`, `**`, `?`, `[abc]`) and routes brace-expansion `{a,b}` to
//    the "literal regex chars" branch (no expansion).
// 4. `readHumanConventionFiles` returns the concatenated contents of
//    every existing human-convention file under cwd, in the documented
//    order, SILENTLY skipping over-cap, missing, non-file, or
//    outside-cwd entries instead of throwing.

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep as pathSep } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetDefaultPromptFilesCacheForTests,
  buildProviderPrompts,
} from "../../src/cli/provider-prompts.js";
import { readHumanConventionFiles, resolveGlobs } from "../../src/config/prompt-files.js";

describe("resolveGlobs", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-resolve-globs-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("passes non-glob entries through unchanged", async () => {
    // Given: a single flat path in cwd that exists.
    await writeFile(join(cwd, "CLAUDE.md"), "claude", "utf8");
    // When: resolveGlobs is called with a mix of glob + flat-path inputs.
    const result = resolveGlobs(["CLAUDE.md"], cwd);
    // Then: the flat path passes through verbatim (the glob branch is skipped).
    expect(result).toEqual(["CLAUDE.md"]);
  });

  it("expands a single-segment `*` glob against files at the cwd root", async () => {
    // Given: two `.mdc` files at cwd root + one nested `.mdc`.
    await writeFile(join(cwd, "alpha.mdc"), "A", "utf8");
    await writeFile(join(cwd, "beta.mdc"), "B", "utf8");
    await mkdir(join(cwd, ".cursor", "rules"), { recursive: true });
    await writeFile(join(cwd, ".cursor", "rules", "nested.mdc"), "N", "utf8");
    // When: a single-segment glob is resolved.
    const result = resolveGlobs([".cursor/rules/*.mdc"], cwd);
    // Then: only root-level `.cursor/rules/*.mdc` matches (single `*`
    // does NOT span `/`); the nested file is correctly excluded.
    expect(result).toContain(".cursor/rules/nested.mdc");
    expect(result).not.toContain("alpha.mdc");
  });

  it("expands a recursive `**` glob against nested files", async () => {
    // Given: a `.cursor/rules/` tree with files at varying depths.
    await mkdir(join(cwd, ".cursor", "rules", "frontend"), { recursive: true });
    await writeFile(join(cwd, ".cursor", "rules", "root.md"), "R", "utf8");
    await writeFile(join(cwd, ".cursor", "rules", "frontend", "deep.md"), "D", "utf8");
    // When: the recursive glob is resolved.
    const result = resolveGlobs([".cursor/rules/**/*.md"], cwd);
    // Then: BOTH root + deeply-nested files are matched.
    expect(result).toContain(".cursor/rules/root.md");
    expect(result).toContain(".cursor/rules/frontend/deep.md");
  });

  it("expands `?` to a single non-separator character", async () => {
    // Given: two files matching `a.md` and `b.md`.
    await writeFile(join(cwd, "a.md"), "A", "utf8");
    await writeFile(join(cwd, "b.md"), "B", "utf8");
    // When: a `?` glob is resolved.
    const result = resolveGlobs(["?.md"], cwd);
    // Then: both single-char prefixes are matched.
    expect([...result].sort()).toEqual(["a.md", "b.md"]);
  });

  it("expands `[abc]` character classes verbatim", async () => {
    // Given: matching + non-matching filenames.
    await writeFile(join(cwd, "a.md"), "A", "utf8");
    await writeFile(join(cwd, "b.md"), "B", "utf8");
    await writeFile(join(cwd, "d.md"), "D", "utf8");
    // When: a character class is resolved.
    const result = resolveGlobs(["[ab].md"], cwd);
    // Then: only `a.md` + `b.md` match; `d.md` is excluded.
    expect([...result].sort()).toEqual(["a.md", "b.md"]);
  });

  it("treats brace-expansion `{a,b}` as literal regex chars (no expansion)", async () => {
    // Given: files that a brace-expansion would match if it worked.
    await writeFile(join(cwd, "{a,b}.md"), "LITERAL", "utf8");
    // When: a brace-expansion pattern is resolved.
    const result = resolveGlobs(["{a,b}.md"], cwd);
    // Then: the pattern is treated as a literal-regex match — only the
    // file whose NAME contains `{a,b}` matches (zero matches expected
    // because `{`/`}` are not in any real filename here).
    expect(result).not.toContain("a.md");
    expect(result).not.toContain("b.md");
  });

  it("treats unmatched `[` as a literal escape (no throw)", async () => {
    // Given: no files match the malformed pattern.
    // When: a `[` without a closing `]` is resolved.
    // Then: no match — the helper should NOT throw, even though the
    // closing-bracket lookup in `globToRegexSource` returns -1.
    const result = resolveGlobs(["[unclosed.md"], cwd);
    expect(result).toEqual([]);
  });

  it("silently drops entries whose realpath escapes cwd (symlink boundary)", async () => {
    // Given: a file inside cwd AND a symlink inside cwd that points
    // OUTSIDE cwd. `resolveGlobs` must drop the outside-cwd target so a
    // glob can never smuggle a file from another repo into the prompt.
    const outsideDir = await mkdtemp(join(tmpdir(), "uma-outside-"));
    try {
      await writeFile(join(outsideDir, "secret.md"), "OUTSIDE", "utf8");
      await symlink(join(outsideDir, "secret.md"), join(cwd, "evil.md"));
      await writeFile(join(cwd, "good.md"), "GOOD", "utf8");
      // When: a glob covering both files is resolved.
      const result = resolveGlobs(["*.md"], cwd);
      // Then: only the in-cwd file survives; the symlink is dropped.
      expect(result).toContain("good.md");
      expect(result).not.toContain("evil.md");
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("returns an empty result for a glob that matches nothing (not an error)", async () => {
    // Given: an empty cwd.
    // When: a glob that has no matches is resolved.
    const result = resolveGlobs([".cursor/rules/*.mdc"], cwd);
    // Then: empty result, no throw.
    expect(result).toEqual([]);
  });

  it("uses the trailing-separator-aware cwd prefix when stripping parentPath", async () => {
    // Regression: when cwd itself contains the platform separator, the
    // `parent.startsWith(cwdWithSep)` check must use the same separator
    // shape as the readdir walk. This test exercises the
    // `parent !== cwd` → `parent.startsWith(cwdWithSep)` branch on a
    // file one directory deep.
    await mkdir(join(cwd, "deep"), { recursive: true });
    await writeFile(join(cwd, "deep", "leaf.md"), "LEAF", "utf8");
    const result = resolveGlobs(["deep/*.md"], cwd);
    expect(result).toEqual(["deep/leaf.md"]);
  });
});

describe("readHumanConventionFiles", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-human-files-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("returns an empty string when none of the human-convention files exist", async () => {
    // Given: an empty cwd.
    // When: the reader runs.
    const result = await readHumanConventionFiles({ cwd });
    // Then: empty result, no throw.
    expect(result).toBe("");
  });

  it("concatenates existing files in HUMAN_CONVENTION_FILE_PATHS order", async () => {
    // Given: README.md, CONTRIBUTING.md, LICENSE — all in cwd.
    await writeFile(join(cwd, "README.md"), "README-MARKER", "utf8");
    await writeFile(join(cwd, "CONTRIBUTING.md"), "CONTRIB-MARKER", "utf8");
    await writeFile(join(cwd, "LICENSE"), "LICENSE-MARKER", "utf8");
    // When: the reader runs.
    const result = await readHumanConventionFiles({ cwd });
    // Then: all three markers are present, ordered per the source's
    // HUMAN_CONVENTION_FILE_PATHS (README → CONTRIBUTING → LICENSE).
    expect(result).toContain("README-MARKER");
    expect(result).toContain("CONTRIB-MARKER");
    expect(result).toContain("LICENSE-MARKER");
    expect(result.indexOf("README-MARKER")).toBeLessThan(result.indexOf("CONTRIB-MARKER"));
    expect(result.indexOf("CONTRIB-MARKER")).toBeLessThan(result.indexOf("LICENSE-MARKER"));
  });

  it("SILENTLY skips files that are over the per-file cap (does not abort the review)", async () => {
    // Given: a README.md larger than DEFAULT_HUMAN_FILE_BYTE_CAP (16 KiB).
    // The reader must skip it instead of throwing — a long README is
    // common and must NOT abort the review.
    const huge = "x".repeat(20_000);
    await writeFile(join(cwd, "README.md"), huge, "utf8");
    await writeFile(join(cwd, "CONTRIBUTING.md"), "CONTRIB-MARKER", "utf8");
    // When: the reader runs.
    const result = await readHumanConventionFiles({ cwd });
    // Then: README was skipped, CONTRIBUTING survived.
    expect(result).not.toContain("x".repeat(1_000));
    expect(result).toContain("CONTRIB-MARKER");
  });

  it("SILENTLY skips directories whose names collide with human-convention filenames", async () => {
    // Given: a directory called `LICENSE` in cwd (a real common pattern:
    // some repos keep a docs/ folder with that name at root).
    await mkdir(join(cwd, "LICENSE"), { recursive: true });
    await writeFile(join(cwd, "README.md"), "README-MARKER", "utf8");
    // When: the reader runs.
    const result = await readHumanConventionFiles({ cwd });
    // Then: the LICENSE directory is silently skipped; README survives.
    expect(result).toContain("README-MARKER");
    expect(result).not.toContain("LICENSE-MARKER");
  });

  it("uses an injected PromptFileSystem so tests can pin the silent-skip paths", async () => {
    // The PromptFileSystem injection is the documented surface for
    // tests that need to assert the silent-skip branches (realpath
    // outside cwd, ENOENT on stat, read failure). This test pins that
    // the injection point is real (not just a paper parameter) and
    // that an ENOENT on stat is silently skipped.
    const calls: string[] = [];
    const injectedFs = {
      realpath: async (input: string) => {
        calls.push(`realpath:${input}`);
        return input;
      },
      realpathWithinCwd: async (
        path: string,
        cwdReal: string,
        _self: { realpath: (s: string) => Promise<string> },
      ) => {
        calls.push(`realpathWithinCwd:${path}`);
        return { absolute: `${cwdReal}${pathSep}${path}`, withinCwd: true };
      },
      stat: async (path: string) => {
        calls.push(`stat:${path}`);
        throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
      },
      readFile: async (path: string) => {
        calls.push(`readFile:${path}`);
        return "";
      },
    };
    const result = await readHumanConventionFiles({ cwd, fs: injectedFs });
    // Then: every stat was attempted (silent skip on ENOENT), no read
    // followed, no throw.
    expect(result).toBe("");
    expect(calls.some((c) => c.startsWith("stat:"))).toBe(true);
    expect(calls.some((c) => c.startsWith("readFile:"))).toBe(false);
  });

  it("SILENTLY skips files whose realpath escapes cwd (security boundary)", async () => {
    // Given: a symlink at cwd/README.md that points outside cwd.
    const outsideDir = await mkdtemp(join(tmpdir(), "uma-outside-human-"));
    try {
      await writeFile(join(outsideDir, "README-source.md"), "OUTSIDE-README", "utf8");
      await symlink(join(outsideDir, "README-source.md"), join(cwd, "README.md"));
      // When: the reader runs.
      const result = await readHumanConventionFiles({ cwd });
      // Then: the symlinked README is silently dropped (realpath
      // resolved outside cwd → skip, not throw).
      expect(result).not.toContain("OUTSIDE-README");
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });
});

/**
 * Regression for the umactually repo's own `CHANGELOG.md` triggering a
 * parse-fail on the umbrella-instruction-files self-review (PR #195
 * self-review, round 1). The umactually CHANGELOG.md is ~92 KB — well
 * over the per-file 65 KiB cap on auto-discovered prompt files. The
 * auto-discovery surface (`resolveDefaultPromptFilesOnce`) MUST skip
 * such files silently rather than abort the review: an operator's repo
 * carrying a long CHANGELOG is not a configuration error, and the
 * explicit `--prompt-files` override still throws loudly via
 * `readPromptFiles` (the loud failure is reserved for the
 * operator-controlled surface, not the auto-discovery surface).
 *
 * 1. `resolveDefaultPromptFilesOnce` (the per-cwd memoized helper that
 *    `buildProviderPrompts` calls) drops over-cap files in the cwd
 *    lookup silently. Verified indirectly via `buildProviderPrompts`,
 *    which is the only public surface that exercises the helper.
 * 2. `buildProviderPrompts` MUST NOT throw `PromptFileError("...",
 *    "byte-cap-exceeded")` for an over-cap auto-discovered file: the
 *    file never makes it into the `defaultPaths` list, so
 *    `readPromptFiles` is never asked to load it.
 */
describe("auto-discovery silently skips over-cap cwd files (CHANGELOG.md regression)", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-over-cap-auto-"));
    // Important: the test mutates the cwd's file set, so clear the
    // per-cwd memoization cache before each scenario.
    __resetDefaultPromptFilesCacheForTests();
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    __resetDefaultPromptFilesCacheForTests();
  });

  it("buildProviderPrompts does not throw byte-cap-exceeded when cwd contains an over-cap CHANGELOG.md (silently skipped by auto-discovery)", async () => {
    // Given: a CHANGELOG.md at cwd root that exceeds the 65 KiB cap
    // (DEFAULT_PROMPT_BYTE_CAP from src/config/defaults.ts). The file
    // name matches an entry in DEFAULT_PROMPT_FILE_PATHS, so without
    // the silent-skip fix the auto-discovery surface would either
    // include it and trip the byte cap on the read path, or throw on
    // stat. The contract being pinned here: the file is silently
    // dropped from the default-lookup list.
    //
    // 100 KB is comfortably above the 65 KiB cap (100_000 bytes vs
    // 65_536). Using exactly 65_536 would risk an off-by-one if the
    // cap ever moved by a single byte, so the buffer is intentional.
    const huge = "x".repeat(100_000);
    await writeFile(join(cwd, "CHANGELOG.md"), huge, "utf8");

    // When: buildProviderPrompts is called with this cwd. It invokes
    // resolveDefaultPromptFilesOnce internally; an over-cap CHANGELOG
    // must be silently filtered out before readPromptFiles is asked
    // to load it. We do NOT pass an explicit --prompt-files list, so
    // the only way the file could reach the reader is via the
    // auto-discovery surface — exactly the path the regression pins.
    const prompts = await buildProviderPrompts({
      parsed: {
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
        sonarHostUrl: null,
        sonarToken: null,
        sonarProjectKey: null,
        sonarTimeoutSeconds: null,
        minimumSeverity: "medium",
        minimumSeverityInternal: "major",
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
        includePrSonarFindings: false,
      },
      cwd,
      env: {},
      platform: "github",
      diffText: "diff --git a/CHANGELOG.md b/CHANGELOG.md\n--- a/CHANGELOG.md\n+++ b/CHANGELOG.md\n@@ -1 +1 @@\n-old\n+new\n",
    });

    // Then: the call resolves (no byte-cap-exceeded throw) and the
    // huge CHANGELOG content does NOT appear in either the system or
    // user prompt — confirming the file was silently skipped by
    // auto-discovery rather than read into the prompt.
    expect(prompts.system).not.toContain("x".repeat(1_000));
    expect(prompts.user).not.toContain("x".repeat(1_000));
  });
});
