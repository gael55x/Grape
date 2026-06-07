import type { LocalBootstrapDetection } from "./bootstrap-detection.js";
import type { LocalProjectConfig, LocalProjectConfigWriteStatus } from "./config.js";
import type { LocalScanDiagnostics } from "./scan-diagnostics.js";

export type DiagnosticStatus = "pass" | "warn" | "fail";

export interface DiagnosticCheck {
  readonly id: string;
  readonly status: DiagnosticStatus;
  readonly message: string;
  readonly detail?: string;
}

export interface InitializeLocalProjectInput {
  readonly rootPath: string;
  readonly connect?: boolean;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface InitializeLocalProjectResult {
  readonly rootPath: string;
  readonly grapeDirPath: string;
  readonly configPath: string;
  readonly databasePath: string;
  readonly configStatus: LocalProjectConfigWriteStatus;
  readonly configBackupPath?: string;
  readonly databaseBackupPath?: string;
  readonly excludeStatus: "updated" | "unchanged";
  readonly createdDirs: readonly string[];
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly migrationsApplied: readonly string[];
  readonly bootstrap: LocalBootstrapDetection;
  readonly scan: LocalScanDiagnostics;
  readonly mcp: McpConnectionGuide;
}

export interface LocalProjectStatus {
  readonly rootPath: string;
  readonly initialized: boolean;
  readonly grapeDirPath: string;
  readonly configPath: string;
  readonly databasePath: string;
  readonly config?: LocalProjectConfig;
  readonly databaseExists: boolean;
  readonly appliedMigrations: readonly string[];
  readonly pendingMigrations: readonly string[];
  readonly branch?: string;
  readonly headCommit?: string;
  readonly dirtyWorktree?: boolean;
  readonly snapshotHash?: string;
  readonly scan: LocalScanDiagnostics;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly recoveryGuidance: readonly string[];
}

export type ContextFreshnessStatus = "fresh" | "stale" | "partial" | "unsafe" | "unknown";

export interface LocalSessionFreshnessSummary {
  readonly sessionId: string;
  readonly status: ContextFreshnessStatus;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly sessionStatus: string;
  readonly lockStatus: string;
  readonly branchName: string;
  readonly headCommitSha: string;
  readonly taskType?: string;
  readonly lastSeenAt: string;
  readonly latestArtifactId?: string;
}

export interface LocalStatusSessionFreshness {
  readonly inspectedSessionCount: number;
  readonly activeSessionCount: number;
  readonly freshSessionCount: number;
  readonly staleSessionCount: number;
  readonly partialSessionCount: number;
  readonly unsafeSessionCount: number;
  readonly unknownSessionCount: number;
  readonly staleItemCount: number;
  readonly sessions: readonly LocalSessionFreshnessSummary[];
}

export interface LocalContextFreshness {
  readonly status: ContextFreshnessStatus;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedAt: string;
  readonly refreshRecommended: boolean;
}

export interface PublicLocalProjectStatus {
  readonly rootPath: string;
  readonly grapeDirPath: string;
  readonly configPath: string;
  readonly databasePath: string;
  readonly status: ContextFreshnessStatus;
  readonly freshness: LocalContextFreshness;
  readonly initialized: boolean;
  readonly configPresent: boolean;
  readonly databaseExists: boolean;
  readonly databaseReady: boolean;
  readonly migrationStatus: "current" | "pending" | "unknown";
  readonly appliedMigrations: readonly string[];
  readonly pendingMigrations: readonly string[];
  readonly branch?: string;
  readonly headCommit?: string;
  readonly dirtyWorktree?: boolean;
  readonly snapshotHash?: string;
  readonly scan: LocalScanDiagnostics;
  readonly sessionFreshness: LocalStatusSessionFreshness;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly recoveryGuidance: readonly string[];
  readonly refreshRecommendations: readonly string[];
}

export interface LocalProjectDoctor {
  readonly rootPath: string;
  readonly overallStatus: DiagnosticStatus;
  readonly checks: readonly DiagnosticCheck[];
  readonly recoveryGuidance: readonly string[];
}

export interface McpConnectionGuide {
  readonly status: "implemented";
  readonly implemented: true;
  readonly serverName: "grape";
  readonly command: "grape";
  readonly args: readonly string[];
  readonly cwd: string;
  readonly transport: "stdio";
  readonly tools: readonly [
    "grape_get_context",
    "grape_get_artifact",
    "grape_get_claims",
    "grape_get_proofs",
    "grape_get_rules",
    "grape_get_omitted_item",
    "grape_get_stale_items",
    "grape_get_conflicts",
    "grape_get_status",
    "grape_record_candidate",
    "grape_record_command_result",
    "grape_record_test_result",
    "grape_record_user_decision",
    "grape_request_user_confirmation"
  ];
  readonly note: string;
}
