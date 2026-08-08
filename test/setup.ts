const SCRUB_VARS = [
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_API_URL",
  "UMACTUALLY_GITHUB_API_BASE",
  "UMACTUALLY_MODEL",
  "UMACTUALLY_PROVIDER",
] as const;
for (const key of SCRUB_VARS) {
  delete process.env[key];
}
export {};
