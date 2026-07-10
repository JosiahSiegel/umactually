// SPDX-License-Identifier: MIT
/**
 * Verified facts layer — pre-computed repo-state assertions that the
 * model receives in the prompt and that the post-filter uses to
 * downgrade findings that contradict the diff.
 *
 * Why this exists
 * ---------------
 * On PR #41 the model emitted a Critical finding claiming "dist/ is not
 * listed in files so the npm-published action will fail at runtime",
 * even though the diff for package.json showed `dist` present both
 * before and after the change (`npm pack --dry-run` confirmed dist/
 * ships). The model was making a verifiable repo-state claim without
 * grounding it in the diff.
 *
 * The fix has two halves:
 *   1. Before sending to the model, scan the post-change state of a
 *      handful of known structured fields (package.json#files,
 *      action.yml#outputs, etc.) and produce a "Verified facts" block
 *      the model sees BEFORE the diff. The model can then read the
 *      facts and avoid asserting facts the action can already prove.
 *   2. After the model responds, scan each finding's body for
 *      contradiction patterns (e.g. "X is missing from Y" when the
 *      verified facts say X is in Y). Downgrade such findings to
 *      `info` rather than posting them at their claimed severity.
 *
 * This module only does the extraction (step 1). The post-filter is in
 * `src/cli/verify-findings.ts`.
 *
 * Design constraints
 * ------------------
 * - Source of truth: the diff. The action runs in a consumer's
 *   checkout where cwd/package.json is NOT UmActually's package.json
 *   — we cannot read the worktree. We reconstruct each file's
 *   post-change content from the diff hunks (context lines + added
 *   lines, ignoring removed lines).
 * - Conservative: if a fact cannot be extracted with high
 *   confidence, it is OMITTED. The model should not see a half-baked
 *   fact and assume it's authoritative.
 * - Cheap: O(diff length) parse. One JSON.parse call per structured
 *   field. No external commands, no network.
 */
import { listDiffPaths } from "../diff/filter-build-artifacts.js";

export type PackageJsonFilesFact = {
  readonly kind: "package-json-files";
  /** The package.json "files" array (post-change). Empty if not extractable. */
  readonly files: readonly string[];
};

export type PackageJsonBinFact = {
  readonly kind: "package-json-bin";
  /** package.json "bin" entries (post-change). Empty if not extractable. */
  readonly binEntries: readonly string[];
};

export type PackageJsonMainFact = {
  readonly kind: "package-json-main";
  /** package.json "main" string (post-change). null if not extractable. */
  readonly main: string | null;
};

export type ActionOutputsFact = {
  readonly kind: "action-outputs";
  /** action.yml `outputs:` keys (post-change). Empty if action.yml has no outputs block. */
  readonly outputKeys: readonly string[];
};

export type VerifiedFacts = {
  /** The PR's file list (every path that appears in the diff). */
  readonly filesInDiff: readonly string[];
  /** Known package.json fields, when extractable. */
  readonly packageJsonFiles: PackageJsonFilesFact | null;
  readonly packageJsonBin: PackageJsonBinFact | null;
  readonly packageJsonMain: PackageJsonMainFact | null;
  /** action.yml outputs block when extractable. */
  readonly actionOutputs: ActionOutputsFact | null;
};

/**
 * Derive verified facts from the supplied PR diff text.
 *
 * Reconstructs the post-change content of `package.json` and
 * `action.yml` from the diff hunks (the action cannot read the
 * consumer's worktree safely — cwd is the consumer's repo, not ours).
 */
export function collectVerifiedFacts(diffText: string): VerifiedFacts {
  return {
    filesInDiff: listDiffPaths(diffText),
    packageJsonFiles: readPackageJsonFiles(diffText),
    packageJsonBin: readPackageJsonBin(diffText),
    packageJsonMain: readPackageJsonMain(diffText),
    actionOutputs: readActionOutputs(diffText),
  };
}

/**
 * Render the verified facts as a prompt block. Empty blocks are
 * omitted (the prompt should not signal "facts collected" when none
 * were). The block is rendered as plain text the model can read line
 * by line.
 */
export function renderVerifiedFactsBlock(facts: VerifiedFacts): string {
  const lines: string[] = [];
  if (facts.packageJsonFiles !== null) {
    lines.push(
      `package.json#files (post-change): ${JSON.stringify(facts.packageJsonFiles.files)}`,
    );
  }
  if (facts.packageJsonBin !== null) {
    lines.push(
      `package.json#bin (post-change): ${JSON.stringify(facts.packageJsonBin.binEntries)}`,
    );
  }
  if (facts.packageJsonMain !== null) {
    lines.push(
      `package.json#main (post-change): ${JSON.stringify(facts.packageJsonMain.main)}`,
    );
  }
  if (facts.actionOutputs !== null) {
    lines.push(
      `action.yml#outputs (post-change): ${JSON.stringify(facts.actionOutputs.outputKeys)}`,
    );
  }
  if (lines.length === 0) {
    return "";
  }
  return [
    "Verified facts (reconstructed from the diff below; do NOT contradict these — they are authoritative for this PR):",
    ...lines,
    "If a finding would contradict any of the above, the finding is wrong; omit it or rephrase without the contradiction.",
  ].join("\n");
}

