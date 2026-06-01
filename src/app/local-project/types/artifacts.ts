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
