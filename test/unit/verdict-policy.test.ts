import { describe, expect, it } from "vitest";

import { mapVerdictToAzureStatus } from "../../src/util/verdict.js";

describe("mapVerdictToAzureStatus", () => {
  it("NEEDS_FIX → pending", () => {
    expect(mapVerdictToAzureStatus("NEEDS_FIX")).toBe("pending");
  });

  it("APPROVED / COMMENT / DISCUSS / SHIP → succeeded", () => {
    expect(mapVerdictToAzureStatus("APPROVED")).toBe("succeeded");
    expect(mapVerdictToAzureStatus("COMMENT")).toBe("succeeded");
    expect(mapVerdictToAzureStatus("DISCUSS")).toBe("succeeded");
    expect(mapVerdictToAzureStatus("SHIP")).toBe("succeeded");
  });

  it("unknown verdict → pending (safe default; live CLI never crashes)", () => {
    expect(mapVerdictToAzureStatus("UNKNOWN")).toBe("pending");
    expect(mapVerdictToAzureStatus("")).toBe("pending");
    expect(mapVerdictToAzureStatus("needs_fix")).toBe("pending");
  });
});
