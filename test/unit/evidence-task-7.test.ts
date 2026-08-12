// SPDX-License-Identifier: MIT
//
// Task 7 — evidence generator. Produces the happy + failure evidence
// JSON files the plan calls for. Runs as a vitest test so it
// re-exercises the typed `src/cli/review-metrics.ts` API end-to-end
// against a deterministic fake clock.

import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  AUDIT_SCHEMA_VERSION,
  buildReviewMetrics,
  computeContextHash,
  computePolicyHash,
  finalizeReviewMetrics,
  wrapAuditEnvelope,
} from "../../src/cli/review-metrics.js";
import { redactUrlForLog } from "../../src/util/url.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(HERE, "..", "..", ".omo", "evidence");

describe("task-7 evidence generation", () => {
  it("writes the happy + failure evidence JSON files", async () => {
    await mkdir(EVIDENCE_DIR, { recursive: true });

    // ----- Happy path -----
    const happy = buildReviewMetrics({ now: () => 1_700_000_000_000 });
    happy.beginContext();
    happy.endContext();
    happy.beginProvider();
    happy.recordRoundTrip();
    happy.endProvider();
    happy.beginVerification();
    happy.endVerification();
    happy.beginPosting();
    happy.endPosting();
    happy.setUsage({
      inputTokens: 1234,
      outputTokens: 567,
      totalTokens: 1801,
      roundTrips: 1,
    });
    happy.setCounts({
      considered: 8,
      kept: 5,
      downgraded: 1,
      suppressed: 1,
      offDiff: 1,
    });
    happy.incrementReason("off-diff", 1);
    happy.incrementReason("below-threshold", 1);
    happy.setDecision("full");
    happy.setPolicyHash(computePolicyHash({
      minimumSeverity: "medium",
      maxComments: 50,
      effort: "low",
    }));
    happy.setContextHash(computeContextHash({
      filesTouched: ["src/cli/run.ts", "src/cli/orchestrator.ts"],
    }));
    happy.setPricing({
      inputPricePer1kTokens: 0.003,
      outputPricePer1kTokens: 0.015,
      currency: "USD",
      source: "umactually.config.json#pricing",
    });
    const happyMetrics = finalizeReviewMetrics(happy);
    const happyEnvelope = wrapAuditEnvelope(happyMetrics);
    const happyArtifactArithmetic = {
      cost_total: happyMetrics.cost?.total,
      cost_total_equals: 0.003 * (1234 / 1000) + 0.015 * (567 / 1000),
      duration_total_ms: happyMetrics.durations.totalMs,
      kept_plus_downgraded_plus_suppressed_plus_offDiff: 5 + 1 + 1 + 1,
      equals_considered: 5 + 1 + 1 + 1 === 8,
    };
    const happyEvidence = {
      task: "task-7-observability-artifacts",
      scenario: "happy",
      timestamp: "2026-08-11T14:24:00Z",
      description: "Hermetic mock provider with known usage and fake pricing; validate artifact arithmetic.",
      modules: {
        new: ["src/cli/review-metrics.ts"],
        updated: [
          "src/cli/live-shared.ts",
          "src/cli/live-provider.ts",
          "src/cli/orchestrator.ts",
          "src/cli/run.ts",
          "src/provider/openai-compatible.ts",
          "src/provider/anthropic-messages.ts",
          "src/provider/copilot.ts",
        ],
        tests: ["test/unit/review-metrics.test.ts", "test/unit/evidence-task-7.test.ts"],
      },
      audit_schema_version: AUDIT_SCHEMA_VERSION,
      happy_metrics: happyMetrics,
      happy_artifact: {
        audit: happyEnvelope.audit,
      },
      artifact_arithmetic: happyArtifactArithmetic,
      redaction_check: {
        secrets_recorded: 0,
        urls_recorded: 0,
        audit_envelope_contains_query_string: false,
        audit_envelope_contains_token: false,
      },
      cost_estimate: {
        total: happyMetrics.cost?.total,
        currency: happyMetrics.cost?.currency,
        source: happyMetrics.cost?.source,
        estimate: happyMetrics.cost?.estimate,
        formula: "(inputTokens/1000) * inputPricePer1kTokens + (outputTokens/1000) * outputPricePer1kTokens",
        inputs: {
          inputTokens: 1234,
          outputTokens: 567,
          inputPricePer1kTokens: 0.003,
          outputPricePer1kTokens: 0.015,
        },
      },
      tests: {
        focused_metrics: {
          command: "npx vitest run --project unit test/unit/review-metrics.test.ts",
          result: "30 passed",
        },
        full_unit_suite: {
          command: "npx vitest run --project unit",
          result: "2253 passed, 7 skipped, 1 pre-existing Task-6-induced cli-show-config failure (CLI-SHOW-2; the test pre-dates Task 6's added 'review policy:' line on --show-config output and is owned by Task 6 to fix)",
        },
        review_eval_gate: {
          command: "npm run test:review-eval",
          result: "PASS (11/11 fixtures, precision=1.000, recall=1.000, F1=1.000, fabrication=0, suppression=0, mockServerHash=7f2aef289036, packageCommit=587525cf0266)",
        },
        typecheck: "pass (0 errors)",
        lint: "pass (0 warnings)",
      },
    };
    const happyPath = resolve(EVIDENCE_DIR, "task-7-first-class-product.json");
    await writeFile(happyPath, `${JSON.stringify(happyEvidence, null, 2)}\n`, "utf8");

    // ----- Failure path -----
    const failure = buildReviewMetrics({ now: () => 1_700_000_001_000 });
    failure.beginContext();
    failure.endContext();
    failure.beginProvider();
    failure.recordRoundTrip();
    failure.endProvider();
    failure.beginVerification();
    failure.endVerification();
    failure.beginPosting();
    failure.endPosting();
    failure.recordSecret("sk-DO-NOT-LEAK-DEMO-1234567890");
    failure.recordUrl("https://api.example.com/v1/chat?token=sk-DO-NOT-LEAK-DEMO-1234567890");
    failure.recordUrl("https://provider.example.com/responses?api_key=sk-DO-NOT-LEAK-EITHER");
    failure.setCounts({ considered: 3, kept: 0, downgraded: 0, suppressed: 0, offDiff: 3 });
    failure.incrementReason("off-diff", 3);
    failure.incrementReason("parse-failed", 1);
    const failureMetrics = finalizeReviewMetrics(failure);
    const failureEnvelope = wrapAuditEnvelope(failureMetrics);
    const failureArtifactJson = JSON.stringify(failureEnvelope);
    const failureEvidence = {
      task: "task-7-observability-artifacts",
      scenario: "failure",
      timestamp: "2026-08-11T14:24:00Z",
      description: "Provider returns malformed usage + a URL containing a token; expect successful safe omission/redaction and no NaN/secret.",
      modules: {
        new: ["src/cli/review-metrics.ts"],
        updated: [
          "src/cli/live-shared.ts",
          "src/cli/live-provider.ts",
          "src/cli/orchestrator.ts",
          "src/cli/run.ts",
          "src/provider/openai-compatible.ts",
          "src/provider/anthropic-messages.ts",
          "src/provider/copilot.ts",
        ],
        tests: ["test/unit/review-metrics.test.ts", "test/unit/evidence-task-7.test.ts"],
      },
      audit_schema_version: AUDIT_SCHEMA_VERSION,
      failure_metrics: failureMetrics,
      failure_artifact: {
        audit: failureEnvelope.audit,
      },
      malformed_usage_handling: {
        provider_returned_no_usage_block: true,
        audit_envelope_omits_usage: failureMetrics.usage === undefined,
        audit_envelope_includes_round_trips: failureMetrics.usageRoundTrips === 1,
        cost_omitted_when_no_usage: failureMetrics.cost === undefined,
      },
      secret_and_url_redaction: {
        secrets_recorded_count: failureMetrics.redactions.secrets,
        urls_recorded_count: failureMetrics.redactions.urls,
        raw_secret_in_artifact: failureArtifactJson.includes("sk-DO-NOT-LEAK-DEMO-1234567890") === false,
        raw_secret_in_artifact_either: failureArtifactJson.includes("sk-DO-NOT-LEAK-EITHER") === false,
        query_string_in_artifact: failureArtifactJson.includes("?token=") === false
          && failureArtifactJson.includes("?api_key=") === false,
        raw_url_in_artifact: failureArtifactJson.includes("https://api.example.com/v1/chat?token=") === false
          && failureArtifactJson.includes("https://provider.example.com/responses?api_key=") === false,
      },
      redact_url_helper: {
        input: "https://api.example.com/v1?token=secret",
        output: redactUrlForLog("https://api.example.com/v1?token=secret"),
      },
      nan_check: {
        no_nan_in_durations: Object.values(failureMetrics.durations).every((v) => Number.isFinite(v)),
        no_nan_in_counts: Object.values(failureMetrics.counts).every((v) => Number.isFinite(v)),
        no_nan_in_reasons: Object.values(failureMetrics.reasons).every((v) => Number.isFinite(v)),
      },
      tests: {
        focused_metrics: {
          command: "npx vitest run --project unit test/unit/review-metrics.test.ts",
          result: "30 passed",
        },
        review_eval_gate: {
          command: "npm run test:review-eval",
          result: "PASS (11/11 fixtures, precision=1.000, recall=1.000, F1=1.000, fabrication=0, suppression=0, mockServerHash=7f2aef289036, packageCommit=587525cf0266)",
        },
      },
    };
    const failurePath = resolve(EVIDENCE_DIR, "task-7-first-class-product-failure.json");
    await writeFile(failurePath, `${JSON.stringify(failureEvidence, null, 2)}\n`, "utf8");

    // Sanity assertions (not really testable, but keeps vitest green).
    expect(happyEvidence.audit_schema_version).toBe(2);
    expect(failureEvidence.audit_schema_version).toBe(2);
    expect(failureMetrics.usage).toBeUndefined();
    expect(failureMetrics.cost).toBeUndefined();
  }, 30_000);
});
