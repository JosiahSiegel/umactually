import { ALL_FIELDS } from "../config/field-schema.js";
import type { FieldDef, FieldName, FieldType } from "../config/field-schema.js";
import type { ActionInputs } from "./read-inputs.js";

const ACTION_INPUT_FIELDS = {
  githubToken: true,
  apiKey: true,
  apiUrl: true,
  model: true,
  prompt: true,
  promptFile: true,
  promptFiles: true,
  additionalPrompt: true,
  additionalPromptFile: true,
  additionalPromptFiles: true,
  walkthrough: true,
  diagnostic: true,
  dryRun: true,
  debugRawResponse: true,
  simulateFindings: true,
  strictSchema: true,
  verifyFindings: true,
  reviewTimeoutSeconds: true,
  stallSeconds: true,
  maxOutputTokens: true,
  minimumSeverity: true,
  maxComments: true,
  reviewFileLimit: true,
  includeSonarqube: true,
  sonarHostUrl: true,
  sonarToken: true,
  sonarProjectKey: true,
  sonarTimeoutSeconds: true,
  detectLeaks: true,
  platform: true,
  prNumber: true,
  repo: true,
  inGitHubActions: true,
  effort: true,
  provider: true,
  githubApiBase: true,
} as const satisfies Readonly<Record<keyof ActionInputs, true>>;

/**
 * Pre-refactor ordering index used to sort `ALL_FIELDS` so the emitted argv
 * sequence stays byte-identical to the hand-written version. The values are
 * sparse (gaps allowed) and any field missing here sorts to the end via the
 * `Number.MAX_SAFE_INTEGER` fallback in `fieldOrder`.
 */
const LEGACY_ARG_ORDER_ENTRIES: readonly (readonly [FieldName, number])[] = [
  ["apiUrl", 0],
  ["apiKey", 1],
  ["model", 2],
  ["prompt", 3],
  ["promptFile", 4],
  ["promptFiles", 5],
  ["additionalPrompt", 6],
  ["additionalPromptFile", 7],
  ["sonarHostUrl", 8],
  ["sonarToken", 9],
  ["sonarProjectKey", 10],
  ["provider", 11],
  ["githubApiBase", 12],
  ["effort", 13],
  ["minimumSeverity", 14],
  ["reviewTimeoutSeconds", 15],
  ["stallSeconds", 16],
  ["maxOutputTokens", 17],
  ["maxComments", 18],
  ["reviewFileLimit", 19],
  ["sonarTimeoutSeconds", 20],
  ["includeSonarqube", 21],
  ["walkthrough", 22],
  ["diagnostic", 23],
  ["debugRawResponse", 24],
  ["simulateFindings", 25],
  ["additionalPromptFiles", 26],
];

const LEGACY_ARG_ORDER: ReadonlyMap<string, number> = new Map(LEGACY_ARG_ORDER_ENTRIES);

export function appendCommonInputArgs(args: string[], inputs: ActionInputs): string[] {
  for (const def of commonInputFieldDefs()) {
    const flag = def.flag;
    if (flag === null) continue;
    if (!isFieldInActionInputs(def.field)) continue;

    pushFieldValue(args, def.type, flag, inputs[def.field]);
  }

  // Manual boolean handlers — these need negation because the CLI
  // defaults are ON. The data-driven loop above only emits the
  // positive form (--flag when value is true), so for default-ON
  // flags the operator must be able to opt out via the negation
  // form (--no-flag). These four are the only default-ON CLI flags
  // exposed via the action surface; any new default-ON field-schema
  // entry must be added here AND to isManualBooleanField().
  args.push(inputs.detectLeaks ? "--detect-leaks" : "--no-detect-leaks");
  args.push(inputs.dryRun ? "--dry-run" : "--no-dry-run");
  args.push(inputs.strictSchema ? "--strict-schema" : "--no-strict-schema");
  args.push(inputs.verifyFindings ? "--verify-findings" : "--no-verify-findings");
  return args;
}

function commonInputFieldDefs(): readonly FieldDef<FieldType>[] {
  return [...ALL_FIELDS]
    .filter((def) => !isCallerOwnedField(def) && !isManualBooleanField(def) && hasActionCliSurface(def))
    .sort((left, right) => fieldOrder(left.field) - fieldOrder(right.field));
}

function hasActionCliSurface(def: FieldDef<FieldType>): boolean {
  return def.flag !== null && isFieldInActionInputs(def.field);
}

function isCallerOwnedField(def: FieldDef<FieldType>): boolean {
  return def.field === "platform" || def.field === "prNumber" || def.field === "repo";
}

function isManualBooleanField(def: FieldDef<FieldType>): boolean {
  return (
    def.field === "detectLeaks" ||
    def.field === "dryRun" ||
    def.field === "strictSchema" ||
    def.field === "verifyFindings"
  );
}

function isFieldInActionInputs(field: string): field is keyof ActionInputs {
  return Object.hasOwn(ACTION_INPUT_FIELDS, field);
}

function fieldOrder(field: string): number {
  return LEGACY_ARG_ORDER.get(field) ?? Number.MAX_SAFE_INTEGER;
}

function pushFieldValue(args: string[], type: FieldType, flag: string, value: unknown): void {
  switch (type) {
    case "string":
    case "enum":
      if (typeof value === "string" && value.length > 0) {
        args.push(flag, value);
      }
      break;
    case "integer":
      if (typeof value === "number" && Number.isFinite(value)) {
        args.push(flag, String(value));
      }
      break;
    case "boolean":
      if (value === true) {
        args.push(flag);
      }
      break;
    default:
      assertNever(type);
  }
}

function assertNever(value: never): never {
  throw new TypeError(`unhandled field type: ${JSON.stringify(value)}`);
}
