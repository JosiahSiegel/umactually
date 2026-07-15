import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts", "test/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "scenario",
          include: ["test/scenario/**/*.test.ts", "test/scenarios/**/*.test.ts", "test/**/*.scenario.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.test.ts"],
          // E2E suite is opt-in: the dev machine without the key
          // reports every test as skipped rather than failing. Use
          // `npm run test:e2e` to actually exercise the suite.
          bail: 1,
          testTimeout: 120_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
