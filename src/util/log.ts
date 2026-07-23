import { BRAND_PREFIX } from "./brand.js";

type AnnotationLevel = "debug" | "error" | "notice" | "warning";

/**
 * When `true`, suppress the GitHub-Actions-specific `::error::` /
 * `::warning::` / `::notice::` annotation prefixes and emit the
 * brand-prefixed message as a plain line. Test scenarios that
 * intentionally exercise error paths (e.g. the leak gate's
 * "Refusing to post" message) would otherwise surface as
 * `##[error]` workflow annotations in every PR CI log, which is
 * noise — the test EXPECTS the error and asserts on it via
 * `result.message`, but the workflow annotation makes the PR
 * look like it has a new failure on every run.
 *
 * Detection: explicit `UMACTUALLY_QUIET_ANNOTATIONS=1` env var
 * (set by vitest's setup file), OR `process.env.VITEST` is
 * defined (vitest sets this for every test file by default).
 */
function isQuietAnnotationMode(): boolean {
  if (process.env["UMACTUALLY_QUIET_ANNOTATIONS"] === "1") return true;
  if (typeof process.env["VITEST"] === "string" && process.env["VITEST"].length > 0) {
    return true;
  }
  return false;
}

/**
 * @returns A single line ending with exactly one newline character. Do not append another newline.
 */
function formatAnnotation(level: AnnotationLevel, action: string, message: string): string {
  const actionPrefix = action.length > 0 ? `${action} ` : "";
  if (isQuietAnnotationMode()) {
    // Plain brand-prefixed line — no `::error::` workflow annotation
    // prefix, so the line still appears in the test log but does NOT
    // surface as a GitHub Actions check annotation. The brand prefix
    // is kept so test assertions that grep for `umactually: ...` still
    // match.
    return `${BRAND_PREFIX}${actionPrefix}${message}\n`;
  }
  return `::${level}::${BRAND_PREFIX}${actionPrefix}${message}\n`;
}

function writeAnnotation(level: AnnotationLevel, action: string, message: string): void {
  const formatted = formatAnnotation(level, action, message);
  try {
    process.stderr.write(formatted);
  } catch {
    if (level !== "debug") {
      // Fallback path: re-format with the GitHub-Actions `::error::` /
      // `::warning::` / `::notice::` annotation prefix UNCONDITIONALLY
      // (i.e. bypassing the quiet-mode strip in formatAnnotation). This
      // is intentional:
      //
      //   - The quiet-mode strip exists so the *normal* stderr write
      //     doesn't surface as a `##[error]` workflow annotation in
      //     vitest. Vitest expects the error to be captured in the test
      //     runner's output, not surfaced as a CI check failure.
      //
      //   - The fallback path is reached ONLY when process.stderr.write
      //     THROWS — i.e. the normal stderr is already broken. In that
      //     case, the brand-prefixed line we'd normally write isn't
      //     going to reach the consumer anyway (stderr is broken); the
      //     fallback's purpose is to surface the error via console.error
      //     (which goes to stderr/stdout depending on the test runner
      //     setup). Including the `::error::` prefix in the fallback
      //     gives a consistent annotation shape if the test runner
      //     DOES pipe console.error to GitHub Actions (rare, but
      //     possible in custom harnesses).
      //
      //   - The contract test
      //     (test/unit/log.test.ts > "falls back to console.error when
      //     stderr write throws") asserts on the prefixed form. Quiet-
      //     mode-ifying the fallback would break this test.
      const actionPrefix = action.length > 0 ? `${action} ` : "";
      const fallback = `::${level}::${BRAND_PREFIX}${actionPrefix}${message}`;
      // eslint-disable-next-line no-console
      console.error(fallback);
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

/**
 * Write a raw `::warning::` / `::error::` annotation to stderr. Use this
 * ONLY for ad-hoc messages that don't fit the action-prefix template
 * (e.g. per-iteration failures with dynamic indices, HTTP-body-aware
 * diagnostics). Pass an empty `action` to suppress the action prefix;
 * the level token (`warning` / `error`) is always emitted.
 *
 * Replaces the 15+ hand-rolled `process.stderr.write(\`::warning::umactually: ...\`)`
 * calls scattered across `live-azure.ts`, `live-github.ts`,
 * `sonar/run-sonar-import.ts`, and `cli/sonar-context.ts`.
 */
export function writeBrandedAnnotation(
  level: "warning" | "error",
  message: string,
): void {
  process.stderr.write(`::${level}::${BRAND_PREFIX}${message}\n`);
}
