# Distribution architecture

umactually (v0.6.0+) ships three install paths. This doc explains how
they relate and which to use when.

## Overview

| Path | Download | On disk | Use when |
|---|---|---|---|
| `npm install -g umactually` | ~330 KB | ~1.2 MB unpacked | You already have Node 24+ or Bun 1.1+ |
| `npx umactually` (one-shot) | ~330 KB (cached after first use) | same as above | You don't want a global install |
| `bunx umactually` | ~330 KB | same as above | You use Bun |
| `curl … \| sh` (smart-router) | 0 KB if Node 24+ found, else ~30 MB | same as the chosen path | You don't know what's installed, want one command |
| Direct binary download | ~30 MB (gzipped) | ~70 MB (uncompressed) | No Node 24+ available, locked-down machine, minimal container |

The curl-pipe installer is the recommended path for "I just want to install this". It automatically picks the best of the two non-npm paths based on what's available on the system.

## Why three paths

- **npm** is the canonical JavaScript distribution. It's how the rest of the JS ecosystem ships. It uses the user's existing runtime (no extra bloat).
- **Smart-router (curl|sh)** lowers the barrier to entry for users who don't know they have Node. Most developers have it; many don't realize. The installer handles either case.
- **Direct binary download** is the fallback for users who genuinely can't install Node — corporate dev machines with locked-down runtimes, minimal containers, sysadmins who want one self-contained executable. The binary bundles Node 25.7, so it runs on any system.

We don't recommend the direct-binary path for most users because it's ~30 MB instead of ~330 KB.

## How the smart-router decides

`scripts/install.sh` (and `scripts/install.ps1`) run this logic at the very top, before any network work:

```sh
# Parse Node version
NODE_VER=$(node -v 2>/dev/null || true)
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/^v//' | cut -d. -f1)
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -ge 24 ] 2>/dev/null; then
  echo "Node $NODE_VER detected, using npm install"
  npm install -g umactually && exit 0
  # If npm install fails, fall through to the binary download
fi
# … existing binary download logic …
```

Bypass with `INSTALL_FORCE_BINARY=1` to skip the npm check.

The PowerShell equivalent follows the same shape (`Get-Command node`, parse major from `node -v` output, gate on >= 24, run `npm install -g umactually`).

## Build pipeline

Three build steps produce the release artifacts:

1. **npm package** — `npm run bundle` runs ncc against `src/cli.ts`, producing `dist/cli.js` (~800 KB unminified, ~250 KB gzipped). The package layout is standard npm.

2. **Node SEA single-file binary** — `node scripts/build-sea.mjs all` runs `tsdown --exe` once per platform/arch, producing 6 binaries in `release/umactually-<id>`. Each binary bundles Node 25.7 and the bundled `dist/cli.js`. Sizes:
   - linux-x64:  ~70 MB raw, ~28 MB gzipped
   - linux-arm64: ~68 MB raw, ~27 MB gzipped
   - darwin-x64:  ~72 MB raw, ~29 MB gzipped
   - darwin-arm64: ~70 MB raw, ~28 MB gzipped
   - windows-x64: ~72 MB raw, ~28 MB gzipped
   - windows-arm64: ~70 MB raw, ~28 MB gzipped
   (Exact numbers depend on the Node 25.7 patch version; pinned to 25.7.0 in tsdown.config.ts.)

3. **Release archives** — `node scripts/package-release-assets.mjs` zips/tars the 6 binaries into `umactually-<id>.{tar.gz,zip}` and writes `checksums.txt` (SHA-256 manifest).

The release workflow (`.github/workflows/release.yml`) runs all three steps on tag-push or `workflow_dispatch`.

## Cross-platform builds

`@tsdown/exe` downloads the target Node binary from `nodejs.org` to cross-compile. The build job runs on `ubuntu-24.04` and produces all 6 platform/arch binaries without needing macOS/Windows runners. This is why the workflow matrix is now `[ubuntu-24.04]` for the build job, with the per-target smoke jobs running on the native OS.

## Why drop Bun

The original v0.5.x release used Bun's `--compile` to produce the single-file binary. Bun's runtime is huge (~94 MB uncompressed) and the team has explicitly deprioritized slimming it. In 2026 the official Node SEA path (added in Node 25.5.0 by Joyee Cheung) is smaller, official, and has no third-party maintenance risk. The bin shim already gates on `engines.node >= 24`; the binary path now bundles Node 25.7 instead of Bun. We tested yao-pkg (Node 22, 25.4 MB gzipped) and esbuild (no change) — neither beat Node SEA. We tested Deno compile (90 MB / 33 MB gzipped, similar) — not worth the lock-in.

## What we don't do

- **No UPX compression of the binary.** UPX adds 30-40% savings but ~80ms cold-start (transparent decompression). Not worth the trade-off for a CLI that's used interactively.
- **No QuickJS / Duktape.** The runtime API surface we need (Node 24 fetch, streams, fs/promises) isn't available in lighter runtimes. Would require a partial rewrite.
- **No static linking of Node.** Possible in theory (musl Node), but Node 25.7 doesn't ship a fully-static build. Would require maintaining a custom Node fork.

## Future work

- v0.7.0: consider publishing a Homebrew tap, a Scoop bucket, and an apt repository for the binary path. (Out of scope for v0.6.0.)
- v0.8.0: re-evaluate binary adoption via GitHub Releases download counts. If npm install accounts for >95% of installs, drop the binary path. (Unlikely — corporate users still need it.)
- v1.0.0: pin the bundle Node version to whatever's LTS at the time. SEA backports to Node 24 LTS are tracked in nodejs/node#53605.
