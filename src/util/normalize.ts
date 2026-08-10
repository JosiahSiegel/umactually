/**
 * Normalize raw user input for case-insensitive enum lookups.
 * Leaf module — zero imports.
 */
export function normalizeEnumInput(raw: string): string {
  return raw.trim().toLowerCase();
}
