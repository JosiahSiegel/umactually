// SPDX-License-Identifier: MIT
// Post-release end-to-end test harness.
//
// What this script does (in order):
//   1. Auto-detect the current OS + arch and pick the right binary
//      archive from scripts/release-targets.json.
//   2. Resolve the tag to test against:
//        --tag <vX.Y.Z>  (explicit, used by the workflow)
//        latest stable release (when no tag is given)
//   3. Download the archive + checksums.txt from the immutable
//      `releases/download/<tag>/` URL.
//   4. Verify SHA-256 against checksums.txt.
//   5. Extract the archive to a temp directory.
//   6. Spawn the unified mock LLM server (handles both OpenAI and
//      Anthropic formats) on a random free port.
//   7. Run the extracted binary against the mock in BOTH provider
//      modes (--provider openai-compatible and --provider anthropic),
//      in standalone review mode (--diff + --repo + --pr-number).
//   8. Assert the resulting artifacts have inline comments with
//      non-empty bodies (i.e. the wire format survived end-to-end).
//   9. Print a final summary; exit 0 on success, 1 on any failure.
//
// Environment variables:
//   TAG              - explicit tag to test (default: auto-resolve latest)
//   REPO             - owner/name (default: from package.json repository)
//   PR_NUMBER        - PR number to use for --pr-number (default: 93)
//   MOCK_LLM_PORT    - port for the mock LLM (default: 0 = random)
//   ARTIFACT_DIR     - where to write review JSON + logs (default: ./artifacts/post-release-e2e)
//   SKIP_MOCK        - if "1", do not spawn the mock; assume one is
//                      already running and reachable at MOCK_LLM_PORT
//
// Process lifecycle: any early-exit `die()` call (e.g. checksum
// failure, extraction failure, missing fixture) MUST first SIGTERM
// any mock LLM we spawned, otherwise the port stays bound and the
// workflow's cleanup step times out. The `cleanup()` function is
// registered against `process.on('beforeExit')` and `process.on('exit')`
// and is the single source of truth for child-process teardown.
//
// Exit codes:
//   0  all checks passed
//   1  download / checksum / extraction / wire-format failure
//   2  mock server failed to start

import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import net from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const args = parseArgs(process.argv.slice(2));
const tag = args.tag ?? process.env.TAG ?? null;
const repo = args.repo ?? process.env.REPO ?? readRepoFromPackage();
const prNumber = args["pr-number"] ?? process.env.PR_NUMBER ?? "93";
const artifactDir = args["artifact-dir"] ?? process.env.ARTIFACT_DIR ?? join(REPO_ROOT, "artifacts", "post-release-e2e");
const skipMock = (args["skip-mock"] ?? process.env.SKIP_MOCK ?? "0") === "1";
// PR-time escape hatch: when --binary-path <path> is passed, skip
// the download/extract/checksum-verify steps and use the locally-
// built binary directly. The release workflow's post-release-e2e
// job uses the default (download from GitHub Releases) path; the
// PR-time e2e job uses --binary-path so the test runs without
// needing a published release artifact.
let binaryPathArg = args["binary-path"] ?? process.env.BINARY_PATH ?? null;

mkdirSync(artifactDir, { recursive: true });

// Single source of truth for child-process teardown. Registered
// against every exit path the Node process can take (normal
// completion, die(), uncaught exception, SIGINT). Idempotent: a
// second call after the proc has already exited is a no-op.
let mockProc = null;
let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (mockProc && !mockProc.killed && mockProc.exitCode === null) {
    try {
      mockProc.kill("SIGTERM");
    } catch {
      /* best-effort */
    }
  }
}
process.on("beforeExit", cleanup);
process.on("exit", cleanup);
// SIGINT/SIGTERM: best-effort terminate, then re-raise.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  });
}

log(`post-release e2e — repo=${repo} pr=${prNumber} tag=${tag ?? "(auto)"} artifact-dir=${artifactDir}`);

