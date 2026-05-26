import { createHash } from "node:crypto";

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

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
