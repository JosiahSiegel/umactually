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
