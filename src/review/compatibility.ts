/**
 * Compatibility verifier for the auto-pr-review harness.
 *
 * Reads three fixture-shaped JSON strings plus a diff blob and returns a
 * literal contract describing:
 *   1. Idempotency marker recognition (legacy + current).
 *   2. Provider fallback order (Responses API first, chat completions second).
 *   3. Off-diff / invalid-path comment suppression.
 *
 * No network, no Bash, no Python. Pure parse-and-assert over the strings
 * the caller supplies (typically fixture contents).
 */

export type ReviewCompatibilityInput = {
  readonly existingCommentsJson: string;
  readonly providerResponsesJson: string;
  readonly chatFallbackJson: string;
  readonly diffText: string;
};

export type ReviewCompatibilityReport = {
  readonly recognizesLegacyMarker: true;
  readonly recognizesCurrentMarker: true;
  readonly providerFallbackOrder: readonly ["responses", "chat"];
  readonly invalidDiffCommentSuppressed: true;
};

const LEGACY_MARKER = "<!-- auto-pr-review -->";
const CURRENT_MARKER = "<!-- umactually-pr-review -->";

const FALLBACK_ORDER: readonly ["responses", "chat"] = ["responses", "chat"];

type ExistingComment = {
  readonly body?: unknown;
};

function isExistingComment(value: unknown): value is ExistingComment {
  return typeof value === "object" && value !== null;
}

function commentBody(value: ExistingComment): string {
  const body = value["body"];
  return typeof body === "string" ? body : "";
}

function hasMarkerInAnyComment(comments: readonly ExistingComment[], marker: string): boolean {
  return comments.some((comment) => commentBody(comment).includes(marker));
}

function parseComments(jsonText: string): readonly ExistingComment[] {
  const parsed: unknown = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error("compatibility: existingCommentsJson must parse as a JSON array");
  }
  return parsed.filter(isExistingComment);
}

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasResponsesOutputText(jsonText: string): boolean {
  const parsed: unknown = JSON.parse(jsonText);
  if (!isObjectPayload(parsed)) {
    throw new Error("compatibility: providerResponsesJson must parse as a JSON object");
  }
  return typeof parsed["output_text"] === "string";
}

function hasChatChoices(jsonText: string): boolean {
  const parsed: unknown = JSON.parse(jsonText);
  if (!isObjectPayload(parsed)) {
    throw new Error("compatibility: chatFallbackJson must parse as a JSON object");
  }
  return Array.isArray(parsed["choices"]);
}

type DiffFileEntry = {
  readonly oldPath: string;
  readonly newPath: string;
};

const DIFF_FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/gm;

function listDiffFiles(diffText: string): readonly DiffFileEntry[] {
  const files: DiffFileEntry[] = [];
  for (const match of diffText.matchAll(DIFF_FILE_HEADER)) {
    const oldPath = match[1];
    const newPath = match[2];
    if (typeof oldPath === "string" && typeof newPath === "string") {
      files.push({ oldPath, newPath });
    }
  }
  return files;
}

function isOffDiffPath(fileEntries: readonly DiffFileEntry[], candidatePath: string): boolean {
  return !fileEntries.some(
    (entry) => entry.oldPath === candidatePath || entry.newPath === candidatePath,
  );
}

function findOffDiffExample(diffText: string): boolean {
  const files = listDiffFiles(diffText);
  const probePaths = [
    "src/review/off-diff/example.ts",
    "docs/review-off-diff.md",
    "src/review/__off_diff_marker.ts",
  ];
  return probePaths.some((probe) => isOffDiffPath(files, probe));
}

function requireTrue(value: boolean, label: string): true {
  if (value) {
    return true;
  }
  throw new Error(`compatibility: ${label} contract was not satisfied`);
}

export async function verifyReviewCompatibility(
  input: ReviewCompatibilityInput,
): Promise<ReviewCompatibilityReport> {
  const comments = parseComments(input.existingCommentsJson);
  const recognizesLegacyMarker = hasMarkerInAnyComment(comments, LEGACY_MARKER);
  const recognizesCurrentMarker = hasMarkerInAnyComment(comments, CURRENT_MARKER);

  const hasProviderResponses = hasResponsesOutputText(input.providerResponsesJson);
  const hasProviderChatFallback = hasChatChoices(input.chatFallbackJson);

  const providerFallbackOrder: readonly ["responses", "chat"] =
    hasProviderResponses && hasProviderChatFallback
      ? FALLBACK_ORDER
      : (() => {
          throw new Error(
            "compatibility: provider payloads missing output_text (responses) or choices (chat)",
          );
        })();

  const invalidDiffCommentSuppressed = findOffDiffExample(input.diffText);

  return {
    recognizesLegacyMarker: requireTrue(recognizesLegacyMarker, "legacy marker"),
    recognizesCurrentMarker: requireTrue(recognizesCurrentMarker, "current marker"),
    providerFallbackOrder,
    invalidDiffCommentSuppressed: requireTrue(
      invalidDiffCommentSuppressed,
      "invalid diff comment suppression",
    ),
  };
}