/**
 * Reconstruct a file's post-change content from the diff. Returns
 * null if the file does not appear in the diff. The reconstructed
 * content is the file content as it would appear in the post-PR
 * worktree — context lines preserved verbatim, added lines included,
 * removed lines excluded.
 *
 * Implementation note: we walk the diff linearly, tracking which file
 * we're in, and for the target file we collect (context lines, added
 * lines). We ignore hunk headers (`@@ -X,Y +A,B @@`) and file-path
 * headers (`+++ b/...`, `--- a/...`).
 */
export function reconstructFileFromDiff(diffText: string, filePath: string): string | null {
  const files = new Map<string, string[]>();
  let currentPath: string | null = null;
  let buffer: string[] | null = null;

  const flush = (): void => {
    if (currentPath !== null && buffer !== null) {
      files.set(currentPath, buffer);
    }
  };

  for (const line of diffText.split(/\r?\n/u)) {
    if (line.startsWith("diff --git ")) {
      flush();
      const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
      currentPath = match === null ? null : (match[2] ?? null);
      buffer = [];
      continue;
    }
    if (currentPath === null || buffer === null) {
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("@@")) {
      continue;
    }
    // Only process unified-diff hunk lines. A line that doesn't
    // start with one of the three markers ('+', '-', ' ') is not
    // a valid hunk line (e.g. a stray blank line, an annotation).
    // Skip it rather than injecting it as a context line, which
    // would shift line numbers and corrupt the JSON parser
    // downstream.
    if (line.startsWith("+")) {
      buffer.push(line.slice(1));
    } else if (line.startsWith("-")) {
      // removed line: skip
    } else if (line.startsWith(" ")) {
      buffer.push(line.slice(1));
    } else {
      // No diff marker; ignore (e.g. blank line, malformed input).
    }
  }
  flush();

  const reconstructed = files.get(filePath);
  return reconstructed === undefined ? null : reconstructed.join("\n");
}

function readPackageJsonFiles(diffText: string): PackageJsonFilesFact | null {
  const content = reconstructFileFromDiff(diffText, "package.json");
  if (content === null) {
    return null;
  }
  // Try full JSON parse first — works when the diff includes enough
  // of the file to form a valid document (e.g. when package.json is
  // small enough that one hunk covers the whole `files` block).
  const fullParse = tryParsePackageJson(content);
  if (fullParse !== null) {
    return extractFilesFromParsed(fullParse);
  }
  // Fall back to targeted extraction: find the `"files":` key and
  // read every JSON string inside the matching brackets. This
  // handles the common case where only the array's contents were
  // changed (the array opener is in the unchanged context).
  return extractFilesByScanning(content);
}

function readPackageJsonBin(diffText: string): PackageJsonBinFact | null {
  const content = reconstructFileFromDiff(diffText, "package.json");
  if (content === null) {
    return null;
  }
  const fullParse = tryParsePackageJson(content);
  if (fullParse !== null) {
    return extractBinFromParsed(fullParse);
  }
  return extractBinByScanning(content);
}

function readPackageJsonMain(diffText: string): PackageJsonMainFact | null {
  const content = reconstructFileFromDiff(diffText, "package.json");
  if (content === null) {
    return null;
  }
  const fullParse = tryParsePackageJson(content);
  if (fullParse !== null) {
    return extractMainFromParsed(fullParse);
  }
  return extractMainByScanning(content);
}

