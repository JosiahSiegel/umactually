# Configuration

UmActually accepts configuration through CLI flags, environment variables, and platform-provided CI variables. Do not put secrets in workflow or pipeline YAML literals; pass them through GitHub Actions secrets, Azure Pipelines secret variables, or a protected variable group.

## Precedence

The runtime resolves configurable review options in this order:

1. Explicit CLI flag.
2. Canonical `UMACTUALLY_*` environment variable.
3. Legacy `REVIEW_*` environment variable.
4. Built-in CLI default.

The CLI natively honors every documented `UMACTUALLY_*` env var. In CI, set them as GitHub Actions env/secrets or Azure pipeline variables and they flow through without shell translation. Boolean env vars accept `true|false|1|0|yes|no|on|off|y|n`, case-insensitively after trimming. Invalid values fail configuration with a redacted error: secret values are never echoed.

With `review --json`, the `resolvedConfig.sources` object reports exactly which surface supplied each resolved field (`flag`, `env`, or `default`, plus the non-secret env name when applicable). Use it to diagnose precedence without exposing credentials.

`GITHUB_TOKEN`, `GITHUB_EVENT_PATH`, `SYSTEM_ACCESSTOKEN`, and Azure build metadata are discovered from the runner environment. `NO_COLOR` is honored at the CLI level: any non-empty value disables decorative color, as does `--no-color`.

## Review options

CLI flag names are the kebab-case form of the option column (for example, `api-url` becomes `--api-url`).

