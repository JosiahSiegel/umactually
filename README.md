# UmActually PR Review Action

UmActually is a pull request review action that sends a redacted PR diff to the UmActually review API, converts the result into platform-native review comments, and posts a stable review marker so repeated runs can update or de-duplicate feedback.

The action is designed for:

- GitHub pull request reviews with least-privilege `GITHUB_TOKEN` permissions.
- Azure DevOps PR validation pipelines that call the same bundled CLI.
- Safe handling of secrets, prompt files, and minor-finding suppression.

## Quickstarts

- [GitHub Actions quickstart](#github-actions-quickstart)
- [Azure DevOps quickstart](#azure-devops-quickstart)
- [Configuration reference](docs/configuration.md)
- [Provider protocol reference](docs/providers.md) — when adding/changing providers, URL resolution rules, dual-protocol dispatch
- [Security model](docs/security.md)
- [Azure DevOps setup notes](docs/azure-devops.md)
- [Contributing / cold-startup guide](CONTRIBUTING.md) — if you've been away for a while, read this first

## Inputs

These inputs mirror `action.yml`.

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `api-url` | No | `""` | Provider base URL. See [docs/providers.md](docs/providers.md) for the per-family URL resolution rules. Prefer `UMACTUALLY_API_URL` in `env` for reusable workflows. Required for `openai-compatible`; `anthropic` defaults to `https://api.anthropic.com/v1`; ignored for `copilot`. |
| `api-key` | No | `""` | Provider API key. Prefer `UMACTUALLY_API_KEY` in `env` or a platform secret; never hard-code it. |
| `model` | No | `auto` | Review model to request. `auto` resolves per-provider + per-URL — see [docs/providers.md#model-auto-resolution-on-dual-protocol-gateways](docs/providers.md#model-auto-resolution-on-dual-protocol-gateways). Use a pinned synthetic name only when a maintainer asks for it. |
| `effort` | No | `medium` | Reasoning effort hint (low\|medium\|high). Forwarded as `reasoning.effort` to providers that support it. |
| `provider` | No | `openai-compatible` | Provider family. `openai-compatible` posts to any OpenAI-protocol gateway. `copilot` uses GitHub Copilot with a GitHub PAT. `anthropic` uses the native Anthropic Messages API. **On dual-protocol gateways** (e.g. MiniMax serves both Anthropic and OpenAI protocols under the same hostname), `--provider` is advisory: the dispatcher transparently falls back to the OTHER protocol at the same URL when the named protocol returns a routing-level rejection (404). See [docs/providers.md#cross-protocol-auto-discovery-the-dispatcher](docs/providers.md#cross-protocol-auto-discovery-the-dispatcher). |
| `github-api-base` | No | `""` | GitHub API base URL for Copilot token exchange. Defaults to `https://api.github.com`. Set to `https://<tenant>.ghe.com` for GitHub Enterprise Server. |
| `review-timeout-seconds` | No | `300` | Maximum review wall-clock time in seconds. |
| `stall-seconds` | No | `270` | Seconds without provider output before the review is considered stalled. |
| `max-output-tokens` | No | `16000` | Maximum provider output token budget. |
| `strict-schema` | No | `true` | Send `response_format: { type: "json_schema", strict: true }` on the wire so the provider enforces the review schema at decode time. Set to `false` for providers that reject the strict-schema payload (older Copilot routes, certain self-hosted OpenAI-compatible servers). The in-context system prompt always carries the schema, so disabling the wire constraint degrades to "shape guide only" — the post-filter still catches semantic errors. CLI flag: `--strict-schema` / `--no-strict-schema`. |
| `verify-findings` | No | `true` | Deterministic re-verification of the model's `comments[]` against the supplied diff before posting. Any comment whose (path, line) does not anchor is dropped before posting. Set to `false` only if the caller has out-of-band validation. CLI flag: `--verify-findings` / `--no-verify-findings`. |
| `review-file-limit` | No | `200` | Cap on the number of changed files the live review will process. PRs that exceed this get a "diff too large" parent card with zero findings — the per-chunk LLM reviews of huge initial-import diffs produce hallucinated findings. Set to `0` to disable. |
| `detect-leaks` | No | `true` | Run secret-leak detection on the diff. Disable with the `--no-detect-leaks` CLI flag. |
| `prompt` | No | `""` | Inline system prompt override. Wins over `prompt-file`. |
| `additional-prompt` | No | `""` | Inline additional prompt override. Wins over `additional-prompt-file`. |
| `prompt-file` | No | `""` | Optional repository-relative prompt file. Absolute paths and path traversal are rejected. |
| `prompt-files` | No | `""` | Comma/newline-separated list of repository-relative prompt files. **Completely overrides** the default-lookup list (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursorrules`, `GEMINI.md`) when non-empty. Files are concatenated in the listed order. |
| `additional-prompt-file` | No | `""` | Optional repository-relative additional prompt file. Absolute paths and path traversal are rejected. |
| `additional-prompt-files` | No | `""` | Comma/newline-separated list of repository-relative additional prompt files. **Completely overrides** the default-lookup list when non-empty. |
| `dry-run` | No | `false` | Generate review output without posting comments or status. |

See [docs/configuration.md](docs/configuration.md) for environment variables, precedence, and platform-specific defaults.

## GitHub Actions quickstart

Use the action from a `pull_request` workflow. Do **not** use `pull_request_target` for this action; it is not required and can expose secrets to untrusted PR code.

```yaml
name: UmActually PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Replace `./` with the published action tag (for example `example/umactually-pr-review@v1`)
      # once this action is published to the GitHub Marketplace.
      - uses: ./
        env:
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
```

A complete copyable example lives at [`examples/github/pr-review.yml`](examples/github/pr-review.yml).

### Using the native Anthropic Messages API

When your `UMACTUALLY_API_KEY` is a vanilla Anthropic key (no OpenAI proxy in front), set `provider: anthropic`. The action posts directly to `https://api.anthropic.com/v1/messages` using the Anthropic Messages wire schema (top-level `system`, user-only `messages[]`, `x-api-key` + `anthropic-version: 2023-06-01` headers). No need to provision an OpenAI-protocol gateway.

```yaml
      - uses: ./
        with:
          provider: anthropic
        env:
          UMACTUALLY_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Override the base URL (for a self-hosted Anthropic-protocol gateway) via `api-url: https://your-gateway.example/anthropic`. The Anthropic provider resolves the URL per the [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) convention — **it preserves the operator's path prefix** so Anthropic-protocol gateways mounted under arbitrary prefixes (the documented example: [MiniMax](https://platform.minimax.io/docs/token-plan/claude-code) at `https://api.minimax.io/anthropic`) route correctly. The action appends `/v1/messages` to whatever base URL you give it, so `https://api.minimax.io/anthropic` lands at `https://api.minimax.io/anthropic/v1/messages` — never at `/v1/messages` (which would 404 on MiniMax's Anthropic endpoint).

### Anthropic-compatible gateways and MiniMax

Some providers serve both Anthropic-protocol and OpenAI-protocol endpoints under the same hostname at different path prefixes. The action handles this transparently with two layers:

1. **Path-prefix heuristic** (`looksLikeAnthropicEndpoint` in `src/util/url.ts`): when the operator's `--api-url` has any path segment equal to `anthropic` (case-insensitive, byte-for-byte — `https://api.minimax.io/anthropic`, `https://gateway.example.com/llm/anthropic`, `https://api.example.com/v1/anthropic` all match), the dispatcher commits to the Anthropic Messages API client regardless of `--provider`. This prevents the openai-compatible client's URL-candidate loop from silently downgrading `/anthropic` to origin+`/v1` (where MiniMax also serves OpenAI and the openai loop would happily succeed with the wrong protocol). A `::notice::` is emitted on every URL that triggers the heuristic so the operator can audit the dispatcher's decision.

2. **Cross-protocol fallback** (PR #32): when the named provider (or the committed one from the heuristic) returns a routing-level rejection (404), the dispatcher retries the OTHER protocol at the same URL. Strictly limited to 404 — payload-level 400s do NOT trigger the fallback, because switching protocols on 400 would silently mask wire-shape bugs.

```yaml
      - uses: ./
        with:
          provider: openai-compatible   # works fine even when the URL is the Anthropic-prefix one
          api-url: https://api.minimax.io/anthropic
        env:
          UMACTUALLY_API_KEY: ${{ secrets.MINIMAX_API_KEY }}
```

On this URL the heuristic commits to the Anthropic Messages API client and POSTs `https://api.minimax.io/anthropic/v1/messages` with `x-api-key` + `anthropic-version: 2023-06-01` headers — the wire shape MiniMax prescribes for this path. Set `--provider anthropic --api-url https://api.minimax.io/v1` for the inverse. The protocol actually used is recovered in `outcome.provider` and reflected in the review attribution (see `artifacts/manual/s1-github-self-review.md` after a run).

See [docs/providers.md#cross-protocol-auto-discovery-the-dispatcher](docs/providers.md#cross-protocol-auto-discovery-the-dispatcher) for the full dispatch decision tree.

For a first-time import or vendoring PR that exceeds the 200-file default cap, set `review-file-limit: 0` (or your desired ceiling) to opt in to chunked review:

```yaml
      - uses: ./
        with:
          review-file-limit: 0
        env:
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
```

`review-file-limit: 0` disables the cap entirely; use it only when you understand the per-chunk LLM reviews of very large diffs may produce hallucinated findings.

## Azure DevOps quickstart

Azure DevOps uses the bundled CLI directly from a pipeline step. This repository includes a root [`azure-pipelines.yml`](azure-pipelines.yml) that uses Node 24, runs `npm ci`, runs the [`scripts/ci-validate.sh`](scripts/ci-validate.sh) validation suite (typecheck + test + bundle + dist-freshness), prepares Azure input files, executes an Azure dry run, and publishes `artifacts/manual`.

For a minimal CLI invocation, pass the supported Azure flags explicitly:

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

Use `--repo`; there is no longer alias for that option. Azure dry-run validation still requires `--event`, `--diff`, `--pr-number`, and `--repo`. The root pipeline creates a safe synthetic event/diff/review path for manual branch runs without `SYSTEM_PULLREQUEST_PULLREQUESTID`; PR validation runs fetch the real PR diff with `$(System.AccessToken)` when available.

For Azure Repos, configure a branch policy build validation pipeline; the YAML `pr:` trigger is only honored for GitHub and Bitbucket Cloud repositories in Azure Pipelines. See [`docs/azure-devops.md`](docs/azure-devops.md) and [`examples/azure/azure-pipelines.yml`](examples/azure/azure-pipelines.yml).

For PRs that exceed the 200-file default cap, add `--review-file-limit N` (or set `REVIEW_FILE_LIMIT=N`) to the CLI invocation. Use `0` to disable the cap entirely.

## Overriding the default prompt lookup

By default, UmActually auto-discovers common agent-instruction files from the repository root: `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursorrules`, `GEMINI.md`. Missing files are silently skipped. To force a specific list of prompt files instead, pass the `prompt-files` / `additional-prompt-files` inputs (GitHub Actions), `UMACTUALLY_PROMPT_FILES` / `UMACTUALLY_ADDITIONAL_PROMPT_FILES` env vars (Azure DevOps pipeline variables), or `--prompt-files` / `--additional-prompt-files` CLI flags. When set, the array **completely overrides** the default-lookup list — files are concatenated in the listed order with the standard `\n\n---\n\n` separator.

**GitHub Actions** — pass the inputs through `with:`:

```yaml
- uses: ./
  with:
    prompt-files: 'prompts/review-system.md,prompts/repo-context.md'
    additional-prompt-files: 'prompts/extra-instructions.md'
  env:
    UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
    UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
```

**Azure DevOps** — set the `UMACTUALLY_PROMPT_FILES` / `UMACTUALLY_ADDITIONAL_PROMPT_FILES` pipeline variables; the root pipeline (and the example) conditionally forward them to the CLI's `--prompt-files` / `--additional-prompt-files` flags:

```yaml
variables:
  - name: UMACTUALLY_PROMPT_FILES
    value: 'prompts/review-system.md,prompts/repo-context.md'
  - name: UMACTUALLY_ADDITIONAL_PROMPT_FILES
    value: 'prompts/extra-instructions.md'
```

The path-safety contract is identical to the explicit `prompt-file` / `additional-prompt-file` readers: each path must be repository-relative (absolute paths and `..` traversal are rejected). See [docs/security.md#default-repository-prompt-lookup](docs/security.md#default-repository-prompt-lookup) and [docs/azure-devops.md#forwarding-prompt-file-lists-overrides-the-default-lookup-list](docs/azure-devops.md#forwarding-prompt-file-lists-overrides-the-default-lookup-list).

## Security summary

- Secrets are never intentionally logged or echoed.
- Review diffs are redacted before provider submission and before artifacts are written.
- High-confidence leaks and security findings ALWAYS bypass `minimum-severity` and are never suppressed.
- `prompt-file` is repository-relative only; absolute paths and `..` traversal are rejected.
- All `::notice::` URLs (the persisted Action annotations) are routed through `redactUrlForLog()` which strips query strings and fragments. Operators who accidentally (or maliciously) type a URL with a `?token=…` parameter do not leak the token into the action log — see [docs/security.md#ci-log-url-redaction](docs/security.md#ci-log-url-redaction).
- Cross-protocol dispatcher reuses the operator's API key for both protocols at the same URL on dual-protocol gateways (MiniMax serves both at the same hostname). This is correct on documented dual-protocol gateways; on non-dual-protocol gateways the same key would land at the same URL with a different wire shape. The 404-only trigger keeps this from happening on payload-level errors.

Read the full [security notes](docs/security.md) before enabling this on repositories that accept external contributors.

## Verifying reviews

After the workflow runs on a PR, check the PR conversation or Files changed tab for comments containing the marker:

```text
<!-- umactually-pr-review -->
```

On GitHub, the action posts a pull request review. On Azure DevOps, the CLI posts PR threads and a PR status using the OAuth token mapped to `SYSTEM_ACCESSTOKEN`.
