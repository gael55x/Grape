import { createHash, randomUUID } from "node:crypto";

import { riskOverlays, taskTypes, type RiskOverlay, type TaskType } from "../../../shared/index.js";

export function parseTaskType(value: string | undefined): TaskType {
  const taskType = value ?? "analysis";
  if ((taskTypes as readonly string[]).includes(taskType)) return taskType as TaskType;
  throw new Error(`unsupported task type: ${taskType}`);
}

export function parseRiskOverlays(value: string | undefined): RiskOverlay[] {
  if (!value) return [];
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const overlay of parsed) {
    if (!(riskOverlays as readonly string[]).includes(overlay)) {
      throw new Error(`unsupported risk overlay: ${overlay}`);
    }
  }
  return [...new Set(parsed)] as RiskOverlay[];
}

export function taskIdFor(task: string, taskType: TaskType, overlays: readonly RiskOverlay[]): string {
  return `task:${hashStableParts([taskType, overlays.join(","), sha256(task)]).slice(0, 16)}`;
}

export function sessionIdFor(repoId: string, branch: string, taskId: string): string {
  return `session:${hashStableParts([repoId, branch, taskId]).slice(0, 16)}`;
}

export function createLockToken(): string {
  return `lock:${randomUUID()}`;
}

export function assertSafeId(label: string, value: string): void {
  if (/^[a-zA-Z0-9._:-]{1,120}$/.test(value)) return;
  throw new Error(`${label} may only contain letters, numbers, dot, underscore, colon, or dash`);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hashStableParts(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(part.length));
    hash.update(":");
    hash.update(part);
    hash.update("\n");
  }
  return hash.digest("hex");
}
