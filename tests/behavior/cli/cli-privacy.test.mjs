import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { sanitizePublicOutput } from "../../../.tmp/build/src/shared/index.js";

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
  return runCliFrom(repoPath, args);
}

function runCliFrom(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
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
      envLine: "SERVICE_API_KEY=service-secret-value"
    },
    { rootPath: repoRoot }
  );

  const serialized = JSON.stringify(output);
  assert.equal(output.artifactJsonPath, publicRepoPath(".grape", "artifacts", "ctx.json"));
  assert.equal(output.headers.authorization, "<redacted-secret>");
  assert.equal(serialized.includes(repoRoot), false);
  assert.equal(serialized.includes(outsidePath), false);
  assert.equal(serialized.includes("service-secret-value"), false);
  assert.equal(serialized.includes("sk-test-1234567890abcdef"), false);

  if (path.sep === "/") {
    const aliased = sanitizePublicOutput(
      { rootPath: "/private/var/folders/grape-private-workspace/repo" },
      { rootPath: "/var/folders/grape-private-workspace/repo" }
    );
    assert.equal(aliased.rootPath, "<repo-root>");
  }

  const windowsCaseVariant = sanitizePublicOutput(
    {
      configBackupPath: "c:\\users\\runneradmin\\appdata\\local\\temp\\repo\\.grape\\config.invalid.json",
      artifactJsonPath: "c:/users/runneradmin/appdata/local/temp/repo/.grape/artifacts/context.json"
    },
    { rootPath: "C:\\Users\\RunnerAdmin\\AppData\\Local\\Temp\\Repo" }
  );
  assert.equal(windowsCaseVariant.configBackupPath, "<repo-root>\\.grape\\config.invalid.json");
  assert.equal(windowsCaseVariant.artifactJsonPath, "<repo-root>/.grape/artifacts/context.json");
});

test("cli status JSON redacts local repository paths by default", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, ["status", "--json"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr.includes(repoPath), false);
    assert.equal(result.stdout.includes(repoPath), false);
    const status = JSON.parse(result.stdout);
    assert.equal(status.rootPath, "<repo-root>");
    assert.equal(status.configPath, publicRepoPath(".grape", "config.json"));
    assert.equal(status.databasePath, publicRepoPath(".grape", "grape.db"));
    assert.equal(Object.hasOwn(status, "config"), false);
  });
});

test("cli --repo JSON redacts the target repository path when launched elsewhere", () => {
  withGitRepo((repoPath) => {
    const outsideCwd = mkdtempSync(path.join(tmpdir(), "grape-cli-outside-cwd-"));
    try {
      const result = runCliFrom(outsideCwd, ["status", "--repo", repoPath, "--json"]);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr.includes(repoPath), false);
      assert.equal(result.stdout.includes(repoPath), false);
      const status = JSON.parse(result.stdout);
      assert.equal(status.rootPath, "<repo-root>");
      assert.equal(status.configPath, publicRepoPath(".grape", "config.json"));
      assert.equal(status.databasePath, publicRepoPath(".grape", "grape.db"));
      assert.equal(Object.hasOwn(status, "config"), false);
    } finally {
      rmSync(outsideCwd, { recursive: true, force: true });
    }
  });
});

function publicRepoPath(...segments) {
  return path.join("<repo-root>", ...segments);
}

test("cli status JSON does not expose internal feature flag allowlists", () => {
  withGitRepo((repoPath) => {
    runCli(repoPath, ["init", "--connect"]);
    const configPath = path.join(repoPath, ".grape", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.scope = { featureFlagAllowlist: ["privateRolloutFlag"] };
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const result = runCli(repoPath, ["status", "--json"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes("privateRolloutFlag"), false);
    const status = JSON.parse(result.stdout);
    assert.equal(Object.hasOwn(status, "config"), false);
  });
});

test("cli bench does not leak explicit missing fixture paths", () => {
  withGitRepo((repoPath) => {
    const outsideCwd = mkdtempSync(path.join(tmpdir(), "grape-cli-bench-outside-"));
    const missingFixturePath = path.join(outsideCwd, "private-fixture");
    try {
      const result = runCliFrom(outsideCwd, [
        "bench",
        "--repo",
        repoPath,
        "--fixture",
        "private-fixture",
        "--fixture-path",
        missingFixturePath,
        "--json"
      ]);

      assert.equal(result.status, 4);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.includes(repoPath), false);
      assert.equal(result.stderr.includes(outsideCwd), false);
      assert.equal(result.stderr.includes(missingFixturePath), false);
      assert.match(result.stderr, /grape bench failed: benchmark fixture not found/);
    } finally {
      rmSync(outsideCwd, { recursive: true, force: true });
    }
  });
});

test("cli status refuses symlinked local state without leaking target paths", () => {
  withGitRepo((repoPath) => {
    const externalState = mkdtempSync(path.join(tmpdir(), "grape-status-external-state-"));
    try {
      symlinkSync(externalState, path.join(repoPath, ".grape"));

      const result = runCli(repoPath, ["status", "--json"]);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr.includes(repoPath), false);
      assert.equal(result.stderr.includes(externalState), false);
      assert.equal(result.stdout.includes(repoPath), false);
      assert.equal(result.stdout.includes(externalState), false);
      const status = JSON.parse(result.stdout);
      assert.equal(status.status, "unsafe");
      assert.ok(status.errors.includes("Grape local directory must not be a symlink: .grape"));
      assert.equal(status.initialized, false);
    } finally {
      rmSync(path.join(repoPath, ".grape"), { recursive: true, force: true });
      rmSync(externalState, { recursive: true, force: true });
    }
  });
});
