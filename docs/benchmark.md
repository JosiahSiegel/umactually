# Benchmark methodology and results

UmActually's benchmark is a repository-local review evaluation, not a claim that one model, provider, or review product is universally superior. It measures the checked-out implementation against deterministic fixtures in `test/fixtures/reviews/` and records a schema-versioned artifact.

## Reproduce

From a clean checkout with Node.js 24 and dependencies installed, run the exact reproduction command:

```bash
npm run test:review-eval
```

The runner is `scripts/run-review-eval.mjs`, the evaluator is `test/e2e/review-eval.ts`, and the committed fixture corpus is `test/fixtures/reviews/`. The output artifact is written under `artifacts/manual/` and includes `schemaVersion`, per-fixture results, aggregate precision/recall signals, and environment metadata. Results apply only to that artifact, commit, fixtures, configuration, provider/model, and execution environment.

## Method

1. Each fixture defines changed code and expected review signals.
2. The evaluator runs the same parsing, policy, citation, and finding-validation contracts used by the CLI.
3. Expected and observed findings are matched by the evaluator's documented identity rules.
4. Aggregates are calculated from the schema-versioned rows; absent provider usage or cost data is not invented.
5. A result is reproducible only when its commit, artifact schema version, fixture corpus, runtime, provider/model configuration, and command are retained.

Do not compare results produced from different fixture revisions or provider/model configurations as though they were controlled experiments. Network-backed runs can vary. Local deterministic contract tests prove implementation behavior; they do not prove semantic quality on every repository.

## Results links

- Fixture corpus: [`test/fixtures/reviews/`](../test/fixtures/reviews/)
- Evaluator: [`test/e2e/review-eval.ts`](../test/e2e/review-eval.ts)
- Unit contract: [`test/unit/review-eval.test.ts`](../test/unit/review-eval.test.ts)
- Runner: [`scripts/run-review-eval.mjs`](../scripts/run-review-eval.mjs)

Publish a benchmark result by linking its schema-versioned artifact and commit SHA. Do not transcribe an unlinked score into product copy.

## Verifiable comparison

| Property | UmActually evidence | Scope |
| --- | --- | --- |
| Local reproducibility | `npm run test:review-eval`; fixture and evaluator links above | Current checkout and declared runtime/configuration only |
| Finding provenance | [`docs/architecture.md`](architecture.md#context-and-policy-provenance) and artifact schema tests | Inputs represented by the current artifact schema |
| Incremental reconciliation | [`test/unit/review-state-machine.test.ts`](../test/unit/review-state-machine.test.ts) | Durable identities and supported GitHub/Azure paths |
| Secret redaction | [`docs/security.md`](security.md#redaction) and security tests | Documented high-confidence patterns; not every possible secret |

This table compares architectural properties to repository evidence. It contains no vendor quality ranking or uncited vendor number.

## Claims inventory

Every comparative statement must link evidence:

- **Reproducible locally** — exact command, fixtures, evaluator, and schema requirements above.
- **Auditable context and policy provenance** — [`docs/architecture.md#context-and-policy-provenance`](architecture.md#context-and-policy-provenance).
- **Incremental instead of blindly duplicating supported findings** — [`docs/architecture.md#incremental-behavior`](architecture.md#incremental-behavior) and state-machine tests.
- **Suggestions are bounded and validated before posting** — [`docs/architecture.md#suggestions`](architecture.md#suggestions).
- **Metrics omit unknown usage and cost** — [`docs/architecture.md#metrics-and-privacy`](architecture.md#metrics-and-privacy) and [`test/unit/review-metrics.test.ts`](../test/unit/review-metrics.test.ts).

No claim here establishes universal superiority.