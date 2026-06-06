import type { ContextPackBudgetResult } from "../../../core/compiler/index.js";
import type { InMemoryTokenSavingsMetric } from "../../../core/diff/index.js";
import type { ContextArtifactShape, ContextPackItemShape, RiskOverlay } from "../../../shared/index.js";

export interface CompileLocalContextInput {
  readonly rootPath: string;
  readonly task: string;
  readonly taskType?: string;
  readonly environmentScope?: ContextArtifactShape["environmentScope"];
  readonly featureFlags?: Readonly<Record<string, string | boolean>>;
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
  readonly recoveryGuidance: readonly string[];
  readonly artifactJsonPath: string;
  readonly artifactMarkdownPath: string;
  readonly databaseBackupPath?: string;
  readonly sessionResetId?: string;
}
