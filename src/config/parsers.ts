import type { Severity, Platform } from "./types.js";
import { InvalidConfigError, REDACTED } from "./errors.js";

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
    const normalized = value.trim().toLowerCase();
    if (TRUTHY_STRINGS.has(normalized)) return true;
    if (FALSY_STRINGS.has(normalized)) return false;
    throw new InvalidConfigError(field, `expected boolean string, received ${REDACTED}`);
  }
  throw new InvalidConfigError(field, `expected boolean, received ${typeof value}`);
}

const INTEGER_RE = /^-?\d+$/;

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
    if (!INTEGER_RE.test(trimmed)) {
      throw new InvalidConfigError(field, `expected integer string, received ${REDACTED}`);
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      throw new InvalidConfigError(field, `expected finite integer, received ${REDACTED}`);
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

export function parseSeverityFromUnknown(value: unknown, field: string): Severity {
  if (typeof value !== "string") {
    throw new InvalidConfigError(field, `expected severity string, received ${typeof value}`);
  }
  const normalized = value.trim().toLowerCase();
  if (!VALID_SEVERITIES.has(normalized as Severity)) {
    throw new InvalidConfigError(field, `unknown severity ${REDACTED}`);
  }
  return normalized as Severity;
}

const VALID_PLATFORMS: ReadonlySet<Platform> = new Set<Platform>(["auto", "github", "azure"]);

export function parsePlatformFromUnknown(value: unknown, field: string): Platform {
  if (typeof value !== "string") {
    throw new InvalidConfigError(field, `expected platform string, received ${typeof value}`);
  }
  const normalized = value.trim().toLowerCase();
  if (!VALID_PLATFORMS.has(normalized as Platform)) {
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
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed;
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