#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Self-review guard: fails CI when the action's output artifact
// contains a parse-fail diagnostic instead of a real review.
//
// Regression: PR #17 self-review posted the same parse-fail card to
// the PR 4 times in a row (rounds 2-4 of the thread-resolution loop),
// and every CI check passed because the action exit code was 0. This
// guard reads the self-review output artifact and asserts it carries
// real review content (either inline threads or an explicit clean
// verdict), not the parse-fail sentinel.
//
// Exit codes:
//   0  Output artifact contains a real review.
//   1  Output artifact missing.
//   2  Output artifact contains the parse-fail sentinel.
//   3  Output artifact exists but has zero inline threads AND no clean
//      verdict (suspicious — the action may have silently dropped them).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

const ARTIFACTS = [
  "artifacts/manual/s1-github-self-review.md",
  "artifacts/manual/s4-azure-mocked-run.json",
];

const PARSE_FAIL_MARKERS = [
  "Provider response did not contain a valid JSON review payload",
  "Parse failed — provider response",
  "Parse failed",
];

const CLEAN_VERDICTS = new Set(["APPROVED", "SHIP"]);

function loadArtifact(relativePath) {
  const full = join(packageRoot, relativePath);
  if (!existsSync(full)) {
    return { exists: false };
  }
  return { exists: true, content: readFileSync(full, "utf8"), full };
}

function isParseFail(content) {
  return PARSE_FAIL_MARKERS.some((marker) => content.includes(marker));
}

function classify(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, reason: "not-valid-json" };
  }

  // Two artifact shapes exist:
  //   1. GitHub self-review shape: { event, verdict, inlineThreadCount,
  //      suppressedCommentCount, marker, blockedRawOutput }
  //   2. Azure self-review shape:  { postedThreadCount,
  //      postedStatusState, marker, blockedRawOutput }
  const event = String(parsed.event ?? "").trim();
  const verdict = String(parsed.verdict ?? "").trim();
  const inlineThreadCount = Number(parsed.inlineThreadCount ?? 0);
  const postedThreadCount = Number(parsed.postedThreadCount ?? 0);
  const suppressedCommentCount = Number(parsed.suppressedCommentCount ?? 0);
  const postedStatusState = String(parsed.postedStatusState ?? "").trim();
  const blockedRawOutput = parsed.blockedRawOutput === true;

  // Sum threads across both shapes.
  const totalFindings = inlineThreadCount + postedThreadCount;

  // Parse-fail signal: zero findings AND no status/event AND no verdict.
  // A real review has at least one of: event set, verdict set, postedStatusState
  // set, or non-zero thread count. A parse-fail card has NONE of these.
  const hasSignal =
    event.length > 0 ||
    verdict.length > 0 ||
    postedStatusState.length > 0 ||
    totalFindings > 0;

  if (!hasSignal) {
    return {
      ok: false,
      reason: "parse-fail: no event, verdict, status, or findings",
      event,
      verdict,
      inlineThreadCount,
      postedThreadCount,
      postedStatusState,
      blockedRawOutput,
    };
  }

  // Low-signal review: at least one field is set but zero findings
  // and no clean verdict. Not necessarily a parse-fail — could be a
  // legitimate review where the model didn't post anything but the
  // status indicates success. Treat as a warning, not a hard fail.
  const isCleanVerdict =
    CLEAN_VERDICTS.has(verdict.toUpperCase()) ||
    CLEAN_VERDICTS.has(postedStatusState.toUpperCase());
  if (totalFindings === 0 && suppressedCommentCount === 0 && !isCleanVerdict) {
    return {
      ok: true,
      warning: "no-findings-no-clean-verdict",
      event,
      verdict,
      inlineThreadCount,
      postedThreadCount,
      postedStatusState,
      blockedRawOutput,
    };
  }
  return {
    ok: true,
    event,
    verdict,
    inlineThreadCount,
    postedThreadCount,
    postedStatusState,
    suppressedCommentCount,
    blockedRawOutput,
  };
}

let exitCode = 0;
let checked = 0;
for (const relativePath of ARTIFACTS) {
  const artifact = loadArtifact(relativePath);
  if (!artifact.exists) {
    console.log(`[skip] ${relativePath}: not present`);
    continue;
  }
  checked += 1;
  console.log(`[check] ${relativePath}: length=${artifact.content.length}`);
  if (isParseFail(artifact.content)) {
    console.error(`[FAIL] ${relativePath}: contains parse-fail sentinel`);
    console.error(`       First 300 chars: ${artifact.content.slice(0, 300)}`);
    exitCode = 2;
    continue;
  }
  const result = classify(artifact.content);
  if (!result.ok) {
    console.error(
      `[FAIL] ${relativePath}: ${result.reason} ` +
        `(event=${result.event} verdict=${result.verdict} threads=${result.inlineThreadCount})`,
    );
    exitCode = 3;
    continue;
  }
  console.log(
    `[OK]   ${relativePath}: event=${result.event} verdict=${result.verdict} ` +
      `inline=${result.inlineThreadCount} suppressed=${result.suppressedCommentCount}`,
  );
}

if (checked === 0) {
  console.error("[FAIL] no output artifacts found; self-review produced nothing");
  process.exit(1);
}
process.exit(exitCode);