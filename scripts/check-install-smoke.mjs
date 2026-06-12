import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMcpContextRestoreSession } from "./mcp-smoke-session.mjs";
import {
  commandForPlatform,
  installedBinForPlatform,
  spawnFailureMessage,
  spawnOptionsForPlatform
} from "./platform-command.mjs";
import { assertNodeSqliteAvailable, envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const root = process.cwd();
assertNodeSqliteAvailable();
const packDir = path.join(root, ".tmp", "install-smoke-pack");
const npmCacheDir = path.join(root, ".tmp", "npm-cache-install-smoke");
const sourcePackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
mkdirSync(npmCacheDir, { recursive: true });

const pack = spawnSync(
  commandForPlatform("npm"),
  ["pack", "--pack-destination", packDir, "--ignore-scripts"],
  spawnOptionsForPlatform({
    cwd: root,
    encoding: "utf8",
    env: npmEnv(),
    stdio: ["ignore", "pipe", "pipe"]
  })
);
assert(pack.status === 0, `npm pack failed: ${spawnFailureMessage(pack)}`);

const packedTarball = pack.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
const tarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
assert(tarballs.length === 1, `npm pack must produce exactly one tarball, found ${tarballs.length}`);
const tarball = tarballs[0];
assert(tarball === packedTarball, `selected tarball ${tarball} must match npm pack output ${packedTarball}`);

const consumerRepo = mkdtempSync(path.join(tmpdir(), "grape-install-smoke-"));
const tarballPath = path.join(packDir, tarball);

try {
  bootstrapGitRepo(consumerRepo);

  const install = spawnSync(
    commandForPlatform("npm"),
    ["install", tarballPath],
    spawnOptionsForPlatform({
      cwd: consumerRepo,
      encoding: "utf8",
      env: npmEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    })
  );
  assert(install.status === 0, `npm install failed: ${spawnFailureMessage(install)}`);

  const grapeBin = installedBinForPlatform(path.join(consumerRepo, "node_modules", ".bin", "grape"));
  assert(existsSync(grapeBin), "installed package is missing node_modules/.bin/grape");
  assertInstalledPackageMetadata(consumerRepo);

  const spawnGrape = (args) =>
    spawnSync(grapeBin, args, spawnOptionsForPlatform({
      cwd: consumerRepo,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: envWithSqliteNodeOptions(npmEnv())
    }));

  const help = spawnGrape(["help"]);
  assert(help.status === 0, `grape help failed: ${help.stderr.trim()}`);
  assert(help.stdout.includes("grape"), "grape help produced no CLI output");

  const init = spawnGrape(["init", "--connect"]);
  assert(init.status === 0, `grape init failed: ${init.stderr.trim()}`);

  const compileArgs = ["compile", "--task", "install smoke", "--session", "install-smoke-cli", "--json"];
  const compile1 = spawnGrape(compileArgs);
  assert(compile1.status === 0, `first grape compile failed: ${compile1.stderr.trim() || compile1.error?.message}`);
  const first = JSON.parse(compile1.stdout);
  assert(Array.isArray(first.contextPackItems), "first compile JSON must include contextPackItems");

  const compile2 = spawnGrape(compileArgs);
  assert(compile2.status === 0, `second grape compile failed: ${compile2.stderr.trim() || compile2.error?.message}`);
  const second = JSON.parse(compile2.stdout);
  assert(Array.isArray(second.contextPackItems), "second compile JSON must include contextPackItems");
  assert(
    second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"),
    "second compile must include OMIT_UNCHANGED"
  );
  assert(
    second.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE"),
    "second compile must include RESTORE_AVAILABLE"
  );
  const restorable = second.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
  assert(restorable?.restoreId, "second compile must include a restoreId");

  const restoredCli = spawnGrape([
    "omitted",
    "--session",
    "install-smoke-cli",
    "--token",
    restorable.restoreId,
    "--json"
  ]);
  assert(restoredCli.status === 0, `CLI omitted restore failed: ${restoredCli.stderr.trim()}`);
  const restoredCliJson = JSON.parse(restoredCli.stdout);
  assert(restoredCliJson.status === "restored", "CLI omitted restore must return restored status");
  assert(typeof restoredCliJson.body === "string" && restoredCliJson.body.length > 0, "CLI omitted restore must return a body");

  const mismatch = spawnGrape([
    "compile",
    "--task",
    "different install smoke",
    "--session",
    "install-smoke-cli",
    "--json"
  ]);
  assert(mismatch.status === 6, `task/session mismatch must exit 6, got ${mismatch.status}`);
  assert(mismatch.stdout === "", "task/session mismatch must not emit JSON stdout");
  assert(mismatch.stderr.includes("context session task mismatch"), "task/session mismatch must explain the mismatch");
  assert(mismatch.stderr.includes("Recovery:"), "task/session mismatch must include recovery guidance");

  const reset = spawnGrape([...compileArgs, "--reset-session"]);
  assert(reset.status === 0, `reset compile failed: ${reset.stderr.trim() || reset.error?.message}`);
  const resetJson = JSON.parse(reset.stdout);
  assert(resetJson.sessionId === "install-smoke-cli", "reset compile must keep the explicit session");
  assert(/^reset:/.test(resetJson.sessionResetId), "reset compile must report a reset id");
  assert(
    resetJson.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"),
    "reset compile must invalidate prior sent context"
  );
  assert(
    resetJson.contextPackItems.some((item) => item.state === "NEW"),
    "reset compile must resend current context"
  );

  const mcp = await runMcpContextRestoreSession({
    command: grapeBin,
    args: ["mcp", "--stdio", "--repo", consumerRepo],
    cwd: consumerRepo,
    env: envWithSqliteNodeOptions(npmEnv()),
    clientInfo: { name: "grape-install-smoke", version: sourcePackage.version },
    query: "install smoke",
    sessionId: "install-smoke-mcp"
  });
  assert(mcp.turn1.structuredContent.contextPackItems.some((item) => item.state === "NEW"), "mcp turn 1 must send NEW items");
  assert(mcp.turn2.structuredContent.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), "mcp turn 2 must include OMIT_UNCHANGED");
  assert(mcp.turn2.structuredContent.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE"), "mcp turn 2 must include RESTORE_AVAILABLE");
  assert(mcp.restored.structuredContent.status === "restored", "mcp restore must return restored status");
  assert(typeof mcp.restored.structuredContent.body === "string" && mcp.restored.structuredContent.body.length > 0, "mcp restore must return an omitted body");

  console.log(`install smoke ok: ${tarball}`);
} finally {
  rmSync(consumerRepo, { recursive: true, force: true });
}

function bootstrapGitRepo(repoPath) {
  writeFileSync(path.join(repoPath, "README.md"), "# install smoke\n");
  writeFileSync(path.join(repoPath, ".gitignore"), "node_modules/\n");
  execFileSync("git", ["init", "-b", "main"], { cwd: repoPath, stdio: "ignore" });
  execFileSync("git", ["add", "README.md"], { cwd: repoPath, stdio: "ignore" });
  execFileSync(
    "git",
    ["-c", "user.name=Grape Install Smoke", "-c", "user.email=grape@example.test", "commit", "-m", "init"],
    { cwd: repoPath, stdio: "ignore" }
  );
}

function npmEnv() {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: npmCacheDir,
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
}

function assertInstalledPackageMetadata(consumerRepo) {
  const packageJsonPath = path.join(consumerRepo, "node_modules", ...sourcePackage.name.split("/"), "package.json");
  assert(existsSync(packageJsonPath), `installed package is missing ${sourcePackage.name}/package.json`);
  const installedPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  assert(installedPackage.name === sourcePackage.name, `installed package name must be ${sourcePackage.name}`);
  assert(installedPackage.version === sourcePackage.version, `installed package version must be ${sourcePackage.version}`);
  assert(
    installedPackage.engines?.node === sourcePackage.engines?.node,
    `installed package Node engine must be ${sourcePackage.engines?.node}`
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
