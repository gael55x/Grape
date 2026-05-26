import type { InMemorySentItemShape } from "../core/diff/index.js";
import type {
  ContextDependencyKind,
  ContextPackItemKind,
  ContextPackItemRecord,
  ContextSentItemRecord,
  OmittedContextItemRecord
} from "../core/storage/index.js";
import type {
  InMemoryContextArtifactShape,
  InMemoryContextDependencyShape,
  InMemoryContextPackItemShape,
  InMemoryContextSectionShape
} from "../shared/index.js";
import type { DurableContextBuildInput } from "./durable-context-build.js";

export function persistArtifact(input: DurableContextBuildInput): void {
  input.repositories.contextArtifacts.insert({
    artifactId: input.artifact.artifactId,
    sessionId: input.sessionId,
    snapshotId: input.snapshotId,
    artifactHash: input.artifact.artifactHash,
    dependencyManifestHash: input.artifact.dependencyManifest.manifestHash,
    taskType: input.artifact.input.taskType,
    riskOverlaysJson: JSON.stringify(input.artifact.input.riskOverlays),
    warningsJson: JSON.stringify(input.artifact.warnings),
    unsafeReasonsJson: JSON.stringify(input.artifact.unsafeReasons),
    createdAt: input.artifact.createdAt
  });

  for (const dependency of input.artifact.dependencyManifest.dependencies) {
    input.repositories.contextDependencies.insert({
      dependencyId: `${input.artifact.artifactId}:${dependency.id}`,
      artifactId: input.artifact.artifactId,
      dependencyKind: toStorageDependencyKind(dependency),
      dependencyRef: dependency.ref,
      dependencyHash: dependency.hash,
      scopeJson: JSON.stringify(dependency.scope),
      createdAt: input.artifact.createdAt
    });
  }
}

export function toInMemorySentItem(item: ContextSentItemRecord): InMemorySentItemShape {
  return {
    itemId: item.sentItemId,
    sessionId: item.sessionId,
    artifactId: item.artifactId,
    sectionId: item.sectionId,
    contentHash: item.contentHash,
    pinned: item.wasPinned,
    restoreToken: item.restoreHint
  };
}

export function createInvalidationPackItem(
  input: DurableContextBuildInput,
  previousItemId: string,
  sectionId: string,
  contentHash: string,
  reason: "dependency_manifest_changed" | "session_reset"
): InMemoryContextPackItemShape {
  return {
    itemId: `${input.sessionId}:${input.artifact.artifactId}:invalidate:${previousItemId}`,
    artifactId: input.artifact.artifactId,
    sessionId: input.sessionId,
    sectionId,
    state: "INVALIDATE_PREVIOUS",
    title: "Invalidate previous context",
    body: invalidationBody(previousItemId, reason),
    contentHash,
    previousItemId,
    pinned: false,
    warnings: [
      "previous_context_invalidated",
      reason === "session_reset" ? "session_reset_forced_full_resend" : "dependency_manifest_changed"
    ]
  };
}

export function toContextSentItem(
  input: DurableContextBuildInput,
  item: InMemoryContextPackItemShape,
  priorSentItems: readonly ContextSentItemRecord[]
): ContextSentItemRecord {
  const section = requireSection(input.artifact, item.sectionId);
  const previous = latestPriorSentItem(priorSentItems, item.sectionId);

  return {
    sentItemId: item.itemId,
    sessionId: input.sessionId,
    artifactId: input.artifact.artifactId,
    sectionId: item.sectionId,
    taskId: input.artifact.input.taskId,
    itemKind: itemKindForPackItem(item, section),
    itemRef: itemRefForSection(section),
    itemHash: item.contentHash,
    contentHash: item.contentHash,
    branchName: input.artifact.input.branch,
    commitSha: input.artifact.input.commit,
    dependencyManifestHash: input.artifact.dependencyManifest.manifestHash,
    wasPinned: item.pinned,
    lastDiffState: item.state,
    omitReason: item.safeOmissionReason,
    restoreHint: item.restoreToken,
    sessionResetId: input.sessionReset?.resetId,
    firstSentAt: previous?.firstSentAt ?? input.now,
    lastSentAt: input.now,
    sendCount: (previous?.sendCount ?? 0) + 1,
    tokenCount: estimateTextTokens(item.body)
  };
}

function invalidationBody(previousItemId: string, reason: "dependency_manifest_changed" | "session_reset"): string {
  if (reason === "session_reset") {
    return `Previously sent context item ${previousItemId} is invalid because the agent session was reset.`;
  }
  return `Previously sent context item ${previousItemId} is stale for this dependency manifest.`;
}

