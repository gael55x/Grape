import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { sanitizePublicOutput } from "../../.tmp/build/src/shared/index.js";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-privacy-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, ".gitignore"), "ignored.env\n");
    writeFileSync(path.join(dir, ".grapeignore"), "private.txt\n");
    writeFileSync(path.join(dir, "README.md"), "# Privacy fixture\n");
    writeFileSync(path.join(dir, "ignored.env"), "SECRET=ignored\n");
    writeFileSync(path.join(dir, "private.txt"), "SECRET=private\n");
    execGit(dir, ["add", "README.md", ".gitignore", ".grapeignore"]);
    execGit(dir, ["add", "-f", "ignored.env", "private.txt"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "privacy fixture"
    ]);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function execGit(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function runCli(repoPath, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoPath,
    encoding: "utf8"
  });
}

test("cli doctor --privacy reports privacy diagnostics without secret contents", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, ["doctor", "--privacy", "--json"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.includes("SECRET=ignored"), false);
    assert.equal(result.stdout.includes("SECRET=private"), false);

    const doctor = JSON.parse(result.stdout);
    const checks = new Map(doctor.checks.map((check) => [check.id, check]));
    assert.equal(checks.get("local_first")?.status, "pass");
    assert.equal(checks.get("scan_rejections")?.status, "warn");
    assert.match(checks.get("scan_rejections")?.detail, /git_ignored=1/);
    assert.match(checks.get("scan_rejections")?.detail, /privacy_ignored=1/);
    assert.equal(checks.get("ignored_private_inputs")?.status, "pass");
    assert.equal(doctor.checks.some((check) => check.message.includes("SECRET=")), false);
  });
});

test("public output sanitizer redacts repo paths, local paths, and secret-looking values", () => {
  const repoRoot = path.join(tmpdir(), "grape-private-workspace", "repo");
  const outsidePath = path.join(tmpdir(), "grape-private-workspace", "outside.txt");
  const output = sanitizePublicOutput(
    {
      artifactJsonPath: path.join(repoRoot, ".grape", "artifacts", "ctx.json"),
      debug: `outside=${outsidePath}`,
      headers: {
        authorization: "Bearer sk-test-1234567890abcdef"
      },
      envLine: "CURSOR_API_KEY=cursor-secret-value"
    },
    { rootPath: repoRoot }
  );

  const serialized = JSON.stringify(output);
  assert.equal(output.artifactJsonPath, "<repo-root>/.grape/artifacts/ctx.json");
  assert.equal(output.headers.authorization, "<redacted-secret>");
  assert.equal(serialized.includes(repoRoot), false);
  assert.equal(serialized.includes(outsidePath), false);
  assert.equal(serialized.includes("cursor-secret-value"), false);
  assert.equal(serialized.includes("sk-test-1234567890abcdef"), false);
});

test("cli status JSON redacts local repository paths by default", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, ["status", "--json"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr.includes(repoPath), false);
    assert.equal(result.stdout.includes(repoPath), false);
    const status = JSON.parse(result.stdout);
    assert.equal(status.rootPath, "<repo-root>");
    assert.equal(status.configPath, "<repo-root>/.grape/config.json");
    assert.equal(status.databasePath, "<repo-root>/.grape/grape.db");
  });
});

test("cli status refuses symlinked local state without leaking target paths", () => {
  withGitRepo((repoPath) => {
    const externalState = mkdtempSync(path.join(tmpdir(), "grape-status-external-state-"));
    try {
      symlinkSync(externalState, path.join(repoPath, ".grape"));

      const result = runCli(repoPath, ["status", "--json"]);

      assert.equal(result.status, 3, result.stderr);
      assert.equal(result.stderr.includes(repoPath), false);
      assert.equal(result.stderr.includes(externalState), false);
      assert.equal(result.stdout.includes(repoPath), false);
      assert.equal(result.stdout.includes(externalState), false);
      const status = JSON.parse(result.stdout);
      assert.ok(status.errors.includes("Grape local directory must not be a symlink: .grape"));
      assert.equal(status.initialized, false);
    } finally {
      rmSync(path.join(repoPath, ".grape"), { recursive: true, force: true });
      rmSync(externalState, { recursive: true, force: true });
    }
  });
});
