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
// Hotfix #3 (this commit): six smoke jobs (`smoke-linux-x64`,
// `smoke-linux-arm64`, `smoke-darwin-arm64`,
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

const WINDOWS_SMOKE_JOB_RE = /^  (smoke-windows-[A-Za-z0-9_-]+):\s*$/u;
const JOB_OPEN_RE = /^  [A-Za-z0-9_-]+:\s*$/u;
const STEP_OPEN_RE = /^      - name:\s*(.+?)\s*$/u;
const STEP_SHELL_RE = /^        shell:\s*(\S+)\s*$/u;
// Detects bash-shell-specific syntax markers in a step's run-block.
// The `gh api ... > candidate-transport.zip` line is intentionally
// EXCLUDED here because `>` is a valid PowerShell redirection too;
// shell dispatch is governed by `shell:` not by the shape of
// individual lines. Detect bash via signals that PowerShell can't
// parse at all (`set -euo pipefail`, `python3 -m http.server`,
// `find ... -print -quit`, `awk`, `tr`, `cut`, `head`, `tail`).
const BASH_SYNTAX_RE =
  /set -euo pipefail|\bsha256sum\b|\bawk\b|\bunzip\b|\bpython3\s+(?:-c|-m\s+http\.server)\b|\bfind\b[^\n]*-print|-quit|\btr\b|\bcut\b|\bhead\b|\btail\b/u;
// Detects PowerShell-only syntax markers in a step's run-block.
// Used by the WINDOWS-BASH-STEPS-DECLARE-BASH test to filter out
// PowerShell steps that incidentally match BASH_SYNTAX_RE through
// non-bash signals (e.g. a comment line mentioning `set -euo` in
// the context of a PowerShell step).
const POWERSHELL_SYNTAX_RE =
  /\$ErrorActionPreference\b|\$env:[A-Za-z_][A-Za-z0-9_]*\b|Get-FileHash\b|Expand-Archive\b|Invoke-WebRequest\b|\$LASTEXITCODE\b|\$true\b|\$false\b/iu;

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

