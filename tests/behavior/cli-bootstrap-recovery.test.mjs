import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-bootstrap-recovery-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, "README.md"), "# Fixture\n");
    execGit(dir, ["add", "README.md"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial fixture"
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

function runCliJson(repoPath, args) {
  const result = runCli(repoPath, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("cli status, doctor, and init recover repairable malformed local config safely", () => {
  withGitRepo((repoPath) => {
    const initial = runCliJson(repoPath, ["init", "--connect"]);
    const configPath = path.join(repoPath, ".grape", "config.json");
    writeFileSync(configPath, "{not valid json");

    const status = runCli(repoPath, ["status", "--json"]);
    assert.equal(status.status, 3, status.stderr);
    const parsedStatus = JSON.parse(status.stdout);
    assert.equal(parsedStatus.initialized, false);
    assert.ok(parsedStatus.errors.some((error) => error.startsWith("Grape config is repairable but invalid")));
    assert.ok(
      parsedStatus.recoveryGuidance.includes(
        "Grape will back up the invalid config before writing a fresh local config."
      )
    );

    const doctor = runCli(repoPath, ["doctor", "--json"]);
    assert.equal(doctor.status, 3, doctor.stderr);
    const parsedDoctor = JSON.parse(doctor.stdout);
    assert.equal(parsedDoctor.overallStatus, "fail");
    assert.ok(parsedDoctor.checks.some((check) => check.id === "config" && check.status === "fail"));
    assert.ok(
      parsedDoctor.recoveryGuidance.includes(
        "Run grape init --connect from the repository root to bootstrap or repair local state."
      )
    );

    const repaired = runCliJson(repoPath, ["init", "--connect"]);
    assert.equal(repaired.configStatus, "repaired");
    assert.equal(existsSync(repaired.configBackupPath), true);
    assert.equal(readFileSync(repaired.configBackupPath, "utf8"), "{not valid json");
    assert.equal(JSON.parse(readFileSync(configPath, "utf8")).project.repoId, initial.repoId);

    const repairedDoctor = runCliJson(repoPath, ["doctor"]);
    assert.equal(repairedDoctor.overallStatus, "pass");

    writeFileSync(configPath, `${JSON.stringify({ schemaVersion: 999 })}\n`);
    const unsupportedStatus = runCli(repoPath, ["status", "--json"]);
    assert.equal(unsupportedStatus.status, 3, unsupportedStatus.stderr);
    const parsedUnsupportedStatus = JSON.parse(unsupportedStatus.stdout);
    assert.ok(parsedUnsupportedStatus.errors.some((error) => error.startsWith("Grape config is unsupported")));
    assert.ok(
      parsedUnsupportedStatus.recoveryGuidance.includes(
        "Use a Grape version that supports this config, or inspect .grape/config.json before reinitializing."
      )
    );

    const unsupportedInit = runCli(repoPath, ["init", "--connect"]);
    assert.equal(unsupportedInit.status, 4);
    assert.match(unsupportedInit.stderr, /unsupported Grape config schema version/);
  });
});

test("cli compile auto-repairs repairable partial bootstrap config", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, ".grape"), { recursive: true });
    writeFileSync(path.join(repoPath, ".grape", "config.json"), "{not valid json");

    const compile = runCli(repoPath, [
      "compile",
      "--task",
      "Explain the README entry point",
      "--session",
      "repair-test",
      "--json"
    ]);

    assert.equal(compile.status, 0, compile.stderr);
    assert.equal(compile.stderr, "");
    const output = JSON.parse(compile.stdout);
    assert.equal(output.sessionId, "repair-test");
    const backups = readdirSync(path.join(repoPath, ".grape")).filter((entry) => entry.startsWith("config.invalid."));
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(path.join(repoPath, ".grape", backups[0]), "utf8"), "{not valid json");
    assert.equal(execGit(repoPath, ["status", "--porcelain=v1"]), "");
  });
});
