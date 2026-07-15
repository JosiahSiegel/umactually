# Troubleshooting

Operator-side answers for the failure modes documented across [`README.md`](../README.md), [`docs/configuration.md`](configuration.md), [`docs/azure-devops.md`](azure-devops.md), and [`docs/gh-actions.md`](gh-actions.md). Every section below is intentionally platform-agnostic so both GH Actions and Azure Pipelines maintainers can share the same runbook.

## Auto-artifact validation

Every live review writes a review artifact (`./umactually-review.json` standalone, `${TEMP}/review.json` in CI) and validates it automatically. The runtime fails the review invocation without posting if the artifact is:

- missing
- invalid JSON
- carrying a parse-fail sentinel
- explicitly flagged `parseFailed: true`
- contradictory (`verdict: NEEDS_FIX` with zero findings)
- structurally empty (no usable review signal)

If `review --json` is in effect, the same checks are folded into the envelope as `outcome.artifactErrors[]`. The CLI does not surface these to the platform — a failed artifact surfaces as a CLI exit code (1 or 127). See [`docs/exit-codes.md`](exit-codes.md).

Do not add a separate `if: always()` `check-review-artifact` step. The inline check is part of every review invocation. `check-review-artifact` remains available for ad-hoc validation of an existing file.

## Parse-fail triage

A parse-fail diagnostic card is not approval. The provider returned text that does not parse into the review schema, so the CLI surfaces a parse-fail rather than posting fabricated findings.

1. Inspect review logs for provider status, endpoint attribution, and parse warnings. The `::notice::` annotations include the exact URL the dispatcher tried and the protocol (`anthropic-messages` / `openai-compatible`).
2. Confirm provider URL, family, credential, and model compatibility against [`docs/providers.md`](providers.md).
3. If the gateway rejects the wire-format `response_format: json_schema`, set `UMACTUALLY_STRICT_SCHEMA=false` (CLI: `--no-strict-schema`). The in-context system prompt still carries the schema, so behavior degrades to "shape guide only" without losing post-filter verification.
4. Increase output or timeout budgets only when logs show truncation or exhaustion (`UMACTUALLY_MAX_OUTPUT_TOKENS`, `UMACTUALLY_REVIEW_TIMEOUT_SECONDS`, `UMACTUALLY_STALL_SECONDS`).
5. Re-run after correcting configuration. The inline artifact validation will fail the run again if the next attempt still cannot parse.

## Concurrency and duplicate runs

**GitHub Actions** uses a concurrency group keyed on `github.workflow + pull_request.number`, with `cancel-in-progress: true` — overlapping runs are cancelled so the marker-bearing comment cannot race.

**Azure Pipelines** has no direct equivalent to a GitHub Actions concurrency group. The CLI's marker lookup/update is best-effort, so rapid re-runs can race and double-post. Cancel superseded runs when practical; do not rely on the CLI alone to dedupe.

## Forwarding third-party credentials to ADO

ADO does not export `$(System.AccessToken)` under any other name. The action requires the build-service token be mapped explicitly:

```yaml
env:
  SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

A secret `AZURE_DEVOPS_TOKEN` PAT remains an alternative when policy prevents the build-service grant. See [`docs/azure-devops.md`](azure-devops.md#oauth-token-setup).

## Interactive recovery prompts

The CLI asks for missing `--api-url` / `--api-key` instead of failing when **all three** are true:

1. The validation error names only those two fields.
2. The process is attached to a TTY (`process.stdin.isTTY === true`).
3. `UMACTUALLY_NO_INTERACTIVE` is unset.

CI is never asked — the gate is `--no-color` safe, runs with stdin piped, and the dispatcher never asks for credentials it has. To force-off interactive recovery even on a TTY (sandboxed shells, SSH to a tty-allocated session), set `UMACTUALLY_NO_INTERACTIVE=1`. Errors then surface as before.

## Required environment per command surface

| Surface | Required to post review | Token / credential source |
| --- | --- | --- |
| Standalone CLI (`umactually review` from a git working tree) | none — writes `./umactually-review.json` only | n/a |
| GitHub Actions | `GITHUB_TOKEN` mapped from `${{ github.token }}` | the action's `permissions: contents: read, pull-requests: write` |
| Azure Pipelines | `SYSTEM_ACCESSTOKEN` mapped from `$(System.AccessToken)` | pipeline-level "Allow scripts to access the OAuth token" |

Provider credentials (`UMACTUALLY_API_URL`, `UMACTUALLY_API_KEY`) are required for live review on every surface but must always be sourced from the secret store (GitHub Actions secrets, Azure Pipelines secret variables, or a protected variable group). Never put them in workflow YAML literals.

## When the documentation disagrees with reality

If you hit a behavior the docs don't cover, the source of truth is the runtime — open a PR with `test/unit/<area>.test.ts` pinning the behavior, then update the doc to match. The docs describe what the code does today; the code describes what the code does tomorrow.

Security issues are handled differently — see [`docs/security.md`](security.md#reporting-issues).
