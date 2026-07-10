# ReviewTask — UmActually PR review task for Azure Pipelines

This is the Build/Release task that gets installed when an operator
adds the UmActually extension to their Azure DevOps organization.
The task is a thin wrapper around the UmActually CLI — see
`../../../bin/umactually-pr-review.mjs` (or the bundled CLI in v0.2+)
for the source of truth on the review behavior.

## How the task is structured

```
ReviewTask/
├── task.json         # Task definition (UI inputs + execution)
├── index.ts          # TypeScript source
├── index.js          # Compiled output (built from index.ts)
├── package.json      # Node deps (azure-pipelines-task-lib)
├── package-lock.json # Pinned dep versions
├── tsconfig.json     # TypeScript config
├── icon.png          # (TODO) 32x32 task icon
└── .gitignore        # Excludes node_modules + build output
```

The task is **stateless** — it shells out to the CLI on every run,
so upgrades to UmActually flow through the .vsix without requiring
a task re-release.

## Why TypeScript and not JavaScript / PowerShell / Python?

The official MS guidance is to use Node 20+ for cross-platform
tasks. The task uses `azure-pipelines-task-lib@5.x` which is the
MS-supported runtime, and the entire task surface is type-checked.

## Building

The build is performed by `scripts/package-extension.sh`. It:

1. Runs `npm install` if `node_modules` is missing
2. Compiles `index.ts` → `index.js` via `tsc -p tsconfig.json`
3. Replaces the publisher ID placeholder if `--publisher <id>` was passed
4. Generates a fresh task GUID if the placeholder is still in `task.json`
5. Packages the .vsix via `tfx extension create`

## Inputs

See the `inputs` array in this directory's `task.json` for the full
list. The 16 inputs cover the most important CLI flags plus a few
that have no CLI equivalent (e.g. `outputArtifact` for the pipeline
attachment). Note: `task.json` ships in this directory alongside
the README, not in a separate PR.

## Output variables

The task sets these for downstream steps:

- `UMACTUALLY_REVIEWED` — `true` | `false`
- `UMACTUALLY_FINDING_COUNT` — integer
- `UMACTUALLY_SEVERITY_HIGH_COUNT` — integer

## Output attachment

The raw provider response is attached as a pipeline artifact under
the name `umactually-review` (configurable via the `outputArtifact`
input). The artifact contains:

- `summary` — the human-readable review summary
- `verdict` — `NEEDS_FIX` | `APPROVED` | `COMMENT` | `DISCUSS` | `SHIP`
- `comments` — the inline findings array
- `suppressed_comments` — findings the model emitted but the post-filter dropped
- `verifiedFactsFilter` + `confidenceFilter` — the audit trail of
  what the deterministic filters downgraded

## Failure modes

| Exit | Task result | Meaning |
| --- | --- | --- |
| 0 | Succeeded | Review ran to completion (posted in live mode, generated in dry-run) |
| 124 | Failed (ReviewTimeout) | Wall-clock timeout exceeded |
| 1 | Failed (ReviewFailed) | CLI exited non-zero (provider error, parse error, etc.) |
| (any) | Failed (TaskError) | The task itself threw (missing env vars, etc.) |

## IN DEVELOPMENT

This task has been built and type-checked but has not been
sideloaded into a real ADO organization. The pre-publish
checklist in `../README.md` is the authoritative source for
what's needed before this can be published to the public
Marketplace.
