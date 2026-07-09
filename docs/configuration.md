# Configuration

UmActually accepts configuration from GitHub Action inputs, environment variables, and platform-provided CI variables. Do not put secrets in workflow YAML literals; pass them through GitHub Actions secrets, Azure Pipelines secret variables, or a protected variable group.

## Precedence

For options that exist both as an action input and an environment variable, the runtime resolves values in this order:

1. Explicit GitHub Action input (`with:` in a workflow) or CLI flag.
2. Environment variable.
3. Built-in default from `action.yml` or the CLI.

Platform variables such as `GITHUB_TOKEN`, `GITHUB_EVENT_PATH`, `SYSTEM_ACCESSTOKEN`, and Azure build metadata are discovered from the runner environment and do not have action inputs.

## Action inputs

These entries mirror `action.yml`.

| Input | Env var | Default | Allowed values | Notes |
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
| `additional-prompt-file` | `UMACTUALLY_ADDITIONAL_PROMPT_FILE` | `""` | Repository-relative path | Optional additional prompt file. Absolute paths and `..` traversal are rejected. |
| `detect-leaks` | `UMACTUALLY_DETECT_LEAKS` | `true` | `true`, `false` | Run secret-leak detection on the diff before posting. Disable with `--no-detect-leaks` on the CLI or by setting the input/env to `false`. |
| `include-sonarqube` | `UMACTUALLY_INCLUDE_SONARQUBE` | `false` | `true`, `false` | Pull SonarQube issues alongside the PR review. Requires `--sonar-host-url`, `--sonar-token`, and `--sonar-project-key`. |
| `sonar-host-url` | `UMACTUALLY_SONAR_HOST_URL` | `""` | HTTPS URL | SonarQube base URL. |
| `sonar-token` | `UMACTUALLY_SONAR_TOKEN` | `""` | Secret string | SonarQube token. Must come from a secret store. |
| `sonar-project-key` | `UMACTUALLY_SONAR_PROJECT_KEY` | `""` | Project key string | SonarQube project key. |
| `dry-run` | `UMACTUALLY_DRY_RUN` | `true` | `true`, `false` | Produces output without posting reviews, threads, or statuses. Defaults to dry-run; set to `false` to run the live provider path. |
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

```yaml
permissions:
  contents: read
  pull-requests: write

steps:
  - uses: actions/checkout@v4
  # Replace `./` with the published action tag once this action is published.
  # Until then, the in-tree action is exercised via `./`.
  - uses: ./
    env:
      UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
      UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
```

Avoid passing `api-key` through `with:` unless a wrapper action requires it. Environment secrets are easier to rotate and less likely to appear in copied workflow snippets.

## Recommended Azure DevOps configuration

Use the root [`azure-pipelines.yml`](../azure-pipelines.yml) as the full PR-validation entrypoint. The CLI itself must receive `--event`, `--diff`, `--pr-number`, and `--repo` for Azure validation; use `--repo` for the repository slug.

```yaml
- script: |
    node bin/umactually-pr-review.mjs \
      --platform azure-devops \
      --event "$AZURE_EVENT_PATH" \
      --diff "$AZURE_DIFF_PATH" \
      --review "$AZURE_REVIEW_PATH" \
      --pr-number "$UMACTUALLY_PR_NUMBER" \
      --repo "$UMACTUALLY_REPO" \
      --dry-run \
      --output-artifact artifacts/manual/s4-azure-mocked-run.json
  displayName: Run UmActually PR review
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
    UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

To fetch PR metadata and the PR diff programmatically, the root pipeline delegates to [`scripts/prepare-azure-pr-inputs.sh`](../scripts/prepare-azure-pr-inputs.sh). The script writes a synthetic `--event`, `--diff`, and `--review` fixture so manual branch runs (without `SYSTEM_PULLREQUEST_PULLREQUESTID`) still execute end-to-end, and switches to a live Azure DevOps REST fetch when the PR ID is set. See [docs/azure-devops.md](azure-devops.md#fetching-pr-metadata-and-diff) for the full walkthrough.

```yaml
- script: bash scripts/prepare-azure-pr-inputs.sh
  displayName: Prepare Azure PR inputs
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

Manual branch runs do not populate `SYSTEM_PULLREQUEST_PULLREQUESTID`. The synthetic inputs written by `prepare-azure-pr-inputs.sh` cover that case automatically — no extra fallback to maintain.

## Provider families

The action supports three provider families. For the canonical end-to-end reference (URL resolution rules, cross-prot protocol dispatch, the MiniMax dual-protocol matrix, model auto-resolution per provider) see [`docs/providers.md`](providers.md). This page documents the CLI surface and runtime defaults only.

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
::notice::umactually-pr-review: Operator URL contains an /anthropic path segment; using the Anthropic Messages API client (not the default openai-compatible).
```

The heuristic is conservative by design. False negatives still fall through to the cross-protocol fallback chain above. False positives are bounded to byte-for-byte segment matches so a path like `https://attacker.example.com/anthropic-related` does NOT trigger the heuristic. See [`docs/providers.md#path-prefix-heuristic`](providers.md#path-prefix-heuristic-the-anthropic-url--anthropic-protocol-commit) for the full contract and the boundary test matrix (`test/unit/looks-like-anthropic-endpoint.test.ts`).

The provider family is selected via `--provider` (CLI), `provider` (action input), or `UMACTUALLY_PROVIDER` env var. Default `openai-compatible`. For GitHub Enterprise Server data residency, set `UMACTUALLY_GITHUB_API_BASE=https://<tenant>.ghe.com` so the token exchange targets the tenant's API.

## Defaults and normalization

Current runtime defaults are intentionally conservative:

- `model`: `auto`
- `effort`: `medium`
- `provider`: `openai-compatible`
- `review-timeout-seconds`: `300`
- `stall-seconds`: `270`
- `dry-run`: `true` (default to dry-run; set to `false` for live provider calls)
- `detect-leaks`: `true`
- `prompt-file`: unset
- `max-output-tokens`: `16000`

`max-output-tokens` is documented and exposed by `action.yml` for provider integrations even when a local test fixture does not consume it directly.