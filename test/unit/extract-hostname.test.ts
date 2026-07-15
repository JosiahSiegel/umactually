// Pins the `extractHostname` helper in src/util/url.ts. Auto-model
// and the provider URL resolver both rely on this function for
// hostname-only routing. The helper is also a real source of
// bugs when scheme-less URLs are involved (case-sensitivity, the
// localhost:port edge case), so we cover both paths here.
import { describe, expect, it } from "vitest";

import { extractHostname } from "../../src/util/url.js";

describe("extractHostname: hostname-only match, always lowercased", () => {
  it("returns the hostname of a fully-qualified URL with scheme", () => {
    expect(extractHostname("https://api.example.com/v1")).toBe("api.example.com");
  });

  it("returns the hostname of a URL with a custom port (port is stripped)", () => {
    // `URL.hostname` strips the port per the WHATWG URL spec.
    // Port handling is the caller's job (use `URL.port` separately
    // if the port is needed).
    expect(extractHostname("https://api.example.com:8443/v1")).toBe(
      "api.example.com",
    );
  });

  it("returns the hostname of a URL with no path", () => {
    expect(extractHostname("https://api.example.com")).toBe("api.example.com");
  });

  it("lowercases a URL with a parseable scheme (case-insensitive)", () => {
    // URL.hostname is already lowercased per the WHATWG URL spec;
    // we just rely on the parser.
    expect(extractHostname("https://API.MINIMAX.IO/v1")).toBe("api.minimax.io");
  });

  it("lowercases a scheme-less uppercase URL (regression)", () => {
    // Scheme-less uppercase URLs don't parse with `new URL()`, so we
    // hit the manual fallback path. The function MUST lowercase
    // there too — otherwise case-insensitive substring match
    // against the lowercase `minimax` route key would fail.
    expect(extractHostname("API.MINIMAX.IO")).toBe("api.minimax.io");
  });

  it("returns null for a scheme-less `host:port` string (localhost:8080)", () => {
    // `new URL("localhost:8080")` parses successfully on current
    // Node (the URL parser interprets the `:` as a port separator
    // and the host as `""` because there is no scheme). The try
    // branch returns `new URL(...).hostname` which is the empty
    // string; the function then returns `null` because the parsed
    // hostname is empty. The fallback path is not reached for this
    // input. The behavior is correct: `localhost:8080` without a
    // scheme is ambiguous (could be a host:port pair, or could be
    // a malformed URL), and the auto-model should not try to
    // route a hostname-less URL.
    //
    // The previous version of this test described the input as
    // "unparseable" but the WHATWG URL parser actually accepts it
    // (with an empty hostname). The assertion and the contract
    // (return null for an empty host) are unchanged; the wording
    // was tightened so a future reader doesn't think the test is
    // asserting "input is unparseable" when it is asserting
    // "extracted hostname is empty".
    expect(extractHostname("localhost:8080")).toBe(null);
  });

  it("returns the hostname of a scheme-less URL with a path (no port)", () => {
    // The original auto-model concern: a URL like
    // `api.minimax.io/anthropic` should give `api.minimax.io`,
    // not `api.minimax.io/anthropic`. The try branch
    // (`new URL("api.minimax.io/anthropic")`) parses hostname
    // as `api.minimax.io` (the slash is treated as a path
    // separator, not part of the host). Even if the fallback
    // path is reached, the slash check stops the slice at the
    // first `/`.
    expect(extractHostname("api.minimax.io/anthropic")).toBe(
      "api.minimax.io",
    );
  });

  it("returns the hostname of a scheme-less bare URL", () => {
    expect(extractHostname("api.example.com")).toBe("api.example.com");
  });

  it("returns null for an empty string", () => {
    expect(extractHostname("")).toBe(null);
  });

  it("returns null for whitespace-only input", () => {
    expect(extractHostname("   ")).toBe(null);
  });

  it("does NOT include the path in the returned hostname", () => {
    // Regression: a buggy version returned `api.minimax.io/anthropic`
    // (host + path) and the substring match in `resolveAutoModel`
    // happened to still work because `/anthropic` is in the
    // allowed list — but the real-world test should pin that
    // we never include the path.
    expect(extractHostname("https://api.minimax.io/anthropic")).toBe(
      "api.minimax.io",
    );
  });
});
