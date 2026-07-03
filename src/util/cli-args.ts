/** Push optional CLI flag values consistently; eliminates duplicated non-empty string guards in CLI builders. */
export function pushFlagValue(args: string[], flag: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    args.push(flag, value);
  }
}

/** Push numeric CLI flag values consistently; eliminates repeated number-to-string flag handling. */
export function pushNumber(args: string[], flag: string, value: number): void {
  args.push(flag, String(value));
}

/** Push boolean CLI flags consistently; eliminates duplicated conditional flag append logic. */
export function pushBool(args: string[], condition: boolean, flag: string): void {
  if (condition) {
    args.push(flag);
  }
}

/** Resolve env aliases consistently; eliminates duplicated first-non-empty fallback loops. */
export function envFallback(...values: ReadonlyArray<string | undefined>): string {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return "";
}

/**
 * Validate a CLI enum value against an accepted set, returning the value
 * when it matches and throwing `Error` on miss. Replaces the four
 * hand-coded enum parsers (`readPlatform`, `readEffort`, `readProvider`,
 * `readMinimumSeverity`) in `parse-args.ts` so the CLI accepts the
 * exact same set as `FIELDS.<x>.enumValues` in `field-schema.ts`.
 * Single source of truth — changing the canonical `enumValues` array
 * updates both surfaces.
 *
 * The accepted set is typed `readonly T[]` so the literal union narrows
 * naturally without an explicit cast: `readEnum<CliPlatform>("--platform",
 * v, FIELDS.platform.enumValues as readonly CliPlatform[])`.
 */
export function readEnum<T extends string>(
  flag: string,
  value: string,
  accepted: readonly T[],
): T {
  for (const candidate of accepted) {
    if (candidate === value) {
      return candidate;
    }
  }
  throw new Error(`invalid ${flag} value: ${value} (accepted: ${accepted.join(", ")})`);
}
