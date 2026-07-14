# Security model

UmActually is designed to operate on PR diffs that may include third-party contributions. This page documents the guarantees the runtime makes and the guardrails reviewers must follow when extending it.

## Redaction

The action redacts high-confidence secret patterns from PR diffs before they are submitted to the review provider and before any artifact is written. The patterns include:

- Stripe-style test keys: `\bsk_test_[a-z_]+\b`
- AWS access key IDs: `\b(?:AKIA|ASIA)[A-Z0-9]{16}\b`
- GitHub personal access tokens: `\bghp_[A-Za-z0-9]{36}\b`

Redaction is applied only to lines that begin with `+` and that are not the `+++` file header. Lines removed in the diff are ignored, so a secret that is being deleted does not get redacted from history that is already gone.

The literal replacement token used during redaction is `[REDACTED_SECRET]`. Anything left in the diff after redaction is the user's responsibility; expand the patterns only with a written justification and a regression test.

## Leak detection

After redaction, the action re-scans the diff and reports `highConfidenceLeakCount`. Raw output that contains any unreplaced high-confidence secret is blocked. A redaction report is written to `artifacts/manual/s5-redaction-report.json`.

If `highConfidenceLeakCount` is non-zero, treat the run as a security incident: the source PR introduced a credential into a diff. Page the security on-call, rotate the leaked credential, and confirm the PR is not merged.

## minimum-severity cannot hide leaks or security findings

`minimum-severity` (default `medium`) filters out findings below the configured tier. The threshold applies uniformly to every finding, with one carve-out: **`security` and `leak` findings ALWAYS survive any threshold.**

Concretely, the threshold behavior:

- `low` — surfaces everything except `info`.
- `medium` (default) — filters `info` and `low`.
- `high` — filters `info`, `low`, and `medium`.
- `critical` — filters everything below `critical`.

The carve-out is unconditional. `security` and `leak` findings bypass every configured threshold and cannot be turned off via `minimum-severity` or any other input — to suppress them you must remove them at the source (e.g. stop posting the credential, fix the underlying code).

**What the carve-out does NOT cover:** `high` and `critical` findings are filtered by `minimum-severity` like any other tier. Setting `minimum-severity: high` suppresses `critical` along with everything below it. Only `security` and `leak` are unconditionally preserved — nothing else is exempt from the threshold.

**Migration note for users coming from the old `ignore-minor` semantics:** the previous carve-out phrasing implied `high` and `critical` findings were also exempt in some configurations; that exemption is gone. With `minimum-severity: high`, both `high` and `critical` findings are filtered like any other tier — only `security` and `leak` are unconditionally preserved. If you relied on the old `high`/`critical` exemption, raise `minimum-severity` to `critical` (which keeps `critical` and `security`/`leak`) rather than `high`.

For noise control, think of the threshold as a quieter-to-louder knob:

- `minimum-severity: high` — quietest; only blocking findings surface inline.
- `minimum-severity: medium` — default; filters style/hygiene noise, keeps substantive findings.
- `minimum-severity: low` — highest-noise; surfaces everything except `info`.

If the default review output is too noisy, raise `minimum-severity` before reaching for model-side changes. Lowering it is the right move only when you specifically need style/hygiene findings inline.

## LLM citation hallucination defenses

LLMs occasionally cite files and line numbers that do not exist in the supplied diff (the canonical example: a model cites `dist/cli.js:42` from training priors even though the diff was source-only). UmActually layers five defenses so a fabrication cannot become a posted inline comment:

