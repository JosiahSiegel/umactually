// SPDX-License-Identifier: MIT
//
// Task 5 — Bounded repository context as auditable structured provenance.
//
// Replaces the previously-flattened instruction/context strings with a
// typed `ContextItem` interface that carries source kind, base/head ref,
// repository-relative path, path scope, trust level, byte count, SHA-256
// content hash, and the rendered text. Selection is budget-bounded,
// selection-order is deterministic, and every excluded candidate carries
// an explicit reason. The content-free redacted context manifest is the
// auditable surface the artifact layer persists.
//
// Supported languages: TypeScript / JavaScript (.ts/.tsx/.mts/.cts/.js/
// .jsx/.mjs/.cjs) — using the already-installed TypeScript compiler API.
// Unsupported languages and TS parse/resolution failures deterministically
// fall back to changed diff hunks + applicable instruction files and
// record `semanticContextStatus: unsupported|parse-failed|budget-exhausted`.
// Reviews NEVER fail because of context collection.

import { createHash } from "node:crypto";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { isAbsolute, sep as pathSep } from "node:path";
// Lazy-load the typescript compiler: it references CJS-only `__filename`
// at module-init, which crashes inside the Node SEA ESM blob. Types are
// erased; the value import lives inside `parseTsFile`.
import type {
  Node as TsNode,
  SyntaxKind as TsSyntaxKind,
} from "typescript";

import { listDiffPaths, isExcludedPath } from "../diff/filter-build-artifacts.js";
import { SECRET_REGEX } from "../config/saved-config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextItemTrust = "base" | "head" | "trusted" | "untrusted";

/** Closed set of source kinds the prompt-renderer + manifest accept. */
export type ContextItemKind =
  | "changed_declaration"
  | "related_type"
  | "direct_caller_or_callee"
  | "test_reference"
  | "instruction"
  | "diff_hunk";

/**
 * A single, typed context item carrying the 9 documented fields:
 * source kind, base ref, head ref, repository-relative path, path scope,
 * trust level, byte count (UTF-8 of text), SHA-256 content hash, and text.
 */
export type ContextItem = {
  readonly sourceKind: ContextItemKind;
  readonly baseRef: string;
  readonly headRef: string;
  readonly path: string;
  readonly pathScope: string;
  readonly trust: ContextItemTrust;
  readonly bytes: number;
  readonly contentHash: string;
  readonly text: string;
};

export type ContextExclusion = {
  readonly path: string;
  readonly reason: string;
};

export type SemanticContextStatus =
  | "ready"
  | "unsupported"
  | "parse-failed"
  | "budget-exhausted";

export type ContextBudgets = {
  readonly totalBytes: number;
  readonly perFileBytes: number;
  readonly maxItems: number;
  readonly maxFilesParsed: number;
  readonly wallTimeMs: number;
};

export const BUDGET_DEFAULTS: ContextBudgets = Object.freeze({
  totalBytes: 64 * 1024,
  perFileBytes: 16 * 1024,
  maxItems: 20,
  maxFilesParsed: 200,
  wallTimeMs: 750,
});

export const BUDGET_HARD_CAPS: ContextBudgets = Object.freeze({
  totalBytes: 256 * 1024,
  perFileBytes: 32 * 1024,
  maxItems: 80,
  maxFilesParsed: 1000,
  wallTimeMs: 3000,
});

export type ContextProvenanceResult = {
  readonly items: readonly ContextItem[];
  readonly excluded: readonly ContextExclusion[];
  readonly budgets: ContextBudgets;
  readonly semanticContextStatus: SemanticContextStatus;
  readonly budgetHash: string;
  readonly bytesUsed: number;
};

export type ContextProvenanceInput = {
  readonly cwd: string;
  readonly diffText: string;
  readonly baseRef: string;
  readonly headRef: string;
  readonly applicableInstructions: readonly string[];
  /** Optional path-scoped instruction rules. `scope` is a minimatch-ish glob. */
  readonly pathScopedInstructionRules?: readonly {
    readonly path: string;
    readonly scope: string;
  }[];
  /** Optional explicit changed paths (else derived from diff). */
  readonly changedPaths?: readonly string[];
  /** Optional instruction-file overrides for head branch (NEVER trusted in PR mode). */
  readonly headBranchInstructionTexts?: ReadonlyMap<string, string>;
  /** Override budgets. */
  readonly budgets?: Partial<ContextBudgets>;
};

// ---------------------------------------------------------------------------
// Render result types
// ---------------------------------------------------------------------------

export type RenderedContextBlock =
  | {
      readonly kind: "rendered";
      readonly text: string;
      readonly included: number;
    }
  | {
      readonly kind: "manifest";
      readonly text: string;
      readonly included: number;
      readonly excluded: number;
      readonly status: SemanticContextStatus;
    };

// ---------------------------------------------------------------------------
// Budget enforcement
// ---------------------------------------------------------------------------

