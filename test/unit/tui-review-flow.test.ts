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

const setAnswers = (answers: readonly [string | symbol, ...(string | symbol)[]]): void => {
  let index = 0;
  const fallback = answers[0];
  const nextAnswer = (): string | symbol => answers[index++] ?? fallback;
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
    setAnswers(["copilot", "model-x", "diff", "menu"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "provider-error", exitCode: 1, message: "failed", sanitizedForLog: "failed" });
    await runReviewFlow();
    expect(stream.error).toHaveBeenCalledWith("failed");
  });

  it("D: returns successfully when cancelled mid-flow", async () => {
    setAnswers(["cancelled"]);
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
    setAnswers(["copilot", "model-x", "secret", "diff", "retry", "copilot", "model-y", "secret-2", "diff", "menu"]);
    vi.mocked(runStandalone).mockResolvedValue({ kind: "provider-error", exitCode: 1, message: "failed", sanitizedForLog: "failed" });
    await runReviewFlow();
    expect(select).toHaveBeenCalledTimes(6);
  });
});
