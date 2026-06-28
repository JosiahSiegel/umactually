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
    ],
  },
});
