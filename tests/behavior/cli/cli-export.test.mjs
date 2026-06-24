import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-export-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"));
    writeFileSync(path.join(dir, "README.md"), "# Export fixture\n");
    writeFileSync(
      path.join(dir, "src", "app.ts"),
      [
        "export function renderExportFixture() {",
        "  return 'grape export unique source phrase 98765';",
        "}",
        ""
      ].join("\n")
    );
    execGit(dir, ["add", "README.md", "src/app.ts"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "export fixture"
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

test("export help documents inventory scope and omitted raw bodies", () => {
  const help = runCli(process.cwd(), ["export", "--help"]);

  assert.equal(help.status, 0, help.stderr);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /grape export \[--repo <path>\] \[--json\]/);
  assert.match(help.stdout, /local Grape inventory/);
  assert.match(help.stdout, /does not include raw repository source bodies/);
  assert.match(help.stdout, /does not delete, compact, or purge local data/);

  const unsupported = runCli(process.cwd(), ["export", "--confirm"]);
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /Unsupported option for grape export: --confirm/);
});

test("export reports sanitized local inventory without raw source text", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    runCliJson(repoPath, ["sync"]);

    const outsideCwd = mkdtempSync(path.join(tmpdir(), "grape-cli-export-outside-"));
    try {
      const result = runCli(outsideCwd, ["export", "--repo", repoPath, "--json"]);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout.includes(repoPath), false);
      assert.equal(result.stdout.includes("grape export unique source phrase 98765"), false);

      const exported = JSON.parse(result.stdout);
      assert.equal(exported.formatVersion, 1);
      assert.equal(exported.rootPath, "<repo-root>");
      assert.equal(exported.databasePath, path.join("<repo-root>", ".grape", "grape.db"));
      assert.ok(exported.storageFootprint.grapeBytes > 0);
      assert.ok(exported.storageFootprint.databaseBytes > 0);
      assert.ok(exported.rowCounts.repositoryState.sources > 0);
      assert.ok(exported.rowCounts.indexes.ftsEntryText > 0);
      assert.equal(exported.sourceTextStorage.storesAllowedSourceTextForLexicalSearch, true);
      assert.ok(exported.omittedFromExport.includes("raw repository source file bodies"));
      assert.ok(exported.omittedFromExport.includes("raw FTS text bodies from fts_entry_text"));
      assert.ok(exported.notes.includes("This export is a local inventory, not a database dump."));

      const human = runCli(repoPath, ["export"]);
      assert.equal(human.status, 0, human.stderr);
      assert.equal(human.stdout.includes("grape export unique source phrase 98765"), false);
      assert.match(human.stdout, /Grape export inventory/);
      assert.match(human.stdout, /Export omits:/);
      assert.match(human.stdout, /raw repository source file bodies/);
    } finally {
      rmSync(outsideCwd, { recursive: true, force: true });
    }
  });
});

test("export refuses symlinked local state without leaking target paths", () => {
  withGitRepo((repoPath) => {
    const externalState = mkdtempSync(path.join(tmpdir(), "grape-export-external-state-"));
    try {
      symlinkSync(externalState, path.join(repoPath, ".grape"));

      const result = runCli(repoPath, ["export", "--json"]);

      assert.equal(result.status, 4);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.includes(repoPath), false);
      assert.equal(result.stderr.includes(externalState), false);
      assert.match(result.stderr, /Grape local directory must not be a symlink/);
    } finally {
      rmSync(externalState, { recursive: true, force: true });
    }
  });
});
