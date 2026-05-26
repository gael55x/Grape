export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcErrorObject {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export type JsonRpcResponse =
  | {
      readonly jsonrpc: "2.0";
      readonly id: JsonRpcId;
      readonly result: unknown;
    }
  | {
      readonly jsonrpc: "2.0";
      readonly id: JsonRpcId;
      readonly error: JsonRpcErrorObject;
    };

export const jsonRpcErrors = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603
} as const;

const defaultMaxMcpFrameBytes = 4 * 1024 * 1024;

export function encodeMcpMessage(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

export function successResponse(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return data === undefined
    ? { jsonrpc: "2.0", id, error: { code, message } }
    : { jsonrpc: "2.0", id, error: { code, message, data } };
}

export function asJsonRpcRequest(value: unknown): JsonRpcRequest | undefined {
  if (!isRecord(value)) return undefined;
  if (value.jsonrpc !== "2.0") return undefined;
  if (typeof value.method !== "string") return undefined;
  const id = value.id;
  if (id !== undefined && id !== null && typeof id !== "string" && typeof id !== "number") return undefined;
  return {
    jsonrpc: "2.0",
    id: id as JsonRpcId | undefined,
    method: value.method,
    params: value.params
  };
}

export class McpMessageBuffer {
  #buffer = Buffer.alloc(0);
  readonly #maxFrameBytes: number;

  constructor(maxFrameBytes = defaultMaxMcpFrameBytes) {
    this.#maxFrameBytes = maxFrameBytes;
  }

  append(chunk: Buffer): unknown[] {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    if (this.#buffer.length > this.#maxFrameBytes) {
      this.reset();
      throw new Error("MCP message exceeds maximum frame size");
    }
    const messages: unknown[] = [];

    while (true) {
      const header = findHeader(this.#buffer);
      if (!header) break;

      const headerText = this.#buffer.subarray(0, header.end).toString("utf8");
      const contentLength = readContentLength(headerText);
      if (contentLength === undefined) {
        this.reset();
        throw new Error("MCP message is missing Content-Length header");
      }
      if (contentLength > this.#maxFrameBytes) {
        this.reset();
        throw new Error("MCP message exceeds maximum frame size");
      }

      const messageStart = header.end + header.separatorLength;
      const messageEnd = messageStart + contentLength;
      if (this.#buffer.length < messageEnd) break;

      const body = this.#buffer.subarray(messageStart, messageEnd).toString("utf8");
      this.#buffer = this.#buffer.subarray(messageEnd);
      messages.push(JSON.parse(body));
    }

    return messages;
  }

  reset(): void {
    this.#buffer = Buffer.alloc(0);
  }
}

function findHeader(buffer: Buffer): { readonly end: number; readonly separatorLength: number } | undefined {
  const crlf = buffer.indexOf("\r\n\r\n");
  if (crlf >= 0) return { end: crlf, separatorLength: 4 };
  const lf = buffer.indexOf("\n\n");
  if (lf >= 0) return { end: lf, separatorLength: 2 };
  return undefined;
}

function readContentLength(headerText: string): number | undefined {
  for (const line of headerText.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    if (name !== "content-length") continue;
    const parsed = Number.parseInt(line.slice(separator + 1).trim(), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
