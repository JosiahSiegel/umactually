import { describe, expect, it } from "vitest";

import { findLastJsonObject } from "../../scripts/publish-with-webauth.mjs";

describe("publish-with-webauth helper script", () => {
  describe("findLastJsonObject", () => {
    it("extracts a top-level JSON object from npm --json EOTP output", () => {
      const out =
        "npm notice Publishing to https://registry.npmjs.org/\n" +
        "npm error code EOTP\n" +
        "{\n" +
        '  "error": {\n' +
        '    "code": "EOTP",\n' +
        '    "summary": "This operation requires a one-time password.",\n' +
        '    "authUrl": "https://www.npmjs.com/auth/cli/abc-123",\n' +
        '    "doneUrl": "https://registry.npmjs.org/-/v1/done?authId=abc-123"\n' +
        "  }\n" +
        "}\n";
      const obj = findLastJsonObject(out);
      expect(obj).not.toBeNull();
      expect(obj?.error?.code).toBe("EOTP");
      expect(obj?.error?.authUrl).toBe("https://www.npmjs.com/auth/cli/abc-123");
    });

    it("handles an EOTP object wrapped in a `{type: error, error: {...}}` envelope", () => {
      const out =
        "npm notice Publishing to https://registry.npmjs.org/\n" +
        "npm error code EOTP\n" +
        '{\n  "type": "error",\n  "error": {\n' +
        '    "code": "EOTP",\n' +
        '    "authUrl": "https://www.npmjs.com/auth/cli/def-456",\n' +
        '    "doneUrl": "https://registry.npmjs.org/-/v1/done?authId=def-456"\n' +
        "  }\n}\n";
      const obj = findLastJsonObject(out);
      expect(obj).not.toBeNull();
      expect(obj?.error?.code).toBe("EOTP");
      expect(obj?.error?.authUrl).toBe("https://www.npmjs.com/auth/cli/def-456");
    });

    it("returns null when there is no top-level JSON object", () => {
      expect(findLastJsonObject("just plain text, no JSON here\n")).toBeNull();
    });

    it("picks the LAST top-level JSON object when multiple are present", () => {
      const out =
        "npm notice something\n" +
        '{"notice":"first"}\n' +
        "npm error code EOTP\n" +
        '{"error":{"code":"EOTP","authUrl":"https://www.npmjs.com/auth/cli/last","doneUrl":"https://registry.npmjs.org/-/v1/done?authId=last"}}\n';
      const obj = findLastJsonObject(out);
      expect(obj?.error?.code).toBe("EOTP");
      expect(obj?.error?.authUrl).toBe("https://www.npmjs.com/auth/cli/last");
    });

    it("survives escaped quotes inside JSON string values (regression: hand-rolled string-scope scanner miscounted braces after backslash-escaped quotes)", () => {
      const out =
        '{"error":{"code":"EOTP","detail":"open this URL: https://www.npmjs.com/auth/cli/\\"quoted-id\\"","authUrl":"https://www.npmjs.com/auth/cli/quoted-id","doneUrl":"https://registry.npmjs.org/-/v1/done?authId=quoted-id"}}\n';
      const obj = findLastJsonObject(out);
      expect(obj?.error?.code).toBe("EOTP");
      expect(obj?.error?.authUrl).toBe("https://www.npmjs.com/auth/cli/quoted-id");
      expect(obj?.error?.["detail"]).toContain('"quoted-id"');
    });

    it("survives Unicode escapes and nested `{` inside string values", () => {
      const out =
        '{"error":{"code":"EOTP","detail":"marker { nested } not a brace","authUrl":"https://www.npmjs.com/auth/cli/u","doneUrl":"https://registry.npmjs.org/-/v1/done?authId=u"}}\n';
      const obj = findLastJsonObject(out);
      expect(obj?.error?.code).toBe("EOTP");
      expect(obj?.error?.["detail"]).toContain("{ nested }");
    });

    it("ignores earlier `{...}` blocks that JSON-parse to objects without error.code", () => {
      const out =
        '{"deprecation":"npm tokens that bypass 2FA are being restricted"}\n' +
        "npm notice Publishing to https://registry.npmjs.org/\n" +
        '{"error":{"code":"EOTP","authUrl":"https://www.npmjs.com/auth/cli/real","doneUrl":"https://registry.npmjs.org/-/v1/done?authId=real"}}\n';
      const obj = findLastJsonObject(out);
      expect(obj?.error?.code).toBe("EOTP");
      expect(obj?.error?.authUrl).toBe("https://www.npmjs.com/auth/cli/real");
    });
  });
});
