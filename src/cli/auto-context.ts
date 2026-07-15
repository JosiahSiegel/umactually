/**
 * Auto-derive CLI platform context from a local git repository.
 *
 * SCOPE: this module owns ONLY git-cwd derivation. It does NOT
 *   - Synthesize event JSON (lives at the call site, structured to avoid
 *     cross-platform shape coupling — see plan D4).
 *   - Synthesize fake posting identity (`prNumber="0"` was architectural rot
 *     leaking local-smoke-test semantics into the posting path).
 *   - Speculate on remote URL review modes (deferred — see plan D5).
 *
 * BEHAVIOR:
 *   - If cwd is not inside a git working tree, returns `null` (caller
 *     surfaces a "not in a git repo, pass --diff and --event manually"
 *     guidance).
 *   - Otherwise: derive (a) a diff path via `git diff <base>...HEAD`,
 *     (b) the synthetic event JSON metadata (branch + base — all
 *     posting-identity fields are written as `null`), and
 *     (c) the canonical owner/name from `git remote get-url origin`
 *     (or `null` when no canonical owner/name is parseable — caller
 *     must supply `--repo` explicitly if posting is requested).
 *   - Caller-supplied `diffOverride` / `eventOverride` skip generation
 *     for those fields; other fields are still derived.
 *
 * CALLER RESPONSIBILITY: callers MUST resolve the base branch BEFORE
 * invoking this function. Default-branch detection lives at the call
 * site (src/cli.ts step 5 per plan D5) so the same resolveContext layer
 * can serve future URL-mode inputs that don't have a cwd concept.
 *
 * SECURITY: `child_process.execFileSync` is used with argv as an array
 * (NOT shell), so user-supplied `base` cannot escape into a shell command.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Fields the caller may override; null/undefined = "auto-derive it". */
export type AutoContextOverrides = {
  readonly eventOverride?: string | null;
  readonly diffOverride?: string | null;
};

/** Inputs required to derive. */
export type DeriveInput = {
  readonly cwd: string;
  readonly base: string;
} & AutoContextOverrides;

/**
 * Resolved context that satisfies the CLI's required-flag validation.
 * `repo` and `prNumber` may be `null` — they identify a posting target and
 * posting is opt-in. The derived object never carries fake identifiers.
 */
export type AutoContext = {
  readonly eventPath: string;
  readonly diffPath: string;
  readonly repo: string | null;
  readonly prNumber: string | null;
};

/**
 * Run `git <args>` in `cwd` and return trimmed stdout. Throws with the
 * failing argv + stderr so the operator gets a clear root cause.
 */
function gitOrThrow(cwd: string, args: readonly string[]): string {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return String(out).trim();
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr ?? "")
        : "";
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd}: ${stderr.trim() || (error as Error).message}`,
    );
  }
}

/**
 * Parse `owner/name` out of a git remote URL. Supports SSH
 * (`git@github.com:owner/name.git`) and HTTPS
 * (`https://github.com/owner/name.git`) forms. Returns `null` when no
 * canonical owner/name is parseable — callers MUST NOT fall back to a
 * slashless dirname because that leaks the local-tempdir basename as
 * a fake identity.
 */
function parseRemoteSlug(remoteUrl: string): string | null {
  // SSH: [user@]host:owner/name[.git]
  const ssh = /^[\w.-]+@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/u.exec(remoteUrl);
  if (ssh !== null) {
    return `${ssh[1]}/${ssh[2]}`;
  }
  // HTTPS: https://host/owner/name[.git]
  const https = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/u.exec(remoteUrl);
  if (https !== null) {
    return `${https[1]}/${https[2]}`;
  }
  return null;
}

/**
 * Write the synthetic GitHub-shaped event JSON metadata to a sibling of
 * the diff path. Identity fields are `null` — they identify a posting
 * target; the synthetic event JSON deliberately does NOT carry fake
 * posting identity. The downstream consumer (`src/cli/run.ts` per Task 8)
 * is responsible for accepting `null` posting identity in non-posting mode.
 */
function writeSyntheticEventJson(
  filePath: string,
  args: { readonly branch: string; readonly base: string; readonly repo: string | null },
): string {
  const event = {
    pull_request: {
      number: null,
      head: { ref: args.branch, sha: null },
      base: { ref: args.base, sha: null },
    },
    repository: {
      full_name: args.repo,
      name: args.repo === null ? null : args.repo.split("/")[1] ?? null,
      owner: { login: args.repo === null ? null : args.repo.split("/")[0] ?? null },
    },
    action: "synthetic",
    sender: { login: "local-smoke-test" },
  };
  writeFileSync(filePath, `${JSON.stringify(event, null, 2)}\n`, "utf8");
  return filePath;
}

