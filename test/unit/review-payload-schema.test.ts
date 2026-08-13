// Regression tests for the review-payload JSON schema. Locks the minLength
// constraints on body/category/path so a provider cannot emit empty-string
// findings that render as location-only threads.
import { describe, expect, it } from "vitest";

import { REVIEW_PAYLOAD_JSON_SCHEMA } from "../../src/cli/provider-prompts.js";

describe("REVIEW_PAYLOAD_JSON_SCHEMA", () => {
  it("requires non-empty body, category, path on comments.items", () => {
    const props = REVIEW_PAYLOAD_JSON_SCHEMA.properties.comments.items.properties;
    expect(props.body).toMatchObject({ type: "string", minLength: 1 });
    expect(props.category).toMatchObject({ type: "string", minLength: 1 });
    expect(props.path).toMatchObject({ type: "string", minLength: 1 });
  });

  it("requires non-empty body, category, path on suppressed_comments.items", () => {
    const props = REVIEW_PAYLOAD_JSON_SCHEMA.properties.suppressed_comments.items.properties;
    expect(props.body).toMatchObject({ type: "string", minLength: 1 });
    expect(props.category).toMatchObject({ type: "string", minLength: 1 });
    expect(props.path).toMatchObject({ type: "string", minLength: 1 });
  });

  it("still requires non-empty severity and verdict", () => {
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.properties.verdict).toMatchObject({
      type: "string",
      minLength: 1,
    });
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.properties.comments.items.properties.severity).toMatchObject({
      type: "string",
      minLength: 1,
    });
    expect(
      REVIEW_PAYLOAD_JSON_SCHEMA.properties.suppressed_comments.items.properties.severity,
    ).toMatchObject({ type: "string", minLength: 1 });
  });

  it("preserves integer line constraint", () => {
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.properties.comments.items.properties.line).toMatchObject({
      type: "integer",
      minimum: 1,
    });
    expect(
      REVIEW_PAYLOAD_JSON_SCHEMA.properties.suppressed_comments.items.properties.line,
    ).toMatchObject({ type: "integer", minimum: 1 });
  });

  it("preserves additionalProperties: false on comments and suppressed_comments items", () => {
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.properties.comments.items.additionalProperties).toBe(false);
    expect(
      REVIEW_PAYLOAD_JSON_SCHEMA.properties.suppressed_comments.items.additionalProperties,
    ).toBe(false);
  });
});
