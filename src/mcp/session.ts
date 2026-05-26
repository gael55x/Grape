import { createHash } from "node:crypto";

interface McpSessionIdentityInput {
  readonly query: string;
  readonly sessionId?: string;
  readonly agentName?: string;
  readonly agentSessionId?: string;
}

export function resolveMcpSessionId(input: McpSessionIdentityInput): string {
  if (input.sessionId) return input.sessionId;
  if (!input.agentSessionId) {
    throw new Error("grape_get_context requires sessionId or agentSessionId for session-scoped diffing");
  }

  const hash = createHash("sha256");
  hash.update(input.agentName ?? "unknown-agent");
  hash.update("\n");
  hash.update(input.agentSessionId);
  hash.update("\n");
  hash.update(input.query);
  return `mcp:${hash.digest("hex").slice(0, 24)}`;
}
