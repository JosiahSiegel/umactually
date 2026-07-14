/** Canonical CLI modes banner shared by help and bare invocation output. */
export const CLI_MODES_TEXT: string = `umactually: Modes:

Standalone mode (any git repo, no CI required)
  umactually --api-url https://api.minimax.io/v1 --api-key "$UMACTUALLY_API_KEY"
  real review, written to ./umactually-review.json, no platform posting

Live CI mode (GitHub Actions, Azure DevOps)
  umactually --platform github
  derive PR context from the runner and post the review through the CLI

Outside a git repo (advanced)
  umactually --api-url https://example.com --api-key "$UMACTUALLY_API_KEY" --event /tmp/event.json --diff /tmp/pr.diff --review /tmp/review.json --pr-number 42 --repo owner/name
  provide event, diff, review, PR number, and repository explicitly

Dry-run smoke test: pass --dry-run to any of the above to skip the provider call.
`;

/** Writes the canonical modes banner to stdout or a caller-provided stream. */
export function printModesBanner(stream?: NodeJS.WritableStream): void {
  const output = stream ?? process?.stdout;
  output?.write(CLI_MODES_TEXT);
}
