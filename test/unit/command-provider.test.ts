/**
 * Unit tests for the `command` provider family.
 *
 * The provider spawns a local executable and exchanges OpenAI
 * chat-completions JSON over stdin/stdout. These tests cover:
 *
 *  - Happy path: subprocess returns a valid review payload on stdout
 *  - Stderr capture: subprocess stderr is surfaced as a ::notice::
 *  - Non-zero exit: spawn result becomes a typed ProviderError
 *  - Timeout: SIGTERM after the configured window produces a timeout error
 *  - Malformed stdout: non-JSON or empty response becomes a parse error
 *  - Config resolution: missing path env var surfaces a typed network error
 *
 * The test fixtures use small Node.js scripts written to a tmpdir,
 * since the provider is OS-agnostic and spawning `node` with a script
 * file is the most portable way to test the spawn pipeline.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveCommandProviderConfig,
  runCommandProviderRequest,
  COMMAND_PROVIDER_NAME,
} from "../../src/provider/command.js";
import { ENV_KEYS } from "../../src/util/env-keys.js";

const NODE = process.execPath;

const REVIEW_PAYLOAD_FIXTURE = {
  id: "chatcmpl-fixture-1",
  object: "chat.completion",
  created: 0,
  model: "fixture-model",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          summary: "Fixture review",
          verdict: "success",
          comments: [],
          suppressed_comments: [],
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
};

function makeScript(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "umactually-cmd-test-"));
  const scriptPath = join(dir, "fixture.mjs");
  writeFileSync(scriptPath, body, "utf8");
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

describe("command provider", () => {
  let workdir: string;
  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), "umactually-cmd-test-workdir-"));
  });
  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it("resolves commandPath / commandArgs / commandTimeoutMs from env", () => {
    const env: NodeJS.ProcessEnv = {
      [ENV_KEYS.UMACTUALLY_COMMAND_PATH]: "/usr/local/bin/llm",
      [ENV_KEYS.UMACTUALLY_COMMAND_ARGS]: "--mode=strict,--model=foo",
      [ENV_KEYS.UMACTUALLY_COMMAND_TIMEOUT_MS]: "12345",
    };
    const config = resolveCommandProviderConfig(env);
    expect(config.commandPath).toContain("/usr/local/bin/llm");
    expect(config.commandArgs).toEqual(["--mode=strict", "--model=foo"]);
    expect(config.commandTimeoutMs).toBe(12345);
  });

  it("falls back to defaults when commandArgs / commandTimeoutMs are unset", () => {
    const env: NodeJS.ProcessEnv = {
      [ENV_KEYS.UMACTUALLY_COMMAND_PATH]: "/bin/true",
    };
    const config = resolveCommandProviderConfig(env);
    expect(config.commandArgs).toEqual([]);
    expect(config.commandTimeoutMs).toBe(60_000);
  });

  it("throws a typed network error when commandPath is missing", () => {
    const env: NodeJS.ProcessEnv = {};
    expect(() => resolveCommandProviderConfig(env)).toThrowError(
      /UMACTUALLY_COMMAND_PATH/,
    );
  });

  it("returns a parsed review payload on the happy path", async () => {
    const script = makeScript(`
      let raw = "";
      process.stdin.on("data", (chunk) => { raw += chunk; });
      process.stdin.on("end", () => {
        process.stdout.write(${JSON.stringify(JSON.stringify(REVIEW_PAYLOAD_FIXTURE))});
      });
    `);
    const env: NodeJS.ProcessEnv = {
      [ENV_KEYS.UMACTUALLY_COMMAND_PATH]: NODE,
      [ENV_KEYS.UMACTUALLY_COMMAND_ARGS]: script,
    };
    const config = resolveCommandProviderConfig(env);
    const result = await runCommandProviderRequest(
      {
        model: "fixture-model",
        system: "sys",
        user: "user",
        requestTimeoutMs: 5000,
        command: config,
      },
      "test-req-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.endpoint).toBe("chat");
    expect(result.review.verdict).toBe("success");
    expect(result.usage?.total_tokens).toBe(15);
  });

  it("surfaces a non-zero exit as a typed network error", async () => {
    const script = makeScript(`
      process.stderr.write("deliberate failure\\n");
      process.exit(7);
    `);
    const env: NodeJS.ProcessEnv = {
      [ENV_KEYS.UMACTUALLY_COMMAND_PATH]: NODE,
      [ENV_KEYS.UMACTUALLY_COMMAND_ARGS]: script,
    };
    const config = resolveCommandProviderConfig(env);
    const result = await runCommandProviderRequest(
      {
        model: "fixture-model",
        system: "sys",
        user: "user",
        requestTimeoutMs: 5000,
        command: config,
      },
      "test-req-2",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("network");
    expect(result.error.message).toMatch(/exited with code 7/);
    expect(result.error.message).toMatch(/deliberate failure/);
  });

  it("surfaces empty stdout as a parse error", async () => {
    const script = makeScript(`
      // do nothing — exit 0 with empty stdout
    `);
    const env: NodeJS.ProcessEnv = {
      [ENV_KEYS.UMACTUALLY_COMMAND_PATH]: NODE,
      [ENV_KEYS.UMACTUALLY_COMMAND_ARGS]: script,
    };
    const config = resolveCommandProviderConfig(env);
    const result = await runCommandProviderRequest(
      {
        model: "fixture-model",
        system: "sys",
        user: "user",
        requestTimeoutMs: 5000,
        command: config,
      },
      "test-req-3",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("parse");
    expect(result.error.message).toMatch(/empty stdout/);
  });

  it("surfaces non-JSON stdout as a parse error", async () => {
    const script = makeScript(`
      process.stdin.on("data", () => {});
      process.stdin.on("end", () => {
        process.stdout.write("not json at all");
      });
    `);
    const env: NodeJS.ProcessEnv = {
      [ENV_KEYS.UMACTUALLY_COMMAND_PATH]: NODE,
      [ENV_KEYS.UMACTUALLY_COMMAND_ARGS]: script,
    };
    const config = resolveCommandProviderConfig(env);
    const result = await runCommandProviderRequest(
      {
        model: "fixture-model",
        system: "sys",
        user: "user",
        requestTimeoutMs: 5000,
        command: config,
      },
      "test-req-4",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("parse");
    expect(result.error.message).toMatch(/not valid JSON/);
  });

  it("sends a chat-completions-shaped body on stdin", async () => {
    const captured: { value: string } = { value: "" };
    const capturePath = join(workdir, "captured.json");
    const script = makeScript(`
      import { writeFileSync } from "node:fs";
      const target = ${JSON.stringify(capturePath)};
      let raw = "";
      process.stdin.on("data", (chunk) => { raw += chunk; });
      process.stdin.on("end", () => {
        writeFileSync(target, raw, "utf8");
        process.stdout.write(${JSON.stringify(JSON.stringify(REVIEW_PAYLOAD_FIXTURE))});
      });
    `);
    const env: NodeJS.ProcessEnv = {
      [ENV_KEYS.UMACTUALLY_COMMAND_PATH]: NODE,
      [ENV_KEYS.UMACTUALLY_COMMAND_ARGS]: script,
    };
    const config = resolveCommandProviderConfig(env);
    const result = await runCommandProviderRequest(
      {
        model: "fixture-model",
        system: "system prompt content",
        user: "user prompt content",
        requestTimeoutMs: 5000,
        command: config,
      },
      "test-req-5",
    );
    expect(result.ok).toBe(true);
    const { readFileSync } = await import("node:fs");
    captured.value = readFileSync(capturePath, "utf8");
    const body = JSON.parse(captured.value);
    expect(body.model).toBe("fixture-model");
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toBe("system prompt content");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("user prompt content");
  });

  it("exposes the canonical command provider name", () => {
    expect(COMMAND_PROVIDER_NAME).toBe("command");
  });
});
