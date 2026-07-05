#!/usr/bin/env node
/**
 * Local viewer for the 20 review summary layouts defined in
 * `src/render/summary-layouts.ts`.
 *
 * Renders every layout against three sample datasets:
 *   1. Clean review (no findings) — shows how each layout renders "all clear"
 *   2. Busy review (many findings across severities + off-diff) — shows the data-rich case
 *   3. Parse-failed fallback — shows how each layout handles the failure path
 *
 * Output:
 *   - artifacts/manual/summary-layouts.html   — single HTML page, GitHub markdown styling
 *   - artifacts/manual/summary-layouts.json   — raw markdown for every (layout × sample)
 *
 * Usage:
 *   node scripts/view-summary-layouts.mjs
 *   node scripts/view-summary-layouts.mjs --samples=clean,busy
 *
 * The script compiles `src/render/summary-layouts.ts` to
 * `.layout-viewer-build/` on demand (idempotent — re-uses existing
 * output if the source hasn't changed). Run `node scripts/clean-viewer.mjs`
 * to remove the build output.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BUILD_DIR = join(ROOT, ".layout-viewer-build");
const LAYOUTS_SRC = join(ROOT, "src", "render", "summary-layouts.ts");
const LAYOUTS_OUT = join(BUILD_DIR, "render", "summary-layouts.js");
const ARTIFACTS_DIR = join(ROOT, "artifacts", "manual");
const HTML_OUT = join(ARTIFACTS_DIR, "summary-layouts.html");
const JSON_OUT = join(ARTIFACTS_DIR, "summary-layouts.json");
const MARKDOWN_OUT = join(ARTIFACTS_DIR, "summary-layouts.md");

// ---------------------------------------------------------------------------
// 1. Compile layouts module on demand
// ---------------------------------------------------------------------------

function ensureBuild() {
  if (existsSync(LAYOUTS_OUT)) {
    // Cheap staleness check — re-compile if the source mtime is newer.
    const srcMtime = statMtime(LAYOUTS_SRC);
    const outMtime = statMtime(LAYOUTS_OUT);
    if (srcMtime <= outMtime) return;
    console.log("[viewer] source changed — rebuilding");
  }
  if (existsSync(BUILD_DIR)) rmSync(BUILD_DIR, { recursive: true, force: true });
  mkdirSync(BUILD_DIR, { recursive: true });
  console.log("[viewer] compiling layouts module...");
  // On Windows, .cmd shims require shell:true to spawn. All arguments
  // are static (no user input) so the shell interpolation surface is
  // empty; this is the standard pattern for invoking npm/npx shims on
  // win32.
  const isWin = process.platform === "win32";
  execFileSync(
    isWin ? "npx.cmd" : "npx",
    [
      "tsc",
      LAYOUTS_SRC,
      "--outDir",
      BUILD_DIR,
      "--module",
      "nodenext",
      "--moduleResolution",
      "nodenext",
      "--target",
      "es2024",
      "--strict",
      "--esModuleInterop",
      "--skipLibCheck",
    ],
    { cwd: ROOT, stdio: "inherit", shell: isWin },
  );
}

function statMtime(p) {
  return readFileSync(p).atimeMs; // good enough for staleness
}

// ---------------------------------------------------------------------------
// 2. Sample data
// ---------------------------------------------------------------------------

function sampleClean() {
  return {
    review: {
      summary: "Diff looks clean — no concerns surfaced.",
      verdict: "APPROVED",
      comments: [],
      suppressedComments: [],
    },
    provider: "openai-compatible",
    modelId: "gpt-5",
    validCommentCount: 0,
    suppressedCommentCount: 0,
    severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    offDiffFromComments: [],
    postedComments: [],
    secrets: [],
  };
}

function sampleBusy() {
  const comments = [
    {
      path: "src/auth/jwt.ts",
      line: 34,
      body: "Hardcoded signing secret. Move to `process.env.JWT_SECRET` and load via `dotenv` before any code path that may invoke `sign()`.",
      severity: "critical",
      category: "security",
    },
    {
      path: "src/db/pool.ts",
      line: 88,
      body: "Connection is leaked when `query()` rejects. Wrap the `conn` in a `try { ... } finally { conn.release(); }` block.",
      severity: "critical",
      category: "bug",
    },
    {
      path: "src/api/users.ts",
      line: 201,
      body: "Unhandled promise rejection — `await this.fetchProfile(id)` is inside a `void` callback with no `.catch`.",
      severity: "high",
      category: "reliability",
    },
    {
      path: "src/util/parse-claims.ts",
      line: 14,
      body: "Function cyclomatic complexity is 18 — split into `parseExp`, `parseIat`, `parseAud` for testability.",
      severity: "medium",
      category: "maintainability",
    },
    {
      path: "src/index.ts",
      line: 5,
      body: "Missing JSDoc block on the exported `createApp()` function.",
      severity: "low",
      category: "style",
    },
    {
      path: "README.md",
      line: 1,
      body: "Trailing whitespace on first line.",
      severity: "low",
      category: "style",
    },
  ];
  const suppressed = [
    {
      path: "src/legacy/sessions.ts",
      line: 142,
      body: "Outdated comment references v2 API. (Off-diff — file deleted by this PR.)",
      severity: "low",
      category: "style",
    },
  ];
  return {
    review: {
      summary: "Reviewed the auth refactor in this PR. Two blockers (hardcoded secret, leaked connection), one reliability issue, and a couple of minor style nits. The structural split of the parse functions is a good call — keep that direction. Address the blockers before merging.",
      verdict: "NEEDS_FIX",
      comments: comments.slice(0, 6),
      suppressedComments: suppressed,
    },
    provider: "openai-compatible",
    modelId: "claude-opus-4-5",
    validCommentCount: 6,
    suppressedCommentCount: 1,
    severityCounts: { critical: 2, high: 1, medium: 1, low: 2 },
    offDiffFromComments: suppressed,
    postedComments: comments.slice(0, 6),
    secrets: ["sk-EXAMPLE-FAKE-1234567890"],
  };
}

function sampleParseFailed() {
  return {
    review: {
      summary:
        "Provider response did not contain a valid JSON review payload.\n\n<details>\n<summary>📨 Raw provider response (truncated)</summary>\n\n```text\n[truncated]\n```\n\nProvider: `openai-compatible` · Model: `gpt-5`\n</details>",
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [],
      parseFailed: true,
    },
    provider: "openai-compatible",
    modelId: "gpt-5",
    validCommentCount: 0,
    suppressedCommentCount: 0,
    severityCounts: {},
    offDiffFromComments: [],
    postedComments: [],
    secrets: [],
  };
}

// ---------------------------------------------------------------------------
// 3. Render every layout against every sample
// ---------------------------------------------------------------------------

function renderAll(layouts) {
  const samples = [sampleClean(), sampleBusy(), sampleParseFailed()];
  const sampleLabels = ["clean", "busy", "parse-failed"];
  const out = {};
  for (const layout of layouts) {
    out[layout] = {};
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];
      out[layout][sampleLabels[i]] = layouts.renderSummary(layout, sample);
    }
  }
  return { out, sampleLabels };
}

// ---------------------------------------------------------------------------
// 4. Minimal GFM markdown → HTML renderer
// ---------------------------------------------------------------------------
// We deliberately use a self-contained renderer (no external deps) so
// the viewer stays a single-file artifact. It covers every GFM feature
// the 20 layouts use: headings, bold, italic, strike, code, fenced
// blocks, blockquote, lists (ordered/unordered), tables, hr, links.

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip hidden HTML comments (the marker + manifest) the same way
 * GitHub and Azure DevOps strip them when rendering a PR comment.
 * The viewer should reflect what the reader actually sees on the PR,
 * not the raw source string. Real platforms hide `<!-- … -->` so the
 * viewer must too — otherwise the layout looks visually cluttered by
 * raw manifest JSON that no real user would ever see.
 */
