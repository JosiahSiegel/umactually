# Changelog

All notable changes to UmActually are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For maintainers: see [docs/release-process.md](docs/release-process.md) for the
release workflow (how to bump the version, fill in a `[X.Y.Z]` section, and
ship a tag).

## [Unreleased]

### Added

- No new changes yet.

## [0.4.0] - 2026-07-15

### Added

- **Auto-rendered version tokens across all shipped docs (PR #62).** The version
  pin used to be hardcoded in nine places across `README.md`,
  `docs/configuration.md`, `docs/azure-devops.md`, `docs/gh-actions.md`,
  `examples/azure/azure-pipelines.yml`, and `examples/github/pr-review.yml`;
  every release required a manual sweep and they drifted in practice (the
  v0.3.0 release shipped with `v0.2.1` still hardcoded in 22 spots). The
  hardcodes are now template tokens `{{UMACTUALLY_VERSION}}` (tag form)
  and `{{UMACTUALLY_VERSION_DOT}}` (bare form), and the new
  `scripts/render-versions.mjs` walks `README.md`, `docs/**/*.md`, and
  `examples/**/*.{yml,yaml,md}` to rewrite them from a single source of
  truth: `package.json` `version`. The script refuses to leave any
  `{{UMACTUALLY_*}}` token unreplaced (typos fail with exit 2), is fully
  idempotent, supports `--check` and `--dry-run` modes, and accepts
  `--package-root <dir>` for sandboxed runs.
- **`scripts/check-version-alignment.mjs` is a new release gate (PR #62).** It
  calls `render-versions.mjs --check` and additionally greps every shipped
  doc for any historical `vX.Y.Z` literal that does not equal
  `v<package.json version>`. Failing this gate exits 1 with a diff that
  names the offending file and the exact stray pin.
- **Canonical release-process runbook (PR #63).** `docs/release-process.md`
  is the one-stop maintainer reference for cutting a release: TL;DR,
  pre-release checklist, cut-the-tag commands, post-tag workflow behavior,
  ADO sync, recovery (bad tag, ci-validate failure, hotfix), and an
  inline SemVer decision guide.
- **`scripts/release.sh` pre-flight helper (PR #63).** Bumps `package.json`
  `version`, inserts a `[X.Y.Z] - YYYY-MM-DD` placeholder under
  `[Unreleased]` in `CHANGELOG.md`, runs `npm run render-docs`, runs
  `bash scripts/ci-validate.sh`, and prints the exact next-step commands.
  Does NOT auto-commit, auto-merge, auto-tag, or auto-push.

### Changed

- **`scripts/ci-validate.sh` grew two new gates** (now six total, PR #62):
  `npm run render-docs` (re-renders tokens against the current
  `package.json` `version`) and `npm run check:version-alignment`
  (drift detector). Both run after `npm run bundle` and before
  `npm run check:dist-freshness`. `package.json` `prepublishOnly` was
  updated in lock-step so `npm publish` enforces the same gates locally.
- **`CONTRIBUTING.md`** documents the new release-process section, the
  token contract, the release PR checklist, and the post-tag push
  workflow. The "Pre-PR validation" section's "four gates" wording was
  updated to "six gates" to match the canonical pipeline (PR #62). The
  Release process section was further trimmed to delegate to
  `docs/release-process.md` as the canonical reference (PR #63).
- **README.md** Documentation index adds `[Release process]` link
  (PR #63).
- **CHANGELOG.md** top-level note points at `docs/release-process.md`
  for the maintainer release workflow (PR #63).

### Fixed

- The on-disk README still claimed `Latest release: v0.2.1` after
  v0.3.0 was tagged (and the npx install fragment was the same). The
  re-render brought every reference up to `v0.3.0` in the same
  commit that landed the rendering tool. Future releases can't
  drift the same way.
- **Drift detector URL false positive (PR #63).**
  `check-version-alignment.mjs` previously flagged the literal
  `v2.0.0` substring inside `https://semver.org/spec/v2.0.0.html` as
  historical project drift. The regex now uses boundary anchors that
  exclude URL path segments, file extensions, and scheme separators,
  so only standalone version literals are matched.

## [0.3.0] - 2026-07-15

### Added

- **CLI graceful recovery with structured remediation hints (PR #60)**:
  every CLI-side error now surfaces an actionable "what to do next"
  hint alongside the bare message. Three layers were threaded:

  1. Typed `hint` field on every CLI-reachable error class
     (`CliUsageError`, `RequiredConfigError`, `LiveReviewError`).
     Parse-time throws for unknown flags now include a Levenshtein-
     based `did you mean` suggestion; `--event` without a value,
     `--foo abc` when `--foo` needs an integer, and the legacy
     `--ignore-minor` all carry explicit hints naming the
     replacement flag, expected shape, or escape-hatch env var.
  2. `validate.ts` is now structured — every error is a
     `{ flag, message, hint }` record (was a flat string list). The
     validator's nine error messages all carry hints naming the
     missing flag, the env var, and the docs URL. The CLI render
     glue preserves the legacy `cli: <msg>` first-line shape so CI
     log scrapers grep'ing for `cli: --api-url is required` keep
     working; new `hint:` lines render underneath.
  3. `ensureHttpOk` (the funnel for every GitHub / Azure 4xx / 5xx)
     grows an optional remediation hint. All 7 call sites in
     `live-github.ts` (3) and `live-azure.ts` (4) pass a platform-
     specific hint naming the missing scope, the right token, the
     docs URL, or the exact `--flag` to re-run with. The
     orchestrator's generic dispatchLivePlatform catch narrows on
     `LiveReviewError` / `RequiredConfigError` / `AzureContextError`
     / `GithubContextError` and surfaces the hint on a second line
     next to the failure.

  Plus an interactive recovery mode: when validation fails ONLY
  because `--api-url` / `--api-key` is missing AND the process is
  attached to a TTY (NOT CI / piped stdin), the CLI asks for those
  values instead of failing. CI is never asked — `canPromptInteractively`
  gates the branch and a `UMACTUALLY_NO_INTERACTIVE` escape hatch
  lets operators force-off. `SmartPromptUnavailable` is a typed
  boundary (`NO_TTY` / `TIMEOUT` / `CLOSED_STDIN` / `READ_ERROR`)
  so the validate-glue renders a structured remediation when a
  prompt cannot be answered.

  Standalone-run now prints the no-diff reason next to the artifact
  path so the operator can see why the CLI wrote a stub without
  having to `cat` the JSON; the `provider-error` result carries a
  `hint` field so the standalone CLI's "exited 1, here is what
  happened" message carries the same remediation the live CI
  delivers.

### Fixed

- **Smart-prompt timeout race + listener-attachment race (PR #60 follow-up)**:
  the original smart-prompt timer called `stdin.destroy(error)` to
  abort the read, but Node's read-stream destroy-with-error only
  surfaces via the `error` event if a read is mid-flight — on a
  paused TTY it never fires, so the read promise hung until the
  operator pressed Enter (the typed `TIMEOUT` code was unreachable
  in practice). Replaced with `Promise.race([readOneLine, timeoutPromise])`,
  the canonical "Promise that should timeout" pattern. Also fixed
  a listener-attachment race in `readOneLine`: the original code
  registered `data` / `end` / `error` listeners AFTER calling
  `stream.resume()`, so a fast EOF (CI with a closed pipe) had
  the synchronous `end` event fire before listeners were bound,
  hanging the Promise forever. Listeners are now attached before
  `resume()`.

## [0.2.1] - 2026-07-15

### Fixed

- **CLI help rendered one character per line (PR #57)**: the contextual
  help feature in v0.2.0 was broken at the bundled-CLI layer. The
  spread `...renderFlags(flagsForContext("review"))` was spreading a
  joined string into an array literal, so each character of a flag line
  became its own array element and the outer `.join("\n")` emitted
  every character on its own line. Affected every per-command help:
  `umactually review --help`, `umactually doctor --help`, and
  `umactually check-review-artifact --help`. The bare
  `umactually --help` was unaffected because it uses a different code
  path (`HELP_FLAGS.map(renderFlagLine)`). Fixed by returning an array
  from `renderFlags` instead of a pre-joined string; added structural
  regression tests that pin each `--flag` to a single line.

## [0.2.0] - 2026-07-15

### Added

- **Contextual per-command CLI help (PR #55)**: `--help` now produces
  output scoped to the subcommand instead of always dumping the same
  40+ flag wall. `umactually review --help` shows review-specific usage
  and flags; `umactually doctor --help` shows the doctor checks list
  and exit codes; `umactually check-review-artifact --help` shows the
  artifact validation usage. The bare `umactually --help` retains the
  top-level Commands banner plus all review flags. Flags are tagged
  with `appliesTo` contexts so each help section shows only the flags
  relevant to that command.

- **Default repository prompt auto-discovery**: UmActually now
  auto-loads common agent-instruction files from the repository root
  when no explicit prompt override is supplied. The default-lookup
  list (in order) is `CLAUDE.md`, `AGENTS.md`,
  `.github/copilot-instructions.md`, `.cursorrules`, and `GEMINI.md`.
  Files that do not exist are silently skipped, so repos that lack
  any of these fall through cleanly to the existing built-in default
  system prompt. The lookup runs against the workflow
  `working-directory` and is subject to the existing path-safety
  refusals (absolute paths, `..` traversal, symlink escape).
- **`prompt-files` and `additional-prompt-files` inputs** (CLI flags
  `--prompt-files` / `--additional-prompt-files`; env vars
  `UMACTUALLY_PROMPT_FILES` / `UMACTUALLY_ADDITIONAL_PROMPT_FILES`):
  comma/newline-separated lists of repository-relative paths. When
  non-empty, the list **completely overrides** the default-lookup
  list and the legacy single-path `prompt-file` /
  `additional-prompt-file` input. Files are concatenated in the
  listed order with the existing `\n\n---\n\n` separator. Same
  cwd-confinement + byte-cap security as the legacy single-file
  reader. **Both inputs are wired through end-to-end on every
  supported surface**: GitHub Actions `with:` block, the
  `UMACTUALLY_PROMPT_FILES` / `UMACTUALLY_ADDITIONAL_PROMPT_FILES`
  pipeline variables in the root `azure-pipelines.yml` (and the
  `examples/azure/azure-pipelines.yml` example), and the bundled
  CLI's `--prompt-files` / `--additional-prompt-files` flags. The
  Azure DevOps pipeline conditionally forwards the env vars to the
  CLI so an unset value produces a clean argv (no empty
  `--prompt-files ""` flag). See
  [docs/azure-devops.md#forwarding-prompt-file-lists-overrides-the-default-lookup-list](docs/azure-devops.md#forwarding-prompt-file-lists-overrides-the-default-lookup-list).
- **CLI-first coverage for `strict-schema` and `verify-findings`**:
  both CLI flags are now exposed as GitHub Actions inputs
  (`strict-schema`, `verify-findings`; underscore-key synonyms
  `strict_schema`, `verify_findings` for runners that need them)
  and as Azure DevOps pipeline variables
  (`UMACTUALLY_STRICT_SCHEMA`, `UMACTUALLY_VERIFY_FINDINGS`). The
  action emits the negation form (`--no-strict-schema` /
  `--no-verify-findings`) when the workflow sets the input to
  `false`, and the positive form when set to `true` (matching
  the existing `--detect-leaks` / `--no-detect-leaks` pattern).
  The Azure DevOps pipeline conditionally forwards the env vars
  to the CLI. This closes the last two CLI flags that were
  previously action-invisible — the CLI is now the canonical
  surface for ALL functionality, and the action + ADO surfaces
  are thin pass-through wrappers. Pinned by
  `test/unit/cli-first-contract.test.ts`.

- **Native Anthropic Messages API provider (PR #31)**: third
  provider family alongside `openai-compatible` and `copilot`. Wire
  shape is the Anthropic Messages schema (`POST /v1/messages`,
  `x-api-key` + `anthropic-version: 2023-06-01`, top-level `system`,
  user-only `messages[]`, `max_tokens` instead of `max_output_tokens`).
  URL resolver follows the `@anthropic-ai/sdk` convention — preserves
  the operator's path prefix — so Anthropic-protocol gateways mounted
  under arbitrary prefixes route correctly. The `--provider anthropic`
  default base URL is `https://api.anthropic.com/v1`; `api-url` is
  optional for this provider (override for self-hosted Anthropic-protocol
  gateways like MiniMax).
- **URL-aware defaults in `parseFallbackModels` (PR #29)**: the
  `model: "auto"` resolver picks the right per-provider model from the
  hostname pattern. `gpt-5-mini` for `openai-compatible`, `claude-sonnet-4.6`
  for Anthropic endpoints, `claude-3-5-sonnet` for Copilot (4.6 is not
  Copilot-routable), `gemini-2.5-flash` for Google, `MiniMax-M3` for
  MiniMax. Per the Vectara HHEM 2026-05-11 leaderboard.
- **Cross-protocol auto-discovery on dual-protocol gateways (PR #32)**:
  the dispatcher transparently retries the OTHER provider family at the
  same `UMACTUALLY_API_URL` when the named provider returns a routing-level
  rejection (404). Documented use case: [MiniMax](https://platform.minimax.io/docs/token-plan/claude-code)
  serves both Anthropic-protocol (`/anthropic/v1/messages`) and
  OpenAI-protocol (`/v1/responses`) under the same hostname with the same
  API key. Operators no longer have to guess which protocol lives under
  which path prefix — `--provider` becomes advisory. Fallback is strictly
  bounded to 404 (payload 400 / parse / auth / network errors do NOT
  trigger fallback — those have a single root cause). See
  [`docs/providers.md`](docs/providers.md#cross-protocol-auto-discovery-the-dispatcher).
- **Path-prefix heuristic for `/anthropic` URLs (PR #34)**: the cross-
  protocol fallback in PR #32 only fires AFTER the named provider's URL
  candidate loop exhausts. On MiniMax-style dual-protocol gateways the
  openai-compatible loop successfully degrades `/anthropic` to
  origin+`/v1` (where MiniMax also serves OpenAI), so the dispatcher
  never reached the fallback and silently routed an
  `UMACTUALLY_API_URL=https://api.minimax.io/anthropic` to OpenAI at
  `/v1/responses` — wrong protocol. Fix: a new heuristic in the
  dispatcher checks whether any path segment in the operator's URL
  exactly equals `anthropic` (case-insensitive, byte-for-byte). When
  true, the dispatcher commits to the Anthropic Messages API client
  regardless of `--provider`, with a `::notice::` annotation for
  operator audit. Conservative by design — false negatives still fall
  through to cross-protocol fallback; false positives are bounded to
  exact-segment matches so `anthropic-v2` and `my-anthropic` do NOT
  trigger. See
  [`docs/providers.md`](docs/providers.md#path-prefix-heuristic-the-anthropic-url-commits-to-the-anthropic-protocol).
- **New `docs/providers.md`**: canonical end-to-end reference for the
  provider layer — per-family URL resolution rules, the
  Anthropic-protocol path-prefix preservation contract (with the
  `@anthropic-ai/sdk` / `anthropic-sdk-kotlin` references), the
  cross-protocol dispatcher decision tree, the dual-protocol gateway
  matrix (MiniMax, LiteLLM, Portkey patterns), and model
  auto-resolution per hostname. The page a fresh dev reads first when
  touching anything in `src/util/url.ts` or
  `src/cli/live-provider.ts`.

### Changed

- **Anthropic URL helper now preserves operator path prefixes
  (PR #32)**: the previous `resolveProviderBaseUrl(baseUrl, "/v1")`
  stripped the operator's path and always substituted `/v1`, which
  silently 404'd MiniMax-style Anthropic-protocol gateways under path
  prefixes. The new `resolveAnthropicMessagesUrl(baseUrl)` in
  `src/util/url.ts` appends `/v1/messages` per the official
  `@anthropic-ai/sdk` convention without stripping the operator's
  path. Query string and fragment are now stripped before appending
  (prevents `.../v1?token=abc/v1/messages`-style URL malformation).
- **`redactUrlForLog` helper (PR #32)**: strips query string and
  fragment from URLs before they enter `::notice::` action annotations
  (which persist in GitHub Actions run logs). Three log sites in
  `src/provider/openai-compatible.ts` and two in
  `src/cli/live-provider.ts` route through the helper. Pinned by
  `test/unit/redact-url-for-log.test.ts`. Operators who accidentally
  (or maliciously) type a URL with a `?token=` parameter no longer
  leak the token into the persisted CI annotation log.
- **LLM citation grounding (PR #26)**: layered defense against LLM
  path/line fabrication. Five layers, each closing a different
  failure mode observed in PR #56 (a 122-line source-only diff that
  produced 8 dist/-fabrication findings on the ADO policy review):
  1. **Diff filter** — `src/diff/filter-build-artifacts.ts` strips
     `dist/`, `build/`, `node_modules/`, lockfiles, `*.min.js`,
     `*.map`, etc. on BOTH the GitHub REST-diff path and the
     Azure REST-reconstruction path. Centralizes what was a
     shell-side `':!dist'` on Azure only.
  2. **System-prompt rewrite** — `src/cli/provider-prompts.ts` now
     documents the strict JSON schema, the diff path enum, the
     quote-first workflow (Anthropic pattern: copy the diff lines
     that justify a finding BEFORE emitting it), and the positive
     constraint (cite only what's in the Files-in-diff list).
  3. **Wire-format `response_format: json_schema`** — the strict
     schema is sent on the wire to providers that support it.
     `--strict-schema` (default ON) / `--no-strict-schema`.
  4. **Parse-warnings artifact** — every off-diff or off-line
     finding the model emitted is now recorded in
     `artifacts/manual/*.parse-warnings.json` (sibling to the
     main review artifact). Pinned by a regression test
     (`test/unit/parse-warnings.test.ts`) that locks the exact
     8-fabrication count from PR #56.
  5. **Model auto-resolver** — `model: "auto"` no longer passes
     through verbatim. Resolves to `gpt-5-mini` (OpenAI),
     `claude-sonnet-4.6` (Anthropic), `claude-3-5-sonnet`
     (Copilot — the 4.6 string is NOT Copilot-routable and
     would 404, so Copilot uses the 3.5 Sonnet line), or
     `gemini-2.5-flash` (Google) based on the active provider +
     `UMACTUALLY_API_URL`. Per the Vectara HHEM 2026-05-11
     leaderboard, these models have HHEM 5-11% vs the
     9-23% of gpt-4o/o3/o4-mini that the prior default fell back to.
  6. **Deterministic verify-findings filter** — defense-in-depth
     re-runs the (path, line) filter on the model's `comments[]`
     before posting. Default ON. `--verify-findings` /
     `--no-verify-findings`. Critically, the parse-warnings
     artifact is built from the PRE-verify review so it captures
     every fabrication event (the inline filter is a defense
     in depth, not a replacement for the artifact).
- New CLI flags: `--strict-schema`, `--no-strict-schema`,
  `--verify-findings`, `--no-verify-findings`. Both default to
  ON. Both are no-ops when the provider doesn't support
  `response_format: json_schema`.

### Removed

- **BREAKING**: `action.yml` `outputs:` block removed. The
  declaration named 7 outputs (`marker`, `marker_text`,
  `inline_thread_count`, `suppressed_comment_count`, `artifact_path`,
  `posted_thread_count`, `posted_status_state`) that the runtime
  never wrote (zero `core.setOutput` / `GITHUB_OUTPUT` /
  `::set-output` calls anywhere in `src/`). Any downstream consumer
  using `steps.<id>.outputs.<name>` was silently getting empty
  strings; the CI guard at `scripts/check-self-review-output.mjs`
  reads the on-disk JSON artifact directly instead. The `outputs:`
  block was removed so the action schema no longer advertises a
  contract it does not implement. Consumers that need structured
  review metadata should read the JSON artifact written to
  `artifacts/manual/` (path configurable via `--output-artifact`).
- **BREAKING**: `ignore-minor` input removed.
  The `ignore-minor` action input, CLI flag, and `UMACTUALLY_IGNORE_MINOR` /
  `REVIEW_IGNORE_MINOR` env vars have been removed. Use `minimum-severity`
  (`low|medium|high`, default `medium`) instead — it covers the same
  "suppress minor findings" use case with finer control. The previous
  guarantee that `security` and `leak` findings are never suppressed now
  lives inside `minimum-severity`'s semantics and applies regardless of
  the configured threshold.
  - CLI: `--ignore-minor` / `--no-ignore-minor` throw `CliUsageError`
    with a migration message — fail loudly is intentional so explicit
    CLI callers can't silently miss the change.
  - Env vars: silently ignored. CI users who still have
    `UMACTUALLY_IGNORE_MINOR` / `REVIEW_IGNORE_MINOR` set will see a
    one-time stderr warning on the next run pointing them at
    `minimum-severity`. The asymmetry with the CLI is deliberate: env
    vars are inherited invisibly and a hard throw on every run would
    brick pipelines that simply forgot to clean up.
  - Action users who were on the previous defaults
    (`ignore-minor: false`, `minimum-severity: low`) will lose
    `info` findings that were previously posted inline; that
    matches the new `minimum-severity: medium` default. Set
    `minimum-severity: low` explicitly to keep the old
    "show everything" behavior.
  - Pipelines that were passing `ignore-minor: true` need to recreate
    their previous filter combination on top of `minimum-severity`,
    NOT just rely on the new default. The two knobs were layered
    (`ignoreMinor` filtered info+low; `minimum-severity` filtered
    everything below the configured tier), so the equivalent new
    setting depends on what previous `minimum-severity` tier you
    were filtering at. Migration examples:
    - `ignore-minor: true` + previous `minimum-severity: low` (the
      old default) → `minimum-severity: medium` (the new default).
      The previous effective filter dropped info+low, and the new
      default does the same.
    - `ignore-minor: true` + previous `minimum-severity: medium`
      → `minimum-severity: medium` (the new default). No change
      needed.
    - `ignore-minor: true` + previous `minimum-severity: high`
      → `minimum-severity: high` (NOT the new default).
    - `ignore-minor: false` (the prior default) + previous
      `minimum-severity: low` (the prior default) → accept the
      new default of `medium` to filter style/hygiene, or set
      `minimum-severity: low` explicitly to keep all findings.
    - `ignore-minor: false` + previous `minimum-severity: high`
      → `minimum-severity: high` (no change needed).
- **BREAKING**: `minimum-severity` default flipped from `low` to `medium`.
  Out of the box, low-severity findings (style, hygiene) are filtered
  out of the postable set and do not appear as inline comments. Set
  `minimum-severity: low` explicitly to keep them.
- Severity-table layout headline now leads with the **posted comment
  count** (e.g. `📊 24 inline findings`) rather than the model's gross
  output. Off-diff findings are surfaced as a separate callout
  (`> 🔍 4 off-diff findings not posted inline — the model produced
  them but they target files not in this PR's diff.`) instead of
  appearing as a "28 findings → 24 posted" math breakdown. The
  manifest still carries `inlineCount` and `suppressedCount`
  separately for downstream consumers.

## [0.1.0] - 2026-06-27

### Added

- Initial release of the UmActually PR review action for GitHub Actions and Azure DevOps.
- Bundled CLI (`bin/umactually.mjs`) that delegates to `dist/cli.js` (built with `@vercel/ncc`).
- `UMACTUALLY_*` environment variable surface for `API_URL`, `API_KEY`, `MODEL`, `PROMPT_FILE`, `ADDITIONAL_PROMPT_FILE`, `REVIEW_TIMEOUT_SECONDS`, `STALL_SECONDS`, `MAX_OUTPUT_TOKENS`, `SONAR_HOST_URL`, `SONAR_TOKEN`, `SONAR_PROJECT_KEY`, `INCLUDE_SONARQUBE`, `IGNORE_MINOR`, `DETECT_LEAKS`, with `REVIEW_*` retained as a backward-compatible fallback.
- `--detect-leaks` / `--no-detect-leaks` and `--include-sonarqube` CLI flags driving the S5 redaction report and the S6 SonarQube mocked report.
- Live redaction scan in `runReview` and `runAzureReview` so secret leaks always block raw output before posting.
- `LICENSE` (MIT), `CHANGELOG.md`, `.nvmrc` (24), `examples/github/pr-review.yml`, and `examples/azure/azure-pipelines.yml`.
- CI smoke step that exercises the bundled CLI against the S1/S4 fixtures.
- `npm run bundle` and `npm run check:dist-freshness` scripts.

### Changed

- `src/index.ts` now wires every action input through to the CLI instead of always forcing `--dry-run`.
- `bin/umactually.mjs` no longer falls back to `src/cli.ts`; it errors with exit code 127 when `dist/cli.js` is missing.
- `docs/configuration.md` and `README.md` document the canonical `UMACTUALLY_*` secrets, the updated defaults (`max-output-tokens=16000`, `ignore-minor=false`), and the `--no-detect-leaks` flag.
- `src/reference/verify-reference-regressions.ts` performs real input checks against fixture contents rather than tautological self-contains.