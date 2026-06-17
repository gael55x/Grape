import { spawn } from "node:child_process";
import { spawnOptionsForPlatform } from "./platform-command.mjs";

export function encodeMcpMessage(message) {
  return Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
}

export function parseMcpMessages(buffer) {
  return drainMcpMessages(buffer).messages;
}

export async function runMcpContextRestoreSession({
  command,
  args,
  cwd,
  env,
  clientInfo,
  query,
  sessionId,
  usePlatformShell = true,
  timeoutMs = 15000
}) {
  const child = spawn(command, args, spawnOptionsForPlatform({
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env,
    ...(usePlatformShell ? {} : { shell: false })
  }));

  let nextId = 1;
  let stdoutBuffer = Buffer.alloc(0);
  let stderr = "";
  const pending = new Map();

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

  const closed = new Promise((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal }));
  });

  try {
    const initialize = await sendMcpRequest(
      child,
      pending,
      {
        jsonrpc: "2.0",
        id: nextId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo
        }
      },
      "initialize",
      timeoutMs
    );
    assert(!initialize.error, `mcp initialize failed: ${JSON.stringify(initialize.error)}`);
    assert(initialize.result?.capabilities?.tools, "mcp initialize must advertise tool capabilities");

    child.stdin.write(encodeMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }));

    const tools = await sendMcpRequest(
      child,
      pending,
      { jsonrpc: "2.0", id: nextId++, method: "tools/list" },
      "tools/list",
      timeoutMs
    );
    assert(!tools.error, `mcp tools/list failed: ${JSON.stringify(tools.error)}`);
    const toolNames = new Set(tools.result?.tools?.map((tool) => tool.name));
    assert(toolNames.has("grape_get_context"), "mcp tools/list must include grape_get_context");
    assert(toolNames.has("grape_get_omitted_item"), "mcp tools/list must include grape_get_omitted_item");

    const turn1 = await callMcpTool(child, pending, nextId++, "grape_get_context", { query, sessionId }, timeoutMs);
    assert(turn1.isError !== true, `mcp turn 1 failed: ${turn1.content?.[0]?.text ?? "unknown"}`);
    assert(Array.isArray(turn1.structuredContent?.contextPackItems), "mcp turn 1 must include contextPackItems");

    const turn2 = await callMcpTool(child, pending, nextId++, "grape_get_context", { query, sessionId }, timeoutMs);
    assert(turn2.isError !== true, `mcp turn 2 failed: ${turn2.content?.[0]?.text ?? "unknown"}`);
    assert(Array.isArray(turn2.structuredContent?.contextPackItems), "mcp turn 2 must include contextPackItems");
    const restorable = turn2.structuredContent.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
    assert(restorable?.restoreId, "mcp turn 2 must include a restoreId");

    const restored = await callMcpTool(
      child,
      pending,
      nextId++,
      "grape_get_omitted_item",
      {
        sessionId,
        restoreToken: restorable.restoreId
      },
      timeoutMs
    );
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

async function callMcpTool(child, pending, id, name, args, timeoutMs) {
  const response = await sendMcpRequest(
    child,
    pending,
    {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    },
    name,
    timeoutMs
  );
  assert(!response.error, `mcp ${name} returned JSON-RPC error: ${JSON.stringify(response.error)}`);
  assert(response.result, `mcp ${name} response missing tool result`);
  return response.result;
}

function sendMcpRequest(child, pending, request, label, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(request.id);
      reject(new Error(`timed out waiting for mcp ${label}`));
    }, timeoutMs);
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