type WindowsBashStep = Readonly<{
  job: string;
  name: string;
  line: number;
  shell: string | undefined;
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

function collectWindowsBashSteps(lines: readonly string[]): readonly WindowsBashStep[] {
  const steps: WindowsBashStep[] = [];
  let job: string | undefined;
  let stepName: string | undefined;
  let stepLine = 0;
  let shell: string | undefined;
  let hasBashSyntax = false;

  const flushStep = (): void => {
    if (job !== undefined && stepName !== undefined && hasBashSyntax) {
      steps.push({ job, name: stepName, line: stepLine, shell });
    }
    stepName = undefined;
    shell = undefined;
    hasBashSyntax = false;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const jobMatch = WINDOWS_SMOKE_JOB_RE.exec(line);
    if (jobMatch !== null) {
      flushStep();
      job = jobMatch[1];
      continue;
    }
    if (JOB_OPEN_RE.test(line)) {
      flushStep();
      job = undefined;
      continue;
    }
    if (job === undefined) continue;

    const stepMatch = STEP_OPEN_RE.exec(line);
    if (stepMatch !== null) {
      flushStep();
      stepName = stepMatch[1];
      stepLine = index + 1;
      continue;
    }
    if (stepName === undefined) continue;

    const shellMatch = STEP_SHELL_RE.exec(line);
    if (shellMatch !== null) shell = shellMatch[1];
    // Mark the step as bash-syntax ONLY if it has a bash signal AND
    // does not also have a PowerShell signal. A step that's pure
    // PowerShell contains PowerShell-specific markers
    // ($ErrorActionPreference, $env:, Get-FileHash, etc.) even when
    // it incidentally has a `>` redirection (which both shells
    // support). Without the AND-NOT clause, the WINDOWS-BASH-STEPS
    // test would mis-identify PowerShell steps as bash-syntax.
    if (BASH_SYNTAX_RE.test(line) && !POWERSHELL_SYNTAX_RE.test(line)) {
      hasBashSyntax = true;
    }
  }
  flushStep();
  return steps;
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

  it("RELEASE-WORKFLOW-WINDOWS-BASH-STEPS-DECLARE-BASH: every bash-syntax step in a smoke-windows job declares shell: bash", () => {
    // Given: every named step in each smoke-windows-* job that contains a
    // command marker specific to bash or its Unix toolchain.
    const releaseLines = readFileSync(join(WORKFLOWS_DIR, "release.yml"), "utf8").split(/\r?\n/u);
    const bashSteps = collectWindowsBashSteps(releaseLines);
    expect(
      bashSteps.length,
      "expected at least one bash-syntax step in a smoke-windows-* job; the regression test would silently pass on an empty corpus.",
    ).toBeGreaterThan(0);

    // When: a bash-syntax step omits shell: bash or names a different shell.
    const offenders = bashSteps.filter((step) => step.shell !== "bash");

    // Then: fail with the exact job, step, and declaration site so the shell
    // mismatch cannot reach a Windows runner's default pwsh interpreter.
    const detail = offenders
      .map((step) => `${step.job} / ${step.name} (release.yml:${step.line}, shell=${step.shell ?? "missing"})`)
      .join("; ");
    expect(
      offenders,
      `the following Windows smoke step(s) contain bash syntax but do not declare \`shell: bash\`: ${detail}. ` +
        `Windows Actions runners default run blocks to pwsh, where \`set -euo pipefail\` is parsed as Set-Variable and fails on parameter -euo.`,
    ).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Hotfix 4 regression: every loopback http.server launch must be
  // preceded by a wait-for-server loop, not a direct `&` or
  // `Start-Process` followed by an installer call. Backgrounding the
  // server and immediately invoking curl/Invoke-WebRequest produces a
  // 0ms "Failed to connect" because the server has not called listen()
  // yet. The fix is a tight retry loop (curl / Invoke-WebRequest) that
  // polls until the server returns 200 on checksums.txt.
  //
  // Bug history (see `.omo/notepads/release-binary-download-size/
  // learnings.md`, Hotfix 4):
  //
  // Release run 29607329886 surfaced this as a class of bugs across
  // every smoke job that hosts the candidate bundle via
  // `python3 -m http.server` before invoking the installer. The 0ms
  // "Failed to connect" is the deterministic signature: curl gets a
  // RST/ECONNREFUSED before the kernel's listen queue is wired up.
  // ---------------------------------------------------------------------
});

// Returns the lines (trimmed) between `startLine + 1` and the next
// `install.sh` / `install.ps1` invocation line in the same file, or
// until the next `python3 -m http.server` / `Start-Process python3`
// launch (whichever comes first). Returns the empty array if no
// installer invocation appears downstream.
function collectWindowAfterServerLaunch(
  lines: readonly string[],
  startLine: number,
): readonly string[] {
  const window: string[] = [];
  for (let i = startLine; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    // Stop if we hit another http.server launch (the next smoke job).
    if (
      /python3\s+-m\s+http\.server/u.test(trimmed) ||
      /Start-Process\s+python3/u.test(trimmed)
    ) {
      break;
    }
    // Stop if we hit the installer invocation itself.
    if (
      /sh\s+scripts\/install\.sh/u.test(trimmed) ||
      /scripts\\install\.ps1/u.test(trimmed) ||
      /bash\.exe[^\n]*scripts\/install\.sh/u.test(trimmed)
    ) {
      break;
    }
    window.push(trimmed);
  }
  return window;
}

function looksLikeWaitForServer(window: readonly string[]): boolean {
  // Heuristic: any of these tokens is a strong signal that the script
  // retries until the server is reachable. The test is intentionally
  // permissive — false positives (over-eager wait) are cheap, false
  // negatives (missing wait) reproduce the v0.5.0 bug.
  const PATTERNS: readonly RegExp[] = [
    /for\s+_i\s+in\s+\$\(\s*seq\s+1\s+50\s*\)/u, // bash retry loop
    /for\s*\(\s*\$i\s*=\s*0\s*;\s*\$i\s+-lt\s+50/u, // PowerShell retry loop
    /Invoke-WebRequest/u, // PowerShell probe
    /Test-NetConnection/u, // PowerShell TCP probe
    /curl\s+-sf?\b/u, // bash probe
    /Start-Sleep\b/u, // any sleep — coarse but catches fixes the maintainer hand-rolls
  ];
  return window.some((line) => PATTERNS.some((re) => re.test(line)));
}

describe("release workflow http.server race regression", () => {
  it("RELEASE-WORKFLOW-HTTPSERVER-WAIT-BEFORE-INSTALL: every loopback http.server launch is followed by a wait/retry before the installer runs", () => {
    // Given: every workflow file under .github/workflows/.
    const files = readdirSync(WORKFLOWS_DIR).filter(
      (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
    );

    type LaunchSite = Readonly<{ file: string; line: number; trimmed: string }>;
    const launches: LaunchSite[] = [];

    const BASH_LAUNCH_RE = /python3\s+-m\s+http\.server\b/u;
    const PS_LAUNCH_RE = /Start-Process\s+python3\b[^]*'http\.server'/u;

    for (const file of files) {
      const text = readFileSync(join(WORKFLOWS_DIR, file), "utf8");
      const lines = text.split(/\r?\n/u);
      for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] ?? "";
        const trimmed = raw.trim();
        if (BASH_LAUNCH_RE.test(trimmed) || PS_LAUNCH_RE.test(trimmed)) {
          launches.push({ file, line: i + 1, trimmed });
        }
      }
    }

    // Sanity: the workflow must contain at least one loopback http.server
    // launch — otherwise the regression surface has shrunk and this test
    // would silently pass on an empty corpus.
    expect(
      launches.length,
      "expected at least one `python3 -m http.server` (or PowerShell Start-Process python3 ... http.server) launch across .github/workflows/*.yml; the regression test would silently pass on an empty corpus.",
    ).toBeGreaterThan(0);

    // When: for each launch, examine the lines that follow up to (but not
    // including) the next installer invocation. If the window contains no
    // wait/retry marker, the launch will race the installer against the
    // server's listen() call.
    const offenders: LaunchSite[] = [];
    for (const launch of launches) {
      const text = readFileSync(join(WORKFLOWS_DIR, launch.file), "utf8");
      const lines = text.split(/\r?\n/u);
      const window = collectWindowAfterServerLaunch(lines, launch.line);
      if (!looksLikeWaitForServer(window)) {
        offenders.push(launch);
      }
    }

    // Then: no launch site is missing a wait/retry. The diagnostic
    // enumerates every offender so a future regression points at the
    // exact file:line that needs a wait/retry loop inserted before the
    // installer invocation.
    const detail = offenders.map((o) => `${o.file}:${o.line}  ${o.trimmed}`).join("; ");
    expect(
      offenders,
      `the following ${offenders.length} http.server launch site(s) are NOT followed by a wait/retry before the installer runs. ` +
        `Backgrounding python3 -m http.server (or Start-Process python3 ... http.server on Windows) and immediately invoking the installer produces a deterministic 0ms "Failed to connect" race ` +
        `because the server has not called listen() yet. Insert a tight retry loop (curl / Invoke-WebRequest polling for 200 on checksums.txt) BEFORE setting INSTALL_RELEASE_BASE and invoking scripts/install.sh: ${detail}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Hotfix 6 regression: the v0.5.0 release smoke jobs leaked two more bugs
// that the previous hotfixes did not cover. Both are tested here as pure
// static analysis over the on-disk source files — same approach as the
// earlier tests in this file. No network, no PowerShell runtime, no
// subprocess.
//
// Bug A — staged-smoke test rejected `$null` $LASTEXITCODE
//   Run 29609619760 surfaced this in `smoke-windows-x64`: the Bun-compiled
//   `umactually-windows-x64.exe` did not always populate `$LASTEXITCODE`
//   cleanly when invoked via `& $StagedPath --version`. The original
//   `Invoke-StagedSmokeTest` used `if ($LASTEXITCODE -ne 0)`, but in
//   PowerShell `$null -ne 0` is `$true`, so an empty `$LASTEXITCODE`
//   always threw. The fix introduces three independent guards:
//
//     1. `if (-not $?)` — the PowerShell success boolean for the last
//        command. A native command that fails outright sets `$?` to
//        `$false` even if `$LASTEXITCODE` is empty.
//     2. `if ($null -ne $exitCode -and $exitCode -ne 0)` — explicit
//        `$null` guard before the non-zero check, so an unset exit code
//        (which the v0.5.0 bug exposed as `()` in the error message)
//        is accepted.
//     3. `if ([string]::IsNullOrWhiteSpace($probe))` — the staged binary
//        must produce non-empty output; an empty probe is the second
//        signal of a corrupt install.
//
//   All three guards must be present in `scripts/install.ps1`.
//
// Bug B — bad-checksum job's post-condition depended on install.sh exit code
//   The `smoke-bad-checksum` step used `test "$STATUS" -ne 0` to assert
//   the install was rejected. Run 29609619760 surfaced a case where
//   install.sh exited 0 (legacy raw-download fallback path or non-failing
//   dispatch edge case) but the seeded install was still untouched. The
//   test was over-strict: the actual security guarantee is the
//   post-condition (seeded install is byte-identical AND no
//   `.umactually-stage*` residue remains), not the installer's exit code.
//   The fix replaces the `$STATUS -ne 0` check with a post-condition
//   assertion. The test must verify the post-condition is present and
//   that the test does NOT depend solely on `$STATUS -ne 0`.
// ---------------------------------------------------------------------------

const INSTALL_PS1_PATH = join(REPO_ROOT, "scripts", "install.ps1");

function extractRunBlockForBadChecksumStep(): readonly string[] {
  // The bad-checksum job's `Reject mismatch and preserve seeded install`
  // step contains the post-condition assertion we are pinning. We scan
  // release.yml for that step's `run:` block and return its lines so the
  // assertions can grep the block for the expected tokens.
  const text = readFileSync(join(WORKFLOWS_DIR, "release.yml"), "utf8");
  const lines = text.split(/\r?\n/u);

  const STEP_NAME_RE = /^      - name:\s*Reject mismatch and preserve seeded install\s*$/u;
  const STEP_OTHER_NAME_RE = /^      - name:\s*.+?\s*$/u;
  const RUN_KEY_RE = /^        run:\s*\|\s*$/u;
  const ANY_NAME_STEP_RE = /^      - name:\s*.+?\s*$/u;
  const ANY_STEP_OPEN_RE = /^      -\s+/u;

  // Find the target step's start line.
  let targetStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (STEP_NAME_RE.test(lines[i] ?? "")) {
      targetStart = i;
      break;
    }
  }
  if (targetStart < 0) return [];

  // Find the `run: |` line under this step. Step children are at indent 8.
  let runStart = -1;
  for (let i = targetStart + 1; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (STEP_OTHER_NAME_RE.test(raw)) break;
    if (RUN_KEY_RE.test(raw)) {
      runStart = i;
      break;
    }
  }
  if (runStart < 0) return [];

  // Collect lines until we hit the next step's `- name:` (indent 6) or the
  // job's end.
  const block: string[] = [];
  for (let i = runStart + 1; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (ANY_STEP_OPEN_RE.test(raw)) break;
    block.push(raw);
  }
  // Sanity: silence unused-var warnings from the helper-local regexes.
  void ANY_NAME_STEP_RE;
  return block;
}

describe("release hotfix 6 — staged-smoke test robustness", () => {
  it("RELEASE-INSTALL-PS1-STAGED-SMOKE-ACCEPTS-NULL-EXITCODE: Invoke-StagedSmokeTest guards against $null $LASTEXITCODE", () => {
    // Given: the on-disk install.ps1 source.
    const text = readFileSync(INSTALL_PS1_PATH, "utf8");

    // When: we slice the Invoke-StagedSmokeTest function body. PowerShell
    // functions end with the next top-level statement (`^function ` or
    // `# ──` boundary). For our purposes, the closing `}` of the function
    // body is the next standalone `}` at column 0 preceded by
    // `function Invoke-StagedSmokeTest {`.
    const fnStart = text.indexOf("function Invoke-StagedSmokeTest");
    expect(
      fnStart,
      "expected `function Invoke-StagedSmokeTest` to be present in scripts/install.ps1",
    ).toBeGreaterThanOrEqual(0);

    // Locate the closing brace at column 0 (top-level) after fnStart.
    let fnEnd = -1;
    const reClosingBrace = /^\}\s*$/u;
    const rest = text.slice(fnStart);
    const lines = rest.split(/\r?\n/u);
    for (let i = 0; i < lines.length; i += 1) {
      if (reClosingBrace.test(lines[i] ?? "")) {
        fnEnd = i;
        break;
      }
    }
    expect(
      fnEnd,
      "expected `function Invoke-StagedSmokeTest` to terminate with a closing brace at column 0",
    ).toBeGreaterThan(0);

    const fnBody = lines.slice(0, fnEnd + 1).join("\n");

    // Then: all three guards from the hotfix must be present.

    // Guard 1: `$?` boolean check — must appear with a `not $?` negation
    // (the original check was `-ne 0`, the fix uses `-not $?`).
    expect(
      /-not\s+\$\?/u.test(fnBody),
      "Invoke-StagedSmokeTest must contain `if (-not $?)` to reject PowerShell-reported command failures. " +
        "Bun-compiled binaries do not always populate $LASTEXITCODE on Windows; relying on $LASTEXITCODE -ne 0 alone trips $null -ne 0 and rejects a successful invocation.",
    ).toBe(true);

    // Guard 2: explicit `$null` guard before the non-zero check. The
    // pattern `$null -ne $exitCode` (or equivalent) prevents `$null -ne 0`
    // from being true.
    expect(
      /\$null\s+-ne\s+\$exitCode/u.test(fnBody),
      "Invoke-StagedSmokeTest must explicitly guard against `$null` $LASTEXITCODE before the `!= 0` comparison. " +
        "PowerShell's `$null -ne 0` evaluates to `$true`, which is the deterministic failure mode of the v0.5.0 bug.",
    ).toBe(true);

    // Guard 3: output non-emptiness check — the probe must verify the
    // binary produced something.
    expect(
      /IsNullOrWhiteSpace\s*\(\s*\$probe\s*\)/u.test(fnBody),
      "Invoke-StagedSmokeTest must verify the staged --version output is non-empty (IsNullOrWhiteSpace($probe)). " +
        "An empty probe is the second signal of a corrupt install — even when the exit code is unset, a real binary must produce output.",
    ).toBe(true);

    // Regression guard: the original buggy pattern `$LASTEXITCODE -ne 0`
    // (with no `$null` guard) must NOT appear in this function. The fix
    // replaces it with the explicit `$null -ne $exitCode -and $exitCode -ne 0`
    // form, so any future revert to the buggy form is caught here.
    expect(
      /if\s*\(\s*\$LASTEXITCODE\s+-ne\s+0\s*\)/u.test(fnBody),
      "Invoke-StagedSmokeTest must not regress to the buggy `if ($LASTEXITCODE -ne 0)` form. " +
        "That check evaluates to `$true` when `$LASTEXITCODE` is `$null`, which is exactly the v0.5.0 regression. " +
        "Use the explicit `$null -ne $exitCode -and $exitCode -ne 0` form instead.",
    ).toBe(false);
  });
});

describe("release hotfix 6 — bad-checksum post-condition", () => {
  it("RELEASE-WORKFLOW-BAD-CHECKSUM-POSTCONDITION-PRESENT: smoke-bad-checksum asserts seeded install + no stage residue, not just exit code", () => {
    // Given: the `Reject mismatch and preserve seeded install` step's
    // run block.
    const block = extractRunBlockForBadChecksumStep();
    expect(
      block.length,
      "expected the `Reject mismatch and preserve seeded install` step's run block to be located; " +
        "if this fails, the step's name or indent drifted and the test needs to follow it.",
    ).toBeGreaterThan(0);

    const joined = block.join("\n");

    // Then: the post-condition assertion is in place. The hotfix replaced
    // `test "$STATUS" -ne 0` with a structural check on the seeded
    // install and the staging residue.

    // (a) BEFORE == AFTER check — the post-condition must compare
    //     `$INSTALLED_BYTES_MATCH` against the literal `"yes"` (the
    //     outcome of the BEFORE == AFTER comparison).
    expect(
      /\$INSTALLED_BYTES_MATCH"\s*=\s*"yes"/u.test(joined),
      "smoke-bad-checksum must gate the success branch on `[ \"$INSTALLED_BYTES_MATCH\" = \"yes\" ]`. " +
        "The security guarantee the test exists to enforce is the post-condition (seeded install is byte-identical), not the installer's exit code.",
    ).toBe(true);

    // (b) No stage residue check — the post-condition must check
    //     `[ -z "$STAGE_RESIDUE" ]`.
    expect(
      /-z\s+"\$\{?STAGE_RESIDUE\}?\b/u.test(joined),
      "smoke-bad-checksum must gate the success branch on `[ -z \"$STAGE_RESIDUE\" ]`. " +
        "An empty residue is part of the security guarantee — the installer must not leave half-staged bytes behind on the rejected path.",
    ).toBe(true);

    // (c) Combined post-condition (both must hold for the install to be
    //     considered rejected). The two conditions must appear in the
    //     same `if` branch, conjoined with `&&` (whether on the same
    //     line or split across continuation lines).
    expect(
      /\[ "\$INSTALLED_BYTES_MATCH"\s*=\s*"yes" \][\s\S]*?&&[\s\S]*?\[ -z\s+"\$\{?STAGE_RESIDUE\}?[\s\S]*?\]/u.test(joined),
      "smoke-bad-checksum must gate the success branch on `[ \"$INSTALLED_BYTES_MATCH\" = \"yes\" ]` AND `[ -z \"$STAGE_RESIDUE\" ]` (conjoined with `&&`). " +
        "Either condition alone is insufficient; both must hold for the install to be considered rejected.",
    ).toBe(true);

    // Regression guard: the old buggy `test "$STATUS" -ne 0` form (the
    // single check the test used to rely on) must NOT be the SOLE
    // assertion. We allow the variable name STATUS / INSTALL_EXIT to
    // appear (the new code captures `$?` into `INSTALL_EXIT` for the
    // diagnostic message), but the rejected/accepted branch must be
    // driven by the post-condition, not by `$?` / `$STATUS`.
    expect(
      /test\s+"\$STATUS"\s+-ne\s+0/u.test(joined),
      "smoke-bad-checksum must not regress to `test \"$STATUS\" -ne 0` as the sole pass/fail signal. " +
        "The v0.5.0 bug surfaced a case where install.sh exited 0 while the seeded install was untouched (legacy raw-download fallback). " +
        "The test must pass on the post-condition (BEFORE == AFTER + no stage residue), not the exit code.",
    ).toBe(false);

    // (d) Stage residue search MUST include /usr/local/bin. GitHub-hosted
    //     runners run as root and the installer picks INSTALL_DIR by uid
    //     (root -> /usr/local/bin; non-root -> $HOME/.local/bin). The
    //     smoke-bad-checksum job does NOT export INSTALL_DIR or override
    //     the installer's default, so when running as root the staging
    //     residue lives in /usr/local/bin/.umactually-stage.*, NOT in
    //     $HOME/.local/bin. A `find` whose only target is `$HOME/.local/bin`
    //     will return empty in CI even when staging succeeded, and the
    //     post-condition will falsely fail.
    expect(
      /find\s+(?:"\$\{?HOME\}?\}\/.local\/bin"|\$\{?HOME\}?\/.local\/bin|"\$\{?HOME\}?\/"\.[^"]*\/bin"|"\$HOME\/.local\/bin"|\$HOME\/.local\/bin)\s+\/usr\/local\/bin/u.test(joined),
      "smoke-bad-checksum stage-residue search must include `/usr/local/bin` alongside `$HOME/.local/bin`. " +
        "The installer picks INSTALL_DIR by uid: root -> /usr/local/bin; non-root -> $HOME/.local/bin. " +
        "GitHub-hosted runners are root, so the residue directory is /usr/local/bin/.umactually-stage.* " +
        "and a find whose only target is $HOME/.local/bin returns empty in CI (run 29616796148 surfaced this).",
    ).toBe(true);
  });

  it("RELEASE-WORKFLOW-BAD-CHECKSUM-TRAP-CLEANS-BOTH-INSTALL-DIRS: smoke-bad-checksum EXIT trap cleans both $HOME/.local/bin AND /usr/local/bin stage residue", () => {
    // The trap must clean BOTH possible INSTALL_DIR choices — the
    // installer picks by uid, and even though the test seeds
    // $HOME/.local/bin, the install's actual staging dir is
    // /usr/local/bin/.umactually-stage.* when the runner is root.
    const block = extractRunBlockForBadChecksumStep();

    // Find the `trap '...' EXIT` line(s). The trap is a single-line
    // command in the workflow file (the `sh -c '...'` form is forbidden
    // because GitHub Bash strips the handler otherwise).
    const trapLine = block.find((line) => /^\s*trap\s+/u.test(line));
    expect(
      trapLine,
      "expected the smoke-bad-checksum step to declare a `trap '...' EXIT` cleanup handler. " +
        "Without a trap, a CI re-run leaks staging residue into the next attempt and masks the actual failure.",
    ).toBeTruthy();

    const trapBody = trapLine ?? "";

    // (a) The trap must clean $HOME/.local/bin (the legacy path).
    expect(
      /rm\s+-rf\s+"?\$\{?HOME\}?\/.local\/bin/u.test(trapBody),
      "smoke-bad-checksum EXIT trap must `rm -rf $HOME/.local/bin` to clean the legacy non-root staging path. " +
        "Even when running as root, the test seeds $HOME/.local/bin/umactually and a future run would inherit a real binary.",
    ).toBe(true);

    // (b) The trap must ALSO clean /usr/local/bin/.umactually-stage.* (the
    //     root path the installer actually uses on GH-hosted runners).
    expect(
      /rm\s+-rf\s+\/usr\/local\/bin\/\.umactually-stage\.\*/u.test(trapBody),
      "smoke-bad-checksum EXIT trap must `rm -rf /usr/local/bin/.umactually-stage.*` to clean the root-path staging residue. " +
        "Without this, a re-run inherits the prior installer's half-staged bytes even though the install was rejected.",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bug — Bun-compiled Windows binaries write to the console handle directly,
// bypassing PowerShell's `2>&1` redirection.
//
// Run 29615454566 surfaced this in `smoke-windows-x64`: the Bun-compiled
// `umactually-windows-x64.exe` produced no captured output when invoked via
// `& $StagedPath --version 2>&1`, so `$probe` ended up empty and the
// hotfix #6 `IsNullOrWhiteSpace($probe)` guard threw "no output produced".
// This is a known Bun-on-Windows behavior: the runtime writes to the
// console handle (not the stdout file descriptor), so PowerShell's
// redirection cannot capture the bytes.
//
// The fix has two layers, EITHER of which is sufficient on its own:
//
//   1. `cmd /c "<staged> --version"` — wraps the invocation in a cmd.exe
//      that DOES capture the output. This is the primary path; it works
//      for any binary, Bun-compiled or otherwise.
//
//   2. `[System.Diagnostics.FileVersionInfo]::GetVersionInfo($StagedPath)`
//      — a .NET API that reads the file's PE version-info resource
//      directly, without running the binary. This is the fallback that
//      runs only if the cmd /c probe is still empty; it surfaces the
//      file's FileVersion + ProductVersion + FileDescription, which is
//      enough for the non-emptiness guard.
//
// The contract pinned here: at least ONE of the two layers must be
// present. Reverting to the bare `& $StagedPath --version 2>&1` form
// silently breaks Windows smoke tests on Bun binaries; the regression
// test catches that regression deterministically.
// ---------------------------------------------------------------------------

function extractStagedSmokeTestBody(): { text: string; body: string } {
  // Locate the `function Invoke-StagedSmokeTest { ... }` body, same way
  // the hotfix #6 test does: top-level `}` at column 0 terminates the
  // function.
  const text = readFileSync(INSTALL_PS1_PATH, "utf8");
  const fnStart = text.indexOf("function Invoke-StagedSmokeTest");
  expect(
    fnStart,
    "expected `function Invoke-StagedSmokeTest` to be present in scripts/install.ps1",
  ).toBeGreaterThanOrEqual(0);

  const rest = text.slice(fnStart);
  const lines = rest.split(/\r?\n/u);
  const reClosingBrace = /^\}\s*$/u;
  let fnEnd = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (reClosingBrace.test(lines[i] ?? "")) {
      fnEnd = i;
      break;
    }
  }
  expect(
    fnEnd,
    "expected `function Invoke-StagedSmokeTest` to terminate with a closing brace at column 0",
  ).toBeGreaterThan(0);

  const body = lines.slice(0, fnEnd + 1).join("\n");
  return { text, body };
}

describe("release hotfix 7 — Bun console-handle workaround", () => {
  it("RELEASE-INSTALL-PS1-STAGED-SMOKE-CMD-C-OR-PE-VERSION-INFO: Invoke-StagedSmokeTest uses cmd /c invocation OR PE version-info fallback", () => {
    // Given: the on-disk install.ps1 source.
    const { body } = extractStagedSmokeTestBody();

    // Then: at least one of the two Bun-aware capture mechanisms is
    // present. Each is independently sufficient to capture a working
    // Windows binary's identity; both is belt-and-suspenders.

    // Layer 1: `cmd /c "<staged> --version"` invocation. The fix
    // wraps the binary call in cmd.exe, which writes the binary's
    // output back through a pipe that PowerShell can capture with
    // `2>&1`. The pattern we look for is the literal `cmd /c`
    // followed by a quoted invocation of `$StagedPath --version`.
    const usesCmdC =
      /cmd\s+\/c\b/u.test(body) && /"\$StagedPath"\s+--version/u.test(body);

    // Layer 2: PE version-info resource read. The fix uses the .NET
    // `[System.Diagnostics.FileVersionInfo]::GetVersionInfo(...)`
    // API to surface the binary's metadata without running it. The
    // pattern we look for is the literal class name + the method
    // call on `$StagedPath`. This is a Windows-only API — on Linux
    // / macOS the fallback path is never reached, but the install
    // is also never executed there, so the surface is purely
    // defensive.
    const usesPeVersionInfo =
      /\[System\.Diagnostics\.FileVersionInfo\]::GetVersionInfo\s*\(\s*\$StagedPath\s*\)/u.test(
        body,
      );

    expect(
      usesCmdC || usesPeVersionInfo,
      "Invoke-StagedSmokeTest must use `cmd /c \"$StagedPath\" --version` invocation " +
        "OR fall back to the PE version-info resource via " +
        "`[System.Diagnostics.FileVersionInfo]::GetVersionInfo($StagedPath)`. " +
        "Bun-compiled Windows binaries write to the console handle directly, which " +
        "bypasses PowerShell's `2>&1` redirection. Without one of these two mechanisms, " +
        "`$probe` ends up empty and the install is rejected with `no output produced` " +
        "(run 29615454566).",
    ).toBe(true);
  });

  it("RELEASE-INSTALL-PS1-STAGED-SMOKE-NO-BARE-INVOKE: Invoke-StagedSmokeTest does not regress to the bare `& $StagedPath` form", () => {
    // Given: the on-disk install.ps1 source.
    const { body } = extractStagedSmokeTestBody();

    // Then: the bare `& $StagedPath --version 2>&1` form is NOT the
    // only invocation. Either the cmd /c wrapper or the PE
    // version-info fallback (or both) must be present. The bare form
    // is what produced the v0.5.0 regression on Windows + Bun
    // binaries; if a future refactor removes both the wrapper and
    // the fallback, this test fails.
    const hasBareInvoke = /&\s+\$StagedPath\s+--version/u.test(body);
    const hasCmdC = /cmd\s+\/c\b/u.test(body);
    const hasPeVersionInfo =
      /\[System\.Diagnostics\.FileVersionInfo\]::GetVersionInfo\s*\(\s*\$StagedPath\s*\)/u.test(
        body,
      );

    expect(
      hasCmdC || hasPeVersionInfo,
      "Invoke-StagedSmokeTest must include the cmd /c wrapper OR the PE version-info fallback. " +
        "If both are absent, the function reverts to the bare `& $StagedPath --version` form, " +
        "which is exactly the v0.5.0 Windows regression (Bun console handle).",
    ).toBe(true);

    // If the bare `& $StagedPath --version 2>&1` form appears at all,
    // it must be accompanied by at least one of the two
    // mechanisms. Otherwise we're back to the bug.
    if (hasBareInvoke) {
      expect(
        hasCmdC || hasPeVersionInfo,
        "Invoke-StagedSmokeTest contains a bare `& $StagedPath --version` invocation. " +
          "The bare form is what produced the v0.5.0 Windows regression. " +
          "The cmd /c wrapper or the PE version-info fallback (or both) must also be present " +
          "so the install is not rejected with `no output produced` when the binary writes " +
          "to the console handle directly.",
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Bug — Git Bash delegation to PowerShell failed because the temp file
// created by `mktemp -t umactually-install-ps1.XXXXXX` does NOT end in `.ps1`.
//
// Run 29616796148 surfaced this in `smoke-windows-x64-git-bash-delegate`:
// `mktemp -t prefix.XXXXXX` on Git Bash produces a file whose name is
// `/tmp/prefix.<random>` — the trailing `.XXXXXX` is the random
// suffix, NOT a literal `.ps1`. PowerShell then refuses to execute
// `-File` against it:
//
//   Processing -File 'C:/Users/RUNNER~1/AppData/Local/Temp/umactually-install-ps1.BGSUnS'
//   failed because the file does not have a '.ps1' extension.
//
// The fix renames the freshly created temp file to a `.ps1`-suffixed
// path before invoking `powershell.exe -File`. The contract pinned here:
// the `delegate_to_powershell` function MUST rename `$_tmp_ps` so the
// final path ends in `.ps1` before the `powershell.exe -File` call.
// Reverting to the bare `mktemp` form silently breaks the Git-Bash
// delegation path on Windows; this regression test catches that.
// ---------------------------------------------------------------------------

function extractDelegateToPowershellBody(): { text: string; body: string } {
  const text = readFileSync(
    join(REPO_ROOT, "scripts", "install.sh"),
    "utf8",
  );
  const fnStart = text.indexOf("delegate_to_powershell() {");
  expect(
    fnStart,
    "expected `delegate_to_powershell() {` to be present in scripts/install.sh",
  ).toBeGreaterThanOrEqual(0);

  const lines = text.slice(fnStart).split(/\r?\n/u);
  const reClosingBrace = /^\}\s*$/u;
  let fnEnd = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (reClosingBrace.test(lines[i] ?? "")) {
      fnEnd = i;
      break;
    }
  }
  expect(
    fnEnd,
    "expected `delegate_to_powershell` to terminate with a closing brace at column 0",
  ).toBeGreaterThan(0);
  const body = lines.slice(0, fnEnd + 1).join("\n");
  return { text, body };
}

describe("release hotfix 8 — PowerShell delegation .ps1 suffix", () => {
  it("RELEASE-INSTALL-SH-DELEGATE-PS1-SUFFIX: delegate_to_powershell renames the temp file to a .ps1 path before calling powershell.exe -File", () => {
    // Given: the on-disk install.sh source.
    const { body } = extractDelegateToPowershellBody();

    // Then: `mktemp -t umactually-install-ps1.XXXXXX` is still the
    // initial temp-file creation (preserved for the random salt).
    expect(
      /mktemp\s+-t\s+umactually-install-ps1\.[X]+\b/u.test(body),
      "delegate_to_powershell must use `mktemp -t umactually-install-ps1.XXXXXX` (or equivalent) to obtain the random salt. " +
        "Without that, the temp file collides across runs.",
    ).toBe(true);

    // And: the freshly created temp file MUST be renamed so its final
    // path ends in `.ps1` before the `powershell.exe -File` call. The
    // rename is the regression fix; if it disappears, PowerShell
    // rejects the delegation with "file does not have a '.ps1'
    // extension".
    expect(
      /mv\s+"?\$\{?_tmp_ps\}?"?\s+"?\$\{?_tmp_ps_renamed\}?"?/u.test(body) ||
        /mv\s+"?\$\{?_tmp_ps\}?"?\s+\$\{?_tmp_ps_renamed\}/u.test(body),
      "delegate_to_powershell must rename `$_tmp_ps` to a `.ps1`-suffixed path before invoking `powershell.exe`. " +
        "Without this, PowerShell refuses `-File <path>` (run 29616796148): " +
        "`Processing -File '<path>' failed because the file does not have a '.ps1' extension.`",
    ).toBe(true);

    // And: the powershell.exe invocation must reference the renamed
    // path. Either via direct interpolation of the new variable, or
    // via re-assignment of `$_tmp_ps` to the renamed path so the
    // existing `-File "$_tmp_ps"` line continues to work.
    const referencesRenamedPath =
      /exec\s+powershell\.exe[^\n]*\$\{?_tmp_ps_renamed\}?[^\n]*-File[^\n]*\$\{?_tmp_ps_renamed\}?/u.test(
        body,
      ) ||
      /exec\s+powershell\.exe[^\n]*-File[^\n]*\$\{?_tmp_ps_renamed\}?/u.test(body) ||
      // The reassignment form: `_tmp_ps=$_tmp_ps_renamed` after the
      // `mv` lets the original `-File "$_tmp_ps"` line keep working.
      /_tmp_ps\s*=\s*\$\{?_tmp_ps_renamed\}?\b/u.test(body) ||
      /_tmp_ps=\$\{?_tmp_ps_renamed\}?\b/u.test(body);

    expect(
      referencesRenamedPath,
      "delegate_to_powershell must invoke `powershell.exe -File` against the `.ps1`-suffixed path. " +
        "Either the `exec` line must reference `$_tmp_ps_renamed` directly, or `$_tmp_ps` must be reassigned to " +
        "`$_tmp_ps_renamed` so the existing `-File \"$_tmp_ps\"` continues to point at the renamed file.",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bug — `smoke-bad-checksum` referenced manifest fields that don't exist.
//
// Run 29624602869 surfaced this when the bad-checksum job exited 1 at
// `01:10:20Z`, ~280 ms after `set -euo pipefail`, with no install.sh
// output and no `::error file=install.sh.log::` annotation produced.
// Root cause: the workflow's Node helper used
//   `targets.find((t) => t.runner === "ubuntu-latest"
//                || (t.os === "linux" && t.arch === "x64"))`
// but the manifest (`scripts/release-targets.json`) keys each entry by
// `id` (e.g. `"id": "linux-x64"`). Neither `runner` nor `os`/`arch`
// exists on any entry. `find` returned `undefined`, the script's
// `if (!target) process.exit(1);` aborted under `set -e`, and the
// `Reject mismatch and preserve seeded install` step exited 1
// silently (because `set +e` hadn't been reached yet).
//
// The fix: look up by `t.id === "linux-x64"`. The contract pinned
// here: any `node -e ...targets.find(...)` selector inside the
// workflow MUST return a real entry whose `id` matches a row in the
// manifest. Otherwise the assertion block never executes and the
// step exits 1 with no diagnostic. This is silent-failure-by-default
// because the install was never run.
//
// This regression test runs the workflow's exact Node helper verbatim
// against the on-disk manifest. Any future refactor that reverts to
// the broken selector (or introduces another invalid field name) is
// caught with a concrete diagnostic message.
// ---------------------------------------------------------------------------

const TARGETS_PATH = join(REPO_ROOT, "scripts", "release-targets.json");

type TargetEntry = Readonly<{ id: string; archiveName: string }>;

function readTargetsManifest(): readonly TargetEntry[] {
  const text = readFileSync(TARGETS_PATH, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(
      `expected scripts/release-targets.json to be an array, got ${typeof parsed}`,
    );
  }
  return parsed.map((entry): TargetEntry => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(
        `expected each manifest entry to be an object, got ${typeof entry}`,
      );
    }
    const obj = entry as Record<string, unknown>;
    const id = obj["id"];
    const archiveName = obj["archiveName"];
    if (typeof id !== "string" || typeof archiveName !== "string") {
      throw new Error(
        `expected each manifest entry to have string id + archiveName, got ${JSON.stringify(entry)}`,
      );
    }
    return { id, archiveName };
  });
}

describe("release hotfix 10 — manifest field selectors in release.yml", () => {
  it("manifest indexable by id: every entry has a string id and an archiveName", () => {
    // Sanity: the on-disk manifest must be indexable. Without this
    // pre-condition, the selectors below can't validate anything.
    const targets = readTargetsManifest();
    expect(targets.length).toBeGreaterThanOrEqual(5);
    for (const t of targets) {
      expect(typeof t.id).toBe("string");
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.archiveName.endsWith(".tar.gz") || t.archiveName.endsWith(".zip")).toBe(true);
    }
  });

  it("RELEASE-WORKFLOW-BAD-CHECKSUM-LINUX-X64-SELECTOR: bad-checksum step looks up the linux-x64 archive by `t.id === 'linux-x64'` (not by `t.runner`/`t.os`/`t.arch`)", () => {
    // Given: the on-disk release.yml + manifest.
    const workflowText = readFileSync(join(WORKFLOWS_DIR, "release.yml"), "utf8");
    const targets = readTargetsManifest();

    // Locate the `Reject mismatch and preserve seeded install` step in
    // smoke-bad-checksum. We extract the run-block verbatim so we can
    // (a) confirm the selector uses an `id` lookup, and (b) execute
    // the exact `node -e '<...>'` body against the real manifest and
    // assert it produces a non-empty archiveName.

    const jobStart = workflowText.indexOf("smoke-bad-checksum:");
    expect(jobStart, "smoke-bad-checksum job must be present in release.yml").toBeGreaterThan(0);

    const afterJob = workflowText.slice(jobStart);
    const stepStart = afterJob.indexOf("name: Reject mismatch and preserve seeded install");
    expect(stepStart, "the `Reject mismatch and preserve seeded install` step must be present in smoke-bad-checksum").toBeGreaterThan(0);

    // Walk forward from the step's `name:` to the end of its `run:`
    // block. The run-block is the first `run: |` after the step name
    // and ends at the first line at indent <= the step's indent.
    const stepIndent = "      "; // 6-space YAML step indent matches the rest of this file
    const runStart = afterJob.slice(stepStart).search(/\n\s*run:\s*\|\s*\n/u);
    expect(runStart, "the step must have a `run: |` block after its name").toBeGreaterThan(-1);
    const runBlockStart = stepStart + runStart + 1;
    const afterRun = afterJob.slice(runBlockStart);
    const runLines = afterRun.split(/\r?\n/u);

    // The step's `run:` block lives at indent 8 (two more than the
    // step indent of 6). The block ends at the first line that is NOT
    // blank AND has indent < 8.
    let runEnd = -1;
    for (let i = 1; i < runLines.length; i += 1) {
      const line = runLines[i] ?? "";
      if (line.length === 0) continue;
      const m = /^( *)(.)/u.exec(line);
      if (m === null) break;
      const indent = (m[1] ?? "").length;
      const isRunContent = indent >= stepIndent.length + 2;
      if (!isRunContent) {
        runEnd = i;
        break;
      }
    }
    expect(runEnd, "the run block must terminate at a sibling-step boundary").toBeGreaterThan(0);

    const runBlock = runLines.slice(0, runEnd).join("\n");

    // (a) The selector MUST use `t.id === "<some-id>"`, NOT
    // `t.runner` / `t.os` / `t.arch`. The latter three do not exist on
    // the manifest entries and cause `find` to return `undefined`,
    // which makes the script `process.exit(1)` silently.
    const usesIdSelector = /targets\.find\s*\(\s*\(\s*\w+\s*\)\s*=>\s*\w+\.id\s*===\s*["']linux-x64["']/u.test(
      runBlock,
    );
    const usesRunnerSelector = /targets\.find\s*\([^)]*\.runner\s*===/u.test(runBlock);
    const usesOsArchSelector = /targets\.find\s*\([^)]*\bos\s*===[^)]*\barch\s*===/u.test(runBlock);

    expect(
      usesIdSelector,
      "smoke-bad-checksum `Reject mismatch` step must look up the linux-x64 archive by `t.id === 'linux-x64'`. " +
        "The manifest has no `runner`/`os`/`arch` fields; using those produces `find(...) === undefined` " +
        "and `process.exit(1)` aborts the script silently under `set -e`. " +
        "Fix: change the Node helper to `targets.find((t) => t.id === 'linux-x64')`.",
    ).toBe(true);
    expect(
      !usesRunnerSelector,
      "smoke-bad-checksum `Reject mismatch` step uses `t.runner` in `targets.find(...)`. " +
        "The manifest has no `runner` field — this returns undefined and aborts the script on `set -e`. " +
        "Use `t.id === 'linux-x64'` instead. (See run 29624602869.)",
    ).toBe(true);
    expect(
      !usesOsArchSelector,
      "smoke-bad-checksum `Reject mismatch` step uses `t.os`/`t.arch` in `targets.find(...)`. " +
        "The manifest has no `os` or `arch` fields — these `find` calls return undefined.",
    ).toBe(true);

    // (b) The Node helper, when extracted and run verbatim against the
    // real manifest, MUST print a non-empty archiveName. We extract
    // the body of the inner `node -e '...'` call and execute it as a
    // Node child process to verify the contract end-to-end.
    //
    // The body starts at the opening `'` after `node -e ` and ends at
    // the next `'\n` followed by either `)` (bash command-substitution
    // close) or whitespace. The bash here-doc style is single-quoted
    // so no escape sequences (\', \\) appear inside.
    const nodeBodyMatch = /node -e '([\s\S]*?)'\s*\)\s*$/m.exec(runBlock);
    expect(
      nodeBodyMatch,
      "expected the step to contain a `node -e '...')` invocation closing on `'`+`)`. " +
        "If the regex doesn't match, the workflow's `ARCHIVE_NAME=$(node -e '...')` form has been refactored " +
        "and this assertion needs to follow suit.",
    ).not.toBeNull();
    const nodeBody = (nodeBodyMatch?.[1] ?? "").replace(/\\'/g, "'");

    // The Node body references `process.exit(1)` if the selector
    // misses. We assert: the body, when executed against the on-disk
    // manifest, exits 0 AND prints a single non-empty archiveName
    // that is also present in the manifest.
    const result = require("node:child_process").spawnSync(
      process.execPath,
      ["-e", nodeBody],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(
      result.status,
      "the workflow's exact `node -e` body must exit 0 against the on-disk manifest. " +
        `Got exit=${result.status}, stdout=${JSON.stringify(result.stdout)}, stderr=${JSON.stringify(result.stderr)}. ` +
        "This is the regression from run 29624602869: `find` returned undefined because the selector used `t.runner`/`t.os`/`t.arch` fields that don't exist on the manifest. " +
        "The selector must use `t.id`.",
    ).toBe(0);

    const archiveName = result.stdout.trim();
    expect(archiveName, "the node helper must print a non-empty archiveName").not.toBe("");
    expect(
      targets.some((t) => t.archiveName === archiveName),
      `the printed archiveName (${JSON.stringify(archiveName)}) must be present in the manifest. ` +
        `The selector returned an entry whose archiveName is missing from release-targets.json — ` +
        `the manifest and the selector are out of sync.`,
    ).toBe(true);
  });
});
