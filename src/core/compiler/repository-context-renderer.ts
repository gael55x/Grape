import type {
  ContextArtifactShape,
  ContextPackItemShape,
  InMemoryContextArtifactShape
} from "../../shared/index.js";
import type { ContextPackBudgetResult } from "./context-budget.js";

export interface RepositoryContextRenderTokenMetric {
  readonly naiveTokens: number;
  readonly grapeTokens: number;
  readonly reductionPercent: number;
}

export interface RepositoryContextRenderInput {
  readonly artifact: InMemoryContextArtifactShape;
  readonly contextArtifact: ContextArtifactShape;
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly omittedItems: readonly { readonly sectionId: string; readonly restoreId?: string }[];
  readonly tokenMetric: RepositoryContextRenderTokenMetric;
  readonly budget?: ContextPackBudgetResult;
}

export function renderRepositoryContextPackJson(input: RepositoryContextRenderInput): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      artifactFormat: "grape.context-pack.v1",
      artifactFormatVersion: input.contextArtifact.artifactFormatVersion,
      contextArtifact: input.contextArtifact,
      contextPackItemShape: "ContextPackItem",
      contextPackItems: input.contextPackItems,
      omittedItems: input.omittedItems,
      tokenMetric: input.tokenMetric,
      budget: input.budget
    },
    null,
    2
  )}\n`;
}

export function renderRepositoryScaffoldArtifactJson(artifact: InMemoryContextArtifactShape): string {
  return `${JSON.stringify(
    {
      artifactShape: "InMemoryContextArtifactShape",
      artifact
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
    ...renderBudget(input.budget),
    ""
  ].join("\n");
}

function renderBudget(budget: ContextPackBudgetResult | undefined): string[] {
  if (!budget || budget.status === "not_requested") return [];
  return [
    "",
    "## Token Budget",
    "",
    `Budget: ${budget.tokenBudget}`,
    `Estimated pack tokens: ${budget.estimatedPackTokens}`,
    `Required context tokens: ${budget.requiredContextTokens}`,
    `Status: ${budget.status}`,
    `Warnings: ${budget.warnings.length === 0 ? "none" : budget.warnings.join(", ")}`,
    `Unsafe reasons: ${budget.unsafeReasons.length === 0 ? "none" : budget.unsafeReasons.join(", ")}`
  ];
}

function renderPackItem(item: ContextPackItemShape): string[] {
  return [
    `### ${item.state}: ${item.title}`,
    "",
    `Item: ${item.id}`,
    `Kind: ${item.itemKind}`,
    `Section: ${item.sectionId ?? "none"}`,
    `Content hash: ${item.contentHash}`,
    item.restoreId ? `Restore ID: ${item.restoreId}` : undefined,
    item.invalidatesSentItemId ? `Invalidates sent item: ${item.invalidatesSentItemId}` : undefined,
    "",
    item.content.length > 0 ? item.content : "_Content omitted; restore metadata is available._",
    ""
  ].filter((line): line is string => line !== undefined);
}
