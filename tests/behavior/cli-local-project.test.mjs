import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories
} from "../../.tmp/build/src/core/storage/index.js";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-local-project-"));

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

function runCli(repoPath, args, cwd = repoPath) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
}

function runCliJson(repoPath, args) {
  const result = runCli(repoPath, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("cli help exposes setup, status, doctor, and mcp guidance commands", () => {
  const result = spawnSync(process.execPath, [cliPath, "help"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /grape init --connect/);
  assert.match(result.stdout, /grape status/);
  assert.match(result.stdout, /grape doctor/);
  assert.match(result.stdout, /grape mcp --print-config/);
});

test("cli init --connect bootstraps local .grape state and keeps it out of git status", () => {
  withGitRepo((repoPath) => {
    const init = runCli(repoPath, ["init", "--connect"]);

    assert.equal(init.status, 0, init.stderr);
    assert.equal(init.stderr, "");
    assert.match(init.stdout, /Grape initialized/);
    assert.equal(existsSync(path.join(repoPath, ".grape", "config.json")), true);
    assert.equal(existsSync(path.join(repoPath, ".grape", "grape.db")), true);
    assert.match(readFileSync(path.join(repoPath, ".git", "info", "exclude"), "utf8"), /\.grape\//);
    assert.equal(execGit(repoPath, ["status", "--porcelain=v1"]), "");
    assert.deepEqual(localSourceRejectionRefs(repoPath).filter((sourceRef) => sourceRef.startsWith(".grape/")), []);
    assert.deepEqual(localIndexedPaths(repoPath).filter((sourceRef) => sourceRef.startsWith(".grape/")), []);

    const status = runCliJson(repoPath, ["status"]);
    assert.equal(status.initialized, true);
    assert.equal(status.databaseExists, true);
    assert.deepEqual(status.pendingMigrations, []);
    assert.equal(status.dirtyWorktree, false);

    const doctor = runCliJson(repoPath, ["doctor"]);
    assert.equal(doctor.overallStatus, "pass");
    assert.ok(doctor.checks.some((check) => check.id === "privacy_local_exclude" && check.status === "pass"));

    mkdirSync(path.join(repoPath, "src"));
    const subdirStatus = runCli(repoPath, ["status", "--json"], path.join(repoPath, "src"));
    assert.equal(subdirStatus.status, 0, subdirStatus.stderr);
    assert.equal(subdirStatus.stderr, "");
    assert.equal(JSON.parse(subdirStatus.stdout).initialized, true);
  });
});

function localSourceRejectionRefs(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return createEvidenceStorageRepositories(database).sourceRejections.listAll().map((row) => row.sourceRef);
  } finally {
    database.close();
  }
}

function localIndexedPaths(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    const rows = database
      .prepare("SELECT snapshot_id FROM repo_snapshots ORDER BY created_at DESC LIMIT 1")
      .all();
    const snapshotId = rows[0]?.snapshot_id;
    if (!snapshotId) return [];
    return createIndexingStorageRepositories(database).symbolNodes.listBySnapshot(String(snapshotId)).map((row) => row.path);
  } finally {
    database.close();
  }
}

test("cli mcp --print-config emits the V1 stdio connection contract", () => {
  const result = spawnSync(process.execPath, [cliPath, "mcp", "--print-config"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.grapeMcp, {
    status: "contract_only",
    implemented: false,
    serverName: "grape",
    command: "grape",
    args: ["mcp", "--stdio"],
    transport: "stdio",
    note: "The stdio MCP server is not implemented in the current setup slice."
  });
});

test("cli rejects unsupported flags instead of pretending commands are implemented", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, ["doctor", "--privacy"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported option/);
  });
});

test("cli status reports config root mismatch as stale local state", () => {
  withGitRepo((repoPath) => {
    const init = runCli(repoPath, ["init", "--connect"]);
    assert.equal(init.status, 0, init.stderr);

    const configPath = path.join(repoPath, ".grape", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.project.rootPath = path.join(repoPath, "moved");
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const status = runCli(repoPath, ["status", "--json"]);
    assert.equal(status.status, 3, status.stderr);
    assert.equal(status.stderr, "");
    const parsed = JSON.parse(status.stdout);
    assert.equal(parsed.initialized, false);
    assert.ok(parsed.errors.includes("Grape config root path does not match the current repository path."));
  });
});
