export const id = 408;
export const ids = [408];
export const modules = {

/***/ 408:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  dispatch: () => (/* binding */ dispatch)
});

// UNUSED EXPORTS: firstPositionalToken, runJsonReview, stripLeadingCommand

// EXTERNAL MODULE: external "node:child_process"
var external_node_child_process_ = __webpack_require__(421);
// EXTERNAL MODULE: external "node:fs/promises"
var promises_ = __webpack_require__(455);
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(760);
// EXTERNAL MODULE: external "node:url"
var external_node_url_ = __webpack_require__(136);
// EXTERNAL MODULE: external "node:util"
var external_node_util_ = __webpack_require__(975);
// EXTERNAL MODULE: ./src/cli.ts + 69 modules
var cli = __webpack_require__(495);
// EXTERNAL MODULE: ./src/config/field-schema.ts
var field_schema = __webpack_require__(876);
;// CONCATENATED MODULE: ./src/cli/doctor.ts
// SPDX-License-Identifier: MIT

const MIN_NODE_MAJOR = 24;
async function runDoctor(deps) {
    const checks = [
        checkNode(deps.nodeVersion ?? process.versions.node),
        await checkDistFreshness(deps),
        checkEnv(deps.env),
        await checkGit(deps),
    ];
    const exitCode = checks.some((check) => check.status === "fail") ? 1 : 0;
    const json = { schemaVersion: 1, command: "doctor", exitCode, checks };
    return deps.isTTY
        ? { exitCode, checks, json, stdout: formatDoctorHuman(checks) }
        : { exitCode, checks, json };
}
function checkNode(nodeVersion) {
    const nodeMajor = Number.parseInt(nodeVersion.split(".", 1)[0] ?? "", 10);
    if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
        return {
            id: "node",
            status: "fail",
            message: `Node ${nodeVersion} detected; ${MIN_NODE_MAJOR}.x or later required`,
            hint: "Install Node 24+ from https://nodejs.org/",
        };
    }
    return { id: "node", status: "ok", message: `Node ${nodeVersion}` };
}
async function checkDistFreshness(deps) {
    const root = deps.packageRoot.replace(/[\\/]$/u, "");
    const distPath = `${root}/dist/cli.js`;
    const srcPath = `${root}/src/cli.ts`;
    const distStat = await statOrNull(deps.fsAdapter, distPath);
    if (distStat === null) {
        return {
            id: "dist-freshness",
            status: "fail",
            message: `${distPath} is missing`,
            hint: "Run `npm run bundle` to produce dist/cli.js",
        };
    }
    const srcStat = await statOrNull(deps.fsAdapter, srcPath);
    if (srcStat === null) {
        return {
            id: "dist-freshness",
            status: "skip",
            message: `${srcPath} not present (npm install); cannot compare freshness`,
        };
    }
    if (distStat.mtimeMs < srcStat.mtimeMs) {
        return {
            id: "dist-freshness",
            status: "fail",
            message: `${distPath} is older than ${srcPath}`,
            hint: "Run `npm run bundle` to refresh dist/cli.js",
        };
    }
    return { id: "dist-freshness", status: "ok", message: `${distPath} present and fresh` };
}
async function statOrNull(fsAdapter, path) {
    try {
        return await fsAdapter.stat(path);
    }
    catch {
        // A diagnostic probe reports unavailable paths rather than propagating adapter errors.
        return null;
    }
}
function checkEnv(env) {
    const presence = [...field_schema/* KNOWN_ENV_VAR_NAMES */.T5].map((name) => ({
        name,
        present: typeof env[name] === "string" && env[name].length > 0,
    }));
    const presentCount = presence.filter((entry) => entry.present).length;
    return {
        id: "env",
        status: "ok",
        message: `${presentCount}/${field_schema/* KNOWN_ENV_VAR_NAMES */.T5.size} known env vars present`,
        presence,
    };
}
async function checkGit(deps) {
    try {
        const result = await deps.execFile("git", ["rev-parse", "--is-inside-work-tree"], {
            cwd: deps.cwd,
        });
        return result.stdout.trim() === "true"
            ? { id: "git", status: "ok", message: "cwd is inside a git work tree" }
            : { id: "git", status: "warn", message: "cwd is not inside a git work tree" };
    }
    catch {
        return {
            id: "git",
            status: "warn",
            message: "git is not on PATH or cwd is not inside a work tree",
        };
    }
}
function formatDoctorHuman(checks) {
    const lines = checks.map((check) => {
        const hint = check.hint === undefined ? "" : `\n  hint: ${check.hint}`;
        return `${check.status.toUpperCase().padEnd(4)} ${check.id}: ${check.message}${hint}`;
    });
    return `${lines.join("\n")}\n`;
}
function formatDoctorJson(result) {
    const envelope = result.json ?? {
        schemaVersion: 1,
        command: "doctor",
        exitCode: result.exitCode,
        checks: result.checks,
    };
    return `${JSON.stringify(envelope)}\n`;
}

