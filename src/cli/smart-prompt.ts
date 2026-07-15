// SPDX-License-Identifier: MIT

/**
 * Smart interactive prompts for the CLI.
 *
 * The CLI's job is to be useful in BOTH a terminal (where the operator
 * can answer questions) AND a CI pipeline (where stdin is closed and
 * non-zero answers must mean "fail fast, don't try"). This module is
 * the single boundary between those two modes.
 *
 * Rule of engagement:
 *   - ALL prompts MUST be guarded by `canPromptInteractively(...)` so
 *     we never write to a piped/CI stdin. If the environment cannot
 *     answer, we throw a typed `SmartPromptUnavailable` error that the
 *     caller (orchestrator / validate glue) maps to a structured
 *     validation error + remediation hint.
 *   - Each prompt supports a `timeoutMs` so an interactive CI with no
 *     operator on the seat doesn't hang forever. A timeout is treated
 *     as "user chose not to answer" — the caller surfaces the
 *     remediation hint and exits.
 *   - Inputs are NOT echoed to stderr (else secrets like API keys
 *     would leak into CI logs).
 *
 * The prompts here are intentionally minimal — no chalk, no TTY
 * detection libraries. The CLI already uses a single brand prefix on
 * its stdout writes; the prompts print that same prefix and let
 * downstream formatting (color, no-color) follow the same path.
 */

import { BRAND_PREFIX } from "../util/brand.js";

/**
 * Throw when the operator's environment cannot answer an interactive
 * prompt (no TTY, no stdin, or timeout). Caught by the validate glue
 * so the operator gets a structured remediation hint instead of a
 * raw stdin EOF / hang.
 */
export class SmartPromptUnavailable extends Error {
  override readonly name = "SmartPromptUnavailable";
  constructor(readonly code: "NO_TTY" | "TIMEOUT" | "CLOSED_STDIN" | "READ_ERROR", message: string) {
    super(message);
  }
}

/**
 * Returns true when the process is attached to a real TTY and stdin
 * is readable. The Node-side test (`process.stdin.isTTY === true`)
 * is the canonical heuristic — Bun treats it the same.
 *
 * NOTE: deliberately NOT wrapping in try/catch. Read-only checks on
 * `process.stdin.isTTY` never throw, so a try/catch here would mask
 * a legitimate internal invariant failure.
 */
export function canPromptInteractively(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

/**
 * Render the standard prompt on stdout, read a single line from
 * stdin, trim trailing newlines/spaces, return the trimmed result.
 *
 * No echoing of input — secrets typed into a terminal echo in the
 * terminal control layer, not in our stdout/stderr, so they don't
 * land in CI logs even when stdout is captured.
 *
 * Throws {@link SmartPromptUnavailable} when:
 *   - the prompt cannot be shown (no TTY),
 *   - stdin closes before a line arrives (e.g. on CI),
 *   - the read times out (operator didn't answer),
 *   - the underlying stream errors.
 */
export async function readInteractiveLine(input: {
  readonly prompt: string;
  readonly timeoutMs: number;
}): Promise<string> {
  if (!canPromptInteractively()) {
    throw new SmartPromptUnavailable(
      "NO_TTY",
      "Cannot read interactive input: stdin is not a TTY. Set --api-url / --api-key on the command line or via UMACTUALLY_API_URL / UMACTUALLY_API_KEY env vars.",
    );
  }
  process.stdout.write(`${BRAND_PREFIX}${input.prompt}\n`);

  const stdin = process.stdin;
  // Race the read against a timeout promise so a missed keypress
  // surfaces the typed TIMEOUT rejection WITHOUT relying on the
  // stream emitting `error` synchronously (which a paused TTY does
  // NOT do — Node's read-stream destroy-with-error only surfaces
  // via `error` if a read is mid-flight). The race pattern is the
  // canonical fix for "Promise that should timeout"; see
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
  // for the underlying semantics.
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => {
        reject(new SmartPromptUnavailable(
          "TIMEOUT",
          `Prompt timed out after ${input.timeoutMs}ms with no input. Set --api-url / --api-key on the command line or via env vars to skip the interactive prompt.`,
        ));
      },
      input.timeoutMs,
    );
    // Don't keep the event loop alive solely on the timer — the read
    // operation also references an open handle via the stream, so
    // unref() is safe here (the read promise keeps the loop alive).
    timeoutHandle.unref();
  });

  try {
    return await Promise.race([readOneLine(stdin), timeoutPromise]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Read a single line from a readable stream, resolving with the
 * trimmed value. Resolves to "" on EOF (caller distinguishes empty
 * vs. typed-empty via the input.length === 0 check + clarifying hint).
 *
 * Pure Node — no external deps. Uses the standard "data" + "end"
 * events rather than readline so the import stays free of a
 * third-party dep at CLI boot time (ncc bundling is happier this
 * way too).
 *
 * Implementation note: all three event listeners (`data`, `end`,
 * `error`) MUST be attached BEFORE `stream.resume()` is called.
 * On a fast EOF (e.g. CI with a closed pipe), the synchronous
 * `end` event fires from inside `resume()` itself; if listeners
 * aren't attached by then, the Promise hangs forever. The same
 * race applies to a synchronous `error` event on a destroyed stream.
 * The order below is load-bearing — don't reorder.
 */
async function readOneLine(stream: NodeJS.ReadStream): Promise<string> {
  return await new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer | string): void => {
      buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline !== -1) {
        stream.pause();
        stream.removeListener("data", onData);
        stream.removeListener("end", onEnd);
        stream.removeListener("error", onError);
        resolve(buffer.slice(0, newline).trimEnd());
      }
    };
    const onEnd = (): void => {
      stream.removeListener("data", onData);
      stream.removeListener("error", onError);
      resolve(buffer.trimEnd());
    };
    const onError = (err: Error): void => {
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      reject(new SmartPromptUnavailable("READ_ERROR", `Failed to read stdin: ${err.message}. Set --api-url / --api-key on the command line or via env vars.`));
    };
    // Attach all three listeners BEFORE resuming the stream. The
    // previous ordering (attach → resume) attached after the same-
    // tick end event had already fired, leaving the Promise to
    // hang forever on a closed stdin.
    stream.on("data", onData);
    stream.once("end", onEnd);
    stream.once("error", onError);
    stream.resume();
  });
}