function tryParsePackageJson(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractFilesFromParsed(pkg: Record<string, unknown>): PackageJsonFilesFact | null {
  const files = pkg["files"];
  if (files === undefined) {
    return null;
  }
  if (!Array.isArray(files)) {
    return null;
  }
  const out: string[] = [];
  for (const entry of files) {
    if (typeof entry !== "string") {
      return null;
    }
    out.push(entry);
  }
  return { kind: "package-json-files", files: out };
}

function extractBinFromParsed(pkg: Record<string, unknown>): PackageJsonBinFact | null {
  const bin = pkg["bin"];
  if (bin === undefined) {
    return { kind: "package-json-bin", binEntries: [] };
  }
  if (typeof bin === "string") {
    return { kind: "package-json-bin", binEntries: [`(binary) -> ${bin}`] };
  }
  if (typeof bin !== "object" || bin === null || Array.isArray(bin)) {
    return null;
  }
  const out: string[] = [];
  for (const [name, value] of Object.entries(bin)) {
    if (typeof value !== "string") {
      return null;
    }
    out.push(`${name} -> ${value}`);
  }
  return { kind: "package-json-bin", binEntries: out };
}

function extractMainFromParsed(pkg: Record<string, unknown>): PackageJsonMainFact | null {
  const main = pkg["main"];
  if (main === undefined) {
    return null;
  }
  if (typeof main !== "string") {
    return null;
  }
  return { kind: "package-json-main", main };
}

// ---------------------------------------------------------------------------
// Targeted scanners — used when the diff only contains part of the file
// and JSON.parse fails. Each scanner locates a JSON key and reads its
// array / object / string value with a hand-rolled walker.
// ---------------------------------------------------------------------------

/**
 * Find `"files": [ ... ]` and read every string element. Returns null
 * if the key isn't present or the array isn't a clean JSON string
 * array. Tolerates multiline arrays.
 */
function extractFilesByScanning(content: string): PackageJsonFilesFact | null {
  const start = findKeyIndex(content, '"files"');
  if (start === -1) {
    return null;
  }
  let i = content.indexOf(":", start) + 1;
  while (i < content.length && /\s/u.test(content[i] ?? "")) {
    i++;
  }
  if (content[i] !== "[") {
    return null;
  }
  i++;
  const out: string[] = [];
  while (i < content.length) {
    const ch = content[i];
    if (ch === undefined) {
      return null;
    }
    if (ch === "]") {
      return { kind: "package-json-files", files: out };
    }
    if (ch === '"') {
      const end = readStringLiteral(content, i);
      if (end === -1) {
        return null;
      }
      out.push(decodeStringLiteral(content.slice(i + 1, end)));
      i = end + 1;
      while (
        i < content.length &&
        (content[i] === " " || content[i] === "\t" || content[i] === "\n" || content[i] === "\r" || content[i] === ",")
      ) {
        i++;
      }
      continue;
    }
    i++;
  }
  return null;
}

/**
 * Find `"bin": { ... }` and read every `"name": "value"` entry.
 */
function extractBinByScanning(content: string): PackageJsonBinFact | null {
  const start = findKeyIndex(content, '"bin"');
  if (start === -1) {
    // `bin` was not mentioned in the diff at all — we don't know
    // whether it was removed or simply not touched. Conservatively
    // omit rather than misreport.
    return null;
  }
  let i = content.indexOf(":", start) + 1;
  while (i < content.length && /\s/u.test(content[i] ?? "")) {
    i++;
  }
  if (content[i] === '"') {
    // Single string form: `"bin": "bin/foo.mjs"`.
    const end = readStringLiteral(content, i);
    if (end === -1) {
      return null;
    }
    const value = decodeStringLiteral(content.slice(i + 1, end));
    return { kind: "package-json-bin", binEntries: [`(binary) -> ${value}`] };
  }
  if (content[i] !== "{") {
    return null;
  }
  i++;
  const out: string[] = [];
  while (i < content.length) {
    const ch = content[i];
    if (ch === undefined) {
      return null;
    }
    if (ch === "}") {
      return { kind: "package-json-bin", binEntries: out };
    }
    if (ch === '"') {
      const keyEnd = readStringLiteral(content, i);
      if (keyEnd === -1) {
        return null;
      }
      const name = decodeStringLiteral(content.slice(i + 1, keyEnd));
      let j = keyEnd + 1;
      while (j < content.length && (content[j] === " " || content[j] === "\t" || content[j] === "\n" || content[j] === "\r")) {
        j++;
      }
      if (content[j] !== ":") {
        return null;
      }
      j++;
      while (j < content.length && (content[j] === " " || content[j] === "\t" || content[j] === "\n" || content[j] === "\r")) {
        j++;
      }
      if (content[j] !== '"') {
        return null;
      }
      const valEnd = readStringLiteral(content, j);
      if (valEnd === -1) {
        return null;
      }
      const value = decodeStringLiteral(content.slice(j + 1, valEnd));
      out.push(`${name} -> ${value}`);
      i = valEnd + 1;
      while (
        i < content.length &&
        (content[i] === " " || content[i] === "\t" || content[i] === "\n" || content[i] === "\r" || content[i] === ",")
      ) {
        i++;
      }
      continue;
    }
    i++;
  }
  return null;
}

/**
 * Find `"main": "value"` and return the string.
 */
function extractMainByScanning(content: string): PackageJsonMainFact | null {
  const start = findKeyIndex(content, '"main"');
  if (start === -1) {
    return null;
  }
  let i = content.indexOf(":", start) + 1;
  while (i < content.length && /\s/u.test(content[i] ?? "")) {
    i++;
  }
  if (content[i] !== '"') {
    return null;
  }
  const end = readStringLiteral(content, i);
  if (end === -1) {
    return null;
  }
  return { kind: "package-json-main", main: decodeStringLiteral(content.slice(i + 1, end)) };
}

/**
 * Locate the start index of a JSON key. Returns -1 if not present.
 * Skips past any key-like substring that is followed by something
 * other than `:` (after optional tabs/spaces).
 */
function findKeyIndex(content: string, quotedKey: string): number {
  let i = 0;
  while (i < content.length) {
    const idx = content.indexOf(quotedKey, i);
    if (idx === -1) {
      return -1;
    }
    let j = idx + quotedKey.length;
    while (j < content.length && (content[j] === " " || content[j] === "\t")) {
      j++;
    }
    if (content[j] === ":") {
      return idx;
    }
    i = idx + 1;
  }
  return -1;
}

/**
 * Return the closing-`"` index for a string literal that starts at
 * `openIndex` (which must point at the opening `"`). Returns -1 on
 * unterminated literal. Handles `\"` escapes.
 */
function readStringLiteral(content: string, openIndex: number): number {
  for (let i = openIndex + 1; i < content.length; i++) {
    const ch = content[i];
    if (ch === undefined) {
      return -1;
    }
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === '"') {
      return i;
    }
  }
  return -1;
}

