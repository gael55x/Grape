import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { encodeMcpMessage } from "./mcp-smoke-session.mjs";
import {
  commandForPlatform,
  installedPackageBinTarget,
  spawnFailureMessage,
  spawnOptionsForPlatform
} from "./platform-command.mjs";
import { assertNodeSqliteAvailable, envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const root = process.cwd();
const sourcePackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const packDir = path.join(root, ".tmp", "beta-client-pack");
const npmCacheDir = path.join(root, ".tmp", "npm-cache-beta-client-trial");
const commandTimeoutMs = 120000;

assertNodeSqliteAvailable();
rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
mkdirSync(npmCacheDir, { recursive: true });

const build = spawnSync(
  commandForPlatform("npm"),
  ["run", "build"],
  spawnOptionsForPlatform({
    cwd: root,
    encoding: "utf8",
    env: npmEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    timeout: commandTimeoutMs
  })
);
assert(build.status === 0, `npm run build failed: ${spawnFailureMessage(build)}`);
logStep("built dist");

const pack = spawnSync(
  commandForPlatform("npm"),
  ["pack", "--pack-destination", packDir, "--ignore-scripts"],
  spawnOptionsForPlatform({
    cwd: root,
    encoding: "utf8",
    env: npmEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    timeout: commandTimeoutMs
  })
);
assert(pack.status === 0, `npm pack failed: ${spawnFailureMessage(pack)}`);

const packedTarball = pack.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
const tarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
assert(tarballs.length === 1, `npm pack must produce exactly one tarball, found ${tarballs.length}`);
assert(tarballs[0] === packedTarball, `selected tarball ${tarballs[0]} must match npm pack output ${packedTarball}`);
logStep("packed local tarball");

const consumerRepo = mkdtempSync(path.join(tmpdir(), "grape-beta-client-trial-"));

try {
  bootstrapConsumerRepo(consumerRepo);
  logStep("created trial repo");
  installPackedPackage(consumerRepo, path.join(packDir, tarballs[0]));
  logStep("installed packed package with npm install");
  commitConsumerRepo(consumerRepo);
  logStep("committed consumer npm install state");

  const grapeCli = installedPackageBinTarget(consumerRepo, sourcePackage.name, sourcePackage.bin.grape);
  assert(existsSync(grapeCli), `installed package is missing ${sourcePackage.bin.grape}`);

  const npxVersion = runNpmExecGrape(consumerRepo, ["--version"], "npm exec grape --version");
  assert(npxVersion.stdout.trim() === `${sourcePackage.name} ${sourcePackage.version}`, "npm exec grape --version must match package metadata");
  const help = runNpmExecGrape(consumerRepo, ["help"], "npm exec grape help");
  assert(help.stdout.includes("grape init --connect"), "npm exec grape help must point to init/connect");
  assert(help.stdout.includes("grape mcp --print-config"), "npm exec grape help must point to MCP config");
  const initConnect = runNpmExecGrape(consumerRepo, ["init", "--connect"], "npm exec grape init --connect");
  assert(initConnect.stdout.includes("MCP integration:"), "npm exec grape init --connect must print MCP integration guidance");
  assert(initConnect.stdout.includes("grape mcp --print-config"), "npm exec grape init --connect must point to the MCP config command");
  logStep("ran npm exec grape init --connect");

  runCliCoreTrial(grapeCli, consumerRepo);
  logStep("completed CLI core workflow trial");

  await runMcpBetaTrial({
    command: process.execPath,
    args: [grapeCli, "mcp", "--stdio", "--repo", consumerRepo],
    cwd: consumerRepo,
    env: envWithSqliteNodeOptions(npmEnv()),
    repoPath: consumerRepo
  });
  logStep("completed MCP beta trial");

  console.log(`beta client trial ok: ${sourcePackage.name}@${sourcePackage.version}`);
} finally {
  rmSync(consumerRepo, { recursive: true, force: true });
}

function bootstrapConsumerRepo(repoPath) {
  mkdirSync(path.join(repoPath, "src"), { recursive: true });
  mkdirSync(path.join(repoPath, "private"), { recursive: true });
  writeFileSync(path.join(repoPath, "README.md"), "# beta client trial\n");
  writeFileSync(
    path.join(repoPath, "package.json"),
    JSON.stringify(
      {
        name: "grape-beta-client-trial",
        version: "0.0.0",
        private: true,
        type: "module"
      },
      null,
      2
    ) + "\n"
  );
  writeFileSync(path.join(repoPath, ".gitignore"), "node_modules/\n.env\n");
  writeFileSync(path.join(repoPath, ".aiignore"), "private/\nignored-output.log\n");
  writeFileSync(
    path.join(repoPath, "src", "billing.js"),
    [
      "export function calculateTotal(subtotal, member) {",
      "  const discount = member ? 0.1 : 0;",
      "  return Math.round(subtotal * (1 - discount));",
      "}",
      ""
    ].join("\n")
  );
  writeFileSync(
    path.join(repoPath, "src", "billing.test.js"),
    [
      "import { calculateTotal } from './billing.js';",
      "",
      "test('calculateTotal applies member discount', () => {",
      "  expect(calculateTotal(100, true)).toBe(90);",
      "});",
      ""
    ].join("\n")
  );
  writeFileSync(path.join(repoPath, ".env"), "API_KEY=secret-beta-client-trial-value\n");
  writeFileSync(path.join(repoPath, "private", "ignored-secret.js"), "export const token = 'PRIVATE_TOKEN=value';\n");
  writeFileSync(path.join(repoPath, "ignored-output.log"), "password=secret-beta-client-trial-value\n");

  runGit(repoPath, ["init", "-b", "main"]);
}

function installPackedPackage(repoPath, tarballPath) {
  const install = spawnSync(
    commandForPlatform("npm"),
    ["install", tarballPath],
    spawnOptionsForPlatform({
      cwd: repoPath,
      encoding: "utf8",
      env: npmEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: commandTimeoutMs
    })
  );
  assert(install.status === 0, `npm install failed: ${spawnFailureMessage(install)}`);

  const packageJsonPath = path.join(repoPath, "node_modules", ...sourcePackage.name.split("/"), "package.json");
  assert(existsSync(packageJsonPath), `installed package is missing ${sourcePackage.name}/package.json`);
  const installedPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  assert(installedPackage.name === sourcePackage.name, `installed package name must be ${sourcePackage.name}`);
  assert(installedPackage.version === sourcePackage.version, `installed package version must be ${sourcePackage.version}`);
}

function commitConsumerRepo(repoPath) {
  runGit(repoPath, ["add", ".gitignore", ".aiignore", "README.md", "package.json", "package-lock.json", "src/billing.js", "src/billing.test.js"]);
  runGit(repoPath, [
    "-c",
    "user.name=Grape Beta Trial",
    "-c",
    "user.email=grape@example.test",
    "commit",
    "-m",
    "initial beta trial fixture"
  ]);
}

function runCliCoreTrial(grapeCli, repoPath) {
  const version = runInstalledCli(grapeCli, repoPath, ["--version"], "grape --version");
  assert(version.stdout.trim() === `${sourcePackage.name} ${sourcePackage.version}`, "grape --version must match package metadata");

  const mcpConfig = parseInstalledCliJson(grapeCli, repoPath, ["mcp", "--print-config"], "grape mcp --print-config");
  assert(mcpConfig.grapeMcp?.command === "grape", "mcp config must include the grape command");
  assert(
    Array.isArray(mcpConfig.grapeMcp?.args) && mcpConfig.grapeMcp.args.includes("--stdio"),
    "mcp config must include stdio args"
  );

  const status = parseInstalledCliJson(grapeCli, repoPath, ["status", "--json"], "grape status --json");
  assert(status.initialized === true, "status must report initialized project");
  assert(status.configPresent === true, "status must report config present");
  assert(status.databaseExists === true, "status must report database present");

  const doctor = parseInstalledCliJson(grapeCli, repoPath, ["doctor", "--json"], "grape doctor --json");
  assert(doctor.overallStatus !== "fail", "doctor must not fail after init");

  const privacyDoctor = parseInstalledCliJson(grapeCli, repoPath, ["doctor", "--privacy", "--json"], "grape doctor --privacy --json");
  assert(privacyDoctor.overallStatus !== "fail", "privacy doctor must not fail with ignored secret-looking files");

  const sync = parseInstalledCliJson(grapeCli, repoPath, ["sync", "--json"], "grape sync --json");
  assert(sync.dirtyWorktree === false, "sync must start from a clean committed repo");

  const task = "CLI core workflow billing change";
  const sessionId = "beta-cli-core-session";
  const compileArgs = ["compile", "--task", task, "--session", sessionId, "--json"];
  const first = parseInstalledCliJson(grapeCli, repoPath, compileArgs, "grape compile first turn");
  assert(first.contextPackItems.some((item) => item.state === "NEW"), "first compile must send NEW context");
  assert(typeof first.artifactId === "string" && first.artifactId.length > 0, "first compile must return an artifactId");

  const second = parseInstalledCliJson(grapeCli, repoPath, compileArgs, "grape compile second turn");
  assert(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), "second compile must omit unchanged context");
  const restorable = second.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
  assert(restorable?.restoreId, "second compile must expose a restore token");

  const omittedList = parseInstalledCliJson(
    grapeCli,
    repoPath,
    ["omitted", "--session", sessionId, "--json"],
    "grape omitted --json"
  );
  assert(
    omittedList.omittedItems.some((item) => item.restoreId === restorable.restoreId),
    "omitted list must include the restore token from second compile"
  );

  const restored = parseInstalledCliJson(
    grapeCli,
    repoPath,
    ["omitted", "--session", sessionId, "--token", restorable.restoreId, "--json"],
    "grape omitted restore"
  );
  assert(restored.status === "restored", "CLI omitted restore must return restored status");
  assert(typeof restored.body === "string" && restored.body.length > 0, "CLI omitted restore must return a body");

  const diff = parseInstalledCliJson(
    grapeCli,
    repoPath,
    ["diff-context", "--task", task, "--session", sessionId, "--explain", "--json"],
    "grape diff-context --explain"
  );
  assert(Array.isArray(diff.contextPackItems), "diff-context must return contextPackItems");
  assert(diff.contextPackItems.length > 0, "diff-context must return a non-empty pack");

  const sessions = parseInstalledCliJson(grapeCli, repoPath, ["sessions", "--json"], "grape sessions --json");
  assert(sessions.sessions.some((session) => session.sessionId === sessionId), "sessions must include the CLI session");

  const artifacts = parseInstalledCliJson(grapeCli, repoPath, ["artifacts", "--session", sessionId, "--json"], "grape artifacts --json");
  assert(artifacts.artifacts.some((artifact) => artifact.artifactId === first.artifactId), "artifacts must include first compile artifact");

  const artifact = parseInstalledCliJson(
    grapeCli,
    repoPath,
    ["artifacts", "--artifact", first.artifactId, "--json"],
    "grape artifacts --artifact --json"
  );
  assert(artifact.artifactId === first.artifactId, "artifact inspection must return the requested artifact");
  assert(artifact.artifactFiles?.jsonExists === true, "artifact inspection must report JSON artifact present");

  const claims = parseInstalledCliJson(grapeCli, repoPath, ["claims", "--active", "--json"], "grape claims --active --json");
  assert(Array.isArray(claims.claims), "claims inspection must return a claims array");

  const proofs = parseInstalledCliJson(grapeCli, repoPath, ["proofs", "--json"], "grape proofs --json");
  assert(Array.isArray(proofs.proofs), "proof inspection must return a proofs array");

  writeFileSync(
    path.join(repoPath, "src", "billing.js"),
    [
      "export function calculateTotal(subtotal, member) {",
      "  const discount = member ? 0.12 : 0;",
      "  return Math.round(subtotal * (1 - discount));",
      "}",
      ""
    ].join("\n")
  );

  const dirtyCompile = parseInstalledCliJson(grapeCli, repoPath, compileArgs, "grape compile dirty turn");
  assert(dirtyCompile.dirtyWorktree === true, "dirty compile must report dirty worktree");
  assert(
    dirtyCompile.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"),
    "dirty source edit must invalidate previous CLI context"
  );

  const dirtyStatus = parseInstalledCliJson(grapeCli, repoPath, ["status", "--json"], "grape status dirty --json");
  assert(dirtyStatus.dirtyWorktree === true, "status must report dirty worktree after source edit");

  const stale = parseInstalledCliJson(grapeCli, repoPath, ["stale", "--session", sessionId, "--json"], "grape stale --json");
  assert(stale.staleItems.length > 0, "stale inspection must list invalidated context after dirty compile");

  runGit(repoPath, ["add", "src/billing.js"]);
  runGit(repoPath, [
    "-c",
    "user.name=Grape Beta Trial",
    "-c",
    "user.email=grape@example.test",
    "commit",
    "-m",
    "cli core workflow change"
  ]);
}

