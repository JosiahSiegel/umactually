/** Canonical CLI modes banner shared by help and bare invocation output. */
export const CLI_MODES_TEXT: string = `Standalone mode:   umactually --api-url <url> --api-key <key>
Live CI mode:      umactually --platform github
Pre-rendered diff: umactually --event <path> --diff <path>
Local files:       umactually --files <path> --api-key <key>

Run \`umactually --help\` for the full reference.
`;

/** Writes the canonical modes banner to stdout or a caller-provided stream. */
export function printModesBanner(stream?: NodeJS.WritableStream): void {
  const output = stream ?? process?.stdout;
  output?.write(CLI_MODES_TEXT);
}
