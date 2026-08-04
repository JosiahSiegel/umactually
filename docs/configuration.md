# Configuration

UmActually accepts configuration through CLI flags, environment variables, and platform-provided CI variables. Do not put secrets in workflow or pipeline YAML literals; pass them through GitHub Actions secrets, Azure Pipelines secret variables, or a protected variable group.

## Precedence

The runtime resolves configurable review options through a four-tier precedence chain (highest priority first):

| Tier | Source | Notes |
| --- | --- | --- |
| 1 | `--provider`, `--api-url`, `--model`, `--api-key` flags | Always wins; lets a one-off run override saved config. |
| 2 | `UMACTUALLY_*` then legacy `REVIEW_*` env vars | First non-empty var wins; the legacy alias is field-specific — see the per-field table below for the exact name (e.g. `UMACTUALLY_API_URL` → `REVIEW_PROVIDER_URL`, `UMACTUALLY_API_KEY` → `REVIEW_PROVIDER_API_KEY`, `UMACTUALLY_PROMPT_FILE` → `REVIEW_PROMPT_SYSTEM_FILE`). |
| 3 | Saved user config (`~/.umactually/config.json`) | Holds `provider` (always), optional `apiUrl`, optional `model`. Written by `umactually init`. Override with `--force` to overwrite. |
| 4 | Built-in CLI default | Last resort; the schema default per `src/config/field-schema.ts`. |

