import type { ActionInputs } from "./read-inputs.js";

export function appendCommonInputArgs(args: string[], inputs: ActionInputs): void {
  pushFlagValue(args, "--api-url", inputs.apiUrl);
  pushFlagValue(args, "--api-key", inputs.apiKey);
  pushFlagValue(args, "--model", inputs.model);
  pushFlagValue(args, "--prompt", inputs.prompt);
  pushFlagValue(args, "--prompt-file", inputs.promptFile);
  pushFlagValue(args, "--additional-prompt", inputs.additionalPrompt);
  pushFlagValue(args, "--additional-prompt-file", inputs.additionalPromptFile);
  pushFlagValue(args, "--sonar-host-url", inputs.sonarHostUrl);
  pushFlagValue(args, "--sonar-token", inputs.sonarToken);
  pushFlagValue(args, "--sonar-project-key", inputs.sonarProjectKey);
  pushFlagValue(args, "--provider", inputs.provider);
  pushFlagValue(args, "--github-api-base", inputs.githubApiBase);
  pushFlagValue(args, "--effort", inputs.effort);
  pushFlagValue(args, "--minimum-severity", inputs.minimumSeverity);

  pushNumber(args, "--review-timeout-seconds", inputs.reviewTimeoutSeconds);
  pushNumber(args, "--stall-seconds", inputs.stallSeconds);
  pushNumber(args, "--max-output-tokens", inputs.maxOutputTokens);
  pushNumber(args, "--max-comments", inputs.maxComments);
  pushNumber(args, "--review-file-limit", inputs.reviewFileLimit);
  pushNumber(args, "--sonar-timeout-seconds", inputs.sonarTimeoutSeconds);

  pushBool(args, inputs.ignoreMinor, "--ignore-minor");
  pushBool(args, inputs.includeSonarqube, "--include-sonarqube");
  pushBool(args, inputs.walkthrough, "--walkthrough");
  pushBool(args, inputs.diagnostic, "--diagnostic");
  pushBool(args, inputs.debugRawResponse, "--debug-raw-response");
  pushBool(args, inputs.simulateFindings, "--simulate-findings");

  args.push(inputs.detectLeaks ? "--detect-leaks" : "--no-detect-leaks");
  args.push(inputs.dryRun ? "--dry-run" : "--no-dry-run");
}

function pushFlagValue(args: string[], flag: string, value: string | undefined): void {
  if (typeof value === "string" && value.length > 0) {
    args.push(flag, value);
  }
}

function pushNumber(args: string[], flag: string, value: number): void {
  args.push(flag, String(value));
}

function pushBool(args: string[], condition: boolean, flag: string): void {
  if (condition) {
    args.push(flag);
  }
}
