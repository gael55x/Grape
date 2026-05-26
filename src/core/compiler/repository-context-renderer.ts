import type {
  InMemoryContextArtifactShape,
  InMemoryContextPackItemShape
} from "../../shared/index.js";

export interface RepositoryContextRenderTokenMetric {
  readonly naiveTokens: number;
  readonly grapeTokens: number;
  readonly reductionPercent: number;
}

export interface RepositoryContextRenderInput {
  readonly artifact: InMemoryContextArtifactShape;
  readonly contextPackItems: readonly InMemoryContextPackItemShape[];
  readonly omittedItems: readonly { readonly sectionId: string; readonly restoreId?: string }[];
  readonly tokenMetric: RepositoryContextRenderTokenMetric;
}

export function renderRepositoryContextPackJson(input: RepositoryContextRenderInput): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      artifactShape: "InMemoryContextArtifactShape",
      artifact: input.artifact,
      contextPackItems: input.contextPackItems,
      omittedItems: input.omittedItems,
      tokenMetric: input.tokenMetric
    },
    null,
    2
  )}\n`;
}

export function renderRepositoryContextPackMarkdown(input: RepositoryContextRenderInput): string {
  return [
    "# Grape Context Pack",
    "",
    `Artifact: ${input.artifact.artifactId}`,
    `Session: ${input.artifact.input.sessionId}`,
    `Task: ${input.artifact.input.taskId}`,
    `Branch: ${input.artifact.input.branch}`,
    `Commit: ${input.artifact.input.commit}`,
    `Worktree hash: ${input.artifact.input.worktreeHash}`,
    `Warnings: ${input.artifact.warnings.length === 0 ? "none" : input.artifact.warnings.join(", ")}`,
    "",
    "## Context Pack Items",
    "",
    ...input.contextPackItems.flatMap(renderPackItem),
    "## Dependency Manifest",
    "",
    `Manifest: ${input.artifact.dependencyManifest.manifestId}`,
    `Hash: ${input.artifact.dependencyManifest.manifestHash}`,
    "",
    ...input.artifact.dependencyManifest.dependencies.map(
      (dependency) => `- ${dependency.id} (${dependency.kind}): ${dependency.ref} @ ${dependency.hash}`
    ),
    "",
    "## Token Metric",
    "",
    `Naive resend tokens: ${input.tokenMetric.naiveTokens}`,
    `Grape context pack tokens: ${input.tokenMetric.grapeTokens}`,
    `Reduction: ${input.tokenMetric.reductionPercent}%`,
    ""
  ].join("\n");
}

function renderPackItem(item: InMemoryContextPackItemShape): string[] {
  return [
    `### ${item.state}: ${item.title}`,
    "",
    `Section: ${item.sectionId}`,
    `Content hash: ${item.contentHash}`,
    item.restoreToken ? `Restore token: ${item.restoreToken}` : undefined,
    item.previousItemId ? `Previous item: ${item.previousItemId}` : undefined,
    "",
    item.body.length > 0 ? item.body : "_Body omitted; restore metadata is available._",
    ""
  ].filter((line): line is string => line !== undefined);
}
