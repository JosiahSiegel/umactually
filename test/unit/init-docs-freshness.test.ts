import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Resolve the package root from THIS test file's location
// (test/unit/init-docs-freshness.test.ts -> ../../package root).
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..", "..");

type DocSnapshot = {
  readonly exists: boolean;
  readonly body: string;
};

function loadDoc(relativePath: string): DocSnapshot {
  const absolute = resolve(packageRoot, relativePath);
  try {
    const body = readFileSync(absolute, "utf8");
    return { exists: true, body };
  } catch {
    return { exists: false, body: "" };
  }
}

// Lazy load-once: re-reading on every `it` is wasteful and the files
// are the contract under test, not test inputs.
const configuration = loadDoc("docs/configuration.md");
const exitCodes = loadDoc("docs/exit-codes.md");
const providers = loadDoc("docs/providers.md");
const security = loadDoc("docs/security.md");
const changelog = loadDoc("CHANGELOG.md");
const benchmark = loadDoc("docs/benchmark.md");
const architecture = loadDoc("docs/architecture.md");
const rootSecurity = loadDoc("SECURITY.md");
const issueConfig = loadDoc(".github/ISSUE_TEMPLATE/config.yml");

function precedenceSection(docBody: string): string {
  return docBody
    .split(/^##\s+Precedence\b/mu)[1]
    ?.split(/^(?:#|##)\s+/mu)[0]
    ?? "";
}

function precedenceTiersFromTable(docBody: string): readonly string[] {
  // v0.6.26 changed §Precedence from a numbered list to a markdown
  // table (one row per tier). The table surfaces the four-tier chain
  // (flag > env > saved config > default) more clearly than a flat
  // numbered list, especially for operators who skim column headers
  // to compare field-name conventions across tiers.
  //
  // Returns one entry per DATA row, each entry being the "Source" cell
  // (the second column). Skips the header row, the separator row, and
  // any non-table lines that follow the table.
  const section = precedenceSection(docBody);
  const lines = section.split(/\r?\n/u);
  const tiers: string[] = [];
  let inTable = false;
  let sawSeparator = false;
  for (const line of lines) {
    if (!line.includes("|")) {
      if (inTable) break;
      continue;
    }
    if (/^\s*\|[-\s|]+\|\s*$/u.test(line)) {
      sawSeparator = true;
      continue;
    }
    if (!inTable) {
      inTable = true;
      continue;
    }
    if (!sawSeparator) {
      // Malformed table (separator never appeared) — bail rather than
      // false-pass on header text.
      continue;
    }
    const match = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/u.exec(line);
    if (match === null) continue;
    tiers.push(match[2] ?? "");
  }
  return tiers;
}

function initTableSection(docBody: string): string {
  // Anchor on `umactually init` table heading variants. Accepts
  // ### `umactually init` exit codes or ### umactually init exit codes.
  return docBody
    .split(/^#{2,4}\s+`?umactually init`?\s+exit codes\b/mu)[1]
    ?.split(/^(?:#|##|###)\s+/mu)[0]
    ?? "";
}

function countMarkdownRows(tableBody: string): number {
  const lines = tableBody.split(/\r?\n/u);
  let count = 0;
  for (const line of lines) {
    if (!line.includes("|")) continue;
    if (/^\s*\|[-\s|]+\|\s*$/u.test(line)) continue;
    count += 1;
  }
  return count;
}

describe("docs/configuration.md precedence (§Precedence)", () => {
  it("INIT-DOC: §Precedence exists in docs/configuration.md", () => {
    expect(configuration.exists, "docs/configuration.md must exist").toBe(true);
    expect(precedenceSection(configuration.body).length).toBeGreaterThan(0);
  });

  it("INIT-DOC: §Precedence lists exactly 4 tier rows", () => {
    // v0.6.26: §Precedence is a markdown table (one data row per tier)
    // rather than a flat numbered list — the table makes the four-tier
    // chain (flag > env > saved config > default) easier to scan when
    // an operator reads the column headers and tries to compare
    // field-name conventions across tiers. Plan T15 (which prescribed
    // a 5th numbered item) is superseded: the legacy `REVIEW_*`
    // env alias is folded into the env tier rather than occupying its
    // own rung, so the chain has 4 tiers not 5.
    const tiers = precedenceTiersFromTable(configuration.body);
    expect(tiers).toHaveLength(4);
  });

  it("INIT-DOC: §Precedence tier #3 is the saved user config rung", () => {
    // Tier #3 (zero-indexed position 2) is the saved config rung.
    // Saved config moved from legacy "item #4" to the v0.6.26 tier #3
    // because the legacy `REVIEW_*` alias env no longer counts as a
    // separate rung.
    const tiers = precedenceTiersFromTable(configuration.body);
    expect(tiers.length, "§Precedence must list at least 3 tiers before tier #3 can be indexed").toBeGreaterThanOrEqual(3);
    const tier3 = tiers[2] ?? "";
    expect(tier3.toLowerCase()).toMatch(/saved(\s+user)?\s+config|savedconfig/u);
    expect(tier3).toMatch(/config\.json/u);
  });
});

describe("docs/exit-codes.md (`umactually init` table)", () => {
  it("INIT-DOC: docs/exit-codes.md has an `umactually init` exit-codes table", () => {
    // Plan T15: the new wizard has its own exit-code contract beyond
    // the existing Code | Meaning | When table. The heading text is
    // `### \`umactually init\` exit codes` (or similar — accept any
    // 2-4 # prefix plus the `umactually init` + `exit codes` tokens).
    expect(exitCodes.exists, "docs/exit-codes.md must exist").toBe(true);
    const table = initTableSection(exitCodes.body);
    expect(table.length, "expected an `umactually init` exit-codes table in docs/exit-codes.md").toBeGreaterThan(0);
  });

  it("INIT-DOC: `umactually init` exit-codes table has at least 4 rows", () => {
    // Bundle §1.8 enumerates 6 outcomes (interactive success/abort,
    // --non-interactive success, missing flags, permission/lock,
    // unknown flag, global 60s timeout). Pin ≥4 so a future doc
    // collapse to 2 rows is caught, but allow the prose author
    // latitude on row count.
    const table = initTableSection(exitCodes.body);
    expect(table).toMatch(/\|/u);
    const rowCount = countMarkdownRows(table);
    expect(rowCount).toBeGreaterThanOrEqual(4);
  });
});

describe("docs/providers.md (setup wizard section)", () => {
  it("INIT-DOC: docs/providers.md has a section mentioning `umactually init`", () => {
    // Plan T15: a §"Setup wizard" (or equivalent) section must cross-link
    // to `umactually init`. Match on the literal `umactually init`
    // anywhere in the doc body so the section heading can vary.
    expect(providers.exists, "docs/providers.md must exist").toBe(true);
    expect(providers.body).toContain("umactually init");
  });

  it("INIT-DOC: the setup-wizard section mentions at least one provider family", () => {
    // The wizard must walk the operator through one of three
    // families. Pin that the cross-link section names ≥1 family so
    // a future doc that links to `umactually init` without naming
    // any provider family is caught.
    expect(providers.body).toMatch(/umactually init/u);
    const mentionsFamily = /openai-compatible/u.test(providers.body)
      || /anthropic/u.test(providers.body)
      || /copilot/u.test(providers.body);
    expect(mentionsFamily, "providers.md must enumerate at least one provider family alongside `umactually init`").toBe(true);
  });
});

describe("docs/security.md (Trust model: init)", () => {
  it("INIT-DOC: docs/security.md has a `Trust model: init` heading", () => {
    // Plan T15: a `# Trust model: init` (or `## Trust model: init`)
    // section. Accept any heading depth 1-6 so the doc author can
    // pick the right nesting level.
    expect(security.exists, "docs/security.md must exist").toBe(true);
    expect(security.body).toMatch(/^#{1,6}\s+Trust model:\s+init\b/mu);
  });
});

describe("Task 14 product trust surfaces", () => {
  it("DOCS-TRUST: benchmark artifact and exact reproduction command are documented", () => {
    expect(benchmark.exists, "docs/benchmark.md must exist").toBe(true);
    expect(benchmark.body).toMatch(/schemaVersion/u);
    expect(benchmark.body).toMatch(/test:review-eval/u);
    expect(benchmark.body).toMatch(/claims inventory/i);
  });

  it("DOCS-TRUST: architecture maps supported surfaces and deferred boundaries", () => {
    expect(architecture.exists, "docs/architecture.md must exist").toBe(true);
    for (const term of ["GitLab", "Bitbucket", "hosted control plane", "opaque learning", "auto-commit"]) {
      expect(architecture.body).toContain(term);
    }
  });

  it("DOCS-TRUST: private advisory and support routes exist", () => {
    expect(rootSecurity.exists, "SECURITY.md must exist").toBe(true);
    expect(rootSecurity.body).toContain("/security/advisories/new");
    expect(issueConfig.exists, ".github/ISSUE_TEMPLATE/config.yml must exist").toBe(true);
    expect(issueConfig.body).toContain("/security/advisories/new");
    expect(issueConfig.body).toContain("/discussions");
  });
});

describe("CHANGELOG.md ([Unreleased] entry)", () => {
  it("INIT-DOC: CHANGELOG.md mentions `umactually init` in the most recent entry", () => {
    // Plan T20 (generalized for v0.6.24+ release flow): every release
    // entry that touches the wizard must include `umactually init`
    // verbatim somewhere in its body. Originally this test pinned the
    // [Unreleased] block, but post-release the Unreleased block is
    // empty by design (no pending changes until the next PR), and the
    // prior entry lives under `[X.Y.Z]`. Walk the most recent
    // non-Unreleased `[X.Y.Z]` section instead so the invariant
    // survives both pre-release and post-release states.
    expect(changelog.exists, "CHANGELOG.md must exist").toBe(true);
    // Split on every `## [` heading; the first chunk is the prose
    // before the first versioned entry (which is the bit we want to
    // skip). Filter out the [Unreleased] section explicitly.
    const chunks = changelog.body.split(/^##\s+\[/mu);
    const firstVersioned = chunks
      .slice(1) // drop the prose preamble
      .find((c) => !c.startsWith("Unreleased")) ?? "";
    expect(firstVersioned).toContain("umactually init");
  });
});