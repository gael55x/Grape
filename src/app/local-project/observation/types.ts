export type ObservationSourceType = "command_run" | "test_run";
export type ObservationAuthority = "agent_reported" | "grape";

export interface RecordLocalCommandResultInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly command: string;
  readonly commandHash: string;
  readonly cwd: string;
  readonly exitCode: number;
  readonly stdoutHash: string;
  readonly stderrHash: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface RecordLocalGrapeObservedCommandResultInput extends RecordLocalCommandResultInput {
  readonly observedRunId: string;
}

export interface RecordLocalTestResultInput extends RecordLocalCommandResultInput {
  readonly passed: boolean;
  readonly testFramework?: string;
  readonly testFiles?: readonly string[];
}

export interface RecordLocalGrapeObservedTestResultInput extends RecordLocalTestResultInput {
  readonly observedRunId: string;
  /** Ephemeral combined stdout/stderr text for in-memory failure parsing only. Never persisted. */
  readonly failureOutputText?: string;
}

export interface RecordLocalObservationResult {
  readonly rootPath: string;
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly sourceType: ObservationSourceType;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly trustClass: "temporary" | "trusted";
  readonly durable: boolean;
  readonly durableClaim: boolean;
  readonly proofId?: string;
  readonly claimId?: string;
  readonly claimType?: string;
  readonly observedBy: ObservationAuthority;
  readonly observedRunId?: string;
  readonly inserted: boolean;
  readonly redactedFields: readonly string[];
  readonly warnings: readonly string[];
}

export interface ObservationContext {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
}
