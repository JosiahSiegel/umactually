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
  const eventPayload = await readGithubPullRequestPayload(env);
  const repo = readGithubRepo(env, eventPayload.repoFullName);
  const prNumber = readGithubPrNumber(env, eventPayload.prNumber);
  const headSha = readGithubSha(env, "GITHUB_HEAD_SHA", eventPayload.headSha);
  const baseSha = readGithubSha(env, "GITHUB_BASE_SHA", eventPayload.baseSha);

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

function readGithubRepo(env: NodeJS.ProcessEnv, fallback: string | null): GithubRepoRef {
  const repository = env["GITHUB_REPOSITORY"] ?? fallback ?? "";
  if (repository.length === 0) {
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

function readGithubPrNumber(env: NodeJS.ProcessEnv, fallback: number | null): number {
  const fromInput = env["PR_NUMBER"];
  const fromEnv = fromInput ?? env["GITHUB_PR_NUMBER"];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return parsePrNumber(fromEnv, env);
  }
  if (fallback !== null) {
    return fallback;
  }
  throw new GithubContextError(
    "GITHUB_PR_NUMBER_INVALID",
    "GitHub pull request number must be provided via PR_NUMBER input, GITHUB_PR_NUMBER env, or the pull_request event payload.",
  );
}

function parsePrNumber(raw: string, _env: NodeJS.ProcessEnv): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new GithubContextError("GITHUB_PR_NUMBER_INVALID", "GitHub pull request number must be a positive integer.");
  }
  return parsed;
}

function readGithubSha(env: NodeJS.ProcessEnv, key: "GITHUB_HEAD_SHA" | "GITHUB_BASE_SHA", fallback: string | null): string {
  const value = env[key] ?? fallback ?? "";
  if (value.length === 0) {
    throw new GithubContextError("GITHUB_SHA_MISSING", `GitHub Actions ${key} must be set.`);
  }
  return value;
}

type PullRequestPayloadFields = {
  readonly isDraft: boolean;
  readonly title: string;
  readonly body: string;
  readonly prNumber: number | null;
  readonly headSha: string | null;
  readonly baseSha: string | null;
  readonly repoFullName: string | null;
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
  const repository = readRecord(parsed, "repository");
  return {
    isDraft: readBoolean(pullRequest["draft"]),
    title: readString(pullRequest["title"]),
    body: readString(pullRequest["body"]),
    prNumber: readOptionalNumber(pullRequest["number"]),
    headSha: readSha(pullRequest, "head"),
    baseSha: readSha(pullRequest, "base"),
    repoFullName: readRepositoryName(repository),
  };
}

function readSha(record: Record<string, unknown>, key: "head" | "base"): string | null {
  const slot = record[key];
  if (!isObject(slot)) {
    return null;
  }
  const sha = slot["sha"];
  return typeof sha === "string" && sha.length > 0 ? sha : null;
}

function readRepositoryName(record: Record<string, unknown>): string | null {
  const fullName = record["full_name"];
  if (typeof fullName === "string" && fullName.length > 0) {
    return fullName;
  }
  const owner = record["owner"];
  const name = record["name"];
  if (isObject(owner) && typeof name === "string" && name.length > 0) {
    const ownerLogin = owner["login"];
    if (typeof ownerLogin === "string" && ownerLogin.length > 0) {
      return `${ownerLogin}/${name}`;
    }
  }
  return null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new GithubContextError("GITHUB_EVENT_PAYLOAD_INVALID", `GitHub event payload must contain a '${label}' object.`);
  }
  return value;
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