// Top-level entry point wrapped in an async IIFE so we can use
// `await` for the per-provider child_process.spawn (the v0.6.x
// Node-25.7.0-built SEA binary has a pipe-drain race under
// spawnSync: status=null even on a clean exit). Module top-level
// is already async-capable (ESM TLA), but wrapping in an IIFE
// keeps the function-level `await` usages and the synchronous
// control flow in `run-e2e.mjs` coherent.
async function main() {
let target = null;
let resolvedTag = null;
let binaryPath = binaryPathArg ? resolve(binaryPathArg) : null; // start from CLI/env override
if (binaryPathArg) {
  // PR-time path: the binary is already on disk, built by the
  // smoke-sea job. We still log the platform/arch for visibility
  // in the workflow log.
  if (!existsSync(binaryPathArg)) {
    die(1, `--binary-path ${binaryPathArg} does not exist`);
  }
  // Resolve to an absolute path: `spawn` (used in runProviderCheck
  // below) doesn't search the cwd for relative paths the way
  // `spawnSync` does. Without an absolute path, the spawn call
  // returns ENOENT.
  log(`using local binary: ${resolve(binaryPathArg)}`);
} else {
  const targets = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "release-targets.json"), "utf8"));
  target = pickTargetForCurrentPlatform(targets);
  if (!target) {
    die(1, `no release target for current platform (${process.platform}/${process.arch})`);
  }
  log(`picked target: ${target.id} (${target.archiveName}, member=${target.memberName})`);

  resolvedTag = tag ?? (await resolveLatestTag(repo));
  if (!resolvedTag) {
    die(1, `could not resolve latest tag for ${repo}`);
  }
  log(`resolved tag: ${resolvedTag}`);

  // Step 3-4: download + verify checksum
  const baseUrl = `https://github.com/${repo}/releases/download/${resolvedTag}`;
  const tmp = mkdtempSync(join(tmpdir(), "umactually-e2e-"));
  log(`workdir: ${tmp}`);

  const archivePath = join(tmp, target.archiveName);
  const checksumsPath = join(tmp, "checksums.txt");
  await downloadTo(`${baseUrl}/${target.archiveName}`, archivePath);
  await downloadTo(`${baseUrl}/checksums.txt`, checksumsPath);

  const expectedSha = pickChecksum(checksumsPath, target.archiveName);
  if (!expectedSha) {
    die(1, `no checksums.txt entry for ${target.archiveName}`);
  }
  const actualSha = sha256File(archivePath);
  if (actualSha !== expectedSha) {
    die(1, `SHA-256 mismatch for ${target.archiveName}: expected ${expectedSha} got ${actualSha}`);
  }
  log(`OK SHA-256(${expectedSha.slice(0, 12)}…) matches checksums.txt`);

  // Step 5: extract archive
  const extractDir = join(tmp, "extracted");
  mkdirSync(extractDir, { recursive: true });
  if (target.archiveType === "tar.gz") {
    const r = spawnSync("tar", ["-xzf", archivePath, "-C", extractDir], { stdio: "inherit" });
    if (r.status !== 0) die(1, `tar -xzf failed with status ${r.status}`);
  } else if (target.archiveType === "zip") {
    const r = spawnSync("unzip", ["-q", archivePath, "-d", extractDir], { stdio: "inherit" });
    if (r.status !== 0) die(1, `unzip failed with status ${r.status}`);
  } else {
    die(1, `unsupported archive type: ${target.archiveType}`);
  }
  binaryPath = join(extractDir, target.memberName);
  if (!existsSync(binaryPath)) {
    die(1, `extracted binary not found at ${binaryPath}`);
  }
  // Ensure executable on POSIX (the archive usually preserves perms; this
  // is a defensive chmod in case the umask stripped them).
  if (process.platform !== "win32") {
    spawnSync("chmod", ["+x", binaryPath]);
  }
  log(`extracted binary: ${binaryPath}`);
}

