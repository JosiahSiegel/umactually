import { describe, expect, it } from "vitest";

import { checkEffortRejection } from "../../src/provider/provider-effort-error.js";
import type { ProviderEndpoint } from "../../src/provider/provider-error.js";

const ENDPOINT: ProviderEndpoint = "chat";

const CONTEXT = {
  reasoningEffort: "xhigh" as const,
  endpoint: ENDPOINT,
  requestId: "req-test",
};

async function rejectionMessage(body: string, init?: { readonly status?: number; readonly secrets?: readonly string[] }): Promise<string> {
  const response = new Response(body, { status: init?.status ?? 400 });
  try {
    await checkEffortRejection(response, { ...CONTEXT, secrets: init?.secrets ?? [] });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error("expected checkEffortRejection to throw");
}

describe("checkEffortRejection", () => {
  it("returns silently when no reasoning effort was requested", async () => {
    // Given
    const response = new Response(JSON.stringify({ error: { message: "effort unsupported" } }), { status: 400 });
    // When / Then
    await expect(checkEffortRejection(response, { endpoint: ENDPOINT, requestId: "req-test", secrets: [] })).resolves.toBeUndefined();
  });

  it("returns silently when the body never mentions effort", async () => {
    // Given
    const response = new Response(JSON.stringify({ error: { message: "model overloaded" } }), { status: 500 });
    // When / Then
    await expect(checkEffortRejection(response, { ...CONTEXT, secrets: [] })).resolves.toBeUndefined();
  });

  it("prefers the envelope error.message as the detail", async () => {
    // Given / When
    const message = await rejectionMessage(JSON.stringify({ error: { message: "effort level too high" } }));
    // Then
    expect(message).toContain("effort level too high");
  });

  it("falls back to the raw body when the envelope record has no message field", async () => {
    // Given / When
    const message = await rejectionMessage(JSON.stringify({ error: { detail: "effort refused here" } }));
    // Then
    expect(message).toContain("effort refused here");
  });

  it("uses a string envelope directly as the detail", async () => {
    // Given / When
    const message = await rejectionMessage(JSON.stringify({ error: "effort value not accepted" }));
    // Then
    expect(message).toContain("effort value not accepted");
  });

  it("uses the raw body when the error response has no envelope", async () => {
    // Given / When
    const message = await rejectionMessage("effort rejected by gateway");
    // Then
    expect(message).toContain("effort rejected by gateway");
  });

  it("does not throw for a successful response without an error envelope", async () => {
    // Given
    const response = new Response(JSON.stringify({ output_text: "effort mentioned in passing" }), { status: 200 });
    // When / Then
    await expect(checkEffortRejection(response, { ...CONTEXT, secrets: [] })).resolves.toBeUndefined();
  });

  it("redacts sk- style tokens from the detail", async () => {
    // Given / When
    const message = await rejectionMessage(JSON.stringify({ error: { message: "effort bad; key sk-AbC123-x_y leaked" } }));
    // Then
    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain("sk-AbC123-x_y");
  });

  it("redacts gh[pousr]_ style tokens from the detail", async () => {
    // Given / When
    const message = await rejectionMessage(JSON.stringify({ error: { message: "effort bad; token ghp_a1B2c3 and ghs_Z9y8x7 leaked" } }));
    // Then
    expect(message).not.toContain("ghp_a1B2c3");
    expect(message).not.toContain("ghs_Z9y8x7");
  });

  it("redacts Bearer authorization strings from the detail", async () => {
    // Given / When
    const message = await rejectionMessage(JSON.stringify({ error: { message: "effort bad; Bearer opaque.token.value leaked" } }));
    // Then
    expect(message).toContain("Bearer [REDACTED]");
    expect(message).not.toContain("opaque.token.value");
  });

  it("replaces literal context secrets before regex redaction", async () => {
    // Given / When
    const message = await rejectionMessage(
      JSON.stringify({ error: { message: "effort bad; key hunter2 leaked" } }),
      { secrets: ["hunter2"] },
    );
    // Then
    expect(message).not.toContain("hunter2");
  });

  it("collapses control characters before truncating the detail", async () => {
    // Given / When
    const message = await rejectionMessage(JSON.stringify({ error: { message: "effort badtrailing junk" } }));
    // Then
    expect(message).not.toMatch(/[]/u);
  });
});
