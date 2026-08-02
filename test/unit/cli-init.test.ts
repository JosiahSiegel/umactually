// SPDX-License-Identifier: MIT
// Tests for src/cli/init.ts (the `umactually init` subcommand) and the
// pure config-builder at src/config/init-config.ts.
//
// We test the pure pieces directly (parseInitArgs, buildInitConfig,
// runInit with injected fs adapter) so we never touch the real
// filesystem and never call any LLM provider.

import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseInitArgs,
  resolveConfigDir,
  runInit,
  formatInitConfig,
  type InitArgs,
  type InitConfig,
  type InitFsAdapter,
} from "../../src/cli/init.js";
import {
  buildInitConfig,
  type InitConfigDeps,
} from "../../src/config/init-config.js";

const HOME = process.platform === "win32"
  ? join(process.cwd().split(sep)[0] ?? "C:\\", "Users", "tester")
  : "/home/tester";

const CONFIG_DIR = join(HOME, ".umactually");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function makeFs(files: Record<string, string>): InitFsAdapter {
  const store: Record<string, string> = { ...files };
  return {
    exists: (path) => path in store,
    isDirectory: (path) => store[`__dir__:${path}`] === "1",
    mkdir: (path) => {
      store[`__dir__:${path}`] = "1";
    },
    readFile: (path) => {
      const entry = store[path];
      if (entry === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return entry;
    },
    writeFile: (path, content) => {
      store[path] = content;
    },
  };
}

describe("parseInitArgs", () => {
  it("returns provider when --provider is supplied", () => {
    const parsed = parseInitArgs(["--provider", "openai"]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.provider).toBe("openai");
    expect(parsed.apply).toBe(false);
    expect(parsed.json).toBe(false);
    expect(parsed.help).toBe(false);
  });

  it("accepts each of the three documented providers", () => {
    for (const provider of ["openai", "anthropic", "copilot"]) {
      const parsed = parseInitArgs(["--provider", provider]);
      expect(parsed.errors).toEqual([]);
      expect(parsed.provider).toBe(provider);
    }
  });

  it("rejects unknown provider values", () => {
    const parsed = parseInitArgs(["--provider", "openai-compatible"]);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.join(" ")).toMatch(/--provider/u);
    expect(parsed.errors.join(" ")).toMatch(/openai\|anthropic\|copilot/u);
  });

  it("rejects invocation without --provider", () => {
    const parsed = parseInitArgs([]);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.join(" ")).toMatch(/--provider/u);
  });

  it("captures --apply and --json flags", () => {
    const parsed = parseInitArgs(["--provider", "anthropic", "--apply", "--json"]);
    expect(parsed.apply).toBe(true);
    expect(parsed.json).toBe(true);
    expect(parsed.provider).toBe("anthropic");
    expect(parsed.errors).toEqual([]);
  });

  it("captures --api-url and --api-key overrides", () => {
    const parsed = parseInitArgs([
      "--provider", "openai",
      "--api-url", "https://api.example/v1",
      "--api-key", "sk-test",
    ]);
    expect(parsed.apiUrl).toBe("https://api.example/v1");
    expect(parsed.apiKey).toBe("sk-test");
    expect(parsed.errors).toEqual([]);
  });

  it("captures --help / -h", () => {
    expect(parseInitArgs(["--help"]).help).toBe(true);
    expect(parseInitArgs(["-h"]).help).toBe(true);
  });

  it("rejects unknown flags", () => {
    const parsed = parseInitArgs(["--provider", "openai", "--bogus"]);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.join(" ")).toMatch(/--bogus/u);
  });

  it("treats --provider with no following value as an error", () => {
    const parsed = parseInitArgs(["--provider"]);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.join(" ")).toMatch(/--provider/u);
  });
});

describe("resolveConfigDir", () => {
  it("uses ~/.umactually/ as the default config directory", () => {
    expect(resolveConfigDir(HOME)).toBe(CONFIG_DIR);
  });
});

