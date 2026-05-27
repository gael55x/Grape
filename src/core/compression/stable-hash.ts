import { createHash } from "node:crypto";

export function hashStableJson(value: unknown): string {
  return sha256(JSON.stringify(value, stableJsonReplacer));
}

function stableJsonReplacer(_key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
  );
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
