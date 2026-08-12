// SPDX-License-Identifier: MIT
// Verbatim canonical CI workflow bytes. Drift-tested against
// examples/github/pr-review.yml and examples/azure/azure-pipelines.yml
// in test/unit/init-templates-drift.test.ts modulo the single
// version-pin substitution point.
//
// Why inline-const (not fs.readFileSync at runtime): the SEA binary
// entry is src/cli.ts (tsdown.config.ts:120-122) and has no copy/include
// for examples/ — readFileSync from process.execPath/../examples/.../yml
// is broken in the binary. The npm-published path also has no
// examples/ files relative to dist/. Inline constants ship with the
// bundle. The drift test guards against template rot.

import { join } from "node:path";

export const GITHUB_WORKFLOW_FILENAME = "umactually-pr-review.yml";
export const AZURE_PIPELINE_FILENAME = "azure-pipelines.yml";

export type CiTarget = "github" | "azure";

const GITHUB_WORKFLOW_TEMPLATE = `# Runs umactually as a pinned npm CLI for pull requests.
name: PR review
on: [pull_request]
concurrency:
  group: umactually-\${{ github.workflow }}-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v7
        with:
          node-version: "24"
      - name: Install umactually
        # Pin the version; never track \`latest\`.
        run: npm install -g umactually@__UMACTUALLY_VERSION__
      - name: Run umactually PR review
        env:
          GITHUB_TOKEN: \${{ github.token }}
          UMACTUALLY_API_URL: \${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: \${{ secrets.UMACTUALLY_API_KEY }}
        run: umactually review --platform github
`;

const AZURE_PIPELINE_TEMPLATE = `# Enable "Allow scripts to access the OAuth token" in pipeline settings.
# Only the two canonical UMACTUALLY_* credential vars are forwarded; runtime
# options (model, provider, github-api-base) are read from the saved config
# under ~/.umactually/config.json or the provider's own discovery.
# Artifact validation is automatic after each live review. SYSTEM_ACCESSTOKEN is the
# only ADO-specific plumbing because Azure does not export $(System.AccessToken).
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
  # Pin the npm version for reproducibility (never track \`latest\`).
  - script: npm install -g umactually@__UMACTUALLY_VERSION__
    displayName: Install umactually
  - script: umactually review --platform azure
    displayName: Run umactually PR review
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
`;

export function renderCiTemplate(input: {
  readonly target: CiTarget;
  readonly packageVersion: string;
  readonly paths?: { readonly githubDir?: string };
}): {
  readonly filename: string;
  readonly relativePath: string;
  readonly body: string;
} {
  const template = input.target === "github" ? GITHUB_WORKFLOW_TEMPLATE : AZURE_PIPELINE_TEMPLATE;
  const body = template.replaceAll("__UMACTUALLY_VERSION__", input.packageVersion);
  const filename = input.target === "github" ? GITHUB_WORKFLOW_FILENAME : AZURE_PIPELINE_FILENAME;
  const relativePath = input.target === "github"
    ? join(input.paths?.githubDir ?? ".github/workflows", filename)
    : filename;
  return { filename, relativePath, body };
}

export function detectCiTarget(input: {
  readonly exists: (path: string) => boolean;
}): CiTarget | null {
  if (input.exists(join(".github"))) return "github";
  if (input.exists("azure-pipelines.yml")) return "azure";
  return null;
}
