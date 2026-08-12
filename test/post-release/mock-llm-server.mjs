// SPDX-License-Identifier: MIT
// Unified mock LLM server for post-release end-to-end tests + hermetic
// review-eval gate.
//
// Handles BOTH provider wire formats umactually supports:
//   - OpenAI Chat Completions: POST /v1/chat/completions
//   - OpenAI Responses:         POST /v1/responses
//   - Anthropic Messages:       POST /v1/messages (also /v1/messages/...)
//
// Returns a realistic canned review JSON that includes inline comments
// targeting a path that is in the test fixture (so the orchestrator
// doesn't drop them during diff-scope filtering).
//
// The review-eval gate drives this server via the `X-Mock-Fixture`
// request header: when the header is present, the server returns the
// canned review JSON file at `${MOCK_REVIEW_DIR}/${fixture}.json`
// instead of the default canary review. The fixture-rigged body lets
// the gate exercise the full prompt → provider transport → parser →
// verification/filter → durable-finding pipeline against deterministic
// inputs without needing a real provider.
//
// Usage:
//   node test/post-release/mock-llm-server.mjs
//   PORT=18123 MOCK_LABEL=osx node test/post-release/mock-llm-server.mjs
//
// Defaults to a random free port. Stdout prints the chosen port so the
// caller can capture it.

import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PORT ?? 0);
const LABEL = process.env.MOCK_LABEL ?? "mock-llm";
const MOCK_REVIEW_DIR = process.env.MOCK_REVIEW_DIR ?? "";
const MOCK_VERSION = process.env.MOCK_VERSION ?? "1.0.0";

// The fixture file the test harness commits to the throwaway branch.
// Comments intentionally target this path with TWO line numbers
// (lines 1 and 7) so the orchestrator's diff-scope filter keeps both
// and umactually posts two inline comments. This is the test
// assertion: "did both comments survive the wire?" — if not, a
// provider-specific bug slipped through.
const FIXTURE_PATH = "test/fixtures/e2e-canary-fixture.txt";

const cannedReview = {
  summary:
    "Post-release end-to-end canary from the mock LLM. If you can read this on a PR created by a GitHub Actions run, the provider wire format (OpenAI-compatible OR Anthropic), the install path, the checksum verification, and the orchestrator's diff-scope filter are all working end-to-end. Two inline comments are attached to verify multi-comment posting.",
  verdict: "request_changes",
  comments: [
    {
      path: FIXTURE_PATH,
      line: 1,
      body: "MOCK-LLM CANARY finding #1 (line 1): the just-published binary is functional end-to-end. If this comment is posted on a real PR via the mock LLM, the wire format, install, checksum, and provider dispatch are all green.",
      severity: "medium",
      category: "testing",
    },
    {
      path: FIXTURE_PATH,
      line: 7,
      body: "MOCK-LLM CANARY finding #2 (line 7): multi-comment posting verified. The second comment targets a different line to confirm the orchestrator preserves multiple findings through the diff-scope filter.",
      severity: "low",
      category: "documentation",
    },
  ],
  suppressed_comments: [],
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function logRequest(req, model, extra) {
  const ts = new Date().toISOString();
  const tail = extra ? ` ${extra}` : "";
  console.error(
    `[${LABEL} ${ts}] ${req.method} ${req.url} model=${model}${tail}`,
  );
}

/**
 * Resolve the canned review body for an inbound request. When the
 * request carries an X-Mock-Fixture header AND MOCK_REVIEW_DIR is set,
 * the server returns the matching fixture file (used by the hermetic
 * review-eval gate). Otherwise it returns the legacy default review
 * so the post-release e2e harness keeps working unchanged.
 *
 * Returns `{ body: string, parseFail: "truncated" | "malformed" | null }`
 * so the wire-format wrapper can short-circuit malformed bodies to a
 * parse-failure response. Files prefixed with `__PARSE_FAIL__` are
 * treated as malformed JSON; `__TRUNCATED__` files are intentionally
 * truncated JSON.
 */
function resolveCannedReview(fixtureHeader) {
  if (fixtureHeader === null || fixtureHeader === undefined || fixtureHeader.length === 0) {
    return { body: JSON.stringify(cannedReview), parseFail: null };
  }
  if (MOCK_REVIEW_DIR.length === 0) {
    return { body: JSON.stringify(cannedReview), parseFail: null };
  }
  const filePath = join(MOCK_REVIEW_DIR, `${fixtureHeader}.json`);
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return { body: JSON.stringify(cannedReview), parseFail: null };
    }
    const text = readFileSync(filePath, "utf8");
    if (text.startsWith("__PARSE_FAIL__")) {
      const malformed = text.slice("__PARSE_FAIL__".length);
      return { body: malformed, parseFail: "malformed" };
    }
    if (text.startsWith("__TRUNCATED__")) {
      // Already pre-truncated by the runner.
      return { body: text.slice("__TRUNCATED__".length), parseFail: "truncated" };
    }
    return { body: text, parseFail: null };
  } catch {
    return { body: JSON.stringify(cannedReview), parseFail: null };
  }
}

