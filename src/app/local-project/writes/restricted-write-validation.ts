import type { UserDecisionConfirmationChannel } from "../../../core/evidence/index.js";
import { sha256 } from "../context/compile-ids.js";

export function boundedString(value: string, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  if (value.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return value;
}

export function safeToken(value: string, label: string): string {
  boundedString(value, label, 200);
  if (!/^[A-Za-z0-9:_./-]+$/.test(value)) throw new Error(`${label} may only contain letters, numbers, :, _, ., /, or -`);
  return value;
}

export function normalizedScope(scope: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(scope)) throw new Error("scope must be an object");
  return JSON.parse(JSON.stringify(scope)) as Record<string, unknown>;
}

export function assertHashMatches(label: string, value: string, hash: string): void {
  const normalizedHash = normalizeSha256(label, hash);
  if (sha256(value) !== normalizedHash) throw new Error(`${label} does not match ${label.replace("Hash", "")}`);
}

export function normalizeSha256(label: string, value: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

export function normalizeTimestamp(label: string, value: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO timestamp`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO timestamp`);
  return new Date(parsed).toISOString();
}

export function normalizeConfirmationChannel(value: UserDecisionConfirmationChannel): UserDecisionConfirmationChannel {
  if (["cli_prompt", "mcp_user_confirmation", "config_file", "rule_file"].includes(value)) return value;
  throw new Error("confirmationChannel must be cli_prompt, mcp_user_confirmation, config_file, or rule_file");
}

export function requiredBoolean(value: boolean, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
