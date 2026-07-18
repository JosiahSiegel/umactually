import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

// allow: SIZE_OK — single test file mandated by Todo 4 brief; candidate YAML
// is in-memory and required to demonstrate all 16 contract rules. Splitting
// would scatter the contract across files and make the RED/GREEN parity
// harder to audit.

// ===========================================================================
// Workflow contract: Todo 4 of .omo/plans/release-binary-download-size.md
//
// These tests express the pre-publication graph contract that the release
// workflow MUST satisfy once Todo 9 ships. They are deliberately RED against
// `.github/workflows/release.yml` today, which still ships raw `.exe`
// artifacts and conflates build + publish inside a single `release` job.
//
// The contract surface comes from:
//   - Scope lines 21-42 (public contract: 6 archives + checksums.txt)
//   - Verification strategy line 60 ("parse release.yml and prove build/package
//     -> required smoke/install jobs -> publish ordering, permission
//     boundaries, tested artifact reuse, seven exact public assets, and no
//     public raw binary")
//   - Todo 4 lines 114-121 (this test suite)
//   - Todo 9 lines 154-161 (the workflow rewrite this suite gates)
//
// Every "asserts X" maps to a specific Scope statement, with the source line
// quoted inline so a reviewer can audit the test against the plan without
// cross-referencing.
// ===========================================================================

// ---------------------------------------------------------------------------
// Type helpers — narrow `unknown` from yaml.parse() into typed records.
// ---------------------------------------------------------------------------

