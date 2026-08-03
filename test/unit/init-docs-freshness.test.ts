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

function precedenceSection(docBody: string): string {
  return docBody
    .split(/^##\s+Precedence\b/mu)[1]
    ?.split(/^(?:#|##)\s+/mu)[0]
    ?? "";
}

function numberedItemsInPrecedence(docBody: string): readonly string[] {
  const section = precedenceSection(docBody);
  const lines = section.split(/\r?\n/u);
  const items: string[] = [];
  for (const line of lines) {
    const match = /^\s*(\d+)\.\s+(.+?)\s*$/u.exec(line);
    if (match !== null) {
      items.push(match[2] ?? "");
    }
  }
  return items;
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

  it("INIT-DOC: §Precedence lists exactly 5 numbered items", () => {
    // Plan T15: precedence must gain a 5th rung for saved user config.
    // The current doc has 4 — this row fails until T16 inserts the
    // Saved user config entry between REVIEW_* env and the built-in
    // default.
    const items = numberedItemsInPrecedence(configuration.body);
    expect(items.length).toBe(5);
  });

  it("INIT-DOC: §Precedence item #4 is the saved user config rung", () => {
    // Item index 3 (zero-based) must name the saved config rung.
    // Match the planning prose "Saved user config" plus tolerant
    // synonyms ("saved config", "savedConfig") since the doc author
    // may pick any one.
    const items = numberedItemsInPrecedence(configuration.body);
    expect(items.length, "§Precedence must list at least 4 items before this row can index #4").toBeGreaterThanOrEqual(4);
    const fourth = items[3] ?? "";
    expect(fourth.toLowerCase()).toMatch(/saved(\s+user)?\s+config|savedconfig/u);
    expect(fourth).toMatch(/config\.json/u);
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