# Azure DevOps setup

Run UmActually as a version-pinned npm CLI in Azure Pipelines. The canonical pipeline at [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml) is the source of truth — copy it into your pipeline rather than re-deriving it from this doc.

## OAuth-token setup

Enable **Allow scripts to access the OAuth token**, then map the token explicitly:

```yaml
env:
  SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

This is the only unavoidable Azure-specific plumbing: Azure provides `$(System.AccessToken)` but does not export it under the name the CLI consumes. Without the setting and mapping, the CLI cannot read PR metadata, fetch the diff, post threads, or update status. A secret `AZURE_DEVOPS_TOKEN` PAT remains an alternative when the build service cannot receive the required permissions.

Store `UMACTUALLY_API_URL` and `UMACTUALLY_API_KEY` as secret pipeline variables or in a protected variable group. The CLI consumes them natively — no Bash or PowerShell argument arrays are needed.

## Branch policy build validation

The YAML `pr:` trigger is honored only for GitHub and Bitbucket Cloud repositories connected to Azure Pipelines. For Azure Repos Git, create the pipeline and add it as an automatic **Build validation** policy on each protected target branch. Only a branch-policy PR run reliably populates the PR-scoped variables.

## Required build-service permissions

Grant the pipeline build service:

- **Read** for repository and pull request content.
- **Contribute to pull requests** for review threads and status updates.

A missing permission normally surfaces as HTTP 403. Grant permissions narrowly; use a secret `AZURE_DEVOPS_TOKEN` PAT only when policy prevents the build-service grant.

## Next

- Verify pipeline with the canonical pipeline at [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml).
- For parse-fail triage, automatic artifact validation, and the concurrency limitation, see [`docs/troubleshooting.md`](troubleshooting.md).
- For the ADO ↔ GitHub mirror sync workflow (when you maintain an ADO fork), see [§ Syncing merged GitHub PRs to ADO main](#syncing-merged-github-prs-to-ado-main) below.

## Syncing merged GitHub PRs to ADO main

If you maintain a fork of this action in Azure DevOps for ADO-side validation work and need to keep ADO `main` in lock-step with the canonical GitHub `main`, ADO main needs to catch up via a sync PR after each GitHub merge:

1. Merge the GitHub PR (squash, per the bot's preference).
2. `git push` a new `sync/ado-main-with-github-mainN` branch to ADO.
3. Use the ADO REST API to create a PR with `bypassPolicy: true` (bypasses the canonical-branch commit-policy check on ADO main, which the sync branch isn't subject to).
4. If ADO reports `mergeStatus: conflicts`, resolve locally: `git merge ado/main --no-ff`, `git checkout --theirs <conflict-file>`, `git commit --no-edit`.
5. `git push --force-with-lease ado sync/ado-main-with-github-mainN` to update the branch tip with the resolution.
6. PATCH the PR to `status: completed` with `bypassPolicy: true` and `lastMergeSourceCommit: { commitId: <force-pushed SHA> }`.

The sync PR's merge commit is one commit ahead of GitHub main in history (the merge commit itself), but the tree is identical. After the sync, run `bash scripts/ci-validate.sh` against ADO main to confirm parity.