/**
 * Returns the directory used for auto-derived temp files (diff + event).
 * Lives under `cwd/.umactually-auto-ctx/` so cleanup is a single
 * recursive remove. The directory is created lazily on first write.
 */
function tempDirPath(cwd: string): string {
  return join(cwd, ".umactually-auto-ctx");
}

/** True when the named local branch ref resolves. */
function localBranchExists(cwd: string, branch: string): boolean {
  try {
    gitOrThrow(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Top-level entry point. See module docstring for the full contract.
 *
 * Returns null when:
 *   - cwd is not inside a git working tree.
 *
 * Throws when:
 *   - the resolved `base` branch does not exist locally — message includes
 *     `git fetch origin <base>` remediation (per plan D5).
 *   - any git command fails for an unrelated reason (e.g. corrupt repo).
 *
 * `base` parameter is OPTIONAL — when empty/null, this module falls back
 * to default-branch detection via `git symbolic-ref refs/remotes/origin/HEAD`
 * and a `main`/`master` fallback. Callers that already resolve the base
 * (e.g. src/cli.ts after parsing `--base`) can pass the explicit value
 * to skip the probe.
 */
export function deriveContextFromGit(input: DeriveInput): AutoContext | null {
  const { cwd, eventOverride, diffOverride } = input;
  const requestedBase = input.base;

  // 1. confirm we're inside a git working tree.
  try {
    gitOrThrow(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return null;
  }

  // 2. resolve the base branch. Caller-supplied value wins; otherwise
  // probe origin/HEAD and finally fall back to main/master. If nothing
  // resolves, throw a guidance-rich error.
  let base: string;
  if (typeof requestedBase === "string" && requestedBase.length > 0) {
    base = requestedBase;
  } else {
    const detected = resolveDefaultBranch(cwd);
    if (detected === null) {
      throw new Error(
        `unable to detect default branch in ${cwd}: origin/HEAD is not set and neither 'main' nor 'master' exists locally. Pass --base <branch> explicitly or fetch the default branch.`,
      );
    }
    base = detected;
  }

  if (!localBranchExists(cwd, base)) {
    throw new Error(
      `base branch '${base}' not found locally in ${cwd}. Run 'git fetch origin ${base}' or pass --base <existing-branch>.`,
    );
  }

  // 3. determine current branch (for the synthetic event JSON metadata).
  let currentBranch = "HEAD";
  try {
    currentBranch = gitOrThrow(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  } catch {
    // Detached HEAD — leave as "HEAD" in the event JSON.
  }

  // 4. resolve the repository slug from `origin`. Returns null when
  // unparseable. Caller MAY supply `--repo` if posting is requested.
  let repo: string | null = null;
  try {
    const remoteUrl = gitOrThrow(cwd, ["remote", "get-url", "origin"]);
    repo = parseRemoteSlug(remoteUrl);
  } catch {
    // No origin remote or other failure; repo stays null.
  }

  // 5. resolve paths: caller overrides win; otherwise generate under
  // cwd/.umactually-auto-ctx/ which Task 9 cleans up.
  const tempDir = tempDirPath(cwd);
  const diffPath =
    diffOverride !== undefined && diffOverride !== null
      ? diffOverride
      : join(tempDir, "diff.patch");
  const eventPath =
    eventOverride !== undefined && eventOverride !== null
      ? eventOverride
      : join(tempDir, "event.json");

  // 6. write the generated files (only if not overridden). Do NOT throw
  // if the diff is empty — that's fine for smoke tests on the default branch.
  if (diffOverride === undefined || diffOverride === null) {
    const diffOutput = gitOrThrow(cwd, ["diff", `${base}...HEAD`]);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(diffPath, diffOutput, "utf8");
  }
  if (eventOverride === undefined || eventOverride === null) {
    mkdirSync(tempDir, { recursive: true });
    writeSyntheticEventJson(eventPath, { branch: currentBranch, base, repo });
  }

  // 7. posting identity is null. The caller (src/cli.ts) gates posting
  // on `--review` (or the resolved dispatcher's posting token), NOT on
  // these fields.
  return { eventPath, diffPath, repo, prNumber: null };
}

/**
 * Default-branch detection helper. Returns null when origin/HEAD is not
 * configured and no fallback branch exists locally. Throws only on
 * unexpected git errors (corrupt repo, exec failure, etc.).
 */
function resolveDefaultBranch(cwd: string): string | null {
  try {
    const ref = gitOrThrow(cwd, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "refs/remotes/origin/HEAD",
    ]);
    return ref.replace(/^origin\//u, "");
  } catch {
    // origin/HEAD not set; try common names.
    for (const candidate of ["main", "master"]) {
      if (localBranchExists(cwd, candidate)) {
        return candidate;
      }
    }
    return null;
  }
}