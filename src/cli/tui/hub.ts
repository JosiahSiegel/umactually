// src/cli/tui/hub.ts — hub menu for the tui subcommand.
// Shape pinned by todo:8; body filled in by todo:10.
// Takes a `runFlow` injection point so the hub can be tested without real flows.
export type HubFlowKind = "review" | "config" | "debug";
export type FlowResult = { exitCode: number };

export async function runHub(_opts: {
  runFlow: (kind: HubFlowKind) => Promise<FlowResult>;
}): Promise<FlowResult> {
  throw new Error("runHub: not yet implemented (filled in by todo:10)");
}