describe("buildInitConfig", () => {
  const baseArgs: InitArgs = {
    provider: "openai",
    apply: false,
    json: false,
    help: false,
    apiUrl: null,
    apiKey: null,
    errors: [],
  };

  const baseEnv = {
    UMACTUALLY_API_URL: "https://api.openai.com/v1",
    UMACTUALLY_API_KEY: "sk-test-1234",
    UMACTUALLY_MODEL: "gpt-4o",
  } as const;

  it("returns a config object with the requested provider and env-derived fields", () => {
    const deps: InitConfigDeps = { args: baseArgs, env: baseEnv };
    const config = buildInitConfig(deps);
    expect(config.provider).toBe("openai");
    expect(config.apiUrl).toBe("https://api.openai.com/v1");
    expect(config.apiKey).toBe("sk-test-1234");
    expect(config.model).toBe("gpt-4o");
  });

  it("prefers CLI --api-url / --api-key over the env-derived values", () => {
    const args: InitArgs = {
      ...baseArgs,
      apiUrl: "https://override.example/v1",
      apiKey: "sk-override",
    };
    const deps: InitConfigDeps = { args, env: baseEnv };
    const config = buildInitConfig(deps);
    expect(config.apiUrl).toBe("https://override.example/v1");
    expect(config.apiKey).toBe("sk-override");
  });

  it("omits env-derived fields that are not set", () => {
    const deps: InitConfigDeps = {
      args: baseArgs,
      env: { UMACTUALLY_API_KEY: "sk-test-1234" },
    };
    const config = buildInitConfig(deps);
    expect(config.apiKey).toBe("sk-test-1234");
    expect(config.apiUrl).toBeUndefined();
    expect(config.model).toBeUndefined();
  });

  it("returns at least the provider when no env-derived fields are set", () => {
    const deps: InitConfigDeps = {
      args: baseArgs,
      env: {},
    };
    const config = buildInitConfig(deps);
    expect(config.provider).toBe("openai");
    expect(config.apiUrl).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
    expect(config.model).toBeUndefined();
  });

  it("never includes empty-string fields", () => {
    const deps: InitConfigDeps = {
      args: baseArgs,
      env: {
        UMACTUALLY_API_URL: "",
        UMACTUALLY_API_KEY: "",
        UMACTUALLY_MODEL: "",
      },
    };
    const config = buildInitConfig(deps);
    expect(config.apiUrl).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
    expect(config.model).toBeUndefined();
  });
});

describe("formatInitConfig", () => {
  it("serializes to JSON with the expected keys", () => {
    const config: InitConfig = {
      provider: "anthropic",
      apiUrl: "https://api.anthropic.com",
      apiKey: "sk-ant-test",
      model: "claude-3-5-sonnet-latest",
    };
    const text = formatInitConfig(config);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed["provider"]).toBe("anthropic");
    expect(parsed["apiUrl"]).toBe("https://api.anthropic.com");
    expect(parsed["apiKey"]).toBe("sk-ant-test");
    expect(parsed["model"]).toBe("claude-3-5-sonnet-latest");
  });

  it("omits undefined fields from the JSON output", () => {
    const text = formatInitConfig({ provider: "copilot" });
    expect(text).not.toContain("apiUrl");
    expect(text).not.toContain("apiKey");
    expect(text).not.toContain("model");
    expect(JSON.parse(text)).toEqual({ provider: "copilot" });
  });
});

