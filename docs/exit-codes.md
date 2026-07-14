# umactually exit codes

`umactually` exits with a small, stable set of codes that every operator
script (CI workflow, ADO pipeline step, smoke-test wrapper) can branch on. The
table below is the canonical reference — the wrapper shim
(`bin/umactually.mjs`) and the bundled CLI (`src/cli.ts:runCli`) are
the two emission points, and they each map to exactly one row. Code 0 is the
only "everything worked" signal; everything else is a fault with a specific
remediation the operator should follow.

| Code | Meaning | When |
|---|---|---|
| 0 | success | normal completion |
| 1 | runtime error | Node version guard, standalone-mode provider failure, or unexpected internal error |
| 2 | validation error | required flags missing |
| 127 | missing bundle | dist/cli.js not built (run `npm run bundle`) |

## How to grep these from CI

Exit codes are emitted via `process.exit(code)` from `bin/umactually.mjs`
and from `src/cli.ts:runCli`. Script against them in your CI by checking the
process exit code; see the [README](#) for the bundled-CLI quickstart.