| Option | Env var | Default | Allowed values | Notes |
| --- | --- | --- | --- | --- |
| `api-url` | `UMACTUALLY_API_URL` | `""` | HTTPS URL | Review API base URL. Required for hosted review API use. Prefer env/secret over a literal input. |
| `api-key` | `UMACTUALLY_API_KEY` | `""` | Secret string | Review API key. Must come from a secret store. Never log or echo it. |
| `model` | `UMACTUALLY_MODEL` | `auto` | `auto`, `review-model-synthetic` | `review-model-synthetic` is intended for fixtures and deterministic tests. `auto` resolves to the lower-citation-hallucination model per provider — see the Vectara HHEM-derived table in [`docs/providers.md`](providers.md#model-auto-resolution-on-dual-protocol-gateways). Set a literal model name to override. |
| `effort` | `UMACTUALLY_EFFORT` | `medium` | `low`, `medium`, `high` | Reasoning effort hint. Forwarded as `reasoning.effort` to providers that support it. |
| `provider` | `UMACTUALLY_PROVIDER` | `openai-compatible` | `openai-compatible`, `copilot`, `anthropic` | Provider family. See [`docs/providers.md`](providers.md) for the wire-shape contract per family and the cross-protocol dispatcher that handles dual-protocol gateways. |
| `github-api-base` | `UMACTUALLY_GITHUB_API_BASE` | `""` | HTTPS URL | GitHub API base URL for Copilot token exchange. Set to `https://<tenant>.ghe.com` for GitHub Enterprise Server. |
| `review-timeout-seconds` | `UMACTUALLY_REVIEW_TIMEOUT_SECONDS` | `300` | Positive integer seconds | Overall review wall-clock budget. |
| `stall-seconds` | `UMACTUALLY_STALL_SECONDS` | `270` | Positive integer seconds | Provider-output stall budget. |
| `max-output-tokens` | `UMACTUALLY_MAX_OUTPUT_TOKENS` | `16000` | Positive integer | Provider output budget. |
| `max-comments` | — | `50` | Positive integer | Cap on posted inline comments per review. `0` disables the cap. |
| `review-file-limit` | `REVIEW_FILE_LIMIT` | `200` | Positive integer, or `0` to disable | Soft cap on changed files the live path processes. Above this the CLI skips the live review and posts a "diff too large to review" parent card — chunked LLM reviews on arbitrary initial-import diffs produce hallucinated findings not grounded in the code. Set to `0` to disable. |
| `minimum-severity` | `REVIEW_MINIMUM_SEVERITY` | `medium` | `low`, `medium`, `high` | Minimum severity for inline comments. `security` and `leak` findings **always** survive any threshold — see [`docs/security.md`](security.md#minimum-severity-cannot-hide-leaks-or-security-findings). |
| `prompt` | `UMACTUALLY_PROMPT` | `""` | String | Inline system prompt override. Wins over `prompt-file`. |
| `additional-prompt` | `UMACTUALLY_ADDITIONAL_PROMPT` | `""` | String | Inline additional prompt override. Wins over `additional-prompt-file`. |
| `prompt-file` | `UMACTUALLY_PROMPT_FILE` | `""` | Repository-relative path | Optional prompt instructions file. Absolute paths and `..` traversal are rejected. |
| `prompt-files` | `UMACTUALLY_PROMPT_FILES` | `""` | Comma/newline-separated repo-relative paths | Explicit list of prompt files. **Completely overrides** the default repository prompt lookup (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursorrules`, `GEMINI.md`) when non-empty. |
| `additional-prompt-file` | `UMACTUALLY_ADDITIONAL_PROMPT_FILE` | `""` | Repository-relative path | Optional additional prompt file. Absolute paths and `..` traversal are rejected. |
| `additional-prompt-files` | `UMACTUALLY_ADDITIONAL_PROMPT_FILES` | `""` | Comma/newline-separated repo-relative paths | Explicit list of additional prompt files. **Completely overrides** the default repository prompt lookup when non-empty. |
| `detect-leaks` | `UMACTUALLY_DETECT_LEAKS` | `true` | `true`, `false` | Run secret-leak detection on the diff before posting. |
| `include-sonarqube` | `UMACTUALLY_INCLUDE_SONARQUBE` | `false` | `true`, `false` | Pull SonarQube issues alongside the PR review. Requires `--sonar-host-url`, `--sonar-token`, `--sonar-project-key`. |
| `sonar-host-url` | `UMACTUALLY_SONAR_HOST_URL` | `""` | HTTPS URL | SonarQube base URL. |
| `sonar-token` | `UMACTUALLY_SONAR_TOKEN` | `""` | Secret string | SonarQube token. Must come from a secret store. |
| `sonar-project-key` | `UMACTUALLY_SONAR_PROJECT_KEY` | `""` | Project key string | SonarQube project key. |
| `dry-run` | `UMACTUALLY_DRY_RUN` | `false` | `true`, `false` | Generate review output without posting comments or status. Standalone mode (no CI markers) implicitly behaves as a smoke run that writes `./umactually-review.json` without a real HTTP provider call. |
| `walkthrough` | `UMACTUALLY_WALKTHROUGH` | `false` | `true`, `false` | Emit a separate PR walkthrough comment alongside the review. |
| `diagnostic` | `UMACTUALLY_DIAGNOSTIC` | `false` | `true`, `false` | Inject a synthetic low-severity finding for pipeline smoke tests. |
| `debug-raw-response` | `UMACTUALLY_DEBUG_RAW_RESPONSE` | `false` | `true`, `false` | Echo the raw provider response into the workflow log. |
| `simulate-findings` | `UMACTUALLY_SIMULATE_FINDINGS` | `false` | `true`, `false` | Replaces an empty live result with the deterministic multi-finding fixture from `src/review/simulated-findings.ts`. Live findings always win. |
| `strict-schema` | `UMACTUALLY_STRICT_SCHEMA` | `true` | `true`, `false` | Send `response_format: { type: "json_schema", strict: true }` on the wire. Set to `false` via `--no-strict-schema` for providers that reject the strict-schema payload. |
| `verify-findings` | `UMACTUALLY_VERIFY_FINDINGS` | `true` | `true`, `false` | Deterministic re-verification of every `comments[]` entry against the supplied diff. Paths or lines that don't anchor are dropped. Records what was dropped in `parse-warnings.json`. |
| `platform` | `UMACTUALLY_PLATFORM` | `auto` | `auto`, `github`, `azure` | Platform dispatch hint. `auto` selects GitHub when `GITHUB_ACTIONS=true` and Azure when `TF_BUILD=True`. |

## Removed inputs (migration map)

| Removed input | Env vars | Migrate to |
| --- | --- | --- |
| `ignore-minor: true` | `UMACTUALLY_IGNORE_MINOR`, `REVIEW_IGNORE_MINOR` | `minimum-severity: medium` (the new default) |

The removed `ignore-minor` flag surfaces as a `CliUsageError` with a `--ignore-minor` migration hint. Env vars are silently ignored.

## Platform and token environment variables

| Env var | Platform | Required | Default/source | Purpose |
| --- | --- | --- | --- | --- |
| `GITHUB_TOKEN` | GitHub Actions | Yes for posting reviews | Automatically provided when permissions allow | Authenticates review creation and PR metadata reads. Requires `contents: read` and `pull-requests: write`. |
| `GITHUB_EVENT_PATH` | GitHub Actions | Yes | Automatically provided | Points to the pull request event JSON. |
| `GITHUB_REPOSITORY` | GitHub Actions | Yes | Automatically provided | Owner/repository, e.g. `${{ github.repository }}`. |
| `GITHUB_SHA` | GitHub Actions | Usually | Automatically provided | Current workflow commit SHA, used for diagnostics and request context. |
| `SYSTEM_ACCESSTOKEN` | Azure DevOps | Yes for posting | Map from `$(System.AccessToken)` | Authenticates Azure DevOps REST calls. Enable scripts to access the OAuth token. |
| `SYSTEM_COLLECTIONURI` | Azure DevOps | Yes | Automatically provided | Azure DevOps organization/collection URI. |
| `SYSTEM_TEAMPROJECT` | Azure DevOps | Yes | Automatically provided | Azure DevOps project name. |
| `BUILD_REPOSITORY_ID` | Azure DevOps | Yes | Automatically provided | Repository identifier used for PR REST API calls. |
| `BUILD_REPOSITORY_NAME` | Azure DevOps | Useful | Automatically provided | Human-readable repository name. |
| `SYSTEM_PULLREQUEST_PULLREQUESTID` | Azure DevOps | Yes in PR validation builds | Populated by branch-policy PR validation | Azure PR ID for posting threads and status. |
| `SYSTEM_PULLREQUEST_SOURCEBRANCH` | Azure DevOps | Useful | Populated by PR validation builds | PR source branch. |
| `SYSTEM_PULLREQUEST_TARGETBRANCH` | Azure DevOps | Useful | Populated by PR validation builds | PR target branch. |
| `BUILD_REASON` | Azure DevOps | Diagnostic | Automatically provided | Should be `PullRequest` for PR review posting. `IndividualCI` / `BatchedCI` may leave PR variables empty. |

## Next

- See [`docs/troubleshooting.md`](troubleshooting.md) for parse-fail triage, automatic artifact validation, and concurrency notes.
- See [`docs/providers.md`](providers.md) for the per-family wire shape, the cross-protocol dispatcher, and the `/anthropic` path-prefix heuristic.
- See [`docs/security.md`](security.md) for redaction, leak detection, the `minimum-severity` carve-out for `security` / `leak` findings, prompt-file path safety, and the trust model.
