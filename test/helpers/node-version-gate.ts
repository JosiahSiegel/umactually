// SPDX-License-Identifier: MIT
// Node 24+ capability gate.
//
// Several umactually scripts (release-targets.ts in particular) rely on
// Node 24+ for transparent `.ts` import (no transpile step). When this
// test suite runs on a host with Node < 24, the .ts imports fail at
// module-load time with `ERR_UNKNOWN_FILE_EXTENSION`, taking down every
// test in the file before any assertion runs.
//
// CI runs on Node 24 (per `engines.node` in package.json). Local
// sandboxes that pin to an older Node need to opt out with
// `ALLOW_NODE_22_SMOKE=1` (or upgrade Node, which is the long-term
// fix).
//
// Usage:
//   import { NODE_24_REQUIRED, NODE_24_SKIP_REASON } from "./node-version-gate.ts";
//   describe.skipIf(NODE_24_REQUIRED)("...", () => { ... });

const HOST_NODE_MAJOR = Number.parseInt(
  process.versions.node.replace(/^v/u, "").split(".")[0] ?? "",
  10,
);

export const NODE_24_REQUIRED =
  Number.isFinite(HOST_NODE_MAJOR) &&
  HOST_NODE_MAJOR < 24 &&
  process.env["ALLOW_NODE_22_SMOKE"] !== "1";

export const NODE_24_SKIP_REASON = `host Node ${process.versions.node} < 24; these tests require Node 24+ for transparent .ts import (see scripts/release-targets.ts). Set ALLOW_NODE_22_SMOKE=1 to override.`;

if (NODE_24_REQUIRED) {
  // eslint-disable-next-line no-console
  console.warn(NODE_24_SKIP_REASON);
}
