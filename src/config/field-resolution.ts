import type { ParsedCliArgs } from "../cli/parse-args.js";
import { wasCliFieldExplicitlySet } from "../cli/parse-args.js";
import { InvalidConfigError, REDACTED } from "./errors.js";
import { FIELDS, type FieldDef, type FieldType } from "./field-schema.js";
import {
  parseBooleanFromUnknown,
  parseIntegerFromUnknown,
  parsePlatformFromUnknown,
  parseSeverityFromUnknown,
} from "./parsers.js";

export type FieldProvenance = {
  readonly source: "flag" | "env" | "savedConfig" | "default";
  readonly envName?: string;
};

export type FieldProvenanceMap = Readonly<Record<string, FieldProvenance>>;

export type SchemaResolvedCliArgs = ParsedCliArgs & Readonly<Record<string, unknown>> & {
  readonly fieldProvenance: FieldProvenanceMap;
};

/**
 * Resolve a config field through the canonical precedence chain: parsed > env > fallback.
 *
 * Returns the first value in the chain that is non-null, non-undefined, AND (when a
 * string) non-empty. This matches the behavior the live path hand-rolls inline at
 * multiple sites (`parsed.X ?? env["Y"] ?? DEFAULT_Z`).
 *
 * Why this exists: the config loader (`src/config/loader.ts`) has private pickX
 * helpers used only inside loadConfigFromSources. The live path cannot call those
 * directly — it builds parsed/env from different inputs (CLI argv + action inputs +
 * env) and needs the same chain. Centralizing eliminates the 7+ hand-rolled
 * `parsed.X ?? env["Y"]` occurrences scattered across cli/ that future maintainers
 * could "fix" by adding a default to one site but not the others.
 *
 * Treats the empty string as "missing" for string-typed fields. This matches the
 * CLI's existing behavior (`parseStringFromUnknown` raises on empty input, and the
 * shell typically passes empty strings for unset flags).
 *
 * @param parsedValue  CLI/inputs value (already parsed).
 * @param envValue     Env-var value (read via ENV_KEYS.X).
 * @param fallback     The schema default (from FIELDS.<x>.defaultValue or a derived constant).
 * @returns            The first non-null/non-empty value, or `fallback`.
 */
export function resolveField<T extends string | number | boolean>(
  parsedValue: T | undefined | null,
  envValue: T | undefined | null,
  fallback: T,
): T {
  if (parsedValue !== undefined && parsedValue !== null) {
    if (typeof parsedValue === "string" && parsedValue.length === 0) {
      // Empty string is treated as missing for string fields.
    } else {
      return parsedValue;
    }
  }
  if (envValue !== undefined && envValue !== null) {
    if (typeof envValue === "string" && envValue.length === 0) {
      // Empty string from env is treated as missing.
    } else {
      return envValue;
    }
  }
  return fallback;
}

export function resolveFromSchema(
  parsed: ParsedCliArgs,
  env: NodeJS.ProcessEnv,
): SchemaResolvedCliArgs {
  const resolved: Record<string, unknown> = { ...parsed };
  const fieldProvenance: Record<string, FieldProvenance> = {};
  for (const field of Object.values(FIELDS)) {
    const parsedValue = parsedValueForField(parsed, field);
    const envValue = firstNonBlankEnv(field.env, env);
    const raw = parsedValue ?? envValue?.value ?? field.defaultValue;
    resolved[field.field] = coerceField(field, raw);
    fieldProvenance[field.field] = parsedValue !== undefined
      ? { source: "flag" }
      : envValue !== undefined
        ? { source: "env", envName: envValue.envName }
        : { source: "default" };
  }
  resolved["minimumSeverityInternal"] = parseSeverityFromUnknown(
    resolved["minimumSeverity"],
    FIELDS.minimumSeverity.field,
  );
  return Object.assign({}, parsed, resolved, { fieldProvenance });
}

function parsedValueForField(
  parsed: ParsedCliArgs,
  field: FieldDef<FieldType>,
): unknown {
  if (!(field.field in parsed)) {
    return undefined;
  }
  if (field.flag !== null && !wasCliFieldExplicitlySet(parsed, field.field)) {
    return undefined;
  }
  const value: unknown = Reflect.get(parsed, field.field);
  return value === null ? undefined : value;
}

function firstNonBlankEnv(
  aliases: readonly string[],
  env: NodeJS.ProcessEnv,
): { readonly envName: string; readonly value: string } | undefined {
  for (const alias of aliases) {
    const value = env[alias];
    if (typeof value === "string" && value.trim().length > 0) {
      return { envName: alias, value };
    }
  }
  return undefined;
}

function coerceField(
  field: FieldDef<FieldType>,
  raw: unknown,
): string | number | boolean | null {
  switch (field.type) {
    case "string":
      if (typeof raw !== "string") {
        throw new InvalidConfigError(field.field, `expected string, received ${typeof raw}`);
      }
      return raw;
    case "boolean":
      return parseBooleanFromUnknown(raw, field.field);
    case "integer":
      return parseIntegerFromUnknown(raw, field.field);
    case "enum":
      return parseEnumField(field, raw);
    default:
      return assertNever(field.type);
  }
}

function parseEnumField(field: FieldDef<FieldType>, raw: unknown): string {
  if (field.field === "platform") {
    return parsePlatformFromUnknown(raw, field.field);
  }
  if (field.field === "minimumSeverity") {
    parseSeverityFromUnknown(raw, field.field);
  }
  if (typeof raw !== "string") {
    throw new InvalidConfigError(field.field, `expected enum string, received ${typeof raw}`);
  }
  const normalized = raw.trim().toLowerCase();
  if (!(field.enumValues ?? []).includes(normalized)) {
    throw new InvalidConfigError(field.field, `unknown enum value ${REDACTED}`);
  }
  return normalized;
}

function assertNever(value: never): never {
  throw new InvalidConfigError("field.type", `unknown field type ${String(value)}`);
}