// EXTERNAL MODULE: ./src/cli/help.ts
var help = __webpack_require__(911);
;// CONCATENATED MODULE: ./src/cli/no-color.ts
// SPDX-License-Identifier: MIT
/**
 * Resolve whether decorative ANSI color should be enabled.
 *
 * GitHub annotation prefixes (`::notice::`, `::warning::`, and `::error::`)
 * are workflow commands, not decorative color, and are unaffected.
 */
function resolveColorPolicy(opts) {
    if (opts.noColor || opts.json) {
        return false;
    }
    const noColorEnv = opts.env["NO_COLOR"];
    if (typeof noColorEnv === "string" && noColorEnv.length > 0) {
        return false;
    }
    return opts.isTTY;
}

;// CONCATENATED MODULE: ./src/cli/dispatch.ts
// SPDX-License-Identifier: MIT
// Subcommand dispatch layer. Pure routing apart from delegated CLI output.









const GLOBAL_ONLY_FLAGS = new Set(["--json", "--no-color"]);
const TOP_LEVEL_COMMANDS = ["review", "doctor", "version", "--help", "--version"];
const execFile = (0,external_node_util_.promisify)(external_node_child_process_.execFile);
function firstPositionalToken(argv) {
    for (const token of argv) {
        if (GLOBAL_ONLY_FLAGS.has(token)) {
            continue;
        }
        return token.startsWith("-") ? null : token;
    }
    return null;
}
function stripLeadingCommand(argv, command) {
    const commandIndex = argv.indexOf(command);
    return commandIndex === -1
        ? argv.slice()
        : [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)];
}
async function dispatch(argv) {
    applyColorPolicy(argv);
    if (argv.includes("--version") || argv.includes("-V")) {
        return (0,cli/* runVersion */.yh)(argv);
    }
    if (argv.includes("--help") || argv.includes("-h")) {
        const stdout = (0,help/* printHelp */.F)(TOP_LEVEL_COMMANDS);
        return argv.includes("--no-color") ? 0 : { exitCode: 0, stdout };
    }
    const command = firstPositionalToken(argv);
    if (command === null) {
        return runReviewBranch(argv);
    }
    switch (command) {
        case "review":
            return runReviewBranch(stripLeadingCommand(argv, command));
        case "doctor":
            return runDoctorBranch(stripLeadingCommand(argv, command));
        case "version":
            return (0,cli/* runVersion */.yh)(stripLeadingCommand(argv, command));
        default: {
            const stderr = `unknown command: ${command}\n`;
            process.stderr.write(stderr);
            return { exitCode: 2, stderr };
        }
    }
}
function applyColorPolicy(argv) {
    return resolveColorPolicy({
        noColor: argv.includes("--no-color"),
        json: argv.includes("--json"),
        env: process.env,
        isTTY: process.stdout.isTTY === true,
    });
}
async function runReviewBranch(args) {
    const json = args.includes("--json");
    const reviewArgs = args.filter((arg) => arg !== "--json" && arg !== "--no-color");
    if (json) {
        return runJsonReview(reviewArgs);
    }
    const result = await (0,cli/* runCli */.ak)(reviewArgs, process.cwd());
    return { exitCode: result.exitCode };
}
async function runJsonReview(argv) {
    const reviewArgs = stripLeadingCommand(argv.filter((arg) => arg !== "--json" && arg !== "--no-color"), "review");
    const originalWrite = process.stdout.write;
    process.stdout.write = process.stderr.write.bind(process.stderr);
    try {
        const result = await (0,cli/* runCli */.ak)(reviewArgs, process.cwd());
        const envelope = {
            schemaVersion: 1,
            command: "review",
            exitCode: result.exitCode,
            resolvedConfig: result.resolvedConfig ?? {},
            outcome: {
                ok: result.exitCode === 0,
                ...result.jsonOutcome,
            },
        };
        const stdout = `${JSON.stringify(envelope)}\n`;
        originalWrite.call(process.stdout, stdout);
        return { exitCode: result.exitCode, stdout };
    }
    finally {
        process.stdout.write = originalWrite;
    }
}
async function runDoctorBranch(args) {
    const json = args.includes("--json");
    const packageRoot = (0,external_node_path_.resolve)((0,external_node_path_.dirname)((0,external_node_url_.fileURLToPath)(import.meta.url)), "..");
    const result = await runDoctor({
        cwd: process.cwd(),
        isTTY: process.stdout.isTTY === true,
        env: process.env,
        fsAdapter: { stat: promises_.stat },
        execFile: async (file, fileArgs, options) => {
            const output = await execFile(file, fileArgs, options);
            return { stdout: output.stdout, stderr: output.stderr };
        },
        packageRoot,
    });
    const stdout = json ? formatDoctorJson(result) : formatDoctorHuman(result.checks);
    process.stdout.write(stdout);
    return { exitCode: result.exitCode, stdout };
}


/***/ })

};
