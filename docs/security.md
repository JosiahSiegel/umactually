# Security model

UmActually is designed to operate on PR diffs that may include third-party contributions. This page documents the guarantees the runtime makes and the guardrails reviewers must follow when extending it.

## Redaction

The action redacts high-confidence secret patterns from PR diffs before they are submitted to the review provider and before any artifact is written. The patterns include:

- Stripe-style test keys: `\bsk_test_[a-z_]+\b`
- AWS access key IDs: `\b(?:AKIA|ASIA)[A-Z0-9]{16}\b`
- GitHub personal access tokens: `\bghp_[A-Za-z0-9]{36}\b`

Redaction is applied only to lines that begin with `+` and that are not the `+++` file header. Lines removed in the diff are ignored, so a secret that is being deleted does not get redacted from history that is already gone.

The literal replacement token used during redaction is `[REDACTED_SECRET]`. Anything left in the diff after redaction is the user's responsibility; expand the patterns only with a written justification and a regression test.

## Leak detection

After redaction, the action re-scans the diff and reports `highConfidenceLeakCount`. Raw output that contains any unreplaced high-confidence secret is blocked. A redaction report is written to `artifacts/manual/s5-redaction-report.json`.

If `highConfidenceLeakCount` is non-zero, treat the run as a security incident: the source PR introduced a credential into a diff. Page the security on-call, rotate the leaked credential, and confirm the PR is not merged.

## ignore-minor cannot hide leaks or security findings

`ignore-minor` (default `true`) suppresses only minor non-security findings. It does **not** suppress:

- High-confidence leaks detected during redaction.
- Security findings emitted by the review provider.
- Findings marked as `severity: high` or `severity: critical` by the runtime.

If you need a quieter review output, lower the noise on the model side first. Treat `ignore-minor: false` as a higher-noise mode, not a less-secure mode.

## Prompt file path safety

`prompt-file` (or `UMACTUALLY_PROMPT_FILE`) is loaded from disk and concatenated into the review request. The runtime refuses the following inputs:

- Absolute paths.
- Paths containing `..` segments.
- Symlinks that resolve outside the repository root.
- Paths outside the configured allowed directories.

Repository-relative paths only. The runtime resolves the file against the workflow `working-directory`, not against `process.cwd()` or `/tmp`. If you need additional prompt sources, extend the allow-list explicitly and add a regression test for each new path.

## Secrets handling

Secrets must come from a secret store and reach the action through environment variables or platform-provided secrets. They must never be hard-coded in workflow YAML, action inputs, or step arguments.

UmActually does not intentionally log, echo, or print secrets. In particular:

- `core.setSecret` is applied to API keys before any logging statement runs.
- The CLI suppresses provider responses that echo back the request body.
- Artifact uploads never include the prompt file's raw contents when it contains a known secret pattern.

When investigating a leak, the first place to look is the workflow log for `printenv`, `Set-*` debug steps, or user-supplied `run:` blocks that print secrets. The action itself is not the source.

## Trust boundaries

The action treats the following inputs as untrusted:

- Pull request title, body, and comments.
- Diff lines.
- `prompt-file` contents (if the file path passes the path safety checks).
- Anything in the event JSON except the small allow-list (PR number, repository name, head SHA).

The action treats the following inputs as trusted:

- Secrets passed through `env:`.
- The repository checkout used by the workflow.
- `GITHUB_TOKEN` (or `SYSTEM_ACCESSTOKEN` on Azure DevOps).

Never expose trusted inputs to untrusted strings. In particular, do not interpolate `secrets.*` into a script body that is later written to disk.

## Least-privilege GitHub permissions

The action requires `contents: read` and `pull-requests: write`. Grant exactly those scopes:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Do not use `pull_request_target` for this action; it is not required to comment on a PR and it can expose secrets to untrusted PR code.

## Reporting issues

If you find a security issue in UmActually, open a private security advisory on the repository rather than a public issue. Include the input or fixture that triggered the issue, the version, and a minimal reproduction.