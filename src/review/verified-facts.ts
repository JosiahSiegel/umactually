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

/**
 * Shared scaffolding for the three package.json field extractors
 * (`readPackageJsonFiles`, `readPackageJsonBin`, `readPackageJsonMain`).
 *
 * The pattern is the same in all three: reconstruct the post-change
 * `package.json` content from the diff; if absent, return null;
 * otherwise try a full JSON parse first (covers the "the whole file
 * fits in one hunk" case), then fall back to a targeted scanner
 * (covers the "only the field's contents changed" case).
 *
 * Both branches return the same shape as `T`, so the caller picks
 * the per-field `fromParsed` + `fromScan` functions and lets this
 * helper route the right one. Dedupes ~30 lines of preamble across
 * the three call sites (DRY-refactor T2h).
 */
function readPackageJsonField<T>(
  diffText: string,
  fromParsed: (pkg: Record<string, unknown>) => T | null,
  fromScan: (content: string) => T | null,
): T | null {
  const content = reconstructFileFromDiff(diffText, "package.json");
  if (content === null) {
    return null;
  }
  // Try full JSON parse first — works when the diff includes enough
  // of the file to form a valid document (e.g. when package.json is
  // small enough that one hunk covers the whole `files` block).
  const fullParse = tryParsePackageJson(content);
  if (fullParse !== null) {
    return fromParsed(fullParse);
  }
  // Fall back to targeted extraction: find the per-field key and
  // read its value (or scan for the array/object contents). Handles
  // the common case where only the field's contents were changed
  // (the field opener is in the unchanged context).
  return fromScan(content);
}

function readPackageJsonFiles(diffText: string): PackageJsonFilesFact | null {
  return readPackageJsonField(diffText, extractFilesFromParsed, extractFilesByScanning);
}

function readPackageJsonBin(diffText: string): PackageJsonBinFact | null {
  return readPackageJsonField(diffText, extractBinFromParsed, extractBinByScanning);
}