export function toOmittedContextItem(
  input: DurableContextBuildInput,
  sectionId: string,
  restoreToken: string
): OmittedContextItemRecord {
  const section = requireSection(input.artifact, sectionId);

  return {
    omittedItemId: `omitted:${restoreToken}`,
    sessionId: input.sessionId,
    artifactId: input.artifact.artifactId,
    sectionId,
    itemKind: itemKindForSection(section),
    itemRef: itemRefForSection(section),
    itemHash: section.contentHash,
    contentHash: section.contentHash,
    branchName: input.artifact.input.branch,
    commitSha: input.artifact.input.commit,
    dependencyManifestHash: input.artifact.dependencyManifest.manifestHash,
    lastDiffState: "OMIT_UNCHANGED",
    reasonOmitted: "unchanged_restorable",
    canRestore: true,
    restoreId: restoreToken,
    restoreCommand: `grape omitted --session ${input.sessionId} --token ${restoreToken}`,
    omittedAt: input.now,
    sendCount: 1,
    tokenCount: estimateTextTokens(section.body)
  };
}

export function toContextPackItem(
  input: DurableContextBuildInput,
  item: InMemoryContextPackItemShape
): ContextPackItemRecord {
  const section = input.artifact.sections.find((candidate) => candidate.id === item.sectionId);

  return {
    packItemId: item.itemId,
    sessionId: input.sessionId,
    artifactId: input.artifact.artifactId,
    sectionId: item.sectionId,
    diffState: item.state,
    itemKind: section ? itemKindForPackItem(item, section) : "invalidation",
    itemRef: item.previousItemId ?? (section ? itemRefForSection(section) : item.sectionId),
    contentHash: item.contentHash,
    tokenCount: estimateTextTokens(item.body),
    pinned: item.pinned,
    safetyCritical: item.pinned,
    invalidatesSentItemId: item.state === "INVALIDATE_PREVIOUS" ? item.previousItemId : undefined,
    restoreId: item.restoreToken,
    inputRefsJson: JSON.stringify(
      section?.dependencyRefs ?? input.artifact.dependencyManifest.dependencies.map((dep) => dep.id)
    ),
    createdAt: input.now
  };
}

export function isSentDiffState(item: InMemoryContextPackItemShape): boolean {
  return item.state === "NEW" || item.state === "CHANGED" || item.state === "PINNED";
}

function requireSection(
  artifact: InMemoryContextArtifactShape,
  sectionId: string
): InMemoryContextSectionShape {
  const section = artifact.sections.find((candidate) => candidate.id === sectionId);
  if (!section) {
    throw new Error(`context build section is missing: ${sectionId}`);
  }
  return section;
}

function latestPriorSentItem(
  priorSentItems: readonly ContextSentItemRecord[],
  sectionId: string
): ContextSentItemRecord | undefined {
  return priorSentItems
    .filter((item) => item.sectionId === sectionId)
    .sort((left, right) => left.lastSentAt.localeCompare(right.lastSentAt))
    .at(-1);
}

function itemKindForPackItem(
  item: InMemoryContextPackItemShape,
  section: InMemoryContextSectionShape
): ContextPackItemKind {
  if (item.state === "INVALIDATE_PREVIOUS") return "invalidation";
  if (item.state === "RESTORE_AVAILABLE") return "restore_hint";
  return itemKindForSection(section);
}

function itemKindForSection(section: InMemoryContextSectionShape): ContextPackItemKind {
  switch (section.type) {
    case "pinned_rule":
      return "rule";
    case "active_claim":
      return "claim";
    case "code_span":
    case "config_span":
      return "code_span";
    case "test_span":
      return "test_output";
    case "compression_orientation":
      return "compression_artifact";
    default:
      return "context_summary";
  }
}

function itemRefForSection(section: InMemoryContextSectionShape): string {
  return section.sourceRefs[0] ?? section.proofRefs[0] ?? section.id;
}

export function toStorageDependencyKind(dependency: InMemoryContextDependencyShape): ContextDependencyKind {
  switch (dependency.kind) {
    case "source_file":
      return "file";
    case "repo_snapshot":
      return "repo_snapshot";
    case "worktree_state":
      return "worktree_state";
    case "session_ledger":
      return "session_ledger";
    default:
      return dependency.kind;
  }
}

function estimateTextTokens(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : Math.ceil(normalized.length / 4);
}
