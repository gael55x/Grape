import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

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
