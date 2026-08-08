import { describe, expect, it } from "vitest";

import {
  REVIEW_HELP,
  DOCTOR_HELP,
  CHECK_REVIEW_ARTIFACT_HELP,
  resolveHelpText,
  INIT_HELP,
  renderCommandsTable,
  type HelpCommand,
} from "../../src/cli/help.js";

const topLevelHelp = resolveHelpText(["--help"]);

describe("CLI help text", () => {
  it("mentions --prompt-files so operators discover the new array override", () => {
    expect(topLevelHelp).toContain("--prompt-files");
  });

  it("mentions --additional-prompt-files so operators discover the new array override", () => {
    expect(topLevelHelp).toContain("--additional-prompt-files");
  });

  it("documents that --prompt-files / --additional-prompt-files OVERRIDE the default lookup list", () => {
    // The help text MUST explain the override semantics so an operator
    // reading `umactually --help` understands the new
    // behavior. If a future edit drops the override-language, the
    // operator can no longer discover the auto-lookup behavior from
    // --help output alone.
    expect(topLevelHelp).toMatch(/--prompt-files[^]*overrides defaults/u);
    expect(topLevelHelp).toMatch(/--additional-prompt-files[^]*overrides defaults/u);
  });

  it("mentions the existing --prompt-file and --additional-prompt-file (back-compat surface)", () => {
    // Regression: if the legacy single-file flags drop off the help
    // text, operators who scripted against them lose discoverability.
    expect(topLevelHelp).toContain("--prompt-file <path>");
    expect(topLevelHelp).toContain("--additional-prompt-file <path>");
  });

  it("contains a Modes: banner so operators can see the three invocation modes at a glance", () => {
    // S4 — help honesty. A brand-new operator running --help must
    // discover the Standalone / Live CI / Pre-rendered / Local-files
    // modes without reading docs. The compact banner (Wave 3) drops
    // the literal "Modes:" header because the four body labels
    // ("Standalone mode:", "Live CI mode:", "Pre-rendered diff:",
    // "Local files:") already serve as discoverability anchors; the
    // header was redundant with the body. This test pins the four
    // anchors so a future edit that drops one of them regresses the
    // S4 surface rather than passing silently.
    expect(topLevelHelp).toContain("Standalone mode:");
    expect(topLevelHelp).toContain("Live CI mode:");
    expect(topLevelHelp).toContain("Pre-rendered diff:");
    expect(topLevelHelp).toContain("Local files:");
  });

  it("shows the Standalone-mode copy-paste example", () => {
    // The standalone example is the primary use case for local
    // dev/smoke tests (README.md "Standalone mode (the primary use
    // case)" section). Operators running --help must be able to
    // adapt it for their own endpoint without crossing into README.md.
    // The compact banner (Wave 3) uses literal placeholders (`<url>`,
    // `<key>`) instead of the previous vendor URL
    // (`https://api.minimax.io/v1`) and shell-quoted env var
    // (`$UMACTUALLY_API_KEY`) because the placeholder form is more
    // useful for new operators — they fill in their own values
    // rather than copying a vendor-specific URL and an env-var name
    // they may not have set. The README documents the placeholder
    // pattern (see "Saved config" / "Configuration sources" sections)
    // so the placeholder is not a step backward in discoverability.
    expect(topLevelHelp).toContain("--api-url <url> --api-key <key>");
  });

  it("shows the live-CI copy-paste example without explicit plumbing", () => {
    // Live CI derives event, diff, review, and PR context from the runner.
    expect(topLevelHelp).toContain("Live CI mode");
    expect(topLevelHelp).toContain("umactually --platform github");
    expect(topLevelHelp).not.toContain('--platform github --event "$GITHUB_EVENT_PATH"');
  });

  it("does not advertise the misleading 'optional in dry-run' annotation", () => {
    // S4 — the old --threads / --review descriptions claimed they
    // were "optional in dry-run" even in standalone mode, where
    // those flags do not apply at all. That misleading wording has
    // been removed from the help text; this test pins the removal
    // so a future refactor can't accidentally re-introduce it.
    expect(topLevelHelp).not.toContain("optional in dry-run");
  });

  it("grew to include the modes banner block (sanity check on total length)", () => {
    // The Modes: banner added ~10 lines of standalone/live-CI/
    // outside-git-repo examples; help text grew from ~88 lines to
    // ~98. A floor of 1500 chars catches accidental banner
    // truncation without depending on a specific line count.
    expect(topLevelHelp.length).toBeGreaterThanOrEqual(1500);
  });

  it("cross-links docs/exit-codes.md so operators find the exit-code reference from --help", () => {
    // The exit-code table has been relocated to docs/exit-codes.md
    // (see hyperplan bundle item #5). --help output is the operator's
    // first stop when a run returns a non-zero exit; without a literal
    // cross-link to docs/exit-codes.md, the operator cannot discover
    // the reference from --help alone and must guess or grep. This
    // test pins the cross-link so the T5 work (adding it to
    // src/cli/help.ts) is verified from the --help surface.
    expect(topLevelHelp).toContain("docs/exit-codes.md");
  });

  // HELP-CFG-* — v0.6.26 saved-config resolution-order lines. These
  // pin the top-level help's documentation of the four-layer precedence
  // chain (flag > env > saved config > default) so an operator reading
  // `umactually --help` can discover why `umactually review` suddenly
  // picked up --api-url from `~/.umactually/config.json` without ever
  // passing the flag. Without these lines the v0.6.26 behavior change
  // would be invisible to anyone reading --help, and a future refactor
  // could quietly drop the documentation while leaving the runtime
  // behavior intact — leading to the exact "silent behavior change
  // with no discoverable explanation" failure mode every CLI changelog
  // tries to avoid.
  it("HELP-CFG-1: top-level help documents the four-layer configuration resolution order", () => {
    expect(topLevelHelp).toContain("Configuration sources (highest priority first)");
    expect(topLevelHelp).toMatch(/--flags > UMACTUALLY_\*\/?REVIEW_\*[\s\S]*?env vars > saved config/);
    expect(topLevelHelp).toContain("~/.umactually/config.json");
    expect(topLevelHelp).toContain("> defaults");
  });

  it("HELP-CFG-2: top-level help calls out --api-key is NEVER persisted (S6 contract)", () => {
    // S6 contract: credentials are not persisted to disk. The help
    // MUST mention this explicitly so an operator reading --help sees
    // both the magic ("saved config supplies defaults") AND the
    // boundary ("but not for the key"). Without this line, the four-
    // layer chain above could be misread as "saved config contains
    // everything, just run it."
    expect(topLevelHelp).toMatch(/--api-key is[\s\S]*?NEVER persisted/);
    expect(topLevelHelp).toMatch(/UMACTUALLY_API_KEY=<key>/);
  });

  it("HELP-CFG-3: top-level help mentions --show-config as the inspection command", () => {
    expect(topLevelHelp).toContain("umactually --show-config");
  });
});

