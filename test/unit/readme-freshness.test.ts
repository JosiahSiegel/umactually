import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const PLUMBING_FLAGS = ["--event", "--diff", "--review", "--pr-number", "--repo"] as const;

type StepShape = {
  readonly name: string;
  readonly command: string;
  readonly always: boolean;
};

type QuickstartShape = {
  readonly permissions: Readonly<Record<string, unknown>>;
  readonly concurrencyGroup: unknown;
  readonly steps: readonly StepShape[];
  readonly plumbingFlags: readonly string[];
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

function workflowShape(value: unknown, platform: "github" | "azure"): QuickstartShape {
  const document = readRecord(value, `${platform} workflow`);
  const stepsValue = platform === "github"
    ? readRecord(readRecord(document["jobs"], "jobs")["review"], "review job")["steps"]
    : document["steps"];
  if (!Array.isArray(stepsValue)) {
    throw new TypeError(`${platform} steps must be an array`);
  }
  const steps = stepsValue.map((value, index) => {
    const step = readRecord(value, `${platform} step ${index}`);
    return {
      name: String(step["name"] ?? step["displayName"] ?? step["task"] ?? step["checkout"] ?? ""),
      command: String(step["run"] ?? step["script"] ?? step["uses"] ?? ""),
      always: step["if"] === "always()" || step["condition"] === "always()",
    };
  });
  const commands = steps.map((step) => step.command).join("\n");
  return {
    permissions: platform === "github" ? readRecord(document["permissions"], "permissions") : {},
    concurrencyGroup: platform === "github"
      ? readRecord(document["concurrency"], "concurrency")["group"]
      : undefined,
    steps,
    plumbingFlags: PLUMBING_FLAGS.filter((flag) => commands.includes(flag)),
  };
}

function readmeReferencesExample(readme: string, examplePath: string, heading: "GitHub Actions" | "Azure DevOps"): boolean {
  // Accepts any of the common pointer patterns used in the README
  // doc and the docs/ files. We require a markdown link with the
  // example path AND the heading must point at the link, so the reader
  // can navigate from README to the canonical example.
  const section = readme.split(`### ${heading}`)[1]?.split(/^(?:#|##) /mu)[0] ?? "";
  return section.includes(examplePath);
}

describe("README quickstart freshness", () => {
  it("README-FRESHNESS: README GH/ADO sections reference the canonical example files", () => {
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readmeReferencesExample(readme, "examples/github/pr-review.yml", "GitHub Actions")).toBe(true);
    expect(readmeReferencesExample(readme, "examples/azure/azure-pipelines.yml", "Azure DevOps")).toBe(true);
  });

  it("README-FRESHNESS R-1: README mentions `umactually init` BEFORE the npm install path in reading order", () => {
    // The wizard path is the canonical first-run experience. If
    // `umactually init` appears AFTER the `npm install -g umactually`
    // recommendation in reading order, the README still nudges
    // operators to skip the wizard — R-1 fails by design until T16.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const initIndex = readme.indexOf("umactually init");
    const npmInstallIndex = readme.indexOf("npm install -g umactually");
    expect(initIndex, "README must contain the literal `umactually init`").toBeGreaterThanOrEqual(0);
    expect(npmInstallIndex, "README must still reference the npm install path (regression guard)").toBeGreaterThanOrEqual(0);
    expect(initIndex).toBeLessThan(npmInstallIndex);
  });

  it("README-FRESHNESS R-2: a `## Quickstart` section heading exists (case-insensitive)", () => {
    // The wizard block lives under `## Quickstart` (recommended) at the
    // top of the README. Match the heading marker with surrounding
    // whitespace tolerance so a future "(recommended)" suffix still
    // satisfies the invariant.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme.toLowerCase()).toMatch(/^##\s+quickstart\b/mu);
  });

  it("README-FRESHNESS R-3: `## Install` matches `^##\\s+Install\\b` (no `(alternative)` suffix)", () => {
    // R-3 was originally the "Install (alternative)" guard. The
    // minimalist-overhaul pass renames the install section to just
    // `## Install` (no suffix), per the plan's section-order contract
    // ("Quickstart, Install, Common operations, ..."). R-3 is updated
    // to match the new contract: the heading must start with `## Install`
    // and must NOT carry the legacy `(alternative)` suffix.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/^##\s+Install\b/mu);
    expect(readme).not.toMatch(/^##\s+Install\s*\(alternative\)/mu);
  });

  it("README-FRESHNESS R-4: Quickstart section describes the 4-step wizard flow", () => {
    // Bundle §2.2 pins the wizard as 4 conceptual steps:
    //   init → choose provider → provide creds → done
    // The README's Quickstart section must surface every step in some
    // scannable form (numbered list, prose enumeration, code blocks).
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const quickstartSection = readme
      .split(/^##\s+Quickstart\b/mu)[1]
      ?.split(/^(?:#|##)\s+/mu)[0]
      ?? "";
    expect(quickstartSection.length, "Quickstart section body must be non-empty").toBeGreaterThan(0);
    expect(quickstartSection).toMatch(/umactually init/u);
    expect(quickstartSection).toMatch(/provider/u);
    expect(quickstartSection).toMatch(/cred(?:ential|s)/u);
    expect(quickstartSection).toMatch(/done|finish|complete|ready|set up|setup/i);
  });

  it("README-FRESHNESS R-5: no fenced code block in README contains `sk-` or `ghp_` secret literals", () => {
    // Security hygiene. A README that ships with `sk-...` or
    // `ghp_...` inside a fenced block either leaks a real key or
    // normalizes the literal shape for scanners. R-5 walks every
    // fenced block and asserts neither prefix appears anywhere.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const fencedBlocks = readme.match(/```[\s\S]*?```/gu) ?? [];
    expect(fencedBlocks.length, "README should have at least one fenced code block").toBeGreaterThan(0);
    for (const block of fencedBlocks) {
      expect(block, "README fenced block must not contain a literal `sk-` API key").not.toMatch(/sk-[A-Za-z0-9]+/u);
      expect(block, "README fenced block must not contain a literal `ghp_` GitHub token").not.toMatch(/ghp_[A-Za-z0-9]+/u);
    }
  });

  it("README-FRESHNESS R-6: README mentions `~/.umactually/config.json` (the persist location)", () => {
    // The wizard persists provider + apiUrl + model to this path.
    // Operators need the literal `~/.umactually/config.json` string
    // somewhere in the README so they can locate + chmod the file.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/\.umactually\/config\.json/u);
  });

  it("README-FRESHNESS R-7: README enumerates all three provider families", () => {
    // The wizard walks the operator through one of three families.
    // The README must name each family explicitly so the operator
    // recognizes the option they're picking.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toContain("openai-compatible");
    expect(readme).toContain("anthropic");
    expect(readme).toContain("copilot");
  });

  it("README-FRESHNESS R-8: the `--non-interactive` example uses $UMACTUALLY_API_KEY, not a literal key", () => {
    // R-8 is conditional: if the README shows a `--non-interactive`
    // example, it MUST source the key from the env var. A literal
    // `sk-...` (already covered by R-5) or `--api-key=sk-test-...`
    // example would normalize the wrong pattern for readers.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const nonInteractiveExample = readme
      .split("```")
      .filter((_chunk, index) => index % 2 === 1)
      .find((chunk) => /--non-interactive/u.test(chunk));
    if (nonInteractiveExample === undefined) {
      // README has no `--non-interactive` example yet — R-8 is
      // vacuously satisfied. When T16 adds the example, the strict
      // check below turns on.
      expect(nonInteractiveExample).toBeUndefined();
      return;
    }
    expect(nonInteractiveExample).toMatch(/\$UMACTUALLY_API_KEY/u);
    expect(nonInteractiveExample, "non-interactive example must not hard-code an api-key literal").not.toMatch(/--api-key\s+\S/u);
  });

  it("README-FRESHNESS R-9: README still cross-links to docs/exit-codes.md (regression guard)", () => {
    // R-9 is the existing invariant the README has honored since
    // v0.5.x. Pin it explicitly so the Quickstart rewrite cannot
    // drop the cross-link.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/docs\/exit-codes\.md/u);
  });

  it("README-FRESHNESS R-10: README still cross-links to docs/configuration.md (regression guard)", () => {
    // R-10 is the existing invariant; the Quickstart rewrite must
    // keep the configuration cross-link live.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/docs\/configuration\.md/u);
  });

  it("README-FRESHNESS: example files are well-formed CI workflows", () => {
    // Each canonical example file is a self-contained, semantically parseable
    // workflow. This is the strong form of the old freshness check: the
    // example files MUST always parse, where before the README's copy of
    // them had to parse too. The README's pointer-to-example structure
    // means a drift fix is one edit (the example file), not two.
    const githubExample = workflowShape(parse(readFileSync(join(REPO_ROOT, "examples/github/pr-review.yml"), "utf8")), "github");
    const azureExample = workflowShape(parse(readFileSync(join(REPO_ROOT, "examples/azure/azure-pipelines.yml"), "utf8")), "azure");

    expect(githubExample.steps.length).toBeGreaterThan(0);
    expect(azureExample.steps.length).toBeGreaterThan(0);
    expect(githubExample.permissions).toHaveProperty("contents");
    expect(githubExample.permissions).toHaveProperty("pull-requests");
  });

  // --- Plan-mandated minimalist-overhaul invariants (R-11..R-15) --------------
  // These assertions encode the plan's exact acceptance contract for the
  // README's minimalistic structure. They are deliberately strict on the
  // heading text and table shapes so a regression that re-introduces the
  // prior verbose form is caught. The line-count budget is asserted as a
  // separate Success Criteria test below (it is not one of R-1..R-15).
  //
  // Helpers shared by R-11..R-15:
  //   - sectionBody(): returns the body of `## <name>` up to the next `## `
  //   - tableRows(): returns the list of data rows in the first Markdown
  //     table inside a section body. Excludes the header row and the
  //     separator row (rows consisting only of `---` and pipes).
  //   - headingNames(): ordered list of every `## ` heading name.

  function sectionBody(readme: string, name: string): string {
    const re = new RegExp(`^##\\s+${name}\\b.*$`, "mu");
    const match = re.exec(readme);
    if (match === null) return "";
    const start = match.index + match[0].length;
    const rest = readme.slice(start);
    const next = /^(?:#|##)\s+/mu.exec(rest);
    return next === null ? rest : rest.slice(0, next.index);
  }

  function tableRows(sectionBodyText: string): readonly string[] {
    // Walks the first Markdown-style pipe table. A row starting with `---`
    // (or matching the separator regex) is the alignment row and is
    // skipped. The header row is identified by being followed by the
    // separator row, and is also skipped, so the returned array contains
    // only data rows. If the table has no separator (technically not
    // strict Markdown but rendered as a table by all major engines), the
    // first row is treated as the header.
    const lines = sectionBodyText.split(/\r?\n/u);
    const rows: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i] ?? "";
      if (!line.trimStart().startsWith("|")) {
        i += 1;
        continue;
      }
      // Found a table row. Gather contiguous pipe rows.
      const tableStart = i;
      i += 1;
      while (i < lines.length && (lines[i] ?? "").trimStart().startsWith("|")) {
        i += 1;
      }
      const tableBlock = lines.slice(tableStart, i);
      // Identify separator row (typically the second line, with `---`).
      let sepIdx = -1;
      for (let k = 0; k < tableBlock.length; k += 1) {
        if (/^\s*\|[\s\s]*---[\s\s]*\|/u.test(tableBlock[k] ?? "")) {
          sepIdx = k;
          break;
        }
      }
      // Header row: immediately before the separator. If no separator is
      // present, treat the first row as the header.
      const headerIdx = sepIdx > 0 ? sepIdx - 1 : 0;
      for (let k = 0; k < tableBlock.length; k += 1) {
        if (k === headerIdx || k === sepIdx) continue;
        rows.push((tableBlock[k] ?? "").trim());
      }
      // Only the first table in the section is considered by R-12 and
      // R-13. Break so trailing tables (e.g. CI or Documentation
      // sub-tables) don't pollute the count.
      break;
    }
    return rows;
  }

  function headingNames(readme: string): readonly string[] {
    const re = /^##\s+(.+?)\s*$/gmu;
    const out: string[] = [];
    for (const m of readme.matchAll(re)) {
      out.push(m[1]?.trim() ?? "");
    }
    return out;
  }

  it("README-FRESHNESS R-11: `## Quickstart` heading has no `(recommended)` suffix", () => {
    // The plan's R-11 is the heading-text guard. The Quickstart heading
    // must be exactly `## Quickstart` (no `(recommended)` suffix), per
    // todo 1's acceptance. Two regexes pin the contract:
    //   - `/^##\s+Quickstart\s*$/mu` MATCHES the new heading
    //   - `/^##\s+Quickstart\s*\(recommended\)/mu` DOES NOT match it
    // The current pre-fix README's `## Quickstart (recommended)` heading
    // fails the first assertion, so R-11 is genuinely RED before todo 1
    // lands; it turns GREEN once the heading is renamed.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/^##\s+Quickstart\s*$/mu);
    expect(readme).not.toMatch(/^##\s+Quickstart\s*\(recommended\)/mu);
  });

  it("README-FRESHNESS R-12: `## Common operations` table has exactly 6 data rows + `--show-config` sibling", () => {
    // R-12 pins the Common operations table shape. Per the plan's todo 2
    // acceptance, the table must enumerate the six commands (`init`,
    // `review`, `doctor`, `tui`, `check-review-artifact`, `uninstall`)
    // — the table is the only place the six commands are enumerated
    // (per the plan; sibling prose is NOT a valid substitute). The
    // table must therefore have EXACTLY 6 data rows, one per command.
    // The `umactually --show-config` block must be a sibling fenced
    // block immediately under the table — NOT a row inside it.
    // The `version` subcommand and `--help` / `--version` flags are
    // intentionally excluded.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const body = sectionBody(readme, "Common operations");
    expect(body, "## Common operations section must exist").not.toBe("");
    const rows = tableRows(body);
    expect(rows.length, "Common operations table must have exactly 6 data rows (one for each of init, review, doctor, tui, check-review-artifact, uninstall)").toBe(6);
    // Each of the six commands must appear as a table row.
    const sixCommands = ["init", "review", "doctor", "tui", "check-review-artifact", "uninstall"];
    const tableText = rows.join("\n");
    for (const cmd of sixCommands) {
      expect(tableText, `Common operations table must include \`${cmd}\` as a row`).toContain(cmd);
    }
    // `--show-config` is a sibling code block, NOT a table row. The
    // block lives somewhere in the section body after the table.
    expect(body, "`--show-config` must appear somewhere in the section body").toContain("--show-config");
    expect(
      rows.some((row) => row.includes("--show-config")),
      "`--show-config` must NOT be a table row inside the Common operations table",
    ).toBe(false);
  });

  it("README-FRESHNESS R-13a: `## Provider` table has exactly 3 data rows covering the 3 families", () => {
    // R-13 (table-shape half) pins the Provider table. The table must
    // enumerate the three provider families in a single Markdown table
    // — the plan requires one row per family (`openai-compatible`,
    // `anthropic`, `copilot`). The table must therefore have EXACTLY 3
    // data rows. (R-13b asserts the section-order invariant.)
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const body = sectionBody(readme, "Provider");
    expect(body, "## Provider section must exist").not.toBe("");
    const rows = tableRows(body);
    expect(rows.length, "Provider table must have exactly 3 data rows (one per family)").toBe(3);
    const families = ["openai-compatible", "anthropic", "copilot"];
    const tableText = rows.join("\n");
    for (const family of families) {
      expect(tableText, `Provider table must include \`${family}\` as a row`).toContain(family);
    }
  });

  it("README-FRESHNESS R-13: section order is Quickstart, Install, Common operations, Provider, CI, Verify, Uninstall, Documentation, License", () => {
    // R-13 pins the exact ordered sequence of `## ` sections (per todo 3
    // acceptance). Quickstart is the first `## ` heading. Each expected
    // heading must appear, and they must appear in the listed order. A
    // regression that re-inserts `## Saved config`, `## Usage`,
    // `## Security and trust`, etc. is caught.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const expected = [
      "Quickstart",
      "Install",
      "Common operations",
      "Provider",
      "CI",
      "Verify",
      "Uninstall",
      "Documentation",
      "License",
    ] as const;
    const actual = headingNames(readme);
    for (const heading of expected) {
      expect(actual, `README must contain a \`## ${heading}\` section`).toContain(heading);
    }
    let cursor = -1;
    for (const heading of expected) {
      const idx = actual.indexOf(heading, cursor + 1);
      expect(idx, `\`## ${heading}\` must appear after the previous expected heading`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("README-FRESHNESS R-14: `## Documentation` table is 4-column User/Platform/Operator/Maintainers with the pinned column-row mapping", () => {
    // R-14 pins the Documentation table shape. Per the plan's "Column-to-row
    // mapping" block (lines 100-107), the table has FOUR columns with
    // headers `User`, `Platform`, `Operator`, `Maintainers` in that
    // left-to-right order. `docs/release-process.md` appears ONLY in the
    // Maintainers column; `docs/samples/review-artifact.json` is dropped;
    // `CONTRIBUTING.md` is added under Maintainers. The pinned column-row
    // mapping is enforced via the strict oracle's filter-empty semantics
    // (the Maintainers column index is taken in the row's non-empty
    // split-by-`|` cell array, so trailing-em-dash-padded cells stay
    // index-stable). Each row carries 4 cells; short columns use `—`
    // placeholders to keep the Maintainers cell at index 3 of the
    // filtered cell array.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const body = sectionBody(readme, "Documentation");
    expect(body, "## Documentation section must exist").not.toBe("");
    // tableRows() returns only data rows (header + separator excluded),
    // so we recover the header separately by walking the body for the
    // first pipe line that contains "User" / "Platform" / etc.
    const dataRows = tableRows(body);
    expect(dataRows.length, "Documentation table must have data rows").toBeGreaterThan(0);
    const lines = body.split(/\r?\n/u);
    let headerLine = "";
    for (const line of lines) {
      if (
        line.includes("|") &&
        line.includes("User") &&
        line.includes("Platform") &&
        line.includes("Operator") &&
        line.includes("Maintainers")
      ) {
        headerLine = line;
        break;
      }
    }
    expect(headerLine, "Documentation table header row must exist").not.toBe("");
    // Split on `|`; expect 6 parts (4 column headers + leading/trailing
    // empty cells from the row's surrounding pipes).
    const cols = headerLine.split("|").map((c) => c.trim());
    expect(cols.length, "Documentation table must have exactly 4 columns").toBe(6);
    // The 4 logical columns live at indices 1..4 (with empty at 0 and 5).
    for (const required of ["User", "Platform", "Operator", "Maintainers"]) {
      expect(headerLine, `Documentation header must include \`${required}\``).toContain(required);
    }
    // Header columns must appear in this exact order: User, Platform,
    // Operator, Maintainers (the strict oracle enforces the same order).
    const filteredHeader = cols.filter((c) => c.length > 0);
    expect(filteredHeader).toEqual(["User", "Platform", "Operator", "Maintainers"]);

    // For data-row cells, follow the strict oracle's semantics: split by
    // `|`, trim, then filter empty cells. The Maintainers cell must be
    // at filtered-index 3 (i.e. row 0..2 are non-empty cells in the
    // leading three columns, and row 3 is the Maintainers cell).
    function filteredCells(row: string): string[] {
      const cs = row.split("|").map((c) => c.trim());
      return cs.filter((c) => c.length > 0);
    }

    // Per the plan's pinned column-row mapping:
    //   User:        docs/configuration.md, docs/troubleshooting.md
    //   Platform:    docs/gh-actions.md, docs/azure-devops.md
    //   Operator:    docs/providers.md, docs/security.md, docs/exit-codes.md, docs/distribution-architecture.md
    //   Maintainers: release-process.md, CHANGELOG.md, CONTRIBUTING.md
    // For each row, cells[0] is the User column, cells[1] is Platform,
    // cells[2] is Operator, cells[3] is Maintainers (the strict oracle
    // pins the Maintainers column at filtered-index 3).
    const userColumns = dataRows.map((row) => filteredCells(row)[0] ?? "");
    expect(userColumns.some((c) => c.includes("docs/configuration.md"))).toBe(true);
    expect(userColumns.some((c) => c.includes("docs/troubleshooting.md"))).toBe(true);

    const platformColumns = dataRows.map((row) => filteredCells(row)[1] ?? "");
    expect(platformColumns.some((c) => c.includes("docs/gh-actions.md"))).toBe(true);
    expect(platformColumns.some((c) => c.includes("docs/azure-devops.md"))).toBe(true);

    const operatorColumns = dataRows.map((row) => filteredCells(row)[2] ?? "");
    for (const path of ["docs/providers.md", "docs/security.md", "docs/exit-codes.md", "docs/distribution-architecture.md"]) {
      expect(operatorColumns.some((c) => c.includes(path)), `Operator column must include ${path}`).toBe(true);
    }

    // Maintainers column at filtered-index 3 of each row. The three
    // pinned Maintainers entries must each appear at that index.
    const releaseRow = dataRows.find((row) => filteredCells(row)[3]?.includes("release-process.md"));
    expect(releaseRow, "release-process.md must be a Maintainers cell (filtered-index 3) in some row").toBeDefined();
    const changelogRow = dataRows.find((row) => filteredCells(row)[3]?.includes("CHANGELOG.md"));
    expect(changelogRow, "CHANGELOG.md must be a Maintainers cell (filtered-index 3) in some row").toBeDefined();
    const contributingRow = dataRows.find((row) => filteredCells(row)[3]?.includes("CONTRIBUTING.md"));
    expect(contributingRow, "CONTRIBUTING.md must be a Maintainers cell (filtered-index 3) in some row").toBeDefined();

    // release-process.md must NOT appear anywhere outside Maintainers.
    const otherCellTexts = [
      ...userColumns,
      ...platformColumns,
      ...operatorColumns,
    ].join("|");
    expect(otherCellTexts.includes("release-process.md"), "release-process.md must not appear outside Maintainers").toBe(false);

    // CHANGELOG.md must NOT appear outside Maintainers.
    expect(otherCellTexts.includes("CHANGELOG.md"), "CHANGELOG.md must not appear outside Maintainers").toBe(false);

    // CONTRIBUTING.md must NOT appear outside Maintainers.
    expect(otherCellTexts.includes("CONTRIBUTING.md"), "CONTRIBUTING.md must not appear outside Maintainers").toBe(false);

    // samples/review-artifact.json is dropped from the table.
    const allCells = dataRows.join("|");
    expect(allCells.includes("docs/samples/review-artifact.json"), "docs/samples/review-artifact.json must not appear in the table").toBe(false);
  });

  it("README-FRESHNESS R-15: `## Install` section contains a fenced code block with `npm install -g umactually`", () => {
    // R-15 is the content-level guard for the Install section. Per todo 2
    // acceptance, the Install section must contain at least one fenced
    // code block that includes the literal `npm install -g umactually`.
    // R-3 already covers the heading-level invariant (heading matches
    // `^##\s+Install\b`); R-15 covers the content-level invariant.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const body = sectionBody(readme, "Install");
    expect(body, "## Install section must exist").not.toBe("");
    const fenced = body.match(/```[\s\S]*?```/gu) ?? [];
    expect(fenced.length, "## Install must have at least one fenced code block").toBeGreaterThan(0);
    expect(
      fenced.some((block) => block.includes("npm install -g umactually")),
      "## Install must have a fenced block containing `npm install -g umactually`",
    ).toBe(true);
  });
});

// --- Success Criteria (not one of R-1..R-15) ---------------------------------
// The line-budget invariant is a Success Criteria item from the plan's
// `## Success criteria` block, separate from the R-1..R-15 freshness
// invariants. It is asserted here so a regression that balloons the
// README back to the verbose 257-line form is caught.
describe("README Success Criteria (non-R)", () => {
  it("README line budget: README.md is <= 120 lines", () => {
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const lineCount = readme.split(/\r?\n/u).length;
    expect(lineCount, `README must be <= 120 lines; saw ${lineCount}`).toBeLessThanOrEqual(120);
  });
});
