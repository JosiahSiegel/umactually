import { FIELDS } from "./field-schema.js";

/** Canonical prompt-file byte cap shared by config loading and live prompt assembly. */
export const DEFAULT_PROMPT_BYTE_CAP = FIELDS.promptByteCap.defaultValue as number;

/** Canonical cap for posted review comments when no CLI/input override is supplied. */
export const DEFAULT_MAX_COMMENTS = FIELDS.maxComments.defaultValue as number;

/** Canonical merge fallback cap for chunked live reviews. */
export const DEFAULT_MAX_COMMENTS_MERGE = DEFAULT_MAX_COMMENTS;

/** Canonical changed-file soft cap for live reviews. */
export const DEFAULT_REVIEW_FILE_LIMIT = FIELDS.reviewFileLimit.defaultValue as number;

/** Canonical wall-clock review timeout, in seconds; derived from field-schema so the loader cannot drift from the canonical default. */
export const DEFAULT_REVIEW_SECONDS = FIELDS.reviewTimeoutSeconds.defaultValue as number;

/** Canonical provider-output stall timeout, in seconds; derived from field-schema. */
export const DEFAULT_STALL_SECONDS = FIELDS.stallSeconds.defaultValue as number;

/** Canonical per-request HTTP timeout, in seconds; derived from field-schema. */
export const DEFAULT_PER_REQUEST_SECONDS = FIELDS.perRequestTimeoutSeconds.defaultValue as number;

/**
 * Canonical Sonar HTTP timeout, in seconds; derived from field-schema.
 *
 * Surfaced a real bug: `config/loader.ts` previously hard-coded `60` here
 * while the field-schema default (and therefore the CLI / action / env
 * surfaces) is `300`. Live SonarQube scans silently timed out at 60s
 * when no override was supplied. This re-export makes the loader default
 * byte-identical to the schema default.
 */
export const DEFAULT_SONAR_TIMEOUT_SECONDS = FIELDS.sonarTimeoutSeconds.defaultValue as number;

export const DEFAULT_PROVIDER_MODEL = FIELDS.model.defaultValue;
