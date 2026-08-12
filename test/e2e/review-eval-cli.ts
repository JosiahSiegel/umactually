/**
 * CLI entry point for the hermetic review-eval gate.
 *
 * Parses argv, runs the gate, writes the JSON report + human summary,
 * and returns a process exit code. This module is the canonical entry
 * point shared by npm, CI, release, and prepublish scripts.
 */
import { pathToFileURL } from "node:url";
import { runHermeticGate } from "./review-eval-runner.js";

type ParsedArgs = {
  readonly output?: string;
  readonly summary?: string;
  readonly validateSnapshot: readonly string[];
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  let output: string | undefined;
  let summary: string | undefined;
  const validateSnapshot: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output" || arg === "-o") {
      const next = argv[++i];
      if (next === undefined) throw new Error("--output requires a path");
      output = next;
    } else if (arg === "--summary" || arg === "-s") {
      const next = argv[++i];
      if (next === undefined) throw new Error("--summary requires a path");
      summary = next;
    } else if (arg === "--validate-snapshot") {
      const next = argv[++i];
      if (next === undefined) throw new Error("--validate-snapshot requires a path");
      validateSnapshot.push(next);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: node scripts/run-review-eval.mjs [--output <path>] [--summary <path>] [--validate-snapshot <path> ...]\n",
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return {
    ...(output !== undefined ? { output } : {}),
    ...(summary !== undefined ? { summary } : {}),
    validateSnapshot,
  };
}

/**
 * Run the gate and return the process exit code. Pure: no side effects
 * beyond stdout/stderr writes + filesystem writes to the explicit
 * `--output` / `--summary` paths.
 */
export async function runCli(argv: readonly string[]): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  const opts: Parameters<typeof runHermeticGate>[0] = {
    ...(args.output !== undefined ? { outputJson: args.output } : {}),
    ...(args.summary !== undefined ? { outputSummary: args.summary } : {}),
    ...(args.validateSnapshot.length > 0 ? { extraSnapshots: args.validateSnapshot } : {}),
  };

  let result;
  try {
    result = await runHermeticGate(opts);
  } catch (error) {
    process.stderr.write(`review-eval gate crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    return 1;
  }

  process.stdout.write(result.humanSummary);
  if (args.output !== undefined) {
    process.stdout.write(`wrote JSON report to ${args.output}\n`);
  }
  if (args.summary !== undefined) {
    process.stdout.write(`wrote human summary to ${args.summary}\n`);
  }
  return result.report.passed ? 0 : 1;
}

const isDirectInvocation = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isDirectInvocation) {
  runCli(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (error) => {
      process.stderr.write(`review-eval runner crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}