function stripHiddenComments(md) {
  return md.replace(/<!--[\s\S]*?-->/gu, "");
}

function renderInline(text) {
  // Bold, italic, strike, code, links, emoji
  let out = escapeHtml(text);
  // Inline code (must come first so we don't re-escape its content)
  out = out.replace(/`([^`\n]+?)`/g, (_, code) => `<code>${code}</code>`);
  // Bold then italic — order matters
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|\W)\*([^*\n]+?)\*(?=\W|$)/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~\n]+?)~~/g, "<del>$1</del>");
  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}" rel="noopener noreferrer">${t}</a>`);
  return out;
}

function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = /^```([a-zA-Z]*)$/.exec(line);
    if (fenceMatch !== null) {
      const lang = fenceMatch[1];
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      const langClass = lang.length > 0 ? ` class="language-${escapeHtml(lang)}"` : "";
      html.push(`<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch !== null) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      html.push("<hr>");
      i += 1;
      continue;
    }

    // Table — header row + separator + rows
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const headerCells = line.split("|").slice(1, -1).map((c) => c.trim());
      const sep = lines[i + 1].split("|").slice(1, -1).map((c) => c.trim());
      const aligns = sep.map((s) => {
        const left = s.startsWith(":");
        const right = s.endsWith(":");
        if (left && right) return "center";
        if (right) return "right";
        if (left) return "left";
        return "left";
      });
      const rows = [];
      i += 2;
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i += 1;
      }
      const thead = `<thead><tr>${headerCells.map((c, idx) => `<th style="text-align:${aligns[idx] ?? "left"}">${renderInline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows.map((row) => `<tr>${row.map((c, idx) => `<td style="text-align:${aligns[idx] ?? "left"}">${renderInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      html.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Blockquote (one or more consecutive `>` lines)
    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      html.push(`<ul>${items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      html.push(`<ol>${items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ol>`);
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }

    // Paragraph — accumulate until blank line or block element
    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i]) &&
      !(/^\|.*\|\s*$/.test(lines[i]) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return html.join("\n");
}

// ---------------------------------------------------------------------------
// 5. Build the viewer HTML
// ---------------------------------------------------------------------------

const STYLES = `
  :root {
    --bg: #0d1117;
    --panel: #161b22;
    --panel-border: #30363d;
    --text: #e6edf3;
    --muted: #8b949e;
    --accent: #58a6ff;
    --code-bg: #1c2128;
    --code-text: #e6edf3;
    --table-stripe: #1c2128;
    --link: #58a6ff;
    --quote-border: #3b434b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.55;
  }
  header.page {
    padding: 32px 40px 24px;
    border-bottom: 1px solid var(--panel-border);
    background: linear-gradient(180deg, #0d1117 0%, #0a0d12 100%);
  }
  header.page h1 { margin: 0 0 8px; font-size: 28px; }
  header.page p { margin: 4px 0; color: var(--muted); }
  nav.toc {
    padding: 16px 40px;
    border-bottom: 1px solid var(--panel-border);
    background: var(--panel);
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 13px;
  }
  nav.toc a {
    color: var(--accent);
    text-decoration: none;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(56, 139, 253, 0.08);
    border: 1px solid rgba(56, 139, 253, 0.3);
  }
  nav.toc a:hover { background: rgba(56, 139, 253, 0.18); }
  main { padding: 24px 40px 80px; max-width: 1480px; margin: 0 auto; }
  .sample-section { margin: 56px 0; }
  .sample-section > h2 {
    font-size: 22px;
    border-bottom: 1px solid var(--panel-border);
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .sample-section > .desc { color: var(--muted); margin: 0 0 20px; }
  .layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 18px;
    align-items: start;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    padding: 18px;
    margin: 14px 0;
  }
  .layout-meta {
    position: sticky;
    top: 18px;
    font-size: 13px;
    color: var(--muted);
  }
  .layout-meta .id {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 4px;
  }
  .layout-meta .label { line-height: 1.4; }
  .layout-meta details { margin-top: 12px; }
  .layout-meta summary { cursor: pointer; color: var(--accent); }
  .layout-meta pre {
    margin: 8px 0 0;
    background: var(--code-bg);
    color: var(--code-text);
    padding: 10px 12px;
    border-radius: 6px;
    overflow: auto;
    max-height: 320px;
    font-size: 11px;
    line-height: 1.5;
    border: 1px solid var(--panel-border);
  }
  .layout-render {
    background: #ffffff;
    color: #1f2328;
    border-radius: 10px;
    padding: 18px 22px;
    overflow: auto;
    border: 1px solid #d0d7de;
    font-size: 14px;
  }
  /* GitHub-like markdown styling */
  .layout-render h1, .layout-render h2, .layout-render h3, .layout-render h4, .layout-render h5, .layout-render h6 {
    margin: 16px 0 8px;
    font-weight: 600;
    line-height: 1.25;
  }
  .layout-render h1 { font-size: 1.8em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
  .layout-render h2 { font-size: 1.4em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
  .layout-render h3 { font-size: 1.2em; }
  .layout-render h4 { font-size: 1.05em; }
  .layout-render p { margin: 0 0 12px; }
  .layout-render a { color: #0969da; text-decoration: none; }
  .layout-render a:hover { text-decoration: underline; }
  .layout-render code {
    background: rgba(175, 184, 193, 0.2);
    border-radius: 6px;
    padding: 0.2em 0.4em;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 85%;
  }
  .layout-render pre {
    background: #f6f8fa;
    color: #1f2328;
    padding: 12px 16px;
    border-radius: 6px;
    overflow: auto;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
  }
  .layout-render pre code { background: transparent; padding: 0; font-size: inherit; }
  .layout-render blockquote {
    margin: 0 0 12px;
    padding: 0 14px;
    border-left: 4px solid var(--quote-border);
    color: #59636e;
  }
  .layout-render blockquote > :last-child { margin-bottom: 0; }
  .layout-render ul, .layout-render ol { margin: 0 0 12px; padding-left: 28px; }
  .layout-render li + li { margin-top: 4px; }
  .layout-render hr { border: 0; border-top: 1px solid #d8dee4; margin: 20px 0; }
  .layout-render table {
    border-collapse: collapse;
    margin: 0 0 12px;
    width: 100%;
  }
  .layout-render th, .layout-render td {
    border: 1px solid #d8dee4;
    padding: 6px 12px;
    text-align: left;
    vertical-align: top;
  }
  .layout-render th { background: #f6f8fa; font-weight: 600; }
  .layout-render tbody tr:nth-child(even) td { background: #f6f8fa; }
  .layout-render strong { font-weight: 700; }
  .layout-render em { font-style: italic; }
`;

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------

async function main() {
  const args = new Set(process.argv.slice(2));
  const requestedSamples = (() => {
    const flag = [...args].find((a) => a.startsWith("--samples="));
    if (flag === undefined) return null;
    return new Set(flag.slice("--samples=".length).split(","));
  })();

  ensureBuild();
  const layouts = await import(
    "file:///" + LAYOUTS_OUT.replace(/\\/g, "/")
  );

  // Sanity check
  if (layouts.LAYOUTS.length !== 20) {
    throw new Error(`Expected 20 layouts, got ${layouts.LAYOUTS.length}`);
  }

  // Filter samples if requested
  let sampleLabels = ["clean", "busy", "parse-failed"];
  if (requestedSamples !== null) {
    sampleLabels = sampleLabels.filter((s) => requestedSamples.has(s));
  }
  const samples = {
    clean: sampleClean,
    busy: sampleBusy,
    "parse-failed": sampleParseFailed,
  };

  // Render every (layout × sample) and the baseline.
  const all = {};
  const baselineAll = {};
  for (const layout of layouts.LAYOUTS) {
    all[layout] = {};
    for (const s of sampleLabels) {
      all[layout][s] = layouts.renderSummary(layout, samples[s]());
    }
    baselineAll[layout] = layouts.renderBaseline("current", samples.busy());
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  // Raw JSON (machine-readable)
  writeFileSync(
    JSON_OUT,
    JSON.stringify({ layouts: all, baseline: baselineAll, samples: sampleLabels }, null, 2),
    "utf8",
  );

  // Combined markdown file (one big file with all layouts across all samples)
  const mdParts = ["# 20 review summary layouts — raw markdown\n"];
  for (const s of sampleLabels) {
    mdParts.push(`\n## Sample: ${s}\n`);
    for (const layout of layouts.LAYOUTS) {
      mdParts.push(`\n### ${layouts.LAYOUT_LABELS[layout]}\n`);
      mdParts.push("```markdown");
      mdParts.push(all[layout][s]);
      mdParts.push("```");
    }
  }
  mdParts.push(`\n## Baseline (current buildReviewBody output)\n`);
  mdParts.push("```markdown");
  mdParts.push(baselineAll["dashboard"]); // any layout triggers the baseline via renderBaseline
  mdParts.push("```");
  writeFileSync(MARKDOWN_OUT, mdParts.join("\n"), "utf8");

  // HTML viewer
  const html = buildHtml(all, sampleLabels, layouts.LAYOUT_LABELS, layouts);
  writeFileSync(HTML_OUT, html, "utf8");

  console.log(`[viewer] wrote ${HTML_OUT}`);
  console.log(`[viewer] wrote ${JSON_OUT}`);
  console.log(`[viewer] wrote ${MARKDOWN_OUT}`);
  console.log(`[viewer] rendered ${layouts.LAYOUTS.length} layouts × ${sampleLabels.length} samples = ${layouts.LAYOUTS.length * sampleLabels.length} cards`);
  console.log(`[viewer] open:  start "" "${HTML_OUT}"  (or just double-click)`);
}

function buildHtml(all, sampleLabels, labels, layouts) {
  const LAYOUTS_IDS = layouts.LAYOUTS;
  const sampleDescriptions = {
    "clean": "All-clear review — zero findings. Shows how each layout renders the 'nothing to fix' case.",
    "busy": "Busy review — 6 findings across all 4 severities + 1 off-diff + parse-OK verdict. Shows the data-rich case that the layouts must handle gracefully.",
    "parse-failed": "Parse-failed fallback — provider returned malformed JSON. Shows how each layout renders the diagnostic case.",
  };

  const sampleTitles = {
    "clean": "Clean review (0 findings)",
    "busy": "Busy review (6 findings, NEEDS_FIX)",
    "parse-failed": "Parse-failed fallback (0 findings, parseFailed=true)",
  };

  const tocLinks = LAYOUTS_IDS.map((id) => {
    // TOC anchors target the busy sample (most representative card per layout)
    return `  <a href="#${id}-busy">${escapeHtml(labels[id])}</a>`;
  }).join("\n");

  // Render the busy sample as the baseline comparison (most data-rich)
  const baselineMd = layouts.renderBaseline("current", sampleBusy());
  const baselineHtml = renderMarkdown(stripHiddenComments(baselineMd));

  const sections = sampleLabels.map((s) => {
    const cards = LAYOUTS_IDS.map((id, idx) => {
      const md = all[id][s];
      const html = renderMarkdown(stripHiddenComments(md));
      return `      <article class="layout" id="${id}-${s}">
        <aside class="layout-meta">
          <div class="id">#${idx + 1}</div>
          <div class="label">${escapeHtml(labels[id])}</div>
          <details>
            <summary>View raw markdown</summary>
            <pre>${escapeHtml(md)}</pre>
          </details>
        </aside>
        <div class="layout-render">
${html}
        </div>
      </article>`;
    }).join("\n");
    return `    <section class="sample-section">
      <h2 id="sample-${s}">${escapeHtml(sampleTitles[s])}</h2>
      <p class="desc">${escapeHtml(sampleDescriptions[s])}</p>
${cards}
    </section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UmActually — 20 review summary layouts</title>
  <style>${STYLES}</style>
</head>
<body>
  <header class="page">
    <h1>UmActually — 20 review summary layouts</h1>
    <p>Each layout below renders the same review data through a different visual personality. The "current" baseline (the existing <code>buildReviewBody</code> output) is reproduced at the very bottom for side-by-side comparison.</p>
    <p>Markdown is rendered with GitHub-flavoured styling. All layouts use only GFM features that render correctly on both GitHub PR reviews and Azure DevOps PR threads (no <code>&lt;details&gt;</code>, no raw HTML tables, no task-list checkboxes).</p>
  </header>
  <nav class="toc">
${tocLinks}
    <a href="#baseline-comparison" style="margin-left:auto;background:rgba(255,166,43,0.1);border-color:rgba(255,166,43,0.3);color:#ffa657;">↪ Baseline comparison</a>
  </nav>
  <main>
${sections}
    <section class="sample-section" id="baseline-comparison">
      <h2>Baseline comparison — current (existing buildReviewBody output)</h2>
      <p class="desc">The byte-identical reproduction of the existing review summary that all 20 layouts are designed to replace. Use it as a reference for "what we have now".</p>
      <article class="layout">
        <aside class="layout-meta">
          <div class="id">⭐ baseline</div>
          <div class="label">Current buildReviewBody output (byte-identical reproduction)</div>
          <details>
            <summary>View raw markdown</summary>
            <pre>${escapeHtml(baselineMd)}</pre>
          </details>
        </aside>
        <div class="layout-render">
${baselineHtml}
        </div>
      </article>
    </section>
  </main>
</body>
</html>
`;
}

main().catch((err) => {
  console.error("[viewer] FAILED:", err);
  process.exit(1);
});