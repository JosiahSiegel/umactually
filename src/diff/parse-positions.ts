import { isPositiveSafeInteger } from "../util/json-guards.js";

export type DiffPosition = {
  readonly path: string;
  readonly line: number;
};

export type DiffPositionIndex = {
  readonly hasPosition: (position: DiffPosition) => boolean;
  readonly enumerate: () => ReadonlyArray<DiffPosition>;
};

export function parseDiffPositions(diffText: string): DiffPositionIndex {
  const linesByPath = new Map<string, Set<number>>();
  // preserve the order in which right-side positions were first observed so
  // callers (e.g. simulated-findings) can pick the first N anchor points
  // deterministically.
  const orderedPositions: Array<DiffPosition> = [];
  const seenPositions = new Set<string>();
  let currentPath: string | null = null;
  let nextNewLine: number | null = null;

  for (const line of diffText.split(/\r?\n/u)) {
    if (line.startsWith("diff --git ")) {
      currentPath = null;
      nextNewLine = null;
      continue;
    }

    if (currentPath === null) {
      const parsedPath = parseNewFilePath(line);
      if (parsedPath !== null) {
        currentPath = parsedPath;
      }
      continue;
    }

    const hunkStart = parseNewHunkStart(line);
    if (hunkStart !== null) {
      nextNewLine = hunkStart;
      continue;
    }

    if (nextNewLine === null) {
      continue;
    }

    if (line.startsWith("+")) {
      addLine(linesByPath, currentPath, nextNewLine);
      recordPosition(orderedPositions, seenPositions, currentPath, nextNewLine);
      nextNewLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      addLine(linesByPath, currentPath, nextNewLine);
      recordPosition(orderedPositions, seenPositions, currentPath, nextNewLine);
      nextNewLine += 1;
    }
  }

  return {
    hasPosition(position: DiffPosition): boolean {
      return linesByPath.get(position.path)?.has(position.line) ?? false;
    },
    enumerate(): ReadonlyArray<DiffPosition> {
      return orderedPositions.slice();
    },
  };
}

function recordPosition(
  ordered: Array<DiffPosition>,
  seen: Set<string>,
  path: string,
  line: number,
): void {
  const key = `${path}\u0000${line}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  ordered.push({ path, line });
}

export function parseNewFilePath(line: string): string | null {
  if (!line.startsWith("+++ ")) {
    return null;
  }

  const [rawPath] = line.slice(4).split("\t");
  if (rawPath === undefined) {
    return null;
  }

  const path = rawPath.trim();
  if (path === "/dev/null") {
    return null;
  }

  return path.startsWith("b/") ? path.slice(2) : path;
}

function parseNewHunkStart(line: string): number | null {
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

  return isPositiveSafeInteger(start) ? start : null;
}

/**
 * `@@ -1,4 +1,7 @@` → 1. Returns null when the header is malformed.
 *
 * Exported so `src/review/diff-line-utils.ts:readDiffLine` can reuse
 * the exact same parser instead of re-implementing it (the two copies
 * drifted subtly before the export was added).
 */
export const parseHunkStart = parseNewHunkStart;

function addLine(linesByPath: Map<string, Set<number>>, path: string, line: number): void {
  const existingLines = linesByPath.get(path);
  if (existingLines !== undefined) {
    existingLines.add(line);
    return;
  }

  linesByPath.set(path, new Set([line]));
}