The `apiKey` field is deliberately omitted from tiers 3 and 4 — the [S6 contract](#api-key-handling) bans persisting secrets to disk. It always comes from tier 1 (`--api-key`) or tier 2 (`UMACTUALLY_API_KEY` / `REVIEW_PROVIDER_API_KEY`); if both are missing the CLI surfaces a `cli: --api-key is required` validation error with an S6-compliant remediation hint, never writes the key to disk. The saved config is loaded via `readSavedConfig()` in `src/config/saved-config.ts` and overlaid on the resolved schema via `applySavedConfig()` (`src/cli/apply-saved-config.ts`). Empty-string env is treated as missing so operators can `unset` a setting without deleting the file. See [docs/security.md#trust-model-init](security.md#trust-model-init) for what is and isn't persisted.

Inspect what the loader actually resolved at runtime:

```bash
umactually --show-config
```

Prints `provider`, optional `apiUrl?`, optional `model?`, the file path the loader used, and the schema version. Field-by-field rendered (not JSON) so adding a future secret field to `SavedConfig` would not silently leak it through `--show-config`. Read-only; never opens a network connection; never prompts; exits 0 (or 1 with a stderr warning if the file is corrupt). Matches the convention of `kubectl config view`, `aws configure get`, and `git config --list --show-origin`.

The CLI natively honors every documented `UMACTUALLY_*` env var. In CI, set them as GitHub Actions env/secrets or Azure pipeline variables and they flow through without shell translation. Boolean env vars accept `true|false|1|0|yes|no|on|off|y|n`, case-insensitively after trimming. Invalid values fail configuration with a redacted error: secret values are never echoed.

With `review --json`, the `resolvedConfig.sources` object reports exactly which surface supplied each resolved field (`flag`, `env`, `savedConfig`, or `default`, plus the non-secret env name when applicable). The `savedConfig` source entry carries the file path the loader read from so you can audit which config supplied a value without exposing credentials.

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
| `files` | `UMACTUALLY_FILES` (n/a) | — | comma-separated paths | Comma-separated paths to files or directories for local-files review (no CI required). Recurses into directories; excludes build-artifact paths (matches `src/diff/filter-build-artifacts.ts`). Skips binary files (NUL-byte detection). Does not follow symlinks. Deduplicates paths via `realpathSync`. Honors `--dry-run` and `--output-artifact`. Ignores `--platform`. Mutually exclusive with `--diff`, `--event`, `--review`. |
| `walkthrough` | `UMACTUALLY_WALKTHROUGH` | `false` | `true`, `false` | Emit a separate PR walkthrough comment alongside the review. |
| `diagnostic` | `UMACTUALLY_DIAGNOSTIC` | `false` | `true`, `false` | Inject a synthetic low-severity finding for pipeline smoke tests. |
| `debug-raw-response` | `UMACTUALLY_DEBUG_RAW_RESPONSE` | `false` | `true`, `false` | Echo the raw provider response into the workflow log. |
| `simulate-findings` | `UMACTUALLY_SIMULATE_FINDINGS` | `false` | `true`, `false` | Replaces an empty live result with the deterministic multi-finding fixture from `src/review/simulated-findings.ts`. Live findings always win. |
| `strict-schema` | `UMACTUALLY_STRICT_SCHEMA` | `true` | `true`, `false` | Send `response_format: { type: "json_schema", strict: true }` on the wire. Set to `false` via `--no-strict-schema` for providers that reject the strict-schema payload. |
| `verify-findings` | `UMACTUALLY_VERIFY_FINDINGS` | `true` | `true`, `false` | Deterministic re-verification of every `comments[]` entry against the supplied diff. Paths or lines that don't anchor are dropped. Records what was dropped in `parse-warnings.json`. |
| `platform` | `UMACTUALLY_PLATFORM` | `auto` | `auto`, `github`, `azure` | Platform dispatch hint. `auto` selects GitHub when `GITHUB_ACTIONS=true` and Azure when `TF_BUILD=True`. |

## Local-files review mode

The `--files` flag runs a review over local files (or the recursive contents of local directories) without any CI runner, platform token, or pre-rendered diff. It is the right mode when you have a directory of code on disk and want the same review the live CI path produces, but you do not have a PR to post to.

When to use `--files` instead of `--diff`: `--diff` requires you to have already rendered a unified diff (typically `git diff` output) and to have the PR's event JSON for context; the live CI path discovers both from the runner. `--files` reads file contents directly from disk and synthesizes a unified diff in-memory, so it works on any folder, not just git working trees.

Standalone-only contract. `--files` is always standalone-only. It ignores CI markers (`GITHUB_ACTIONS`, `TF_BUILD`), so the same invocation behaves identically on a developer laptop and inside a CI step. It also ignores `--platform`: even if the runner is in CI and you pass `--platform github`, the local-files path never reaches the posting step. It honors `--dry-run` (skips the provider call, writes a stub artifact) and `--output-artifact` (writes to a custom path instead of `./umactually-review.json`). It is mutually exclusive with `--diff`, `--event`, and `--review` — the validator rejects the combination before any file is read.

Synthesized diff format. For each non-excluded, non-binary file, the CLI writes a unified-diff block with the standard header (`diff --git a/<path> b/<path>`, `--- a/<path>`, `+++ b/<path>`) and a single hunk whose header is `@@ -0,0 +1,<N> @@` where `<N>` is the line count of the file's contents. Each line is emitted with a leading `+` (added-line) marker. The concatenated blocks are written to `<cwd>/.umactually-auto-ctx/local-files-<uuid>.diff`, then handed to the same `runStandalone` pipeline the local-diff path uses. The temp diff file is left in place after the run so operators can inspect what the provider saw; delete it manually if you do not want to keep it. Under `--dry-run` no file is written to disk at all — the diff is synthesized in memory and discarded.

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

## Release asset format

Every GitHub Release under a `vX.Y.Z` tag ships exactly six public assets. Five are compressed archives (`.tar.gz` on Linux/macOS, `.zip` on Windows), each wrapping one binary member; one is a SHA-256 manifest (`checksums.txt`). The manifest's source of truth is [`scripts/release-targets.json`](../scripts/release-targets.json); the workflow and the installers both parse it.

| Asset | Format | Wraps | Verified by |
| --- | --- | --- | --- |
| `umactually-linux-x64.tar.gz` | gzipped tar | `umactually-linux-x64` | `checksums.txt` + installer archive-mode |
| `umactually-linux-arm64.tar.gz` | gzipped tar | `umactually-linux-arm64` | same |
| `umactually-darwin-arm64.tar.gz` | gzipped tar | `umactually-darwin-arm64` | same |
| `umactually-windows-x64.zip` | ZIP | `umactually-windows-x64.exe` | same |
| `umactually-windows-arm64.zip` | ZIP | `umactually-windows-arm64.exe` | same |
| `checksums.txt` | manifest | — | generated by the release workflow's size report step |

`darwin-x64` (Intel macOS) is not produced — Node's `--build-sea` segfaults on darwin-x64 ([nodejs/node#62893](https://github.com/nodejs/node/issues/62893)). Intel Mac users get the npm install path: `npm install -g umactually`. The curl-pipe installer detects darwin-x64 and fails fast with a pointer at the npm path.

The archive contract is the only supported download entry point. The installer one-liners in the README (`curl | sh` / `irm | iex`) download the matching archive by immutable tag, verify its SHA-256 against `checksums.txt`, and extract the single member to your PATH. The `INSTALL_ASSET_CONTRACT=archive` env var is the wire-format selection; the legacy raw-executable contract is preserved only for back-compat and is not the supported path for any current release. See [`docs/release-process.md`](release-process.md) for the full layout, pre-publication gates, Windows ARM64 structural validation, and size budget contract.

## SonarCloud integration

SonarCloud analysis is optional. Without the `SONAR_TOKEN` secret the `sonarqube-scan` job in `.github/workflows/ci.yml` emits a synthetic-success notice and skips, so forks and contributors without org access are never blocked.

**Operator setup (first time only)**

1. Create the SonarCloud project: https://sonarcloud.io → "+" → "Analyze new project" → select `JosiahSiegel/umactually`. SonarCloud auto-creates the project key `JosiahSiegel_umactually` against the `josiahsiegel` organisation (note: SonarCloud normalises GitHub org names to lowercase — `JosiahSiegel` on GitHub becomes `josiahsiegel` on SonarCloud; the project key, however, preserves the case from the repo name). `sonar-project.properties` is preconfigured against this org/project; no further edits to that file are needed.2. Generate a token: https://sonarcloud.io → Account → Security → Generate Tokens → name `umactually-ci`. Copy the token immediately; it cannot be retrieved later.
3. Add the secret: GitHub repo → Settings → Secrets and variables → Actions → New repository secret → Name `SONAR_TOKEN`, Value = the token from step 2.

**What runs in CI**

A single job is added by the SonarCloud workflow: `sonarqube-scan` uploads coverage and scan results to SonarCloud and posts PR decoration. The job is gated on the `SONAR_TOKEN` secret and emits a synthetic-success notice when the secret is absent so forks and contributors without org access are not blocked.

**Branch protection**

The `SonarCloud Code Analysis` check is **intentionally advisory**, not a required status check on `main`. Two reasons:

1. The job emits a synthetic-success `::notice::` whenever `SONAR_TOKEN` is absent so forks and contributors without org access are not blocked. On a fork PR without the secret, the check would pass vacuously — that would defeat the purpose of making it required. The same caveat applies to the main repo if the secret is ever cleared.
2. The actual quality gate is enforced server-side at SonarCloud (project → Administration → Quality Gate). Configuring that gate is the canonical place to block merges on coverage / new-code / security criteria.

If you do want a tighter signal on the main repo, configure the SonarCloud project's quality gate to fail on new-code coverage dropping below a threshold and surface that as a PR-decoration status badge — operators see it on the PR without it being a GitHub merge gate.

> If you later decide to make the SonarCloud check required on the main ruleset (override (1) above), the cleanest path is to gate the job at the workflow level on the secret's presence so forks report it as `skipped` rather than `success`. The synthetic-success step then becomes a documentation-only artifact for fork-PR debugging.
**Quality gate tuning**

The default SonarCloud "Sonar way" quality gate applies unless overridden in the SonarCloud UI (project → Administration → Quality Gate). The repo's coverage metric is fed from `coverage/lcov.info`, produced by `npm run test:coverage` inside the `sonarqube-scan` job.

**Local reproduction**

Run `npm run test:coverage` first to refresh `coverage/lcov.info`, then:

```bash
SONAR_TOKEN=<your-token> \
  npx --yes sonarqube-scanner \
    -Dsonar.host.url=https://sonarcloud.io \
    -Dsonar.token="$SONAR_TOKEN" \
    -Dsonar.organization=<your-org> \
    -Dsonar.projectKey=<your-org>_umactually
```

**What this does NOT do**

- Does not gate on coverage percentage thresholds — only on the SonarCloud quality gate, which is configured in the UI.
- Does not fail on `SonarCloud` outages. The scanner action retries internally; if it times out, the job fails and the synthetic-success notice is NOT emitted (so a real outage blocks merges by design).
- Does not validate the LIVE sonar import (the `runLiveSonarImport` HTTP poller). That path is exercised by `sonarqube-scan`'s own outcome — it would fail to upload coverage if the live HTTP path regressed. Live runtime regression coverage for the `--include-sonarqube` user-facing CLI lives in the user-facing `self-review.yml` workflow (which posts a real review on every PR).

## Next

- See [`docs/troubleshooting.md`](troubleshooting.md) for parse-fail triage, automatic artifact validation, and concurrency notes.
- See [`docs/providers.md`](providers.md) for the per-family wire shape, the cross-protocol dispatcher, and the `/anthropic` path-prefix heuristic.
- See [`docs/security.md`](security.md) for redaction, leak detection, the `minimum-severity` carve-out for `security` / `leak` findings, prompt-file path safety, and the trust model.
