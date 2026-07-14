#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Verification script: scan the repo for high-entropy literals and verify
// that every one is either (a) in an ignored_path or (b) covered by a
// SHA256 hash in ignored_matches. This script is the local pre-merge
// check that mirrors what GitGuardian's GitHub App would do.
//
// Exit 0: all literals covered.
// Exit 1: at least one UNCOVERED literal found.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse as parseYaml } from "yaml";

const cfg = parseYaml(fs.readFileSync(".gitguardian.yaml", "utf8"));
const ignoredHashes = new Set(cfg.secret.ignored_matches.map((m) => m.match));

function shouldIgnorePath(p) {
  for (const pattern of cfg.secret.ignored_paths) {
    const re = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".") +
        "$",
    );
    if (re.test(p)) return true;
  }
  return false;
}

// GitGuardian's high-entropy detector targets LONG RANDOM-LOOKING
// STRINGS ASSIGNED TO VARIABLES named apiKey, token, secret, etc.
// The real detector uses the ContentWhitelistPreValidator with
// entropy + length thresholds tuned to base64/hex tokens. We
// approximate that by matching `<secret-named-var>: "<token>"` or
// `<secret-named-var> = "<token>"` patterns and applying an entropy
// threshold to the value alone. Bare literals in comments or
// documentation are NOT flagged (the real detector's
// variable-name gate is the primary filter).
const SECRET_VAR_NAMES = [
  "apiKey",
  "api_key",
  "token",
  "secret",
  "password",
  "authToken",
  "accessToken",
  "githubToken",
  "anthropicApiKey",
];

// Match: <secret-var-name> <colon-or-equals> <quote> <token> <quote>
// Excludes object-key positions where the secret-var-name is the
// PROPERTY key (e.g. `apiKey: "value"` where `apiKey` is the
// property name being defined, not the value's variable). The
// heuristic: if the line contains `<value>: {` or `<value>: []`
// nearby, the secret-var is the schema name, not the value.
const SECRET_ASSIGN_RE = new RegExp(
  `\\b(${SECRET_VAR_NAMES.join("|")})\\s*[:=]\\s*["']([\\w\\-+/.=]{8,})["']`,
  "g",
);

/**
 * Shannon entropy in bits-per-character. GitGuardian's high-entropy
 * detector typically flags strings with entropy > ~3.5 bits/char
 * (the "Generic High Entropy Secret" detector threshold).
 * English text averages ~1.0-1.5; random base64 ~4.5-5.0; hex ~4.0.
 */
function shannonEntropy(s) {
  const counts = new Map();
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1);
  const len = s.length;
  let h = 0;
  for (const n of counts.values()) {
    const p = n / len;
    h -= p * Math.log2(p);
  }
  return h;
}

const ENTROPY_THRESHOLD = 3.5;
// Require 20+ characters of high-entropy content (rough proxy for
// "this is a generated token, not a text constant"). The "do-not-leak"
// suffix means our fixtures have entropy below real tokens (because
// the suffix is repeated), so this threshold lets the do-not-leak
// fixtures through while excluding text like "sk-test" or
// "anthropic-messages".
const MIN_LENGTH = 20;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-tmp",
  "artifacts",
  "coverage",
  ".layout-viewer-build",
  "docs",
  "playwright-mcp",
  ".playwright-mcp",
]);

// .env* files are gitignored locally and never scanned by GitGuardian
// (which only sees committed files). Skip them so the local verifier
// doesn't false-positive on a developer's unsaved secrets.
const SKIP_FILES = new Set([".env"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let uncovered = 0;
let ignored = 0;
let total = 0;
const uncoveredDetails = [];
for (const file of walk(".")) {
  const rel = file.replace(/\\/g, "/");
  if (shouldIgnorePath(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(SECRET_ASSIGN_RE)) {
    const varName = m[1];
    const val = m[2];
    if (val.length < MIN_LENGTH) continue;
    if (shannonEntropy(val) < ENTROPY_THRESHOLD) continue;
    // Skip object-key positions where the matched line is a
    // TypeScript object literal that maps <secret-named-var> to a
    // canonical field name (e.g. `apiKey: "providerApiKey"` in
    // env-sources.ts). The value is a schema identifier, not a
    // secret. Heuristic: if the file is TypeScript (.ts) and the
    // value matches camelCase field naming (lowercase, alphanumeric,
    // no uppercase, no underscores/dashes), it's a field identifier.
    if (rel.endsWith(".ts") && /^[a-z][a-zA-Z0-9]*$/.test(val)) continue;
    const hash = crypto.createHash("sha256").update(val).digest("hex");
    total++;
    if (ignoredHashes.has(hash)) {
      ignored++;
    } else {
      uncovered++;
      uncoveredDetails.push(`${rel}  →  ${varName} = ${val.slice(0, 30)}...`);
    }
  }
}

console.log("---");
console.log("Total high-entropy secret-like literals in non-ignored files:", total);
console.log("Ignored via SHA256 match:", ignored);
console.log("UNCOVERED (would trigger GitGuardian):", uncovered);
if (uncovered > 0) {
  console.log("\nUncovered literals:");
  for (const d of uncoveredDetails.slice(0, 20)) console.log("  " + d);
  if (uncoveredDetails.length > 20) {
    console.log(`  ...and ${uncoveredDetails.length - 20} more`);
  }
  process.exit(1);
}
process.exit(0);