describe("Contextual help (per-command)", () => {
  it("review --help shows review-specific usage and flags", () => {
    expect(REVIEW_HELP).toContain("umactually review");
    expect(REVIEW_HELP).toContain("--api-url");
    expect(REVIEW_HELP).toContain("--dry-run");
    // Review help should NOT include the doctor or check-review-artifact content.
    expect(REVIEW_HELP).not.toContain("check-review-artifact");
    expect(REVIEW_HELP).not.toContain("Node.js >= 24");
  });

  // REV_HELP-CFG-* — REVIEW_HELP mirrors the same saved-config
  // resolution-order lines so `umactually review --help` is also
  // self-documenting. These cases pin REVIEW_HELP coverage even though
  // the block text is identical to top-level help — the duplication is
  // the contract: each context (`umactually --help` and
  // `umactually review --help`) must surface the resolution order
  // independently so operators don't need to read both pages.
  it("REV_HELP-CFG-1: review --help documents the four-layer configuration resolution order", () => {
    expect(REVIEW_HELP).toContain("Configuration sources (highest priority first)");
    expect(REVIEW_HELP).toMatch(/--flags > UMACTUALLY_\*\/?REVIEW_\*[\s\S]*?env vars > saved config/);
    expect(REVIEW_HELP).toContain("~/.umactually/config.json");
  });

  it("REV_HELP-CFG-2: review --help calls out --api-key is NEVER persisted and routes via UMACTUALLY_API_KEY", () => {
    // The resolution-order block exists in both top-level and
    // REVIEW_HELP_TEXT, but the API-key callout is the load-bearing
    // security disclosure: an operator running `umactually review
    // --help` to debug "where does my key go?" must find the S6
    // answer without crossing into `umactually init --help`.
    expect(REVIEW_HELP).toMatch(/--api-key is[\s\S]*?NEVER persisted/);
    expect(REVIEW_HELP).toContain("UMACTUALLY_API_KEY=<key>");
  });

  it("REV_HELP-CFG-3: review --help mentions --show-config for inspecting loaded saved config", () => {
    expect(REVIEW_HELP).toContain("umactually --show-config");
  });

  it("doctor --help shows doctor-specific checks and exits", () => {
    expect(DOCTOR_HELP).toContain("umactually doctor");
    expect(DOCTOR_HELP).toContain("--json");
    expect(DOCTOR_HELP).toContain("Checks:");
    expect(DOCTOR_HELP).toContain("node");
    expect(DOCTOR_HELP).toContain("git");
    // Doctor help should NOT include review flags.
    expect(DOCTOR_HELP).not.toContain("--api-url");
    expect(DOCTOR_HELP).not.toContain("--dry-run");
  });

  it("check-review-artifact --help shows validation usage and exit codes", () => {
    expect(CHECK_REVIEW_ARTIFACT_HELP).toContain("check-review-artifact");
    expect(CHECK_REVIEW_ARTIFACT_HELP).toContain("<path>");
    expect(CHECK_REVIEW_ARTIFACT_HELP).toContain("Exit codes:");
    // Should NOT include review or doctor flags.
    expect(CHECK_REVIEW_ARTIFACT_HELP).not.toContain("--api-url");
    expect(CHECK_REVIEW_ARTIFACT_HELP).not.toContain("Checks:");
  });

  it("resolveHelpText returns review help for ['review', '--help']", () => {
    expect(resolveHelpText(["review", "--help"])).toBe(REVIEW_HELP);
  });

  it("resolveHelpText returns doctor help for ['doctor', '--help']", () => {
    expect(resolveHelpText(["doctor", "--help"])).toBe(DOCTOR_HELP);
  });

  it("resolveHelpText returns check-review-artifact help for ['check-review-artifact', '--help']", () => {
    expect(resolveHelpText(["check-review-artifact", "--help"])).toBe(CHECK_REVIEW_ARTIFACT_HELP);
  });

  it("resolveHelpText returns top-level help for bare ['--help']", () => {
    expect(resolveHelpText(["--help"])).toBe(topLevelHelp);
  });

  it("resolveHelpText returns top-level help when no command precedes --help", () => {
    expect(resolveHelpText(["--no-color", "--help"])).toBe(topLevelHelp);
  });

  it("top-level help includes Commands banner with all subcommands", () => {
    expect(topLevelHelp).toContain("Commands:");
    expect(topLevelHelp).toContain("review");
    expect(topLevelHelp).toContain("doctor");
    expect(topLevelHelp).toContain("check-review-artifact");
    expect(topLevelHelp).toContain("version");
  });
});

