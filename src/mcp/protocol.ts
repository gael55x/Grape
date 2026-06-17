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
  return Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
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
    return this.#drainDelimitedLines();
  }

  flush(): unknown[] {
    if (this.#buffer.length === 0) return [];
    const line = this.#buffer;
    this.#buffer = Buffer.alloc(0);
    return [this.#parseLine(line)];
  }

  #drainDelimitedLines(): unknown[] {
    const messages: unknown[] = [];

    while (true) {
      const newline = this.#buffer.indexOf(0x0a);
      if (newline < 0) break;

      const line = this.#buffer.subarray(0, newline);
      this.#buffer = this.#buffer.subarray(newline + 1);
      messages.push(this.#parseLine(line));
    }

    if (this.#buffer.length > this.#maxFrameBytes) {
      this.reset();
      throw new Error("MCP message exceeds maximum line size");
    }

    return messages;
  }

  #parseLine(rawLine: Buffer): unknown {
    const line = rawLine.length > 0 && rawLine[rawLine.length - 1] === 0x0d ? rawLine.subarray(0, rawLine.length - 1) : rawLine;
    if (line.length > this.#maxFrameBytes) {
      this.reset();
      throw new Error("MCP message exceeds maximum line size");
    }
    const text = line.toString("utf8");
    if (text.trim() === "") {
      this.reset();
      throw new Error("MCP stdio message line is empty");
    }
    if (/^content-length\s*:/i.test(text)) {
      this.reset();
      throw new Error("MCP stdio uses newline-delimited JSON messages, not Content-Length headers");
    }
    return JSON.parse(text);
  }

  reset(): void {
    this.#buffer = Buffer.alloc(0);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
