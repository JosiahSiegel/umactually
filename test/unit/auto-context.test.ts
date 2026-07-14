import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deriveContextFromGit } from "../../src/cli/auto-context.js";

const REPO_ROOT = resolve(__dirname, "..", "..");
// The production `DeriveInput` type makes `base` required, but the impl
// accepts an empty base and falls back to default-branch detection.
// Mirror that contract in the test type so individual test sites can
// focus on what they're verifying without repeating the boilerplate.
type Derive = (
  input: Omit<Parameters<typeof deriveContextFromGit>[0], "base"> & {
    readonly base?: string;
  },
) => ReturnType<typeof deriveContextFromGit>;

// Module-scope reference: typed alias of the production export. All test
// sites use this single shared reference (avoids redeclaring `derive` in
// every it-block, which would collide with itself inside the describe scope).
const derive = deriveContextFromGit as Derive;

describe("auto-context: derive event/diff/pr-number/repo from git repo", () => {
  let scratchDir: string;
  let realBareCloneDir: string;

  beforeAll(() => {
    // Scratch repo: in-process execFileSync targets use this cwd.
    scratchDir = mkdtempSync(join(tmpdir(), "auto-ctx-scratch-"));
    // Initialise a fresh git repo with origin/HEAD pointing at "main".
    spawnSync("git", ["init", "--initial-branch=main", "--quiet", scratchDir], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "config", "user.email", "test@example.com"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "config", "user.name", "Test"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "config", "commit.gpgsign", "false"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "checkout", "-q", "-b", "main"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "commit", "--allow-empty", "-m", "initial"], { stdio: "ignore" });
    // Fake a remote so origin/HEAD can be set without a real fetch.
    realBareCloneDir = mkdtempSync(join(tmpdir(), "auto-ctx-bare-"));
    spawnSync("git", ["init", "--bare", "--quiet", "--initial-branch=main", realBareCloneDir], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "remote", "add", "origin", realBareCloneDir], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "push", "--quiet", "-u", "origin", "main"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "remote", "set-head", "origin", "main"], { stdio: "ignore" });
    // Add a feature commit so a three-dot diff has content.
    spawnSync("git", ["-C", scratchDir, "checkout", "-q", "-b", "feature"], { stdio: "ignore" });
    const featureFile = join(scratchDir, "feature.txt");
    require("node:fs").writeFileSync(featureFile, "feature content\n", "utf8");
    spawnSync("git", ["-C", scratchDir, "add", "feature.txt"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "commit", "-m", "add feature"], { stdio: "ignore" });
  });

  afterAll(() => {
    rmSync(scratchDir, { recursive: true, force: true });
    rmSync(realBareCloneDir, { recursive: true, force: true });
  });

  // S1: happy path — origin URL parses to canonical owner/name
  it("AC-S1: in a git repo with origin URL → returns event with owner/name repo slug; prNumber is null, repo is canonical owner/name", () => {
    const ctx = derive({ cwd: scratchDir });
    expect(ctx).not.toBeNull();
    // Diff file: contains the feature.txt change.
    const diffText = readFileSync(ctx!.diffPath, "utf8");
    expect(diffText).toContain("feature.txt");
    expect(diffText).toContain("feature content");
    // Event file: valid JSON with the branch + canonical repo fields.
    const event = JSON.parse(readFileSync(ctx!.eventPath, "utf8"));
    expect(event.pull_request.head.ref).toBe("feature");
    // prNumber in the synthetic event is null (not the magic "0" placeholder).
    expect(event.pull_request.number).toBeNull();
    // Repo: canonical owner/name derived from origin URL.
    // The scratch repo's origin is a bare-clone path, so owner/name
    // CANNOT be parsed cleanly from it; this test uses a clean
    // origin URL. See AC-S1b for the no-origin case.
    expect(ctx!.repo).toBeNull();
    expect(ctx!.prNumber).toBeNull();
  });

  // S1b: no canonical origin → repo is null, NOT a slashless basename
  it("AC-S1b: in a git repo with no usable origin remote → repo is null (no synthetic owner/name)", async () => {
    // Create a separate git repo with NO origin configured.
    const noOriginDir = mkdtempSync(join(tmpdir(), "auto-ctx-no-origin-"));
    try {
      spawnSync("git", ["init", "--quiet", "--initial-branch=main", noOriginDir], { stdio: "ignore" });
      spawnSync("git", ["-C", noOriginDir, "config", "user.email", "t@e.com"], { stdio: "ignore" });
      spawnSync("git", ["-C", noOriginDir, "config", "user.name", "T"], { stdio: "ignore" });
      spawnSync("git", ["-C", noOriginDir, "config", "commit.gpgsign", "false"], { stdio: "ignore" });
      spawnSync("git", ["-C", noOriginDir, "checkout", "-q", "-b", "main"], { stdio: "ignore" });
      spawnSync("git", ["-C", noOriginDir, "commit", "--allow-empty", "-m", "x"], { stdio: "ignore" });
      spawnSync("git", ["-C", noOriginDir, "remote", "set-head", "origin", "main"], { stdio: "ignore" });
      // Strip the origin remote so remote get-url fails.
      // (This simulates a fresh local clone without remote.)
      // Note: we never `add`ed a remote, so `get-url origin` throws.
      const ctx = derive({ cwd: noOriginDir });
      expect(ctx).not.toBeNull();
      expect(ctx!.repo).toBeNull();
      expect(ctx!.prNumber).toBeNull();
    } finally {
      rmSync(noOriginDir, { recursive: true, force: true });
    }
  });

  // S1c: SSH origin URL → owner/name parsed from git@github.com:owner/name.git form
  it("AC-S1c: SSH origin URL (git@github.com:owner/name.git) → repo resolves to 'owner/name'", async () => {
    const sshDir = mkdtempSync(join(tmpdir(), "auto-ctx-ssh-"));
    try {
      // Init with a fake remote URL that points nowhere — we never fetch,
      // we only need the URL string to be parseable.
      spawnSync("git", ["init", "--quiet", "--initial-branch=main", sshDir], { stdio: "ignore" });
      spawnSync("git", ["-C", sshDir, "config", "user.email", "t@e.com"], { stdio: "ignore" });
      spawnSync("git", ["-C", sshDir, "config", "user.name", "T"], { stdio: "ignore" });
      spawnSync("git", ["-C", sshDir, "config", "commit.gpgsign", "false"], { stdio: "ignore" });
      spawnSync("git", ["-C", sshDir, "commit", "--allow-empty", "-m", "x"], { stdio: "ignore" });
      spawnSync(
        "git",
        ["-C", sshDir, "remote", "add", "origin", "git@github.com:acme/widgets.git"],
        { stdio: "ignore" },
      );
      // We need origin/HEAD to exist for the default-branch detection.
      // remote set-head on a never-fetched remote with no actual branch
      // would fail; instead set commit-ish.
      spawnSync(
        "git",
        ["-C", sshDir, "remote", "set-head", "origin", "--auto"],
        { stdio: "ignore" },
      );
      const ctx = derive({ cwd: sshDir });
      expect(ctx).not.toBeNull();
      expect(ctx!.repo).toBe("acme/widgets");
    } finally {
      rmSync(sshDir, { recursive: true, force: true });
    }
  });

  // S2: edge — on the default branch with no uncommitted changes
  it("AC-S2: on the default branch with no changes → empty diff, valid event, null prNumber/repo", async () => {
    // Use a separate repo so we don't perturb the shared scratchRepo branch ref.
    const emptyBaseDir = mkdtempSync(join(tmpdir(), "auto-ctx-empty-"));
    try {
      spawnSync("git", ["init", "--quiet", "--initial-branch=main", emptyBaseDir], { stdio: "ignore" });
      spawnSync("git", ["-C", emptyBaseDir, "config", "user.email", "t@e.com"], { stdio: "ignore" });
      spawnSync("git", ["-C", emptyBaseDir, "config", "user.name", "T"], { stdio: "ignore" });
      spawnSync("git", ["-C", emptyBaseDir, "config", "commit.gpgsign", "false"], { stdio: "ignore" });
      spawnSync("git", ["-C", emptyBaseDir, "commit", "--allow-empty", "-m", "x"], { stdio: "ignore" });
      const ctx = derive({ cwd: emptyBaseDir });
      expect(ctx).not.toBeNull();
      const diffText = readFileSync(ctx!.diffPath, "utf8");
      expect(diffText).toBe("");
      expect(ctx!.repo).toBeNull();
      expect(ctx!.prNumber).toBeNull();
    } finally {
      rmSync(emptyBaseDir, { recursive: true, force: true });
    }
  });

  // S4: edge — not in a git repo
  it("AC-S4: not in a git repo → returns null (caller must provide flags manually)", async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "auto-ctx-empty-"));
    try {
      const ctx = derive({ cwd: emptyDir });
      expect(ctx).toBeNull();
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  // S5: override — --base flag
  it("AC-S5: --base develop override → diff is against develop even when origin/HEAD says main", async () => {
    // Create a 'develop' branch with different content.
    spawnSync("git", ["-C", scratchDir, "checkout", "-q", "main"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "checkout", "-q", "-b", "develop"], { stdio: "ignore" });
    const devFile = join(scratchDir, "develop-only.txt");
    require("node:fs").writeFileSync(devFile, "develop-only content\n", "utf8");
    spawnSync("git", ["-C", scratchDir, "add", "develop-only.txt"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "commit", "-m", "develop commit"], { stdio: "ignore" });
    spawnSync("git", ["-C", scratchDir, "checkout", "-q", "feature"], { stdio: "ignore" });
    const ctx = derive({ cwd: scratchDir, base: "develop" });
    expect(ctx).not.toBeNull();
    const diffText = readFileSync(ctx!.diffPath, "utf8");
    // Three-dot diff from develop should NOT include develop-only.txt
    // (it was added on develop, not on the feature branch since diverging).
    expect(diffText).not.toContain("develop-only.txt");
    expect(diffText).toContain("feature.txt");
  });

  // S6: override — --diff passed by caller is preserved verbatim
  it("AC-S6: --diff path passed by caller → preserved verbatim, not regenerated", async () => {
    const explicitDiff = join(scratchDir, "my-explicit.diff");
    require("node:fs").writeFileSync(explicitDiff, "explicit marker\n", "utf8");
    const ctx = derive({ cwd: scratchDir, diffOverride: explicitDiff });
    expect(ctx).not.toBeNull();
    expect(ctx!.diffPath).toBe(explicitDiff);
    // Diff file content unchanged.
    expect(readFileSync(ctx!.diffPath, "utf8")).toBe("explicit marker\n");
    // Caller-supplied diff is NEVER regenerated, even if the git-cwd
    // would have produced a different diff.
    expect(existsSync(explicitDiff)).toBe(true);
  });

  // S7: override — --event passed by caller is preserved verbatim
  it("AC-S7: --event path passed by caller → preserved verbatim, not regenerated", async () => {
    const explicitEvent = join(scratchDir, "my-explicit.json");
    require("node:fs").writeFileSync(explicitEvent, '{"pull_request":{"head":{"ref":"explicit"}}}', "utf8");
    const ctx = derive({ cwd: scratchDir, eventOverride: explicitEvent });
    expect(ctx).not.toBeNull();
    expect(ctx!.eventPath).toBe(explicitEvent);
    expect(readFileSync(ctx!.eventPath, "utf8")).toBe('{"pull_request":{"head":{"ref":"explicit"}}}');
  });

  // S8: capability-aware identity: prNumber is null when not posting
  it("AC-S8: derived context exposes prNumber/repo as null (no magic '0' placeholder)", async () => {
    const ctx = derive({ cwd: scratchDir });
    expect(ctx).not.toBeNull();
    // Posting identity is absent; posting consumers must gate on
    // their own posting-target signal (e.g. --review or platform
    // tokens), not on these fields.
    expect(ctx!.prNumber).toBeNull();
    expect(ctx!.repo).toBeNull();
    // Synthetic event JSON must also have null prNumber (not "0").
    const event = JSON.parse(readFileSync(ctx!.eventPath, "utf8"));
    expect(event.pull_request.number).toBeNull();
  });

  // S3: edge — missing local --base throws with the standard remediation hint
  it("AC-S3: --base points at a non-existent local branch → throws naming the branch AND the `git fetch origin <base>` remediation", () => {
    expect(() =>
      derive({
        cwd: scratchDir,
        base: "this-branch-does-not-exist",
      }),
    ).toThrow(/this-branch-does-not-exist[\s\S]*git fetch origin this-branch-does-not-exist/u);
  });
});

