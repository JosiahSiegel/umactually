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

export function collectValidationErrors(parsed: ParsedCliArgs): readonly string[] {
  const errors: string[] = [];
  const resolved = resolvePlatform(parsed.platform);

  if (resolved === "github") {
    if (parsed.eventPath === null) {
      errors.push("--event is required for --platform github");
    }
    if (parsed.diffPath === null) {
      errors.push("--diff is required for --platform github");
    }
  }

  if (resolved === "azure") {
    if (parsed.eventPath === null) {
      errors.push("--event is required for --platform azure");
    }
    if (parsed.diffPath === null) {
      errors.push("--diff is required for --platform azure");
    }
    if (parsed.prNumber === null) {
      errors.push("--pr-number is required for --platform azure");
    }
    if (parsed.repo === null) {
      errors.push("--repo is required for --platform azure");
    }
  }

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

  if (!parsed.dryRun) {
    // Copilot provider does not need --api-url; it uses the GitHub Copilot
    // token exchange endpoint (defaulting to https://api.github.com).
    if (parsed.apiUrl === null && parsed.provider !== "copilot") {
      errors.push("--api-url is required unless --dry-run is set or --provider copilot is used");
    }
    if (parsed.apiKey === null) {
      errors.push("--api-key is required unless --dry-run is set");
    }
  }

  return errors;
}

function assertNever(value: never): never {
  throw new TypeError(`unhandled platform variant: ${JSON.stringify(value)}`);
}