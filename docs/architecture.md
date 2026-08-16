# Architecture and contributor map

UmActually is a Node.js 24 CLI. It reads review context, applies committed/local policy, sends redacted context to a configured model provider, validates structured findings, and optionally reconciles platform comments. It has no hosted service dependency operated by this project.

## Runtime map

| Layer | Responsibility | Primary paths |
| --- | --- | --- |
| CLI | Commands, argument parsing, init, doctor, TUI, artifacts | `src/cli.ts`, `src/cli/` |
| Configuration and policy | Provider settings, committed review policy, precedence/provenance | `src/config/` |
| Context | GitHub, Azure DevOps, local diff/files, safe instruction files | `src/platform/`, `src/cli/auto-context.ts` |
| Provider adapters | OpenAI-compatible, Anthropic, Copilot requests and parsing | `src/provider/` |
| Review contracts | Findings, fingerprints, suggestions, artifact schema, state | `src/review/` |
| Rendering/posting | Summaries and platform reconciliation | `src/render/`, `src/cli/live-*.ts` |
| Distribution | npm CLI and release-built standalone binaries | `bin/`, `dist/`, `scripts/` |
| Proof | Unit/scenario/e2e tests and benchmark fixtures | `test/`, [`docs/benchmark.md`](benchmark.md) |

The architecture is intentionally CLI-first: configuration and review state live with the operator or repository. The project does not ship a hosted control plane.

### Review body shape

Every CLI-rendered review body ends with three trailing sections in a fixed order: a `---` rule + footer block, a collapsed `<details><summary>📖 How to read + resolve</summary>…</details>` resolution guide, and the manifest comment `<!-- umactually:manifest {…} -->`. The guide is platform-aware — GitHub-path bodies carry `resolveReviewThread` GraphQL recipes; Azure-path bodies carry `az repos pr thread update` recipes; the orchestrator passes its resolved platform explicitly so even auto-detected Azure runs receive the Azure variant. The resolution guide is bounded by the marker `<!-- umactually:resolution-guide-v3 -->` (the `v3` prefix is the same marker family used by grep-idempotency in the self-review workflow, with a versionless skip regex to prevent double-append on re-runs). The guide is intentionally condensed (< 2,500 chars per variant); the full long-form walkthroughs remain in `.github/workflows/data/resolution-guide-*.md` for consumers on older CLIs that don't bake the guide.

## Context and policy provenance

Context may come from GitHub, Azure DevOps, a supplied diff, or local files. Repository instruction files are untrusted input; PR-mode platform adapters obtain supported instruction context from the base revision. The audit artifact hashes sanitized policy/context metadata without persisting raw secrets. `--show-config` exposes resolved non-secret configuration, while committed `umactually.review.json` fields retain source/path/hash/schema provenance. See [`docs/configuration.md`](configuration.md) and [`docs/security.md`](security.md).

## Incremental behavior

Supported GitHub and Azure posting paths assign durable finding identities and reconcile new, changed, unchanged, and resolved findings. A schema-versioned state artifact enables repeated reviews without treating every run as unrelated. Collision detection fails closed rather than mutating ambiguous state. Incremental review is scoped to the current fingerprint/state schemas and platform adapters; it is not opaque learning from prior repositories or hidden server state.

## Suggestions

Suggestions are explicit structured findings. Candidate patches are checked for supported platform shape and diff applicability before posting. Unsupported or unsafe suggestions degrade to ordinary findings instead of being silently applied. UmActually does not auto-commit changes.

## Metrics and privacy

Review metrics are local artifact fields: phase timing, reason histograms, round trips, and provider-reported usage when present. Cost appears only when the operator supplies prices and the provider supplies both token counts. The runtime does not infer pricing from a model name. Raw prompts, secrets, and URL query/fragment credentials are not metrics fields; sanitized hashes support provenance. Review content is sent to the operator-selected provider, so that provider's retention/privacy terms still apply.

## Operations

- `umactually doctor` checks runtime, configuration, authentication prerequisites, platform context, and distribution freshness where applicable. Use `umactually doctor --help` for the current full surface.
- `umactually tui` is a local interactive wrapper over supported review/config/debug flows; it is not a web dashboard.
- GitHub.com, GitHub Enterprise Server where documented, and Azure DevOps are platform adapters. See platform docs for exact permissions and limitations.
- Roll back by pinning the previous npm version/release tag, restoring the previous committed policy/state artifact if its schema changed, and rerunning `umactually doctor` before review. Never downgrade by tracking `main`.

## Limitations and deferred scope

The following are not shipped:

- hosted control plane;
- GitLab integration;
- Bitbucket integration;
- opaque learning across runs or repositories;
- auto-commit or autonomous merge behavior.

Model output can be incomplete or wrong. Diff validation, citation checks, policy, and redaction reduce risk but do not replace human review. Benchmarks cover the committed fixtures, not every language, repository, or model.

## Contributor ownership

Start at the narrowest layer in the runtime map and pair every behavior change with a focused test. Changes to artifact, fingerprint, policy, metrics, or platform-state schemas require compatibility analysis, fixture updates, documentation, and rollback notes. Security-boundary changes require regression tests and review of [`SECURITY.md`](../SECURITY.md). Distribution/version changes must pass rendered-doc, version-alignment, and dist-freshness gates. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).