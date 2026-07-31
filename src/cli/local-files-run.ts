/**
 * Runs a provider-only review over local files/directories for the
 * `umactually --files <path>[,<path>...]` mode. Synthesizes a unified
 * diff from the file contents and feeds it through the existing
 * `runStandalone` pipeline. Never posts to a platform; standalone-only.
 */
import * as fsPromises from "node:fs/promises";
import { realpathSync } from "node:fs";
import { relative, resolve as pathResolve } from "node:path";
import { join } from "node:path";

import { isExcludedPath } from "../diff/filter-build-artifacts.js";
import { BRAND_PREFIX } from "../util/brand.js";
import { runStandalone } from "./standalone-run.js";
import type { ParsedCliArgs } from "./parse-args.js";

export type LocalFilesRunResult =
  | { readonly kind: "ok"; readonly artifactPath: string; readonly review: { readonly comments: readonly unknown[]; readonly verdict: string; readonly summary: string } }
  | { readonly kind: "ok-no-files"; readonly artifactPath: string; readonly note: string }
  | { readonly kind: "provider-error"; readonly exitCode: 1; readonly message: string; readonly sanitizedForLog: string; readonly hint?: string };

const MAX_FILE_BYTES = 256 * 1024;
const SYNTHESIZED_DIFF_HEADER_LINES = 2;
const SYNTHESIZED_HUNK_HEADER_PREFIX = "@@ -0,0 +1,";
const BINARY_SAMPLE_BYTES = 8 * 1024;

type RunLocalFilesInput = {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly overrideArtifactPath?: string;
};

class LocalFilesPathError extends Error {}

function splitPaths(files: string | null): readonly string[] {
  if (files === null) {
    return [];
  }
  const paths = files.split(",").map((path) => path.trim()).filter((path) => path.length > 0);
  const offending = paths.find((path) => path.includes(","));
  if (offending !== undefined) {
    throw new LocalFilesPathError(`--files does not accept paths containing commas (got '${offending}')`);
  }
  return paths;
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function candidatePaths(inputPath: string, cwd: string): Promise<readonly string[]> {
  const absolute = pathResolve(cwd, inputPath);
  let info;
  try {
    info = await fsPromises.lstat(absolute);
  } catch (error) {
    console.error(`${BRAND_PREFIX}--files: skipped ${inputPath} (${reasonFor(error)})`);
    return [];
  }
  if (info.isSymbolicLink()) {
    return [];
  }
  if (!info.isDirectory()) {
    return [absolute];
  }
  try {
    const entries = await fsPromises.readdir(absolute, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
      .map((entry) => pathResolve(entry.parentPath, entry.name));
  } catch (error) {
    console.error(`${BRAND_PREFIX}--files: skipped ${inputPath} (${reasonFor(error)})`);
    return [];
  }
}

async function isBinary(path: string): Promise<boolean> {
  const handle = await fsPromises.open(path, "r");
  try {
    const buffer = Buffer.alloc(BINARY_SAMPLE_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, BINARY_SAMPLE_BYTES, 0);
    if (bytesRead === 0) {
      return false;
    }
    let nulBytes = 0;
    for (let index = 0; index < bytesRead; index += 1) {
      if (buffer[index] === 0) {
        nulBytes += 1;
      }
    }
    return nulBytes / bytesRead > 0.05;
  } finally {
    await handle.close();
  }
}

async function collectFiles(paths: readonly string[], cwd: string): Promise<readonly string[]> {
  const candidates = (await Promise.all(paths.map((path) => candidatePaths(path, cwd)))).flat();
  const unique = new Set<string>();
  for (const absolute of candidates) {
    const relativePath = relative(cwd, absolute).replaceAll("\\", "/");
    if (isExcludedPath(relativePath)) {
      continue;
    }
    if (await isBinary(absolute)) {
      console.error(`${BRAND_PREFIX}--files: skipped ${relativePath} (binary)`);
      continue;
    }
    unique.add(realpathSync(absolute));
  }
  return Array.from(unique).sort();
}

function truncate(content: string): string {
  const bytes = Buffer.from(content, "utf8");
  if (bytes.length <= MAX_FILE_BYTES) {
    return content;
  }
  return `${bytes.subarray(0, MAX_FILE_BYTES).toString("utf8")}... (truncated)`;
}

function diffBlock(relativePath: string, content: string): string {
  const normalized = content.endsWith("\n") ? content.slice(0, -1) : content;
  const lines = normalized.length === 0 ? [] : normalized.split("\n");
  const header = [
    `diff --git a/${relativePath} b/${relativePath}`,
    `${SYNTHESIZED_HUNK_HEADER_PREFIX}${lines.length} @@`,
  ];
  if (header.length !== SYNTHESIZED_DIFF_HEADER_LINES) {
    throw new Error("invalid synthesized diff header");
  }
  return `${header.join("\n")}\n${lines.map((line) => `+${line}`).join("\n")}\n`;
}

async function synthesize(files: readonly string[], cwd: string): Promise<string> {
  const blocks: string[] = [];
  for (const absolute of files) {
    const content = truncate(await fsPromises.readFile(absolute, "utf8"));
    const relativePath = relative(cwd, absolute).replaceAll("\\", "/");
    blocks.push(diffBlock(relativePath, content));
  }
  return blocks.join("\n");
}

export async function runLocalFilesReview(input: RunLocalFilesInput): Promise<LocalFilesRunResult> {
  const paths = splitPaths(input.parsed.files);
  const files = await collectFiles(paths, input.cwd);
  const diffPath = join(input.cwd, ".umactually-auto-ctx", `local-files-${process.pid}-${input.parsed.dryRun ? "dry-run" : Date.now()}.diff`);
  const artifactPath = pathResolve(input.cwd, input.overrideArtifactPath ?? "./umactually-review.json");
  if (files.length === 0) {
    return { kind: "ok-no-files", artifactPath, note: "no files matched (excluded or non-existent)" };
  }
  const diffText = await synthesize(files, input.cwd);
  if (input.parsed.dryRun) {
    return { kind: "ok", artifactPath: diffPath, review: { comments: [], verdict: "COMMENT", summary: "local-files dry run" } };
  }
  await fsPromises.mkdir(join(input.cwd, ".umactually-auto-ctx"), { recursive: true });
  await fsPromises.writeFile(diffPath, diffText, "utf8");
  const result = await runStandalone({
    parsed: { ...input.parsed, diffPath, files: null }, cwd: input.cwd, env: input.env,
    ...(input.overrideArtifactPath !== undefined ? { overrideArtifactPath: input.overrideArtifactPath } : {}),
  });
  switch (result.kind) {
    case "ok":
      return result;
    case "ok-no-diff":
      return { kind: "ok-no-files", artifactPath: result.artifactPath, note: "no files matched" };
    case "provider-error":
      return result;
  }
}
