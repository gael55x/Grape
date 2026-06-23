import type { ContextArtifactShape } from "./context-artifact-contract.js";
import type { AgentContextPackItemShape } from "./agent-context-transport.js";
import type { ContextPackItemShape as PackItemShape } from "./contracts.js";
import { diffStates } from "./contracts.js";
import { displayRetrievalConfidenceState } from "./retrieval-confidence.js";

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
  readonly contextPackItems: readonly AgentContextMarkdownPackItem[];
  readonly packItemContentMode: "preview" | "full";
  readonly diffSummary: AgentContextDiffSummary;
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly budget: AgentContextBudgetSummary;
}

type AgentContextMarkdownPackItem = Pick<PackItemShape | AgentContextPackItemShape, "state" | "itemKind" | "sectionId">;

export function renderAgentContextPackMarkdown(input: AgentContextMarkdownInput): string {
  return [
    "# Grape Context Pack",
    "",
    ...renderArtifactSummary(input),
    ...renderDiffSummary(input),
    ...renderContextPackItems(input.contextPackItems, input.packItemContentMode),
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
    `Compile mode: ${artifact.compileMode}`,
    `Task type: ${artifact.taskType}`,
    `Risk overlays: ${formatInlineList(artifact.riskOverlays)}`,
    `Session: ${artifact.sessionId}`,
    `Branch: ${artifact.branch}`,
    `Head commit: ${artifact.headCommit}`,
    `Dirty worktree: ${formatBoolean(artifact.dirtyWorktree)}`,
    `Graph confidence: ${artifact.graphConfidence}`,
    `Retrieval confidence: ${formatRetrievalConfidence(artifact)}`,
    `Section count: ${artifact.outputSections.length}`
  ]);
}

function formatRetrievalConfidence(artifact: ContextArtifactShape): string {
  return artifact.retrievalConfidence
    ? displayRetrievalConfidenceState(artifact.retrievalConfidence.state)
    : "none";
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

function renderContextPackItems(
  items: readonly AgentContextMarkdownPackItem[],
  contentMode: AgentContextMarkdownInput["packItemContentMode"]
): string[] {
  const invalidationSummary = summarizeInvalidations(items);
  const contentMessage = contentMode === "full"
    ? "Exact item payloads are in contextPackItems[].content; relationships are in agentGraph."
    : "Compact item previews are in contextPackItems[].contentPreview; full item payloads require artifactRef.fullArtifactTool, grape_get_artifact outputMode=full, or grape_get_context outputMode=full.";

  return [
    "## Context Pack Items",
    "",
    ...(invalidationSummary.length > 0 ? invalidationSummary : []),
    items.length === 0
      ? "_No context pack items emitted._"
      : contentMessage,
    ""
  ];
}

function summarizeInvalidations(items: readonly AgentContextMarkdownPackItem[]): string[] {
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

function renderArtifactSections(sections: ContextArtifactShape["outputSections"]): string[] {
  const sectionIds = sections.map((sectionShape) => sectionShape.id).join(", ");
  const safetyCriticalCount = sections.filter((sectionShape) => sectionShape.safetyCritical).length;
  const restoreableCount = sections.filter((sectionShape) => sectionShape.restoreable).length;

  return [
    "## Artifact Sections",
    "",
    `Sections: ${sectionIds || "none"}`,
    `Safety critical sections: ${safetyCriticalCount}`,
    `Restoreable sections: ${restoreableCount}`,
    "Text: see artifactRef.artifactFiles.json or request outputMode=full for exact section bodies.",
    ""
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

function section(title: string, lines: readonly string[]): string[] {
  return [`## ${title}`, "", ...lines, ""];
}

function formatInlineList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no";
}
