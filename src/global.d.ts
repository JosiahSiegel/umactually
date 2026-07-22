// SPDX-License-Identifier: MIT
// Ambient compile-time constants injected at build time.
//
// In Bun --compile standalone builds, `--define UMACTUALLY_VERSION='"<version>"'`
// replaces bare references to this identifier with a string literal at compile
// time. The v0.6.0 distribution pipeline uses tsdown + Node SEA instead of
// Bun --compile, but the replacement mechanism is the same: tsdown's `define`
// config (see tsdown.config.ts) maps `UMACTUALLY_VERSION` to the package
// version JSON, and rolldown substitutes the bare identifier at bundle time.
// This declaration makes the identifier visible to TypeScript without
// triggering "Cannot find name" errors.
//
// In Node (npm/dev) usage, the identifier is undefined and code falls back to
// reading package.json from disk.
declare const UMACTUALLY_VERSION: string | undefined;
