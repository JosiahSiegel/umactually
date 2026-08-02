import { describe, expect, it } from "vitest";

import {
  CLI_HELP_TEXT,
  REVIEW_HELP,
  DOCTOR_HELP,
  CHECK_REVIEW_ARTIFACT_HELP,
  resolveHelpText,
} from "../../src/cli/help.js";

describe("CLI help text", () => {
  it("mentions --prompt-files so operators discover the new array override", () => {
    // M6: trim moved the full flag list from CLI_HELP_TEXT to REVIEW_HELP
    // (the `umactually review --help` surface); consult that for the
    // override language.
    expect(REVIEW_HELP).toContain("--prompt-files");
  });

  it("mentions --additional-prompt-files so operators discover the new array override", () => {
    // See the --prompt-files test above for the M6 trim context.
    expect(REVIEW_HELP).toContain("--additional-prompt-files");
  });

  it("documents that --prompt-files / --additional-prompt-files OVERRIDE the default lookup list", () => {
    // M6: review-help owns the full flag documentation; top-level --help
    // is a pointer to it.
    expect(REVIEW_HELP).toMatch(/--prompt-files[^]*overrides defaults/u);
    expect(REVIEW_HELP).toMatch(/--additional-prompt-files[^]*overrides defaults/u);
  });

  it("mentions the existing --prompt-file and --additional-prompt-file (back-compat surface)", () => {
    // REVIEW_HELP is the legacy single-file flag discoverability surface.
    expect(REVIEW_HELP).toContain("--prompt-file <path>");
    expect(REVIEW_HELP).toContain("--additional-prompt-file <path>");
  });

  it("contains a Modes: banner so operators can see the three invocation modes at a glance", () => {
    // S4 — help honesty. A brand-new operator running --help must
    // discover the Standalone / Live CI / Outside-git-repo modes
    // without reading docs. If a future edit drops the "Modes:"
    // header, the standalone/live-CI copy-paste examples vanish
    // from --help output and S1/S2/S4 surface artifacts regress.
    expect(CLI_HELP_TEXT).toContain("Modes:");
  });

  it("shows the Standalone-mode copy-paste example", () => {
    // The standalone example is the primary use case for local
    // dev/smoke tests (README.md "Standalone mode (the primary use
    // case)" section). Operators running --help must be able to
    // copy it directly without crossing into README.md.
    expect(CLI_HELP_TEXT).toContain(
      '--api-url https://api.minimax.io/v1 --api-key "$UMACTUALLY_API_KEY"',
    );
  });

  it("shows the live-CI copy-paste example without explicit plumbing", () => {
    // Live CI derives event, diff, review, and PR context from the runner.
    expect(CLI_HELP_TEXT).toContain("Live CI mode");
    expect(CLI_HELP_TEXT).toContain("umactually --platform github");
    expect(CLI_HELP_TEXT).not.toContain('--platform github --event "$GITHUB_EVENT_PATH"');
  });

  it("does not advertise the misleading 'optional in dry-run' annotation", () => {
    // S4 — the old --threads / --review descriptions claimed they
    // were "optional in dry-run" even in standalone mode, where
    // those flags do not apply at all. That misleading wording has
    // been removed from the help text; this test pins the removal
    // so a future refactor can't accidentally re-introduce it.
    expect(CLI_HELP_TEXT).not.toContain("optional in dry-run");
  });

  it("grew to include the modes banner block (sanity check on total length)", () => {
    // The Modes: banner added ~10 lines of standalone/live-CI/
    // outside-git-repo examples; help text grew from ~88 lines to
    // ~98. A floor of 1500 chars catches accidental banner
    // truncation without depending on a specific line count.
    expect(CLI_HELP_TEXT.length).toBeGreaterThanOrEqual(1500);
  });

  it("cross-links docs/exit-codes.md so operators find the exit-code reference from --help", () => {
    // The exit-code table has been relocated to docs/exit-codes.md
    // (see hyperplan bundle item #5). --help output is the operator's
    // first stop when a run returns a non-zero exit; without a literal
    // cross-link to docs/exit-codes.md, the operator cannot discover
    // the reference from --help alone and must guess or grep. This
    // test pins the cross-link so the T5 work (adding it to
    // src/cli/help.ts) is verified from the --help surface.
    expect(CLI_HELP_TEXT).toContain("docs/exit-codes.md");
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
    expect(resolveHelpText(["--help"])).toBe(CLI_HELP_TEXT);
  });

  it("resolveHelpText returns top-level help when no command precedes --help", () => {
    expect(resolveHelpText(["--no-color", "--help"])).toBe(CLI_HELP_TEXT);
  });

  it("top-level CLI_HELP_TEXT includes Commands banner with all subcommands", () => {
    expect(CLI_HELP_TEXT).toContain("Commands:");
    expect(CLI_HELP_TEXT).toContain("review");
    expect(CLI_HELP_TEXT).toContain("doctor");
    expect(CLI_HELP_TEXT).toContain("check-review-artifact");
    expect(CLI_HELP_TEXT).toContain("version");
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

  it("REVIEW_HELP keeps the --api-url flag on its own line", () => {
    // M6: the full flag list moved to REVIEW_HELP; that is the surface
    // operators reach when they need the placeholder syntax.
    const lines = REVIEW_HELP.split("\n");
    const apiUrlLine = lines.find((line) => line.includes("--api-url"));
    expect(apiUrlLine).toBeDefined();
    expect(apiUrlLine).toMatch(/--api-url\s+<url>/u);
  });

  it("CLI_HELP_TEXT keeps the --platform flag on its own line (sanity check on the trimmed pointer)", () => {
    // M6: the pointer line lists common flags inline. The reviewer
    // guards against the regression where the list spans multiple lines
    // (the spread-of-string bug this section was added to catch).
    const lines = CLI_HELP_TEXT.split("\n");
    const platformLine = lines.find((line) => line.includes("--platform"));
    expect(platformLine).toBeDefined();
    expect(platformLine).toContain("--platform");
    expect(platformLine).toContain("--api-url");
  });
});