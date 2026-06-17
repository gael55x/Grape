import type { Readable, Writable } from "node:stream";

import { PACKAGE_VERSION } from "../shared/package-version.js";
import {
  McpMessageBuffer,
  asJsonRpcRequest,
  encodeMcpMessage,
  errorResponse,
  jsonRpcErrors,
  successResponse,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse
} from "./protocol.js";
import { callMcpTool, listMcpTools, parseToolCallParams } from "./tools.js";

export interface StdioMcpServerOptions {
  readonly rootPath: string;
  readonly input?: Readable;
  readonly output?: Writable;
  readonly error?: Writable;
}

export async function runStdioMcpServer(options: StdioMcpServerOptions): Promise<number> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const error = options.error ?? process.stderr;
  const parser = new McpMessageBuffer();
  let queue = Promise.resolve();

  return new Promise((resolve) => {
    input.on("data", (chunk: Buffer | string) => {
      try {
        const messages = parser.append(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"));
        for (const message of messages) {
          queue = queue.then(() => handleParsedMessage(message, options.rootPath, output));
        }
      } catch (parseError) {
        writeResponse(
          output,
          errorResponse(null, jsonRpcErrors.parse, parseError instanceof Error ? parseError.message : String(parseError))
        );
      }
    });

    input.on("error", (streamError) => {
      error.write(`Grape MCP stdio input failed: ${streamError.message}\n`);
      resolve(1);
    });

    input.on("end", () => {
      try {
        const messages = parser.flush();
        for (const message of messages) {
          queue = queue.then(() => handleParsedMessage(message, options.rootPath, output));
        }
      } catch (parseError) {
        writeResponse(
          output,
          errorResponse(null, jsonRpcErrors.parse, parseError instanceof Error ? parseError.message : String(parseError))
        );
      }

      queue
        .then(() => resolve(0))
        .catch((serverError: unknown) => {
          error.write(`Grape MCP stdio server failed: ${serverError instanceof Error ? serverError.message : String(serverError)}\n`);
          resolve(1);
        });
    });

    input.resume();
  });
}

async function handleParsedMessage(message: unknown, rootPath: string, output: Writable): Promise<void> {
  const request = asJsonRpcRequest(message);
  if (!request) {
    writeResponse(output, errorResponse(null, jsonRpcErrors.invalidRequest, "Invalid JSON-RPC request"));
    return;
  }

  const response = await dispatchRequest(request, rootPath);
  if (response) writeResponse(output, response);
}

async function dispatchRequest(request: JsonRpcRequest, rootPath: string): Promise<JsonRpcResponse | undefined> {
  const id = request.id;
  const isNotification = id === undefined;

  try {
    switch (request.method) {
      case "initialize":
        return respondIfNeeded(id, {
          protocolVersion: requestedProtocolVersion(request.params),
          capabilities: { tools: {} },
          serverInfo: { name: "grape", version: PACKAGE_VERSION }
        });
      case "notifications/initialized":
      case "$/cancelRequest":
        return undefined;
      case "ping":
        return respondIfNeeded(id, {});
      case "tools/list":
        return respondIfNeeded(id, listMcpTools());
      case "tools/call":
        return respondIfNeeded(id, callMcpTool(parseToolCallParams(request.params), rootPath));
      default:
        return isNotification
          ? undefined
          : errorResponse(id, jsonRpcErrors.methodNotFound, `Method not found: ${request.method}`);
    }
  } catch (error) {
    return isNotification
      ? undefined
      : errorResponse(id, jsonRpcErrors.invalidParams, error instanceof Error ? error.message : String(error));
  }
}

function respondIfNeeded(id: JsonRpcId | undefined, result: unknown): JsonRpcResponse | undefined {
  return id === undefined ? undefined : successResponse(id, result);
}

function requestedProtocolVersion(params: unknown): string {
  if (typeof params === "object" && params !== null && "protocolVersion" in params) {
    const value = (params as { readonly protocolVersion?: unknown }).protocolVersion;
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "2024-11-05";
}

function writeResponse(output: Writable, response: JsonRpcResponse): void {
  output.write(encodeMcpMessage(response));
}
