import { CliHelpSignal, CliUsageError, parseCliArgs, type ParsedCliArgs } from "./cli/parse-args.js";
import { printHelp } from "./cli/help.js";
import { dispatchLive, runDryRun, type CliRunResult } from "./cli/run.js";
import { collectValidationErrors, resolvePlatform } from "./cli/validate.js";

declare global {
  // Cross-module flag set by the action entry to suppress this module's
  // auto-invoke when both modules are concatenated into dist/index.js.
  var __umactually_action_entry__: boolean | undefined;
}

export type { CliRunResult } from "./cli/run.js";
export type { ParsedCliArgs, CliPlatform } from "./cli/parse-args.js";
export { parseCliArgs, CliUsageError };

export async function runCli(args: readonly string[], cwd: string): Promise<CliRunResult> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    if (error instanceof CliHelpSignal) {
      printHelp();
      return { exitCode: 0 };
    }
    throw error;
  }

  const errors = collectValidationErrors(parsed);
  if (errors.length > 0) {
    process.stderr.write(`cli: ${errors.join("; ")}\n`);
    return { exitCode: 2 };
  }

  if (parsed.dryRun) {
    return runDryRun(parsed, cwd, resolvePlatform(parsed.platform));
  }

  return dispatchLive(parsed, cwd, process.env);
}

export async function main(argv: readonly string[]): Promise<number> {
  try {
    const result = await runCli(argv, process.cwd());
    return result.exitCode;
  } catch (error) {
    if (error instanceof CliUsageError) {
      process.stderr.write(`cli: ${error.message}\n`);
      return 2;
    }
    if (error instanceof Error) {
      process.stderr.write(`cli: unexpected error: ${error.message}\n`);
    } else {
      process.stderr.write(`cli: unexpected error: ${String(error)}\n`);
    }
    return 1;
  }
}

// Only auto-invoke `main` when this module is the canonical CLI entry
// (`dist/cli.js`). The action entry (`dist/index.js`) bundles this module too,
// so `process.argv[1]` will equal `import.meta.url` for both bundles. We
// differentiate by the script basename: `cli.js` vs anything else.
//
// The action entry sets `globalThis.__umactually_action_entry__` to `true`
// before reaching this module; that flag short-circuits the auto-invoke so the
// action entry's own `src_main()` is the sole runtime, even though both
// modules are concatenated into the same bundle.
const isMainModule = (() => {
  if (typeof process === "undefined") {
    return false;
  }
  if (globalThis.__umactually_action_entry__ === true) {
    return false;
  }
  const argv1 = process.argv[1];
  if (argv1 === undefined) {
    return false;
  }
  if (import.meta.url !== pathToFileUrl(argv1)) {
    return false;
  }
  return /(^|[\\/])cli\.js$/u.test(argv1);
})();

if (isMainModule) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`cli: fatal: ${message}\n`);
      process.exit(1);
    });
}

function pathToFileUrl(value: string): string {
  return new URL(`file://${value.replace(/\\/gu, "/")}`).href;
}