// Sanity: --version works. We capture the binary's stdout AND
// stderr to pipes. The binary's runVersion tier 0b is opt-in
// via the UMACTUALLY_VERSION_TO_STDERR env var, which we set
// here. This is the bypass for Windows + Git Bash + Node 25.6.0
// SEA where fd 1 is mapped to a CONOUT$ handle. With the env
// var set, the binary writes the version to stderr with an
// `umactually-version:` marker prefix. The harness extracts the
// version from stderr (preferred) or stdout (fallback).
// Without the env var, the contract is preserved (--version
// writes nothing to stderr).
let vStdout = "";
try {
  const v = await new Promise((resolve) => {
    const child = spawn(binaryPath, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, UMACTUALLY_VERSION_TO_STDERR: "1" },
    });
    const out = { status: null, signal: null, stdout: "", stderr: "" };
    child.stdout.on("data", (d) => { out.stdout += d.toString("utf8"); });
    child.stderr.on("data", (d) => { out.stderr += d.toString("utf8"); });
    child.on("error", (err) => { out.error = err; });
    child.on("close", (code, signal) => {
      out.status = code;
      out.signal = signal;
      resolve(out);
    });
  });
  if (v.error) {
    die(1, `binary --version spawn error: ${v.error.message}`);
  }
  if (v.status !== 0) {
    die(1, `binary --version failed: status=${v.status} stderr=${v.stderr.slice(0, 500)}`);
  }
  // Prefer stderr (the tier 0b bypass for Windows + CONOUT$);
  // fall back to stdout (the normal --version output). The
  // tier 0b marker is `umactually-version:\d+\.\d+\.\d+`. The
  // stdout fallback matches a leading semver.
  const versionRe = /umactually-version:(\d+\.\d+\.\d+[^\n]*)/u;
  const stderrVersionMatch = v.stderr.match(versionRe);
  if (stderrVersionMatch) {
    vStdout = stderrVersionMatch[1].trim();
  } else {
    const stdoutMatch = v.stdout.match(/^\d+\.\d+\.\d+[^\n]*/mu);
    vStdout = (stdoutMatch?.[0] ?? "").trim();
  }
  if (!vStdout) {
    die(
      1,
      `binary --version produced no version string. ` +
        `stdout=${JSON.stringify(v.stdout.slice(0, 200))} ` +
        `stderr=${JSON.stringify(v.stderr.slice(0, 200))}. ` +
        `The binary exited 0 but runVersion never produced a version. ` +
        `Likely main() did not fire — rebuild with the process.versions.sea ` +
        `short-circuit in isMainModule (src/cli.ts).`,
    );
  }
  log(`binary --version: ${vStdout}`);
} catch (e) {
  die(1, `binary --version harness error: ${e.message}`);
}

// Step 6: spawn the mock LLM (unless skipped).
let mockPort = Number(process.env.MOCK_LLM_PORT ?? 0);
if (skipMock) {
  if (!mockPort) die(2, `SKIP_MOCK=1 but MOCK_LLM_PORT not set`);
  log(`using existing mock LLM at port ${mockPort}`);
} else {
  const started = await startMockLlm(REPO_ROOT, process.env.MOCK_LABEL ?? "post-release-e2e");
  mockPort = started.port;
  mockProc = started.proc;
  log(`started mock LLM (pid=${mockProc.pid}) on http://127.0.0.1:${mockPort}`);
}

// Step 7: run umactually against the mock in BOTH provider modes.
// We use standalone review mode (no GitHub posting) — this catches
// wire-format regressions on every supported provider without needing
// a throwaway PR for each run.
const diffPath = join(REPO_ROOT, "test", "fixtures", "e2e-canary-diff.patch");
if (!existsSync(diffPath)) {
  die(1, `missing test fixture: ${diffPath}`);
}

const openaiResult = await runProviderCheck({
  binaryPath,
  provider: "openai-compatible",
  apiUrl: `http://127.0.0.1:${mockPort}/v1`,
  diffPath,
  repo,
  prNumber,
});
log(
  `openai-compatible: artifact=${openaiResult.artifactPath} comments=${openaiResult.commentCount} exit=${openaiResult.exitCode}`,
);

const anthropicResult = await runProviderCheck({
  binaryPath,
  provider: "anthropic",
  apiUrl: `http://127.0.0.1:${mockPort}`,
  diffPath,
  repo,
  prNumber,
});
log(
  `anthropic: artifact=${anthropicResult.artifactPath} comments=${anthropicResult.commentCount} exit=${anthropicResult.exitCode}`,
);

// Step 8: assertions.
let failures = [];
if (openaiResult.exitCode !== 0) failures.push(`openai-compatible exit=${openaiResult.exitCode}`);
if (anthropicResult.exitCode !== 0) failures.push(`anthropic exit=${anthropicResult.exitCode}`);
if (openaiResult.commentCount < 2) failures.push(`openai-compatible produced ${openaiResult.commentCount} comments (want >=2)`);
if (anthropicResult.commentCount < 2) failures.push(`anthropic produced ${anthropicResult.commentCount} comments (want >=2)`);

