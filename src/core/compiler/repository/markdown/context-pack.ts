import { diffStates } from "../../../../shared/index.js";
import type {
  ContextDependencyShape,
  ContextInputRefShape,
  ContextSectionItemRefShape,
  ContextSectionShape,
  ContextPackItemShape
} from "../../../../shared/index.js";
import type { ContextPackBudgetResult } from "../../pack/context-budget.js";
import type { RepositoryContextRenderInput } from "../render-types.js";

export function renderRepositoryContextPackMarkdown(input: RepositoryContextRenderInput): string {
  return [
    "# Grape Context Pack",
    "",
    ...renderArtifactSummary(input),
    ...renderDiffSummary(input.contextPackItems),
    ...renderContextPackItems(input.contextPackItems),
    ...renderOmittedAndRestore(input),
    ...renderArtifactSections(input.contextArtifact.outputSections),
    ...renderDependencyManifest(input),
    ...renderTokenMetric(input),
    ...renderWarningsAndSafety(input),
    ""
  ].join("\n");
}

function renderArtifactSummary(input: RepositoryContextRenderInput): string[] {
  const artifact = input.contextArtifact;
  return section("Artifact Summary", [
    `Artifact: ${input.artifact.artifactId}`,
    "Artifact format: grape.context-pack.v1",
    `Artifact format version: ${artifact.artifactFormatVersion}`,
    `Compile mode: ${artifact.compileMode}`,
    `Task type: ${artifact.taskType}`,
    `Risk overlays: ${formatInlineList(artifact.riskOverlays)}`,
    `Project: ${artifact.projectId}`,
    `Repo: ${artifact.repoId}`,
    `Session: ${artifact.sessionId}`,
    `Task: ${artifact.taskId ?? input.artifact.input.taskId}`,
    `Branch: ${artifact.branch}`,
    `Head commit: ${artifact.headCommit}`,
    `Dirty worktree: ${formatBoolean(artifact.dirtyWorktree)}`,
    `Worktree hash: ${input.artifact.input.worktreeHash}`,
    `Environment: ${artifact.environmentScope}`,
    `Confidence: ${artifact.confidence}`,
    `Graph confidence: ${artifact.graphConfidence}`,
    `Content hash: ${artifact.contentHash}`,
    `Created at: ${artifact.createdAt}`
  ]);
}

function renderDiffSummary(items: readonly ContextPackItemShape[]): string[] {
  const counts = new Map<string, number>();
  for (const state of diffStates) counts.set(state, 0);
  for (const item of items) counts.set(item.state, (counts.get(item.state) ?? 0) + 1);

  return section("Diff Summary", [
    `Total context pack items: ${items.length}`,
    ...diffStates.map((state) => `- ${state}: ${counts.get(state) ?? 0}`)
  ]);
}

function renderContextPackItems(items: readonly ContextPackItemShape[]): string[] {
  return [
    "## Context Pack Items",
    "",
    ...(items.length === 0 ? ["_No context pack items emitted._", ""] : items.flatMap(renderPackItem))
  ];
}

function renderPackItem(item: ContextPackItemShape): string[] {
  return [
    `### ${item.state}: ${item.title}`,
    "",
    `Item: ${item.id}`,
    `Kind: ${item.itemKind}`,
    `Item ref: ${item.itemRef}`,
    `Section: ${item.sectionId ?? "none"}`,
    `Content hash: ${item.contentHash}`,
    `Token count: ${item.tokenCount}`,
    `Pinned: ${formatBoolean(item.pinned)}`,
    `Safety critical: ${formatBoolean(item.safetyCritical)}`,
    item.restoreId ? `Restore ID: ${item.restoreId}` : undefined,
    item.invalidatesSentItemId ? `Invalidates sent item: ${item.invalidatesSentItemId}` : undefined,
    `Warnings: ${formatInlineList(item.warnings)}`,
    "Input refs:",
    ...renderInputRefs(item.inputRefs),
    "",
    item.content.length > 0 ? item.content : "_Content omitted; restore metadata is available._",
    ""
  ].filter((line): line is string => line !== undefined);
}

function renderOmittedAndRestore(input: RepositoryContextRenderInput): string[] {
  const omitted = [
    ...input.omittedItems.map((item) => ({
      id: item.sectionId,
      details: `section=${item.sectionId}, restore=${item.restoreId ?? "none"}`
    })),
    ...input.contextArtifact.omittedDueToBudget.map((item) => ({
      id: item.id,
      details: `item=${item.itemRef}, reason=${item.reasonOmitted}, restore=${item.restoreId ?? "none"}`
    }))
  ];

  return section("Omitted And Restore", omitted.length === 0 ? ["- none"] : omitted.map((item) => `- ${item.id}: ${item.details}`));
}

function renderArtifactSections(sections: readonly ContextSectionShape[]): string[] {
  return [
    "## Artifact Sections",
    "",
    ...(sections.length === 0 ? ["- none", ""] : sections.flatMap(renderArtifactSection))
  ];
}

