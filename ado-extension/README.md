# UmActually — Azure DevOps Marketplace extension

> **⚠️ IN DEVELOPMENT — Dev Preview.** This directory contains the
> Visual Studio Marketplace packaging for the UmActually PR review
> extension. **It is not ready for publication to the public
> Marketplace yet.** The package builds, the manifest is well-formed,
> and the task compiles under `tsc --noEmit`. It has not been
> sideloaded into a real ADO organization to validate the
> end-to-end behavior.

## Contents

```
ado-extension/
├── vss-extension.json             # Extension manifest (Azure DevOps Marketplace)
├── overview.md                    # Marketplace details page (the long description)
├── license-terms.md               # EULA (MIT)
├── ReviewTask/                    # The Build/Release task
│   ├── task.json                  # Task definition (UI inputs + execution)
│   ├── index.ts                   # TypeScript task implementation
│   ├── package.json               # Node deps (azure-pipelines-task-lib)
│   ├── tsconfig.json              # TypeScript config
│   └── icon.png                   # (TODO) 32x32 task icon
├── images/                        # Extension-level images
│   └── extension-icon.png         # (TODO) 128x128 marketplace icon
├── scripts/
│   └── package-extension.sh       # Build + .vsix + share/publish
├── docs/                          # (reserved for future per-extension docs)
└── README.md                      # This file
```

## Architecture

The extension is a **thin wrapper** around the UmActually CLI. The
task implementation (`ReviewTask/index.ts`) shells out to the CLI
binary via `spawn` and:

1. Reads the task inputs (provider, model, effort, severity, etc.)
2. Reads the Azure Pipelines PR context (collection URI, project,
   repo, PR number, source commit, target branch) from build
   variables
3. Resolves the CLI to invoke — currently from the agent's working
   directory's `bin/umactually.mjs` (the repo's own bundled
   CLI). Future versions will bundle the CLI as a node_modules
   dependency inside the task folder for a self-contained .vsix.
4. Builds the CLI argv, runs the CLI with a wall-clock timeout,
   captures stdout/stderr, and parses the CLI's summary card to
   extract `inlineCount` and per-severity counts.
5. Uploads the raw provider response as a pipeline artifact, sets
   output variables for downstream steps, and reports the task
   result (`Succeeded` / `Failed`).

The CLI is the source of truth for all review behavior. Changes to
the provider layer, filter stack, SonarQube integration, or output
format flow through automatically without requiring an extension
release.

## Pre-publish checklist

Before publishing to the public Visual Studio Marketplace:

- [ ] **Register a publisher ID.** Go to
      <https://marketplace.visualstudio.com/manage/createpublisher>
      and reserve a publisher ID. The publisher ID must match the
      `publisher` field in `vss-extension.json` (currently
      `REPLACE_WITH_PUBLISHER_ID`).
- [ ] **Generate a fresh task GUID.** PowerShell:
      `[guid]::NewGuid().Guid`. bash: `uuidgen`. Replace
      `REPLACE_WITH_GENERATED_GUID` in `ReviewTask/task.json` with
      the new GUID. The current placeholder is intentionally invalid
      so the package fails the marketplace validation if you forget.
- [ ] **Add real icons.** `images/extension-icon.png` must be
      128×128. `ReviewTask/icon.png` must be 32×32. See the
      `icon` requirements in
      <https://learn.microsoft.com/en-us/azure/devops/extend/develop/integrate-build-task>.
- [ ] **Sideload into a private ADO organization.** Run
      `bash scripts/package-extension.sh --share <your-org>`. Install
      the shared extension in your org and wire it into a test
      pipeline. Validate that:
        - The task shows up in the Add Task dialog under "Utility"
        - All inputs render correctly
        - The `provider` / `githubApiBase` / `sonarHostUrl` visibility
          rules work (`visibleRule`)
        - The CLI runs to completion in a real PR validation build
        - The `UMACTUALLY_REVIEWED` output variable is set
        - The output artifact is uploaded
        - The review threads appear on the PR
- [ ] **Update the manifest for the public release.** Change
      `galleryFlags` from `[Preview]` to `[Public]`. Update
      `version` from `0.1.0-dev` to `0.1.0` (or whatever the first
      public release is).
- [ ] **Test the marketplace metadata.** Upload the .vsix to the
      marketplace as a private draft first, verify the
      `overview.md` renders correctly, the icons display, the
      description fits the 200-char limit on the summary line, and
      the categories are right.
- [ ] **Add a CHANGELOG and privacy policy.** The marketplace
      requires both for the public release (the `content.license`
      field is already populated; add `content.privacypolicy` and a
      `CHANGELOG.md` linked from the README).
- [ ] **Switch from `bin/` to bundled CLI.** v0.2 will bundle
      `umactually` as a node_modules dependency inside
      `ReviewTask/`. This removes the need for the operator to
      check out the repo and run `npm run bundle` first.

## Local development

```bash
# 1. Install task dependencies
cd ReviewTask
npm install

# 2. Type-check + build
npx tsc -p tsconfig.json

# 3. Validate the manifest
cd ..
python -c "import json; json.load(open('vss-extension.json'))" && echo "vss-extension.json OK"
python -c "import json; json.load(open('ReviewTask/task.json'))" && echo "task.json OK"

# 4. Package the .vsix
bash scripts/package-extension.sh
# -> dist/umactually-0.1.0-dev.vsix
```

## Publishing (after the checklist is complete)

```bash
# One-time: get a Marketplace PAT
# https://marketplace.visualstudio.com/manage/createpublisher
export MARKETPLACE_PAT="<your-pat>"

# Build + publish
bash scripts/package-extension.sh --rev-version --publish
```

## Why sideloading, not publishing, first?

The Marketplace submission pipeline includes a Microsoft-side review
(typically 1-3 business days for first submissions, faster for
updates). An incorrect or broken first submission costs time and
risks getting flagged as a low-quality extension. Sideloading into
a private organization lets us:

- Validate the install + run + post-review-threads contract against
  a real ADO build agent (which has subtly different behavior than
  the local dev environment for env-var inheritance, attachment
  uploads, and output variable capture)
- Catch any tfx-cli or manifest-schema issues before the
  marketplace sees them
- Run the build through a real PR validation pipeline (not just a
  `tfx extension create` syntax check)

When the sideloaded version has been used in production for a few
weeks without issues, switch the `galleryFlags` and publish.

## Related files in the parent repo

- `README.md` — the parent repo's main README (GitHub Action + CLI)
- `docs/azure-devops.md` — parent repo's ADO setup notes
- `docs/security.md` — the security model that the extension inherits
- `examples/azure/azure-pipelines.yml` — example pipeline that uses
  the CLI directly (the same pipeline the extension is designed to
  wrap)
- `bin/umactually.mjs` — the CLI the extension shells out
  to
