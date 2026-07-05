#!/usr/bin/env node
/**
 * Tiny static file server used for local visual QA of generated HTML
 * artifacts. Run from the project root:
 *   node scripts/serve-artifacts.mjs
 * Then open http://127.0.0.1:7891/summary-layouts.html in a browser.
 *
 * Stop with Ctrl-C. NOT for production use — no auth, no caching,
 * single-threaded, no logging.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "artifacts", "manual");
const PORT = Number(process.env.PORT ?? 7891);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    const fullPath = normalize(join(ROOT, rel));
    if (!fullPath.startsWith(ROOT)) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("forbidden");
      return;
    }
    const data = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end(`not found: ${req.url}\n${err.message}`);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[serve-artifacts] http://127.0.0.1:${PORT}  (root: ${ROOT})`);
});