/**
 * Conditionally prompt for a single value. Skips the prompt when:
 *   - the env var name is already populated (caller should re-check),
 *   - the env var cannot be prompted (no TTY / piped stdin / timeout),
 *   - the prompt times out without an answer.
 *
 * Returns `null` when no answer was collected — the caller should fall
 * back to throwing the typed validation error.
 *
 * The optional `default` is offered as an empty-input fallback so the
 * operator can press <Enter> to take the previously-saved value.
 */
export async function smartPromptForValue(input: {
  readonly label: string;
  readonly envVarName: string;
  readonly placeholder: string;
  readonly default?: string;
  readonly timeoutMs?: number;
}): Promise<string | null> {
  const existingFromEnv = process.env[input.envVarName];
  if (typeof existingFromEnv === "string" && existingFromEnv.length > 0) {
    // Already populated — no need to prompt.
    return existingFromEnv;
  }
  if (!canPromptInteractively()) {
    return null;
  }
  const defaultHint = input.default !== undefined && input.default.length > 0
    ? ` [default: ${input.default}]`
    : "";
  const promptText = `${input.label} (${input.envVarName})${defaultHint}: `;
  try {
    const answer = await readInteractiveLine({
      prompt: promptText,
      timeoutMs: input.timeoutMs ?? 15_000,
    });
    if (answer.length > 0) {
      return answer;
    }
    if (input.default !== undefined && input.default.length > 0) {
      return input.default;
    }
    return null;
  } catch (error) {
    if (error instanceof SmartPromptUnavailable) {
      return null;
    }
    throw error;
  }
}

/**
 * Convenience: prompt for the two API-config values operators most
 * commonly forget (`--api-url`, `--api-key`). Returns null when
 * neither could be collected (caller should then throw the typed
 * validation error).
 *
 * Both prompts share a 15-second timeout (configurable). When
 * `promptForUrl` is false, only the API key is asked for — useful for
 * Anthropic-native invocations where the URL is implicit.
 */
export async function smartPromptForApiConfig(input: {
  readonly promptForUrl: boolean;
  readonly timeoutMs?: number;
}): Promise<{ readonly apiUrl: string | null; readonly apiKey: string | null }> {
  let apiUrl: string | null = null;
  if (input.promptForUrl) {
    apiUrl = await smartPromptForValue({
      label: "Model provider base URL",
      envVarName: "UMACTUALLY_API_URL",
      placeholder: "https://api.openai.com/v1",
      ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    });
  }
  const apiKey = await smartPromptForValue({
    label: "Model provider API key",
    envVarName: "UMACTUALLY_API_KEY",
    placeholder: "sk-…",
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
  });
  return { apiUrl, apiKey };
}
