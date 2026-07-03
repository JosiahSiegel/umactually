import { FIELDS } from "./field-schema.js";

/** Canonical prompt-file byte cap shared by config loading and live prompt assembly. */
export const DEFAULT_PROMPT_BYTE_CAP = FIELDS.promptByteCap.defaultValue as number;

/** Canonical cap for posted review comments when no CLI/input override is supplied. */
export const DEFAULT_MAX_COMMENTS = FIELDS.maxComments.defaultValue as number;

/** Canonical merge fallback cap for chunked live reviews. */
export const DEFAULT_MAX_COMMENTS_MERGE = DEFAULT_MAX_COMMENTS;

/** Canonical changed-file soft cap for live reviews. */
export const DEFAULT_REVIEW_FILE_LIMIT = FIELDS.reviewFileLimit.defaultValue as number;
