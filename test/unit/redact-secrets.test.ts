import { describe, expect, it } from "vitest";

import { replaceSecretsLiterally } from "../../src/util/redact.js";
import {
  REDACTED_AUTHORIZATION_HEADER,
  REDACTED_BEARER_TOKEN,
  REDACTED_SECRET_TOKEN,
} from "../../src/util/brand.js";

describe("replaceSecretsLiterally", () => {
  it("DRY-REDACT-001 returns the input unchanged when secrets are empty", () => {
    // Given
    const input = "nothing to redact";

    // When
    const output = replaceSecretsLiterally(input, []);

    // Then
    expect(output).toBe(input);
  });

  it("DRY-REDACT-002 replaces every occurrence of a single literal secret", () => {
    // Given
    const input = "token=secret123 repeated secret123";

    // When
    const output = replaceSecretsLiterally(input, ["secret123"]);

    // Then
    expect(output).toBe(`token=${REDACTED_SECRET_TOKEN} repeated ${REDACTED_SECRET_TOKEN}`);
  });

  it("DRY-REDACT-003 replaces multiple secrets in array order so earlier entries win on overlap", () => {
    // Given
    const input = "abc ab xyz";

    // When
    const output = replaceSecretsLiterally(input, ["ab", "abc", "xyz"]);

    // Then
    expect(output).toBe(`${REDACTED_SECRET_TOKEN}c ${REDACTED_SECRET_TOKEN} ${REDACTED_SECRET_TOKEN}`);
  });

  it("DRY-REDACT-004 treats regex metacharacters in secrets literally", () => {
    // Given
    const input = "literal a.b+c* stays separate from axbc";

    // When
    const output = replaceSecretsLiterally(input, ["a.b+c*"]);

    // Then
    expect(output).toBe(`literal ${REDACTED_SECRET_TOKEN} stays separate from axbc`);
  });

  it("DRY-REDACT-005 skips empty-string secrets without clobbering the value", () => {
    // Given
    const input = "keep secret123 keep";

    // When
    const output = replaceSecretsLiterally(input, ["", "secret123"]);

    // Then
    expect(output).toBe(`keep ${REDACTED_SECRET_TOKEN} keep`);
  });

  it("DRY-REDACT-006 preserves the representative behavior of the prior literal-redaction loops", () => {
    // Given
    const liveInput = "Authorization: Bearer abc";
    const summaryInput = "api_key=secret123";
    const debugInput = "apiKey=sk-abc123";

    // When
    const liveOutput = replaceSecretsLiterally(
      liveInput.replace(/Authorization:\s*[^\r\n]*/giu, REDACTED_AUTHORIZATION_HEADER).replace(/\bBearer\s+\S+/giu, REDACTED_BEARER_TOKEN),
      [],
    );
    const summaryOutput = replaceSecretsLiterally(summaryInput, ["secret123"]);
    const debugOutput = replaceSecretsLiterally(debugInput, ["sk-abc123"]);

    // Then
    expect(liveOutput).toBe(REDACTED_AUTHORIZATION_HEADER);
    expect(summaryOutput).toBe(`api_key=${REDACTED_SECRET_TOKEN}`);
    expect(debugOutput).toBe(`apiKey=${REDACTED_SECRET_TOKEN}`);
  });
});
