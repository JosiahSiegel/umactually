/** Canonical CLI modes banner shared by help and bare invocation output. */
export const CLI_MODES_TEXT: string = `Modes:

Standalone mode (any git repo, no CI required)
  umactually --api-url https://api.minimax.io/v1 --api-key "$UMACTUALLY_API_KEY"
  Writes the review to ./umactually-review.json — no posting.

Live CI mode (GitHub Actions, Azure DevOps)
  umactually --platform github
  Discovers PR context from the runner and posts the review.

Pre-rendered diff (advanced)
  You have a pre-rendered diff file and the PR's event JSON; pass --event and --diff.

Review local files or directories (any folder, no CI required)
  umactually --files <path>[,<path>...] --api-key "$UMACTUALLY_API_KEY"
  Recursively reviews the listed files or directories; writes ./umactually-review.json. No CI, no posting.

Just want to try? Add --dry-run to any of the above.
`;

/** Writes the canonical modes banner to stdout or a caller-provided stream. */
export function printModesBanner(stream?: NodeJS.WritableStream): void {
  const output = stream ?? process?.stdout;
  output?.write(CLI_MODES_TEXT);
}
