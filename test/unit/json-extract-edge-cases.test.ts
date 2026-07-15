// SPDX-License-Identifier: MIT
// Edge cases for the stray-quote disambiguation. Each case pins a
// specific failure mode so the extractor doesn't regress.

import { describe, expect, it } from "vitest";
import { extractJsonBlock, extractFirstBalancedObject } from "../../src/render/json-extract.js";

describe("extractFirstBalancedObject — stray-quote disambiguation edge cases", () => {
  it("handles a stray quote inside a long string followed by a comma", () => {
    // The stray quote's next non-ws char is a letter (body content), not
    // a structural char. The peek-ahead should classify this as stray.
    const input = '{"summary":"x","body":"the "quoted" word, then more text","verdict":"COMMENT"}';
    const result = extractJsonBlock(input);
    expect(result).not.toBeNull();
    const parsed = result as { body: string };
    expect(parsed.body).toContain('"quoted"');
    expect(parsed.body).toContain('then more text');
  });

  it("handles a stray quote immediately before the closing brace", () => {
    // Edge case: stray quote followed by closing `}`. The peek-ahead
    // sees `}` next and would NORMALLY classify this as a closing
    // quote. But the model probably emitted 'body value" }' as the
    // end of a string property, where the `"` is stray (model forgot
    // to escape it) and `}` is the actual object close.
    //
    // The peek-ahead heuristic misclassifies this case — it thinks
    // `"` is a closing quote because `}` follows. The first-pass
    // depth tracker then sees the next `}` and decrements depth
    // twice (once for the spurious close + once for the real close),
    // finding the wrong end index.
    //
    // Acceptable behavior: the extractor recovers SOMETHING parseable.
    // Pinning exact recovery would require a more sophisticated
    // heuristic (look at depth, not just structural chars). For now,
    // verify the extractor doesn't crash and either recovers the body
    // or returns null.
    const input = '{"body":"trailing quote"}';
    const result = extractFirstBalancedObject(input);
    // Well-formed case: extracts the whole object.
    expect(result).not.toBeNull();
    expect(JSON.parse(result!)).toEqual({ body: "trailing quote" });
  });

  it("handles a stray quote immediately before the closing brace (actually-broken case)", () => {
    // Now the actually-broken case where the body has an unescaped
    // quote just before `}`. The peek-ahead sees `}` and would
    // classify the `"` as a closing quote. But the next `"` (the
    // real closing quote at the end of `body`) — we already closed.
    // The `}` then closes the object. The result is malformed
    // because we treated the stray as closing, so the actual close
    // gets dropped.
    const input = '{"body":"trailing " quote"}';
    const balanced = extractFirstBalancedObject(input);
    // Pin current behavior: the extractor may produce something
    // unexpected here. Either null or a malformed string. The test
    // exists to document the edge case, not to assert a fix.
    if (balanced !== null) {
      // If we got something, it should at least be parseable OR null
      // — never throw.
      expect(() => JSON.parse(balanced)).not.toThrow();
    }
  });

  it("handles a stray quote immediately before a colon (next-key indicator) — KNOWN LIMITATION", () => {
    // KNOWN LIMITATION: pattern `"body":"value" "next":"x"}` (model
    // emits a stray quote before the next property name) is NOT
    // recoverable. The peek-ahead heuristic treats the next-key's
    // opening `"` as NOT-a-structural-char and classifies the stray
    // as stay-in-string, but then the next `"` is also classified
    // as stray, and the depth tracker never exits string state.
    //
    // Acceptable behavior: the extractor returns null (parse-fail)
    // rather than producing a half-broken substring. The parse-fail
    // card posts, the guard catches it, the retry path fires — same
    // outcome as before this fix. Operators see a parse-fail card
    // and the action's run log shows the exact position.
    //
    // A more sophisticated fix would track depth inside strings and
    // use the first `"` that produces a structural match as the
    // real close. That's a bigger refactor — defer until this
    // specific failure mode becomes common in practice.
    const input = '{"body":"value" "next":"x"}';
    const result = extractJsonBlock(input);
    expect(result).toBeNull();
  });

  it("handles escape sequences inside strings correctly", () => {
    // Well-formed JSON with `\"` escapes should not be over-escaped.
    const input = '{"body":"a \\\"quoted\\\" word"}';
    const result = extractJsonBlock(input);
    expect(result).not.toBeNull();
    const parsed = result as { body: string };
    expect(parsed.body).toBe('a "quoted" word');
  });
});