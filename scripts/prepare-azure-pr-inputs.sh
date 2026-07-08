#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Prepares Azure DevOps PR review inputs for the UmActually CLI.
#
# This is the canonical implementation of the "Prepare Azure PR inputs"
# step that lived inline in both azure-pipelines.yml and
# examples/azure/azure-pipelines.yml. Both pipelines now invoke this
# script via:
#
#   - script: bash scripts/prepare-azure-pr-inputs.sh
#     env:
#       SYSTEM_ACCESSTOKEN: $(System.AccessToken)
#
# Behaviour:
#   1. Creates $AZURE_ARTIFACT_DIR and writes a synthetic Azure PR event
#      + review fixture so manual branch runs without
#      SYSTEM_PULLREQUEST_PULLREQUESTID still execute end-to-end.
#   2. When SYSTEM_PULLREQUEST_PULLREQUESTID is set (PR validation),
#      fetches the real PR payload via the Azure DevOps REST API and
#      generates a real unified diff via `git diff` (three-dot:
#      origin/<target>...HEAD). Emits ##vso[task.setvariable] lines so
#      downstream steps can read UMACTUALLY_PR_NUMBER and
#      UMACTUALLY_REPO as pipeline variables.
#
# Required env vars (set by the calling Azure pipeline step's
# `variables:` block — see azure-pipelines.yml lines 20-29 and
# examples/azure/azure-pipelines.yml lines 27-36):
#   AZURE_ARTIFACT_DIR  artifacts directory (e.g. artifacts/manual)
#   AZURE_EVENT_PATH    path to write the PR event JSON
#   AZURE_DIFF_PATH     path to write the PR diff
#   AZURE_REVIEW_PATH   path to write the review fixture
#   SYSTEM_ACCESSTOKEN  $(System.AccessToken) mapping (PR fetch only;
#                       only required when SYSTEM_PULLREQUEST_PULLREQUESTID
#                       is set, i.e. branch-policy PR validation builds)

set -euo pipefail

# Fail fast with a clear error if any caller forgets to define the
# required vars. Under `set -u`, an unset var in `mkdir -p "$X"`
# would otherwise produce a confusing "no such file or directory"
# instead of an actionable message naming the missing variable.
: "${AZURE_ARTIFACT_DIR:?AZURE_ARTIFACT_DIR must be set in the pipeline variables block (e.g. value: artifacts/manual)}"
: "${AZURE_EVENT_PATH:?AZURE_EVENT_PATH must be set in the pipeline variables block (e.g. value: artifacts/manual/azure-event.json)}"
: "${AZURE_DIFF_PATH:?AZURE_DIFF_PATH must be set in the pipeline variables block (e.g. value: artifacts/manual/azure-pr.diff)}"
: "${AZURE_REVIEW_PATH:?AZURE_REVIEW_PATH must be set in the pipeline variables block (e.g. value: artifacts/manual/azure-review.json)}"

mkdir -p "$AZURE_ARTIFACT_DIR"

node --input-type=module <<'NODE'
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const env = process.env;
const artifactDir = env.AZURE_ARTIFACT_DIR ?? "artifacts/manual";
const rawPrNumber = env.SYSTEM_PULLREQUEST_PULLREQUESTID ?? "";
const prNumber = rawPrNumber.length > 0 ? Number.parseInt(rawPrNumber, 10) : 1;
if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
  throw new Error(`Invalid Azure PR number: ${rawPrNumber}`);
}

const repositoryName = env.BUILD_REPOSITORY_NAME ?? "umactually";
const projectName = env.SYSTEM_TEAMPROJECT ?? "local";
const repoSlug = repositoryName.includes("/") ? repositoryName : `${projectName}/${repositoryName}`;
const sourceBranch = env.SYSTEM_PULLREQUEST_SOURCEBRANCH ?? env.BUILD_SOURCEBRANCH ?? "refs/heads/manual";
const targetBranch = env.SYSTEM_PULLREQUEST_TARGETBRANCH ?? "refs/heads/main";
const event = {
  pullRequestId: prNumber,
  title: env.SYSTEM_PULLREQUEST_TITLE ?? "Synthetic Azure Pipelines validation event",
  sourceRefName: sourceBranch,
  targetRefName: targetBranch,
  repository: {
    id: env.BUILD_REPOSITORY_ID ?? "manual",
    name: repositoryName,
  },
};
const review = {
  verdict: "COMMENT",
  comments: [],
  suppressed_comments: [],
};
const metadata = {
  isPullRequest: rawPrNumber.length > 0,
  pullRequestId: prNumber,
  repo: repoSlug,
  eventPath: env.AZURE_EVENT_PATH,
  diffPath: env.AZURE_DIFF_PATH,
  reviewPath: env.AZURE_REVIEW_PATH,
};

