# S3 — Reference Compatibility Surface

This artifact summarizes the preserved compatibility behaviors documented in
`.reference/` (the round-1 oracle PR #944 lineage) and points to the files in
`src/` that implement each behavior in the current build.

## Behaviors

### 1. Inline quote escaping

- **Behavior**: `evidence_quote` is rendered as a markdown inline code span
  whose backtick fence length is strictly greater than the longest backtick
  run inside the value, so the span cannot terminate early regardless of
  input. Newlines collapse to spaces; trailing backticks are padded; length
  is capped.
- **Source reference**: `.reference/inline_quote_helpers.py`
- **Implementation**: `src/render/markdown.ts` (`wrapInlineCode`,
  `quoteMarkdownLines`, `longestBacktickRun`).

### 2. Raw JSON leak prevention

- **Behavior**: When the provider response is valid JSON that fails the strict
  shape check, the harness extracts `summary` and `verdict` fields via regex
  and renders a clean top-level body instead of dumping the raw JSON. If
  extraction fails, the body is truncated at the first fence closure so raw
  text cannot escape the fenced `<details>` block.
- **Source reference**: `.reference/test_raw_json_leak_fix.py`
- **Implementation**:
  - `src/render/raw-output.ts` (`renderRawReviewFallback`,
    `recoverFencedJsonReview`, `truncateAtFenceClosure`,
    `extractJsonStringField`).
  - `src/render/json-extract.ts` (`extractJsonBlock`,
    `extractJsonFenceBody`, `extractFirstBalancedObject`).

### 3. Provider fallback order (responses → chat)

- **Behavior**: Primary endpoint is `/v1/responses`. If the request fails with
  a fallback-eligible error, the runner retries the same request against
  `/v1/chat/completions` using the same model id. If the chat endpoint also
  fails, the failure is surfaced; transient failures retry once against the
  primary endpoint first.
- **Source reference**: `.reference/review.sh` and `.reference/action.yml`
- **Implementation**:
  - `src/provider/openai-compatible.ts` (`runProviderRequest`,
    `runWithEndpoint`, `shouldFallback`, `callEndpoint`,
    `ENDPOINT_RESPONSES`, `ENDPOINT_CHAT`).
  - `src/provider/provider-parse.ts` (`buildResponsesBody`,
    `buildChatBody`, `extractTextPayload`).
  - `src/provider/provider-error.ts` (`ProviderError`, `sanitizeHttpStatus`,
    `sanitizeMessage`).

### 4. Idempotency markers

- **Behavior**: Every posted review surface contains the marker
  `<!-- umactually-pr-review -->`. Re-running the action updates or
  de-duplicates the prior surface via this marker instead of stacking a new
  comment on every run.
- **Source reference**: `.reference/action.yml` (description field)
- **Implementation**:
  - `src/review/run-review.ts` (`REVIEW_MARKER` constant; `marker` field in
    `PostedGithubReview`).
  - `src/azure/run-azure-review.ts` (`REVIEW_MARKER` constant;
    `hasMatchingReviewThread` checks the marker on existing threads).
  - `src/review/compatibility.ts` (`CURRENT_MARKER`).
  - `src/render/raw-output.ts` (`marker` field in
    `RenderedRawReviewFallback`).
  - `src/reference/verify-reference-regressions.ts` (`CURRENT_MARKER`).
  - `src/cli/help.ts` (User-Agent string).
  - `src/platform/github/api.ts` and `src/platform/azure/api.ts`
    (User-Agent string).

### 5. Diff-position suppression

- **Behavior**: Comments whose `path`/`line` are not present in the PR diff
  are suppressed before posting, both for the GitHub and Azure surfaces. The
  suppressed count is preserved in the dry-run artifact. The diff position
  index is built from the parsed unified diff hunks.
- **Source reference**: `.reference/test_inline_quote_helpers.py` (test
  scaffolding for the harness that consumes the parsed provider payload).
- **Implementation**:
  - `src/diff/parse-positions.ts` (`parseDiffPositions`,
    `DiffPosition.hasPosition`).
  - `src/review/run-review.ts` (`countMatchingComments`,
    `countOffDiffComments`).
  - `src/azure/run-azure-review.ts` (`hasMatchingReviewThread` — also
    suppresses if the existing thread does not carry the marker).

## Notes

- `docs/reference-compatibility.md` does not currently exist; the canonical
  prose lives under `.reference/` and is mirrored by these `src/` modules.
- The `src/reference/verify-reference-regressions.ts` module exists as the
  CI hook that exercises these five surfaces against the canonical
  fixtures; its full path was preserved to keep the round-1 contract name
  stable for downstream callers.
