import { REDACTED_SECRET_TOKEN } from "./brand.js";

/**
 * Replace each literal secret in `value` with the canonical REDACTED_SECRET_TOKEN.
 * Uses split().join() (not regex) so secrets containing regex metacharacters
 * (.+*?()[]{}\|^$) replace literally without surprises. Empty secrets are
 * skipped to avoid "replace every empty string" which would clobber the value.
 * Returns `value` unchanged when `secrets` is empty (cheap fast path).
 *
 * Behavior contract pinned by test/unit/redact-secrets.test.ts:
 *   - Empty secrets → returns value unchanged (identity).
 *   - Single secret: every occurrence of the literal string is replaced.
 *   - Multiple secrets: replaced in array order (earlier wins on overlap).
 *   - Secrets containing regex metacharacters are treated literally.
 *   - Empty string in secrets array is skipped (no clobber).
 */
export function replaceSecretsLiterally(value: string, secrets: readonly string[]): string {
  if (secrets.length === 0) return value;
  let out = value;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    out = out.split(secret).join(REDACTED_SECRET_TOKEN);
  }
  return out;
}
