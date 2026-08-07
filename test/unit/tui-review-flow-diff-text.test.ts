// test/unit/tui-review-flow-diff-text.test.ts — coverage test for the
// Run Review wizard's diffText path (review thread #1).
//
// The previous buildReviewData always passed `diffText: ""`, which
// made selectPostableComments classify every finding as off-diff and
// render zero inline comments. This file lives separately from
// tui-review-flow.test.ts because it mocks `node:child_process` and
// `node:fs/promises` at module top — those mocks would change
// behaviour for the other tests in the shared file (which legitimately
// rely on the real fs / process behaviour under the harness).

import { beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_DIFF =
  "diff --git a/src/foo.ts b/src/foo.ts\n" +
  "index 0000001..1111112 100644\n" +
  "--- a/src/foo.ts\n" +
  "+++ b/src/foo.ts\n" +
  "@@ -1,1 +1,1 @@\n" +
  "-old\n" +
  "+new\n";

const FAKE_ARTIFACT = {
  review: {
    summary: "ok",
    verdict: "COMMENT",
    comments: [{ path: "src/foo.ts", line: 1, severity: "medium", body: "ok" }],
    suppressedComments: [],
  },
};

// Module-scoped stores for the mock fs so writeFile/readFile stay
// consistent across the wizard's two reads of the temp diff file.
const tempDiffContents: Map<string, string> = new Map();

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  isCancel: vi.fn(() => false),
  stream: { message: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../src/cli/load-saved-config.js", () => ({
  tryReadSavedConfig: vi.fn(() => ({ config: null, path: "", warning: null })),
}));

vi.mock("../../src/cli/standalone-run.js", () => ({
  runStandalone: vi.fn(),
  StandaloneRunResult: vi.fn(),
}));

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  const fakeExecFile: typeof actual.execFile = Object.assign(
    ((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: null, out: { stdout: string; stderr: string }) => void;
      cb(null, { stdout: SAMPLE_DIFF, stderr: "" });
      return {} as never;
    }) as unknown as typeof actual.execFile,
    {
      [Symbol.for("nodejs.util.promisify.custom")]: (
        _cmd: string,
        _args: readonly string[],
        _opts: unknown,
      ) => Promise.resolve({ stdout: SAMPLE_DIFF, stderr: "" }),
    },
  );
  return {
    ...actual,
    execFile: fakeExecFile,
  };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    writeFile: async (path: string, data: string) => {
      tempDiffContents.set(String(path), String(data));
    },
    readFile: async (path: string | Buffer | URL) => {
      const p = String(path);
      if (p === "./artifact.json") return JSON.stringify(FAKE_ARTIFACT);
      const fromTemp = tempDiffContents.get(p);
      if (fromTemp !== undefined) return fromTemp;
      throw new Error(`mocked fs/promises readFile: unhandled path ${p}`);
    },
    unlink: async () => undefined,
  };
});

import { isCancel, password, select, text } from "@clack/prompts";
import { runStandalone } from "../../src/cli/standalone-run.js";
import * as liveSharedModule from "../../src/cli/live-shared.js";

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

describe("Run Review wizard — diff text reaches selectPostableComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempDiffContents.clear();
    delete process.env["UMACTUALLY_API_KEY"];
  });

  it("forwards the temp diff file content (not empty string) to selectPostableComments", async () => {
    const selectPostableSpy = vi.spyOn(liveSharedModule, "selectPostableComments");
    setAnswers(["copilot", "model-x", "secret", "diff"]);
    vi.mocked(runStandalone).mockResolvedValue({
      kind: "ok",
      artifactPath: "./artifact.json",
    } as never);

    const { runReviewFlow } = await import("../../src/cli/tui/flows/review.js");
    await runReviewFlow();

    expect(selectPostableSpy).toHaveBeenCalled();
    const lastCall = selectPostableSpy.mock.calls.at(-1);
    expect(lastCall?.[0]?.diffText).toContain("diff --git a/src/foo.ts b/src/foo.ts");
    expect(lastCall?.[0]?.diffText).toContain("@@ -1,1 +1,1 @@");
  });
});
