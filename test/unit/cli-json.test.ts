import { describe, expect, it, vi } from "vitest";

import {
  expectNotImplementedExport,
  RedModuleMissingError,
} from "../helpers/assert-red-module.js";

const dispatchModule = "../../src/cli/dispatch.js";
const dispatchImplPath = "src/cli/dispatch.ts";
const exportName = "runJsonReview";

type RunJsonReview = (argv: readonly string[]) => Promise<unknown>;

function isRunJsonReview(value: unknown): value is RunJsonReview {
  return typeof value === "function";
}

async function loadRunJsonReview(): Promise<RunJsonReview> {
  const exported = await expectNotImplementedExport(dispatchModule, dispatchImplPath, exportName);
  if (!isRunJsonReview(exported)) {
    expect.fail(`RED: ${dispatchImplPath} must export ${exportName}(argv: readonly string[])`);
  }
  return exported;
}

interface CapturedStdout {
  readonly combined: string;
  readonly callCount: number;
}

function captureStdout(fn: () => Promise<unknown>): Promise<CapturedStdout> {
  return new Promise((resolve, reject) => {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let combined = "";
    let callCount = 0;
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(((chunk: string | Uint8Array): boolean => {
        callCount += 1;
        combined += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
        return true;
      }) as typeof process.stdout.write);

    fn()
      .then(() => {
        spy.mockRestore();
        process.stdout.write = originalWrite;
        resolve({ combined, callCount });
      })
      .catch((err) => {
        spy.mockRestore();
        process.stdout.write = originalWrite;
        reject(err);
      });
  });
}

describe("CLI --json envelope RED contract", () => {
  it("CLI-JSON-001: --dry-run writes exactly one parseable JSON object to stdout", async () => {
    // Given: the future dispatch.ts must export runJsonReview(argv).
    let runJsonReview: RunJsonReview;
    try {
      runJsonReview = await loadRunJsonReview();
    } catch (error) {
      if (error instanceof RedModuleMissingError) {
        expect.fail(
          `RED: ${dispatchImplPath} must exist and export ${exportName}(argv). ${error.message}`,
        );
      }
      throw error;
    }

    // When: runJsonReview(['--dry-run']) is invoked and stdout is captured.
    const captured = await captureStdout(() => runJsonReview(["--dry-run"]));

    // Then: stdout contains exactly one JSON write and the combined bytes parse cleanly.
    expect(captured.callCount).toBe(1);
    expect(() => JSON.parse(captured.combined)).not.toThrow();
  });

  it("CLI-JSON-002: parsed envelope has schemaVersion:1, command:'review', exitCode, resolvedConfig, outcome", async () => {
    const runJsonReview = await loadRunJsonReview();

    const captured = await captureStdout(() => runJsonReview(["--dry-run"]));
    const parsed: unknown = JSON.parse(captured.combined);

    expect(typeof parsed).toBe("object");
    expect(parsed).not.toBeNull();
    const envelope = parsed as Record<string, unknown>;

    expect(envelope["schemaVersion"]).toBe(1);
    expect(envelope["command"]).toBe("review");
    expect(typeof envelope["exitCode"]).toBe("number");
    expect(envelope["exitCode"] === 0 || envelope["exitCode"] === 2).toBe(true);
    expect(typeof envelope["resolvedConfig"]).toBe("object");
    expect(envelope["resolvedConfig"]).not.toBeNull();
    expect(envelope["resolvedConfig"]).not.toBeNull();
    expect(typeof envelope["outcome"]).toBe("object");
    expect(envelope["outcome"]).not.toBeNull();
  });

  it("CLI-JSON-003: --json output does not leak UMACTUALLY_API_KEY / Sonar token / inline-prompt content", async () => {
    // Given: fixtures seeded into process.env and inline prompt content.
    const apiKeyFixture = "sk-fixture-secret-JSON-003";
    const sonarTokenFixture = "sonar-fixture-secret-JSON-003";
    const inlinePromptFixture = "INLINE-PROMPT-SECRET-JSON-003-do-not-leak";

    const savedApiKey = process.env["UMACTUALLY_API_KEY"];
    const savedSonarToken = process.env["UMACTUALLY_SONAR_TOKEN"];
    process.env["UMACTUALLY_API_KEY"] = apiKeyFixture;
    process.env["UMACTUALLY_SONAR_TOKEN"] = sonarTokenFixture;

    const runJsonReview = await loadRunJsonReview();

    try {
      const captured = await captureStdout(() =>
        runJsonReview(["--dry-run", "--prompt", inlinePromptFixture]),
      );

      // Then: none of the seeded secrets appear anywhere on stdout.
      expect(captured.combined).not.toContain(apiKeyFixture);
      expect(captured.combined).not.toContain(sonarTokenFixture);
      expect(captured.combined).not.toContain(inlinePromptFixture);

      // And: the envelope still parses cleanly.
      expect(() => JSON.parse(captured.combined)).not.toThrow();
    } finally {
      if (savedApiKey === undefined) {
        delete process.env["UMACTUALLY_API_KEY"];
      } else {
        process.env["UMACTUALLY_API_KEY"] = savedApiKey;
      }
      if (savedSonarToken === undefined) {
        delete process.env["UMACTUALLY_SONAR_TOKEN"];
      } else {
        process.env["UMACTUALLY_SONAR_TOKEN"] = savedSonarToken;
      }
    }
  });

  it("CLI-JSON-004: ['--json','review','--dry-run'] and ['review','--json','--dry-run'] both produce the same envelope shape", async () => {
    const runJsonReview = await loadRunJsonReview();

    const before = await captureStdout(() =>
      runJsonReview(["--json", "review", "--dry-run"]),
    );
    const after = await captureStdout(() =>
      runJsonReview(["review", "--json", "--dry-run"]),
    );

    expect(before.callCount).toBe(1);
    expect(after.callCount).toBe(1);

    const beforeParsed = JSON.parse(before.combined) as Record<string, unknown>;
    const afterParsed = JSON.parse(after.combined) as Record<string, unknown>;

    expect(afterParsed["schemaVersion"]).toBe(beforeParsed["schemaVersion"]);
    expect(afterParsed["command"]).toBe(beforeParsed["command"]);
    expect(afterParsed["exitCode"]).toBe(beforeParsed["exitCode"]);
    expect(typeof afterParsed["resolvedConfig"]).toBe(typeof beforeParsed["resolvedConfig"]);
    expect(typeof afterParsed["outcome"]).toBe(typeof beforeParsed["outcome"]);
  });
});
