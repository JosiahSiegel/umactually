// SPDX-License-Identifier: MIT
//
// Tiny ESM loader that rewrites TypeScript's canonical `./foo.js`
// imports to `./foo.ts` so Node 24's `--experimental-transform-types`
// can resolve them as TS source. The CLI runner invokes this loader
// via `--loader=./scripts/review-eval-loader.mjs`.
//
// We do not add new external dependencies; this is a 30-line shim
// that keeps the gate hermetic and self-contained.

import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const TS_EXT = ".ts";
const JS_EXT = ".js";

export function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(JS_EXT)) {
    const tsCandidate = specifier.slice(0, -JS_EXT.length) + TS_EXT;
    try {
      const url = new URL(tsCandidate, context.parentURL ?? pathToFileURL(process.cwd() + "/").href);
      if (existsSync(fileURLToPath(url))) {
        const stat = statSync(fileURLToPath(url));
        if (stat.isFile()) {
          return nextResolve(tsCandidate, context);
        }
      }
    } catch {
      /* fall through */
    }
  }
  return nextResolve(specifier, context);
}
