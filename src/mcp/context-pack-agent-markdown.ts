import type { ContextArtifactShape, ContextPackItemShape } from "../shared/index.js";
import { diffStates } from "../shared/index.js";

export interface AgentContextDiffSummary {
  readonly newItems: number;
  readonly changedItems: number;
  readonly pinnedItems: number;
  readonly omittedItems: number;
  readonly invalidatedItems: number;
  readonly restoreAvailableItems: number;
}

interface AgentContextBudgetSummary {
  readonly status: string;
  readonly tokenBudget?: number;
  readonly estimatedPackTokens: number;
  readonly requiredContextTokens: number;
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
}

export interface AgentContextMarkdownInput {
  readonly artifactId: string;
  readonly contextArtifact: ContextArtifactShape;
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly diffSummary: AgentContextDiffSummary;
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly budget: AgentContextBudgetSummary;
}

export function renderAgentContextPackMarkdown(input: AgentContextMarkdownInput): string {
  return [
    "# Grape Context Pack",
    "",
    ...renderArtifactSummary(input),
    ...renderDiffSummary(input),
    ...renderContextPackItems(input.contextPackItems),
    ...renderArtifactSections(input.contextArtifact.outputSections),
    ...renderTokenBudget(input.budget),
    ...renderWarningsAndSafety(input),
    ""
  ].join("\n");
}

function renderArtifactSummary(input: AgentContextMarkdownInput): string[] {
  const artifact = input.contextArtifact;
  return section("Artifact Summary", [
    `Artifact: ${input.artifactId}`,
    "Artifact format: grape.context-pack.v1",
    `Artifact format version: ${artifact.artifactFormatVersion}`,
    `Compile mode: ${artifact.compileMode}`,
    `Task type: ${artifact.taskType}`,
    `Risk overlays: ${formatInlineList(artifact.riskOverlays)}`,
    `Project: ${artifact.projectId}`,
    `Repo: ${artifact.repoId}`,
    `Session: ${artifact.sessionId}`,
    `Task: ${artifact.taskId ?? "none"}`,
    `Branch: ${artifact.branch}`,
    `Head commit: ${artifact.headCommit}`,
    `Dirty worktree: ${formatBoolean(artifact.dirtyWorktree)}`,
    `Environment: ${artifact.environmentScope}`,
    `Confidence: ${artifact.confidence}`,
    `Graph confidence: ${artifact.graphConfidence}`,
    `Content hash: ${artifact.contentHash}`,
    `Created at: ${artifact.createdAt}`
  ]);
}

function renderDiffSummary(input: AgentContextMarkdownInput): string[] {
  const counts = new Map<string, number>();
  for (const state of diffStates) counts.set(state, 0);
  for (const item of input.contextPackItems) counts.set(item.state, (counts.get(item.state) ?? 0) + 1);

  return section("Diff Summary", [
    `Total context pack items: ${input.contextPackItems.length}`,
    ...diffStates.map((state) => `- ${state}: ${counts.get(state) ?? 0}`),
    `Restore available: ${input.diffSummary.restoreAvailableItems > 0 ? "yes" : "no"}`
  ]);
}

function renderContextPackItems(items: readonly ContextPackItemShape[]): string[] {
  const invalidationSummary = summarizeInvalidations(items);
  const itemLines = items.flatMap((item) =>
    item.state === "INVALIDATE_PREVIOUS" ? renderCompactInvalidationItem(item) : renderPackItem(item)
  );

  return [
    "## Context Pack Items",
    "",
    ...(invalidationSummary.length > 0 ? invalidationSummary : []),
    ...(items.length === 0 ? ["_No context pack items emitted._", ""] : itemLines)
  ];
}

