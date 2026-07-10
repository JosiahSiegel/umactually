# Azure DevOps setup

UmActually runs on Azure DevOps through the bundled CLI. The repository now has a root [`azure-pipelines.yml`](../azure-pipelines.yml) entrypoint that can be attached to an Azure Repos branch policy build validation pipeline or run manually from Azure Pipelines.

## Root pipeline behavior

The root pipeline is intentionally safe for both PR validation and manual branch runs:

1. Uses Node 24 and installs dependencies with `npm ci`.
2. Runs [`scripts/ci-validate.sh`](../scripts/ci-validate.sh), which performs the full CI validation suite: `npm run typecheck`, `npm test -- --run`, `npm run bundle`, and `npm run check:dist-freshness`. The example pipeline at [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml) invokes the same script so both pipelines share one implementation of the validation gates.
3. Creates `artifacts/manual` and writes Azure-compatible input files.
4. On PR validation runs, fetches the PR payload and diff with `$(System.AccessToken)` and real Azure PR metadata.
5. On manual non-PR runs, writes a synthetic Azure event, diff, and review payload so the CLI still executes without `SYSTEM_PULLREQUEST_PULLREQUESTID`.
6. Runs the CLI in Azure dry-run mode and publishes `artifacts/manual` as the `umactually-review` pipeline artifact.

The dry-run step proves the CLI executed by writing `artifacts/manual/s4-azure-mocked-run.json` and logging its marker/thread/status summary. It does not post live PR comments.

## Required Azure CLI flags

For `--platform azure-devops`, validation requires all of these flags, even in dry-run mode:

```bash
node bin/umactually-pr-review.mjs \
  --platform azure-devops \
  --event artifacts/manual/azure-event.json \
  --diff artifacts/manual/azure-pr.diff \
  --review artifacts/manual/azure-review.json \
  --pr-number "$UMACTUALLY_PR_NUMBER" \
  --repo "$UMACTUALLY_REPO" \
  --dry-run \
  --output-artifact artifacts/manual/s4-azure-mocked-run.json
```

Use `--repo`; there is no longer alias for that option.

## System.AccessToken mapping

Azure DevOps exposes an OAuth-style token at `$(System.AccessToken)`. Map it to `SYSTEM_ACCESSTOKEN` in the script `env:` block whenever a step needs Azure DevOps REST access:

```yaml
- script: node bin/umactually-pr-review.mjs --platform azure-devops --event "$AZURE_EVENT_PATH" --diff "$AZURE_DIFF_PATH" --pr-number "$UMACTUALLY_PR_NUMBER" --repo "$UMACTUALLY_REPO" --dry-run
  displayName: Run UmActually PR review
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
    UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

Two prerequisites:

1. Enable **Allow scripts to access the OAuth token** in pipeline settings. Without it, `$(System.AccessToken)` resolves to an empty string and PR diff fetches or live posting cannot authenticate.
2. Before live posting, grant the build service `Contribute to pull requests` and permission to update PR status. Without those permissions, Azure DevOps returns 403.

Do not echo the token. Passing it through `env:` keeps it out of the script body and avoids accidental log disclosure.

## Posting threads and PR status with an explicit PAT

The project build service identity mapped to `SYSTEM_ACCESSTOKEN` does not always hold the `Contribute to pull requests` permission on the repository, which causes the threads and statuses POST endpoints to return HTTP 403. To post live PR comments without manually editing project security, store an Azure DevOps PAT with the required permissions in the `umactually-secrets` variable group as `DEVOPS_PAT`, then forward it to the CLI as `AZURE_DEVOPS_TOKEN`:

```yaml
- script: |
    set -euo pipefail
    : "${DEVOPS_PAT:?DEVOPS_PAT must be set as a pipeline variable (umactually-secrets group).}"
    export AZURE_DEVOPS_TOKEN="${DEVOPS_PAT}"
    node bin/umactually-pr-review.mjs \
      --platform azure-devops \
      --event "$AZURE_EVENT_PATH" \
      --diff "$AZURE_DIFF_PATH" \
      --pr-number "$UMACTUALLY_PR_NUMBER" \
      --repo "$UMACTUALLY_REPO" \
      --no-dry-run
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    DEVOPS_PAT: $(DEVOPS_PAT)
    UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
    UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