function clampBudgets(input: Partial<ContextBudgets> | undefined): ContextBudgets {
  const merged: ContextBudgets = {
    totalBytes: input?.totalBytes ?? BUDGET_DEFAULTS.totalBytes,
    perFileBytes: input?.perFileBytes ?? BUDGET_DEFAULTS.perFileBytes,
    maxItems: input?.maxItems ?? BUDGET_DEFAULTS.maxItems,
    maxFilesParsed: input?.maxFilesParsed ?? BUDGET_DEFAULTS.maxFilesParsed,
    wallTimeMs: input?.wallTimeMs ?? BUDGET_DEFAULTS.wallTimeMs,
  };
  if (merged.totalBytes > BUDGET_HARD_CAPS.totalBytes) {
    throw new Error(
      `context budget totalBytes=${merged.totalBytes} exceeds hard cap ${BUDGET_HARD_CAPS.totalBytes}`,
    );
  }
  if (merged.perFileBytes > BUDGET_HARD_CAPS.perFileBytes) {
    throw new Error(
      `context budget perFileBytes=${merged.perFileBytes} exceeds hard cap ${BUDGET_HARD_CAPS.perFileBytes}`,
    );
  }
  if (merged.maxItems > BUDGET_HARD_CAPS.maxItems) {
    throw new Error(
      `context budget maxItems=${merged.maxItems} exceeds hard cap ${BUDGET_HARD_CAPS.maxItems}`,
    );
  }
  if (merged.maxFilesParsed > BUDGET_HARD_CAPS.maxFilesParsed) {
    throw new Error(
      `context budget maxFilesParsed=${merged.maxFilesParsed} exceeds hard cap ${BUDGET_HARD_CAPS.maxFilesParsed}`,
    );
  }
  if (merged.wallTimeMs > BUDGET_HARD_CAPS.wallTimeMs) {
    throw new Error(
      `context budget wallTimeMs=${merged.wallTimeMs} exceeds hard cap ${BUDGET_HARD_CAPS.wallTimeMs}`,
    );
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Path normalization / unsafe-path detection
// ---------------------------------------------------------------------------

function toPosix(p: string): string {
  return p.replace(/\\/gu, "/");
}

function isUnsafeRepoPath(p: string): boolean {
  if (p.startsWith("/")) return true;
  if (/^[a-zA-Z]:[\\/]/.test(p)) return true;
  const segments = p.split(/[\\/]/);
  return segments.some((s) => s === ".." || s === ".");
}

function normalizeRepoPath(p: string): string {
  const t = toPosix(p);
  if (t.startsWith("a/") || t.startsWith("b/")) {
    return t.slice(2);
  }
  return t;
}

function isWithinCwdReal(real: string, cwdReal: string): boolean {
  return real === cwdReal || real.startsWith(`${cwdReal}${pathSep}`);
}

// ---------------------------------------------------------------------------
// Glob → RegExp (small, predictable — mirrors prompt-files.ts scope)
// ---------------------------------------------------------------------------

const REGEX_ESCAPE_CHARS = new Set([
  ".", "+", "(", ")", "|", "^", "$", "{", "}", "[", "]", "\\",
]);

function appendStarSequence(body: string, pattern: string, i: number): { body: string; next: number } {
  if (pattern[i + 1] !== "*") {
    return { body: body + "[^/]*", next: i };
  }
  let next = i + 1;
  if (pattern[next + 1] === "/") next += 1;
  return { body: body + ".*", next };
}

function appendEscapedChar(body: string, ch: string): string {
  if (REGEX_ESCAPE_CHARS.has(ch)) return body + `\\${ch}`;
  return body + ch;
}

function appendLiteralChar(body: string, ch: string | undefined): string {
  if (ch === undefined) return body;
  return appendEscapedChar(body, ch);
}

function translateGlobBody(pattern: string): string {
  let body = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      const r = appendStarSequence(body, pattern, i);
      body = r.body;
      i = r.next;
    } else if (ch === "?") {
      body += "[^/]";
    } else {
      body = appendLiteralChar(body, ch);
    }
  }
  return body;
}

function globToRegex(pattern: string): RegExp {
  const body = translateGlobBody(pattern);
  if (pattern.endsWith("/")) {
    const dir = body.slice(0, -1);
    return new RegExp(`(?:^${dir}$|^${dir}/|(?:^|.*/)${dir}(?:/|$))`, "u");
  }
  const finalBody = body.startsWith(".*/") ? `(?:.*/)?${body.slice(3)}` : body;
  return new RegExp(`^${finalBody}$`, "u");
}

function matchesGlob(path: string, pattern: string): boolean {
  return globToRegex(pattern).test(toPosix(path));
}

// ---------------------------------------------------------------------------
// TS-language detection
// ---------------------------------------------------------------------------

const TS_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function isTsLike(path: string): boolean {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return false;
  return TS_EXTENSIONS.has(path.slice(lastDot).toLowerCase());
}

// ---------------------------------------------------------------------------
// File-read with realpath boundary + budget + secret + size checks
// ---------------------------------------------------------------------------

type ReadOutcome =
  | { readonly ok: true; readonly text: string; readonly bytes: number }
  | { readonly ok: false; readonly reason: string };

