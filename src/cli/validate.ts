import type { Platform } from "../config/types.js";
import type { ParsedCliArgs } from "./parse-args.js";
import { detectPlatform, PlatformDetectionError } from "../platform/detect.js";

/** Platform after auto-resolution. Mirrors `Platform` minus the "auto" variant. */
export type ResolvedPlatform = Exclude<Platform, "auto">;

/**
 * Structured validation error. Carries the originating flag (or
 * `null` for cross-cutting errors), the legacy string message (for
 * backwards compatibility with callers that join a flat list), and
 * an actionable remediation hint that names the env var, the flag,
 * or the docs the operator should consult.
 *
 * Renderer (src/cli.ts:renderValidationErrors) prints each entry as:
 *
 *   cli: <message>
 *     hint: <hint>
 *
 * so the message bytes still match the legacy `"cli: <msg>;<msg>"` join
 * when only `message` is read.
 */
export type ValidationError = {
  readonly flag: string | null;
  readonly message: string;
  readonly hint: string;
};

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
 *
 * Returns {@link ValidationError} objects so the runner can render the
 * `message` (legacy contract) AND the structured `hint` so the operator
 * knows exactly what to set. The `message` field on each entry is the
 * byte-identical legacy string the old flat-join consumer printed, so
 * grep-friendly CI logs and any test that does `.includes("--api-url")`
 * keep working.
 */
function collectAlwaysValidationErrors(parsed: ParsedCliArgs): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (parsed.includeSonarqube) {
    if (parsed.sonarHostUrl === null) {
      errors.push({
        flag: "--sonar-host-url",
        message: "--sonar-host-url is required when --include-sonarqube is set",
        hint: "Pass the SonarQube base URL (e.g. `https://sonar.example.com`) via `--sonar-host-url <url>` or `UMACTUALLY_SONAR_HOST_URL=<url>`. Run `umactually doctor` to see which env vars are present.",
      });
    }
    if (parsed.sonarToken === null) {
      errors.push({
        flag: "--sonar-token",
        message: "--sonar-token is required when --include-sonarqube is set",
        hint: "Provide a SonarQube user token via `--sonar-token <token>` or `UMACTUALLY_SONAR_TOKEN=<token>`. Store it as a CI secret — never in source.",
      });
    }
    if (parsed.sonarProjectKey === null) {
      errors.push({
        flag: "--sonar-project-key",
        message: "--sonar-project-key is required when --include-sonarqube is set",
        hint: "Pass the SonarQube project key (e.g. `myorg_myrepo`) via `--sonar-project-key <key>` or `UMACTUALLY_SONAR_PROJECT_KEY=<key>`. The key is usually `<organization>_<repository>` and is shown in the SonarQube UI under Project Settings.",
      });
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
      errors.push({
        flag: "--api-url",
        message: "--api-url is required unless --dry-run is set, --provider copilot is used, or --provider anthropic is used",
        hint: "Pass `--api-url <url>` (e.g. `https://api.openai.com/v1`) or `UMACTUALLY_API_URL=<url>`. For Anthropic-native, pass `--provider anthropic` (default URL is https://api.anthropic.com/v1). For GitHub Copilot, pass `--provider copilot`. Run `umactually doctor` to confirm env vars are loaded.",
      });
    }
    if (parsed.apiKey === null || parsed.apiKey.length === 0) {
      errors.push({
        flag: "--api-key",
        message: "--api-key is required unless --dry-run is set",
        hint: "Pass `--api-key <key>` (or `UMACTUALLY_API_KEY=<key>`). Store it as a CI secret — never in source. Run `umactually doctor` to confirm env vars are loaded. Add `--dry-run` to skip the provider call for a smoke test.",
      });
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
 *
 * Returns {@link ValidationError} objects with hints so the runner can
 * render remediation text alongside the failure (see
 * `renderValidationErrors` in cli.ts).
 */
export function collectPostingValidationErrors(parsed: ParsedCliArgs): readonly ValidationError[] {
  if (!isPostingRequested(parsed)) {
    return [];
  }

  const errors: ValidationError[] = [];
  const resolved = resolvePlatform(parsed.platform);

  // Event + diff are posting-side inputs for BOTH GitHub and Azure flows:
  // they're read by buildGithubDryRunArtifact / buildAzureDryRunArtifact /
  // the dispatcher's runLiveReview path.
  if (parsed.eventPath === null) {
    errors.push({
      flag: "--event",
      message: "--review requires --event",
      hint: "Pass the path to the GitHub `event.json` payload (or the Azure equivalent) via `--event <path>`. The CLI uses this file to identify which PR to post the review on. See https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request for the GitHub event payload shape.",
    });
  }
  if (parsed.diffPath === null) {
    errors.push({
      flag: "--diff",
      message: "--review requires --diff",
      hint: "Pass the path to the unified PR diff (or a synthetic diff for local runs) via `--diff <path>`. Generate one with `git diff <base>...HEAD` or use the API-supplied diff in CI. The CLI reviews this diff and posts inline comments against it.",
    });
  }

  if (resolved === "azure") {
    if (parsed.prNumber === null) {
      errors.push({
        flag: "--pr-number",
        message: "--review requires --pr-number for --platform azure",
        hint: "Pass `--pr-number <N>` (a positive integer) — Azure DevOps does not advertise the PR number through SYSTEM_PULLREQUEST_PULLREQUESTID in every pipeline configuration. See docs/azure-devops.md for the supported forms.",
      });
    }
    if (parsed.repo === null) {
      errors.push({
        flag: "--repo",
        message: "--review requires --repo for --platform azure",
        hint: "Pass `--repo <organization>/<project>/<repository>` (Azure-format repo id) or set `SYSTEM_TEAMPROJECT` and `BUILD_REPOSITORY_NAME` in the pipeline. The CLI uses these to build the threads API URL.",
      });
    }
  }

  return errors;
}

/**
 * Composed validator. Always-errors ALWAYS apply; posting-errors apply
 * only when posting is requested. Backwards-compatible at the level of
 * the `message` field (each entry carries the legacy flat string), and
 * forwards-compatible via `flag`+`hint` so structured renderers can
 * surface remediation.
 *
 * Returns {@link ValidationError} records; legacy flat-string callers
 * can map `errors.map((e) => e.message)` to recover the old shape.
 */
export function collectValidationErrors(parsed: ParsedCliArgs): readonly ValidationError[] {
  return [
    ...collectAlwaysValidationErrors(parsed),
    ...collectPostingValidationErrors(parsed),
  ];
}

function assertNever(value: never): never {
  throw new TypeError(`unhandled platform variant: ${JSON.stringify(value)}`);
}