When `AZURE_DEVOPS_TOKEN` is set, the CLI uses it in preference to `SYSTEM_ACCESSTOKEN` for posting threads and statuses, so the build service identity's missing permission is bypassed. When `AZURE_DEVOPS_TOKEN` is empty, the CLI falls back to `SYSTEM_ACCESSTOKEN` so dry-run and manual callers keep working. The PAT value is treated as a secret and is redacted from logs and provider payloads.

### Local development: sourcing the PAT from `.env`

For local inspection of PR state (reviewing posted threads, checking merge status, fetching run logs from outside the agent), store the PAT in `.env` as `DEVOPS_PAT` and source it into the shell:

```bash
# .env (gitignored — never commit)
DEVOPS_PAT=<your-pat>
AZURE_DEVOPS_ORG=<your-org>
AZURE_DEVOPS_PROJECT=<your-project>
AZURE_DEVOPS_PULL_REQUEST_ID=<pr-id>

# One-shot source for a single command
set -a && source .env && set +a
curl -s -u ":${DEVOPS_PAT}" \
  "https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/git/pullrequests/${AZURE_DEVOPS_PULL_REQUEST_ID}?api-version=7.1"
```

Both `DEVOPS_PAT` (agent-friendly name) and `AZURE_DEVOPS_TOKEN` (runtime-side name) can hold the same PAT value. The `.env.example` template at the repo root documents the local flow.

## Fetching PR metadata and diff

The root pipeline fetches real PR metadata and the PR diff only when `SYSTEM_PULLREQUEST_PULLREQUESTID` is present. The actual implementation lives in [`scripts/prepare-azure-pr-inputs.sh`](../scripts/prepare-azure-pr-inputs.sh), which both the root pipeline and `examples/azure/azure-pipelines.yml` invoke via a single shell step:

```yaml
- script: bash scripts/prepare-azure-pr-inputs.sh
  displayName: Prepare Azure PR inputs
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

The script does three things in order:

1. Writes a synthetic Azure PR event + review fixture (always, so manual branch runs without `SYSTEM_PULLREQUEST_PULLREQUESTID` still execute end-to-end).
2. Emits `##vso[task.setvariable]` markers so downstream steps can read `UMACTUALLY_PR_NUMBER` and `UMACTUALLY_REPO` as pipeline variables.
3. When `SYSTEM_PULLREQUEST_PULLREQUESTID` is set, fetches the real PR payload via the Azure DevOps REST API (`/_apis/git/repositories/{repoId}/pullRequests/{prId}` at `api-version=7.1`) using the OAuth bearer token, then generates a real unified diff via `git diff origin/<target>...HEAD` so the model reviews actual code changes (not just file paths).

Manual branch runs should not fail just because PR variables are missing. The synthetic event/diff/review fallback is built into `prepare-azure-pr-inputs.sh`, so adapting the example pipeline does not require copying that logic.

## Why `pr:` does not populate on Azure Repos

The YAML `pr:` block is only honored for GitHub and Bitbucket Cloud repositories connected to Azure Pipelines. For Azure Repos Git repositories, pull request builds are configured through **branch policy build validation** in the Azure DevOps project UI, not through `pr:`.

This has three practical consequences:

- A plain CI or manual run does not populate `SYSTEM_PULLREQUEST_PULLREQUESTID`, `SYSTEM_PULLREQUEST_SOURCEBRANCH`, or `SYSTEM_PULLREQUEST_TARGETBRANCH`.
- `BUILD_REASON` is `IndividualCI`, `BatchedCI`, or `Manual` for non-policy builds; it is `PullRequest` only when branch policy invokes the pipeline.
- Live posting requires PR-scoped Azure environment variables. The dry-run root pipeline avoids trivial manual failures by writing synthetic inputs.

If a live review fails with missing PR variables, wire the pipeline into branch policy build validation for the target branch.

## Recommended topology

Use the root `azure-pipelines.yml` for PR validation. For Azure Repos:

1. Create an Azure Pipeline from the root YAML file.
2. Enable **Allow scripts to access the OAuth token**.
3. Open **Project settings → Repositories → `<repo>` → Policies → Branch policies**.
4. Under **Build validation**, add the pipeline to the target branch (`main`, for example).
5. Set **Trigger** to **Automatic** and choose whether the policy is required.

Keep the root pipeline in dry-run mode until Azure authentication, branch policy wiring, and artifacts are verified. To post live reviews later, pass the same supported flags, provide `UMACTUALLY_API_URL` and `UMACTUALLY_API_KEY`, ensure Azure PR variables are populated, and switch from `--dry-run` to `--no-dry-run`.

