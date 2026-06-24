import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-purge-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"));
    writeFileSync(path.join(dir, "README.md"), "# Purge fixture\n");
    writeFileSync(path.join(dir, "src", "app.ts"), "export const purgeFixture = true;\n");
    execGit(dir, ["add", "README.md", "src/app.ts"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "purge fixture"
    ]);
    const canonicalRepoPath = execGit(dir, ["rev-parse", "--show-toplevel"]);
    fn(canonicalRepoPath);
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

function runCli(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
}

function runCliJson(cwd, args) {
  const result = runCli(cwd, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("purge help documents preview, confirm, and safety scope", () => {
  const help = runCli(process.cwd(), ["purge", "--help"]);

  assert.equal(help.status, 0, help.stderr);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /grape purge --confirm/);
  assert.match(help.stdout, /repo-local \.grape directory/);
  assert.match(help.stdout, /Without --confirm, no data is deleted/);
  assert.match(help.stdout, /does not delete source files, Git history, editor config, or MCP config/);
  assert.match(help.stdout, /Git-tracked paths under \.grape/);
  assert.match(help.stdout, /locked or contended context sessions/);

  const conflict = runCli(process.cwd(), ["purge", "--dry-run", "--confirm"]);
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /Choose either --dry-run or --confirm/);

  const unsupported = runCli(process.cwd(), ["purge", "--force"]);
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /Unsupported option for grape purge: --force/);
});

test("purge preview does not create local state when .grape is missing", () => {
  withGitRepo((repoPath) => {
    const result = runCliJson(repoPath, ["purge"]);

    assert.equal(result.dryRun, true);
    assert.equal(result.applied, false);
    assert.equal(result.confirmationRequired, false);
    assert.equal(result.targetExists, false);
    assert.equal(result.planned.files, 0);
    assert.equal(result.planned.directories, 0);
    assert.equal(existsSync(path.join(repoPath, ".grape")), false);
  });
});

test("purge previews and confirms repo-local state deletion without deleting source or git data", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    runCliJson(repoPath, ["compile", "--task", "inspect purge fixture", "--session", "purge-session"]);
    writeFileSync(path.join(repoPath, ".grape", "tmp", "manual-note.txt"), "local note\n");

    const outsideCwd = mkdtempSync(path.join(tmpdir(), "grape-cli-purge-outside-"));
    try {
      const previewResult = runCli(outsideCwd, ["purge", "--repo", repoPath, "--json"]);

      assert.equal(previewResult.status, 0, previewResult.stderr);
      assert.equal(previewResult.stderr, "");
      assert.equal(previewResult.stdout.includes(repoPath), false);

      const preview = JSON.parse(previewResult.stdout);
      assert.equal(preview.rootPath, "<repo-root>");
      assert.equal(preview.grapeDirPath, path.join("<repo-root>", ".grape"));
      assert.equal(preview.dryRun, true);
      assert.equal(preview.applied, false);
      assert.equal(preview.confirmationRequired, true);
      assert.equal(preview.targetExists, true);
      assert.equal(preview.configRootStatus, "matches");
      assert.equal(preview.trackedPathCount, 0);
      assert.equal(preview.sessionLocks.status, "checked");
      assert.equal(preview.sessionLocks.lockedOrContended, 0);
      assert.ok(preview.planned.files > 0);
      assert.ok(preview.planned.directories > 0);
      assert.ok(preview.planned.bytes > 0);
      assert.equal(preview.deleted.files, 0);
      assert.equal(existsSync(path.join(repoPath, ".grape")), true);
    } finally {
      rmSync(outsideCwd, { recursive: true, force: true });
    }

    const applied = runCliJson(repoPath, ["purge", "--confirm"]);

    assert.equal(applied.dryRun, false);
    assert.equal(applied.applied, true);
    assert.equal(applied.confirmationRequired, false);
    assert.ok(applied.deleted.files > 0);
    assert.ok(applied.deleted.directories > 0);
    assert.equal(existsSync(path.join(repoPath, ".grape")), false);
    assert.equal(existsSync(path.join(repoPath, ".git")), true);
    assert.equal(readFileSync(path.join(repoPath, "src", "app.ts"), "utf8"), "export const purgeFixture = true;\n");

    const status = runCliJson(repoPath, ["status"]);
    assert.equal(status.initialized, false);
    assert.equal(status.configPresent, false);
    assert.equal(status.databaseExists, false);
    assert.ok(status.warnings.includes("local .grape directory has not been created."));
  });
});

test("purge refuses symlinked local state without leaking target paths", () => {
  withGitRepo((repoPath) => {
    const externalState = mkdtempSync(path.join(tmpdir(), "grape-purge-external-state-"));
    try {
      symlinkSync(externalState, path.join(repoPath, ".grape"));

      const result = runCli(repoPath, ["purge", "--confirm", "--json"]);

      assert.equal(result.status, 4);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.includes(repoPath), false);
      assert.equal(result.stderr.includes(externalState), false);
      assert.match(result.stderr, /Grape local directory must not be a symlink/);
      assert.equal(existsSync(externalState), true);
    } finally {
      rmSync(externalState, { recursive: true, force: true });
    }
  });
});

test("purge refuses symlinked config or database state", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    const externalConfig = path.join(mkdtempSync(path.join(tmpdir(), "grape-purge-config-")), "config.json");
    writeFileSync(externalConfig, "{}\n");
    rmSync(path.join(repoPath, ".grape", "config.json"), { force: true });
    symlinkSync(externalConfig, path.join(repoPath, ".grape", "config.json"));

    const result = runCli(repoPath, ["purge", "--confirm", "--json"]);

    assert.equal(result.status, 4);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Grape local state file must not be a symlink/);
    assert.equal(existsSync(path.join(repoPath, ".grape")), true);
  });
});

test("purge refuses mismatched config roots", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    const configPath = path.join(repoPath, ".grape", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.project.rootPath = path.dirname(repoPath);
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const result = runCli(repoPath, ["purge", "--confirm", "--json"]);

    assert.equal(result.status, 4);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /config root path does not match/);
    assert.equal(existsSync(path.join(repoPath, ".grape")), true);
  });
});

test("purge refuses git-tracked files under .grape", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    writeFileSync(path.join(repoPath, ".grape", "tracked.txt"), "tracked local state\n");
    execGit(repoPath, ["add", "-f", ".grape/tracked.txt"]);

    const result = runCli(repoPath, ["purge", "--confirm", "--json"]);

    assert.equal(result.status, 4);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Git-tracked paths/);
    assert.equal(existsSync(path.join(repoPath, ".grape", "tracked.txt")), true);
  });
});

test("purge refuses locked or contended sessions", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    runCliJson(repoPath, ["compile", "--task", "inspect purge locks", "--session", "locked-purge-session"]);

    const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
    try {
      database
        .prepare("UPDATE context_sessions SET lock_status = 'locked', lock_token = ? WHERE session_id = ?")
        .run("lock:purge", "locked-purge-session");
    } finally {
      database.close();
    }

    const preview = runCliJson(repoPath, ["purge"]);
    assert.equal(preview.sessionLocks.status, "checked");
    assert.equal(preview.sessionLocks.lockedOrContended, 1);

    const result = runCli(repoPath, ["purge", "--confirm", "--json"]);

    assert.equal(result.status, 4);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /sessions are locked or contended/);
    assert.equal(existsSync(path.join(repoPath, ".grape")), true);
  });
});
