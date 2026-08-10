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

## `minimum-severity` cannot hide leaks or security findings

`minimum-severity` (default `medium`) filters out findings below the configured tier. The threshold applies uniformly to every finding, with one carve-out: **`security` and `leak` findings ALWAYS survive any threshold.**

Concretely:

- `low` — surfaces everything except `info`.
- `medium` (default) — filters `info` and `low`.
- `high` — filters `info`, `low`, and `medium`.

The carve-out is unconditional. `security` and `leak` findings bypass every configured threshold and cannot be turned off via `minimum-severity` or any other input — to suppress them you must remove them at the source (e.g. stop posting the credential, fix the underlying code).

`high` and `critical` findings are filtered by `minimum-severity` like any other tier. Setting `minimum-severity: high` suppresses `critical` along with everything below it. Only `security` and `leak` are unconditionally preserved — nothing else is exempt from the threshold.

If the default review output is too noisy, raise `minimum-severity` before reaching for model-side changes. Lowering it is the right move only when you specifically need style/hygiene findings inline.

## LLM citation hallucination defenses

LLMs occasionally cite files and line numbers that do not exist in the supplied diff (the canonical example: a model cites `dist/cli.js:42` from training priors even though the diff was source-only). UmActually layers five defenses so a fabrication cannot become a posted inline comment:

