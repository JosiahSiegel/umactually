# Security policy

## Report a vulnerability

Please do **not** open a public issue for a suspected vulnerability. Use a [private GitHub security advisory](https://github.com/JosiahSiegel/umactually/security/advisories/new). If the advisory form is unavailable, contact the maintainers through the repository's private security channel before sharing exploit details.

Include the affected version or commit, impact, reproduction steps, and a minimal fixture. Redact credentials and personal data. We acknowledge reports as promptly as practical, investigate reproducibly, and coordinate disclosure after a fix or mitigation is available.

For non-sensitive bugs, use the [bug report template](https://github.com/JosiahSiegel/umactually/issues/new?template=bug.yml). For questions and usage support, use [GitHub Discussions](https://github.com/JosiahSiegel/umactually/discussions).

## Security boundaries

The runtime treats pull-request text, diffs, repository instruction files, prompt files, and event metadata as untrusted. Secrets must arrive through the platform secret store or environment and are never intended for committed configuration. Findings are validated against the supplied diff before posting. Read the detailed [security model](docs/security.md) for redaction, path safety, provider, platform, and privacy guarantees.

## Supported versions

Use the current release for security fixes. Pin releases in CI and consult [`CHANGELOG.md`](CHANGELOG.md) for mitigations. GitHub Enterprise Server support, permissions, and version constraints are documented in [`docs/gh-actions.md`](docs/gh-actions.md).
