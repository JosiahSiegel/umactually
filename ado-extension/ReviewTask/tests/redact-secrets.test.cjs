// SPDX-License-Identifier: MIT
//
// Smoke tests for the UmActually Azure DevOps task.
//
// Uses node:test (Node 20+ built-in) so the test runner is
// dependency-free. Run with:
//
//   cd ReviewTask
//   node --test tests/
//
// These tests do NOT spawn the CLI (the build server has the CLI;
// the test environment doesn't). They cover the pure-function
// helpers in redact-secrets.js (the secret-masking contract) and
// structural validation of task.json (the marketplace schema
// validator at upload time is strict; this catches obvious
// mistakes before the tfx-cli round-trip).
//
// IN DEVELOPMENT: the test surface is intentionally small. v0.2
// will add ADO-API mock tests using nock or a custom mock so the
// full task pipeline (read inputs → build CLI argv → spawn → parse
// stdout → set output variables → set result) can be tested
// without a real ADO build agent.
//
// This file is JavaScript (not TypeScript) on purpose: it runs under
// `node --test` directly, no ts-node, no tsc, no separate build
// step. The dependency under test (./redact-secrets.js) is the
// compiled output of ./redact-secrets.ts, so this test verifies
// the SHIPPED artifact, not the source.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const TASK_DIR = path.join(__dirname, "..");

// Load the compiled helper. The helper file is pure (no top-level
// side effects, no task-lib dependencies) so this is safe to do
// from a test environment. Use require() because redact-secrets.js
// is a CommonJS module.
const { redactSecretsForLog } = require(path.join(TASK_DIR, "redact-secrets.js"));

// -----------------------------------------------------------------------
// redactSecretsForLog behavior
// -----------------------------------------------------------------------

test("redactSecretsForLog masks --api-key value", () => {
  const input = [
    "node", "cli.js",
    "--platform", "azure-devops",
    "--api-key", "sk-real-secret-do-not-leak-12345",
    "--pr-number", "42",
  ];
  const out = redactSecretsForLog(input);
  assert.deepEqual(out, [
    "node", "cli.js",
    "--platform", "azure-devops",
    "--api-key", "***",
    "--pr-number", "42",
  ]);
});

test("redactSecretsForLog masks --sonar-token value", () => {
  const input = [
    "--api-url", "https://sonar.example.com",
    "--sonar-token", "squ_secret_very_long_token_abc123",
    "--sonar-project-key", "myproject",
  ];
  const out = redactSecretsForLog(input);
  assert.deepEqual(out, [
    "--api-url", "https://sonar.example.com",
    "--sonar-token", "***",
    "--sonar-project-key", "myproject",
  ]);
});

test("redactSecretsForLog does NOT mask --api-url (URL is not a secret)", () => {
  const input = [
    "--api-url", "https://api.minimax.io/anthropic",
    "--api-key", "sk-fake-but-test",
  ];
  const out = redactSecretsForLog(input);
  // --api-url stays unredacted (it's a public endpoint, not a secret)
  assert.equal(out[0], "--api-url");
  assert.equal(out[1], "https://api.minimax.io/anthropic");
  // --api-key is redacted
  assert.equal(out[2], "--api-key");
  assert.equal(out[3], "***");
});

test("redactSecretsForLog does NOT mask flag name itself (only the value)", () => {
  // If the literal "--api-key" appears as a value (not as a flag),
  // it must NOT be masked — only the value following the flag.
  const input = [
    "--model", "--api-key",  // value is the literal string "--api-key"
    "--pr-number", "42",
  ];
  const out = redactSecretsForLog(input);
  // The value at index 1 (the literal "--api-key") must be unchanged
  // because the previous arg is "--model", not "--api-key".
  assert.equal(out[1], "--api-key");
  // The value at index 3 (the pr-number) is unchanged.
  assert.equal(out[3], "42");
});

test("redactSecretsForLog handles empty argv", () => {
  const out = redactSecretsForLog([]);
  assert.deepEqual(out, []);
});

