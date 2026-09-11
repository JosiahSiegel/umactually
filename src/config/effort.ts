import { normalizeEnumInput } from "../util/normalize.js";

/** Recognized configuration vocabulary; providers decide which levels they support. */
export const EFFORT_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

/** Return a normalized recognized level, or undefined for invalid/absent input. */
export function parseEffort(value: unknown): Effort | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeEnumInput(value);
  return EFFORT_LEVELS.find((level) => level === normalized);
}