writeFileSync(env.AZURE_EVENT_PATH ?? join(artifactDir, "azure-event.json"), `${JSON.stringify(event, null, 2)}\n`, "utf8");
writeFileSync(env.AZURE_REVIEW_PATH ?? join(artifactDir, "azure-review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8");
writeFileSync(join(artifactDir, "azure-inputs.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`##vso[task.setvariable variable=UMACTUALLY_PR_NUMBER]${prNumber}`);
console.log(`##vso[task.setvariable variable=UMACTUALLY_REPO]${repoSlug}`);
NODE

if [ -n "${SYSTEM_PULLREQUEST_PULLREQUESTID:-}" ]; then
  echo "Fetching Azure DevOps PR diff for PR ${SYSTEM_PULLREQUEST_PULLREQUESTID} via git diff."
  : "${SYSTEM_PULLREQUEST_TARGETBRANCH:?SYSTEM_PULLREQUEST_TARGETBRANCH must be set by Azure Pipelines for PR validation builds.}"
  # Fetch the real PR metadata via the REST API (still needed for the
  # event JSON that downstream steps consume). The diff is generated
  # via git diff instead of the iterations/changes REST endpoint
  # because that endpoint returns a JSON manifest of changed files
  # (changeEntries), not a unified diff — the model can't review code
  # from file paths alone.
  : "${SYSTEM_ACCESSTOKEN:?System.AccessToken must be mapped to SYSTEM_ACCESSTOKEN. Enable 'Allow scripts to access the OAuth token'.}"
  : "${SYSTEM_COLLECTIONURI:?SYSTEM_COLLECTIONURI must be set by Azure Pipelines.}"
  : "${SYSTEM_TEAMPROJECT:?SYSTEM_TEAMPROJECT must be set by Azure Pipelines.}"
  : "${BUILD_REPOSITORY_ID:?BUILD_REPOSITORY_ID must be set by Azure Pipelines.}"
  collection_uri="${SYSTEM_COLLECTIONURI%/}"
  project_path="$(node -e 'process.stdout.write(encodeURIComponent(process.env.SYSTEM_TEAMPROJECT || ""))')"
  repository_path="$(node -e 'process.stdout.write(encodeURIComponent(process.env.BUILD_REPOSITORY_ID || ""))')"
  pr_url="${collection_uri}/${project_path}/_apis/git/repositories/${repository_path}/pullRequests/${SYSTEM_PULLREQUEST_PULLREQUESTID}?api-version=7.1"
  curl -fsS \
    --header "Authorization: Bearer ${SYSTEM_ACCESSTOKEN}" \
    --header "Accept: application/json" \
    "$pr_url" \
    --output "$AZURE_EVENT_PATH"
  # Fetch the target branch so git can resolve the merge-base for
  # the three-dot diff. persistCredentials: true on the checkout step
  # means the agent has OAuth-authenticated access to origin.
  target_branch="${SYSTEM_PULLREQUEST_TARGETBRANCH#refs/heads/}"
  git fetch origin "${target_branch}"
  # Three-dot diff: changes on HEAD since it diverged from the target
  # branch. This captures exactly what the PR introduces, including
  # multi-commit branches. The output is a standard unified diff that
  # the model can review.
  git diff "origin/${target_branch}...HEAD" > "$AZURE_DIFF_PATH"
  if [ ! -s "$AZURE_DIFF_PATH" ]; then
    echo "##vso[task.logissue type=warning]Azure DevOps PR git diff is empty (target branch matches HEAD)."
  fi
else
  echo "SYSTEM_PULLREQUEST_PULLREQUESTID is empty; creating a synthetic manual-run diff."
  cat > "$AZURE_DIFF_PATH" <<'DIFF'
diff --git a/README.md b/README.md
index 0000000..1111111 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 # UmActually PR Review Action
+Synthetic Azure Pipelines manual validation diff.
DIFF
fi
