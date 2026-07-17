#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Local HTTP fixture server for POSIX installer archive-mode tests.
//
// What it serves:
//   GET /repos/<owner>/<repo>/releases/latest
//     -> JSON { tag_name, draft, prerelease, ... }
//   GET /releases/download/<tag>/<file>
//     -> File contents from --release-dir (the manifest's archive/member files
//        and checksums.txt). Anything not in --release-dir returns 404.
//   GET /raw/<owner>/<repo>/<branch>/<file>
//     -> File contents from --raw-dir (for INSTALL_POWERSHELL_SCRIPT_URL).
//   ANY /__set/<key>=<value>
//     -> Mutate a server-side state flag. Used by tests to flip a fixture
//        (e.g. tag -> "v0.5.0", prerelease -> true, etc.).
//   ANY /__seed/<basename>
//     -> Replace the served bytes for /releases/download/<tag>/<basename>
//        with the request body for the rest of the server lifetime.
//        Tests use this to swap in hostile archives without touching disk.
//
// Listens on a random localhost port. Prints `PORT=<port>` on stdout when
// ready, then nothing else. Stops cleanly on SIGTERM / SIGINT.
//
// Args:
//   --release-dir <dir>      Files served under /releases/download/<tag>/*
//   --raw-dir <dir>          Files served under /raw/<owner>/<repo>/<branch>/*
//   --release-tag <tag>      Initial tag (default: v0.5.0)
//   --release-prerelease     Set prerelease: true in the latest JSON
//   --release-draft          Set draft: true in the latest JSON
//   --release-missing        404 every /releases/latest request
//   --release-status <n>     Override latest-JSON status code (default 200)

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
function flag(name, fallback = undefined) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1];
}
function boolFlag(name) {
  return args.includes(name);
}

const releaseDir = flag("--release-dir", "");
const rawDir = flag("--raw-dir", "");
let tag = flag("--release-tag", "v0.5.0");
let prerelease = boolFlag("--release-prerelease");
let draft = boolFlag("--release-draft");
const missing = boolFlag("--release-missing");
const statusOverride = Number(flag("--release-status", "0")) || 200;

// In-memory overrides for served archive bytes (replaces releaseDir contents
// for a given basename without changing disk state). Cleared on server restart.
const seededBytes = new Map();
const servedLatest = {
  tag_name: tag,
  draft,
  prerelease,
  html_url: `https://github.com/JosiahSiegel/umactually/releases/tag/${tag}`,
  assets: [],
};

function safeJoin(root, requested) {
  // Reject any traversal attempt. Path.resolve against the root, then verify
  // the resolved path stays inside the root.
  if (root === "") return null;
  const absolute = normalize(join(root, requested));
  const rootSep = root.endsWith(sep) ? root : root + sep;
  if (absolute !== root && !absolute.startsWith(rootSep)) return null;
  if (!existsSync(absolute)) return null;
  const stat = statSync(absolute);
  if (!stat.isFile()) return null;
  return absolute;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const url = request.url ?? "/";

  // Test controls. /__set updates a flag; /__seed replaces archive bytes.
  if (url.startsWith("/__set/")) {
    const spec = url.slice("/__set/".length);
    const eq = spec.indexOf("=");
    if (eq < 0) {
      response.writeHead(400);
      response.end("bad /__set spec");
      return;
    }
    const key = spec.slice(0, eq);
    const value = spec.slice(eq + 1);
    if (key === "tag") {
      tag = value;
      servedLatest.tag_name = value;
    } else if (key === "prerelease") {
      prerelease = value === "true";
      servedLatest.prerelease = prerelease;
    } else if (key === "draft") {
      draft = value === "true";
      servedLatest.draft = draft;
    }
    response.writeHead(204);
    response.end();
    return;
  }
  if (method === "POST" && url.startsWith("/__seed/")) {
    const basename = decodeURIComponent(url.slice("/__seed/".length));
    const body = await readBody(request);
    seededBytes.set(basename, body);
    response.writeHead(204);
    response.end();
    return;
  }

  // GitHub latest-release JSON. Use a permissive pattern so tests can vary
  // owner/repo and probe the actual request path the installer hits.
  const latestMatch = /^\/repos\/([^/]+)\/([^/]+)\/releases\/latest\/?$/.exec(url);
  if (method === "GET" && latestMatch !== null) {
    if (missing) {
      sendJson(response, 404, { message: "Not Found" });
      return;
    }
    sendJson(response, statusOverride, servedLatest);
    return;
  }

  // Immutable asset directory. The installer constructs
  //   ${BASE}/${TAG}/<basename>
  // where BASE may be the GitHub canonical "/releases/download" prefix OR
  // the bare fixture origin in tests. Accept both shapes, but ONLY at the
  // path root (so /repos/owner/releases/latest is not mistaken for an
  // asset path).
  if (method === "GET" && (url.startsWith("/releases/download/") || url.startsWith("/v"))) {
    let dlMatch = /^\/releases\/download\/([^/]+)\/(.+)$/.exec(url);
    if (dlMatch === null) {
      dlMatch = /^\/(v[^/]+)\/(.+)$/.exec(url);
    }
    if (dlMatch !== null) {
      const basename = decodeURIComponent(dlMatch[2]);
      if (seededBytes.has(basename)) {
        response.writeHead(200, { "content-type": "application/octet-stream" });
        response.end(seededBytes.get(basename));
        return;
      }
      if (releaseDir === "") {
        response.writeHead(404);
        response.end("release-dir not configured");
        return;
      }
      const absolute = safeJoin(releaseDir, basename);
      if (absolute === null) {
        response.writeHead(404);
        response.end(`not found: ${basename}`);
        return;
      }
      response.writeHead(200, { "content-type": "application/octet-stream" });
      response.end(readFileSync(absolute));
      return;
    }
  }

  // Raw file content for INSTALL_POWERSHELL_SCRIPT_URL and friends.
  // Shape: /raw/<owner>/<repo>/<branch>/<file...>
  const rawMatch = /^\/raw\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  if (method === "GET" && rawMatch !== null) {
    if (rawDir === "") {
      response.writeHead(404);
      response.end("raw-dir not configured");
      return;
    }
    const basename = decodeURIComponent(rawMatch[4]);
    const absolute = safeJoin(rawDir, basename);
    if (absolute === null) {
      response.writeHead(404);
      response.end(`not found: ${basename}`);
      return;
    }
    response.writeHead(200, { "content-type": "text/plain" });
    response.end(readFileSync(absolute, "utf8"));
    return;
  }

  sendJson(response, 404, { message: `unexpected ${method} ${url}` });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address === null || typeof address === "string") {
    console.error("server failed to bind");
    process.exit(1);
  }
  process.stdout.write(`PORT=${address.port}\n`);
});

// Graceful shutdown so the parent test harness doesn't see exit codes.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
