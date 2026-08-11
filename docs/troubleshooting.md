# Troubleshooting

Operator-side answers for the failure modes documented across [`README.md`](../README.md), [`docs/configuration.md`](configuration.md), [`docs/azure-devops.md`](azure-devops.md), and [`docs/gh-actions.md`](gh-actions.md). Every section below is intentionally platform-agnostic so both GH Actions and Azure Pipelines maintainers can share the same runbook. For architecture, privacy, rollback, and deferred scope see [`docs/architecture.md`](architecture.md); for private vulnerability reporting see [`SECURITY.md`](../SECURITY.md).

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

## Release download failed

The installer one-liner (`curl -fsSL .../scripts/install.sh | sh` / `irm .../scripts/install.ps1 | iex`) downloads a `.tar.gz` (Linux/macOS) or `.zip` (Windows) archive from the GitHub Release page, verifies its SHA-256 against `checksums.txt`, and extracts the single member to your PATH. When that path fails end-to-end, work the recovery ladder in order:

1. **Network / DNS / proxy failure.** The installer surfaces the HTTP status (e.g. `could not download archive: HTTP 503`). Re-run once; if it persists, check `https://github.com/JosiahSiegel/umactually/releases` in a browser to confirm GitHub's status. A corporate proxy may need `HTTPS_PROXY` / `NO_PROXY` exported in the same shell — the installer honors both.
2. **Release not found for this tag.** The installer only fetches immutable tag URLs (`https://github.com/JosiahSiegel/umactually/releases/download/<tag>/...`); it never falls back to `/releases/latest/`. Confirm the tag exists at the releases page; an unreleased branch build will not have archives. Pin the install to a specific tag, not the implicit latest.
3. **`checksums.txt` mismatch.** The installer downloads `checksums.txt` first, computes the archive's SHA-256, and refuses to extract on any mismatch. Re-running with the same tag after the maintainer has published a corrected release is the only fix. The archive contract is the only supported download entry point; there is no supported bypass for a checksum mismatch.
4. **Archive corruption mid-download.** The installer detects a partial download (size mismatch or `gzip`/`unzip` failure) and refuses to extract. Re-run; if the problem persists, download the archive manually via the browser, verify its SHA-256 against `checksums.txt` with `sha256sum` (POSIX) / `Get-FileHash` (PowerShell), and report the failure as a release bug if the hashes diverge.
5. **Path / permission denied.** The installer stages inside `INSTALL_DIR` and atomically replaces the destination. A locked destination (Windows file handle held by another process, POSIX immutable bit, ACL revocation) blocks the rename. Close the conflicting process, or set `INSTALL_DIR=/path/you/own` before running the installer.

The post-publish canary in `.github/workflows/release.yml` runs the public installer against the live tag on every release. A canary failure means the path is broken end-to-end for every user; it is treated as a P0 and triggers a follow-up patch release — see [`docs/release-process.md`](release-process.md#recovery).

## When the documentation disagrees with reality

If you hit a behavior the docs don't cover, the source of truth is the runtime — open a PR with `test/unit/<area>.test.ts` pinning the behavior, then update the doc to match. The docs describe what the code does today; the code describes what the code does tomorrow.

Security issues are handled differently — see [`docs/security.md`](security.md#reporting-issues).