// Step 9: cleanup mock + summary.
if (mockProc && !mockProc.killed) {
  mockProc.kill("SIGTERM");
}
if (failures.length > 0) {
  log(`FAIL: ${failures.length} check(s) failed:`);
  for (const f of failures) log(`  - ${f}`);
  process.exit(1);
}
log("OK: all post-release e2e checks passed");
process.exit(0);
}

// Kick off the async IIFE. The IIFE runs the rest of the
// pipeline (manifest resolution, mock LLM spawn, per-provider
// child runs, assertions) and exits via process.exit() at the
// end. Errors thrown synchronously inside main() propagate to
// the catch block which logs + exits 1; errors in async paths
// (e.g. mock startup) are surfaced via die() at the source.
main().catch((err) => {
  console.error(`[e2e] FATAL: ${err?.stack ?? err?.message ?? err}`);
  process.exit(1);
});

// --- helpers ---

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "1";
      }
    }
  }
  return out;
}

function readRepoFromPackage() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  // pkg.repository.url is like "git+https://github.com/JosiahSiegel/umactually.git"
  const m = String(pkg.repository?.url ?? "").match(/github\.com[:/](.+?)(?:\.git)?$/);
  return m ? m[1] : null;
}

function pickTargetForCurrentPlatform(targets) {
  // Map Node's process.platform/arch to the manifest ids.
  const plat = process.platform;
  const arch = process.arch;
  // Windows runners are x64 even on arm64 hosts (CI runners); the
  // manifest distinguishes by id, so we look up by id directly.
  // For local developer machines we still get the right id because
  // process.platform/arch matches the build target.
  const candidates = targets.filter((t) => t.id.endsWith(`-${plat === "win32" ? "windows" : plat === "darwin" ? "darwin" : "linux"}-${arch}`));
  if (candidates.length > 0) return candidates[0];
  // Fall back: any target with matching OS regardless of arch (for
  // x64-on-arm64 emulation, etc.).
  const osName = plat === "win32" ? "windows" : plat === "darwin" ? "darwin" : "linux";
  const arch2 = arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : null;
  if (!arch2) return null;
  return targets.find((t) => t.id === `${osName}-${arch2}`) ?? null;
}

async function resolveLatestTag(repo) {
  const r = spawnSync("gh", ["api", `repos/${repo}/releases/latest`, "--jq", ".tag_name"], {
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN ?? "" },
  });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  // Fall back to the local git tag list when gh is unavailable.
  const r2 = spawnSync("git", ["-C", REPO_ROOT, "tag", "--sort=-v:refname"], { encoding: "utf8" });
  if (r2.status === 0) {
    const first = r2.stdout.split("\n").map((s) => s.trim()).filter((s) => /^v\d+\.\d+\.\d+$/.test(s))[0];
    if (first) return first;
  }
  return null;
}

async function downloadTo(url, dest) {
  const r = spawnSync("curl", ["-fsSL", "-o", dest, url], { stdio: "inherit" });
  if (r.status !== 0) die(1, `download failed: ${url} (curl exit ${r.status})`);
}

function pickChecksum(checksumsPath, archiveName) {
  const text = readFileSync(checksumsPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([0-9a-f]{64})\s+\*?(\S+)\s*$/);
    if (m && m[2] === archiveName) return m[1];
  }
  return null;
}

function sha256File(p) {
  const h = createHash("sha256");
  h.update(readFileSync(p));
  return h.digest("hex");
}

