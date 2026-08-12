// SPDX-License-Identifier: MIT
// Regression tests for v0.5.0 release-time runtime contract.
//
// Run history: release run 29616796148 surfaced three orthogonal v0.5.0 release-CI failures that
// static-only contract tests did NOT catch. The full per-run breakdown (Hotfix commits 8082ef7, 302a100,
// etc.) is in the local-only notepad trail used during the work; the three bugs
// (pwsh `${X}` mis-expansion, mktemp .ps1 suffix loss, bad-checksum residue search dir mismatch) are
// documented inline below.
//
// Run 29616796148 surfaced three orthogonal v0.5.0 release-CI failures
// that static-only contract tests did NOT catch. All three were real
// runtime bugs that had been latent since the v0.5.0 merge (af65b2b):
//
//   Bug A — pwsh `${X}` is PowerShell variable expansion, not env
//     The smoke-windows-arm64-structural job's "Download candidate
//     bundle (by id)" step ran under `shell: pwsh` and emitted
//     `gh api "repos/${GITHUB_REPOSITORY}/actions/artifacts/${ARTIFACT_ID}/zip" ...`.
//     In PowerShell, `${X}` is a PowerShell *variable* expansion, NOT
//     an environment variable expansion. `${GITHUB_REPOSITORY}` therefore
//     evaluates to the empty string, and `gh api` received the malformed
//     endpoint `repos//actions/artifacts//zip`, printed its usage banner,
//     and exited non-zero. Expand-Archive then failed with "The path
//     'candidate-transport.zip' either does not exist". The earlier
//     v0.5.0 hotfix 7 (commit 8082ef7) removed a backtick line
//     continuation but the underlying variable-expansion bug remained.
//
//   Bug B — install.sh temp file lacks .ps1 suffix
//     scripts/install.sh's `delegate_to_powershell` used
//     `mktemp -t umactually-install-ps1.XXXXXX`, which on Git Bash
//     produces `<tmpdir>/prefix.<random>` (the trailing `.XXXXXX` is
//     the random suffix, NOT a literal `.ps1`). Windows PowerShell
//     then refused `powershell.exe -File '<path>'` with:
//       "Processing -File '<path>' failed because the file does
//        not have a '.ps1' extension."
//     Run 29616796148 surfaced this in
//     smoke-windows-x64-git-bash-delegate.
//
//   Bug C — bad-checksum residue search dir mismatch
//     smoke-bad-checksum asserted the seeded install was preserved
//     AND no `.umactually-stage*` residue remained. Hotfix 6
//     (commit 302a100) introduced the post-condition check. But the
//     `find` for residue only searched `$HOME/.local/bin`. GH-hosted
//     runners run as root, so the installer's actual staging dir is
//     `/usr/local/bin/.umactually-stage.*`, not `$HOME/.local/bin/.
//     umactually-stage.*`. The trap only cleaned `$HOME/.local/bin`
//     too, so a re-run would have inherited residue even with the
//     bug fix in place.
//
// These three regressions MUST be catchable by `npm test -- --run`
// on every PR. The release-workflow-contract.test.ts and the
// release-action-pins.test.ts tests were designed to fail closed
// at PR-merge time so we do not have to repeat the seven-hotfix
// cycle that v0.5.0 already went through.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github/workflows/release.yml");
const INSTALL_SH_PATH = join(REPO_ROOT, "scripts/install.sh");

// ===========================================================================
// Workflow loaders (typed narrow of yaml.parse())
// ===========================================================================

type Workflow = Readonly<Record<string, unknown>>;
type WorkflowStep = Readonly<{
  readonly id?: string;
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly shell?: string;
}>;
type WorkflowJob = Readonly<{
  readonly name?: string;
  readonly "runs-on"?: string | readonly string[];
  readonly needs?: string | readonly string[];
  readonly steps: readonly WorkflowStep[];
}>;

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

function readJobs(workflow: Workflow): ReadonlyMap<string, WorkflowJob> {
  const jobsValue = readRecord(workflow["jobs"], "workflow.jobs");
  const out = new Map<string, WorkflowJob>();
  for (const [id, raw] of Object.entries(jobsValue)) {
    const job = readRecord(raw, `job ${id}`);
    const stepsRaw = job["steps"];
    if (!Array.isArray(stepsRaw)) {
      throw new TypeError(`job ${id} steps must be an array`);
    }
    const steps = stepsRaw.map((step, index) =>
      readRecord(step, `job ${id} step ${index}`),
    ) as readonly WorkflowStep[];
    out.set(id, { ...job, steps });
  }
  return out;
}

