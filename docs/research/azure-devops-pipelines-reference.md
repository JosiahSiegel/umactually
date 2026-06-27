# Azure DevOps Pipelines reference

This document is a reference for authoring and operating Azure DevOps
Pipelines. It covers the YAML pipeline schema, reusable components,
templates, tasks, secure resources, workload identity federation, and the
gotchas that show up in real pipelines. Use it together with the [CI/CD
platform guide](./ci-cd-platform-guide.md) when comparing concepts to GitHub
Actions.

## Source policy

Prefer Microsoft Learn, the Azure DevOps YAML schema repository, the
`azure-pipelines-tasks` and `azure-pipelines-task-lib` repositories, and
Microsoft DevBlogs release notes. GitHub issues from those repositories are
useful for gotchas but should be treated as supporting evidence, not as the
primary source.

## Pipeline file conventions

The conventional pipeline file is `azure-pipelines.yml` at the root of the
repository. The path can be changed in the pipeline settings UI when you
create or edit a pipeline, but most projects stick to the convention so that
new contributors find the file without instruction.

YAML pipelines are stored alongside the code, so the file path becomes part
of the pipeline's identity. Renaming or moving the file in source control
disables the existing pipeline until you repoint it.

## Root YAML schema

The root of a pipeline YAML file is a single mapping. Its top-level keys
include `name`, `trigger`, `pr`, `schedules`, `resources`, `variables`,
`parameters`, `pool`, `stages`, `jobs`, `steps`, `extends`, and a small set of
configuration keys like `lockBehavior`. Exactly one of `stages`, `jobs`,
`steps`, or `extends` should appear at the root.

The canonical example of a complete root schema lives in the
[pipeline YAML schema reference](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/pipeline).

```yaml
# azure-pipelines.yml
name: $(Date:yyyyMMdd)-$(Rev:r)

trigger:
  branches:
    include:
      - main
      - release/*
  paths:
    exclude:
      - docs/**

pr:
  branches:
    include:
      - main

schedules:
  - cron: "0 6 * * Mon"
    displayName: Weekly build
    branches:
      include:
        - main
    always: false

resources:
  pipelines:
    - pipeline: upstream
      source: lib-build
      trigger: true
  repositories:
    - repository: tools
      type: git
      name: Common/tools

variables:
  - name: buildConfiguration
    value: Release
  - group: prod-vars

parameters:
  - name: deploy
    type: boolean
    default: false

pool:
  vmImage: ubuntu-latest

stages:
  - stage: Build
    displayName: Build artifacts
    jobs:
      - job: BuildJob
        steps:
          - checkout: self
          - task: UseDotNet@2
            inputs:
              version: 8.x
          - script: dotnet build --configuration $(buildConfiguration)
```

A useful mental model: Azure Pipelines YAML is not full YAML. Anchors,
complex keys, and YAML sets are not supported. The order of the first
mapping keys matters for stages, jobs, and tasks because of how the parser
recognizes the document shape. See the [YAML schema index](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema)
for the full list of recognized types.

## Triggers

Azure DevOps supports three trigger families on the root pipeline:
continuous integration (`trigger`), pull request validation (`pr`), and
scheduled (`schedules`).

### Continuous integration

```yaml
trigger:
  branches:
    include:
      - main
      - feature/*
    exclude:
      - feature/experimental-*
  tags:
    include:
      - v*
  paths:
    include:
      - src/**
    exclude:
      - docs/**
```

