import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./test/setup.ts"],
    // Coverage config used by `npm run test:coverage` (consumed by the
    // sonarqube-scan job in .github/workflows/ci.yml). The lcov.info output
    // is read by SonarCloud via sonar.javascript.lcov.reportPaths.
    // v8 provider chosen over istanbul because istanbul adds a transform
    // pass that breaks Node 25.6 SEA builds and doesn't change the
    // percentage materially for this codebase size.
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text", "text-summary"],
      reportsDirectory: "./coverage",
      // src/ + bin/ mirror sonar.sources=src,bin in sonar-project.properties.
      // scripts/ is excluded here AND in sonar.coverage.exclusions so both
      // metrics agree that scripts/ isn't measured (CI/release glue).
      include: ["src/**/*.ts", "bin/**/*.mjs"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "release/**",
        "artifacts/**",
        "test/**",
        "**/*.test.ts",
        "**/*.scenario.test.ts",
        "**/*.e2e.test.ts",
        "**/*.d.ts",
        "test/setup.ts",
        "scripts/**",
      ],
    },
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
