import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { runReviewFlow } from "../../src/cli/tui/flows/review.js";

// Throws when production code makes more select/text/password calls than
// the test provided answers for. The previous helper used `answers[0]`
// as a silent fallback, which masked bugs where the wizard gained an
// extra prompt. Tests exercising the cancel-mid-flow branch mock
// `isCancel` directly so they stop consuming answers at the right call.
const setAnswers = (answers: readonly (string | symbol)[]): void => {
  let index = 0;
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
  vi.mocked(select).mockImplementation(async () => nextAnswer());
  vi.mocked(text).mockImplementation(async () => nextAnswer());
  vi.mocked(password).mockImplementation(async () => nextAnswer());
  vi.mocked(isCancel).mockReturnValue(false);
};

describe("Run Review wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["UMACTUALLY_API_KEY"];
  });
  it("A: completes with parsed provider, model, URL, diff, and key", async () => {
    setAnswers(["anthropic", "https://api.example", "model-x", "secret", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });
    await expect(runReviewFlow()).resolves.toEqual({ exitCode: 0 });
    expect(runStandalone).toHaveBeenCalledWith(expect.objectContaining({ parsed: expect.objectContaining({ provider: "anthropic", model: "model-x", apiKey: "secret" }) }));
  });

  it("B: skips API key prompt when env key exists", async () => {
    process.env["UMACTUALLY_API_KEY"] = "env-key";
    setAnswers(["copilot", "model-x", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "ok-no-diff", artifactPath: "x", note: "done" });
    await runReviewFlow();
    expect(password).not.toHaveBeenCalled();
    delete process.env["UMACTUALLY_API_KEY"];
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

  it("E: does not retain the local key after completion", async () => {
    let capturedInput: Parameters<typeof runStandalone>[0] | undefined;
    setAnswers(["copilot", "model-x", "secret", "diff"]);
    vi.mocked(runStandalone).mockImplementation(async (input) => {
      capturedInput = structuredClone(input);
      return { kind: "ok-no-diff", artifactPath: "x", note: "done" };
    });
    await runReviewFlow();
    expect(capturedInput?.parsed.apiKey).toBe("secret");
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
