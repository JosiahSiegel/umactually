// Pins the verdict-mapping policy split:
//   - "current" policy (live CLI): NEEDS_FIX → "pending", unknowns → "pending"
//   - "legacy" policy (S4 fixture): NEEDS_FIX → "failed", unknowns THROW
//
// The legacy-throws behavior preserves the original `assertNever(verdict)`
// guard from `src/azure/run-azure-review.ts:118` (the S4 RED contract
// pins `postedStatusState: "failed"` for `verdict: "NEEDS_FIX"`).
import { describe, expect, it } from "vitest";

import { mapVerdictToAzureStatus } from "../../src/util/verdict.js";

describe("mapVerdictToAzureStatus: current policy (live CLI)", () => {
  it("NEEDS_FIX → pending", () => {
    expect(mapVerdictToAzureStatus("NEEDS_FIX", "current")).toBe("pending");
  });

  it("APPROVED / COMMENT / DISCUSS / SHIP → succeeded", () => {
    expect(mapVerdictToAzureStatus("APPROVED", "current")).toBe("succeeded");
    expect(mapVerdictToAzureStatus("COMMENT", "current")).toBe("succeeded");
    expect(mapVerdictToAzureStatus("DISCUSS", "current")).toBe("succeeded");
    expect(mapVerdictToAzureStatus("SHIP", "current")).toBe("succeeded");
  });

  it("unknown verdict → pending (safe default; live CLI never crashes)", () => {
    expect(mapVerdictToAzureStatus("UNKNOWN", "current")).toBe("pending");
    expect(mapVerdictToAzureStatus("", "current")).toBe("pending");
    expect(mapVerdictToAzureStatus("needs_fix", "current")).toBe("pending");
  });
});

describe("mapVerdictToAzureStatus: legacy policy (S4 fixture)", () => {
  it("NEEDS_FIX → failed (S4 RED contract)", () => {
    expect(mapVerdictToAzureStatus("NEEDS_FIX", "legacy")).toBe("failed");
    // Case-insensitive: "needs_fix" normalizes to "NEEDS_FIX" → "failed".
    expect(mapVerdictToAzureStatus("needs_fix", "legacy")).toBe("failed");
  });

  it("APPROVED → succeeded", () => {
    expect(mapVerdictToAzureStatus("APPROVED", "legacy")).toBe("succeeded");
  });

  it("unknown verdict THROWS (preserves assertNever behavior)", () => {
    expect(() => mapVerdictToAzureStatus("UNKNOWN", "legacy")).toThrow(TypeError);
    expect(() => mapVerdictToAzureStatus("", "legacy")).toThrow(TypeError);
    expect(() => mapVerdictToAzureStatus("shipped", "legacy")).toThrow(TypeError);
  });

  it("unknown verdict error message redacts the raw verdict", () => {
    const rawVerdict = "PRIVATE verdict\nwith control chars";

    expect(() => mapVerdictToAzureStatus(rawVerdict, "legacy")).toThrow(/len=34, sha256=[0-9a-f]{12}/u);
    expect(() => mapVerdictToAzureStatus(rawVerdict, "legacy")).not.toThrow(rawVerdict);
  });
});

