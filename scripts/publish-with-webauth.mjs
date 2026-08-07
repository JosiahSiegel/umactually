#!/usr/bin/env node
// Polls the npm WebAuth doneUrl until the user completes 2FA in their browser,
// then runs `npm publish --no-provenance --ignore-scripts --otp=<code>` once a
// non-empty OTP is returned.
//
// Usage: node scripts/publish-with-webauth.mjs [--timeout=120]
//
// Exits 0 on successful publish; non-zero otherwise.

import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import { invokedDirectly, parseArgs } from "./lib/cli-shared.mjs";

const REPO_ROOT = process.cwd();

function parseTimeoutSec(argv) {
  const { timeout } = parseArgs(argv);
  if (timeout === undefined) return 180;
  const parsed = Number.parseInt(timeout, 10);
  // Original behavior: a non-numeric timeout (or unparseable integer)
  // falls back to the 180s default rather than throwing — preserve.
  return Number.isFinite(parsed) ? parsed : 180;
}

export function startPublish() {
  // We expect this to fail with EOTP and emit authUrl/doneUrl. Capture both
  // stdout and stderr; maxBuffer is bumped to 64 MiB so a package whose npm
  // notice / audit stream exceeds the 1 MiB default does not throw a
  // synchronous RangeError before we ever see the JSON.
  const result = spawnSync(
    "npm",
    ["publish", "--no-provenance", "--ignore-scripts", "--json"],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const out = (result.stdout ?? "") + (result.stderr ?? "");
  // Locate the LAST top-level JSON object in the output. npm emits both
  // `npm error code EOTP` text AND one or more JSON objects (one per npm
  // notice line) in the same stream; the EOTP error object is the final
  // one. We hand off to JSON.parse directly for every candidate slice —
  // the platform parser handles escape sequences, nested wrappers, and
  // any other JSON-correctness concern so we don't need a hand-rolled
  // scanner.
  const parsed = findLastJsonObject(out);
  if (!parsed || parsed.error?.code !== "EOTP") {
    throw new Error(
      `npm publish did not emit an EOTP JSON block (last JSON object: ${JSON.stringify(parsed)}).\n--- output ---\n${out}`,
    );
  }
  const { authUrl, doneUrl } = parsed.error;
  if (!authUrl || !doneUrl) {
    throw new Error(`EOTP without authUrl/doneUrl: ${JSON.stringify(parsed)}`);
  }
  return { authUrl, doneUrl };
}

// Find the LAST top-level JSON object in `out` that JSON.parse accepts.
// Walks backward from the end of the string; for each `}` candidate,
// scans left with a depth counter to find the matching `{`, takes the
// slice, and asks JSON.parse. If the slice is not valid JSON (e.g. the
// `{` we picked is wrong because of earlier unmatched braces), move on
// to the next `{` to its left. Returns the first valid parse found
// scanning right-to-left, which is the LAST top-level JSON object in
// the output.
export function findLastJsonObject(out) {
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i] !== "}") continue;
    let depth = 1;
    let j = i - 1;
    for (; j >= 0; j -= 1) {
      const ch = out[j];
      if (ch === "}") depth += 1;
      else if (ch === "{") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue;
    try {
      return JSON.parse(out.slice(j, i + 1));
    } catch {
      // Not valid JSON — the matching `{` we picked is not the real one
      // for this `}`. The inner for-loop keeps scanning leftward.
    }
  }
  return null;
}

async function pollForOtp(doneUrl, timeoutSec) {
  // Poll the doneUrl via GET. Per npm WebAuth flow:
  //   - Body is `""` (empty string) until the user completes 2FA.
  //   - After completion, the body is `{"token":"<16-digit-otp>"}` — this
  //     is the registry session token that `npm publish --otp=<token>`
  //     consumes (npm calls it an "OTP" in the error message but the value
  //     IS the session token, not a TOTP code).
  //   - The authId is one-shot: once consumed (either by a successful
  //     poll or by the registry recording it as used), subsequent polls
  //     return HTTP 404 with body `{"message":"not found"}`. Treat both
  //     `""` and `{"message":"not found"}` as "still pending / stale".
  //   - If the user clicks "Don't challenge requests from this IP for
  //     N minutes" on the browser page instead of completing WebAuth,
  //     the registry marks the IP as trusted and the polling can stall —
  //     in that case the user should re-run `npm publish` directly,
  //     which will succeed without OTP because the registry accepts the
  //     trust window.
  const deadline = Date.now() + timeoutSec * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    let body = "";
    try {
      const res = await fetch(doneUrl, { method: "GET" });
      body = await res.text();
    } catch (err) {
      process.stdout.write(`[poll ${attempt}] fetch error: ${err.message}\n`);
    }
    const trimmed = body.trim();
    if (trimmed && trimmed.length > 0 && trimmed !== '""') {
      // Try JSON parsing first — the success shape is `{"token":"<digits>"}`.
      try {
        const j = JSON.parse(trimmed);
        if (j && typeof j.token === "string" && /^\d{6,32}$/.test(j.token)) {
          return j.token;
        }
        if (j && typeof j.otp === "string" && /^\d{6,32}$/.test(j.otp)) {
          return j.otp;
        }
        // {"message":"not found"} means the authId was consumed/expired;
        // do NOT treat this as success.
        if (j && typeof j.message === "string") {
          process.stdout.write(`[poll ${attempt}] doneUrl: ${j.message}\n`);
        }
      } catch {
        // Not JSON — maybe the OTP came as a bare string. Strip optional quotes.
        const otp = trimmed.replace(/^"|"$/g, "").trim();
        if (/^\d{6,32}$/.test(otp)) {
          return otp;
        }
        process.stdout.write(`[poll ${attempt}] unexpected body: ${trimmed.slice(0, 80)}\n`);
      }
    }
    await sleep(3000);
  }
  throw new Error(
    `timed out after ${timeoutSec}s waiting for OTP at ${doneUrl}.\n` +
      `If you completed the browser flow and selected "Don't challenge requests from this IP for N minutes" instead of approving with a security key,\n` +
      `the doneUrl may never return an OTP — the registry marks the IP as trusted and ` +
      `a fresh \`npm publish --no-provenance --ignore-scripts\` invocation from the same terminal will succeed without OTP.\n` +
      `If you completed WebAuth but no token arrived, check your browser for an "Approve" prompt and re-run this script with a fresh authId.`,
  );
}

function runPublishWithOtp(otp) {
  const result = spawnSync(
    "npm",
    ["publish", "--no-provenance", "--ignore-scripts", `--otp=${otp}`],
    { cwd: REPO_ROOT, encoding: "utf8", stdio: "inherit" },
  );
  return result.status ?? 1;
}

async function main() {
  const timeoutSec = parseTimeoutSec(process.argv.slice(2));
  process.stdout.write("Starting npm publish to capture WebAuth challenge...\n");
  const { authUrl, doneUrl } = startPublish();
  process.stdout.write(`\n=== ACTION REQUIRED ===\n`);
  process.stdout.write(`Open this URL in your browser to complete 2FA:\n  ${authUrl}\n`);
  process.stdout.write(`(Polling ${doneUrl} every 3s for up to ${timeoutSec}s)\n\n`);
  const otp = await pollForOtp(doneUrl, timeoutSec);
  process.stdout.write(`\nGot OTP (${otp.length} digits). Running publish with --otp=...\n\n`);
  const code = runPublishWithOtp(otp);
  process.exit(code);
}

// Gate the script entrypoint so importing the module from a test (or
// otherwise evaluating this file outside a direct invocation) does NOT
// trigger a real `npm publish` against the registry.
if (invokedDirectly(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  });
}
