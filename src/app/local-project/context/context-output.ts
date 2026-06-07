import type {
  ContextArtifactShape,
  ContextScopeShape,
  ContextPackItemShape,
  InMemoryContextArtifactShape
} from "../../../shared/index.js";
import {
  buildContextArtifact,
  renderRepositoryContextPackJson,
  renderRepositoryContextPackMarkdown,
  renderRepositoryArtifactJson
} from "../../../core/compiler/index.js";
import type {
  ContextPackBudgetResult,
  RepositoryContextRenderTokenMetric
} from "../../../core/compiler/index.js";
import { assertArtifactTextHasNoSecrets } from "../../../core/security/index.js";
import { writeLocalArtifactFiles } from "./artifact-files.js";
import type { LocalArtifactWriteResult } from "./artifact-files.js";

export interface LocalContextArtifactProjectionInput {
  readonly artifact: InMemoryContextArtifactShape;
  readonly projectId: string;
  readonly repoSnapshotId: string;
  readonly worktreeStateId: string;
  readonly dirtyWorktree: boolean;
  readonly budget: ContextPackBudgetResult;
  readonly tokenCost: number;
  readonly environmentScope?: ContextArtifactShape["environmentScope"];
  readonly currentScope?: ContextScopeShape;
}

export interface LocalContextOutputInput extends LocalContextArtifactProjectionInput {
  readonly artifactDirPath: string;
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly omittedItems: readonly { readonly sectionId: string; readonly restoreId?: string }[];
  readonly tokenMetric: RepositoryContextRenderTokenMetric;
}

export function projectLocalContextArtifact(input: LocalContextArtifactProjectionInput): ContextArtifactShape {
  return buildContextArtifact(input);
}

export function writeLocalContextOutput(input: LocalContextOutputInput): LocalArtifactWriteResult {
  const contextArtifact = projectLocalContextArtifact(input);
  const renderInput = {
    artifact: input.artifact,
    contextArtifact,
    contextPackItems: input.contextPackItems,
    omittedItems: input.omittedItems,
    tokenMetric: input.tokenMetric,
    budget: input.budget
  };
  const json = renderRepositoryContextPackJson(renderInput);
  const markdown = renderRepositoryContextPackMarkdown(renderInput);
  const repositoryArtifactJson = renderRepositoryArtifactJson(input.artifact);

  assertArtifactTextHasNoSecrets(json, "context artifact JSON");
  assertArtifactTextHasNoSecrets(markdown, "context artifact Markdown");
  assertArtifactTextHasNoSecrets(repositoryArtifactJson, "repository artifact JSON");

  return writeLocalArtifactFiles({
    artifactDirPath: input.artifactDirPath,
    artifact: input.artifact,
    json,
    markdown,
    repositoryArtifactJson
  });
}