async function startMockLlm(repoRoot, label) {
  return await new Promise((resolve, reject) => {
    // Track every listener we register so we can detach them once
    // the promise settles. Without this, every successful start
    // leaks a `data`/`exit`/`error` listener onto the proc, which
    // pin the EventEmitter in memory until the proc itself GCs.
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      proc.stdout.removeAllListeners("data");
      proc.stderr.removeAllListeners("data");
      proc.removeAllListeners("error");
      proc.removeAllListeners("exit");
      fn(value);
    };
    const proc = spawn(
      process.execPath,
      [join(repoRoot, "test", "post-release", "mock-llm-server.mjs")],
      {
        env: { ...process.env, MOCK_LABEL: label },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let out = "";
    proc.stdout.on("data", (chunk) => {
      if (settled) return;
      out += chunk.toString("utf8");
      const port = parseInt(out.trim().split("\n")[0], 10);
      if (!Number.isNaN(port) && port > 0) {
        // Wait for the health endpoint to be ready before resolving,
        // so the test never races the bind.
        waitForHealth(port)
          .then(() => settle(resolve, { port, proc }))
          .catch((err) => settle(reject, err));
      }
    });
    proc.stderr.on("data", (chunk) => process.stderr.write(`[mock] ${chunk}`));
    proc.on("error", (err) => settle(reject, err));
    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        settle(reject, new Error(`mock LLM exited with code ${code} before becoming ready`));
      }
    });
    // Startup deadline. Cleared on success so Node's timer table
    // doesn't keep a 5s timer alive after a fast happy-path start.
    const startupTimer = setTimeout(
      () => settle(reject, new Error("mock LLM did not start within 5s")),
      5000,
    );
  });
}

