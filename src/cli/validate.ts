import type { ParsedCliArgs } from "./parse-args.js";

export type ResolvedPlatform = "github" | "azure";

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
      return env["TF_BUILD"] === "True" ? "azure" : "github";
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
    if (parsed.apiUrl === null) {
      errors.push("--api-url is required unless --dry-run is set");
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