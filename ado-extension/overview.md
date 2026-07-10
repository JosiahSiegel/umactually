# UmActually — Provider-agnostic AI PR review for Azure DevOps

> **⚠️ IN DEVELOPMENT — Dev Preview.** This extension is under active
> development. The manifest, task UI, and runtime contract are stable
> enough for sideloading into a private Azure DevOps organization, but
> the extension is **not** ready for publication to the public
> Visual Studio Marketplace. See the pre-publish checklist in
> [`README.md`](README.md#pre-publish-checklist) before tagging a
> release.

## What it does

UmActually wires the [UmActually CLI](https://github.com/JosiahSiegel/umactually)
into Azure Pipelines so every pull request gets a verifiable AI review
posted as inline review threads on the PR. It runs on PR validation
builds (the same hook you use for branch policies) and writes the
raw provider response as a pipeline artifact.

## Why UmActually vs. the alternatives

There are four other AI review tools in the Azure DevOps Marketplace.
UmActually is the only one with all three of:

- **Provider-agnostic.** Point it at any OpenAI-protocol gateway
  (LiteLLM, OpenRouter, vLLM, Ollama exposed via OpenAI), the native
  Anthropic Messages API, or GitHub Copilot via token exchange. The
  `--provider` flag is *advisory* — on dual-protocol gateways
  (`https://api.minimax.io/anthropic`) the dispatcher transparently
  falls back to the OTHER protocol at the same URL when the named
  one 404s.
- **Verified-facts + confidence-filter stack.** The 5-layer
  citation-grounding defenses (diff-side exclusion, system-prompt
  path enum, wire-format `response_format: json_schema`,
  deterministic verify-findings, model auto-resolver) plus the
  **verified-facts post-filter** and the **Layer 5 confidence
  filter** catch the LLM's most common hallucination patterns and
  downgrade them to `info` so they don't appear as blocking
  findings. The CLI's F1 against self-review is documented in
  [`docs/security.md`](https://github.com/JosiahSiegel/umactually/blob/main/docs/security.md).
- **SonarQube context integration.** When enabled, the tool fetches
  prior findings from SonarQube and injects them into the review
  prompt so the model doesn't re-report what's already known. Useful
  for regulated-industry teams where SonarQube is the canonical
  static-analysis source of truth.

## Quickstart

### 1. Install the extension

Sideload the `.vsix` (see [`scripts/package-extension.sh`](scripts/package-extension.sh))
into a private Azure DevOps organization. **Do not publish to the
public Marketplace** until the pre-publish checklist in
[`README.md`](README.md#pre-publish-checklist) is complete.

### 2. Set pipeline variables

In your pipeline's variable group, define:

| Variable | Required | Description |
| --- | --- | --- |
| `UMACTUALLY_API_URL` | yes | Provider base URL |
| `UMACTUALLY_API_KEY` | yes (secret) | Provider API key |
| `UMACTUALLY_SONAR_TOKEN` | only if `--include-sonarqube` | SonarQube auth token |

### 3. Grant the build service identity permission to post

The build service identity needs `Contribute to pull requests` on
the target repo. In the project settings:
**Project Settings → Repositories → [your repo] → Security → [Build
Service] → Contribute to pull requests = Allow**.

### 4. Wire the task into a PR validation pipeline

```yaml
trigger: none

pr:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

steps:
  - checkout: self
    persistCredentials: true

  - task: UmActuallyReviewTask.ReviewTask@0
    displayName: 'UmActually PR review'
    inputs:
      provider: anthropic
      effort: medium
      minimumSeverity: medium
      noDryRun: true   # set to false for first-time setup
      reviewFileLimit: 200
      maxComments: 50
    env:
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)

  - task: PublishPipelineArtifact@1
    condition: always()
    inputs:
      targetPath: artifacts/manual
      artifact: umactually-review
```

### 5. Branch policy

In **Project Settings → Repositories → [your repo] → Policies →
Branch Policies → main → Build Validation**, add the pipeline you
just created. The build policy fails the PR if the task returns
`Failed` — by default, `ReviewFailed` is a non-blocking policy
result, but you can change this in the policy settings.

## Inputs

See the `inputs` array in [`ReviewTask/task.json`](ReviewTask/task.json)
for the full list. The most-frequently-tuned inputs:

- `provider` — `openai-compatible` (default) | `anthropic` | `copilot`
- `model` — defaults to `auto` (resolves per-provider + per-URL)
- `effort` — `low` | `medium` (default) | `high`
- `minimumSeverity` — `info` | `low` | `medium` (default) | `high` | `critical`. **`security` and `leak` findings always bypass the threshold.**
- `noDryRun` — `true` (default, posts threads) | `false` (logs only)
- `detectLeaks` — `true` (default) | `false`
- `includeSonarqube` — `true` | `false` (default)
- `reviewFileLimit` — cap on changed files reviewed (default 200, set to 0 to disable)
- `maxComments` — cap on inline comments posted (default 50)
- `reviewTimeoutSeconds` — wall-clock cap (default 300)

## Output variables

The task sets these pipeline variables on success or failure:

- `UMACTUALLY_REVIEWED` — `true` | `false`
- `UMACTUALLY_FINDING_COUNT` — number of inline comments posted (live) or generated (dry-run)
- `UMACTUALLY_SEVERITY_HIGH_COUNT` — high-severity findings count

## Output artifact

The task writes the raw provider response to
`artifacts/manual/s4-azure-mocked-run.json` (configurable via
`outputArtifact`). Use a `PublishPipelineArtifact@1` step in your
pipeline to upload it. The artifact is useful for:
- Auditing what the model emitted
- Replaying a review against a different threshold without re-running the provider
- Sharing the review payload with a Slack notification step

## Security model

The CLI redacts high-confidence secret patterns from the PR diff
**before** the diff reaches the provider and **before** any artifact
is written. The task sets `--no-detect-leaks` to `false` (i.e.
leak-detector runs) by default; the always-on redaction is independent.
See [docs/security.md](https://github.com/JosiahSiegel/umactually/blob/main/docs/security.md)
for the full redaction-pattern list and the scope of the
`vso.code_write` / `vso.threads_full` permissions.

## License

MIT. See [`license-terms.md`](license-terms.md).

## Status

**Dev Preview (v0.1.0-dev).** The task compiles cleanly under
`tsc --noEmit` and the manifest is well-formed JSON. **It has not
been sideloaded into a real ADO organization yet.** Test coverage
of the task implementation is TBD — the existing 1081 unit tests
in the parent repo cover the CLI's filter layer but not this
thin task wrapper.

Reporting issues: <https://github.com/JosiahSiegel/umactually/issues>
