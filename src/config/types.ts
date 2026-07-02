export type Severity = "info" | "minor" | "major" | "critical" | "security" | "leak";

export type Platform = "auto" | "github" | "azure";

export type ProviderConfig = {
  readonly url: string;
  readonly apiKey: string;
  readonly model: string;
};

export type PromptConfig = {
  readonly system: string;
  readonly user: string;
  readonly systemFiles: readonly string[];
  readonly userFiles: readonly string[];
};

export type GuidanceFlags = {
  readonly walkthrough: boolean;
  readonly diagnostic: boolean;
  readonly dryRun: boolean;
  readonly debugRawResponse: boolean;
};

export type TimeoutControls = {
  readonly reviewSeconds: number;
  readonly stallSeconds: number;
  readonly perRequestSeconds: number;
};

export type SeverityControls = {
  readonly ignoreMinor: boolean;
  readonly minimum: Severity;
  readonly maxComments: number;
};

export type SonarConfig = {
  readonly enabled: boolean;
  readonly host: string;
  readonly token: string;
  readonly project: string;
  readonly timeoutSeconds: number;
};

export type AzureConfig = {
  readonly org: string;
  readonly project: string;
  readonly repo: string;
  readonly pullRequestId: number;
  readonly token: string;
};

export type ReviewConfig = {
  readonly provider: ProviderConfig;
  readonly prompts: PromptConfig;
  readonly guidance: GuidanceFlags;
  readonly timeouts: TimeoutControls;
  readonly severity: SeverityControls;
  readonly scope: ReviewScopeControls;
  readonly sonar: SonarConfig;
  readonly leakDetection: boolean;
  readonly redactorEnabled: boolean;
  readonly platform: Platform;
  readonly githubToken: string;
  readonly azure: AzureConfig;
};

export type ReviewScopeControls = {
  /**
   * Soft cap on the number of changed files the live review path will
   * process. When `countDiffFiles(diffText) > reviewFileLimit` the
   * orchestrator skips the chunked review and posts a "diff too large
   * to review" parent card with zero inline findings, rather than
   * feeding arbitrarily-large per-file chunks to the LLM (which
   * produces hallucinated findings that aren't grounded in the diff).
   */
  readonly reviewFileLimit: number;
};

export type CliArgs = {
  readonly providerUrl?: string;
  readonly providerApiKey?: string;
  readonly providerModel?: string;
  readonly promptSystem?: string;
  readonly promptSystemFile?: string;
  readonly promptUser?: string;
  readonly promptUserFile?: string;
  readonly promptByteCap?: number;
  readonly walkthrough?: boolean;
  readonly diagnostic?: boolean;
  readonly dryRun?: boolean;
  readonly debugRawResponse?: boolean;
  readonly simulateFindings?: boolean;
  readonly reviewTimeoutSeconds?: number;
  readonly stallTimeoutSeconds?: number;
  readonly perRequestTimeoutSeconds?: number;
  readonly ignoreMinor?: boolean;
  readonly minimumSeverity?: Severity;
  readonly maxComments?: number;
  readonly reviewFileLimit?: number;
  readonly sonarEnabled?: boolean;
  readonly sonarHost?: string;
  readonly sonarToken?: string;
  readonly sonarProject?: string;
  readonly sonarTimeoutSeconds?: number;
  readonly leakDetection?: boolean;
  readonly redactorEnabled?: boolean;
  readonly platform?: Platform;
  readonly githubToken?: string;
  readonly azureOrg?: string;
  readonly azureProject?: string;
  readonly azureRepo?: string;
  readonly azurePullRequestId?: number;
  readonly azureToken?: string;
};

export type ActionInputs = {
  readonly providerUrl?: string;
  readonly providerApiKey?: string;
  readonly providerModel?: string;
  readonly promptSystem?: string;
  readonly promptSystemFile?: string;
  readonly promptUser?: string;
  readonly promptUserFile?: string;
  readonly promptByteCap?: string | number;
  readonly walkthrough?: string | boolean;
  readonly diagnostic?: string | boolean;
  readonly dryRun?: string | boolean;
  readonly debugRawResponse?: string | boolean;
  readonly simulateFindings?: string | boolean;
  readonly reviewTimeoutSeconds?: string | number;
  readonly stallTimeoutSeconds?: string | number;
  readonly perRequestTimeoutSeconds?: string | number;
  readonly ignoreMinor?: string | boolean;
  readonly minimumSeverity?: string;
  readonly maxComments?: string | number;
  readonly reviewFileLimit?: string | number;
  readonly sonarEnabled?: string | boolean;
  readonly sonarHost?: string;
  readonly sonarToken?: string;
  readonly sonarProject?: string;
  readonly sonarTimeoutSeconds?: string | number;
  readonly leakDetection?: string | boolean;
  readonly redactorEnabled?: string | boolean;
  readonly platform?: string;
  readonly githubToken?: string;
  readonly azureOrg?: string;
  readonly azureProject?: string;
  readonly azureRepo?: string;
  readonly azurePullRequestId?: string | number;
  readonly azureToken?: string;
};

export type EnvSources = {
  readonly providerUrl?: string;
  readonly providerApiKey?: string;
  readonly providerModel?: string;
  readonly promptSystemFile?: string;
  readonly promptUserFile?: string;
  readonly promptByteCap?: string;
  readonly walkthrough?: string;
  readonly diagnostic?: string;
  readonly dryRun?: string;
  readonly debugRawResponse?: string;
  readonly simulateFindings?: string;
  readonly reviewTimeoutSeconds?: string;
  readonly stallTimeoutSeconds?: string;
  readonly perRequestTimeoutSeconds?: string;
  readonly ignoreMinor?: string;
  readonly minimumSeverity?: string;
  readonly maxComments?: string;
  readonly reviewFileLimit?: string;
  readonly sonarEnabled?: string;
  readonly sonarHost?: string;
  readonly sonarToken?: string;
  readonly sonarProject?: string;
  readonly sonarTimeoutSeconds?: string;
  readonly leakDetection?: string;
  readonly redactorEnabled?: string;
  readonly platform?: string;
  readonly githubToken?: string;
  readonly azureOrg?: string;
  readonly azureProject?: string;
  readonly azureRepo?: string;
  readonly azurePullRequestId?: string;
  readonly azureToken?: string;
};

export type LoadConfigSources = {
  readonly cli: CliArgs;
  readonly inputs: ActionInputs;
  readonly env: EnvSources;
  readonly cwd: string;
};
