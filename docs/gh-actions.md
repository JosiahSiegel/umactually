# GitHub Actions setup

Run UmActually as a version-pinned npm CLI in pull request workflows. The canonical copyable workflow is [`examples/github/pr-review.yml`](../examples/github/pr-review.yml).

## Install

Use Node 24 and pin the package version in every invocation:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "24"
- name: Install dependencies
  run: npm ci
```

```yaml
run: npx umactually@0.1.0 review --platform github
```

`npm ci` is mandatory even when the review command runs through `npx`. It installs the checked-in application dependencies exactly from `package-lock.json`, so checkout-time scripts, validation, and repository tooling do not drift. The explicit version on `npx` independently pins the UmActually CLI instead of resolving whatever npm currently marks as latest.

The CLI requires Node 24. Do not rely on the runner's ambient Node version.

## Permissions

Grant only the permissions the review needs:

```yaml
permissions:
  contents: read
  pull-requests: write
```

`contents: read` lets checkout and PR-diff discovery read repository content. `pull-requests: write` lets the CLI create or update the review, inline comments, and marker-bearing parent comment. Omitting either permission causes checkout/context reads or posting to fail.

Do not use `pull_request_target`. It is unnecessary for this integration and can expose secrets to untrusted pull request code.

## Token wiring

Wire the workflow token explicitly on the review step:

```yaml
env:
  GITHUB_TOKEN: ${{ github.token }}
```

GitHub creates `${{ github.token }}` for the job, but it is not automatically exported as `GITHUB_TOKEN` for arbitrary `run:` steps. UmActually reads `GITHUB_TOKEN` from the process environment, so the mapping is required.

## Concurrency pattern

Use this exact workflow-level concurrency key:

```yaml
concurrency:
  group: umactually-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

Every review posts or updates the same marker slot. Rapid `synchronize` events can otherwise run concurrently, race while looking up that marker, and duplicate or overwrite comments. Cancelling the older run leaves only the newest commit eligible to post.

## Provider secrets

Create these repository or organization Actions secrets:

- `UMACTUALLY_API_URL`: provider or gateway base URL.
- `UMACTUALLY_API_KEY`: provider credential.

Forward them only through the review step's environment:

```yaml
env:
  GITHUB_TOKEN: ${{ github.token }}
  UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
  UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
```

Never put provider credentials directly in workflow YAML or command arguments.

## Prompt-file forwarding

The CLI discovers the standard repository instruction files by default. To replace that lookup with an explicit ordered list, add either optional flag:

```yaml
run: |
  npx umactually@0.1.0 review \
    --platform github \
    --prompt-files "prompts/review-system.md,prompts/repo-context.md" \
    --additional-prompt-files "prompts/extra-instructions.md"
```

`--prompt-files` and `--additional-prompt-files` accept comma- or newline-separated repository-relative paths. A non-empty explicit list overrides the corresponding default lookup. Keep the flags absent when no override is needed.

## Review artifact validation

Always validate the artifact, including when the review step fails:

```yaml
- name: Validate review artifact
  if: always()
  run: npx umactually@0.1.0 check-review-artifact ./umactually-review.json
```

The command rejects a missing file, invalid JSON, parse-fail sentinel, explicitly failed parse, contradictory verdict, or artifact with no usable review signal. Its exit code makes provider-output failures visible as a CI failure rather than a misleading successful workflow.

## Parse-fail triage

A parse-fail diagnostic card means the provider returned output that could not become a valid review artifact. It is not a clean review.

1. Open the review step logs and find the provider status, endpoint attribution, and parse warning.
2. Confirm `UMACTUALLY_API_URL`, provider selection, and model support the configured response format.
3. If the gateway rejects strict JSON schema, retry with `--no-strict-schema`; local finding verification still runs.
4. Check provider truncation or timeout signals and raise the output/time budget only when the logs show exhaustion.
5. Re-run the failed workflow after correcting the provider configuration. Do not dismiss the validation failure or treat the diagnostic card as approval.

## Upgrade procedure

Upgrade deliberately:

1. Choose the released npm version to adopt.
2. Replace every `umactually@<version>` in the workflow, including the artifact-validation step, with the same new version.
3. Review that release's changelog and required Node version.
4. Run the workflow on a test pull request and confirm both review posting and artifact validation.
5. Merge the version bump only after the test workflow is green.

Do not switch to an unpinned `npx umactually` invocation.

## Complete workflow

```yaml
name: PR review
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

concurrency:
  group: umactually-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - name: Install dependencies
        run: npm ci
      - name: Run umactually PR review
        env:
          GITHUB_TOKEN: ${{ github.token }}
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
        run: |
          npx umactually@0.1.0 review \
            --platform github \
            --api-url "$UMACTUALLY_API_URL" \
            --api-key "$UMACTUALLY_API_KEY"
      - name: Validate review artifact
        if: always()
        run: npx umactually@0.1.0 check-review-artifact ./umactually-review.json
```

## GitHub Enterprise Server limitation

GitHub Enterprise Server is not supported in the first CLI-only release. Live GitHub PR requests resolve from `GITHUB_API_URL` when the runner supplies it, otherwise they use `DEFAULT_GITHUB_API_BASE` (`https://api.github.com`) in [`src/platform/github/api.ts:27`](../src/platform/github/api.ts#L27). The current release contract and test matrix cover GitHub.com only; do not deploy it as a GHES integration.