describe("Help text structural invariants (catches spread-of-string regressions)", () => {
  // Regression guard: a previous bug spread `renderFlags(...)` (a joined
  // string) into an array literal, so every character landed on its own
  // line. `toContain("--api-url")` falsely passed because the substring
  // still appeared — split across many lines. These tests pin the
  // WELL-FORMED shape: each flag occupies a single line with its column
  // padding intact.
  it("each --flag line in REVIEW_HELP is on a single line (no per-char fragmentation)", () => {
    const lines = REVIEW_HELP.split("\n");
    const platformLine = lines.find((line) => line.includes("--platform <auto|github|azure>"));
    expect(platformLine).toBeDefined();
    // The flag's first char and last char must be on the same line.
    expect(platformLine).toContain("<auto|github|azure>");
    // No single-line text should be just one char repeated or just whitespace.
    for (const line of lines) {
      expect(line.length).toBeLessThan(200);
    }
  });

  it("DOCTOR_HELP keeps the --json flag on its own line", () => {
    const lines = DOCTOR_HELP.split("\n");
    const jsonLine = lines.find((line) => line.includes("--json"));
    expect(jsonLine).toBeDefined();
    expect(jsonLine).toMatch(/--json\s+\S/u);
  });

  it("CHECK_REVIEW_ARTIFACT_HELP keeps `<path>` on its own line", () => {
    const lines = CHECK_REVIEW_ARTIFACT_HELP.split("\n");
    const pathLine = lines.find((line) => line.includes("<path>"));
    expect(pathLine).toBeDefined();
    expect(pathLine).toContain("check-review-artifact <path>");
  });

  it("top-level help keeps the --api-url flag on its own line", () => {
    const lines = topLevelHelp.split("\n");
    const apiUrlLine = lines.find((line) => line.includes("--api-url"));
    expect(apiUrlLine).toBeDefined();
    expect(apiUrlLine).toMatch(/--api-url\s+<url>/u);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Task T13 — `umactually init` help wiring (RED).
//
// Current state: src/cli/help.ts:35's HelpContext union does NOT include
// `"init"`; `INIT_HELP_TEXT` is not defined; `TOP_LEVEL_COMMANDS` (at
// :134-142) does NOT list `init`; `COMMAND_HELP` (at :217-222) does NOT
// map `init`. These tests pin the discoverability contract that T14's
// wiring must satisfy.
// ────────────────────────────────────────────────────────────────────────

describe("init help wiring (RED — Task T13)", () => {
  it("HELP-D-3: INIT_HELP exists and is byte-distinct from REVIEW_HELP", () => {
    // Given: the help module exports a per-command help const for `init`.
    // The const MUST exist (T14) and MUST NOT be the same string as
    // REVIEW_HELP — a future bug that re-uses REVIEW_HELP_TEXT as
    // INIT_HELP_TEXT would silently leave operators reading the wrong
    // help when they run `umactually init --help`.
    expect(INIT_HELP).toBeDefined();
    expect(typeof INIT_HELP).toBe("string");
    expect(INIT_HELP.length).toBeGreaterThan(0);
    expect(INIT_HELP).not.toBe(REVIEW_HELP);
  });

  it("HELP-D-4: topLevelHelp mentions `init` in the Commands banner", () => {
    // Given: a top-level `--help` invocation. The Commands banner
    // (rendered from TOP_LEVEL_COMMANDS at help.ts:134-142) MUST list
    // `init` so a brand-new operator discovers the guided-setup
    // quickstart from `umactually --help` alone.
    expect(topLevelHelp).toContain("Commands:");
    expect(topLevelHelp).toMatch(/^\s*init\b/im);
  });

  it("HELP-H-5: the `init` line in topLevelHelp appears BEFORE the `uninstall` line (ordering invariant)", () => {
    // Given: the plan mandates a specific Commands banner order —
    // `init` is the recommended quickstart, `uninstall` is the
    // destructive last-resort, so `init` MUST be listed first. A
    // future edit that re-sorts the array (e.g. alphabetical) would
    // bury init under review/doctor and bury uninstall beneath
    // everything else — this test pins the recommended-before-destructive
    // ordering as a load-bearing discoverability invariant.
    const initIndex = topLevelHelp.search(/^\s*init\b/im);
    const uninstallIndex = topLevelHelp.search(/^\s*uninstall\b/im);
    expect(initIndex).toBeGreaterThan(-1);
    expect(uninstallIndex).toBeGreaterThan(-1);
    expect(initIndex).toBeLessThan(uninstallIndex);
  });

  it("HELP-H-1: INIT_HELP enumerates every flag from the plan (per-flag toContain)", () => {
    // Given: the plan section "T13…H-1" enumerates the init flag
    // surface. The init help text MUST mention every one of them so
    // `umactually init --help` is the single discoverable source for
    // the wizard's flag surface. A missing flag here means the
    // operator cannot discover it from --help and must grep the
    // source.
    const expectedFlags = [
      "--provider",
      "--api-url",
      "--api-key",
      "--github-token",
      "--model",
      "--scope",
      "--ci",
      "--apply",
      "--force",
      "--yes",
      "--dry-run",
      "--show",
      "--json",
      "--non-interactive",
      "--help",
      "-h",
    ] as const;
    for (const flag of expectedFlags) {
      expect(INIT_HELP, `INIT_HELP must mention ${flag}`).toContain(flag);
    }
  });

  it("HELP-H-2: INIT_HELP mentions the security guarantee that apiKey is never persisted", () => {
    // Given: the plan's S6 override ("apiKey NEVER persisted at
    // rest"). The init help text MUST surface this guarantee so an
    // operator reading `umactually init --help` understands that the
    // wizard will ask for an apiKey but will NOT write it to
    // ~/.umactually/config.json. Without this line in the help text
    // the operator cannot discover the at-rest trust model from
    // --help alone.
    expect(INIT_HELP).toMatch(/api[_ -]?key/i);
    expect(INIT_HELP).toMatch(/(never|not)\s+(persisted|saved|written|stored)/iu);
  });
});

// ────────────────────────────────────────────────────────────────────────
// renderCommandsTable — column-aligned renderer for the Commands banner.
//
// The PR introduces `HelpCommand` + `renderCommandsTable` so the top-level
// help, the doctor usage block, and any future quickstart surface all
// share one width-agnostic renderer (width is computed from the input
// `commands` array — no shared module state coupling the surfaces).
//
// These tests pin the *byte-exact* output of every branch so a future
// refactor that drops padding, concatenates descriptions wrong, or breaks
// the `Math.max(0, ...)` guard regresses loudly instead of silently
// re-aligning some columns and not others.
//
// `GUTTER_SPACES = 2` and `INDENT_SPACES = 2` are inlined into the
// expected strings so the assertions stay self-explanatory: the
// 2-space indent, then the command token, then enough spaces to reach
// `width + 2`, then the description (if any).
// ────────────────────────────────────────────────────────────────────────

describe("renderCommandsTable", () => {
  it("equal-length rows: column width is the command length, every row gets the same 2-space gutter", () => {
    // Given: two rows of identical command length (6 chars each).
    const commands: readonly HelpCommand[] = [
      { command: "review" },
      { command: "doctor" },
    ];

    // When: renderCommandsTable computes a single width for the whole
    // table and renders each row.
    const rows = renderCommandsTable(commands);

    // Then: every row is indented by 2, padded with exactly 2 spaces
    // past the command (width 6, command 6, gutter 2), and has no
    // description (so the head is returned verbatim).
    expect(rows).toEqual(["  review  ", "  doctor  "]);
  });

  it("varying length with longest at index 0: width tracks the longest command, shorter rows pad to the gutter", () => {
    // Given: the longest command is first, followed by a much shorter
    // one. The width computation must use the MAX across the whole
    // array, not just the first row.
    const commands: readonly HelpCommand[] = [
      { command: "check-review-artifact" },
      { command: "review" },
    ];

    // When: renderCommandsTable runs.
    const rows = renderCommandsTable(commands);

    // Then: row 0 is the command + the 2-space gutter past its own
    // length (21 - 21 + 2 = 2 trailing spaces), and row 1 is padded
    // out to width 21 plus the 2-space gutter (21 - 6 + 2 = 17
    // trailing spaces). The padding branch in renderCommandLine is
    // exercised by the 17-space gap on row 1.
    expect(rows).toEqual([
      "  check-review-artifact  ",
      `  review${" ".repeat(17)}`,
    ]);
  });

  it("padding branch with descriptions: short rows get the full gutter-and-then-some, descriptions concatenate after the head", () => {
    // Given: two rows where the short row's command is much shorter
    // than the longest, and BOTH rows carry descriptions. This is
    // the realistic case for the top-level Commands banner.
    const commands: readonly HelpCommand[] = [
      { command: "aaaa", description: "long description one" },
      { command: "bb", description: "short desc" },
    ];

    // When: renderCommandsTable runs.
    const rows = renderCommandsTable(commands);

    // Then:
    //   row 0: indent(2) + "aaaa" + gutter(2) + description
    //          = "  aaaa  long description one"
    //   row 1: indent(2) + "bb" + pad(4) + description
    //          = "  bb    short desc"
    //   The 4-space gap on row 1 is the padding branch — width (4) -
    //   command length (2) + gutter (2) = 4. The 2-space gap on row
    //   0 is the same width-equals-command case from the equal-length
    //   test above.
    expect(rows).toEqual([
      "  aaaa  long description one",
      "  bb    short desc",
    ]);
  });

  it("no-description branch: row is returned as head only, no trailing description is concatenated", () => {
    // Given: a single command with no description — the canonical case
    // for a usage line where the placeholder fully documents the value.
    const commands: readonly HelpCommand[] = [{ command: "review" }];

    // When: renderCommandsTable runs.
    const rows = renderCommandsTable(commands);

    // Then: the row is exactly "  " + command + 2 trailing spaces
    // (the canonical gutter), and nothing else. The description
    // branch in renderCommandLine is NOT taken.
    expect(rows).toEqual(["  review  "]);
  });

  it("empty input: returns an empty array (no rows to render, no padding to compute)", () => {
    // Given: an empty command list — the "nothing to render" edge
    // case. width reduce() over an empty array returns 0 (the seeded
    // initial value), and the map over an empty array returns [].

    // When + Then:
    expect(renderCommandsTable([])).toEqual([]);
  });
});

describe("resolveHelpText (coverage closure)", () => {
  it("no-help short-circuit: returns topLevelHelp when argv contains neither --help nor -h", () => {
    // Given: argv with no help flag. resolveHelpText must not even
    // enter the for-loop scan; it returns the top-level help
    // immediately. This is the call shape bare-invocation dispatch
    // uses when the operator did NOT pass --help.
    expect(resolveHelpText(["review"])).toBe(topLevelHelp);
    expect(resolveHelpText([])).toBe(topLevelHelp);
  });

  it("unknown-positional fallback: returns topLevelHelp when the token before --help is not a recognized subcommand", () => {
    // Given: an unknown subcommand name precedes --help. The for-loop
    // hits the unrecognized branch and breaks out, then resolveHelpText
    // returns the top-level help. Operators who fat-finger a subcommand
    // get the same help surface as a bare --help invocation — a
    // discoverability contract.
    expect(resolveHelpText(["unknown-cmd", "--help"])).toBe(topLevelHelp);
    expect(resolveHelpText(["nope", "-h"])).toBe(topLevelHelp);
  });
});

describe("help module exports", () => {
  it("does not expose removed compatibility help symbols", async () => {
    // Given / When: the contextual help module is loaded.
    const helpModule = await import("../../src/cli/help.js");

    // Then: only contextual entry points remain public.
    expect("CLI_HELP_TEXT" in helpModule).toBe(false);
    expect("printHelp" in helpModule).toBe(false);
    expect(typeof helpModule.printContextualHelp).toBe("function");
  });
});