/**
 * Decode a JSON string-literal body (without surrounding quotes) into
 * a JS string. Handles the common escapes \\, \", \n, \r, \t.
 */
function decodeStringLiteral(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\") {
      const next = body[i + 1];
      if (next === undefined) {
        out += "\\";
        continue;
      }
      switch (next) {
        case '"':
          out += '"';
          i++;
          break;
        case "\\":
          out += "\\";
          i++;
          break;
        case "n":
          out += "\n";
          i++;
          break;
        case "r":
          out += "\r";
          i++;
          break;
        case "t":
          out += "\t";
          i++;
          break;
        default:
          out += next;
          i++;
          break;
      }
      continue;
    }
    out += ch ?? "";
  }
  return out;
}

function readActionOutputs(diffText: string): ActionOutputsFact | null {
  const content = reconstructFileFromDiff(diffText, "action.yml");
  if (content === null) {
    return null;
  }
  return parseActionOutputsYaml(content, diffText);
}

/**
 * Minimal YAML reader for the action.yml `outputs:` block. We do not
 * need a full YAML parser — outputs is always a flat map of
 * key: description pairs at 2-space indentation under the
 * `outputs:` line. We collect keys only.
 *
 * Returns null when the reconstructed action.yml does NOT contain an
 * `outputs:` line AND the diff did not explicitly remove one. This
 * is important: returning an empty `outputKeys` array for an
 * action.yml that never had outputs would cause the post-filter to
 * interpret the empty list as "outputs were removed" and
 * potentially flag findings that legitimately mention outputs in
 * natural language.
 *
 * When the diff DOES contain `-outputs:` (or an entire outputs
 * block removal), we return `{ outputKeys: [] }` because the diff
 * itself is the signal that outputs was removed; the absence of
 * `outputs:` in the reconstructed file is the post-change state.
 */
function parseActionOutputsYaml(
  text: string,
  diffText: string,
): ActionOutputsFact | null {
  const lines = text.split(/\r?\n/u);
  const outputKeys: string[] = [];
  let inOutputsBlock = false;
  let sawOutputsMarker = false;
  for (const line of lines) {
    if (/^outputs\s*:\s*$/u.test(line)) {
      inOutputsBlock = true;
      sawOutputsMarker = true;
      continue;
    }
    if (!inOutputsBlock) {
      continue;
    }
    if (line.length > 0 && line[0] !== " " && line[0] !== "\t") {
      inOutputsBlock = false;
      continue;
    }
    const keyMatch = /^  (\w[\w-]*)\s*:/u.exec(line);
    if (keyMatch !== null) {
      outputKeys.push(keyMatch[1] ?? "");
    }
  }
  if (sawOutputsMarker) {
    return { kind: "action-outputs", outputKeys };
  }
  // Reconstructed action.yml has no `outputs:` line. Distinguish:
  // (a) the diff explicitly removed the outputs block — in which
  //     case the post-change state is "no outputs" and we should
  //     report it as such.
  // (b) action.yml never had outputs, or our reconstruction is
  //     incomplete — in which case we should not report it.
  if (/^-\s*outputs\s*:\s*$/um.test(diffText)) {
    return { kind: "action-outputs", outputKeys: [] };
  }
  // Also detect removal of the entire outputs block (the `outputs:`
  // line is in a `-outputs:` removal but the keys were also
  // removed as a sequence). Check for any `-  <key>:` pattern that
  // is a key in the outputs block. As a fallback, check whether
  // the diff has the `outputs:` word at all in a removed line.
  if (/^-\s*outputs\b/um.test(diffText)) {
    return { kind: "action-outputs", outputKeys: [] };
  }
  return null;
}