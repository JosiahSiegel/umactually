# umactually exit codes

`umactually` exits with a small, stable set of codes that every operator script (CI workflow, ADO pipeline step, smoke-test wrapper) can branch on. The table below is the canonical reference — the wrapper shim (`bin/umactually.mjs`) and the bundled CLI (`src/cli.ts:runCli`) are the two emission points, and they each map to exactly one row. Code 0 is the only "everything worked" signal; everything else is a fault with a specific remediation the operator should follow.

| Code | Meaning | When |
| --- | --- | --- |
| 0 | success | normal completion (also: `--help`, `--version`, bare-invocation quickstart on TTY) |
| 1 | runtime error | Node version guard, standalone-mode provider failure, unexpected internal error, `LiveReviewError`, invalid artifact, uninstall check failure, corrupt `--show-config` file |
| 2 | validation error | required flags missing (or `CliUsageError` from parse-time), unknown subcommand, non-interactive `--purge-config`/`--revert-path` without `--yes` |
| 127 | missing bundle | `dist/cli.js` not built (run `npm run bundle`) |

## Wiring CI around exit codes

Exit codes are emitted via `process.exit(code)` from `bin/umactually.mjs` and from `src/cli.ts:runCli`. Script against them in your CI by checking the process exit code. The bundled-CLI quickstart is in [`README.md`](../README.md#usage); the broader parse-fail and auto-artifact-validation behavior is in [`docs/troubleshooting.md`](troubleshooting.md).

### `umactually init` exit codes

| Outcome | Exit |
|---|---|
| Interactive success / clean abort (Ctrl-C, Ctrl-D, `n` to overwrite) | 0 |
| `--non-interactive` success | 0 |
| Missing required flags | 2 |
| Permission error / invalid `~/.umactually/` / no-clobber collision / concurrency lock | 1 |
| Unknown flag | 2 |
| Global 60s timeout | 2 |

### `umactually doctor` exit codes

| Outcome | Exit |
|---|---|
| All checks passed | 0 |
| One or more checks failed or warned | 1 |
| Usage error (unknown flag, missing arg) | 2 |

### `umactually check-review-artifact` exit codes

| Outcome | Exit |
|---|---|
| Artifact is valid | 0 |
| Artifact is invalid, unparseable, or carrys a parse-fail sentinel | 1 |
| Usage error (no path given, or too many positional args) | 2 |

### `umactually uninstall` exit codes

| Outcome | Exit |
|---|---|
| Successful binary removal (and follow-up destructive actions, when requested) | 0 |
| One or more checks failed | 1 |
| Usage error / `--purge-config` or `--revert-path` in non-interactive mode without `--yes` (or `UMACTUALLY_UNINSTALL_YES=1`) | 2 |

### `umactually --show-config` exit codes

| Outcome | Exit |
|---|---|
| Saved config exists and is valid; printed to stdout | 0 |
| No saved config exists; hint to run `umactually init` printed | 0 |
| Saved config exists but is corrupt; stderr warning emitted | 1 |

### `umactually review` exit codes

| Outcome | Exit |
|---|---|
| Review completed and (live) posted or (standalone) written to `./umactually-review.json` | 0 |
| Provider, parse, or network failure during the live review (a parse-fail sentinel is written, no threads posted) | 1 |
| Required flag missing (e.g. `--api-url` for `--provider openai-compatible` with no env), unknown flag, or `CliUsageError` from parse-time | 2 |
| `dist/cli.js` not built (run `npm run bundle`) | 127 |
