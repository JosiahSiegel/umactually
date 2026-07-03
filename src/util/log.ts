import { BRAND_PREFIX } from "./brand.js";

type AnnotationLevel = "debug" | "error" | "notice" | "warning";

/**
 * @returns A single line ending with exactly one newline character. Do not append another newline.
 */
function formatAnnotation(level: AnnotationLevel, action: string, message: string): string {
  const actionPrefix = action.length > 0 ? `${action} ` : "";
  return `::${level}::${BRAND_PREFIX}${actionPrefix}${message}\n`;
}

function writeAnnotation(level: AnnotationLevel, action: string, message: string): void {
  const formatted = formatAnnotation(level, action, message);
  try {
    process.stderr.write(formatted);
  } catch {
    if (level !== "debug") {
      // eslint-disable-next-line no-console
      console.error(formatted.trimEnd());
    }
  }
}

/**
 * Centralizes duplicated GitHub warning annotations so every warning uses the same brand prefix.
 * Pass an empty string `""` to suppress the action prefix.
 */
export function logWarning(action: string, message: string): void {
  writeAnnotation("warning", action, message);
}

/**
 * Centralizes duplicated GitHub error annotations so every error uses the same brand prefix.
 * Pass an empty string `""` to suppress the action prefix.
 */
export function logError(action: string, message: string): void {
  writeAnnotation("error", action, message);
}

/** Centralizes duplicated debug annotations so verbose diagnostics cannot drift from the branded format. */
export function logDebug(action: string, message: string): void {
  writeAnnotation("debug", action, message);
}

/** Centralizes duplicated notice annotations so informational diagnostics share one branded format. */
export function logNotice(action: string, message: string): void {
  writeAnnotation("notice", action, message);
}
