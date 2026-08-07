// src/cli/tui/hub.ts — hub menu for the tui subcommand.
// Takes a `runFlow` injection point so the hub can be tested without real flows.
import { isCancel, log, select } from "@clack/prompts";

export type HubFlowKind = "review" | "config" | "debug";
export type FlowResult = { exitCode: number };

export async function runHub(opts: {
  runFlow: (kind: HubFlowKind) => Promise<FlowResult>;
}): Promise<FlowResult> {
  // The hub is a LOOP — after a flow returns, the hub prompts again.
  // Only `exit` and `isCancel` break the loop.
  //
  // The hub itself does NOT perform TTY gating; that's `runTuiBranch`'s
  // job. The hub assumes TTY is already verified.
  //
  // `isCancel` is the canonical @clack/prompts cancel pattern; the
  // underlying cancel sentinel is an internal implementation detail and
  // not part of the public API — do NOT try/catch it.
  //
  // A flow that throws (rather than returning `{ exitCode: N }`) is
  // caught here so the hub stays open: log the error and re-prompt.
  // Silently swallowing would leave the operator stranded without a
  // reason; `p.log.error` keeps the message visible alongside the menu.
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
    try {
      await opts.runFlow(choice as HubFlowKind);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`Flow crashed: ${message}`);
    }
    // After flow returns (or throws), loop back to the menu.
  }
}
