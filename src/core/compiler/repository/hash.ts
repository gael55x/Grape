import { createHash } from "node:crypto";

export function hashStableJson(value: unknown): string {
  return sha256(JSON.stringify(value, stableJsonReplacer));
}

export function hashStableParts(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(part.length));
    hash.update(":");
    hash.update(part);
    hash.update("\n");
  }
  return hash.digest("hex");
}

function stableJsonReplacer(_key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
