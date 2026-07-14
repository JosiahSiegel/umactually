# Azure DevOps setup

Run UmActually as a version-pinned npm CLI in Azure Pipelines. The canonical Linux pipeline is [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml).

## OAuth-token setup

Enable **Allow scripts to access the OAuth token** before the first run. Then map the pipeline token into the review step explicitly:

```yaml
env:
  SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

Without that setting, `$(System.AccessToken)` is empty and the CLI cannot read PR metadata, fetch the diff, post threads, or update PR status. Do not echo the token. Passing it through `env:` keeps it out of the script body and Azure masks it in logs.

A secret `AZURE_DEVOPS_TOKEN` PAT may be used when an organization cannot grant the build service the required repository permissions. The CLI prefers that value when present and otherwise uses `SYSTEM_ACCESSTOKEN`.

## Branch policy build validation

The YAML `pr:` trigger is honored only for GitHub and Bitbucket Cloud repositories connected to Azure Pipelines. Azure Repos Git does not use that trigger.

For Azure Repos Git:

1. Create a pipeline from the YAML file.
2. Open **Project settings → Repositories → `<repo>` → Policies → Branch policies**.
3. Add the pipeline under **Build validation** for each protected target branch.
4. Set the trigger to **Automatic** and choose whether the policy is required.

Only a branch-policy PR run reliably populates `System.PullRequest.PullRequestId` and the other PR-scoped variables. A manual or ordinary CI run is not a substitute for PR validation.

## Linux canonical pipeline

Copy [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml). It uses Node 24, installs the checked-in dependencies with `npm ci`, invokes `npx umactually@0.1.0`, forwards the provider secrets, and validates the review artifact even when the review step fails.

Store these values as secret pipeline variables or in a protected variable group:

- `UMACTUALLY_API_URL`
- `UMACTUALLY_API_KEY`

Keep the npm version pinned in both the review and validation commands. `npm ci` remains mandatory: it installs the repository dependency graph exactly from `package-lock.json`, while the version-qualified `npx` invocation separately pins the distributed CLI.

## Required build-service permissions

Grant the project's build service these repository permissions:

- **Read**: fetch repository and pull request content.
- **Contribute to pull requests**: create and update review threads and PR status.

A missing permission normally surfaces as HTTP 403. Prefer granting these narrowly to the pipeline's build-service identity. Use a secret PAT as `AZURE_DEVOPS_TOKEN` only when organizational policy prevents that grant.

## Windows agent

Windows agents can run the same CLI from PowerShell. Replace the Bash review task with this equivalent:

```yaml
- powershell: |
    $ErrorActionPreference = "Stop"
    $arguments = @("umactually@0.1.0", "review", "--platform", "azure-devops")
    if ($env:UMACTUALLY_PROMPT_FILES) {
      $arguments += @("--prompt-files", $env:UMACTUALLY_PROMPT_FILES)
    }
    if ($env:UMACTUALLY_ADDITIONAL_PROMPT_FILES) {
      $arguments += @("--additional-prompt-files", $env:UMACTUALLY_ADDITIONAL_PROMPT_FILES)
    }
    & npx @arguments
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  displayName: Run umactually PR review
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
    UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
    UMACTUALLY_PROMPT_FILES: $(UMACTUALLY_PROMPT_FILES)
    UMACTUALLY_ADDITIONAL_PROMPT_FILES: $(UMACTUALLY_ADDITIONAL_PROMPT_FILES)
```

Use `NodeTool@0` with `versionSpec: 24.x` before this task. The remaining checkout and validation tasks follow the same ordering as the [Linux canonical pipeline](#linux-canonical-pipeline).

## Prompt-file forwarding

The CLI discovers standard repository instruction files by default. To replace that lookup with an explicit ordered list, set optional pipeline variables and forward only non-empty values:

| Pipeline variable | CLI flag | Format |
| --- | --- | --- |
| `UMACTUALLY_PROMPT_FILES` | `--prompt-files` | Comma- or newline-separated repository-relative paths |
| `UMACTUALLY_ADDITIONAL_PROMPT_FILES` | `--additional-prompt-files` | Comma- or newline-separated repository-relative paths |

The canonical example builds an `EXTRA_ARGS` array so an unset variable does not become an empty flag value. A non-empty explicit list overrides the corresponding default prompt lookup and preserves the listed order.

## Artifact validation

Validate the generated artifact in an always-run task:

```yaml
- script: npx umactually@0.1.0 check-review-artifact ./umactually-review.json
  condition: always()
  displayName: Validate review artifact
```

The command rejects a missing file, invalid JSON, parse-fail sentinel, explicitly failed parse, contradictory verdict, or artifact with no usable review signal. Keep the validator package version identical to the review package version.

## Parse-fail triage

A parse-fail diagnostic card means the provider response could not become a valid review. It is not approval.

1. Inspect the review task logs for endpoint attribution, HTTP status, timeout, and parse warnings.
2. Confirm the provider URL, provider family, model, and credential are compatible.
3. If the gateway rejects strict JSON schema, retry with `--no-strict-schema`; local finding verification remains enabled.
4. Increase output or timeout budgets only when logs show truncation or exhaustion.
5. Queue a new branch-policy validation run after correcting the configuration. Do not bypass the artifact-validation failure.

## Concurrency limitation

Azure Pipelines has no direct equivalent to a GitHub Actions `concurrency:` group with `cancel-in-progress`. UmActually's marker lookup and update reduce duplicates, but Azure marker deduplication is best effort rather than atomic. Rapid re-runs or overlapping policy builds can both observe an empty marker slot and double-post.

Avoid manually queueing overlapping runs for the same PR. Cancel superseded runs when practical and treat duplicate marker comments as an expected platform limitation in the first release.

## Historical repository synchronization

The following guidance is operational history, not installation setup. It applies only when GitHub and Azure DevOps host separate mirrors of the repository.

Merge to the canonical host first, create a sync branch from that host's `main`, push it to the mirror, and open a mirror PR. If the mirror reports conflicts, merge its `main` into the sync branch locally, resolve by the canonical tree, run the full test suite, and update the sync branch with `--force-with-lease`. The resulting commit graphs may differ by a merge commit while their trees remain identical.