If `trigger:` is omitted, behavior is governed by the project setting "Override
the YAML continuous integration trigger from the pipeline settings UI". When
that setting is enabled, the YAML value is ignored in favor of whatever the
UI has saved. This is one of the most common sources of "my trigger does not
work" reports, and is documented in
[Troubleshoot pipeline triggers](https://learn.microsoft.com/en-us/azure/devops/pipelines/troubleshooting/troubleshoot-triggers).

### Pull request validation

```yaml
pr:
  branches:
    include:
      - main
  drafts: false
  autoCancel: true
```

The `pr:` key only applies to GitHub and Bitbucket Cloud repositories. It
does not work for Azure Repos Git repositories; pull request builds in Azure
Repos are configured through branch policies, not through the pipeline YAML.
This is documented under the [pr YAML schema reference](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/pr).

### Scheduled triggers

```yaml
schedules:
  - cron: "0 6 * * Mon-Fri"
    displayName: Weekday morning build
    branches:
      include:
        - main
    always: false
    batch: true
```

Cron expressions are evaluated in UTC. There is no project setting that
switches scheduled triggers to local time, so plan for the offset or anchor
the schedule to a known timezone like UTC explicitly.

### Pipeline resources as triggers

A pipeline can also be triggered by another pipeline through a `pipeline`
resource:

```yaml
resources:
  pipelines:
    - pipeline: upstream
      source: lib-build
      trigger:
        branches:
          include:
            - main
        stages:
          - Completed
        tags:
          include:
            - v*
```

Pipeline resource triggers cannot be configured inside templates. The
`trigger` block under `resources.pipelines` must exist in the root pipeline
file, because that is the file the orchestrator reads to decide whether to
queue downstream runs.

## Agents and pools

A pipeline runs on an agent hosted in a pool. There are two main pool kinds:
Microsoft-hosted agents selected by `vmImage`, and self-hosted agents
selected by `name` or `demands`.

```yaml
pool:
  vmImage: ubuntu-latest
```

```yaml
pool:
  name: MySelfHostedAgents
  demands:
    - Agent.OS -equals Linux
    - npm -equals true
  timeoutInMinutes: 60
```

Demands are matched against agent capabilities. `Agent.OS`, `Agent.OSArchitecture`,
`Agent.Name`, and any custom capability added during agent configuration are
typically used. Demands can also be expressed on a specific job or step to
gate execution on capability matching.

Microsoft-hosted agent images are predefined virtual machine images such as
`ubuntu-latest`, `windows-latest`, `macos-latest`, and pinned versions like
`ubuntu-22.04`. Pinning a version is recommended when reproducibility matters
more than staying current with toolchain updates.

## Stages, jobs, and steps

A pipeline is a hierarchy: stages contain jobs, jobs contain steps. Stages
are sequential by default; jobs within a stage run in parallel unless they
declare dependencies.

```yaml
stages:
  - stage: Build
    displayName: Build
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Building"
            displayName: Compile
  - stage: Test
    displayName: Test
    dependsOn: Build
    jobs:
      - job: TestJob
        steps:
          - script: echo "Testing"
```

To run stages in parallel, declare `dependsOn: []` to remove the implicit
dependency on every previous stage:

```yaml
stages:
  - stage: A
    displayName: Stage A
    dependsOn: []
    jobs:
      - job: A1
        steps:
          - script: echo A
  - stage: B
    displayName: Stage B
    dependsOn: []
    jobs:
      - job: B1
        steps:
          - script: echo B
```

Deployment jobs are a special job type that targets an environment:

```yaml
- stage: Deploy
  displayName: Deploy to prod
  jobs:
    - deployment: ProdDeploy
      environment: prod
      strategy:
        runOnce:
          deploy:
            steps:
              - script: echo Deploying
```

Deployment jobs have lifecycle hooks (`preDeploy`, `deploy`, `routeTraffic`,
`postRouteTraffic`, `on: failure`, `on: success`) and auto-download pipeline
artifacts produced by earlier stages. The artifact download behavior is one
of the reasons deployment jobs are preferred for production releases.

### Conditions

Conditions control whether a stage, job, or step runs. A custom condition
replaces the default `succeeded()` check, so include it explicitly when
you want the normal behavior preserved.

```yaml
- job: DeployJob
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  steps:
    - script: echo "Deploying to main"
```

```yaml
- script: echo "Only on tags"
  condition: startsWith(variables['Build.SourceBranch'], 'refs/tags/')
```

For conditions to short-circuit work that should not run, prefer `condition`
over skipping in script bodies. Skipping in scripts still costs agent time
and obscures the pipeline graph. See
[Specify conditions](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/conditions)
for the full expression grammar.

## Variables, secrets, parameters, and expressions

### Variables

Variables can be defined at the root, per stage, per job, or inline in steps.
They are referenced with three different syntaxes, each evaluated at a
different time.

```yaml
variables:
  - name: foo
    value: bar
  - group: prod-vars
```

```yaml
steps:
  - script: echo $(foo)             # macro: expanded before each task
  - script: echo ${{ variables.foo }} # compile-time: expanded before the run
  - script: echo $[ variables.foo ]   # runtime: expanded during the run
```

The macro syntax `$(var)` is processed by the agent before the task runs and
does not expand in compile-time-only keys such as `resources`, `trigger`, or
checkout refs. The compile-time syntax `${{ }}` runs before the run starts,
so runtime metadata (for example `$(Agent.JobName)`) is not yet known. The
runtime syntax `$[ ]` runs during the run and is the only syntax that sees
values set in earlier steps of the same job. The full model is in the
[runs processing order](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/runs)
documentation.

### Secrets

Secret variables are masked in logs and must be passed to tasks through
`env:` mappings, not by inlining them into script arguments. The agent will
refuse to print their values, but it cannot stop you from echoing them
through a script, so the security boundary is the script's discipline.

```yaml
variables:
  - name: MY_TOKEN
    value: $(SECRET_TOKEN)   # secret variable from a group

steps:
  - script: |
      echo "##vso[task.setvariable variable=output;issecret=true]hidden"
      curl -H "Authorization: Bearer $MY_TOKEN" "$URL"
    env:
      MY_TOKEN: $(MY_TOKEN)
```

Inlining secrets into scripts invites two problems: the value may appear in
debug output, and the substitution happens in the agent's shell before the
script runs, where quoting is unpredictable.

### Parameters

Parameters are inputs supplied at queue time, typed, and constrained to a
fixed set of values when typed as `string`, `boolean`, `number`, or `step`
lists. Untyped parameters are strings, so `false` as a default is the string
`"false"`, which is truthy in expressions unless the parameter is typed
`boolean` or compared explicitly.

```yaml
parameters:
  - name: environment
    type: string
    default: dev
    values:
      - dev
      - staging
      - prod
  - name: deploy
    type: boolean
    default: false
```

Parameters are resolved at compile time and become constants for the run.
They are commonly used to switch between deploy and build-only modes or to
pick a target environment.

### Expressions

Expressions combine variables, parameters, functions, and operators. Useful
functions include `eq`, `ne`, `and`, `or`, `not`, `contains`, `startsWith`,
`endsWith`, `format`, `coalesce`, `in`, and the newer `iif`. The full
function list lives in the
[expressions reference](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/expressions).

## Templates, includes, and extends

Templates are reusable YAML fragments. There are two ways to use them:
includes and `extends`.

### Includes

```yaml
# azure-pipelines.yml
stages:
  - template: stages/build.yml
    parameters:
      buildConfiguration: Release
  - template: stages/test.yml
    parameters:
      testSet: unit
```

```yaml
# stages/build.yml
parameters:
  - name: buildConfiguration
    type: string
    default: Debug
steps:
  - script: echo Building ${{ parameters.buildConfiguration }}
```

Includes can be used for steps, jobs, stages, and variables. Parameters
become compile-time constants inside the template.

### Extends

`extends` is the security primitive. A pipeline that extends a template is
subject to validation rules declared in that template, including disallowed
steps and required template references.

```yaml
# azure-pipelines.yml
extends:
  template: base-pipelines/secure-base.yml
  parameters:
    serviceConnection: my-service-connection
```

When a template enforces checks such as "extend this template" on a
protected resource, pipelines that bypass it lose access to that resource.
That is the mechanism that makes templates enforceable rather than merely
conventional. See
[Use templates for security](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/templates)
for the enforcement model.

Template expansion has hard limits: 100 included YAML files, 100 nesting
levels, and a 20 MB parse memory ceiling. These limits are rarely hit on
small projects but show up in monorepos that compose large template graphs.

Cross-repo templates only contribute YAML to the consuming pipeline. Scripts
from the template repo are not automatically checked out; if your template
relies on scripts, package them or check them out separately.

## Tasks and custom tasks

A step is either a script (`script`, `bash`, `pwsh`, `powershell`) or a
task. Tasks are reusable units with inputs and outputs declared in a
manifest.

### Built-in and Marketplace tasks

```yaml
steps:
  - task: DotNetCoreCLI@2
    inputs:
      command: build
      projects: "**/*.csproj"
  - task: PublishPipelineArtifact@1
    inputs:
      targetPath: $(Build.ArtifactStagingDirectory)
      artifact: drop
```

The full task catalog is in the
[task reference index](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/).
Each task reference documents the input contract, supported versions, and
known issues.

### Custom tasks

Custom tasks are packaged as VSIX extensions with a `vss-extension.json`
manifest at the extension root and a `task.json` per task. A typical
`task.json` declares the execution handler, inputs, and output variables.

```json
{
  "id": "MyTask",
  "name": "MyTask",
  "friendlyName": "My Custom Task",
  "description": "Runs MyTool on the agent",
  "author": "Contoso",
  "helpUrl": "https://example.com/help",
  "category": "Utility",
  "minimumAgentVersion": "3.224.0",
  "execution": {
    "Node20_1": {
      "target": "src/index.js"
    }
  },
  "inputs": [
    { "name": "command", "type": "string", "required": true }
  ]
}
```

A few details that bite custom-task authors:

- The Node 20 handler is `Node20_1`, not `Node20`. The plain `Node20` value
  is treated as unknown by modern agents. Newer tasks may also include
  `Node24`. The handler list lives in the
  [azure-pipelines-task-lib](https://github.com/microsoft/azure-pipelines-task-lib)
  repository.
- Inputs can be primitives, file refs, `secureFile`, pick lists, radio
  buttons, identity controls, or a service connection picker using
  `connectedService:<type>`.
- Server and ServerGate tasks are agentless and cannot run Node or
  PowerShell handlers; they execute an HTTP request or Service Bus call.
- The VSIX package limit is 50 MB. Production dependencies should be
  packaged, not dev dependency trees.
- Republishing the same task version is ignored by the agent cache. Bump
  the patch or major version to push a new build.
- Task groups are a Classic-pipelines construct and project-scoped; YAML
  templates replace them for YAML pipelines.

Output variables should be declared in the task manifest so that the editor
and UI surface them. Tasks can also call `##vso[task.setvariable]` and
`##vso[task.settaskvariable]` logging commands to set values for the rest
of the job or the rest of the task, respectively.

## Environments, approvals, and checks

Environments are protected resources that group deployment targets and
attach checks. Common check types include approvals, branch control, and
required templates.

```yaml
- stage: Deploy
  jobs:
    - deployment: ProdDeploy
      environment: prod
      strategy:
        runOnce:
          deploy:
            steps:
              - script: echo Deploying
```

The configuration of approvals, branch policies, and required templates is
done on the environment itself, not in YAML. To require that pipelines
extending a particular template have access to an environment, add a
required template check that references the template.

Other protected resources follow the same model: agent pools, repositories,
service connections, variable groups, and secure files all gate access
through the same approval and check framework. The
[protected resources overview](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/resources)
covers the full list and how to update pipeline permissions through REST.

## Artifacts and cache

### Pipeline artifacts

```yaml
steps:
  - publish: $(Build.ArtifactStagingDirectory)
    artifact: drop
```

In a downstream pipeline:

```yaml
resources:
  pipelines:
    - pipeline: upstream
      source: lib-build

steps:
  - download: upstream
    artifact: drop
    path: $(Pipeline.Workspace)/upstream
```

### Cache

The `Cache@2` task restores a cache before the job and saves it after. Cache
keys treat path-like segments as files, so quote string segments that look
like paths.

```yaml
- task: Cache@2
  inputs:
    key: 'npm | "$(Agent.OS)" | package-lock.json'
    restoreKeys: |
      npm | "$(Agent.OS)"
      npm
    path: $(Pipeline.Workspace)/.npm
```

Caches are immutable. Restoring a key that was saved by another pipeline
returns the same byte stream; modifying a cache requires a new key.
Restoring succeeds on a partial key match when one of the `restoreKeys` is a
prefix of an existing key.

Caches are not secret stores. Anyone with pipeline write access can pull a
cache and inspect it; treat cache contents as public.

## Service connections and protected resources

Service connections (also called service endpoints) are references to
external systems, including Azure subscriptions, GitHub repositories,
Docker registries, and generic REST endpoints. In task inputs, the
`azureSubscription` value is the service connection name, not the Azure
subscription name or ID.

```yaml
- task: AzureWebApp@1
  inputs:
    azureSubscription: 'my-service-connection'
    appName: 'my-app'
    package: '$(Pipeline.Workspace)/drop'
```

Service connections are protected resources. By default, pipelines cannot
use a service connection until they have been granted access, either by
project administrators (open access) or by an explicit grant from the
service connection owner. Treat "allow all pipelines" as a last resort.

## Workload identity federation

Workload identity federation (WIF) lets Azure DevOps exchange a short-lived
token for an Azure access token without storing a service principal
secret. For Azure Resource Manager service connections, WIF has replaced the
older secret and certificate flows as the recommended path.

Microsoft is migrating ARM service connections from the legacy Azure DevOps
issuer (`https://vstoken.dev.azure.com/...`) to the Microsoft Entra issuer
(`https://login.microsoftonline.com/.../v2.0`). Per the
[retirement blog](https://devblogs.microsoft.com/devops/retirement-of-azure-devops-issuer-in-workload-identity-federation-service-connections/),
new WIF service connections use the Entra issuer by default starting in
November 2025, the Azure DevOps issuer is deprecated on 2026-07-01, and the
Azure DevOps issuer is retired on 2027-07-01 for public-cloud supported
scenarios. Plan migrations before those dates; sovereign clouds, Azure
Stack, and multitenant app scenarios may need to remain on the Azure DevOps
issuer until support catches up.

The `AzureCLI@2` task exposes the federated identity through
`addSpnToEnvironment`:

```yaml
- task: AzureCLI@2
  inputs:
    azureSubscription: 'my-wif-connection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    addSpnToEnvironment: true
    inlineScript: |
      echo "Tenant: $tenantId"
      echo "Client: $servicePrincipalId"
      az login --service-principal -u "$servicePrincipalId" -t "$tenantId" --federated-token "$idToken"
      az account show
```

The environment variables populated by `addSpnToEnvironment` include
`servicePrincipalId`, `idToken`, and `tenantId`. Older scripts may still
reference `servicePrincipalKey` for compatibility, but the federated flow
does not produce one.

A few operational facts to plan around:

- Hard limit: 20 federated identity credentials per app registration or
  user-assigned managed identity. Plan a rotation strategy before you
  exhaust the slots.
- App-registration tokens are short-lived (about one hour). User-assigned
  managed identity tokens can be valid much longer (around 24 hours).
  Long-running jobs that hold a token across hours need to account for
  expiry on the UAMI side.
- Converting an existing service connection in product is only supported
  for connections that Azure DevOps created and that are not shared across
  projects. Azure DevOps-created connections have a 7-day revert window.
- Some Azure tasks do not support WIF in older major versions. Bump the
  task version before converting the service connection or you will see
  failures on tasks that still expect a secret.

The full setup walkthrough is in
[Configure a workload identity service connection](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/configure-workload-identity)
and
[Connect to Azure with an ARM service connection](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/connect-to-azure).

## Variable groups, secure files, and Key Vault

### Variable groups

Variable groups are sets of variables scoped to a project or shared across
projects. They can store non-secret values or be linked to Azure Key Vault
for secrets.

```yaml
variables:
  - group: prod-vars
```

When a variable group is linked to Key Vault, only Key Vault secrets are
mapped to the variable group. Keys and certificates in Key Vault are not
exposed. Adding or removing secrets in Key Vault does not automatically
update the variable group; you must re-link the group to refresh the
mapping.

Variable groups are protected resources. Non-secret variables are not gated
by approvals and checks; secrets are. Variable-group names referenced in
YAML must resolve at compile time. A group name built from a runtime
variable will fail with an authorization error because the orchestrator
cannot preauthorize access.

### Secure files

Secure files are encrypted files up to 10 MB, such as certificates, signing
keys, or kubeconfigs.

```yaml
- task: DownloadSecureFile@1
  name: caCert
  inputs:
    secureFile: 'ca-bundle.p12'
- script: |
    echo "Cert at $(caCert.secureFilePath)"
    openssl pkcs12 -in "$(caCert.secureFilePath)" -nokeys
```

`DownloadSecureFile@1` runs in the pre-job phase regardless of where it
appears in the YAML, and exposes the local path as
`$(<stepName>.secureFilePath)`. Secure files cannot be selected with
runtime expressions; the file name must be known at compile time.

A historical failure class is the expired-download-ticket error, which in
older `securefiles-common` versions would write a JSON error blob into the
target file even though the task reported success. Newer task versions
detect non-200 responses, but pin your agent and task versions and validate
the resulting file in scripts that depend on it.

### Key Vault variable groups vs AzureKeyVault@2

`AzureKeyVault@2` is a task that fetches secrets at the start of a job. Its
`RunAsPreJob` input controls whether secrets are available to every task in
the job or only inside the task's scope.

```yaml
- task: AzureKeyVault@2
  inputs:
    azureSubscription: 'my-wif-connection'
    KeyVaultName: 'my-vault'
    SecretsFilter: 'DbPassword,ApiToken'
    RunAsPreJob: true
```

A Key Vault-linked variable group behaves differently: there is no per-task
control, and secrets are loaded like any other variable group. The two
mechanisms do not have the same scope control, so choose deliberately.

Private Key Vault configurations (private endpoints, RBAC-only data plane)
are tricky with Azure DevOps. Azure DevOps is not a trusted service for
private-endpoint RBAC vaults. Common workarounds include:

- Use the Key Vault access policy model instead of RBAC.
- Run a self-hosted agent inside the VNet so it can reach the vault.
- Open temporary firewall rules for Microsoft-hosted agent IP ranges, which
  rotate frequently.

The 2027 Key Vault RBAC default and API retirement (2026-02-01 data plane
API retirement) is also worth tracking, because the access-policy workaround
may eventually need migration.

## Gotchas checklist

A short, scannable list of things that have actually caused confusion in
real pipelines.

### YAML parsing

- Azure Pipelines YAML is not full YAML. Anchors, complex keys, and YAML
  sets are unsupported. The first mapping keys like `stage`, `job`, and
  `task` matter for parser recognition.
- Always quote version-like values (for example `Node20_1`) when needed.

### Trigger gotchas

- UI trigger settings override YAML when the "Override the YAML continuous
  integration trigger" project setting is on.
- `pr:` YAML does not work for Azure Repos Git. Configure pull request
  builds through branch policies.
- Scheduled triggers run in UTC.
- Pipeline resource triggers must be declared in the root pipeline file,
  not inside a template.
- Tags-based triggers need explicit `tags:` configuration; the default
  branch-based trigger will not fire on tag pushes alone.

### Stages and jobs

- Stages run sequentially by default. Use `dependsOn: []` to run in
  parallel.
- Custom `condition:` replaces the default `succeeded()` check; include
  `succeeded()` explicitly when desired.
- Deployment jobs auto-download artifacts produced by earlier stages.

### Variables and expressions

- Three syntaxes evaluate at different times: `$( )` macro, `${{ }}`
  compile-time, `$[ ]` runtime. Choose the one whose timing matches the
  value's lifetime.
- Macro syntax does not expand in compile-time-only keys like `resources`,
  `trigger`, or checkout refs.
- Untyped parameters are strings. `"false"` is truthy in expressions unless
  the parameter is typed `boolean` or compared explicitly.
- Secret variables are masked in logs but not in scripts. Map them to
  `env:` rather than inlining them.

### Templates and decorators

- Templates must exist at the start of the run; they cannot come from
  pipeline artifacts.
- Template expansion limits: 100 included files, 100 nesting levels, 20 MB
  parse memory.
- Cross-repo templates contribute YAML only; scripts from the template repo
  are not auto-checked out.
- Pipeline decorators are private, high-privilege extensions that inject
  steps. They see task GUIDs, not task names.

### Tasks

- Custom-task Node 20 handler is `Node20_1`, not `Node20`. Newer tasks may
  use `Node24`.
- VSIX package limit is 50 MB.
- Republishing the same task version is ignored by the agent cache; bump
  the version.
- Server/ServerGate tasks are agentless and cannot run Node or PowerShell.

### Cache gotchas

- Cache keys treat path-like segments as files. Quote string segments that
  look like paths.
- Caches are immutable; a new key produces a new cache.
- Caches are not secret stores.

### Service connections and WIF

- `azureSubscription` means the service connection name, not the Azure
  subscription name or ID.
- Service connections are protected resources. Open access is a security
  smell.
- WIF migration: Azure DevOps issuer deprecated 2026-07-01, retired
  2027-07-01 for public-cloud scenarios. New WIF connections default to the
  Entra issuer since November 2025.
- Federated credential hard limit is 20 per app registration or UAMI.
- App-registration tokens are short-lived (~1 hour); UAMI tokens can last
  much longer (~24 hours), affecting long-running jobs.
- Some Azure tasks do not support WIF in older major versions; bump task
  versions before converting service connections.
- Sovereign clouds, Azure Stack, and multitenant app scenarios may need to
  stay on the Azure DevOps issuer until supported.

### Variable groups and secure files

- Variable-group names in YAML must resolve at compile time.
- Key Vault-linked variable groups only map secrets, not keys or
  certificates. Adding/removing KV secrets does not auto-refresh the
  group.
- `DownloadSecureFile@1` runs in the pre-job phase regardless of YAML
  position.
- Secure files cannot be selected with runtime expressions.
- `AzureKeyVault@2` `RunAsPreJob` controls scope per task; variable-group
  backed KV has no equivalent knob.
- Private Key Vault with RBAC and Azure DevOps is unsupported as a
  trusted-service scenario; use access policy mode, a self-hosted agent in
  the VNet, or temporary firewall rules.

### Protected resources and approvals

- Protected resources include variable groups, secure files, service
  connections, environments, agent pools, and repositories.
- Required-template checks on protected resources enforce the use of a
  specific template; without them, templates are only conventions.
- Pipeline permissions on protected resources can be updated via the
  pipeline-permissions REST API.

## See also

- [CI/CD platform guide](./ci-cd-platform-guide.md)
- [Azure Pipelines documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/)
- [Azure DevOps YAML schema index](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema)
- [azure-pipelines-tasks repository](https://github.com/microsoft/azure-pipelines-tasks)
- [azure-pipelines-task-lib repository](https://github.com/microsoft/azure-pipelines-task-lib)
- [Azure DevOps YAML schema source repository](https://github.com/MicrosoftDocs/azure-devops-yaml-schema)
