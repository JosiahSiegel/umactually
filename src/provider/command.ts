/**
 * Subprocess-backed LLM provider.
 *
 * Wires `umactually` to any local executable that speaks OpenAI Chat
 * Completions JSON over stdin/stdout. The subprocess is invoked once per
 * review with the same request body the HTTP providers would POST, and
 * is expected to return a chat-completions response object on stdout.
 *
 * Wire contract (documented in `docs/providers.md`):
 *   - stdin:  single JSON object (OpenAI chat-completions request)
 *   - stdout: single JSON object (OpenAI chat-completions response)
 *   - stderr: free-form logs; surfaced as `::notice::` annotations
 *   - exit 0 = success; non-zero = failure (stderr captured)
 *
 * The response is parsed through the same `parseReviewPayload` /
 * `parseProviderUsage` path the HTTP providers use, so the rest of the
 * pipeline (retry, parse-fail self-healing, severity filter, fact
 * verification) is unchanged. This is the only provider that doesn't
 * touch the network; the others all wrap `performProviderFetch`.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  buildChatBody,
  parseProviderUsage,
  parseReviewPayload,
  extractTextPayload,
  type ProviderEndpoint,
  type ProviderReviewPayload,
  type ResponseFormat,
} from "./provider-parse.js";
import { ProviderError, type ProviderUsage } from "./provider-error.js";
import { runWithRetry } from "./provider-retry.js";
import { BRAND_PREFIX } from "../util/brand.js";
import { ENV_KEYS } from "../util/env-keys.js";

const COMMAND_PROVIDER_NAME = "command";
const ENDPOINT_CHAT: ProviderEndpoint = "chat";

/** Configuration sourced from the CLI / env for the command family. */
export type CommandProviderConfig = {
  readonly commandPath: string;
  readonly commandArgs: readonly string[];
  readonly commandTimeoutMs: number;
  readonly commandEnv?: Readonly<Record<string, string>>;
};

export type CommandCallConfig = {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly requestTimeoutMs: number;
  readonly command: CommandProviderConfig;
  readonly signal?: AbortSignal;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
  readonly responseFormat?: ResponseFormat;
};

export type CommandCallSuccess = {
  readonly ok: true;
  readonly endpoint: ProviderEndpoint;
  readonly review: ProviderReviewPayload;
  readonly requestId: string;
  readonly usage?: import("./provider-error.js").ProviderUsage;
};

export type CommandCallFailure = {
  readonly ok: false;
  readonly error: ProviderError;
};

export type CommandCallResult = CommandCallSuccess | CommandCallFailure;

function resolveCommandProviderConfig(env: NodeJS.ProcessEnv): CommandProviderConfig {
  const commandPath = (env[ENV_KEYS.UMACTUALLY_COMMAND_PATH] ?? "").trim();
  if (!commandPath) {
    throw new ProviderError(
      "network",
      ENDPOINT_CHAT,
      null,
      "",
      `${ENV_KEYS.UMACTUALLY_COMMAND_PATH} is not set. Pass --command-path <executable> or export the env var.`,
    );
  }
  const argsRaw = (env[ENV_KEYS.UMACTUALLY_COMMAND_ARGS] ?? "").trim();
  const commandArgs = argsRaw.length > 0
    ? argsRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    : [];
  const timeoutRaw = (env[ENV_KEYS.UMACTUALLY_COMMAND_TIMEOUT_MS] ?? "").trim();
  const parsedTimeout = timeoutRaw.length > 0 ? Number.parseInt(timeoutRaw, 10) : NaN;
  const commandTimeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : 60_000;
  return {
    commandPath: resolve(commandPath),
    commandArgs,
    commandTimeoutMs,
  };
}

type SpawnResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
};

async function runSubprocess(
  config: CommandProviderConfig,
  requestBody: unknown,
  signal: AbortSignal | undefined,
): Promise<SpawnResult> {
  return await new Promise<SpawnResult>((resolveRun, rejectRun) => {
    let child;
    try {
      child = spawn(config.commandPath, [...config.commandArgs], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...(config.commandEnv ?? {}) },
      });
    } catch (err) {
      rejectRun(err);
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (err) => {
      if (timer !== undefined) clearTimeout(timer);
      rejectRun(err);
    });

    child.on("close", (code, sig) => {
      if (timer !== undefined) clearTimeout(timer);
      resolveRun({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: code,
        signal: sig,
        timedOut,
      });
    });

    if (signal !== undefined) {
      if (signal.aborted) {
        child.kill("SIGTERM");
      } else {
        signal.addEventListener("abort", () => child.kill("SIGTERM"), { once: true });
      }
    }

    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, config.commandTimeoutMs);
    timer.unref?.();

    // Write the request body, then close stdin so the subprocess knows
    // to start processing. The body is single-line JSON; pretty-printing
    // is the subprocess's choice if it wants to log it.
    try {
      child.stdin.write(JSON.stringify(requestBody));
      child.stdin.end();
    } catch (err) {
      if (timer !== undefined) clearTimeout(timer);
      rejectRun(err);
    }
  });
}

function announceStderr(stderr: string): void {
  const trimmed = stderr.trim();
  if (trimmed.length === 0) return;
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.length === 0) continue;
    process.stderr.write(`::notice::${BRAND_PREFIX}command-provider: ${line}\n`);
  }
}

/**
 * Extract a `ProviderUsage` from a chat-completions response's top-level
 * `usage` block. The HTTP provider clients use `parseProviderUsage` on
 * the SSE stream's terminal event; the command provider gets a single
 * JSON object, so we read the OpenAI-style `usage` field directly.
 * Returns `undefined` when no usage block is present (e.g. fixtures,
 * mock subprocesses, or providers that suppress usage).
 */
