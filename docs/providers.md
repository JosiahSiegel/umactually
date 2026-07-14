# Provider protocol reference

This document is the **canonical reference** for how the action talks to model APIs across the three provider families (`openai-compatible`, `copilot`, `anthropic`) and how the **cross-protocol dispatcher** reasons about operators who pick the wrong provider for a dual-protocol gateway.

Read this before changing URL handling, adding a provider, or editing the dispatcher. The patterns here are also documented in `src/util/url.ts` and `src/cli/live-provider.ts` at the code level, but this page is the single place to read end-to-end.

## Mental model in 30 seconds

The action supports three wire-shape families:

| Family | Wire shape | Auth header | Endpoint paths |
| --- | --- | --- | --- |
| `openai-compatible` | OpenAI Responses API + Chat Completions | `Authorization: Bearer <key>` | `/v1/responses`, `/v1/chat/completions` |
| `copilot` | OpenAI Chat Completions (sub-set) | GitHub PAT → short-lived session token | `/chat/completions` |
| `anthropic` | Anthropic Messages API | `x-api-key: <key>` + `anthropic-version: 2023-06-01` | `/v1/messages` |

Operators point `--api-url` (or `UMACTUALLY_API_URL`) at a base URL. The action appends the appropriate endpoint path internally.

## Per-family URL resolution

### `openai-compatible` — `resolveProviderBaseUrlCandidates(baseUrl)`

Contract: "try the operator's URL as-pasted first; if both `/responses` and `/chat/completions` 404 at it, fall back to the origin + `/v1`."

```text
input                            →  candidates tried (in order)
https://api.example.com           →  https://api.example.com, https://api.example.com/v1
https://api.example.com/v1        →  https://api.example.com/v1          (already canonical)
https://api.example.com/openai    →  https://api.example.com/openai, https://api.example.com/v1
https://api.example.com/api/v2     →  https://api.example.com/api/v2,  https://api.example.com/v1
```

Implementation: `src/util/url.ts` (`resolveProviderBaseUrlCandidates`).

### `anthropic` — `resolveAnthropicMessagesUrl(baseUrl)`

Contract: "preserve the operator's path; append `/v1/messages` per the official `@anthropic-ai/sdk` convention. Query/fragment are dropped."

```text
input                                            → output
https://api.anthropic.com                         → https://api.anthropic.com/v1/messages
https://api.anthropic.com/v1                      → https://api.anthropic.com/v1/messages  (idempotent)
https://api.anthropic.com/v1/                     → https://api.anthropic.com/v1/messages  (trailing / trimmed)
https://api.anthropic.com/v1/messages             → https://api.anthropic.com/v1/messages  (idempotent)
https://gateway.example.com/llm/anthropic         → https://gateway.example.com/llm/anthropic/v1/messages
https://api.minimax.io/anthropic                  → https://api.minimax.io/anthropic/v1/messages  ← MiniMax Anthropic-protocol
https://api.example.com/v1?token=abc              → https://api.example.com/v1/messages  (query dropped)
```

Implementation: `src/util/url.ts` (`resolveAnthropicMessagesUrl`).

### `copilot` — separate scheme

