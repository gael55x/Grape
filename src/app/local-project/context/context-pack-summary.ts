import type {
  ContextSentItemRecord,
  StorageRepositories
} from "../../../core/storage/index.js";
import type { ContextPackSummarySentItemInput } from "../../../core/compression/index.js";
import type { InMemoryContextArtifactShape } from "../../../shared/index.js";
import { partitionPriorContextByStaleness } from "../../durable-context-staleness.js";

export interface ListContextPackSummarySentItemsInput {
  readonly repositories: StorageRepositories;
  readonly sessionId: string;
  readonly branch: string;
  readonly commit: string;
}

export interface ListCurrentContextPackSummarySentItemsInput
  extends ListContextPackSummarySentItemsInput {
  readonly artifact: InMemoryContextArtifactShape;
}

export function listContextPackSummarySentItems(
  input: ListContextPackSummarySentItemsInput
): readonly ContextPackSummarySentItemInput[] {
  return latestContextPackSummarySentItems(
    input.repositories.contextSentItems.listActiveBySessionScope({
      sessionId: input.sessionId,
      branchName: input.branch,
      commitSha: input.commit,
      excludedKind: "compression_artifact"
    })
  );
}

export function listCurrentContextPackSummarySentItems(
  input: ListCurrentContextPackSummarySentItemsInput
): readonly ContextPackSummarySentItemInput[] {
  const sentPackItems = input.repositories.contextPackItems.listActiveSentPayloadsBySession(input.sessionId);
  const activePriorItems = input.repositories.contextSentItems.listActiveBySession(input.sessionId)
    .filter((item) => item.itemKind !== "compression_artifact");
  const { currentPriorItems } = partitionPriorContextByStaleness({
    activePriorItems,
    packItems: sentPackItems,
    artifact: input.artifact,
    listDependenciesByArtifact: (artifactId) =>
      input.repositories.contextDependencies.listByArtifact(artifactId),
    forceStale: false
  });

  return latestContextPackSummarySentItems(currentPriorItems);
}

function latestContextPackSummarySentItems(
  sentItems: readonly ContextSentItemRecord[]
): readonly ContextPackSummarySentItemInput[] {
  const latestBySection = new Map<string, ContextSentItemRecord>();

  for (const item of sentItems) {
    const previous = latestBySection.get(item.sectionId);
    if (!previous || compareSentItems(item, previous) > 0) {
      latestBySection.set(item.sectionId, item);
    }
  }

  return [...latestBySection.values()]
    .sort((left, right) => left.sectionId.localeCompare(right.sectionId))
    .map(toContextPackSummarySentItem);
}

function compareSentItems(left: ContextSentItemRecord, right: ContextSentItemRecord): number {
  const lastSentCompare = left.lastSentAt.localeCompare(right.lastSentAt);
  if (lastSentCompare !== 0) return lastSentCompare;
  return left.sentItemId.localeCompare(right.sentItemId);
}

function toContextPackSummarySentItem(item: ContextSentItemRecord): ContextPackSummarySentItemInput {
  return {
    sentItemId: item.sentItemId,
    artifactId: item.artifactId,
    sectionId: item.sectionId,
    itemKind: item.itemKind,
    itemRef: item.itemRef,
    itemHash: item.itemHash,
    contentHash: item.contentHash,
    diffState: item.lastDiffState,
    wasPinned: item.wasPinned,
    firstSentAt: item.firstSentAt,
    lastSentAt: item.lastSentAt,
    sendCount: item.sendCount,
    tokenCount: item.tokenCount
  };
}
