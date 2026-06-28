# Azure DevOps setup

UmActually runs on Azure DevOps through the same bundled CLI. This page documents the configuration required to post a review on a PR in Azure Repos or in a GitHub-mirrored Azure Pipelines repo.

## System.AccessToken mapping

Azure DevOps exposes an OAuth-style token at `$(System.AccessToken)`. The CLI expects it as the environment variable `SYSTEM_ACCESSTOKEN`. Map the two with an `env:` block on the running step:

```yaml
- script: node dist/cli.js --platform azure-devops --repository example/umactually-fixture
  displayName: Run UmActually PR review
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
    UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

Two prerequisites:

1. The pipeline must run with **Allow scripts to access the OAuth token** enabled. This is in the pipeline security settings, not in YAML. Without it, `$(System.AccessToken)` resolves to an empty string and the CLI cannot post PR threads or a PR status.
2. The project collection must grant the build service `Contribute to pull requests` and the ability to update PR status. Without those permissions, the POST returns 403.

Do not commit `$(System.AccessToken)` to logs. The mapping above passes it through `env:`, which keeps it out of the script body and out of debug output.

## Why `pr:` does not populate on Azure Repos

The YAML `pr:` block is only honored for GitHub and Bitbucket Cloud repositories in Azure Pipelines. For Azure Repos Git repositories, pull request builds are configured through **branch policy build validation** in the Azure DevOps project UI, not through `pr:`.

This has three practical consequences:

- A plain CI trigger (for example `trigger: branches: include: [main]`) does not populate `SYSTEM_PULLREQUEST_PULLREQUESTID`, `SYSTEM_PULLREQUEST_SOURCEBRANCH`, or `SYSTEM_PULLREQUEST_TARGETBRANCH`.
- `BUILD_REASON` is `IndividualCI` or `BatchedCI` for plain CI builds; it is `PullRequest` only when the pipeline runs because a branch policy invoked it.
- The CLI requires the PR-scoped environment variables to post threads and status. If they are missing, the CLI exits with an error explaining which variable is unset.

If your repository lives in Azure Repos and the action fails with `SYSTEM_PULLREQUEST_PULLREQUESTID is empty` or `BUILD_REASON is not PullRequest`, that is a branch policy problem, not a CLI problem. Wire the pipeline into the branch policy for the target branch.

## Recommended topology

Use a PR validation pipeline triggered by a branch policy, not a YAML `pr:` block, when the repository is in Azure Repos. The pipeline should:

1. Install Node 24 and `npm ci`.
2. Run `node dist/cli.js --platform azure-devops --repository <owner/repo>`.
3. Map `SYSTEM_ACCESSTOKEN`, `UMACTUALLY_API_URL`, and `UMACTUALLY_API_KEY` through `env:`.
4. Upload `artifacts/manual/s4-azure-mocked-run.json` and the redaction report as pipeline artifacts.

For repository owners who want a CI smoke run as well, keep two pipelines:

- **PR validation pipeline** — required, runs on every PR, posts review.
- **Continuous integration pipeline** — runs on push to `main`, builds, runs unit tests, and produces build artifacts.

The CI pipeline is not the PR review pipeline; do not couple them.

## Copyable azure-pipelines.yml

```yaml
# azure-pipelines.yml
# Azure Repos PR validation build for the UmActually PR review action.
# Wire this pipeline into a branch policy build validation on the target branch
# (for example `main`) for the UmActually review to run on every PR.
trigger: none

pr:
  branches:
    include:
      - main
  # Note: the pr: block above is honored only for GitHub or Bitbucket Cloud
  # repositories mirrored into Azure Pipelines. For Azure Repos Git, configure
  # branch policy build validation in the Azure DevOps project UI instead.

pool:
  vmImage: ubuntu-latest

variables:
  - name: NODE_VERSION
    value: "24.x"

steps:
  - checkout: self
    persistCredentials: true

  - task: NodeTool@0
    displayName: Use Node $(NODE_VERSION)
    inputs:
      versionSpec: $(NODE_VERSION)

  - script: npm ci
    displayName: Install dependencies

  - script: node dist/cli.js --platform azure-devops --repository example/umactually-fixture
    displayName: Run UmActually PR review
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)

  - task: PublishPipelineArtifact@1
    condition: always()
    displayName: Publish review artifacts
    inputs:
      targetPath: artifacts/manual
      artifact: umactually-review
```

A standalone copy of this file is at [`examples/azure/azure-pipelines.yml`](../examples/azure/azure-pipelines.yml).

## Branch policy wiring (Azure Repos)

1. Open **Project settings → Repositories → `<repo>` → Policies → Branch policies**.
2. Under **Build validation**, add a new policy.
3. Select the pipeline defined above and the target branch (`main`).
4. Set **Trigger** to **Automatic** so the build runs on every PR update.
5. Set **Policy requirement** to **Required** if the review must pass before merge.
6. Save the policy.

After the policy is saved, open a test pull request and verify the pipeline runs with `BUILD_REASON: PullRequest`. If `SYSTEM_PULLREQUEST_PULLREQUESTID` is still empty, re-check the policy trigger; YAML alone does not start PR validation builds for Azure Repos.

## Verifying the CLI posted a review

Two indicators confirm a successful run:

1. The CLI exits 0 and the run summary lists the posted thread count.
2. The PR shows the UmActually review threads (Azure Repos calls them PR threads, status entry, or comments depending on UI).

To inspect what was posted:

- Open the PR in Azure DevOps and look for threads containing `<!-- umactually-pr-review -->`.
- Download the `umactually-review` artifact and inspect `artifacts/manual/s4-azure-mocked-run.json` for `postedThreadCount` and `postedStatusState`.

If `postedThreadCount` is 0 but the run succeeded, no reviewable findings were emitted for this PR. If the run failed with `BUILD_REASON is not PullRequest`, the build was triggered as a CI build, not as a PR validation build; re-check the branch policy wiring.