import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const RENDER_SCRIPT = join(process.cwd(), "scripts", "render-versions.mjs");
const CHECK_SCRIPT = join(process.cwd(), "scripts", "check-version-alignment.mjs");

// Invoke scripts/render-versions.mjs with --package-root so the test can
// sandbox against a tmpdir tree without copying the script out of the
// real repo. The script was deliberately extended with --package-root
// for exactly this purpose.
function invokeRenderScript(
  args: string[],
  options: { packageRoot?: string; cwd?: string } = {},
): { stdout: string; stderr: string; status: number } {
  const fullArgs = [...args];
  if (options.packageRoot) {
    fullArgs.push("--package-root", options.packageRoot);
  }
  try {
    const out = execFileSync(process.execPath, [RENDER_SCRIPT, ...fullArgs], {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout: out, stderr: "", status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    const stdout = typeof e.stdout === "string" ? e.stdout : e.stdout ? e.stdout.toString("utf8") : "";
    const stderr = typeof e.stderr === "string" ? e.stderr : e.stderr ? e.stderr.toString("utf8") : "";
    return { stdout, stderr, status: e.status ?? 1 };
  }
}

// Same shape for scripts/check-version-alignment.mjs.
function invokeCheckScript(
  args: string[],
  options: { packageRoot?: string; cwd?: string } = {},
): { stdout: string; stderr: string; status: number } {
  const fullArgs = [...args];
  if (options.packageRoot) {
    fullArgs.push("--package-root", options.packageRoot);
  }
  try {
    const out = execFileSync(process.execPath, [CHECK_SCRIPT, ...fullArgs], {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout: out, stderr: "", status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    const stdout = typeof e.stdout === "string" ? e.stdout : e.stdout ? e.stdout.toString("utf8") : "";
    const stderr = typeof e.stderr === "string" ? e.stderr : e.stderr ? e.stderr.toString("utf8") : "";
    return { stdout, stderr, status: e.status ?? 1 };
  }
}

const tmpRoots: string[] = [];

afterEach(() => {
  while (tmpRoots.length > 0) {
    const root = tmpRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function makeIsolatedTree(): string {
  const tmpRoot = mkdtempSync(join(tmpdir(), "render-versions-test-"));
  tmpRoots.push(tmpRoot);
  return tmpRoot;
}

function seedTree(tmpRoot: string, version = "9.9.9"): void {
  writeFileSync(
    join(tmpRoot, "package.json"),
    JSON.stringify({ name: "x", version }, null, 2),
    "utf8",
  );
  writeFileSync(join(tmpRoot, "README.md"), "# X\n\ntag: {{UMACTUALLY_VERSION}}\n", "utf8");
  mkdirSync(join(tmpRoot, "docs"), { recursive: true });
  writeFileSync(
    join(tmpRoot, "docs", "configuration.md"),
    "# Config\n\npin: {{UMACTUALLY_VERSION}}, dot: {{UMACTUALLY_VERSION_DOT}}\n",
    "utf8",
  );
  mkdirSync(join(tmpRoot, "examples", "azure"), { recursive: true });
  writeFileSync(
    join(tmpRoot, "examples", "azure", "azure-pipelines.yml"),
    "script: npx github:x/y#{{UMACTUALLY_VERSION}} review\n",
    "utf8",
  );
}

describe("scripts/render-versions.mjs", () => {
  it("renders {{UMACTUALLY_VERSION}} and {{UMACTUALLY_VERSION_DOT}} into shipped docs", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);

    const result = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(result.status, result.stderr).toBe(0);

    const readme = readFileSync(join(tmpRoot, "README.md"), "utf8");
    expect(readme).toContain("tag: v9.9.9");
    expect(readme).not.toContain("{{UMACTUALLY_VERSION}}");

    const config = readFileSync(join(tmpRoot, "docs", "configuration.md"), "utf8");
    expect(config).toContain("pin: v9.9.9, dot: 9.9.9");
    expect(config).not.toContain("{{UMACTUALLY_VERSION}}");
    expect(config).not.toContain("{{UMACTUALLY_VERSION_DOT}}");

    const yml = readFileSync(join(tmpRoot, "examples", "azure", "azure-pipelines.yml"), "utf8");
    expect(yml).toContain("npx github:x/y#v9.9.9");
    expect(yml).not.toContain("{{UMACTUALLY_VERSION}}");
  });

  it("is idempotent — re-running on a rendered tree is a no-op", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);

    const first = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(first.status).toBe(0);
    const readmeAfterFirst = readFileSync(join(tmpRoot, "README.md"), "utf8");

    const second = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(second.status, second.stderr).toBe(0);
    const readmeAfterSecond = readFileSync(join(tmpRoot, "README.md"), "utf8");
    expect(readmeAfterSecond).toBe(readmeAfterFirst);
  });

  it("--check exits non-zero when a target file still has not been rendered", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);
    // Skip the render — go straight to --check. The file still contains
    // {{UMACTUALLY_VERSION}} so the script must report drift.
    const result = invokeRenderScript(["--check"], { packageRoot: tmpRoot });
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).toMatch(/render-versions|render-docs|--check/);
  });

  it("rejects non-canonical {{UMACTUALLY_*}} tokens with exit 2", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);
    // Plant a typo so the renderer reports it but cannot substitute.
    writeFileSync(
      join(tmpRoot, "README.md"),
      "# X\n\ntypo: {{UMACTUALLY_VRSION}}\n",
      "utf8",
    );
    const result = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/UMACTUALLY_VRSION/);
  });

  it("--dry-run does not write any file", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);

    const before = readFileSync(join(tmpRoot, "README.md"), "utf8");
    const result = invokeRenderScript(["--dry-run"], { packageRoot: tmpRoot });
    expect(result.status, result.stderr).toBe(0);
    const after = readFileSync(join(tmpRoot, "README.md"), "utf8");
    expect(after).toBe(before);
    expect(after).toContain("{{UMACTUALLY_VERSION}}");
  });

  it("walks the canonical TARGETS set (README.md, docs/**/*.md, examples/**/*.{yml,yaml,md})", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);
    mkdirSync(join(tmpRoot, "examples", "extra"), { recursive: true });
    writeFileSync(join(tmpRoot, "examples", "extra", "extra.md"), "n/a\n", "utf8");

    const result = invokeRenderScript(["--dry-run"], { packageRoot: tmpRoot });
    expect(result.status, result.stderr).toBe(0);
    // Should mention at least 4 files (README.md, docs/configuration.md,
    // examples/azure/azure-pipelines.yml, examples/extra/extra.md).
    expect(result.stdout).toMatch(/README\.md/);
    expect(result.stdout).toMatch(/docs[\\/]configuration\.md/);
    expect(result.stdout).toMatch(/examples[\\/]azure[\\/]azure-pipelines\.yml/);
  });
});

