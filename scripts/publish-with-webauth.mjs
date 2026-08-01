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

const REPO_ROOT = process.cwd();

function parseArgs() {
  const args = process.argv.slice(2);
  let timeoutSec = 180;
  for (const a of args) {
    const m = a.match(/^--timeout=(\d+)$/u);
    if (m) timeoutSec = Number.parseInt(m[1], 10);
  }
  return { timeoutSec };
}

function startPublish() {
  // We expect this to fail with EOTP and emit authUrl/doneUrl.
  // Capture both stdout and stderr.
  const result = spawnSync(
    "npm",
    ["publish", "--no-provenance", "--ignore-scripts", "--json"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const out = (result.stdout ?? "") + (result.stderr ?? "");
  if (!out.includes('"error":')) {
    throw new Error(`npm publish did not emit an "error" JSON block.\n--- output ---\n${out}`);
  }
  // Find the top-level JSON object that wraps an EOTP error block. npm
  // emits both `npm error code EOTP` text AND a JSON object in the same
  // output. The text contains a substring like `{ "error": { ... } }`
  // (sometimes nested inside a wrapper like `{ "type": "error", ... }`).
  //
  // Brute-force every `{` candidate: from each `{`, walk forward with a
  // depth counter to find the matching `}`, JSON.parse the slice, and
  // accept the first one whose `error.code === "EOTP"`. This tolerates
  // any wrapper shape (no / wrapper, single wrapper, double-nested) and
  // is robust against earlier text that happens to contain `"error":`
  // (e.g. a deprecation notice) — those slices will JSON-parse to objects
  // without an `error.code` field and we just skip them.
  const parsed = findEotpErrorObject(out);
  if (!parsed) {
    throw new Error(`npm publish did not emit an EOTP JSON block.\n--- output ---\n${out}`);
  }
  const { authUrl, doneUrl } = parsed.error;
  if (!authUrl || !doneUrl) {
    throw new Error(`EOTP without authUrl/doneUrl: ${JSON.stringify(parsed)}`);
  }
  return { authUrl, doneUrl };
}

// Brute-force scan every `{` candidate, find the matching `}` via a depth
// counter, JSON.parse the slice, and return the first parse that yields
// an `error.code === "EOTP"` object. Returns `null` if no candidate matches.
function findEotpErrorObject(out) {
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] !== "{") continue;
    let depth = 1;
    let j = i + 1;
    let inString = false;
    let escape = false;
    for (; j < out.length; j += 1) {
      const ch = out[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue;
    try {
      const obj = JSON.parse(out.slice(i, j + 1));
      if (obj?.error?.code === "EOTP") return obj;
    } catch {
      // Not valid JSON — likely truncated by an earlier nested mismatch;
      // try the next `{` candidate.
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
  const { timeoutSec } = parseArgs();
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

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