async function runMcpBetaTrial(input) {
  const client = createMcpClient(input);
  const query = "Update billing discount in src/billing.js and keep tests current";
  const sessionId = "beta-client-trial-session";

  try {
    const initialize = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "grape-beta-client-trial", version: sourcePackage.version }
    });
    assert(initialize.result?.capabilities?.tools, "initialize must advertise tool capabilities");
    client.notify("notifications/initialized");

    const tools = await client.request("tools/list");
    const toolNames = new Set(tools.result?.tools?.map((tool) => tool.name));
    for (const requiredTool of ["grape_get_context", "grape_get_omitted_item", "grape_get_status"]) {
      assert(toolNames.has(requiredTool), `tools/list missing ${requiredTool}`);
    }
    assertNoLeaks("tools/list", tools, input.repoPath);

    const status = await client.callTool("grape_get_status", {});
    assert(status.isError !== true, status.content?.[0]?.text ?? "status failed");
    assertNoLeaks("grape_get_status", status, input.repoPath);

    const turn1 = await client.callTool("grape_get_context", {
      query,
      sessionId,
      files: ["src/billing.js"],
      tests: ["src/billing.test.js"]
    });
    assert(turn1.isError !== true, turn1.content?.[0]?.text ?? "turn1 failed");
    assert(turn1.structuredContent.contextPackItems.some((item) => item.state === "NEW"), "turn1 must send NEW context");
    assertNoLeaks("turn1", turn1, input.repoPath);

    const turn2 = await client.callTool("grape_get_context", {
      query,
      sessionId,
      files: ["src/billing.js"],
      tests: ["src/billing.test.js"]
    });
    assert(turn2.isError !== true, turn2.content?.[0]?.text ?? "turn2 failed");
    assert(
      turn2.structuredContent.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"),
      "turn2 must omit unchanged context"
    );
    const restorable = turn2.structuredContent.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
    assert(restorable?.restoreId, "turn2 must expose a restore token");

    const restored = await client.callTool("grape_get_omitted_item", {
      sessionId,
      restoreToken: restorable.restoreId
    });
    assert(restored.isError !== true, restored.content?.[0]?.text ?? "restore failed");
    assert(restored.structuredContent.status === "restored", "restore must return restored status");
    assertNoLeaks("restore", restored, input.repoPath);

    writeFileSync(
      path.join(input.repoPath, "src", "billing.js"),
      [
        "export function calculateTotal(subtotal, member) {",
        "  const discount = member ? 0.15 : 0;",
        "  return Math.round(subtotal * (1 - discount));",
        "}",
        ""
      ].join("\n")
    );

    const dirtyTurn = await client.callTool("grape_get_context", {
      query,
      sessionId,
      files: ["src/billing.js"],
      tests: ["src/billing.test.js"]
    });
    assert(dirtyTurn.isError !== true, dirtyTurn.content?.[0]?.text ?? "dirty turn failed");
    assert(dirtyTurn.structuredContent.dirtyWorktree === true, "dirty turn must report dirty worktree");
    assert(
      dirtyTurn.structuredContent.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"),
      "dirty source edit must invalidate previous context"
    );

    const staleRestore = await client.callTool("grape_get_omitted_item", {
      sessionId,
      restoreToken: restorable.restoreId
    });
    assert(staleRestore.isError === true, "stale restore must return an MCP error result");
    assert(staleRestore.structuredContent.status === "stale", "stale restore must return stale status");
    assert(!("body" in staleRestore.structuredContent), "stale restore must not return a body");

    const mismatch = await client.callTool("grape_get_context", {
      query: "Explain a different billing task",
      sessionId
    });
    assert(mismatch.isError === true, "task mismatch must return an MCP error result");
    assert(Array.isArray(mismatch.structuredContent.recoveryGuidance), "task mismatch must include recovery guidance");
    assert(
      mismatch.structuredContent.recoveryGuidance.some((item) => item.includes("Reuse the exact original")),
      "task mismatch guidance must tell the agent how to recover"
    );

    const reset = await client.callTool("grape_get_context", {
      query,
      sessionId,
      files: ["src/billing.js"],
      tests: ["src/billing.test.js"],
      resetSession: true
    });
    assert(reset.isError !== true, reset.content?.[0]?.text ?? "reset failed");
    assert(/^reset:/.test(reset.structuredContent.sessionResetId), "reset must report a session reset id");
    assert(
      reset.structuredContent.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"),
      "reset must invalidate previous context"
    );
    assert(
      reset.structuredContent.contextPackItems.some((item) => item.state === "NEW"),
      "reset must resend current context"
    );

    runGit(input.repoPath, ["add", "src/billing.js"]);
    runGit(input.repoPath, [
      "-c",
      "user.name=Grape Beta Trial",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "adjust discount"
    ]);
    runGit(input.repoPath, ["checkout", "-b", "beta-client-branch"]);
    writeFileSync(
      path.join(input.repoPath, "README.md"),
      "# beta client trial\n\nFeature branch branch-specific note.\n"
    );
    runGit(input.repoPath, ["add", "README.md"]);
    runGit(input.repoPath, [
      "-c",
      "user.name=Grape Beta Trial",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "branch trial change"
    ]);

    const branchTurn = await client.callTool("grape_get_context", {
      query,
      sessionId,
      files: ["src/billing.js"],
      tests: ["src/billing.test.js"]
    });
    assert(branchTurn.isError !== true, branchTurn.content?.[0]?.text ?? "branch turn failed");
    assert(branchTurn.structuredContent.branch === "beta-client-branch", "branch turn must use the new branch");
    assert(
      branchTurn.structuredContent.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"),
      "branch switch must invalidate previous context"
    );
    assertNoLeaks("branch turn", branchTurn, input.repoPath);
  } finally {
    await client.close();
  }
}

