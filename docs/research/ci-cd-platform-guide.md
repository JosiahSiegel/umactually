# CI/CD platform guide

This directory is a reference set for creating and maintaining CI/CD
workflows in GitHub Actions and Azure DevOps Pipelines. It is written for
future maintainers who need to choose a platform, map concepts between the two
systems, or avoid common workflow and pipeline gotchas.

## Source policy

Prefer official product documentation, official source repositories, and
vendor-authored security guidance. Community posts and issue threads are useful
for gotchas, but should be treated as supporting evidence rather than the
primary source.

## References in this directory

- [GitHub Actions reference](./github-actions-reference.md) explains GitHub
  workflow YAML, custom actions, reusable workflows, security, OIDC,
  merge queues, caching, artifacts, and gotchas.
- [Azure DevOps Pipelines reference](./azure-devops-pipelines-reference.md)
  explains Azure pipeline YAML, tasks, templates, service connections,
  workload identity federation, secure resources, caching, artifacts, and
  gotchas.

This guide is the routing layer. It maps concepts between the two systems,
compares security and resource models, and collects cross-platform gotchas.
Open the platform-specific reference for syntax, snippets, and detailed
behavior.

## Quick platform routing

Use this section to decide which detailed reference to open first.

| Need | Start with |
| --- | --- |
| GitHub-native repository automation, checks, releases, or Marketplace actions | [GitHub Actions reference](./github-actions-reference.md) |
| Azure DevOps project pipelines, service connections, protected resources, or classic-to-YAML migration | [Azure DevOps Pipelines reference](./azure-devops-pipelines-reference.md) |
| Migration or cross-platform mapping | This guide |

Official overview docs to keep open:

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Azure Pipelines documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/)

## Concept map

The two systems organize automation differently. The table below maps the
common concepts. It is not a translation table. Several rows hide important
behavioral differences that the comparison sections below call out.

| Concept | GitHub Actions | Azure DevOps Pipelines |
| --- | --- | --- |
| Top-level automation file | Workflow in `.github/workflows/*.yml` | Pipeline, usually `azure-pipelines.yml` |
| Execution unit | Job (`jobs.<id>`) | Job inside a stage; stages group jobs |
| Command or action unit | Step (`run:`, `uses:`, or shell form) | Step or task (`script`, `bash`, `pwsh`, or `task: NAME@VER`) |
| Reusable multi-job flow | Reusable workflow with `on: workflow_call`, called via `uses:` on a caller job | YAML template included with `template:`, or `extends:` for enforced base pipelines |
| Reusable step bundle | Composite, JavaScript, or Docker action (`action.yml`) | Step template, custom task extension, or task group (Classic only) |
| Built-in repository token | `GITHUB_TOKEN` with `permissions:` block | `System.AccessToken` for the job access token; scripts must opt in to use it |
| Cloud federation | GitHub OIDC token via `id-token: write` permission | Workload identity federation on an ARM service connection |
| Deployment gate | Environment with protection rules and required reviewers | Environment, service connection, or agent pool with approvals and checks |
| Variables (non-secret) | Repository and environment variables | Pipeline, stage, job variables, and variable groups |
| Secrets | Encrypted at rest; referenced with `${{ secrets.NAME }}` | Encrypted variable groups, Key Vault links, and secret variables in variable groups |
| Cache primitive | `actions/cache` with a key and optional `restore-keys` | `Cache@2` with a key and optional `restoreKeys` |
| Artifact primitive | `upload-artifact` and `download-artifact` | `publish`/`download` or `PublishPipelineArtifact@1`/`DownloadPipelineArtifact@1` |
| Runner or agent | GitHub-hosted runner (`runs-on: ubuntu-latest`) or self-hosted runner in a pool | Microsoft-hosted agent (`vmImage:`) or self-hosted agent in a pool |
| Matrix or strategy | `strategy.matrix` with up to 256 jobs per run | `strategy.matrix` or `parallel` with a per-stage or per-job matrix |
| Conditions or expressions | `${{ }}` expressions on `if:`, `needs:`, and `outputs:` keys | `condition:` plus macro `$( )`, compile-time `${{ }}`, and runtime `$[ ]` syntaxes |
| Required status checks | Branch protection or rulesets with required jobs by name | Branch policies on Azure Repos, or required checks on GitHub/Bitbucket repos |
| Triggers | `on:` with `push`, `pull_request`, `merge_group`, `workflow_call`, `workflow_dispatch`, schedules | `trigger:`, `pr:`, `schedules:`, and `resources.pipelines:` trigger blocks |
| Concurrency control | `concurrency:` group with `cancel-in-progress` | No native equivalent; rely on pipeline-level locking or external state |