const server = createServer(async (req, res) => {
  const ts = new Date().toISOString();

  // Health probe used by the test harness to know the server is ready.
  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, label: LABEL, ts }));
    return;
  }

  // Version probe used by the runner to capture the mock-server
  // version alongside its hash. Lets a snapshot reject a run whose
  // server version drifted from the captured snapshot.
  if (req.method === "GET" && req.url === "/version") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ version: MOCK_VERSION, label: LABEL }));
    return;
  }

  // Anthropic Messages: POST {baseUrl}/v1/messages
  if (req.method === "POST" && req.url.includes("/v1/messages")) {
    const body = await readBody(req);
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* ignore */
    }
    const model = parsed?.model ?? "unknown";
    const xapi = req.headers["x-api-key"]?.toString() ?? "none";
    const fingerprint = xapi === "none" ? "none" : `${xapi.slice(0, 4)}…(len=${xapi.length})`;
    const ver = req.headers["anthropic-version"] ?? "none";
    const fixtureHeader = req.headers["x-mock-fixture"]?.toString() ?? null;
    logRequest(req, model, `x-api-key=${fingerprint} anthropic-version=${ver}`);
    const canned = resolveCannedReview(fixtureHeader);
    const textContent = canned.parseFail !== null
      ? `__PARSE_FAIL__${canned.body}`
      : canned.body;
    const response = {
      id: `msg_${Date.now()}`,
      type: "message",
      role: "assistant",
      model,
      content: [{ type: "text", text: textContent }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1234, output_tokens: 200 },
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(response));
    return;
  }

  // OpenAI Chat Completions: POST {baseUrl}/v1/chat/completions
  if (req.method === "POST" && req.url.includes("/chat/completions")) {
    const body = await readBody(req);
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* ignore */
    }
    const model = parsed?.model ?? "unknown";
    const fixtureHeader = req.headers["x-mock-fixture"]?.toString() ?? null;
    logRequest(req, model);
    const canned = resolveCannedReview(fixtureHeader);
    const content = canned.parseFail !== null
      ? canned.body
      : canned.body;
    const completion = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content,
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1234, completion_tokens: 200, total_tokens: 1434 },
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(completion));
    return;
  }

  // OpenAI Responses: POST {baseUrl}/v1/responses
  if (req.method === "POST" && req.url.includes("/v1/responses")) {
    const body = await readBody(req);
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* ignore */
    }
    const model = parsed?.model ?? "unknown";
    const fixtureHeader = req.headers["x-mock-fixture"]?.toString() ?? null;
    logRequest(req, model);
    const canned = resolveCannedReview(fixtureHeader);
    const textContent = canned.body;
    const response = {
      id: `resp_${Date.now()}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      model,
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: textContent }],
        },
      ],
      usage: { input_tokens: 1234, output_tokens: 200, total_tokens: 1434 },
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(response));
    return;
  }

  console.error(`[${LABEL} ${ts}] ${req.method} ${req.url} -> 404`);
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  const addr = server.address();
  // Single line on stdout for the harness to grep. Stderr is for logs.
  console.log(`${addr.port}`);
});