function createMcpClient(input) {
  const child = spawn(input.command, input.args, spawnOptionsForPlatform({
    cwd: input.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: input.env,
    shell: false
  }));

  let nextId = 1;
  let stdoutBuffer = Buffer.alloc(0);
  let stderr = "";
  const pending = new Map();
  const closed = new Promise((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal }));
  });

  child.stdout.on("data", (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, Buffer.from(chunk)]);
    const parsed = drainMcpMessages(stdoutBuffer);
    stdoutBuffer = parsed.rest;
    for (const message of parsed.messages) {
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      waiter.resolve(message);
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += Buffer.from(chunk).toString("utf8");
  });

  return {
    request(method, params) {
      return sendMcpRequest(child, pending, {
        jsonrpc: "2.0",
        id: nextId++,
        method,
        ...(params === undefined ? {} : { params })
      });
    },
    notify(method, params) {
      child.stdin.write(encodeMcpMessage({
        jsonrpc: "2.0",
        method,
        ...(params === undefined ? {} : { params })
      }));
    },
    async callTool(name, args) {
      const response = await this.request("tools/call", {
        name,
        arguments: args
      });
      assert(!response.error, `mcp ${name} returned JSON-RPC error: ${JSON.stringify(response.error)}`);
      assert(response.result, `mcp ${name} response missing tool result`);
      assertNoLeaks(name, response.result, input.repoPath);
      return response.result;
    },
    async close() {
      child.stdin.end();
      const exit = await closed;
      assert(exit.code === 0, `mcp stdio failed: ${stderr.trim() || `signal ${exit.signal}`}`);
    }
  };
}