## Verifying a run

After a pipeline run completes, download the `umactually-review` artifact and inspect:

- `artifacts/manual/azure-inputs.json` — whether the run used real PR metadata or synthetic manual metadata.
- `artifacts/manual/azure-event.json` — the Azure pull request event payload passed with `--event`.
- `artifacts/manual/azure-pr.diff` — the fetched or synthetic diff passed with `--diff`.
- `artifacts/manual/s4-azure-mocked-run.json` — the CLI dry-run artifact containing `marker`, `postedThreadCount`, and `postedStatusState`.

For live posting, also inspect the PR for threads containing:

```text
<!-- umactually-pr-review -->
```

A standalone copyable example lives at [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml).

## Syncing merged GitHub PRs to ADO main

When the action lives in both GitHub and ADO and the canonical review pipeline is GitHub (`umactually-pr-review/` at GitHub), ADO main drifts behind. The workflow that keeps them in parity is reproducible end-to-end with the REST API — no manual web-UI steps required.

The pattern (used for PRs #32 / ADO #62 and earlier syncs #59, #60, #61):

1. **Merge the PR on GitHub first** (squash or merge, per the PR's bot reviews). This becomes the "source of truth" commit on GitHub main.

2. **Create a sync branch from origin/main on ADO** — the branch name follows `sync/ado-main-with-github-mainN` (each PR increments N):

    ```bash
    # Locally against the canonical repo
    git checkout ado/main
    git checkout -b sync/ado-main-with-github-main8 origin/main
    git push ado sync/ado-main-with-github-main8
    ```

3. **Create the ADO PR via REST API**. ADO's web UI is not required — the operator used `gh api` against ADO. Required fields: `sourceRefName`, `targetRefName` (`refs/heads/main`), `bypassPolicy: true` (with a `bypassReason` explaining the sync), `bypassReason: "Sync of already-merged GitHub PR #N."`.

    ```bash
    # Find the repo id once:
    REPO_ID=$(curl -sS -u ":${DEVOPS_PAT}" \
      "https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/git/repositories?api-version=7.1" \
      | python -c "import sys, json; print(next(r['id'] for r in json.load(sys.stdin)['value'] if r['name']=='umactually'))")

    # Create the PR with bypassPolicy (bypassReason required when bypassing):
    curl -sS -X POST -u ":${DEVOPS_PAT}" -H "Content-Type: application/json" \
      "https://dev.azure.com/${AZURE_DEVOPS_ORG}/${AZURE_DEVOPS_PROJECT}/_apis/git/repositories/${REPO_ID}/pullrequests?api-version=7.1" \
      -d '{
        "sourceRefName": "refs/heads/sync/ado-main-with-github-main8",
        "targetRefName": "refs/heads/main",
        "title": "sync: bring ADO main into parity with GitHub main (PR #32)",
        "description": "Sync PR #32 ...",
        "bypassPolicy": true,
        "bypassReason": "Sync of already-merged GitHub PR #32."
      }'
    ```

4. **ADO detects conflicts** when the PRs being synced involve overlapping files (the case for cross-provider work spanning `src/cli/live-provider.ts`, `src/util/url.ts`, etc.). When conflicts arise, the merge fails with `mergeStatus: conflicts`.

5. **Resolve conflicts locally** — checkout the sync branch, do `git merge ado/main --no-ff`, run `git checkout --theirs <file>` for each conflict (the sync branch is the source of truth because the GitHub PR has already passed CI + review there), commit the resolution with `git commit --no-edit`.

6. **Force-push the resolved branch** with `--force-with-lease`:

    ```bash
    git push --force-with-lease ado sync/ado-main-with-github-main8
    ```

7. **Complete the PR via REST API** — set `status: completed` with `bypassPolicy: true` and `lastMergeSourceCommit: { commitId: <force-pushed tip SHA> }`. After this, ADO main moves to the sync PR's merge commit.

The sync PR's merge commit will be **one commit ahead** of GitHub main in history (the merge commit itself), but the **tree** is identical. GitHub and ADO are at parity for any `git checkout <commit-sha>` operation; they only differ in commit-graph history.

Required secrets: `DEVOPS_PAT` (or `AZURE_DEVOPS_TOKEN`) must be in `.env` or the shell session for the REST calls. Both are agent-friendly names that map to the same Azure DevOps Personal Access Token value — see the [`Local development: sourcing the PAT from .env`](#local-development-sourcing-the-pat-from-env) section above.
