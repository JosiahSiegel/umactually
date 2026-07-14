import type { Platform } from "../config/types.js";
import type { ParsedCliArgs } from "./parse-args.js";
import { detectPlatform, PlatformDetectionError } from "../platform/detect.js";

/** Platform after auto-resolution. Mirrors `Platform` minus the "auto" variant. */
export type ResolvedPlatform = Exclude<Platform, "auto">;

export function resolvePlatform(
  platform: ParsedCliArgs["platform"],
  env: NodeJS.ProcessEnv = process.env,
): ResolvedPlatform {
  switch (platform) {
    case "github":
      return "github";
    case "azure":
      return "azure";
    case "auto":
      // Route through the canonical detector so auto-resolution and
      // detection share one truth-table (catches TF_BUILD=True AND
      // GITHUB_ACTIONS=true, with GitHub precedence). Narrow catch:
      // any non-PlatformDetectionError is an internal invariant
      // failure that must surface — matching the orchestrator.ts and
      // index.ts symmetric narrow-catch pattern.
      //
      // Fallback to "github" (not "null" like orchestrator.ts, not
      // "fall through" like index.ts) is intentional: the validator
      // must return a concrete ResolvedPlatform so subsequent error
      // messages can name it, whereas orchestrator needs `null` to
      // surface "Live review requires GitHub Actions (...)" and
      // index.ts has no Azure path on the bare-entry side. Unifying
      // these three contracts would break the validator.
      try {
        const detected = detectPlatform(env);
        return detected === "azure-devops" ? "azure" : "github";
      } catch (error) {
        if (error instanceof PlatformDetectionError) {
          return "github";
        }
        throw error;
      }
    default:
      return assertNever(platform);
  }
}

/**
 * Did the operator ask the CLI to actually post? Posting identity must
 * be present iff true.
 *
 * Posting intent is signaled by `--review`: that's the only artifact path
 * the operator must explicitly opt into. ADO requires it for thread
 * posting; GH Actions derives it from `$GITHUB_EVENT_PATH` automatically,
 * which the wrapper runtime fills in (`src/index.ts:resolveGithubEventPath`)
 * before the CLI parser runs. Operator-supplied --dry-run is a hard kill
 * switch — even with --review, dry-run never posts.
 */
function isPostingRequested(parsed: ParsedCliArgs): boolean {
  if (parsed.dryRun) {
    return false;
  }
  return parsed.reviewPath !== null;
}

/**
 * Errors that ALWAYS apply regardless of whether the run is posting.
 * These are invariants the operator must satisfy in every mode.
 */
function collectAlwaysValidationErrors(parsed: ParsedCliArgs): readonly string[] {
  const errors: string[] = [];

  if (parsed.includeSonarqube) {
    if (parsed.sonarHostUrl === null) {
      errors.push("--sonar-host-url is required when --include-sonarqube is set");
    }
    if (parsed.sonarToken === null) {
      errors.push("--sonar-token is required when --include-sonarqube is set");
    }
    if (parsed.sonarProjectKey === null) {
      errors.push("--sonar-project-key is required when --include-sonarqube is set");
    }
  }

  // Provider config is required in live mode (the CLI talks to a
  // provider when it runs for real). --dry-run skips the provider call
  // entirely, so api-url/api-key are optional there. Copilot + Anthropic-
  // native providers don't need --api-url (Copilot → GitHub Copilot
  // token exchange; Anthropic → api.anthropic.com default).
  if (!parsed.dryRun) {
    if (
      (parsed.apiUrl === null || parsed.apiUrl.length === 0) &&
      parsed.provider !== "copilot" &&
      parsed.provider !== "anthropic"
    ) {
      errors.push("--api-url is required unless --dry-run is set, --provider copilot is used, or --provider anthropic is used");
    }
    if (parsed.apiKey === null || parsed.apiKey.length === 0) {
      errors.push("--api-key is required unless --dry-run is set");
    }
  }

  return errors;
}

/**
 * Errors that apply ONLY when posting is requested.
 *
 * Posting-target identity (--event, --diff, --pr-number, --repo) is
 * genuinely required to post somewhere. If the operator did not request
 * posting (dry-run, or no --review), these errors do NOT apply —
 * because the CLI never reaches the posting step.
 *
 * ADO additionally requires prNumber + repo because the PR-event shape
 * demands them; GitHub Actions can derive these from GITHUB_EVENT_PATH.
 */
export function collectPostingValidationErrors(parsed: ParsedCliArgs): readonly string[] {
  if (!isPostingRequested(parsed)) {
    return [];
  }

  const errors: string[] = [];
  const resolved = resolvePlatform(parsed.platform);

  // Event + diff are posting-side inputs for BOTH GitHub and Azure flows:
  // they're read by buildGithubDryRunArtifact / buildAzureDryRunArtifact /
  // the dispatcher's runLiveReview path.
  if (parsed.eventPath === null) {
    errors.push("--review requires --event");
  }
  if (parsed.diffPath === null) {
    errors.push("--review requires --diff");
  }

  if (resolved === "azure") {
    if (parsed.prNumber === null) {
      errors.push("--review requires --pr-number for --platform azure");
    }
    if (parsed.repo === null) {
      errors.push("--review requires --repo for --platform azure");
    }
  }

  return errors;
}

/**
 * Composed validator. Always-errors ALWAYS apply; posting-errors apply
 * only when posting is requested. Backwards-compatible: callers expecting
 * field-level required errors on every run will see them when posting;
 * callers running smoke tests (no --review, dry-run) will see none.
 */
export function collectValidationErrors(parsed: ParsedCliArgs): readonly string[] {
  return [
    ...collectAlwaysValidationErrors(parsed),
    ...collectPostingValidationErrors(parsed),
  ];
}

function assertNever(value: never): never {
  throw new TypeError(`unhandled platform variant: ${JSON.stringify(value)}`);
}