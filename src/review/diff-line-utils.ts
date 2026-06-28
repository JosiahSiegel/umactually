import type { DiffPosition } from "../diff/parse-positions.js";

/**
 * Walk the diff text and return the raw line content for the first
 * `+` or ` ` row at the given right-side position. Falls back to an empty
 * string when the diff has no hunk header reachable for the file path.
 *
 * Exposed so the simulated-findings fixture can build context-aware bodies
 * that reference a representative token from the actual diff line.
 */
export function readDiffLine(diffText: string, position: DiffPosition): string {
  const targetPath = `b/${position.path}`;
  const diffLines = diffText.split(/\r?\n/u);
  let currentPath: string | null = null;
  let nextNewLine: number | null = null;

  for (const rawLine of diffLines) {
    if (rawLine.startsWith("diff --git ")) {
      currentPath = null;
      nextNewLine = null;
      continue;
    }

    if (currentPath === null) {
      if (rawLine.startsWith("+++ ")) {
        const [rawPath] = rawLine.slice(4).split("\t");
        if (rawPath !== undefined) {
          const path = rawPath.trim();
          if (path !== "/dev/null") {
            const normalized = path.startsWith("b/") ? path.slice(2) : path;
            if (normalized === position.path) {
              currentPath = targetPath;
            } else {
              currentPath = normalized;
            }
          }
        }
      }
      continue;
    }

    if (currentPath !== targetPath) {
      continue;
    }

    if (rawLine.startsWith("@@ ")) {
      const start = parseHunkStart(rawLine);
      nextNewLine = start;
      continue;
    }

    if (nextNewLine === null) {
      continue;
    }

    if (rawLine.startsWith("+") || rawLine.startsWith(" ")) {
      if (nextNewLine === position.line) {
        return rawLine.slice(1).trim();
      }
      nextNewLine += 1;
    }
  }

  return "";
}

/**
 * `@@ -1,4 +1,7 @@` → 1. Returns null when the header is malformed.
 */
function parseHunkStart(line: string): number | null {
  if (!line.startsWith("@@ ")) {
    return null;
  }
  const plusIndex = line.indexOf("+");
  if (plusIndex === -1) {
    return null;
  }
  const afterPlus = line.slice(plusIndex + 1);
  const endIndex = afterPlus.search(/[ ,]/u);
  const rawStart = endIndex === -1 ? afterPlus : afterPlus.slice(0, endIndex);
  const start = Number.parseInt(rawStart, 10);
  return Number.isSafeInteger(start) && start > 0 ? start : null;
}

/**
 * Pull a meaningful token out of the diff line for context-aware bodies.
 * Falls back to a path-derived identifier when the line is blank.
 */
export function extractRepresentativeToken(lineContent: string, path: string): string {
  const identifierMatch = lineContent.match(/\b([A-Za-z_$][\w$]*)\s*\(/u);
  if (identifierMatch !== null && identifierMatch[1] !== undefined) {
    return identifierMatch[1];
  }

  const declarationMatch = lineContent.match(
    /\b(?:const|let|var|function|class|interface|type|export)\s+([A-Za-z_$][\w$]*)/u,
  );
  if (declarationMatch !== null && declarationMatch[1] !== undefined) {
    return declarationMatch[1];
  }

  const genericMatch = lineContent.match(/\b([A-Za-z_$][\w$]{3,})\b/u);
  if (genericMatch !== null && genericMatch[1] !== undefined) {
    return genericMatch[1];
  }

  const fallback = path.replace(/[^\w]+/gu, "_").replace(/^_+|_+$/gu, "");
  return fallback.length > 0 ? fallback : "this change";
}