# umactually — provider-agnostic PR review action

umactually sends a redacted PR diff to a model gateway (Anthropic, OpenAI-compatible, or GitHub Copilot), converts the response into platform-native review comments, and posts a stable marker so repeated runs update instead of duplicating. It ships as a single bundled CLI at `dist/cli.js`; GitHub Actions and Azure Pipelines install and invoke that public CLI directly.

## Install

**macOS / Linux:**
```bash
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh
```
**Windows (PowerShell):**
```powershell
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex
```
**npm:** `npm install -g umactually` (Node required) · **Try without installing:** `npx umactually doctor` or `bunx umactually doctor`
**GitHub Actions:** pin the npm CLI in your workflow (Node 24):
```yaml
- name: Run umactually PR review
  env:
    GITHUB_TOKEN: ${{ github.token }}
    UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
    UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
  run: npx umactually@0.1.0 review --platform github
```

**Uninstall:**
```bash
# macOS / Linux
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.sh | sh

# Windows (PowerShell)
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.ps1 | iex

# npm
npm uninstall -g umactually
```

## Synopsis

```
umactually <command> [flags]
  review                  Run the PR review (default; all pre-existing flags accepted)
  doctor                  Diagnostic self-check; --json for a machine-readable report
  check-review-artifact   Validate a review artifact for CI
  --version               Print version and exit 0
  --help                  Full flag reference
```
Global flag: `--no-color` (also honored via `NO_COLOR=<anything>`); `--json` on `review` is documented under [JSON output](#json-output). Run `umactually check-review-artifact ./umactually-review.json` in an always-run CI step to validate that the review artifact was produced and is usable.

## Quickstart

### Standalone (local dev / smoke tests)

Inside any git repo, the CLI derives the diff and event automatically and writes `./umactually-review.json` to the cwd. **Standalone never posts to GitHub or Azure DevOps** — no token, no scope, no PR-context. Use this for local review iterations and `dry-run` smoke tests documented in [`docs/exit-codes.md`](docs/exit-codes.md).

```bash
npm install && npm run bundle
umactually \
  --api-url https://api.example.com/v1 \
  --api-key "$UMACTUALLY_API_KEY"
```

### Live CI (GitHub Actions / Azure DevOps)

The CLI derives event, diff, review, and PR context automatically from the runner — do not hard-code plumbing flags in workflow YAML or pipeline variables. `--platform auto` (default) reads `GITHUB_ACTIONS` / `TF_BUILD`; explicit `--platform github` or `--platform azure-devops` is accepted.

```bash
umactually --platform github
```

### Outside a git repo (advanced)

Without a git working tree, supply every plumbing flag explicitly. Useful for sandbox runs, vendor imports, and the `--dry-run` fixture path (`artifacts/manual/s1-github-self-review.md`).

```bash
umactually \
  --api-url https://api.example.com \
  --api-key "$UMACTUALLY_API_KEY" \
  --event /tmp/event.json \
  --diff /tmp/pr.diff \
  --review /tmp/review.json \
  --pr-number 42 \
  --repo owner/name
```
### Doctor

`doctor` runs a non-mutating self-check of the local environment (Node version, `dist/cli.js` bundle, `bin` shim, platform env vars, `--api-url` resolver). Exits 0 when every check is `ok`, 1 if any is `fail`. Pass `--json` for a machine-readable report.
```bash
umactually doctor            # human-readable
umactually doctor --json    # machine-readable
```

### JSON output

`review --json` writes one JSON envelope to stdout and exits with the same code as the underlying run — `{schemaVersion:1, command:"review", exitCode, resolvedConfig, outcome}`. Pair with `--dry-run` for a no-provider-call smoke test.
```bash
umactually review --json --dry-run --api-url https://api.example.com/v1 --api-key "$UMACTUALLY_API_KEY"
```
## Providers

The CLI dispatches on `--provider` (wire protocol) independently from `--api-url` (gateway). Dual-protocol gateways are auto-discovered via a path-prefix heuristic and a 404-only cross-protocol fallback. The dispatch decision tree is documented in [`docs/providers.md`](docs/providers.md).

### Anthropic

`--provider anthropic` targets the native Messages API. Defaults to `https://api.anthropic.com/v1`; override `--api-url` for self-hosted gateways. The Anthropic client preserves your path prefix (so `https://api.example.com/anthropic` lands at `/anthropic/v1/messages`).

```bash
umactually \
  --provider anthropic \
  --api-url https://api.example.com/anthropic \
  --api-key "$UMACTUALLY_API_KEY"
```

### OpenAI-compatible (default)

Omit `--provider` for the OpenAI family. Works against any OpenAI-protocol gateway at the `/v1/responses` or `/v1/chat/completions` endpoint; the dispatcher tries both before falling back.

```bash
umactually \
  --api-url https://api.example.com/v1 \
  --api-key "$UMACTUALLY_API_KEY"
```

### GitHub Copilot

`--provider copilot` exchanges a GitHub PAT for a short-lived Copilot token via `github-api-base` (defaults to `https://api.github.com`; set to `https://<tenant>.ghe.com` for Enterprise Server). The default model is `claude-3-5-sonnet`; pass `UMACTUALLY_API_KEY` as the GitHub PAT and let the runner's `GITHUB_TOKEN` provide the platform identity for posting.

```bash
umactually \
  --provider copilot \
  --api-url https://api.example.com \
  --api-key "$GITHUB_TOKEN" \
  --model claude-3-5-sonnet
```

## Artifacts

Two artifacts are written per live run, both tagged with the canonical marker `<!-- umactually -->` so a repeated run can locate and update its previous comments instead of duplicating:

- `umactually-review.json` (Standalone, default path) or the path supplied via `--review` (Wrapper) — the canonical review payload with `summary`, `verdict`, `comments[]`, `suppressed_comments[]`, `parseWarnings`, `severityWarnings`, `outcome` (resolved `provider`/`modelId`/`endpoint`/`fallbackFrom`/`elapsedMs`/`stalled`), `effectiveConfig`, and `secretsDetected`. A worked example lives at [`docs/samples/review-artifact.json`](docs/samples/review-artifact.json).
- `artifacts/manual/s1-github-self-review.md` — the dry-run smoke artifact written by the wrapper shim with no provider call; read it to confirm wiring without burning an upstream key.

## GitHub Actions

```yaml
name: PR review
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

concurrency:
  group: umactually-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - name: Install dependencies
        run: npm ci
      - name: Run umactually PR review
        env:
          GITHUB_TOKEN: ${{ github.token }}
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
        run: |
          npx umactually@0.1.0 review \
            --platform github \
            --api-url "$UMACTUALLY_API_URL" \
            --api-key "$UMACTUALLY_API_KEY"
      - name: Validate review artifact
        if: always()
        run: |
          # Equivalent installed command: umactually check-review-artifact
          npx umactually@0.1.0 check-review-artifact ./umactually-review.json
```

Do not use `pull_request_target` — it is not required and exposes secrets to untrusted PR code. The pinned public CLI derives event, diff, review, and PR context from the runner. The canonical copyable workflow lives at `examples/github/pr-review.yml`.

## Azure DevOps

```yaml
trigger: none
pr:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  - name: NODE_VERSION
    value: "24.x"

steps:
  - checkout: self
    persistCredentials: true
  - task: NodeTool@0
    inputs:
      versionSpec: $(NODE_VERSION)
  - script: npm ci
    displayName: Install dependencies
  - script: |
      set -euo pipefail
      # Conditionally forward the optional prompt-file list inputs and toggles.
      # When set, these override the default repository prompt lookup
      # (CLAUDE.md, AGENTS.md, etc.). See docs/configuration.md.
      optional_env_value() {
        local value="${1:-}"
        if [[ "$value" == \$\(*\) ]] || [[ -z "$value" ]]; then
          echo ""
        else
          echo "$value"
        fi
      }
      UMACTUALLY_PROMPT_FILES: $(UMACTUALLY_PROMPT_FILES)
      UMACTUALLY_ADDITIONAL_PROMPT_FILES: $(UMACTUALLY_ADDITIONAL_PROMPT_FILES)
      UMACTUALLY_STRICT_SCHEMA: $(UMACTUALLY_STRICT_SCHEMA)
      UMACTUALLY_VERIFY_FINDINGS: $(UMACTUALLY_VERIFY_FINDINGS)
      prompt_files="$(optional_env_value UMACTUALLY_PROMPT_FILES)"
      additional_prompt_files="$(optional_env_value UMACTUALLY_ADDITIONAL_PROMPT_FILES)"
      strict_schema="$(optional_env_value UMACTUALLY_STRICT_SCHEMA)"
      verify_findings="$(optional_env_value UMACTUALLY_VERIFY_FINDINGS)"
      EXTRA_ARGS=()
      if [ -n "$prompt_files" ]; then
        EXTRA_ARGS+=(--prompt-files "$prompt_files")
      fi
      if [ -n "$additional_prompt_files" ]; then
        EXTRA_ARGS+=(--additional-prompt-files "$additional_prompt_files")
      fi
      # strict_schema / verify_findings are default-ON in the CLI; the
      # pipeline forwards them only when the operator sets the env vars.
      # `false` translates to --no-strict-schema / --no-verify-findings.
      if [ -n "$strict_schema" ]; then
        if [ "$strict_schema" = "false" ]; then
          EXTRA_ARGS+=(--no-strict-schema)
        else
          EXTRA_ARGS+=(--strict-schema)
        fi
      fi
      if [ -n "$verify_findings" ]; then
        if [ "$verify_findings" = "false" ]; then
          EXTRA_ARGS+=(--no-verify-findings)
        else
          EXTRA_ARGS+=(--verify-findings)
        fi
      fi
      npx umactually@0.1.0 review \
        --platform azure-devops \
        --api-url "$(UMACTUALLY_API_URL)" \
        --api-key "$(UMACTUALLY_API_KEY)" \
        "${EXTRA_ARGS[@]}"
    displayName: Run umactually PR review
    env:
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
      UMACTUALLY_PR_NUMBER: $(System.PullRequest.PullRequestId)
      UMACTUALLY_REPO: $(Build.Repository.Name)
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
  - script: |
      npx umactually@0.1.0 check-review-artifact ./umactually-review.json
    condition: always()
    displayName: Validate review artifact
```

Enable "Allow scripts to access the OAuth token" so `$(System.AccessToken)` is available. Azure Repos callers wire this pipeline into a branch policy build validation pipeline (the YAML `pr:` trigger is honored only for GitHub / Bitbucket Cloud). For PRs over the 200-file default cap, pass `--review-file-limit N` (or set `REVIEW_FILE_LIMIT=N`); use `0` to disable the cap. Full ADO playbook at [`docs/azure-devops.md`](docs/azure-devops.md) and `examples/azure/azure-pipelines.yml`.

## Files

- [`docs/exit-codes.md`](docs/exit-codes.md) — canonical exit-code table (0/1/2/127) and emission points.
- [`docs/configuration.md`](docs/configuration.md) — every input, env var, CLI flag, and precedence rule (including the new CLI commands section and `NO_COLOR`).
- [`docs/providers.md`](docs/providers.md) — provider-protocol dispatch decision tree and dual-protocol fallback rules.
- [`docs/security.md`](docs/security.md) — secret-leak detection, URL redaction, prompt-file path-safety, and the `minimum-severity` bypass guarantee for `security`/`leak` findings.
- [`docs/samples/review-artifact.json`](docs/samples/review-artifact.json) — a worked Standalone artifact showing the canonical shape.
- [`docs/azure-devops.md`](docs/azure-devops.md) — root pipeline layout, manual branch runs, prompt-file forwarding.
## Exit codes

| Code | Meaning | Remediation |
|---|---|---|
| 0 | success | review posted (or `--dry-run` artifact written) |
| 1 | runtime error | Node version guard, provider failure, or unexpected internal error |
| 2 | validation error | required flag missing — `--help` lists the full surface |
| 127 | missing bundle | `dist/cli.js` not built — run `npm run bundle` |
See [`docs/exit-codes.md`](docs/exit-codes.md) for the canonical table and the exact emission points (`bin/umactually.mjs` and `src/cli.ts:runCli`).