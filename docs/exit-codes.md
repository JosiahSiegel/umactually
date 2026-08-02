# umactually exit codes

`umactually` exits with a small, stable set of codes that every operator script (CI workflow, ADO pipeline step, smoke-test wrapper) can branch on. The table below is the canonical reference — the wrapper shim (`bin/umactually.mjs`) and the bundled CLI (`src/cli.ts:runCli`) are the two emission points, and they each map to exactly one row. Code 0 is the only "everything worked" signal; everything else is a fault with a specific remediation the operator should follow.

| Code | Meaning | When |
| --- | --- | --- |
| 0 | success | normal completion |
| 1 | runtime error | Node version guard, standalone-mode provider failure, or unexpected internal error |
| 2 | usage error | parse-time `CliUsageError` (unknown flag, missing flag value) or validation-time error other than auth-required |
| 3 | parse-fail | the live review produced an artifact that `classifyReviewArtifact` rejected as invalid (parse-fail sentinel, contradictory verdict=NEEDS_FIX with 0 findings, empty artifact, or `parseFailed: true` flag) — see `src/cli/run.ts:validateLiveArtifact` |
| 4 | auth-required | the operator passed review flags but no `--api-key` / `UMACTUALLY_API_KEY` (and no `--api-url` / `UMACTUALLY_API_URL` for non-Copilot, non-Anthropic providers) was supplied and the `init` config did not provide them either |
| 127 | missing bundle | `dist/cli.js` not built (run `npm run bundle`) |

> **M7 addendum**: codes 3 and 4 are additive (added by the upcoming release). Codes 0/1/2/127 are byte-identical to v0.6.22 — no operator workflow keyed on those codes will break. The `cli: --api-key is required` legacy stderr line is still emitted on exit 4 so external CI scrapers keep working.

## Wiring CI around exit codes

Exit codes are emitted via `process.exit(code)` from `bin/umactually.mjs` and from `src/cli.ts:runCli`. Script against them in your CI by checking the process exit code. The bundled-CLI quickstart is in [`README.md`](../README.md#usage); the broader parse-fail and auto-artifact-validation behavior is in [`docs/troubleshooting.md`](troubleshooting.md).
