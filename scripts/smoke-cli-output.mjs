// F3 final-verification smoke runner for the cli-output-fixes plan.
// Imports the live help.ts renderer and dumps five help surfaces to stdout
// so we can visually confirm that the column widths computed by
// renderCommandLine / renderFlagLine produce a single aligned column across
// every row in the Commands banner, the Review flags / Global flags tables,
// and the bare-invocation quickstart banners.
//
// Usage (from worktree root):
//   npx tsx scripts/smoke-cli-output.mjs                   > .omo/smoke-help-output.txt
//   npx tsx scripts/smoke-cli-output.mjs --review          > .omo/smoke-review-help.txt
//   npx tsx scripts/smoke-cli-output.mjs --doctor          > .omo/smoke-doctor-help.txt
//   npx tsx scripts/smoke-cli-output.mjs --first-run       > .omo/smoke-first-run.txt
//   npx tsx scripts/smoke-cli-output.mjs --loaded-config  > .omo/smoke-loaded-config.txt
//
// The .mjs extension is intentional — the runtime is TypeScript via tsx,
// and the .ts imports are resolved by tsx's loader, not by Node's ESM.

import { resolveHelpText } from "../src/cli/help.ts";
import { BRAND_PREFIX } from "../src/util/brand.ts";
import {
  FIRST_RUN_QUICKSTART,
  renderLoadedConfigQuickstart,
} from "../src/cli/dispatch.ts";

const args = process.argv;
const mode = args.includes("--review")
  ? "review"
  : args.includes("--doctor")
    ? "doctor"
    : args.includes("--first-run")
      ? "first-run"
      : args.includes("--loaded-config")
        ? "loaded-config"
        : "top";

let out;
if (mode === "review") {
  out = resolveHelpText(["review", "--help"]);
} else if (mode === "doctor") {
  out = resolveHelpText(["doctor", "--help"]);
} else if (mode === "first-run") {
  out = `${BRAND_PREFIX}${FIRST_RUN_QUICKSTART}`;
} else if (mode === "loaded-config") {
  const syntheticConfig = {
    schemaVersion: 1,
    provider: "openai-compatible",
    apiUrl: "https://api.example.com/v1",
    model: "gpt-test",
  };
  // The header line echoes the synthetic path so the smoke artifact is
  // self-describing in the F3 evidence trail.
  out =
    `path: /tmp/cfg.json\n` +
    `${BRAND_PREFIX}${renderLoadedConfigQuickstart(syntheticConfig)}`;
} else {
  out = resolveHelpText([]);
}

process.stdout.write(out);