import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runMcpContextRestoreSession } from "./mcp-smoke-session.mjs";
import { envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const sourcePackage = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const expectedPackage = sourcePackage.name;
const expectedVersion = sourcePackage.version;
const repoPath = mkdtempSync(path.join(tmpdir(), "grape-global-smoke-"));

try {
  const npmList = spawnSync("npm", ["list", "-g", `${expectedPackage}@${expectedVersion}`, "--depth=0", "--json"], {
    encoding: "utf8",
    env: smokeEnv()
  });
  assert(npmList.status === 0, `global npm package ${expectedPackage}@${expectedVersion} is not installed`);

  bootstrapGitRepo(repoPath);

  const help = runGrape(["help"]);
  assert(help.status === 0, `grape help failed: ${help.stderr.trim()}`);
  assert(help.stdout.includes("grape"), "grape help produced no CLI output");

  const init = runGrape(["init", "--connect"]);
  assert(init.status === 0, `grape init failed: ${init.stderr.trim()}`);

  const compileArgs = ["compile", "--task", "global install smoke", "--session", "global-smoke-cli", "--json"];
  const first = runGrape(compileArgs);
  assert(first.status === 0, `first compile failed: ${first.stderr.trim() || first.error?.message}`);
  assert(JSON.parse(first.stdout).contextPackItems.some((item) => item.state === "NEW"), "first compile must send NEW items");

  const second = runGrape(compileArgs);
  assert(second.status === 0, `second compile failed: ${second.stderr.trim() || second.error?.message}`);
  const secondJson = JSON.parse(second.stdout);
  assert(
    secondJson.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"),
    "second compile must include OMIT_UNCHANGED"
  );
  const restorable = secondJson.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
  assert(restorable?.restoreId, "second compile must include RESTORE_AVAILABLE with restoreId");

  const restored = runGrape(["omitted", "--session", "global-smoke-cli", "--token", restorable.restoreId, "--json"]);
  assert(restored.status === 0, `omitted restore failed: ${restored.stderr.trim()}`);
  assert(JSON.parse(restored.stdout).status === "restored", "omitted restore must return restored status");

  const mismatch = runGrape([
    "compile",
    "--task",
    "different global install smoke",
    "--session",
    "global-smoke-cli",
    "--json"
  ]);
  assert(mismatch.status === 6, `task/session mismatch must exit 6, got ${mismatch.status}`);
  assert(mismatch.stderr.includes("Recovery:"), "task/session mismatch must include recovery guidance");

  const reset = runGrape([...compileArgs, "--reset-session"]);
  assert(reset.status === 0, `reset compile failed: ${reset.stderr.trim() || reset.error?.message}`);
  const resetJson = JSON.parse(reset.stdout);
  assert(/^reset:/.test(resetJson.sessionResetId), "reset compile must report a reset id");
  assert(
    resetJson.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"),
    "reset compile must invalidate prior context"
  );
  assert(resetJson.contextPackItems.some((item) => item.state === "NEW"), "reset compile must resend current context");

  const mcp = await runMcpContextRestoreSession({
    command: "grape",
    args: ["mcp", "--stdio", "--repo", repoPath],
    cwd: repoPath,
    env: envWithSqliteNodeOptions(smokeEnv()),
    clientInfo: { name: "grape-global-smoke", version: expectedVersion },
    query: "global mcp smoke",
    sessionId: "global-smoke-mcp"
  });
  assert(mcp.turn1.structuredContent.contextPackItems.some((item) => item.state === "NEW"), "MCP turn 1 must send NEW items");
  assert(
    mcp.turn2.structuredContent.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"),
    "MCP turn 2 must include OMIT_UNCHANGED"
  );
  assert(mcp.restored.structuredContent.status === "restored", "MCP restore must return restored status");

  console.log(`global install smoke ok: ${expectedPackage}@${expectedVersion}`);
} finally {
  rmSync(repoPath, { recursive: true, force: true });
}

function bootstrapGitRepo(targetPath) {
  writeFileSync(path.join(targetPath, "README.md"), "# global smoke\n");
  writeFileSync(path.join(targetPath, ".gitignore"), "node_modules/\n");
  run("git", ["init", "-b", "main"], { cwd: targetPath });
  run("git", ["add", "README.md"], { cwd: targetPath });
  run("git", ["-c", "user.name=Grape Global Smoke", "-c", "user.email=grape@example.test", "commit", "-m", "init"], {
    cwd: targetPath
  });
}

function runGrape(args, options = {}) {
  return spawnSync("grape", args, {
    cwd: repoPath,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: envWithSqliteNodeOptions(smokeEnv()),
    ...options
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "ignore", ...options });
  assert(result.status === 0, `${command} ${args.join(" ")} failed`);
  return result;
}

function smokeEnv() {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
