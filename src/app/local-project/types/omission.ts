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
