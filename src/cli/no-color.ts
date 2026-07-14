// SPDX-License-Identifier: MIT

export type ColorPolicyOpts = {
  readonly noColor: boolean;
  readonly json: boolean;
  readonly env: NodeJS.ProcessEnv;
  readonly isTTY: boolean;
};

/**
 * Resolve whether decorative ANSI color should be enabled.
 *
 * GitHub annotation prefixes (`::notice::`, `::warning::`, and `::error::`)
 * are workflow commands, not decorative color, and are unaffected.
 */
export function resolveColorPolicy(opts: ColorPolicyOpts): boolean {
  if (opts.noColor || opts.json) {
    return false;
  }

  const noColorEnv = opts.env["NO_COLOR"];
  if (typeof noColorEnv === "string" && noColorEnv.length > 0) {
    return false;
  }

  return opts.isTTY;
}
