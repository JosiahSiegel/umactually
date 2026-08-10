import type { Severity, Platform } from "./types.js";
import { InvalidConfigError, REDACTED } from "./errors.js";
import { FIELDS } from "./field-schema.js";
import { tryParseStrictInt } from "../util/strict-integer.js";
import { stripTrailingSlash } from "../util/url.js";
import { normalizeEnumInput } from "../util/normalize.js";

const TRUTHY_STRINGS: ReadonlySet<string> = new Set(["1", "true", "yes", "on", "y"]);
const FALSY_STRINGS: ReadonlySet<string> = new Set(["0", "false", "no", "off", "n", ""]);

/**
 * Parses a boolean from an unknown boundary. Accepts:
 * - native boolean
 * - 0 or 1 (number)
 * - string in TRUTHY_STRINGS / FALSY_STRINGS (case-insensitive, trimmed)
 * Anything else throws InvalidConfigError with [REDACTED] in the message.
 */
export function parseBooleanFromUnknown(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    throw new InvalidConfigError(field, `expected boolean, received number ${REDACTED}`);
  }
  if (typeof value === "string") {
    const normalized = normalizeEnumInput(value);
    if (TRUTHY_STRINGS.has(normalized)) return true;
    if (FALSY_STRINGS.has(normalized)) return false;
    throw new InvalidConfigError(field, `expected boolean string, received ${REDACTED}`);
  }
  throw new InvalidConfigError(field, `expected boolean, received ${typeof value}`);
}

/**
 * Parses an integer from an unknown boundary. Accepts native integers
 * and decimal-integer strings. Rejects floats, NaN, Infinity, empty strings.
 */
export function parseIntegerFromUnknown(value: unknown, field: string): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new InvalidConfigError(field, `expected integer, received non-integer number ${REDACTED}`);
    }
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new InvalidConfigError(field, `expected integer, received empty string`);
    }
    const parsed = tryParseStrictInt(trimmed);
    if (parsed === null) {
      throw new InvalidConfigError(field, `expected integer string, received ${REDACTED}`);
    }
    // Reject values outside the safe-integer range so callers that
    // rely on exact equality (severity-key lookups, cache keys,
    // downstream arithmetic) do not silently truncate. The CLI's
    // parseStrictInt has the same check; this is the config-loader's
    // equivalent so the two surfaces agree.
    if (!Number.isSafeInteger(parsed)) {
      throw new InvalidConfigError(
        field,
        `expected integer in [${Number.MIN_SAFE_INTEGER}, ${Number.MAX_SAFE_INTEGER}], received ${REDACTED}`,
      );
    }
    return parsed;
  }
  throw new InvalidConfigError(field, `expected integer, received ${typeof value}`);
}

const VALID_SEVERITIES: ReadonlySet<Severity> = new Set<Severity>([
  "info",
  "minor",
  "major",
  "critical",
  "security",
  "leak",
]);

const SEVERITY_ALIASES: Readonly<Record<string, Severity | undefined>> = Object.freeze({
  low: "minor",
  medium: "major",
  high: "critical",
});

// Startup invariant: every alias target must be a canonical Severity in
// VALID_SEVERITIES. The TypeScript `Record<... , Severity | undefined>`
// signature catches invalid targets at compile time, but a future
// relaxation (e.g. widening the type during a refactor) would let bad
// aliases slip through. This assertion runs once at module load and
// throws if anyone introduces `"low": "banana"`-style drift. The
// pin-by-test in `test/unit/config-extended.test.ts:config:
// minimum-severity default + alias mapping` covers the live case; this
// is the compile-time-fallback for static analysis.
for (const [alias, target] of Object.entries(SEVERITY_ALIASES)) {
  if (target !== undefined && !VALID_SEVERITIES.has(target)) {
    throw new Error(
      `severity alias "${alias}" maps to non-canonical severity ${JSON.stringify(target)}`,
    );
  }
}

export function parseSeverityFromUnknown(value: unknown, field: string): Severity {
  if (typeof value !== "string") {
    throw new InvalidConfigError(field, `expected severity string, received ${typeof value}`);
  }
  const normalized = normalizeEnumInput(value);
  const alias = SEVERITY_ALIASES[normalized];
  if (alias !== undefined) return alias;
  if (!VALID_SEVERITIES.has(normalized as Severity)) {
    throw new InvalidConfigError(field, `unknown severity ${REDACTED}`);
  }
  return normalized as Severity;
}

// Derive the parser's accepted set from the canonical field-schema entry.
// Single source of truth: changing the canonical `enumValues` here updates
// both the parser and any future code-gen of the CLI help.
const VALID_PLATFORMS: ReadonlySet<string> = new Set<string>(
  FIELDS.platform.enumValues ?? [],
);

export function parsePlatformFromUnknown(value: unknown, field: string): Platform {
  if (typeof value !== "string") {
    throw new InvalidConfigError(field, `expected platform string, received ${typeof value}`);
  }
  const normalized = normalizeEnumInput(value);
  if (!VALID_PLATFORMS.has(normalized)) {
    throw new InvalidConfigError(field, `unknown platform ${REDACTED}`);
  }
  return normalized as Platform;
}

/**
 * Normalizes a provider base URL:
 * - trims whitespace
 * - requires http: or https:
 * - lowercases scheme and host
 * - strips query/fragment
 * - appends `/v1` if no version path segment is present
 *
 * Never includes the raw URL in error messages.
 */
export function normalizeApiUrl(rawUrl: unknown, field: string): string {
  if (typeof rawUrl !== "string") {
    throw new InvalidConfigError(field, `expected URL string, received ${typeof rawUrl}`);
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new InvalidConfigError(field, `expected non-empty URL`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidConfigError(field, `unparseable URL ${REDACTED}`);
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new InvalidConfigError(field, `unsupported URL scheme ${REDACTED}`);
  }
  const cleanedPath = normalizePath(parsed.pathname);
  const hasVersionSegment = hasVersionPathSegment(cleanedPath);
  const finalPath = hasVersionSegment ? cleanedPath : appendV1(cleanedPath);
  return `${protocol}//${parsed.host.toLowerCase()}${finalPath}`;
}

function normalizePath(pathname: string): string {
  return stripTrailingSlash(pathname);
}

function hasVersionPathSegment(path: string): boolean {
  if (path.length === 0) return false;
  const segments = path.split("/");
  for (const segment of segments) {
    if (/^v\d+$/.test(segment)) return true;
  }
  return false;
}

function appendV1(path: string): string {
  return path.length === 0 ? "/v1" : `${path}/v1`;
}