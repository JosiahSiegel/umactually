# GitHub Actions Reference

A practical reference for writing, securing, and operating GitHub Actions workflows, reusable
workflows, custom actions, and deployment integrations. It distills current GitHub Docs guidance with
supporting material from the GitHub Security Lab, official `actions/*` repositories, and cloud-provider
OIDC documentation.

## Source policy

- **Primary:** [GitHub Docs](https://docs.github.com/en/actions) for syntax, triggers, permissions, and feature behavior.
- **Security:** [GitHub Security Lab](https://securitylab.github.com/resources/) and the official
  [Security hardening for GitHub
  Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
  guide.
- **Custom actions:** Official repositories under [github.com/actions](https://github.com/actions),
  [github.com/actions/toolkit](https://github.com/actions/toolkit), and the official templates
  ([typescript-action](https://github.com/actions/typescript-action),
  [javascript-action](https://github.com/actions/javascript-action)).
- **OIDC:** GitHub's per-cloud hardening guides plus the cloud provider's own trust-policy
  documentation (AWS IAM, Microsoft Entra workload identity, Google Cloud WIF, HashiCorp Vault JWT auth).
- **Tooling:** [actionlint](https://github.com/rhysd/actionlint) for static checks,
  [act](https://github.com/nektos/act) for local runs, and
  [@github/local-action](https://github.com/github/local-action) for JS/TS action smoke tests.

Code samples follow GitHub's recommended idioms and are intended as starting points, not drop-in production workflows.

## Table of contents

1. [Workflow placement and YAML anatomy](#workflow-placement-and-yaml-anatomy)
2. [Triggers](#triggers)
3. [Permissions and GITHUB_TOKEN](#permissions-and-github_token)
4. [Secrets, variables, and environments](#secrets-variables-and-environments)
5. [Matrix and concurrency](#matrix-and-concurrency)
6. [Reusable workflows](#reusable-workflows)
7. [Custom actions](#custom-actions)
8. [Caching and artifacts](#caching-and-artifacts)
9. [OpenID Connect (OIDC)](#openid-connect-oidc)
10. [Merge queues and merge_group](#merge-queues-and-merge_group)
11. [Gotchas checklist](#gotchas-checklist)

## Workflow placement and YAML anatomy

Workflow files must live directly in `.github/workflows/` with the `.yml` or `.yaml` extension.
Reusable workflows follow the same placement rule: a reusable workflow must be in `.github/workflows/`
of the calling repo, the same org/enterprise, or a public repo; subdirectory nesting does not change
this ([GitHub Docs — workflow
syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)).

A workflow file has these top-level keys:

| Key | Purpose |
| --- | --- |
| `name` | Human-readable name shown in the Actions UI. |
| `run-name` | Per-run label that can interpolate expressions. |
| `on` | Triggers. Use `on:` (not `true:`), which is the canonical form, though both are accepted. |
| `permissions` | Token scopes for `GITHUB_TOKEN`. |
| `env` | Workflow-level environment variables. |
| `defaults` | Default `run` shell and `working-directory`. |
| `concurrency` | Group and cancellation policy for in-flight runs. |
| `jobs` | The actual work, made of steps that run actions or shell commands. |

### Minimal workflow

```yaml
name: CI
run-name: "CI on ${{ github.ref_name }} @ ${{ github.sha }}"

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
```

## Triggers

GitHub Actions exposes a wide
[event catalog](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
A few specifics drive most day-to-day decisions:

- **`pull_request`** defaults to activity types `opened`, `synchronize`, and `reopened`. Adding more
  types expands the set; the default is not "all activity."
- **Path filters** apply to `pull_request`, `push`, and similar events. They cap at roughly 300 files in
  the diff, and very large pushes (>1,000 commits) bypass path filters and always run.
- **Branch filters** interact with required checks: if a branch filter excludes the merge base, the
  check never reports against that PR, and the PR appears to wait forever.
- **`pull_request_target`** runs in the context of the base branch with write permissions and a token
  that can write to the repo. If you check out and execute code from the head branch (a fork), a
  malicious PR can exfiltrate secrets. The
  [GitHub Security Lab pwn-request
  article](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests) and the
  [secure use of `pull_request_target`](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
  guide describe mitigations (build on `pull_request`, label gate, then re-run privileged checks).
- **`workflow_run`** lets you react to completed workflows and is the recommended place to do
  privileged work triggered by forks.
- **`workflow_call`** is the entry point for reusable workflows (see [Reusable workflows](#reusable-workflows)).
- **`merge_group`** is required for any check that gates a merge-queue PR (see [Merge queues and merge_group](#merge-queues-and-merge_group)).
- **`workflow_dispatch`** enables manual runs and accepts typed inputs. It can be triggered
  programmatically via the [REST API](https://docs.github.com/en/rest/actions/workflows) and the
  [`gh workflow run`](https://cli.github.com/manual/gh_workflow_run) command.

### Filtering triggers

```yaml
on:
  push:
    branches: [main, "releases/**"]
    paths:
      - "src/**"
      - "package.json"
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]
  workflow_dispatch:
    inputs:
      reason:
        description: "Why are you running this?"
        required: true
        type: string
```

## Permissions and GITHUB_TOKEN

Every workflow receives a `GITHUB_TOKEN`. Its scopes come from the workflow's `permissions` block. Two rules matter most:

1. **Specifying any permission key makes every unspecified permission `none`.** This is intentional
   and is the foundation of least-privilege workflows
   ([permissions reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)).
2. **For OIDC**, you must set `permissions: id-token: write` to request a token. That permission
   grants nothing else. Add `contents: read` or other scopes explicitly.

### Least-privilege permission snippets

```yaml
# Read-only check
permissions:
  contents: read

# Read code + write issues (for triage bots)
permissions:
  contents: read
  issues: write

# Required for OIDC deployments
permissions:
  contents: read
  id-token: write
```

You can also set `permissions:` at the job or step level to narrow further. The narrower level wins over the broader level.

`GITHUB_TOKEN` is short-lived and scoped to a single run, but it can still do serious damage if
mishandled. Treat it like any other credential: log actions you take with it, avoid printing it to
logs, and prefer per-job narrowing.

## Secrets, variables, and environments

GitHub offers three primitives beyond `GITHUB_TOKEN`:

- **Secrets** (`Settings → Secrets and variables → Actions`) are encrypted key/value pairs. Secrets at
  the repo, environment, or organization level behave slightly differently.
- **Variables** are non-secret configuration, useful for feature flags, endpoints, and similar values.
- **Environments** group secrets, variables, protection rules, and deployment targets. They can
  require reviewers, restrict to certain branches, or wait for a delay.

Key behaviors:

- Secrets can be referenced with `${{ secrets.NAME }}` in expressions. They are not passed to actions
  as plain `secrets.NAME` unless the action declares an `input` with `type: secret`; consumers usually
  expose them via the `env:` block or pass them explicitly to actions.
- Secrets are masked in logs but **not encrypted in workflow inputs** — anyone who can edit the
  workflow can read them. Use environments to gate access.
- **Environment secrets do not pass through `workflow_call`.** Reusable workflows cannot read
  environment secrets from the caller's environment. Pass secrets explicitly as `secrets:` in the
  `uses` block, or use repo/org secrets
  ([GitHub Docs — workflow_call](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)).
- **Reusable workflow secrets pass only one hop.** If workflow A calls workflow B, and B calls
  workflow C, C does not automatically receive A's secrets.

### Example: deploy job with environment

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy
          aws-region: us-east-1
```

## Matrix and concurrency

### Matrix strategies

Matrices fan a job out across a set of variable values. GitHub imposes a hard cap of **256 jobs per
workflow run**
([GitHub Docs — matrix](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstrategymatrix)).

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [20, 22, 24]
        exclude:
          - os: windows-latest
            node: 20
        include:
          - os: ubuntu-latest
            node: 24
            experimental: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
```

`fail-fast: false` lets other matrix legs finish after one fails. `max-parallel` caps concurrent
jobs, useful when hammering rate-limited services.

### Concurrency groups

Concurrency cancels or queues in-flight runs of a workflow. A concurrency `group` is a free-form string. Two pitfalls:

- **Group collisions across workflows.** `group: ${{ github.ref }}` is a popular choice but is shared
  by any other workflow using the same expression. Prefix with the workflow name:
  `group: ci-${{ github.workflow }}-${{ github.ref }}`.
- **`cancel-in-progress: true` cancels queued runs in addition to in-progress ones.** If you only want
  to cancel running duplicates, leave queued runs alone and let `cancel-in-progress: false` handle
  ordering via `group`.

```yaml
concurrency:
  group: deploy-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false
```

## Reusable workflows

Reusable workflows let you centralize a job sequence and call it from many caller workflows. They
live in `.github/workflows/` of any repo the caller can access.

### Caller

```yaml
jobs:
  build:
    uses: octo-org/example-repo/.github/workflows/reusable-build.yml@main
    with:
      node-version: 24
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Reusable workflow

```yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        required: true
    secrets:
      NPM_TOKEN:
        required: true

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - run: npm run build
```

Caller-job rules ([GitHub Docs — reusing workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)):

- The caller job cannot define most other keys (`runs-on`, `steps`, etc.) when it has `uses`.
- `secrets:` must be declared explicitly; they are not inherited automatically.
- Outputs are surfaced via `outputs:` at the reusable workflow level and accessed from the caller with `needs.<job>.outputs.<key>`.

## Custom actions

Custom actions come in three flavors ([about custom actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions)):

| Type | Runs on | When to use |
| --- | --- | --- |
| **JavaScript** | Any runner | Fast, cross-platform logic that does not need extra binaries. |
| **Docker container** | Linux runners only | Need a specific toolchain, runtime, or system dependency. |
| **Composite** | Any runner | A bundle of shell steps and `run:` commands; portable and easy. |

Every action requires a root metadata file. **`action.yml` is the preferred filename.** Renaming it
after publishing to Marketplace hides prior releases from the Marketplace listing.

### Composite action

```yaml
# action.yml
name: "Setup Project"
description: "Install Node and run npm ci"
inputs:
  node-version:
    description: "Node version"
    required: true
  cache:
    description: "Cache key prefix"
    required: false
    default: npm
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: ${{ inputs.cache }}
    - shell: bash
      run: npm ci
      env:
        NODE_VERSION: ${{ inputs.node-version }}
```

Composite actions **do not automatically map inputs to `INPUT_*` environment variables** the way
Docker container actions do. Reference inputs with `${{ inputs.name }}` or assign them to explicit
env vars if a child action needs them.

### JavaScript action essentials

- Use the official [typescript-action](https://github.com/actions/typescript-action) or
  [javascript-action](https://github.com/actions/javascript-action) template.
- Bundle dependencies into `dist/` using `@vercel/ncc` (or Rollup, used by the TS template). **The
  runner does not run `npm install`.** If `dist/` is missing, the action fails.
- Pin the runtime with `using: node20` or `using: node24` in `action.yml`. Node 20 is being phased
  out; Node 24 is the new default in 2026.
- Inputs declared `required: true` in `action.yml` are not auto-enforced. Call
  `core.getInput('name', { required: true })` or validate manually.

### Docker action essentials

- **Linux runners only.** Use composite or JS for Windows/macOS.
- The `Dockerfile` `ENTRYPOINT` must be executable and will run as root by default; `WORKDIR` is
  brittle in this context — prefer explicit `cd` in the entrypoint script.
- Share files with the calling workflow through the workspace (`$GITHUB_WORKSPACE`), `state` outputs, or environment variables.

### Versioning

Reference actions by major tag (`@v4`) for ease, by full-length commit SHA for supply-chain
security. **Only a full-length 40-character SHA is immutable** — major tags can be re-pointed.

## Caching and artifacts

Caches and artifacts look similar but behave very differently.

| Primitive | Purpose | Lifespan | Best for |
| --- | --- | --- | --- |
| [Cache](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows) (via `actions/cache`) | Reuse derived files between runs | Caches not accessed for 7 days are evicted, and storage is capped per repo (default 10 GB) | `node_modules`, build outputs, compiler caches. **Not for secrets.** |
| [Artifact](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow) (via `actions/upload-artifact`) | Pass files between jobs in the same run or download later | Configurable retention (default 90 days, can extend) | Build outputs, test reports, SBOMs, logs. |

### Cache snippet

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
      ${{ runner.os }}-
```

Lookup order is: exact key on current branch, prefix on current branch, each `restore-keys` in
order, then the same sequence on the default branch. `cache-hit` is true only on the exact primary-key
match.

### Artifact snippet (v4+)

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: dist/
    if-no-files-found: error
    retention-days: 14

# In a later job:
- uses: actions/download-artifact@v4
  with:
    name: build-output
    path: dist/
```

Artifact v4+ specifics:

- **Immutable:** re-uploading the same name deletes the prior artifact and creates a new one with
  a fresh ID (use `overwrite: true`).
- Hidden files (`.*`) are excluded by default in newer versions; use `include-hidden-files: true` if you need them.
- The digest is SHA-256 of the uploaded bytes; `digest-mismatch` controls behavior on download.
- Downloads **lose Unix modes** unless the artifact was tarred. Files land as `0644`, directories as `0755`.

### Caches are unsafe for secrets

Caches are branch-scoped and immutable, which makes them a poor secret store. Cache poisoning has
been used in real incidents — see the
[GitHub Security Lab pwn-request
article](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests) and the
[TanStack cache poisoning postmortem](https://blog.tanstack.com/cache-poisoning-postmortem) for the
canonical example.

`pull_request_target` is especially dangerous with caches: it can write to the default-branch shared
cache namespace, allowing a malicious PR to plant a cache entry that the next trusted run will
restore.

## OpenID Connect (OIDC)

GitHub can mint short-lived OIDC tokens that cloud providers trust as a federated identity, replacing
long-lived cloud secrets
([GitHub Docs — OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)).

The issuer is `https://token.actions.githubusercontent.com`. Its discovery document lives at `https://token.actions.githubusercontent.com/.well-known/openid-configuration`.

### Workflow setup

```yaml
permissions:
  contents: read
  id-token: write   # required to mint an OIDC token
```

Request a token in a step:

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/github-deploy
    aws-region: us-east-1
```

Or via the toolkit:

```js
const token = await core.getIDToken("sts.amazonaws.com");
```

### Trust policies by cloud

| Cloud | Audience (`aud`) | Subject (`sub`) shape | Notes |
| --- | --- | --- | --- |
| **AWS** | `sts.amazonaws.com` | `repo:OWNER/REPO:ref:refs/heads/main` or `repo:OWNER/REPO:environment:prod` | New trust policies must use `token.actions.githubusercontent.com:sub` (or `job_workflow_ref`); AWS evaluates identity-provider controls on first edit ([GitHub Docs — OIDC in AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [AWS IAM — secure-by-default](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_oidc_secure-by-default.html)). |
| **Azure** | `api://AzureADTokenExchange` | Repo/branch/environment composite | Use Federated Identity Credentials; per-app FIC count is limited ([GitHub Docs — OIDC in Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure), [Microsoft Entra workload identity](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-create-trust)). |
| **GCP** | Provider-specific audience URL | Repo/branch/environment composite | Workload Identity Federation requires explicit claim mapping before conditions can reference claims; prefer numeric repo IDs over names ([GitHub Docs — OIDC in GCP](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform), [Google Cloud WIF](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)). |
| **HashiCorp Vault** | Configurable; default repo owner URL | `repo:OWNER/REPO:*` etc. | Vault 1.17+ requires `bound_audiences` for JWT roles when the token contains `aud` ([GitHub Docs — OIDC in Vault](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-hashicorp-vault), [Vault JWT auth](https://developer.hashicorp.com/vault/docs/auth/jwt)). |

A subtle but important rollout: GitHub is standardizing **immutable subject identifiers** (numeric
owner/repo IDs), reaching general availability after July 15, 2026. Trust policies that match on
repo name may need to accept both forms during the transition.

Reusable workflows called across org/enterprise boundaries also need `id-token: write` on the
caller side; permissions are not inherited.

## Merge queues and merge_group

GitHub's
[merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
builds speculative merge commits on `gh-readonly-queue/<base>/...` refs and asks your CI whether
they are safe. Workflows receive a `merge_group` event with activity type `checks_requested`.
`GITHUB_SHA` is the merge-group SHA, not the PR head SHA.

**Any required check produced by GitHub Actions must run on `merge_group`, not only
`pull_request`.** Otherwise the queue waits for a status that never reports, and PRs stall.

### Trigger snippet

```yaml
on:
  pull_request:
    branches: [main]
  merge_group:
    types: [checks_requested]
```

### Context differences

`github.event.pull_request` is absent in `merge_group` runs. Read these instead:

- `github.event.merge_group.head_sha`
- `github.event.merge_group.base_sha`
- `github.event.merge_group.head_ref`
- `github.event.merge_group.base_ref`

Branch your payload access so the same workflow works for both events. The canonical pattern uses a
step or job condition based on `github.event_name`.

### Other queue pitfalls

- **Job names must exactly match branch-protection/ruleset requirements.** Required-check matching
  is by name/context, not by workflow.
- **Path filters and skipped jobs can stall the queue.** A skipped check may not post the required
  context. Make sure conditional jobs still post a status or remove them from "required."
- **Pre-receive hooks and rulesets** that block creation of `gh-readonly-queue/**` refs cause silent
  no-CI failures. Allow that namespace.
- **Third-party CI** must trigger on the `merge_group` webhook or on pushes to
  `gh-readonly-queue/<base>`. Some integrations have known gaps; check vendor docs before relying
  on a queue in production.

## Gotchas checklist

A compact list of foot-guns collected from the sections above.

- [ ] Required checks must include `merge_group: { types: [checks_requested] }` or the merge queue will
  stall.
- [ ] `pull_request_target` runs with write permissions against the base branch. Never check out and
  execute head-branch code in a `pull_request_target` job.
- [ ] Setting one `permissions:` key makes every unspecified permission `none`. Always declare the
  full set you intend.
- [ ] Reusable workflow secrets pass only one hop. Pass secrets explicitly to nested calls, and
  remember environment secrets do not pass through `workflow_call` at all.
- [ ] Matrix strategies cap at 256 jobs per workflow run.
- [ ] Concurrency groups collide across workflows when both use the same expression
  (e.g., `${{ github.ref }}`). Namespace with `${{ github.workflow }}` or a workflow prefix.
- [ ] Caches are immutable and branch-scoped; they are unsafe for secrets. They are also
  write-restricted on fork PRs but read-accessible.
- [ ] `pull_request_target` runs can write to default-branch shared caches, enabling cache
  poisoning. Avoid restoring or saving caches in those jobs.
- [ ] Cache `cache-hit` is true only on exact primary-key matches, not on `restore-keys` prefix hits.
- [ ] Composite actions do not auto-populate `INPUT_*` env vars. Reference `${{ inputs.name }}`
  explicitly or assign env vars.
- [ ] `inputs.required: true` in `action.yml` is documentation only. Validate in the action's code.
- [ ] JavaScript actions must bundle to `dist/`. The runner does not run `npm install`.
- [ ] Docker actions run only on Linux runners.
- [ ] Pin custom actions by full 40-character commit SHA for supply-chain integrity. Tags are mutable.
- [ ] OIDC requires `permissions: id-token: write`. Add `contents: read` (or whatever else you need)
  explicitly; nothing else is implicit.
- [ ] Cloud trust policies: AWS evaluates identity-provider controls on first edit of an OIDC trust
  policy. Vault 1.17+ requires `bound_audiences`. GCP requires claim mapping before conditions.
  Azure FIC count is limited per app.
- [ ] Immutable OIDC subject identifiers (numeric owner/repo IDs) reach GA after July 15, 2026.
  Dual-format trust policies may be needed during transition.
- [ ] Artifact v4+ uploads are immutable per name; downloads lose Unix modes unless the artifact is
  tarred. Hidden files are excluded by default.
- [ ] `pull_request` defaults to `opened`, `synchronize`, and `reopened` only — adding types requires
  explicit listing.
- [ ] Path filters cap at roughly 300 files in the diff. Very large pushes (>1,000 commits) bypass
  path filters and always run.
- [ ] Skipped matrix legs can leave required-check contexts unreported. Ensure every required context
  posts a status, even on skip.
- [ ] `github.event.pull_request` is absent in `merge_group` runs. Use `github.event.merge_group.*`
  instead.