function readPackageJsonMain(diffText: string): PackageJsonMainFact | null {
  return readPackageJsonField(diffText, extractMainFromParsed, extractMainByScanning);
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
//
// The generic `extractJsonFieldByScanning` below owns the locate-key,
// skip-whitespace, dispatch-on-first-byte logic. Per-field callers are
// thin wrappers that pass their `shape` and map the result into the
// field's fact shape.
//
// IMPORTANT: this helper does NOT require the surrounding file to be
// valid JSON. It only needs the post-change content reconstructed
// from the diff (see reconstructFileFromDiff above), and even that
// may be a partial / malformed slice of package.json. This is
// load-bearing: the full-parse path already handles the fully-valid
// case; this scanner exists precisely to recover the fact when the
// diff only carries the field's opening line and its added lines.
// ---------------------------------------------------------------------------

type JsonFieldShape = "string" | "string|string[]" | "Record<string,string>";

type ShapeReturn<S extends JsonFieldShape> = S extends "string"
  ? string
  : string[];

/**
 * Generic "find a JSON key in possibly-malformed JSON and read its
 * value". Used by the three package.json fallback scanners when
 * JSON.parse fails. Walks past the key, the colon, and whitespace,
 * then dispatches on the value's first non-whitespace byte:
 *
 *   `"string"`           expects a JSON string literal only
 *   `"string|string[]"`  accepts either a string literal OR a string array
 *   `"Record<string,string>"`
 *                        accepts either a string literal OR a
 *                        string-keyed map of string-string pairs
 *                        (e.g. `"bin": "foo.mjs"` or `"bin": { "x": "y" }`)
 *
 * The walker is hand-rolled on purpose — we cannot import a JSON
 * parser because the surrounding file is intentionally allowed to
 * be malformed (the scanner exists to recover a fact from partial
 * diff content, not to validate the file).
 */
function extractJsonFieldByScanning<S extends JsonFieldShape>(
  content: string,
  key: string,
  shape: S,
): ShapeReturn<S> | null {
  const start = findKeyIndex(content, `"${key}"`);
  if (start === -1) {
    return null;
  }
  let i = content.indexOf(":", start) + 1;
  while (i < content.length && isHorizontalWhitespace(content[i] ?? "")) {
    i++;
  }
  const ch = content[i];
  if (ch === undefined) {
    return null;
  }
  if (ch === '"') {
    const end = readStringLiteral(content, i);
    if (end === -1) {
      return null;
    }
    const value = decodeStringLiteral(content.slice(i + 1, end));
    if (shape === "string") {
      return value as ShapeReturn<S>;
    }
    if (shape === "string|string[]") {
      return [value] as ShapeReturn<S>;
    }
    // Single-string form is the npm `"bin": "path/to/script"` shorthand.
    // Surface it as one entry tagged with "(binary) ->" so callers
    // can disambiguate from the map form (which uses "name -> value").
    return [`(binary) -> ${value}`] as ShapeReturn<S>;
  }
  if (ch === "[") {
    if (shape !== "string|string[]") {
      return null;
    }
    return scanStringArray(content, i + 1) as ShapeReturn<S> | null;
  }
  if (ch === "{") {
    if (shape !== "Record<string,string>") {
      return null;
    }
    return scanStringMap(content, i + 1) as ShapeReturn<S> | null;
  }
  return null;
}

function scanStringArray(content: string, openIndex: number): string[] | null {
  let i = openIndex;
  const out: string[] = [];
  while (i < content.length) {
    const ch = content[i];
    if (ch === undefined) {
      return null;
    }
    if (ch === "]") {
      return out;
    }
    if (ch === '"') {
      const end = readStringLiteral(content, i);
      if (end === -1) {
        return null;
      }
      out.push(decodeStringLiteral(content.slice(i + 1, end)));
      i = end + 1;
      while (i < content.length && isArrayElementSeparator(content[i] ?? "")) {
        i++;
      }
      continue;
    }
    i++;
  }
  return null;
}

function scanStringMap(content: string, openIndex: number): string[] | null {
  let i = openIndex;
  const out: string[] = [];
  while (i < content.length) {
    const ch = content[i];
    if (ch === undefined) {
      return null;
    }
    if (ch === "}") {
      return out;
    }
    if (ch === '"') {
      const keyEnd = readStringLiteral(content, i);
      if (keyEnd === -1) {
        return null;
      }
      const name = decodeStringLiteral(content.slice(i + 1, keyEnd));
      let j = keyEnd + 1;
      while (j < content.length && isHorizontalWhitespace(content[j] ?? "")) {
        j++;
      }
      if (content[j] !== ":") {
        return null;
      }
      j++;
      while (j < content.length && isHorizontalWhitespace(content[j] ?? "")) {
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
      while (i < content.length && isArrayElementSeparator(content[i] ?? "")) {
        i++;
      }
      continue;
    }
    i++;
  }
  return null;
}

function isHorizontalWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isArrayElementSeparator(ch: string): boolean {
  return (
    ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ","
  );
}

/**
 * Find `"files": [ ... ]` and read every string element.
 */
function extractFilesByScanning(content: string): PackageJsonFilesFact | null {
  const files = extractJsonFieldByScanning(content, "files", "string|string[]");
  if (files === null) {
    return null;
  }
  return { kind: "package-json-files", files };
}

/**
 * Find `"bin": "value"` or `"bin": { ... }` and surface entries.
 *
 * When `bin` is absent from the diff entirely we don't know whether
 * it was removed or simply not touched — conservatively omit rather
 * than misreport. (The generic also returns null in this case, but
 * call it out at the field site so the rationale stays visible.)
 */
function extractBinByScanning(content: string): PackageJsonBinFact | null {
  if (findKeyIndex(content, '"bin"') === -1) {
    return null;
  }
  const binEntries = extractJsonFieldByScanning(content, "bin", "Record<string,string>");
  if (binEntries === null) {
    return null;
  }
  return { kind: "package-json-bin", binEntries };
}

/**
 * Find `"main": "value"` and return the string.
 */
function extractMainByScanning(content: string): PackageJsonMainFact | null {
  const main = extractJsonFieldByScanning(content, "main", "string");
  if (main === null) {
    return null;
  }
  return { kind: "package-json-main", main };
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