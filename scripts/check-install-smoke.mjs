import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertNodeSqliteAvailable, envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const root = process.cwd();
assertNodeSqliteAvailable();
const packDir = path.join(root, ".tmp", "install-smoke-pack");
const npmCacheDir = path.join(root, ".tmp", "npm-cache-install-smoke");
const sourcePackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
mkdirSync(npmCacheDir, { recursive: true });

const pack = spawnSync("npm", ["pack", "--pack-destination", packDir, "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8",
  env: npmEnv(),
  stdio: ["ignore", "pipe", "pipe"]
});
assert(pack.status === 0, `npm pack failed: ${pack.stderr.trim()}`);

const packedTarball = pack.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
const tarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
assert(tarballs.length === 1, `npm pack must produce exactly one tarball, found ${tarballs.length}`);
const tarball = tarballs[0];
assert(tarball === packedTarball, `selected tarball ${tarball} must match npm pack output ${packedTarball}`);

const consumerRepo = mkdtempSync(path.join(tmpdir(), "grape-install-smoke-"));
const tarballPath = path.join(packDir, tarball);

try {
  bootstrapGitRepo(consumerRepo);

  const install = spawnSync("npm", ["install", tarballPath], {
    cwd: consumerRepo,
    encoding: "utf8",
    env: npmEnv(),
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert(install.status === 0, `npm install failed: ${install.stderr.trim()}`);

  const grapeBin = path.join(consumerRepo, "node_modules", ".bin", "grape");
  assert(existsSync(grapeBin), "installed package is missing node_modules/.bin/grape");
  assertInstalledPackageMetadata(consumerRepo);

  const spawnGrape = (args) =>
    spawnSync(grapeBin, args, {
      cwd: consumerRepo,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: envWithSqliteNodeOptions(npmEnv())
    });

  const help = spawnGrape(["help"]);
  assert(help.status === 0, `grape help failed: ${help.stderr.trim()}`);
  assert(help.stdout.includes("grape"), "grape help produced no CLI output");

  const init = spawnGrape(["init", "--connect"]);
  assert(init.status === 0, `grape init failed: ${init.stderr.trim()}`);

  const compileArgs = ["compile", "--task", "install smoke", "--json"];
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

  const mcp = await runMcpStdioSession(grapeBin, consumerRepo, {
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

function encodeMcpFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

function drainMcpFrames(buffer) {
  const messages = [];
  let rest = Buffer.from(buffer);
  while (rest.length > 0) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = rest.subarray(0, headerEnd).toString("utf8");
    const match = /^Content-Length:\s*(\d+)$/im.exec(header);
    if (!match) break;
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (rest.length < bodyEnd) break;
    messages.push(JSON.parse(rest.subarray(bodyStart, bodyEnd).toString("utf8")));
    rest = rest.subarray(bodyEnd);
  }
  return { messages, rest };
}

async function runMcpStdioSession(grapeBin, repoPath, { query, sessionId }) {
  const child = spawn(grapeBin, ["mcp", "--stdio", "--repo", repoPath], {
    cwd: repoPath,
    stdio: ["pipe", "pipe", "pipe"],
    env: envWithSqliteNodeOptions(npmEnv())
  });

  let nextId = 1;
  let stdoutBuffer = Buffer.alloc(0);
  let stderr = "";
  const pending = new Map();

  child.stdout.on("data", (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, Buffer.from(chunk)]);
    const parsed = drainMcpFrames(stdoutBuffer);
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

  const closed = new Promise((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal }));
  });

  try {
    const initialize = await sendMcpRequest(child, pending, {
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "grape-install-smoke", version: sourcePackage.version }
      }
    }, "initialize");
    assert(!initialize.error, `mcp initialize failed: ${JSON.stringify(initialize.error)}`);
    assert(initialize.result?.capabilities?.tools, "mcp initialize must advertise tool capabilities");

    child.stdin.write(encodeMcpFrame({ jsonrpc: "2.0", method: "notifications/initialized" }));

    const tools = await sendMcpRequest(child, pending, {
      jsonrpc: "2.0",
      id: nextId++,
      method: "tools/list"
    }, "tools/list");
    assert(!tools.error, `mcp tools/list failed: ${JSON.stringify(tools.error)}`);
    const toolNames = new Set(tools.result?.tools?.map((tool) => tool.name));
    assert(toolNames.has("grape_get_context"), "mcp tools/list must include grape_get_context");
    assert(toolNames.has("grape_get_omitted_item"), "mcp tools/list must include grape_get_omitted_item");

    const turn1 = await callMcpTool(child, pending, nextId++, "grape_get_context", { query, sessionId });
    assert(turn1.isError !== true, `mcp turn 1 failed: ${turn1.content?.[0]?.text ?? "unknown"}`);
    assert(Array.isArray(turn1.structuredContent?.contextPackItems), "mcp turn 1 must include contextPackItems");

    const turn2 = await callMcpTool(child, pending, nextId++, "grape_get_context", { query, sessionId });
    assert(turn2.isError !== true, `mcp turn 2 failed: ${turn2.content?.[0]?.text ?? "unknown"}`);
    assert(Array.isArray(turn2.structuredContent?.contextPackItems), "mcp turn 2 must include contextPackItems");
    const restorable = turn2.structuredContent.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
    assert(restorable?.restoreId, "mcp turn 2 must include a restoreId");

    const restored = await callMcpTool(child, pending, nextId++, "grape_get_omitted_item", {
      sessionId,
      restoreToken: restorable.restoreId
    });
    assert(restored.isError !== true, `mcp restore failed: ${restored.content?.[0]?.text ?? "unknown"}`);

    child.stdin.end();
    const exit = await closed;
    assert(exit.code === 0, `mcp stdio failed: ${stderr.trim() || `signal ${exit.signal}`}`);

    return { turn1, turn2, restored };
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function callMcpTool(child, pending, id, name, args) {
  const response = await sendMcpRequest(child, pending, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args
    }
  }, name);
  assert(!response.error, `mcp ${name} returned JSON-RPC error: ${JSON.stringify(response.error)}`);
  assert(response.result, `mcp ${name} response missing tool result`);
  return response.result;
}

function sendMcpRequest(child, pending, request, label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(request.id);
      reject(new Error(`timed out waiting for mcp ${label}`));
    }, 15000);
    pending.set(request.id, {
      resolve: (message) => {
        clearTimeout(timeout);
        resolve(message);
      }
    });
    child.stdin.write(encodeMcpFrame(request), (error) => {
      if (!error) return;
      clearTimeout(timeout);
      pending.delete(request.id);
      reject(error);
    });
  });
}
