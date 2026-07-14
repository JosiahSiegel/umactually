# Configuration

UmActually accepts configuration from CLI flags, environment variables, and platform-provided CI variables. Do not put secrets in workflow or pipeline YAML literals; pass them through GitHub Actions secrets, Azure Pipelines secret variables, or a protected variable group.

## Precedence

The runtime resolves configurable review options in this order:

1. Explicit CLI flag.
2. Canonical `UMACTUALLY_*` environment variable.
3. Legacy `REVIEW_*` environment variable.
4. Built-in CLI default.

The CLI natively honors every documented `UMACTUALLY_*` env var. In CI, set them as GitHub Actions env/secrets or Azure pipeline variables and they flow through without shell translation. Boolean env vars accept `true|false|1|0|yes|no|on|off|y|n`, case-insensitively after trimming. Invalid values fail configuration with a redacted error: secret values are never echoed.

With `review --json`, the new `resolvedConfig.sources` object reports exactly which surface supplied each resolved field (`flag`, `env`, or `default`, plus the non-secret env name when applicable). Use it to diagnose precedence without exposing credentials.

Platform variables such as `GITHUB_TOKEN`, `GITHUB_EVENT_PATH`, `SYSTEM_ACCESSTOKEN`, and Azure build metadata are discovered from the runner environment. `NO_COLOR` is also honored at the CLI level: any non-empty value disables decorative color, as does `--no-color`.

## Review options

CLI flag names are the kebab-case form of the option column (for example, `api-url` becomes `--api-url`).

