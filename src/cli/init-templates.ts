// SPDX-License-Identifier: MIT
// Verbatim canonical CI workflow bytes. Drift-tested against
// examples/github/pr-review.yml, examples/azure/azure-pipelines.yml
// (longform/inline), and examples/github/pr-review.yml.action-ref.yml
// + examples/azure/azure-pipelines.yml.task-ref.yml (shortform/action-
// ref) in test/unit/init-templates-drift.test.ts modulo the single
// version-pin substitution point.
//
// Why inline-const (not fs.readFileSync at runtime): the SEA binary
// entry is src/cli.ts (tsdown.config.ts:120-122) and has no copy/include
// for examples/ — readFileSync from process.execPath/../examples/.../yml
// is broken in the binary. The npm-published path also has no
// examples/ files relative to dist/. Inline constants ship with the
// bundle. The drift test guards against template rot.
//
// Shortform vs longform: the default wizard emit (shortform) references
// the published GitHub Action / ADO task so the workflow body stays a
// single step. `--longform` selects the prior inline install + run form
// for one release as a deprecation escape hatch — removal is pinned to
// `umactually-action@v2` (target: 2026-Q4), see CHANGELOG `[Unreleased]`.

import { join } from "node:path";

export const GITHUB_WORKFLOW_FILENAME = "umactually-pr-review.yml";
export const AZURE_PIPELINE_FILENAME = "azure-pipelines.yml";

export type CiTarget = "github" | "azure";

/**
 * Shortform (default) — references the published GitHub Action so the
 * generated workflow body is a single `uses:` step. The action owns
 * Node.js setup, npm install of the CLI, and the live review call; the
 * operator only wires credentials and config.
 *
 * `__UMACTUALLY_VERSION__` pins the action's `cli-version` input
 * (default for the npm install the action runs internally). It is
 * intentionally NOT on an `npm install -g` line — longform still has
 * that, but shortform delegates install to the action.
 */
export const GITHUB_WORKFLOW_TEMPLATE = `# Runs umactually via the published GitHub Action for pull requests.
# Action: https://github.com/JosiahSiegel/umactually-action
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
      - name: Run umactually PR review
        uses: JosiahSiegel/umactually-action@v1
        with:
          cli-version: __UMACTUALLY_VERSION__
          api-url: \${{ secrets.UMACTUALLY_API_URL }}
          api-key: \${{ secrets.UMACTUALLY_API_KEY }}
          provider: openai-compatible
          config-path: ./umactually.review.json
          output-artifact: umactually-review.json
          skip-draft: 'true'
          paths-ignore: '**/*.md,docs/**,**/*.lock'
`;

/**
 * Longform — the prior inline `npm install -g` + `umactually review`
 * form, retained for one release as a deprecation escape hatch via the
 * `umactually init --longform` flag. Byte-for-byte equivalent to
 * examples/github/pr-review.yml modulo the version pin (so the drift
 * test can pin the prior canonical example against this constant).
 */
export const GITHUB_WORKFLOW_TEMPLATE_LONGFORM = `# Runs umactually as a pinned npm CLI for pull requests.
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

/**
 * Shortform (default) — references the published ADO task. The task
 * owns Node.js setup, npm install, and the live review call; the
 * operator only wires credentials and config.
 *
 * `SYSTEM_ACCESSTOKEN` env-passthrough is preserved because ADO does
 * not export $(System.AccessToken) inside the task scope.
 */
export const AZURE_PIPELINE_TEMPLATE = `# Enable "Allow scripts to access the OAuth token" in pipeline settings.
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
  - task: UmActuallyReview@1
    inputs:
      cliVersion: __UMACTUALLY_VERSION__
      apiUrl: $(UMACTUALLY_API_URL)
      apiKey: $(UMACTUALLY_API_KEY)
      provider: openai-compatible
      configPath: ./umactually.review.json
      outputArtifact: umactually-review.json
      skipDraft: 'true'
      pathsIgnore: '**/*.md,docs/**,**/*.lock'
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
`;

/**
 * Longform — the prior inline `npm install -g` + `umactually review`
 * script form, retained for one release as a deprecation escape hatch
 * via `umactually init --longform`. Byte-for-byte equivalent to
 * examples/azure/azure-pipelines.yml modulo the version pin.
 */
export const AZURE_PIPELINE_TEMPLATE_LONGFORM = `# Enable "Allow scripts to access the OAuth token" in pipeline settings.
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

/**
 * Render the canonical CI workflow body for a target. Default
 * (`longform: false`) emits the published-action / published-task
 * shortform. `longform: true` selects the prior inline form for one
 * release — removal is pinned to `umactually-action@v2` (target:
 * 2026-Q4), see CHANGELOG `[Unreleased]`.
 *
 * The `__UMACTUALLY_VERSION__` placeholder is substituted on
 * whichever line owns the version pin for the selected form:
 *   - shortform GitHub: `cli-version: __UMACTUALLY_VERSION__` (input to the action)
 *   - longform  GitHub: `npm install -g umactually@__UMACTUALLY_VERSION__`
 *   - shortform Azure: `cliVersion: __UMACTUALLY_VERSION__` (input to the task)
 *   - longform  Azure: `npm install -g umactually@__UMACTUALLY_VERSION__`
 */
export function renderCiTemplate(input: {
  readonly target: CiTarget;
  readonly packageVersion: string;
  readonly longform?: boolean;
  readonly paths?: { readonly githubDir?: string };
}): {
  readonly filename: string;
  readonly relativePath: string;
  readonly body: string;
} {
  const useLongform = input.longform === true;
  const template = input.target === "github"
    ? (useLongform ? GITHUB_WORKFLOW_TEMPLATE_LONGFORM : GITHUB_WORKFLOW_TEMPLATE)
    : (useLongform ? AZURE_PIPELINE_TEMPLATE_LONGFORM : AZURE_PIPELINE_TEMPLATE);
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
