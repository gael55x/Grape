import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const expectedPackage = "grape-context";
const expectedVersion = "0.1.0-alpha.3";
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

  const mcp = await runMcpStdioSession({ query: "global mcp smoke", sessionId: "global-smoke-mcp" });
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

async function runMcpStdioSession({ query, sessionId }) {
  const child = spawn("grape", ["mcp", "--stdio", "--repo", repoPath], {
    cwd: repoPath,
    stdio: ["pipe", "pipe", "pipe"],
    env: envWithSqliteNodeOptions(smokeEnv())
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
        clientInfo: { name: "grape-global-smoke", version: expectedVersion }
      }
    }, "initialize");
    assert(!initialize.error, `MCP initialize failed: ${JSON.stringify(initialize.error)}`);
    assert(initialize.result?.capabilities?.tools, "MCP initialize must advertise tool capabilities");

    child.stdin.write(encodeMcpFrame({ jsonrpc: "2.0", method: "notifications/initialized" }));

    const tools = await sendMcpRequest(child, pending, { jsonrpc: "2.0", id: nextId++, method: "tools/list" }, "tools/list");
    assert(!tools.error, `MCP tools/list failed: ${JSON.stringify(tools.error)}`);
    const toolNames = new Set(tools.result?.tools?.map((tool) => tool.name));
    assert(toolNames.has("grape_get_context"), "MCP tools/list must include grape_get_context");
    assert(toolNames.has("grape_get_omitted_item"), "MCP tools/list must include grape_get_omitted_item");

    const turn1 = await callMcpTool(child, pending, nextId++, "grape_get_context", { query, sessionId });
    const turn2 = await callMcpTool(child, pending, nextId++, "grape_get_context", { query, sessionId });
    const restorable = turn2.structuredContent.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
    assert(restorable?.restoreId, "MCP turn 2 must include a restoreId");
    const restored = await callMcpTool(child, pending, nextId++, "grape_get_omitted_item", {
      sessionId,
      restoreToken: restorable.restoreId
    });

    child.stdin.end();
    const exit = await closed;
    assert(exit.code === 0, `MCP stdio failed: ${stderr.trim() || `signal ${exit.signal}`}`);
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
    params: { name, arguments: args }
  }, name);
  assert(!response.error, `MCP ${name} returned JSON-RPC error: ${JSON.stringify(response.error)}`);
  assert(response.result?.isError !== true, `MCP ${name} failed: ${response.result?.content?.[0]?.text ?? "unknown"}`);
  assert(Array.isArray(response.result?.structuredContent?.contextPackItems) || name === "grape_get_omitted_item", `MCP ${name} response missing structured content`);
  return response.result;
}

function sendMcpRequest(child, pending, request, label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(request.id);
      reject(new Error(`timed out waiting for MCP ${label}`));
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