1. **Diff-side exclusion** — `dist/`, `build/`, `out/`, `target/`, `_build/`, `.next/`, `.nuxt/`, `.output/`, `.nyc_output/`, `vendor/`, `node_modules/`, `coverage/`, `**/*.min.js`, `**/*.min.css`, `**/*.bundle.js`, `**/*.bundle.css`, `**/*.chunk.js`, `**/*.map`, `**/*.tsbuildinfo`, and lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `Gemfile.lock`, `Cargo.lock`, `poetry.lock`, `composer.lock`) are stripped from the diff before it reaches the model. The patterns live in `src/diff/filter-build-artifacts.ts:DEFAULT_BUILD_ARTIFACT_PATTERNS`. Applied on the GitHub REST-diff path, the Azure REST-reconstruction path, the local `git diff` path (defense-in-depth), and the CLI's `--diff` reader.
2. **System-prompt path enum** — the user message lists every file the model is permitted to cite, paired with an explicit "quote the diff lines that justify the finding" workflow. The positive constraint (cite only what's in the list) is paired with a "do not cite off-list" constraint to avoid the "negative-instructions backfire" failure mode.
3. **Wire-format `response_format: json_schema`** — the strict schema is sent to providers that support it. `--strict-schema` (default ON) / `--no-strict-schema`.
4. **Deterministic verify-findings filter** — before posting, every comment is re-checked against the diff. Any (path, line) pair not in the diff is dropped. The same filter records what was dropped in `parse-warnings.json` so operators can see fabrication events.
5. **Explicit model recommended** — the runtime uses the operator-supplied `model` (flag / env / saved config) verbatim. Discovery per provider happens only when `model` is omitted — see [`docs/providers.md`](providers.md#model-resolution). Set `model: <string>` explicitly to bypass discovery and pin a known model.

The `parse-warnings.json` artifact is the authoritative record of fabrication events. If the file shows a non-zero `summary.invalidCount`, the review dropped at least one comment the model cited. The `summary.byReason` field splits the drop into `path-not-in-diff` and `line-not-in-diff` for triage.

## Prompt file path safety

`prompt-file` / `additional-prompt-file` (or `UMACTUALLY_PROMPT_FILE` / `UMACTUALLY_ADDITIONAL_PROMPT_FILE`) is loaded from disk and concatenated into the review request. The runtime refuses:

- Absolute paths.
- Paths containing `..` segments.
- Symlinks that resolve outside the repository root.
- Paths outside the configured allowed directories.

Repository-relative paths only. The runtime resolves the file against the workflow `working-directory`, not against `process.cwd()` or `/tmp`. To extend the allow-list, add a regression test for each new path.

### Default repository prompt lookup

When **no** explicit `prompt-file` / `additional-prompt-file` AND no explicit `prompt-files` / `additional-prompt-files` list is supplied, UmActually auto-discovers common agent-instruction files from the repository root:

1. `CLAUDE.md` (Anthropic Claude Code / Cowork)
2. `AGENTS.md` (agent-agnostic; Cursor, aider, OpenAI Codex)
3. `.github/copilot-inructions.md` (GitHub Copilot Coding Agent)
4. `.cursorrules` (Cursor single-file rules)
5. `GEMINI.md` (Google Gemini CLI)

Missing files are silently skipped. Default-lookup entries share the same path-safety refusals as explicit paths (absolute, `..`, symlink escape rejected).

A non-empty `prompt-files` / `additional-prompt-files` list **completely overrides** the default lookup. The legacy single-path `prompt-file` inputs also override. To opt out without naming your own files, set `prompt-files: ""` and supply a single `prompt-file:` (or set `UMACTUALLY_PROMPT_FILE` to a single path); the explicit single-path override still wins over the defaults.

To add new entries to the default-lookup list, extend the constants in `src/config/prompt-files.ts` (`DEFAULT_PROMPT_FILE_PATHS`) and add a regression test pinning the new path.

#### Default-lookup cache lifetime

The default-lookup resolution is memoized **per cwd** for the lifetime of the Node process. The cache is populated on the first `buildProviderPrompts` call (at most five synchronous `fs.stat` calls) and reused on every subsequent call within the same run.

This is safe under the action's deployment model: each `umactually` invocation runs as a fresh Node process, so the cache effectively lives for one review run. A `CLAUDE.md` added to the repo mid-run will not appear until the next process restart.

The bundled CLI exposes a `__resetDefaultPromptFilesCacheForTests` hook for tests. Using it from production code is unsupported — long-lived-process deployments should restart the CLI per review.

## Secrets handling

Secrets must come from a secret store and reach the action through environment variables or platform-provided secrets. They must never be hard-coded in workflow YAML, action inputs, or step arguments.

UmActually does not intentionally log, echo, or print secrets:

- `core.setSecret` is applied to API keys before any logging statement runs.
- The CLI suppresses provider responses that echo back the request body.
- Artifact uploads never include the prompt file's raw contents when it contains a known secret pattern.

When investigating a leak, the first place to look is the workflow log for `printenv`, `Set-*` debug steps, or user-supplied `run:` blocks that print secrets. The action itself is not the source.

### npm publishing authentication (Trusted Publishing / OIDC)

The `publish-npm` job in `.github/workflows/release.yml` authenticates to npmjs.org via **Trusted Publishing (OIDC)** — the GitHub Actions OIDC token (from `id-token: write` permission) is exchanged at publish time for a short-lived registry session token. **There is no `NPM_TOKEN` repo secret**, no Granular Token, no `--otp=<code>` step.

Why the move: npm deprecated classic tokens in 2022 and deprecated TOTP authenticator apps in 2025. Granular Tokens with `bypass_2fa: true` are now restricted for direct publishing (https://gh.io/npm-gat-bypass2fa-deprecation). Trusted Publishing is the official replacement — see https://docs.npmjs.com/trusted-publishers.

**Properties of the OIDC path that NPM_TOKEN never had:**

- **No long-lived secret to leak.** The OIDC token is minted at workflow run time, exchanged for a session token, and discarded. There is nothing in repo secrets to leak via log exposure, fork-PR exfiltration, or secret-scanner false positives.
- **No 90-day rotation clock.** There is no expiry because there is no token. The Trusted Publisher binding on npmjs.com is a one-time dashboard click and never expires.
- **No "revoke and rotate" runbook.** A suspected leak of an NPM_TOKEN requires (a) revoking the token at npm → Access Tokens, (b) minting a new Granular Token, (c) pasting it into the GitHub repo secret, (d) re-running the workflow. With OIDC, none of those steps exist; the binding itself cannot be exfiltrated because it lives on the npmjs.com dashboard and is keyed to a specific workflow file.
- **Cryptographically pinned to the workflow file.** A Trusted Publisher binding names the workflow filename (`release.yml`) explicitly. A forked repo running a modified `release.yml` cannot exchange an OIDC token for a publish session — the registry rejects it.

**Configuration state (one-time, already complete on this repo):**

- npmjs.com → `umactually` → Settings → Publishing access → GitHub Actions binding for `JosiahSiegel/umactually` workflow filename `release.yml`.
- GitHub repo → Settings → Secrets and variables → Actions → no `NPM_TOKEN` secret (delete if one was set previously).
- npmjs.com → Settings → Tokens → no active Granular Tokens for the maintainer account (revoke any old ones).

**Why the workflow does not hard-fail on missing Trusted Publisher binding**: cross-pipeline failure modes are worse than a skipped npm publish. If `publish-npm` were a hard gate, a binding misconfiguration would block every GitHub Release too — the canary, the post-publish download, and the GitHub-Release-only install path would all fail alongside npm. The current shape (the OIDC exchange fails fast with a clear error, the canary still runs against the GitHub Release) keeps the GitHub Release pipeline independent from the npm publish pipeline so a binding issue on one side never cascades into a public-release outage on the other.

## Trust boundaries

The action treats the following inputs as **untrusted**:

- Pull request title, body, and comments.
- Diff lines.
- `prompt-file` contents (if the file path passes the path safety checks).
- Anything in the event JSON except the small allow-list (PR number, repository name, head SHA).
- The `api-url` string (and any query parameters it carries).
- Instruction files (CLAUDE.md, AGENTS.md, .github/copilot-instructions.md, README.md, …) are UNTRUSTED repo-supplied content. In PR mode, umactually reads them from the PR's base branch (not the PR head) to defeat attacker-injected instructions.

The action treats the following inputs as **trusted**:

- Secrets passed through `env:`.
- The repository checkout used by the workflow.
- `GITHUB_TOKEN` (or `SYSTEM_ACCESSTOKEN` on Azure DevOps).

Never expose trusted inputs to untrusted strings. In particular, do not interpolate `secrets.*` into a script body that is later written to disk.

## Trust model: init

`umactually init` persists typed provider settings to `~/.umactually/config.json` (mode `0o600`; directory mode `0o700`). The file is written atomically and refuses to overwrite a regular file without confirmation (`--force` bypasses). Symlinks and regular files that fail JSON parse trigger a backup-aside rename (`<path>.bak-<unix-mtime>`) and a refuse-to-clobber prompt.

### What init stores

- `provider` — one of `openai-compatible`, `anthropic`, `copilot`.
- `apiUrl` — present only when the operator picked a non-default value for the chosen provider (e.g. a self-hosted gateway URL that does not match the provider's built-in default). Omitted when the operator accepted the default.
- `model` — present only when the operator picked a non-empty value. When omitted, the runtime resolves per-provider at review time — see [`docs/providers.md`](providers.md#model-resolution).
- `schemaVersion` — always `1` for this release. Bumping the schema is a breaking change.

### What init NEVER stores

- `apiKey` — never read from or written to disk. The flag/env value is consumed in-memory for the live-provider HEAD probe only and is never serialized.
- GitHub or Azure platform tokens — `GITHUB_TOKEN`, `GH_TOKEN`, `SYSTEM_ACCESSTOKEN` are sourced from the runner env at review time, not from disk.
- Any literal matching the secret regex `ghp_|ghs_|gho_|ghu_|ghr_|glpat-|s\.r|sk-|eyJ...` — the writer re-scans the serialized content before `fsync` and refuses to write a file that contains a match (defensive: the typed shape excludes `apiKey`, but the writer enforces the guarantee at the byte level).

### Where secrets live

- GitHub Actions: repo Settings → Secrets and variables → Actions → secret `UMACTUALLY_API_KEY` (and `GITHUB_TOKEN`, automatically provided).
- Azure DevOps: Pipelines → Library → Variable group → secret variable `UMACTUALLY_API_KEY` (and `SYSTEM_ACCESSTOKEN`, mapped from `$(System.AccessToken)`).
- Local shell: `export UMACTUALLY_API_KEY=...` — never committed, never in shell history.

### Rotation guidance

1. Generate a new key in the upstream provider console.
2. Update the secret store (GitHub repo secret / Azure variable group / local `UMACTUALLY_API_KEY` env).
3. Re-run `umactually review` once on a non-PR branch to confirm the new key is wired.
4. Revoke the old key in the upstream console.

The wizard never touches the secret store — rotation is fully decoupled from `umactually init`. Re-running `umactually init` after rotation is unnecessary; the saved config does not contain `apiKey`.

## CI log URL redaction

GitHub Actions annotations are persisted on the PR's action run and visible to anyone with `actions:read`. The action emits `::notice::` lines that include the operator's `UMACTUALLY_API_URL` so operators can audit which candidate URL the dispatcher is trying.

`redactUrlForLog(value: string): string` in `src/util/url.ts` is the single point where URLs cross into log output. It strips the query string (`?...`) and fragment (`#...`) from a URL, dropping to bare `origin + path` form:

```text
https://api.example.com                              → https://api.example.com
https://api.example.com/v1/responses                 → https://api.example.com/v1/responses
https://gateway.example.com/session=abc              → https://gateway.example.com
https://gateway.example.com/oauth?token=secret-leak  → https://gateway.example.com/oauth
https://gateway.example.com/anthropic?session=abc123 → https://gateway.example.com/anthropic
```

The helper uses the WHATWG `URL` parser and falls back to substring-strip if the input is unparseable. It is wired into every `::notice::` URL log site in `src/provider/openai-compatible.ts` and `src/cli/live-provider.ts`.

Operators who accidentally (or maliciously) type a URL with a `?token=` session parameter do not leak that token into the action log on every retry. The wire-shape path is unaffected — the API key still goes to the same URL over HTTPS, but the query token never reaches the persisted log.

## Cross-protocol dispatcher security notes

The cross-protocol fallback in `src/cli/live-provider.ts:runWithCrossProtocolFallback` posts the operator's `UMACTUALLY_API_KEY` to **both** the named provider and the fallback provider at the same `UMACTUALLY_API_URL` when the named protocol returns 404. This is correct on documented dual-protocol gateways (which accept the same key for both protocols). The non-correct fallbacks are bounded by the 404-only trigger:

- **404** → fallback fires (routing-level rejection; operator likely typed a URL whose protocol-prefix they got wrong).
- **400** → fallback does NOT fire (payload-level errors should not trigger a wire-shape switch).
- **401/403/429/5xx/network/parse** → fallback does NOT fire (single root cause; another protocol won't help).

Operators pointing `--provider anthropic` or `--provider openai-compatible` at non-dual-protocol URLs get a wasted secondary request at most. The `::notice::` annotation surfaces this so they can pick the right `--provider` on the next run. See [`docs/providers.md`](providers.md#cross-protocol-auto-discovery-the-dispatcher) for the full decision tree.

## Least-privilege GitHub permissions

```yaml
permissions:
  contents: read
  pull-requests: write
```

Do not use `pull_request_target` for this action; it is not required to comment on a PR and can expose secrets to untrusted PR code.

## Synthetic test API keys (the `do-not-leak` sentinel)

UmActually's test suite uses synthetic API keys to exercise the cross-protocol dispatcher, the Anthropic Messages API, and the provider-failure paths. Every synthetic key carries the literal `do-not-leak` sentinel — for example `sk-anthropic-v2-do-not-leak`, `sk-test-openai-do-not-leak`, `sk-gateway-smoke-test-do-not-leak`. The `do-not-leak` suffix is a tripwire: a maintainer who copies a fixture into a real config file and forgets to swap it will find this section via `rg do-not-leak src/`, and the next reviewer will catch it in code review.

If you add a new test fixture that looks like an API key, append the `do-not-leak` suffix. A grep for `do-not-leak` should match every synthetic key in the repo.

## Reporting issues

If you find a security issue in UmActually, open a private security advisory on the repository rather than a public issue. Include the input or fixture that triggered the issue, the version, and a minimal reproduction.
