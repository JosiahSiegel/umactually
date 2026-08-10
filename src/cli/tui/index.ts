// src/cli/tui/index.ts — entry point for the `umactually tui` subcommand.
// Dispatch wiring lives in src/cli/dispatch.ts (`runTuiBranch`); this file
// just hosts the hub-level flow dispatch + clack intro/outro.
import { intro, outro } from "@clack/prompts";

import { runConfigFlow } from "./flows/config.js";
import { runDebugFlow } from "./flows/debug.js";
import { runReviewFlow } from "./flows/review.js";
import { runHub, type FlowResult, type HubFlowKind } from "./hub.js";

export type TuiExit = { exitCode: number };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- entry-point signature parity
export async function runTui(_argv: readonly string[]): Promise<TuiExit> {
  intro("umactually tui");
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
  outro("Done.");
  return result;
}