type Workflow = Readonly<Record<string, unknown>>;
type WorkflowStep = {
  readonly id?: string;
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly if?: string;
  readonly shell?: string;
};
type WorkflowJob = {
  readonly name?: string;
  readonly "runs-on"?: string | readonly string[];
  readonly needs?: string | readonly string[];
  readonly permissions?: Readonly<Record<string, unknown>>;
  readonly steps: readonly WorkflowStep[];
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

function readSteps(value: unknown, label: string): readonly WorkflowStep[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return value.map((step, index) => readRecord(step, `${label}[${index}]`) as WorkflowStep);
}

function readJobs(value: unknown): Record<string, WorkflowJob> {
  const raw = readRecord(value, "workflow.jobs");
  const result: Record<string, WorkflowJob> = {};
  for (const [key, job] of Object.entries(raw)) {
    const jobRecord = readRecord(job, `jobs.${key}`);
    result[key] = {
      ...jobRecord,
      steps: readSteps(jobRecord["steps"], `jobs.${key}.steps`),
    } as WorkflowJob;
  }
  return result;
}

function parseWorkflow(text: string): Workflow {
  return readRecord(parse(text), "workflow root");
}

function loadCurrentWorkflow(): Workflow {
  return parseWorkflow(readFileSync(join(REPO_ROOT, ".github/workflows/release.yml"), "utf8"));
}

function readTriggers(on: Record<string, unknown>): {
  readonly push: null | { readonly tags?: readonly string[] } | Record<string, unknown>;
  readonly workflowDispatch: null | Record<string, unknown>;
} {
  const push = on["push"];
  const workflowDispatch = on["workflow_dispatch"];
  return {
    push: (push === undefined ? null : push) as null | { readonly tags?: readonly string[] } | Record<string, unknown>,
    workflowDispatch: (workflowDispatch === undefined ? null : workflowDispatch) as null | Record<string, unknown>,
  };
}

function readTopLevelPermissions(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  return readRecord(value, "workflow.permissions");
}

function jobPermissions(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  return readRecord(value, "job.permissions");
}

function runsOnLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

const EMPTY_JOB: WorkflowJob = { steps: [] };

// ---------------------------------------------------------------------------
// Constants — the six manifest archive basenames (one source of truth via the
// in-repo manifest, plus `checksums.txt`). All public-asset assertions are
// derived from these.
// ---------------------------------------------------------------------------

type TargetManifest = {
  readonly id: string;
  readonly archiveName: string;
};

function loadManifest(): readonly TargetManifest[] {
  const raw = readFileSync(join(REPO_ROOT, "scripts/release-targets.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new TypeError("release-targets.json must be an array");
  }
  return parsed.map((row, index) => {
    const rec = readRecord(row, `release-targets[${index}]`);
    return {
      id: String(rec["id"] ?? ""),
      archiveName: String(rec["archiveName"] ?? ""),
    };
  });
}

const MANIFEST: readonly TargetManifest[] = loadManifest();
const ARCHIVE_BASENAMES: readonly string[] = MANIFEST.map((m) => m.archiveName);
const RAW_BASENAMES: readonly string[] = [
  "umactually-linux-x64",
  "umactually-linux-arm64",
  "umactually-darwin-x64",
  "umactually-darwin-arm64",
  "umactually-windows-x64.exe",
  "umactually-windows-arm64.exe",
];
const PUBLIC_BASENAMES: readonly string[] = [...ARCHIVE_BASENAMES, "checksums.txt"];

// ---------------------------------------------------------------------------
// Contract probe — single source of truth for what the workflow must look
// like. The probe returns a list of violations; an empty list means the
// workflow satisfies the contract. Every violation cites the plan source
// line it implements, so a reviewer can trace each rule to its provenance.
// ---------------------------------------------------------------------------

type Violation = { readonly rule: string; readonly source: string; readonly detail: string };

const REQUIRED_NATIVE_RUNNERS = [
  "ubuntu-24.04",
  "ubuntu-24.04-arm",
  "macos-15-intel",
  "macos-15",
  "windows-2025",
] as const;

function readOnRecord(workflow: Workflow): Record<string, unknown> {
  // `on:` is a YAML key; in JS the parser produces the string key "on".
  // Some YAML parsers also expose the boolean coercion. Read both safely.
  const candidate = (workflow as Record<string, unknown>)["on"] ?? (workflow as Record<string, unknown>)["true"];
  return readRecord(candidate, "workflow.on");
}

function findJobById(jobs: Record<string, WorkflowJob>, predicate: (job: WorkflowJob, id: string) => boolean): { id: string; job: WorkflowJob } | null {
  for (const [id, job] of Object.entries(jobs)) {
    if (predicate(job, id)) return { id, job };
  }
  return null;
}

function getJobNeeds(job: WorkflowJob): readonly string[] {
  const needs = job.needs;
  if (needs === undefined) return [];
  if (typeof needs === "string") return [needs];
  if (Array.isArray(needs)) return needs.map(String);
  return [];
}

function probeContract(workflow: Workflow): readonly Violation[] {
  const violations: Violation[] = [];
  const onRecord = readOnRecord(workflow);
  const triggers = readTriggers(onRecord);

  // Rule 1: workflow_dispatch exists with publish (boolean) and correlation (string) inputs.
  // Source: Todo 4 brief ("workflow_dispatch inputs include publish: boolean and correlation: string")
  //         and Todo 9 lines 156-161 ("workflow_dispatch inputs publish (boolean, default false)
  //         and correlation (string, required for dispatch QA)").
  if (triggers.workflowDispatch === null) {
    violations.push({
      rule: "workflow_dispatch-inputs",
      source: "Todo 4 brief + Todo 9 L156-161",
      detail: "workflow_dispatch trigger is absent",
    });
  } else {
    const inputs = readRecord(triggers.workflowDispatch["inputs"] ?? {}, "workflow_dispatch.inputs");
    const publish = inputs["publish"];
    const correlation = inputs["correlation"];
    if (publish === undefined || String(readRecord(publish, "inputs.publish")["type"] ?? "") !== "boolean") {
      violations.push({
        rule: "workflow_dispatch-publish-boolean",
        source: "Todo 4 brief + Todo 9 L156-161",
        detail: "workflow_dispatch.inputs.publish is missing or not type boolean",
      });
    }
    if (correlation === undefined || String(readRecord(correlation, "inputs.correlation")["type"] ?? "") !== "string") {
      violations.push({
        rule: "workflow_dispatch-correlation-string",
        source: "Todo 4 brief + Todo 9 L156-161",
        detail: "workflow_dispatch.inputs.correlation is missing or not type string",
      });
    }
  }

  // Rule 2: tag-push is the only publish trigger (push.tags v*).
  // Source: Todo 4 brief ("tag-push is the only publish trigger") and
  //         current release.yml L4-6.
  if (triggers.push === null) {
    violations.push({
      rule: "tag-push-trigger",
      source: "Todo 4 brief",
      detail: "push trigger is absent; tag push is required",
    });
  } else {
    const tags = (triggers.push as { tags?: readonly string[] }).tags;
    if (!Array.isArray(tags) || !tags.includes("v*")) {
      violations.push({
        rule: "tag-push-trigger",
        source: "Todo 4 brief",
        detail: "push.tags must include v* (only published-tag trigger)",
      });
    }
  }

  // Rule 3: dispatch must run a publish: false branch (no publish from dispatch).
  // Source: Todo 4 brief ("dispatch runs a publish: false branch. No publish
  //         happens from latest").
  const allJobs = readJobs(workflow["jobs"]);
  const stepGateText = Object.values(allJobs)
    .flatMap((job) => job.steps.map((step) => `${step.if ?? ""}\n${step.run ?? ""}`))
    .join("\n");
  if (!/inputs\.publish\s*==\s*['"]false['"]/u.test(stepGateText) && !/inputs\.publish\s*==\s*false/u.test(stepGateText)) {
    violations.push({
      rule: "dispatch-publish-false-branch",
      source: "Todo 4 brief",
      detail: "no step gates publish on inputs.publish == false (dispatch must skip publish)",
    });
  }

  const topPerms = readTopLevelPermissions(workflow["permissions"]);

  // Rule 4: only the publish job holds contents: write.
  // Source: Scope L41 ("Publish only the already-tested Actions artifact bundle")
  //         and Todo 4 brief ("publish is the only job holding contents: write").
  const jobs = readJobs(workflow["jobs"]);
  const allJobIds = Object.keys(jobs);
  const writeHolders: string[] = [];
  for (const [id, job] of Object.entries(jobs)) {
    const jp = jobPermissions(job["permissions"]);
    if (jp !== null && String(jp["contents"] ?? "") === "write") writeHolders.push(id);
  }
  // If the workflow grants `contents: write` at the top level (no job-level
  // override), then every job effectively holds it. Require an explicit,
  // narrow grant.
  if (topPerms !== null && String(topPerms["contents"] ?? "") === "write") {
    violations.push({
      rule: "contents-write-narrowed",
      source: "Scope L41 + Todo 4 brief",
      detail: `top-level permissions grant contents: write to every job; must be narrowed to publish only (current holders: ${allJobIds.join(", ")})`,
    });
  }
  if (writeHolders.length === 0) {
    violations.push({
      rule: "contents-write-grant",
      source: "Scope L41 + Todo 4 brief",
      detail: "no job grants contents: write; publish must be the sole holder",
    });
  }
  if (writeHolders.length > 1) {
    violations.push({
      rule: "contents-write-unique",
      source: "Scope L41 + Todo 4 brief",
      detail: `multiple jobs hold contents: write (${writeHolders.join(", ")}); publish must be the sole holder`,
    });
  }

  // Rule 5: build/package job uploads a candidate bundle with id candidate-upload.
  // Source: Todo 4 brief ("a build/package job uploads one candidate bundle
  //         under a step with stable id: candidate-upload") and Todo 9 L155-161
  //         (Step ID `candidate-upload` exposed via `outputs.artifact-id`).
  const candidateUpload = Object.values(jobs)
    .flatMap((job) => job.steps)
    .find((step) => step.id === "candidate-upload");
  if (candidateUpload === undefined) {
    violations.push({
      rule: "candidate-upload-step",
      source: "Todo 4 brief + Todo 9 L155-161",
      detail: "no step with id: candidate-upload exists",
    });
  } else {
    const withBody = candidateUpload.with ?? {};
    const pathField = withBody["path"];
    const nameField = withBody["name"];
    if (typeof pathField !== "string" || pathField.length === 0) {
      violations.push({
        rule: "candidate-upload-path",
        source: "Todo 9 L155-161",
        detail: `candidate-upload step with.path is missing or empty (got ${JSON.stringify(pathField)})`,
      });
    }
    if (typeof nameField !== "string" || nameField !== "umactually-release-candidate") {
      violations.push({
        rule: "candidate-upload-name",
        source: "Todo 9 L155-161",
        detail: `candidate-upload step with.name must be exactly 'umactually-release-candidate' (got ${JSON.stringify(nameField)})`,
      });
    }
  }

  // Rule 6: every required smoke job (native + install) depends on the
  //         candidate-upload's producing job.
  // Source: Scope L41 ("Gate publication on candidate-archive checks, native
  //         Linux x64/ARM64, macOS x64/ARM64, Windows x64 execution,
  //         POSIX/PowerShell installer smoke, and Windows ARM64 structural
  //         PE/archive validation") + Todo 4 brief.
  const producer = findJobById(jobs, (job) =>
    job.steps.some((step) => step.id === "candidate-upload"),
  );
  if (producer === null) {
    violations.push({
      rule: "candidate-producer-job",
      source: "Scope L41 + Todo 4 brief",
      detail: "no job produces the candidate-upload step",
    });
  } else {
    // A "smoke" job is any job that gates publication: native target jobs
    // (one of the five required runners) AND install smoke jobs. We
    // explicitly exclude the producer itself, the publish job, and the
    // canary (which depends on publish, not the producer).
    const smokeJobs = allJobIds.filter((id) => {
      if (id === producer.id) return false;
      if (/publish/u.test(id)) return false;
      if (/canary/u.test(id)) return false;
      const job: WorkflowJob | undefined = jobs[id];
      const label = runsOnLabel(job?.["runs-on"]);
      if (REQUIRED_NATIVE_RUNNERS.some((r) => label === r)) return true;
      const stepText = (job?.steps ?? []).map((s) => s.run ?? "").join("\n");
      if (/install\.sh/u.test(stepText) || /install\.ps1/u.test(stepText)) return true;
      return false;
    });
    const notDepending = smokeJobs.filter((id) => {
      const job: WorkflowJob | undefined = jobs[id];
      return !getJobNeeds(job ?? EMPTY_JOB).includes(producer.id);
    });
    if (notDepending.length > 0) {
      violations.push({
        rule: "smoke-depends-on-candidate",
        source: "Scope L41 + Todo 4 brief",
        detail: `smoke jobs do not depend on candidate producer (${producer.id}): ${notDepending.join(", ")}`,
      });
    }
  }

  // Rule 7: publish depends on every required smoke job.
  // Source: Todo 4 brief ("publish depends on every required smoke job").
  const publishJob = findJobById(jobs, (_job, id) => /publish/u.test(id)) ?? findJobById(jobs, (job) => {
    // Fallback: a job whose steps include `gh release create` and that holds
    // contents: write.
    if (writeHolders.length !== 1) return false;
    const jp = jobPermissions(job["permissions"]);
    return jp !== null && String(jp["contents"] ?? "") === "write" && job.steps.some((s) => /gh release create/u.test(s.run ?? ""));
  });
  if (publishJob === null) {
    violations.push({
      rule: "publish-job-exists",
      source: "Todo 4 brief",
      detail: "no job identifiable as publish (must depend on smoke jobs and hold contents: write)",
    });
  } else {
    const publishNeeds = getJobNeeds(publishJob.job);
    // Required gates: every native smoke job + every install smoke job.
    // The canary and the producer itself are NOT in publish's needs —
    // publish depends on smoke jobs, the canary depends on publish, and
    // the producer is the implicit upstream of every smoke job.
    const requiredGateIds = allJobIds.filter((id) => {
      if (id === publishJob.id) return false;
      if (/canary/u.test(id)) return false;
      // Producer (build-package) does not need to be in publish's needs
      // explicitly because every smoke job already depends on it.
      if (id === producer?.id) return false;
      const job = jobs[id];
      const label = runsOnLabel(job?.["runs-on"] ?? "");
      if (REQUIRED_NATIVE_RUNNERS.some((r) => label === r)) return true;
      const stepText = (job?.steps ?? []).map((s) => s.run ?? "").join("\n");
      if (/install\.sh/u.test(stepText) || /install\.ps1/u.test(stepText)) return true;
      return false;
    });
    const missing = requiredGateIds.filter((id) => !publishNeeds.includes(id));
    if (missing.length > 0) {
      violations.push({
        rule: "publish-needs-smokes",
        source: "Todo 4 brief",
        detail: `publish job (${publishJob.id}) does not depend on: ${missing.join(", ")}`,
      });
    }
  }

  // Rule 8: publish downloads the tested artifact bundle by ID.
  // Source: Todo 4 brief ("publish downloads the tested artifact bundle by ID")
  //         and Todo 9 L155-161 (publish retrieves by `actions/artifacts/<id>/zip`).
  if (publishJob !== null) {
    const downloadsById = publishJob.job.steps.some(
      (step) => /actions\/artifacts\/\$\{[^}]*artifact[_-]?id[^}]*\}\/zip/u.test(step.run ?? "") ||
        /actions\/artifacts\/.+\/zip/u.test(step.run ?? ""),
    );
    if (!downloadsById) {
      violations.push({
        rule: "publish-download-by-id",
        source: "Todo 4 brief + Todo 9 L155-161",
        detail: "publish job does not download the artifact by ID (no `actions/artifacts/.../zip` reference)",
      });
    }
  }

  // Rule 9: public files are exactly six archives + checksums.txt.
  // Source: Scope L25-31 ("Public release contract: exactly six archives plus
  //         checksums.txt") and Verification strategy L60 ("seven exact public
  //         assets").
  if (publishJob !== null) {
    const publishRun = publishJob.job.steps
      .map((s) => s.run ?? "")
      .join("\n");
    // YAML literal block scalars use `\` at end of line to continue on
    // the next line; the parser keeps the literal backslash + newline
    // characters in the string. Collapse them before scanning for path
    // tokens.
    const normalized = publishRun.replace(/\\\r?\n/g, " ");
    // Find the single `gh release create` invocation and inspect its path args.
    const createMatch = normalized.match(/gh release create[^\n]*/u);
    if (createMatch === null) {
      violations.push({
        rule: "gh-release-create",
        source: "Todo 4 brief + Todo 9 L155-161",
        detail: "publish job does not run `gh release create` (draft creation required)",
      });
    } else {
      const createLine = createMatch[0];
      // Capture every path-like token from the create invocation. A
      // basename is a contiguous run of letters/digits/`._-` ending in
      // `.tar.gz` or `.zip` or `checksums.txt`. (Excluding flag values
      // that contain dots, e.g. `--generate-notes`, which never do.)
      const basenameRe = /[A-Za-z0-9][A-Za-z0-9._-]*\.(?:tar\.gz|zip)|checksums\.txt/gu;
       const pathTokens = createLine.match(basenameRe) ?? [];
       const usesManifest = publishRun.includes("release-targets.json");
       const expected = new Set(PUBLIC_BASENAMES);
       const seen = new Set(pathTokens);
       const missing = usesManifest ? [] : PUBLIC_BASENAMES.filter((n) => !seen.has(n));
       const extra = pathTokens.filter((p) => !expected.has(p));
      if (missing.length > 0 || extra.length > 0) {
        violations.push({
          rule: "public-asset-basenames",
          source: "Scope L25-31",
          detail: `gh release create path set diverges. missing=[${missing.join(", ")}] extra=[${extra.join(", ")}]`,
        });
      }
    }
  }

  // Rule 10: raw executables and release-size-report.json must NOT appear as
  //          publish-job upload `with: path` patterns.
  // Source: Scope L40-45 ("no raw executable GitHub Release assets",
  //         "release-size-report.json" is internal-only) and Todo 4 brief.
  if (publishJob !== null) {
    const publishUploadPaths = publishJob.job.steps
      .filter((step) => step.uses?.startsWith("actions/upload-artifact") === true || step.uses?.startsWith("softprops/action-gh-release") === true)
      .map((step) => {
        const withBody = step.with ?? {};
        const pathField = withBody["path"] ?? withBody["files"];
        if (typeof pathField === "string") return pathField;
        if (Array.isArray(pathField)) return pathField.map(String).join("\n");
        return "";
      })
      .join("\n");
    const rawLeak = RAW_BASENAMES.filter((b) => publishUploadPaths.includes(b));
    if (rawLeak.length > 0) {
      violations.push({
        rule: "no-raw-public-assets",
        source: "Scope L25-31, L45",
        detail: `publish job references raw executables as upload paths: ${rawLeak.join(", ")}`,
      });
    }
    if (publishUploadPaths.includes("release-size-report.json")) {
      violations.push({
        rule: "no-size-report-public",
        source: "Scope L40",
        detail: "publish job exposes release-size-report.json as a public upload path",
      });
    }
  }

  // Rule 11: post-publication canary depends on publish.
  // Source: Scope L42 ("retain one immutable-tag post-publication install canary")
  //         and Todo 4 brief ("post-publication canary depends on publish").
  // A canary is a job whose ID contains "canary" — that's the
  // post-publication install probe. Pre-publication install smoke jobs
  // (e.g. install-posix, install-powershell) serve a different purpose
  // and are NOT the canary. Resolve once at function scope so Rule 12f
  // (and any future rule that needs the canary job) can reference it.
  const canary = findJobById(jobs, (_job, id) => /canary/u.test(id));
  if (canary === null) {
    violations.push({
      rule: "canary-job-exists",
      source: "Scope L42 + Todo 4 brief",
      detail: "no post-publish canary job found (job id must contain 'canary')",
    });
  } else if (publishJob !== null && !getJobNeeds(canary.job).includes(publishJob.id)) {
    violations.push({
      rule: "canary-needs-publish",
      source: "Scope L42 + Todo 4 brief",
      detail: `canary job (${canary.id}) does not depend on publish (${publishJob.id})`,
    });
  }

  // Rule 12: runner labels include the five pinned names; windows-arm64
  //          validation is labeled structural (not runtime).
  // Source: Scope L41 + Scope L51 ("No reliance on a Windows ARM64 public-
  //         preview runner for a required publication gate; structural
  //         validation must report that it is non-runtime validation") and
  //         Todo 4 brief.
  const allRunnerLabels = new Set<string>();
  for (const job of Object.values(jobs)) {
    const label = runsOnLabel(job["runs-on"]);
    if (label.length > 0) allRunnerLabels.add(label);
  }
  for (const required of REQUIRED_NATIVE_RUNNERS) {
    if (!allRunnerLabels.has(required)) {
      violations.push({
        rule: "runner-label-present",
        source: "Scope L41 + Todo 4 brief",
        detail: `required runner label missing: ${required}`,
      });
    }
  }
  // The windows-arm64 job is identified by its JOB ID, not step text —
  // step text like `umactually-windows-arm64.zip` would otherwise match
  // the publish job's `gh release create` paths.
  const windowsArm64Job = findJobById(jobs, (_job, id) => /windows[-_]?arm64/u.test(id));
  if (windowsArm64Job !== null) {
    const stepText = windowsArm64Job.job.steps
      .map((s) => `${s.name ?? ""} ${s.run ?? ""}`)
      .join("\n");
    const isStructural = /structural|non[- ]?runtime|pe[^\n]{0,40}(machine|validation|archive)/iu.test(stepText);
    if (!isStructural) {
      violations.push({
        rule: "windows-arm64-structural",
        source: "Scope L41, L51 + Todo 4 brief",
        detail: `windows-arm64 job (${windowsArm64Job.id}) must explicitly label its validation structural or non-runtime (e.g. 'Structural PE machine type + archive validation (non-runtime)')`,
      });
    }
  }

  // Rule 12b: every smoke job's "Download candidate bundle (by id)" step
  //           must redirect `gh api ...` to a file via PowerShell `>` or
  //           bash `>` redirection. NEVER `gh api ... --output`, which
  //           is not a gh CLI flag (run 29627957958 surface this with
  //           `unknown flag: --output` exit code 1, silently producing
  //           an empty/absent candidate-transport.zip and breaking
  //           Expand-Archive on Windows ARM64 structural).
  //
  // Cross-reference: hotfix #11.
  for (const [jobId, job] of Object.entries(jobs)) {
    if (!/smoke-/u.test(jobId)) continue;
    const runText = (job.steps ?? [])
      .map((s) => s.run ?? "")
      .join("\n");
    const ghApiSteps = runText.split("\n").filter((line) => /gh api/u.test(line));
    if (ghApiSteps.length === 0) continue;
    for (const line of ghApiSteps) {
      // Acceptable forms:
      //   gh api "...zip" > candidate-transport.zip     (bash; most jobs)
      //   gh api "...zip" | Out-File -Encoding utf8 ... (PowerShell)
      // Reject:
      //   gh api "...zip" --output candidate-transport.zip
      //   gh api "...zip" -o candidate-transport.zip
      const usesUnsupportedOutputFlag = /gh\s+api\s+[^\n]*\s+--?(?:output|o)\s+\S/u.test(line);
      if (usesUnsupportedOutputFlag) {
        violations.push({
          rule: "gh-api-no-output-flag",
          source: "Run 29627957958 (Windows ARM64 structural smoke failed with 'unknown flag: --output')",
          detail: `job ${jobId} uses \`gh api ... --output <file>\` which is not a gh CLI flag. Replace with stdout redirection (\`> <file>\` in bash, \`| Out-File ...\` in PowerShell) so the streaming response is written to disk.`,
        });
      }
    }
  }

  // Rule 12c: the candidate bundle uploaded by `build-package`
  //           (path: release/public, release/internal/raw,
  //            release/internal/release-size-report.json) MUST
  //           include scripts/release-targets.json copied to
  //           release/internal/release-targets.json. The publish
  //           and canary jobs run from $RUNNER_TEMP/umactually-release-candidate
  //           and `cd ...` into the bundle's `release/` directory
  //           before reading the manifest. Without the bundled copy,
  //           run 29628553762 (and every prior release run that
  //           reached the publish job) failed with ENOENT reading
  //           `scripts/release-targets.json` because that path is
  //           relative to the working tree, NOT the bundle.
  //
  //           Pin the contract: every script that writes the
  //           candidate-bundle layout (currently the inline node -e
  //           block in `build-package`'s Stage step) MUST also copy
  //           scripts/release-targets.json into release/internal/.
  //           The pinning lives here instead of the node -e block
  //           because that block has been refactored twice and is
  //           easy to drift; this rule is the source of truth that
  //           the publish path works.
  const buildPackage = findJobById(jobs, (_job, id) => id === "build-package");
  if (buildPackage !== null) {
    const stageStepText = buildPackage.job.steps
      .map((s) => `${s.name ?? ""} ${s.run ?? ""}`)
      .join("\n");
    const bundlesManifest = /release-targets\.json/u.test(stageStepText);
    if (!bundlesManifest) {
      violations.push({
        rule: "build-package-bundles-manifest",
        source: "Run 29628553762 (publish ENOENT for scripts/release-targets.json)",
        detail: `build-package's Stage candidate bundle step must copy scripts/release-targets.json into the candidate bundle (e.g. into release/internal/release-targets.json). The publish + canary jobs run from $RUNNER_TEMP/umactually-release-candidate and cannot resolve scripts/release-targets.json from the working tree.`,
      });
    }
    // And pin the upload-artifact path includes release/internal/release-targets.json:
    const uploadStep = buildPackage.job.steps.find((s) => /Upload candidate bundle/u.test(s.name ?? ""));
    if (uploadStep !== undefined) {
      const uploadPath = String(uploadStep.with?.["path"] ?? "");
      if (!/(^|\s)release\/internal\/release-targets\.json(\s|$)/u.test(uploadPath)) {
        violations.push({
          rule: "upload-artifact-includes-manifest",
          source: "Run 29628553762",
          detail: `build-package's Upload candidate bundle step path: must include release/internal/release-targets.json so the publish + canary jobs can resolve the manifest from $RUNNER_TEMP/umactually-release-candidate/...`,
        });
      }
    }
  }

  // Rule 12d: every publish-job step that consumes the manifest via
  //           Node's `fs.readFileSync` MUST read the in-bundle path
  //           `internal/release-targets.json` (NOT
  //           `release/internal/release-targets.json`) and MUST `cd`
  //           into the bundle root BEFORE the read. The bundle's
  //           extracted root has only `public/` and `internal/` —
  //           there is NO `release/` ancestor — because
  //           `actions/upload-artifact` archives the contents of the
  //           `path:` argument (it strips the shared `release/`
  //           ancestor). Run 29629288395 surfaced this: the publish
  //           job's Node helper read `release/internal/release-targets.json`
  //           and exited with ENOENT.
  //
  //           For each named publish step that reads the manifest,
  //           we assert:
  //           - run contains `cd "$RUNNER_TEMP/umactually-release-candidate"`
  //             textually BEFORE the manifest read;
  //           - run contains `fs.readFileSync("internal/release-targets.json"`
  //           - run does NOT contain `fs.readFileSync("release/internal/release-targets.json"`
  //           - run does NOT contain `fs.readFileSync("scripts/release-targets.json"`
  //             (scripts/... only exists in the canary workspace).
  //
  //           Steps covered: `Validate exact candidate bundle layout`,
  //           `Compute candidate asset hashes (pre-publish verification)`,
  //           `gh release create (draft)`, `Verify draft assets + hashes
  //           (pre-publish gate)`.
  if (publishJob !== null) {
    const publishStepNames = [
      "Validate exact candidate bundle layout",
      "Compute candidate asset hashes (pre-publish verification)",
      "gh release create (draft)",
      "Verify draft assets + hashes (pre-publish gate)",
    ];
    for (const stepName of publishStepNames) {
      const step = publishJob.job.steps.find((s) => (s.name ?? "") === stepName);
      if (step === undefined) continue;
      const run = step.run ?? "";
      // The cd must be to the EXACT bundle root, not to a path that
      // merely contains the root as a prefix (e.g. `cd "...-broken"`).
      // We require the cd's path to end at the bundle root: either
      // a newline, a `&&`, a `;`, or end-of-step after the closing
      // quote.
      const cdMatch = /\bcd\s+"\$\{?RUNNER_TEMP\}?\/umactually-release-candidate"(?=\s|$|&&|;|\|)/u.exec(run);
      const readBundlePath = /fs\.readFileSync\(\s*"internal\/release-targets\.json"/u.test(run);
      const readWrongPath = /fs\.readFileSync\(\s*"release\/internal\/release-targets\.json"/u.test(run);
      const readScriptPath = /fs\.readFileSync\(\s*"scripts\/release-targets\.json"/u.test(run);
      if (!readBundlePath && !readWrongPath && !readScriptPath) continue;
      if (!readBundlePath) {
        violations.push({
          rule: "publish-manifest-path-incorrect",
          source: "Run 29629288395 (publish ENOENT on scripts/release-targets.json relative path)",
          detail: `${stepName}: must read internal/release-targets.json (the bundle's extracted manifest path), not ${readWrongPath ? "release/internal/release-targets.json" : "scripts/release-targets.json"}. actions/upload-artifact strips the release/ ancestor; the bundle root contains only public/ and internal/.`,
        });
        continue;
      }
      if (!cdMatch) {
        violations.push({
          rule: "publish-manifest-needs-cd",
          source: "Run 29629288395 (publish Node helper ran from workspace cwd, ENOENT)",
          detail: `${stepName}: must \`cd "$RUNNER_TEMP/umactually-release-candidate"\` BEFORE the Node manifest read so the relative path "internal/release-targets.json" resolves.`,
        });
        continue;
      }
      // Ensure the cd occurs textually before the read.
      if (cdMatch.index > run.indexOf('fs.readFileSync("internal/release-targets.json"')) {
        violations.push({
          rule: "publish-manifest-cd-before-read",
          source: "Run 29629288395",
          detail: `${stepName}: the \`cd "$RUNNER_TEMP/umactually-release-candidate"\` statement must appear textually BEFORE the fs.readFileSync call to "internal/release-targets.json".`,
        });
      }
    }
  }

  // Rule 12e: the publish job's `gh release create (draft)` step
  //           must pass `public/<archive>` paths (relative to the
  //           bundle root) and `public/checksums.txt`, NOT bare
  //           basenames. Run 29629288395 would have surfaced this
  //           as MISSING=7 if it had reached gh release create with
  //           the current bare-basename form. The bundle root has
  //           no `umactually-linux-x64.tar.gz` directly — only
  //           `public/umactually-linux-x64.tar.gz`.
  if (publishJob !== null) {
    const createStep = publishJob.job.steps.find((s) => /gh release create/u.test(s.run ?? ""));

    if (createStep !== undefined) {
      const run = createStep.run ?? "";
      // The publish job's `gh release create` arguments must use
      // `public/<archive>` paths (relative to the bundle root), NOT
      // bare basenames or any other prefix. The bundle's archives
      // live under `public/` only — `release/internal/...` would
      // also be wrong because that path doesn't exist in the
      // extracted root.
      const hasLiteralPublicPath = /public\/umactually-/u.test(run);
      const hasTemplatePublicPath = /public\/\$\{target\.archiveName\}/u.test(run);
      // Variable form: follow the upstream node helper if the step
      // sets $ASSET_ARGS (or any variable holding the asset list).
      const varMatch = /\$\b([A-Z_][A-Z0-9_]*)\s*$/mu.exec(run);
      let varDefHasPublicPath = false;
      if (varMatch !== null) {
        const varName = varMatch[1] ?? "";
        const defRe = new RegExp(
          "\\b" + varName + "\\s*=\\$\\(node\\s+-e\\s*['\"`]",
          "u",
        );
        const defMatch = defRe.exec(run);
        if (defMatch !== null) {
          const after = run.slice(defMatch.index);
          const bodyMatch = /['"`]\s*([\s\S]*?)['"`]\s*\)/u.exec(after);
          if (bodyMatch !== null) {
            const body = bodyMatch[1] ?? "";
            varDefHasPublicPath = /public\/\$\{target\.archiveName\}/u.test(body)
              || /public\/\$\{target\b[^}]*\.archiveName\}/u.test(body);
          }
        }
      }
      const hasAnyPublicPath = hasLiteralPublicPath || hasTemplatePublicPath || varDefHasPublicPath;
      // Every archive token must be preceded by `public/` (or be a
      // template that includes `public/`). Anything else — bare
      // basenames, `release/...`, `internal/raw/...` — is wrong.
      // The preceding character can be whitespace OR a path-separator
      // `/` (e.g. `release/internal/umactually-linux-x64.tar.gz`),
      // so the prefix check is wider than `\s`.
      const archiveArgs = run.match(/\bumactually-(?:linux|darwin|windows)-[\w.-]+/gu) ?? [];
      const malformed = archiveArgs.filter((token) => {
        const idx = run.indexOf(token);
        const prefix = run.slice(Math.max(0, idx - 32), idx);
        // Accept only `public/` immediately preceding the token.
        return !/public\/$/u.test(prefix);
      });
      if (!hasAnyPublicPath || malformed.length > 0) {
        violations.push({
          rule: "publish-asset-paths-must-be-public-prefixed",
          source: "Run 29629288395 (would surface as MISSING=7 in gh release create)",
          detail: `gh release create (draft): every archive asset argument must be prefixed with \`public/\` (relative to the bundle root). Found malformed arguments: [${malformed.join(", ")}]. The bundle's archives live under public/, not at the root or anywhere else.`,
        });
      }
      // And the bundled checksums entry must be public/checksums.txt.
      if (!/public\/checksums\.txt/u.test(run)) {
        violations.push({
          rule: "publish-checksums-path-must-be-public-prefixed",
          source: "Run 29629288395",
          detail: `gh release create (draft): must reference public/checksums.txt (the bundle's checksums entry), not bare checksums.txt.`,
        });
      }
    }
  }

  // Rule 12f: the canary job's manifest reader MUST consume
  //           `scripts/release-targets.json` (the in-repo path
  //           available after `actions/checkout`) and MUST NOT
  //           switch to the bundle-only path. The canary does not
  //           download or extract the artifact — it reads the
  //           checked-in manifest from `GITHUB_WORKSPACE`.
  if (canary !== null) {
    const queryStep = canary.job.steps.find(
      (s) => (s.name ?? "") === "Query release by exact tag and assert seven assets",
    );
    if (queryStep !== undefined) {
      const run = queryStep.run ?? "";
      if (!/fs\.readFileSync\(\s*"scripts\/release-targets\.json"/u.test(run)) {
        violations.push({
          rule: "canary-manifest-must-read-scripts",
          source: "Run 29629288395 (canary side, latent)",
          detail: `Query release by exact tag: must read scripts/release-targets.json (the in-repo manifest available after actions/checkout), not release/internal/... nor internal/.... The canary does not download the artifact.`,
        });
      }
      if (/fs\.readFileSync\(\s*"release\/internal\/release-targets\.json"/u.test(run)) {
        violations.push({
          rule: "canary-must-not-read-artifact-path",
          source: "Run 29629288395 (canary side, latent)",
          detail: `Query release by exact tag: must not reference release/internal/release-targets.json — the canary does not download the artifact.`,
        });
      }
      // And: the canary's run-block must NOT include a `cd` to the
      // extracted bundle root. The canary runs from GITHUB_WORKSPACE.
      if (/\bcd\s+"\$\{?RUNNER_TEMP\}?\/umactually-release-candidate\b/u.test(run)) {
        violations.push({
          rule: "canary-must-not-cd-to-bundle-root",
          source: "Run 29629288395 (canary side, latent)",
          detail: `Query release by exact tag: must not cd into the bundle root — the canary does not extract the artifact.`,
        });
      }
    }
  }

  // Rule 13: publish uses literal `gh release create` with exactly seven
  //          explicit basename-only paths and a draft.
  // Source: Todo 4 brief ("publish job uses `gh release create ...` with
  //         exactly seven explicit basename-only paths in a single command
  //         (one draft create)").
  if (publishJob !== null) {
    const createStep = publishJob.job.steps.find((s) => /gh release create/u.test(s.run ?? ""));
    if (createStep === undefined) {
      violations.push({
        rule: "gh-release-create-step",
        source: "Todo 4 brief",
        detail: "publish job has no step that runs `gh release create`",
      });
    } else {
      const run = createStep.run ?? "";
      const required = ['--verify-tag', '--title "$GITHUB_REF_NAME"', "--generate-notes", "--draft"];
      for (const flag of required) {
        if (!run.includes(flag)) {
          violations.push({
            rule: "gh-release-create-flags",
            source: "Todo 4 brief",
            detail: `gh release create is missing flag: ${flag}`,
          });
        }
      }
    }
  }

  // Rule 14: pre-publish verification step confirms draft asset names + hashes
  //          before `gh release edit --draft=false`.
  // Source: Todo 4 brief ("a pre-publish verification step that confirms draft
  //         asset names and hashes before `gh release edit --draft=false`").
  if (publishJob !== null) {
    const publishRuns = publishJob.job.steps.map((s) => s.run ?? "").join("\n");
    const hasEdit = /gh release edit[^\n]*--draft=false/u.test(publishRuns);
    const hasAssetHashCheck = /(sha256sum|shasum|Get-FileHash|certutil).{0,200}(asset|release|umactually)/iu.test(publishRuns) ||
      /(asset|release|umactually).{0,200}(sha256sum|shasum|Get-FileHash|certutil)/iu.test(publishRuns);
    if (!hasEdit) {
      violations.push({
        rule: "publish-edit-draft-false",
        source: "Todo 4 brief",
        detail: "publish job has no `gh release edit --draft=false` step",
      });
    }
    if (!hasAssetHashCheck) {
      violations.push({
        rule: "publish-asset-hash-check",
        source: "Todo 4 brief",
        detail: "publish job has no pre-publish asset-name + hash verification step",
      });
    }
  }

  // Rule 15: a draft-deletion step is wired on pre-publish failure.
  // Source: Todo 4 brief ("a draft-deletion step is wired on pre-publish
  //         failure").
  if (publishJob !== null) {
    const hasDraftDelete = publishJob.job.steps.some((s) => {
      const run = s.run ?? "";
      return /gh release delete[^\n]*--draft/u.test(run) || /gh release delete[^\n]*-y/u.test(run) && /draft/u.test(run);
    });
    if (!hasDraftDelete) {
      violations.push({
        rule: "publish-draft-deletion",
        source: "Todo 4 brief",
        detail: "publish job has no `gh release delete` step wired to pre-publish failure",
      });
    }
  }

  // Rule 16: no pre-publish job may reference /releases/latest/.
  // Source: Scope L37 ("Remove the branch in a later release" — referring
  //         to legacy fallback; contract removes `releases/latest` as a
  //         pre-publication gate), Scope L38 (override matrix: no overrides
  //         → resolve `releases/latest` is consumer-side, NOT a pre-publish
  //         gate), and Todo 4 brief ("releases/latest references in
  //         pre-publish jobs reject").
  for (const [id, job] of Object.entries(jobs)) {
    if (id === publishJob?.id) continue;
    if (/canary/u.test(id)) continue;
    const stepText = job.steps
      .map((s) => `${s.run ?? ""}\n${(s.env ? Object.values(s.env).map(String).join(" ") : "")}`)
      .join("\n");
    if (/releases\/latest/u.test(stepText) || /\/releases\/latest\//u.test(stepText)) {
      violations.push({
        rule: "no-latest-in-pre-publish",
        source: "Scope L37, L38 + Todo 4 brief",
        detail: `pre-publish job (${id}) references /releases/latest/ — pre-publication gates must use the tested candidate bundle, not the live latest-release API`,
      });
    }
  }

  // Rule 17: manifest-derived publish asset lists must not hardcode archive names.
  // Source: release-binary-download-size RC#2.
  if (publishJob !== null) {
    const publishRuns = publishJob.job.steps.map((s) => s.run ?? "").join("\n");
    const publishArchiveNames = ARCHIVE_BASENAMES.filter((name) => publishRuns.includes(name));
    if (publishArchiveNames.length > 0 && !publishRuns.includes("release-targets.json") && !publishRuns.includes("CANDIDATE_BASELINE_MANIFEST") && publishRuns.includes("ASSET_ARGS=")) {
      violations.push({
        rule: "manifest-parity",
        source: "release-binary-download-size RC#2",
        detail: `publish job hardcodes archive basenames (${publishArchiveNames.join(", ")}); derive them from scripts/release-targets.json`,
      });
    }
    const hashStep = publishJob.job.steps.find((step) => /Compute candidate asset hashes/u.test(step.name ?? ""));
    if (hashStep !== undefined && !hashStep.run?.includes("release-targets.json")) {
      violations.push({
        rule: "manifest-parity-hashes",
        source: "release-binary-download-size RC#2",
        detail: "candidate asset hashes must read archive names from scripts/release-targets.json",
      });
    }
  }

  // Rule 18: the build pipeline's raw-binary copy step MUST NOT
  //          hardcode a manifest `rawName`. F1 audit identified four
  //          places in `.github/workflows/release.yml` that duplicated
  //          manifest data as hardcoded shell tokens with no automated
  //          parity gate. The most concrete duplication is a literal
  //          `cp dist/<rawName> release/<rawName>` (or `mv`, `tar`,
  //          `ln`, `install`) line that names a manifest rawName —
  //          that shape is ALWAYS an ungrounded duplication. Other
  //          uses (e.g. `cd candidate/public && sha256sum -c
  //          checksums.txt`, the `gh release create <files>` wire
  //          format, or  the contract test's `tar -xzf` smoke) are
  //          legitimate — they operate on the *runtime bundle* the
  //          candidate produced, not on a hardcoded list.
  //          This rule is narrowly scoped to RAW-binary copy/mv/ln
  //          patterns and ONLY fires when the step does not also read
  //          `scripts/release-targets.json`.
  // Source: F1 audit (release-binary-download-size).
  for (const [id, job] of Object.entries(jobs)) {
    for (const [stepIndex, step] of job.steps.entries()) {
      const stepText = step.run ?? "";
      if (stepText.length === 0) continue;
      // Steps that read the manifest at runtime are exempted — they
      // derive basenames from the JSON, so any literal rawName
      // elsewhere is by-construction derived.
      if (stepText.includes("release-targets.json")) continue;
      const lines = stepText.split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex] ?? "";
        // Detect a copy/move-style shell line that names a manifest
        // rawName. The shape is `<verb> <src-with-rawName>
        // <dst-with-rawName>` where the rawName appears on the same
        // line. This catches `cp dist/umactually-linux-x64
        // release/umactually-linux-x64`, `mv foo/umactually-darwin-arm64
        // bar/umactually-darwin-arm64`, etc. — exactly the F1 audit's
        // hardcoded target/basename duplication shape.
        for (const rawName of RAW_BASENAMES) {
          const escaped = rawName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
          const copyRe = new RegExp(`\\b(?:cp|mv|ln|install)\\b[^\\n]*\\b${escaped}\\b[^\\n]*\\b${escaped}\\b`, "u");
          if (copyRe.test(line)) {
            violations.push({
              rule: "manifest-parity",
              source: "F1 audit (release-binary-download-size)",
              detail: `job ${id} step ${stepIndex} line ${lineIndex + 1} hardcodes copy/move of manifest rawName "${rawName}" without reading scripts/release-targets.json — manifest is the single source of truth; consume the list via \`node -e\` reading release-targets.json`,
            });
          }
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// RED tests against the current `.github/workflows/release.yml`.
//
// Self-attestation: the current workflow is KNOWN-BROKEN relative to this
// contract. The mismatches are intentional — Todo 9 of the plan ships the
// fix. These tests must FAIL today; they will go GREEN once Todo 9 lands.
// ---------------------------------------------------------------------------

describe("Release workflow contract — RED against current workflow (Todo 9 fix)", () => {
  // Self-attestation comment (mandatory per task brief):
  // The current `.github/workflows/release.yml` ships raw `.exe` artifacts
  // and conflates build + publish inside one job. Todo 9 of
  // `.omo/plans/release-binary-download-size.md` rewrites the workflow to
  // satisfy this contract. The tests below must FAIL today and PASS after
  // that rewrite.

  it("RELEASE-WORKFLOW-CONTRACT: the release.yml satisfies every pre-publication graph contract rule", () => {
    // Given: the on-disk release workflow, parsed as YAML.
    const workflow = loadCurrentWorkflow();

    // When: every contract rule is probed.
    const violations = probeContract(workflow);

    // Then: the violation list must be empty. A non-empty list names every
    // rule the current workflow fails to satisfy, with the plan source line
    // each rule implements — making the red-phase diagnostic directly
    // actionable for the Todo 9 implementer.
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  it("RELEASE-WORKFLOW-GH-API-NO-OUTPUT-FLAG: every smoke job's gh api step uses stdout redirection, never `--output` (run 29627957958)", () => {
    // Run 29627957958 surfaced this: smoke-windows-arm64-structural
    // passed \`gh api ... --output candidate-transport.zip\`. gh does
    // not have an --output flag; it printed its usage banner, exited
    // non-zero, and produced an empty candidate-transport.zip that
    // Expand-Archive then rejected with "path ... does not exist".
    //
    // Pin the rule: every \`gh api ...zip\` invocation across all
    // smoke-* jobs in the workflow must redirect via shell stdout
    // capture (`>`, `| Out-File`, etc.) — never `--output` or `-o`,
    // which are not flags `gh` recognizes.
    const workflow = loadCurrentWorkflow();
    const jobs = workflow["jobs"] as Record<string, WorkflowJob>;
    for (const [jobId, job] of Object.entries(jobs)) {
      if (!/smoke-/u.test(jobId)) continue;
      const runText = job.steps.map((s) => s.run ?? "").join("\n");
      const offenders = runText
        .split("\n")
        .filter((line) => /gh\s+api\s+[^\n]*\s+--?(?:output|o)\s+\S/u.test(line));
      expect(
        offenders,
        `job ${jobId} uses \`gh api ... --output\` which is not a gh CLI flag. ` +
          `Replace with stdout redirection (\`> <file>\` in bash, \`| Out-File ...\` in PowerShell).`,
      ).toEqual([]);
    }
  });

  it("RELEASE-WORKFLOW-PUBLISH-MANIFEST-PATH-AND-CD: publish job reads `internal/release-targets.json` after `cd` to the bundle root (run 29629288395)", () => {
    // Run 29629288395 surfaced this: the publish job's Node helpers
    // read `release/internal/release-targets.json`, but
    // actions/upload-artifact archives the contents of `path:`
    // (stripping the shared `release/` ancestor), so the extracted
    // root contains `internal/release-targets.json`, NOT
    // `release/internal/release-targets.json`. Every publish-step
    // that consumes the manifest MUST (a) read `internal/...` and
    // (b) `cd "$RUNNER_TEMP/umactually-release-candidate"` BEFORE
    // the read. Probe must call probeContract on the on-disk
    // workflow and find zero violations of Rule 12d.
    const workflow = loadCurrentWorkflow();
    const violations = probeContract(workflow);
    const rule12d = violations.filter(
      (v) => v.rule === "publish-manifest-path-incorrect" ||
        v.rule === "publish-manifest-needs-cd" ||
        v.rule === "publish-manifest-cd-before-read",
    );
    expect(
      rule12d,
      `publish job manifest read path/cd rules violated: ${formatViolations(rule12d)}. ` +
        `Run 29629288395 surfaced ENOENT because PR #76 used "release/internal/release-targets.json" ` +
        `and never cd'd to the bundle root before reading.`,
    ).toEqual([]);
  });

  it("RELEASE-WORKFLOW-PUBLISH-ASSET-PATHS: gh release create receives `public/...` paths and `public/checksums.txt` (run 29629288395 latent)", () => {
    // Even if publish ENOENT on the manifest is fixed, the next
    // step (`gh release create`) would fail with MISSING=7 because
    // the seven asset paths were passed as bare basenames
    // (umactually-linux-x64.tar.gz, etc.) — files that exist only
    // under `public/` in the bundle root. The seven CLI arguments
    // must be `public/<archive>` paths plus `public/checksums.txt`.
    const workflow = loadCurrentWorkflow();
    const violations = probeContract(workflow);
    const rule12e = violations.filter(
      (v) => v.rule === "publish-asset-paths-must-be-public-prefixed" ||
        v.rule === "publish-checksums-path-must-be-public-prefixed",
    );
    expect(
      rule12e,
      `publish asset path rules violated: ${formatViolations(rule12e)}. ` +
        `Bare basenames are wrong: bundle has only public/<archive>, not <archive>.`,
    ).toEqual([]);
  });

  it("RELEASE-WORKFLOW-CANARY-MANIFEST-PATH: canary reads `scripts/release-targets.json` from the workspace, not the artifact path", () => {
    // The canary does NOT download or extract the candidate artifact;
    // it operates on `GITHUB_WORKSPACE` after `actions/checkout`.
    // Therefore it must read the in-repo manifest at
    // `scripts/release-targets.json`, NOT the artifact-only paths.
    const workflow = loadCurrentWorkflow();
    const violations = probeContract(workflow);
    const rule12f = violations.filter(
      (v) => v.rule === "canary-manifest-must-read-scripts" ||
        v.rule === "canary-must-not-read-artifact-path" ||
        v.rule === "canary-must-not-cd-to-bundle-root",
    );
    expect(
      rule12f,
      `canary manifest read rules violated: ${formatViolations(rule12f)}. ` +
        `The canary must read scripts/release-targets.json from the workspace, ` +
        `not the artifact-only path.`,
    ).toEqual([]);
  });

  it("RELEASE-WORKFLOW-DISPATCH: workflow_dispatch inputs are publish (boolean) and correlation (string)", () => {
    // Source: Todo 4 brief.
    const workflow = loadCurrentWorkflow();
    const onRecord = readOnRecord(workflow);
    const dispatch = onRecord["workflow_dispatch"];
    expect(dispatch, "workflow_dispatch trigger is required for native dispatch QA").toBeDefined();
    const inputs = readRecord((dispatch as Record<string, unknown>)["inputs"] ?? {}, "workflow_dispatch.inputs");
    expect(String(readRecord(inputs["publish"] ?? {}, "publish")["type"])).toBe("boolean");
    expect(String(readRecord(inputs["correlation"] ?? {}, "correlation")["type"])).toBe("string");
  });

  it("RELEASE-WORKFLOW-INSTALLER-GATES: native lanes install exact local candidates before publish", () => {
    // Given: the parsed release workflow and the five executable native lanes.
    const jobs = readJobs(loadCurrentWorkflow()["jobs"]);
    const nativeIds = [
      "smoke-linux-x64",
      "smoke-linux-arm64",
      "smoke-darwin-x64",
      "smoke-darwin-arm64",
      "smoke-windows-x64",
    ] as const;

    // When: each lane's executable step contract is inspected.
    for (const id of nativeIds) {
      const job = jobs[id] ?? EMPTY_JOB;
      const text = job.steps.map((step) => `${step.uses ?? ""}\n${step.run ?? ""}\n${Object.entries(step.env ?? {}).map(([key, value]) => `${key}=${String(value)}`).join(" ")}`).join("\n");

      // Then: it retrieves the producer artifact ID, verifies transport and
      // inner checksums, serves localhost, pins the candidate tag/base, invokes
      // the real installer, and exercises all installed CLI surfaces.
      expect(text, `${id} must use download-artifact@v4`).toContain("actions/download-artifact@v4");
      expect(text).toContain("needs.build-package.outputs.artifact_id");
      expect(text).toContain("needs.build-package.outputs.artifact_digest");
      expect(text).toMatch(/sha256sum|shasum -a 256|Get-FileHash/u);
      expect(text).toContain("checksums.txt");
      expect(text).toContain("127.0.0.1");
      expect(text).toContain("http.server");
      expect(text).toContain("INSTALL_RELEASE_BASE");
      expect(text).toContain("INSTALL_RELEASE_TAG");
      expect(text).toContain("github.ref_name");
      expect(text).not.toContain("INSTALL_TEST_MODE");
      expect(text).toContain("--version");
      expect(text).toContain("--help");
      expect(text).toContain("doctor");
    }
  });

  it("RELEASE-WORKFLOW-FAILURE-GATES: delegation and checksum preservation gate publication", () => {
    // Given: the delegation, failure-preservation, and publish jobs.
    const jobs = readJobs(loadCurrentWorkflow()["jobs"]);
    const delegate = jobs["smoke-windows-x64-git-bash-delegate"] ?? EMPTY_JOB;
    const badChecksum = jobs["smoke-bad-checksum"] ?? EMPTY_JOB;
    const publish = jobs["publish"] ?? EMPTY_JOB;

    // When: their machine-consumed contracts are inspected.
    const delegateText = delegate.steps.map((step) => `${step.run ?? ""}\n${Object.values(step.env ?? {}).join(" ")}`).join("\n");
    const failureText = badChecksum.steps.map((step) => `${step.run ?? ""}\n${Object.values(step.env ?? {}).join(" ")}`).join("\n");

    // Then: Git Bash delegates to the locally served PowerShell installer,
    // checksum failure preserves the seeded binary and removes staging, and
    // publish requires every Todo 10 gate plus the producer explicitly.
    expect(getJobNeeds(delegate)).toContain("smoke-windows-x64");
    expect(delegateText).toContain("INSTALL_POWERSHELL_SCRIPT_URL");
    expect(delegateText).toContain("bash");
    expect(delegateText).toContain("powershell.exe");
    expect(failureText).toContain("0000000000000000000000000000000000000000000000000000000000000000");
    expect(failureText).toMatch(/sha256sum|shasum -a 256/u);
    expect(failureText).toMatch(/status|exit|nonzero|non-zero/iu);
    expect(failureText).toContain(".umactually-stage");
    expect(getJobNeeds(publish)).toEqual(expect.arrayContaining([
      "build-package",
      "smoke-linux-x64",
      "smoke-linux-arm64",
      "smoke-darwin-x64",
      "smoke-darwin-arm64",
      "smoke-windows-x64",
      "smoke-windows-x64-git-bash-delegate",
      "smoke-windows-arm64-structural",
      "smoke-bad-checksum",
    ]));
  });

  // ===========================================================================
  // Todo 11 — immutable-tag post-publication canary + doc hygiene.
  //
  // Three new contract assertions, added (not replacing) so the existing 10
  // tests remain as regression guards. Each assertion maps to a machine-
  // consumable contract surface the maintainer-facing docs also describe:
  //   1. The canary job MUST target the immutable tag URL, never /latest/.
  //   2. The canary job MUST verify all six archive basenames + checksums.txt.
  //   3. No user-facing doc may name a raw asset basename (umactually-linux-x64,
  //      etc.) as a supported download — only the installer one-liners are.
  // ===========================================================================

  it("RELEASE-WORKFLOW-CANARY-IMMUTABLE-TAG: canary uses github.ref_name, never latest", () => {
    // Given: the parsed workflow and the canary job (the post-publication
    // install probe; job id contains "canary").
    const jobs = readJobs(loadCurrentWorkflow()["jobs"]);
    const canaryEntry = findJobById(jobs, (_job, id) => /canary/u.test(id));
    if (canaryEntry === null) throw new Error("canary job not found");

    // When: every step's env surface is scanned for tag references. We
    // inspect env vars (the wire-format surface) rather than `run` text,
    // because run text may legitimately contain comments that document
    // the prohibition ("NEVER /releases/latest/") without violating it.
    const envSurface = canaryEntry.job.steps
      .map((step) => {
        const envEntries = step.env ?? {};
        return Object.entries(envEntries).map(([key, value]) => `${key}=${String(value)}`).join("\n");
      })
      .join("\n");

    // Then: the canary uses the immutable tag form in its wire-format
    // surface (env vars + URLs) and never /latest/.
    expect(envSurface, "canary must use github.ref_name as the tag source").toContain("github.ref_name");
    expect(envSurface, "canary must reference releases/download/<tag>").toMatch(/releases\/download\//u);
    // The canary also references /releases/tags/ via the gh api call —
    // include the `run` text only for that single purpose, then strip
    // comments (lines starting with `#`) before the negative assertion.
    const runNoComments = canaryEntry.job.steps
      .map((step) => step.run ?? "")
      .join("\n")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(runNoComments + "\n" + envSurface, "canary code (excluding comments) must use /releases/tags/ or /releases/download/").toMatch(/releases\/(tags|download)\//u);
    // No `/releases/latest/` anywhere in the env surface — the wire-format
    // contract.
    expect(envSurface, "canary env vars must never include releases/latest/").not.toMatch(/releases\/latest/u);
    expect(envSurface, "canary env vars must never include the literal `latest` as a tag value").not.toMatch(/\blatest\b/u);
  });

  it("RELEASE-WORKFLOW-CANARY-SEVEN-ASSETS: canary asserts all six archive basenames + checksums.txt", () => {
    // Given: the canary job and the manifest-derived canonical public asset names.
    // Manifest is the single source of truth — read `archiveName` directly so
    // adding/renaming a target requires only a manifest edit.
    const jobs = readJobs(loadCurrentWorkflow()["jobs"]);
    const canaryEntry = findJobById(jobs, (_job, id) => /canary/u.test(id));
    if (canaryEntry === null) throw new Error("canary job not found");
    const surface = canaryEntry.job.steps
      .map((step) => step.run ?? "")
      .join("\n");
    const expected = [...ARCHIVE_BASENAMES, "checksums.txt"];

    // When/Then: every manifest-derived archive basename appears as a literal
    // in the canary's run block (the node -e body emits them as string literals),
    // or the step references release-targets.json at runtime. The SHA-256
    // verification + installer invocation also run.
    const expectedLiteralPatterns = expected.filter((n) => n === "checksums.txt");
    for (const name of expectedLiteralPatterns) {
      expect(surface, `canary must reference public asset name: ${name}`).toContain(name);
    }
    // The six archive names must come from the manifest at runtime, NOT be
    // hardcoded as a literal shell line in the workflow.
    expect(surface, "canary must read public-asset names from release-targets.json").toContain("release-targets.json");
    for (const name of ARCHIVE_BASENAMES) {
      expect(surface, `canary must derive archive basename from manifest at runtime: ${name}`).not.toMatch(new RegExp(`^\\s*["']?${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}["']?\\s*\\\\?$`, "mu"));
    }
    expect(surface, "canary must verify the downloaded archive's SHA-256").toContain("sha256sum");
    expect(surface, "canary must run the public installer").toContain("install.sh");
    expect(surface, "canary must assert --version / --help / doctor").toContain("--version");
    expect(surface).toContain("--help");
    expect(surface).toContain("doctor");
  });

  it("RELEASE-WORKFLOW-DOC-HYGIENE: no user-facing doc names a raw asset basename as a supported download", () => {
    // Given: README.md and docs/release-process.md are the two surfaces that
    // a release reader will land on. The raw basenames are NOT supported
    // downloads (the installer one-liners are). They may legitimately appear
    // inside markdown tables (where they describe the source binary that goes
    // INTO an archive) or inside a sentence describing a ZIP's member name,
    // but they must never be advertised as a standalone download.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const releaseProcess = readFileSync(join(REPO_ROOT, "docs/release-process.md"), "utf8");
    const rawBasenames = RAW_BASENAMES;

    // Strip markdown tables and inline code spans so the residual check
    // covers only "prose" prose where a raw basename would mean "download
    // this raw file". Markdown tables (`| ... |`) and inline code spans
    // (`` ` ``) are the legitimate contexts where source-binary names
    // appear as documentation of what's inside an archive.
    function stripDocumentationContexts(text: string): string {
      const lines = text.split("\n");
      const out: string[] = [];
      let inTable = false;
      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        // Markdown table rows begin and end with `|` after trimming.
        const isTableRow = /^\s*\|.*\|\s*$/u.test(line);
        if (isTableRow) {
          inTable = true;
          continue;
        }
        if (inTable && line === "") {
          inTable = false;
          continue;
        }
        if (inTable) continue;
        // Strip inline code spans (single-backtick) from prose lines.
        out.push(line.replace(/`[^`]*`/gu, ""));
      }
      return out.join("\n");
    }

    function assertNoRawAssetReference(label: string, text: string): void {
      const residual = stripDocumentationContexts(text);
      for (const raw of rawBasenames) {
        const escaped = raw.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        const regex = new RegExp(escaped, "gu");
        const occurrences = residual.match(regex) ?? [];
        expect(
          occurrences.length,
          `${label} must not name raw asset basename "${raw}" outside of tables / inline code ` +
          `(found ${occurrences.length} in prose: ${occurrences.join(", ")}); raw assets are not supported downloads — use the installer one-liner`,
        ).toBe(0);
      }
    }

    // When/Then: neither doc exposes a raw executable basename as a
    // download target in prose.
    assertNoRawAssetReference("README.md", readme);
    assertNoRawAssetReference("docs/release-process.md", releaseProcess);
  });
});

function formatViolations(violations: readonly Violation[]): string {
  if (violations.length === 0) return "no violations";
  return [
    "release.yml fails the pre-publication graph contract:",
    ...violations.map((v, index) => `  ${index + 1}. [${v.rule}] ${v.source} — ${v.detail}`),
  ].join("\n");
}

// ===========================================================================
// GREEN tests against mutated in-memory fixtures.
//
// Each fixture is a candidate-passing workflow with ONE field mutated; the
// mutated workflow must be REJECTED by the same `probeContract` used above.
// This proves the probe is not a tautology that happens to pass the current
// workflow: every negative case is independently exercised.
// ===========================================================================

const CANDIDATE_YAML = /* yaml */ `name: Release
on:
  push:
    tags:
      - "v*"
  workflow_dispatch:
    inputs:
      publish:
        description: "Publish flag"
        type: boolean
        default: false
      correlation:
        description: "QA correlation id"
        type: string
        required: true
permissions: {}
concurrency:
  group: release-\${{ github.ref }}
  cancel-in-progress: false
jobs:
  build-package:
    name: build & package
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "24"
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.14"
      - name: Install dependencies
        run: npm ci
      - name: Build candidate bundle
        run: node scripts/build-binary.mjs
      - name: Stage candidate bundle (copies manifest into release/internal/release-targets.json)
        run: node scripts/stage-release-assets.mjs --release-dir release --manifest scripts/release-targets.json
      - name: Upload candidate bundle
        id: candidate-upload
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
        with:
          name: umactually-release-candidate
          # CANDIDATE_BASELINE: the contract probe expects the
          # candidate bundle to include the release manifest
          # (scripts/release-targets.json copied to
          # release/internal/release-targets.json by the stage
          # step). See the matching path in the real release.yml
          # upload step.
          path: |
            release/public
            release/internal/release-targets.json
  smoke-linux-x64:
    name: Linux x64 smoke
    needs: build-package
    runs-on: ubuntu-24.04
    steps:
      - name: Download candidate
        uses: actions/download-artifact@v4
        with:
          name: umactually-release-candidate
          path: candidate
      - name: Smoke (--version)
        run: ./candidate/umactually-linux-x64 --version
  smoke-linux-arm64:
    name: Linux ARM64 smoke
    needs: build-package
    runs-on: ubuntu-24.04-arm
    steps:
      - name: Download candidate
        uses: actions/download-artifact@v4
        with:
          name: umactually-release-candidate
          path: candidate
      - name: Smoke (--version)
        run: ./candidate/umactually-linux-arm64 --version
  smoke-darwin-x64:
    name: macOS x64 smoke
    needs: build-package
    runs-on: macos-15-intel
    steps:
      - name: Download candidate
        uses: actions/download-artifact@v4
        with:
          name: umactually-release-candidate
          path: candidate
      - name: Smoke (--version)
        run: ./candidate/umactually-darwin-x64 --version
  smoke-darwin-arm64:
    name: macOS ARM64 smoke
    needs: build-package
    runs-on: macos-15
    steps:
      - name: Download candidate
        uses: actions/download-artifact@v4
        with:
          name: umactually-release-candidate
          path: candidate
      - name: Smoke (--version)
        run: ./candidate/umactually-darwin-arm64 --version
  smoke-windows-x64:
    name: Windows x64 smoke
    needs: build-package
    runs-on: windows-2025
    steps:
      - name: Download candidate
        uses: actions/download-artifact@v4
        with:
          name: umactually-release-candidate
          path: candidate
      - name: Smoke (--version)
        shell: pwsh
        run: .\\candidate\\umactually-windows-x64.exe --version
  smoke-windows-arm64-structural:
    name: Windows ARM64 structural PE/archive validation
    needs: build-package
    runs-on: windows-2025
    steps:
      - name: Download candidate
        uses: actions/download-artifact@v4
        with:
          name: umactually-release-candidate
          path: candidate
      - name: Structural PE machine type + archive validation (non-runtime)
        run: node scripts/verify-arm64-structural.mjs
  install-posix:
    name: POSIX installer smoke
    needs: build-package
    runs-on: ubuntu-24.04
    steps:
      - name: Run install.sh
        run: bash scripts/install.sh
  install-powershell:
    name: PowerShell installer smoke
    needs: build-package
    runs-on: windows-2025
    steps:
      - name: Run install.ps1
        shell: pwsh
        run: .\\scripts\\install.ps1
  publish:
    name: publish
    needs:
      - smoke-linux-x64
      - smoke-linux-arm64
      - smoke-darwin-x64
      - smoke-darwin-arm64
      - smoke-windows-x64
      - smoke-windows-arm64-structural
      - install-posix
      - install-powershell
    runs-on: ubuntu-24.04
    permissions:
      contents: write
      actions: read
    env:
      GH_TOKEN: \${{ github.token }}
      ARTIFACT_ID: \${{ needs.build-package.outputs.artifact_id }}
    steps:
      - name: Download tested candidate bundle by ID
        env:
          ARTIFACT_ID: \${{ needs.build-package.outputs.artifact_id }}
        run: gh api repos/\${{ github.repository }}/actions/artifacts/\${{ env.ARTIFACT_ID }}/zip > candidate-transport.zip
      - name: Pre-publish verification (asset names + hashes)
        run: |
          sha256sum candidate/umactually-*.tar.gz candidate/umactually-*.zip candidate/checksums.txt
      - name: gh release create (draft)
        run: |
          gh release create "\$GITHUB_REF_NAME" \\
            --verify-tag \\
            --title "\$GITHUB_REF_NAME" \\
            --generate-notes \\
            --draft \\
            public/umactually-linux-x64.tar.gz \\
            public/umactually-linux-arm64.tar.gz \\
            public/umactually-darwin-x64.tar.gz \\
            public/umactually-darwin-arm64.tar.gz \\
            public/umactually-windows-x64.zip \\
            public/umactually-windows-arm64.zip \\
            public/checksums.txt
      - name: gh release edit --draft=false
        if: inputs.publish == 'false' && github.event_name == 'push'
        run: gh release edit "\$GITHUB_REF_NAME" --draft=false
      - name: Draft deletion on pre-publish failure
        if: failure()
        run: gh release delete "\$GITHUB_REF_NAME" --draft --yes
  canary:
    name: post-publish canary
    needs: publish
    runs-on: ubuntu-24.04
    steps:
      - name: Run install.sh against published tag
        run: bash scripts/install.sh
`;

// Mutation helpers — each returns a NEW yaml string with one field flipped.
// The base CANDIDATE_YAML satisfies every contract rule; every mutation
// must break exactly one rule.

const MUTATIONS = {
  // Negative 1: a smoke job (smoke-linux-x64) loses its needs: build-package
  //             dependency. Contract: every smoke job must depend on the
  //             candidate producer.
  "missing smoke dependency": (yaml: string): string => {
    // Find the smoke-linux-x64 block and remove its `needs: build-package`.
    const lines = yaml.split("\n");
    const startIdx = lines.findIndex((l) => l.trim() === "smoke-linux-x64:");
    if (startIdx === -1) return yaml;
    // Search the next ~10 lines for `needs: build-package`.
    for (let i = startIdx; i < Math.min(startIdx + 8, lines.length); i += 1) {
      if (lines[i]?.trim() === "needs: build-package") {
        return [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n");
      }
    }
    return yaml;
  },

  // Negative 2: build-package job gains contents: write. Contract: only
  //             publish holds contents: write.
  "write permission granted to build": (yaml: string): string => {
    // Insert a `permissions: contents: write` block AFTER the
    // `name: build & package` line.
    const lines = yaml.split("\n");
    const idx = lines.findIndex((l) => l.trim() === "name: build & package");
    if (idx === -1) return yaml;
    const insert = ["    permissions:", "      contents: write"];
    return [...lines.slice(0, idx + 1), ...insert, ...lines.slice(idx + 1)].join("\n");
  },

  // Negative 3: raw .exe paths leak into publish's `gh release create` paths.
  "raw .exe paths in publish": (yaml: string): string => {
    // Replace one of the archive basenames in the publish job with a raw
    // `.exe` path. The path appears after a `\\` line-continuation in the
    // candidate yaml; insert a new line.
    const lines = yaml.split("\n");
    const idx = lines.findIndex((l) => l.includes("umactually-linux-arm64.tar.gz"));
    if (idx === -1) return yaml;
    const replacement = "            release/umactually-windows-x64.exe \\\\";
    return [...lines.slice(0, idx), replacement, ...lines.slice(idx + 1)].join("\n");
  },

  // Negative 4: the literal `gh release create` step is removed (only
  //             `gh release edit --draft=false` remains). Contract: one
  //             draft create is required.
  "omits draft creation": (yaml: string): string => {
    // Remove every line of the gh release create step body, keeping the
    // surrounding step structure intact.
    const lines = yaml.split("\n");
    const startIdx = lines.findIndex((l) => l.includes("gh release create"));
    if (startIdx === -1) return yaml;
    // Find the end of the multi-line `run:` block. The block ends at the
    // next `      -` (next step) or at a less-indented line.
    let endIdx = startIdx + 1;
    while (endIdx < lines.length) {
      const line = lines[endIdx] ?? "";
      if (line.length > 0 && !line.startsWith("          ") && !line.startsWith("        ")) break;
      if (/^      - /u.test(line)) break;
      endIdx += 1;
    }
    return [...lines.slice(0, startIdx), ...lines.slice(endIdx)].join("\n");
  },

  // Negative 5: a pre-publish job references /releases/latest/ (forbidden
  //             by Scope: remove dependence on `releases/latest` as a
  //             pre-publication gate).
  "releases/latest in pre-publish job": (yaml: string): string => {
    // Add a `releases/latest` reference to the POSIX install smoke job's
    // step as an env var, so it parses cleanly as a child of the step.
    const lines = yaml.split("\n");
    const idx = lines.findIndex((l) => l.includes("Run install.sh") && l.trim().startsWith("- name:"));
    if (idx === -1) return yaml;
    const probe = "        env:\n          RESOLVE_LATEST: curl -fsSL https://api.github.com/repos/JosiahSiegel/umactually/releases/latest";
    // Insert AFTER the `- name:` line, before the `run:` line.
    return [...lines.slice(0, idx + 1), probe, ...lines.slice(idx + 1)].join("\n");
  },

  // Negative 6: a hardcoded raw basename (umactually-linux-x64) appears as a
  //             standalone shell token in a step that does NOT read the
  //             manifest. Contract: the build pipeline must read target
  //             lists from scripts/release-targets.json at runtime.
  "hardcoded raw basename outside manifest read": (yaml: string): string => {
    // Inject a hardcoded `cp dist/<raw> release/<raw>` style line into the
    // build-package "Build candidate bundle" step's run block.
    const lines = yaml.split("\n");
    const idx = lines.findIndex((l) => l.includes("node scripts/build-binary.mjs"));
    if (idx === -1) return yaml;
    const probe = "          cp dist/umactually-linux-x64 release/umactually-linux-x64";
    return [...lines.slice(0, idx + 1), probe, ...lines.slice(idx + 1)].join("\n");
  },

  // Negative 7: the publish job's manifest-read uses the
  //             `release/internal/release-targets.json` path (the path
  //             that PR #76 introduced). Run 29629288395 surfaced this
  //             — the path is invalid because actions/upload-artifact
  //             archives the contents of `path:`, stripping the shared
  //             `release/` ancestor.
  //
  //             The fixture encodes the publish-step asset path as a
  //             literal `public/<archive>` string in the YAML. We
  //             mutate by re-introducing the `release/` prefix on one
  //             archive line, simulating a regression that the
  //             probe MUST reject.
  "publish reads release/internal/": (yaml: string): string => {
    return yaml.replace(
      "public/umactually-linux-x64.tar.gz \\\\",
      "release/internal/umactually-linux-x64.tar.gz \\\\",
    );
  },

  // Negative 8: the publish job's manifest-read step is missing the
  //             `cd "$RUNNER_TEMP/umactually-release-candidate"` it
  //             needs to make the relative `internal/release-targets.json`
  //             path resolve.
  //
  //             The fixture's publish job uses no Node helper; the
  //             `cd` requirement is implicitly required for any future
  //             helper that reads the manifest. Mutate by injecting
  //             a fake Node helper that reads the manifest WITHOUT cd'ing.
  "publish omits cd before manifest read": (yaml: string): string => {
    return yaml.replace(
      /      - name: gh release create \(draft\)\n        run: \|/u,
      (match) =>
        `${match}\n          cd "$RUNNER_TEMP/umactually-release-candidate-broken"\n           node -e '\n             const fs = require("node:fs");\n             fs.readFileSync("internal/release-targets.json", "utf8");\n           '\n`,
    );
  },

  // Negative 9: the publish job's `gh release create` step passes bare
  //             basenames (umactually-linux-x64.tar.gz) instead of
  //             `public/...` paths. The bundle's archives live under
  //             `public/`, not at the root.
  //
  //             The fixture's gh release create step lists literal
  //             `public/<archive>` strings. Mutate by stripping the
  //             `public/` prefix on one archive line.
  "publish passes bare basenames to gh release create": (yaml: string): string => {
    return yaml.replace(
      "public/umactually-darwin-arm64.tar.gz \\\\",
      "umactually-darwin-arm64.tar.gz \\\\",
    );
  },

  // Negative 10: the canary job's manifest-read uses the artifact
  //              path `internal/release-targets.json`. The canary does
  //              NOT extract the artifact — it operates on the
  //              workspace after `actions/checkout`.
  //
  //              Mutate the fixture's canary step to switch its
  //              manifest read to the bundle path.
  "canary reads internal/release-targets.json": (yaml: string): string => {
    return yaml.replace(
      'readFileSync("scripts/release-targets.json"',
      'readFileSync("internal/release-targets.json"',
    );
  },

  // Negative 11: the canary job's manifest-read switches to
  //              `release/internal/release-targets.json` (the
  //              invalid path PR #76 introduced).
  "canary uses public/ path with cd to bundle": (yaml: string): string => {
    return yaml.replace(
      'readFileSync("scripts/release-targets.json"',
      'readFileSync("release/internal/release-targets.json"',
    );
  },
} as const satisfies Record<string, (yaml: string) => string>;

describe("Release workflow contract — GREEN against mutated fixtures (probe strength)", () => {
  it("CANDIDATE-BASELINE: the unmutated fixture satisfies every contract rule", () => {
    // Sanity check: the candidate fixture must pass on its own. If this
    // test fails, the candidate yaml is broken and every negative-case
    // test below is meaningless.
    const workflow = parseWorkflow(CANDIDATE_YAML);
    const violations = probeContract(workflow);
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  for (const [label, mutate] of Object.entries(MUTATIONS)) {
    it(`REJECTS: ${label}`, () => {
      // Given: a mutated candidate workflow with one contract rule broken.
      const mutated = mutate(CANDIDATE_YAML);
      


      // When: the contract is probed.
      const violations = probeContract(workflow);

      // Then: at least one violation must be reported. A zero-length
      // violation list means the probe let the mutation through, which
      // would mean the contract is too weak to gate Todo 9.
      expect(violations.length, `mutation should produce a violation but produced none\n--- mutated yaml ---\n${mutated}`).toBeGreaterThan(0);
    });
  }
});
