// SPDX-License-Identifier: MIT
// Ambient compile-time constants injected by Bun's --define flag.
//
// In Bun --compile standalone builds, `--define UMACTUALLY_VERSION='"<version>"'`
// replaces bare references to this identifier with a string literal at compile
// time. This declaration makes the identifier visible to TypeScript without
// triggering "Cannot find name" errors.
//
// In Node (npm/dev) usage, the identifier is undefined and code falls back to
// reading package.json from disk.
declare const UMACTUALLY_VERSION: string | undefined;
