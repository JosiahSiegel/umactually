// F3 final-verification smoke runner for Wave 1 of the cli-output-fixes plan.
// Imports the live help.ts renderer and dumps three help surfaces to stdout
// so we can visually confirm that the column widths computed by
// renderCommandLine / renderFlagLine produce a single aligned column across
// every row in the Commands banner and the Review flags / Global flags tables.
//
// Usage (from worktree root):
//   npx tsx scripts/smoke-cli-output.mjs                   > .omo/smoke-help-output.txt
//   npx tsx scripts/smoke-cli-output.mjs --review          > .omo/smoke-review-help.txt
//   npx tsx scripts/smoke-cli-output.mjs --doctor          > .omo/smoke-doctor-help.txt
//
// The .mjs extension is intentional — the runtime is TypeScript via tsx,
// and the .ts imports are resolved by tsx's loader, not by Node's ESM.

import { CLI_HELP_TEXT, resolveHelpText } from "../src/cli/help.ts";

const mode = process.argv.includes("--review")
  ? "review"
  : process.argv.includes("--doctor")
    ? "doctor"
    : "top";

const out =
  mode === "review"
    ? resolveHelpText(["review", "--help"])
    : mode === "doctor"
      ? resolveHelpText(["doctor", "--help"])
      : CLI_HELP_TEXT;

process.stdout.write(out);