1. **Diff-side exclusion** — `dist/`, `build/`, `node_modules/`, `coverage/`, lockfiles, `*.min.js`, `*.map`, and similar are stripped from the diff before it reaches the model. Applied on BOTH the GitHub REST-diff path and the Azure REST-reconstruction path; the same patterns also run on the CLI's `--diff` reader.
2. **System-prompt path enum** — the user message lists every file the model is permitted to cite, paired with an explicit "quote the diff lines that justify the finding" workflow. The positive constraint (cite only what's in the list) is paired with a "do not cite off-list" constraint to avoid the "negative-instructions backfire" failure mode.
3. **Wire-format `response_format: json_schema`** — the strict schema is sent to providers that support it. `--strict-schema` (default ON) / `--no-strict-schema`.
4. **Deterministic verify-findings filter** — before posting, every comment is re-checked against the diff. Any (path, line) pair not in the diff is dropped. The same filter records what was dropped in the `parse-warnings.json` sibling artifact so operators can see fabrication events.
5. **Model auto-resolver** — `model: "auto"` resolves to the less-hallucinating model for the active provider (`gpt-5-mini` for OpenAI, `claude-sonnet-4.6` for Anthropic, `claude-3-5-sonnet` for Copilot — the 4.6 string is NOT Copilot-routable and would 404, so Copilot uses the 3.5 Sonnet line, or `gemini-2.5-flash` for Google, per Vectara HHEM 2026-05-11), not whatever the provider's "auto" picks.

The `parse-warnings.json` artifact is the authoritative record of fabrication events. If the file shows a non-zero `summary.invalidCount`, the review dropped at least one comment the model cited. The `summary.byReason` field splits the drop into `path-not-in-diff` and `line-not-in-diff` for triage.

## Prompt file path safety

`prompt-file` / `additional-prompt-file` (or `UMACTUALLY_PROMPT_FILE` / `UMACTUALLY_ADDITIONAL_PROMPT_FILE`) is loaded from disk and concatenated into the review request. The runtime refuses the following inputs:

- Absolute paths.
- Paths containing `..` segments.
- Symlinks that resolve outside the repository root.
- Paths outside the configured allowed directories.

Repository-relative paths only. The runtime resolves the file against the workflow `working-directory`, not against `process.cwd()` or `/tmp`. If you need additional prompt sources, extend the allow-list explicitly and add a regression test for each new path.

### Default repository prompt lookup

When **no** explicit `prompt-file` / `additional-prompt-file` AND no explicit `prompt-files` / `additional-prompt-files` list is supplied, UmActually auto-discovers common agent-instruction files from the repository root. The default-lookup list is:

1. `CLAUDE.md` (Anthropic Claude Code / Cowork repo-level instructions)
2. `AGENTS.md` (agent-agnostic convention; adopted by Cursor, aider, OpenAI Codex)
3. `.github/copilot-instructions.md` (GitHub Copilot Coding Agent instructions)
4. `.cursorrules` (Cursor legacy single-file rules)
5. `GEMINI.md` (Google Gemini CLI repo-level instructions)

Missing files are silently skipped — the action does not require any of these to exist. The lookup runs against the workflow `working-directory` (same cwd-resolved base as the explicit `prompt-file` reader), so every default-lookup path is subject to the same path-safety refusals above (absolute paths, `..`, symlink escape are all rejected).

The default-lookup list is **completely overridden** when `prompt-files` / `additional-prompt-files` is non-empty: the array is consulted and the defaults are not. To opt out of the default lookup entirely without supplying files, set `prompt-files: ""` is already the default — there is no "skip defaults" toggle. The legacy `prompt-file` / `additional-prompt-file` (single-path) inputs also override the defaults (they take precedence over the auto-discovered list).

If you need additional prompt sources beyond the documented list, extend the constants in `src/config/prompt-files.ts` (`DEFAULT_PROMPT_FILE_PATHS`) and add a regression test pinning the new path.

#### Default-lookup cache lifetime

The default-lookup resolution is memoized **per cwd** for the lifetime of the Node process. The cache is populated on the first `buildProviderPrompts` call (at most five synchronous `fs.stat` calls for the entries above) and reused on every subsequent call within the same run — including per-chunk reads in the chunked orchestrator.

This is safe under the action's documented deployment model: each `umactually` invocation (GitHub Actions, Azure DevOps, CLI) runs as a fresh Node process, so the cache effectively lives for one review run. A `CLAUDE.md` added to the repo mid-run will not appear until the next process restart.

If you need to force a re-stat mid-process (rare; the action does not currently support this from a non-test caller), the bundled CLI exposes the same package's internal `__resetDefaultPromptFilesCacheForTests` hook, but using it from production code is unsupported — a long-lived-process deployment that needs fresh filesystem state should restart the CLI per review instead.

## Secrets handling

Secrets must come from a secret store and reach the action through environment variables or platform-provided secrets. They must never be hard-coded in workflow YAML, action inputs, or step arguments.

UmActually does not intentionally log, echo, or print secrets. In particular:

- `core.setSecret` is applied to API keys before any logging statement runs.
- The CLI suppresses provider responses that echo back the request body.
- Artifact uploads never include the prompt file's raw contents when it contains a known secret pattern.

When investigating a leak, the first place to look is the workflow log for `printenv`, `Set-*` debug steps, or user-supplied `run:` blocks that print secrets. The action itself is not the source.

## Trust boundaries

The action treats the following inputs as untrusted:

- Pull request title, body, and comments.
- Diff lines.
- `prompt-file` contents (if the file path passes the path safety checks).
- Anything in the event JSON except the small allow-list (PR number, repository name, head SHA).
- The `api-url` string (and any query parameters it carries). The URL is opaque to the action and may come from a workflow input or environment variable.

The action treats the following inputs as trusted:

- Secrets passed through `env:`.
- The repository checkout used by the workflow.
- `GITHUB_TOKEN` (or `SYSTEM_ACCESSTOKEN` on Azure DevOps).

Never expose trusted inputs to untrusted strings. In particular, do not interpolate `secrets.*` into a script body that is later written to disk.

## CI log URL redaction

GitHub Actions annotations are persisted on the PR's action run and visible to anyone with `actions:read` on the repository. The action emits `::notice::` lines that include the operator's `UMACTUALLY_API_URL` so operators can audit which candidate URL the dispatcher is trying.

`redactUrlForLog(value: string): string` in `src/util/url.ts` is the single point where URLs cross into log output. It strips the query string (`?...`) and fragment (`#...`) from a URL, drops to bare `origin + path` form. Concrete transformations:

```text
https://api.example.com                              → https://api.example.com
https://api.example.com/v1/responses                 → https://api.example.com/v1/responses
https://gateway.example.com/session=abc              → https://gateway.example.com
https://gateway.example.com/oauth?token=secret-leak  → https://gateway.example.com/oauth
https://api.minimax.io/anthropic?session=abc123      → https://api.minimax.io/anthropic
```

The helper uses the WHATWG `URL` parser and falls back to substring-strip if the input is unparseable. It is wired into every `::notice::` URL log site:

- `src/provider/openai-compatible.ts` — `"Resolving provider base URL"`, `"Trying base URL"`, and `"Base URL ... returned routable failure"` notices (3 sites).
- `src/cli/live-provider.ts` — the `"Named provider ... returned status=... — retrying with cross-protocol fallback ..."` and the dual-protocol-failure notice in `runWithCrossProtocolFallback`.

Operators who accidentally (or maliciously) type a URL with a `?token=` session parameter do not leak that token into the action log on every retry. The wire-shape path (the `fetch` call) is unaffected — the API key STILL goes to the same URL over HTTPS, but the query token never reaches the persisted log.

## Cross-protocol dispatcher security notes

The cross-protocol fallback in `src/cli/live-provider.ts:runWithCrossProtocolFallback` posts the operator's `UMACTUALLY_API_KEY` to BOTH the named provider and the fallback provider at the same `UMACTUALLY_API_URL` when the named protocol returns 404. This is correct on documented dual-protocol gateways (MiniMax accepts the same key for both protocols). The fallbacks that are NOT correct are bounded by the 404-only trigger:

- **404** is treated as a routing-level rejection → fallback fires. The operator has likely typed a URL whose protocol-prefix they got wrong (e.g. `provider=openai-compatible` against `/anthropic`).
- **400** is NOT a routing failure → fallback does NOT fire. Payload-level 400s (e.g. unsupported `max_tokens` value, content-policy rejection) would be silently masked if we switched protocols on 400 — the operator would see a successful review attributed to the OTHER protocol and never know their original call was wire-shape-malformed.
- **401/403/429/5xx/network/parse** → fallback does NOT fire. Single root cause; another protocol won't help.

Operators pointing `--provider anthropic` or `--provider openai-compatible` at non-dual-protocol URLs (a hostname that serves only one protocol) get a wasted secondary request at most. The `::notice::` annotation surfaces this so they can pick the right `--provider` on the next run. The fallback is bounded to a single retry, so even on non-dual-protocol URLs the wasted request cost is one extra HTTP call (~10–30s for Anthropic, ~5–15s for OpenAI).

`api-url` is treated as untrusted above — see [`docs/providers.md`](providers.md#cross-protocol-auto-discovery-the-dispatcher) for the full decision tree.

## Least-privilege GitHub permissions

The action requires `contents: read` and `pull-requests: write`. Grant exactly those scopes:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Do not use `pull_request_target` for this action; it is not required to comment on a PR and it can expose secrets to untrusted PR code.

## Secret scanning in CI (GitGuardian)

The UmActually repository uses [GitGuardian's GitHub App](https://dashboard.gitguardian.com) to scan every PR for committed secrets. The detector is the industry-standard high-recall scanner — any long random-looking string assigned to a variable named `apiKey`, `token`, `secret`, etc. triggers an incident. This is the right posture for production code and surfaces the kind of accidental credential commit that would otherwise ship to a public mirror.

### Why some scanner findings are false positives

UmActually's test suite deliberately uses synthetic API keys to exercise the cross-protocol dispatcher, the Anthropic Messages API, and the provider-failure paths. Every synthetic key carries the literal `do-not-leak` sentinel as a suffix — for example `sk-anthropic-v2-do-not-leak`, `sk-test-openai-do-not-leak`, `sk-minimax-smoke-test-do-not-leak`. The `do-not-leak` suffix is a tripwire: a maintainer who copies a fixture into a real config file and forgets to swap it will find this section via `rg do-not-leak src/`, and the next reviewer will catch it in code review.

Convention enforced across 10+ test files in `test/unit/`:

- `live-provider-cross-protocol-dispatch.test.ts`
- `live-provider-anthropic-dispatch.test.ts`
- `anthropic-messages.test.ts`
- `live-shared-body.test.ts`
- `live-shared-prepare-posted-review.test.ts`
- `live-azure-parent-clarity.test.ts`
- `provider.test.ts`
- `provider-retry.test.ts`
- `redact-url-for-log.test.ts`
- `verdict-reconciliation.test.ts`

If you add a new test fixture that looks like an API key, append the `do-not-leak` suffix. A grep for `do-not-leak` should match every synthetic key in the repo.

### Per-repo configuration (`.gitguardian.yaml`)

The repository carries a `.gitguardian.yaml` at the root that scopes the scanner to the surfaces that matter:

- **`secret.ignored_paths`** excludes `test/**`, `tests/**`, `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`, `**/fixtures/**`, `**/__snapshots__/**`, `dist/**`, `build/**`, `coverage/**`, `artifacts/**`, `docs/**`, `**/*.md`, `**/*.rst`, `LICENSE`, `CHANGELOG*`, and editor scratch. These are the paths where the `do-not-leak` fixtures and the per-run redaction-report / cassette artifacts live.
- **`secret.ignored_matches`** pre-registers the 9 historical `sk-*-do-not-leak` fixture values from the cross-protocol-dispatch test file so the corresponding dashboard incidents auto-resolve on the next scan.
- **The `Generic High Entropy Secret` detector is NOT globally disabled** — `src/**` and `bin/**` stay fully scanned. Production code is the surface that needs the most aggressive scanning; weakening it for test convenience would defeat the purpose of the gate.

The full file is 144 lines and lives at `.gitguardian.yaml` in the repo root. Schema reference: <https://docs.gitguardian.com/ggshield-docs/configuration>.

### Resolving a false-positive incident in the dashboard

The `.gitguardian.yaml` config governs **future** scans. Pre-existing incidents in the GitGuardian workspace must be resolved manually — the config does not retroactively close them. When the scanner reports a `Generic High Entropy Secret` incident on a `do-not-leak` test fixture:

1. Open the incident at the URL printed in the PR check annotation (format: `https://dashboard.gitguardian.com/workspace/<id>/incidents/<incident_id>?occurrence=<occurrence_id>`).
2. Click **Ignore** and choose the reason **False positive**.
3. Add a comment citing this section so the audit trail is self-explanatory: `Synthetic test fixture per the do-not-leak sentinel convention; see docs/security.md#secret-scanning-in-ci-gitguardian.`

To script the resolution via the GitGuardian API instead:

```bash
curl -X POST "https://api.gitguardian.com/v1/incidents/secrets/<incident_id>/ignore" \
  -H "Authorization: Token $GITGUARDIAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ignore_reason": "false_positive_test"}'
```

`GITGUARDIAN_API_KEY` is the workspace API token from **GitGuardian dashboard → Settings → API**. Store it in your platform secret store — never commit it. The valid `ignore_reason` values are `false_positive_test`, `false_positive`, `test_credential`, `low_risk`, or `low_severity`. For `do-not-leak` fixtures, `false_positive_test` is the right choice (the value is a documented test sentinel, not a real credential).

### When the scanner finds a REAL secret

If GitGuardian reports a finding that is NOT a `do-not-leak` fixture in `test/`:

1. **Do not merge the PR.** Treat the report as a security incident.
2. Rotate the leaked credential at the issuing platform (GitHub PAT settings, Azure DevOps PAT settings, the provider's API-key console, etc.).
3. Rewrite git history to remove the secret (`git filter-repo` or BFG). The UmActually repo's CONTRIBUTING guide links to GitGuardian's history-rewriting cheatsheet.
4. Add the rotated value to your platform's secret store and reference it via `${{ secrets.* }}` (GitHub) or the variable group's secret variable (Azure DevOps).
5. Mark the incident **Resolved** in the GitGuardian dashboard with `secret_revoked: true`.

The scanner is configured to fail CI on any open incident at the `Triggered` status. A real secret will block the merge until the credential is rotated and the history is rewritten — by design.

## Reporting issues

If you find a security issue in UmActually, open a private security advisory on the repository rather than a public issue. Include the input or fixture that triggered the issue, the version, and a minimal reproduction.