describe("runInit", () => {
  const baseEnv = {
    UMACTUALLY_API_URL: "https://api.openai.com/v1",
    UMACTUALLY_API_KEY: "sk-test-1234",
    UMACTUALLY_MODEL: "gpt-4o",
  } as const;

  it("prints the would-write preview and does NOT create the file in dry-run mode", async () => {
    const fs = makeFs({});
    const result = await runInit({
      argv: ["--provider", "openai"],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: { write: (chunk: string) => chunk.length } as { write: (chunk: string) => number },
      stderr: { write: (chunk: string) => chunk.length } as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(0);
    expect(fs.exists(CONFIG_PATH)).toBe(false);
  });

  it("writes the config file when --apply is set", async () => {
    const fs = makeFs({});
    const stdout = { write: () => 0 };
    const stderr = { write: () => 0 };
    const result = await runInit({
      argv: ["--provider", "openai", "--apply"],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: stdout as { write: (chunk: string) => number },
      stderr: stderr as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(0);
    expect(fs.exists(CONFIG_PATH)).toBe(true);
    const written = fs.readFile(CONFIG_PATH);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed["provider"]).toBe("openai");
    expect(parsed["apiUrl"]).toBe("https://api.openai.com/v1");
    expect(parsed["apiKey"]).toBe("sk-test-1234");
    expect(parsed["model"]).toBe("gpt-4o");
  });

  it("overwrites an existing config file when --apply is set", async () => {
    const fs = makeFs({
      [CONFIG_PATH]: JSON.stringify({ provider: "anthropic", model: "old-model" }),
    });
    const result = await runInit({
      argv: ["--provider", "openai", "--apply"],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: { write: () => 0 } as { write: (chunk: string) => number },
      stderr: { write: () => 0 } as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(0);
    const written = fs.readFile(CONFIG_PATH);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed["provider"]).toBe("openai");
    expect(parsed["model"]).toBe("gpt-4o");
  });

  it("does not overwrite an existing config file in dry-run mode", async () => {
    const original = JSON.stringify({ provider: "anthropic", model: "old-model" });
    const fs = makeFs({ [CONFIG_PATH]: original });
    const result = await runInit({
      argv: ["--provider", "openai"],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: { write: () => 0 } as { write: (chunk: string) => number },
      stderr: { write: () => 0 } as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(0);
    expect(fs.readFile(CONFIG_PATH)).toBe(original);
  });

  it("returns exit 2 and a clear error when --provider is missing", async () => {
    const fs = makeFs({});
    const stderrChunks: string[] = [];
    const stderr = {
      write: (chunk: string) => {
        stderrChunks.push(chunk);
        return chunk.length;
      },
    };
    const result = await runInit({
      argv: [],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: { write: () => 0 } as { write: (chunk: string) => number },
      stderr: stderr as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(2);
    expect(stderrChunks.join("")).toMatch(/--provider/u);
  });

  it("returns exit 2 when --provider has an unknown value", async () => {
    const fs = makeFs({});
    const stderrChunks: string[] = [];
    const stderr = {
      write: (chunk: string) => {
        stderrChunks.push(chunk);
        return chunk.length;
      },
    };
    const result = await runInit({
      argv: ["--provider", "bogus-provider"],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: { write: () => 0 } as { write: (chunk: string) => number },
      stderr: stderr as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(2);
    expect(stderrChunks.join("")).toMatch(/--provider/u);
  });

  it("honors UMACTUALLY_INIT_FORCE=1 as an alternate apply signal", async () => {
    const fs = makeFs({});
    const result = await runInit({
      argv: ["--provider", "openai"],
      env: { ...baseEnv, UMACTUALLY_INIT_FORCE: "1" },
      fs,
      homeDir: HOME,
      stdout: { write: () => 0 } as { write: (chunk: string) => number },
      stderr: { write: () => 0 } as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(0);
    expect(fs.exists(CONFIG_PATH)).toBe(true);
  });

  it("emits a JSON envelope when --json is set", async () => {
    const fs = makeFs({});
    const stdoutChunks: string[] = [];
    const stdout = {
      write: (chunk: string) => {
        stdoutChunks.push(chunk);
        return chunk.length;
      },
    };
    const result = await runInit({
      argv: ["--provider", "openai", "--json"],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: stdout as { write: (chunk: string) => number },
      stderr: { write: () => 0 } as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(0);
    const out = stdoutChunks.join("");
    const parsed = JSON.parse(out) as Record<string, unknown>;
    // M1's envelope.ts may not be merged yet. Accept either the
    // simple fallback shape (`{ command, ok, data }`) or the
    // canonical EnvelopeV1 shape.
    expect(parsed["command"]).toBe("init");
    expect(parsed["ok"]).toBe(true);
    const data = (parsed["data"] ?? parsed) as Record<string, unknown>;
    expect(data["provider"]).toBe("openai");
    expect(data["configPath"]).toBe(CONFIG_PATH);
    expect(data["applied"]).toBe(false);
  });

  it("creates the config directory on --apply when missing", async () => {
    const fs = makeFs({});
    const result = await runInit({
      argv: ["--provider", "openai", "--apply"],
      env: baseEnv,
      fs,
      homeDir: HOME,
      stdout: { write: () => 0 } as { write: (chunk: string) => number },
      stderr: { write: () => 0 } as { write: (chunk: string) => number },
    });
    expect(result.exitCode).toBe(0);
    expect(fs.isDirectory(CONFIG_DIR)).toBe(true);
  });
});