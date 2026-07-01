import { AzureApiError, AZURE_EMPTY_DIFF_STATUS } from "./errors.js";
import type { AzureChange } from "./diff.js";

export function parseLatestIterationId(payload: unknown): number {
  const root = requireRecord(payload, "Azure iterations response");
  const iterations = requireArray(root["value"], "Azure iterations response value");
  const latestIteration = iterations.at(-1);
  if (latestIteration === undefined) {
    throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, "Azure DevOps PR iterations response was empty.");
  }

  const latestRecord = requireRecord(latestIteration, "Azure latest iteration");
  return requirePositiveInteger(latestRecord["id"], "Azure latest iteration id");
}

export function parseSourceCommitId(payload: unknown): string {
  const root = requireRecord(payload, "Azure iteration response");
  const sourceRefCommit = requireRecord(root["sourceRefCommit"], "Azure iteration sourceRefCommit");
  return requireNonEmptyString(sourceRefCommit["commitId"], "Azure iteration sourceRefCommit.commitId");
}

export function parseIterationChanges(payload: unknown): readonly AzureChange[] {
  const root = requireRecord(payload, "Azure iteration changes response");
  const rawChanges = findFirstArray(root, ["changes", "changeEntries", "value"]);
  if (rawChanges === null) {
    throw new AzureApiError(
      "AZURE_FETCH_FAILED",
      AZURE_EMPTY_DIFF_STATUS,
      "Azure DevOps PR iteration changes response did not include changes.",
    );
  }

  return rawChanges.map(parseAzureChange);
}

export function parseItemContent(payload: unknown): string {
  const root = requireRecord(payload, "Azure item response");
  return requireString(root["content"], "Azure item response content");
}

function parseAzureChange(value: unknown): AzureChange {
  const root = requireRecord(value, "Azure iteration change");
  const item = requireRecord(root["item"], "Azure iteration change item");

  return {
    item: {
      path: requireNonEmptyString(item["path"], "Azure iteration change item.path"),
      url: readOptionalString(item["url"]),
      objectId: readOptionalString(item["objectId"]),
    },
    originalObjectId: readOptionalString(root["originalObjectId"]),
  };
}

function findFirstArray(record: Record<string, unknown>, keys: readonly string[]): readonly unknown[] | null {
  for (const key of keys) {
    const value = record[key];
    if (isUnknownArray(value)) {
      return value;
    }
  }

  return null;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a JSON object.`);
}

function requireArray(value: unknown, label: string): readonly unknown[] {
  if (isUnknownArray(value)) {
    return value;
  }

  throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a JSON array.`);
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a positive integer.`);
}

function requireNonEmptyString(value: unknown, label: string): string {
  const parsed = requireString(value, label);
  if (parsed.length > 0) {
    return parsed;
  }

  throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was empty.`);
}

function requireString(value: unknown, label: string): string {
  if (typeof value === "string") {
    return value;
  }

  throw new AzureApiError("AZURE_FETCH_FAILED", AZURE_EMPTY_DIFF_STATUS, `${label} was not a string.`);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