function readWithinCwd(
  cwdReal: string,
  rel: string,
  perFileBytes: number,
): ReadOutcome {
  if (isUnsafeRepoPath(rel)) {
    return { ok: false, reason: "outside-cwd" };
  }
  if (isAbsolute(rel)) {
    return { ok: false, reason: "absolute-path" };
  }
  const abs = `${cwdReal}${rel.startsWith("/") ? "" : "/"}${rel}`;
  let real: string;
  try {
    real = realpathSync(abs);
  } catch {
    return { ok: false, reason: "not-found" };
  }
  if (!isWithinCwdReal(real, cwdReal)) {
    return { ok: false, reason: "outside-cwd" };
  }
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(real);
  } catch {
    return { ok: false, reason: "not-found" };
  }
  if (!st.isFile()) {
    return { ok: false, reason: "not-a-file" };
  }
  if (isExcludedPath(rel)) {
    return { ok: false, reason: "generated-or-build-artifact" };
  }
  if (st.size > perFileBytes) {
    return { ok: false, reason: "byte-cap-exceeded" };
  }
  // The exact-byte truncation happens at the text-load site.
  // We use the file size as a fast guard; trimming is applied at use.
  let text: string;
  try {
    text = readFileSync(real, "utf8");
  } catch {
    return { ok: false, reason: "read-failed" };
  }
  // Soft-cap (size <= perFileBytes) means we already are under the hard cap.
  // If `text.length` > perFileBytes (e.g. multi-byte chars), exact-byte truncate.
  const textBytes = Buffer.byteLength(text, "utf8");
  if (textBytes > perFileBytes) {
    text = truncateUtf8ToBytes(text, perFileBytes);
  }
  if (SECRET_REGEX.test(text)) {
    SECRET_REGEX.lastIndex = 0;
    return { ok: false, reason: "secret-detected" };
  }
  SECRET_REGEX.lastIndex = 0;
  const truncatedBytes = Buffer.byteLength(text, "utf8");
  return { ok: true, text, bytes: truncatedBytes };
}