describe("scripts/render-versions.mjs — historical vX.Y.Z literal rewrite", () => {
  it("rewrites a stale vX.Y.Z literal to the current version, idempotently", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot, "0.4.0");
    // Plant a stale v0.3.0 literal (the kind an old release would render to).
    writeFileSync(
      join(tmpRoot, "README.md"),
      "# X\n\nLatest release: **v0.3.0** — pin: v0.3.0 today.\n",
      "utf8",
    );

    const first = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(first.status, first.stderr).toBe(0);

    const rendered = readFileSync(join(tmpRoot, "README.md"), "utf8");
    // Every standalone v0.3.0 literal becomes v0.4.0.
    expect(rendered).not.toMatch(/\bv0\.3\.0\b/);
    expect(rendered).toMatch(/\*\*v0\.4\.0\*\*/);
    expect(rendered).toMatch(/pin: v0\.4\.0 today/);

    // Idempotence: re-running is a no-op.
    const second = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(second.status, second.stderr).toBe(0);
  });

  it("does NOT rewrite vX.Y.Z substrings inside URL paths or file extensions", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot, "0.4.0");
    writeFileSync(
      join(tmpRoot, "README.md"),
      [
        "# X",
        "",
        "Stable spec URL: https://semver.org/spec/v2.0.0.html",
        "Older release: https://github.com/x/y/releases/tag/v0.3.0",
        "Artifact: review.v1.2.3.html",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(result.status, result.stderr).toBe(0);

    const out = readFileSync(join(tmpRoot, "README.md"), "utf8");
    // URL path segments stay intact (SemVer spec URL, GitHub release URL).
    expect(out).toContain("https://semver.org/spec/v2.0.0.html");
    expect(out).toContain("https://github.com/x/y/releases/tag/v0.3.0");
    // Filename extension stays intact.
    expect(out).toContain("review.v1.2.3.html");
  });

  it("--check exits 1 when a stale literal would be rewritten, exits 0 after rewrite", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot, "0.4.0");
    writeFileSync(
      join(tmpRoot, "README.md"),
      "# X\n\nStale pin: v0.3.0 today\n",
      "utf8",
    );

    // Before render: --check exits 1.
    const beforeRender = invokeRenderScript(["--check"], { packageRoot: tmpRoot });
    expect(beforeRender.status).toBe(1);
    expect(beforeRender.stderr + beforeRender.stdout).toMatch(/render-versions|README\.md/);

    // Render once.
    const render = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(render.status, render.stderr).toBe(0);

    // After render: --check exits 0.
    const afterRender = invokeRenderScript(["--check"], { packageRoot: tmpRoot });
    expect(afterRender.status, afterRender.stderr).toBe(0);
  });

  it("does NOT rewrite vX.Y.Z-{prerelease} or vX.Y.Z+{build} suffixes", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot, "0.4.0");
    // Plant suffixed literals that a maintainer may have intentionally
    // written. They must be preserved byte-for-byte even after the render
    // runs, because stripping the suffix would silently rewrite a real
    // historical note.
    const SUFFIXED_LITERALS = [
      "v0.3.0-rc.1", // pre-release
      "v0.3.0-beta.2", // longer pre-release identifier
      "v0.3.0+build.7", // build metadata
      "v0.3.0-alpha", // plain pre-release label
    ];
    writeFileSync(
      join(tmpRoot, "README.md"),
      `# X\n\n` +
        SUFFIXED_LITERALS.map((literal) => `Tag: ${literal}`).join("\n") +
        "\n",
      "utf8",
    );

    const result = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(result.status, result.stderr).toBe(0);

    const out = readFileSync(join(tmpRoot, "README.md"), "utf8");
    for (const literal of SUFFIXED_LITERALS) {
      expect(out, `expected literal '${literal}' to be preserved`).toContain(`Tag: ${literal}`);
    }
    // No bare 'v0.4.0' should have been injected by the rewrite —
    // scripts/install.sh-style setup lines etc. might still mention
    // it elsewhere, so we only assert that the suffixed lines are
    // untouched byte-for-byte in their slot.
  });

  it("warns (informational, not a failure) when a bare literal is auto-migrated", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot, "0.4.0");
    writeFileSync(
      join(tmpRoot, "README.md"),
      "# X\n\nold: v0.3.0 today\n",
      "utf8",
    );

    const result = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/auto-migrated historical literals/);
    expect(result.stdout).toMatch(/README\.md: v0\.3\.0 -> v0\.4\.0/);
  });

  it("check-version-alignment also skips suffixed vX.Y.Z-{prerelease} and vX.Y.Z+{build} forms", () => {
    // The regex change means suffixed forms are explicitly excluded from
    // both the auto-rewriter and the drift detector. Maintainers can leave
    // intentional suffixed pins in shipped docs without tripping CI.
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot, "0.4.0");
    writeFileSync(
      join(tmpRoot, "README.md"),
      "# X\n\nhistoric: v0.3.0-rc.1 and v0.3.0+build.7\n",
      "utf8",
    );

    // Render first so the bare v0.3.0 pin part is migrated, leaving only
    // the suffixed forms which must be unchanged.
    const render = invokeRenderScript([], { packageRoot: tmpRoot });
    expect(render.status, render.stderr).toBe(0);

    const check = invokeCheckScript(["--quiet"], { packageRoot: tmpRoot });
    expect(check.status, check.stdout + check.stderr).toBe(0);
  });
});

describe("scripts/check-version-alignment.mjs", () => {
  it("exits 0 on a clean tree (v<package.json version> in every shipped doc)", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);
    invokeRenderScript([], { packageRoot: tmpRoot });

    const result = invokeCheckScript(["--quiet"], { packageRoot: tmpRoot });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it("detects historical vX.Y.Z pins that drifted behind", () => {
    const tmpRoot = makeIsolatedTree();
    seedTree(tmpRoot);
    invokeRenderScript([], { packageRoot: tmpRoot });
    // After the render, plant a historical pin so the drift guard fires.
    const rendered = readFileSync(join(tmpRoot, "README.md"), "utf8");
    writeFileSync(join(tmpRoot, "README.md"), `${rendered}\nold: v9.9.8\n`, "utf8");

    const result = invokeCheckScript(["--quiet"], { packageRoot: tmpRoot });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/v9\.9\.8/);
  });

  it("survives a real repo run (the on-disk state must remain aligned)", () => {
    // This catches drift at HEAD against the package.json version on
    // main. If the canonical wiring is healthy, this exits 0; if a
    // contributor forgot to run npm run render-docs, it exits 1 with a
    // diff that names the offending file.
    const result = invokeCheckScript(["--quiet"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