| Option | Env var | Default | Allowed values | Notes |
| --- | --- | --- | --- | --- |
| `api-url` | `UMACTUALLY_API_URL` | `""` | HTTPS URL | Review API base URL. Required for hosted review API use. Prefer env/secret over a literal input. |
| `api-key` | `UMACTUALLY_API_KEY` | `""` | Secret string | Review API key. Must come from a secret store. Never log or echo it. |
| `model` | `UMACTUALLY_MODEL` | `auto` | `auto`, `review-model-synthetic` | `review-model-synthetic` is intended for fixtures and deterministic tests. `auto` is opinionated: it resolves to `gpt-5-mini` for OpenAI endpoints, `claude-sonnet-4.6` for Anthropic, `claude-3-5-sonnet` for Copilot (the 4.6 string is NOT Copilot-routable and would 404, so Copilot uses the 3.5 Sonnet line), and `gemini-2.5-flash` for Google endpoints — each chosen for the lowest citation-hallucination rate among production code-review models per the Vectara HHEM 2026-05-11 leaderboard. Set a literal model name (`gpt-5-mini`, `claude-sonnet-4.6`, etc.) to override. |
| `effort` | `UMACTUALLY_EFFORT` | `medium` | `low`, `medium`, `high` | Reasoning effort hint. Forwarded as `reasoning.effort` to providers that support it. |
| `provider` | `UMACTUALLY_PROVIDER` | `openai-compatible` | `openai-compatible`, `copilot`, `anthropic` | Provider family. Set to `copilot` to use GitHub Copilot (requires a GitHub PAT as `UMACTUALLY_API_KEY`). Set to `anthropic` to use the native Anthropic Messages API (`POST /v1/messages` with `x-api-key`/`anthropic-version` headers). **Advisory on dual-protocol gateways** — if the operator's `--provider` returns 404 at the URL, the dispatcher retries the OTHER protocol at the same URL (MiniMax serves both Anthropic and OpenAI protocols under the same hostname). See [providers.md](providers.md#cross-protocol-auto-discovery-the-dispatcher). |
| `github-api-base` | `UMACTUALLY_GITHUB_API_BASE` | `""` | HTTPS URL | GitHub API base URL for Copilot token exchange. Set to `https://<tenant>.ghe.com` for GitHub Enterprise Server. |
| `review-timeout-seconds` | `UMACTUALLY_REVIEW_TIMEOUT_SECONDS` | `300` | Positive integer seconds | Overall review wall-clock budget. Current runtime default is 300 seconds. |
| `stall-seconds` | `UMACTUALLY_STALL_SECONDS` | `270` | Positive integer seconds | Provider-output stall budget. Current runtime default is 270 seconds. |
| `max-output-tokens` | `UMACTUALLY_MAX_OUTPUT_TOKENS` | `16000` | Positive integer | Provider output budget. |
| `max-comments` | — | `50` | Positive integer | Cap on posted inline comments per review. Set to `0` to disable the cap. |
| `review-file-limit` | `REVIEW_FILE_LIMIT` | `200` | Positive integer, or `0` to disable | Soft cap on the number of changed files the live review path will process. When `countDiffFiles(diff) > review-file-limit` the CLI skips the live review and posts a "diff too large to review" parent card with zero inline findings — the chunked LLM reviews of arbitrarily-large initial-import diffs produce hallucinated findings that aren't grounded in the code. Raise this for huge PRs, or set to `0` to disable the cap entirely. |
| `minimum-severity` | `REVIEW_MINIMUM_SEVERITY` | `medium` | `low`, `medium`, `high` | Minimum severity for inline comments. Defaults to `medium`, so `low`-severity findings (style, hygiene) are filtered out before posting. Set to `low` to keep them. `security` and `leak` findings ALWAYS survive any threshold and are never suppressed. |
| `prompt` | `UMACTUALLY_PROMPT` | `""` | String | Inline system prompt override. Wins over `prompt-file`. |
| `additional-prompt` | `UMACTUALLY_ADDITIONAL_PROMPT` | `""` | String | Inline additional prompt override. Wins over `additional-prompt-file`. |
| `prompt-file` | `UMACTUALLY_PROMPT_FILE` | `""` | Repository-relative path | Optional prompt instructions file. Absolute paths and `..` traversal are rejected. |
| `prompt-files` | `UMACTUALLY_PROMPT_FILES` | `""` | Comma/newline-separated repo-relative paths | Explicit list of prompt files. **Completely overrides** the default repository prompt lookup (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursorrules`, `GEMINI.md`) when non-empty. Files are concatenated in the listed order. |
| `additional-prompt-file` | `UMACTUALLY_ADDITIONAL_PROMPT_FILE` | `""` | Repository-relative path | Optional additional prompt file. Absolute paths and `..` traversal are rejected. |
| `additional-prompt-files` | `UMACTUALLY_ADDITIONAL_PROMPT_FILES` | `""` | Comma/newline-separated repo-relative paths | Explicit list of additional prompt files. **Completely overrides** the default repository prompt lookup when non-empty. |
| `detect-leaks` | `UMACTUALLY_DETECT_LEAKS` | `true` | `true`, `false` | Run secret-leak detection on the diff before posting. Disable with `--no-detect-leaks` on the CLI or by setting the input/env to `false`. |
| `include-sonarqube` | `UMACTUALLY_INCLUDE_SONARQUBE` | `false` | `true`, `false` | Pull SonarQube issues alongside the PR review. Requires `--sonar-host-url`, `--sonar-token`, and `--sonar-project-key`. |
| `sonar-host-url` | `UMACTUALLY_SONAR_HOST_URL` | `""` | HTTPS URL | SonarQube base URL. |
| `sonar-token` | `UMACTUALLY_SONAR_TOKEN` | `""` | Secret string | SonarQube token. Must come from a secret store. |
| `sonar-project-key` | `UMACTUALLY_SONAR_PROJECT_KEY` | `""` | Project key string | SonarQube project key. |
| `dry-run` | `UMACTUALLY_DRY_RUN` | `false` | `true`, `false` | Generate review output without posting comments or status. Standalone mode (no CI markers) implicitly behaves as a smoke run that writes `./umactually-review.json` without a real HTTP provider call when `--dry-run` is set. |
| `walkthrough` | `UMACTUALLY_WALKTHROUGH` | `false` | `true`, `false` | Emit a separate PR walkthrough comment alongside the review. |
| `diagnostic` | `UMACTUALLY_DIAGNOSTIC` | `false` | `true`, `false` | Inject a synthetic low-severity finding for pipeline smoke tests. |
| `debug-raw-response` | `UMACTUALLY_DEBUG_RAW_RESPONSE` | `false` | `true`, `false` | Echo the raw provider response into the workflow log. |
| `simulate-findings` | `UMACTUALLY_SIMULATE_FINDINGS` | `false` | `true`, `false` | When enabled, replaces a structurally empty live provider payload (no inline comments and no suppressed comments) with the deterministic multi-finding fixture defined in `src/review/simulated-findings.ts`. Live findings always win: a non-empty provider result is preserved untouched. The fixture anchors 4-6 inline threads across at least 2 files (mixed severities and categories) plus 1-2 suppressed off-diff entries so the suppression path is exercised. CLI equivalent: `--simulate-findings` / `--no-simulate-findings`. |
| `strict-schema` | `UMACTUALLY_STRICT_SCHEMA` | `true` | `true`, `false` | Send `response_format: { type: "json_schema", strict: true }` on the wire so the provider enforces the review schema at decode time. Set to `false` via `--no-strict-schema` for providers that reject the strict-schema payload (older Copilot routes, certain self-hosted OpenAI-compatible servers). The in-context system prompt always carries the schema, so disabling the wire constraint degrades to "shape guide only" — the post-filter still catches semantic errors. |
| `verify-findings` | `UMACTUALLY_VERIFY_FINDINGS` | `true` | `true`, `false` | Deterministic re-verification of the model's `comments[]` against the supplied diff. Runs locally — does NOT depend on provider support for `response_format: json_schema`. Any comment whose (path, line) does not anchor is dropped before posting. Set to `false` via `--no-verify-findings` only if the caller has out-of-band validation. The same filter powers the `parse-warnings.json` artifact that records what was dropped. |
| `platform` | `UMACTUALLY_PLATFORM` | `auto` | `auto`, `github`, `azure` | Platform dispatch hint. `auto` selects GitHub when `GITHUB_ACTIONS=true` and Azure when `TF_BUILD=True`. |

## Removed inputs (migration map)

The following inputs were removed in a recent breaking change. Workflows and pipelines still setting them will not error — they are silently ignored (env vars) or surface as a one-time stderr warning at config load. Migrate as shown:

| Removed input | Env vars | Migrate to |
| --- | --- | --- |
| `ignore-minor: true` | `UMACTUALLY_IGNORE_MINOR`, `REVIEW_IGNORE_MINOR` | `minimum-severity: medium` (the new default) |

CLI users will see `CliUsageError` for `--ignore-minor` / `--no-ignore-minor` with the same migration hint.

## Platform and token environment variables

| Env var | Platform | Required | Default/source | Purpose |
| --- | --- | --- | --- | --- |
| `GITHUB_TOKEN` | GitHub Actions | Yes for posting reviews | Automatically provided by GitHub Actions when permissions allow it | Authenticates review creation and PR metadata reads. Requires `contents: read` and `pull-requests: write` for normal review posting. |
| `GITHUB_EVENT_PATH` | GitHub Actions | Yes | Automatically provided by GitHub Actions | Points to the pull request event JSON. The action reads PR number and repository metadata from it. |
| `GITHUB_REPOSITORY` | GitHub Actions | Yes | Automatically provided by GitHub Actions | Owner/repository name, for example `${{ github.repository }}`. |
| `GITHUB_SHA` | GitHub Actions | Usually | Automatically provided by GitHub Actions | Current workflow commit SHA used for diagnostics and request context. |
| `SYSTEM_ACCESSTOKEN` | Azure DevOps | Yes for posting PR threads/status | Map from `$(System.AccessToken)` in the step `env:` block | Authenticates Azure DevOps REST calls. Enable scripts to access the OAuth token. |
| `SYSTEM_COLLECTIONURI` | Azure DevOps | Yes | Automatically provided by Azure Pipelines from `$(System.CollectionUri)` | Azure DevOps organization/collection URI. |
| `SYSTEM_TEAMPROJECT` | Azure DevOps | Yes | Automatically provided by Azure Pipelines | Azure DevOps project name. |
| `BUILD_REPOSITORY_ID` | Azure DevOps | Yes | Automatically provided by Azure Pipelines | Repository identifier used for PR REST API calls. |
| `BUILD_REPOSITORY_NAME` | Azure DevOps | Useful | Automatically provided by Azure Pipelines | Human-readable repository name. |
| `SYSTEM_PULLREQUEST_PULLREQUESTID` | Azure DevOps | Yes in PR validation builds | Populated by branch policy PR validation; may be empty in CI builds | Azure PR ID for posting threads and status. |
| `SYSTEM_PULLREQUEST_SOURCEBRANCH` | Azure DevOps | Useful | Populated by PR validation builds | PR source branch. |
| `SYSTEM_PULLREQUEST_TARGETBRANCH` | Azure DevOps | Useful | Populated by PR validation builds | PR target branch. |
| `BUILD_REASON` | Azure DevOps | Diagnostic | Automatically provided by Azure Pipelines | Should be `PullRequest` for PR review posting. If it is `IndividualCI` or `BatchedCI`, PR variables may not populate. |

## Recommended GitHub configuration

Use the pinned CLI workflow in [`docs/gh-actions.md`](gh-actions.md) or copy [`examples/github/pr-review.yml`](../examples/github/pr-review.yml). Pass provider credentials through `UMACTUALLY_API_URL` and `UMACTUALLY_API_KEY` secrets, and map `${{ github.token }}` explicitly to `GITHUB_TOKEN` on the review step.

### Overriding the default prompt lookup

By default, UmActually auto-discovers common agent-instruction files from the repository root (CLAUDE.md, AGENTS.md, `.github/copilot-instructions.md`, `.cursorrules`, GEMINI.md — see [docs/security.md](security.md#default-repository-prompt-lookup) for the security contract). To force a specific list instead, pass `--prompt-files` / `--additional-prompt-files` or set `UMACTUALLY_PROMPT_FILES` / `UMACTUALLY_ADDITIONAL_PROMPT_FILES`. A non-empty list **completely overrides** the corresponding default lookup.

```yaml
env:
  UMACTUALLY_PROMPT_FILES: prompts/review-system.md,prompts/repo-context.md
  UMACTUALLY_ADDITIONAL_PROMPT_FILES: prompts/extra-instructions.md
run: npx umactually@0.1.0 review --platform github
```

Azure DevOps uses the same CLI-native variables: define them as pipeline variables and run the slim example without a forwarding script.

## Recommended Azure DevOps configuration

Use the pinned CLI pipeline in [`docs/azure-devops.md`](azure-devops.md) or copy [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml). In live branch-policy runs, the CLI derives PR metadata, diff, and artifact paths from Azure's runner environment. Map `$(System.AccessToken)` to `SYSTEM_ACCESSTOKEN` and store provider credentials as secret pipeline variables.

## Provider families

The CLI supports three provider families. For the canonical end-to-end reference (URL resolution rules, cross-protocol dispatch, the MiniMax dual-protocol matrix, model auto-resolution per provider) see [`docs/providers.md`](providers.md). This page documents the CLI surface and runtime defaults only.

- **`openai-compatible`** (default): posts to any OpenAI-compatible `/responses` or `/chat/completions` endpoint. The `UMACTUALLY_API_URL` must be the base URL (e.g. `https://api.openai.com/v1`). Set `UMACTUALLY_API_KEY` to the provider key. Forwards `max_output_tokens` and `reasoning.effort` when supported by the endpoint.

- **`copilot`**: exchanges the `UMACTUALLY_API_KEY` value (a GitHub PAT) for a short-lived session token at `${UMACTUALLY_GITHUB_API_BASE}/copilot_internal/v2/token` using `Authorization: token <githubToken>`, then dispatches to the plan-routed host returned in the token envelope (`endpoints.api` — typically `api.individual.githubcopilot.com`, `api.business.githubcopilot.com`, or `api.enterprise.githubcopilot.com` depending on the user's Copilot plan). Sends the required `Editor-Version`, `Editor-Plugin-Version`, `Copilot-Integration-Id`, and `User-Agent` headers. Only `/chat/completions` is used (Copilot does not expose `/responses`).

- **`anthropic`**: uses the native Anthropic Messages API (`POST /v1/messages`). The wire body uses the Anthropic Messages schema — top-level `system` field, user-only `messages[]`, `max_tokens` instead of `max_output_tokens`, `x-api-key` and `anthropic-version: 2023-06-01` headers (NOT `Authorization: Bearer ...`). Anthropic does not support OpenAI-style `response_format: json_schema`, so strict-JSON is enforced entirely by the in-context system prompt + the parser; the same fallback the openai-compatible client uses after its self-healing retry strips the wire schema. Defaults to `https://api.anthropic.com/v1` when `UMACTUALLY_API_URL` is unset. The URL resolver (`src/util/url.ts:resolveAnthropicMessagesUrl`) follows the official `@anthropic-ai/sdk` convention: **the operator's path prefix is preserved**, so `--api-url https://api.minimax.io/anthropic` POSTs to `https://api.minimax.io/anthropic/v1/messages` (not `/v1/messages`). This matches [MiniMax's docs](https://platform.minimax.io/docs/token-plan/claude-code) and the [anthropic-sdk-kotlin path-preserving fix](https://github.com/xemantic/anthropic-sdk-kotlin/pull/145). Query strings and fragments are dropped before route resolution to prevent `.../v1?token=abc/v1/messages`-style URL malformations. The retry / parse-fail / bumped-budget / network-retry flows are shared byte-for-byte with the openai-compatible client so behavior is identical regardless of provider family.

### Cross-protocol auto-discovery (dual-protocol gateways)

When `--api-url` points at a gateway that serves both protocols under the same hostname (the documented example is MiniMax, but the rule generalizes — any Anthropic-protocol-compatible gateway mounted under a path prefix):

```text
--provider openai-compatible --api-url https://api.minimax.io/anthropic
  → dispatcher tries /anthropic/responses + /anthropic/chat/completions (404)
  → fallback to origin + /v1, tries /v1/responses + /v1/chat/completions (404)
  → named provider exhausted; fall back to OTHER protocol
  → anthropic provider tries resolveAnthropicMessagesUrl → /anthropic/v1/messages (200)
  → outcome.attribution = "anthropic-messages"
```

And the inverse:

```text
--provider anthropic --api-url https://api.minimax.io/v1
  → dispatcher tries /v1/messages (404)
  → fall back to OTHER protocol
  → openai-compatible tries /v1/responses + /v1/chat/completions
  → outcome.attribution = "openai-compatible" on success
```

The trigger is **strictly 404** (routing-level rejection). 400 (payload error), 401/403 (auth), 5xx (server), parse failures, and network errors do NOT trigger the fallback — see [providers.md](providers.md#what-triggers-the-fallback) for the rationale. Each fallback emits two `::notice::` annotations so operators can audit which protocol produced the review.

The fallback reuses the operator's `UMACTUALLY_API_KEY` for both protocols. This is correct on documented dual-protocol gateways (MiniMax accepts the same key for both protocols at the same hostname). Operators pointing the action at a non-dual-protocol URL with the wrong `--provider` get a wasted secondary request — the `::notice::` annotations let them see it happened so they can pick the right `--provider` next run.

#### Path-prefix heuristic for `/anthropic` URLs (commit-to-Anthropic-protocol)

A subtle gotcha surfaced by the operator's actual setup (`UMACTUALLY_API_URL=https://api.minimax.io/anthropic` + default `--provider=openai-compatible`): the openai-compatible client's URL candidate loop downgrades `/anthropic` to `origin+/v1` and tries `/v1/responses` there. MiniMax serves OpenAI Responses at `/v1/responses` (just like it serves Anthropic at `/anthropic/v1/messages`), so the openai loop happily succeeds with the **OpenAI** wire shape — never triggering the cross-protocol fallback above. Result: the action posts OpenAI-Responses shape to a URL the operator typed as an Anthropic-protocol gateway.

To prevent this, the dispatcher runs `looksLikeAnthropicEndpoint(baseUrl)` (`src/util/url.ts`) *before* choosing which provider client to call. When ANY path segment is exactly `anthropic` (case-insensitive, byte-for-byte — `anthropic-v2` and `my-anthropic` do NOT match), the dispatcher commits to the Anthropic Messages API client regardless of `--provider`. A `::notice::` is emitted on every URL that triggers the heuristic:

```
::notice::umactually: Operator URL contains an /anthropic path segment; using the Anthropic Messages API client (not the default openai-compatible).
```

The heuristic is conservative by design. False negatives still fall through to the cross-protocol fallback chain above. False positives are bounded to byte-for-byte segment matches so a path like `https://attacker.example.com/anthropic-related` does NOT trigger the heuristic. See [`docs/providers.md#path-prefix-heuristic`](providers.md#path-prefix-heuristic-the-anthropic-url-commits-to-the-anthropic-protocol) for the full contract and the boundary test matrix (`test/unit/looks-like-anthropic-endpoint.test.ts`).

The provider family is selected via `--provider` or `UMACTUALLY_PROVIDER`. The default is `openai-compatible`. `UMACTUALLY_GITHUB_API_BASE` controls Copilot token exchange only; it does not make live PR posting compatible with GitHub Enterprise Server.

## Defaults and normalization

Current runtime defaults are intentionally conservative:

- `model`: `auto`
- `effort`: `medium`
- `provider`: `openai-compatible`
- `review-timeout-seconds`: `300`
- `stall-seconds`: `270`
- `dry-run`: `false` (set to `true` for a smoke test that skips provider calls; standalone mode bypasses platform posting regardless)
- `detect-leaks`: `true`
- `prompt-file`: unset
- `max-output-tokens`: `16000`

`max-output-tokens` is part of the public CLI/provider configuration even when a local test fixture does not consume it directly.

## CLI commands

The bundled CLI at `bin/umactually.mjs` (and `dist/cli.js`) accepts the following top-level commands:

- `umactually [--version | -V]` — print version, exit 0.
- `umactually review [...flags]` (default) — run the review; the existing public flag surface remains accepted. Bare invocation is equivalent to `umactually review`. Standalone mode derives inputs from the current git working tree, while live CI mode derives platform context from the runner environment.
- `umactually doctor [--json]` — diagnostic self-check of the local environment (Node version, `dist/cli.js` bundle, `bin` shim, required platform env vars, `--api-url` resolver sanity). Exit 0 if every check is `ok`, exit 1 if any check is `fail`. `--json` emits a machine-readable report on stdout.
- `umactually --no-color` — disables decorative color across all subcommands. Honored equivalently by the `NO_COLOR=<anything>` env var; either form forces monochrome output.
- `umactually --json` on `review` — emits one JSON document on stdout with the envelope `{schemaVersion:1, command:"review", exitCode, resolvedConfig, outcome}`. `resolvedConfig` reflects the post-precedence config the CLI actually used, and `outcome` mirrors the artifact's `outcome` block. Exit code is unchanged from the underlying run.

The `review` subcommand's public flag surface is unchanged from earlier releases and lives in the [Review options](#review-options) table above. CLI flags use kebab-case names and map to the documented environment variables; the [precedence rules](#precedence) apply.

## Current limitations

**Windows host self-review is unsupported.** The release workflow smoke-tests the packaged Windows binary, including startup and CLI dispatch, but it does not execute a live or self-review workflow on a Windows host. Use Linux for CI review jobs in the first release; the Windows binary smoke result is distribution evidence, not end-to-end platform support.

**GitHub Enterprise Server is unsupported.** Live GitHub PR requests resolve from `GITHUB_API_URL` when supplied by the runner and otherwise fall back to `DEFAULT_GITHUB_API_BASE` (`https://api.github.com`) at [`src/platform/github/api.ts:27`](../src/platform/github/api.ts#L27). The first CLI-only release is tested and supported against GitHub.com, not GHES.

**Azure marker deduplication is non-atomic.** Azure Pipelines has no GitHub-style workflow concurrency group with cancellation. The CLI's marker lookup/update is best effort, so rapid re-runs can race and double-post. Cancel superseded runs when practical.

**The shell and PowerShell installers are not CI-grade installation paths.** `scripts/install.sh` and `scripts/install.ps1` are convenience installers for interactive machines. CI must use Node 24 and a version-pinned npm package such as `npx umactually@0.1.0`; never curl an installer or resolve an unpinned latest version in a review pipeline.