function extractChatCompletionsUsage(response: unknown): ProviderUsage | undefined {
  if (typeof response !== "object" || response === null) return undefined;
  const usage = (response as { readonly usage?: unknown })["usage"];
  if (typeof usage !== "object" || usage === null) return undefined;
  const u = usage as { readonly [k: string]: unknown };
  const input = typeof u["prompt_tokens"] === "number" ? (u["prompt_tokens"] as number) : undefined;
  const output = typeof u["completion_tokens"] === "number" ? (u["completion_tokens"] as number) : undefined;
  const total = typeof u["total_tokens"] === "number" ? (u["total_tokens"] as number) : undefined;
  if (input === undefined && output === undefined && total === undefined) return undefined;
  return {
    ...(input !== undefined ? { input_tokens: input } : {}),
    ...(output !== undefined ? { output_tokens: output } : {}),
    ...(total !== undefined ? { total_tokens: total } : {}),
  };
}

/**
 * Build the OpenAI chat-completions request body from the call config.
 * Mirrors `buildChatBody`'s contract exactly so the subprocess sees the
 * same shape an OpenAI-compatible HTTP endpoint would receive.
 */
function buildCommandRequestBody(config: CommandCallConfig): Record<string, unknown> {
  return buildChatBody({
    model: config.model,
    system: config.system,
    user: config.user,
    ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
    ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
    ...(config.responseFormat !== undefined ? { responseFormat: config.responseFormat } : {}),
  }) as Record<string, unknown>;
}

/**
 * Run a single review request through the configured subprocess.
 *
 * Returns a chat-completions-shaped `CommandCallResult` so the calling
 * live-provider dispatcher can treat it identically to the HTTP
 * providers' results.
 */
export async function runCommandProviderRequest(
  config: CommandCallConfig,
  requestId: string,
): Promise<CommandCallResult> {
  const requestBody = buildCommandRequestBody(config);
  let spawnResult: SpawnResult;
  try {
    spawnResult = await runSubprocess(config.command, requestBody, config.signal);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: new ProviderError("network", ENDPOINT_CHAT, null, requestId,
        `command provider failed to spawn ${config.command.commandPath}: ${message}`),
    };
  }

  if (spawnResult.stderr.length > 0) {
    announceStderr(spawnResult.stderr);
  }

  if (spawnResult.timedOut) {
    return {
      ok: false,
      error: new ProviderError("timeout", ENDPOINT_CHAT, null, requestId,
        `command provider timed out after ${config.command.commandTimeoutMs}ms`),
    };
  }

  if (spawnResult.exitCode !== 0) {
    const stderrTail = spawnResult.stderr.trim().split(/\r?\n/).slice(-5).join(" | ");
    return {
      ok: false,
      error: new ProviderError("network", ENDPOINT_CHAT, null, requestId,
        `command provider exited with code ${spawnResult.exitCode}${spawnResult.signal !== null ? ` (signal ${spawnResult.signal})` : ""}${stderrTail.length > 0 ? `: ${stderrTail}` : ""}`),
    };
  }

  // Parse stdout as a chat-completions response. The contract says
  // single-line JSON; tolerate trailing whitespace.
  const stdout = spawnResult.stdout.trim();
  if (stdout.length === 0) {
    return {
      ok: false,
      error: new ProviderError("parse", ENDPOINT_CHAT, null, requestId,
        "command provider returned empty stdout (expected a chat-completions JSON object)"),
    };
  }

  let response: unknown;
  try {
    response = JSON.parse(stdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: new ProviderError("parse", ENDPOINT_CHAT, null, requestId,
        `command provider stdout is not valid JSON: ${message}`),
    };
  }

  if (typeof response !== "object" || response === null) {
    return {
      ok: false,
      error: new ProviderError("parse", ENDPOINT_CHAT, null, requestId,
        "command provider stdout is not a JSON object"),
    };
  }

  const usage = parseProviderUsage(stdout) ?? extractChatCompletionsUsage(response);
  const textPayload = extractTextPayload(ENDPOINT_CHAT, stdout);
  const parsedReview = parseReviewPayload(textPayload, { providerName: COMMAND_PROVIDER_NAME });
  if (parsedReview === null) {
    return {
      ok: false,
      error: new ProviderError("parse", ENDPOINT_CHAT, null, requestId,
        "command provider response failed to parse as a review payload (expected an OpenAI chat-completions response whose `choices[0].message.content` is a strict-JSON review body)"),
    };
  }

  const result: CommandCallSuccess = usage !== undefined
    ? { ok: true, endpoint: ENDPOINT_CHAT, review: parsedReview, requestId, usage }
    : { ok: true, endpoint: ENDPOINT_CHAT, review: parsedReview, requestId };
  return result;
}

/**
 * Resolve the command provider config from env, run the request through
 * the standard retry/parse-fail self-healing loop, and return a result
 * shaped like the HTTP providers' `ProviderCallResult` so the
 * cross-protocol dispatcher in `live-provider.ts` can handle it
 * uniformly.
 */
export async function runCommandProviderWithRetry(
  config: CommandCallConfig,
  requestId: string,
): Promise<CommandCallResult> {
  return await runWithRetry<CommandCallResult>({
    runOnce: () => runCommandProviderRequest(config, requestId),
    endpoint: ENDPOINT_CHAT,
    requestId,
    signal: config.signal,
    fallbackMessage: `command provider at ${config.command.commandPath} failed after retries`,
  });
}

export { resolveCommandProviderConfig, COMMAND_PROVIDER_NAME };
