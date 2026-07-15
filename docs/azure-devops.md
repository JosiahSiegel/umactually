# Azure DevOps setup

Run UmActually as a version-pinned npm CLI in Azure Pipelines. Copy the slim Linux pipeline from [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml).

## OAuth-token setup

Enable **Allow scripts to access the OAuth token**, then map the token explicitly:

```yaml
env:
  SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

This is the only unavoidable Azure-specific plumbing: Azure provides `$(System.AccessToken)` but does not export it under the name the CLI consumes. Without the setting and mapping, the CLI cannot read PR metadata, fetch the diff, post threads, or update status. A secret `AZURE_DEVOPS_TOKEN` PAT remains an alternative when the build service cannot receive the required permissions.

## Branch policy build validation

The YAML `pr:` trigger is honored only for GitHub and Bitbucket Cloud repositories connected to Azure Pipelines. For Azure Repos Git, create the pipeline and add it as an automatic **Build validation** policy on each protected target branch. Only a branch-policy PR run reliably populates the PR-scoped variables.

## Minimal Linux pipeline

```yaml
trigger: none
pr:
  branches:
    include: [main]
pool:
  vmImage: ubuntu-latest
steps:
  - checkout: self
  - task: NodeTool@0
    inputs:
      versionSpec: "24.x"
  # Pin to the v0.4.0 release tag. The umactually npm package is not
  # yet published; `npx github:owner/repo#tag` resolves to the GitHub
  # tarball at that ref so the install is reproducible.
  - script: npx github:JosiahSiegel/umactually#v0.4.0 review --platform azure-devops
    displayName: Run umactually PR review
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

Store `UMACTUALLY_API_URL` and `UMACTUALLY_API_KEY` as secret pipeline variables or in a protected variable group. `npx` installs the pinned CLI, so a consuming repository does not need a separate `npm ci` step unless its own build requires one.

## CLI-native pipeline variables

Every documented `UMACTUALLY_*` env var is CLI-native. Set values as Azure pipeline variables and they flow into the script process automatically; do not build Bash or PowerShell argument arrays to forward them.

High-value variables include:

- `UMACTUALLY_PROVIDER`, `UMACTUALLY_MODEL`, and `UMACTUALLY_EFFORT`
- `UMACTUALLY_PROMPT_FILES` and `UMACTUALLY_ADDITIONAL_PROMPT_FILES`
- `UMACTUALLY_STRICT_SCHEMA` and `UMACTUALLY_VERIFY_FINDINGS`
- `UMACTUALLY_REVIEW_TIMEOUT_SECONDS`, `UMACTUALLY_STALL_SECONDS`, and `UMACTUALLY_MAX_OUTPUT_TOKENS`
- `UMACTUALLY_DETECT_LEAKS`, `UMACTUALLY_WALKTHROUGH`, and `UMACTUALLY_DRY_RUN`

For example, define `UMACTUALLY_STRICT_SCHEMA=false` as a pipeline variable to disable strict schema. Prompt-file variables accept comma- or newline-separated repository-relative paths; a non-empty list overrides the corresponding default repository prompt lookup.

## Automatic artifact validation

The CLI validates the persisted artifact automatically after every live review. Missing files, invalid JSON, parse-fail sentinels, explicit parse failures, contradictory verdicts, and artifacts without usable review signals fail the review invocation. Do not add a separate always-run validation task.

`check-review-artifact` remains available for manually validating an existing file, but the standard pipeline does not invoke it.

## Required build-service permissions

Grant the pipeline build service:

- **Read** for repository and pull request content.
- **Contribute to pull requests** for review threads and status updates.

A missing permission normally surfaces as HTTP 403. Grant permissions narrowly, using a secret `AZURE_DEVOPS_TOKEN` only when policy prevents the build-service grant.

## Windows agent

Windows agents use the same single command after `NodeTool@0`:

```yaml
# Pin to the v0.4.0 release tag.
- powershell: npx github:JosiahSiegel/umactually#v0.4.0 review --platform azure-devops
  displayName: Run umactually PR review
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
    UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

Optional `UMACTUALLY_*` pipeline variables remain inherited by the process; no PowerShell translation is needed.

## Parse-fail triage

A parse-fail diagnostic card is not approval.

1. Inspect logs for endpoint attribution, HTTP status, timeout, and parse warnings.
2. Confirm provider URL, family, credential, and model compatibility.
3. If the gateway rejects strict JSON schema, set `UMACTUALLY_STRICT_SCHEMA=false`; local finding verification remains enabled.
4. Increase output or timeout budgets only when logs show exhaustion.
5. Queue a new branch-policy validation run after correcting configuration.

## Concurrency limitation

Azure Pipelines has no direct equivalent to a GitHub Actions concurrency group with cancellation. Marker lookup and update reduce duplicates but are not atomic. Avoid overlapping runs for the same PR and cancel superseded runs when practical.

## Syncing merged GitHub PRs to ADO main

If you maintain a fork of this action in Azure DevOps for ADO-side validation work and need to keep ADO `main` in lock-step with the canonical GitHub `main`, ADO main needs to catch up via a sync PR after each GitHub merge:

1. Merge the GitHub PR (squash, per the bot's preference).
2. `git push` a new `sync/ado-main-with-github-mainN` branch to ADO.
3. Use the ADO REST API to create a PR with `bypassPolicy: true` (bypasses the canonical-branch commit-policy check on ADO main, which the sync branch isn't subject to).
4. If ADO reports `mergeStatus: conflicts`, resolve locally: `git merge ado/main --no-ff`, `git checkout --theirs <conflict-file>`, `git commit --no-edit`.
5. `git push --force-with-lease ado sync/ado-main-with-github-mainN` to update the branch tip with the resolution.
6. PATCH the PR to `status: completed` with `bypassPolicy: true` and `lastMergeSourceCommit: { commitId: <force-pushed SHA> }`.

The sync PR's merge commit is one commit ahead of GitHub main in history (the merge commit itself), but the tree is identical. After the sync, run `bash scripts/ci-validate.sh` against ADO main to confirm parity.