function sendMcpRequest(child, pending, request) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(request.id);
      reject(new Error(`timed out waiting for mcp ${request.method}`));
    }, 20000);
    pending.set(request.id, {
      resolve: (message) => {
        clearTimeout(timeout);
        resolve(message);
      }
    });
    child.stdin.write(encodeMcpMessage(request), (error) => {
      if (!error) return;
      clearTimeout(timeout);
      pending.delete(request.id);
      reject(error);
    });
  });
}

function drainMcpMessages(buffer) {
  const messages = [];
  let rest = Buffer.from(buffer);
  while (rest.length > 0) {
    const newline = rest.indexOf(0x0a);
    if (newline < 0) break;
    const rawLine = rest.subarray(0, newline);
    const line = rawLine.length > 0 && rawLine[rawLine.length - 1] === 0x0d ? rawLine.subarray(0, rawLine.length - 1) : rawLine;
    messages.push(JSON.parse(line.toString("utf8")));
    rest = rest.subarray(newline + 1);
  }
  return { messages, rest };
}

function runInstalledCli(grapeCli, repoPath, args, label) {
  const result = spawnSync(process.execPath, [grapeCli, ...args], spawnOptionsForPlatform({
    cwd: repoPath,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: envWithSqliteNodeOptions(npmEnv()),
    shell: false,
    timeout: commandTimeoutMs
  }));
  assert(result.status === 0, `${label} failed: ${spawnFailureMessage(result)}`);
  assertNoLeaks(label, result.stdout, repoPath);
  assertNoLeaks(`${label} stderr`, result.stderr, repoPath);
  return result;
}

