import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gitDiff = vi.hoisted(() => vi.fn<() => Promise<{ stdout: string; stderr: string }>>());
vi.mock("node:child_process", () => ({
  execFile: Object.assign(vi.fn(), { [Symbol.for("nodejs.util.promisify.custom")]: gitDiff }),
}));

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  isCancel: vi.fn(() => false),
  stream: { message: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../../src/cli/standalone-run.js", () => ({ runStandalone: vi.fn() }));
vi.mock("../../src/cli/load-saved-config.js", () => ({ tryReadSavedConfig: vi.fn(() => ({ config: null, path: "", warning: null })) }));

import { isCancel, password, select, stream, text } from "@clack/prompts";
import { runStandalone } from "../../src/cli/standalone-run.js";
import { tryReadSavedConfig } from "../../src/cli/load-saved-config.js";
import { resolveProviderCredential } from "../../src/cli/validate.js";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import { runReviewFlow } from "../../src/cli/tui/flows/review.js";

const MOCKED_TRY_READ_SAVED_CONFIG = vi.mocked(tryReadSavedConfig);
let promptSequence: string[] = [];

// Throws when production code makes more select/text/password calls than
// the test provided answers for. The previous helper used `answers[0]`
// as a silent fallback, which masked bugs where the wizard gained an
// extra prompt. Tests exercising the cancel-mid-flow branch mock
// `isCancel` directly so they stop consuming answers at the right call.
const setAnswers = (answers: readonly (string | symbol)[]): void => {
  let index = 0;
  promptSequence = [];
  const nextAnswer = (): string | symbol => {
    const current = answers[index];
    if (current === undefined) {
      throw new Error(
        `setAnswers: production code made more prompt calls than answers provided (consumed ${index}, provided ${answers.length})`,
      );
    }
    index += 1;
    return current;
  };
  vi.mocked(select).mockImplementation(async () => {
    promptSequence.push("select");
    return nextAnswer();
  });
  vi.mocked(text).mockImplementation(async () => {
    promptSequence.push("text");
    return nextAnswer();
  });
  vi.mocked(password).mockImplementation(async () => {
    promptSequence.push("password");
    return nextAnswer();
  });
  vi.mocked(isCancel).mockReturnValue(false);
};

describe.each([
  { state: "empty", stdout: "", diffPath: null },
  {
    state: "nonempty",
    stdout: "diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n",
    diffPath: expect.stringMatching(/^\.\/\.umactually-tui-diff-/u),
  },
])("Run Review wizard ($state git diff)", ({ stdout, diffPath }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    gitDiff.mockResolvedValue({ stdout, stderr: "" });
    promptSequence = [];
    delete process.env["UMACTUALLY_API_KEY"];
    delete process.env["UMACTUALLY_EFFORT"];
    delete process.env["GITHUB_TOKEN"];
    delete process.env["GH_TOKEN"];
  });
  it("A: maps Anthropic answers to provider, URL, model, API key, and diff source", async () => {
    // Given a deterministic git diff, independent of the checkout's changes.
    setAnswers(["anthropic", "https://api.example", "model-x", "secret", "diff"]);
    let consumedDiff: string | undefined;
    vi.mocked(runStandalone).mockImplementation(async ({ parsed }) => {
      consumedDiff = parsed.diffPath === null ? "" : await readFile(parsed.diffPath, "utf8");
      return { kind: "ok-no-diff", artifactPath: "x", note: "done" };
    });

    // When the wizard hands the selected source to standalone.
    await expect(runReviewFlow()).resolves.toEqual({ exitCode: 0 });

    // Then standalone receives the exact diff bytes, or the no-diff path.
    expect(consumedDiff).toBe(stdout);

    const captured = vi.mocked(runStandalone).mock.calls[0]?.[0];
    expect(captured?.parsed).toMatchObject({
      provider: "anthropic",
      apiUrl: "https://api.example",
      model: "model-x",
      effort: null,
      apiKey: "secret",
      files: null,
    });
    expect(captured?.parsed.diffPath).toEqual(diffPath);
    expect(gitDiff).toHaveBeenCalledWith("git", ["diff"], { cwd: process.cwd() });
    expect(captured?.env?.["UMACTUALLY_API_KEY"]).toBe("secret");
    expect(promptSequence).toEqual(["select", "text", "text", "password", "select"]);
  });

  it("B0: maps Copilot answers to provider, saved model, GitHub token, and diff source", async () => {
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: {
        schemaVersion: 1,
        provider: "copilot",
        model: "saved-model",
        effort: "high",
      },
      path: "/saved/config.json",
      warning: null,
    });
    setAnswers(["copilot", "", "secret", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });

    await runReviewFlow();

    const captured = vi.mocked(runStandalone).mock.calls[0]?.[0];
    expect(captured?.parsed).toMatchObject({
      provider: "copilot",
      apiUrl: null,
      model: "saved-model",
      effort: "high",
      apiKey: null,
      githubToken: "secret",
      files: null,
    });
    expect(captured?.env?.["GITHUB_TOKEN"]).toBe("secret");

    expect(promptSequence).toEqual(["select", "text", "password", "select"]);
    expect(vi.mocked(select).mock.calls[0]?.[0]).toMatchObject({ initialValue: "copilot" });
    expect(vi.mocked(text).mock.calls[0]?.[0]).toMatchObject({ initialValue: "saved-model" });
  });

  it("B: uses a Copilot GITHUB_TOKEN alias without prompting for a generic API key", async () => {
    process.env["GH_TOKEN"] = "github-env-token";
    setAnswers(["copilot", "model-x", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });

    await runReviewFlow();

    expect(password).not.toHaveBeenCalled();
    const captured = vi.mocked(runStandalone).mock.calls[0]?.[0];
    expect(captured?.parsed).toMatchObject({
      provider: "copilot",
      apiUrl: null,
      model: "model-x",
      apiKey: null,
      files: null,
    });
    expect(captured?.parsed.diffPath).toEqual(diffPath);
    expect(gitDiff).toHaveBeenCalledWith("git", ["diff"], { cwd: process.cwd() });
    expect(promptSequence).toEqual(["select", "text", "select"]);
    expect(resolveProviderCredential(captured?.parsed ?? { ...parseCliArgs([]), provider: "copilot" }, captured?.env ?? {})).toBe("github-env-token");
  });

  it("B1: prompts for a Copilot token and keeps it separate from API-key credentials", async () => {
    setAnswers(["copilot", "model-x", "prompted-github-token", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });

    await runReviewFlow();

    expect(password).toHaveBeenCalledTimes(1);
    const captured = vi.mocked(runStandalone).mock.calls[0]?.[0];
    expect(captured?.parsed).toMatchObject({
      provider: "copilot",
      apiUrl: null,
      model: "model-x",
      apiKey: null,
      githubToken: "prompted-github-token",
      files: null,
    });
    expect(captured?.parsed.diffPath).toEqual(diffPath);
    expect(gitDiff).toHaveBeenCalledWith("git", ["diff"], { cwd: process.cwd() });
    expect(captured?.env?.["GITHUB_TOKEN"]).toBe("prompted-github-token");
    expect(promptSequence).toEqual(["select", "text", "password", "select"]);
    expect(resolveProviderCredential(captured?.parsed ?? parseCliArgs([]), captured?.env ?? {})).toBe("prompted-github-token");
  });

  it("C: shows provider error and retry/menu choices", async () => {
    // provider, model, apiKey (no env var), diff source, retry/menu
    setAnswers(["copilot", "model-x", "secret", "diff", "menu"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "provider-error", exitCode: 1, message: "failed", sanitizedForLog: "failed" });
    await runReviewFlow();
    expect(stream.error).toHaveBeenCalledWith("failed");
  });

  it("D: returns successfully when cancelled mid-flow", async () => {
    // isCancel short-circuits on the first call so a single placeholder
    // answer is sufficient.
    setAnswers(["copilot"]);
    vi.mocked(isCancel).mockReturnValue(true);
    await expect(runReviewFlow()).resolves.toEqual({ exitCode: 0 });
  });

  it("E: captures a prompted Copilot token separately from the provider API key", async () => {
    let capturedInput: Parameters<typeof runStandalone>[0] | undefined;
    setAnswers(["copilot", "model-x", "secret", "diff"]);
    vi.mocked(runStandalone).mockImplementation(async (input) => {
      capturedInput = structuredClone(input);
      return { kind: "ok-no-diff", artifactPath: "x", note: "done" };
    });

    await runReviewFlow();

    expect(capturedInput?.parsed.apiKey).toBeNull();
    expect(capturedInput?.parsed.githubToken).toBe("secret");
  });

  it("F0: rejects invalid nonblank effort env without falling back to saved effort", async () => {
    process.env["UMACTUALLY_EFFORT"] = "invalid-effort-secret";
    process.env["GITHUB_TOKEN"] = "github-env-token";
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: { schemaVersion: 1, provider: "copilot", model: "saved-model", effort: "high" },
      path: "/saved/config.json",
      warning: null,
    });
    setAnswers(["copilot", "model-x", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });

    await runReviewFlow();

    expect(runStandalone).not.toHaveBeenCalled();
    expect(stream.error).toHaveBeenCalledWith(
      "invalid UMACTUALLY_EFFORT value; expected one of none|minimal|low|medium|high|xhigh|max",
    );
    expect(vi.mocked(stream.error).mock.calls.flat().join(" ")).not.toContain("invalid-effort-secret");
  });

  it("F1: lets a valid effort env override saved effort", async () => {
    process.env["UMACTUALLY_EFFORT"] = "low";
    process.env["GITHUB_TOKEN"] = "github-env-token";
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: { schemaVersion: 1, provider: "copilot", model: "saved-model", effort: "high" },
      path: "/saved/config.json",
      warning: null,
    });
    setAnswers(["copilot", "model-x", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });

    await runReviewFlow();

    expect(vi.mocked(runStandalone).mock.calls[0]?.[0].parsed.effort).toBe("low");
  });

  it("F2: treats a blank effort env as absent and keeps saved effort", async () => {
    process.env["UMACTUALLY_EFFORT"] = "   ";
    process.env["GITHUB_TOKEN"] = "github-env-token";
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: { schemaVersion: 1, provider: "copilot", model: "saved-model", effort: "high" },
      path: "/saved/config.json",
      warning: null,
    });
    setAnswers(["copilot", "model-x", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });

    await runReviewFlow();

    expect(vi.mocked(runStandalone).mock.calls[0]?.[0].parsed.effort).toBe("high");
  });

  it("F: cancel at diff source does not run standalone", async () => {
    setAnswers(["copilot", "model-x", "secret", "cancel"]);
    await runReviewFlow();
    expect(runStandalone).not.toHaveBeenCalled();
  });

  it("G: retry restarts the wizard from provider", async () => {
    // First pass: provider, model, apiKey, diff source → provider-error.
    // Retry path prompts again: provider, model, apiKey, diff source,
    // then the post-error retry/menu select ("menu").
    setAnswers(["copilot", "model-x", "secret", "diff", "retry", "copilot", "model-y", "secret-2", "diff", "menu"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "provider-error", exitCode: 1, message: "failed", sanitizedForLog: "failed" });
    await runReviewFlow();
    expect(select).toHaveBeenCalledTimes(6);
  });
});