test("redactSecretsForLog handles multiple secret flags", () => {
  const input = [
    "--api-key", "key1",
    "--api-url", "https://x",
    "--sonar-token", "tok1",
    "--api-key", "key2",  // second occurrence
  ];
  const out = redactSecretsForLog(input);
  assert.equal(out[1], "***");
  assert.equal(out[3], "https://x");  // api-url is NOT redacted
  assert.equal(out[5], "***");
  assert.equal(out[7], "***");
});

test("redactSecretsForLog is a pure function (does not mutate input)", () => {
  const input = ["--api-key", "secret", "--pr-number", "42"];
  const inputCopy = [...input];
  redactSecretsForLog(input);
  assert.deepEqual(input, inputCopy, "input array must not be mutated");
});

// -----------------------------------------------------------------------
// task.json structural validation
// -----------------------------------------------------------------------

test("ReviewTask/index.js exists (build artifact present)", () => {
  const indexJs = path.join(TASK_DIR, "index.js");
  assert.ok(
    fs.existsSync(indexJs),
    `ReviewTask/index.js not found at ${indexJs}. Run \`npm run build\` first.`,
  );
  const stat = fs.statSync(indexJs);
  assert.ok(
    stat.size > 1000,
    `ReviewTask/index.js is suspiciously small (${stat.size} bytes) — did the build succeed?`,
  );
});

test("ReviewTask/task.json has all required fields", () => {
  const taskJson = JSON.parse(fs.readFileSync(path.join(TASK_DIR, "task.json"), "utf8"));
  assert.ok(taskJson.id, "task.json must have an id");
  // Self-review finding #2345: the id must be a real GUID, NOT the
  // literal placeholder. A placeholder in the shipped task.json
  // would make the .vsix fail the marketplace schema validator.
  assert.match(
    taskJson.id,
    /^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/,
    `task.json id must be a real GUID, not the placeholder. Got: ${taskJson.id}`,
  );
  assert.ok(taskJson.name, "task.json must have a name");
  assert.equal(
    taskJson.name,
    "ReviewTask",
    "task name MUST match the folder name for vss-extension.json contribution.properties.name",
  );
  assert.ok(taskJson.friendlyName, "task.json must have a friendlyName");
  assert.ok(taskJson.instanceNameFormat, "task.json must have an instanceNameFormat");
  assert.ok(taskJson.version, "task.json must have a version");
  assert.ok(taskJson.inputs, "task.json must have inputs");
  assert.ok(Array.isArray(taskJson.inputs), "task.json inputs must be an array");
  assert.ok(taskJson.inputs.length >= 4, "task.json should have at least 4 inputs");
  assert.ok(taskJson.execution, "task.json must have an execution block");
  assert.ok(taskJson.execution.Node20_1, "task.json must specify Node20_1 execution");
  assert.equal(taskJson.execution.Node20_1.target, "index.js", "task.json must target index.js");
});

test("ReviewTask/task.json noDryRun input is well-formed", () => {
  // Self-review finding #2315 caught that noDryRun: true on the
  // first run is dangerous. The task.json default is true (so the
  // task does what it says: posts review threads on every run
  // by default — the operator decides when to flip to dry-run).
  // The Quickstart in overview.md uses noDryRun: false for first
  // runs. The contract is: task.json default is 'true' (matches the
  // input's label "Post review (live mode)"), Quickstart uses 'false'.
  const taskJson = JSON.parse(fs.readFileSync(path.join(TASK_DIR, "task.json"), "utf8"));
  const noDryRun = taskJson.inputs.find((i) => i.name === "noDryRun");
  assert.ok(noDryRun, "task.json must define a noDryRun input");
  assert.equal(typeof noDryRun.defaultValue, "boolean", "noDryRun.defaultValue must be a boolean");
});

