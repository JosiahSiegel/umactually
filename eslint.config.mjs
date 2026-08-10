import js from "@eslint/js";
import tseslint from "typescript-eslint";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const noopRule = {
  meta: { type: "problem", schema: [], messages: {} },
  create() {
    return {};
  },
};

// Add a noop alias for `@typescript-eslint/no-throw-literal` so that
// pre-existing `// eslint-disable-next-line @typescript-eslint/no-throw-literal`
// comments remain valid under typescript-eslint v8 (the rule was renamed to
// `@typescript-eslint/only-throw-error`). The rule itself stays off in the
// config below, so this only silences the "Definition for rule not found"
// diagnostic from the disable-directive parser.
if (tsPlugin.rules) {
  tsPlugin.rules["no-throw-literal"] = noopRule;
}

export default tseslint.config(
  {
    ...js.configs.recommended,
    ignores: ["**/*.mjs", "**/*.mts"],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["src/**/*.ts", "test/**/*.ts", "scripts/**/*.ts", "scripts/**/*.mts", "vitest.config.ts"],
  })),
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ["src/**/*.ts", "test/**/*.ts", "scripts/**/*.ts", "scripts/**/*.mts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-throw-literal": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-template-curly-in-string": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "no-console": "warn",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-regex-spaces": "off",
      "no-control-regex": "off",
      "no-irregular-whitespace": "off",
      "no-unused-vars": "off",
      "no-undef": "off",
      "prefer-const": "off",
    },
  },
  {
    files: ["test/**/*.ts", "test/**/*.mts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-template-curly-in-string": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "bin/**", "scripts/lib/**", "**/*.d.ts", "**/*.d.mts"] },
);