function summarizeInvalidations(items: readonly ContextPackItemShape[]): string[] {
  const invalidations = items.filter((item) => item.state === "INVALIDATE_PREVIOUS");
  if (invalidations.length === 0) return [];

  const groups = new Map<string, number>();
  for (const item of invalidations) {
    const key = `${item.itemKind}:${item.sectionId ?? "none"}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return [
    "### INVALIDATE_PREVIOUS Summary",
    "",
    `Invalidated items: ${invalidations.length}`,
    "Grouped invalidations:",
    ...[...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => `- ${key}: ${count}`),
    "Full invalidatesSentItemId values remain in contextPackItems.",
    ""
  ];
}

function renderPackItem(item: ContextPackItemShape): string[] {
  return [
    `### ${item.state}: ${item.title}`,
    "",
    ...renderItemMetadata(item),
    "Input refs:",
    ...renderInputRefs(item.inputRefs),
    "Content: see contextPackItems[].content for the exact payload.",
    ""
  ];
}

function renderCompactInvalidationItem(item: ContextPackItemShape): string[] {
  return [
    `### ${item.state}: ${item.title}`,
    "",
    ...renderItemMetadata(item),
    "Input refs:",
    ...renderInputRefs(item.inputRefs),
    "Content omitted from Markdown; this row invalidates previously sent context.",
    ""
  ];
}

function renderItemMetadata(item: ContextPackItemShape): string[] {
  return [
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
    `Warnings: ${formatInlineList(item.warnings)}`
  ].filter((line): line is string => line !== undefined);
}

function renderArtifactSections(sections: ContextArtifactShape["outputSections"]): string[] {
  return [
    "## Artifact Sections",
    "",
    ...(sections.length === 0
      ? ["- none", ""]
      : sections.flatMap((sectionShape) =>
          [
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
            ...sectionShape.itemRefs.map((ref) => `- ${ref.kind}: ${ref.ref} @ ${ref.hash}`),
            "Text: see contextArtifact.outputSections[].text for the exact section body.",
            ""
          ].filter((line): line is string => line !== undefined)
        ))
  ];
}

function renderTokenBudget(budget: AgentContextBudgetSummary): string[] {
  if (budget.status === "not_requested") return section("Token Budget", ["Token budget: not requested"]);

  return section("Token Budget", [
    `Budget: ${budget.tokenBudget ?? "none"}`,
    `Estimated pack tokens: ${budget.estimatedPackTokens}`,
    `Required context tokens: ${budget.requiredContextTokens}`,
    `Status: ${budget.status}`,
    `Warnings: ${formatInlineList(budget.warnings)}`,
    `Unsafe reasons: ${formatInlineList(budget.unsafeReasons)}`
  ]);
}

function renderWarningsAndSafety(input: AgentContextMarkdownInput): string[] {
  const artifact = input.contextArtifact;
  return section("Warnings And Safety", [
    `Warnings: ${formatInlineList(input.warnings)}`,
    `Unsafe reasons: ${formatInlineList(input.unsafeReasons)}`,
    `Missing context: ${formatInlineList(artifact.missingContext)}`,
    `Blind spots: ${formatInlineList(artifact.blindSpots)}`,
    `Critical blind spots: ${formatInlineList(artifact.criticalBlindSpots)}`,
    `Unverified assumptions: ${formatInlineList(artifact.unverifiedAssumptions)}`,
    `Active contradictions: ${formatInlineList(artifact.activeContradictions)}`,
    `Omitted required: ${formatInlineList(artifact.omittedRequired)}`,
    `Impact candidate set too large: ${formatBoolean(artifact.impactCandidateSetTooLarge)}`
  ]);
}

function renderInputRefs(refs: readonly ContextPackItemShape["inputRefs"][number][]): string[] {
  if (refs.length === 0) return ["- none"];
  return refs.map((ref) => `- ${ref.id}: ${ref.kind} ${ref.ref} @ ${ref.hash}; scope=${formatScope(ref.scope)}`);
}

function section(title: string, lines: readonly string[]): string[] {
  return [`## ${title}`, "", ...lines, ""];
}

function formatInlineList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no";
}

function formatScope(scope: Record<string, unknown>): string {
  const keys = Object.keys(scope).sort();
  if (keys.length === 0) return "{}";
  return `{${keys.map((key) => `${key}=${String(scope[key])}`).join(", ")}}`;
}