test("ReviewTask/task.json secret-bearing inputs are type: secureString", () => {
  // Self-review finding #2326/#2327 caught that apiKey and
  // sonarToken were type: string, which renders as plain text in
  // the ADO UI and is NOT auto-masked in build logs. Both are now
  // secureString so they render as password fields and are
  // automatically masked. The non-secret inputs (apiUrl, model,
  // etc.) stay type: string.
  const taskJson = JSON.parse(fs.readFileSync(path.join(TASK_DIR, "task.json"), "utf8"));
  const SECRET_INPUTS = ["apiKey", "sonarToken"];
  for (const name of SECRET_INPUTS) {
    const input = taskJson.inputs.find((i) => i.name === name);
    assert.ok(input, `task.json must define a ${name} input`);
    assert.equal(
      input.type,
      "secureString",
      `${name} must be type: secureString (renders as password, auto-masked in logs). Got: ${input.type}`,
    );
  }
  // Sanity: non-secret inputs are still type: string.
  const apiUrl = taskJson.inputs.find((i) => i.name === "apiUrl");
  assert.equal(apiUrl.type, "string", "apiUrl is a public URL, type: string is correct");
});

test("ReviewTask/task.json outputArtifact default is NOT a mocked-test path", () => {
  // Self-review finding #2336/#2338 caught that the default was
  // 'artifacts/manual/s4-azure-mocked-run.json' — clearly copied
  // from a local manual-test path. Production default must be a
  // neutral path. The matching index.ts fallback uses the SAME
  // default (a regression guard for divergence between the two).
  const taskJson = JSON.parse(fs.readFileSync(path.join(TASK_DIR, "task.json"), "utf8"));
  const outputArtifact = taskJson.inputs.find((i) => i.name === "outputArtifact");
  assert.ok(outputArtifact, "task.json must define an outputArtifact input");
  // The mocked-test hint is "s4-azure-mocked" or "manual/" — both
  // are signs the default was copy-pasted from a dev script.
  assert.ok(
    !outputArtifact.defaultValue.includes("s4-azure-mocked"),
    `outputArtifact.defaultValue must not reference a mocked-test path. Got: ${outputArtifact.defaultValue}`,
  );
  assert.ok(
    !outputArtifact.defaultValue.includes("manual/"),
    `outputArtifact.defaultValue must not be in artifacts/manual/ (that path is reserved for the self-review regression test). Got: ${outputArtifact.defaultValue}`,
  );
  // Cross-check: the index.ts fallback uses the SAME default.
  const indexTs = fs.readFileSync(path.join(TASK_DIR, "index.ts"), "utf8");
  const matches = [...indexTs.matchAll(/get\("outputArtifact", false\) \|\| "([^"]+)"/g)];
  assert.ok(matches.length >= 1, "index.ts must have an outputArtifact fallback default");
  const fallback = matches[0][1];
  assert.equal(
    fallback,
    outputArtifact.defaultValue,
    `index.ts fallback ('${fallback}') must match task.json default ('${outputArtifact.defaultValue}')`,
  );
});

test("ReviewTask/task.json restrictions does NOT pin commands.mode: restricted", () => {
  // Self-review finding #2339: a Node-handler task that calls
  // child_process.spawn needs to allow 'node' in the allowlist.
  // Setting commands.mode: 'restricted' blocks spawn() unless
  // the allowlist explicitly names node, which is fragile. The
  // recommended default for a Node task is to omit the commands
  // restriction entirely (or set mode: 'restricted' with a
  // documented allowlist that includes 'node'). We choose the
  // former — no commands restriction.
  const taskJson = JSON.parse(fs.readFileSync(path.join(TASK_DIR, "task.json"), "utf8"));
  const restrictions = taskJson.restrictions;
  if (restrictions === undefined) {
    // OK — no restrictions block at all.
    return;
  }
  // If a restrictions block exists, it must NOT pin commands.mode: 'restricted'.
  if (restrictions.commands !== undefined) {
    assert.notEqual(
      restrictions.commands.mode,
      "restricted",
      "restrictions.commands.mode: 'restricted' blocks child_process.spawn() of node. Either remove the commands restriction or set mode: 'restricted' with a documented allowlist that includes 'node'.",
    );
  }
});

test("scripts/package-extension.sh exists with shebang", () => {
  const scriptPath = path.join(TASK_DIR, "..", "scripts", "package-extension.sh");
  const stat = fs.statSync(scriptPath);
  assert.ok(stat.isFile(), `${scriptPath} must be a regular file`);
  const head = fs.readFileSync(scriptPath, "utf8").split("\n")[0];
  assert.ok(head.startsWith("#!"), `${scriptPath} must start with a shebang`);
});
