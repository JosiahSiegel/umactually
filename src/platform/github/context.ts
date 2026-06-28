import { readFile } from "node:fs/promises";

export type GithubRepoRef = {
  readonly owner: string;
  readonly name: string;
};

export type GithubContext = {
  readonly token: string;
  readonly repo: GithubRepoRef;
  readonly prNumber: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly isDraft: boolean;
  readonly title: string;
  readonly body: string;
};

export class GithubContextError extends Error {
  override readonly name = "GithubContextError";
  readonly code:
    | "GITHUB_TOKEN_MISSING"
    | "GITHUB_REPOSITORY_INVALID"
    | "GITHUB_PR_NUMBER_INVALID"
    | "GITHUB_SHA_MISSING"
    | "GITHUB_EVENT_PATH_MISSING"
    | "GITHUB_EVENT_PAYLOAD_INVALID";

  constructor(code: GithubContextError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

export async function readGithubContext(env: NodeJS.ProcessEnv): Promise<GithubContext> {
  const token = readGithubToken(env);
  const repo = readGithubRepo(env);
  const prNumber = readGithubPrNumber(env);
  const headSha = readGithubSha(env, "GITHUB_HEAD_SHA");
  const baseSha = readGithubSha(env, "GITHUB_BASE_SHA");
  const eventPayload = await readGithubPullRequestPayload(env);

  return {
    token,
    repo,
    prNumber,
    headSha,
    baseSha,
    isDraft: eventPayload.isDraft,
    title: eventPayload.title,
    body: eventPayload.body,
  };
}

function readGithubToken(env: NodeJS.ProcessEnv): string {
  const token = env["GITHUB_TOKEN"];
  if (token === undefined || token.length === 0) {
    throw new GithubContextError("GITHUB_TOKEN_MISSING", "GitHub Actions GITHUB_TOKEN must be set.");
  }
  return token;
}

function readGithubRepo(env: NodeJS.ProcessEnv): GithubRepoRef {
  const repository = env["GITHUB_REPOSITORY"];
  if (repository === undefined) {
    throw new GithubContextError("GITHUB_REPOSITORY_INVALID", "GitHub Actions GITHUB_REPOSITORY must be set as '<owner>/<name>'.");
  }
  const slashIndex = repository.indexOf("/");
  if (slashIndex <= 0 || slashIndex === repository.length - 1) {
    throw new GithubContextError("GITHUB_REPOSITORY_INVALID", "GitHub Actions GITHUB_REPOSITORY must follow '<owner>/<name>'.");
  }
  const owner = repository.slice(0, slashIndex);
  const name = repository.slice(slashIndex + 1);
  return { owner, name };
}

function readGithubPrNumber(env: NodeJS.ProcessEnv): number {
  const fromInput = env["PR_NUMBER"];
  const fromEnv = fromInput ?? env["GITHUB_PR_NUMBER"];
  if (fromEnv === undefined || fromEnv.length === 0) {
    throw new GithubContextError("GITHUB_PR_NUMBER_INVALID", "GitHub pull request number must be provided via PR_NUMBER input or GITHUB_PR_NUMBER env.");
  }
  const parsed = Number.parseInt(fromEnv, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new GithubContextError("GITHUB_PR_NUMBER_INVALID", "GitHub pull request number must be a positive integer.");
  }
  return parsed;
}

function readGithubSha(env: NodeJS.ProcessEnv, key: "GITHUB_HEAD_SHA" | "GITHUB_BASE_SHA"): string {
  const value = env[key];
  if (value === undefined || value.length === 0) {
    throw new GithubContextError("GITHUB_SHA_MISSING", `GitHub Actions ${key} must be set.`);
  }
  return value;
}

type PullRequestPayloadFields = {
  readonly isDraft: boolean;
  readonly title: string;
  readonly body: string;
};

async function readGithubPullRequestPayload(env: NodeJS.ProcessEnv): Promise<PullRequestPayloadFields> {
  const eventPath = env["GITHUB_EVENT_PATH"];
  if (eventPath === undefined || eventPath.length === 0) {
    throw new GithubContextError("GITHUB_EVENT_PATH_MISSING", "GitHub Actions GITHUB_EVENT_PATH must be set for pull_request events.");
  }
  const rawPayload = await readFile(eventPath, "utf8");
  const parsed: unknown = JSON.parse(rawPayload);
  if (!isObject(parsed)) {
    throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must parse as a JSON object.");
  }
  const pullRequest = parsed["pull_request"];
  if (!isObject(pullRequest)) {
    throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", "GitHub event payload must contain a 'pull_request' object.");
  }
  return {
    isDraft: readBoolean(pullRequest["draft"]),
    title: readString(pullRequest["title"]),
    body: readString(pullRequest["body"]),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}