function loadReleaseWorkflow(): Workflow {
  const text = readFileSync(WORKFLOW_PATH, "utf8");
  return readRecord(parse(text), "release.yml") as Workflow;
}

// ===========================================================================
// Bug A — pwsh `${X}` is a PowerShell variable, not an env var
// ===========================================================================
//
// In PowerShell, `${X}` is a PowerShell *variable* (NOT an env var).
// `${GITHUB_REPOSITORY}` evaluates to the empty string and the
// `gh api` command receives a malformed endpoint. The correct form
// is `$env:X` (reads from the step's `env:` block as a real env var).
//
// We pin two contracts:
//   1. Every pwsh `gh api` invocation uses `$env:NAME` for env-var
//      expansion; no `${NAME}` (curly-brace) form is allowed.
//   2. No `pwsh` step uses a backtick-newline continuation for
//      a multi-line `gh api` call.
//
// These are simple, mechanical, and 100% reliable. If a future edit
// introduces either form, this test fails closed at PR time.

describe("release-time: pwsh ${X} variable expansion regression", () => {
  it("RELEASE-TIME-PWSH-ENV-EXPANSION-NO-CURLY-BRACE: every pwsh run block expands env-var strings via $env:X, NOT ${X}", () => {
    const jobs = readJobs(loadReleaseWorkflow());
    const offenders: string[] = [];

    for (const [jobId, job] of jobs) {
      for (let stepIndex = 0; stepIndex < job.steps.length; stepIndex += 1) {
        const step = job.steps[stepIndex];
        if (step === undefined) continue;
        if (step.shell !== "pwsh") continue;
        const run = step.run ?? "";
        if (run.length === 0) continue;
        // Strip comments before scanning: a `${X}` inside a `# ...`
        // comment is documentation, not an expansion. PowerShell-style
        // comments use `#`, and YAML treats `#` after a leading space
        // as a comment. We strip both forms so the scanner only sees
        // code. The strip is greedy: anything from the first `#` to the
        // end of the line is removed.
        const codeOnly = run
          .split(/\r?\n/u)
          .map((line) => line.replace(/#.*$/u, ""))
          .join("\n");
        // The forbidden pattern is a PowerShell variable expansion
        // (curly-brace form). The safe form `$env:X` reads an env var
        // (no curly braces). Allow `${...}` only inside string literals
        // — but for this contract we accept NO curly-brace expansion
        // in pwsh run blocks. The GitHub Actions docs use `${X}` for
        // environment markers in workflow YAML; in PowerShell that is
        // a PowerShell *variable* expansion, which evaluates to the
        // empty string in this scope.
        // eslint-disable-next-line no-template-curly-in-string
        const re = /\$\{[A-Za-z_][A-Za-z0-9_]*(?::|\})/u;
        const lines = codeOnly.split(/\r?\n/u);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i] ?? "";
          if (re.test(line)) {
            offenders.push(
              `${jobId} / step ${stepIndex + 1} (${step.name ?? "(unnamed)"}) ` +
                `line ${i + 1}: ${line.trim().slice(0, 80)}`,
            );
          }
        }
      }
    }

    expect(
      offenders,
      `pwsh run block(s) use \${X} (PowerShell variable) where \$env:X (env var) is required. ` +
        `PowerShell's \${X} reads a PowerShell variable, not an env var; the env block's ` +
        `ARTIFACT_ID etc. are empty in that scope, so \`gh api\` receives a malformed endpoint ` +
        `and prints its usage banner (observed in run 29616796148). Offenders: ${offenders.join("; ")}.`,
    ).toEqual([]);
  });

  it("RELEASE-TIME-PWSH-NO-BACKTICK-LINE-CONTINUATION: pwsh run blocks do not use backtick-newline to split a single command", () => {
    const jobs = readJobs(loadReleaseWorkflow());
    const offenders: string[] = [];

    for (const [jobId, job] of jobs) {
      for (let stepIndex = 0; stepIndex < job.steps.length; stepIndex += 1) {
        const step = job.steps[stepIndex];
        if (step === undefined) continue;
        if (step.shell !== "pwsh") continue;
        const run = step.run ?? "";
        if (run.length === 0) continue;
        // Strip comments before scanning.
        const codeOnly = run
          .split(/\r?\n/u)
          .map((line) => line.replace(/#.*$/u, ""))
          .join("\n");
        const lines = codeOnly.split(/\r?\n/u);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i] ?? "";
          // Trailing backtick + space = powerShell continuation marker.
          // GitHub Actions serializes `run: |` blocks verbatim, so the
          // backtick survives but its trailing behavior varies across
          // runner image updates. The single-line form (no continuation)
          // is the only robust pattern.
          if (/`\s*$/u.test(line)) {
            offenders.push(
              `${jobId} / step ${stepIndex + 1} (${step.name ?? "(unnamed)"}) ` +
                `line ${i + 1}: ${line.trim().slice(0, 80)}`,
            );
          }
        }
      }
    }

    expect(
      offenders,
      `pwsh run block(s) end with a backtick (continuation marker). ` +
        `PowerShell's backtick-line-continuation is brittle across ` +
        `runner image updates; pin a single-line command instead. ` +
        `Offenders: ${offenders.join("; ")}.`,
    ).toEqual([]);
  });
});

// ===========================================================================
// Bug B — install.sh delegate_to_powershell temp file must have .ps1 suffix
// ===========================================================================

function extractDelegateToPowershellBody(): { text: string; body: string } {
  const text = readFileSync(INSTALL_SH_PATH, "utf8");
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

describe("release-time: PowerShell delegation .ps1 suffix regression", () => {
  it("RELEASE-TIME-DELEGATE-PS1-SUFFIX: delegate_to_powershell renames the temp file to .ps1 before invoking powershell.exe", () => {
    const { body } = extractDelegateToPowershellBody();

    // (a) The original `mktemp -t umactually-install-ps1.XXXXXX` is still
    //     in place (preserved for the random salt).
    expect(
      /mktemp\s+-t\s+umactually-install-ps1\.[X]+\b/u.test(body),
      "delegate_to_powershell must still create the temp file via `mktemp -t umactually-install-ps1.XXXXXX` (preserves the random salt).",
    ).toBe(true);

    // (b) The freshly created temp file MUST be renamed so its final
    //     path ends in `.ps1` BEFORE the `powershell.exe -File` invocation.
    //     Without this, PowerShell refuses to execute the file with:
    //       "Processing -File '<path>' failed because the file does not
    //        have a '.ps1' extension."
    //     (observed in run 29616796148, smoke-windows-x64-git-bash-delegate)
    expect(
      /mv\s+"\$\{?_tmp_ps\}?"\s+"\$\{?_tmp_ps_renamed\}?"/u.test(body) ||
        /mv\s+"\$\{?_tmp_ps\}?"\s+\$\{?_tmp_ps_renamed\}/u.test(body),
      "delegate_to_powershell must rename `$_tmp_ps` to `$_tmp_ps_renamed` (with a `.ps1` suffix) before invoking `powershell.exe`. " +
        "Without this, Git Bash's `mktemp -t prefix.XXXXXX` produces a name whose extension is `.XXXXXX` (the random suffix), not `.ps1`, " +
        "and PowerShell refuses `-File <path>` (run 29616796148).",
    ).toBe(true);

    // (c) The renamed path MUST be the one passed to `powershell.exe -File`.
    //     Either via direct interpolation on the `exec` line, or via a
    //     reassignment of `$_tmp_ps = $_tmp_ps_renamed` so the existing
    //     `exec powershell.exe -File "$_tmp_ps"` line continues to work.
    const referencesRenamed =
      /exec\s+powershell\.exe[\s\S]*?\$_tmp_ps_renamed[\s\S]*?-File[\s\S]*?\$_tmp_ps_renamed/u.test(body) ||
      /exec\s+powershell\.exe[\s\S]*?-File[\s\S]*\$_tmp_ps_renamed/u.test(body) ||
      /\b_tmp_ps\s*=\s*\$\{?_tmp_ps_renamed\}?\b/u.test(body) ||
      /\b_tmp_ps\b=\$\{?_tmp_ps_renamed\}?\b/u.test(body);

    expect(
      referencesRenamed,
      "delegate_to_powershell must invoke `powershell.exe -File` against the renamed `.ps1` path, either directly or via `$_tmp_ps=$_tmp_ps_renamed` reassignment.",
    ).toBe(true);
  });
});

// ===========================================================================
// Bug C — bad-checksum residue search must include both INSTALL_DIRs
// ===========================================================================

function extractBadChecksumStepBlock(): readonly string[] {
  const text = readFileSync(WORKFLOW_PATH, "utf8");
  const lines = text.split(/\r?\n/u);

  const STEP_NAME_RE =
    /^      - name:\s*Reject mismatch and preserve seeded install\s*$/u;
  const STEP_OTHER_NAME_RE = /^      - name:\s*.+?\s*$/u;
  const RUN_KEY_RE = /^        run:\s*\|\s*$/u;
  const ANY_STEP_OPEN_RE = /^      -\s+/u;

  let targetStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (STEP_NAME_RE.test(lines[i] ?? "")) {
      targetStart = i;
      break;
    }
  }
  if (targetStart < 0) return [];

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

  const block: string[] = [];
  for (let i = runStart + 1; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (ANY_STEP_OPEN_RE.test(raw)) break;
    block.push(raw);
  }
  return block;
}

describe("release-time: bad-checksum residue path must include root INSTALL_DIR", () => {
  it("RELEASE-TIME-BAD-CHECKSUM-STAGE-RESIDUE-DUAL-PATH: smoke-bad-checksum residue search covers BOTH $HOME/.local/bin AND /usr/local/bin", () => {
    const block = extractBadChecksumStepBlock();
    expect(
      block.length,
      "expected the `Reject mismatch and preserve seeded install` step's run block to be located; " +
        "if this fails, the step's name or indent drifted and the test needs to follow it.",
    ).toBeGreaterThan(0);

    const joined = block.join("\n");

    // (a) STAGE_RESIDUE `find` must include both paths. The installer
    //     picks INSTALL_DIR by uid: root -> /usr/local/bin; non-root
    //     -> $HOME/.local/bin. GH-hosted runners are root, so the
    //     residue lives in /usr/local/bin. A search restricted to
    //     $HOME/.local/bin returns empty even when the install was
    //     rejected with a half-staged bytes pattern (observed in run
    //     29616796148).
    expect(
      /find\s+(?:"\$\{?HOME\}?\/.local\/bin"|\$\{?HOME\}?\/.local\/bin)\s+\/usr\/local\/bin/u.test(
        joined,
      ),
      "smoke-bad-checksum stage-residue search must include `/usr/local/bin` alongside `$HOME/.local/bin`. " +
        "The installer picks INSTALL_DIR by uid (root -> /usr/local/bin; non-root -> $HOME/.local/bin) " +
        "and GH-hosted runners are root. A find whose only target is $HOME/.local/bin returns empty " +
        "in CI and the post-condition falsely fails (run 29616796148).",
    ).toBe(true);
  });

  it("RELEASE-TIME-BAD-CHECKSUM-TRAP-CLEANS-BOTH-DIRS: smoke-bad-checksum EXIT trap cleans both $HOME/.local/bin AND /usr/local/bin stage residue", () => {
    const block = extractBadChecksumStepBlock();
    expect(block.length).toBeGreaterThan(0);

    const trapLine = block.find((line) => /^\s*trap\s+/u.test(line));
    expect(
      trapLine,
      "expected the smoke-bad-checksum step to declare a `trap '...' EXIT` cleanup handler.",
    ).toBeTruthy();
    const trapBody = trapLine ?? "";

    // The trap must clean both install dirs.
    expect(
      /rm\s+-rf\s+"?\$\{?HOME\}?\/.local\/bin/u.test(trapBody),
      "smoke-bad-checksum EXIT trap must `rm -rf $HOME/.local/bin`.",
    ).toBe(true);
    expect(
      /rm\s+-rf\s+\/usr\/local\/bin\/\.umactually-stage\.\*/u.test(trapBody),
      "smoke-bad-checksum EXIT trap must `rm -rf /usr/local/bin/.umactually-stage.*`. " +
        "Without this, a re-run inherits the prior installer's half-staged bytes even though " +
        "the install was rejected (run 29616796148).",
    ).toBe(true);
  });
});