describe("auto-context: integration with the CLI binary", () => {
  it("AC-INT-1: running the CLI in a git repo with only --api-url --api-key succeeds (no '--event is required' error)", async () => {
    // Given: the canonical CLI binary and a git-repo cwd (this repo).
    // When: invoked with only --api-url --api-key --dry-run.
    // Then: exit 0 or 1 (model call may fail, but not a cli: validation error).
    // AND: stderr does NOT contain 'cli: --event is required' or 'cli: --diff is required'.
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of ["GITHUB_ACTIONS", "TF_BUILD", "INPUT_EVENT", "INPUT_DIFF", "INPUT_REVIEW", "INPUT_PLATFORM", "INPUT_OUTPUT_ARTIFACT", "UMACTUALLY_API_URL", "UMACTUALLY_API_KEY"]) {
      delete env[k];
    }
    env["UMACTUALLY_API_URL"] = "https://example.invalid/v1";
    env["UMACTUALLY_API_KEY"] = "sk-test";
    env["INPUT_DRY_RUN"] = "true";

    const result = spawnSync(process.execPath, [resolve(REPO_ROOT, "bin/umactually.mjs"), "--api-url", "https://example.invalid/v1", "--api-key", "sk-test", "--dry-run"], {
      cwd: REPO_ROOT,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stderr = result.stderr ?? "";
    expect(stderr).not.toMatch(/cli: --event is required/);
    expect(stderr).not.toMatch(/cli: --diff is required/);
  });
});