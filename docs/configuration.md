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
| `model` | `UMACTUALLY_MODEL` | `auto` | `auto`, `review-model-synthetic` | `review-model-synthetic` is intended for fixtures and deterministic tests. |
| `effort` | `UMACTUALLY_EFFORT` | `medium` | `low`, `medium`, `high` | Reasoning effort hint. Forwarded as `reasoning.effort` to providers that support it. |
| `provider` | `UMACTUALLY_PROVIDER` | `openai-compatible` | `openai-compatible`, `copilot` | Provider family. Set to `copilot` to use GitHub Copilot (requires a GitHub PAT as `UMACTUALLY_API_KEY`). |
| `github-api-base` | `UMACTUALLY_GITHUB_API_BASE` | `""` | HTTPS URL | GitHub API base URL for Copilot token exchange. Set to `https://<tenant>.ghe.com` for GitHub Enterprise Server. |
| `review-timeout-seconds` | `UMACTUALLY_REVIEW_TIMEOUT_SECONDS` | `300` | Positive integer seconds | Overall review wall-clock budget. Current runtime default is 300 seconds. |
| `stall-seconds` | `UMACTUALLY_STALL_SECONDS` | `270` | Positive integer seconds | Provider-output stall budget. Current runtime default is 270 seconds. |
| `max-output-tokens` | `UMACTUALLY_MAX_OUTPUT_TOKENS` | `16000` | Positive integer | Provider output budget. |
| `max-comments` | — | `50` | Positive integer | Cap on posted inline comments per review. Set to `0` to disable the cap. |
| `review-file-limit` | `REVIEW_FILE_LIMIT` | `200` | Positive integer, or `0` to disable | Soft cap on the number of changed files the live review path will process. When `countDiffFiles(diff) > review-file-limit` the CLI skips the live review and posts a "diff too large to review" parent card with zero inline findings — the chunked LLM reviews of arbitrarily-large initial-import diffs produce hallucinated findings that aren't grounded in the code. Raise this for huge PRs, or set to `0` to disable the cap entirely. |
| `ignore-minor` | `UMACTUALLY_IGNORE_MINOR` | `false` | `true`, `false` | Suppresses minor non-security findings only. Leaks and security findings are still reported. |
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
| `platform` | `UMACTUALLY_PLATFORM` | `auto` | `auto`, `github`, `azure` | Platform dispatch hint. `auto` selects GitHub when `GITHUB_ACTIONS=true` and Azure when `TF_BUILD=True`. |

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

To fetch PR metadata and the PR diff programmatically, use the Azure DevOps REST API with the OAuth token:

```yaml
- script: |
    set -euo pipefail
    collection_uri="${SYSTEM_COLLECTIONURI%/}"
    project_path="$(node -e 'process.stdout.write(encodeURIComponent(process.env.SYSTEM_TEAMPROJECT || ""))')"
    repository_path="$(node -e 'process.stdout.write(encodeURIComponent(process.env.BUILD_REPOSITORY_ID || ""))')"
    pr_url="${collection_uri}/${project_path}/_apis/git/repositories/${repository_path}/pullRequests/${SYSTEM_PULLREQUEST_PULLREQUESTID}?api-version=7.1"
    diff_url="${collection_uri}/${project_path}/_apis/git/repositories/${repository_path}/pullRequests/${SYSTEM_PULLREQUEST_PULLREQUESTID}/diffs/commits?api-version=7.1"
    curl -fsS \
      --header "Authorization: Bearer ${SYSTEM_ACCESSTOKEN}" \
      --header "Accept: application/json" \
      "$pr_url" \
      --output "$AZURE_EVENT_PATH"
    curl -fsS \
      --request POST \
      --header "Authorization: Bearer ${SYSTEM_ACCESSTOKEN}" \
      --header "Accept: text/plain" \
      --header "Content-Type: application/json" \
      --data '{}' \
      "$diff_url" \
      --output "$AZURE_DIFF_PATH"
  displayName: Fetch PR metadata and diff via REST API
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

Manual branch runs do not populate `SYSTEM_PULLREQUEST_PULLREQUESTID`. Keep a synthetic `--event` file, synthetic `--diff` file, `--review` fixture, `--pr-number 1`, and repository slug fallback for smoke validation outside branch-policy PR runs.

## Provider families

The action supports two provider families:

- **`openai-compatible`** (default): posts to any OpenAI-compatible `/responses` or `/chat/completions` endpoint. The `UMACTUALLY_API_URL` must be the base URL (e.g. `https://api.openai.com/v1`). Set `UMACTUALLY_API_KEY` to the provider key. Forwards `max_output_tokens` and `reasoning.effort` when supported by the endpoint.

- **`copilot`**: exchanges the `UMACTUALLY_API_KEY` value (a GitHub PAT) for a short-lived session token at `${UMACTUALLY_GITHUB_API_BASE}/copilot_internal/v2/token` using `Authorization: token <githubToken>`, then dispatches to the plan-routed host returned in the token envelope (`endpoints.api` — typically `api.individual.githubcopilot.com`, `api.business.githubcopilot.com`, or `api.enterprise.githubcopilot.com` depending on the user's Copilot plan). Sends the required `Editor-Version`, `Editor-Plugin-Version`, `Copilot-Integration-Id`, and `User-Agent` headers. Only `/chat/completions` is used (Copilot does not expose `/responses`).

The provider family is selected via `--provider` (CLI), `provider` (action input), or `UMACTUALLY_PROVIDER` env var. Default `openai-compatible`. For GitHub Enterprise Server data residency, set `UMACTUALLY_GITHUB_API_BASE=https://<tenant>.ghe.com` so the token exchange targets the tenant's API.

## Defaults and normalization

Current runtime defaults are intentionally conservative:

- `model`: `auto`
- `effort`: `medium`
- `provider`: `openai-compatible`
- `review-timeout-seconds`: `300`
- `stall-seconds`: `270`
- `ignore-minor`: `false`
- `dry-run`: `true` (default to dry-run; set to `false` for live provider calls)
- `detect-leaks`: `true`
- `prompt-file`: unset
- `max-output-tokens`: `16000`

`max-output-tokens` is documented and exposed by `action.yml` for provider integrations even when a local test fixture does not consume it directly.