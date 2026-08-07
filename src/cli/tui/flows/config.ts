// src/cli/tui/flows/config.ts — View Config flow.
// Shape + stub created by todo:8; body filled in by todo:13.
//
// Read-only display surface for the operator: shows the effective saved
// config (path, provider, optional apiUrl, optional model) and the
// `present` / `absent` status of every env var name the runtime reads.
//
// The flow NEVER mutates the saved config, NEVER opens a network
// connection, and NEVER writes to disk. It is the TUI twin of the
// `umactually --show-config` dispatch command (see dispatch.ts:
// renderShowConfig / runShowConfig) — same data, friendlier shell.
//
// Pattern references:
//   - dispatch.ts:338-346 (renderShowConfig): the field-by-field rendering
//     shape we mirror here. We DO NOT import the dispatcher directly
//     because it writes to process.stdout (a CLI contract); this flow
//     uses @clack/prompts notes instead so the TUI keeps its visual
//     consistency with the hub menu.
//   - doctor.ts:144-156 (checkEnv): the canonical env-presence shape
//     (`{ name, present }`) we mirror in the env-var table.
//
// After the read-only display, the flow blocks on a single-option
// `select` with `{ value: 'menu', label: 'Back to menu' }` so the hub
// gets a sentinel it can route on — this is consistent with todo:14's
// Debug flow and matches the hub's select-based dispatch.

import * as p from "@clack/prompts";

import { KNOWN_ENV_VAR_NAMES } from "../../../config/field-schema.js";
import { tryReadSavedConfig } from "../../load-saved-config.js";

/**
 * Render the saved config (path + provider + optional apiUrl/model)
 * as a multiline string. Mirrors the shape of `renderShowConfig` in
 * `src/cli/dispatch.ts:338-346` so the TUI's display matches the
 * CLI's `--show-config` output line-for-line — operators reading
 * the TUI see the same field labels they would in the dispatch
 * path. Inlined here (rather than imported) because the dispatcher
 * writes to process.stdout directly; this flow feeds the string
 * into a `@clack/prompts` `note` so the visual framing fits the hub.
 */
function renderSavedConfig(
  config: NonNullable<ReturnType<typeof tryReadSavedConfig>["config"]>,
  path: string,
): string {
  const lines: string[] = [
    `saved config: ${path}`,
    `  provider: ${config.provider}`,
  ];
  if (config.apiUrl !== undefined) lines.push(`  apiUrl:   ${config.apiUrl}`);
  if (config.model !== undefined) lines.push(`  model:    ${config.model}`);
  return lines.join("\n");
}

/**
 * Render the env-var presence table. The format is intentionally
 * compact and machine-greppable so an operator who pastes a screen
 * scrape into a bug report preserves the `present=true` / `present=false`
 * markers verbatim. The doctor env-presence shape (`{name, present}`)
 * is preserved field-for-field.
 */
function renderEnvPresence(env: NodeJS.ProcessEnv): string {
  const entries = [...KNOWN_ENV_VAR_NAMES].map((name) => ({
    name,
    present: typeof env[name] === "string" && (env[name] as string).length > 0,
  }));
  const presentCount = entries.filter((entry) => entry.present).length;
  const header = `env (${presentCount}/${KNOWN_ENV_VAR_NAMES.size} known env vars present)`;
  const rows = entries.map(
    (entry) => `  ${entry.name}=${entry.present ? "present" : "absent"}`,
  );
  return [header, ...rows].join("\n");
}

export async function runConfigFlow(): Promise<{ exitCode: 0 }> {
  // Step 1: load the saved config (non-exiting wrapper).
  const saved = tryReadSavedConfig();

  // Surface any warning (corrupt file, symlink refused, malformed JSON,
  // schema mismatch) via the clack `stream.warn` so it appears as a
  // proper warning block rather than as part of the config block.
  if (saved.warning !== null) {
    p.stream.warn(saved.warning);
  }

  // Step 2: display the saved config OR the "no saved config" hint.
  if (saved.config !== null) {
    p.note(renderSavedConfig(saved.config, saved.path), "Saved config");
  } else {
    p.note(
      `No saved config found at ${saved.path}\n(run \`umactually init\` to create one)`,
      "Saved config",
    );
  }

  // Step 3: env-presence table (read process.env only — no mutation).
  p.note(renderEnvPresence(process.env), "Environment");

  // Step 4: block on the single-option "Back to menu" sentinel so the
  // hub can route back here. The sentinel value is the public API the
  // hub consumes (it doesn't matter that there's only one option —
  // @clack/prompts requires the array form). `isCancel` returns the
  // hub to its loop; selecting the option returns the operator to the
  // hub menu.
  const choice = await p.select({
    message: "What next?",
    options: [{ value: "menu", label: "Back to menu" }],
  });
  if (p.isCancel(choice)) {
    return { exitCode: 0 };
  }
  return { exitCode: 0 };
}
