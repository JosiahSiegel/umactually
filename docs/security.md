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

`prompt-file` (or `UMACTUALLY_PROMPT_FILE`) is loaded from disk and concatenated into the review request. The runtime refuses the following inputs:

- Absolute paths.
- Paths containing `..` segments.
- Symlinks that resolve outside the repository root.
- Paths outside the configured allowed directories.

Repository-relative paths only. The runtime resolves the file against the workflow `working-directory`, not against `process.cwd()` or `/tmp`. If you need additional prompt sources, extend the allow-list explicitly and add a regression test for each new path.

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

## Reporting issues

If you find a security issue in UmActually, open a private security advisory on the repository rather than a public issue. Include the input or fixture that triggered the issue, the version, and a minimal reproduction.