function renderArtifactSection(sectionShape: ContextSectionShape): string[] {
  return [
    `### ${sectionShape.id}: ${sectionShape.title}`,
    "",
    `Type: ${sectionShape.type}`,
    `Content hash: ${sectionShape.contentHash}`,
    `Token count: ${sectionShape.tokenCount}`,
    `Pinned: ${formatBoolean(sectionShape.pinned)}`,
    `Safety critical: ${formatBoolean(sectionShape.safetyCritical)}`,
    `Requires exact code: ${formatBoolean(sectionShape.requiresExactCode)}`,
    `Can compress: ${formatBoolean(sectionShape.canCompress)}`,
    `Restoreable: ${formatBoolean(sectionShape.restoreable)}`,
    sectionShape.restoreHint ? `Restore hint: ${sectionShape.restoreHint}` : undefined,
    `Risk overlays: ${formatInlineList(sectionShape.riskOverlays)}`,
    "Item refs:",
    ...renderSectionRefs(sectionShape.itemRefs),
    ""
  ].filter((line): line is string => line !== undefined);
}

function renderDependencyManifest(input: RepositoryContextRenderInput): string[] {
  const manifest = input.contextArtifact.dependencyManifest;
  return [
    "## Dependency Manifest",
    "",
    `Manifest: ${input.artifact.dependencyManifest.manifestId}`,
    `Manifest version: ${manifest.manifestVersion}`,
    `Manifest hash: ${input.artifact.dependencyManifest.manifestHash}`,
    `Input hash: ${manifest.inputHash}`,
    `Generated at: ${manifest.generatedAt}`,
    "",
    ...(manifest.dependencies.length === 0 ? ["- none"] : manifest.dependencies.map(renderDependency)),
    ""
  ];
}

function renderDependency(dependency: ContextDependencyShape): string {
  return [
    `- ${dependency.id} (${dependency.kind}): ${dependency.ref} @ ${dependency.hash}`,
    `strength=${dependency.strength}`,
    `requiredForSafety=${formatBoolean(dependency.requiredForSafety)}`,
    `invalidates=${formatInlineList(dependency.invalidates)}`,
    `scope=${formatScope(dependency.scope)}`
  ].join("; ");
}

function renderTokenMetric(input: RepositoryContextRenderInput): string[] {
  return [
    "## Token Metric",
    "",
    `Naive resend tokens: ${input.tokenMetric.naiveTokens}`,
    `Grape context pack tokens: ${input.tokenMetric.grapeTokens}`,
    `Reduction: ${input.tokenMetric.reductionPercent}%`,
    ...renderBudget(input.budget)
  ];
}

function renderBudget(budget: ContextPackBudgetResult | undefined): string[] {
  if (!budget || budget.status === "not_requested") return ["Token budget: not requested", ""];

  return [
    "",
    "## Token Budget",
    "",
    `Budget: ${budget.tokenBudget}`,
    `Estimated pack tokens: ${budget.estimatedPackTokens}`,
    `Required context tokens: ${budget.requiredContextTokens}`,
    `Status: ${budget.status}`,
    `Warnings: ${formatInlineList(budget.warnings)}`,
    `Unsafe reasons: ${formatInlineList(budget.unsafeReasons)}`,
    ""
  ];
}

function renderWarningsAndSafety(input: RepositoryContextRenderInput): string[] {
  const artifact = input.contextArtifact;
  return section("Warnings And Safety", [
    `Warnings: ${formatInlineList(input.artifact.warnings)}`,
    `Unsafe reasons: ${formatInlineList(input.artifact.unsafeReasons)}`,
    `Missing context: ${formatInlineList(artifact.missingContext)}`,
    `Blind spots: ${formatInlineList(artifact.blindSpots)}`,
    `Critical blind spots: ${formatInlineList(artifact.criticalBlindSpots)}`,
    `Unverified assumptions: ${formatInlineList(artifact.unverifiedAssumptions)}`,
    `Active contradictions: ${formatInlineList(artifact.activeContradictions)}`,
    `Omitted required: ${formatInlineList(artifact.omittedRequired)}`,
    `Impact candidate set too large: ${formatBoolean(artifact.impactCandidateSetTooLarge)}`
  ]);
}

function renderInputRefs(refs: readonly ContextInputRefShape[]): string[] {
  if (refs.length === 0) return ["- none"];
  return refs.map((ref) => `- ${ref.id}: ${ref.kind} ${ref.ref} @ ${ref.hash}; scope=${formatScope(ref.scope)}`);
}

function renderSectionRefs(refs: readonly ContextSectionItemRefShape[]): string[] {
  if (refs.length === 0) return ["- none"];
  return refs.map((ref) => `- ${ref.kind}: ${ref.ref} @ ${ref.hash}`);
}

function section(title: string, lines: readonly string[]): string[] {
  return [`## ${title}`, "", ...lines, ""];
}

function formatInlineList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function formatBoolean(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function formatScope(scope: Record<string, unknown>): string {
  const entries = Object.entries(scope).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return "none";
  return JSON.stringify(Object.fromEntries(entries));
}
