import type { ContextSessionRecord } from "../../core/storage/index.js";
import type { TaskType } from "../../shared/index.js";

export interface EnsureCompileSessionInput {
  readonly existing: ContextSessionRecord | undefined;
  readonly sessionId: string;
  readonly lockToken: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly branch: string;
  readonly commit: string;
  readonly taskId: string;
  readonly taskType: TaskType;
  readonly now: string;
}

export interface EnsuredCompileSession {
  readonly existed: boolean;
  readonly record: ContextSessionRecord;
}

export function ensureCompileSession(input: EnsureCompileSessionInput): EnsuredCompileSession {
  if (input.existing) {
    assertSessionMatch("project", input.existing.projectId, input.projectId);
    assertSessionMatch("repo", input.existing.repoId, input.repoId);
    assertSessionMatch("branch", input.existing.branchName, input.branch);
    assertSessionMatch("task", input.existing.taskId, input.taskId);
    assertSessionMatch("task type", input.existing.taskType, input.taskType);
    if (input.existing.lockStatus === "locked" && input.existing.lockToken !== input.lockToken) {
      throw new Error(`context session is locked: ${input.sessionId}`);
    }
    return { existed: true, record: input.existing };
  }

  return {
    existed: false,
    record: {
      sessionId: input.sessionId,
      projectId: input.projectId,
      repoId: input.repoId,
      repoSnapshotId: input.snapshotId,
      worktreeStateId: input.worktreeStateId,
      agentName: "grape-cli",
      agentSessionId: input.sessionId,
      taskId: input.taskId,
      taskType: input.taskType,
      branchName: input.branch,
      baseCommitSha: input.commit,
      headCommitSha: input.commit,
      status: "active",
      lockToken: undefined,
      lockStatus: "unlocked",
      startedAt: input.now,
      lastSeenAt: input.now,
      createdAt: input.now,
      updatedAt: input.now
    }
  };
}

function assertSessionMatch(label: string, existing: string | undefined, next: string): void {
  if (existing === next) return;
  throw new Error(`context session ${label} mismatch; choose a different --session`);
}