async function waitForHealth(port, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    const ok = await new Promise((res) => {
      const req = httpGet(`http://127.0.0.1:${port}/health`, (status) => {
        res(status === 200);
      });
      req.on("error", () => res(false));
      req.setTimeout(500, () => {
        req.destroy();
        res(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`mock LLM did not respond to /health after ${attempts} attempts`);
}

function httpGet(url, onStatus) {
  // Minimal HTTP/1.0 GET using only node:net. No need for a full client
  // here — we only care about the status line.
  const u = new URL(url);
  const socket = net.createConnection({ host: u.hostname, port: u.port });
  let buf = "";
  let resolved = false;
  socket.on("connect", () => {
    socket.write(`GET ${u.pathname} HTTP/1.0\r\nHost: ${u.host}\r\nConnection: close\r\n\r\n`);
  });
  socket.on("data", (d) => {
    buf += d.toString("utf8");
    if (resolved) return;
    const m = buf.match(/^HTTP\/1\.[01] (\d+)/);
    if (m) {
      resolved = true;
      onStatus(Number(m[1]));
    }
  });
  socket.on("error", () => {
    if (!resolved) {
      resolved = true;
      onStatus(0);
    }
  });
  socket.on("close", () => {
    if (!resolved) {
      resolved = true;
      onStatus(0);
    }
  });
  return socket;
}

async function runProviderCheck({ binaryPath, provider, apiUrl, diffPath, repo, prNumber }) {
  // The standalone-review mode writes its artifact to a fixed
  // cwd-relative path (`./umactually-review.json`). We can't override
  // it from the CLI in standalone mode, so we run each provider
  // check in its own scratch directory and copy the resulting file
  // into the shared artifact dir under a provider-specific name.
  //
  // IMPORTANT: GitHub Actions runners set `GITHUB_ACTIONS=true`
  // automatically, which makes the binary take its LIVE-orchestrator
  // path (writes `artifacts/manual/s1-github-self-review.md`,
  // requires a real --event, and exits 1 when the post-validator
  // finds the artifact flagged parseFailed=true because we never
  // hit a real GitHub API). For the e2e we want the standalone
  // path, so we explicitly override GITHUB_ACTIONS=false. The same
  // applies to TF_BUILD (Azure Pipelines).
  const providerCwd = mkdtempSync(join(tmpdir(), "umactually-e2e-"));
  const cwdArtifact = join(providerCwd, "umactually-review.json");
  const finalArtifact = join(artifactDir, `${provider}.review.json`);
  const args = [
    "review",
    "--provider", provider,
    "--api-url", apiUrl,
    "--api-key", "test-key",
    // Seed an explicit opaque model so the new contract-based
    // discovery does not trigger a `GET /v1/models` call that the
    // HTTP fixture does not serve. Same rationale as the
    // GitHub live-contract fixture (see 9d939bc): post-Plan §10
    // removed the literal `"auto"` fallback, so an omitted model
    // would route to provider discovery and exit 1 before
    // inference, producing zero comments. The opaque id is the
    // same synthetic value used by the GitHub live fixture.
    "--model", "review-model-test",
    "--diff", diffPath,
    "--repo", repo,
    "--pr-number", prNumber,
    "--no-detect-leaks",
  ];
  log(`running: ${binaryPath} ${args.join(" ")}`);
  // Use event-based spawn instead of spawnSync because the
  // Node 25.7.0-built SEA binary has a pipe-drain race when the
  // parent's stdio is fully piped AND the parent waits
  // synchronously via spawnSync: process.stdout.write from the
  // child doesn't reach the parent pipe before the parent's
  // spawnSync call resolves, leaving the child in a weird
  // "still running" state and the parent with status=null. The
  // v0.6.0+ --version path uses writeFileSync(process.stdout.fd,
  // ...) to bypass this race; the review subcommand's stdout
  // writes go through process.stdout.write and are subject to
  // the race. spawn() with event-based I/O drains the pipes
  // naturally and avoids the issue. See the post-release-e2e
  // run history for context (v0.6.0 published Linux binary
  // passes; locally-built Node 25.7.0 binary fails via
  // spawnSync, passes via spawn).
  // Capture stdout/stderr to FILES (not pipes) for the same
  // CONOUT$ reason as the --version check above. The review
  // subcommand's stdout (brand-prefixed summary) and stderr
  // (warnings) both go through Node's stream layer; on Windows
  // + Git Bash the stream's underlying fd is a CONOUT$ handle,
  // so pipe-based capture loses everything. File fds work
  // because the kernel's write(2) syscall to a regular file is
  // reliable regardless of what fd 0/1/2 happen to be mapped
  // to. The cwd-relative artifact file (./umactually-review.json)
  // is written via fs.writeFile, which goes to a real file
  // and is unaffected by this issue.
  const reviewStdoutFile = join(providerCwd, "review-stdout.log");
  const reviewStderrFile = join(providerCwd, "review-stderr.log");
  const reviewStdoutFd = openSync(reviewStdoutFile, "w");
  const reviewStderrFd = openSync(reviewStderrFile, "w");
  let r;
  try {
    r = await new Promise((resolve) => {
      const child = spawn(binaryPath, args, {
        stdio: ["ignore", reviewStdoutFd, reviewStderrFd],
        cwd: providerCwd,
        env: {
          ...process.env,
          GITHUB_ACTIONS: "false",
          TF_BUILD: "",
        },
      });
      const out = { status: null, signal: null };
      child.on("error", (err) => {
        out.status = -1;
        try { writeFileSync(reviewStderrFile, `[harness] spawn error: ${err.message}\n`); } catch {}
        resolve(out);
      });
      child.on("exit", (code, signal) => {
        out.status = code;
        out.signal = signal;
        resolve(out);
      });
    });
  } finally {
    closeSync(reviewStdoutFd);
    closeSync(reviewStderrFd);
  }
  let commentCount = 0;
  let reviewSummary = "";
  if (existsSync(cwdArtifact)) {
    try {
      const j = JSON.parse(readFileSync(cwdArtifact, "utf8"));
      commentCount = (j.review?.comments ?? []).length;
      reviewSummary = String(j.review?.summary ?? "").slice(0, 100);
      // Persist into the shared artifact dir for the workflow to
      // upload as a build artifact for debugging.
      writeFileSync(finalArtifact, readFileSync(cwdArtifact));
    } catch (e) {
      log(`WARN: failed to parse ${cwdArtifact}: ${e.message}`);
    }
  } else {
    log(`WARN: artifact not written at ${cwdArtifact}`);
    const reviewStderrContents = existsSync(reviewStderrFile) ? readFileSync(reviewStderrFile, "utf8") : "";
    if (reviewStderrContents) log(`WARN: stderr was: ${reviewStderrContents.slice(0, 500)}`);
    if (r.signal) log(`WARN: killed by signal: ${r.signal}`);
  }
  return {
    artifactPath: finalArtifact,
    commentCount,
    exitCode: r.status,
    stderr: existsSync(reviewStderrFile) ? readFileSync(reviewStderrFile, "utf8") : "",
    summary: reviewSummary,
  };
}

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

function die(code, msg) {
  console.error(`[e2e] FATAL: ${msg}`);
  process.exit(code);
}
