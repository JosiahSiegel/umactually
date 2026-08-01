// The unit tests assume a clean provider-config env (no UMACTUALLY_API_URL,
// UMACTUALLY_API_KEY, UMACTUALLY_PROVIDER, UMACTUALLY_MODEL). When a
// contributor runs `npm test` after `source .env` those vars leak in and
// the cli-dry-run prompt-gate tests fail with `expected exit 2 / got
// exit 0` because the CLI skips the validation gate. Scrub them here so
// `npm test` behaves the same locally as it does in CI.
const SCRUB_VARS = ["UMACTUALLY_API_URL", "UMACTUALLY_API_KEY", "UMACTUALLY_PROVIDER", "UMACTUALLY_MODEL"] as const;
for (const key of SCRUB_VARS) {
  delete process.env[key];
}
export {};
