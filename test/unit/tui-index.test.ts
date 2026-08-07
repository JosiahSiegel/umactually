// test/unit/tui-index.test.ts — unit tests for src/cli/tui/index.ts.
//
// Covers the `runTui` wrapper: it dispatches to the correct flow based
// on `HubFlowKind`, calls `intro` before the hub loop, and calls
// `outro` after the hub returns. The hub itself is mocked at the
// module boundary so the test stays focused on the wrapper.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
}));

vi.mock("../../src/cli/tui/flows/config.js", () => ({
  runConfigFlow: vi.fn(async () => ({ exitCode: 0 })),
}));
vi.mock("../../src/cli/tui/flows/debug.js", () => ({
  runDebugFlow: vi.fn(async () => ({ exitCode: 0 })),
}));
vi.mock("../../src/cli/tui/flows/review.js", () => ({
  runReviewFlow: vi.fn(async () => ({ exitCode: 0 })),
}));

vi.mock("../../src/cli/tui/hub.js", () => ({
  runHub: vi.fn(),
}));

import { intro, outro } from "@clack/prompts";
import { runHub } from "../../src/cli/tui/hub.js";
import { runConfigFlow } from "../../src/cli/tui/flows/config.js";
import { runDebugFlow } from "../../src/cli/tui/flows/debug.js";
import { runReviewFlow } from "../../src/cli/tui/flows/review.js";

import { runTui } from "../../src/cli/tui/index.js";

const MOCKED_INTRO = vi.mocked(intro);
const MOCKED_OUTRO = vi.mocked(outro);
const MOCKED_RUN_HUB = vi.mocked(runHub);
const MOCKED_RUN_CONFIG = vi.mocked(runConfigFlow);
const MOCKED_RUN_DEBUG = vi.mocked(runDebugFlow);
const MOCKED_RUN_REVIEW = vi.mocked(runReviewFlow);

describe("tui entry point (runTui)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints intro before the hub runs", async () => {
    MOCKED_RUN_HUB.mockImplementationOnce(async (opts) => {
      await opts.runFlow("review");
      return { exitCode: 0 };
    });
    await runTui([]);
    expect(MOCKED_INTRO).toHaveBeenCalledWith("umactually tui");
  });

  it("prints outro after the hub returns", async () => {
    MOCKED_RUN_HUB.mockResolvedValueOnce({ exitCode: 0 });
    await runTui([]);
    expect(MOCKED_OUTRO).toHaveBeenCalledWith("Done.");
  });

  it("dispatches the review flow when the hub selects it", async () => {
    MOCKED_RUN_HUB.mockImplementationOnce(async (opts) => {
      await opts.runFlow("review");
      return { exitCode: 0 };
    });
    await runTui([]);
    expect(MOCKED_RUN_REVIEW).toHaveBeenCalledTimes(1);
  });

  it("dispatches the config flow when the hub selects it", async () => {
    MOCKED_RUN_HUB.mockImplementationOnce(async (opts) => {
      await opts.runFlow("config");
      return { exitCode: 0 };
    });
    await runTui([]);
    expect(MOCKED_RUN_CONFIG).toHaveBeenCalledTimes(1);
  });

  it("dispatches the debug flow when the hub selects it", async () => {
    MOCKED_RUN_HUB.mockImplementationOnce(async (opts) => {
      await opts.runFlow("debug");
      return { exitCode: 0 };
    });
    await runTui([]);
    expect(MOCKED_RUN_DEBUG).toHaveBeenCalledTimes(1);
  });

  it("propagates the hub's exitCode to the caller", async () => {
    MOCKED_RUN_HUB.mockResolvedValueOnce({ exitCode: 7 });
    const result = await runTui([]);
    expect(result).toEqual({ exitCode: 7 });
  });
});
