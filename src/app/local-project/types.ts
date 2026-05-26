import type { LocalProjectConfig } from "./config.js";
import type { ContextPackBudgetResult } from "../../core/compiler/index.js";
import type { InMemoryTokenSavingsMetric } from "../../core/diff/index.js";
import type { ContextArtifactShape, ContextPackItemShape, RiskOverlay } from "../../shared/index.js";

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
  readonly tools: readonly [
    "grape_get_context",
    "grape_get_artifact",
    "grape_get_claims",
    "grape_get_proofs",
    "grape_get_omitted_item",
    "grape_get_status"
  ];
  readonly note: string;
}

export interface CompileLocalContextInput {
  readonly rootPath: string;
  readonly task: string;
  readonly taskType?: string;
  readonly riskOverlays?: string;
  readonly riskSeedRefs?: readonly string[];
  readonly seedFiles?: readonly string[];
  readonly seedSymbols?: readonly string[];
  readonly seedTests?: readonly string[];
  readonly tokenBudget?: number;
  readonly sessionId?: string;
  readonly resetSession?: boolean;
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
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly contextArtifact: ContextArtifactShape;
  readonly omittedItemCount: number;
  readonly sentItemCount: number;
  readonly tokenMetric: InMemoryTokenSavingsMetric;
  readonly budget: ContextPackBudgetResult;
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly artifactJsonPath: string;
  readonly artifactMarkdownPath: string;
  readonly sessionResetId?: string;
}

export interface OmittedContextSummary {
  readonly omittedItemId: string;
  readonly sessionId: string;
  readonly artifactId: string;
  readonly sectionId: string;
  readonly restoreId: string;
  readonly restoreCommand: string;
  readonly contentHash: string;
  readonly reasonOmitted: string;
  readonly omittedAt: string;
  readonly tokenCount: number;
}

export interface ListOmittedContextInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly migrationsDir?: string;
}

export interface ListOmittedContextResult {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly omittedItems: readonly OmittedContextSummary[];
}

export interface RestoreOmittedContextInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly restoreToken: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export type RestoreOmittedContextResult =
  | {
      readonly status: "restored";
      readonly rootPath: string;
      readonly sessionId: string;
      readonly restoreToken: string;
      readonly artifactId: string;
      readonly sectionId: string;
      readonly title: string;
      readonly body: string;
      readonly contentHash: string;
      readonly warnings: readonly string[];
    }
  | {
      readonly status: "stale";
      readonly rootPath: string;
      readonly sessionId: string;
      readonly restoreToken: string;
      readonly artifactId: string;
      readonly sectionId: string;
      readonly reason: string;
      readonly warnings: readonly string[];
    };

export interface LocalArtifactFileRefs {
  readonly json: string;
  readonly markdown: string;
  readonly jsonExists: boolean;
  readonly markdownExists: boolean;
}

export interface LocalArtifactSummary {
  readonly artifactId: string;
  readonly sessionId: string;
  readonly taskType: string;
  readonly riskOverlays: readonly string[];
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly createdAt: string;
  readonly artifactFiles: LocalArtifactFileRefs;
}

export interface LocalArtifactDependencySummary {
  readonly dependencyId: string;
  readonly kind: string;
  readonly ref: string;
  readonly hash: string;
  readonly scope: Record<string, unknown>;
}

export interface ListLocalArtifactsInput {
  readonly rootPath: string;
  readonly sessionId?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ListLocalArtifactsResult {
  readonly rootPath: string;
  readonly artifacts: readonly LocalArtifactSummary[];
}

export interface GetLocalArtifactInput {
  readonly rootPath: string;
  readonly artifactId: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface GetLocalArtifactResult extends LocalArtifactSummary {
  readonly rootPath: string;
  readonly dependencies: readonly LocalArtifactDependencySummary[];
}

export interface LocalProofSummary {
  readonly proofId: string;
  readonly claimId?: string;
  readonly sourceId: string;
  readonly sourceType?: string;
  readonly sourceRef?: string;
  readonly sourceScope?: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
  readonly privacyStatus?: string;
  readonly redactionStatus?: string;
  readonly createdAt: string;
}

export interface ListLocalProofsInput {
  readonly rootPath: string;
  readonly proofId?: string;
  readonly sourceId?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ListLocalProofsResult {
  readonly rootPath: string;
  readonly filter: {
    readonly proofId?: string;
    readonly sourceId?: string;
  };
  readonly proofs: readonly LocalProofSummary[];
}

export interface LocalClaimSummary {
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly verificationStatus: string;
  readonly scope: Record<string, unknown>;
  readonly scopeHash: string;
  readonly proofRefs: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListLocalClaimsInput {
  readonly rootPath: string;
  readonly activeOnly?: boolean;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ListLocalClaimsResult {
  readonly rootPath: string;
  readonly activeOnly: boolean;
  readonly claims: readonly LocalClaimSummary[];
  readonly rejectedCount: number;
  readonly warnings: readonly string[];
}