function runNpmExecGrape(repoPath, args, label) {
  const result = spawnSync(commandForPlatform("npm"), ["exec", "--", "grape", ...args], spawnOptionsForPlatform({
    cwd: repoPath,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: envWithSqliteNodeOptions(npmEnv()),
    timeout: commandTimeoutMs
  }));
  assert(result.status === 0, `${label} failed: ${spawnFailureMessage(result)}`);
  assertNoLeaks(label, result.stdout, repoPath);
  assertNoLeaks(`${label} stderr`, result.stderr, repoPath);
  return result;
}

function parseInstalledCliJson(grapeCli, repoPath, args, label) {
  const result = runInstalledCli(grapeCli, repoPath, args, label);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function runGit(repoPath, args) {
  execFileSync("git", ["-C", repoPath, ...args], { stdio: "ignore" });
}

function assertNoLeaks(label, value, repoPath) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert(!text.includes(repoPath), `${label} leaked absolute repo path`);
  assert(!text.includes("secret-beta-client-trial-value"), `${label} leaked ignored secret value`);
  assert(!text.includes("PRIVATE_TOKEN=value"), `${label} leaked ignored private file value`);
  assert(!text.includes("API_KEY=secret-beta-client-trial-value"), `${label} leaked ignored env value`);
}

function logStep(message) {
  console.log(`ok ${message}`);
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