See the [GitHub Actions reference](./github-actions-reference.md) for
GitHub-specific sections and the [Azure DevOps Pipelines
reference](./azure-devops-pipelines-reference.md) for Azure-specific
sections.

## Security comparison

The two systems share the same goal (least-privilege execution) but expose
very different knobs. Read the [GitHub Actions security hardening
guide](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
and the [Azure DevOps protected resources
overview](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/resources)
before doing anything non-trivial.

### Repository token and permissions

| Topic | GitHub Actions | Azure DevOps Pipelines |
| --- | --- | --- |
| Default repository token | `GITHUB_TOKEN`, short-lived, scoped to the run | `System.AccessToken`, the job access token. Scripts must explicitly map it to `env:`; `persistCredentials: true` only leaves checkout credentials in Git config for later Git commands |
| Scopes | Declared in `permissions:` at workflow, job, or step level. Setting any key makes unspecified keys `none` | Granted on the project collection build service identity; granular scopes are limited and managed by admins |
| Least-privilege pattern | Start with `permissions: contents: read`, add scopes only where needed | Prefer variable groups and scoped identities over granting the build service identity broad access |
| Token in `pull_request` from forks | Read-only by default; cannot access secrets | Does not apply; Azure Pipelines does not run PR builds for Azure Repos from forks |

Details live in the [GitHub Actions reference permissions
section](./github-actions-reference.md#permissions-and-github_token) and
the Azure reference on tokens and pipelines.

### OIDC and workload identity federation

| Topic | GitHub Actions | Azure DevOps Pipelines |
| --- | --- | --- |
| Issuer | `https://token.actions.githubusercontent.com` | Microsoft Entra issuer `https://login.microsoftonline.com/.../v2.0` for new service connections; legacy Azure DevOps issuer being retired |
| Setup | `permissions: id-token: write` plus a cloud SDK action that exchanges the token | ARM service connection with workload identity federation; tasks like `AzureCLI@2` use `addSpnToEnvironment: true` |
| Audience | Per cloud (`sts.amazonaws.com`, `api://AzureADTokenExchange`, and so on) | The federated credential subject on the Entra app registration |
| Hard limits | None on the workflow side; cloud trust policies enforce limits | 20 federated identity credentials per app registration or user-assigned managed identity |
| Trust policy changes | Cloud trust policy must allow the workflow's repo, branch, environment, or tag | Federated credential must match the project's subject and audience |
| Token lifetime | Minted at step request, short-lived | App-registration tokens are short-lived (~1 hour); user-assigned managed identity tokens can last ~24 hours |

Plan around the
[WIF retirement timeline](https://devblogs.microsoft.com/devops/retirement-of-azure-devops-issuer-in-workload-identity-federation-service-connections/)
and the [GitHub OIDC in
Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
guide when migrating.

### Protected resources and approvals

| Topic | GitHub Actions | Azure DevOps Pipelines |
| --- | --- | --- |
| Environment | First-class object with protection rules, required reviewers, branch restrictions, and wait timers | Environment resource with approvals, branch control, and required-template checks |
| Service connections | Not a separate resource; cloud access flows through OIDC and long-lived secrets | Protected resource; pipelines must be granted access on each connection |
| Variable groups | Replaced by environment or repo variables | Protected resource when linked to Key Vault; gated by approvals |
| Secure files | Replaced by GitHub-hosted encrypted files or external secret managers | First-class protected resource with `DownloadSecureFile@1` |
| Agent pools | Runners can be self-hosted or GitHub-hosted; required reviewers not native to runner pools | Protected resource; pipelines must be granted access to private pools |
| Required-template enforcement | Not native; rely on convention or reusable workflows called via `workflow_call` | `extends:` plus a required-template check on the protected resource |

### Fork and third-party PR handling

| Topic | GitHub Actions | Azure DevOps Pipelines |
| --- | --- | --- |
| Fork PR builds | Run with read-only `GITHUB_TOKEN` and no secrets by default; opt in with explicit settings | Not supported for Azure Repos Git; external PRs require a separate fork-handling pipeline |
| Privileged checks on forks | Use `pull_request_target` with extreme care, or run a `workflow_run` after merge | Pipeline resources and manual triggers handle the equivalent flow |
| Cache write access from forks | Disabled by default for forks; `pull_request_target` can still write to default-branch caches | Caches are scoped to the project; fork PRs do not run in Azure Pipelines |

The GitHub Security Lab [pwn-request
article](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests)
is the canonical reference for fork PR risks.

## Cache and artifact comparison

Caches and artifacts look similar on both platforms but have different
retention rules, scope rules, and abuse cases. Details: [GitHub caching and
artifacts](./github-actions-reference.md#caching-and-artifacts) and [Azure
artifacts and cache](./azure-devops-pipelines-reference.md#artifacts-and-cache).

| Property | GitHub Actions cache | Azure DevOps cache | GitHub Actions artifact | Azure DevOps pipeline artifact |
| --- | --- | --- | --- | --- |
| Default task | `actions/cache@v4` | `Cache@2` | `actions/upload-artifact@v4` and `download-artifact@v4` | `publish:`/`download:` or `PublishPipelineArtifact@1`/`DownloadPipelineArtifact@1` |
| Scope | Branch-scoped, namespace per repo | Project-scoped, shared across pipelines in the project | Per run, per workflow | Per pipeline run |
| Lifespan | Caches not accessed for 7 days are evicted; storage is capped per repo (default 10 GB) | Immutable until evicted by retention policy or key churn; Azure cache entries are not secret storage | Configurable retention, default 90 days, can extend | Tied to pipeline retention policy |
| Immutability | Immutable per key | Immutable per key | Immutable per name in v4+ (re-upload deletes prior) | Immutable per name |
| Best for | `node_modules`, build outputs, compiler caches | `node_modules`, NuGet, Pip, Maven caches | Build outputs, test reports, SBOMs, logs | Build outputs, drop folders, signed binaries |
| Secret safe? | No. Cache poisoning is a real risk | No. Treat cache contents as public | No. Artifacts are downloadable by anyone with read access | No. Pipeline artifacts follow pipeline permissions |
| Cross-run reuse | Branch namespace plus default branch fallback | Project-wide key namespace | Same name across jobs in a run | Same name across stages in a pipeline |
| Restore-keys or restoreKeys | `restore-keys:` list, evaluated in order | `restoreKeys:` list, evaluated in order | Not applicable | Not applicable |
| Path quoting | No path-like segments; key is a free-form string | Quote path-like segments because cache keys treat them as files | Glob patterns in `path:` | Folder paths under `$(Pipeline.Workspace)` |

### Cache poisoning (both platforms)

Caches are a known attack surface. A malicious PR can plant an entry in a
shared cache namespace that the next trusted run restores. Defenses:

- Use narrow keys (`hashFiles('**/package-lock.json')`, lockfile hash, OS).
- Treat caches as untrusted input. Verify hashes of cached artifacts before
  loading them into a build.
- Avoid caching build outputs that get linked into the final binary.
- On GitHub, never restore or save caches from `pull_request_target` runs.
- On Azure, do not rely on caches for security-critical toolchains.

The [TanStack cache poisoning
postmortem](https://blog.tanstack.com/cache-poisoning-postmortem) is the
canonical public example.

## Expression and timing comparison

Expressions look similar on both platforms but evaluate at very different
points in the run lifecycle. A condition that works in GitHub can silently
expand to a stale or compile-time-empty value in Azure, and vice versa.
Full grammar: [GitHub expressions
reference](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions)
and [Azure Pipelines expressions
reference](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/expressions).

| Syntax | GitHub Actions | Azure DevOps Pipelines |
| --- | --- | --- |
| Single evaluation pass | `${{ }}` expressions on workflow keys are evaluated when the run starts | Compile-time `${{ }}` and macro `$( )` evaluate before the run; runtime `$[ ]` evaluates during the run |
| Contexts available | `github`, `env`, `vars`, `secrets`, `inputs`, `matrix`, `needs`, `strategy`, `runner` | `variables`, `parameters`, and pre-defined runtime variables like `$(Build.BuildId)` |
| Available at compile time | `github.event`, `github.ref`, `inputs.*`, `secrets.*` (read-only) | `parameters.*`, `variables.*` declared at root, and a small set of pre-defined variables |
| Available at runtime | Most contexts plus step outputs via `${{ steps.x.outputs.y }}` | Runtime metadata via `$[ ]`, including agent and build variables |
| Skipping a step or job | `if: ${{ condition }}` on a step or job | `condition:` on a stage, job, or step |
| Default success check | Implied: steps and jobs run if their predecessors succeeded | `succeeded()` is implicit but a custom `condition:` replaces it |
| Conditional defaults | `if: always()`, `if: failure()`, `if: cancelled()` | `succeededOrFailed()`, `always()`, `failed()`, `canceled()` |
| Matrix | `strategy.matrix` with up to 256 jobs per run | `strategy.matrix` or `parallel` per stage or job |
| Iteration over dynamic lists | `fromJSON(needs.x.outputs.lists)` style with `matrix.include`/`exclude` | Variable groups and parameters, no native dynamic matrix |
| Expansion inside trigger blocks | Not applicable (triggers live in `on:`) | Macro syntax `$( )` does not expand inside `trigger:`, `pr:`, or `resources:` blocks |
| Functions | `contains`, `startsWith`, `endsWith`, `format`, `join`, `toJSON`, `fromJSON` | `eq`, `ne`, `and`, `or`, `not`, `contains`, `startsWith`, `endsWith`, `format`, `coalesce`, `in`, `iif` |

### Timing traps

- GitHub `${{ }}` evaluates at the start of the run. A condition that reads
  a step output must use `${{ steps.x.outputs.y }}`; using `$[ ]` style does
  not exist. Conditionals cannot read runtime values that are produced after
  the run starts.
- Azure `$( )` macros expand on the agent right before each task runs, so
  they see variables set in earlier steps of the same job via `##vso[task.setvariable]`.
  Macros do not expand in `trigger:`, `pr:`, `resources:`, or `checkout` keys.
- Azure `${{ }}` is compile-time and cannot read runtime values. Use `$[ ]`
  for any expression that must see values produced during the run.
- Azure `$[ ]` is runtime. Condition keys like `condition:` that need a
  runtime value must use `$[ ]` or rely on `variables` resolved through the
  agent.

When porting a condition between platforms, verify the evaluation timing on
the destination. A condition that depends on `github.event.pull_request` in
GitHub must use `github.event.merge_group.*` on a `merge_group` run; an Azure
condition that compares `$(Build.SourceBranch)` at runtime must use `$[ ]` if
the variable is set late in the run.

## Migration checklist

The list below is the minimum due diligence for moving a pipeline between
platforms. Treat each item as a checklist entry, not a one-line search and
replace.

### Identity and secrets

- [ ] Inventory every secret, variable, and access token the current pipeline
  uses. Decide where each one moves (environment secrets, variable group,
  Key Vault link, federated credential).
- [ ] For each cloud deployment, prefer OIDC or workload identity federation
  over long-lived secrets. Configure trust policies and audiences explicitly.
- [ ] On Azure DevOps, migrate ARM service connections to WIF before the
  Azure DevOps issuer retirement date.
- [ ] On GitHub, pin custom actions by full 40-character commit SHA if
  supply-chain integrity matters.
- [ ] Confirm that secret scopes on the destination match the source's
  principle of least privilege.

### Triggers and required checks

- [ ] Map the trigger vocabulary. `on: push` plus `on: pull_request` plus
  `on: merge_group` becomes `trigger:`, `pr:`, and pipeline-resource triggers.
- [ ] Make sure every check required by branch protection or rulesets is
  produced by a workflow that runs on the right event. On GitHub, required
  checks must include `merge_group` if the repo uses a merge queue.
- [ ] On Azure DevOps, configure required checks through branch policies for
  Azure Repos Git, since `pr:` YAML does not apply there.
- [ ] Confirm UI trigger overrides. Azure DevOps project settings can
  override YAML triggers and silently disable them.

### Reusable building blocks

- [ ] Decide whether each reusable piece should become a reusable workflow,
  a composite action, a YAML template, or a custom task.
- [ ] Audit secret flow. Reusable workflows on GitHub pass secrets only one
  hop and do not pass environment secrets through `workflow_call` at all.
- [ ] On Azure DevOps, decide between includes and `extends`. `extends` is
  the enforcement primitive when you want required-template checks on
  protected resources to block bypass.
- [ ] Mind the limits: 256 jobs per GitHub workflow run, 100 included YAML
  files and 100 nesting levels on Azure.

### Caches and artifacts

- [ ] Reproduce cache keys on the destination. Both platforms treat
  path-like segments in keys differently; quote segments that look like
  paths on Azure.
- [ ] Re-establish retention windows. Artifact retention defaults differ
  (90 days on GitHub, pipeline retention policy on Azure).
- [ ] Re-verify that nothing stores secrets in caches. The risk is
  identical on both platforms.

### Expressions and conditions

- [ ] Convert expressions carefully. Do not translate `${{ }}` to `$( )`
  mechanically. Match the destination's evaluation timing.
- [ ] Replace any custom `condition:` on Azure with a form that explicitly
  includes `succeeded()` when the default success behavior must be kept.
- [ ] On GitHub, branch payload access so the same workflow works for both
  `pull_request` and `merge_group` events. `github.event.pull_request` is
  absent in `merge_group` runs.

### Testing and rollout

- [ ] Run the new pipeline end-to-end against a staging environment before
  cutting the protected-resource approvals.
- [ ] Verify deployment approvals, branch policies, and rulesets on the
  real platform, not in YAML.
- [ ] Keep a parallel run window. Most rollouts run both pipelines until
  the new one has produced clean required checks for at least one full
  sprint.

## Cross-platform gotchas summary

A condensed list of foot-guns that map directly to the two references. Each
line points to the relevant section in the platform reference for details.

### GitHub-specific

- **Required checks must include `merge_group` if the repo uses a merge
  queue.** A workflow that only runs on `pull_request` will not produce the
  status the queue is waiting for, and PRs stall. See [Merge queues and
  merge_group](./github-actions-reference.md#merge-queues-and-merge_group).
- **`pull_request_target` runs with write permissions against the base
  branch.** Never check out and execute head-branch code in that job. The
  [secure use of
  `pull_request_target`](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
  guide describes the label-gate and `workflow_run` patterns.
- **Reusable workflow secrets pass only one hop.** Pass secrets explicitly
  to nested calls. Environment secrets do not pass through `workflow_call`
  at all.
- **Cache poisoning from `pull_request_target`.** That trigger can write to
  the default-branch shared cache namespace, allowing a malicious PR to
  plant a cache entry that the next trusted run restores. Avoid restoring
  or saving caches in `pull_request_target` jobs.
- **Caches are unsafe for secrets in general.** Branch-scoped and immutable
  caches are a poor secret store. Treat them as untrusted input.
- **Setting one `permissions:` key makes every unspecified permission
  `none`.** Always declare the full set you intend.
- **`github.event.pull_request` is absent in `merge_group` runs.** Use
  `github.event.merge_group.*` instead, and branch payload access on
  `github.event_name`.

### Azure DevOps-specific

- **Protected resources gate access, not just permissions.** Service
  connections, agent pools, environments, variable groups, secure files,
  and repositories are all protected. Pipelines must be granted access on
  each one. See [Environments, approvals, and
  checks](./azure-devops-pipelines-reference.md#environments-approvals-and-checks).
- **Custom `condition:` replaces the default `succeeded()` check.** Include
  `succeeded()` explicitly when you want the normal behavior preserved.
- **Three expression syntaxes evaluate at different times.** `$( )` macro,
  `${{ }}` compile-time, and `$[ ]` runtime each see a different slice of
  state. Macro syntax does not expand in `trigger:`, `pr:`, or `resources:`
  keys.
- **WIF service connection names, not Azure subscription names, are what
  YAML references.** `azureSubscription: 'name'` takes the service
  connection name.
- **Federated credential subject and audience must match.** Hard limit is
  20 federated identity credentials per app registration or user-assigned
  managed identity. Plan a rotation strategy before exhausting the slots.
- **App-registration tokens are short-lived (~1 hour); UAMI tokens can
  last ~24 hours.** Long-running jobs that hold a token across hours need
  to plan for expiry on the UAMI side.
- **Secure files run in the pre-job phase.** `DownloadSecureFile@1` always
  runs before the job, regardless of where it appears in the YAML, and
  exposes the local path as `$(<stepName>.secureFilePath)`. Secure files
  cannot be selected with runtime expressions; the file name must be known
  at compile time.
- **Variable-group names must resolve at compile time.** A group name
  built from a runtime variable fails with an authorization error because
  the orchestrator cannot preauthorize access.
- **Untyped parameters are strings.** `"false"` is truthy in expressions
  unless the parameter is typed `boolean` or compared explicitly.
- **UI trigger settings can override YAML.** When the "Override the YAML
  continuous integration trigger" project setting is on, the YAML value is
  ignored in favor of whatever the UI has saved.
- **`pr:` YAML does not apply to Azure Repos Git.** Pull request builds for
  Azure Repos are configured through branch policies, not the pipeline YAML.
- **Tags-based triggers need explicit `tags:` configuration.** The default
  branch-based trigger does not fire on tag pushes alone.
- **Pipeline resource triggers must be declared in the root pipeline
  file.** Templates cannot declare them.
- **Custom-task Node 20 handler is `Node20_1`, not `Node20`.** The plain
  `Node20` value is treated as unknown by modern agents.

### Both platforms

- **Required checks can stall if the event that produces the required
  context does not run on the commit or ref being merged.** Audit each
  required check and confirm it triggers on the relevant event.
- **Caches are not secret stores on either platform.** Both have cache-scope
  rules and poisoning risks.
- **Inline scripts are injection surfaces when fed untrusted event payload
  data.** Map and validate event inputs before passing them to a shell.
- **Reusable building blocks are not equivalent.** GitHub reusable workflows
  run as jobs, while Azure templates expand before the run.
- **Deployment approvals usually live outside the YAML author's direct
  control** and should be tested in the real platform before relying on
  them.
- **Pin third-party and custom building blocks by an immutable reference
  (commit SHA, package version, task version).** Major tags can be
  re-pointed.

## See also

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Azure Pipelines documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/)
- [GitHub Actions security hardening
  guide](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Azure DevOps protected resources
  overview](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/resources)
- [GitHub OIDC
  documentation](https://docs.github.com/en/actions/concepts/security/openid-connect)
- [Azure Pipelines workload identity
  configuration](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/configure-workload-identity)
