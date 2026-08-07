// src/cli/tui/hub.ts — hub menu for the tui subcommand.
// Shape pinned by todo:8; body filled in by todo:10.
// Takes a `runFlow` injection point so the hub can be tested without real flows.
import { isCancel, select } from "@clack/prompts";

export type HubFlowKind = "review" | "config" | "debug";
export type FlowResult = { exitCode: number };

export async function runHub(opts: {
  runFlow: (kind: HubFlowKind) => Promise<FlowResult>;
}): Promise<FlowResult> {
  // The hub is a LOOP — after a flow returns, the hub prompts again.
  // Only `exit` and `isCancel` break the loop.
  //
  // The hub itself does NOT perform TTY gating; that's `runTuiBranch`'s
  // job (todo:9). The hub assumes TTY is already verified.
  //
  // `isCancel` is the canonical @clack/prompts cancel pattern; the
  // underlying cancel sentinel is an internal implementation detail and
  // not part of the public API — do NOT try/catch it.
  while (true) {
    const choice = await select({
      message: "What would you like to do?",
      options: [
        { value: "review", label: "Run review" },
        { value: "config", label: "View config" },
        { value: "debug", label: "Debug environment" },
        { value: "exit", label: "Exit" },
      ],
    });
    if (isCancel(choice)) {
      return { exitCode: 0 };
    }
    if (choice === "exit") {
      return { exitCode: 0 };
    }
    await opts.runFlow(choice as HubFlowKind);
    // After flow returns, loop back to the menu.
  }
}