function truncateUtf8ToBytes(s: string, maxBytes: number): string {
  if (Buffer.byteLength(s, "utf8") <= maxBytes) return s;
  // Binary-search the longest prefix whose UTF-8 byte-length <= maxBytes.
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (Buffer.byteLength(s.slice(0, mid), "utf8") <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return `${s.slice(0, lo)}\n[… truncated at ${maxBytes}-byte cap …]`;
}

// ---------------------------------------------------------------------------
// SHA-256 helper
// ---------------------------------------------------------------------------

function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// TS parser facade (uses already-installed TypeScript compiler API)
// ---------------------------------------------------------------------------

type Declaration = {
  readonly name: string;
  readonly kind: "function" | "class" | "interface" | "type" | "const" | "export";
  readonly line: number;
};

type ParsedTsFile =
  | { readonly ok: true; readonly declarations: readonly Declaration[]; readonly imports: readonly { readonly module: string; readonly name: string }[] }
  | { readonly ok: false; readonly reason: string };

async function parseTsFile(
  filePath: string,
  text: string,
): Promise<ParsedTsFile> {
  // Dynamic import — the typescript compiler module references CJS-only
  // `__filename` at module-init. Loading it lazily keeps the SEA blob's
  // startup path (--version, --help, doctor, init) free of that crash.
  const ts = await import("typescript");
  let sf: ReturnType<typeof ts.createSourceFile>;
  try {
    sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, /* setParentNodes */ true, /* scriptKind */ undefined);
  } catch {
    return { ok: false, reason: "parse-failed" };
  }
  // TS compiler reports parse errors via parseDiagnostics even when it
  // produces a (partial) AST. Treat any error-category diagnostic as a
  // hard parse-failure so we degrade to the diff_hunk fallback.
  const parseDiagnostics = (sf as { parseDiagnostics?: readonly { category?: number }[] }).parseDiagnostics ?? [];
  const hasFatalDiagnostic = parseDiagnostics.some((d) => d.category === 1);
  if (hasFatalDiagnostic) {
    return { ok: false, reason: "parse-failed" };
  }
  const declarations: Declaration[] = [];
  const imports: { module: string; name: string }[] = [];
  function walk(node: TsNode): void {
    node.forEachChild(walk);
    if (ts.isImportDeclaration(node)) {
      const moduleText = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : "";
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const stmt of bindings.elements) {
          if (stmt && stmt.name && stmt.name.escapedText) {
            imports.push({ module: moduleText, name: String(stmt.name.escapedText) });
          }
        }
      }
      if (clause && clause.name) {
        imports.push({ module: moduleText, name: String(clause.name.escapedText) });
      }
      if (!clause) {
        imports.push({ module: moduleText, name: "" });
      }
    }
    if (ts.isExportDeclaration(node)) {
      // expose named exports so the model can resolve re-exports
      // (we don't pull the actual declaration; we just record the name).
    }
    const nameIdent = (node as { name?: { escapedText?: string | number } }).name;
    if (node.kind === ts.SyntaxKind.FunctionDeclaration && nameIdent && typeof nameIdent.escapedText === "string") {
      declarations.push({ name: nameIdent.escapedText, kind: "function", line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    } else if (node.kind === ts.SyntaxKind.ClassDeclaration && nameIdent && typeof nameIdent.escapedText === "string") {
      declarations.push({ name: nameIdent.escapedText, kind: "class", line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    } else if (node.kind === ts.SyntaxKind.InterfaceDeclaration && nameIdent && typeof nameIdent.escapedText === "string") {
      declarations.push({ name: nameIdent.escapedText, kind: "interface", line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    } else if (node.kind === ts.SyntaxKind.TypeAliasDeclaration && nameIdent && typeof nameIdent.escapedText === "string") {
      declarations.push({ name: nameIdent.escapedText, kind: "type", line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    } else if (node.kind === ts.SyntaxKind.VariableStatement) {
      const declList = (node as { declarationList?: { declarations?: readonly { name?: { kind: TsSyntaxKind; escapedText?: string | number }; getStart(sf: unknown): number }[] } }).declarationList;
      if (declList) {
        for (const decl of declList.declarations ?? []) {
          const nm = decl.name;
          if (nm && nm.kind === ts.SyntaxKind.Identifier && typeof nm.escapedText === "string") {
            declarations.push({ name: nm.escapedText, kind: "const", line: sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line + 1 });
          }
        }
      }
    }
  }
  walk(sf);
  return { ok: true, declarations, imports };
}

// ---------------------------------------------------------------------------
// Hunk extraction (pure-string fallback)
// ---------------------------------------------------------------------------

type Hunk = { path: string; text: string };

function parseDiffBlocks(diffText: string): string[] {
  return diffText.split(/^diff --git /um).slice(1).map((block) => `diff --git ${block}`);
}

function extractTargetPath(block: string): string | null {
  for (const line of block.split(/\r?\n/u)) {
    if (!line.startsWith("+++ ")) continue;
    const raw = line.slice(4).split("\t")[0]?.trim() ?? "";
    if (raw === "" || raw === "/dev/null") return null;
    return normalizeRepoPath(raw.startsWith("b/") ? raw.slice(2) : raw);
  }
  return null;
}

function extractHunkText(block: string, target: string): Hunk | null {
  const hunks: string[] = [];
  let startedAt: number | null = null;
  let added: number | null = null;
  for (const line of block.split(/\r?\n/u)) {
    const hunkHeader = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/u.exec(line);
    if (hunkHeader !== null) {
      if (startedAt !== null) hunks.push(`@@ line ${startedAt}+`);
      startedAt = Number(hunkHeader[1]);
      added = 0;
    }
    if (line.startsWith("+") && !line.startsWith("+++") && startedAt !== null && added !== null) {
      hunks.push(line);
      added += 1;
      if (added >= 30) hunks.push("[… hunk truncated …]");
    }
  }
  if (startedAt !== null) hunks.push(`@@ line ${startedAt}+`);
  return hunks.length > 0 ? { path: target, text: hunks.join("\n") } : null;
}

function extractHunks(diffText: string): Hunk[] {
  const result: Hunk[] = [];
  for (const block of parseDiffBlocks(diffText)) {
    const target = extractTargetPath(block);
    if (target === null) continue;
    const hunk = extractHunkText(block, target);
    if (hunk !== null) result.push(hunk);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers — diff path extraction
// ---------------------------------------------------------------------------

function diffPaths(diffText: string): readonly string[] {
  return listDiffPaths(diffText).map((p) => normalizeRepoPath(p));
}

// ---------------------------------------------------------------------------
// Main collector
// ---------------------------------------------------------------------------

type Candidate = {
  readonly kind: ContextItemKind;
  readonly path: string;
  readonly pathScope: string;
  readonly text: string;
  readonly trust: ContextItemTrust;
};

// ---------------------------------------------------------------------------
// Refactored orchestrator + per-phase helpers. The orchestrator itself
// is a linear sequence of helper calls so its CC stays around 5.
// ---------------------------------------------------------------------------

type CollectInit = {
  readonly start: number;
  readonly budgets: ContextBudgets;
  readonly cwdReal: string;
  readonly baseRef: string;
  readonly headRef: string;
  readonly changedPaths: readonly string[];
  readonly tsLikeChanged: readonly string[];
  readonly instructionsByPath: Map<string, string>;
  readonly pathScopes: Map<string, string>;
};

type CollectState = {
  readonly selected: ContextItem[];
  readonly excluded: ContextExclusion[];
  readonly counters: { filesParsed: number; budgetBytes: number };
  status: SemanticContextStatus;
  budgetByteTotal: number;
};

export async function collectContextProvenance(
  input: ContextProvenanceInput,
): Promise<ContextProvenanceResult> {
  const init = await clampAndInitBudgets(input);
  const state: CollectState = {
    selected: [],
    excluded: [],
    counters: { filesParsed: 0, budgetBytes: 0 },
    status: "ready",
    budgetByteTotal: 0,
  };

  await collectFromChangedDeclarations(input, init, state);
  await collectFromCallers(input, init, state);
  await collectFromTestReferences(init, state);
  collectExcludedItems(input, init, state);

  return finalizeContextResult(
    init,
    state.selected,
    state.excluded,
    state.budgetByteTotal,
    state.status,
  );
}

async function clampAndInitBudgets(input: ContextProvenanceInput): Promise<CollectInit> {
  const start = performance.now();
  const budgets = clampBudgets(input.budgets);
  const cwdReal = resolveCwdReal(input.cwd);
  const diffPathsList = diffPaths(input.diffText);
  const changedPaths = input.changedPaths !== undefined
    ? input.changedPaths.map(normalizeRepoPath).filter((p) => diffPathsList.includes(p) || true)
    : diffPathsList;

  const instructionsByPath = new Map<string, string>();
  for (const p of input.applicableInstructions) {
    const norm = normalizeRepoPath(p);
    if (instructionsByPath.has(norm)) continue;
    instructionsByPath.set(norm, await readInstructionText(cwdReal, norm));
  }

  const pathScopes = new Map<string, string>();
  for (const rule of input.pathScopedInstructionRules ?? []) {
    pathScopes.set(normalizeRepoPath(rule.path), rule.scope);
  }

  return {
    start,
    budgets,
    cwdReal,
    baseRef: input.baseRef,
    headRef: input.headRef,
    changedPaths,
    tsLikeChanged: changedPaths.filter(isTsLike),
    instructionsByPath,
    pathScopes,
  };
}

function resolveCwdReal(cwd: string): string {
  try {
    return realpathSync(cwd);
  } catch {
    return cwd;
  }
}

function maybeAddCandidate(init: CollectInit, state: CollectState, candidate: Candidate): boolean {
  if (state.selected.length >= init.budgets.maxItems) return false;
  if (performance.now() - init.start > init.budgets.wallTimeMs) {
    state.status = "budget-exhausted";
    return false;
  }
  const bytes = Buffer.byteLength(candidate.text, "utf8");
  if (state.budgetByteTotal + bytes > init.budgets.totalBytes) {
    state.status = "budget-exhausted";
    return false;
  }
  state.selected.push({
    sourceKind: candidate.kind,
    baseRef: init.baseRef,
    headRef: init.headRef,
    path: candidate.path,
    pathScope: candidate.pathScope,
    trust: candidate.trust,
    bytes,
    contentHash: sha256Hex(candidate.text),
    text: candidate.text,
  });
  state.budgetByteTotal += bytes;
  return true;
}

function recordExclusion(state: CollectState, path: string, reason: string): void {
  state.excluded.push({ path, reason });
  // Mirror the user-facing exclusion list with a fast-lookup set so
  // we can scrub items whose underlying file is unsafe (escapes
  // cwd, oversized, secret-bearing, parse-failed). Step 2's
  // readWithinCwd call always records a reason; if the file later
  // appeared as a `diff_hunk` from Step 1, the hunk has to be
  // scrubbed from `selected` AND its bytes refunded from the budget
  // total. This is what keeps malicious/oversized content out of
  // the provider prompt even though the diff text was already
  // accepted in Step 1.
  const i = state.selected.findIndex((it) => it.path === path);
  if (i !== -1) {
    state.budgetByteTotal = Math.max(0, state.budgetByteTotal - state.selected[i]!.bytes);
    state.selected.splice(i, 1);
  }
}

function isBudgetOrWallTimeExhausted(init: CollectInit, state: CollectState): boolean {
  if (state.counters.filesParsed >= init.budgets.maxFilesParsed) {
    state.status = "budget-exhausted";
    return true;
  }
  if (performance.now() - init.start > init.budgets.wallTimeMs) {
    state.status = "budget-exhausted";
    return true;
  }
  return false;
}

async function collectFromChangedDeclarations(
  input: ContextProvenanceInput,
  init: CollectInit,
  state: CollectState,
): Promise<void> {
  // Step 1 — diff hunks for every changed path (always present as fallback).
  const hunks = extractHunks(input.diffText);

  if (init.tsLikeChanged.length === 0 && init.changedPaths.length > 0) {
    state.status = "unsupported";
  }

  for (const hunk of hunks) {
    if (state.selected.length >= init.budgets.maxItems) break;
    if (isExcludedPath(hunk.path)) {
      recordExclusion(state, hunk.path, "generated-or-build-artifact");
      continue;
    }
    const added = maybeAddCandidate(init, state, {
      kind: "diff_hunk",
      path: hunk.path,
      pathScope: "<diff>",
      text: hunk.text,
      trust: "base",
    });
    if (!added) break;
  }

  // Step 2 — TS declarations for changed TS files.
  for (const path of init.tsLikeChanged) {
    if (isBudgetOrWallTimeExhausted(init, state)) break;
    const r = readWithinCwd(init.cwdReal, path, init.budgets.perFileBytes);
    if (!r.ok) {
      recordExclusion(state, path, r.reason);
      continue;
    }
    state.counters.filesParsed += 1;
    const parsed = await parseTsFile(path, r.text);
    if (!parsed.ok) {
      state.status = "parse-failed";
      // Fallback is the diff_hunk item already added; no further action.
      continue;
    }
    // Emit one `changed_declaration` per declared function/class/etc.
    for (const decl of parsed.declarations) {
      if (!maybeAddCandidate(init, state, {
        kind: "changed_declaration",
        path,
        pathScope: path,
        text: `${decl.kind} ${decl.name} (line ${decl.line})`,
        trust: "base",
      })) break;
    }
  }
}

async function collectFromCallers(
  input: ContextProvenanceInput,
  init: CollectInit,
  state: CollectState,
): Promise<void> {
  // Same-project imports + reverse-import scan over standard test/source
  // directories. Both write caller/callee items.
  await collectResolvedImportTargets(input, init, state);
  await collectReverseImporters(input, init, state);
}

async function collectResolvedImportTargets(
  input: ContextProvenanceInput,
  init: CollectInit,
  state: CollectState,
): Promise<void> {
  for (const path of init.tsLikeChanged) {
    if (markBudgetOrWallTimeExhausted(init, state)) break;
    const parsed = await readAndParseBudgetedFile(init, state, path);
    if (parsed === null || !parsed.ok) continue;
    for (const imp of parsed.imports) {
      if (state.counters.filesParsed >= init.budgets.maxFilesParsed) break;
      await emitCalleeForImport(input, init, state, path, imp);
    }
  }
}

function markBudgetOrWallTimeExhausted(init: CollectInit, state: CollectState): boolean {
  if (state.counters.filesParsed >= init.budgets.maxFilesParsed) return true;
  if (performance.now() - init.start <= init.budgets.wallTimeMs) return false;
  state.status = "budget-exhausted";
  return true;
}

async function readAndParseBudgetedFile(
  init: CollectInit,
  state: CollectState,
  path: string,
): Promise<ParsedTsFile | null> {
  const r = readWithinCwd(init.cwdReal, path, init.budgets.perFileBytes);
  if (!r.ok) return null;
  state.counters.filesParsed += 1;
  return await parseTsFile(path, r.text);
}

async function emitCalleeForImport(
  input: ContextProvenanceInput,
  init: CollectInit,
  state: CollectState,
  path: string,
  imp: { readonly module: string; readonly name: string },
): Promise<void> {
  const target = resolveSameProjectImport(input.cwd, path, imp.module);
  if (target === null) return;
  if (isExcludedPath(target)) {
    recordExclusion(state, target, "generated-or-build-artifact");
    return;
  }
  const targetRead = readWithinCwd(init.cwdReal, target, init.budgets.perFileBytes);
  if (!targetRead.ok) {
    recordExclusion(state, target, targetRead.reason);
    return;
  }
  state.counters.filesParsed += 1;
  const listed = imp.name.length > 0 ? imp.name : "*";
  const header = `// callee: imports { ${listed} } from "${target}"`;
  maybeAddCandidate(init, state, {
    kind: "direct_caller_or_callee",
    path: target,
    pathScope: path,
    text: `${header}\n${targetRead.text}`,
    trust: "base",
  });
}

async function collectReverseImporters(
  input: ContextProvenanceInput,
  init: CollectInit,
  state: CollectState,
): Promise<void> {
  const changedBaseNames = new Set(
    init.tsLikeChanged.map((p) => basenameOf(p).replace(/\.[jt]sx?$/u, "")),
  );
  const callerSeeds = [
    "src",
    "lib",
    "tests",
    "test",
    "__tests__",
  ];
  const seenCallerFiles = new Set<string>();
  for (const seed of callerSeeds) {
    if (state.counters.filesParsed >= init.budgets.maxFilesParsed) break;
    if (performance.now() - init.start > init.budgets.wallTimeMs) break;
    const entries = readdirSafe(init.cwdReal, seed);
    if (entries === null) continue;
    for (const rel of entries) {
      if (state.counters.filesParsed >= init.budgets.maxFilesParsed) break;
      if (!isTsLike(rel)) continue;
      if (init.tsLikeChanged.includes(rel)) continue;
      if (seenCallerFiles.has(rel)) continue;
      seenCallerFiles.add(rel);
      const readAttempt = readWithinCwd(init.cwdReal, rel, init.budgets.perFileBytes);
      if (!readAttempt.ok) {
        recordExclusion(state, rel, readAttempt.reason);
        continue;
      }
      state.counters.filesParsed += 1;
      const parsedCaller = await parseTsFile(rel, readAttempt.text);
      if (!parsedCaller.ok) continue;
      const hits = parsedCaller.imports.filter((imp) => {
        if (imp.module.length === 0) return false;
        if (!imp.module.startsWith(".")) return false;
        const target = resolveSameProjectImport(input.cwd, rel, imp.module);
        if (target === null) return false;
        const bn = basenameOf(target).replace(/\.[jt]sx?$/u, "");
        return changedBaseNames.has(bn);
      });
      if (hits.length === 0) continue;
      const symbols = [...new Set(hits.map((h) => h.name).filter((n) => n.length > 0))];
      const header = `// caller: imports { ${symbols.join(", ") || "*"} } from "${rel}"`;
      maybeAddCandidate(init, state, {
        kind: "direct_caller_or_callee",
        path: rel,
        pathScope: rel,
        text: `${header}\n${readAttempt.text}`,
        trust: "base",
      });
    }
  }
}

function readdirSafe(cwdReal: string, seed: string): readonly string[] | null {
  const seedAbs = `${cwdReal}${seed.startsWith("/") ? "" : "/"}${seed}`;
  try {
    return readdirSync(seedAbs, { recursive: true, withFileTypes: true }).map((d) => {
      // Include both regular files and symlinks so the per-entry
      // realpath guard in `readWithinCwd` can record an explicit
      // exclusion for an escape. Without this, a symlink targeting
      // outside cwd would be silently invisible to the caller scan.
      const isRegular = d.isFile();
      const isSymlink = d.isSymbolicLink();
      if (!isRegular && !isSymlink) return null;
      const parent = (d as { parentPath?: string; path?: string }).parentPath
        ?? (d as { path?: string }).path
        ?? "";
      const name = d.name;
      const full = parent ? `${parent}/${name}` : name;
      return full.startsWith(`${cwdReal}/`) ? full.slice(`${cwdReal}/`.length) : full;
    }).filter((v): v is string => v !== null);
  } catch {
    return null;
  }
}

const TEST_CANDIDATE_BUILDERS: readonly ((base: string) => string)[] = [
  (base) => `src/${base}.test.ts`,
  (base) => `src/${base}.spec.ts`,
  (base) => `src/${base}.test.tsx`,
  (base) => `src/${base}.spec.tsx`,
  (base) => `tests/${base}.test.ts`,
  (base) => `tests/${base}.spec.ts`,
  (base) => `__tests__/${base}.test.ts`,
  (base) => `__tests__/${base}.spec.ts`,
];

async function collectFromTestReferences(
  init: CollectInit,
  state: CollectState,
): Promise<void> {
  for (const path of init.tsLikeChanged) {
    if (isTestReferenceBudgetExhausted(init, state)) break;
    await tryEmitFirstTestCandidateForPath(init, state, path);
  }
}

function isTestReferenceBudgetExhausted(init: CollectInit, state: CollectState): boolean {
  if (state.counters.filesParsed >= init.budgets.maxFilesParsed) return true;
  if (performance.now() - init.start > init.budgets.wallTimeMs) return true;
  return false;
}

async function tryEmitFirstTestCandidateForPath(
  init: CollectInit,
  state: CollectState,
  path: string,
): Promise<void> {
  const base = basenameOf(path).replace(/\.[jt]sx?$/u, "");
  if (base.length === 0) return;
  for (const mkCand of TEST_CANDIDATE_BUILDERS) {
    if (state.counters.filesParsed >= init.budgets.maxFilesParsed) break;
    const cand = mkCand(base);
    if (tryEmitTestCandidate(init, state, path, base, cand)) return;
  }
}

function tryEmitTestCandidate(
  init: CollectInit,
  state: CollectState,
  sourcePath: string,
  base: string,
  cand: string,
): boolean {
  if (isExcludedPath(cand)) {
    recordExclusion(state, cand, "generated-or-build-artifact");
    return false;
  }
  const r = readWithinCwd(init.cwdReal, cand, init.budgets.perFileBytes);
  if (!r.ok) return false;
  state.counters.filesParsed += 1;
  maybeAddCandidate(init, state, {
    kind: "test_reference",
    path: cand,
    pathScope: sourcePath,
    text: `// test for ${base}\n${r.text}`,
    trust: "base",
  });
  return true;
}

function collectExcludedItems(
  input: ContextProvenanceInput,
  init: CollectInit,
  state: CollectState,
): void {
  // Step 5 — Applicable instructions, path-scoped rules applied.
  for (const [path, text] of init.instructionsByPath) {
    if (text === null) continue;
    if (state.selected.length >= init.budgets.maxItems) break;
    if (isExcludedPath(path)) {
      recordExclusion(state, path, "generated-or-build-artifact");
      continue;
    }
    const scope = init.pathScopes.get(path) ?? "*";
    if (!init.changedPaths.some((p) => matchesGlob(p, scope))) {
      recordExclusion(state, path, "outside-path-scope");
      continue;
    }
    maybeAddCandidate(init, state, {
      kind: "instruction",
      path,
      pathScope: scope,
      text: `// base-branch instruction (applies to ${scope})\n${text}`,
      trust: "base",
    });
  }

  if (input.headBranchInstructionTexts !== undefined) {
    for (const path of input.headBranchInstructionTexts.keys()) {
      const norm = normalizeRepoPath(path);
      if (input.applicableInstructions.includes(norm) || input.applicableInstructions.includes(path)) {
        if (!state.excluded.some((e) => e.path === norm && e.reason === "head-branch-ignored-trust")) {
          state.excluded.push({ path: norm, reason: "head-branch-ignored-trust" });
        }
      }
    }
  }
}

function finalizeContextResult(
  init: CollectInit,
  selectedRaw: readonly ContextItem[],
  excludedRaw: readonly ContextExclusion[],
  budgetByteTotal: number,
  collectedStatus: SemanticContextStatus,
): ContextProvenanceResult {
  const selected = [...selectedRaw];
  selected.sort(compareContextItem);

  // PR-mode trust policy: head-branch instruction content is NEVER trusted.
  for (let i = 0; i < selected.length; i += 1) {
    const it = selected[i]!;
    selected[i] = { ...it, trust: it.trust === "head" ? "untrusted" : it.trust };
  }

  const budgetHash = sha256Hex(JSON.stringify(init.budgets) + `\n${selected.length}\n${budgetByteTotal}`);

  return {
    items: Object.freeze(selected),
    excluded: Object.freeze(excludedRaw),
    budgets: init.budgets,
    semanticContextStatus: collectedStatus,
    budgetHash,
    bytesUsed: budgetByteTotal,
  };
}

// ---------------------------------------------------------------------------
// Instruction text helper
// ---------------------------------------------------------------------------

async function readInstructionText(cwdReal: string, rel: string): Promise<string> {
  const r = readWithinCwd(cwdReal, rel, BUDGET_DEFAULTS.perFileBytes);
  if (!r.ok) return "";
  return r.text;
}

// ---------------------------------------------------------------------------
// Same-project import resolver
// ---------------------------------------------------------------------------

function resolveSameProjectImport(cwd: string, fromFile: string, spec: string): string | null {
  if (spec.length === 0) return null;
  if (isAbsolute(spec) || spec.startsWith("/")) return null;
  if (spec.startsWith(".")) {
    const fromDir = posixDirname(toPosix(fromFile));
    const joined = posixResolve(fromDir, spec);
    const slashed = joined.startsWith("/") ? joined : `${cwd}/${joined}`;
    if (slashed.startsWith(`${cwd}/`) || slashed === `${cwd}`) {
      const rel = slashed.slice(`${cwd}/`.length);
      return rel;
    }
    return null;
  }
  return null;
}

function posixDirname(p: string): string {
  const t = p.replace(/\\/gu, "/");
  const slash = t.lastIndexOf("/");
  return slash === -1 ? "" : t.slice(0, slash);
}

function posixResolve(fromDir: string, spec: string): string {
  const parts = (fromDir + "/" + spec).split("/").filter((s) => s.length > 0 && s !== ".");
  const out: string[] = [];
  for (const seg of parts) {
    if (seg === "..") {
      out.pop();
    } else {
      out.push(seg);
    }
  }
  return out.join("/");
}

// ---------------------------------------------------------------------------
// Basename helper
// ---------------------------------------------------------------------------

function basenameOf(p: string): string {
  const t = toPosix(p);
  const slash = t.lastIndexOf("/");
  return slash === -1 ? t : t.slice(slash + 1);
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function compareContextItem(a: ContextItem, b: ContextItem): number {
  const ORDER: Record<ContextItemKind, number> = {
    changed_declaration: 0,
    related_type: 1,
    direct_caller_or_callee: 2,
    test_reference: 3,
    instruction: 4,
    diff_hunk: 5,
  };
  const ord = ORDER[a.sourceKind] - ORDER[b.sourceKind];
  if (ord !== 0) return ord;
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Render either the model-facing block (with file text) or the
 * content-free manifest. The default `kind: "rendered"` is what
 * `buildProviderPrompts` embeds in the user prompt; pass `asManifest: true`
 * to get the content-free manifest for the artifact layer.
 */
export function renderContextBlock(
  result: ContextProvenanceResult,
  opts: { readonly asManifest?: boolean } = {},
): RenderedContextBlock {
  if (opts.asManifest === true) {
    const lines: string[] = [];
    lines.push("Context manifest (content-free):");
    lines.push(`semanticContextStatus: ${result.semanticContextStatus}`);
    lines.push(`budgets: ${JSON.stringify(result.budgets)}`);
    lines.push(`budgetHash: ${result.budgetHash}`);
    lines.push(`bytesUsed: ${result.bytesUsed}`);
    lines.push(`items: ${result.items.length} included, ${result.excluded.length} excluded`);
    for (const it of result.items) {
      lines.push(`- ${it.sourceKind} ${it.path} (scope=${it.pathScope} trust=${it.trust} bytes=${it.bytes} sha256=${it.contentHash})`);
    }
    if (result.excluded.length > 0) {
      lines.push("exclusions:");
      for (const ex of result.excluded) {
        lines.push(`- ${ex.path}: ${ex.reason}`);
      }
    }
    return {
      kind: "manifest",
      text: lines.join("\n"),
      included: result.items.length,
      excluded: result.excluded.length,
      status: result.semanticContextStatus,
    };
  }
  const lines: string[] = [];
  lines.push("Repository context (typed provenance, budget-bounded):");
  lines.push(`status: ${result.semanticContextStatus}`);
  for (const it of result.items) {
    lines.push("");
    lines.push(`--- [${it.sourceKind}] ${it.path} (trust=${it.trust}, scope=${it.pathScope}, bytes=${it.bytes}, sha256=${it.contentHash.slice(0, 12)}…) ---`);
    lines.push(it.text);
  }
  return {
    kind: "rendered",
    text: lines.join("\n"),
    included: result.items.length,
  };
}

// Re-export so callers can import from one place.
export { posix as _posix } from "node:path";
