import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isRecord, REPO_ROOT, type CliResult } from "./cli-only-github-fixture.js";

export const API_KEY = "sk-effort-fixture-credential-only";
export const GITHUB_TOKEN = "fixture-platform-token";
export const MODEL = "deployment/opaque-xhigh-max-alias";
const REVIEW = JSON.stringify({ summary: "Local fixture review complete", verdict: "APPROVE", comments: [] });
export type WireCall = {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: Readonly<Record<string, unknown>>;
};

function sanitizeHeaders(headers: Readonly<Record<string, string | string[] | undefined>>): Readonly<Record<string, string | string[] | undefined>> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => {
    const normalizedName = name.toLowerCase();
    return [
      name,
      normalizedName === "authorization" || normalizedName === "x-api-key"
        ? "[REDACTED]"
        : value,
    ];
  }));
}
export type EffortFixture = Awaited<ReturnType<typeof startEffortFixture>>;

export async function startEffortFixture(mode: "responses" | "chat" | "anthropic" | "reject" | "copilot" = "responses") {
  const home = await mkdtemp(join(tmpdir(), "umactually-effort-"));
  await mkdir(join(home, ".umactually"));
  await writeFile(join(home, "example.ts"), "export const value = 1;\n");
  await writeFile(join(home, "event.json"), JSON.stringify({
    number: 42, repository: { full_name: "example/effort" },
    pull_request: { number: 42, title: "Effort fixture", body: "", draft: false,
      base: { sha: "0000000000000000000000000000000000000001", ref: "main" },
      head: { sha: "0000000000000000000000000000000000000002", ref: "feature" } },
  }));
  // Mutable recorder intentionally retains bodies only, never credential headers.
  const calls: WireCall[] = [];
  const platformCalls: string[] = [];
  const server = createServer(async (request, response) => {
    const path = request.url ?? "/";
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString("utf8");
    response.setHeader("content-type", "application/json");
    if (path.startsWith("/repos/")) {
      platformCalls.push(`${request.method} ${path}`);
      if (path.endsWith("/pulls/42")) {
        response.end("diff --git a/example.ts b/example.ts\n--- a/example.ts\n+++ b/example.ts\n@@ -0,0 +1 @@\n+export const value = 1;\n");
      } else response.end(request.method === "POST" ? '{"id":9001}' : "[]");
      return;
    }
    const body: unknown = JSON.parse(text || "{}");
    if (!isRecord(body)) throw new TypeError("Expected provider request object");
    calls.push({
      method: request.method ?? "GET",
      path,
      headers: sanitizeHeaders(request.headers),
      body,
    });
    if (mode === "reject") {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: { code: "unsupported_value", param: "reasoning.effort", message: `Unsupported reasoning.effort xhigh ${API_KEY}` } }));
      return;
    }
    if (mode === "chat" && path === "/v1/responses") {
      response.statusCode = 404;
      response.end('{"error":{"message":"endpoint not found"}}');
      return;
    }
    if (mode === "copilot") {
      if (path === "/copilot_internal/v2/token" || path === "/api/copilot_internal/v2/token") {
        response.end(JSON.stringify({
          token: "fixture-copilot-session-token",
          expires_at: Math.floor(Date.now() / 1000) + 3_600,
          endpoints: { api: `${apiUrl}/copilot` },
        }));
        return;
      }
      if (path === "/copilot/chat/completions") {
        response.end(JSON.stringify({ choices: [{ message: { content: REVIEW } }] }));
        return;
      }
    }
    switch (path) {
      case "/v1/responses": response.end(JSON.stringify({ output_text: REVIEW })); break;
      case "/v1/chat/completions": response.end(JSON.stringify({ choices: [{ message: { content: REVIEW } }] })); break;
      case "/v1/messages": response.end(JSON.stringify({ content: [{ type: "text", text: REVIEW }], stop_reason: "end_turn" })); break;
      default: response.statusCode = 404; response.end("{}");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new TypeError("Expected TCP address");
  const apiUrl = `http://127.0.0.1:${address.port}`;
  return {
    home, apiUrl, calls, platformCalls,
    async save(effort?: string, provider: "openai-compatible" | "anthropic" | "copilot" = mode === "anthropic" ? "anthropic" : mode === "copilot" ? "copilot" : "openai-compatible") {
      await writeFile(join(home, ".umactually", "config.json"), JSON.stringify({
        schemaVersion: 1, provider,
        apiUrl: `${apiUrl}/v1`, model: MODEL, ...(effort === undefined ? {} : { effort }),
      }));
    },

    async artifact() { return readFile(join(home, "review.json"), "utf8"); },
    async close() {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await rm(home, { recursive: true, force: true });
    },
  };
}

export async function runEffortCli(fixture: EffortFixture, input: {
  readonly flags?: readonly string[];
  readonly envEffort?: string;
  readonly pr?: boolean;
  readonly copilot?: boolean;
  readonly omitGithubToken?: boolean;
} = {}): Promise<CliResult> {
  // Allowlist instead of inheriting developer credentials, proxy settings, or CI state.
  const env: NodeJS.ProcessEnv = {
    PATH: process.env["PATH"], HOME: fixture.home, USERPROFILE: fixture.home,
    XDG_CONFIG_HOME: fixture.home, XDG_CACHE_HOME: fixture.home,
    ...(input.copilot ? {} : { UMACTUALLY_API_KEY: API_KEY }), NO_COLOR: "1",
    ...(input.envEffort === undefined ? {} : { UMACTUALLY_EFFORT: input.envEffort }),
    ...(input.copilot && !input.omitGithubToken ? { GITHUB_TOKEN: GITHUB_TOKEN } : {}),
    ...(input.pr ? { GITHUB_ACTIONS: "true", GITHUB_TOKEN: GITHUB_TOKEN,
      GITHUB_EVENT_PATH: join(fixture.home, "event.json"), GITHUB_REPOSITORY: "example/effort",
      GITHUB_API_URL: fixture.apiUrl } : {}),
    ...(input.copilot ? {
      NODE_OPTIONS: `--import=${fileURLToPath(new URL("./effort-copilot-interceptor.mjs", import.meta.url))}`,
      UMACTUALLY_E2E_COPILOT_BASE: fixture.apiUrl,
    } : {}),
  };
  const args = [join(REPO_ROOT, "bin", "umactually.mjs"), "review", "--json",
    "--output-artifact", join(fixture.home, "review.json"),
    ...(input.pr ? ["--platform", "github"] : ["--files", "example.ts"]),
    ...(input.flags ?? [])];
  return new Promise<CliResult>((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: fixture.home, env, stdio: ["ignore", "pipe", "pipe"] });
    const timeout = setTimeout(() => child.kill("SIGKILL"), 20_000);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("close", status => { clearTimeout(timeout); resolve({ status, stdout, stderr }); });
  });
}
