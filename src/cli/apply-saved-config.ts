// SPDX-License-Identifier: MIT
// Apply saved-config values to fields that fell through to their schema
// default after flag + env resolution. Single source of truth for the
// "saved config supplies defaults" behavior shared by `umactually review`
// and `umactually --files`.
//
// Resolution order (final, after this function runs):
//   - explicit CLI flag    → source = "flag"
//   - environment variable  → source = "env"
//   - saved config (~/.umactually/config.json) → source = "savedConfig"
//   - schema default        → source = "default"
//
// `apiKey` deliberately does NOT participate: the S6 contract (v0.6.23)
// bans persisting credentials to disk. The `SavedConfig` type excludes
// `apiKey`, so there is no value to read even if a caller passes one.
// `apiKey` resolves via flag > `UMACTUALLY_API_KEY` env > error.

import type {
  FieldProvenance,
  SchemaResolvedCliArgs,
} from "../config/field-resolution.js";
import type { SavedConfig } from "../config/saved-config.js";

const SAVED_CONFIG_FIELDS = ["provider", "apiUrl", "model"] as const;
type SavedConfigField = (typeof SAVED_CONFIG_FIELDS)[number];

type SavedConfigSource = {
  readonly source: "savedConfig";
  readonly path: string;
};

export type ApplySavedConfigResult = {
  readonly resolved: SchemaResolvedCliArgs;
  readonly applied: readonly SavedConfigField[];
};

/**
 * Pure resolver. Returns a NEW `SchemaResolvedCliArgs` with `provider` /
 * `apiUrl` / `model` overridden from `saved` when the current
 * `fieldProvenance[field].source === "default"`. Fields whose values
 * were already supplied by `--flag` or env var are left alone — flag
 * and env ALWAYS win over saved config (matches the contract for every
 * other well-behaved tool: flag > env > persisted > default).
 *
 * `saved === null` (no config file present, or read failed) is a
 * no-op; the resolver returns `resolved` unchanged with an empty
 * `applied` list.
 *
 * `path` is required when `saved !== null` (it tells the operator
 * which file supplied the value). The empty-string placeholder is
 * reserved for the `saved === null` fast path.
 */
export function applySavedConfig(
  resolved: SchemaResolvedCliArgs,
  saved: SavedConfig | null,
  path: string,
): ApplySavedConfigResult {
  if (saved === null) {
    return { resolved, applied: [] };
  }

  let current: SchemaResolvedCliArgs = resolved;
  const applied: SavedConfigField[] = [];

  if (saved.provider !== undefined) {
    const next = maybeOverride(current, "provider", saved.provider, path);
    if (next !== null) {
      current = next;
      applied.push("provider");
    }
  }

  // `apiUrl` and `model` are optional on SavedConfig. Skip when absent
  // — no override, no provenance flip.
  if (saved.apiUrl !== undefined) {
    const next = maybeOverride(current, "apiUrl", saved.apiUrl, path);
    if (next !== null) {
      current = next;
      applied.push("apiUrl");
    }
  }
  if (saved.model !== undefined) {
    const next = maybeOverride(current, "model", saved.model, path);
    if (next !== null) {
      current = next;
      applied.push("model");
    }
  }

  return { resolved: current, applied };
}

/**
 * Override a single field IFF its current provenance is "default".
 * Returns the new `SchemaResolvedCliArgs` on success, `null` when the
 * field should be left alone (already supplied by flag or env).
 *
 * Pure function over `current.fieldProvenance[field]` and the field's
 * current value. Does NOT mutate — returns a new object. The nested
 * `fieldProvenance` map is also shallow-cloned so subsequent
 * overrides to a different field don't accidentally leak the
 * earlier provenance update.
 */
function maybeOverride(
  current: SchemaResolvedCliArgs,
  field: SavedConfigField,
  value: string,
  path: string,
): SchemaResolvedCliArgs | null {
  const provenance: FieldProvenance | undefined = current.fieldProvenance[field];
  if (provenance === undefined) {
    // Field wasn't resolved by `resolveFromSchema`. This shouldn't
    // happen because we only pass through `provider` / `apiUrl` /
    // `model`, all of which are in `FIELDS`. Refuse to override
    // when the invariant is broken — preserves the byte-exact existing
    // behavior for edge cases.
    return null;
  }
  if (provenance.source !== "default") {
    // Flag or env already supplied a value. Saved config is the
    // strictly-LOWER priority layer and MUST NOT override.
    return null;
  }

  const newProvenance: SavedConfigSource = { source: "savedConfig", path };
  const newFieldProvenance: Record<string, FieldProvenance> = {
    ...current.fieldProvenance,
    [field]: newProvenance,
  };
  return {
    ...current,
    [field]: value,
    fieldProvenance: newFieldProvenance,
  } as SchemaResolvedCliArgs;
}
