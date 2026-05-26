import type {
  ContextArtifactShape,
  ContextPackItemShape,
  InMemoryContextArtifactShape
} from "../../shared/index.js";
import {
  buildV1ContextArtifact,
  renderRepositoryContextPackJson,
  renderRepositoryContextPackMarkdown,
  renderRepositoryScaffoldArtifactJson
} from "../../core/compiler/index.js";
import type {
  ContextPackBudgetResult,
  RepositoryContextRenderTokenMetric
} from "../../core/compiler/index.js";
import { assertArtifactTextHasNoSecrets } from "../../core/security/index.js";
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
}

export interface LocalContextOutputInput extends LocalContextArtifactProjectionInput {
  readonly artifactDirPath: string;
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly omittedItems: readonly { readonly sectionId: string; readonly restoreId?: string }[];
  readonly tokenMetric: RepositoryContextRenderTokenMetric;
}

export function projectLocalContextArtifact(input: LocalContextArtifactProjectionInput): ContextArtifactShape {
  return buildV1ContextArtifact(input);
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
  const scaffoldJson = renderRepositoryScaffoldArtifactJson(input.artifact);

  assertArtifactTextHasNoSecrets(json, "context artifact JSON");
  assertArtifactTextHasNoSecrets(markdown, "context artifact Markdown");
  assertArtifactTextHasNoSecrets(scaffoldJson, "context artifact scaffold JSON");

  return writeLocalArtifactFiles({
    artifactDirPath: input.artifactDirPath,
    artifact: input.artifact,
    json,
    markdown,
    scaffoldJson
  });
}
