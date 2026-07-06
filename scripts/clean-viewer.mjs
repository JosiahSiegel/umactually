#!/usr/bin/env node
/**
 * Remove the viewer's transient build directory (.layout-viewer-build/).
 * Idempotent — exits 0 when the directory is already gone.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(here, "..", ".layout-viewer-build");

if (existsSync(BUILD_DIR)) {
  rmSync(BUILD_DIR, { recursive: true, force: true });
  console.log(`[clean-viewer] removed ${BUILD_DIR}`);
} else {
  console.log(`[clean-viewer] nothing to do (${BUILD_DIR} does not exist)`);
}
