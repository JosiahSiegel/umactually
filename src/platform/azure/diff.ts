export type AzureChangeItem = {
  readonly path: string;
  readonly url: string | null;
  readonly objectId: string | null;
};

export type AzureChange = {
  readonly item: AzureChangeItem;
  readonly originalObjectId: string | null;
};

export type AzureItemVersion = {
  readonly path: string;
  readonly baseUrl: string | null;
  readonly versionType: "Branch" | "Commit";
  readonly version: string;
};

export type AzureFileSnapshot = {
  readonly exists: boolean;
  readonly content: string;
};

export function buildUnifiedFileDiff(path: string, oldFile: AzureFileSnapshot, newFile: AzureFileSnapshot): string | null {
  if (oldFile.exists === newFile.exists && oldFile.content === newFile.content) {
    return null;
  }

  const diffPath = normalizeDiffPath(path);
  const oldLines = splitContentLines(oldFile.content);
  const newLines = splitContentLines(newFile.content);
  const oldLabel = oldFile.exists ? `a/${diffPath}` : "/dev/null";
  const newLabel = newFile.exists ? `b/${diffPath}` : "/dev/null";
  const hunkLines = buildHunkLines(oldLines, newLines);

  return [
    `diff --git a/${diffPath} b/${diffPath}`,
    `--- ${oldLabel}`,
    `+++ ${newLabel}`,
    `@@ -${formatRange(oldLines)} +${formatRange(newLines)} @@`,
    ...hunkLines,
    "",
  ].join("\n");
}

function buildHunkLines(oldLines: readonly string[], newLines: readonly string[]): readonly string[] {
  const prefixLength = findCommonPrefixLength(oldLines, newLines);
  const suffixLength = findCommonSuffixLength(oldLines, newLines, prefixLength);
  const hunkLines: string[] = [];

  for (const line of oldLines.slice(0, prefixLength)) {
    hunkLines.push(` ${line}`);
  }
  for (const line of oldLines.slice(prefixLength, oldLines.length - suffixLength)) {
    hunkLines.push(`-${line}`);
  }
  for (const line of newLines.slice(prefixLength, newLines.length - suffixLength)) {
    hunkLines.push(`+${line}`);
  }
  for (const line of oldLines.slice(oldLines.length - suffixLength)) {
    hunkLines.push(` ${line}`);
  }

  return hunkLines;
}

function findCommonPrefixLength(oldLines: readonly string[], newLines: readonly string[]): number {
  let index = 0;
  while (index < oldLines.length && index < newLines.length && oldLines[index] === newLines[index]) {
    index += 1;
  }

  return index;
}

function findCommonSuffixLength(
  oldLines: readonly string[],
  newLines: readonly string[],
  prefixLength: number,
): number {
  let length = 0;
  while (
    length + prefixLength < oldLines.length &&
    length + prefixLength < newLines.length &&
    oldLines[oldLines.length - length - 1] === newLines[newLines.length - length - 1]
  ) {
    length += 1;
  }

  return length;
}

function splitContentLines(content: string): readonly string[] {
  if (content.length === 0) {
    return [];
  }

  const contentWithoutFinalNewline = content.endsWith("\n") ? content.slice(0, -1) : content;
  if (contentWithoutFinalNewline.length === 0) {
    return [];
  }

  return contentWithoutFinalNewline.split(/\r?\n/u);
}

function formatRange(lines: readonly string[]): string {
  const start = lines.length === 0 ? 0 : 1;
  return `${start},${lines.length}`;
}

function normalizeDiffPath(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}
