import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
export const REVIEW_MARKER = "<!-- umactually -->";

export type RecordedHttpCall = {
  readonly method: string;
  readonly path: string;
  readonly body: string;
};

export type CliResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type GithubFixtureOptions = {
  readonly providerBody: string;
  readonly existingReviews?: readonly Record<string, unknown>[];
};

export type GithubFixture = {
  readonly apiUrl: string;
  readonly calls: readonly RecordedHttpCall[];
  readonly close: () => Promise<void>;
};

const DIFF = [
  "diff --git a/src/review/example.ts b/src/review/example.ts",
  "--- a/src/review/example.ts",
  "+++ b/src/review/example.ts",
  "@@ -1,2 +1,2 @@",
  "-export const value = 'old';",
  "+export const value = 'new';",
].join("\n");

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

export async function startGithubFixture(options: GithubFixtureOptions): Promise<GithubFixture> {
  /** HTTP fixture recorder; mutation is the purpose of this test adapter. */
  const calls: RecordedHttpCall[] = [];
  /** Review state simulates GitHub's surviving review collection. */
  const reviews = [...(options.existingReviews ?? [])];
  const server = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const path = request.url ?? "/";
    const body = await readBody(request);
    calls.push({ method, path, body });

    if (method === "POST" && path === "/v1/responses") {
      sendJson(response, 200, { output_text: options.providerBody });
      return;
    }
    if (method === "GET" && path === "/repos/example/umactually-fixture/pulls/42") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(DIFF);
      return;
    }
    if (method === "GET" && path === "/repos/example/umactually-fixture/pulls/42/reviews") {
      sendJson(response, 200, reviews);
      return;
    }
    const reviewIdMatch = /^\/repos\/example\/umactually-fixture\/pulls\/42\/reviews\/(\d+)$/u.exec(path);
    if (method === "DELETE" && reviewIdMatch !== null) {
      const id = Number(reviewIdMatch[1]);
      const survivorIndex = reviews.findIndex((review) => review["id"] === id);
      if (survivorIndex >= 0) {
        reviews.splice(survivorIndex, 1);
      }
      response.writeHead(204);
      response.end();
      return;
    }
    if (method === "POST" && path === "/repos/example/umactually-fixture/pulls/42/reviews") {
      const parsed: unknown = JSON.parse(body);
      const record = isRecord(parsed) ? parsed : {};
      reviews.push({ id: 9001, state: "COMMENTED", body: record["body"] });
      sendJson(response, 201, { id: 9001 });
      return;
    }
    sendJson(response, 404, { message: `unexpected ${method} ${path}` });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new TypeError("fixture server must listen on a TCP port");
  }
  return {
    apiUrl: `http://127.0.0.1:${address.port}`,
    calls,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    }),
  };
}

function reviewEnvelopeExitCode(stdout: string): number | null {
  const line = stdout.trimEnd().split(/\r?\n/u).at(-1);
  if (line === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(line);
    if (
      isRecord(parsed) &&
      parsed["schemaVersion"] === 1 &&
      parsed["command"] === "review" &&
      typeof parsed["exitCode"] === "number"
    ) {
      return parsed["exitCode"];
    }
    return null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

export async function runGithubCli(apiUrl: string): Promise<CliResult> {
  const workspace = await mkdtemp(join(tmpdir(), "umactually-cli-only-github-"));
  const eventPath = join(workspace, "event.json");
  await writeFile(eventPath, JSON.stringify({
    number: 42,
    repository: { full_name: "example/umactually-fixture" },
    pull_request: {
      number: 42,
      title: "CLI-only contract",
      body: "Fixture pull request",
      draft: false,
      base: { sha: "0000000000000000000000000000000000000001", ref: "main" },
      head: { sha: "0000000000000000000000000000000000000002", ref: "feature/cli-only" },
    },
  }), "utf8");

  const args = [
    join(REPO_ROOT, "bin", "umactually.mjs"),
    "review",
    "--platform", "github",
    "--json",
    "--api-url", `${apiUrl}/v1`,
    "--api-key", "test-key",
  ];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GITHUB_ACTIONS: "true",
    GITHUB_TOKEN: "fixture-github-token",
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_REPOSITORY: "example/umactually-fixture",
    GITHUB_API_URL: apiUrl,
  };

  try {
    return await new Promise<CliResult>((resolveResult, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: REPO_ROOT,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; });
      child.stderr.on("data", (chunk: string) => { stderr += chunk; });
      child.once("error", reject);
      child.once("close", (processStatus) => {
        const envelopeStatus = reviewEnvelopeExitCode(stdout);
        const status = envelopeStatus ?? processStatus;
        if (process.platform === "win32" && envelopeStatus !== null && processStatus !== envelopeStatus) {
          console.warn(`CLI fixture ignored Windows libuv teardown status ${String(processStatus)}; JSON envelope reported ${envelopeStatus}.`);
        }
        resolveResult({ status, stdout, stderr });
      });
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
