// src/cli/tui/index.ts — entry point for the `umactually tui` subcommand.
// Dispatch wiring lives in src/cli/dispatch.ts (`runTuiBranch`); this file
// just hosts the hub-level flow dispatch + clack intro/outro.
import * as p from "@clack/prompts";

import { runConfigFlow } from "./flows/config.js";
import { runDebugFlow } from "./flows/debug.js";
import { runReviewFlow } from "./flows/review.js";
import { runHub, type FlowResult, type HubFlowKind } from "./hub.js";

export type TuiExit = { exitCode: number };

export async function runTui(_argv: readonly string[]): Promise<TuiExit> {
  p.intro("umactually tui");
  const result: FlowResult = await runHub({
    runFlow: async (kind: HubFlowKind): Promise<FlowResult> => {
      switch (kind) {
        case "review":
          return runReviewFlow();
        case "config":
          return runConfigFlow();
        case "debug":
          return runDebugFlow();
      }
    },
  });
  p.outro("Done.");
  return result;
}