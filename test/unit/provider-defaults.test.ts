import { describe, expect, it } from "vitest";

import {
  DEFAULT_ANTHROPIC_URL,
  DEFAULT_GITHUB_API_BASE,
  DEFAULT_OPENAI_URL,
} from "../../src/util/provider-defaults.js";

describe("DRY-DEFAULTS: provider/platform URL defaults SSOT", () => {
  it("DRY-DEFAULTS-001: DEFAULT_OPENAI_URL matches the canonical OpenAI base URL", () => {
    expect(DEFAULT_OPENAI_URL).toBe("https://api.openai.com/v1");
  });

  it("DRY-DEFAULTS-002: DEFAULT_ANTHROPIC_URL matches the canonical Anthropic base URL", () => {
    expect(DEFAULT_ANTHROPIC_URL).toBe("https://api.anthropic.com/v1");
  });

  it("DRY-DEFAULTS-003: DEFAULT_GITHUB_API_BASE matches the canonical GitHub API base URL", () => {
    expect(DEFAULT_GITHUB_API_BASE).toBe("https://api.github.com");
  });
});