import type { LocalProjectConfig } from "./config.js";
import type { InMemoryTokenSavingsMetric } from "../../core/diff/index.js";
import type { InMemoryContextPackItemShape, RiskOverlay } from "../../shared/index.js";

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
  readonly configStatus: "created" | "unchanged";
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
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface LocalProjectDoctor {
  readonly rootPath: string;
  readonly overallStatus: DiagnosticStatus;
  readonly checks: readonly DiagnosticCheck[];
}

export interface McpConnectionGuide {
  readonly status: "implemented";
  readonly implemented: true;
  readonly serverName: "grape";
  readonly command: "grape";
  readonly args: readonly string[];
  readonly cwd: string;
  readonly transport: "stdio";
  readonly tools: readonly ["grape_get_context", "grape_get_status"];
  readonly note: string;
}

export interface CompileLocalContextInput {
  readonly rootPath: string;
  readonly task: string;
  readonly taskType?: string;
  readonly riskOverlays?: string;
  readonly riskSeedRefs?: readonly string[];
  readonly sessionId?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface CompileLocalContextResult {
  readonly rootPath: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly riskOverlays: readonly RiskOverlay[];
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly contextPackItems: readonly InMemoryContextPackItemShape[];
  readonly omittedItemCount: number;
  readonly sentItemCount: number;
  readonly tokenMetric: InMemoryTokenSavingsMetric;
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly artifactJsonPath: string;
  readonly artifactMarkdownPath: string;
}