Copilot does its own token exchange at `${UMACTUALLY_GITHUB_API_BASE}/copilot_internal/v2/token` (default `https://api.github.com`). The token endpoint is part of the Copilot API and is independent of `UMACTUALLY_API_URL`. The exchange returns an `endpoints.api` host (which depends on the operator's Copilot plan) and the action then POSTs `/chat/completions` to that host. There is no URL remapping in `src/util/url.ts` for Copilot — the routing lives entirely in `src/provider/copilot.ts`.

## The path-prefix matrix (why both protocols are real)

Some providers serve **more than one wire shape** under the same hostname at different path prefixes. The canonical example is **MiniMax**, whose docs (see refs section) prescribe two distinct URLs for the same API key:

| Provider | URL the operator types | Maps to | Wire shape |
| --- | --- | --- | --- |
| MiniMax (Anthropic) | `https://api.minimax.io/anthropic` | `https://api.minimax.io/anthropic/v1/messages` | Anthropic Messages |
| MiniMax (OpenAI) | `https://api.minimax.io/v1` | `https://api.minimax.io/v1/responses` | OpenAI Responses / Chat Completions |

These are NOT interchangeable — the Anthropic-protocol endpoint only speaks Anthropic Messages API; the OpenAI-protocol endpoint only speaks OpenAI-shaped requests. The same API key works for both.

Other providers we have seen follow the same pattern (gateways that mount multiple protocol families under a hostname):
- **Anthropic SDK convention**: `ANTHROPIC_BASE_URL=https://example.com/anthropic-prefix` → POST `…/anthropic-prefix/v1/messages`. Per the official `@anthropic-ai/sdk` and `anthropic-sdk-kotlin`'s [path-preserving fix](https://github.com/xemantic/anthropic-sdk-kotlin/pull/145).
- **Self-hosted Anthropic-protocol gateways** (LiteLLM, Portkey, OpenRouter with Anthropic compat) commonly use arbitrary path prefixes to disambiguate from the same gateway's OpenAI compat endpoints.

OpenAI-protocol gateways (LiteLLM, Portkey, OpenRouter, etc.) generally do NOT use a path prefix — `/v1` is canonical. So `resolveProviderBaseUrlCandidates` tries the as-pasted URL first (to honor operator intent) and falls back to origin + `/v1` if both endpoints 404 there.

## Cross-protocol auto-discovery (the dispatcher)

When the operator points `--api-url` at a dual-protocol gateway like MiniMax, they often do not know (or do not care) which protocol lives under which path prefix. The dispatcher (`src/cli/live-provider.ts:runWithCrossProtocolFallback`) makes `--provider` advisory on these gateways:

```text
Operator: --provider openai-compatible --api-url https://api.minimax.io/anthropic

Dispatcher behavior:
  1. Try OpenAI at /anthropic/responses      → 404  (no OpenAI-protocol at this prefix on MiniMax)
  2. Try OpenAI at /anthropic/chat/completions → 404 (same — chat completion is also a /responses-prefixed alternative)
  3. Advance to origin fallback: try /v1/responses        → try /v1/chat/completions  → all 404
  4. Named protocol exhausted → call cross-protocol fallback
  5. Retry with Anthropic protocol at the SAME base URL
  6. resolveAnthropicMessagesUrl("...anthropic") = ".../anthropic/v1/messages" → POST → 200
  7. Outcome.attribution = "anthropic-messages" (recovered via providerNameForEndpoint)
```

### Path-prefix heuristic (the `/anthropic` URL commits to the Anthropic protocol)

A subtle gotcha surfaced by the operator's actual setup (`UMACTUALLY_API_URL=https://api.minimax.io/anthropic` + default `--provider=openai-compatible`): the openai-compatible client's URL candidate loop downgrades `/anthropic` to `origin+/v1` and tries `/v1/responses` there. MiniMax serves OpenAI Responses at `/v1/responses` (just like it serves Anthropic at `/anthropic/v1/messages`), so the openai loop happily succeeds with the **OpenAI** wire shape — never triggering the cross-protocol fallback above. Result: the action posts OpenAI-Responses shape to a URL the operator typed as an Anthropic-protocol gateway.

To prevent this, the dispatcher runs `looksLikeAnthropicEndpoint(baseUrl)` *before* choosing which provider client to call. If ANY path segment is exactly `anthropic` (case-insensitive, byte-for-byte match — `anthropic-v2` and `my-anthropic` do NOT match), the dispatcher commits to the Anthropic Messages API client regardless of `--provider`. The cross-protocol fallback still fires if the committed Anthropic call also fails.

```text
URL                                                             → committed protocol
https://api.minimax.io/anthropic                               → anthropic (heuristic)
https://gateway.example.com/llm/anthropic                     → anthropic (heuristic)
https://gateway.example.com/v1/anthropic                       → anthropic (heuristic)
https://api.openai.com/v1                                       → openai-compatible (default)
https://api.example.com/                                        → openai-compatible (default)
https://api.example.com/anthropic-v2                            → openai-compatible (heuristic does NOT match)
https://api.example.com/anthropic?token=secret                  → anthropic (heuristic; query dropped)
```

Operator-visible notice on every URL that triggers the heuristic:

```
::notice::umactually: Operator URL contains an /anthropic path segment; using the Anthropic Messages API client (not the default openai-compatible).
```

The heuristic is conservative by design. False negatives still fall through to the cross-protocol fallback chain. False positives are bounded to byte-for-byte segment matches so a path like `https://attacker.example.com/anthropic-related` does NOT trigger the heuristic (the segment is `anthropic-related`, not `anthropic`). See `src/util/url.ts:looksLikeAnthropicEndpoint` for the exact contract and `test/unit/looks-like-anthropic-endpoint.test.ts` for the boundary test matrix.

### What triggers the fallback

`isRoutableFailureForDispatcher(error)` is `true` ONLY when `error.status === 404`. Specifically:

- **404** → cross-protocol fallback fires. Genuine routing-level rejection.
- **400** → fallback does NOT fire. The OpenAI client's internal URL-candidate loop advances to sibling paths under the same URL (responses → chat/completions), but the dispatcher boundary does NOT switch protocols on 400. Rationale: 400 typically signals payload-level errors (malformed body, missing required field, unsupported `max_tokens` value, content-policy rejection). Switching protocols on 400 would silently mask wire-shape bugs — an Anthropic call that 400s on an unsupported parameter would retry against the OpenAI wire shape and possibly succeed, with the operator seeing a successful review attributed to the OTHER protocol without ever knowing their original call was malformed.
- **Other (401/403/429/5xx/network/parse)** → fallback does NOT fire. Single root cause; another protocol won't help.

And the inverse:

```text
Operator: --provider anthropic --api-url https://api.minimax.io/v1

Dispatcher behavior:
  1. Try Anthropic at /v1/messages            → 404  (no Anthropic-protocol at this prefix on MiniMax)
  2. Cross-protocol fallback → call OpenAI provider at the SAME base URL
  3. OpenAI tries /v1/responses, then /v1/chat/completions  → 200 (or 400 if M3 body shape mismatch)
  4. Outcome.attribution = "openai-compatible"
```

### Outcome attribution after fallback

`providerNameForEndpoint(endpoint)` recovers the **actual** protocol from the success result, not the operator's `--provider` choice. So `outcome.provider` reads `anthropic-messages` even when the operator picked `openai-compatible` and the dispatcher fell back. The action's GitHub review attribution reflects what actually produced the review. The named error is what surfaces on dual-protocol failure.

### Operator-visible notices

Every fallback emits two `::notice::` annotations:

```
::notice::umactually: Named provider "openai-compatible" returned status=404 at https://api.minimax.io/anthropic — retrying with cross-protocol fallback "anthropic".
```

(And on dual-protocol failure:)

```
::notice::umactually: Cross-protocol fallback "anthropic" returned status=404 at https://api.minimax.io/anthropic — surfacing named protocol's error.
```

Both lines use `redactUrlForLog` (defined in `src/util/url.ts`) which strips the query string + fragment so `?token=…`-style session ids never reach the persisted CI annotation log.

### Why named errors win on dual-protocol failure

The dispatcher surfaces the named provider's error on dual-protocol failure rather than the fallback's. Rationale: the operator typed `--provider anthropic` (or `openai-compatible`), and the most actionable diagnostic for them is what their chosen protocol returned. The fallback's error is logged via the diagnostic notice (above) so audit trail is preserved; the surfaced error keeps operator intent honored.

## Model auto-resolution on dual-protocol gateways

`src/cli/auto-model.ts:resolveAutoModel` resolves `model: "auto"` per-provider + URL hostname. On MiniMax-style gateways the same `MiniMax-M3` model works for both protocols, so the operator's choice of `--provider` does not change the model. The auto-detected defaults:

```text
hostname                    → resolved model
api.openai.com / *.openai.* → gpt-5-mini            (HHEM ~6%, Vectara 2026-05-11)
api.anthropic.com / anthropic-* → claude-sonnet-4.6  (HHEM ~6%, Vectara 2026-05-11)
api.minimax.io / *.minimax.* → MiniMax-M3
copilot (any URL)           → claude-3-5-sonnet
generativelanguage.*, ai.google.* → gemini-2.5-flash
```

Per the Vectara HHEM leaderboard, these are the lower-hallucination choices for code review in 2026. Set `model: <string>` explicitly to override.

## `api-url` precedence

For all three providers, the order of resolution is:

1. `api-url` CLI flag / action input.
2. `UMACTUALLY_API_URL` env var.
3. Provider default (`openai-compatible` → `""` (required), `anthropic` → `https://api.anthropic.com/v1`, `copilot` → empty).

`api-url` is **NOT required** when `--provider anthropic` (the provider has a sensible default). `--provider anthropic --api-url https://api.minimax.io/anthropic` is the typical MiniMax setup.

`api-url` IS required when `--provider openai-compatible` (no default). The CLI surfaces this in `validate.ts:readRequiredConfig("UMACTUALLY_API_URL", …)` and `orchestrator.ts`.

`api-url` is NOT used for Copilot (Copilot uses `UMACTUALLY_GITHUB_API_BASE` for the token exchange URL).

## SDK references

The Anthropic URL resolution pattern matches:

- The official `@anthropic-ai/sdk` convention (Claude Code's `ANTHROPIC_BASE_URL` injects as bare-host; SDK appends `/v1/messages`).
- [`anthropic-sdk-kotlin/pull/145`](https://github.com/xemantic/anthropic-sdk-kotlin/pull/145) — "previously, `client.post('/v1/messages')` replaced any path on a configured baseUrl, breaking Anthropic-compatible providers whose endpoints live under a path prefix."
- The [Vercel AI SDK issue #15580](https://github.com/vercel/ai/issues/15580) — documented failure mode when providers strip the path prefix.

The MiniMax dual-protocol behavior is documented at:

- [MiniMax Claude Code docs](https://platform.minimax.io/docs/token-plan/claude-code) — Anthropic-protocol endpoint.
- [MiniMax Codex docs](https://platform.minimax.io/docs/token-plan/codex) — OpenAI-protocol endpoint.

## When to add a new provider family

Before adding a new provider, check that:

1. The wire shape differs from all three current families in a way the existing dispatcher's cross-protocol logic can't accommodate (the Anthropic and OpenAI families cover the bulk of the LLM API universe; LiteLLM, Portkey, etc. usually proxy one or both of them).
2. The auth header isn't a small variant on Bearer / x-api-key (e.g. AWS SigV4 for Bedrock would be a real new family).
3. The provider has stable documented endpoint paths so URL resolution rules can be encoded as deterministic string rules (not pure routing-by-probe).

If all three pass, the new family should follow the same pattern as `src/provider/anthropic-messages.ts`: a dedicated `run<X>Request` exported from the provider module, a wire-shape-only contract, and the dispatcher in `src/cli/live-provider.ts` is updated with one more "if errored, route to the OTHER protocol" branch.

If only (1) holds but the rest are negative, route through the existing OpenAI client with a request-body adapter (see `src/provider/openai-compatible.ts:buildChatBody` for how the wire body is currently adapted). Avoid adding new families when a thin adapter suffices.
